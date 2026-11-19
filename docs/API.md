# API reference

This document describes every HTTP endpoint of the two back-end services:

- **REST API** (`api/`, NestJS): everything the web app uses. Base URL `http://localhost:8001/api/v1`
  in development (`PORT`, default 8001).
- **Prediction service** (`api-predictor/`, FastAPI): called only by the REST API. Base URL
  `http://localhost:8000/api/v1`. See [Prediction service API](#prediction-service-api).

Everything below was written from the controllers, DTOs and services in the source tree; the
source files are named in each section so the reference can be re-checked after changes.

## Contents

- [Conventions](#conventions)
- [Error responses](#error-responses)
- [Enumerations](#enumerations)
- [Endpoint summary](#endpoint-summary)
- [Auth](#auth)
- [Users](#users)
- [Patients](#patients)
- [Predictions](#predictions)
- [Results](#results)
- [Reports](#reports)
- [Audit trail](#audit-trail)
- [Files](#files)
- [Prediction service API](#prediction-service-api)

## Conventions

**Authentication.** Every route except the public auth routes needs an access token:

```http
Authorization: Bearer <access token>
```

Access and refresh tokens are JWTs signed with `JWT_SECRET` (HS256). Only access tokens are
accepted on protected routes: a refresh token or a password-reset approval token is rejected
with `401 "An access token is required."`. Revoked tokens (see [logout](#post-authlogout)) are
rejected with `401 "The token has been revoked."`. On every request the user is loaded from the
database: an access token of a deleted or deactivated user is rejected with
`401 "User not found or inactive."`, so deactivation takes effect immediately, not when the
token expires. A token issued before the user's last password reset (`Users.passwordChangedAt`)
is rejected with `401 "The session ended because the password was changed."`.

**Rate limits.** Five public auth routes are rate-limited per client IP and per route, over a
fixed window of `AUTH_RATE_LIMIT_WINDOW_SECONDS` (default 60):

| Group | Routes | Requests per window (variable, default) |
|---|---|---|
| login | `POST /auth/login` | `AUTH_RATE_LIMIT_LOGIN`, 10 |
| refresh | `POST /auth/refresh-access` | `AUTH_RATE_LIMIT_REFRESH`, 30 |
| password reset | `POST /auth/request-password-reset`, `POST /auth/validate-admin-and-token`, `POST /auth/reset-password` (each counted on its own) | `AUTH_RATE_LIMIT_PASSWORD_RESET`, 5 |

Invalid or empty values fall back to the defaults. Every request counts, including failed ones
(a login is counted before the credentials are checked). Above the limit the answer is
`429 { "statusCode": 429, "message": "Too many requests. Please try again later." }` with a
`Retry-After-<name>` header in seconds (`Retry-After-auth-login`, `Retry-After-auth-refresh` or
`Retry-After-auth-password-reset`). The client IP is Express's `req.ip`: behind a reverse proxy set
`TRUST_PROXY` (e.g. `1`) so it comes from `X-Forwarded-For`; without it the header is ignored.
The other routes, including `POST /auth/validate-reset-token`, are not rate-limited.

**Roles.** `ADMIN` and `STANDARD`. Roles are checked on the server for every route
(`RolesGuard` with `@Roles(...)`); a user without the required role gets
`403 "You do not have permission to access this resource."`. The role used is the one stored in
the database, not the `role` claim of the token, so a role change applies from the next request.
STANDARD users have additional per-record rules on results (see [Results](#results)).

**Request bodies.** JSON unless stated otherwise. A global `ValidationPipe` applies to every
JSON body and query string:

- undeclared properties are rejected (`400 "property <name> should not exist"`);
- primitive values are converted to the declared type (query strings to numbers);
- only the first failing rule of each property is reported.

The two upload endpoints of the results module take `multipart/form-data` with a JSON string in
the `data` field; that JSON is validated with the same rules (see
[Multipart `data` field](#multipart-data-field)).

**Uploaded images.** JPEG, PNG, BMP or TIFF: the MIME type must be one of `image/jpeg`,
`image/jpg`, `image/png`, `image/bmp`, `image/tiff` **and** the extension one of `.jpg`, `.jpeg`,
`.png`, `.bmp`, `.tiff`. Maximum size per file: `MAX_FILE_SIZE` bytes (default 10 485 760,
10 MB). At most 20 files per request on the result upload endpoints, one on
`POST /predictions/analyze`; a result holds at most 20 images in total (see
[the append endpoint](#post-resultsidpredictionswith-files)).

**Pagination.** List endpoints accept `page` and `limit` (integers ≥ 1; defaults 1 and 10) and
return:

```json
{ "data": [], "total": 0, "page": 1, "limit": 10, "totalPages": 0 }
```

`limit` is capped at 100 (users, patients, results) or 50 (report search); the audit trail
rejects `limit > 100` with a 400 instead.

**Identifiers.** Path parameters named `:id` must be integers
(`400 "Validation failed (numeric string is expected)"` otherwise).

**Dates.** Timestamps are stored in UTC and returned as ISO 8601 strings
(`"2026-09-24T14:05:31.120Z"`). Query dates of `GET /results/statistics` are local days
(`YYYY-MM-DD`) of `APP_TIMEZONE`; `GET /traceability` takes ISO 8601 instants with a time zone.

**Image URLs.** Responses that reference a stored image return an absolute `imageUrl` built from
`API_BASE_URL`, for example `http://localhost:8001/api/v1/files/predictions/<file name>`.
Those URLs need the `Authorization` header too.

## Error responses

The API uses three error envelopes.

**1. Standard NestJS envelope** (every endpoint except the ones listed under 2):

```json
{ "statusCode": 404, "message": "Result with ID 42 not found.", "error": "Not Found" }
```

- Validation failures return `400` with `message` as an **array** of strings:

  ```json
  {
    "statusCode": 400,
    "message": ["Invalid document type. Must be one of: NATIONAL_ID, MINOR_ID, FOREIGNER_ID, PASSPORT, BIRTH_CERTIFICATE."],
    "error": "Bad Request"
  }
  ```

- An authentication failure without a specific reason (missing, malformed or expired token;
  wrong login credentials) returns `{ "statusCode": 401, "message": "Unauthorized" }`.
- Unexpected server errors return `500` with a generic message, usually
  `{ "statusCode": 500, "message": "Unexpected error.", "error": "Internal Server Error" }`.
  The real error is logged on the server and never sent to the client.
- A request that races past a uniqueness check and hits a database unique constraint returns
  `409 "A record with the same unique values already exists."`.
- A rate-limited auth route answers `429` with this envelope, without `error` (see
  [Rate limits](#conventions)), also on the routes that otherwise use envelope 2.

**2. Auth envelopes** (only in the auth controller, `api/src/modules/auth/passport-auth.controller.ts`):

- `GET /auth/profile`, `POST /auth/request-password-reset` and `POST /auth/reset-password`
  answer failures with the failure's HTTP status and:

  ```json
  { "success": false, "error": "Could not change the password.", "detail": "The token has already been used." }
  ```

  `error` is a fixed label per endpoint; `detail` is the specific reason (`"Unexpected error."`
  for a 500).
- `POST /auth/validate-reset-token` and `POST /auth/validate-admin-and-token` answer business
  failures (invalid token, wrong administrator credentials) with **200** and
  `{ "success": false, "valid": false, "message": "..." }`; unexpected failures use the same
  body with the failure's status.
- Body validation errors of these endpoints still use envelope 1 (the `ValidationPipe` runs
  before the controller).

**3. Prediction service** (FastAPI): `{ "detail": "..." }`. The REST API never forwards this
envelope; it maps the status and `detail` into envelope 1 (see
[POST /predictions/analyze](#post-predictionsanalyze)).

### Multipart `data` field

`POST /results/batch/with-files` and `POST /results/:id/predictions/with-files` read their
payload from a `data` form field that holds a JSON object. Failures are `400` with a message
array:

| Problem | Message |
|---|---|
| Field missing or empty | `The "data" field is required.` |
| Not JSON | `The "data" field must be valid JSON.` |
| JSON but not an object | `The "data" field must be a JSON object.` |
| DTO rule failed | The rule's message; nested errors are prefixed with their path, e.g. `predictions[1]: Invalid prediction. It must be one of the valid ICAP classes.` |
| Undeclared property (e.g. `userId`) | `property userId should not exist` |

## Enumerations

| Name | Values |
|---|---|
| Role (`UserRole`) | `ADMIN`, `STANDARD` |
| Document type (`DocumentType`) | `NATIONAL_ID`, `MINOR_ID`, `FOREIGNER_ID`, `PASSPORT`, `BIRTH_CERTIFICATE` |
| Gender (`Gender`) | `M`, `F`, `OTHER` |
| Result status (`ResultStatus`) | `PENDING`, `VERIFIED`, `CORRECTED` |
| Dilution (`Dilution`) | `"80"`, `"160"`, `"320"`, `"640"`, `"1280"`, `"2560"` (strings; shown as `1:80` … `1:2560`) |
| Audit activity (`ActivityType`) | `CREATE`, `UPDATE`, `DELETE`, `PASSWORD_RESET_REQUEST`, `PASSWORD_RESET_COMPLETED`, `PASSWORD_RESET_EXPIRED` |
| Audit entity (`EntityType`) | `USER`, `PATIENT`, `RESULT`, `CORRECTION` |

**Pattern classes (`PredictionClass`)**, the same keys in the predictor, the database and the web
app (`api/src/entities/results/result.types.ts`):

| Level | Key | ICAP code | Display name |
|---|---|---|---|
| general | `NEGATIVE` | AC-0 | Negative |
| general | `NUCLEAR` | AC-1 to AC-14, AC-29 | Nuclear |
| general | `CYTOPLASMIC` | AC-15 to AC-23 | Cytoplasmic |
| general | `MITOTIC` | AC-24 to AC-28 | Mitotic |
| competent | `NUCLEAR_HOMOGENEOUS` | AC-1 | Nuclear Homogeneous |
| competent | `NUCLEAR_DENSE_FINE_SPECKLED` | AC-2 | Nuclear Dense Fine Speckled |
| competent | `NUCLEAR_CENTROMERE` | AC-3 | Nuclear Centromere |
| competent | `NUCLEAR_SPECKLED` | AC-4/AC-5 | Nuclear Speckled |
| competent | `NUCLEOLAR` | AC-8 to AC-10 | Nucleolar |
| competent | `CYTOPLASMIC_FIBRILLAR` | AC-15/AC-16/AC-17 | Cytoplasmic Fibrillar |
| competent (expert-level pattern) | `CYTOPLASMIC_DISCRETE_DOTS` | AC-18 | Cytoplasmic Discrete Dots |
| competent | `CYTOPLASMIC_SPECKLED` | AC-19/AC-20 | Cytoplasmic Speckled |
| competent | `CYTOPLASMIC_RETICULAR_AMA` | AC-21 | Cytoplasmic Reticular/AMA |
| competent | `CYTOPLASMIC_POLAR_GOLGI` | AC-22 | Cytoplasmic Polar/Golgi-like |
| expert | `NUCLEOLAR_HOMOGENEOUS` | AC-8 | Nucleolar Homogeneous |
| expert | `NUCLEOLAR_CLUMPY` | AC-9 | Nucleolar Clumpy |
| expert | `NUCLEOLAR_PUNCTATE` | AC-10 | Nucleolar Punctate |
| expert | `CYTOPLASMIC_DENSE_FINE_SPECKLED` | AC-19 | Cytoplasmic Dense Fine Speckled |
| expert | `CYTOPLASMIC_FINE_SPECKLED` | AC-20 | Cytoplasmic Fine Speckled |
| expert | `MITOTIC_CENTROSOME` | AC-24 | Mitotic Centrosome |
| expert | `MITOTIC_SPINDLE_FIBERS` | AC-25 | Mitotic Spindle Fibers |
| expert | `MITOTIC_NUMA` | AC-26 | Mitotic NuMA-like |
| expert | `MITOTIC_INTERCELLULAR_BRIDGE` | AC-27 | Mitotic Intercellular Bridge |
| expert | `MITOTIC_CHROMOSOMAL_ENVELOPE` | AC-28 | Mitotic Chromosomal Envelope |

## Endpoint summary

Paths are relative to `/api/v1`. "Public" means no token. Rate-limited routes are marked
"(rate-limited)".

| Method | Path | Access |
|---|---|---|
| POST | `/auth/login` | Public (rate-limited) |
| POST | `/auth/refresh-access` | Public (refresh token in body; rate-limited) |
| POST | `/auth/logout` | Any authenticated user |
| GET | `/auth/profile` | Any authenticated user |
| POST | `/auth/request-password-reset` | Public (rate-limited) |
| POST | `/auth/validate-reset-token` | Public |
| POST | `/auth/validate-admin-and-token` | Public (administrator credentials in body; rate-limited) |
| POST | `/auth/reset-password` | Public (approval token in body; rate-limited) |
| GET | `/users` | ADMIN |
| GET | `/users/:id` | ADMIN |
| POST | `/users` | ADMIN |
| PATCH | `/users/:id` | ADMIN |
| DELETE | `/users/:id` | ADMIN |
| GET | `/patients` | ADMIN, STANDARD |
| GET | `/patients/document` | ADMIN, STANDARD |
| GET | `/patients/:id` | ADMIN, STANDARD |
| POST | `/patients` | ADMIN, STANDARD |
| PATCH | `/patients/:id` | ADMIN, STANDARD |
| DELETE | `/patients/:id` | ADMIN, STANDARD |
| POST | `/predictions/analyze` | ADMIN, STANDARD |
| GET | `/results` | ADMIN, STANDARD (STANDARD: filtered) |
| GET | `/results/statistics` | ADMIN, STANDARD (STANDARD: own results) |
| GET | `/results/:id` | ADMIN, STANDARD (STANDARD: own or PENDING) |
| POST | `/results/batch/with-files` | ADMIN, STANDARD |
| POST | `/results/:id/predictions/with-files` | ADMIN, STANDARD (STANDARD: own or PENDING) |
| PATCH | `/results/:id` | ADMIN, STANDARD (STANDARD: own or PENDING) |
| POST | `/results/corrections` | ADMIN, STANDARD (STANDARD: own or PENDING, never VERIFIED) |
| POST | `/results/corrections/batch` | ADMIN, STANDARD (same rule) |
| GET | `/results/:id/corrections` | ADMIN, STANDARD (STANDARD: own or PENDING) |
| GET | `/results/:id/corrections/latest` | ADMIN, STANDARD (STANDARD: own or PENDING) |
| GET | `/reports/search` | ADMIN, STANDARD |
| GET | `/reports/:id` | ADMIN, STANDARD |
| GET | `/traceability` | ADMIN |
| GET | `/traceability/:id` | ADMIN |
| GET | `/files/predictions/:filename` | ADMIN, STANDARD |
| GET | `/files/reference/classes` | ADMIN, STANDARD |
| GET | `/files/reference/:className` | ADMIN, STANDARD |
| GET | `/files/reference/:className/:filename` | ADMIN, STANDARD |

---

## Auth

Source: `api/src/modules/auth/` (`passport-auth.controller.ts`, `auth.service.ts`,
`password-reset.service.ts`), DTOs in `api/src/DTOs/auth/`.

### POST /auth/login

Signs in with username and password. Public.

Request:

```json
{ "username": "jdoe", "password": "correct horse battery" }
```

The body is read by Passport's local strategy (there is no DTO): both fields must be non-empty
strings.

Response `200`:

```json
{ "refresh": "<refresh JWT>", "access": "<access JWT>" }
```

Both tokens carry `sub` (user id), `username`, `role` and `jti` (a random UUID, unique per
token, so two sessions of the same user never share a token and each one is revoked on its own);
the refresh token also has `type: "refresh"`. Lifetimes: `JWT_ACCESS_EXPIRATION` (default `15m`) and
`JWT_REFRESH_EXPIRATION` (default `7d`). A successful login updates the user's `lastLogin`.

Errors: `401 { "statusCode": 401, "message": "Unauthorized" }` for a missing field, an unknown
username, a wrong password or an inactive account (the response does not say which). An unknown
username still costs one bcrypt comparison against a dummy hash, so the response time does not
tell it apart from a wrong password. `429` above the login rate limit (counted before the
credentials are checked, so failed attempts count too).

### POST /auth/refresh-access

Issues a new access token. Public. The refresh token is not rotated.

Request: `{ "refresh": "<refresh JWT>" }` (`refresh`: required string).

Response `200`: `{ "access": "<access JWT>" }`. The new token carries the user's **current** role
and a new `jti`.

Errors (`401`, envelope 1):

| Message | Cause |
|---|---|
| `The refresh token has expired.` | Expired refresh token |
| `Invalid refresh token.` | Bad signature or malformed token |
| `Invalid token.` | A valid JWT that is not a refresh token |
| `The refresh token has been revoked.` | Revoked at logout |
| `User not found or inactive.` | The account was deleted or deactivated |
| `The session ended because the password was changed.` | The refresh token was issued before the user's last password reset |

`429` above the refresh rate limit.

### POST /auth/logout

Revokes the given refresh token and the access token of the request. Any authenticated user.

Request: `{ "refresh": "<refresh JWT>" }` (`refresh`: required string).

Response `200`:

```json
{ "success": true, "message": "Logged out successfully." }
```

- If the refresh token was already revoked, `message` is
  `"The token was already revoked. Logged out successfully."`.
- If the refresh token is expired or malformed, only the access token is revoked and the
  response is still `200 "Logged out successfully."`.

Errors: `401 "Invalid token."` (the `refresh` value is not a refresh token);
`401 "The token does not belong to this user."`.

### GET /auth/profile

Returns the signed-in user. Any authenticated user.

Response `200`:

```json
{
  "success": true,
  "user": {
    "userId": 3,
    "username": "jdoe",
    "email": "jane.doe@example.com",
    "fullName": "Jane Doe",
    "professionalCard": "LIC-12345",
    "role": "STANDARD",
    "dateJoined": "2026-09-01T12:00:00.000Z",
    "isActive": true
  }
}
```

Errors (envelope 2, `error: "Could not retrieve the user data."`): `404 detail "User not found."`.

### POST /auth/request-password-reset

Starts an administrator-approved password reset. Public.

Request: `{ "username": "jdoe" }` (`username`: required string).

Response `200`, **always the same**, whether or not the account exists:

```json
{ "success": true, "message": "If the account exists, an administrator has been notified." }
```

When the account exists, is active and has an email, an administrator email is known
(`ADMIN_EMAIL`, otherwise the first active ADMIN user with an email), and the user has **no
pending request from the last 10 minutes** (an unused, unexpired token created less than 10
minutes ago), the API:

1. marks every unused reset token of the user as used;
2. stores a new single-use token (32 random bytes, base64url) that expires after
   `PASSWORD_RESET_TOKEN_EXPIRATION` (default 30 minutes);
3. emails the administrator a link `{FRONTEND_URL}/reset-password?token=<token>`. Without a
   SendGrid key (empty or `change-me…`) nothing is emailed: outside production
   (`NODE_ENV` other than `production`) the notification, including the link, is logged at WARN
   level so a local installation can finish the reset; in production (the API Docker image sets
   `NODE_ENV=production`) only the fact that the email was skipped is logged;
4. writes a `PASSWORD_RESET_REQUEST` audit record.

Otherwise nothing is stored or sent, and the reason is logged on the server. During the
10-minute cooldown a repeated request neither creates a token nor voids the pending one, so the
link already sent to the administrator keeps working.

The answer is the same in every case, but the eligible case does more work (token write, email,
audit record), so response times can still differ (see the known limitations in the
[README](../README.md#known-limitations)).

Errors (envelope 2, `error: "Could not process the request."`): `500` on unexpected failures.
`429` (envelope 1) above the password-reset rate limit.

### POST /auth/validate-reset-token

Checks a reset link before the reset page shows its form. Public.

Request: `{ "token": "<reset token>" }` (`token`: required string).

Response `200` (valid):

```json
{
  "success": true,
  "valid": true,
  "user": {
    "fullName": "Jane Doe",
    "username": "jdoe",
    "email": "jane.doe@example.com",
    "professionalCard": "LIC-12345",
    "role": "Standard"
  }
}
```

`user.role` is the display label (`Administrator` or `Standard`); `professionalCard` is
`"Not recorded"` when empty.

Response `200` (invalid): `{ "success": false, "valid": false, "message": "<reason>" }` with one of
`Invalid token.`, `The token has already been used.`, `The token has expired.` An expired token
also writes a `PASSWORD_RESET_EXPIRED` audit record.

### POST /auth/validate-admin-and-token

An administrator approves a reset with their own credentials. Public (the credentials are the
authorization).

Request:

| Field | Rules |
|---|---|
| `token` | Required non-empty string (the reset token) |
| `adminUsername` | Required non-empty string |
| `adminPassword` | Required string, at least 6 characters |

Validation messages of this DTO are the class-validator defaults, e.g.
`"adminPassword must be longer than or equal to 6 characters"`.

Response `200` (approved):

```json
{
  "success": true,
  "valid": true,
  "user": { "fullName": "Jane Doe", "username": "jdoe", "email": "jane.doe@example.com", "professionalCard": "LIC-12345", "role": "Standard" },
  "admin": { "userId": 1, "fullName": "System Administrator", "username": "admin" },
  "approvalToken": "<JWT>"
}
```

`approvalToken` is a JWT valid for **10 minutes** with the claims
`purpose: "password-reset-approval"`, `sub` (administrator id) and `resetTokenId`. It is not an
access token and is rejected by every protected route.

Response `200` (refused): `{ "success": false, "valid": false, "message": "<reason>" }` with one of
the reset-token reasons above, `Invalid administrator credentials.`,
`The user does not have administrator privileges.` or `The administrator user is inactive.`
(role and status are only disclosed after the password matched). An unknown administrator
username still costs one bcrypt comparison against a dummy hash. `429` (envelope 1) above the
password-reset rate limit.

### POST /auth/reset-password

Sets the new password. Public (the approval token is the authorization).

Request:

| Field | Rules |
|---|---|
| `token` | Required string: the reset token |
| `newPassword` | Required string, at least 8 characters |
| `approvalToken` | Required string: from `validate-admin-and-token` |

Response `200`: `{ "success": true, "message": "Password updated successfully." }`

The reset token is claimed atomically (a second use fails), the password is hashed with bcrypt,
the time of the change is stored in `Users.passwordChangedAt`, and a `PASSWORD_RESET_COMPLETED`
audit record attributes the change to the approving administrator.

**Every session of the user ends:** access and refresh tokens issued before `passwordChangedAt`
are rejected with `401 "The session ended because the password was changed."` (by every
protected route and by `POST /auth/refresh-access`). The comparison uses the token's `iat`, which
has one-second resolution, so a token issued in the same second as the reset, even just after
it, is rejected too (fail safe); logging in again a second later works.

Errors (envelope 2, `error: "Could not change the password."`):

| Status | `detail` |
|---|---|
| 401 | `The administrator approval is invalid or has expired.` (bad signature, expired, or not an approval token) |
| 400 | `Invalid token.`, `The token has already been used.`, `The token has expired.` |
| 403 | `The administrator approval does not match this reset request.` |
| 403 | `The approving administrator is no longer authorized.` (no longer ADMIN or inactive) |
| 429 | Envelope 1, `Too many requests. Please try again later.` (password-reset rate limit) |

---

## Users

ADMIN only. Source: `api/src/modules/users/`, DTOs in `api/src/DTOs/users/`.

User object returned by these endpoints (`UserDetailDto`; the list uses `UserListDto`, the
same fields without `professionalCard`). The password hash is never returned.

```json
{
  "userId": 3,
  "username": "jdoe",
  "fullName": "Jane Doe",
  "email": "jane.doe@example.com",
  "professionalCard": "LIC-12345",
  "role": "STANDARD",
  "isActive": true,
  "dateJoined": "2026-09-01T12:00:00.000Z",
  "lastLogin": "2026-09-24T08:15:00.000Z"
}
```

### GET /users

Query: `page`, `limit` (see [Pagination](#conventions)). Sorted by `dateJoined`, newest first.
Response `200`: paginated `UserListDto`.

### GET /users/:id

Response `200`: `UserDetailDto`. Errors: `404 "User with ID {id} not found."`.

### POST /users

Creates a user. Response `201`: `UserDetailDto`. Writes a `CREATE` audit record (without the
password).

| Field | Rules |
|---|---|
| `username` | Required; 3–50 characters; letters, digits, `-` and `_` only |
| `fullName` | Required; 1–100 characters |
| `email` | Required; valid email; at most 100 characters |
| `password` | Required; 8–255 characters (stored as a bcrypt hash) |
| `professionalCard` | Required; 1–50 characters (professional license number) |
| `role` | Optional; `ADMIN` or `STANDARD` (default `STANDARD`) |

Errors: `409 "A user with this username already exists."`,
`409 "A user with this email already exists."`.

### PATCH /users/:id

Partially updates a user. Response `200`: `UserDetailDto`. Writes one `UPDATE` audit record per
changed field.

| Field | Rules |
|---|---|
| `fullName` | Optional; 1–100 characters |
| `email` | Optional; valid email; at most 100 characters; must be unused |
| `professionalCard` | Optional; 1–50 characters |
| `role` | Optional; `ADMIN` or `STANDARD` |
| `isActive` | Optional boolean (`true` re-activates a deactivated user) |

`username` and `password` cannot be changed here (`400 "property password should not exist"`);
passwords change only through the [reset flow](#post-authrequest-password-reset).

Errors: `404 "User with ID {id} not found."`, `409 "A user with this email already exists."`.

### DELETE /users/:id

Deactivates the user (`isActive = false`); nothing is deleted. Response `200`:
`{ "message": "User deactivated successfully." }`. Writes an `UPDATE` audit record for
`isActive` when the status changed.

A deactivated user can no longer log in or refresh, and any access token issued before is
rejected from the next request (`401 "User not found or inactive."`).

Errors: `404 "User with ID {id} not found."`.

---

## Patients

ADMIN and STANDARD. Source: `api/src/modules/patients/`, DTOs in `api/src/DTOs/patients/`.

Patient object (`PatientDetailDto`, also used by the list):

```json
{
  "patientId": 12,
  "fullName": "Jane Doe",
  "documentType": "NATIONAL_ID",
  "documentNumber": "1234567890",
  "gender": "F",
  "birthDate": "1980-05-17T00:00:00.000Z",
  "phonePrefix": "+1",
  "phoneNumber": "5550100",
  "email": "jane.doe@example.com"
}
```

### GET /patients

Query: `page`, `limit`. Sorted by `patientId`, newest first. Response `200`: paginated patients.

### GET /patients/document

Finds a patient by document. Query:

| Parameter | Rules |
|---|---|
| `documentType` | Required; a `DocumentType` value |
| `documentNumber` | Required; 5–20 letters or digits |

Response `200`: the patient. Errors: `404 "Patient with document {type} {number} not found."`.

### GET /patients/:id

Response `200`: the patient. Errors: `404 "Patient with ID {id} not found."`.

### POST /patients

Response `201`: the patient. Writes a `CREATE` audit record.

| Field | Rules |
|---|---|
| `fullName` | Required; 1–100 characters |
| `documentType` | Required; a `DocumentType` value |
| `documentNumber` | Required; 5–20 letters or digits (same rule as the lookup) |
| `gender` | Required; `M`, `F` or `OTHER` |
| `birthDate` | Required; ISO 8601 date string (`YYYY-MM-DD`) |
| `phonePrefix` | Required; `+` followed by 1–4 digits |
| `phoneNumber` | Required; 1–15 digits |
| `email` | Optional; valid email; at most 50 characters |

Errors: `409 "A patient with document {type} {number} already exists."` (the pair
`documentType` + `documentNumber` is unique).

Create, update and [`GET /patients/document`](#get-patientsdocument) share the document number
rule, so every stored patient can be found by the lookup. Messages:
`400 "The document number must be between 5 and 20 characters long."`,
`400 "The document number may only contain letters and numbers."`.

### PATCH /patients/:id

Same fields as `POST`, all optional. Response `200`: the patient. Writes one `UPDATE` audit
record per changed field.

Errors: `404`, `409 "Another patient with document {type} {number} already exists."`.

### DELETE /patients/:id

Permanently deletes a patient that has no results. Response `200`:
`{ "message": "Patient deleted successfully." }`. Writes a `DELETE` audit record with a snapshot
(name, document, email).

Errors: `404`, `409 "The patient has analysis results and cannot be deleted."`.

---

## Predictions

Source: `api/src/modules/predictions/` (`predictions.controller.ts`, `predictor.client.ts`,
`prediction-signature.service.ts`).

### POST /predictions/analyze

Classifies one image through the prediction service. ADMIN and STANDARD. The image is **not
stored**; results are saved separately with the [results endpoints](#results).

Request: `multipart/form-data` with one image in the field `file` (image rules in
[Conventions](#conventions)).

The API forwards the image to `{PREDICTOR_URL}/api/v1/predict` with
`Authorization: Bearer {PREDICTOR_API_KEY}` (server-side; the key never reaches the browser):

- each attempt times out after `PREDICTOR_TIMEOUT_MS` (default 60 000 ms); a timeout is not
  retried;
- network errors and `502`, `503`, `504` answers are retried at most twice, after 500 ms and
  1 000 ms.

Response `200`: the prediction service JSON (see [POST /predict](#post-apiv1predict)) plus two
fields added by the API, which make the prediction **trusted** (see
[ARCHITECTURE.md](ARCHITECTURE.md#41-why-predictions-are-signed)):

| Field | Content |
|---|---|
| `imageSha256` | SHA-256 of the analyzed image bytes, lowercase hex |
| `signature` | base64url (no padding) HMAC-SHA256, keyed with `PREDICTION_SIGNING_SECRET`, of `${imageSha256}\|${prediction_key}\|${confidence_percentage}\|${classification_level}` |

Numbers in the signed string are rendered as JavaScript's `String()` renders them (`93.12`, `88`).
When the predictor omits `classification_level`, the API sets it to `"general"` in the response
and signs that value.

```json
{
  "filename": "slide_01.png",
  "prediction": "Nucleolar Clumpy",
  "prediction_key": "NUCLEOLAR_CLUMPY",
  "confidence": 0.912345,
  "confidence_percentage": 91.23,
  "classification_level": "expert",
  "note": null,
  "voting_method": "hybrid_voting",
  "status": "success",
  "imageSha256": "<64 lowercase hex characters>",
  "signature": "<43 base64url characters>"
}
```

(`class_probabilities` and `patch_statistics` omitted; for this answer the signed string is
`<imageSha256>|NUCLEOLAR_CLUMPY|91.23|expert`.)

To save the prediction, send `prediction_key`, `confidence_percentage`, `classification_level`
and `signature` back unchanged with the same image (see
[POST /results/batch/with-files](#post-resultsbatchwith-files)).

Errors (envelope 1):

| Status | Message | Cause |
|---|---|---|
| 400 | `No file was provided.` | No `file` field |
| 400 | `File type not allowed: …` / `File extension not allowed: …` | Rejected by the API's image filter |
| 400 | Prediction service `detail` | The predictor rejected the image (empty, undecodable, or an unsupported mode such as 32-bit `I`/`F`: `Unsupported image mode.`) |
| 413 | `File too large` | Larger than `MAX_FILE_SIZE` |
| 413 | Prediction service `detail` | Above the predictor's size or pixel limit |
| 415 | Prediction service `detail` | Mapped if the predictor ever answers 415 |
| 502 | `Prediction service misconfigured` | The predictor answered 401/403 (wrong `PREDICTOR_API_KEY`) |
| 502 | `Prediction service returned an invalid response` | A 2xx answer that is not JSON, or JSON without a non-empty string `prediction_key`, a finite number `confidence_percentage` or (when present) a string `classification_level` |
| 503 | `Prediction service unavailable, try again later` | Timeout, unreachable after retries, or any other predictor status (e.g. 500, or 503 while the models are not loaded) |

---

## Results

ADMIN and STANDARD. Source: `api/src/modules/results/` (`results.controller.ts`,
`results.service.ts`), DTOs in `api/src/DTOs/results/`.

A **result** is one ANA exam of a patient: one or more **predictions** (one per uploaded image,
with its dilution) and, optionally, **corrections** of those predictions. See the lifecycle in
[ARCHITECTURE.md](ARCHITECTURE.md#5-result-lifecycle).

**Access rules for STANDARD users** (ADMIN users can read and change every result):

- they can read and change their **own** results and **any PENDING** result (the shared queue);
- they cannot correct a **VERIFIED** result, not even their own:
  `403 "You do not have permission to correct this prediction."` or
  `403 "You cannot correct predictions of a verified result. Only an administrator can do this."`.

**Verified results are locked** for every role: adding images, changing a dilution or changing
the observations of a `VERIFIED` result answers `409 "Verified results cannot be modified."`
(append and `PATCH`). Only real changes count: sending the stored values again is a no-op, not a
conflict. The only way to change a `VERIFIED` result is an **ADMIN correction**
([`POST /results/corrections`](#post-resultscorrections), [`/corrections/batch`](#post-resultscorrectionsbatch)
or `existingCorrections` of the [append endpoint](#post-resultsidpredictionswith-files)); it moves
the result to `CORRECTED` and clears `verifiedBy` and `verifiedAt`. Every write re-checks these
rules on the result row read with an update lock inside its transaction, so a concurrent
verification cannot slip in between the check and the write.

Result detail object (`ResultDetailDto`), returned by several endpoints:

```json
{
  "resultId": 42,
  "dateAndHour": "2026-09-24T14:05:31.120Z",
  "observations": "Bright nucleoli in most cells.",
  "status": "VERIFIED",
  "patient": {
    "patientId": 12, "fullName": "Jane Doe", "documentType": "NATIONAL_ID", "documentNumber": "1234567890",
    "gender": "F", "birthDate": "1980-05-17T00:00:00.000Z", "phonePrefix": "+1", "phoneNumber": "5550100",
    "email": "jane.doe@example.com"
  },
  "user": { "userId": 3, "fullName": "Jane Doe" },
  "verifiedBy": { "userId": 1, "fullName": "System Administrator" },
  "verifiedAt": "2026-09-24T14:10:02.000Z",
  "predictions": [
    {
      "predictionId": 101,
      "prediction": "NUCLEOLAR_CLUMPY",
      "confidencePercentage": 91.23,
      "imagePath": "0b6f…-1790290000000-slide_01.png",
      "imageUrl": "http://localhost:8001/api/v1/files/predictions/0b6f…-1790290000000-slide_01.png",
      "dilution": "160"
    }
  ]
}
```

`user` is the creator; `verifiedBy`/`verifiedAt` are the user and time the result moved to
`VERIFIED` (`null` if never, and cleared again by any later correction). `observations` is `null`
when there are none. Predictions are ordered by `predictionId`; `prediction` is the
model's class, corrections are returned by the correction endpoints.

Correction object (`CorrectionDetailDto`):

```json
{
  "correctedResultId": 7,
  "predictionId": 101,
  "correctedPrediction": "NUCLEOLAR_HOMOGENEOUS",
  "observations": "Homogeneous nucleolar staining.",
  "correctedDate": "2026-09-24T14:12:40.000Z",
  "correctedBy": { "userId": 1, "username": "admin", "fullName": "System Administrator" }
}
```

### GET /results

Lists results. Sorted by date, newest first (then by id).

| Parameter | Rules |
|---|---|
| `page`, `limit` | Optional integers ≥ 1 (defaults 1 and 10); `limit` capped at 100 |
| `status` | Optional `ResultStatus` |
| `search` | Optional string, at most 100 characters (`400 "Search must be at most 100 characters long."`). Keeps the results whose patient full name **or** document number contains the text: trimmed, case-insensitive, `LIKE` wildcards (`%`, `_`, `[`) taken literally. Blank is ignored |

What a STANDARD user sees: without `status`, their own results plus every PENDING result; with
`status=PENDING`, every PENDING result; with `VERIFIED` or `CORRECTED`, only their own. `search`
narrows that set; `total` and `totalPages` count the matching results.

Response `200`: paginated items:

```json
{
  "resultId": 42,
  "dateAndHour": "2026-09-24T14:05:31.120Z",
  "status": "PENDING",
  "patient": { "patientId": 12, "fullName": "Jane Doe", "documentType": "NATIONAL_ID", "documentNumber": "1234567890", "email": "jane.doe@example.com", "phoneNumber": "5550100", "phonePrefix": "+1" },
  "user": { "userId": 3, "fullName": "Jane Doe", "username": "jdoe" },
  "predictionsCount": 3
}
```

### GET /results/statistics

Model accuracy for the Analytics page, computed **per prediction (image)** over results with
status `VERIFIED` or `CORRECTED`. ADMIN users get every result; STANDARD users only their own.

Query (optional): `dateFrom`, `dateTo` in `YYYY-MM-DD`: **local dates of the laboratory time zone**
(`APP_TIMEZONE`, default `UTC`), both inclusive. The API converts them to UTC instants, from the
local midnight that starts `dateFrom` (inclusive) to the local midnight after `dateTo`
(exclusive), honouring daylight saving time, and compares them with the result's date. For
example, with `APP_TIMEZONE=America/Lima` (UTC-5), `dateFrom=2026-09-24&dateTo=2026-09-24`
covers `2026-09-24T05:00:00Z` up to, but not including, `2026-09-25T05:00:00Z`.

The totals are computed in the database by one aggregate query (count of distinct predictions
and of distinct predictions with a correction); no list of predictions is loaded or sent back as
query parameters, so large date ranges work.

Response `200`:

```json
{
  "totalValidated": 120,
  "precision": 87.5,
  "correctionRate": 12.5,
  "totalVerifiedWithoutCorrections": 105,
  "totalCorrected": 15
}
```

`precision` is the share of predictions without any correction (%, one decimal) and
`correctionRate` the share with at least one. All values are 0 when nothing matches.

Errors: `400 "Start date must be in YYYY-MM-DD format."`, `"End date must be in YYYY-MM-DD format."`,
`"Start date cannot be later than end date."`.

### GET /results/:id

Response `200`: `ResultDetailDto`. Errors: `404 "Result with ID {id} not found."`,
`403 "You do not have permission to access this result."` (STANDARD).

### POST /results/batch/with-files

Creates a result with its images, predictions and, optionally, corrections, in **one database
transaction**. The creator is always the authenticated user.

Request `multipart/form-data`:

- `images`: 1–20 image files, in the same order as `predictions`;
- `data`: JSON string ([rules](#multipart-data-field)):

| Field | Rules |
|---|---|
| `patientId` | Required integer; the patient must exist |
| `predictions` | Required array, at least one item, **one per image** |
| `predictions[].prediction` | Required `PredictionClass`: the `prediction_key` of the analysis |
| `predictions[].confidencePercentage` | Required number, 0–100: the `confidence_percentage` of the analysis, unchanged |
| `predictions[].classificationLevel` | Required, `general`, `competent` or `expert`: the `classification_level` of the analysis |
| `predictions[].signature` | Required string, at most 128 characters: the `signature` of the analysis |
| `predictions[].dilution` | Required `Dilution` |
| `observations` | Optional string, at most 1 000 characters; `""` or `null` means none (stored as `null`) |
| `status` | Optional, `PENDING` or `VERIFIED` (default `PENDING`) |
| `corrections` | Optional array |
| `corrections[].imageIndex` | Required integer ≥ 0, lower than the number of images, unique |
| `corrections[].correctedPrediction` | Required `PredictionClass` |
| `corrections[].observations` | Optional string, at most 1 000 characters; `""` or `null` means none |

Messages of the two signed fields, prefixed with the item path (e.g.
`predictions[0]: Signature is required.`): `Classification level is required.`,
`Classification level must be one of: general, competent, expert.`, `Signature is required.`,
`Signature must be a string.`, `Signature must be at most 128 characters long.`

Example `data`:

```json
{
  "patientId": 12,
  "predictions": [
    { "prediction": "NUCLEOLAR_CLUMPY", "confidencePercentage": 91.23, "classificationLevel": "expert",
      "signature": "<signature from /predictions/analyze>", "dilution": "160" },
    { "prediction": "NUCLEAR", "confidencePercentage": 88.1, "classificationLevel": "general",
      "signature": "<signature from /predictions/analyze>", "dilution": "320" }
  ],
  "corrections": [{ "imageIndex": 1, "correctedPrediction": "NUCLEAR_HOMOGENEOUS" }],
  "observations": "Two fields reviewed.",
  "status": "VERIFIED"
}
```

**Signature check.** Before anything is stored, the API computes the SHA-256 of the image at the
same index as each prediction (upload order) and recomputes the HMAC over that hash and the
item's `prediction`, `confidencePercentage` and `classificationLevel` (see
[POST /predictions/analyze](#post-predictionsanalyze)). The comparison is constant-time. A
changed class, confidence or level, a signature from another image, or images sent in another
order fail with `400 "Prediction signature is invalid for image N."` (`N` counts from 1). The
confidence must be sent exactly as the analysis returned it (`91.23`, not a rounded `91`).
Corrections are how a user records a different class; they do not touch the signed prediction.

Status of the new result: `CORRECTED` when `corrections` is not empty (whatever `status` says);
otherwise `status`, or `PENDING`. A result created as `VERIFIED` records the creator as verifier.

Images are stored under `{UPLOADS_DIR}/predictions/` as `<uuid>-<timestamp>-<sanitised name><ext>`.
If anything fails after the images were written, the transaction rolls back and the images
are deleted.

Response `201`:

```json
{ "resultId": 42, "dateAndHour": "2026-09-24T14:05:31.120Z", "observations": "Two fields reviewed.", "status": "CORRECTED" }
```

Errors:

| Status | Message |
|---|---|
| 400 | `Provide at least one image.` |
| 400 | Any [`data` field](#multipart-data-field) error, including `Status must be PENDING or VERIFIED; CORRECTED is set automatically when corrections are sent.` |
| 400 | `Each uploaded image needs exactly one prediction (received {n} images and {m} predictions).` |
| 400 | `Prediction signature is invalid for image {N}.` |
| 400 | `Correction {k} refers to image index {i}, but only {n} images were uploaded.` |
| 400 | `Each image can be corrected at most once per request.` |
| 400 | `Patient with ID {id} does not exist.` |
| 400 | Image type or extension messages; more than 20 files |
| 413 | `File too large` |

Writes one `CREATE` audit record for the result, with a snapshot of the patient, every
prediction and every correction.

### POST /results/:id/predictions/with-files

Changes an existing result ("Continue Analysis") in **one database transaction**: new images with
their signed predictions, dilutions of existing predictions, corrections of the new and of the
existing predictions, the observations and the status. Either everything is stored or nothing is.

Request `multipart/form-data`: `images` (0–20 files, one per item of `newPredictions`, in the
same order: `images[i]` ↔ `newPredictions[i]`) and `data` ([rules](#multipart-data-field)).
**A result holds at most 20 images** (`MAX_IMAGES_PER_RESULT`), saved ones included: new images
that would exceed it answer `400 "A result can hold at most 20 images."`.
Every field of `data` is optional:

| Field | Rules |
|---|---|
| `newPredictions` | Array, one item per image: `{ prediction, confidencePercentage, classificationLevel, signature, dilution }` with the same rules and [signature check](#post-resultsbatchwith-files) as `predictions` of the create endpoint |
| `updatedDilutions` | Array (at most 100) of `{ "predictionId": <int>, "dilution": <Dilution> }`; every id must belong to this result |
| `corrections` | Array (at most 100) of `{ imageIndex, correctedPrediction, observations? }`: corrections of the **new** images; `imageIndex` indexes `newPredictions` (integer ≥ 0, lower than its length, unique) |
| `existingCorrections` | Array (at most 100) of `{ predictionId, correctedPrediction, observations? }`: corrections of predictions that already belong to this result; each `predictionId` at most once |
| `observations` | String, at most 1 000 characters; `""` or `null` clears them (stored as `null`) |
| `status` | `PENDING` or `VERIFIED`, subject to the [status transitions](#status-transitions); moving to `VERIFIED` records the verifier. `CORRECTED` is never requested: corrections set it |

Correction `observations` follow the same rule (`""` or `null` means none). At least one field
must be present; otherwise
`400 "Provide at least one change: newPredictions, updatedDilutions, corrections, existingCorrections, observations or status."`
(empty arrays count as absent).

Example `data` (one new image corrected by index, one existing prediction corrected, an edited
dilution and new observations):

```json
{
  "newPredictions": [
    { "prediction": "NUCLEAR", "confidencePercentage": 88.1, "classificationLevel": "general",
      "signature": "<signature from /predictions/analyze>", "dilution": "320" }
  ],
  "updatedDilutions": [{ "predictionId": 101, "dilution": "640" }],
  "corrections": [{ "imageIndex": 0, "correctedPrediction": "NUCLEAR_HOMOGENEOUS", "observations": "Reviewed." }],
  "existingCorrections": [{ "predictionId": 102, "correctedPrediction": "NUCLEAR_SPECKLED" }],
  "observations": "Second field reviewed."
}
```

What is stored:

- **Only real changes count.** A dilution equal to the stored one, observations equal to the
  stored text (`""`, `null` and no text are the same) and a correction whose class equals the
  prediction's **current** class (its latest correction, else the model class; for a new image,
  its model class) are ignored: nothing is written for them.
- **Any stored correction** makes the result `CORRECTED` and clears `verifiedBy` and
  `verifiedAt`; `status` is then ignored. Without a stored correction, `status` follows the
  transition table (keeping the current status is a no-op).
- **Verified lock.** On a `VERIFIED` result, new images, a changed dilution or changed
  observations answer `409 "Verified results cannot be modified."` for every role; corrections
  are allowed for ADMIN users only (STANDARD: 403). A request whose values all equal the stored
  ones is accepted and changes nothing.

Order of the checks: the `data` rules; at least one change; one prediction per image; the
signatures (before the result is loaded); correction indexes and duplicates; the result exists;
every referenced prediction belongs to it; the access rules, the verified lock and the status
transition; the image cap. Then the images are written, and inside the transaction the result row
is read again with an update lock (`UPDLOCK`) and the access rules, the lock and the transition
are checked again on it, and the saved images are counted again, so a verification or an append
that committed in the meantime is honoured. On any failure the transaction rolls back and the
written images are deleted.

Response `201`: `ResultDetailDto` after the change, plus `addedPredictionIds`: the ids of the
predictions created by this request, in upload order (empty without new images):

```json
{ "resultId": 42, "status": "CORRECTED", "verifiedBy": null, "verifiedAt": null, "…": "…", "addedPredictionIds": [105] }
```

Errors:

| Status | Message |
|---|---|
| 400 | Any [`data` field](#multipart-data-field) error, including `Status must be PENDING or VERIFIED; CORRECTED is set automatically when corrections are sent.`, `At most 100 dilution updates can be sent at once.`, `At most 100 corrections can be sent at once.`, `At most 100 existing corrections can be sent at once.` |
| 400 | `Provide at least one change: newPredictions, updatedDilutions, corrections, existingCorrections, observations or status.` |
| 400 | `Each uploaded image needs exactly one prediction (received {n} images and {m} predictions).` |
| 400 | `Prediction signature is invalid for image {N}.` |
| 400 | `Correction {k} refers to image index {i}, but only {n} images were uploaded.` |
| 400 | `Each image can be corrected at most once per request.` |
| 400 | `Each prediction can be corrected at most once per request.` |
| 400 | `Predictions {ids} do not belong to result {id}.` |
| 400 | `A result can hold at most 20 images.` (saved images plus new ones) |
| 400 | Image type or extension messages; more than 20 files |
| 403 | `You do not have permission to modify this result.` (STANDARD: not their result and not `PENDING`) |
| 403 | `You cannot correct predictions of a verified result. Only an administrator can do this.` (STANDARD correction of a `VERIFIED` result) |
| 404 | `Result with ID {id} not found.` |
| 409 | `Verified results cannot be modified.` |
| 409 | `Invalid status transition from {X} to {Y}.` |
| 413 | `File too large` |

Writes one consolidated `UPDATE` audit record after the commit: previous and new snapshots with
the status, the observations, every prediction of the result, the added predictions, the stored
corrections and one entry per changed dilution. A request whose values all equal the stored ones
changes nothing and writes no audit record (the response is the same).

### PATCH /results/:id

Changes the status and/or observations, in a transaction that reads the result row with an
update lock.

| Field | Rules |
|---|---|
| `status` | Optional `ResultStatus` |
| `observations` | Optional string, at most 1 000 characters; `""` or `null` clears them (stored as `null`) |

The web app uses this endpoint to verify a pending exam from Home.

Changing the observations of a `VERIFIED` result answers `409 "Verified results cannot be modified."`
(every role). Sending the stored text again, or `status: "VERIFIED"` for a `VERIFIED` result, is
a no-op and answers `200`.

#### Status transitions

They apply to this endpoint and to the `status` field of
[`POST /results/:id/predictions/with-files`](#post-resultsidpredictionswith-files) (when that
request stores no correction), and are checked after the access rules:

| Current status | Requested status | Outcome |
|---|---|---|
| `PENDING` | `VERIFIED` | Allowed; records the current user and time as verifier (`verifiedBy`, `verifiedAt`) |
| `CORRECTED` | `VERIFIED` | Allowed; records the verifier the same way |
| any | the same status | Allowed; the status does not change (a no-op) |
| any other pair | – | `409 "Invalid status transition from {X} to {Y}."` |

So nothing returns a result to `PENDING`, and `CORRECTED` is reached only by storing a correction
(the [correction endpoints](#post-resultscorrections) or the corrections of the append endpoint),
which also clears the verification. A `VERIFIED` result leaves that status only through an ADMIN
correction.

Response `200`: `ResultDetailDto`. Writes one `UPDATE` audit record per changed field (a cleared
field is recorded with an empty new value); nothing when no field changed.

Errors: `404 "Result with ID {id} not found."`, `403 "You do not have permission to modify this result."`,
`409 "Verified results cannot be modified."`, `409 "Invalid status transition from {X} to {Y}."`.

### POST /results/corrections

Corrects one prediction.

| Field | Rules |
|---|---|
| `predictionId` | Required positive integer |
| `correctedPrediction` | Required `PredictionClass` |
| `observations` | Optional string, at most 1 000 characters; `""` or `null` means none |

Response `201`: `CorrectionDetailDto`. In one transaction, on the result row read with an update
lock, the access rules are checked again, the correction is stored and the result becomes
`CORRECTED` with `verifiedBy` and `verifiedAt` cleared (also when an ADMIN corrects a `VERIFIED`
result). Unlike the append endpoint, these endpoints store a correction even when its class
equals the current one. Writes a `CREATE` audit record for the correction.

Errors: `404 "Prediction with ID {id} not found."`, `403` (see access rules).

### POST /results/corrections/batch

Corrects several predictions of **one** result at once, with a single audit record.

Request:

```json
{
  "corrections": [
    { "predictionId": 101, "correctedPrediction": "NUCLEOLAR_HOMOGENEOUS", "observations": "Reviewed." },
    { "predictionId": 102, "correctedPrediction": "NUCLEAR_SPECKLED" }
  ]
}
```

`corrections`: required array with 1 to 100 items (`400 "At least one correction is required."`,
`400 "At most 100 corrections can be sent at once."`); item rules as in
[`POST /results/corrections`](#post-resultscorrections).

Response `201`: array of `CorrectionDetailDto`, in creation order. In one transaction (same
locked re-check) the result becomes `CORRECTED` and its verification is cleared.

Errors: `400 "Each prediction can be corrected at most once per request."`,
`400 "All corrections must belong to the same result."`,
`404 "Predictions with IDs {ids} not found."`, `403` (see access rules).

The audit record is a `CREATE` of entity `CORRECTION` whose entity id is the **result id**; it
holds the previous and new result status, a patient snapshot and every correction.

### GET /results/:id/corrections

Every correction of every prediction of the result, newest first (by `correctedDate`, then id).
Response `200`: array of `CorrectionDetailDto` (empty when there are none).

Errors: `404 "Result with ID {id} not found."`,
`403 "You do not have permission to view the corrections of this result."`.

### GET /results/:id/corrections/latest

The newest correction of the result. Response `200`: `CorrectionDetailDto`.

Errors: as above, plus `404 "No corrections found for the result with ID {id}."`.

---

## Reports

ADMIN and STANDARD; every user can see every report. Source: `api/src/modules/reports/`, DTOs in
`api/src/DTOs/reports/`.

A **report** is a result whose status is `VERIFIED` or `CORRECTED`.

### GET /reports/search

Query:

| Parameter | Rules |
|---|---|
| `patientName` | Optional string; partial match on the patient's full name (`LIKE` wildcards in the input are escaped; case-insensitive with SQL Server's default collation) |
| `patientDocument` | Optional string; exact match on the document number |
| `page`, `limit` | Optional integers ≥ 1; `limit` capped at 50 |

At least one of `patientName` and `patientDocument` is required; with both, both must match.
Sorted by date, newest first.

Response `200`: paginated items:

```json
{
  "resultId": 42,
  "dateAndHour": "2026-09-24T14:05:31.120Z",
  "status": "CORRECTED",
  "patientName": "Jane Doe",
  "patientDocument": "1234567890",
  "patientPhoneNumber": "5550100",
  "patientPhonePrefix": "+1",
  "patientEmail": "jane.doe@example.com",
  "observations": "Two fields reviewed."
}
```

Errors: `400 "Provide at least one search criterion (patient name or document number)."`.

### GET /reports/:id

The full clinical report of a result.

Response `200`:

```json
{
  "resultId": 42,
  "dateAndHour": "2026-09-24T14:05:31.120Z",
  "observations": "Two fields reviewed.",
  "status": "CORRECTED",
  "patient": { "patientId": 12, "fullName": "Jane Doe", "documentType": "NATIONAL_ID", "documentNumber": "1234567890", "gender": "F", "birthDate": "1980-05-17T00:00:00.000Z", "phonePrefix": "+1", "phoneNumber": "5550100", "email": "jane.doe@example.com" },
  "medic": { "userId": 1, "fullName": "System Administrator", "professionalCard": "ADMIN-0001", "email": "admin@example.com", "username": "admin" },
  "verifiedBy": null,
  "verifiedAt": null,
  "predictions": [
    {
      "predictionId": 101,
      "prediction": "NUCLEOLAR_CLUMPY",
      "confidencePercentage": 91.23,
      "imagePath": "…",
      "imageUrl": "http://localhost:8001/api/v1/files/predictions/…",
      "dilution": "160",
      "correction": {
        "correctedResultId": 7,
        "correctedPrediction": "NUCLEOLAR_HOMOGENEOUS",
        "observations": "Reviewed.",
        "correctedDate": "2026-09-24T14:12:40.000Z",
        "correctedBy": 1
      },
      "finalPattern": "NUCLEOLAR_HOMOGENEOUS"
    }
  ],
  "createdAt": "2026-09-24T14:05:31.120Z",
  "lastModifiedAt": "2026-09-24T14:12:40.000Z"
}
```

Rules (from `reports.service.ts`):

- `predictions` lists **every** prediction of the result, ordered by id. `correction` is the
  prediction's latest correction (newest `correctedDate`, then highest id) and `finalPattern`
  is its class, or the model prediction when there is no correction.
- `medic` (the responsible physician) is whoever acted last between the latest correction of
  the result and the verification (`verifiedBy`/`verifiedAt`); the creator when neither exists.
- `lastModifiedAt` is the latest of: the result date, the latest correction, the verification
  time and the latest `UPDATE` audit record of the result.

Errors: `404 "Report with ID {id} not found."`,
`404 "Result with ID {id} is not available as a report (status: PENDING)."`.

---

## Audit trail

ADMIN only. Source: `api/src/modules/traceability/`, DTOs in `api/src/DTOs/traceability/`. What
is recorded is described in [ARCHITECTURE.md](ARCHITECTURE.md#6-audit-trail).

### GET /traceability

Query (all optional; the filters combine with AND):

| Parameter | Rules |
|---|---|
| `page` | Integer ≥ 1, default 1 |
| `limit` | Integer 1–100, default 10; above 100 → `400 "Limit cannot be greater than 100."` |
| `from` | ISO 8601 instant **with a time zone** (`Z` or an offset), e.g. `2026-09-24T05:00:00.000Z`; **inclusive** (`dateAndHour >= from`) |
| `to` | Same format; **exclusive** (`dateAndHour < to`). `from` must not be later than `to` (equal gives an empty range) |
| `userName` | String, at most 100 characters: the actor's full name contains it (trimmed, case-insensitive, `LIKE` wildcards taken literally). Records without a user ("System") never match. Blank is ignored |
| `activityType` | One `ActivityType` value |

Validation errors (`400`):

| Problem | Message |
|---|---|
| `from`/`to` not an instant with a zone (e.g. `2026-09-24`) | `from must be an ISO 8601 instant with a time zone (e.g. 2026-09-24T05:00:00.000Z).` (or `to must …`) |
| `from` later than `to` | `from cannot be later than to.` |
| `userName` | `User name must be a string.`, `User name must be at most 100 characters long.` |
| `activityType` | `Invalid activity type. It must be one of: CREATE, UPDATE, DELETE, PASSWORD_RESET_REQUEST, PASSWORD_RESET_COMPLETED, PASSWORD_RESET_EXPIRED.` |

The server never guesses a time zone: the client turns the chosen days into instants. The web app
sends the local midnight that starts the first day as `from` and the local midnight after the
last day as `to` (browser time zone); in UTC-5, the single day 2026-09-24 is
`from=2026-09-24T05:00:00.000Z&to=2026-09-25T05:00:00.000Z`. Its CSV export requests every page
with the same filters and `limit=100`.

Sorted newest first (then by id).

Response `200`: paginated items:

```json
{
  "traceabilityId": 310,
  "userFullName": "Jane Doe",
  "userRole": "STANDARD",
  "dateAndHour": "2026-09-24T14:05:31.500Z",
  "activityType": "CREATE",
  "activityTypeLabel": "Create",
  "entityType": "RESULT"
}
```

`userFullName` is `"System"` and `userRole` is `null` for records without a user: system
actions such as the administrator created by the seed script.

### GET /traceability/:id

Response `200` (`TraceabilityDetailDto`):

```json
{
  "traceabilityId": 310,
  "generalInfo": { "dateAndHour": "2026-09-24T14:05:31.500Z", "activityType": "UPDATE", "activityTypeLabel": "Update" },
  "userInfo": { "userId": 3, "username": "jdoe", "fullName": "Jane Doe", "role": "STANDARD", "email": "jane.doe@example.com" },
  "entityType": "RESULT",
  "entityTypeLabel": "Result",
  "patientInfo": { "patientId": 12, "fullName": "Jane Doe", "documentType": "NATIONAL_ID", "documentNumber": "1234567890" },
  "resultInfo": { "resultId": 42, "status": "PENDING", "predictionsCount": 3, "predictions": [] },
  "fieldChanges": [
    { "fieldName": "status", "fieldLabel": "Status", "previousValue": "PENDING", "newValue": "VERIFIED" }
  ]
}
```

- `patientInfo` appears for `PATIENT`, `RESULT` and `CORRECTION` records, `affectedUserInfo`
  (`userId`, `username`, `fullName`, `role`, `email`) for `USER` records, `resultInfo` for
  `RESULT` and `CORRECTION` records. Sections are omitted when the entity no longer exists.
- `resultInfo` may also contain `dateAndHour`, `observations`, `newPredictionsAdded`,
  `addedPredictions` and `originalResultDateTime`; each prediction has `predictionId`,
  `prediction`, `confidencePercentage`, `imagePath`, `imageUrl`, `dilution` and its current
  `correction`, if any.
- `fieldChanges` lists the recorded values: one entry for a single-field record, every stored
  field for `CREATE`/`DELETE`, and the differing fields of the two snapshots for a consolidated
  `UPDATE`. Values are display strings.

Errors: `404 "Audit record with ID {id} not found."`.

---

## Files

Source: `api/src/modules/files/`. Images are never served as static files; these JWT-protected
routes are the only way to read them. No route deletes or replaces a file: stored prediction
images are removed only by the API itself, when the result write they belong to fails. Logs
never contain the original upload name, only the opaque `<uuid>-<timestamp>` prefix of the stored
name.

File names from the URL must be bare names: empty names, `.`, `..`, names with `/`, `\` or a NUL
byte, and names that would resolve outside the folder are rejected with
`400 "Invalid file name."` (this also covers URL-encoded `..%2F`).

### GET /files/predictions/:filename

ADMIN and STANDARD. Streams a stored prediction image with `Content-Type` from its extension and
`Cache-Control: private, max-age=3600`.

Errors: `400 "Invalid file name."`, `404 "Prediction image '{filename}' not found."`.

The route checks the role, not the result's owner: any signed-in user who knows a file name can
read it. File names start with a random UUID.

### GET /files/reference/classes

ADMIN and STANDARD. The pattern classes that have a folder in the reference gallery
(`{UPLOADS_DIR}/reference/<PredictionClass>/`), in `PredictionClass` order. Folders with other
names are ignored.

Response `200`: `["NUCLEAR_HOMOGENEOUS", "CYTOPLASMIC_RETICULAR_AMA"]`, or `[]` when the gallery
is empty (the default).

### GET /files/reference/:className

ADMIN and STANDARD. The reference images of one class, sorted by file name; only files with an
allowed image extension are listed.

Response `200`:

```json
[{ "filename": "example-1.jpg", "url": "/files/reference/NUCLEAR_HOMOGENEOUS/example-1.jpg" }]
```

`url` is relative to the API base (`/api/v1`). A class without a folder returns `[]`.

Errors: `400 "Unknown pattern class '{className}'."`.

### GET /files/reference/:className/:filename

ADMIN and STANDARD. Streams one reference image with `Cache-Control: private, max-age=86400`.

Errors: `400 "Unknown pattern class '{className}'."`, `400 "Invalid file name."`,
`400 "File extension not allowed."`, `404 "Reference image '{filename}' not found."`.

---

## Prediction service API

Source: `api-predictor/app/` (`routers/prediction.py`, `routers/health.py`,
`core/security.py`, `services/prediction_service.py`). Only the REST API calls this service; its
CORS allow-list (`ALLOWED_ORIGINS`) is empty by default. Interactive OpenAPI docs (`/docs`,
`/redoc`, `/openapi.json`) are served only when `DEBUG=true`.

Errors use FastAPI's envelope `{ "detail": "..." }`.

### GET /api/v1/health

No authentication (used by container health checks).

| Status | Body | Meaning |
|---|---|---|
| 200 | `{ "status": "ok", "models_loaded": 6 }` | The general model is loaded; `models_loaded` counts loaded checkpoints |
| 503 | `{ "status": "unavailable", "models_loaded": 0 }` | The general model is missing, so no prediction can run |

### POST /api/v1/predict

Classifies one image. Requires `Authorization: Bearer <key>` with one of the keys in
`API_KEYS` (compared in constant time; an empty `API_KEYS` rejects every request).

Request: `multipart/form-data` with the image in the field `file`. The extension (when the file
has a name) must be one of `ALLOWED_EXTENSIONS` (default `.jpg`, `.jpeg`, `.png`, `.bmp`, `.tiff`)
and the content type must start with `image/`.

Images are processed one at a time (see [ARCHITECTURE.md](ARCHITECTURE.md#3-classification-pipeline-api-predictor)).

Image modes (Pillow): RGB, 8-bit grey (`L`) and 16-bit grey (`I;16*`) are used as they are; other
grey modes (bilevel, grey with alpha) are converted to `L`, and palette, RGBA, CMYK, YCbCr and the
other colour modes to `RGB`. 32-bit integer (`I`) and floating-point (`F`) images are rejected
with `400 "Unsupported image mode."`, because they have no lossless 8-bit path and OpenCV would
silently saturate them to black or white; so is any mode Pillow cannot convert, or a conversion
that does not give 8-bit or 16-bit samples.

Response `200`:

```json
{
  "filename": "slide_01.png",
  "prediction": "Nucleolar Clumpy",
  "prediction_key": "NUCLEOLAR_CLUMPY",
  "confidence": 0.912345,
  "confidence_percentage": 91.23,
  "class_probabilities": {
    "NUCLEOLAR_CLUMPY": 0.912345,
    "NUCLEOLAR_HOMOGENEOUS": 0.052110,
    "NUCLEOLAR_PUNCTATE": 0.035545
  },
  "patch_statistics": {
    "total_patches": 6,
    "average_confidence": 88.4,
    "min_confidence": 71.2,
    "max_confidence": 97.9,
    "by_class": {
      "NUCLEOLAR_CLUMPY": { "count": 5, "percentage": 83.3, "avg_confidence": 91.0 },
      "NUCLEOLAR_HOMOGENEOUS": { "count": 1, "percentage": 16.7, "avg_confidence": 71.2 },
      "NUCLEOLAR_PUNCTATE": { "count": 0, "percentage": 0.0, "avg_confidence": 0 }
    }
  },
  "classification_level": "expert",
  "note": null,
  "voting_method": "hybrid_voting",
  "status": "success"
}
```

(Values are illustrative.)

| Field | Meaning |
|---|---|
| `prediction` | Display name of the final class |
| `prediction_key` | Class key (`PredictionClass` value); the web app uses this field |
| `classification_level` | `general`, `competent` or `expert`: the level of the returned class (AC-18 is reported as `expert`) |
| `confidence`, `confidence_percentage` | Voted confidence (0–1 and %) of the model that produced the returned class |
| `class_probabilities` | Voted probability of every class of that model |
| `patch_statistics` | Patch votes of that model: count, share and mean confidence per class; mean/min/max patch confidence (%) |
| `note` | Why the classification stopped early, or `null`; e.g. `Low confidence at expert level (70.12% < 75.0%); classified at competent level` |

When a lower level falls back (low confidence, missing model, or an error), `prediction`,
`confidence`, `class_probabilities` and `patch_statistics` come from the level whose class is
returned.

With `ENABLE_HIERARCHICAL_CLASSIFICATION=false` only the general model runs, `prediction` holds
the class key (not the display name) and `classification_level` and `note` are absent.

Errors:

| Status | `detail` |
|---|---|
| 401 | `API key required.` (no `Authorization` header) or `Invalid API key.`; with `WWW-Authenticate: Bearer` |
| 400 | `File extension not allowed. Use: .jpg, .jpeg, .png, .bmp, .tiff.` |
| 400 | `The file must be an image.` (content type) |
| 400 | `The file is empty.`, `The file is not a valid image.`, `Unsupported image mode.` |
| 413 | `The file exceeds the maximum size of 10 MB.` (`MAX_FILE_SIZE`) |
| 413 | `The image exceeds the maximum of 50,000,000 pixels.` (`MAX_IMAGE_PIXELS`, checked before decoding) |
| 422 | FastAPI request validation error (e.g. no `file` field) |
| 503 | `Prediction models are not loaded.` |
| 500 | `Prediction failed.` or `Internal server error.` (the cause is logged, never returned) |
