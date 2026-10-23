# Qaryati Palestinian Villages Knowledge Platform

API-centric backend for structured, source-backed information about Palestinian villages.
Advanced Software Engineering

## Status
Walking skeleton: NestJS + MySQL 8.4 (Docker) + Prisma 7, with a `/health` endpoint.

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
4. Start the API in watch mode:
   ```
   npm run start:dev
   ```
5. Check it works: open http://localhost:3000/health and you should see
   `{"status":"ok","database":"up"}`

Useful commands:
| Command | What it does |
|---|---|
| `docker compose stop` | stop MySQL (data is kept) |
| `docker compose down -v` | delete the database completely (start fresh) |
| `npx prisma generate` | regenerate the Prisma client after editing `schema.prisma` |

## Documentation
- [Contributing guide](CONTRIBUTING.md)
- [Architecture Decision Records](docs/adr/)
- [ERD](docs/architecture/erd.md) and [data dictionary](docs/architecture/data-dictionary.md)
- Performance reports: `docs/performance/`
- API documentation: _API-Dog link_
