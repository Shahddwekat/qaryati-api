# Optimization: faster village list

**Endpoint:** `GET /api/v1/villages` (list without `q`), sorted by `nameEn` by default.
**Changes:**
1. two composite indexes on `villages`, with a tie-break in the same direction as the sort
   (migration `20261114120000_villages_list_index`);
2. the page and the total are read in parallel, without a database transaction.

## Problem
The first k6 runs (`perf/k6/villages-read.js`, 5,000 test villages, ramp to 50 virtual users)
showed the list as the slowest read endpoint by far. On a Windows laptop with MySQL 8.4 in
Docker, **even the fastest list request took 132 ms**, while details and nearby answered in
2-3 ms. A fixed cost on every request pointed to how the list queries the database, not to load.

The list runs two queries: the page and `COUNT(*)` for `meta.total`:
```sql
SELECT ... FROM villages WHERE deleted_at IS NULL
ORDER BY name_en ASC, id ASC LIMIT 20 OFFSET ?;

SELECT COUNT(*) FROM villages WHERE deleted_at IS NULL;
```

We found two causes.

### Cause 1: no index for the sort order
`EXPLAIN` showed that MySQL used **no index**, read **all ~5,000 rows** and sorted them
(`Using filesort`) on every request, only to return 20:

| | key | rows | Extra |
|---|---|---|---|
| before | `NULL` | 4,864 | Using where; **Using filesort** |

The existing index on `deleted_at` alone does not help: almost every village has
`deleted_at = NULL`, so it narrows nothing down, and it is not sorted by name.

### Cause 2: a transaction for two reads
The service wrapped both queries in `prisma.$transaction([...])`. A transaction takes a
dedicated connection and adds extra round trips (`BEGIN` ... `COMMIT`). For a read-only list
that is not needed: if a village is added between the two queries, the total is off by one
for that single request, which is harmless. Search already ran its two queries in parallel
without a transaction, and its fastest request was 6 ms. On the Windows + Docker setup this
transaction overhead was the largest part of the 130 ms.

## Changes
1. **Indexes** (`prisma/schema.prisma`):
   ```prisma
   @@index([deletedAt, nameEn])
   @@index([deletedAt, nameAr])
   ```
   Inside `deleted_at IS NULL`, the index entries are already sorted by name, and InnoDB adds
   the primary key (`id`) to every index entry, so `name, id` order comes for free. MySQL reads
   the entries in order and stops after `OFFSET + 20`.
2. **Tie-break in the sort direction:** `orderBy: [{ nameEn: order }, { id: order }]` instead
   of always `id: 'asc'`. With mixed directions (`name DESC, id ASC`) MySQL cannot read the
   index backwards and sorts again. The order stays stable and complete.
3. **No transaction:** `Promise.all([findMany, count])` instead of `$transaction([...])`.

`EXPLAIN` after the change:

| Sort | key | Extra |
|---|---|---|
| `nameEn` asc (default) | `villages_deleted_at_name_en_idx` | Using where; Using index |
| `nameEn` desc | `villages_deleted_at_name_en_idx` | Backward index scan; Using index |
| `nameAr` asc | `villages_deleted_at_name_ar_idx` | Using where; Using index |
| `nameAr` desc | `villages_deleted_at_name_ar_idx` | Backward index scan; Using index |

No more `filesort` for the name sorts.

## Results
Same data (5,000 test villages) and the same load in every run (`npm run perf:villages`:
ramp to 50 virtual users in 30 s, hold 1 minute, ramp down; about 4,000 requests, 0 errors).

### Windows laptop, MySQL 8.4 in Docker (main measurement)
| list endpoint | before | index only | index + no transaction | change |
|---|---|---|---|---|
| average | 149.6 ms | 150.4 ms | **50.2 ms** | **−66%** |
| median | 143.4 ms | 143.6 ms | **38.9 ms** | **−73%** |
| p95 | 180.9 ms | 184.4 ms | **134.1 ms** | −26% |
| fastest | 132.0 ms | 131.2 ms | **3.6 ms** | |

Whole API (all four endpoints together), before → after:

| | before | after | change |
|---|---|---|---|
| average | 83.9 ms | 60.7 ms | −28% |
| median | 73.8 ms | 44.5 ms | −40% |
| p95 | 172.1 ms | 172.8 ms | same |
| requests in 1m50s | 3,940 | 4,023 | +2% |

Note: the p95 of details (144 → 193 ms) and search (152 → 206 ms) went up in the "after" run,
while their averages and medians changed much less. The laptop was also running Docker,
the API and k6 at the same time, so the slowest 5% vary between runs; we report the numbers
as measured. The list itself improved clearly in every statistic.

### Linux test machine, MySQL 8 (index only)
On a machine without the transaction overhead the index alone made a clear difference:

| list endpoint | before | after (index) | change |
|---|---|---|---|
| average | 13.6 ms | 6.1 ms | **−55%** |
| p95 | 22.1 ms | 10.6 ms | **−52%** |

The query alone (run 300 times in a row): **5.5 ms → 0.85 ms**.

### What we learned
- `EXPLAIN` found the missing index, but **fixing the query plan did not change the numbers
  on the laptop**: the measurement showed that another cost (the transaction) was bigger.
  Without measuring before and after we would have stopped after the index.
- The index matters more as data grows: without it the sort cost grows with every village,
  with it the query only reads `OFFSET + 20` index entries.

## Trade-offs
- Two more indexes: a little more disk space, and each insert/update of a village name
  updates two more index entries. Villages are read far more often than written.
- Without the transaction, `meta.total` can be off by one if a village is created or hidden
  between the two reads of the same request. Acceptable for a public list.
- `COUNT(*)` still counts all visible villages. Fast at this size; with much more data the
  total could be cached.
- Sorting by `createdAt` still sorts in memory (no index). It is not the default; add
  `@@index([deletedAt, createdAt])` if it becomes common.
- Very deep pages (large `OFFSET`) still read all skipped index entries. Keyset ("after this
  name") pagination would avoid that, but it would change the API.

## How to repeat the measurement
```
npm run perf:seed
npm run build
npm run start:prod
npm run perf:villages          # in a second terminal, ~2 minutes
```
Stop and restart `start:prod` after every `npm run build`, otherwise the old code keeps
running (port 3000 stays taken). For "before", check out the commit before this change and
drop the two indexes (or `npx prisma migrate reset`). Remove the test data afterwards with
`npm run perf:seed -- --clean`.
