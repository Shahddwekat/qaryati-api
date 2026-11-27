# Deployment

How to run the Qaryati API with Docker, what to configure, and what to check before running
it anywhere other than your own computer. For day-to-day development see the
[README](../README.md#quick-start).

## 1. Requirements
- **Docker** with Docker Compose v2 (Docker Desktop on Windows and macOS).
- Port **3000** (API) and the MySQL port from `DB_PORT` (default **3306**) free on the host.
- Outgoing HTTPS to `nominatim.openstreetmap.org`, only needed when a village is created
  without coordinates ([geocoding](architecture/geocoding.md)).

Node.js is **not** needed on the host: the image builds and runs the app.

## 2. Start
```
git clone https://github.com/Shahddwekat/qaryati-api.git
cd qaryati-api
copy .env.example .env                    # Windows   (cp on macOS / Linux)
docker compose --profile app up --build -d
docker compose --profile app ps
```

Three services start, in this order:

| Service | What it does | When it is done |
|---|---|---|
| `mysql` | MySQL 8.4, data in the volume `qaryati-mysql-data` | health check passes (TCP ping) |
| `migrate` | `prisma migrate deploy`, then the development seed | exits with code 0 |
| `api` | `node dist/main` on port 3000, as a non-root user | `docker compose ps` shows `(healthy)` |

Check:
- http://localhost:3000/health → `{"status":"ok","database":"up"}`
- http://localhost:3000/api/docs → Swagger UI

The first build takes a few minutes; later builds reuse the cached layers.

## 3. Configuration (`.env`)
All settings come from `.env` (never committed). Inside Docker, `DB_HOST`, `DB_PORT` and
`DATABASE_URL` are overridden to point to the `mysql` service, so you only set the values below.

| Variable | Default in `.env.example` | Notes |
|---|---|---|
| `DB_NAME`, `DB_USER` | `qaryati` | database and user created on the first start |
| `DB_PASSWORD` | `change-me` | **change** for any shared or public machine |
| `DB_ROOT_PASSWORD` | `change-me-root` | **change**; only used by MySQL itself |
| `DB_PORT` | `3306` | port on the **host**; change it if 3306 is taken |
| `API_PORT` | `3000` (not in the file) | port on the host for the Docker API |
| `JWT_SECRET` | placeholder | **required**, at least 32 random characters, or the API does not start. With the example value it starts but logs a warning |
| `JWT_ACCESS_TOKEN_TTL_MINUTES` | `15` | lifetime of access tokens |
| `JWT_REFRESH_TOKEN_TTL_DAYS` | `7` | lifetime of refresh tokens |
| `LOGIN_RATE_LIMIT`, `LOGIN_RATE_TTL_MS` | `5`, `60000` | login attempts per IP per window, then 429 |
| `CORS_ORIGINS` | empty | comma-separated allowed browser origins; empty disallows cross-origin browser access |
| `GEOCODING_USER_AGENT` | placeholder | **required**: your app name and a real contact (Nominatim policy) |
| `GEOCODING_BASE_URL` | empty (= public Nominatim) | point to your own Nominatim server if needed |
| `GEOCODING_TIMEOUT_MS` | `3000` | time per geocoding try |
| `SEED_USER_PASSWORD` | `Password123!` | password of the development accounts created by the seed |
| `SEED_DEV_DATA` | `true` | `false` = the seed loads only the governorates, no development accounts or sample data |

A random secret can be generated with:
```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 4. Before running it for real
The Docker setup is made for development, demos and grading. Before exposing it to other
people, also check:

- [ ] All placeholders in `.env` changed (`JWT_SECRET`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`,
      `SEED_USER_PASSWORD`, `GEOCODING_USER_AGENT`).
- [ ] **The seed accounts.** The `migrate` service runs the seed on every `up`. With the default
      `SEED_DEV_DATA=true` it creates `admin@qaryati.local`, `verifier@qaryati.local` and
      `contributor@qaryati.local` with `SEED_USER_PASSWORD`. For a real deployment set
      `SEED_DEV_DATA=false` (only the governorates are loaded), create the real admin account,
      and disable or delete any seed accounts that already exist.
- [ ] Do not publish the MySQL port to the internet: remove the `ports` entry of `mysql` in
      `docker-compose.yml` (the API reaches it through the Docker network).
- [ ] Put a reverse proxy with HTTPS (for example Nginx or Caddy) in front of port 3000.
- [ ] Read the "Known limits" in [security](security.md): login rate limit kept in memory per
      process, `trust proxy` not configured.

## 5. Updating
```
git pull
docker compose --profile app up --build -d
```
`migrate` runs again and applies only the new migrations; the data in the volume is kept.
Migrations are never edited after they are merged, only new ones are added.

## 6. Operations
| Task | Command |
|---|---|
| Logs of the API | `docker compose --profile app logs -f api` |
| Logs of one request | search the logs for the `requestId` from the error body or the `X-Request-Id` header |
| Status and health | `docker compose --profile app ps` |
| Stop (keep data) | `docker compose --profile app down` |
| Stop and **delete all data** | `docker compose --profile app down -v` |
| Backup | `docker exec qaryati-mysql mysqldump -u root -p<DB_ROOT_PASSWORD> qaryati > backup.sql` |
| Restore | `docker exec -i qaryati-mysql mysql -u root -p<DB_ROOT_PASSWORD> qaryati < backup.sql` |

Every request writes one log line: `<requestId> <method> <url> <status> <time>ms`. Errors
with status 500 also log the stack trace with the same id ([error model](architecture/error-model.md)).

## 7. Troubleshooting
| Problem | Cause and fix |
|---|---|
| `migrate` exits with code 1 on the first start | MySQL was not ready yet. The health check waits for a real TCP connection; if it still happens, run `up` again |
| `port is already allocated` / `EADDRINUSE` | another program (often `npm run start:dev` or a local MySQL) uses 3000 or 3306. Stop it, or set `API_PORT` / `DB_PORT` in `.env` |
| The API exits with `JWT_SECRET must be configured...` | `JWT_SECRET` missing or shorter than 32 characters |
| The API exits with `GEOCODING_USER_AGENT must be configured` | set it in `.env` |
| Creating a village without coordinates returns 503 | Nominatim was not reachable after the retries (up to about 12 seconds); send `latitude` and `longitude` in the request |
| A search finds nothing right after deleting many rows | rebuild the full-text index: `docker exec qaryati-mysql mysql -u root -p<DB_ROOT_PASSWORD> qaryati -e "OPTIMIZE TABLE village_names"` |
| Changes in the code are not visible | rebuild: `up --build`. For `npm run start:prod` stop and start it again after `npm run build` |

## 8. Continuous integration
Every pull request runs `.github/workflows/ci.yml`:
1. **build-and-test:** `npm ci`, lint, build, unit tests, then `prisma migrate deploy`, seed and
   the e2e tests against a MySQL 8.4 service.
2. **docker:** builds both images, starts the whole stack from `.env.example` and checks
   `/health`, `/api/v1/villages` and `/api/docs`.

`main` is protected: changes only through pull requests with green checks and one approval
from someone who did not push the last commit, merged with "Squash and merge".
