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
- Performance reports: `docs/performance/`
- API documentation: _API-Dog link_