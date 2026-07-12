# AssetFlow — Backend API Documentation

Complete reference for the AssetFlow REST API: authentication, roles, every endpoint with request/response schemas, and the full database schema.

---

## Base URL

```
https://assetflow-production-85d2.up.railway.app
```

All module endpoints are prefixed with `/api` (e.g. `https://assetflow-production-85d2.up.railway.app/api/auth/login`). The only exception is the health check, which lives at `/health`.

---

## Table of Contents

1. [Response Envelope](#1-response-envelope)
2. [Authentication (Cookies & Bearer Token)](#2-authentication-cookies--bearer-token)
3. [Roles & Access Scoping](#3-roles--access-scoping)
4. [Health](#4-health)
5. [Auth API](#5-auth-api) — `/api/auth`
6. [Users API](#6-users-api) — `/api/users`
7. [Departments API](#7-departments-api) — `/api/departments`
8. [Categories API](#8-categories-api) — `/api/categories`
9. [Locations API](#9-locations-api) — `/api/locations`
10. [Assets API](#10-assets-api) — `/api/assets`
11. [Allocations API](#11-allocations-api) — `/api/allocations`
12. [Transfers API](#12-transfers-api) — `/api/transfers`
13. [Resources & Bookings API](#13-resources--bookings-api) — `/api/resources`, `/api/bookings`
14. [Maintenance API](#14-maintenance-api) — `/api/maintenance`
15. [Audit Cycles API](#15-audit-cycles-api) — `/api/audit-cycles`
16. [Dashboard API](#16-dashboard-api) — `/api/dashboard`
17. [Reports API](#17-reports-api) — `/api/reports`
18. [Notifications API](#18-notifications-api) — `/api/notifications`
19. [Activity Logs API](#19-activity-logs-api) — `/api/activity-logs`
20. [Error Reference](#20-error-reference)
21. [Database Schema](#21-database-schema)
22. [Seeded Test Accounts](#22-seeded-test-accounts)

---

## 1. Response Envelope

Every endpoint (except CSV exports and `/health`) returns the same JSON envelope:

```json
{
  "success": true,
  "message": "Human-readable summary",
  "data": { }
}
```

| Field     | Type              | Description                                        |
|-----------|-------------------|----------------------------------------------------|
| `success` | boolean           | `true` on 2xx, `false` on any error                |
| `message` | string            | Human-readable result / error message              |
| `data`    | object \| null    | Payload; `null` when there is nothing to return    |

Error responses use the same shape with `success: false` and `data: null`.

**Request body limit:** JSON bodies are capped at **20 KB** (`express.json({ limit: '20kb' })`). File uploads use `multipart/form-data` (see [10.7 Assets — documents](#107-post-apiassetsiddocuments)).

---

## 2. Authentication (Cookies & Bearer Token)

The API issues a **JWT access token** and an **opaque refresh token** on signup / login. Both are delivered as **HttpOnly cookies**, and the access token is *also* accepted via the `Authorization` header (fallback mode for Postman, mobile clients, etc.).

### 2.1 Tokens

| Token             | Name | Format                                   | Lifetime            | Where it lives                                |
|-------------------|------|------------------------------------------|---------------------|-----------------------------------------------|
| Access token      | `at` | JWT — payload `{ userId, role, departmentId }`, issuer `assetflow-api`, audience `api` | **15 minutes** (`ACCESS_TOKEN_TTL`) | Cookie `at` (Path=`/`) **or** `Authorization: Bearer <jwt>` header |
| Refresh token     | `rt` | Opaque 128-hex-char random string; only its SHA-256 hash is stored in the DB | **7 days** (`REFRESH_TOKEN_TTL_DAYS`) | Cookie `rt` (Path=`/api/auth` — sent only to auth endpoints) |

### 2.2 Cookie attributes

| Attribute  | Production                | Development        |
|------------|---------------------------|--------------------|
| `HttpOnly` | ✅                        | ✅                 |
| `Secure`   | ✅                        | ❌ (plain HTTP)    |
| `SameSite` | `None` (cross-site SPA)   | `Lax`              |
| `Path`     | `at` → `/` · `rt` → `/api/auth` | same         |

Because cookies are cross-site in production, browser clients **must** send requests with `credentials: 'include'` (CORS on the server is configured with `credentials: true` and an origin allowlist from `CLIENT_URL`).

### 2.3 Using the API

**Option A — Cookies (browsers / the frontend):**

```js
fetch('https://assetflow-production-85d2.up.railway.app/api/auth/me', {
  credentials: 'include',
});
```

**Option B — Bearer token (Postman, scripts, mobile):**

```
GET /api/assets HTTP/1.1
Host: assetflow-production-85d2.up.railway.app
Authorization: Bearer <access-token-jwt>
```

> The middleware checks the `at` cookie **first**, then falls back to the `Authorization: Bearer` header. Note that the login/signup responses set the token in cookies only — to use bearer mode, capture the `at` cookie value from the `Set-Cookie` response header.

**Quick start — demo Admin login (curl):**

```bash
# Log in with the seeded demo Admin account (see §22) and store the cookies
curl -X POST https://assetflow-production-85d2.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "admin@assetflow.com", "password": "Admin@123" }' \
  -c cookies.txt

# Call any protected endpoint with the saved cookies
curl https://assetflow-production-85d2.up.railway.app/api/auth/me -b cookies.txt
```

### 2.4 Token lifecycle

- **`POST /api/auth/refresh`** rotates the refresh token: the old one is revoked and chained to its replacement, and a fresh access token is minted. Role / department are re-read from the DB, so promotions apply without re-login.
- **Reuse detection:** presenting an already-revoked refresh token is treated as theft — *every* active session for that user is revoked.
- **Password reset** revokes all sessions. **Password change** keeps the current session and revokes all others. **Deactivating a user** revokes all their refresh tokens (access dies within 15 minutes).

---

## 3. Roles & Access Scoping

`users.role` is one of four values:

| Role            | Description                                                                   |
|-----------------|-------------------------------------------------------------------------------|
| `ADMIN`         | Full org-wide control: user management, org setup, audits, activity logs      |
| `ASSET_MANAGER` | Org-wide asset operations: register/allocate assets, maintenance, transfers   |
| `DEPT_HEAD`     | Read/approve within **their own department** only                             |
| `EMPLOYEE`      | Self-service: own assets, own bookings, raise maintenance, request transfers  |

**Signup always creates an `EMPLOYEE`.** Roles are changed only by an Admin via `PATCH /api/users/:id/role` (promotion to `ADMIN` is never accepted).

### List scoping (applies to assets, allocations, bookings, maintenance, dashboard)

| Role                    | Sees                                                                 |
|-------------------------|----------------------------------------------------------------------|
| `ADMIN`, `ASSET_MANAGER`| Everything (org-wide)                                                |
| `DEPT_HEAD`             | Rows belonging to users/assets in **their department**               |
| `EMPLOYEE`              | Only **their own** rows (assets they hold, bookings they made, etc.) |

### Auth error codes

| Status | Meaning                                                             |
|--------|---------------------------------------------------------------------|
| `401`  | No / invalid / expired token → `"Not authenticated"`                |
| `403`  | Valid token, insufficient role → `"Insufficient permissions"`, or out-of-department → `"This record is outside your department"` |

---

## 4. Health

### 4.1 GET `/health`

Public — no auth. Verifies the database connection. *(Does not use the standard envelope's `data: null` convention; includes a `timestamp`.)*

**Response `200`:**

```json
{
  "success": true,
  "message": "API is healthy",
  "data": {
    "status": "ok",
    "environment": "production",
    "uptime_seconds": 4210,
    "database": { "status": "connected", "latency_ms": 12.4 }
  },
  "timestamp": "2026-07-12T10:00:00.000Z"
}
```

**Response `503`:** same shape with `"status": "degraded"` and `database.status: "disconnected"`.

---

## 5. Auth API

Base: `/api/auth`

| # | Method | Endpoint            | Auth              | Description                                  |
|---|--------|---------------------|-------------------|----------------------------------------------|
| 1 | POST   | `/signup`           | Public            | Register (always `EMPLOYEE`) + auto-login    |
| 2 | POST   | `/login`            | Public            | Login, sets `at` + `rt` cookies              |
| 3 | POST   | `/refresh`          | `rt` cookie       | Rotate refresh token, mint new access token  |
| 4 | POST   | `/logout`           | `rt` cookie (optional) | Revoke session, clear cookies           |
| 5 | GET    | `/me`               | Required          | Current user (fresh from DB)                 |
| 6 | POST   | `/forgot-password`  | Public            | Email a 6-digit OTP                          |
| 7 | POST   | `/reset-password`   | Public            | OTP + new password (atomic)                  |
| 8 | POST   | `/change-password`  | Required          | Change password while logged in              |

### 5.1 POST `/api/auth/signup`

**Request body:**

```json
{
  "name": "Jane Doe",
  "email": "jane@gmail.com",
  "password": "Secret@123"
}
```

| Field      | Type   | Rules                                                                 |
|------------|--------|-----------------------------------------------------------------------|
| `name`     | string | Required, 2–100 characters                                            |
| `email`    | string | Required, valid format, **must be from an allowed provider** (gmail.com, googlemail.com, outlook.com, hotmail.com, live.com, yahoo.com, yahoo.co.in, icloud.com, me.com, protonmail.com, proton.me, rediffmail.com, aol.com, zoho.com) |
| `password` | string | Min 8 chars, ≥1 uppercase, ≥1 digit, ≥1 symbol                        |

A `role` field in the body is **ignored** — the account is always created as `EMPLOYEE`. A welcome email is sent in the background.

**Response `201`** (also sets `at` + `rt` cookies):

```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": {
      "id": "uuid",
      "name": "Jane Doe",
      "email": "jane@gmail.com",
      "role": "EMPLOYEE",
      "departmentId": null,
      "status": "ACTIVE"
    }
  }
}
```

**Errors:** `400` (validation), `409` `"Email already registered"`.

### 5.2 POST `/api/auth/login`

**Request body** (example uses the seeded **demo Admin account** — full list of demo logins in [§22](#22-seeded-test-accounts)):

```json
{
  "email": "admin@assetflow.com",
  "password": "Admin@123"
}
```

**Response `200`** (sets `at` + `rt` cookies):

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "name": "System Admin",
      "email": "admin@assetflow.com",
      "role": "ADMIN",
      "departmentId": null,
      "status": "ACTIVE"
    }
  }
}
```

**Errors:** `400` missing fields, `401` `"Invalid credentials"` (identical for unknown email and wrong password — anti-enumeration), `403` `"Account is inactive. Contact your administrator."`.

### 5.3 POST `/api/auth/refresh`

No body. Requires the `rt` cookie. Rotates the refresh token and sets fresh `at` + `rt` cookies.

**Response `200`:**

```json
{
  "success": true,
  "message": "Session refreshed",
  "data": {
    "user": { "id": "uuid", "name": "Jane Doe", "role": "EMPLOYEE", "departmentId": null }
  }
}
```

**Errors:** `401` `"Session expired. Please log in again."` (missing / unknown / expired token, and **token reuse** — which also revokes every session for the user), `403` `"Account is inactive."`.

### 5.4 POST `/api/auth/logout`

No body. Revokes the presented refresh token (if any) and clears both cookies. **Always `200`:**

```json
{ "success": true, "message": "Logged out", "data": null }
```

### 5.5 GET `/api/auth/me`

Auth required. Role and department are read fresh from the DB, not from the token.

**Response `200`:**

```json
{
  "success": true,
  "message": "User fetched",
  "data": {
    "user": {
      "id": "uuid",
      "name": "Jane Doe",
      "email": "jane@gmail.com",
      "role": "EMPLOYEE",
      "departmentId": "uuid",
      "status": "ACTIVE",
      "department": { "id": "uuid", "name": "Engineering" }
    }
  }
}
```

### 5.6 POST `/api/auth/forgot-password`

**Request body:** `{ "email": "jane@gmail.com" }`

Sends a 6-digit OTP valid for **10 minutes**. Anti-enumeration: always returns the generic message even if the email is unknown.

**Response `200`:**

```json
{
  "success": true,
  "message": "If that email is registered, a reset code has been sent.",
  "data": null
}
```

**Errors:** `429` `"Please wait 60 seconds before requesting another code."` (per-user rate limit).

### 5.7 POST `/api/auth/reset-password`

OTP verification + password update in **one atomic request**. All existing sessions are revoked on success.

**Request body:**

```json
{
  "email": "jane@gmail.com",
  "otp": "123456",
  "newPassword": "NewSecret@123"
}
```

**Response `200`:** `"Password updated. You can log in now."`

**Errors:** `400` `"Invalid or expired code"` (each wrong OTP increments an attempts counter), `429` `"Too many attempts. Request a new code."` (after 5 failed attempts), `400` password-rule message.

### 5.8 POST `/api/auth/change-password`

Auth required.

**Request body:**

```json
{
  "currentPassword": "OldSecret@123",
  "newPassword": "NewSecret@123"
}
```

**Response `200`:** `"Password updated"`. The **current session survives**; every other session is revoked.

**Errors:** `400` `"Current password is incorrect"`, `400` password-rule message.

---

## 6. Users API

Base: `/api/users` — auth required. **Everything is Admin-only except `PATCH /me/profile`.** This is the only module that can ever write `users.role`.

| # | Method | Endpoint            | Role      | Description                                    |
|---|--------|---------------------|-----------|------------------------------------------------|
| 1 | PATCH  | `/me/profile`       | Any user  | Update own name / designation                  |
| 2 | GET    | `/`                 | ADMIN     | Paginated employee directory with filters      |
| 3 | GET    | `/:id/assets`       | ADMIN     | Assets currently held by a user                |
| 4 | GET    | `/:id/activity`     | ADMIN     | Recent activity by a user                      |
| 5 | PATCH  | `/:id/role`         | ADMIN     | Promote / demote a user (never to ADMIN)       |
| 6 | PATCH  | `/:id/department`   | ADMIN     | Assign or unassign (`null`) a department       |
| 7 | PATCH  | `/:id/status`       | ADMIN     | Activate / deactivate (revokes sessions)       |

### 6.1 PATCH `/api/users/me/profile`

**Request body** (at least one field):

```json
{ "name": "Jane D.", "designation": "Senior Engineer" }
```

**Response `200`:**

```json
{
  "success": true,
  "message": "Profile updated",
  "data": { "user": { "id": "uuid", "name": "Jane D.", "designation": "Senior Engineer" } }
}
```

### 6.2 GET `/api/users`

**Query parameters:**

| Param          | Type   | Description                                        |
|----------------|--------|----------------------------------------------------|
| `page`         | number | Default `1`                                        |
| `limit`        | number | Default `20`, max `100`                            |
| `q`            | string | Search name / email (case-insensitive)             |
| `role`         | string | `ADMIN` \| `ASSET_MANAGER` \| `DEPT_HEAD` \| `EMPLOYEE` |
| `departmentId` | uuid   | Filter by department                               |
| `status`       | string | `ACTIVE` \| `INACTIVE`                             |

**Response `200`:**

```json
{
  "success": true,
  "message": "Users fetched",
  "data": {
    "users": [
      {
        "id": "uuid",
        "name": "Jane Doe",
        "email": "jane@gmail.com",
        "role": "EMPLOYEE",
        "department": { "id": "uuid", "name": "Engineering" },
        "status": "ACTIVE",
        "createdAt": "2026-07-01T10:00:00.000Z"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```

### 6.3 GET `/api/users/:id/assets`

Assets the user currently holds (allocation status `ACTIVE` or `RETURN_REQUESTED`).

**Response `200`:**

```json
{
  "success": true,
  "message": "User assets fetched",
  "data": {
    "assets": [
      {
        "id": "uuid",
        "tag": "AF-0001",
        "name": "MacBook Pro 14",
        "status": "ALLOCATED",
        "allocatedAt": "2026-07-01T10:00:00.000Z",
        "expectedReturnDate": "2026-08-01"
      }
    ]
  }
}
```

### 6.4 GET `/api/users/:id/activity`

**Query:** `limit` (default `5`, max `20`).

**Response `200`:**

```json
{
  "success": true,
  "message": "User activity fetched",
  "data": {
    "activities": [
      {
        "id": "uuid",
        "actionType": "ALLOCATION",
        "entityType": "ALLOCATION",
        "description": "Allocated AF-0001 (MacBook Pro 14) to Jane Doe",
        "createdAt": "2026-07-01T10:00:00.000Z"
      }
    ]
  }
}
```

### 6.5 PATCH `/api/users/:id/role`

**Request body:** `{ "role": "ASSET_MANAGER" }` — allowed values: `EMPLOYEE`, `ASSET_MANAGER`, `DEPT_HEAD`. **`ADMIN` is never accepted.**

**Response `200`:**

```json
{
  "success": true,
  "message": "Role updated to Asset Manager",
  "data": {
    "user": { "id": "uuid", "name": "Jane Doe", "role": "ASSET_MANAGER", "departmentId": "uuid" }
  }
}
```

**Errors:** `400` `"Invalid role"`, `400` `"Assign a department before promoting to Department Head"`, `403` `"You cannot change your own role"`, `404` user not found. If the user already has the role, returns `200` with `"User is already a <Role>"` and `data: null`.

### 6.6 PATCH `/api/users/:id/department`

**Request body:** `{ "departmentId": "uuid" }` — or `{ "departmentId": null }` to unassign.

**Response `200`:**

```json
{
  "success": true,
  "message": "Department updated",
  "data": {
    "user": {
      "id": "uuid",
      "departmentId": "uuid",
      "department": { "id": "uuid", "name": "Engineering" }
    }
  }
}
```

**Errors:** `400` `"Cannot unassign department from a Department Head"`, `404` user / department not found. Idempotent no-op returns `200` with an "already assigned" message.

### 6.7 PATCH `/api/users/:id/status`

**Request body:** `{ "status": "INACTIVE" }` — `ACTIVE` | `INACTIVE`.

Deactivation revokes **all** the user's refresh tokens; their access token dies within 15 minutes and cannot be renewed.

**Response `200`:**

```json
{
  "success": true,
  "message": "User deactivated",
  "data": { "user": { "id": "uuid", "status": "INACTIVE" } }
}
```

**Errors:** `400` `"Invalid status"`, `403` `"You cannot deactivate yourself"`, `404` user not found.

---

## 7. Departments API

Base: `/api/departments` — auth required. **Reads: any user. Writes: Admin only.**

| # | Method | Endpoint           | Role  | Description                            |
|---|--------|--------------------|-------|----------------------------------------|
| 1 | GET    | `/`                | Any   | List all departments                   |
| 2 | GET    | `/:id`             | Any   | Department detail                      |
| 3 | GET    | `/:id/employees`   | Any   | Members of a department                |
| 4 | GET    | `/:id/assets`      | Any   | Assets owned by a department           |
| 5 | POST   | `/`                | ADMIN | Create department                      |
| 6 | PATCH  | `/:id`             | ADMIN | Partial update                         |
| 7 | DELETE | `/:id`             | ADMIN | Delete (members become unassigned)     |

### Department object

```json
{
  "id": "uuid",
  "name": "Engineering",
  "head": { "id": "uuid", "name": "Department Head" },
  "parentId": null,
  "status": "ACTIVE",
  "employeeCount": 12,
  "assetCount": 34
}
```

### 7.1 GET `/api/departments`

**Response `200`:** `{ "departments": [ <Department>, ... ] }` — sorted by name.

### 7.2 GET `/api/departments/:id`

**Response `200`:** `{ "department": <Department> }` · **Errors:** `404`.

### 7.3 GET `/api/departments/:id/employees`

**Response `200`:**

```json
{
  "success": true,
  "message": "Department employees fetched",
  "data": {
    "employees": [
      { "id": "uuid", "name": "Jane Doe", "email": "jane@gmail.com", "role": "EMPLOYEE", "status": "ACTIVE", "createdAt": "…" }
    ]
  }
}
```

### 7.4 GET `/api/departments/:id/assets`

**Response `200`:**

```json
{
  "success": true,
  "message": "Department assets fetched",
  "data": {
    "assets": [
      { "id": "uuid", "tag": "AF-0001", "name": "MacBook Pro 14", "status": "AVAILABLE", "condition": "GOOD", "location": "HQ / 2F / 204", "category": "Laptops" }
    ]
  }
}
```

### 7.5 POST `/api/departments`

**Request body:**

```json
{ "name": "Engineering", "headId": "uuid|null", "parentId": "uuid|null" }
```

| Field      | Type          | Rules                       |
|------------|---------------|-----------------------------|
| `name`     | string        | Required, 2–100 characters  |
| `headId`   | uuid \| null  | Optional, must be a user    |
| `parentId` | uuid \| null  | Optional parent department  |

**Response `201`:** `{ "department": <Department> }`

**Errors:** `400` name length, `404` head/parent not found, `409` `"Department name already exists"`.

### 7.6 PATCH `/api/departments/:id`

**Request body** (any subset): `name`, `headId` (nullable), `parentId` (nullable, not itself), `status` (`ACTIVE`|`INACTIVE`).

**Response `200`:** `{ "department": <Department> }` · **Errors:** `400` `"Nothing to update"` / `"A department cannot be its own parent"`, `404`, `409` duplicate name.

### 7.7 DELETE `/api/departments/:id`

**Response `200`:** `"Department deleted"` (users' `department_id` becomes `NULL` via FK).

**Errors:** `404`, `409` `"Department has child departments. Reassign them first."`.

---

## 8. Categories API

Base: `/api/categories` — auth required. **Reads: any user. Writes: Admin only.** Categories carry per-category **custom field definitions** used by assets' `customValues`.

| # | Method | Endpoint                          | Role  | Description                        |
|---|--------|-----------------------------------|-------|------------------------------------|
| 1 | GET    | `/`                               | Any   | Flat list                          |
| 2 | GET    | `/tree`                           | Any   | Hierarchical tree with counts      |
| 3 | GET    | `/:id`                            | Any   | Single category                    |
| 4 | POST   | `/`                               | ADMIN | Create category                    |
| 5 | PATCH  | `/:id`                            | ADMIN | Partial update                     |
| 6 | DELETE | `/:id`                            | ADMIN | Delete category                    |
| 7 | POST   | `/:id/custom-fields`              | ADMIN | Add a custom field definition      |
| 8 | DELETE | `/:id/custom-fields/:fieldId`     | ADMIN | Remove a custom field definition   |

### Category object

```json
{
  "id": "uuid",
  "name": "Laptops",
  "customFields": [
    { "id": "uuid", "label": "Warranty Period", "key": "warrantyPeriod", "type": "date", "required": false }
  ],
  "status": "ACTIVE",
  "parentId": null,
  "icon": "💻",
  "assetCount": 12
}
```

### 8.1 GET `/api/categories`

**Response `200`:** `{ "categories": [ <Category>, ... ] }`

### 8.2 GET `/api/categories/tree`

**Response `200`:** `{ "tree": [ <Category & { children: [...] }>, ... ] }` — roots at the top level, children nested recursively.

### 8.3 GET `/api/categories/:id`

**Response `200`:** `{ "category": <Category> }` · **Errors:** `404`.

### 8.4 POST `/api/categories`

**Request body:**

```json
{
  "name": "Laptops",
  "customFields": [],
  "parentId": "uuid|null",
  "icon": "💻"
}
```

**Response `201`:** `{ "category": <Category> }` · **Errors:** `400` name 2–100 chars, `409` `"Category name already exists"`.

### 8.5 PATCH `/api/categories/:id`

**Request body** (any subset): `name`, `customFields` (full array replace), `status` (`ACTIVE`|`INACTIVE`), `parentId` (nullable, not itself), `icon`.

**Response `200`:** `{ "category": <Category> }` · **Errors:** `400`, `404`, `409` duplicate name.

### 8.6 DELETE `/api/categories/:id`

**Response `200`:** `"Category deleted"` · **Errors:** `404`.

### 8.7 POST `/api/categories/:id/custom-fields`

**Request body:**

```json
{
  "label": "Warranty Period",
  "key": "warrantyPeriod",
  "type": "date",
  "required": false,
  "options": ["A", "B"]
}
```

| Field      | Type     | Rules                                                    |
|------------|----------|----------------------------------------------------------|
| `label`    | string   | Required                                                 |
| `key`      | string   | Optional — auto-camelCased from `label` if omitted       |
| `type`     | string   | `text` \| `number` \| `date` \| `select` (default `text`)|
| `required` | boolean  | Default `false`                                          |
| `options`  | string[] | Only used when `type` is `select`                        |

**Response `201`:** `{ "field": { "id": "uuid", "label": "…", "key": "…", "type": "…", "required": false } }`

### 8.8 DELETE `/api/categories/:id/custom-fields/:fieldId`

**Response `200`:** `"Custom field removed"` · **Errors:** `404` category / field not found.

---

## 9. Locations API

Base: `/api/locations` — auth required. **Reads: any user. Writes: ADMIN / ASSET_MANAGER.**

Locations form a three-level cascade: **building → floor → room**. Deleting a building cascades to its floors and rooms; deleting a floor cascades to its rooms. Assets referencing a deleted room keep their free-text `location` label but their `roomId` becomes `null` (FK `SET NULL`).

| # | Method | Endpoint                                  | Role         | Description                     |
|---|--------|-------------------------------------------|--------------|---------------------------------|
| 1 | GET    | `/`                                       | Any          | Full nested cascade             |
| 2 | POST   | `/`                                       | ADMIN, AM    | Add a building                  |
| 3 | PATCH  | `/:id`                                    | ADMIN, AM    | Rename building / city          |
| 4 | DELETE | `/:id`                                    | ADMIN, AM    | Delete building (cascades)      |
| 5 | POST   | `/:id/floors`                             | ADMIN, AM    | Add a floor                     |
| 6 | PATCH  | `/:id/floors/:floorId`                    | ADMIN, AM    | Rename a floor                  |
| 7 | DELETE | `/:id/floors/:floorId`                    | ADMIN, AM    | Delete floor (cascades)         |
| 8 | POST   | `/:id/floors/:floorId/rooms`              | ADMIN, AM    | Add a room                      |
| 9 | PATCH  | `/:id/floors/:floorId/rooms/:roomId`      | ADMIN, AM    | Rename a room                   |
| 10| DELETE | `/:id/floors/:floorId/rooms/:roomId`      | ADMIN, AM    | Delete room (assets' `roomId` → null) |

### 9.1 GET `/api/locations`

Returns the full **building → floor → room** cascade.

**Response `200`:**

```json
{
  "success": true,
  "message": "Locations fetched",
  "data": {
    "locations": [
      {
        "id": "uuid",
        "building": "HQ Tower",
        "city": "Ahmedabad",
        "floors": [
          {
            "id": "uuid",
            "name": "2nd Floor",
            "rooms": [ { "id": "uuid", "name": "204" } ]
          }
        ]
      }
    ]
  }
}
```

### 9.2 POST `/api/locations`

**Request body:**

```json
{ "building": "Skyline Hub", "city": "Pune" }
```

| Field      | Type   | Rules                          |
|------------|--------|--------------------------------|
| `building` | string | Required, 2–100 characters     |
| `city`     | string | Optional                       |

**Response `201`:**

```json
{
  "success": true,
  "message": "Building added",
  "data": { "location": { "id": "uuid", "building": "Skyline Hub", "city": "Pune", "floors": [] } }
}
```

### 9.3 PATCH `/api/locations/:id`

**Request body** (any subset): `{ "building": "Skyline Hub West", "city": "Pune" }`

**Response `200`:** `{ "location": { "id", "building", "city" } }` · **Errors:** `400` `"Nothing to update"`, `404`.

### 9.4 DELETE `/api/locations/:id`

**Response `200`:** `"Location deleted"` — floors and rooms are deleted with it. · **Errors:** `404`.

### 9.5 POST `/api/locations/:id/floors`

**Request body:** `{ "name": "Floor 3" }` (required, max 100 chars)

**Response `201`:**

```json
{
  "success": true,
  "message": "Floor added",
  "data": { "floor": { "id": "uuid", "name": "Floor 3", "locationId": "uuid", "rooms": [] } }
}
```

**Errors:** `400` missing name, `404` location not found.

### 9.6 PATCH `/api/locations/:id/floors/:floorId`

**Request body:** `{ "name": "3rd Floor" }`

**Response `200`:** `{ "floor": { "id", "name" } }` · **Errors:** `400`, `404` (floor must belong to the building).

### 9.7 DELETE `/api/locations/:id/floors/:floorId`

**Response `200`:** `"Floor deleted"` — its rooms are deleted with it. · **Errors:** `404`.

### 9.8 POST `/api/locations/:id/floors/:floorId/rooms`

**Request body:** `{ "name": "Room 301" }` (required, max 100 chars)

**Response `201`:**

```json
{
  "success": true,
  "message": "Room added",
  "data": { "room": { "id": "uuid", "name": "Room 301", "floorId": "uuid" } }
}
```

**Errors:** `400` missing name, `404` floor not found (must belong to the building).

### 9.9 PATCH `/api/locations/:id/floors/:floorId/rooms/:roomId`

**Request body:** `{ "name": "Room 301-A" }`

**Response `200`:** `{ "room": { "id", "name" } }` · **Errors:** `400`, `404` (full chain building → floor → room is validated).

### 9.10 DELETE `/api/locations/:id/floors/:floorId/rooms/:roomId`

**Response `200`:** `"Room deleted"` — assets pointing at it keep their text `location` but `roomId` becomes `null`. · **Errors:** `404`.

---

## 10. Assets API

Base: `/api/assets` — auth required. List/detail reads are **scoped by role** (see §3).

Asset lifecycle: `AVAILABLE → ALLOCATED → AVAILABLE`, `AVAILABLE → RETIRED → DISPOSED`, any → `LOST`, plus `UNDER_MAINTENANCE` while maintenance is approved.

| #  | Method | Endpoint            | Role                  | Description                                  |
|----|--------|---------------------|-----------------------|----------------------------------------------|
| 1  | GET    | `/`                 | Any (scoped)          | Paginated list with filters                  |
| 2  | GET    | `/search`           | Any (scoped)          | Quick lookup by tag / serial / name          |
| 3  | POST   | `/`                 | ADMIN, ASSET_MANAGER  | Register an asset (tag auto-generates)       |
| 4  | GET    | `/:id`              | Any (scoped)          | Full detail incl. documents                  |
| 5  | PATCH  | `/:id`              | ADMIN, ASSET_MANAGER  | Partial update                               |
| 6  | GET    | `/:id/history`      | Any                   | Allocation + maintenance timeline            |
| 7  | POST   | `/:id/documents`    | ADMIN, ASSET_MANAGER  | Upload document (multipart → Cloudinary)     |
| 8  | GET    | `/:id/qr`           | Any                   | QR code (PNG data URL) for the asset tag     |
| 9  | POST   | `/:id/retire`       | ADMIN, ASSET_MANAGER  | AVAILABLE → RETIRED                          |
| 10 | POST   | `/:id/dispose`      | ADMIN, ASSET_MANAGER  | RETIRED → DISPOSED                           |
| 11 | POST   | `/:id/mark-lost`    | ADMIN, ASSET_MANAGER  | any → LOST (idempotent)                      |
| 12 | POST   | `/bulk-delete`      | ADMIN                 | Delete many assets at once                   |

### Asset object

```json
{
  "id": "uuid",
  "tag": "AF-0001",
  "name": "MacBook Pro 14",
  "serialNo": "C02XL0GYJGH5",
  "category": { "id": "uuid", "name": "Laptops" },
  "department": { "id": "uuid", "name": "Engineering" },
  "status": "AVAILABLE",
  "condition": "GOOD",
  "location": "HQ / 2F / 204",
  "roomId": "uuid",
  "isBookable": false,
  "purchaseDate": "2025-01-15",
  "purchaseCost": 189999,
  "customValues": { "warrantyPeriod": "2027-01-15" },
  "retirement": null,
  "disposal": null,
  "currentHolder": { "id": "uuid", "name": "Jane Doe" },
  "createdAt": "2026-07-01T10:00:00.000Z"
}
```

`status` ∈ `AVAILABLE | ALLOCATED | UNDER_MAINTENANCE | RETIRED | DISPOSED | LOST`.

### 10.1 GET `/api/assets`

**Query parameters:**

| Param          | Type   | Description                                  |
|----------------|--------|----------------------------------------------|
| `page`         | number | Default `1`                                  |
| `limit`        | number | Default `20`, max `100`                      |
| `q`            | string | Search name / tag / serial                   |
| `categoryId`   | uuid   | Filter by category                           |
| `departmentId` | uuid   | Filter by department                         |
| `status`       | string | One of the six statuses                      |

**Response `200`:** `{ "assets": [ <Asset>, ... ], "total": 120, "page": 1, "limit": 20 }`

### 10.2 GET `/api/assets/search?q=`

`q` required. Returns up to **20** matches (tag / serial / name, case-insensitive), scoped by role.

**Response `200`:** `{ "assets": [ <Asset>, ... ] }` · **Errors:** `400` `"q is required"`.

### 10.3 POST `/api/assets`

**Request body:**

```json
{
  "tag": "AF-0042",
  "name": "MacBook Pro 14",
  "serialNo": "C02XL0GYJGH5",
  "categoryId": "uuid",
  "departmentId": "uuid",
  "condition": "GOOD",
  "location": "HQ / 2F / 204",
  "roomId": "uuid",
  "isBookable": false,
  "purchaseDate": "2025-01-15",
  "purchaseCost": 189999,
  "customValues": { "warrantyPeriod": "2027-01-15" }
}
```

Only `name` (min 2 chars) is required. If `tag` is omitted it auto-generates as `AF-0001`, `AF-0002`, …

**Response `201`:** `{ "asset": <Asset> }` · **Errors:** `400` `"Asset name is required"`, `409` `"Asset tag already exists"`.

### 10.4 GET `/api/assets/:id`

**Response `200`:** `{ "asset": <Asset & { documents: [...] }> }` where each document is:

```json
{ "id": "uuid", "url": "https://res.cloudinary.com/…", "filename": "invoice.pdf", "mime": "application/pdf", "bytes": 82344, "created_at": "…" }
```

**Errors:** `404` `"Asset not found"`, `403` `"This record is outside your department"` (exists but out of scope).

### 10.5 PATCH `/api/assets/:id`

**Request body** (any subset): `name`, `serialNo`, `categoryId`, `departmentId`, `condition`, `location`, `roomId`, `isBookable`, `purchaseDate`, `purchaseCost`, `customValues`, `status`.

**Response `200`:** `{ "asset": <Asset> }` · **Errors:** `400` `"Invalid status"` / `"Nothing to update"`, `404`.

### 10.6 GET `/api/assets/:id/history`

**Response `200`:**

```json
{
  "success": true,
  "message": "Asset history fetched",
  "data": {
    "allocationHistory": [
      {
        "id": "uuid",
        "date": "2026-07-01T10:00:00.000Z",
        "event": "Allocated to Jane Doe",
        "status": "RETURNED",
        "expectedReturnDate": "2026-08-01",
        "returnedAt": "2026-07-20T09:00:00.000Z",
        "conditionOnReturn": "GOOD"
      }
    ],
    "maintenanceHistory": [
      {
        "id": "uuid",
        "date": "2026-06-10T08:00:00.000Z",
        "event": "Screen flickering",
        "status": "RESOLVED",
        "priority": "MEDIUM",
        "resolvedAt": "2026-06-12T15:00:00.000Z",
        "resolutionNotes": "Replaced display cable"
      }
    ]
  }
}
```

### 10.7 POST `/api/assets/:id/documents`

**Request:** `multipart/form-data` with a single **`file`** field.

| Constraint | Value                                        |
|------------|----------------------------------------------|
| Max size   | **10 MB**                                    |
| MIME types | `image/png`, `image/jpeg`, `application/pdf` |

**Response `201`:**

```json
{
  "success": true,
  "message": "Document uploaded",
  "data": {
    "document": { "id": "uuid", "url": "https://res.cloudinary.com/…", "filename": "invoice.pdf", "mime": "application/pdf", "bytes": 82344, "created_at": "…" }
  }
}
```

**Errors:** `400` missing file / disallowed type (`"Only PNG, JPEG or PDF files are allowed"`), `413` file too large, `404` asset not found, `503` `"Cloudinary is not configured on the server"`.

### 10.8 GET `/api/assets/:id/qr`

**Response `200`:**

```json
{
  "success": true,
  "message": "QR generated",
  "data": { "tag": "AF-0001", "qrUrl": "data:image/png;base64,…" }
}
```

The QR encodes `{"app":"assetflow","assetId":"<uuid>","tag":"AF-0001"}`.

### 10.9 POST `/api/assets/:id/retire`

Asset must currently be `AVAILABLE`.

**Request body (optional):** `{ "reason": "End of life", "retirementDate": "2026-07-12" }`

**Response `200`:** `{ "asset": { "id": "uuid", "tag": "AF-0001", "status": "RETIRED" } }`

**Errors:** `400` `"Asset must be Available to retire"`, `404`.

### 10.10 POST `/api/assets/:id/dispose`

Asset must currently be `RETIRED`.

**Request body (optional):** `{ "method": "E-waste recycler", "notes": "…", "disposalDate": "2026-07-12" }`

**Response `200`:** `{ "asset": { "id": "uuid", "tag": "AF-0001", "status": "DISPOSED" } }`

**Errors:** `400` `"Asset must be Retired before disposal"`, `404`.

### 10.11 POST `/api/assets/:id/mark-lost`

No body. Idempotent — if already `LOST`, returns `200` with `"Asset is already marked as lost"`.

**Response `200`:** `{ "asset": { "id": "uuid", "tag": "AF-0001", "status": "LOST" } }`

### 10.12 POST `/api/assets/bulk-delete`

**Request body:** `{ "ids": ["uuid", "uuid"] }`

**Response `200`:** `{ "deletedCount": 2 }` with message `"2 asset(s) deleted"`.

**Errors:** `400` `"ids must be a non-empty array of asset ids"`.

---

## 11. Allocations API

Base: `/api/allocations` — auth required, list reads scoped by role.

Allocation status: `PENDING → ACTIVE → RETURN_REQUESTED → RETURNED` (or `REJECTED`).

| # | Method | Endpoint               | Role                             | Description                                |
|---|--------|------------------------|----------------------------------|--------------------------------------------|
| 1 | GET    | `/`                    | Any (scoped)                     | List (filters below), max 200 rows         |
| 2 | GET    | `/kanban`              | Any (scoped)                     | Board grouped by status column             |
| 3 | GET    | `/overdue`             | Any (scoped)                     | Overdue allocations with `daysOverdue`     |
| 4 | GET    | `/:id`                 | Any (scoped)                     | Single allocation                          |
| 5 | POST   | `/`                    | ADMIN, ASSET_MANAGER             | Allocate an available asset                |
| 6 | POST   | `/:id/approve`         | ADMIN, ASSET_MANAGER, DEPT_HEAD* | Approve a PENDING allocation               |
| 7 | POST   | `/:id/return`          | Current holder                   | Initiate return with condition check-in    |
| 8 | POST   | `/:id/return/approve`  | ADMIN, ASSET_MANAGER             | Confirm check-in → asset AVAILABLE again   |

\* Dept Head only when the holder is in their department.

### Allocation object

```json
{
  "id": "uuid",
  "status": "ACTIVE",
  "purpose": "Project work",
  "asset": { "id": "uuid", "tag": "AF-0001", "name": "MacBook Pro 14" },
  "holder": { "id": "uuid", "name": "Jane Doe" },
  "allocatedBy": "Asset Manager",
  "allocatedAt": "2026-07-01T10:00:00.000Z",
  "expectedReturnDate": "2026-08-01",
  "returnRequestedAt": null,
  "conditionOnReturn": null,
  "returnNotes": null,
  "returnedAt": null,
  "isOverdue": false
}
```

### 11.1 GET `/api/allocations`

**Query filters:** `assetId` (uuid), `employeeId` (uuid), `departmentId` (uuid), `status` (`PENDING`|`ACTIVE`|`RETURN_REQUESTED`|`RETURNED`|`REJECTED`).

**Response `200`:** `{ "allocations": [ <Allocation>, ... ] }`

### 11.2 GET `/api/allocations/kanban`

**Response `200`:**

```json
{
  "success": true,
  "message": "Kanban data fetched",
  "data": {
    "columns": {
      "PENDING":          { "count": 2,  "items": [ <Allocation> ] },
      "ACTIVE":           { "count": 14, "items": [ <Allocation> ] },
      "RETURN_REQUESTED": { "count": 1,  "items": [ <Allocation> ] },
      "OVERDUE":          { "count": 3,  "items": [ <Allocation> ] }
    }
  }
}
```

Overdue rows land in `OVERDUE` regardless of underlying status; each column carries at most 50 items.

### 11.3 GET `/api/allocations/overdue`

**Response `200`:** `{ "overdue": [ <Allocation & { daysOverdue: 5 }>, ... ] }`

### 11.4 GET `/api/allocations/:id`

**Response `200`:** `{ "allocation": <Allocation> }` · **Errors:** `404`.

### 11.5 POST `/api/allocations`

**Request body:**

```json
{
  "assetId": "uuid",
  "employeeId": "uuid",
  "purpose": "Project work",
  "expectedReturnDate": "2026-08-01"
}
```

(`holderId` is accepted as an alias for `employeeId`.) The asset must be `AVAILABLE` and the user `ACTIVE`. On success the asset becomes `ALLOCATED` and the holder is notified.

**Response `201`:** `{ "allocation": <Allocation> }` (status `ACTIVE`)

**Errors:** `400` `"Asset is <STATUS> — only Available assets can be allocated"` / `"User is inactive"`, `404` asset / user not found.

### 11.6 POST `/api/allocations/:id/approve`

No body. Allocation must be `PENDING`. Sets it `ACTIVE`, marks the asset `ALLOCATED`, notifies the holder.

**Response `200`:** `{ "allocation": { "id": "uuid", "status": "ACTIVE" } }`

**Errors:** `400` `"Only pending allocations can be approved"`, `403` out-of-department (Dept Head), `404`.

### 11.7 POST `/api/allocations/:id/return`

Only the **current holder** may call this; allocation must be `ACTIVE`.

**Request body (optional):** `{ "condition": "GOOD", "notes": "Minor scratch on lid" }` (condition defaults to `GOOD`).

**Response `200`:** `{ "allocation": { "id": "uuid", "status": "RETURN_REQUESTED" } }` with message `"Return requested — awaiting Asset Manager approval"`.

**Errors:** `403` `"Only the current holder can initiate a return"`, `400` `"Only active allocations can be returned"`, `404`.

### 11.8 POST `/api/allocations/:id/return/approve`

No body. Allocation must be `RETURN_REQUESTED`. Sets it `RETURNED`, the asset becomes `AVAILABLE`, holder is notified.

**Response `200`:** `{ "allocation": { "id": "uuid", "status": "RETURNED" } }`

**Errors:** `400` `"No pending return on this allocation"`, `404`.

---

## 12. Transfers API

Base: `/api/transfers` — auth required.

Transfer status: `REQUESTED → APPROVED | REJECTED`.

| # | Method | Endpoint         | Role                             | Description                                  |
|---|--------|------------------|----------------------------------|----------------------------------------------|
| 1 | GET    | `/`              | Any (scoped)                     | List — Employee sees own (either side), Dept Head their dept, Admin/AM all |
| 2 | GET    | `/:id`           | Any (participants / managers)    | Single transfer                              |
| 3 | POST   | `/`              | Any                              | Request transfer of an allocated asset       |
| 4 | POST   | `/:id/approve`   | ADMIN, ASSET_MANAGER, DEPT_HEAD* | Approve — reassigns the allocation           |
| 5 | POST   | `/:id/reject`    | ADMIN, ASSET_MANAGER, DEPT_HEAD* | Reject with reason                           |

\* Dept Head only when the **target user** is in their department.

### Transfer object

```json
{
  "id": "uuid",
  "status": "REQUESTED",
  "reason": "Moving to new project team",
  "decisionReason": null,
  "asset": { "id": "uuid", "tag": "AF-0001", "name": "MacBook Pro 14" },
  "from": { "id": "uuid", "name": "Jane Doe" },
  "to": { "id": "uuid", "name": "Arjun Nair" },
  "decidedBy": null,
  "createdAt": "2026-07-10T10:00:00.000Z",
  "decidedAt": null
}
```

### 12.1 GET `/api/transfers`

**Query filter:** `status` (`REQUESTED`|`APPROVED`|`REJECTED`). Max 200 rows.

**Response `200`:** `{ "transfers": [ <Transfer>, ... ] }`

### 12.2 GET `/api/transfers/:id`

**Response `200`:** `{ "transfer": <Transfer> }` · **Errors:** `403` (employee who is not a participant), `404`.

### 12.3 POST `/api/transfers`

**Request body:**

```json
{ "assetId": "uuid", "toUserId": "uuid", "reason": "Moving to new project team" }
```

(`to` is accepted as an alias for `toUserId`.) The asset must be `ALLOCATED`; `from` is derived from the current active allocation.

**Response `201`:** `{ "transfer": <Transfer> }`

**Errors:** `400` `"Cannot transfer an asset to yourself"` / `"Only allocated assets can be transferred"` / `"Target user is inactive"`, `404` asset / target user, `409` `"A transfer request for this asset is already pending"`.

### 12.4 POST `/api/transfers/:id/approve`

No body. Closes the old holder's allocation (`RETURNED`), opens a new `ACTIVE` allocation for the target, keeps the asset `ALLOCATED`, and notifies both parties.

**Response `200`:** `{ "transfer": { "id": "uuid", "status": "APPROVED" } }`

**Errors:** `400` `"Transfer request is already decided"`, `403` out-of-department, `404`.

### 12.5 POST `/api/transfers/:id/reject`

**Request body (optional):** `{ "reason": "Asset needed by current team" }`

**Response `200`:** `{ "transfer": { "id": "uuid", "status": "REJECTED" } }`

---

## 13. Resources & Bookings API

Bases: `/api/resources` and `/api/bookings` — auth required. A **resource** is any asset with `isBookable: true`.

Booking status is **derived from time**: `UPCOMING` (before start) → `ONGOING` → `COMPLETED`, or `CANCELLED`.

| #  | Method | Endpoint                          | Role                              | Description                          |
|----|--------|-----------------------------------|-----------------------------------|--------------------------------------|
| 1  | GET    | `/api/resources`                  | Any                               | Bookable assets                      |
| 2  | GET    | `/api/resources/:id/calendar`     | Any                               | Confirmed bookings in a window       |
| 3  | GET    | `/api/resources/:id/availability` | Any                               | Hour-grid free slots for a day       |
| 4  | GET    | `/api/bookings`                   | Any (scoped)                      | List with filters                    |
| 5  | GET    | `/api/bookings/my`                | Any                               | Current user's bookings              |
| 6  | POST   | `/api/bookings/check-availability`| Any                               | Overlap check + alternatives         |
| 7  | POST   | `/api/bookings`                   | Any                               | Create (conflict-checked)            |
| 8  | POST   | `/api/bookings/recurring`         | Any                               | Daily/weekly series                  |
| 9  | GET    | `/api/bookings/:id`               | Owner / Dept Head* / Admin / AM   | Single booking                       |
| 10 | POST   | `/api/bookings/:id/cancel`        | Owner / Dept Head* / Admin / AM   | Cancel                               |
| 11 | POST   | `/api/bookings/:id/reschedule`    | Owner / Dept Head* / Admin / AM   | Move to a new (conflict-checked) slot|

\* Dept Head of the booker's department.

### Booking object

```json
{
  "id": "uuid",
  "resource": { "id": "uuid", "tag": "AF-0100", "name": "Conference Room A" },
  "bookedBy": { "id": "uuid", "name": "Jane Doe" },
  "start": "2026-07-14T09:30:00.000Z",
  "end": "2026-07-14T10:30:00.000Z",
  "purpose": "Sprint planning",
  "attendees": ["jane@gmail.com"],
  "seriesId": null,
  "status": "UPCOMING",
  "createdAt": "2026-07-12T08:00:00.000Z"
}
```

### Time-range input (used by create / check / reschedule)

Either of the following forms is accepted:

```json
{ "start": "2026-07-14T09:30:00Z", "end": "2026-07-14T10:30:00Z" }
```

```json
{ "date": "2026-07-14", "startTime": "09:30", "endTime": "10:30" }
```

`end` must be after `start`, otherwise `400` `"Provide start/end (ISO) or date + startTime + endTime"`.

### 13.1 GET `/api/resources`

Bookable assets not in `RETIRED`/`DISPOSED`/`LOST`.

**Response `200`:** `{ "resources": [ { "id", "tag", "name", "location", "status" } ] }`

### 13.2 GET `/api/resources/:id/calendar?from=&to=`

`from`/`to` optional ISO dates (defaults: now → +7 days).

**Response `200`:** `{ "bookings": [ <Booking>, ... ] }`

### 13.3 GET `/api/resources/:id/availability?date=YYYY-MM-DD`

`date` required. Returns a 09:00–18:00 hour grid.

**Response `200`:**

```json
{
  "success": true,
  "message": "Availability fetched",
  "data": {
    "date": "2026-07-14",
    "slots": [
      { "start": "09:00", "end": "10:00", "available": true },
      { "start": "10:00", "end": "11:00", "available": false }
    ]
  }
}
```

### 13.4 GET `/api/bookings`

**Query filters:** `resourceId` (uuid), `date` (`YYYY-MM-DD`), `status` (`UPCOMING`|`ONGOING`|`COMPLETED`|`CANCELLED`). Max 200 rows.

**Response `200`:** `{ "bookings": [ <Booking>, ... ] }`

### 13.5 GET `/api/bookings/my`

**Response `200`:** `{ "bookings": [ <Booking>, ... ] }` (max 100).

### 13.6 POST `/api/bookings/check-availability`

**Request body:** `{ "resourceId": "uuid", ...timeRange }`

**Response `200` (free):** `{ "available": true }`

**Response `200` (busy):**

```json
{
  "success": true,
  "message": "Slot conflicts with existing booking",
  "data": {
    "available": false,
    "conflict": { "bookedBy": "Arjun Nair", "start": "…", "end": "…" },
    "alternatives": [ { "resourceId": "uuid", "resourceName": "Conference Room B" } ]
  }
}
```

### 13.7 POST `/api/bookings`

**Request body:**

```json
{
  "resourceId": "uuid",
  "date": "2026-07-14",
  "startTime": "09:30",
  "endTime": "10:30",
  "purpose": "Sprint planning",
  "attendees": ["jane@gmail.com"]
}
```

**Response `201`:** `{ "booking": <Booking> }`

**Errors:** `400` `"This asset is not bookable"` / invalid range, `404` resource, `409` `"Requested slot conflicts with an existing booking"`.

### 13.8 POST `/api/bookings/recurring`

**Request body:**

```json
{
  "resourceId": "uuid",
  "frequency": "WEEKLY",
  "startDate": "2026-07-14",
  "endDate": "2026-09-14",
  "startTime": "09:30",
  "endTime": "10:30",
  "purpose": "Weekly standup",
  "attendees": []
}
```

`frequency` ∈ `DAILY | WEEKLY` (default `WEEKLY`). Conflicting occurrences are skipped and reported; a safety cap of 60 occurrences applies.

**Response `201`:**

```json
{
  "success": true,
  "message": "Recurring booking created (9 slots)",
  "data": { "seriesId": "uuid", "bookingsCreated": 9, "conflicts": ["2026-08-04"] }
}
```

### 13.9 GET `/api/bookings/:id`

**Response `200`:** `{ "booking": <Booking> }` · **Errors:** `403`, `404`.

### 13.10 POST `/api/bookings/:id/cancel`

No body. **Response `200`:** `{ "booking": { "id": "uuid", "status": "CANCELLED" } }` · **Errors:** `400` `"Booking is already cancelled"`, `403`, `404`. The booker is notified if someone else cancels.

### 13.11 POST `/api/bookings/:id/reschedule`

**Request body:** a time range (see above). Re-runs the overlap check excluding this booking.

**Response `200`:** `{ "booking": { "id": "uuid", "start": "…", "end": "…", "status": "UPCOMING" } }` · **Errors:** `400` cancelled / invalid range, `409` conflict, `403`, `404`.

---

## 14. Maintenance API

Base: `/api/maintenance` — auth required.

Status flow: `PENDING → APPROVED → TECHNICIAN_ASSIGNED → IN_PROGRESS → RESOLVED`, with `REJECTED` (from PENDING) and `ESCALATED` (from any open state) as branches. Approval puts the asset `UNDER_MAINTENANCE`; resolving returns it to `AVAILABLE` (or `ALLOCATED` if it still has an active allocation).

| #  | Method | Endpoint           | Role                          | Description                                 |
|----|--------|--------------------|-------------------------------|---------------------------------------------|
| 1  | GET    | `/`                | Any (scoped¹)                 | List with filters, max 200                  |
| 2  | GET    | `/:id`             | Any                           | Detail incl. `commentCount`                 |
| 3  | POST   | `/`                | Any                           | Raise a request                             |
| 4  | POST   | `/:id/approve`     | ADMIN, ASSET_MANAGER          | PENDING → APPROVED (asset UNDER_MAINTENANCE)|
| 5  | POST   | `/:id/reject`      | ADMIN, ASSET_MANAGER          | PENDING → REJECTED with reason              |
| 6  | POST   | `/:id/assign`      | ADMIN, ASSET_MANAGER          | Assign technician (user id or free-text name)|
| 7  | POST   | `/:id/start`       | Assigned technician / AM / Admin | TECHNICIAN_ASSIGNED → IN_PROGRESS        |
| 8  | POST   | `/:id/resolve`     | Assigned technician / AM / Admin | → RESOLVED (asset back in service)       |
| 9  | POST   | `/:id/escalate`    | ADMIN, ASSET_MANAGER          | → ESCALATED, priority forced CRITICAL       |
| 10 | GET    | `/:id/comments`    | Any                           | Comment thread                              |
| 11 | POST   | `/:id/comments`    | Any                           | Add a comment                               |

¹ Employees see requests they raised **or** where they are the assigned technician.

### Maintenance request object

```json
{
  "id": "uuid",
  "issue": "Screen flickering",
  "issueType": "HARDWARE",
  "priority": "MEDIUM",
  "status": "PENDING",
  "asset": { "id": "uuid", "tag": "AF-0001", "name": "MacBook Pro 14" },
  "raisedBy": { "id": "uuid", "name": "Jane Doe" },
  "technician": null,
  "startedAt": null,
  "resolvedAt": null,
  "resolutionNotes": null,
  "cost": null,
  "rejectedReason": null,
  "escalated": null,
  "createdAt": "2026-07-10T10:00:00.000Z"
}
```

`priority` ∈ `LOW | MEDIUM | HIGH | CRITICAL`.

### 14.1 GET `/api/maintenance`

**Query filters:** `assetId` (uuid), `status` (any status above), `priority`.

**Response `200`:** `{ "requests": [ <MaintenanceRequest>, ... ] }`

### 14.2 GET `/api/maintenance/:id`

**Response `200`:** `{ "request": <MaintenanceRequest & { commentCount: 3 }> }` · **Errors:** `404`.

### 14.3 POST `/api/maintenance`

**Request body:**

```json
{
  "assetId": "uuid",
  "issue": "Screen flickering",
  "issueType": "HARDWARE",
  "priority": "HIGH"
}
```

`issue` required (min 3 chars); `priority` defaults to `MEDIUM`.

**Response `201`:** `{ "request": <MaintenanceRequest> }` · **Errors:** `400`, `404` asset.

### 14.4 POST `/api/maintenance/:id/approve`

No body. **Response `200`:** `{ "request": { "id": "uuid", "status": "APPROVED" } }` — asset goes `UNDER_MAINTENANCE`, requester is notified. **Errors:** `400` `"Request must be PENDING to approve"`, `404`.

### 14.5 POST `/api/maintenance/:id/reject`

**Request body (optional):** `{ "reason": "Not reproducible" }`

**Response `200`:** `{ "request": { "id": "uuid", "status": "REJECTED" } }` · **Errors:** `400` not PENDING, `404`.

### 14.6 POST `/api/maintenance/:id/assign`

**Request body:** either an internal user or an external name:

```json
{ "technicianId": "uuid" }
```
```json
{ "technicianName": "External AC Services" }
```

Request must be `APPROVED` (re-assign is allowed from `TECHNICIAN_ASSIGNED`).

**Response `200`:**

```json
{
  "success": true,
  "message": "Technician assigned",
  "data": { "request": { "id": "uuid", "status": "TECHNICIAN_ASSIGNED", "technician": { "id": "uuid", "name": "Rohan Verma" } } }
}
```

**Errors:** `400` `"Request must be APPROVED before assigning a technician"` / `"technicianId or technicianName is required"`, `404` request / technician user.

### 14.7 POST `/api/maintenance/:id/start`

No body. Only the assigned technician (or Admin/AM). **Response `200`:** `{ "request": { "id": "uuid", "status": "IN_PROGRESS" } }` · **Errors:** `400` `"Request must be in ASSIGNED status"`, `403` `"Only the assigned technician can start work"`.

### 14.8 POST `/api/maintenance/:id/resolve`

**Request body (optional):** `{ "notes": "Replaced display cable", "cost": 1500 }`

Allowed from `IN_PROGRESS`, `TECHNICIAN_ASSIGNED`, or `ESCALATED`. The asset returns to `AVAILABLE` (or `ALLOCATED` if it still has an active holder); the requester is notified.

**Response `200`:** `{ "request": { "id": "uuid", "status": "RESOLVED" } }` · **Errors:** `400` `"Request is not in progress"`, `403`.

### 14.9 POST `/api/maintenance/:id/escalate`

**Request body (optional):** `{ "reason": "Vendor SLA breach", "escalateTo": "ADMIN" }`

**Response `200`:** `{ "request": { "id": "uuid", "status": "ESCALATED", "priority": "CRITICAL" } }` · **Errors:** `400` `"Cannot escalate a closed request"`.

### 14.10 GET `/api/maintenance/:id/comments`

**Response `200`:**

```json
{
  "success": true,
  "message": "Comments fetched",
  "data": {
    "comments": [
      {
        "id": "uuid",
        "author": { "id": "uuid", "name": "Rohan Verma", "role": "ASSET_MANAGER" },
        "text": "Parts ordered, ETA Friday.",
        "createdAt": "2026-07-11T09:00:00.000Z"
      }
    ]
  }
}
```

### 14.11 POST `/api/maintenance/:id/comments`

**Request body:** `{ "text": "Parts ordered, ETA Friday." }` (required)

**Response `201`:** `{ "comment": { "id": "uuid", "text": "…", "createdAt": "…" } }`

---

## 15. Audit Cycles API

Base: `/api/audit-cycles` — auth required.

Cycle status: `ACTIVE | CLOSED`. Item verification: `PENDING | VERIFIED | DISCREPANCY | MISSING`. Items may only be marked by an **Admin** or an **assigned auditor**.

| #  | Method | Endpoint                       | Role                    | Description                                  |
|----|--------|--------------------------------|-------------------------|----------------------------------------------|
| 1  | GET    | `/`                            | Any (DH scoped¹)        | List cycles with stats                       |
| 2  | POST   | `/`                            | ADMIN                   | Create cycle; checklist snapshot from assets |
| 3  | GET    | `/:id`                         | Any                     | Detail + auditors + departments              |
| 4  | POST   | `/:id/auditors`                | ADMIN                   | Assign auditors                              |
| 5  | GET    | `/:id/items`                   | Any                     | Checklist (filters: `status`, `q`)           |
| 6  | PATCH  | `/:id/items/bulk-update`       | Admin / assigned auditor| Mark many items at once                      |
| 7  | PATCH  | `/:id/items/:itemId`           | Admin / assigned auditor| Mark a single item                           |
| 8  | GET    | `/:id/progress`                | Any                     | Totals + per-auditor breakdown               |
| 9  | GET    | `/:id/discrepancy-report`      | Any                     | Flagged (DISCREPANCY / MISSING) items        |
| 10 | GET    | `/:id/summary`                 | Any                     | Historical summary                           |
| 11 | POST   | `/:id/close`                   | ADMIN                   | Lock cycle; MISSING items mark assets LOST   |

¹ Dept Heads see org-wide (`ALL`) cycles plus cycles covering their department.

### Cycle object

```json
{
  "id": "uuid",
  "name": "Q3 2026 Audit",
  "scopeType": "DEPARTMENT",
  "startDate": "2026-07-01",
  "endDate": "2026-07-31",
  "status": "ACTIVE",
  "createdAt": "2026-07-01T10:00:00.000Z",
  "closedAt": null,
  "stats": {
    "total": 120,
    "verified": 80,
    "discrepancy": 3,
    "missing": 2,
    "pending": 35,
    "completionPercent": 71
  }
}
```

### 15.1 GET `/api/audit-cycles`

**Query filter:** `status` (`ACTIVE`|`CLOSED`).

**Response `200`:** `{ "cycles": [ <Cycle>, ... ] }`

### 15.2 POST `/api/audit-cycles`

**Request body:**

```json
{
  "name": "Q3 2026 Audit",
  "departmentIds": ["uuid"],
  "startDate": "2026-07-01",
  "endDate": "2026-07-31"
}
```

`name` required (min 3 chars). If `departmentIds` is empty/omitted, scope is `ALL`. Checklist items are snapshotted from all non-`DISPOSED` assets in scope.

**Response `201`:** `{ "cycle": <Cycle> }`

### 15.3 GET `/api/audit-cycles/:id`

**Response `200`:** `{ "cycle": <Cycle & { auditors: [{id,name,email}], departments: [{id,name}] }> }` · **Errors:** `404`.

### 15.4 POST `/api/audit-cycles/:id/auditors`

**Request body:** `{ "userIds": ["uuid", "uuid"] }` (required, non-empty). Duplicate assignments are ignored; new auditors are notified.

**Response `200`:** `{ "addedCount": 2 }` with message `"2 auditor(s) assigned"`.

### 15.5 GET `/api/audit-cycles/:id/items`

**Query filters:** `status` (verification value), `q` (search tag / name / serial).

**Response `200`:**

```json
{
  "success": true,
  "message": "Audit items fetched",
  "data": {
    "items": [
      {
        "id": "uuid",
        "asset": { "id": "uuid", "tag": "AF-0001", "name": "MacBook Pro 14", "serial": "C02…", "status": "ALLOCATED" },
        "expectedLocation": "HQ / 2F / 204",
        "verification": "PENDING",
        "notes": null,
        "photo": null,
        "verifiedBy": null,
        "verifiedAt": null
      }
    ],
    "total": 120,
    "verified": 80,
    "discrepancy": 3,
    "missing": 2,
    "pending": 35
  }
}
```

### 15.6 PATCH `/api/audit-cycles/:id/items/bulk-update`

**Request body:**

```json
{
  "itemIds": ["uuid", "uuid"],
  "verification": "VERIFIED",
  "notes": "Physically verified on floor walk"
}
```

`verification` must be `VERIFIED`, `DISCREPANCY` or `MISSING` (not `PENDING`).

**Response `200`:** `{ "updatedCount": 2 }` · **Errors:** `400`, `403` `"Only an assigned auditor can mark items"`.

### 15.7 PATCH `/api/audit-cycles/:id/items/:itemId`

**Request body:**

```json
{ "verification": "DISCREPANCY", "notes": "Found in room 305 instead", "photoUrl": "https://…" }
```

**Response `200`:** `{ "item": { "id": "uuid", "verification": "DISCREPANCY" } }` · **Errors:** `400` invalid value, `403`, `404`.

### 15.8 GET `/api/audit-cycles/:id/progress`

**Response `200`:**

```json
{
  "success": true,
  "message": "Progress fetched",
  "data": {
    "total": 120, "verified": 80, "discrepancy": 3, "missing": 2, "pending": 35, "completionPercent": 71,
    "byAuditor": [ { "auditor": { "id": "uuid", "name": "Priya Shah" }, "completed": 45 } ]
  }
}
```

### 15.9 GET `/api/audit-cycles/:id/discrepancy-report`

**Response `200`:**

```json
{
  "success": true,
  "message": "Discrepancy report fetched",
  "data": {
    "flaggedCount": 5,
    "items": [
      { "assetTag": "AF-0001", "assetName": "MacBook Pro 14", "verificationStatus": "MISSING", "notes": "…", "verifiedBy": "Priya Shah", "verifiedAt": "…" }
    ]
  }
}
```

### 15.10 GET `/api/audit-cycles/:id/summary`

**Response `200`:** `{ "summary": <Cycle> }`

### 15.11 POST `/api/audit-cycles/:id/close`

No body. Locks the cycle and marks every asset with a `MISSING` item as `LOST`.

**Response `200`:** `{ "cycle": { "id": "uuid", "status": "CLOSED", "assetsMarkedLost": 2 } }` · **Errors:** `400` `"Cycle is already closed"`, `404`.

---

## 16. Dashboard API

Base: `/api/dashboard` — auth required. All widgets are **scoped by role** (Employee → own, Dept Head → dept, Admin/AM → org).

| # | Method | Endpoint              | Description                                    |
|---|--------|-----------------------|------------------------------------------------|
| 1 | GET    | `/kpis`               | Headline counters                              |
| 2 | GET    | `/overdue`            | Overdue returns                                |
| 3 | GET    | `/activity-feed`      | Recent activity (`?limit=`, default 10, max 50)|
| 4 | GET    | `/utilization-chart`  | % assets allocated per day (`?days=`, 7–90)    |
| 5 | GET    | `/upcoming-returns`   | Next expected returns (`?limit=`, default 5)   |
| 6 | GET    | `/health-score`       | Fleet health score (org-wide)                  |

### 16.1 GET `/api/dashboard/kpis`

**Response `200`:**

```json
{
  "success": true,
  "message": "KPIs fetched",
  "data": {
    "assetsAvailable": 42,
    "assetsAllocated": 60,
    "underMaintenance": 4,
    "maintenanceOpen": 6,
    "activeBookings": 9,
    "pendingTransfers": 2,
    "upcomingReturns": 5
  }
}
```

### 16.2 GET `/api/dashboard/overdue`

**Response `200`:**

```json
{
  "success": true,
  "message": "Overdue items fetched",
  "data": {
    "overdueReturns": [
      { "assetTag": "AF-0001", "assetName": "MacBook Pro 14", "holder": "Jane Doe", "expectedReturnDate": "2026-07-01", "daysOverdue": 11 }
    ],
    "overdueBookings": []
  }
}
```

### 16.3 GET `/api/dashboard/activity-feed?limit=10`

**Response `200`:**

```json
{
  "success": true,
  "message": "Activity feed fetched",
  "data": {
    "activities": [
      {
        "id": "uuid",
        "type": "ALLOCATION",
        "description": "Allocated AF-0001 (MacBook Pro 14) to Jane Doe",
        "actor": { "id": "uuid", "name": "Asset Manager" },
        "entityType": "ALLOCATION",
        "entityId": "uuid",
        "createdAt": "2026-07-12T09:00:00.000Z"
      }
    ]
  }
}
```

### 16.4 GET `/api/dashboard/utilization-chart?days=30`

**Response `200`:** `{ "dataPoints": [ { "date": "2026-07-01", "utilization": 48 }, ... ] }` — one point per day, utilization is a percentage.

### 16.5 GET `/api/dashboard/upcoming-returns?limit=5`

**Response `200`:**

```json
{
  "success": true,
  "message": "Upcoming returns fetched",
  "data": {
    "returns": [
      {
        "allocationId": "uuid",
        "asset": { "tag": "AF-0001", "name": "MacBook Pro 14" },
        "holder": { "id": "uuid", "name": "Jane Doe" },
        "expectedReturnDate": "2026-07-15",
        "status": "ON_TIME"
      },
      {
        "allocationId": "uuid",
        "asset": { "tag": "AF-0002", "name": "Dell Monitor" },
        "holder": { "id": "uuid", "name": "Arjun Nair" },
        "expectedReturnDate": "2026-07-01",
        "status": "OVERDUE",
        "daysOverdue": 11
      }
    ]
  }
}
```

### 16.6 GET `/api/dashboard/health-score`

Weighted score: 40% availability ratio + 25% maintenance backlog + 20% audit compliance + 15% on-time returns.

**Response `200`:**

```json
{
  "success": true,
  "message": "Health score fetched",
  "data": {
    "score": 84,
    "label": "Good standing",
    "breakdown": {
      "availableRatio": 0.85,
      "maintenanceBacklog": 0.94,
      "auditCompliance": 0.71,
      "overdueRate": 0.03
    }
  }
}
```

`label`: `Good standing` (≥80), `Needs attention` (≥60), `At risk` (<60).

---

## 17. Reports API

Base: `/api/reports` — **ADMIN, ASSET_MANAGER, DEPT_HEAD** only (Dept Heads see their department's slice).

| # | Method | Endpoint                  | Description                                     |
|---|--------|---------------------------|-------------------------------------------------|
| 1 | GET    | `/utilization`            | Most-used + idle assets                         |
| 2 | GET    | `/maintenance-frequency`  | Maintenance request count per category          |
| 3 | GET    | `/due-for-maintenance`    | Assets with ≥2 repairs or older than 4 years    |
| 4 | GET    | `/allocation-summary`     | Active allocations per department               |
| 5 | GET    | `/booking-heatmap`        | Peak booking hours per resource                 |
| 6 | GET    | `/export`                 | Any of the above as a **CSV download**          |

### 17.1 GET `/api/reports/utilization`

```json
{
  "success": true,
  "message": "utilization report fetched",
  "data": {
    "mostUsed": [ { "asset": "AF-0001 — MacBook Pro 14", "count": 8 } ],
    "idle": [ { "asset": "AF-0031 — Projector", "idleDays": 92 } ]
  }
}
```

### 17.2 GET `/api/reports/maintenance-frequency`

```json
{ "data": { "byCategory": [ { "category": "Laptops", "count": 14 } ] } }
```

### 17.3 GET `/api/reports/due-for-maintenance`

```json
{ "data": { "dueOrNearingRetirement": [ { "asset": "AF-0007 — Printer", "note": "3 repairs on record" } ] } }
```

### 17.4 GET `/api/reports/allocation-summary`

```json
{ "data": { "byDepartment": [ { "department": "Engineering", "allocatedCount": 24 } ] } }
```

### 17.5 GET `/api/reports/booking-heatmap`

```json
{ "data": { "heatmap": [ { "resource": "Conference Room A", "peakHour": "10:00-11:00", "bookings": 15 } ] } }
```

### 17.6 GET `/api/reports/export?type=&format=csv`

| Param    | Rules                                                                                     |
|----------|-------------------------------------------------------------------------------------------|
| `type`   | Required: `utilization` \| `maintenance-frequency` \| `due-for-maintenance` \| `allocation-summary` \| `booking-heatmap` |
| `format` | Only `csv` is supported (default)                                                         |

**Response `200`:** raw CSV with `Content-Type: text/csv` and `Content-Disposition: attachment` — **not** the JSON envelope.

**Errors:** `400` unknown type / non-csv format.

---

## 18. Notifications API

Base: `/api/notifications` — auth required.

**Feed visibility (`GET /`) is role-scoped:**

| Role            | Sees                                                                        |
|-----------------|------------------------------------------------------------------------------|
| `ADMIN`         | **All** notifications (org-wide)                                             |
| `ASSET_MANAGER` | Asset-related notifications org-wide (`ALLOCATION`, `RETURN`, `TRANSFER`, `MAINTENANCE`) **plus** their own of any type |
| `DEPT_HEAD`     | Notifications of every user in **their department**                          |
| `EMPLOYEE`      | Only **their own**                                                           |

Write actions (`mark-read`, `mark-all-read`, `DELETE`) and preferences remain **owner-only** — they only ever affect the logged-in user's own notifications.

| # | Method | Endpoint          | Description                                       |
|---|--------|-------------------|---------------------------------------------------|
| 1 | GET    | `/`               | Role-scoped feed (`?unread=true` to filter), max 100 |
| 2 | GET    | `/preferences`    | Own notification preferences (with defaults)      |
| 3 | PATCH  | `/preferences`    | Upsert own preferences (merge)                    |
| 4 | POST   | `/mark-all-read`  | Mark all as read                                  |
| 5 | PATCH  | `/:id/read`       | Mark one as read                                  |
| 6 | DELETE | `/:id`            | Dismiss one                                       |

### 18.1 GET `/api/notifications`

**Response `200`:**

```json
{
  "success": true,
  "message": "Notifications fetched",
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "ALLOCATION",
        "title": "Asset allocated to you",
        "message": "AF-0001 — MacBook Pro 14 has been allocated to you.",
        "entity_type": "ALLOCATION",
        "entity_id": "uuid",
        "read": false,
        "created_at": "2026-07-12T09:00:00.000Z",
        "recipient": { "id": "uuid", "name": "Priya Shah" },
        "isMine": false
      }
    ],
    "unreadCount": 3
  }
}
```

`recipient` identifies whose notification each row is (relevant for Admin / Asset Manager / Dept Head feeds); `isMine` is `true` when it belongs to the caller. `unreadCount` counts unread rows **within the caller's scope**.

### 18.2 GET `/api/notifications/preferences`

**Response `200`:**

```json
{
  "success": true,
  "message": "Preferences fetched",
  "data": {
    "preferences": { "allocation": true, "transfer": true, "maintenance": true, "booking": true, "audit": true, "email": false }
  }
}
```

### 18.3 PATCH `/api/notifications/preferences`

**Request body:** any subset, merged into existing prefs — e.g. `{ "email": true, "booking": false }`

**Response `200`:** `{ "preferences": { ...merged } }`

### 18.4 POST `/api/notifications/mark-all-read`

**Response `200`:** `{ "updatedCount": 3 }`

### 18.5 PATCH `/api/notifications/:id/read`

**Response `200`:** `"Notification marked as read"` · **Errors:** `404` (not found or not yours).

### 18.6 DELETE `/api/notifications/:id`

**Response `200`:** `"Notification dismissed"` · **Errors:** `404`.

---

## 19. Activity Logs API

Base: `/api/activity-logs` — **ADMIN only.** Full audit trail of every mutating action.

| # | Method | Endpoint   | Description                              |
|---|--------|------------|------------------------------------------|
| 1 | GET    | `/`        | Paginated, filterable log                |
| 2 | GET    | `/export`  | CSV download (same filters, max 5000)    |

Action types: `ALLOCATION`, `RETURN`, `TRANSFER`, `BOOKING`, `MAINTENANCE`, `AUDIT`, `ASSET`, `USER_CHANGE`, `SYSTEM`.

### 19.1 GET `/api/activity-logs`

**Query parameters:**

| Param        | Type   | Description                              |
|--------------|--------|------------------------------------------|
| `page`       | number | Default `1`                              |
| `limit`      | number | Default `25`, max `100`                  |
| `actionType` | string | One of the action types above            |
| `userId`     | uuid   | Filter by actor                          |
| `entityType` | string | e.g. `ASSET`, `ALLOCATION`               |
| `from`       | date   | `YYYY-MM-DD` (inclusive)                 |
| `to`         | date   | `YYYY-MM-DD` (inclusive)                 |

**Response `200`:**

```json
{
  "success": true,
  "message": "Activity logs fetched",
  "data": {
    "logs": [
      {
        "id": "uuid",
        "actionType": "ASSET",
        "entityType": "ASSET",
        "entityId": "uuid",
        "description": "Registered asset AF-0042 — MacBook Pro 14",
        "metadata": null,
        "actor": { "id": "uuid", "name": "Asset Manager", "email": "manager@assetflow.com" },
        "createdAt": "2026-07-12T09:00:00.000Z"
      }
    ],
    "total": 512,
    "page": 1,
    "limit": 25
  }
}
```

### 19.2 GET `/api/activity-logs/export?format=csv`

Accepts the same filters. **Response `200`:** raw CSV (`timestamp,actor,action_type,entity_type,description`) as an attachment — not the JSON envelope.

---

## 20. Error Reference

All errors use the envelope `{ "success": false, "message": "<reason>", "data": null }`.

| Status | When                                                                                  |
|--------|---------------------------------------------------------------------------------------|
| `400`  | Validation failure, invalid state transition, nothing to update                       |
| `401`  | Missing / invalid / expired token; refresh-token reuse; invalid credentials           |
| `403`  | Insufficient role; record outside your department; self-modification blocked          |
| `404`  | Resource not found (also returned for malformed UUIDs); unknown route (`"Route not found"`) |
| `409`  | Uniqueness conflicts (email, tag, department/category name), pending transfer exists, booking slot conflict |
| `413`  | Uploaded file exceeds 10 MB                                                           |
| `429`  | OTP rate limits (60 s resend cooldown; 5 verify attempts)                             |
| `503`  | Cloudinary not configured; database unreachable (`/health`)                           |
| `500`  | Unhandled server error (`"Internal server error"`)                                    |

---

## 21. Database Schema

PostgreSQL (Neon) with `pgcrypto` for UUID generation. Full DDL: [`sql/schema.sql`](sql/schema.sql).

### Enums

| Enum          | Values                                            |
|---------------|---------------------------------------------------|
| `user_role`   | `ADMIN`, `ASSET_MANAGER`, `DEPT_HEAD`, `EMPLOYEE` |
| `user_status` | `ACTIVE`, `INACTIVE`                              |

### Tables

#### `users`

| Column          | Type          | Notes                                        |
|-----------------|---------------|----------------------------------------------|
| `id`            | UUID PK       | `gen_random_uuid()`                          |
| `name`          | TEXT          | NOT NULL                                     |
| `email`         | TEXT          | UNIQUE, NOT NULL                             |
| `password_hash` | TEXT          | bcrypt (cost 10), NOT NULL                   |
| `role`          | `user_role`   | Default `EMPLOYEE`                           |
| `department_id` | UUID FK       | → `departments(id)`, ON DELETE SET NULL      |
| `status`        | `user_status` | Default `ACTIVE`                             |
| `designation`   | TEXT          | Nullable                                     |
| `created_at` / `updated_at` | TIMESTAMPTZ | Default `now()`                  |

#### `departments`

| Column       | Type    | Notes                                        |
|--------------|---------|----------------------------------------------|
| `id`         | UUID PK |                                              |
| `name`       | TEXT    | UNIQUE, NOT NULL                             |
| `head_id`    | UUID FK | → `users(id)`, ON DELETE SET NULL            |
| `parent_id`  | UUID FK | → `departments(id)` (hierarchy)              |
| `status`     | TEXT    | Default `'ACTIVE'`                           |
| `created_at` | TIMESTAMPTZ |                                          |

#### `refresh_tokens`

| Column        | Type    | Notes                                            |
|---------------|---------|--------------------------------------------------|
| `id`          | UUID PK |                                                  |
| `user_id`     | UUID FK | → `users(id)`, ON DELETE CASCADE                 |
| `token_hash`  | TEXT    | UNIQUE — SHA-256 of the opaque token             |
| `expires_at`  | TIMESTAMPTZ | NOT NULL                                     |
| `revoked_at`  | TIMESTAMPTZ | Set on logout / rotation / revocation        |
| `replaced_by` | UUID FK | → `refresh_tokens(id)` — rotation chain          |
| `created_at`  | TIMESTAMPTZ |                                              |

#### `password_reset_otps`

| Column       | Type    | Notes                                     |
|--------------|---------|-------------------------------------------|
| `id`         | UUID PK |                                           |
| `user_id`    | UUID FK | → `users(id)`, ON DELETE CASCADE          |
| `code_hash`  | TEXT    | bcrypt hash of the 6-digit code           |
| `expires_at` | TIMESTAMPTZ | 10-minute TTL                         |
| `consumed`   | BOOLEAN | Default FALSE                             |
| `attempts`   | INT     | Default 0 (max 5)                         |
| `created_at` | TIMESTAMPTZ |                                       |

#### `categories`

| Column          | Type    | Notes                                     |
|-----------------|---------|-------------------------------------------|
| `id`            | UUID PK |                                           |
| `name`          | TEXT    | UNIQUE, NOT NULL                          |
| `custom_fields` | JSONB   | Array of field definitions, default `[]`  |
| `status`        | TEXT    | Default `'ACTIVE'`                        |
| `parent_id`     | UUID FK | → `categories(id)`, ON DELETE SET NULL    |
| `icon`          | TEXT    | Nullable                                  |
| `created_at`    | TIMESTAMPTZ |                                       |

#### `locations` / `floors` / `rooms`

| Table       | Columns                                                              |
|-------------|----------------------------------------------------------------------|
| `locations` | `id` UUID PK, `building` TEXT NOT NULL, `city` TEXT, `created_at`    |
| `floors`    | `id` UUID PK, `location_id` UUID FK → locations (CASCADE), `name`    |
| `rooms`     | `id` UUID PK, `floor_id` UUID FK → floors (CASCADE), `name`          |

#### `assets`

| Column          | Type    | Notes                                                        |
|-----------------|---------|--------------------------------------------------------------|
| `id`            | UUID PK |                                                              |
| `tag`           | TEXT    | UNIQUE, NOT NULL (auto `AF-0001`, `AF-0002`, …)              |
| `name`          | TEXT    | NOT NULL                                                     |
| `serial_no`     | TEXT    | Nullable                                                     |
| `category_id`   | UUID FK | → `categories(id)`, SET NULL                                 |
| `department_id` | UUID FK | → `departments(id)`, SET NULL                                |
| `status`        | TEXT    | `AVAILABLE` (default) \| `ALLOCATED` \| `UNDER_MAINTENANCE` \| `RETIRED` \| `DISPOSED` \| `LOST` |
| `condition`     | TEXT    | Default `'GOOD'`                                             |
| `location`      | TEXT    | Free-text location label                                     |
| `room_id`       | UUID FK | → `rooms(id)`, SET NULL                                      |
| `is_bookable`   | BOOLEAN | Default FALSE — makes the asset a bookable resource          |
| `purchase_date` | DATE    | Nullable                                                     |
| `purchase_cost` | NUMERIC | Nullable                                                     |
| `custom_values` | JSONB   | Values for the category's custom fields, default `{}`        |
| `retirement`    | JSONB   | `{ reason, retirementDate, by }` when retired                |
| `disposal`      | JSONB   | `{ method, notes, disposalDate, by }` when disposed          |
| `created_by`    | UUID FK | → `users(id)`, SET NULL                                      |
| `created_at` / `updated_at` | TIMESTAMPTZ |                                          |

#### `asset_documents`

| Column        | Type    | Notes                                  |
|---------------|---------|----------------------------------------|
| `id`          | UUID PK |                                        |
| `asset_id`    | UUID FK | → `assets(id)`, CASCADE                |
| `url`         | TEXT    | Cloudinary secure URL                  |
| `filename`    | TEXT    | Original filename                      |
| `mime`        | TEXT    | `image/png` \| `image/jpeg` \| `application/pdf` |
| `bytes`       | INTEGER | File size                              |
| `uploaded_by` | UUID FK | → `users(id)`, SET NULL                |
| `created_at`  | TIMESTAMPTZ |                                    |

#### `allocations`

| Column                 | Type    | Notes                                                       |
|------------------------|---------|-------------------------------------------------------------|
| `id`                   | UUID PK |                                                             |
| `asset_id`             | UUID FK | → `assets(id)`, CASCADE                                     |
| `holder_id`            | UUID FK | → `users(id)`, CASCADE                                      |
| `allocated_by`         | UUID FK | → `users(id)`, SET NULL                                     |
| `purpose`              | TEXT    | Nullable                                                    |
| `status`               | TEXT    | `PENDING` \| `ACTIVE` (default) \| `RETURN_REQUESTED` \| `RETURNED` \| `REJECTED` |
| `expected_return_date` | DATE    | Nullable — drives overdue logic                             |
| `allocated_at`         | TIMESTAMPTZ | Default `now()`                                         |
| `return_requested_at`  | TIMESTAMPTZ | Nullable                                                |
| `condition_on_return`  | TEXT    | Nullable                                                    |
| `return_notes`         | TEXT    | Nullable                                                    |
| `returned_at`          | TIMESTAMPTZ | Nullable                                                |
| `approved_by`          | UUID FK | → `users(id)`, SET NULL                                     |
| `created_at`           | TIMESTAMPTZ |                                                         |

#### `transfer_requests`

| Column            | Type    | Notes                                             |
|-------------------|---------|---------------------------------------------------|
| `id`              | UUID PK |                                                   |
| `asset_id`        | UUID FK | → `assets(id)`, CASCADE                           |
| `from_user`       | UUID FK | → `users(id)`, SET NULL (current holder)          |
| `to_user`         | UUID FK | → `users(id)`, CASCADE                            |
| `reason`          | TEXT    | Nullable                                          |
| `status`          | TEXT    | `REQUESTED` (default) \| `APPROVED` \| `REJECTED` |
| `decided_by`      | UUID FK | → `users(id)`, SET NULL                           |
| `decision_reason` | TEXT    | Nullable                                          |
| `created_at` / `decided_at` | TIMESTAMPTZ |                                       |

#### `bookings` & `booking_series`

| Table            | Columns                                                                                                   |
|------------------|-----------------------------------------------------------------------------------------------------------|
| `bookings`       | `id` PK, `resource_id` FK → assets (CASCADE), `booked_by` FK → users (CASCADE), `series_id` FK → booking_series (SET NULL), `start_ts` / `end_ts` TIMESTAMPTZ NOT NULL, `purpose` TEXT, `attendees` JSONB `[]`, `status` TEXT default `'CONFIRMED'` (\| `CANCELLED`), `created_at` |
| `booking_series` | `id` PK, `resource_id` FK → assets (CASCADE), `frequency` TEXT (`DAILY`\|`WEEKLY`), `start_date` / `end_date` DATE, `created_by` FK → users (SET NULL), `created_at` |

#### `maintenance_requests`

| Column             | Type    | Notes                                                            |
|--------------------|---------|------------------------------------------------------------------|
| `id`               | UUID PK |                                                                  |
| `asset_id`         | UUID FK | → `assets(id)`, CASCADE                                          |
| `raised_by`        | UUID FK | → `users(id)`, SET NULL                                          |
| `issue`            | TEXT    | NOT NULL                                                         |
| `issue_type`       | TEXT    | Nullable                                                         |
| `priority`         | TEXT    | `LOW` \| `MEDIUM` (default) \| `HIGH` \| `CRITICAL`              |
| `status`           | TEXT    | `PENDING` (default) \| `APPROVED` \| `REJECTED` \| `TECHNICIAN_ASSIGNED` \| `IN_PROGRESS` \| `RESOLVED` \| `ESCALATED` |
| `technician_id`    | UUID FK | → `users(id)`, SET NULL                                          |
| `technician_name`  | TEXT    | For external technicians                                         |
| `started_at` / `resolved_at` | TIMESTAMPTZ | Nullable                                         |
| `resolution_notes` | TEXT    | Nullable                                                         |
| `cost`             | NUMERIC | Nullable                                                         |
| `rejected_reason`  | TEXT    | Nullable                                                         |
| `escalated`        | JSONB   | `{ reason, escalateTo, by }`                                     |
| `created_at` / `updated_at` | TIMESTAMPTZ |                                              |

#### `maintenance_comments`

| Column       | Type    | Notes                                       |
|--------------|---------|---------------------------------------------|
| `id`         | UUID PK |                                             |
| `request_id` | UUID FK | → `maintenance_requests(id)`, CASCADE       |
| `author_id`  | UUID FK | → `users(id)`, SET NULL                     |
| `text`       | TEXT    | NOT NULL                                    |
| `created_at` | TIMESTAMPTZ |                                         |

#### `audit_cycles`, `audit_cycle_departments`, `audit_cycle_auditors`, `audit_items`

| Table                     | Columns                                                                                          |
|---------------------------|--------------------------------------------------------------------------------------------------|
| `audit_cycles`            | `id` PK, `name` NOT NULL, `scope_type` TEXT default `'ALL'` (\| `DEPARTMENT`), `start_date` / `end_date` DATE, `status` TEXT `'ACTIVE'`\|`'CLOSED'`, `created_by` FK → users, `closed_at`, `created_at` |
| `audit_cycle_departments` | `(cycle_id, department_id)` composite PK — both FK CASCADE                                        |
| `audit_cycle_auditors`    | `(cycle_id, user_id)` composite PK — both FK CASCADE                                              |
| `audit_items`             | `id` PK, `cycle_id` FK (CASCADE), `asset_id` FK (CASCADE), `expected_location` TEXT, `verification` TEXT default `'PENDING'` (\| `VERIFIED`\|`DISCREPANCY`\|`MISSING`), `notes`, `photo_url`, `verified_by` FK → users (SET NULL), `verified_at`; **UNIQUE (cycle_id, asset_id)** |

#### `notifications`

| Column        | Type    | Notes                                        |
|---------------|---------|----------------------------------------------|
| `id`          | UUID PK |                                              |
| `user_id`     | UUID FK | → `users(id)`, CASCADE                       |
| `type`        | TEXT    | `ALLOCATION`, `RETURN`, `TRANSFER`, `BOOKING`, `MAINTENANCE`, `AUDIT`, … |
| `title`       | TEXT    | NOT NULL                                     |
| `message`     | TEXT    | Nullable                                     |
| `entity_type` | TEXT    | Nullable                                     |
| `entity_id`   | UUID    | Nullable                                     |
| `read`        | BOOLEAN | Default FALSE                                |
| `created_at`  | TIMESTAMPTZ |                                          |

#### `notification_preferences`

| Column       | Type    | Notes                                    |
|--------------|---------|------------------------------------------|
| `user_id`    | UUID PK | → `users(id)`, CASCADE                   |
| `prefs`      | JSONB   | Merged over defaults, default `{}`       |
| `updated_at` | TIMESTAMPTZ |                                      |

#### `activity_logs`

| Column        | Type    | Notes                                     |
|---------------|---------|-------------------------------------------|
| `id`          | UUID PK |                                           |
| `actor_id`    | UUID FK | → `users(id)`, SET NULL                   |
| `action_type` | TEXT    | See action types in §19                   |
| `entity_type` | TEXT    | Nullable                                  |
| `entity_id`   | UUID    | Nullable                                  |
| `description` | TEXT    | NOT NULL                                  |
| `metadata`    | JSONB   | Nullable                                  |
| `created_at`  | TIMESTAMPTZ |                                       |

### Indexes

| Index                  | Table / Columns                                            | Purpose                            |
|------------------------|------------------------------------------------------------|------------------------------------|
| `idx_users_email`      | `users(email)`                                             | Login lookup                       |
| `idx_otp_user`         | `password_reset_otps(user_id, consumed)`                   | OTP verification                   |
| `idx_rt_hash`          | `refresh_tokens(token_hash)`                               | Refresh lookup                     |
| `idx_rt_user_active`   | `refresh_tokens(user_id)` WHERE `revoked_at IS NULL`       | Bulk session revocation (partial)  |
| `idx_assets_status`    | `assets(status)`                                           | Status filters / KPIs              |
| `idx_assets_category`  | `assets(category_id)`                                      | Category filters                   |
| `idx_assets_department`| `assets(department_id)`                                    | Department scoping                 |
| `idx_alloc_asset`      | `allocations(asset_id, status)`                            | Current-holder lookups             |
| `idx_alloc_holder`     | `allocations(holder_id, status)`                           | "My assets" queries                |
| `idx_transfers_status` | `transfer_requests(status)`                                | Pending-transfer lists             |
| `idx_bookings_resource`| `bookings(resource_id, start_ts)`                          | Calendar / conflict checks         |
| `idx_bookings_user`    | `bookings(booked_by, start_ts)`                            | "My bookings"                      |
| `idx_maint_status`     | `maintenance_requests(status)`                             | Open-request lists                 |
| `idx_maint_asset`      | `maintenance_requests(asset_id)`                           | Asset history                      |
| `idx_audit_items_cycle`| `audit_items(cycle_id, verification)`                      | Checklist filters / stats          |
| `idx_notif_user`       | `notifications(user_id, read, created_at DESC)`            | Feed + unread count                |
| `idx_activity_created` | `activity_logs(created_at DESC)`                           | Log timeline                       |
| `idx_activity_actor`   | `activity_logs(actor_id, created_at DESC)`                 | Per-user activity                  |

---

## 22. Seeded Test Accounts

`npm run seed` provisions demo data including these logins:

| Role            | Email                    | Password       | Department       |
|-----------------|--------------------------|----------------|------------------|
| ADMIN           | `admin@assetflow.com`    | `Admin@123`    | —                |
| ASSET_MANAGER   | `manager@assetflow.com`  | `Manager@123`  | —                |
| DEPT_HEAD       | `head@assetflow.com`     | `Head@123`     | Engineering      |
| DEPT_HEAD       | `aditi@assetflow.com`    | `Aditi@123`    | Sales            |
| ASSET_MANAGER   | `rohan@assetflow.com`    | `Rohan@123`    | Operations       |
| EMPLOYEE        | `employee@assetflow.com` | `Employee@123` | Engineering      |
| EMPLOYEE        | `priya@assetflow.com`    | `Priya@123`    | Engineering      |
| EMPLOYEE        | `arjun@assetflow.com`    | `Arjun@123`    | Sales            |
| EMPLOYEE        | `sneha@assetflow.com`    | `Sneha@123`    | Marketing        |
| EMPLOYEE (INACTIVE) | `vikram@assetflow.com` | `Vikram@123` | Human Resources  |

---

*Generated from the source in `Backend/src` (Express 5 + TypeScript + Neon PostgreSQL). Postman collection: [`postman/AssetFlow.postman_collection.json`](postman/AssetFlow.postman_collection.json).*
