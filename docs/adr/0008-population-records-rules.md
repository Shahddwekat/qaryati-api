# ADR-0008: Population figures are checked by pure rules, conflicts are kept, trends use one figure per year

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Dana (with the whole team to review)

## Context
The spec says population must be historical records (value, year, source) and that the team
must define validation and consistency rules for adding and updating them. It also says
conflicting data must not be silently overwritten. Two sources often give different figures
for the same village and year, and some villages were emptied of people, so a figure of 0 is
real data. We also need a "population by year" report for a governorate.

## Options considered
1. **Reject anything unusual.** Safe, but it would block real history (sudden drops) and push
   contributors to leave data out.
2. **Accept everything and let verifiers catch mistakes.** Fast, but obvious typos reach the
   verification queue and waste reviewer time.
3. **Hard rules for impossible data, warnings for unusual data**, plus keeping conflicting
   figures side by side.

## Decision
We use **option 3**. The rules are pure functions in `population/domain/population-rules.ts`
(no framework, no database), so they are unit-tested directly.

**Hard rules (HTTP 400):**
- `year` is a whole number from 1500 to the current year (no future figures);
- `population` is a whole number from 0 to 1,000,000 (0 is allowed for depopulated villages;
  the upper limit catches an extra zero);
- `households`, when given, is a whole number and not greater than `population`;
- the village exists and is not soft-deleted, and the source exists (HTTP 404).

**Soft rule (warning, record still saved):** if the new figure implies more than 10% change per
year compared with the closest earlier or later verified year, the response contains a
`warnings` list for the contributor and the verifier. A figure of 0 on either side is never
flagged.

**Conflicts and updates:**
- Different sources may give different figures for the same year: they are separate rows and
  all returned (the preferred one first). Only the same source twice for the same village and
  year is a duplicate (HTTP 409, enforced by a unique index).
- Records are **not edited in place.** A correction is a new record with its own source, and
  the wrong one is rejected by a verifier with a reason. This keeps every value traceable
  (ADR-0005) and avoids silent overwrites.
- New records are always `PENDING`; the request body cannot set status, preferred flag or
  submitter. Review follows ADR-0007.

**Trends report (`GET /reports/population-trends`):** raw SQL with `ROW_NUMBER()` picks
exactly one `VERIFIED` figure per village and year (the preferred one, otherwise the most
recent). It sums them per year and returns `villagesCount` next to the total, because the
number of villages with a figure differs between years and a bare total would mislead.
Hidden (soft-deleted) villages are excluded.

## Consequences
- Positive:
  - business rules are testable without a database or HTTP;
  - unusual but real history is not blocked;
  - no figure is ever overwritten, so the full history and its sources stay available;
  - the report never double-counts a village.
- Negative / trade-offs accepted:
  - "no editing" means more rows and a rejected record for each mistake;
  - the 10% threshold and the 1500 / 1,000,000 limits are judgement calls and may need tuning
    with real data;
  - the report needs MySQL 8 (window functions).
- Follow-up work:
  - measure the report with k6 and add an index or a cache if it is the bottleneck.
