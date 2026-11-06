# Contributing to Qaryati

## Golden rules
1. Never push directly to `main`. Every change goes through a Pull Request.
2. Every PR needs at least one approving review from another team member.
3. Never commit secrets. Real values live in `.env` (git-ignored); only `.env.example` is committed.
4. Keep PRs small and focused: one feature or fix per PR.

## Branch naming
```
<type>/<short-description>
```
| Type | Use for | Example |
|------|---------|---------|
| `feature/` | New functionality | `feature/village-search` |
| `fix/` | Bug fixes | `fix/population-year-validation` |
| `refactor/` | Code restructuring, no behavior change | `refactor/extract-geocoding-port` |
| `docs/` | Documentation and ADRs | `docs/adr-003-conflicting-data` |
| `test/` | Tests only | `test/village-repository-integration` |
| `chore/` | Build, Docker, CI, dependencies | `chore/docker-compose-mysql` |
| `perf/` | Performance work | `perf/index-village-name-search` |

## Commit messages (Conventional Commits)
```
<type>(<scope>): <summary in imperative mood>

[optional body: what and why, not how]
```
Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.
Scopes match module names: `villages`, `population`, `heritage`, `geography`, `sources`, `auth`, `audit`, `geocoding`, `infra`.

Good:
```
feat(population): reject records with a future reference year
fix(auth): return 401 instead of 500 on expired token
perf(villages): add full-text index for name search
```
Bad: `update`, `fixed stuff`, `final version`, `wip`.

## Workflow
1. Pick or create an issue and assign yourself.
2. `git checkout main && git pull`
3. `git checkout -b feature/<name>`
4. Commit in small, focused steps.
5. Rebase on `main` before opening the PR: `git fetch && git rebase origin/main`
6. Open a PR using the template and link the issue (`Closes #12`).
7. Address review comments, get approval, then **squash and merge**.
8. Delete the branch after merging.

## Definition of Done
- [ ] Code follows the agreed module boundaries
- [ ] Unit and/or integration tests added and passing
- [ ] Request validation and error responses follow the standard error format
- [ ] API documentation updated (Swagger: `@ApiOperation` + `@ApiErrors` on new endpoints)
- [ ] ADR written if an important design decision was made
- [ ] No secrets, debug code, or commented-out blocks

## Documenting endpoints (Swagger)
Run the API and open http://localhost:3000/api/docs. The raw OpenAPI file is at
http://localhost:3000/api/docs-json (API-Dog can import it).

- Request bodies and query parameters are documented **automatically** from the DTO classes
  (types, `class-validator` rules, and the `/** comment */` above each property). Name DTO
  files `*.dto.ts` so the plugin finds them.
- Each controller has `@ApiTags('<module>')`.
- On every endpoint add a summary and the possible errors:

```ts
import { ApiOperation } from '@nestjs/swagger';
import { ApiErrors } from '../common/swagger/api-errors.decorator';

@Post(':id/landmarks')
@ApiOperation({ summary: 'Add a landmark (any signed-in role)', description: 'Starts as PENDING.' })
@ApiErrors(400, 401, 403, 404, 409)
create(...) {}
```

See `src/villages/villages.controller.ts` for a complete example.
