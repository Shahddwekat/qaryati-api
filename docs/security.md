# Security overview

A short list of what protects the Qaryati API and where to read more. The details of login,
tokens, roles and the audit log are in
[Authentication, authorization and audit](architecture/auth-authorization-audit.md); this page
does not repeat them.

## What we do

| Topic | What we do | More |
|---|---|---|
| Access tokens | Short-lived JWT (15 minutes in development), signed with `JWT_SECRET`. The API **does not start** if the secret is missing or shorter than 32 characters | [Auth doc, section 3](architecture/auth-authorization-audit.md) |
| Refresh tokens | Random token. Only its SHA-256 hash is stored in the database. It is **rotated** on every refresh (the old one is revoked), and logout revokes it | [Auth doc, section 2](architecture/auth-authorization-audit.md) |
| Roles | `ADMIN`, `VERIFIER`, `CONTRIBUTOR`. `JwtAuthGuard` checks the token and that the account is still active, `RolesGuard` checks the role. Wrong or missing token: 401. Wrong role: 403 | [Auth doc, section 4](architecture/auth-authorization-audit.md) |
| Passwords | Hashed with **bcrypt** (cost 12). 8 to 72 characters (bcrypt only uses the first 72). The hash is never returned by the API | [Auth doc, section 2](architecture/auth-authorization-audit.md) |
| Login rate limiting | At most 5 login attempts per IP per minute (`LOGIN_RATE_LIMIT`, `LOGIN_RATE_TTL_MS`), then 429 with `Retry-After`. Every attempt counts | [Auth doc, section 2](architecture/auth-authorization-audit.md) |
| Four-eyes rule | Nobody can verify or reject a fact they submitted themselves, not even an `ADMIN` (403). Checked in `VerificationService`, so every module gets it | [Provenance doc, section 3](architecture/provenance.md) |
| Audit log | Changes are written to the audit log (who, what, before, after, IP), in the **same transaction** as the change. If the audit row cannot be written, the change is not saved. Only `ADMIN` can read it | [Auth doc, section 6](architecture/auth-authorization-audit.md) |
| Input validation | A global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`: unknown fields are **rejected** with 400, not silently ignored. Every DTO has type, length and range rules | below |
| Error bodies | Every error has the same body. Unexpected errors answer only `Internal server error`; SQL, stack traces and Prisma details go to the server log, with the `requestId` to find them | [Error model](architecture/error-model.md) |
| Secrets | Only in `.env` (ignored by git). `.env.example` has placeholders, never real values. The Docker containers read `.env` too | below |
| Security headers | Helmet applies HTTP security headers globally through `configureApp` | below |
| CORS | Explicit origin allowlist configured through `CORS_ORIGINS`. Empty by default | below |

## Input validation

`src/app.setup.ts` sets one `ValidationPipe` for the whole API, and the e2e tests use the same
function, so tests and production behave the same:

- `whitelist: true`: fields without a validation decorator are removed.
- `forbidNonWhitelisted: true`: instead of removing them, the request fails with `400` and a
  message that names the field. A client that sends `"role": "ADMIN"` in a body that does not
  allow it gets an error, not a silent success.
- `transform: true`: path and query values (for example `:id`, `page`) become real numbers, so
  `/villages/abc` is a 400 and not a database error.

Database access goes through Prisma, which sends values as query parameters. The few native SQL
queries (for example "nearby villages") also use parameters.

## HTTP security headers (Helmet)

Helmet is enabled globally in `src/app.setup.ts` through `app.use(helmet())`.

It provides security headers including:

- `X-Content-Type-Options: nosniff`.
- `X-Frame-Options: SAMEORIGIN`.
- Content Security Policy (CSP).
- Referrer Policy.
- Strict Transport Security (HSTS).

Swagger UI at `/api/docs` was verified to load and execute requests with the default
Helmet configuration. No CSP relaxation was necessary.

## Cross-Origin Resource Sharing (CORS)

CORS is configured globally through `app.enableCors()` in `src/app.setup.ts`.

- Allowed origins are read from the comma-separated `CORS_ORIGINS` environment variable.
- Whitespace and empty entries are removed.
- An empty allowlist prevents cross-origin browser access to API responses.
- Allowed methods: `GET`, `POST`, `PATCH`, `DELETE`.
- Allowed headers: `Content-Type`, `Authorization`, `X-Request-Id`.
- Exposed headers: `X-Request-Id`, `Retry-After`.

Example configuration:

```env
CORS_ORIGINS=https://frontend.example.com,http://localhost:5173
```

Only trusted frontend origins should be configured in production.

CORS is a browser security mechanism, not a replacement for authentication
or authorization. Non-browser clients are not restricted by CORS.

The `test/security-headers.e2e-spec.ts` suite verifies:

- Helmet returns `X-Content-Type-Options: nosniff`.
- An allowed origin receives `Access-Control-Allow-Origin`.
- An unknown origin does not receive `Access-Control-Allow-Origin`.

## Rate limiting design

Rate limiting is currently applied only to the login endpoint because login
is a primary target for brute-force attacks and password guessing.

Public read endpoints are relatively inexpensive and are intended to remain
accessible. A global rate limit was therefore not introduced at this stage.

A custom login rate-limiting guard is used instead of `@nestjs/throttler`
because the latter caused compatibility issues with the project's ESM
end-to-end test setup.

Additional endpoint-specific limits and distributed rate limiting can be
considered before a public production deployment.

## Secrets

- Put real values only in `.env`. `.gitignore` ignores `.env` and `.env.*`, except
  `.env.example`.
- Change the placeholders before running anywhere other than your own computer:
  `JWT_SECRET` (at least 32 random characters), `DB_PASSWORD`, `DB_ROOT_PASSWORD` and
  `SEED_USER_PASSWORD`. The seed accounts (`admin@qaryati.local` and so on) are for development
  only and must not exist in a real deployment.
- Never put a secret in code, in a test, in an issue or in a pull request. Pull requests have a
  checklist item for it. If one is committed by mistake, change the secret, because deleting
  the commit does not make it safe again.

## Known limits

Not done yet, so nobody assumes they are:

- **Login rate limit is per process and per IP, kept in memory.** With several API instances,
  each has its own counters. Behind a reverse proxy, the IP seen by the API is the proxy's
  unless Express `trust proxy` is configured. Both need a decision before a real deployment.
- **Only login is rate limited.** Other endpoints, including registration, have no limit.
- **Registration says when an email is already used (409).** Login does not tell a wrong
  password from an unknown or disabled account (always `Invalid credentials`).
- **No password rules beyond the length**, and no email verification.
- **Access tokens cannot be revoked** before they expire (15 minutes). Disabling an account
  does take effect at once, because the guard checks the account on every request.