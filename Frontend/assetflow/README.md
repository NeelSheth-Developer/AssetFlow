# AssetFlow — Frontend Documentation

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS · shadcn/ui · Zustand · Framer Motion · Recharts

**Backend:** Node.js + Express + Neon Postgres — deployed at Railway  
**Frontend:** Deployed via Vercel (or local dev at `http://localhost:3000`)

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Environment Variables](#2-environment-variables)
3. [Project Structure](#3-project-structure)
4. [Authentication Flow](#4-authentication-flow)
5. [Pages & Features](#5-pages--features)
6. [API Integration](#6-api-integration)
7. [State Management](#7-state-management)
8. [UI Components](#8-ui-components)
9. [Role-Based Access](#9-role-based-access)
10. [Key Design Decisions](#10-key-design-decisions)

---

## 1. Quick Start

```bash
cd Frontend/assetflow
npm install
cp .env.example .env.local    # configure API URL
npm run dev                   # http://localhost:3000
```

Build for production:
```bash
npm run build
npm start
```

---

## 2. Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | Yes | Backend API base URL (e.g. `https://assetflow-production-85d2.up.railway.app/api`) |

The `.env.local` file is gitignored. Use `.env.example` as a template.

---

## 3. Project Structure

```
src/
├── app/
│   ├── (auth)/                    # Auth pages (no sidebar/topbar)
│   │   ├── login/page.tsx         # Login with animated features panel
│   │   ├── signup/page.tsx        # Signup with benefits panel
│   │   ├── forgot-password/page.tsx # OTP-based password reset
│   │   └── layout.tsx             # Bare layout (no chrome)
│   ├── (dashboard)/               # Authenticated pages (sidebar + topbar)
│   │   ├── layout.tsx             # Auth guard, sidebar, topbar, notifications
│   │   ├── page.tsx               # Dashboard — KPIs, activity, charts
│   │   ├── organization/page.tsx  # Departments, Categories, Employees CRUD
│   │   ├── assets/page.tsx        # Asset registry with lifecycle actions
│   │   ├── allocations/page.tsx   # Kanban board for allocations
│   │   ├── transfers/page.tsx     # Transfer requests & approvals
│   │   ├── bookings/page.tsx      # Resource booking with conflict checking
│   │   ├── maintenance/page.tsx   # Maintenance pipeline with comments
│   │   ├── audits/page.tsx        # Audit cycles management
│   │   ├── reports/page.tsx       # Analytics charts (utilization, heatmap)
│   │   ├── activity/page.tsx      # Activity logs + notifications
│   │   └── settings/page.tsx      # Profile & change password
│   ├── globals.css
│   ├── layout.tsx                 # Root layout with providers
│   └── page.tsx                   # Landing page
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx            # Collapsible navigation sidebar
│   │   └── topbar.tsx             # Breadcrumb, notifications, user menu
│   ├── shared/
│   │   └── status-badge.tsx       # Reusable status badge component
│   └── ui/                        # shadcn/ui primitives
├── lib/
│   ├── api.ts                     # All backend API calls (fetch wrapper + auth)
│   ├── constants.ts               # NAV_ITEMS, enums, static values
│   ├── types.ts                   # TypeScript interfaces
│   └── utils.ts                   # cn() utility
├── stores/
│   ├── auth-store.ts              # Zustand: user, login, logout, fetchMe
│   ├── notification-store.ts      # Zustand: notifications, mark read
│   └── ui-store.ts                # Zustand: sidebar collapse state
└── data/
    └── mock.ts                    # Legacy mock data (being phased out)
```

---

## 4. Authentication Flow

- **Cookie-based auth**: Backend sets HttpOnly `at` (access token, 15min) and `rt` (refresh token, 7 days) cookies
- **Frontend never stores tokens**: Uses `credentials: "include"` on all fetch calls
- **Silent refresh**: On 401 response, `api.ts` automatically calls `POST /auth/refresh` and retries the original request
- **Session rehydration**: On page load, `GET /auth/me` rehydrates the user state
- **Redirect logic**: Unauthenticated users are redirected to `/login`; authenticated users on auth pages are redirected to `/`

### Auth Pages

| Page | Route | Description |
|---|---|---|
| Login | `/login` | Email + password, animated feature showcase |
| Signup | `/signup` | Name + email + password, role notice (always EMPLOYEE) |
| Forgot Password | `/forgot-password` | 3-step: email → OTP → new password |

---

## 5. Pages & Features

### Dashboard (`/`)
- KPI cards: Available, Allocated, Under Maintenance, Active Bookings, Pending Transfers, Upcoming Returns
- Recent Activity feed (from `GET /dashboard/activity-feed`)
- Asset Utilization chart (from `GET /dashboard/utilization-chart`)
- Upcoming Returns widget (from `GET /dashboard/upcoming-returns`)

### Organization (`/organization`)
Three tabs with full CRUD:

**Departments:**
- Card grid showing name, head, employee/asset counts
- Click to view department detail (fetches employees + assets from backend)
- Admin: Create, Edit (name/head/parent/status), Delete with confirmation dialog

**Categories:**
- Hierarchical tree with expand/collapse
- Expanding shows custom fields + fetches actual assets in that category
- Admin: Create with optional custom fields

**Employees:**
- Searchable table with role badges and status indicators
- Admin: Edit role/department, Toggle status (activate/deactivate), Create new employee (calls `POST /auth/signup`)
- All confirmations via Dialog (no browser alerts)

### Assets (`/assets`)
- List/Grid toggle with search and status filter
- Click row to see full detail (info + allocation history + maintenance history)
- **Create**: Register new asset (name, serial, category, condition, location, cost, bookable)
- **Edit**: Partial update (Admin/Asset Manager only)
- **Lifecycle actions**: Retire (AVAILABLE→RETIRED), Dispose (RETIRED→DISPOSED), Mark Lost (any→LOST)
- `currentHolder` from backend displayed as "Assigned To"

### Allocations (`/allocations`)
- Kanban board: PENDING | ACTIVE | RETURN_REQUESTED | OVERDUE columns
- **Create**: Allocate an available asset to an employee
- **Approve**: Move PENDING → ACTIVE
- **Approve Return**: Confirm return check-in

### Transfers (`/transfers`)
- Table listing all transfer requests with status
- **Create**: Request transfer of an allocated asset to another user
- **Approve/Reject**: Admin/AM/Dept Head can decide (reject requires reason via Dialog)

### Bookings (`/bookings`)
Three tabs: My Bookings | All Bookings | Check Availability

- **Create**: Select resource, date, time range, purpose — runs conflict check before booking
- **Recurring**: Create daily/weekly series (conflicts auto-skipped)
- **Reschedule**: Move booking to new slot (re-runs conflict check)
- **Cancel**: With confirmation dialog
- **Availability**: Hour-grid showing free/booked slots for a resource on a date
- Time slots: 09:00–18:00 in 30-minute intervals

### Maintenance (`/maintenance`)
Pipeline View + All Requests tab:

- **Create**: Raise request (asset, issue type, priority, description)
- **Approve/Reject**: Admin/AM actions on PENDING requests (reject via Dialog with reason)
- **Assign**: Assign technician (user or external name)
- **Start**: TECHNICIAN_ASSIGNED → IN_PROGRESS
- **Resolve**: Resolution notes + cost
- **Escalate**: Escalate with reason (forces CRITICAL priority)
- **Comments**: Thread per request (view + add)
- Click row to see full detail dialog with contextual actions

### Audits (`/audits`)
- List audit cycles with progress bars
- Create new cycle (name, departments, dates)
- View items checklist

### Reports (`/reports`)
- Asset Utilization (line chart)
- Allocations by Department (pie chart)
- Maintenance Frequency (bar chart)
- Booking Heatmap (bar chart)
- Export CSV button

### Activity (`/activity`)
- Activity logs from `GET /activity-logs` (real-time from backend)
- Notifications panel with mark-read and dismiss

### Profile (`/settings`)
- Account info (read-only): name, email, role, department
- Change Password: calls `POST /auth/change-password`
- Sign Out

---

## 6. API Integration

All API calls go through `src/lib/api.ts` which provides:

- **Automatic auth**: `credentials: "include"` on every request
- **Silent refresh**: 401 → refresh → retry (once)
- **Session expiry**: Failed refresh → clear state → redirect to login
- **Response envelope**: Backend always returns `{ success, message, data }`
- **Error handling**: Throws with backend's `message` field

### API Modules

| Module | Endpoints |
|---|---|
| `authApi` | signup, login, refresh, logout, me, forgotPassword, resetPassword, changePassword |
| `usersApi` | list, changeRole, changeDepartment, changeStatus |
| `departmentsApi` | list, get, create, update, delete |
| `categoriesApi` | list, tree, create |
| `assetsApi` | list, search, get, create, update, history, retire, dispose, markLost |
| `allocationsApi` | list, kanban, overdue, get, create, approve, returnRequest, returnApprove |
| `transfersApi` | list, get, create, approve, reject |
| `resourcesApi` | list, calendar, availability |
| `bookingsApi` | list, my, get, create, checkAvailability, recurring, cancel, reschedule |
| `maintenanceApi` | list, get, create, approve, reject, assign, start, resolve, escalate, getComments, addComment |
| `auditsApi` | list, get, create, assignAuditors, getItems, updateItem, bulkUpdateItems, progress, discrepancyReport, summary, close |
| `dashboardApi` | kpis, overdue, activityFeed, utilizationChart, upcomingReturns, healthScore |
| `reportsApi` | utilization, maintenanceFrequency, dueForMaintenance, allocationSummary, bookingHeatmap, export |
| `notificationsApi` | list, markRead, markAllRead, dismiss, getPreferences, updatePreferences |
| `activityApi` | list, exportUrl |

---

## 7. State Management

Three Zustand stores:

| Store | Purpose |
|---|---|
| `auth-store` | User session: login, signup, logout, fetchMe, isAuthenticated |
| `notification-store` | Notifications: fetch, markRead, markAllRead, dismiss, unreadCount |
| `ui-store` | UI state: sidebar collapsed toggle |

All stores use `persist` middleware where needed (auth persists to localStorage).

---

## 8. UI Components

- **shadcn/ui**: Button, Input, Dialog, Select, Table, Badge, Tabs, Switch, Textarea, DropdownMenu, Progress, Command
- **Framer Motion**: Page transitions on auth pages, animated feature panels
- **Recharts**: Dashboard utilization chart, reports charts
- **date-fns**: Date formatting across the app
- **sonner**: Toast notifications for all user feedback
- **Tailwind CSS**: Utility-first styling, dark mode support via class strategy

---

## 9. Role-Based Access

| Role | Capabilities |
|---|---|
| **ADMIN** | Everything: CRUD departments, categories, users, assets, approvals, audits |
| **ASSET_MANAGER** | Register/edit assets, allocate, approve maintenance/transfers/returns |
| **DEPT_HEAD** | Approve within own department, view department data |
| **EMPLOYEE** | View own assets/bookings, raise maintenance, request transfers, book resources |

UI conditionally renders action buttons based on `user.role` from the auth store. Backend independently enforces all permissions — the frontend is UX only.

---

## 10. Key Design Decisions

1. **No token storage in JS**: Cookies are HttpOnly — frontend never sees JWTs
2. **Optimistic UI with re-fetch**: After any mutation, we re-fetch the full list to ensure consistency
3. **No browser alerts**: All confirmations use custom Dialog components
4. **Select value handling**: `value={state || undefined}` pattern ensures placeholder displays correctly
5. **Environment variables**: API URL in `.env.local` via `NEXT_PUBLIC_API_BASE`
6. **Validation**: Required fields show red borders, negative numbers blocked, email format validated
7. **Scroll management**: Long lists (>8 items) get max-height with overflow scroll
8. **Error boundaries**: All date formatting wrapped in try/catch to prevent crashes
9. **Conflict checking**: Bookings run availability check before creation

---

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@assetflow.com` | `Admin@123` |
| Asset Manager | `manager@assetflow.com` | `Manager@123` |
| Department Head | `head@assetflow.com` | `Head@123` |
| Employee | `employee@assetflow.com` | `Employee@123` |
