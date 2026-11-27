# Performance report

All four k6 scenarios were run on the same machine with the same data and the same load
profile. This page reports the results, the bottlenecks we found, and the optimization we made.

> **Read the numbers with the environment in mind:** everything ran on one Windows laptop, with
> MySQL in Docker Desktop and k6 on the same machine. Absolute times depend on the machine
> (on a Linux test machine the same endpoints were several times faster); compare runs only on
> the same machine. The raw k6 results are in [`results/`](results/).

## 1. Setup
| | |
|---|---|
| Machine | Windows 11 laptop |
| API | `npm run build` + `npm run start:prod` (Node.js 24.13, one process) |
| Database | MySQL 8.4 in Docker Desktop, Prisma 7 with the MariaDB driver adapter, pool of 10 connections |
| Load tool | k6 2.3.0 on the same laptop |
| Data | development seed + `npm run perf:seed`: 5,000 test villages, 11,603 names, 10,000 population records, 2,100 heritage rows |
| Code | `main` after PR #37 (includes the village list optimization from PR #29) |

**Load profile (the same for every scenario, `perf/k6/lib/config.js`):** ramp up to 50 virtual
users in 30 s, hold 50 users for 1 minute, ramp down in 20 s. Each virtual user waits
0.5 to 1.5 s between requests, like a person clicking. Because of this think time, the
throughput below is the throughput **at 50 users**, not the maximum the API could handle.

**Targets (thresholds):** p95 below 500 ms for every endpoint, fewer than 1% failed requests,
more than 99% of checks passing.

Login is rate limited (5 per minute per IP) and every k6 user has the same IP, so the API was
started with `LOGIN_RATE_LIMIT=100000` for these runs.

## 2. Results

### Overview
| Scenario | Kind | Requests | Throughput | Avg | Median | p95 | Max | Errors | Target |
|---|---|---|---|---|---|---|---|---|---|
| `villages-read.js` | read | 4,028 | 36.3 req/s | 62 ms | 45 ms | 174 ms | 335 ms | 0% | ✅ met |
| `heritage-read.js` | read | 4,217 | 38.2 req/s | 17 ms | 8 ms | 57 ms | 128 ms | 0% | ✅ met |
| `population-write.js` | authenticated write + review | 2,983 | 26.8 req/s | 613 ms | 581 ms | 1,039 ms | 1,201 ms | 0% | ❌ p95 too high |
| `auth.js` | login | 427 | 3.9 req/s | 9,333 ms | 10,852 ms | 12,347 ms | 13,295 ms | 0% | ❌ p95 far too high |

All checks passed in all runs (no wrong status codes, no missing data), and **no request failed**.

### Villages (read-heavy)
Visitors browsing: 35% list, 25% full-text search, 25% details, 15% nearby.

| Endpoint | Avg | Median | p95 | Max |
|---|---|---|---|---|
| list (`GET /villages`) | 49.6 ms | 37.5 ms | 135.7 ms | 242.6 ms |
| search (`GET /villages?q=`) | 77.4 ms | 59.6 ms | 207.0 ms | 327.4 ms |
| details (`GET /villages/:id`) | 72.5 ms | 53.2 ms | 202.6 ms | 334.8 ms |
| nearby (`GET /villages/:id/nearby`) | 44.2 ms | 29.8 ms | 127.5 ms | 206.8 ms |

### Heritage (read)
Each request lists one kind of heritage for a random test village.

| Endpoint | Avg | Median | p95 |
|---|---|---|---|
| landmarks | 18.1 ms | 8.6 ms | 61.6 ms |
| historical events | 16.9 ms | 8.7 ms | 52.1 ms |
| cultural traits | 15.9 ms | 8.3 ms | 49.0 ms |
| economic activities | 16.6 ms | 8.2 ms | 57.8 ms |
| facilities | 17.4 ms | 8.5 ms | 59.7 ms |

### Population (authenticated write and review)
40 contributors add population records while 10 verifiers read the review queue and verify
records, at the same time. Both log in once in `setup()`.

| Endpoint | Avg | Median | p95 | Max |
|---|---|---|---|---|
| create (`POST /villages/:id/population`) | 750.7 ms | 868.7 ms | 1,062.1 ms | 1,201.4 ms |
| review queue (`GET /verification/queue`) | 240.7 ms | 279.4 ms | 394.6 ms | 509.0 ms |
| verify (`PATCH /verification/population-records/:id/verify`) | 450.9 ms | 488.6 ms | 599.3 ms | 688.7 ms |

1,971 records created (all saved as `PENDING`), 479 verified. 1 expected duplicate (409) and
25 expected verify conflicts (two verifiers picking the same record) were counted separately,
not as errors.

### Login
50 users logging in again and again (on purpose, to load the password check).

| Endpoint | Avg | Median | p95 | Min |
|---|---|---|---|---|
| login (`POST /auth/login`) | 9,333 ms | 10,852 ms | 12,347 ms | 403 ms |

## 3. Bottlenecks

### Login: password hashing on one thread
The **fastest** login took 403 ms: that is the cost of one password check alone, with no
waiting. Passwords are checked with **bcrypt at cost 12**, which is slow on purpose so that
guessing passwords is expensive. We use `bcryptjs`, a pure JavaScript version, so every check
runs on Node's single JavaScript thread. That thread can do only a few checks per second
(3.9 per second here). With 50 users asking at the same time, each new login waits for all
the ones before it: the median grew to 10.9 s.

This is a capacity limit, not a bug: real users log in once, not every second. But it is the
clearest bottleneck in the system, and while the thread is hashing, other requests have to
wait for it too. Options, from smallest to largest:
1. Use the native `bcrypt` package: it hashes in Node's worker thread pool (4 threads by
   default), so several logins run in parallel and other requests are not slowed down.
2. Lower the cost to 10 (about 4 times faster), after a security decision (ADR).
3. Run several API processes (for example one per CPU core) behind a load balancer; this also
   needs a shared store for the login rate limit (see [security](../security.md)).

### Writes: transactions and the connection pool
Every write is done in an **interactive transaction** with its audit row (by design: the
change and its audit row are saved together or not at all). The fastest create took 190 ms
and the fastest verify 112 ms, but the medians are 869 ms and 489 ms. The difference is
**waiting**:
- An interactive transaction keeps one database connection for several round trips
  (`BEGIN`, reads, insert, audit insert, `COMMIT`). On this Windows + Docker setup each
  transaction costs well over 100 ms (we measured the same effect on the village list, see
  below).
- The pool has **10 connections** for 50 users. When all 10 are inside a transaction, the next
  requests wait for a free connection.

The review queue (`UNION ALL` over all fact tables, no transaction) stayed under the target
(p95 395 ms) even while 40 users were writing.

Options: measure with a bigger pool (for example 20); reduce round trips inside the
transactions; run MySQL on Linux instead of Docker Desktop on Windows (on our Linux test
machine the same transaction overhead was not visible).

### Reads
Reads meet the target. Heritage lists are fast (median 8 ms) because each is a small indexed
query per village. Village search and details are the slowest reads (p95 about 200 ms):
search uses full-text matching over all names, and details loads the village with its
governorate and municipality.

## 4. The optimization: faster village list
The first runs showed the village list as the slowest read: even the fastest list request
took 132 ms. We found two causes, fixed both and measured before and after with the same
data and load:

| list endpoint | before | after | change |
|---|---|---|---|
| average | 149.6 ms | 50.2 ms | **−66%** |
| median | 143.4 ms | 38.9 ms | **−73%** |
| p95 | 180.9 ms | 134.1 ms | −26% |

1. **Missing index for the sort:** `EXPLAIN` showed a full scan of all villages plus a sort
   on every request. New indexes on `(deleted_at, name_en)` and `(deleted_at, name_ar)` let
   MySQL read the rows already in order.
2. **An unneeded transaction around two reads:** removing it removed the fixed ~130 ms cost.

The list in this report (avg 49.6 ms, p95 135.7 ms) matches the "after" numbers, so the
improvement held. Full details, `EXPLAIN` output and trade-offs:
[village-list-index.md](village-list-index.md).

The same transaction overhead is the main cost of the write endpoints (section 3). There it
cannot simply be removed, because the audit row must be written together with the change,
so it stays a known limit with the options listed above.

## 5. How to repeat
```
npm run perf:seed
npm run build
set LOGIN_RATE_LIMIT=100000 && npm run start:prod        (Windows)
k6 run --summary-export=perf/results/villages-read.json    perf/k6/villages-read.js
k6 run --summary-export=perf/results/heritage-read.json    perf/k6/heritage-read.js
k6 run --summary-export=perf/results/auth.json             perf/k6/auth.js
k6 run --summary-export=perf/results/population-write.json perf/k6/population-write.js
npm run perf:seed -- --clean
```
The k6 summaries of the runs in this report are committed in [`results/`](results/)
(`villages-read.json`, `heritage-read.json`, `population-write.json`, `auth.json`; the login
tokens that k6 stores under `setup_data` were removed). In these files a threshold value of
`true` means the target was **missed**.
Results depend on the machine; compare runs only on the same machine. See
[perf/README.md](../../perf/README.md).
