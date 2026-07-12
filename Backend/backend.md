# AssetFlow — Backend

Authentication & RBAC API for AssetFlow.

**Stack:** Node.js + TypeScript + Express · Neon (Postgres) · Nodemailer · JWT (HttpOnly cookies)

**Locked decisions**

| Decision | Value |
|---|---|
| Login | Email + password only |
| OTP at signup | **Not used** — signup logs you straight in |
| OTP usage | **Forgot password only** |
| Tokens | Access token (15 min) + Refresh token (7 days, rotating) |
| Role at signup | Always `EMPLOYEE` — hardcoded server-side |
| Admin creation | Seeded directly into the database (`npm run db:seed`) |
| Role assignment | Admin only, from the Employee Directory |

---

## Index

1. [Quick start](#1-quick-start)
2. [Environment variables](#2-environment-variables)
3. [Scripts](#3-scripts)
4. [Project structure](#4-project-structure)
5. [Response envelope](#5-response-envelope)
6. [Where the tokens live](#6-where-the-tokens-live)
7. [Database schema](#7-database-schema)
8. [Auth API](#8-auth-api)
9. [Role assignment API (Admin only)](#9-role-assignment-api-admin-only)
10. [Departments & Categories API](#10-departments--categories-api)
11. [Authorization middleware & status codes](#11-authorization-middleware--status-codes)
12. [The four roles](#12-the-four-roles)
13. [Route permission matrix](#13-route-permission-matrix)
14. [Demo credentials](#14-demo-credentials)
15. [The 60-second RBAC demo](#15-the-60-second-rbac-demo)
16. [Frontend integration notes](#16-frontend-integration-notes)
17. [API reference — all endpoints](#17-api-reference--all-endpoints)
    · [Auth](#171-auth-apiauth) · [Users](#172-users-apiusers) · [Departments](#173-departments-apidepartments)
    · [Categories](#174-categories-apicategories) · [Assets](#175-assets-apiassets) · [Locations](#176-locations-apilocations)
    · [Allocations](#177-allocations-apiallocations) · [Transfers](#178-transfers-apitransfers)
    · [Resources](#179-resources-bookable-apiresources) · [Bookings](#1710-bookings-apibookings) · [Maintenance](#1711-maintenance-apimaintenance)
    · [Audit Cycles](#1712-audit-cycles-apiaudit-cycles) · [Dashboard](#1713-dashboard-apidashboard) · [Reports](#1714-reports-apireports)
    · [Notifications](#1715-notifications-apinotifications) · [Activity Logs](#1716-activity-logs-apiactivity-logs) · [Health](#1717-health-health)

---

## 1. Quick start

```bash
cd Backend
npm install
cp .env.example .env        # fill in DATABASE_URL, JWT_ACCESS_SECRET, mail creds
npm run db:migrate          # creates all tables in Neon (idempotent)
npm run db:seed             # seeds the Admin + demo accounts + departments
npm run dev                 # http://localhost:3000, auto-reload
```

Verify: `curl http://localhost:3000/health` → reports DB connectivity and latency.

## 2. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon Postgres connection string (`sslmode=require`) |
| `JWT_ACCESS_SECRET` | ✅ | `openssl rand -hex 32` — signs the access JWT |
| `ACCESS_TOKEN_TTL` | | Access token lifetime (default `15m`) |
| `REFRESH_TOKEN_TTL_DAYS` | | Refresh token lifetime (default `7`) |
| `CLIENT_URL` | | Frontend origin(s) for CORS with credentials; comma-separate several (default `http://localhost:5173`) |
| `PORT` / `NODE_ENV` | | Default `3000` / `development` |
| `APP_NAME` | | Name used in emails (default `AssetFlow`) |
| `MAIL_USER` / `MAIL_PASS` | ✅ for emails | Gmail address + **App Password** (needs 2FA on the Google account) — the only email sender, delivers to any address |

Forgot-password emails require `MAIL_USER`/`MAIL_PASS`. Create the App Password at myaccount.google.com/apppasswords.

## 3. Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with auto-reload (`tsx watch`) |
| `npm start` | Run the server |
| `npm run db:migrate` | Apply `sql/schema.sql` to Neon — idempotent, safe to re-run |
| `npm run db:seed` | Seed Admin + demo users + Engineering/Sales departments — idempotent |
| `npm run typecheck` | `tsc --noEmit` (strict mode) |

## 4. Project structure

```
src/
  server.ts              boot: verify DB, start listening
  app.ts                 express wiring: helmet, CORS+credentials, logging, sanitize, routers
  config.ts              typed env access (fails fast on missing vars)
  db/
    neon.ts              pg Pool — the only file that knows the database
    migrate.ts           applies sql/schema.sql
    seed.ts              demo accounts (spec §3.6 / §11)
  lib/
    tokens.ts            access JWT sign/verify · opaque refresh token
    cookies.ts           at/rt HttpOnly cookie options (Secure+None in prod, Lax in dev)
    crypto.ts            6-digit OTP · SHA-256 token hashing
    email.ts             Nodemailer (Gmail SMTP) — branded HTML reset-code email
    respond.ts           the { success, message, data } envelope
    validate.ts          email/UUID validators
    logger.ts            pino (pretty in dev, JSON in prod)
  middleware/
    auth.ts              requireAuth · requireRole · requireOwnDepartment
    sanitize.ts          trims strings, strips control chars, caps depth, blocks proto-pollution
    activity.ts          logActivity() — appends to the activity trail
    notify.ts            notify() — creates in-app notifications
    scope.ts             role-based SQL scoping (own / dept / org-wide)
    cloudinary.ts        asset document uploads (assets/<assetId> folders)
  routes/
    health.ts  auth.ts  users.ts  departments.ts  categories.ts
    assets.ts  locations.ts  allocations.ts  transfers.ts  bookings.ts
    maintenance.ts  audits.ts  dashboard.ts  reports.ts
    notifications.ts  activity-logs.ts
sql/schema.sql           full DDL (auth spec §3.5 + all module tables)
```

## 5. Response envelope

**Every endpoint returns the same shape.** No exceptions.

```json
{ "success": true,  "message": "Login successful", "data": { "user": { "…": "…" } } }
{ "success": true,  "message": "Logged out",       "data": null }
{ "success": false, "message": "Invalid credentials", "data": null }
```

| Key | Type | Rule |
|---|---|---|
| `success` | boolean | `true` for 2xx, `false` for 4xx/5xx |
| `message` | string | Always present, human-readable — this is what the frontend toasts |
| `data` | object \| null | The payload; `null` when there is nothing to return |

Everything lives **inside `data`** (`data.user`, `data.users`, `data.total`) — never at the top level.

## 6. Where the tokens live

Tokens are **not in the JSON body** — they travel in `Set-Cookie` response headers.

| | Access token `at` | Refresh token `rt` |
|---|---|---|
| Format | JWT (HS256) `{ userId, role, departmentId }` | Random 64-byte opaque hex |
| Lifetime | 15 minutes | 7 days |
| Sent on | every API request (`Path=/`) | only `/api/auth/*` (`Path=/api/auth`) |
| Stored in DB | No — stateless | Yes — SHA-256 hash in `refresh_tokens` |
| Readable by JS | **No** (`HttpOnly`) | **No** (`HttpOnly`) |

- **Rotation:** every `/refresh` revokes the presented token and chains it to its replacement (`replaced_by`).
- **Reuse detection:** presenting an already-revoked token revokes **every** active session for that user.
- **Dev vs prod cookies:** production uses `Secure; SameSite=None` (cross-origin Vercel↔Render); development uses `SameSite=Lax` without `Secure` so cookies work over plain http.
- **Bearer fallback (spec §2.1):** `requireAuth` also accepts `Authorization: Bearer <at>` if you ever need it.

## 7. Database schema

Applied by `npm run db:migrate`. Enums: `user_role` = `ADMIN | ASSET_MANAGER | DEPT_HEAD | EMPLOYEE`, `user_status` = `ACTIVE | INACTIVE`.

| Table | Purpose | Key columns |
|---|---|---|
| `departments` | Org structure; optional hierarchy | `name` unique, `head_id → users`, `parent_id → departments`, `status` |
| `users` | The auth table — **`role` drives all RBAC, `department_id` drives scoping** | `email` unique, `password_hash` (bcrypt 10), `role`, `department_id` (NULL until Admin assigns), `status` |
| `password_reset_otps` | Forgot-password codes | `code_hash` (bcrypt of the 6 digits), `expires_at` (+10 min), `consumed`, `attempts` (lock at 5), `created_at` (60s resend cooldown) |
| `refresh_tokens` | One row per session | `token_hash` (SHA-256) unique, `expires_at` (+7 days), `revoked_at`, `replaced_by` (rotation chain) |
| `categories` | Asset categories + custom fields, optional hierarchy (Screen 3/4) | `name` unique, `custom_fields` JSONB (each field has an `id`), `parent_id`, `icon` |

**Module tables (Screens 2–10):**

| Table | Purpose | Key columns |
|---|---|---|
| `locations` / `floors` / `rooms` | Building → floor → room cascade | `building`, `city` · `location_id` · `floor_id` |
| `assets` | Core asset registry | `tag` unique (auto `AF-000N`), `serial_no`, `category_id`, `department_id`, `status` (`AVAILABLE·ALLOCATED·UNDER_MAINTENANCE·RETIRED·DISPOSED·LOST`), `condition`, `location`/`room_id`, `is_bookable`, `custom_values` JSONB, `retirement`/`disposal` JSONB |
| `asset_documents` | Uploaded files per asset (Cloudinary) | `url`, `filename`, `mime`, `bytes`, `uploaded_by` |
| `allocations` | Asset ↔ holder lifecycle | `status` (`PENDING·ACTIVE·RETURN_REQUESTED·RETURNED·REJECTED`), `expected_return_date`, `condition_on_return`, `approved_by` |
| `transfer_requests` | Transfer workflow | `from_user`, `to_user`, `status` (`REQUESTED·APPROVED·REJECTED`), `decided_by`, `decision_reason` |
| `bookings` / `booking_series` | Resource bookings + recurring series | `resource_id → assets`, `start_ts`/`end_ts`, `status` (`CONFIRMED·CANCELLED`; Upcoming/Ongoing/Completed derived), `series_id`, `frequency` |
| `maintenance_requests` | Repair pipeline | `issue`, `priority` (`LOW…CRITICAL`), `status` (`PENDING·APPROVED·REJECTED·TECHNICIAN_ASSIGNED·IN_PROGRESS·RESOLVED·ESCALATED`), `technician_id`/`technician_name`, `cost` |
| `maintenance_comments` | Comment thread per request | `request_id`, `author_id`, `text` |
| `audit_cycles` (+`_departments`, `_auditors`) | Audit cycles, scope, assigned auditors | `scope_type` (`ALL·DEPARTMENT`), `status` (`ACTIVE·CLOSED`) — *auditor is an assignment, not a role* |
| `audit_items` | Per-asset checklist snapshot | `verification` (`PENDING·VERIFIED·DISCREPANCY·MISSING`), `notes`, `photo_url`, `verified_by`, unique `(cycle_id, asset_id)` |
| `notifications` | Per-user in-app feed | `type`, `title`, `message`, `entity_type/id`, `read` |
| `notification_preferences` | Per-user settings | `prefs` JSONB (merged over defaults) |
| `activity_logs` | Full audit trail | `actor_id`, `action_type` (`ALLOCATION·RETURN·TRANSFER·BOOKING·MAINTENANCE·AUDIT·ASSET·USER_CHANGE·SYSTEM`), `description`, `metadata` |

No `is_verified` column — signup sends no OTP. The seeded Admin is what satisfies *"not self-assigned admin roles"*: the signup endpoint physically cannot produce an `ADMIN`.

## 8. Auth API

Base path `/api/auth`.

| # | Endpoint | Auth | Tokens issued |
|---|---|---|---|
| 8.1 | `POST /signup` | public | ✅ `at` + `rt` |
| 8.2 | `POST /login` | public | ✅ `at` + `rt` |
| 8.3 | `POST /refresh` | `rt` cookie | ✅ new pair (old `rt` revoked) |
| 8.4 | `POST /logout` | `rt` cookie | ❌ cookies cleared |
| 8.5 | `GET /me` | `at` | ❌ |
| 8.6 | `POST /forgot-password` | public | ❌ |
| 8.7 | `POST /reset-password` | public (OTP is the proof) | ❌ |
| 8.8 | `POST /change-password` | `at` | ❌ |

### 8.1 `POST /signup`

```json
{ "name": "Raj Mehta", "email": "raj@example.com", "password": "Raj@12345" }
```

Rules: `name` 2–100 chars · valid `email` (lowercased) · `password` ≥ 8 chars. A `"role"` field in the body is **never read** — the insert hardcodes `'EMPLOYEE'`.

**201** → `data.user` = `{ id, name, email, role: "EMPLOYEE", departmentId: null, status: "ACTIVE" }`
**Errors:** `400` validation · `409 Email already registered`

### 8.2 `POST /login`

```json
{ "email": "raj@example.com", "password": "Raj@12345" }
```

Checks in order: user exists → bcrypt matches → status ACTIVE → issue tokens.
**Errors:** `400 Email and password are required` · `401 Invalid credentials` (same message for unknown email and wrong password — prevents enumeration) · `403 Account is inactive. Contact your administrator.`

### 8.3 `POST /refresh`

No body — the browser sends the `rt` cookie. Rotates the refresh token, mints a new access token. **Role and department are re-read from the database**, never copied from the old token — an Admin's promotion/demotion takes effect without logout, within 15 minutes at worst.
**Errors:** `401 Session expired. Please log in again.` (missing/expired/revoked/reused) · `403 Account is inactive.`

### 8.4 `POST /logout`

Revokes the presented `rt`, clears both cookies. Always `200`, even without a valid session.

### 8.5 `GET /me`

Rehydrates `AuthContext` on app load. Reads role/department **fresh from the DB**.
**200** → `data.user` = `{ id, name, email, role, departmentId, department: { id, name } | null, status }`
**Errors:** `401 Not authenticated`

### 8.6 `POST /forgot-password`

```json
{ "email": "raj@example.com" }
```

Emails a 6-digit code (10-minute expiry) via Gmail SMTP (Nodemailer). Returns the same generic `200` whether or not the email exists (anti-enumeration):
`"If that email is registered, a reset code has been sent."`
**Errors:** `429 Please wait 60 seconds before requesting another code.`

### 8.7 `POST /reset-password`

OTP and new password **together in one request** — verification and update are atomic (a separate verify endpoint would let anyone hit step 2 without proof).

```json
{ "email": "raj@example.com", "otp": "482913", "newPassword": "NewPass@123" }
```

On success: password updated → OTP consumed → **every refresh token revoked** (boots out an attacker if the account was compromised). The user logs in again.
**Errors:** `400 Invalid or expired code` · `400 Password must be at least 8 characters` · `429 Too many attempts. Request a new code.` (5 wrong tries)

### 8.8 `POST /change-password`

```json
{ "currentPassword": "Raj@12345", "newPassword": "NewPass@123" }
```

Current session survives; all **other** sessions are revoked.
**Errors:** `400 Current password is incorrect` · `401 Not authenticated`

## 9. Role assignment API (Admin only)

Employee Directory (Screen 3, Tab C) — **the only place `users.role` is ever written by a request.** All routes: `requireAuth` + `requireRole('ADMIN')`.

### 9.1 `GET /api/users`

Query params: `page` (default 1) · `limit` (default 20, max 100) · `q` (name/email, case-insensitive) · `role` · `departmentId` · `status`.
**200** → `data` = `{ users: [{ id, name, email, role, department: { id, name } | null, status, createdAt }], total, page, limit }`

### 9.2 `PATCH /api/users/:id/role`

```json
{ "role": "ASSET_MANAGER" }
```

Allowed: `EMPLOYEE`, `ASSET_MANAGER`, `DEPT_HEAD`. **`ADMIN` is deliberately not accepted.**
**Errors:** `400 Invalid role` (including `"ADMIN"`) · `400 Assign a department before promoting to Department Head` · `403 You cannot change your own role` · `404 User not found`
The target's existing access token still carries the old role — it self-corrects on their next refresh (≤ 15 min).

### 9.3 `PATCH /api/users/:id/department`

```json
{ "departmentId": "9c4a…" }   // or null to unassign
```

**Errors:** `400 Cannot unassign department from a Department Head` · `404 Department not found` · `404 User not found`

### 9.4 `PATCH /api/users/:id/status`

```json
{ "status": "INACTIVE" }
```

Deactivating revokes **all** of that user's refresh tokens immediately — their access token dies within 15 minutes and cannot be renewed.
**Errors:** `403 You cannot deactivate yourself` · `404 User not found`

## 10. Departments & Categories API

Reads: any authenticated user. Writes: **Admin only.**

| Endpoint | Method | Notes |
|---|---|---|
| `/api/departments` | GET | List with head + employee count |
| `/api/departments/:id` | GET | Detail: `{ id, name, head: {id,name}, parentId, status, employeeCount }` |
| `/api/departments` | POST | `{ name, headId?, parentId? }` → 201 · `409` duplicate name |
| `/api/departments/:id` | PATCH | Partial: `name`, `headId`, `parentId`, `status` |
| `/api/departments/:id` | DELETE | Members' `department_id` becomes NULL (FK) |
| `/api/categories` | GET | `{ id, name, customFields, status }` — Screen 4 picklist |
| `/api/categories` | POST | `{ name, customFields?: [{ key, label, type }] }` → 201 |
| `/api/categories/:id` | PATCH / DELETE | Admin only |

## 11. Authorization middleware & status codes

Applied in this order:

- **`requireAuth`** — verifies the `at` cookie JWT (or Bearer header). Attaches `req.user = { userId, role, departmentId }`. Fail → `401 Not authenticated`.
- **`requireRole(...roles)`** — checks `req.user.role`. Fail → `403 Insufficient permissions`.
- **`requireOwnDepartment(loader)`** — for Dept Heads; compares the target record's `department_id` with `req.user.departmentId`. Admin and Asset Manager bypass (org-wide). Fail → `403 This record is outside your department`. (Wired up by the asset/transfer modules as they land.)

| Code | Meaning | Raised by |
|---|---|---|
| 400 | Bad input | Validation |
| 401 | No / invalid / expired access token | `requireAuth` |
| 403 | Valid token, wrong role | `requireRole` |
| 403 | Right role, wrong department | `requireOwnDepartment` |
| 403 | Account inactive | Login / refresh |
| 404 | Record not found | Controller |
| 409 | Email/name already registered | Signup, departments, categories |
| 429 | OTP cooldown / too many attempts | Rate limit |

Also on: helmet security headers, request logging with secret redaction, a global input sanitizer (trims strings, strips control characters, caps length/depth/array size, drops `__proto__`/`constructor`/`prototype`), and a 20 kb JSON body limit.

## 12. The four roles

- **Admin** — Organization Setup (departments, categories, employee directory). **The only role that can assign roles.** Org-wide analytics. Seeded into the DB; never created via signup.
- **Asset Manager** — Registers and allocates assets; approves transfers, maintenance, returns, audit discrepancies. Organisation-wide scope.
- **Department Head** — Views/approves within **their own department** only (`requireOwnDepartment`).
- **Employee** — The default for every signup. Own assets, bookings, maintenance requests, return/transfer requests.

Roles are **cumulative** — every authenticated user has the Employee baseline, with role-specific permissions layered on top.

> **Auditor is not a role.** Auditors are assigned to an audit cycle (`audit_cycle_auditors` join table, when the audit module lands). The check is "is this user an assigned auditor on this cycle?" — adding `AUDITOR` to the enum would be a design error.

## 13. Route permission matrix

Implemented today (`requireAuth` on every row; `—` = any authenticated user):

| Endpoint | Method | Role guard |
|---|---|---|
| `/health` | GET | public |
| `/api/auth/signup` · `/login` · `/forgot-password` · `/reset-password` · `/refresh` | POST | public |
| `/api/auth/me` | GET | — |
| `/api/auth/logout` · `/change-password` | POST | — |
| `/api/departments` | GET | — |
| `/api/departments/:id` | GET | — |
| `/api/departments` (+`/:id`) | POST / PATCH / DELETE | `ADMIN` |
| `/api/categories` | GET | — |
| `/api/categories` (+`/:id`) | POST / PATCH / DELETE | `ADMIN` |
| `/api/users` | GET | `ADMIN` |
| `/api/users/:id/role` · `/department` · `/status` | PATCH | `ADMIN` |
| `/api/users/:id/assets` · `/:id/activity` | GET | `ADMIN` |
| `/api/users/me/profile` | PATCH | — |
| `/api/departments/:id/employees` · `/:id/assets` | GET | — |
| `/api/categories/tree` · `/:id` | GET | — |
| `/api/categories/:id/custom-fields` (+`/:fieldId`) | POST / DELETE | `ADMIN` |
| `/api/locations` | GET | — |
| `/api/assets` · `/search` · `/:id` · `/:id/history` · `/:id/qr` | GET | — (scoped: Employee → held, Dept Head → dept) |
| `/api/assets` (+`/:id`) | POST / PATCH | `ADMIN`, `ASSET_MANAGER` |
| `/api/assets/:id/documents` · `/retire` · `/dispose` · `/mark-lost` | POST | `ADMIN`, `ASSET_MANAGER` |
| `/api/assets/bulk-delete` | POST | `ADMIN` |
| `/api/allocations` · `/kanban` · `/overdue` · `/:id` | GET | — (scoped) |
| `/api/allocations` | POST | `ADMIN`, `ASSET_MANAGER` |
| `/api/allocations/:id/approve` | POST | `ADMIN`, `ASSET_MANAGER`, `DEPT_HEAD` (own dept) |
| `/api/allocations/:id/return` | POST | holder only |
| `/api/allocations/:id/return/approve` | POST | `ADMIN`, `ASSET_MANAGER` |
| `/api/transfers` · `/:id` | GET | — (scoped) |
| `/api/transfers` | POST | — |
| `/api/transfers/:id/approve` · `/reject` | POST | `ADMIN`, `ASSET_MANAGER`, `DEPT_HEAD` (own dept) |
| `/api/resources` · `/:id/calendar` · `/:id/availability` | GET | — |
| `/api/bookings` · `/my` · `/:id` | GET | — (scoped / owner or Dept Head) |
| `/api/bookings` · `/recurring` · `/check-availability` | POST | — |
| `/api/bookings/:id/cancel` · `/reschedule` | POST | owner, or Dept Head of booker's dept |
| `/api/maintenance` · `/:id` · `/:id/comments` | GET | — (scoped; technicians see their jobs) |
| `/api/maintenance` · `/:id/comments` | POST | — |
| `/api/maintenance/:id/approve` · `/reject` · `/assign` · `/escalate` | POST | `ADMIN`, `ASSET_MANAGER` |
| `/api/maintenance/:id/start` · `/resolve` | POST | assigned technician (or AM) |
| `/api/audit-cycles` · `/:id` · `/:id/items` · `/:id/progress` · `/:id/discrepancy-report` · `/:id/summary` | GET | — (Dept Head → cycles covering their dept) |
| `/api/audit-cycles` · `/:id/auditors` · `/:id/close` | POST | `ADMIN` |
| `/api/audit-cycles/:id/items/:itemId` · `/items/bulk-update` | PATCH | assigned auditor (or Admin) |
| `/api/dashboard/kpis` · `/overdue` · `/activity-feed` · `/utilization-chart` · `/upcoming-returns` · `/health-score` | GET | — (scoped) |
| `/api/reports/utilization` · `/maintenance-frequency` · `/due-for-maintenance` · `/allocation-summary` · `/booking-heatmap` · `/export` | GET | `ADMIN`, `ASSET_MANAGER`, `DEPT_HEAD` (own dept) |
| `/api/notifications` · `/preferences` | GET | own only |
| `/api/notifications/:id/read` · `/preferences` | PATCH | own only |
| `/api/notifications/mark-all-read` | POST · `/:id` DELETE | own only |
| `/api/activity-logs` · `/export` | GET | `ADMIN` |

## 14. Demo credentials

Seeded by `npm run db:seed`:

| Role | Name | Email | Password |
|---|---|---|---|
| Admin | System Admin | `admin@assetflow.com` | `Admin@123` |
| Asset Manager | Asset Manager | `manager@assetflow.com` | `Manager@123` |
| Department Head | Department Head | `head@assetflow.com` | `Head@123` |
| Employee | Employee | `employee@assetflow.com` | `Employee@123` |

The Department Head and Employee are pre-assigned to **Engineering**. Reviewers can also sign up themselves — new accounts become Employees, and the Admin can promote them.

## 15. The 60-second RBAC demo

1. Sign up a fresh account → `GET /me` shows **role: EMPLOYEE**, no Organization Setup in the sidebar.
2. In Postman, `POST /api/departments` with that account's cookie → **403 `Insufficient permissions`.** *"The frontend hides it, the backend blocks it."*
3. Log in as Admin → set the new user's Department to Engineering, then Role to Asset Manager.
4. Back in the first tab, the silent refresh (≤ 15 min) or a reload picks up the new role.

That demonstrates: non-self-elevating signup, backend enforcement, the single legitimate promotion path, and live role propagation.

## 16. Frontend integration notes

```js
fetch('/api/assets', { credentials: 'include' })   // ← attaches the HttpOnly cookies
```

Backend already ships `cors({ origin: CLIENT_URL, credentials: true })` — without `credentials` on **both** sides, cookies will not cross origins. This is the single most common bug.

**Silent refresh interceptor:** any API call returns 401 → call `POST /api/auth/refresh` **once** → on success replay the original request; on failure clear `AuthContext` and redirect to `/login`.

**Conditional UI is UX, not security** — hide unavailable actions, but every restriction is independently enforced by the middleware in §11.

## 17. API reference — all endpoints

Complete request/response reference for **all 110 endpoints**. Every response is wrapped in the [§5 envelope](#5-response-envelope) `{ success, message, data }` — the tables below show the **`data`** object only. Auth is the [§6 cookie](#6-where-the-tokens-live) session; **Access** names the required role and *(scoped)* means Employee → own, Dept Head → dept, Admin/AM → all. Path params use `:id`; list values like `uuid` / `ISO` denote types, not literals. Arrays show one representative element.

### 17.1 Auth (`/api/auth`)

Login/Signup set HttpOnly `at` (15 min) + `rt` (7 day) cookies; every other call reads them automatically.

| Method | Path | Access |
|---|---|---|
| `POST` | `/signup` | Public |
| `POST` | `/login` | Public |
| `POST` | `/refresh` | Public (rt cookie) |
| `POST` | `/logout` | Public |
| `GET` | `/me` | Authenticated |
| `POST` | `/forgot-password` | Public |
| `POST` | `/reset-password` | Public |
| `POST` | `/change-password` | Authenticated |

<details><summary><code>POST /api/auth/signup</code> — Register (always EMPLOYEE) and log in.</summary>

**Access:** Public

**Request body**

```json
{
  "name": "Jane Doe",
  "email": "jane@gmail.com",
  "password": "Str0ng!Pass"
}
```

**Response `201` — `data`:**

```json
{
  "user": {
    "id": "uuid",
    "name": "Jane Doe",
    "email": "jane@gmail.com",
    "role": "EMPLOYEE",
    "departmentId": "uuid|null",
    "status": "ACTIVE"
  }
}
```

</details>

<details><summary><code>POST /api/auth/login</code> — Log in; sets auth cookies.</summary>

**Access:** Public

**Request body**

```json
{
  "email": "jane@gmail.com",
  "password": "Str0ng!Pass"
}
```

**Response `200` — `data`:**

```json
{
  "user": {
    "id": "uuid",
    "name": "Jane Doe",
    "email": "jane@gmail.com",
    "role": "EMPLOYEE",
    "departmentId": "uuid|null",
    "status": "ACTIVE"
  }
}
```

</details>

<details><summary><code>POST /api/auth/refresh</code> — Rotate refresh token, mint new access token.</summary>

**Access:** Public (rt cookie)

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "user": {
    "id": "uuid",
    "name": "Jane Doe",
    "role": "EMPLOYEE",
    "departmentId": "uuid|null"
  }
}
```

</details>

<details><summary><code>POST /api/auth/logout</code> — Revoke rt and clear cookies.</summary>

**Access:** Public

**Request:** no body.

**Response `200` — `data`:**

_No `data` payload (envelope `message` only)._

</details>

<details><summary><code>GET /api/auth/me</code> — Current user, role/department read fresh from DB.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "user": {
    "id": "uuid",
    "name": "Jane Doe",
    "email": "jane@gmail.com",
    "role": "EMPLOYEE",
    "departmentId": "uuid|null",
    "status": "ACTIVE",
    "department": {
      "id": "uuid",
      "name": "Engineering"
    }
  }
}
```

</details>

<details><summary><code>POST /api/auth/forgot-password</code> — Email a 6-digit OTP (generic 200, rate-limited 1/60s).</summary>

**Access:** Public

**Request body**

```json
{
  "email": "jane@gmail.com"
}
```

**Response `200` — `data`:**

_No `data` payload (envelope `message` only)._

</details>

<details><summary><code>POST /api/auth/reset-password</code> — Consume OTP + set new password (revokes all sessions).</summary>

**Access:** Public

**Request body**

```json
{
  "email": "jane@gmail.com",
  "otp": "123456",
  "newPassword": "N3w!Password"
}
```

**Response `200` — `data`:**

_No `data` payload (envelope `message` only)._

</details>

<details><summary><code>POST /api/auth/change-password</code> — Change password; other sessions revoked.</summary>

**Access:** Authenticated

**Request body**

```json
{
  "currentPassword": "Str0ng!Pass",
  "newPassword": "N3w!Password"
}
```

**Response `200` — `data`:**

_No `data` payload (envelope `message` only)._

</details>

### 17.2 Users (`/api/users`)

`PATCH /me/profile` is self-service; everything else is **Admin only**.

| Method | Path | Access |
|---|---|---|
| `PATCH` | `/me/profile` | Authenticated |
| `GET` | `/` | Admin |
| `GET` | `/:id/assets` | Admin |
| `GET` | `/:id/activity` | Admin |
| `PATCH` | `/:id/role` | Admin |
| `PATCH` | `/:id/department` | Admin |
| `PATCH` | `/:id/status` | Admin |

<details><summary><code>PATCH /api/users/me/profile</code> — Update own name / designation (never role).</summary>

**Access:** Authenticated

**Request body**

```json
{
  "name": "Jane D.",
  "designation": "Senior Analyst"
}
```

**Response `200` — `data`:**

```json
{
  "user": {
    "id": "uuid",
    "name": "Jane D.",
    "designation": "Senior Analyst"
  }
}
```

</details>

<details><summary><code>GET /api/users/</code> — Paginated directory.</summary>

**Access:** Admin

**Query params**

| Param | Required | Notes |
|---|---|---|
| `page` | no | default 1 |
| `limit` | no | default 20, max 100 |
| `q` | no | search name/email |
| `role` | no | ADMIN|ASSET_MANAGER|DEPT_HEAD|EMPLOYEE |
| `departmentId` | no | filter |
| `status` | no | ACTIVE|INACTIVE |

**Response `200` — `data`:**

```json
{
  "users": [
    {
      "id": "uuid",
      "name": "Jane Doe",
      "email": "jane@gmail.com",
      "role": "EMPLOYEE",
      "department": {
        "id": "uuid",
        "name": "Engineering"
      },
      "status": "ACTIVE",
      "createdAt": "ISO"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

</details>

<details><summary><code>GET /api/users/:id/assets</code> — Assets currently held by a user.</summary>

**Access:** Admin

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "assets": [
    {
      "id": "uuid",
      "tag": "AF-0001",
      "name": "Laptop",
      "status": "ALLOCATED",
      "allocatedAt": "ISO",
      "expectedReturnDate": "ISO|null"
    }
  ]
}
```

</details>

<details><summary><code>GET /api/users/:id/activity</code> — Recent activity by a user.</summary>

**Access:** Admin

**Query params**

| Param | Required | Notes |
|---|---|---|
| `limit` | no | default 5, max 20 |

**Response `200` — `data`:**

```json
{
  "activities": [
    {
      "id": "uuid",
      "actionType": "ALLOCATION",
      "entityType": "ASSET",
      "description": "\u2026",
      "createdAt": "ISO"
    }
  ]
}
```

</details>

<details><summary><code>PATCH /api/users/:id/role</code> — Promote/demote (ADMIN never accepted).</summary>

**Access:** Admin

**Request body**

```json
{
  "role": "ASSET_MANAGER"
}
```

**Response `200` — `data`:**

```json
{
  "user": {
    "id": "uuid",
    "name": "Jane Doe",
    "role": "ASSET_MANAGER",
    "departmentId": "uuid|null"
  }
}
```

</details>

<details><summary><code>PATCH /api/users/:id/department</code> — Assign/unassign department.</summary>

**Access:** Admin

**Request body**

```json
{
  "departmentId": "uuid|null"
}
```

**Response `200` — `data`:**

```json
{
  "user": {
    "id": "uuid",
    "departmentId": "uuid|null",
    "department": {
      "id": "uuid",
      "name": "Engineering"
    }
  }
}
```

</details>

<details><summary><code>PATCH /api/users/:id/status</code> — Activate/deactivate (deactivate revokes tokens).</summary>

**Access:** Admin

**Request body**

```json
{
  "status": "INACTIVE"
}
```

**Response `200` — `data`:**

```json
{
  "user": {
    "id": "uuid",
    "status": "INACTIVE"
  }
}
```

</details>

### 17.3 Departments (`/api/departments`)

Reads: any authenticated user. Writes: **Admin only**.

| Method | Path | Access |
|---|---|---|
| `GET` | `/` | Authenticated |
| `GET` | `/:id` | Authenticated |
| `GET` | `/:id/employees` | Authenticated |
| `GET` | `/:id/assets` | Authenticated |
| `POST` | `/` | Admin |
| `PATCH` | `/:id` | Admin |
| `DELETE` | `/:id` | Admin |

<details><summary><code>GET /api/departments/</code> — List all with counts.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "departments": [
    {
      "id": "uuid",
      "name": "Engineering",
      "head": {
        "id": "uuid",
        "name": "Head"
      },
      "parentId": "uuid|null",
      "status": "ACTIVE",
      "employeeCount": 12,
      "assetCount": 34
    }
  ]
}
```

</details>

<details><summary><code>GET /api/departments/:id</code> — Single department.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "department": {
    "id": "uuid",
    "name": "Engineering",
    "head": {
      "id": "uuid",
      "name": "Head"
    },
    "parentId": "uuid|null",
    "status": "ACTIVE",
    "employeeCount": 12,
    "assetCount": 34
  }
}
```

</details>

<details><summary><code>GET /api/departments/:id/employees</code> — Members.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "employees": [
    {
      "id": "uuid",
      "name": "Jane",
      "email": "jane@x.com",
      "role": "EMPLOYEE",
      "status": "ACTIVE",
      "createdAt": "ISO"
    }
  ]
}
```

</details>

<details><summary><code>GET /api/departments/:id/assets</code> — Assets owned by dept.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "assets": [
    {
      "id": "uuid",
      "tag": "AF-0001",
      "name": "Laptop",
      "status": "AVAILABLE",
      "condition": "GOOD",
      "location": "HQ",
      "category": "Electronics"
    }
  ]
}
```

</details>

<details><summary><code>POST /api/departments/</code> — Create department.</summary>

**Access:** Admin

**Request body**

```json
{
  "name": "Engineering",
  "headId": "uuid|null",
  "parentId": "uuid|null"
}
```

**Response `201` — `data`:**

```json
{
  "department": {
    "id": "uuid",
    "name": "Engineering",
    "head": {
      "id": "uuid",
      "name": "Head"
    },
    "parentId": "uuid|null",
    "status": "ACTIVE",
    "employeeCount": 12,
    "assetCount": 34
  }
}
```

</details>

<details><summary><code>PATCH /api/departments/:id</code> — Partial update.</summary>

**Access:** Admin

**Request body**

```json
{
  "name": "R&D",
  "headId": "uuid|null",
  "parentId": "uuid|null",
  "status": "ACTIVE"
}
```

**Response `200` — `data`:**

```json
{
  "department": {
    "id": "uuid",
    "name": "Engineering",
    "head": {
      "id": "uuid",
      "name": "Head"
    },
    "parentId": "uuid|null",
    "status": "ACTIVE",
    "employeeCount": 12,
    "assetCount": 34
  }
}
```

</details>

<details><summary><code>DELETE /api/departments/:id</code> — Delete (users' dept → null; 409 if it has children).</summary>

**Access:** Admin

**Request:** no body.

**Response `200` — `data`:**

_No `data` payload (envelope `message` only)._

</details>

### 17.4 Categories (`/api/categories`)

Reads: any authenticated user. Writes: **Admin only**.

| Method | Path | Access |
|---|---|---|
| `GET` | `/` | Authenticated |
| `GET` | `/tree` | Authenticated |
| `GET` | `/:id` | Authenticated |
| `POST` | `/:id/custom-fields` | Admin |
| `DELETE` | `/:id/custom-fields/:fieldId` | Admin |
| `POST` | `/` | Admin |
| `PATCH` | `/:id` | Admin |
| `DELETE` | `/:id` | Admin |

<details><summary><code>GET /api/categories/</code> — Flat list.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "categories": [
    {
      "id": "uuid",
      "name": "Laptops",
      "customFields": [
        {
          "id": "uuid",
          "label": "\u2026",
          "key": "\u2026",
          "type": "text",
          "required": false
        }
      ],
      "status": "ACTIVE",
      "parentId": "uuid|null",
      "icon": "laptop",
      "assetCount": 8
    }
  ]
}
```

</details>

<details><summary><code>GET /api/categories/tree</code> — Hierarchical view.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "tree": [
    {
      "id": "uuid",
      "name": "Laptops",
      "customFields": [
        {
          "id": "uuid",
          "label": "\u2026",
          "key": "\u2026",
          "type": "text",
          "required": false
        }
      ],
      "status": "ACTIVE",
      "parentId": "uuid|null",
      "icon": "laptop",
      "assetCount": 8,
      "children": []
    }
  ]
}
```

</details>

<details><summary><code>GET /api/categories/:id</code> — Single category.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "category": {
    "id": "uuid",
    "name": "Laptops",
    "customFields": [
      {
        "id": "uuid",
        "label": "\u2026",
        "key": "\u2026",
        "type": "text",
        "required": false
      }
    ],
    "status": "ACTIVE",
    "parentId": "uuid|null",
    "icon": "laptop",
    "assetCount": 8
  }
}
```

</details>

<details><summary><code>POST /api/categories/:id/custom-fields</code> — Append a custom field (type: text|number|date|select).</summary>

**Access:** Admin

**Request body**

```json
{
  "label": "Warranty Expiry",
  "key": "warrantyExpiry",
  "type": "date",
  "required": false,
  "options": []
}
```

**Response `201` — `data`:**

```json
{
  "field": {
    "id": "uuid",
    "label": "Warranty Expiry",
    "key": "warrantyExpiry",
    "type": "date",
    "required": false
  }
}
```

</details>

<details><summary><code>DELETE /api/categories/:id/custom-fields/:fieldId</code> — Remove a custom field.</summary>

**Access:** Admin

**Request:** no body.

**Response `200` — `data`:**

_No `data` payload (envelope `message` only)._

</details>

<details><summary><code>POST /api/categories/</code> — Create category.</summary>

**Access:** Admin

**Request body**

```json
{
  "name": "Laptops",
  "customFields": [],
  "parentId": "uuid|null",
  "icon": "laptop"
}
```

**Response `201` — `data`:**

```json
{
  "category": {
    "id": "uuid",
    "name": "Laptops",
    "customFields": [
      {
        "id": "uuid",
        "label": "\u2026",
        "key": "\u2026",
        "type": "text",
        "required": false
      }
    ],
    "status": "ACTIVE",
    "parentId": "uuid|null",
    "icon": "laptop",
    "assetCount": 8
  }
}
```

</details>

<details><summary><code>PATCH /api/categories/:id</code> — Partial update.</summary>

**Access:** Admin

**Request body**

```json
{
  "name": "Ultrabooks",
  "customFields": [],
  "status": "ACTIVE",
  "parentId": "uuid|null",
  "icon": "laptop"
}
```

**Response `200` — `data`:**

```json
{
  "category": {
    "id": "uuid",
    "name": "Laptops",
    "customFields": [
      {
        "id": "uuid",
        "label": "\u2026",
        "key": "\u2026",
        "type": "text",
        "required": false
      }
    ],
    "status": "ACTIVE",
    "parentId": "uuid|null",
    "icon": "laptop",
    "assetCount": 8
  }
}
```

</details>

<details><summary><code>DELETE /api/categories/:id</code> — Delete category.</summary>

**Access:** Admin

**Request:** no body.

**Response `200` — `data`:**

_No `data` payload (envelope `message` only)._

</details>

### 17.5 Assets (`/api/assets`)

List/detail **scoped**. Writes: **Admin / Asset Manager**.

| Method | Path | Access |
|---|---|---|
| `GET` | `/` | Authenticated (scoped) |
| `GET` | `/search` | Authenticated (scoped) |
| `POST` | `/bulk-delete` | Admin |
| `POST` | `/` | Admin / Asset Manager |
| `GET` | `/:id` | Authenticated (scoped) |
| `PATCH` | `/:id` | Admin / Asset Manager |
| `GET` | `/:id/history` | Authenticated |
| `POST` | `/:id/documents` | Admin / Asset Manager |
| `GET` | `/:id/qr` | Authenticated |
| `POST` | `/:id/retire` | Admin / Asset Manager |
| `POST` | `/:id/dispose` | Admin / Asset Manager |
| `POST` | `/:id/mark-lost` | Admin / Asset Manager |

<details><summary><code>GET /api/assets/</code> — Paginated list.</summary>

**Access:** Authenticated (scoped)

**Query params**

| Param | Required | Notes |
|---|---|---|
| `page` | no | default 1 |
| `limit` | no | default 20, max 100 |
| `q` | no | search name/tag/serial |
| `categoryId` | no |  |
| `departmentId` | no |  |
| `status` | no | AVAILABLE|ALLOCATED|UNDER_MAINTENANCE|RETIRED|DISPOSED|LOST |

**Response `200` — `data`:**

```json
{
  "assets": [
    {
      "id": "uuid",
      "tag": "AF-0001",
      "name": "Dell Latitude",
      "serialNo": "SN-123",
      "category": {
        "id": "uuid",
        "name": "Electronics"
      },
      "department": {
        "id": "uuid",
        "name": "Engineering"
      },
      "status": "AVAILABLE",
      "condition": "GOOD",
      "location": "HQ / Floor 2",
      "roomId": "uuid|null",
      "isBookable": false,
      "purchaseDate": "2026-01-15",
      "purchaseCost": 1499.0,
      "customValues": {},
      "retirement": null,
      "disposal": null,
      "currentHolder": {
        "id": "uuid",
        "name": "Jane"
      },
      "createdAt": "ISO"
    }
  ],
  "total": 120,
  "page": 1,
  "limit": 20
}
```

</details>

<details><summary><code>GET /api/assets/search</code> — Quick lookup (max 20).</summary>

**Access:** Authenticated (scoped)

**Query params**

| Param | Required | Notes |
|---|---|---|
| `q` | yes | search term |

**Response `200` — `data`:**

```json
{
  "assets": [
    {
      "id": "uuid",
      "tag": "AF-0001",
      "name": "Dell Latitude",
      "serialNo": "SN-123",
      "category": {
        "id": "uuid",
        "name": "Electronics"
      },
      "department": {
        "id": "uuid",
        "name": "Engineering"
      },
      "status": "AVAILABLE",
      "condition": "GOOD",
      "location": "HQ / Floor 2",
      "roomId": "uuid|null",
      "isBookable": false,
      "purchaseDate": "2026-01-15",
      "purchaseCost": 1499.0,
      "customValues": {},
      "retirement": null,
      "disposal": null,
      "currentHolder": {
        "id": "uuid",
        "name": "Jane"
      },
      "createdAt": "ISO"
    }
  ]
}
```

</details>

<details><summary><code>POST /api/assets/bulk-delete</code> — Delete many.</summary>

**Access:** Admin

**Request body**

```json
{
  "ids": [
    "uuid",
    "uuid"
  ]
}
```

**Response `200` — `data`:**

```json
{
  "deletedCount": 2
}
```

</details>

<details><summary><code>POST /api/assets/</code> — Register (tag auto-generates if empty).</summary>

**Access:** Admin / Asset Manager

**Request body**

```json
{
  "tag": "",
  "name": "Dell Latitude 7440",
  "serialNo": "SN-123",
  "categoryId": "uuid",
  "departmentId": "uuid",
  "condition": "GOOD",
  "location": "HQ / Floor 2",
  "roomId": "uuid|null",
  "isBookable": false,
  "purchaseDate": "2026-01-15",
  "purchaseCost": 1499.0,
  "customValues": {}
}
```

**Response `201` — `data`:**

```json
{
  "asset": {
    "id": "uuid",
    "tag": "AF-0001",
    "name": "Dell Latitude",
    "serialNo": "SN-123",
    "category": {
      "id": "uuid",
      "name": "Electronics"
    },
    "department": {
      "id": "uuid",
      "name": "Engineering"
    },
    "status": "AVAILABLE",
    "condition": "GOOD",
    "location": "HQ / Floor 2",
    "roomId": "uuid|null",
    "isBookable": false,
    "purchaseDate": "2026-01-15",
    "purchaseCost": 1499.0,
    "customValues": {},
    "retirement": null,
    "disposal": null,
    "currentHolder": {
      "id": "uuid",
      "name": "Jane"
    },
    "createdAt": "ISO"
  }
}
```

</details>

<details><summary><code>GET /api/assets/:id</code> — Full detail incl. documents (403 outside scope).</summary>

**Access:** Authenticated (scoped)

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "asset": {
    "id": "uuid",
    "tag": "AF-0001",
    "name": "Dell Latitude",
    "serialNo": "SN-123",
    "category": {
      "id": "uuid",
      "name": "Electronics"
    },
    "department": {
      "id": "uuid",
      "name": "Engineering"
    },
    "status": "AVAILABLE",
    "condition": "GOOD",
    "location": "HQ / Floor 2",
    "roomId": "uuid|null",
    "isBookable": false,
    "purchaseDate": "2026-01-15",
    "purchaseCost": 1499.0,
    "customValues": {},
    "retirement": null,
    "disposal": null,
    "currentHolder": {
      "id": "uuid",
      "name": "Jane"
    },
    "createdAt": "ISO",
    "documents": [
      {
        "id": "uuid",
        "url": "https://\u2026",
        "filename": "invoice.pdf",
        "mime": "application/pdf",
        "bytes": 20480,
        "created_at": "ISO"
      }
    ]
  }
}
```

</details>

<details><summary><code>PATCH /api/assets/:id</code> — Partial update.</summary>

**Access:** Admin / Asset Manager

**Request body**

```json
{
  "name": "\u2026",
  "serialNo": "\u2026",
  "categoryId": "uuid",
  "departmentId": "uuid",
  "condition": "FAIR",
  "location": "\u2026",
  "roomId": "uuid|null",
  "isBookable": true,
  "purchaseDate": "2026-01-15",
  "purchaseCost": 1499.0,
  "customValues": {},
  "status": "AVAILABLE"
}
```

**Response `200` — `data`:**

```json
{
  "asset": {
    "id": "uuid",
    "tag": "AF-0001",
    "name": "Dell Latitude",
    "serialNo": "SN-123",
    "category": {
      "id": "uuid",
      "name": "Electronics"
    },
    "department": {
      "id": "uuid",
      "name": "Engineering"
    },
    "status": "AVAILABLE",
    "condition": "GOOD",
    "location": "HQ / Floor 2",
    "roomId": "uuid|null",
    "isBookable": false,
    "purchaseDate": "2026-01-15",
    "purchaseCost": 1499.0,
    "customValues": {},
    "retirement": null,
    "disposal": null,
    "currentHolder": {
      "id": "uuid",
      "name": "Jane"
    },
    "createdAt": "ISO"
  }
}
```

</details>

<details><summary><code>GET /api/assets/:id/history</code> — Allocation + maintenance timeline.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "allocationHistory": [
    {
      "id": "uuid",
      "date": "ISO",
      "event": "Allocated to Jane",
      "status": "RETURNED",
      "expectedReturnDate": "ISO|null",
      "returnedAt": "ISO|null",
      "conditionOnReturn": "GOOD|null"
    }
  ],
  "maintenanceHistory": [
    {
      "id": "uuid",
      "date": "ISO",
      "event": "Screen flicker",
      "status": "RESOLVED",
      "priority": "HIGH",
      "resolvedAt": "ISO|null",
      "resolutionNotes": "\u2026|null"
    }
  ]
}
```

</details>

<details><summary><code>POST /api/assets/:id/documents</code> — multipart/form-data, field `file` (max 10 MB) → Cloudinary.</summary>

**Access:** Admin / Asset Manager

**Request:** `multipart/form-data` — field `file` — the document. Accepts **PNG, JPEG, or PDF only** (max 10 MB); any other type → `400 Only PNG, JPEG or PDF files are allowed`. Images are stored **compressed** (`quality: auto:good`, capped at 2000px) via Cloudinary; PDFs are stored as-is (`raw`) with their `.pdf` extension preserved.

**Response `201` — `data`:**

```json
{
  "document": {
    "id": "uuid",
    "url": "https://\u2026",
    "filename": "invoice.pdf",
    "mime": "application/pdf",
    "bytes": 20480,
    "created_at": "ISO"
  }
}
```

</details>

<details><summary><code>GET /api/assets/:id/qr</code> — QR PNG data-URL encoding the tag.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "tag": "AF-0001",
  "qrUrl": "data:image/png;base64,\u2026"
}
```

</details>

<details><summary><code>POST /api/assets/:id/retire</code> — Requires AVAILABLE.</summary>

**Access:** Admin / Asset Manager

**Request body**

```json
{
  "reason": "End of life",
  "retirementDate": "2026-07-12"
}
```

**Response `200` — `data`:**

```json
{
  "asset": {
    "id": "uuid",
    "tag": "AF-0001",
    "status": "RETIRED"
  }
}
```

</details>

<details><summary><code>POST /api/assets/:id/dispose</code> — Requires RETIRED.</summary>

**Access:** Admin / Asset Manager

**Request body**

```json
{
  "method": "Recycled",
  "notes": "\u2026",
  "disposalDate": "2026-07-12"
}
```

**Response `200` — `data`:**

```json
{
  "asset": {
    "id": "uuid",
    "tag": "AF-0001",
    "status": "DISPOSED"
  }
}
```

</details>

<details><summary><code>POST /api/assets/:id/mark-lost</code> — Flag LOST.</summary>

**Access:** Admin / Asset Manager

**Request body**

```json
{}
```

**Response `200` — `data`:**

```json
{
  "asset": {
    "id": "uuid",
    "tag": "AF-0001",
    "status": "LOST"
  }
}
```

</details>

### 17.6 Locations (`/api/locations`)

Buildings → Floors → Rooms cascade.

| Method | Path | Access |
|---|---|---|
| `GET` | `/` | Authenticated |

<details><summary><code>GET /api/locations/</code> — Nested tree.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "locations": [
    {
      "id": "uuid",
      "building": "HQ",
      "city": "Ahmedabad",
      "floors": [
        {
          "id": "uuid",
          "name": "Floor 2",
          "rooms": [
            {
              "id": "uuid",
              "name": "Room B2"
            }
          ]
        }
      ]
    }
  ]
}
```

</details>

### 17.7 Allocations (`/api/allocations`)

List scoped by holder. Create / return-approve: **Admin/AM**. Approve: **Admin/AM/Dept Head**. Return: the holder.

| Method | Path | Access |
|---|---|---|
| `GET` | `/` | Authenticated (scoped) |
| `GET` | `/kanban` | Authenticated (scoped) |
| `GET` | `/overdue` | Authenticated (scoped) |
| `GET` | `/:id` | Authenticated (scoped) |
| `POST` | `/` | Admin / Asset Manager |
| `POST` | `/:id/approve` | Admin / AM / Dept Head |
| `POST` | `/:id/return` | Holder only |
| `POST` | `/:id/return/approve` | Admin / Asset Manager |

<details><summary><code>GET /api/allocations/</code> — List (max 200).</summary>

**Access:** Authenticated (scoped)

**Query params**

| Param | Required | Notes |
|---|---|---|
| `assetId` | no |  |
| `employeeId` | no |  |
| `departmentId` | no |  |
| `status` | no | PENDING|ACTIVE|RETURN_REQUESTED|RETURNED|REJECTED |

**Response `200` — `data`:**

```json
{
  "allocations": [
    {
      "id": "uuid",
      "status": "ACTIVE",
      "purpose": "Onboarding kit",
      "asset": {
        "id": "uuid",
        "tag": "AF-0001",
        "name": "Laptop"
      },
      "holder": {
        "id": "uuid",
        "name": "Jane"
      },
      "allocatedBy": "Manager",
      "allocatedAt": "ISO",
      "expectedReturnDate": "ISO|null",
      "returnRequestedAt": "ISO|null",
      "conditionOnReturn": "null",
      "returnNotes": "null",
      "returnedAt": "null",
      "isOverdue": false
    }
  ]
}
```

</details>

<details><summary><code>GET /api/allocations/kanban</code> — Grouped by column.</summary>

**Access:** Authenticated (scoped)

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "columns": {
    "PENDING": {
      "count": 1,
      "items": [
        {
          "id": "uuid",
          "status": "ACTIVE",
          "purpose": "Onboarding kit",
          "asset": {
            "id": "uuid",
            "tag": "AF-0001",
            "name": "Laptop"
          },
          "holder": {
            "id": "uuid",
            "name": "Jane"
          },
          "allocatedBy": "Manager",
          "allocatedAt": "ISO",
          "expectedReturnDate": "ISO|null",
          "returnRequestedAt": "ISO|null",
          "conditionOnReturn": "null",
          "returnNotes": "null",
          "returnedAt": "null",
          "isOverdue": false
        }
      ]
    },
    "ACTIVE": {
      "count": 0,
      "items": []
    },
    "RETURN_REQUESTED": {
      "count": 0,
      "items": []
    },
    "OVERDUE": {
      "count": 0,
      "items": []
    }
  }
}
```

</details>

<details><summary><code>GET /api/allocations/overdue</code> — Past due, with daysOverdue.</summary>

**Access:** Authenticated (scoped)

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "overdue": [
    {
      "id": "uuid",
      "status": "ACTIVE",
      "purpose": "Onboarding kit",
      "asset": {
        "id": "uuid",
        "tag": "AF-0001",
        "name": "Laptop"
      },
      "holder": {
        "id": "uuid",
        "name": "Jane"
      },
      "allocatedBy": "Manager",
      "allocatedAt": "ISO",
      "expectedReturnDate": "ISO|null",
      "returnRequestedAt": "ISO|null",
      "conditionOnReturn": "null",
      "returnNotes": "null",
      "returnedAt": "null",
      "isOverdue": false,
      "daysOverdue": 3
    }
  ]
}
```

</details>

<details><summary><code>GET /api/allocations/:id</code> — Single allocation.</summary>

**Access:** Authenticated (scoped)

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "allocation": {
    "id": "uuid",
    "status": "ACTIVE",
    "purpose": "Onboarding kit",
    "asset": {
      "id": "uuid",
      "tag": "AF-0001",
      "name": "Laptop"
    },
    "holder": {
      "id": "uuid",
      "name": "Jane"
    },
    "allocatedBy": "Manager",
    "allocatedAt": "ISO",
    "expectedReturnDate": "ISO|null",
    "returnRequestedAt": "ISO|null",
    "conditionOnReturn": "null",
    "returnNotes": "null",
    "returnedAt": "null",
    "isOverdue": false
  }
}
```

</details>

<details><summary><code>POST /api/allocations/</code> — Allocate an AVAILABLE asset to an ACTIVE user.</summary>

**Access:** Admin / Asset Manager

**Request body**

```json
{
  "assetId": "uuid",
  "employeeId": "uuid",
  "purpose": "Onboarding kit",
  "expectedReturnDate": "2026-12-31"
}
```

**Response `201` — `data`:**

```json
{
  "allocation": {
    "id": "uuid",
    "status": "ACTIVE",
    "purpose": "Onboarding kit",
    "asset": {
      "id": "uuid",
      "tag": "AF-0001",
      "name": "Laptop"
    },
    "holder": {
      "id": "uuid",
      "name": "Jane"
    },
    "allocatedBy": "Manager",
    "allocatedAt": "ISO",
    "expectedReturnDate": "ISO|null",
    "returnRequestedAt": "ISO|null",
    "conditionOnReturn": "null",
    "returnNotes": "null",
    "returnedAt": "null",
    "isOverdue": false
  }
}
```

</details>

<details><summary><code>POST /api/allocations/:id/approve</code> — PENDING → ACTIVE.</summary>

**Access:** Admin / AM / Dept Head

**Request body**

```json
{}
```

**Response `200` — `data`:**

```json
{
  "allocation": {
    "id": "uuid",
    "status": "ACTIVE"
  }
}
```

</details>

<details><summary><code>POST /api/allocations/:id/return</code> — Initiate return with condition.</summary>

**Access:** Holder only

**Request body**

```json
{
  "condition": "GOOD",
  "notes": "\u2026"
}
```

**Response `200` — `data`:**

```json
{
  "allocation": {
    "id": "uuid",
    "status": "RETURN_REQUESTED"
  }
}
```

</details>

<details><summary><code>POST /api/allocations/:id/return/approve</code> — Confirm check-in; asset → AVAILABLE.</summary>

**Access:** Admin / Asset Manager

**Request body**

```json
{}
```

**Response `200` — `data`:**

```json
{
  "allocation": {
    "id": "uuid",
    "status": "RETURNED"
  }
}
```

</details>

### 17.8 Transfers (`/api/transfers`)

Anyone requests; **Admin/AM/Dept Head** decide. Scoped list.

| Method | Path | Access |
|---|---|---|
| `GET` | `/` | Authenticated (scoped) |
| `GET` | `/:id` | Authenticated (scoped) |
| `POST` | `/` | Authenticated |
| `POST` | `/:id/approve` | Admin / AM / Dept Head |
| `POST` | `/:id/reject` | Admin / AM / Dept Head |

<details><summary><code>GET /api/transfers/</code> — List (max 200).</summary>

**Access:** Authenticated (scoped)

**Query params**

| Param | Required | Notes |
|---|---|---|
| `status` | no | REQUESTED|APPROVED|REJECTED |

**Response `200` — `data`:**

```json
{
  "transfers": [
    {
      "id": "uuid",
      "status": "REQUESTED",
      "reason": "\u2026",
      "decisionReason": "null",
      "asset": {
        "id": "uuid",
        "tag": "AF-0001",
        "name": "Laptop"
      },
      "from": {
        "id": "uuid",
        "name": "Jane"
      },
      "to": {
        "id": "uuid",
        "name": "Arjun"
      },
      "decidedBy": "null",
      "createdAt": "ISO",
      "decidedAt": "null"
    }
  ]
}
```

</details>

<details><summary><code>GET /api/transfers/:id</code> — Single transfer.</summary>

**Access:** Authenticated (scoped)

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "transfer": {
    "id": "uuid",
    "status": "REQUESTED",
    "reason": "\u2026",
    "decisionReason": "null",
    "asset": {
      "id": "uuid",
      "tag": "AF-0001",
      "name": "Laptop"
    },
    "from": {
      "id": "uuid",
      "name": "Jane"
    },
    "to": {
      "id": "uuid",
      "name": "Arjun"
    },
    "decidedBy": "null",
    "createdAt": "ISO",
    "decidedAt": "null"
  }
}
```

</details>

<details><summary><code>POST /api/transfers/</code> — Request transfer of an ALLOCATED asset.</summary>

**Access:** Authenticated

**Request body**

```json
{
  "assetId": "uuid",
  "toUserId": "uuid",
  "reason": "\u2026"
}
```

**Response `201` — `data`:**

```json
{
  "transfer": {
    "id": "uuid",
    "status": "REQUESTED",
    "reason": "\u2026",
    "decisionReason": "null",
    "asset": {
      "id": "uuid",
      "tag": "AF-0001",
      "name": "Laptop"
    },
    "from": {
      "id": "uuid",
      "name": "Jane"
    },
    "to": {
      "id": "uuid",
      "name": "Arjun"
    },
    "decidedBy": "null",
    "createdAt": "ISO",
    "decidedAt": "null"
  }
}
```

</details>

<details><summary><code>POST /api/transfers/:id/approve</code> — Move allocation to target.</summary>

**Access:** Admin / AM / Dept Head

**Request body**

```json
{}
```

**Response `200` — `data`:**

```json
{
  "transfer": {
    "id": "uuid",
    "status": "APPROVED"
  }
}
```

</details>

<details><summary><code>POST /api/transfers/:id/reject</code> — Reject with reason.</summary>

**Access:** Admin / AM / Dept Head

**Request body**

```json
{
  "reason": "\u2026"
}
```

**Response `200` — `data`:**

```json
{
  "transfer": {
    "id": "uuid",
    "status": "REJECTED"
  }
}
```

</details>

### 17.9 Resources (bookable) (`/api/resources`)

Bookable assets and their calendars.

| Method | Path | Access |
|---|---|---|
| `GET` | `/` | Authenticated |
| `GET` | `/:id/calendar` | Authenticated |
| `GET` | `/:id/availability` | Authenticated |

<details><summary><code>GET /api/resources/</code> — Bookable, in-service assets.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "resources": [
    {
      "id": "uuid",
      "tag": "AF-0100",
      "name": "Room B2",
      "location": "HQ",
      "status": "AVAILABLE"
    }
  ]
}
```

</details>

<details><summary><code>GET /api/resources/:id/calendar</code> — Confirmed bookings in a window (default next 7 days).</summary>

**Access:** Authenticated

**Query params**

| Param | Required | Notes |
|---|---|---|
| `from` | no | ISO |
| `to` | no | ISO |

**Response `200` — `data`:**

```json
{
  "bookings": [
    {
      "id": "uuid",
      "resource": {
        "id": "uuid",
        "tag": "AF-0100",
        "name": "Room B2"
      },
      "bookedBy": {
        "id": "uuid",
        "name": "Jane"
      },
      "start": "ISO",
      "end": "ISO",
      "purpose": "Sprint planning",
      "attendees": [],
      "seriesId": "uuid|null",
      "status": "UPCOMING",
      "createdAt": "ISO"
    }
  ]
}
```

</details>

<details><summary><code>GET /api/resources/:id/availability</code> — Hourly 09:00–18:00 slot grid.</summary>

**Access:** Authenticated

**Query params**

| Param | Required | Notes |
|---|---|---|
| `date` | yes | YYYY-MM-DD |

**Response `200` — `data`:**

```json
{
  "date": "2026-07-14",
  "slots": [
    {
      "start": "09:00",
      "end": "10:00",
      "available": true
    }
  ]
}
```

</details>

### 17.10 Bookings (`/api/bookings`)

Conflict-checked. Time input: `{start,end}` ISO **or** `{date,startTime,endTime}`. Manage = owner, booker's Dept Head, or Admin/AM.

| Method | Path | Access |
|---|---|---|
| `GET` | `/` | Authenticated (scoped) |
| `GET` | `/my` | Authenticated |
| `POST` | `/check-availability` | Authenticated |
| `POST` | `/` | Authenticated |
| `POST` | `/recurring` | Authenticated |
| `GET` | `/:id` | Manager of booking |
| `POST` | `/:id/cancel` | Manager of booking |
| `POST` | `/:id/reschedule` | Manager of booking |

<details><summary><code>GET /api/bookings/</code> — List (max 200); status derived.</summary>

**Access:** Authenticated (scoped)

**Query params**

| Param | Required | Notes |
|---|---|---|
| `resourceId` | no |  |
| `status` | no | UPCOMING|ONGOING|COMPLETED|CANCELLED |
| `date` | no | YYYY-MM-DD |

**Response `200` — `data`:**

```json
{
  "bookings": [
    {
      "id": "uuid",
      "resource": {
        "id": "uuid",
        "tag": "AF-0100",
        "name": "Room B2"
      },
      "bookedBy": {
        "id": "uuid",
        "name": "Jane"
      },
      "start": "ISO",
      "end": "ISO",
      "purpose": "Sprint planning",
      "attendees": [],
      "seriesId": "uuid|null",
      "status": "UPCOMING",
      "createdAt": "ISO"
    }
  ]
}
```

</details>

<details><summary><code>GET /api/bookings/my</code> — Caller's bookings.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "bookings": [
    {
      "id": "uuid",
      "resource": {
        "id": "uuid",
        "tag": "AF-0100",
        "name": "Room B2"
      },
      "bookedBy": {
        "id": "uuid",
        "name": "Jane"
      },
      "start": "ISO",
      "end": "ISO",
      "purpose": "Sprint planning",
      "attendees": [],
      "seriesId": "uuid|null",
      "status": "UPCOMING",
      "createdAt": "ISO"
    }
  ]
}
```

</details>

<details><summary><code>POST /api/bookings/check-availability</code> — Overlap check + alternatives.</summary>

**Access:** Authenticated

**Request body**

```json
{
  "resourceId": "uuid",
  "date": "2026-07-14",
  "startTime": "09:00",
  "endTime": "10:00"
}
```

**Response `200` — `data`:**

Available:
```json
{
  "available": true
}
```
Conflict:
```json
{
  "available": false,
  "conflict": {
    "bookedBy": "Jane",
    "start": "ISO",
    "end": "ISO"
  },
  "alternatives": [
    {
      "resourceId": "uuid",
      "resourceName": "Room A1"
    }
  ]
}
```

</details>

<details><summary><code>POST /api/bookings/</code> — Create (409 on conflict).</summary>

**Access:** Authenticated

**Request body**

```json
{
  "resourceId": "uuid",
  "start": "2026-07-14T09:00:00",
  "end": "2026-07-14T10:00:00",
  "purpose": "Sprint planning",
  "attendees": []
}
```

**Response `201` — `data`:**

```json
{
  "booking": {
    "id": "uuid",
    "resource": {
      "id": "uuid",
      "tag": "AF-0100",
      "name": "Room B2"
    },
    "bookedBy": {
      "id": "uuid",
      "name": "Jane"
    },
    "start": "ISO",
    "end": "ISO",
    "purpose": "Sprint planning",
    "attendees": [],
    "seriesId": "uuid|null",
    "status": "UPCOMING",
    "createdAt": "ISO"
  }
}
```

</details>

<details><summary><code>POST /api/bookings/recurring</code> — Daily/weekly series (cap 60; skips conflicts).</summary>

**Access:** Authenticated

**Request body**

```json
{
  "resourceId": "uuid",
  "frequency": "WEEKLY",
  "startDate": "2026-07-14",
  "endDate": "2026-08-14",
  "startTime": "09:00",
  "endTime": "10:00",
  "purpose": "Standup",
  "attendees": []
}
```

**Response `201` — `data`:**

```json
{
  "seriesId": "uuid",
  "bookingsCreated": 4,
  "conflicts": [
    "2026-07-28"
  ]
}
```

</details>

<details><summary><code>GET /api/bookings/:id</code> — Single booking.</summary>

**Access:** Manager of booking

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "booking": {
    "id": "uuid",
    "resource": {
      "id": "uuid",
      "tag": "AF-0100",
      "name": "Room B2"
    },
    "bookedBy": {
      "id": "uuid",
      "name": "Jane"
    },
    "start": "ISO",
    "end": "ISO",
    "purpose": "Sprint planning",
    "attendees": [],
    "seriesId": "uuid|null",
    "status": "UPCOMING",
    "createdAt": "ISO"
  }
}
```

</details>

<details><summary><code>POST /api/bookings/:id/cancel</code> — Cancel.</summary>

**Access:** Manager of booking

**Request body**

```json
{}
```

**Response `200` — `data`:**

```json
{
  "booking": {
    "id": "uuid",
    "status": "CANCELLED"
  }
}
```

</details>

<details><summary><code>POST /api/bookings/:id/reschedule</code> — Move (re-runs overlap check).</summary>

**Access:** Manager of booking

**Request body**

```json
{
  "start": "2026-07-14T11:00:00",
  "end": "2026-07-14T12:00:00"
}
```

**Response `200` — `data`:**

```json
{
  "booking": {
    "id": "uuid",
    "start": "ISO",
    "end": "ISO",
    "status": "UPCOMING"
  }
}
```

</details>

### 17.11 Maintenance (`/api/maintenance`)

Pipeline `PENDING → APPROVED → TECHNICIAN_ASSIGNED → IN_PROGRESS → RESOLVED` (+ REJECTED, ESCALATED). List scoped.

| Method | Path | Access |
|---|---|---|
| `GET` | `/` | Authenticated (scoped) |
| `GET` | `/:id` | Authenticated |
| `POST` | `/` | Authenticated |
| `POST` | `/:id/approve` | Admin / Asset Manager |
| `POST` | `/:id/reject` | Admin / Asset Manager |
| `POST` | `/:id/assign` | Admin / Asset Manager |
| `POST` | `/:id/start` | Assigned technician / Manager |
| `POST` | `/:id/resolve` | Technician / Manager |
| `POST` | `/:id/escalate` | Admin / Asset Manager |
| `GET` | `/:id/comments` | Authenticated |
| `POST` | `/:id/comments` | Authenticated |

<details><summary><code>GET /api/maintenance/</code> — List (max 200); employees also see assigned jobs.</summary>

**Access:** Authenticated (scoped)

**Query params**

| Param | Required | Notes |
|---|---|---|
| `status` | no | PENDING|APPROVED|REJECTED|TECHNICIAN_ASSIGNED|IN_PROGRESS|RESOLVED|ESCALATED |
| `priority` | no | LOW|MEDIUM|HIGH|CRITICAL |
| `assetId` | no |  |

**Response `200` — `data`:**

```json
{
  "requests": [
    {
      "id": "uuid",
      "issue": "Screen flicker",
      "issueType": "HARDWARE",
      "priority": "HIGH",
      "status": "PENDING",
      "asset": {
        "id": "uuid",
        "tag": "AF-0001",
        "name": "Laptop"
      },
      "raisedBy": {
        "id": "uuid",
        "name": "Jane"
      },
      "technician": null,
      "startedAt": "null",
      "resolvedAt": "null",
      "resolutionNotes": "null",
      "cost": null,
      "rejectedReason": "null",
      "escalated": null,
      "createdAt": "ISO"
    }
  ]
}
```

</details>

<details><summary><code>GET /api/maintenance/:id</code> — Detail + commentCount.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "request": {
    "id": "uuid",
    "issue": "Screen flicker",
    "issueType": "HARDWARE",
    "priority": "HIGH",
    "status": "PENDING",
    "asset": {
      "id": "uuid",
      "tag": "AF-0001",
      "name": "Laptop"
    },
    "raisedBy": {
      "id": "uuid",
      "name": "Jane"
    },
    "technician": null,
    "startedAt": "null",
    "resolvedAt": "null",
    "resolutionNotes": "null",
    "cost": null,
    "rejectedReason": "null",
    "escalated": null,
    "createdAt": "ISO",
    "commentCount": 3
  }
}
```

</details>

<details><summary><code>POST /api/maintenance/</code> — Raise request (priority defaults MEDIUM).</summary>

**Access:** Authenticated

**Request body**

```json
{
  "assetId": "uuid",
  "issue": "Screen flicker",
  "issueType": "HARDWARE",
  "priority": "HIGH"
}
```

**Response `201` — `data`:**

```json
{
  "request": {
    "id": "uuid",
    "issue": "Screen flicker",
    "issueType": "HARDWARE",
    "priority": "HIGH",
    "status": "PENDING",
    "asset": {
      "id": "uuid",
      "tag": "AF-0001",
      "name": "Laptop"
    },
    "raisedBy": {
      "id": "uuid",
      "name": "Jane"
    },
    "technician": null,
    "startedAt": "null",
    "resolvedAt": "null",
    "resolutionNotes": "null",
    "cost": null,
    "rejectedReason": "null",
    "escalated": null,
    "createdAt": "ISO"
  }
}
```

</details>

<details><summary><code>POST /api/maintenance/:id/approve</code> — PENDING → APPROVED; asset UNDER_MAINTENANCE.</summary>

**Access:** Admin / Asset Manager

**Request body**

```json
{}
```

**Response `200` — `data`:**

```json
{
  "request": {
    "id": "uuid",
    "status": "APPROVED"
  }
}
```

</details>

<details><summary><code>POST /api/maintenance/:id/reject</code> — Reject PENDING with reason.</summary>

**Access:** Admin / Asset Manager

**Request body**

```json
{
  "reason": "\u2026"
}
```

**Response `200` — `data`:**

```json
{
  "request": {
    "id": "uuid",
    "status": "REJECTED"
  }
}
```

</details>

<details><summary><code>POST /api/maintenance/:id/assign</code> — Assign technician (id or name).</summary>

**Access:** Admin / Asset Manager

**Request body**

```json
{
  "technicianId": "uuid|null",
  "technicianName": "Vendor Co."
}
```

**Response `200` — `data`:**

```json
{
  "request": {
    "id": "uuid",
    "status": "TECHNICIAN_ASSIGNED",
    "technician": {
      "id": "uuid|null",
      "name": "\u2026"
    }
  }
}
```

</details>

<details><summary><code>POST /api/maintenance/:id/start</code> — ASSIGNED → IN_PROGRESS.</summary>

**Access:** Assigned technician / Manager

**Request body**

```json
{}
```

**Response `200` — `data`:**

```json
{
  "request": {
    "id": "uuid",
    "status": "IN_PROGRESS"
  }
}
```

</details>

<details><summary><code>POST /api/maintenance/:id/resolve</code> — Resolve; asset back to AVAILABLE/ALLOCATED.</summary>

**Access:** Technician / Manager

**Request body**

```json
{
  "notes": "Replaced panel",
  "cost": 220.5
}
```

**Response `200` — `data`:**

```json
{
  "request": {
    "id": "uuid",
    "status": "RESOLVED"
  }
}
```

</details>

<details><summary><code>POST /api/maintenance/:id/escalate</code> — Escalate; priority → CRITICAL.</summary>

**Access:** Admin / Asset Manager

**Request body**

```json
{
  "reason": "SLA breach",
  "escalateTo": "ADMIN"
}
```

**Response `200` — `data`:**

```json
{
  "request": {
    "id": "uuid",
    "status": "ESCALATED",
    "priority": "CRITICAL"
  }
}
```

</details>

<details><summary><code>GET /api/maintenance/:id/comments</code> — Comment thread.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "comments": [
    {
      "id": "uuid",
      "author": {
        "id": "uuid",
        "name": "Jane",
        "role": "EMPLOYEE"
      },
      "text": "\u2026",
      "createdAt": "ISO"
    }
  ]
}
```

</details>

<details><summary><code>POST /api/maintenance/:id/comments</code> — Add comment.</summary>

**Access:** Authenticated

**Request body**

```json
{
  "text": "Vendor scheduled Monday."
}
```

**Response `201` — `data`:**

```json
{
  "comment": {
    "id": "uuid",
    "text": "\u2026",
    "createdAt": "ISO"
  }
}
```

</details>

### 17.12 Audit Cycles (`/api/audit-cycles`)

Create/auditors/close: **Admin**. Mark items: assigned auditor or Admin. Reads scoped for Dept Heads.

| Method | Path | Access |
|---|---|---|
| `GET` | `/` | Authenticated (scoped) |
| `POST` | `/` | Admin |
| `GET` | `/:id` | Authenticated |
| `POST` | `/:id/auditors` | Admin |
| `GET` | `/:id/items` | Authenticated |
| `PATCH` | `/:id/items/bulk-update` | Assigned auditor / Admin |
| `PATCH` | `/:id/items/:itemId` | Assigned auditor / Admin |
| `GET` | `/:id/progress` | Authenticated |
| `GET` | `/:id/discrepancy-report` | Authenticated |
| `GET` | `/:id/summary` | Authenticated |
| `POST` | `/:id/close` | Admin |

<details><summary><code>GET /api/audit-cycles/</code> — List cycles.</summary>

**Access:** Authenticated (scoped)

**Query params**

| Param | Required | Notes |
|---|---|---|
| `status` | no | ACTIVE|CLOSED |

**Response `200` — `data`:**

```json
{
  "cycles": [
    {
      "id": "uuid",
      "name": "Q3 2026 Audit",
      "scopeType": "DEPARTMENT",
      "startDate": "2026-07-15",
      "endDate": "2026-07-30",
      "status": "ACTIVE",
      "createdAt": "ISO",
      "closedAt": "null",
      "stats": {
        "total": 120,
        "verified": 80,
        "discrepancy": 3,
        "missing": 1,
        "pending": 36,
        "completionPercent": 70
      }
    }
  ]
}
```

</details>

<details><summary><code>POST /api/audit-cycles/</code> — Create + snapshot checklist from assets in scope.</summary>

**Access:** Admin

**Request body**

```json
{
  "name": "Q3 2026 Audit",
  "departmentIds": [
    "uuid"
  ],
  "startDate": "2026-07-15",
  "endDate": "2026-07-30"
}
```

**Response `201` — `data`:**

```json
{
  "cycle": {
    "id": "uuid",
    "name": "Q3 2026 Audit",
    "scopeType": "DEPARTMENT",
    "startDate": "2026-07-15",
    "endDate": "2026-07-30",
    "status": "ACTIVE",
    "createdAt": "ISO",
    "closedAt": "null",
    "stats": {
      "total": 120,
      "verified": 80,
      "discrepancy": 3,
      "missing": 1,
      "pending": 36,
      "completionPercent": 70
    }
  }
}
```

</details>

<details><summary><code>GET /api/audit-cycles/:id</code> — Detail + auditors + departments.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "cycle": {
    "id": "uuid",
    "name": "Q3 2026 Audit",
    "scopeType": "DEPARTMENT",
    "startDate": "2026-07-15",
    "endDate": "2026-07-30",
    "status": "ACTIVE",
    "createdAt": "ISO",
    "closedAt": "null",
    "stats": {
      "total": 120,
      "verified": 80,
      "discrepancy": 3,
      "missing": 1,
      "pending": 36,
      "completionPercent": 70
    },
    "auditors": [
      {
        "id": "uuid",
        "name": "Jane",
        "email": "\u2026"
      }
    ],
    "departments": [
      {
        "id": "uuid",
        "name": "Engineering"
      }
    ]
  }
}
```

</details>

<details><summary><code>POST /api/audit-cycles/:id/auditors</code> — Assign auditors (idempotent).</summary>

**Access:** Admin

**Request body**

```json
{
  "userIds": [
    "uuid",
    "uuid"
  ]
}
```

**Response `200` — `data`:**

```json
{
  "addedCount": 2
}
```

</details>

<details><summary><code>GET /api/audit-cycles/:id/items</code> — Checklist + counts.</summary>

**Access:** Authenticated

**Query params**

| Param | Required | Notes |
|---|---|---|
| `status` | no | PENDING|VERIFIED|DISCREPANCY|MISSING |
| `q` | no | search |

**Response `200` — `data`:**

```json
{
  "items": [
    {
      "id": "uuid",
      "asset": {
        "id": "uuid",
        "tag": "AF-0001",
        "name": "Laptop",
        "serial": "SN-1",
        "status": "AVAILABLE"
      },
      "expectedLocation": "HQ",
      "verification": "VERIFIED",
      "notes": "null",
      "photo": "null",
      "verifiedBy": "Jane|null",
      "verifiedAt": "ISO|null"
    }
  ],
  "total": 120,
  "verified": 80,
  "discrepancy": 3,
  "missing": 1,
  "pending": 36
}
```

</details>

<details><summary><code>PATCH /api/audit-cycles/:id/items/bulk-update</code> — Mark many (VERIFIED|DISCREPANCY|MISSING).</summary>

**Access:** Assigned auditor / Admin

**Request body**

```json
{
  "verification": "VERIFIED",
  "itemIds": [
    "uuid"
  ],
  "notes": ""
}
```

**Response `200` — `data`:**

```json
{
  "updatedCount": 5
}
```

</details>

<details><summary><code>PATCH /api/audit-cycles/:id/items/:itemId</code> — Mark one (optional photo).</summary>

**Access:** Assigned auditor / Admin

**Request body**

```json
{
  "verification": "DISCREPANCY",
  "notes": "Wrong room",
  "photoUrl": "null"
}
```

**Response `200` — `data`:**

```json
{
  "item": {
    "id": "uuid",
    "verification": "DISCREPANCY"
  }
}
```

</details>

<details><summary><code>GET /api/audit-cycles/:id/progress</code> — Totals + per-auditor breakdown.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "total": 120,
  "verified": 80,
  "discrepancy": 3,
  "missing": 1,
  "pending": 36,
  "completionPercent": 70,
  "byAuditor": [
    {
      "auditor": {
        "id": "uuid",
        "name": "Jane"
      },
      "completed": 40
    }
  ]
}
```

</details>

<details><summary><code>GET /api/audit-cycles/:id/discrepancy-report</code> — Flagged items.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "flaggedCount": 4,
  "items": [
    {
      "assetTag": "AF-0001",
      "assetName": "Laptop",
      "verificationStatus": "DISCREPANCY",
      "notes": "\u2026",
      "verifiedBy": "Jane",
      "verifiedAt": "ISO"
    }
  ]
}
```

</details>

<details><summary><code>GET /api/audit-cycles/:id/summary</code> — Historical summary.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "summary": {
    "id": "uuid",
    "name": "Q3 2026 Audit",
    "scopeType": "DEPARTMENT",
    "startDate": "2026-07-15",
    "endDate": "2026-07-30",
    "status": "ACTIVE",
    "createdAt": "ISO",
    "closedAt": "null",
    "stats": {
      "total": 120,
      "verified": 80,
      "discrepancy": 3,
      "missing": 1,
      "pending": 36,
      "completionPercent": 70
    }
  }
}
```

</details>

<details><summary><code>POST /api/audit-cycles/:id/close</code> — Lock cycle; MISSING items → assets LOST.</summary>

**Access:** Admin

**Request body**

```json
{}
```

**Response `200` — `data`:**

```json
{
  "cycle": {
    "id": "uuid",
    "status": "CLOSED",
    "assetsMarkedLost": 1
  }
}
```

</details>

### 17.13 Dashboard (`/api/dashboard`)

All widgets **scoped**: Employee → own, Dept Head → dept, Admin/AM → org.

| Method | Path | Access |
|---|---|---|
| `GET` | `/kpis` | Authenticated (scoped) |
| `GET` | `/overdue` | Authenticated (scoped) |
| `GET` | `/activity-feed` | Authenticated (scoped) |
| `GET` | `/utilization-chart` | Authenticated |
| `GET` | `/upcoming-returns` | Authenticated (scoped) |
| `GET` | `/health-score` | Authenticated |

<details><summary><code>GET /api/dashboard/kpis</code> — Headline counters.</summary>

**Access:** Authenticated (scoped)

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "assetsAvailable": 50,
  "assetsAllocated": 40,
  "underMaintenance": 5,
  "maintenanceOpen": 8,
  "activeBookings": 12,
  "pendingTransfers": 3,
  "upcomingReturns": 7
}
```

</details>

<details><summary><code>GET /api/dashboard/overdue</code> — Overdue returns.</summary>

**Access:** Authenticated (scoped)

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "overdueReturns": [
    {
      "assetTag": "AF-0001",
      "assetName": "Laptop",
      "holder": "Jane",
      "expectedReturnDate": "ISO",
      "daysOverdue": 3
    }
  ],
  "overdueBookings": []
}
```

</details>

<details><summary><code>GET /api/dashboard/activity-feed</code> — Recent timeline.</summary>

**Access:** Authenticated (scoped)

**Query params**

| Param | Required | Notes |
|---|---|---|
| `limit` | no | default 10, max 50 |

**Response `200` — `data`:**

```json
{
  "activities": [
    {
      "id": "uuid",
      "type": "ALLOCATION",
      "description": "\u2026",
      "actor": {
        "id": "uuid",
        "name": "Jane"
      },
      "entityType": "ASSET",
      "entityId": "uuid",
      "createdAt": "ISO"
    }
  ]
}
```

</details>

<details><summary><code>GET /api/dashboard/utilization-chart</code> — % allocated per day.</summary>

**Access:** Authenticated

**Query params**

| Param | Required | Notes |
|---|---|---|
| `days` | no | 7–90, default 30 |

**Response `200` — `data`:**

```json
{
  "dataPoints": [
    {
      "date": "2026-07-01",
      "utilization": 62
    }
  ]
}
```

</details>

<details><summary><code>GET /api/dashboard/upcoming-returns</code> — Next returns due.</summary>

**Access:** Authenticated (scoped)

**Query params**

| Param | Required | Notes |
|---|---|---|
| `limit` | no | default 5, max 20 |

**Response `200` — `data`:**

```json
{
  "returns": [
    {
      "allocationId": "uuid",
      "asset": {
        "tag": "AF-0001",
        "name": "Laptop"
      },
      "holder": {
        "id": "uuid",
        "name": "Jane"
      },
      "expectedReturnDate": "ISO",
      "status": "ON_TIME"
    }
  ]
}
```

</details>

<details><summary><code>GET /api/dashboard/health-score</code> — Composite fleet health.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "score": 82,
  "label": "Good standing",
  "breakdown": {
    "availableRatio": 0.9,
    "maintenanceBacklog": 0.95,
    "auditCompliance": 0.7,
    "overdueRate": 0.05
  }
}
```

</details>

### 17.14 Reports (`/api/reports`)

**Admin / Asset Manager / Dept Head** (dept heads scoped to their dept).

| Method | Path | Access |
|---|---|---|
| `GET` | `/utilization` | Admin / AM / Dept Head |
| `GET` | `/maintenance-frequency` | Admin / AM / Dept Head |
| `GET` | `/due-for-maintenance` | Admin / AM / Dept Head |
| `GET` | `/allocation-summary` | Admin / AM / Dept Head |
| `GET` | `/booking-heatmap` | Admin / AM / Dept Head |
| `GET` | `/export` | Admin / AM / Dept Head |

<details><summary><code>GET /api/reports/utilization</code> — Most-used + idle assets.</summary>

**Access:** Admin / AM / Dept Head

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "mostUsed": [
    {
      "asset": "AF-0001 \u2014 Laptop",
      "count": 12
    }
  ],
  "idle": [
    {
      "asset": "AF-0009 \u2014 Chair",
      "idleDays": 45
    }
  ]
}
```

</details>

<details><summary><code>GET /api/reports/maintenance-frequency</code> — Counts by category.</summary>

**Access:** Admin / AM / Dept Head

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "byCategory": [
    {
      "category": "Electronics",
      "count": 18
    }
  ]
}
```

</details>

<details><summary><code>GET /api/reports/due-for-maintenance</code> — ≥2 repairs or >4 yrs old.</summary>

**Access:** Admin / AM / Dept Head

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "dueOrNearingRetirement": [
    {
      "asset": "AF-0001 \u2014 Laptop",
      "note": "3 repairs on record"
    }
  ]
}
```

</details>

<details><summary><code>GET /api/reports/allocation-summary</code> — Active allocations by dept.</summary>

**Access:** Admin / AM / Dept Head

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "byDepartment": [
    {
      "department": "Engineering",
      "allocatedCount": 24
    }
  ]
}
```

</details>

<details><summary><code>GET /api/reports/booking-heatmap</code> — Peak hours per resource.</summary>

**Access:** Admin / AM / Dept Head

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "heatmap": [
    {
      "resource": "Room B2",
      "peakHour": "09:00-10:00",
      "bookings": 14
    }
  ]
}
```

</details>

<details><summary><code>GET /api/reports/export</code> — CSV download (envelope does not apply).</summary>

**Access:** Admin / AM / Dept Head

**Query params**

| Param | Required | Notes |
|---|---|---|
| `type` | yes | utilization|maintenance-frequency|due-for-maintenance|allocation-summary|booking-heatmap |
| `format` | yes | csv |

**Response `200` — `data`:**

`text/csv` attachment (raw CSV, not the JSON envelope).

</details>

### 17.15 Notifications (`/api/notifications`)

All scoped to the logged-in user.

| Method | Path | Access |
|---|---|---|
| `GET` | `/` | Authenticated |
| `GET` | `/preferences` | Authenticated |
| `PATCH` | `/preferences` | Authenticated |
| `POST` | `/mark-all-read` | Authenticated |
| `PATCH` | `/:id/read` | Authenticated (owner) |
| `DELETE` | `/:id` | Authenticated (owner) |

<details><summary><code>GET /api/notifications/</code> — Own feed (max 100) + unread count.</summary>

**Access:** Authenticated

**Query params**

| Param | Required | Notes |
|---|---|---|
| `unread` | no | true = unread only |

**Response `200` — `data`:**

```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "ALLOCATION",
      "title": "\u2026",
      "message": "\u2026",
      "entity_type": "ALLOCATION",
      "entity_id": "uuid",
      "read": false,
      "created_at": "ISO"
    }
  ],
  "unreadCount": 4
}
```

</details>

<details><summary><code>GET /api/notifications/preferences</code> — Merged over defaults.</summary>

**Access:** Authenticated

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "preferences": {
    "allocation": true,
    "transfer": true,
    "maintenance": true,
    "booking": true,
    "audit": true,
    "email": false
  }
}
```

</details>

<details><summary><code>PATCH /api/notifications/preferences</code> — Upsert (partial merge).</summary>

**Access:** Authenticated

**Request body**

```json
{
  "allocation": true,
  "transfer": true,
  "maintenance": true,
  "booking": true,
  "audit": true,
  "email": false
}
```

**Response `200` — `data`:**

```json
{
  "preferences": {
    "allocation": true,
    "transfer": true,
    "maintenance": true,
    "booking": true,
    "audit": true,
    "email": false
  }
}
```

</details>

<details><summary><code>POST /api/notifications/mark-all-read</code> — Mark all read.</summary>

**Access:** Authenticated

**Request body**

```json
{}
```

**Response `200` — `data`:**

```json
{
  "updatedCount": 4
}
```

</details>

<details><summary><code>PATCH /api/notifications/:id/read</code> — Mark one read.</summary>

**Access:** Authenticated (owner)

**Request body**

```json
{}
```

**Response `200` — `data`:**

_No `data` payload (envelope `message` only)._

</details>

<details><summary><code>DELETE /api/notifications/:id</code> — Dismiss.</summary>

**Access:** Authenticated (owner)

**Request:** no body.

**Response `200` — `data`:**

_No `data` payload (envelope `message` only)._

</details>

### 17.16 Activity Logs (`/api/activity-logs`)

**Admin only** — full audit trail.

| Method | Path | Access |
|---|---|---|
| `GET` | `/` | Admin |
| `GET` | `/export` | Admin |

<details><summary><code>GET /api/activity-logs/</code> — Paginated, filterable.</summary>

**Access:** Admin

**Query params**

| Param | Required | Notes |
|---|---|---|
| `page` | no | default 1 |
| `limit` | no | default 25, max 100 |
| `actionType` | no | ALLOCATION|RETURN|TRANSFER|BOOKING|MAINTENANCE|AUDIT|ASSET|USER_CHANGE|SYSTEM |
| `userId` | no |  |
| `entityType` | no |  |
| `from` | no | YYYY-MM-DD |
| `to` | no | YYYY-MM-DD |

**Response `200` — `data`:**

```json
{
  "logs": [
    {
      "id": "uuid",
      "actionType": "ALLOCATION",
      "entityType": "ASSET",
      "entityId": "uuid",
      "description": "\u2026",
      "metadata": {},
      "actor": {
        "id": "uuid",
        "name": "Jane",
        "email": "\u2026"
      },
      "createdAt": "ISO"
    }
  ],
  "total": 500,
  "page": 1,
  "limit": 25
}
```

</details>

<details><summary><code>GET /api/activity-logs/export</code> — CSV (max 5000 rows).</summary>

**Access:** Admin

**Query params**

| Param | Required | Notes |
|---|---|---|
| `format` | yes | csv |
| `from` | no | YYYY-MM-DD |
| `to` | no | YYYY-MM-DD |
| `actionType` | no |  |

**Response `200` — `data`:**

`text/csv` attachment.

</details>

### 17.17 Health (`/health`)

Liveness/readiness. **No auth, no `/api` prefix.** Uses `{success,message,data,timestamp}`.

| Method | Path | Access |
|---|---|---|
| `GET` | `/health` | Public |

<details><summary><code>GET /health/health</code> — DB ping + uptime (200 healthy / 503 degraded).</summary>

**Access:** Public

**Request:** no body.

**Response `200` — `data`:**

```json
{
  "status": "ok",
  "environment": "development",
  "uptime_seconds": 3600,
  "database": {
    "status": "connected",
    "latency_ms": 12.34
  }
}
```

</details>

