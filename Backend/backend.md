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
17. [Module APIs — Screens 2–10](#17-module-apis--screens-210)
    · [Dashboard](#171-dashboard-apidashboard) · [Assets](#172-assets-apiassets) · [Locations](#173-locations-apilocations)
    · [Allocations](#174-allocations-apiallocations) · [Transfers](#175-transfers-apitransfers)
    · [Booking & Resources](#176-booking--resources-apibookings--apiresources) · [Maintenance](#177-maintenance-apimaintenance)
    · [Audit](#178-audit-apiaudit-cycles) · [Reports](#179-reports-apireports)
    · [Notifications](#1710-notifications-apinotifications) · [Activity logs](#1711-activity-logs-apiactivity-logs)

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

| Role | Email | Password |
|---|---|---|
| Admin | `admin@assetflow.com` | `Admin@123` |
| Asset Manager | `manager@assetflow.com` | `Manager@123` |
| Department Head | `head@assetflow.com` | `Head@123` |
| Employee | `employee@assetflow.com` | `Employee@123` |

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

## 17. Module APIs — Screens 2–10

All module routes use the §5 envelope, §6 cookie auth, and §11 guards. "Scoped" = Employee sees own records, Dept Head their department's, Admin/Asset Manager everything. Every state-changing action writes an `activity_logs` row, and workflow decisions create `notifications` for the affected user.

### 17.1 Dashboard (`/api/dashboard`)

| Route | Method | Returns |
|---|---|---|
| `/kpis` | GET | `assetsAvailable, assetsAllocated, underMaintenance, maintenanceOpen, activeBookings, pendingTransfers, upcomingReturns` (7-day window) |
| `/overdue` | GET | `overdueReturns[]` with `daysOverdue` |
| `/activity-feed?limit=10` | GET | Recent `activities[]` (type, description, actor, createdAt) |
| `/utilization-chart?days=30` | GET | `dataPoints[]` — % of assets allocated per day, computed from allocation history |
| `/upcoming-returns?limit=5` | GET | Next returns with `ON_TIME` / `OVERDUE` status |
| `/health-score` | GET | `score` 0–100 + `breakdown` (availableRatio, maintenanceBacklog, auditCompliance, overdueRate) |

### 17.2 Assets (`/api/assets`)

- `GET /` — paginated; filters `q, categoryId, departmentId, status, page, limit`. Scoped.
- `GET /search?q=` — quick lookup by tag / serial / name (⌘K, QR scan target).
- `GET /:id` — full detail: category, department, current holder, custom values, documents. 403 outside your scope.
- `POST /` (Admin/AM) — register; `tag` auto-generates (`AF-000N`) if omitted; `customValues` object validated against the category's custom fields client-side.
- `PATCH /:id` (Admin/AM) — partial update, including `status`.
- `GET /:id/history` — allocation + maintenance timelines.
- `POST /:id/documents` (Admin/AM) — multipart `file` field → Cloudinary folder `assets/<id>` (10 MB cap).
- `GET /:id/qr` — `{ qrUrl }` PNG data-URL encoding `{ app, assetId, tag }`.
- `POST /:id/retire` — requires status `AVAILABLE`; body `{ reason, retirementDate }` → 400 `Asset must be Available to retire`.
- `POST /:id/dispose` — requires `RETIRED`; body `{ method, notes, disposalDate }` → 400 `Asset must be Retired before disposal`.
- `POST /:id/mark-lost` — flags `LOST` outside an audit.
- `POST /bulk-delete` (Admin) — `{ ids: [] }`.

### 17.3 Locations (`/api/locations`)

`GET /` — nested `locations[] → floors[] → rooms[]` cascade for the registration form.

### 17.4 Allocations (`/api/allocations`)

- `GET /` — scoped; filters `assetId, employeeId, departmentId, status`.
- `GET /kanban` — grouped columns `PENDING / ACTIVE / RETURN_REQUESTED / OVERDUE` (overdue derived from `expected_return_date`).
- `GET /overdue` — with `daysOverdue`.
- `GET /:id` — detail incl. condition notes once returned.
- `POST /` (Admin/AM) — `{ assetId, employeeId, purpose, expectedReturnDate }`; asset must be `AVAILABLE`; sets it `ALLOCATED`; notifies the holder.
- `POST /:id/approve` (AM / Dept Head of holder's dept) — PENDING → ACTIVE.
- `POST /:id/return` (holder only) — `{ condition, notes }` → `RETURN_REQUESTED`.
- `POST /:id/return/approve` (Admin/AM) — checks in; asset back to `AVAILABLE`; notifies the holder.

### 17.5 Transfers (`/api/transfers`)

- `GET /` — scoped (employees see either side of their own transfers); filter `status`.
- `GET /:id` — detail.
- `POST /` — `{ assetId, toUserId, reason }`; asset must be `ALLOCATED`; one open request per asset (409 otherwise).
- `POST /:id/approve` (AM / Dept Head of target's dept) — closes the old allocation, opens one for the new holder, notifies both sides.
- `POST /:id/reject` — `{ reason }`, notifies the requester.

### 17.6 Booking & Resources (`/api/bookings` · `/api/resources`)

Time inputs accept `{ start, end }` (ISO) **or** `{ date, startTime, endTime }` (`"2026-07-14"`, `"09:30"`).

- `GET /api/resources` — bookable assets (`is_bookable = true`).
- `GET /api/resources/:id/calendar?from=&to=` — confirmed bookings in a window.
- `GET /api/resources/:id/availability?date=` — hourly 09:00–18:00 slot grid with `available` flags.
- `GET /api/bookings` — scoped; filters `resourceId, status (UPCOMING/ONGOING/COMPLETED/CANCELLED — derived), date`.
- `GET /api/bookings/my` — the caller's bookings.
- `GET /api/bookings/:id` — owner, their Dept Head, or Admin/AM.
- `POST /api/bookings` — overlap-checked → 409 `Requested slot conflicts with an existing booking`.
- `POST /api/bookings/check-availability` — `{ available: true }` or conflict + up to 3 alternative free resources.
- `POST /api/bookings/recurring` — `{ resourceId, frequency: DAILY|WEEKLY, startDate, endDate, startTime, endTime }` → creates the series, skips and reports conflicting dates (60-slot cap).
- `POST /api/bookings/:id/cancel` · `/:id/reschedule` — owner or Dept Head of the booker's dept; reschedule re-runs the overlap check.

### 17.7 Maintenance (`/api/maintenance`)

Pipeline: `PENDING → APPROVED → TECHNICIAN_ASSIGNED → IN_PROGRESS → RESOLVED` (+ `REJECTED`, `ESCALATED`).

- `GET /` — scoped; employees also see requests where they are the assigned technician; filters `status, priority, assetId`.
- `GET /:id` — detail + `commentCount`.
- `POST /` — `{ assetId, issue, issueType?, priority? }`.
- `POST /:id/approve` (AM) — asset → `UNDER_MAINTENANCE`. `/:id/reject` (AM) — `{ reason }`.
- `POST /:id/assign` (AM) — `{ technicianId }` (a user) or `{ technicianName }` (external).
- `POST /:id/start` — assigned technician only (400 unless `TECHNICIAN_ASSIGNED`).
- `POST /:id/resolve` — technician or AM; `{ notes, cost }`; asset returns to `AVAILABLE` (or `ALLOCATED` if still held).
- `POST /:id/escalate` (AM) — `{ reason, escalateTo }` → status `ESCALATED`, priority `CRITICAL`.
- `GET /:id/comments` · `POST /:id/comments` — `{ text }` thread on the request.

### 17.8 Audit (`/api/audit-cycles`)

Auditor is an **assignment** (`audit_cycle_auditors`), not a role — marking items requires being assigned to that cycle (Admin bypasses).

- `GET /` — Dept Heads see org-wide cycles plus ones covering their dept; filter `status`.
- `POST /` (Admin) — `{ name, departmentIds?, startDate?, endDate? }`; snapshots a checklist item for every asset in scope.
- `GET /:id` — detail + stats + auditors + departments.
- `POST /:id/auditors` (Admin) — `{ userIds: [] }`; notifies each auditor.
- `GET /:id/items?status=&q=` — checklist with per-status counts.
- `PATCH /:id/items/:itemId` — `{ verification, notes?, photoUrl? }`.
- `PATCH /:id/items/bulk-update` — `{ itemIds: [], verification, notes? }`.
- `GET /:id/progress` — totals, `completionPercent`, per-auditor completed counts.
- `GET /:id/discrepancy-report` — derived read over `DISCREPANCY`/`MISSING` rows.
- `GET /:id/summary` — historical stats (for closed cycles).
- `POST /:id/close` (Admin) — locks the cycle; assets on `MISSING` items are auto-marked `LOST`.

### 17.9 Reports (`/api/reports`)

Admin / Asset Manager / Dept Head (dept-scoped). Six endpoints:
`/utilization` (most used + idle assets), `/maintenance-frequency` (by category), `/due-for-maintenance` (≥2 repairs or >4 years old), `/allocation-summary` (by department), `/booking-heatmap` (peak hour × resource), and `/export?type=<report>&format=csv` — CSV download (the §5 envelope doesn't apply to file streams).

### 17.10 Notifications (`/api/notifications`)

All scoped to the logged-in user: `GET /` (`?unread=true`, returns `unreadCount`), `PATCH /:id/read`, `POST /mark-all-read`, `DELETE /:id` (dismiss), `GET /preferences` / `PATCH /preferences` (JSONB merged over defaults: allocation, transfer, maintenance, booking, audit, email).

### 17.11 Activity logs (`/api/activity-logs`)

Admin only. `GET /` — paginated; filters `actionType, userId, entityType, from, to`. `GET /export?format=csv` — up to 5 000 rows, `Content-Disposition: attachment`.
