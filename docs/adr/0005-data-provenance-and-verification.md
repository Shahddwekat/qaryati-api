# ADR-0005: Store facts as source-backed rows with verification and side-by-side conflicts

- **Status:** Accepted
- **Date:** 2026-10-16
- **Deciders:** Whole team

## Context
Information about Palestinian villages comes from many places: censuses, books, archives,
websites and oral history. These sources often disagree. For example, two sources may give
different populations for the same village and year. The platform must:

- show where every fact came from (provenance),
- let trusted users check facts before they are treated as reliable,
- keep conflicting values instead of silently overwriting one with another,
- keep a history of who changed what, and when.

These rules shape almost every table, so they are decided once here and then applied
consistently. The full model is in [`docs/architecture/erd.md`](../architecture/erd.md) and
[`docs/architecture/data-dictionary.md`](../architecture/data-dictionary.md).

## Options considered
1. **Wide `villages` table** with one column per fact (`population_1997`, `founded_year`, …).
   Simple to query, but it cannot hold more than one value per fact, has nowhere to put a source
   per value, and needs schema changes for every new year.
2. **Generic key/value table** (`village_id, attribute, value, source_id`).
   Very flexible, but it loses types, constraints and indexes, and makes queries and validation hard.
3. **One table per kind of fact, each row carrying its own source and verification status.**
   More tables, but every fact is typed, constrained, indexed and individually traceable.

## Decision
We use **option 3**.

1. **One fact, one row, with its source.** Each kind of fact has its own table
   (`village_names`, `population_records`, `historical_events`, `landmarks`, `cultural_traits`,
   `economic_activities`, `facilities`, `village_relations`). Every row references a shared
   `sources` table, and `source_id` is required (oral history uses source type `ORAL`).
   The one exception is `village_names`, where the source is optional.
2. **Verification status per row.** Every fact row has `status`
   (`PENDING` → `VERIFIED` or `REJECTED`), `submitted_by`, `verified_by`, `verified_at` and
   `rejection_reason`. New facts from contributors start as `PENDING`. Only users with the
   `VERIFIER` or `ADMIN` role can change the status.
3. **Conflicts are kept side by side.** Disagreeing values are separate rows. In tables
   where a single value is expected per group (population per village and year, a village's
   name per language and type), a verifier marks one row as **preferred**. This is enforced by
   the database: `is_preferred` is stored as `1` or `NULL`, and a unique index on
   (group columns, `is_preferred`) allows only one `1` per group, because MySQL treats NULLs
   as distinct.
4. **Public visibility.** The read API returns `VERIFIED` and `PENDING` facts, each with its
   status and source, so clients can show "not checked yet". `REJECTED` facts are never
   returned publicly. When several values exist, the preferred one comes first and the others
   are returned as alternatives.
5. **Nothing is silently lost.**
   - Villages are **soft-deleted** (`deleted_at`) and can be restored by an admin. Hidden
     villages and their facts disappear from the API.
   - Every create, update, delete, restore, verify, reject and set-preferred action writes an
     **append-only** row to `audit_logs` with `before` and `after` JSON. It is written in the
     same database transaction as the change itself.
6. **Roles are a fixed list** (`ADMIN`, `VERIFIER`, `CONTRIBUTOR`) stored as an enum on
   `users`, not a separate table, because the set is small and does not change at runtime.

## Consequences
- Positive:
  - every fact can be traced to a source and to the people who added and checked it;
  - conflicting sources are visible to users instead of hidden;
  - the database itself enforces "one preferred value", not only the application code;
  - the audit log answers "who changed this, and what was it before?";
  - fact tables share one structure, so verification can be implemented once and reused.
- Negative / trade-offs accepted:
  - more tables and joins than a single wide table;
  - reads must always filter out `REJECTED` rows and hidden villages, which we handle in the
    repository layer so it is not forgotten;
  - the `audit_logs` table grows continuously (acceptable at our scale; archiving is out of scope).
- Follow-up work:
  - implement a reusable verification service and guard (`VERIFIER`/`ADMIN` only);
  - write the generated `location` column, spatial index, full-text index and `CHECK`
    constraints as custom SQL in the Prisma migration;
  - add integration tests for: one-preferred-per-group, rejected facts hidden, audit row
    written on every change.
