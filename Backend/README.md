# AssetFlow — Backend

REST API for the AssetFlow asset management system, built with **Express + TypeScript** on **PostgreSQL**.

## 📑 Table of Contents

- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [NPM Scripts](#-npm-scripts)
- [Authentication & Security](#-authentication--security)
- [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
- [Demo Credentials](#-demo-credentials)
- [API Index](#-api-index)
- [Database Schema](#-database-schema)
- [Project Structure](#-project-structure)
- [Postman Collection](#-postman-collection)

## 🛠 Tech Stack

| Concern | Technology |
|---------|------------|
| Runtime | Node.js ≥ 20 (ES modules), executed with `tsx` |
| Framework | Express 4 |
| Language | TypeScript (strict, `tsc --noEmit` typecheck) |
| Database | PostgreSQL (Neon serverless) via `pg` |
| Auth | `jsonwebtoken` (JWT access tokens) + opaque rotating refresh tokens |
| Password hashing | `bcryptjs` |
| Email | `nodemailer` (Gmail SMTP — OTPs, notifications) |
| File storage | Cloudinary (asset images/documents), uploaded via `multer` |
| QR codes | `qrcode` — per-asset QR generation |
| Security | `helmet` (headers), `cors` (allow-listed client), request sanitizer, 20 kb JSON body limit |
| Logging | `pino` + `pino-http` (pretty-printed in dev) |
| Config | `dotenv` with fail-fast validation of required vars |

## 🚀 Getting Started

```bash
cd Backend
npm install

# Create .env (see below), then:
npm run db:migrate     # applies sql/schema.sql
npm run db:seed        # seeds departments, users, categories, sample data

npm run dev            # dev server with watch mode → http://localhost:3000
```

Health check: `GET /health`

## 🔧 Environment Variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string (Neon) |
| `JWT_ACCESS_SECRET` | ✅ | — | Secret for signing access tokens |
| `PORT` | | `3000` | HTTP port |
| `NODE_ENV` | | `development` | `production` enables secure cookies |
| `CLIENT_URL` | | `http://localhost:5173` | Allowed CORS origin (frontend URL) |
| `ACCESS_TOKEN_TTL` | | `15m` | Access-token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | | `7` | Refresh-token lifetime (days) |
| `MAIL_USER` / `GMAIL_USER` | | — | SMTP user for outgoing mail |
| `MAIL_PASS` / `GMAIL_APP_PASSWORD` | | — | SMTP app password |
| `CLOUDINARY_CLOUD_NAME` | | — | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | | — | Cloudinary API secret |

The server **fails fast at boot** if a required variable is missing (`src/config.ts`).

## 📜 NPM Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start with `tsx watch` (auto-reload) |
| `npm start` | Start once (production) |
| `npm run db:migrate` | Apply `sql/schema.sql` to the database |
| `npm run db:seed` | Seed demo departments, users, categories, assets |
| `npm run typecheck` | TypeScript check without emitting |

## 🔐 Authentication & Security

**Token model — dual token, cookie-first:**

1. **Access token (`at` cookie)** — short-lived JWT (**15 min**) carrying `{ userId, role, departmentId }`, signed with `issuer: assetflow-api`, `audience: api`. Also accepted as an `Authorization: Bearer` header (fallback for API clients).
2. **Refresh token (`rt` cookie)** — opaque **64-byte random** token, valid **7 days**. Only its **SHA-256 hash** is stored in the DB (`refresh_tokens.token_hash`), so a DB leak cannot forge sessions. Tokens are **rotated on every refresh** (old row revoked, `replaced_by` chain kept).

Both cookies are **HttpOnly** (XSS-safe); `Secure` + cross-site settings apply in production. The frontend performs **silent refresh**: any 401 triggers `POST /api/auth/refresh` and a single retry.

**Auth endpoints (`/api/auth`):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/signup` | Register (first user patterns / employee self-signup) |
| POST | `/login` | Email + password → sets `at` + `rt` cookies |
| POST | `/refresh` | Rotate refresh token, issue new access token |
| POST | `/logout` | Revoke refresh token, clear cookies |
| GET | `/me` | Current user profile (requires auth) |
| POST | `/forgot-password` | Email a hashed, expiring OTP (attempt-limited) |
| POST | `/reset-password` | Verify OTP, set new password |
| POST | `/change-password` | Change password while logged in |

**Other hardening:** `helmet` security headers, strict CORS allow-list with credentials, input sanitization middleware, bcrypt password hashes, OTPs stored hashed with expiry + attempt counter.

## 👮 Role-Based Access Control (RBAC)

Four roles, enforced by three middleware layers (`src/middleware/auth.ts`):

| Middleware | What it does |
|------------|--------------|
| `requireAuth` | Verifies the JWT (cookie or Bearer) and attaches `req.user = { userId, role, departmentId }`. Missing/invalid → **401** |
| `requireRole(...roles)` | Valid token but role not in the allow-list → **403** |
| `requireOwnDepartment(loader)` | Department scoping: `ADMIN` and `ASSET_MANAGER` bypass (org-wide); `DEPT_HEAD` may only touch records whose `department_id` matches their own → otherwise **403** |

| Role | Scope |
|------|-------|
| `ADMIN` | Everything — user & department management, org setup, all modules |
| `ASSET_MANAGER` | Organization-wide asset operations: assets, allocations, transfers, maintenance, audits, reports |
| `DEPT_HEAD` | Their department only — its assets, people, transfer approvals, requests |
| `EMPLOYEE` | Self-service — own allocations, bookings, maintenance requests, notifications |

## 🧪 Demo Credentials

Created by `npm run db:seed`:

| Role | Email | Password | Department |
|------|-------|----------|------------|
| ADMIN | admin@assetflow.com | Admin@123 | — |
| ASSET_MANAGER | manager@assetflow.com | Manager@123 | — |
| DEPT_HEAD | head@assetflow.com | Head@123 | Engineering |
| EMPLOYEE | employee@assetflow.com | Employee@123 | Engineering |

(The seed also creates extra sample users: `priya@`, `arjun@`, `aditi@`, `rohan@`, `sneha@assetflow.com` — password pattern `Name@123`.)

## 🌐 API Index

All routes are mounted under `/api` (`src/app.ts`). Responses use a uniform envelope: `{ success, message, data }`.

| Base path | Module | Highlights |
|-----------|--------|------------|
| `/api/auth` | Authentication | Login, signup, refresh rotation, OTP password reset |
| `/api/users` | Users | CRUD, role/department assignment (Admin) |
| `/api/departments` | Departments | Hierarchy (`parent_id`), department heads |
| `/api/categories` | Categories | Custom fields per category (JSONB, e.g. warranty period) |
| `/api/assets` | Assets | Registry, documents/images (Cloudinary), **QR code generation**, status lifecycle |
| `/api/locations` | Locations | Location → floor → room hierarchy |
| `/api/allocations` | Allocations | Assign assets to users/departments, holder history |
| `/api/transfers` | Transfers | Cross-department transfer request/approval workflow |
| `/api/resources` + `/api/bookings` | Bookings | Shared-resource reservations, recurring series, conflict checks |
| `/api/maintenance` | Maintenance | Request → in-progress → resolved, threaded comments |
| `/api/audit-cycles` | Audits | Audit cycles per department, assigned auditors, item verification |
| `/api/dashboard` | Dashboard | Role-scoped KPIs & stats |
| `/api/reports` | Reports | Aggregated reporting endpoints |
| `/api/notifications` | Notifications | Unread feed, mark-read, per-user preferences |
| `/api/activity-logs` | Activity | Full audit trail (who/what/when) |
| `/health` | Health | Liveness probe |

## 🗄 Database Schema

Single idempotent migration: `sql/schema.sql` (applied via `npm run db:migrate`). Uses `pgcrypto` for UUID PKs and native enums (`user_role`, `user_status`).

**Table groups:**

- **Auth & org** — `users`, `departments` (self-referencing hierarchy + head FK), `refresh_tokens` (hashed, rotating), `password_reset_otps` (hashed, expiring, attempt-limited)
- **Asset registry** — `categories` (JSONB custom fields), `locations` → `floors` → `rooms`, `assets`, `asset_documents`
- **Workflows** — `allocations`, `transfer_requests`, `booking_series` + `bookings`, `maintenance_requests` + `maintenance_comments`
- **Audit** — `audit_cycles`, `audit_cycle_departments`, `audit_cycle_auditors`, `audit_items`
- **Platform** — `notifications`, `notification_preferences`, `activity_logs`

**Indexes** target the hot query paths:

| Index | Covers |
|-------|--------|
| `idx_users_email` | Login lookup |
| `idx_rt_hash`, `idx_rt_user_active` (partial) | Refresh-token verify & active-session queries |
| `idx_otp_user` | OTP validation |
| `idx_assets_status` / `_category` / `_department` | Asset list filters |
| `idx_alloc_asset`, `idx_alloc_holder` | Current-holder lookups |
| `idx_transfers_status` | Pending-approval queues |
| `idx_bookings_resource`, `idx_bookings_user` | Conflict checks & "my bookings" (composite with `start_ts`) |
| `idx_maint_status`, `idx_maint_asset` | Maintenance queues |
| `idx_audit_items_cycle` | Cycle progress |
| `idx_notif_user` | Unread feed (`user_id, read, created_at DESC`) |
| `idx_activity_created`, `idx_activity_actor` | Activity timeline |

## 📂 Project Structure

```
Backend/
├── sql/schema.sql          # Full DB schema + indexes (idempotent)
├── postman/                # Postman collection + generator
└── src/
    ├── server.ts           # Bootstrap
    ├── app.ts              # Express app, middleware, route mounting
    ├── config.ts           # Env loading + validation
    ├── db/                 # neon.ts (pool), migrate.ts, seed.ts
    ├── middleware/         # auth.ts (requireAuth/requireRole/requireOwnDepartment), sanitize.ts
    ├── lib/                # tokens, crypto, cookies, email, cloudinary, notify,
    │                       # activity logging, validation, response envelope, logger
    └── routes/             # One router per module (16 modules)
```

## 📬 Postman Collection

A ready-to-import collection lives at [`postman/AssetFlow.postman_collection.json`](./postman/AssetFlow.postman_collection.json) — see [`postman/README.md`](./postman/README.md).
