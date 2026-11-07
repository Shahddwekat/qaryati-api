# Performance tests (k6)

We use [k6](https://grafana.com/docs/k6/latest/) to measure how fast the API answers
under load. Results and conclusions go in [`docs/performance/`](../docs/performance/).

## 1. Install k6 (once)
```
winget install k6 --source winget     # Windows (then open a NEW terminal)
brew install k6                       # macOS
```
Check: `k6 version`

## 2. Prepare the API and the data
Measure the **built** API, not `start:dev` (watch mode is slower and restarts on save).
```
docker compose up -d                  # MySQL
npx prisma db seed                    # users, sources, governorates (if not done yet)
npm run perf:seed                     # + 5,000 test villages (ids 10001-15000)
npm run build
npm run start:prod                    # API on http://localhost:3000
```
Or run the whole stack in Docker (`docker compose --profile app up --build`) and
run `npm run perf:seed` from your computer; both use the same database.

> **Before running `npm run test:e2e` again, remove the test villages:**
> `npm run perf:seed -- --clean`. The e2e tests expect only the 6 development villages
> (counts, sorting and nearby results would be different).

## 3. Run a scenario (in a second terminal)
```
k6 run -e QUICK=1 perf/k6/villages-read.js     # 20-second check that the script works
npm run perf:villages                          # real run (~2 minutes), saves perf/results/villages-read.json
```
Close other heavy programs while measuring, and run each scenario at least twice.

## Scenarios
| File | Who | What it measures |
|---|---|---|
| `villages-read.js` | Shahd | browsing: list, full-text search, details, nearby (read-only) |
| `auth.js` | Batool | login (and the shared login helper in `lib/`) |
| `population-write.js` | Dana | contributor adds population records, verifier verifies them |
| `heritage-read.js` | Jana | heritage lists for random villages |

Start a new scenario from [`k6/_template.js`](k6/_template.js).

## Load profile and targets (the same for every scenario)
- **Load:** ramp up to 50 virtual users in 30 s, hold 1 minute, ramp down in 20 s.
  Each virtual user waits 0.5-1.5 s between requests, like a real visitor.
- **Targets (thresholds):** fewer than 1% failed requests, p95 below 500 ms for every
  endpoint, more than 99% of checks passing. k6 prints ✓ or ✗ for each target.

## Reading the results
| Number | Meaning |
|---|---|
| `http_req_duration p(95)` | 95% of requests were faster than this. Our main number |
| `http_req_duration avg / med` | average / middle request time |
| `http_reqs` | total requests and requests per second (throughput) |
| `http_req_failed` | share of requests that returned an error |
| `{ name:search }` lines | the same numbers for one endpoint |

## Notes
- Requests that change data (POST/PATCH) need a token; once Batool's login rate limiting
  is merged, log in **once** in `setup()` and pass the token to the virtual users, not in every iteration.
- `perf/results/` is ignored by git; copy the numbers you need into the report.
