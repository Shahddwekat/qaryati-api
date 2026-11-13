
# Authentication, Authorization, and Audit Logging

## 1. Overview

The Qaryati API uses a NestJS modular architecture to manage user authentication, role-based authorization, user administration, and audit logging.

The implementation consists of three main modules:

- **AuthModule:** Registration, login, access tokens, refresh token rotation, and logout.
- **UsersModule:** Current user information and administrative user management.
- **AuditModule:** Recording and retrieving audit events.

The API uses Prisma ORM with MySQL for data persistence.

## 2. Authentication

### Registration

Endpoint: `POST /api/v1/auth/register`

A new user provides an email address, password, and full name.

The system:
1. Normalizes the email address.
2. Checks whether the email is already registered.
3. Hashes the password with bcrypt.
4. Creates an account with the `CONTRIBUTOR` role.
5. Writes a `CREATE` audit row for the new user in the same transaction
   (if the audit row cannot be written, the account is not created).
6. Returns user information without exposing the password hash.

Duplicate email registration returns HTTP 409.

### Login

Endpoint: `POST /api/v1/auth/login`

The system validates the user's credentials and account status.

On successful authentication, it:
- Issues a JWT access token.
- Generates a random refresh token.
- Stores a SHA-256 hash of the refresh token in the database.
- Updates the user's last login timestamp.

Invalid credentials or a disabled account return HTTP 401.

### Login Rate Limiting

Login attempts are limited per client IP by `LoginRateLimitGuard`:
at most `LOGIN_RATE_LIMIT` attempts (default 5) within `LOGIN_RATE_TTL_MS`
milliseconds (default 60000). The next attempt returns HTTP 429 with a
`Retry-After` header (seconds until the window ends).

- Every attempt counts, successful or not, so guessing passwords is slowed down
  without revealing whether a guess was right.
- Counters are kept in memory, which is enough for one API instance. Several
  instances would need a shared store (for example Redis).
- For load tests (k6), start the API with a high limit, for example
  `LOGIN_RATE_LIMIT=100000`.

### Refresh Token Rotation

Endpoint: `POST /api/v1/auth/refresh`

The client submits a refresh token.

The system validates the stored token hash, expiration time, revocation status, and associated user account.

A successful refresh:
1. Revokes the old refresh token.
2. Creates a new refresh token.
3. Returns a new JWT access token and refresh token.

The database changes occur inside a Prisma transaction.

Reusing a revoked or expired refresh token is rejected.

### Logout

Endpoint: `POST /api/v1/auth/logout`

The provided refresh token is revoked in the database.

The endpoint returns a success message.

## 3. Token Configuration

Token lifetimes are configured using environment variables:

- `JWT_SECRET`: Secret used to sign JWT access tokens.
- `JWT_ACCESS_TOKEN_TTL_MINUTES`: Access token lifetime in minutes.
- `JWT_REFRESH_TOKEN_TTL_DAYS`: Refresh token lifetime in days.

The project's local development configuration has been tested with a 15-minute access token and a 7-day refresh token.

## 4. Role-Based Authorization

Qaryati supports three roles:

| Role | Description |
|---|---|
| ADMIN | Manages user roles, disables user accounts, and accesses audit logs. |
| VERIFIER | Role available for verification workflows. |
| CONTRIBUTOR | Default role assigned to newly registered users. |

Authorization is implemented using:

- `JwtAuthGuard`: Validates the JWT and loads the active user.
- `RolesGuard`: Checks whether the user has the required role.
- `@Roles()`: Declares allowed roles on protected endpoints.
- `@CurrentUser()`: Provides authenticated user information to controllers.

Unauthenticated requests receive HTTP 401:

| Situation | Message |
|---|---|
| No `Authorization: Bearer` header | 401 `Missing access token` |
| Invalid or expired access token | 401 `Invalid or expired access token` |
| Token valid, but the account was disabled or deleted | 401 `Account unavailable` |

Authenticated users without the required role receive HTTP 403
(`Your role does not have permission to access this resource`).

## 5. User Management

The following endpoints are available:

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/v1/users/me` | Authenticated users |
| GET | `/api/v1/users` | ADMIN |
| PATCH | `/api/v1/users/:id/role` | ADMIN |
| PATCH | `/api/v1/users/:id/disable` | ADMIN |

The system prevents administrators from removing their own ADMIN role or disabling their own account through these endpoints.

Role changes and account disabling are recorded in the audit log.

## 6. Audit Logging

The AuditModule records changes to application entities.

Audit records contain:

- Acting user ID
- Action type
- Entity type
- Entity ID
- Data before the change
- Data after the change
- Optional IP address
- Creation timestamp

The shared `AuditService.log()` method supports an optional Prisma transaction client, allowing business operations and audit records to be saved atomically.

Audit log IDs use a BigInt database type and are serialized as strings in API responses.

### Retrieving Audit Logs

Endpoint: `GET /api/v1/audit-logs`

Access: ADMIN only.

Supported query parameters:

| Parameter | Description |
|---|---|
| `page` | Page number, starting at 1. Default: 1. |
| `limit` | Number of records returned. Default: 20; maximum: 100. |
| `entityType` | Optional filter by entity type. |
| `entityId` | Optional filter by a positive entity ID. |

Example:

`GET /api/v1/audit-logs?entityType=User&entityId=4`

## 7. API Endpoint Summary

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Register a new contributor |
| POST | `/api/v1/auth/login` | Authenticate and issue tokens |
| POST | `/api/v1/auth/refresh` | Rotate a refresh token |
| POST | `/api/v1/auth/logout` | Revoke a refresh token |
| GET | `/api/v1/users/me` | Get authenticated user |
| GET | `/api/v1/users` | List users (ADMIN) |
| PATCH | `/api/v1/users/:id/role` | Update user role (ADMIN) |
| PATCH | `/api/v1/users/:id/disable` | Disable account (ADMIN) |
| GET | `/api/v1/audit-logs` | Retrieve audit records (ADMIN) |

Interactive API documentation is available through Swagger UI at:

`http://localhost:3000/api/docs`

## 8. Automated Testing

The modules have unit tests implemented with Jest.

### Authentication Tests

File: `src/auth/auth.service.spec.ts`

10 tests cover registration, duplicate registration, successful and failed login, disabled users, invalid refresh tokens, logout, and refresh token rotation.

### Authorization Tests

File: `src/auth/guards/roles.guard.spec.ts`

6 tests verify role-based access decisions for ADMIN, VERIFIER, CONTRIBUTOR, and unauthenticated requests.

### Audit Tests

File: `src/audit/audit.service.spec.ts`

8 tests cover audit record creation, before/after data, BigInt serialization, transaction support, pagination, filtering, and empty results.

### Running Tests

Run the authentication tests:

`npm.cmd test -- --runInBand auth.service.spec.ts`

Run the authorization tests:

`npm.cmd test -- --runInBand roles.guard.spec.ts`

Run the audit tests:

`npm.cmd test -- --runInBand audit.service.spec.ts`

A total of 24 unit tests were executed successfully for these three components.

## 9. Implementation Notes

- Authentication and administrative endpoints are separated into dedicated NestJS modules.
- Password hashes and refresh token hashes are not returned in standard API responses.
- Protected endpoints rely on JWT authentication and role checks.
- Audit logging is reusable across modules through `AuditService.log()`.
- Unit tests use mocked dependencies and do not require a running MySQL instance.
- Additional integration and performance tests may be added as part of the overall project test suite.
