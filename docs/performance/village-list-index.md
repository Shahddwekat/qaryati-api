# Optimization: index for the village list

**Endpoint:** `GET /api/v1/villages` (list without `q`), sorted by `nameEn` by default.
**Change:** two composite indexes on `villages` and a matching tie-break in the query
(migration `20261114120000_villages_list_index`).

## Problem
The first k6 runs (`perf/k6/villages-read.js`, 5,000 test villages) showed the list as the
slowest read endpoint by far. On a Windows laptop with MySQL in Docker, a 20-second check gave:

| Endpoint | p95 |
|---|---|
| details | 19 ms |
| nearby | 18 ms |
| search | 21 ms |
| **list** | **173 ms** |

The list query is:
```sql
SELECT ... FROM villages
WHERE deleted_at IS NULL
ORDER BY name_en ASC, id ASC
LIMIT 20 OFFSET ?;
```
`EXPLAIN` showed that MySQL used **no index**, read **all ~5,000 rows** and sorted them
(`Using filesort`) on every request, only to return 20 of them:

| | key | rows | Extra |
|---|---|---|---|
| before | `NULL` | 4,864 | Using where; **Using filesort** |

The existing index on `deleted_at` alone cannot help with the order: almost every village
has `deleted_at = NULL`, so it does not narrow anything down, and it is not sorted by name.

## Change
1. New indexes (`prisma/schema.prisma`):
   ```prisma
   @@index([deletedAt, nameEn])
   @@index([deletedAt, nameAr])
   ```
   Inside `deleted_at IS NULL`, the index entries are already sorted by name, and InnoDB adds
   the primary key (`id`) to every index entry, so the order `name, id` comes for free.
   MySQL now reads the first matching entries in order and stops after `OFFSET + 20`.
2. The tie-break now follows the sort direction (`orderBy: [{ nameEn: order }, { id: order }]`
   instead of always `id: 'asc'`). With mixed directions (`name DESC, id ASC`) MySQL cannot
   read the index backwards and sorts again. The result order is still stable and complete.

`EXPLAIN` after the change:

| Sort | key | Extra |
|---|---|---|
| `nameEn` asc (default) | `villages_deleted_at_name_en_idx` | Using where; Using index |
| `nameEn` desc | `villages_deleted_at_name_en_idx` | Backward index scan; Using index |
| `nameAr` asc | `villages_deleted_at_name_ar_idx` | Using where; Using index |
| `nameAr` desc | `villages_deleted_at_name_ar_idx` | Backward index scan; Using index |

No more `filesort` for the name sorts.

## Results
Same data (5,000 test villages), same load (`villages-read.js`: ramp to 50 virtual users,
1 minute hold, about 4,200 requests), measured on a Linux test machine with MySQL 8:

| list endpoint | before | after | change |
|---|---|---|---|
| average | 13.6 ms | 6.1 ms | **−55%** |
| median | 12.6 ms | 5.3 ms | −58% |
| p95 | 22.1 ms | 10.6 ms | **−52%** |
| max | 46.4 ms | 28.4 ms | −39% |

The query alone (`EXPLAIN`ed query, run 300 times in a row): **5.5 ms → 0.85 ms** per query.

Other endpoints did not change in a meaningful way (all p95 below 20 ms), and there were
**0 failed requests** in both runs.

The gain grows with the number of villages: without the index the sort cost grows with
every village, with the index the query only reads `OFFSET + 20` index entries.

## Trade-offs
- Two more indexes: a little more disk space, and every insert/update of a village name
  updates two more index entries. Villages are read far more often than written, so this
  is a good trade.
- `COUNT(*)` for `meta.total` still counts all visible villages (through the `deleted_at`
  index). That is fast at this size; for much larger tables we could cache the total.
- Sorting by `createdAt` still sorts in memory (no index for it). It is not the default
  and rarely used; add `@@index([deletedAt, createdAt])` if that changes.
- Very deep pages (large `OFFSET`) still read all skipped index entries. Keyset ("after
  this name") pagination would fix that, but it would change the API.

## How to repeat the measurement
```
npm run perf:seed
npm run build
npm run start:prod
npm run perf:villages          # in a second terminal, ~2 minutes
```
For "before", check out the commit before this change, run `npx prisma migrate reset`
(or drop the two indexes by hand), and repeat. Remove the test data afterwards with
`npm run perf:seed -- --clean`.
