# AssetFlow — Complete API Routes Document
## UI vs Backend Comparison + Missing Routes Analysis

---

## 📊 COMPARISON SUMMARY

| Module | UI (readme.md) Needs | Backend (backend.md) Has | Status |
|--------|---------------------|--------------------------|--------|
| Auth (Login/Signup/Forgot) | ✅ Full | ✅ Full (§4) | ✅ Complete |
| Dashboard KPIs | ✅ 6 KPI cards + charts | ✅ §20 (kpis + overdue) | ⚠️ Partial — missing activity feed + utilization chart + health score APIs |
| Organization Setup — Departments | ✅ CRUD + hierarchy + card grid | ✅ §8 + §13 (detail) | ⚠️ Missing: list with employee/asset counts, update head |
| Organization Setup — Categories | ✅ Tree + custom fields + CRUD | ✅ §8 + §12 (list) | ⚠️ Missing: single category detail, tree structure endpoint |
| Organization Setup — Employee Dir | ✅ Table + role promotion + bulk | ✅ §5 (full) | ✅ Complete |
| Asset Registration & Directory | ✅ Multi-step form + list/grid + detail + QR | ✅ §8 + §14 | ⚠️ Missing: bulk delete, retire/dispose actions, location cascade |
| Allocation & Transfer | ✅ Kanban + allocate + return + transfer | ✅ §8 + §15 + §16 | ⚠️ Missing: kanban grouped view, transfer detail |
| Resource Booking | ✅ Calendar + time slots + recurring + reschedule | ✅ §8 + §17 | ⚠️ Missing: recurring booking, my-bookings filtered, conflict-check |
| Maintenance | ✅ Pipeline + kanban + SLA + assign + resolve | ✅ §8 + §18 | ⚠️ Missing: comments thread, escalate action, SLA config |
| Audit | ✅ Cycles + checklist + discrepancy + close | ✅ §8 + §19 | ⚠️ Missing: audit item bulk update, auditor progress |
| Reports & Analytics | ✅ 6 chart types + heatmap + export | ✅ §21 (6 sub-routes) | ✅ Complete |
| Activity Logs & Notifications | ✅ Timeline + notification feed + mark-read | ✅ §8 + §22 | ⚠️ Missing: activity log filters, bulk mark-read, notification preferences |

---

## 🔴 MISSING ROUTES — Not in backend.md at all

These are routes the UI clearly needs but are **completely absent** from the backend spec:

### 1. Dashboard — Additional Data Endpoints

| Route | Method | Purpose | UI Reference |
|-------|--------|---------|--------------|
| `/api/dashboard/activity-feed` | GET | Recent activity timeline (8-10 items) for dashboard | Screen 2 — Left column activity feed |
| `/api/dashboard/utilization-chart` | GET | 30-day area chart data (asset utilization %) | Screen 2 — Right column Widget 1 |
| `/api/dashboard/upcoming-returns` | GET | Next 5 upcoming return dates | Screen 2 — Right column Widget 2 |
| `/api/dashboard/health-score` | GET | Fleet health percentage (donut chart) | Screen 2 — Bonus widget |

### 2. Departments — Missing Sub-Routes

| Route | Method | Purpose | UI Reference |
|-------|--------|---------|--------------|
| `/api/departments` | GET (list) | List all departments with employee count + asset count per card | Screen 3 Tab A — card grid |
| `/api/departments/:id/employees` | GET | Employees in a specific department | Screen 3 Tab A — footer badges |
| `/api/departments/:id/assets` | GET | Assets assigned to a department | Screen 3 Tab A — asset count badge |

### 3. Categories — Missing Sub-Routes

| Route | Method | Purpose | UI Reference |
|-------|--------|---------|--------------|
| `/api/categories/:id` | GET | Single category detail + custom fields | Screen 3 Tab B — right panel |
| `/api/categories/tree` | GET | Full hierarchical tree structure | Screen 3 Tab B — tree view |
| `/api/categories/:id/custom-fields` | GET | Custom fields for a category | Screen 4 — dynamic fields on registration |
| `/api/categories/:id/custom-fields` | POST | Add custom field to category | Screen 3 Tab B — custom field section |
| `/api/categories/:id/custom-fields/:fieldId` | DELETE | Remove custom field | Screen 3 Tab B — field management |

### 4. Assets — Missing Actions

| Route | Method | Purpose | UI Reference |
|-------|--------|---------|--------------|
| `/api/assets/:id/retire` | POST | Transition asset to "Retired" state | Screen 4 — detail page actions dropdown |
| `/api/assets/:id/dispose` | POST | Transition asset from Retired to "Disposed" | Screen 4 — detail page actions dropdown |
| `/api/assets/:id/mark-lost` | POST | Flag asset as "Lost" (outside audit) | Screen 4 — actions menu |
| `/api/assets/bulk-delete` | POST | Bulk delete selected assets | Screen 4 — bulk actions (implied) |
| `/api/assets/search` | GET | Advanced search (QR scan, serial, tag, category, location) | Screen 4 — search + ⌘K |
| `/api/locations` | GET | Buildings → Floors → Rooms cascade data | Screen 4 Step 2 — cascading selects |

### 5. Allocations — Missing Sub-Routes

| Route | Method | Purpose | UI Reference |
|-------|--------|---------|--------------|
| `/api/allocations/kanban` | GET | Grouped by status (Pending/Approved/Active/Overdue) for kanban | Screen 5 — Kanban board columns |
| `/api/allocations/:id/approve` | POST | Approve an allocation request (Dept Head flow) | Screen 5 — Approval Queue |

### 6. Transfers — Missing Detail

| Route | Method | Purpose | UI Reference |
|-------|--------|---------|--------------|
| `/api/transfers/:id` | GET | Single transfer request detail | Screen 5 — card expand/view |

### 7. Bookings — Missing Features

| Route | Method | Purpose | UI Reference |
|-------|--------|---------|--------------|
| `/api/bookings/check-availability` | POST | Real-time overlap validation before submit | Screen 6 — conflict check as user selects time |
| `/api/bookings/recurring` | POST | Create recurring booking series | Screen 6 — Recurring toggle in modal |
| `/api/bookings/my` | GET | Current user's bookings only (filtered shortcut) | Screen 6 — "My Bookings" tab |
| `/api/resources/:id/availability` | GET | Quick availability slots for a resource on a date | Screen 6 — suggested alternatives on conflict |

### 8. Maintenance — Missing Actions

| Route | Method | Purpose | UI Reference |
|-------|--------|---------|--------------|
| `/api/maintenance/:id/start` | POST | Technician starts work (In Progress) | Screen 7 — "Start Work" action |
| `/api/maintenance/:id/escalate` | POST | Escalate overdue/critical request | Screen 7 — row action "Escalate" |
| `/api/maintenance/:id/comments` | GET | Comments thread on a request | Screen 7 — detail panel comments |
| `/api/maintenance/:id/comments` | POST | Add comment to maintenance request | Screen 7 — mini chat in detail panel |

### 9. Audit — Missing Sub-Routes

| Route | Method | Purpose | UI Reference |
|-------|--------|---------|--------------|
| `/api/audit-cycles/:id/items` | GET | All items in a cycle (the checklist) | Screen 8 — checklist table |
| `/api/audit-cycles/:id/items/bulk-update` | PATCH | Bulk mark items as verified/discrepancy/missing | Screen 8 — bulk actions |
| `/api/audit-cycles/:id/progress` | GET | Progress stats (verified/total, per auditor) | Screen 8 — progress bar + KPI cards |
| `/api/audit-cycles/:id/summary` | GET | Historical summary for closed audits | Screen 8 — audit summary dashboard |

### 10. Notifications — Missing Features

| Route | Method | Purpose | UI Reference |
|-------|--------|---------|--------------|
| `/api/notifications/mark-all-read` | POST | Mark all notifications as read | Screen 10 — "Mark all as read" button |
| `/api/notifications/:id` | DELETE | Dismiss/delete a notification | Screen 10 — "×" dismiss button |
| `/api/notifications/preferences` | GET | Get notification preferences | Screen 10 — "Notification Preferences" link |
| `/api/notifications/preferences` | PATCH | Update notification preferences | Screen 10 — preferences page |

### 11. Activity Logs — Missing Filters

| Route | Method | Purpose | UI Reference |
|-------|--------|---------|--------------|
| `/api/activity-logs` | GET (enhanced) | Needs filters: actionType, userId, dateRange, entityType | Screen 10 — filter bar |
| `/api/activity-logs/export` | GET | Export activity logs as CSV/PDF | Screen 10 — export for compliance |

### 12. User Profile — Implied but Missing

| Route | Method | Purpose | UI Reference |
|-------|--------|---------|--------------|
| `/api/users/me/profile` | PATCH | Update own name/designation (not role) | Sidebar — user card settings gear |
| `/api/users/:id/assets` | GET | Assets currently assigned to a user | Screen 3 Tab C — slide-out "Assets Assigned" |
| `/api/users/:id/activity` | GET | Recent activity by a specific user | Screen 3 Tab C — slide-out "Recent Activity" |

---

## ✅ COMPLETE ROUTE LIST — All Routes Needed for Full UI

Below is the **master route list** combining existing backend.md routes + all missing routes identified above.

### Authentication (`/api/auth`)

| # | Method | Route | Auth | Role Guard | Purpose |
|---|--------|-------|------|-----------|---------|
| 1 | POST | `/api/auth/signup` | Public | — | Create employee account + auto-login |
| 2 | POST | `/api/auth/login` | Public | — | Login with email + password |
| 3 | POST | `/api/auth/refresh` | rt cookie | — | Rotate refresh token, mint new access token |
| 4 | POST | `/api/auth/logout` | rt cookie | — | Revoke refresh token, clear cookies |
| 5 | GET | `/api/auth/me` | at cookie | — | Get current user (rehydrate AuthContext) |
| 6 | POST | `/api/auth/forgot-password` | Public | — | Send 6-digit OTP via email |
| 7 | POST | `/api/auth/reset-password` | Public | — | Verify OTP + set new password (atomic) |
| 8 | POST | `/api/auth/change-password` | at cookie | — | Change own password (logged in) |


### Dashboard (`/api/dashboard`)

| # | Method | Route | Auth | Role Guard | Scope | Purpose |
|---|--------|-------|------|-----------|-------|---------|
| 9 | GET | `/api/dashboard/kpis` | at | — | Employee→own, DeptHead→dept, Admin/AM→all | 6 KPI values for dashboard cards |
| 10 | GET | `/api/dashboard/overdue` | at | — | Same scoping | Overdue returns + overdue bookings |
| 11 | GET | `/api/dashboard/activity-feed` | at | — | Same scoping | Recent 10 activity entries for timeline |
| 12 | GET | `/api/dashboard/utilization-chart` | at | — | Same scoping | 30-day utilization % trend data |
| 13 | GET | `/api/dashboard/upcoming-returns` | at | — | Same scoping | Next 5 upcoming asset returns |
| 14 | GET | `/api/dashboard/health-score` | at | — | Same scoping | Fleet health % (donut chart value) |

### Organization — Departments (`/api/departments`)

| # | Method | Route | Auth | Role Guard | Purpose |
|---|--------|-------|------|-----------|---------|
| 15 | GET | `/api/departments` | at | — | List all departments (with employeeCount, assetCount, head info) |
| 16 | GET | `/api/departments/:id` | at | — | Single department detail |
| 17 | POST | `/api/departments` | at | ADMIN | Create new department |
| 18 | PATCH | `/api/departments/:id` | at | ADMIN | Update department (name, head, parent, status) |
| 19 | DELETE | `/api/departments/:id` | at | ADMIN | Delete/deactivate department |
| 20 | GET | `/api/departments/:id/employees` | at | — | List employees in a department |
| 21 | GET | `/api/departments/:id/assets` | at | — | List assets assigned to a department |

### Organization — Asset Categories (`/api/categories`)

| # | Method | Route | Auth | Role Guard | Purpose |
|---|--------|-------|------|-----------|---------|
| 22 | GET | `/api/categories` | at | — | List all categories (flat or nested) |
| 23 | GET | `/api/categories/tree` | at | — | Full hierarchical tree with child counts |
| 24 | GET | `/api/categories/:id` | at | — | Single category + its custom fields |
| 25 | POST | `/api/categories` | at | ADMIN | Create category (name, parent, icon) |
| 26 | PATCH | `/api/categories/:id` | at | ADMIN | Update category |
| 27 | DELETE | `/api/categories/:id` | at | ADMIN | Delete category |
| 28 | POST | `/api/categories/:id/custom-fields` | at | ADMIN | Add custom field to category |
| 29 | DELETE | `/api/categories/:id/custom-fields/:fieldId` | at | ADMIN | Remove custom field |

### Organization — Users / Employee Directory (`/api/users`)

| # | Method | Route | Auth | Role Guard | Purpose |
|---|--------|-------|------|-----------|---------|
| 30 | GET | `/api/users` | at | ADMIN | List all users (paginated, filterable) |
| 31 | PATCH | `/api/users/:id/role` | at | ADMIN | Promote/change role (the ONLY promotion path) |
| 32 | PATCH | `/api/users/:id/department` | at | ADMIN | Assign/change department |
| 33 | PATCH | `/api/users/:id/status` | at | ADMIN | Activate/deactivate user |
| 34 | GET | `/api/users/:id/assets` | at | ADMIN | Assets currently assigned to user |
| 35 | GET | `/api/users/:id/activity` | at | ADMIN | Recent activity by user (last 5) |
| 36 | PATCH | `/api/users/me/profile` | at | — | Update own name/designation |

### Assets (`/api/assets`)

| # | Method | Route | Auth | Role Guard | Scope | Purpose |
|---|--------|-------|------|-----------|-------|---------|
| 37 | GET | `/api/assets` | at | — | DeptHead→dept, Employee→own | List/search assets (paginated, filterable by category, status, dept, date) |
| 38 | GET | `/api/assets/search` | at | — | Same | Advanced search (QR, serial, tag, name) |
| 39 | GET | `/api/assets/:id` | at | — | Same | Full asset detail |
| 40 | POST | `/api/assets` | at | ADMIN, ASSET_MANAGER | — | Register new asset (multi-step data) |
| 41 | PATCH | `/api/assets/:id` | at | ADMIN, ASSET_MANAGER | — | Update asset fields |
| 42 | GET | `/api/assets/:id/history` | at | — | Same | Full lifecycle history (allocations + maintenance) |
| 43 | POST | `/api/assets/:id/documents` | at | ADMIN, ASSET_MANAGER | — | Upload document/photo (multipart) |
| 44 | GET | `/api/assets/:id/qr` | at | — | — | Generate/get QR code for asset |
| 45 | POST | `/api/assets/:id/retire` | at | ADMIN, ASSET_MANAGER | — | Transition to Retired status |
| 46 | POST | `/api/assets/:id/dispose` | at | ADMIN, ASSET_MANAGER | — | Transition from Retired to Disposed |
| 47 | POST | `/api/assets/:id/mark-lost` | at | ADMIN, ASSET_MANAGER | — | Flag asset as Lost |
| 48 | POST | `/api/assets/bulk-delete` | at | ADMIN | — | Delete multiple assets |
| 49 | GET | `/api/locations` | at | — | — | Buildings → Floors → Rooms cascading data |

### Allocations (`/api/allocations`)

| # | Method | Route | Auth | Role Guard | Scope | Purpose |
|---|--------|-------|------|-----------|-------|---------|
| 50 | GET | `/api/allocations` | at | — | Employee→own, DeptHead→dept | List allocations (filterable) |
| 51 | GET | `/api/allocations/kanban` | at | — | Same | Grouped by status for kanban columns |
| 52 | GET | `/api/allocations/overdue` | at | — | Same | Overdue allocations list |
| 53 | GET | `/api/allocations/:id` | at | — | Same | Single allocation detail |
| 54 | POST | `/api/allocations` | at | ADMIN, ASSET_MANAGER | — | Create allocation (assign asset to employee) |
| 55 | POST | `/api/allocations/:id/return` | at | — | Holder only | Initiate return (condition check-in) |
| 56 | POST | `/api/allocations/:id/return/approve` | at | ASSET_MANAGER | — | Approve return |
| 57 | POST | `/api/allocations/:id/approve` | at | ASSET_MANAGER, DEPT_HEAD | requireOwnDepartment | Approve allocation request |

### Transfers (`/api/transfers`)

| # | Method | Route | Auth | Role Guard | Scope | Purpose |
|---|--------|-------|------|-----------|-------|---------|
| 58 | GET | `/api/transfers` | at | — | Employee→own, DeptHead→dept | List transfer requests |
| 59 | GET | `/api/transfers/:id` | at | — | Same | Single transfer detail |
| 60 | POST | `/api/transfers` | at | — | — | Create transfer request |
| 61 | POST | `/api/transfers/:id/approve` | at | ASSET_MANAGER, DEPT_HEAD | requireOwnDepartment | Approve transfer |
| 62 | POST | `/api/transfers/:id/reject` | at | ASSET_MANAGER, DEPT_HEAD | requireOwnDepartment | Reject transfer (with reason) |

### Resource Booking (`/api/bookings` + `/api/resources`)

| # | Method | Route | Auth | Role Guard | Scope | Purpose |
|---|--------|-------|------|-----------|-------|---------|
| 63 | GET | `/api/resources` | at | — | — | List bookable resources (isBookable=true assets) |
| 64 | GET | `/api/resources/:id/calendar` | at | — | — | Calendar view for a resource (from/to query) |
| 65 | GET | `/api/resources/:id/availability` | at | — | — | Available slots for a resource on a date |
| 66 | GET | `/api/bookings` | at | — | Employee→own, DeptHead→dept | List bookings (filterable) |
| 67 | GET | `/api/bookings/my` | at | — | Own only | Current user's bookings shortcut |
| 68 | GET | `/api/bookings/:id` | at | — | Owner or DeptHead | Single booking detail |
| 69 | POST | `/api/bookings` | at | — | — | Create booking |
| 70 | POST | `/api/bookings/recurring` | at | — | — | Create recurring booking series |
| 71 | POST | `/api/bookings/check-availability` | at | — | — | Real-time overlap validation |
| 72 | POST | `/api/bookings/:id/cancel` | at | — | Owner or DeptHead | Cancel booking |
| 73 | POST | `/api/bookings/:id/reschedule` | at | — | Owner or DeptHead | Reschedule booking |

### Maintenance (`/api/maintenance`)

| # | Method | Route | Auth | Role Guard | Scope | Purpose |
|---|--------|-------|------|-----------|-------|---------|
| 74 | GET | `/api/maintenance` | at | — | Employee→own, DeptHead→dept | List maintenance requests (filter: status, priority, assetId) |
| 75 | GET | `/api/maintenance/:id` | at | — | Same | Single request detail + asset history |
| 76 | POST | `/api/maintenance` | at | — | — | Raise new maintenance request |
| 77 | POST | `/api/maintenance/:id/approve` | at | ASSET_MANAGER | — | Approve request (asset → Under Maintenance) |
| 78 | POST | `/api/maintenance/:id/reject` | at | ASSET_MANAGER | — | Reject request (with reason) |
| 79 | POST | `/api/maintenance/:id/assign` | at | ASSET_MANAGER | — | Assign technician |
| 80 | POST | `/api/maintenance/:id/start` | at | — | Assigned technician | Start work (In Progress) |
| 81 | POST | `/api/maintenance/:id/resolve` | at | — | Assigned technician | Mark resolved (asset → Available) |
| 82 | POST | `/api/maintenance/:id/escalate` | at | ASSET_MANAGER | — | Escalate overdue/critical request |
| 83 | GET | `/api/maintenance/:id/comments` | at | — | Same | Get comments thread |
| 84 | POST | `/api/maintenance/:id/comments` | at | — | — | Add comment to request |

### Audit (`/api/audit-cycles`)

| # | Method | Route | Auth | Role Guard | Scope | Purpose |
|---|--------|-------|------|-----------|-------|---------|
| 85 | GET | `/api/audit-cycles` | at | — | DeptHead→dept | List all audit cycles |
| 86 | GET | `/api/audit-cycles/:id` | at | — | Same | Cycle detail + checklist summary |
| 87 | POST | `/api/audit-cycles` | at | ADMIN | — | Create new audit cycle |
| 88 | POST | `/api/audit-cycles/:id/auditors` | at | ADMIN | — | Assign auditors to cycle |
| 89 | GET | `/api/audit-cycles/:id/items` | at | — | Same | Full checklist items for the cycle |
| 90 | PATCH | `/api/audit-cycles/:id/items/:itemId` | at | — | Assigned auditor | Mark item (verified/discrepancy/missing + notes) |
| 91 | PATCH | `/api/audit-cycles/:id/items/bulk-update` | at | — | Assigned auditor | Bulk mark items |
| 92 | GET | `/api/audit-cycles/:id/progress` | at | — | Same | Progress stats (verified/total, per auditor) |
| 93 | GET | `/api/audit-cycles/:id/discrepancy-report` | at | — | Same | Auto-generated discrepancy report |
| 94 | GET | `/api/audit-cycles/:id/summary` | at | — | Same | Historical summary (for closed audits) |
| 95 | POST | `/api/audit-cycles/:id/close` | at | ADMIN | — | Close cycle (lock + auto-update statuses) |

### Reports (`/api/reports`)

| # | Method | Route | Auth | Role Guard | Scope | Purpose |
|---|--------|-------|------|-----------|-------|---------|
| 96 | GET | `/api/reports/utilization` | at | ADMIN, AM, DEPT_HEAD | DeptHead→dept | Most used vs idle assets |
| 97 | GET | `/api/reports/maintenance-frequency` | at | ADMIN, AM, DEPT_HEAD | Same | Breakdown by category |
| 98 | GET | `/api/reports/due-for-maintenance` | at | ADMIN, AM, DEPT_HEAD | Same | Assets nearing retirement/service |
| 99 | GET | `/api/reports/allocation-summary` | at | ADMIN, AM, DEPT_HEAD | Same | By department allocation counts |
| 100 | GET | `/api/reports/booking-heatmap` | at | ADMIN, AM, DEPT_HEAD | Same | Peak usage time × day grid |
| 101 | GET | `/api/reports/export` | at | ADMIN, AM, DEPT_HEAD | Same | Export as CSV/PDF/XLSX |

### Notifications (`/api/notifications`)

| # | Method | Route | Auth | Role Guard | Scope | Purpose |
|---|--------|-------|------|-----------|-------|---------|
| 102 | GET | `/api/notifications` | at | — | Own only | List user's notifications |
| 103 | PATCH | `/api/notifications/:id/read` | at | — | Owner | Mark single notification as read |
| 104 | POST | `/api/notifications/mark-all-read` | at | — | Own only | Mark all as read |
| 105 | DELETE | `/api/notifications/:id` | at | — | Owner | Dismiss/delete notification |
| 106 | GET | `/api/notifications/preferences` | at | — | Own only | Get notification settings |
| 107 | PATCH | `/api/notifications/preferences` | at | — | Own only | Update notification settings |

### Activity Logs (`/api/activity-logs`)

| # | Method | Route | Auth | Role Guard | Scope | Purpose |
|---|--------|-------|------|-----------|-------|---------|
| 108 | GET | `/api/activity-logs` | at | ADMIN | — | Full activity log (filterable: actionType, userId, dateRange) |
| 109 | GET | `/api/activity-logs/export` | at | ADMIN | — | Export logs as CSV/PDF |

---

## 📋 DETAILED SPECS FOR MISSING ROUTES

Below are request/response details for routes that need to be built but aren't documented in backend.md.

---

### `/api/dashboard/activity-feed`

**Method:** GET  
**Auth:** requires valid `at`  
**Scope:** Employee → own actions only, Dept Head → department, Admin/AM → org-wide  
**Query params:** `limit` (default 10)

**200 OK**
```json
{
  "success": true,
  "message": "Activity feed fetched",
  "data": {
    "activities": [
      {
        "id": "act-1",
        "type": "ALLOCATION",
        "icon": "package",
        "color": "green",
        "description": "Priya Sharma allocated MacBook Pro M3 to Arjun Mehta",
        "entities": {
          "user": { "id": "u1", "name": "Priya Sharma" },
          "asset": { "id": "a1", "tag": "AF-0001", "name": "MacBook Pro M3" },
          "target": { "id": "u2", "name": "Arjun Mehta" }
        },
        "createdAt": "2026-07-12T08:30:00Z",
        "relativeTime": "2 hours ago"
      }
    ]
  }
}
```

---

### `/api/dashboard/utilization-chart`

**Method:** GET  
**Auth:** requires valid `at`  
**Query params:** `days` (default 30)

**200 OK**
```json
{
  "success": true,
  "message": "Utilization data fetched",
  "data": {
    "dataPoints": [
      { "date": "2026-06-12", "utilization": 72 },
      { "date": "2026-06-13", "utilization": 75 }
    ]
  }
}
```

---

### `/api/dashboard/upcoming-returns`

**Method:** GET  
**Auth:** requires valid `at`  
**Query params:** `limit` (default 5)

**200 OK**
```json
{
  "success": true,
  "message": "Upcoming returns fetched",
  "data": {
    "returns": [
      {
        "allocationId": "alloc-5",
        "asset": { "tag": "AF-0021", "name": "Dell XPS 15" },
        "holder": { "id": "u3", "name": "Vikram Singh", "avatar": null },
        "expectedReturnDate": "2026-07-14",
        "status": "ON_TIME"
      },
      {
        "allocationId": "alloc-8",
        "asset": { "tag": "AF-0033", "name": "iPad Pro" },
        "holder": { "id": "u5", "name": "Rohit Joshi", "avatar": null },
        "expectedReturnDate": "2026-07-09",
        "status": "OVERDUE",
        "daysOverdue": 3
      }
    ]
  }
}
```

---

### `/api/dashboard/health-score`

**Method:** GET  
**Auth:** requires valid `at`

**200 OK**
```json
{
  "success": true,
  "message": "Health score fetched",
  "data": {
    "score": 82,
    "label": "Good standing",
    "breakdown": {
      "availableRatio": 0.85,
      "maintenanceBacklog": 0.92,
      "auditCompliance": 0.78,
      "overdueRate": 0.03
    }
  }
}
```

---

### `/api/categories/tree`

**Method:** GET  
**Auth:** requires valid `at`

**200 OK**
```json
{
  "success": true,
  "message": "Category tree fetched",
  "data": {
    "tree": [
      {
        "id": "cat-1",
        "name": "IT",
        "icon": "laptop",
        "assetCount": 127,
        "children": [
          { "id": "cat-1a", "name": "Laptops", "assetCount": 42, "children": [] },
          { "id": "cat-1b", "name": "Desktops", "assetCount": 18, "children": [] },
          { "id": "cat-1c", "name": "Peripherals", "assetCount": 67, "children": [] }
        ]
      },
      {
        "id": "cat-2",
        "name": "Furniture",
        "icon": "armchair",
        "assetCount": 95,
        "children": [
          { "id": "cat-2a", "name": "Desks", "assetCount": 45, "children": [] },
          { "id": "cat-2b", "name": "Chairs", "assetCount": 50, "children": [] }
        ]
      }
    ]
  }
}
```

---

### `/api/categories/:id/custom-fields` (POST)

**Method:** POST  
**Auth:** ADMIN only

**Request**
```json
{
  "label": "Warranty Period (months)",
  "key": "warrantyPeriod",
  "type": "number",
  "required": true
}
```

Field types: `text` | `number` | `date` | `select`  
For `select` type, include `"options": ["Petrol", "Diesel", "Electric"]`

**201 Created**
```json
{
  "success": true,
  "message": "Custom field added",
  "data": {
    "field": { "id": "cf-12", "label": "Warranty Period (months)", "key": "warrantyPeriod", "type": "number", "required": true }
  }
}
```

---

### `/api/assets/:id/retire`

**Method:** POST  
**Auth:** ADMIN, ASSET_MANAGER

**Request**
```json
{
  "reason": "End of life — 5 years old, multiple repairs",
  "retirementDate": "2026-07-12"
}
```

**200 OK**
```json
{
  "success": true,
  "message": "Asset retired",
  "data": { "asset": { "id": "a8", "tag": "AF-0008", "status": "RETIRED" } }
}
```

**Errors:**
- `400 Asset must be Available to retire` — can't retire if currently allocated
- `404 Asset not found`

---

### `/api/assets/:id/dispose`

**Method:** POST  
**Auth:** ADMIN, ASSET_MANAGER

**Request**
```json
{
  "method": "Sold",
  "notes": "Sold to vendor for ₹5,000 salvage value",
  "disposalDate": "2026-07-12"
}
```

**200 OK**
```json
{
  "success": true,
  "message": "Asset disposed",
  "data": { "asset": { "id": "a8", "tag": "AF-0008", "status": "DISPOSED" } }
}
```

**Errors:**
- `400 Asset must be Retired before disposal`

---

### `/api/locations`

**Method:** GET  
**Auth:** requires valid `at`

**200 OK**
```json
{
  "success": true,
  "message": "Locations fetched",
  "data": {
    "locations": [
      {
        "id": "loc-1",
        "building": "Nexora Tower, BKC",
        "city": "Mumbai",
        "floors": [
          {
            "id": "f-1",
            "name": "Floor 1",
            "rooms": [
              { "id": "r-1", "name": "Room 101" },
              { "id": "r-2", "name": "Room 102" }
            ]
          }
        ]
      }
    ]
  }
}
```

---

### `/api/allocations/kanban`

**Method:** GET  
**Auth:** requires valid `at`  
**Scope:** Employee → own, Dept Head → dept, Admin/AM → all

**200 OK**
```json
{
  "success": true,
  "message": "Kanban data fetched",
  "data": {
    "columns": {
      "PENDING": {
        "count": 3,
        "items": [
          { "id": "alloc-10", "asset": "MacBook Pro", "assetTag": "AF-0001", "requester": "Arjun Mehta", "priority": "HIGH", "date": "2026-07-11" }
        ]
      },
      "APPROVED": { "count": 2, "items": [] },
      "ACTIVE": { "count": 15, "items": [] },
      "OVERDUE": { "count": 4, "items": [] }
    }
  }
}
```

---

### `/api/bookings/check-availability`

**Method:** POST  
**Auth:** requires valid `at`

**Request**
```json
{
  "resourceId": "res-1",
  "date": "2026-07-14",
  "startTime": "09:30",
  "endTime": "10:30"
}
```

**200 OK (available)**
```json
{
  "success": true,
  "message": "Slot is available",
  "data": { "available": true }
}
```

**200 OK (conflict)**
```json
{
  "success": true,
  "message": "Slot conflicts with existing booking",
  "data": {
    "available": false,
    "conflict": {
      "bookedBy": "Arjun Mehta",
      "start": "09:00",
      "end": "10:00"
    },
    "alternatives": [
      { "resourceId": "res-3", "resourceName": "Room 3B", "start": "09:30", "end": "10:30" },
      { "resourceId": "res-1", "resourceName": "Room B2", "start": "10:00", "end": "11:00" }
    ]
  }
}
```

---

### `/api/bookings/recurring`

**Method:** POST  
**Auth:** requires valid `at`

**Request**
```json
{
  "resourceId": "res-1",
  "startTime": "09:00",
  "endTime": "10:00",
  "purpose": "Sprint Planning",
  "frequency": "WEEKLY",
  "startDate": "2026-07-14",
  "endDate": "2026-09-14",
  "attendees": ["u1", "u2", "u3"]
}
```

**201 Created**
```json
{
  "success": true,
  "message": "Recurring booking created (10 slots)",
  "data": {
    "seriesId": "series-1",
    "bookingsCreated": 10,
    "conflicts": []
  }
}
```

---

### `/api/maintenance/:id/start`

**Method:** POST  
**Auth:** requires valid `at`  
**Guard:** Must be the assigned technician

**Request:** none (or optional `{ "notes": "Starting inspection" }`)

**200 OK**
```json
{
  "success": true,
  "message": "Work started",
  "data": { "request": { "id": "mr-3", "status": "IN_PROGRESS", "startedAt": "2026-07-12T09:00:00Z" } }
}
```

**Errors:**
- `403 Only the assigned technician can start work`
- `400 Request must be in ASSIGNED status`

---

### `/api/maintenance/:id/escalate`

**Method:** POST  
**Auth:** ASSET_MANAGER

**Request**
```json
{
  "reason": "SLA breached — critical equipment down for 48 hours",
  "escalateTo": "ADMIN"
}
```

**200 OK**
```json
{
  "success": true,
  "message": "Request escalated",
  "data": { "request": { "id": "mr-2", "status": "ESCALATED", "priority": "CRITICAL" } }
}
```

---

### `/api/maintenance/:id/comments`

**Method:** GET  
**Auth:** requires valid `at`

**200 OK**
```json
{
  "success": true,
  "message": "Comments fetched",
  "data": {
    "comments": [
      { "id": "c1", "author": { "id": "u1", "name": "Priya Sharma", "role": "ASSET_MANAGER" }, "text": "Technician assigned. ETA: 2 hours.", "createdAt": "2026-07-11T14:00:00Z" },
      { "id": "c2", "author": { "id": "u4", "name": "R. Varma", "role": "EMPLOYEE" }, "text": "Part ordered, will arrive tomorrow.", "createdAt": "2026-07-11T16:30:00Z" }
    ]
  }
}
```

**Method:** POST  
**Request:** `{ "text": "Resolved. Replaced the bulb." }`  
**201 Created** → `{ "success": true, "message": "Comment added", "data": { "comment": { … } } }`

---

### `/api/audit-cycles/:id/items`

**Method:** GET  
**Auth:** requires valid `at`  
**Query params:** `status` (ALL/VERIFIED/DISCREPANCY/MISSING/PENDING), `q` (search)

**200 OK**
```json
{
  "success": true,
  "message": "Audit items fetched",
  "data": {
    "items": [
      {
        "id": "item-1",
        "asset": { "id": "a1", "tag": "AF-0001", "name": "MacBook Pro", "serial": "NX-LAP-2024-0042" },
        "expectedLocation": "Mumbai HQ, Floor 3, Room 301",
        "currentStatus": "ALLOCATED",
        "verification": "PENDING",
        "notes": null,
        "photo": null,
        "verifiedBy": null
      }
    ],
    "total": 120,
    "verified": 45,
    "discrepancy": 3,
    "missing": 2,
    "pending": 70
  }
}
```

---

### `/api/audit-cycles/:id/items/bulk-update`

**Method:** PATCH  
**Auth:** Assigned auditor on the cycle

**Request**
```json
{
  "itemIds": ["item-1", "item-2", "item-3"],
  "verification": "VERIFIED",
  "notes": "All found at expected location"
}
```

**200 OK**
```json
{
  "success": true,
  "message": "3 items updated",
  "data": { "updatedCount": 3 }
}
```

---

### `/api/audit-cycles/:id/progress`

**Method:** GET  
**Auth:** requires valid `at`

**200 OK**
```json
{
  "success": true,
  "message": "Progress fetched",
  "data": {
    "total": 120,
    "verified": 80,
    "discrepancy": 5,
    "missing": 2,
    "pending": 33,
    "completionPercent": 67,
    "byAuditor": [
      { "auditor": { "id": "u1", "name": "Priya Sharma" }, "assigned": 60, "completed": 45 },
      { "auditor": { "id": "u5", "name": "Rohit Joshi" }, "assigned": 60, "completed": 35 }
    ]
  }
}
```

---

### `/api/notifications/mark-all-read`

**Method:** POST  
**Auth:** requires valid `at`  
**Scope:** Own notifications only

**200 OK**
```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": { "updatedCount": 12 }
}
```

---

### `/api/activity-logs` (Enhanced Query Params)

The existing route in backend.md needs these **additional query parameters** to support Screen 10's filter bar:

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `page` | int | 1 | Pagination |
| `limit` | int | 25 | max 100 |
| `actionType` | string | — | Filter: ALLOCATION, RETURN, MAINTENANCE, AUDIT, BOOKING, USER_CHANGE, SYSTEM |
| `userId` | UUID | — | Filter by actor |
| `entityType` | string | — | Filter: ASSET, USER, BOOKING, MAINTENANCE, AUDIT |
| `from` | date | — | Date range start |
| `to` | date | — | Date range end |

---

### `/api/activity-logs/export`

**Method:** GET  
**Auth:** ADMIN  
**Query:** `format` (csv|pdf), `from`, `to`, `actionType`

**200 OK** → Binary file stream (Content-Disposition: attachment)

---

## 🗄️ DATABASE TABLES — Additional Tables Needed

The backend.md defines: `departments`, `users`, `password_reset_otps`, `refresh_tokens`.

**Still needed for the full app:**

| Table | Purpose |
|-------|---------|
| `asset_categories` | Categories with parent_id for tree, icon |
| `category_custom_fields` | Custom fields per category (label, key, type, required, options) |
| `locations` | Buildings with city |
| `floors` | Floors per building |
| `rooms` | Rooms per floor |
| `assets` | Core asset table (tag, name, serial, category_id, status, condition, location, is_bookable, etc.) |
| `asset_custom_field_values` | Stores custom field values per asset |
| `asset_documents` | Uploaded files per asset (url, type, filename) |
| `allocations` | Asset allocations (asset_id, holder_id, allocated_by, expected_return, actual_return, condition_on_return, status) |
| `transfer_requests` | Transfer workflow (asset_id, from_user, to_user, reason, status, approved_by) |
| `bookings` | Resource bookings (resource_id, booked_by, date, start_time, end_time, purpose, status, series_id) |
| `booking_series` | Recurring booking series metadata |
| `maintenance_requests` | Requests (asset_id, raised_by, issue_type, priority, status, technician_id, resolution_notes, cost) |
| `maintenance_comments` | Comments thread per request |
| `audit_cycles` | Cycles (name, scope_type, start_date, end_date, status) |
| `audit_cycle_departments` | Departments included in a cycle |
| `audit_cycle_auditors` | Auditors assigned (cycle_id, user_id) |
| `audit_items` | Per-asset checklist rows (cycle_id, asset_id, verification, notes, photo_url, verified_by) |
| `notifications` | User notifications (user_id, type, title, message, read, entity_id) |
| `activity_logs` | Full audit trail (actor_id, action_type, entity_type, entity_id, description, metadata) |
| `notification_preferences` | Per-user settings (email, in_app toggles per notification type) |

---

## 📊 TOTAL ROUTE COUNT

| Category | Routes in backend.md | Missing Routes | Total Needed |
|----------|---------------------|----------------|--------------|
| Auth | 8 | 0 | **8** |
| Dashboard | 2 | 4 | **6** |
| Departments | 4 (CRUD + detail) | 2 (sub-resources) | **7** |
| Categories | 4 (CRUD + list) | 4 (tree, detail, custom fields) | **8** |
| Users | 4 | 3 (profile, user assets, user activity) | **7** |
| Assets | 6 (CRUD + history + docs + QR) | 5 (retire, dispose, lost, bulk, locations, search) | **13** |
| Allocations | 5 (CRUD + return + overdue) | 2 (kanban, approve) | **8** |
| Transfers | 3 (create + approve + list) | 2 (detail, reject) | **5** |
| Bookings | 7 (CRUD + cancel + reschedule + resources + calendar) | 4 (check, recurring, my, availability) | **11** |
| Maintenance | 6 (CRUD + approve + reject + assign + resolve) | 4 (start, escalate, comments) | **11** |
| Audit | 6 (CRUD + auditors + items + close + discrepancy) | 4 (items list, bulk, progress, summary) | **11** |
| Reports | 6 | 0 | **6** |
| Notifications | 2 (list + mark-read) | 4 (mark-all, delete, preferences) | **6** |
| Activity Logs | 1 | 1 (export) | **2** |
| **TOTAL** | **64** | **45** | **109** |

---

## 🎯 PRIORITY ORDER FOR IMPLEMENTATION

### Phase 1 — Core (Must have for basic demo)
1. Auth (already done in backend.md) ✅
2. Departments CRUD + list
3. Categories CRUD + tree + custom fields
4. Assets full CRUD + search + documents + QR
5. Allocations + returns
6. Dashboard KPIs + activity feed

### Phase 2 — Workflows
7. Transfers (request + approve + reject)
8. Bookings (create + calendar + check-availability + cancel + reschedule)
9. Maintenance (full pipeline: raise → approve → assign → start → resolve)
10. Notifications (list + mark-read + mark-all)

### Phase 3 — Advanced
11. Audit cycles (create → assign → verify → close → discrepancy report)
12. Reports (all 6 sub-routes + export)
13. Activity logs (full + export)
14. Recurring bookings
15. Maintenance comments + escalation

### Phase 4 — Polish
16. Locations cascade
17. Asset retire/dispose/mark-lost
18. Notification preferences
19. User profile update
20. Bulk operations (assets, audit items)

---

*This document serves as the single source of truth for all API routes needed to fully implement the AssetFlow UI. Backend developers should implement routes in priority order and match the response envelope from backend.md §1.*
