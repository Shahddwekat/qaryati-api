# ADR-0002: Use Node.js with NestJS and TypeScript for the backend

- **Status:** Accepted
- **Date:** 2026-10-08
- **Deciders:** Whole team

## Context
The project allows Spring Boot, Node.js (Express or NestJS), or Python (Django REST / FastAPI).
The system must have clear module boundaries, controlled dependencies, consistent validation
and error handling, role-based authorization, and strong testability. The team has more
experience with JavaScript/TypeScript than with Java or Python, and the deadline is fixed
(01/12/2026), so learning curve is a real risk.

## Options considered
1. **Spring Boot (Java)**: very mature ecosystem (Spring Security, JPA, Resilience4j).
   Cons: steeper learning curve for the team, more boilerplate, slower iteration.
2. **Django REST / FastAPI (Python)**: fast development.
   Cons: FastAPI requires building structure (modules, auth, DI) manually; less team experience.
3. **Node.js + Express**: minimal and flexible.
   Cons: no enforced structure; module boundaries, DI, validation, and error handling
   must be designed and policed by convention, which risks inconsistency across team members.
4. **Node.js + NestJS (TypeScript)**: opinionated framework on top of Express.
   Pros: built-in module system, dependency injection, guards, pipes, interceptors,
   exception filters, first-class testing support, OpenAPI generation.
   Cons: more abstraction than Express; decorators add a learning step.

## Decision
We use **Node.js (LTS) with NestJS and TypeScript in strict mode**.

## Rationale
- **Maintainability:** each domain area (villages, population, heritage, sources, auth, audit,
  geocoding) is a NestJS module with explicit imports/exports, so dependencies between modules
  are visible and controlled.
- **Testability:** dependency injection lets us replace repositories and external clients with
  mocks in unit tests, and the testing module supports integration tests with a real database.
- **Security:** guards give a central place for authentication and role-based authorization;
  global validation pipes reject invalid input before it reaches business logic.
- **Consistency:** a global exception filter enforces one error-response format across the API.
- **Development efficiency:** the team already knows TypeScript, and the CLI scaffolds modules,
  controllers, and services consistently.
- **Scalability:** Node's non-blocking I/O suits an API that is mostly reads and external calls;
  the app is stateless (JWT), so it can scale horizontally behind a load balancer.

## Consequences
- Positive: architecture boundaries are enforced by the framework, not only by convention.
- Negative: NestJS abstractions (decorators, DI container) add a learning step for team members
  new to it; CPU-heavy work would block the event loop (not expected in this system).
- Follow-up: ADR-0003 (database and ORM), ADR-0004 (architecture style).