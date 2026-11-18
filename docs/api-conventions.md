# API conventions

Rules every endpoint follows, so the API feels the same in every module. The full list of
endpoints, bodies and answers is in Swagger: http://localhost:3000/api/docs (OpenAPI JSON at
`/api/docs-json`).

## URLs and versions
- Everything is under **`/api/v1`**. Only the health check is outside: `GET /health`.
- A new, incompatible version would get `/api/v2`; `v1` keeps working until it is retired.
- Resources are **plural nouns in lower case**, with `-` between words:
  `/villages`, `/historical-events`, `/audit-logs`.
- Things that belong to a village are nested under it:
  `/villages/:id/names`, `/villages/:id/population`, `/villages/:id/landmarks`.
- Ids are positive integers in the path: `/villages/42`. Anything else gives `400`.
- Actions that are not plain create/update/delete are sub-resources with a verb:
  `POST /villages/:id/restore`, `PATCH /verification/:entityType/:id/verify|reject|prefer`.

## Methods and status codes
| Method | Used for | Success |
|---|---|---|
| `GET` | read one or a list (never changes data) | `200` |
| `POST` | create | `201` with the created resource |
| `POST` | an action (`/restore`, `/auth/login`, `/auth/refresh`) | `200`, or `201` for login and refresh |
| `PATCH` | change some fields, or a review action | `200` with the updated resource |
| `DELETE` | hide a village (soft delete, it can be restored) | `200` |

We use `PATCH`, not `PUT`: clients send only the fields they change.

| Error code | When |
|---|---|
| `400` | invalid body, query or path value, or a business rule (for example a historical name without a source) |
| `401` | no token, invalid or expired token, disabled account |
| `403` | the role is not allowed, or the four-eyes rule |
| `404` | unknown route, unknown or hidden resource |
| `409` | duplicate, or a conflict with the current state (for example verifying a rejected fact) |
| `422` | geocoding found no place for the village name |
| `429` | too many login attempts |
| `503` | the geocoding service is not reachable |
| `500` | anything unexpected (details only in the server log) |

Every error has the same body (`statusCode`, `error`, `message`, `path`, `timestamp`,
`requestId`). See the [error model](architecture/error-model.md).

## Lists: pagination, filters, sorting
Lists that can grow are paginated with query parameters, shared by every module
(`PaginationQueryDto`):

| Parameter | Default | Rules |
|---|---|---|
| `page` | `1` | integer ≥ 1 |
| `limit` | `20` | integer 1 to 100 |

The answer always has the same shape:
```json
{
  "data": [ ... ],
  "meta": { "page": 1, "limit": 20, "total": 5006, "totalPages": 251 }
}
```

Filters and sorting are extra query parameters, for example on `GET /villages`:

| Parameter | Meaning |
|---|---|
| `q` | full-text search in all names (Arabic, English, historical, transliterations); results by relevance |
| `governorateId`, `municipalityId` | filter |
| `sortBy` | `nameEn` (default), `nameAr`, `createdAt` (ignored when `q` is given) |
| `order` | `asc` (default) or `desc` |

Unknown query parameters are rejected with `400`, so a typo (`limt=10`) is noticed instead
of silently ignored.

Short lists that belong to one village (names, relations, population years, heritage) are
returned as a plain array without pagination.

## Bodies
- JSON only, field names in **camelCase** (`nameEn`, `sourceId`, `yearFrom`).
- Unknown fields are rejected with `400` (`forbidNonWhitelisted`), so a client cannot set
  `status`, `isPreferred` or `role` by sending them.
- Text is trimmed where it matters (names); empty strings are not valid names.
- Dates are ISO 8601 in UTC (`2026-11-04T10:15:30.000Z`).
- Arabic text is stored and returned as UTF-8 (`utf8mb4`).

## Facts and provenance
- New facts (names, population figures, heritage) start as `PENDING`, with `submittedBy`.
- Public lists show `PENDING` and `VERIFIED` facts with their `status`, so readers can see
  what is checked; `REJECTED` facts are hidden.
- Facts carry a `source` where the rule needs one.
- Details: [provenance](architecture/provenance.md).

## Authentication
- `POST /auth/login` returns an `accessToken` (15 minutes) and a `refreshToken`.
- Send `Authorization: Bearer <accessToken>` on protected endpoints. Reading is mostly public;
  writing needs a role (`CONTRIBUTOR`, `VERIFIER`, `ADMIN`).
- Details: [auth](architecture/auth-authorization-audit.md) and [security](security.md).

## Headers
| Header | Direction | Meaning |
|---|---|---|
| `Authorization: Bearer ...` | request | access token |
| `X-Request-Id` | request (optional) and response | id of the request; also in error bodies and in the log line |
| `Retry-After` | response to `429` | seconds until login is allowed again |
