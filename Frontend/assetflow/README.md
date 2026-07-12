# AssetFlow — Frontend

Web client for the AssetFlow asset management system, built with **Next.js 16 (App Router)** and **React 19**.

## 📑 Table of Contents

- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
- [Authentication Flow](#-authentication-flow)
- [Roles & Demo Credentials](#-roles--demo-credentials)
- [Pages & Features](#-pages--features)
- [State Management](#-state-management)
- [Project Structure](#-project-structure)
- [NPM Scripts](#-npm-scripts)

## 🛠 Tech Stack

| Concern | Technology |
|---------|------------|
| Framework | Next.js 16 (App Router, route groups) |
| UI library | React 19 + TypeScript |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`), `tw-animate-css`, `tailwindcss-animate` |
| Components | shadcn/ui on **Base UI** (`@base-ui/react`) — button, dialog, sheet, table, tabs, command palette (`cmdk`), drawer (`vaul`), etc. |
| Icons | Lucide React |
| Forms & validation | React Hook Form + Zod (`@hookform/resolvers`) |
| State | Zustand (auth, notifications, UI stores) |
| Tables | TanStack Table v8 |
| Charts | Recharts (dashboard & reports) |
| Dates | date-fns + React Day Picker (calendar/bookings) |
| Animation | Framer Motion |
| Theming | next-themes (light/dark) |
| Toasts | Sonner |

## 🚀 Getting Started

```bash
cd Frontend/assetflow
npm install
npm run dev        # http://localhost:3000
```

> Requires the [Backend](../../Backend/README.md) to be reachable (see Configuration).

## 🔧 Configuration

The API base URL is set in `src/lib/api.ts` (`API_BASE`). It currently points at the production Railway deployment:

```
https://assetflow-production-85d2.up.railway.app/api
```

For local development, point it at your local backend (`http://localhost:3000/api`) and make sure the backend's `CLIENT_URL` env var matches this app's origin (CORS + cookies).

## 🔒 Authentication Flow

- Auth is **cookie-based** — the backend sets HttpOnly `at` (access, 15 min) and `rt` (refresh, 7 days) cookies; the frontend never touches raw tokens.
- Every request in `src/lib/api.ts` is sent with `credentials: "include"`.
- **Silent refresh**: when any request returns 401, the client calls `POST /auth/refresh` once (deduplicated across concurrent requests) and retries the original request. If refresh fails, the user is routed to login.
- The current user (`{ id, name, email, role, departmentId }`) lives in the Zustand **auth store** and drives role-based rendering — the sidebar, actions, and pages adapt to `ADMIN`, `ASSET_MANAGER`, `DEPT_HEAD`, or `EMPLOYEE`.
- Auth screens: **login**, **signup**, and **forgot password** (OTP-based reset over email).

## 🧪 Roles & Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| ADMIN | admin@assetflow.com | Admin@123 |
| ASSET_MANAGER | manager@assetflow.com | Manager@123 |
| DEPT_HEAD | head@assetflow.com | Head@123 |
| EMPLOYEE | employee@assetflow.com | Employee@123 |

## 📄 Pages & Features

Routes are organized in two App Router groups: `(auth)` for public screens and `(dashboard)` for the authenticated shell (sidebar + topbar layout).

| Route | Page | What it does |
|-------|------|--------------|
| `/login`, `/signup`, `/forgot-password` | Auth | Sign in/up, OTP password reset |
| `/` | Dashboard | Role-scoped KPIs and charts (Recharts) |
| `/organization` | Organization | Departments, users, categories, locations → floors → rooms setup |
| `/assets` | Assets | Registry with filters, custom category fields, documents, QR codes |
| `/allocations` | Allocations | Assign/return assets, holder history |
| `/bookings` | Bookings | Shared-resource calendar, recurring series, conflict-aware booking |
| `/maintenance` | Maintenance | Request/triage/resolve workflow with comments |
| `/audits` | Audits | Audit cycles, auditor assignment, item verification |
| `/reports` | Reports | Aggregated reporting views |
| `/activity` | Activity | Organization-wide activity log timeline |
| `/settings` | Settings | Profile, password change, notification preferences, theme |

Plus an in-app **notification feed** (unread badge, mark-as-read) and light/dark mode.

## 🗃 State Management

Three small Zustand stores in `src/stores/`:

| Store | Holds |
|-------|-------|
| `auth-store` | Current user, role, session status — drives role-based UI |
| `notification-store` | Notification feed + unread count |
| `ui-store` | Sidebar/layout UI state |

Server data is fetched through the typed API client (`src/lib/api.ts`) with shared types in `src/lib/types.ts`.

## 📂 Project Structure

```
Frontend/assetflow/
├── components.json          # shadcn/ui config
├── next.config.ts
└── src/
    ├── app/
    │   ├── (auth)/          # login, signup, forgot-password
    │   ├── (dashboard)/     # authenticated shell + 10 feature pages
    │   ├── layout.tsx       # root layout (theme provider, toaster)
    │   └── globals.css      # Tailwind v4 theme tokens
    ├── components/
    │   ├── ui/              # shadcn/Base UI primitives (24 components)
    │   ├── layout/          # sidebar, topbar, shell
    │   └── shared/          # reusable feature components
    ├── stores/              # Zustand: auth, notifications, ui
    ├── lib/                 # api.ts (client + silent refresh), types, constants, utils
    └── data/                # static/config data
```

## 📜 NPM Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (flat config, `eslint-config-next`) |
