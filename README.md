# Qaryati Palestinian Villages Knowledge Platform

API-centric backend for structured, source-backed information about Palestinian villages.
Advanced Software Engineering

## Status
Walking skeleton: NestJS + MySQL 8.4 (Docker) + Prisma 7, with a `/health` endpoint.
Database schema: 16 tables with the initial migration, plus development seed data.

## Team
| Name | GitHub | Main modules |
|------|--------|--------------|
| | [@Shahddwekat](https://github.com/Shahddwekat) | |
| | [@BatoolMasri](https://github.com/BatoolMasri) | |
| | [@danasamaro](https://github.com/danasamaro) | |
| | [@janasalahat](https://github.com/janasalahat) | |

## Quick start
Requirements: **Node.js 24+** and **Docker Desktop**.

1. Clone and install (this also generates the Prisma client):
   ```
   git clone https://github.com/Shahddwekat/qaryati-api.git
   cd qaryati-api
   npm install
   ```
2. Create your local env file (never commit it):
   ```
   copy .env.example .env        # Windows
   cp .env.example .env          # macOS / Linux
   ```
3. Start MySQL and wait until `docker compose ps` shows `(healthy)`:
   ```
   docker compose up -d
   ```
4. Create the tables (run again whenever someone adds a new migration):
   ```
   npx prisma migrate dev
   ```
5. Fill the database with development data (safe to run more than once):
   ```
   npx prisma db seed
   ```
6. Start the API in watch mode:
   ```
   npm run start:dev
   ```
7. Check it works: open http://localhost:3000/health and you should see
   `{"status":"ok","database":"up"}`

### Development accounts (from the seed)
All use the password from `SEED_USER_PASSWORD` in `.env` (default `Password123!`).

| Email | Role |
|---|---|
| `admin@qaryati.local` | ADMIN |
| `verifier@qaryati.local` | VERIFIER |
| `contributor@qaryati.local` | CONTRIBUTOR |

Seed population figures and sources are **sample data, not real**.

Useful commands:
| Command | What it does |
|---|---|
| `docker compose stop` | stop MySQL (data is kept) |
| `docker compose down -v` | delete the database completely (start fresh) |
| `npx prisma generate` | regenerate the Prisma client after editing `schema.prisma` |
| `npx prisma migrate dev --name <change>` | after editing `schema.prisma`: create and apply a new migration |
| `npx prisma db seed` | add the development data again |

## Run everything in Docker
No Node.js needed, only **Docker Desktop**. From a fresh clone:
```
copy .env.example .env        # Windows   (cp on macOS / Linux)
docker compose --profile app up --build
```
This starts three containers:
| Service | What it does |
|---|---|
| `mysql` | the database |
| `migrate` | applies the migrations and loads the development seed, then exits |
| `api` | the API on http://localhost:3000 (docs at http://localhost:3000/api/docs) |

Stop with `Ctrl + C`, or `docker compose --profile app down` (add `-v` to also delete the data).
After pulling new code, run the same `up --build` command again.

For day-to-day development keep using the Quick start above: `docker compose up -d` starts
**only MySQL**, and you run the API with `npm run start:dev`. Don't run both at the same time,
because both use port 3000 (or set `API_PORT=3001` in `.env` for the Docker API).

## Tests
| Command | What it runs |
|---|---|
| `npm test` | all unit tests (every module) |
| `npm run test:cov` | unit tests + coverage report in `coverage/` |
| `npm run test:e2e` | end-to-end tests against the real database (needs MySQL running, migrated and seeded) |
| `npm run lint` | lint checks |
| `npm run format:check` | Prettier formatting check |

Every pull request is checked automatically by GitHub Actions (`.github/workflows/ci.yml`):
lint, build, unit tests, then migrations + seed + end-to-end tests on a real MySQL 8.4.
Please wait for the green check before merging.

## Documentation
- [Contributing guide](CONTRIBUTING.md)
- [Architecture Decision Records](docs/adr/)
- [ERD](docs/architecture/erd.md) and [data dictionary](docs/architecture/data-dictionary.md)
- [Error model](docs/architecture/error-model.md): the error body, status codes and request ids
- Performance reports: `docs/performance/`
- API documentation (Swagger UI): http://localhost:3000/api/docs when the API is running;
  OpenAPI JSON at http://localhost:3000/api/docs-json