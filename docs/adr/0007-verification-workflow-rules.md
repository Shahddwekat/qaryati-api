# ADR-0007: One shared verification service with a four-eyes rule

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Dana (with the whole team to review)

## Context
ADR-0005 says every fact starts as `PENDING` and a `VERIFIER` or `ADMIN` turns it into
`VERIFIED` or `REJECTED`, and that a verifier may mark one value as preferred. Eight tables
(`village_names`, `population_records`, `historical_events`, `landmarks`, `cultural_traits`,
`economic_activities`, `facilities`, `village_relations`) share this workflow. Implementing it
once per module would give eight slightly different versions of rules that must be identical
(who may review, what is written to the audit log, what happens to the preferred flag).

The spec also asks us to define who may verify or remove information, to make changes
auditable, and to avoid silently overwriting conflicting data.

## Options considered
1. **Each module writes its own verify/reject code.** Simple to start, but the rules drift
   apart and each copy needs its own tests.
2. **A base class or Prisma extension that adds the methods to every model.** Removes
   duplication, but hides the rules inside framework magic and is hard to unit test.
3. **One `VerificationService` driven by a registry** (`VERIFIABLE_ENTITIES`) that maps each
   fact type to its Prisma delegate, its status column and its "preferred" group. Feature
   modules call the service; a single controller exposes it for all fact types.

## Decision
We use **option 3**. The rules, all enforced in `VerificationService` (not only in controllers):

1. **Who:** only `VERIFIER` and `ADMIN` can verify, reject or prefer.
2. **Four-eyes rule:** nobody can verify or reject a fact they submitted themselves. This
   applies to admins too. `GET /verification/queue` leaves out the reviewer's own submissions.
3. **State changes:** `PENDING` → `VERIFIED` or `REJECTED`. A `VERIFIED` fact can later be
   `REJECTED` (a retraction). A `REJECTED` fact is final: the contributor submits a corrected
   new fact instead of re-opening the old one, so the history stays clear.
4. **Reject needs a reason** (max 500 characters), stored in `rejection_reason` and in the audit log.
5. **Preferred:** only a `VERIFIED` fact can be preferred, one per group (for example one
   population figure per village and year). The previous preferred row is cleared first, in the
   same transaction, because the database allows one `is_preferred = 1` per group. Rejecting a
   preferred fact clears its flag. Setting an already preferred fact again changes nothing and
   writes no audit row.
6. **Atomic and audited:** the status change and its audit row (`VERIFY`, `REJECT`,
   `SET_PREFERRED`, with before/after) are written in one transaction.
7. **No lost updates:** each update is conditional on the status that was read. If someone
   else reviewed the same fact first, the API answers 409 instead of overwriting.
8. **API shape:** `PATCH /api/v1/verification/{fact-type}/{id}/verify|reject|prefer` works for
   every fact type, and `GET /api/v1/verification/queue` lists everything pending (oldest first)
   with raw SQL `UNION ALL` over the eight tables, because the ORM cannot express it.

## Consequences
- Positive:
  - one place to read, test and change the review rules;
  - feature modules get verification without writing controllers for it;
  - adding a new kind of fact means adding one registry entry.
- Negative / trade-offs accepted:
  - the service reaches Prisma delegates by name, so a renamed model must be updated in the
    registry (a unit test and TypeScript's compile check on usage help catch this);
  - the four-eyes rule means a team with one verifier cannot verify that person's own facts;
    an admin has to review them;
  - the queue SQL names eight tables and must be updated when a fact table is added.
- Follow-up work:
  - integration tests against MySQL for the one-preferred-per-group index and for the queue;
