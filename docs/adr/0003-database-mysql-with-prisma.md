# ADR-0003: Use MySQL 8 as the relational database with Prisma as the ORM

- **Status:** Accepted
- **Date:** 2026-10-08
- **Deciders:** Whole team

## Context
A relational database and an ORM are mandatory, and selected data-access cases must use
native SQL. The domain needs Arabic text (names, transliterations), geographic coordinates
and "nearby villages" queries, historical records with sources, transactions for multi-step
writes, and an audit trail.

## Options considered
1. **PostgreSQL**: very capable (PostGIS, rich indexing).
   Cons: less team experience.
2. **MySQL 8**: widely known by the team, mature, well supported by Node tooling.
   Provides InnoDB transactions, utf8mb4 for Arabic, spatial types and functions,
   full-text indexes, and JSON columns.
3. **SQLite**: simple, but not suitable for concurrent load testing or production-like execution.

ORM options:
1. **TypeORM**: integrates natively with NestJS, but has a weaker type-safety and migration story.
2. **Sequelize**: mature, but weaker TypeScript support.
3. **Prisma**: schema-first, fully type-safe client, reliable migrations,
   and safe parameterized raw SQL via `$queryRaw`.

## Decision
We use **MySQL 8 (InnoDB, utf8mb4)** with **Prisma** as the ORM.

## Rationale
- **Arabic support:** all tables use `utf8mb4` with the `utf8mb4_0900_ai_ci` collation so
  Arabic and English names are stored and compared correctly.
- **Geography:** village coordinates are stored as `POINT SRID 4326` with a spatial index;
  "nearby villages" uses `ST_Distance_Sphere`.
- **Native SQL where it adds value:** Prisma does not model spatial types natively, so spatial
  queries, full-text search, and reporting queries (for example, population trends) use
  `$queryRaw`. This is a deliberate, documented use of native SQL, not a workaround everywhere.
- **Consistency:** InnoDB transactions (`prisma.$transaction`) cover multi-step writes,
  for example creating a population record together with its source and audit entry.
- **Maintainability:** the Prisma schema is the single source of truth for the data model,
  and migrations are versioned in Git.
- **Testability:** integration tests run against a real MySQL container, not a mock database.

## Consequences
- Positive: type-safe data access, versioned migrations, and a clear split between
  ORM queries (normal CRUD) and native SQL (spatial, full-text, reporting).
- Negative: spatial columns must be declared as `Unsupported` in Prisma and accessed through
  raw SQL; MySQL spatial support is less rich than PostGIS (acceptable for our needs).
- Follow-up: define indexing strategy in the ERD; document raw-SQL cases in the README.