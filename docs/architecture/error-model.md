# Error model

Every error response from the API has the same JSON body, produced by one global filter
(`src/common/filters/all-exceptions.filter.ts`):

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "This village already has this name with this type",
  "path": "/api/v1/villages/1/names",
  "timestamp": "2026-11-04T10:15:30.000Z",
  "requestId": "6f1c2a0e-8a43-4b8e-9f5e-2d1c7a9b0e11"
}
```

| Field | Meaning |
|---|---|
| `statusCode` | HTTP status code (same as the response status) |
| `error` | Standard name of the status code |
| `message` | What went wrong. For validation errors it is a **list** of messages, one per problem |
| `path` | The requested URL |
| `timestamp` | When the error happened (ISO 8601, UTC) |
| `requestId` | Id of the request, also sent in the `X-Request-Id` header |

## Status codes we use

| Code | When |
|---|---|
| 400 Bad Request | Invalid body or query (validation), invalid JSON, a business rule such as "historical names need a source" |
| 401 Unauthorized | Missing, invalid or expired access token |
| 403 Forbidden | Logged in, but the role is not allowed, or the four-eyes rule (you cannot verify your own submission) |
| 404 Not Found | Unknown route, or the record does not exist or is hidden |
| 409 Conflict | Duplicate (unique value already exists) or a conflict with a related record |
| 500 Internal Server Error | Anything unexpected. The body only says `Internal server error`; details go to the server log |

## Database errors

Services handle the database errors they expect and return a clear message (for example
"This village already has this name with this type"). If a Prisma error still reaches the
filter, it is mapped to a safe default:

| Prisma code | Meaning | Response |
|---|---|---|
| P2002 | Unique constraint failed | 409 `A record with these values already exists` |
| P2003 | Foreign key constraint failed | 409 `This change conflicts with a related record` |
| P2025 | Record to update or delete not found | 404 `Record not found` |
| P2000 | Value too long for the column | 400 `A value is too long for its field` |
| any other | | 500 `Internal server error` |

SQL text, stack traces and connection details are never sent to the client.

## Request id and logs

- Every request gets an id. A client may send its own in `X-Request-Id`
  (letters, digits, `-`, `_`, at most 64 characters); otherwise the API creates a UUID.
- The id is returned in the `X-Request-Id` response header and in every error body.
- The API writes one log line per request: `<requestId> <method> <url> <status> <time>ms`.
  For 500 errors it also logs the stack trace with the same id.
- When someone reports a problem, ask for the `requestId` and search the logs for it.
