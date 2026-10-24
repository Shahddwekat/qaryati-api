# ADR-0006: Compute nearby villages from latitude/longitude instead of a spatial column

- **Status:** Accepted (supersedes the "Geography" point of ADR-0003)
- **Date:** 2026-10-23
- **Deciders:** Whole team

## Context
ADR-0003 and the first version of the ERD planned a `POINT SRID 4326` column on `villages`,
generated from `latitude`/`longitude`, with a `SPATIAL INDEX` for "nearby villages".

While writing the Prisma schema we found three problems with that plan:

1. Prisma has no spatial type. The column would have to be declared as `Unsupported("point")`.
2. A `SPATIAL INDEX` in MySQL requires the column to be `NOT NULL`. A **required** `Unsupported`
   field removes `create` from the Prisma Client for that model, so every village insert would
   have to be written in raw SQL.
3. If the column is left out of `schema.prisma`, the next `prisma migrate dev` sees it as
   drift and generates a migration that drops it.

## Options considered
1. **Generated `POINT` column + spatial index (original plan)**: fastest for very large
   datasets, but breaks normal Prisma CRUD on villages (points 2 and 3 above).
2. **Separate `village_locations` table filled by a trigger**: keeps CRUD in Prisma, but
   Prisma would also try to drop a table it does not know about, and triggers hide logic.
3. **Plain `latitude`/`longitude` columns with a B-tree index, distance computed in native SQL**:
   a bounding-box condition uses the index to keep only nearby candidates, then
   `ST_Distance_Sphere` computes the exact distance for those few rows.

## Decision
We use **option 3**. `villages` keeps `latitude DECIMAL(9,6)` and `longitude DECIMAL(9,6)`
(both required, with `CHECK` constraints for valid ranges) and an index on
`(latitude, longitude)`. The nearby-villages query is native SQL:

```sql
SELECT id, name_ar, name_en,
       ST_Distance_Sphere(POINT(longitude, latitude), POINT(?, ?)) / 1000 AS distance_km
FROM villages
WHERE deleted_at IS NULL
  AND latitude  BETWEEN ? AND ?      -- lat ± radius_km / 111.045
  AND longitude BETWEEN ? AND ?      -- lng ± radius_km / (111.045 * COS(RADIANS(lat)))
HAVING distance_km <= ?
ORDER BY distance_km
LIMIT ?;
```

`POINT(x, y)` here has no SRID, so `x` is longitude and `y` is latitude, which is what
`ST_Distance_Sphere` expects.

## Consequences
- Positive:
  - villages stay fully usable through the Prisma Client (create, update, filter);
  - no schema drift between `schema.prisma` and the database;
  - the query is still native SQL with a spatial function, as ADR-0003 intended;
  - the dataset (a few thousand villages) is small enough that a bounding box on a B-tree
    index is fast.
- Negative / trade-offs accepted:
  - for very large datasets a real spatial index would be faster;
  - the bounding box is a rectangle, so the `HAVING` filter is needed to cut it to a circle.
- Follow-up work:
  - measure the nearby-villages endpoint with k6 and record the result in `docs/performance/`;
  - if it turns out to be slow, revisit option 1 using raw SQL for village inserts.
