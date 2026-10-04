# ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-05
- **Deciders:** Whole team

## Context
The project requires us to justify important engineering decisions and their trade-offs.
Decisions made verbally or in chat get lost and cannot be defended later.

## Options considered
1. **No formal records**: fast, but reasoning is lost and inconsistent.
2. **One long design document**: hard to keep current, decisions get buried.
3. **Architecture Decision Records (ADRs)**: short, one file per decision, versioned with the code.

## Decision
We use ADRs stored in `docs/adr/`, numbered sequentially, using `0000-template.md`.
An ADR is added in the same PR as the change it justifies.

## Consequences
- Positive: decisions are traceable in Git history and reviewable in PRs.
- Negative: small overhead per significant decision.
- Follow-up: ADR-0002 (technology stack), ADR-0003 (architecture style).
