# ADR-0004: Use a modular monolith with layered modules

- **Status:** Accepted
- **Date:** 2026-10-09
- **Deciders:** Whole team

## Context
The system covers several related domain areas (village identity, geography, population,
heritage, economy, sources/provenance, audit, users) and one external integration (geocoding).
The spec requires clear module boundaries, controlled and documented dependencies, business
rules that are testable without infrastructure, and an external provider that can be replaced
with limited impact. The team is small and the deadline is fixed.

## Options considered
1. **Classic layered monolith** (controllers / services / repositories for the whole app):
   simple, but layers are organized by technical role, so domain areas mix together and
   boundaries erode as the code grows.
2. **Microservices**: strong isolation and independent scaling.
   Cons: network calls, distributed transactions, multiple deployments and databases;
   far more operational complexity than this system or team needs.
3. **Full hexagonal / clean architecture everywhere**: excellent isolation.
   Cons: many interfaces and mappings for simple CRUD areas; high ceremony for a small team.
4. **Modular monolith with layered modules**: one deployable application split into
   domain modules, each with internal layers; ports-and-adapters only where it pays off
   (external integrations).

## Decision
We build a **modular monolith**. Each domain area is a NestJS module with four layers:

| Layer | Contains | May depend on |
|-------|----------|---------------|
| Presentation | Controllers, request/response DTOs, validation | Application |
| Application | Services (use cases), transaction boundaries, authorization checks | Domain |
| Domain | Entities, business rules, repository and provider interfaces | Nothing framework-specific |
| Infrastructure | Prisma repositories, external API clients | Domain (implements its interfaces) |

Modules:
- `villages`: identity, names, administrative affiliation
- `geography`: coordinates, nearby villages, location description
- `population`: population history and its validation rules
- `heritage`: history, timeline events, landmarks, cultural characteristics
- `economy`: agriculture, crafts, industries, public facilities
- `sources`: source/reference records and verification status
- `audit`: change history (who, what, when)
- `auth` / `users`: authentication, roles, permissions
- `geocoding`: external provider integration behind a `GeocodingProvider` interface
- `shared`: error format, logging, pagination, configuration (no business logic)

## Dependency rules
1. Dependencies point inward: presentation → application → domain; infrastructure implements domain interfaces.
2. The domain layer has no imports from NestJS, Prisma, or HTTP libraries.
3. A module uses another module only through that module's exported application service,
   never by accessing its repositories or database tables directly.
4. No circular dependencies between modules.
5. Auditing is triggered through events or an interceptor, so domain modules do not depend on `audit`.
6. The external geocoding provider is used only through the `GeocodingProvider` interface;
   swapping providers means writing one new adapter.

## Consequences
- Positive: clear ownership per module (useful for splitting work across the team),
  business rules testable with plain unit tests, single deployment and single database
  (simple transactions and Docker setup), and modules could be extracted into services
  later if ever needed.
- Negative: boundaries depend on discipline and code review, since everything runs in one
  process; some mapping between DTOs, domain objects, and Prisma models.
- Follow-up: architecture diagram in `docs/architecture/`; ERD; enforce rule 3 in code reviews.