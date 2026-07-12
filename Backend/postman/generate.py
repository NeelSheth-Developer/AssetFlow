#!/usr/bin/env python3
"""Generate the AssetFlow Postman collection covering all 110 API endpoints."""
import json, os

BASE = "{{baseUrl}}"

def q(desc, value=""):
    return {"desc": desc, "value": value}

# Each endpoint: (name, method, path, roles, description, query, body)
# path uses :param style; we convert to {{var}} where a collection var exists.
# body is a python dict (raw JSON) or None. query is list of (key, value, desc, disabled).

folders = []

def folder(name, description, items):
    folders.append({"name": name, "description": description, "items": items})

def ep(name, method, path, roles, description, query=None, body=None, form=None, note=None):
    return {
        "name": name, "method": method, "path": path, "roles": roles,
        "description": description, "query": query or [], "body": body,
        "form": form, "note": note,
    }

# ---------------- Auth ----------------
folder("Auth", "Authentication & session. Login/signup set HttpOnly `at` and `rt` cookies which Postman's cookie jar stores automatically — subsequent requests are authenticated with no manual token handling.", [
    ep("Signup", "POST", "/api/auth/signup", "Public",
       "Register a new account. Role is always EMPLOYEE (any `role` in the body is ignored). Logs in immediately (sets cookies).",
       body={"name": "Jane Doe", "email": "jane.doe@gmail.com", "password": "Str0ng!Pass"}),
    ep("Login", "POST", "/api/auth/login", "Public",
       "Log in. Sets `at` (15m) + `rt` (7d) HttpOnly cookies. Run this first — everything else reuses the cookie.",
       body={"email": "jane.doe@gmail.com", "password": "Str0ng!Pass"}),
    ep("Refresh session", "POST", "/api/auth/refresh", "Public (rt cookie)",
       "Rotates the refresh token and mints a new access token. Uses the `rt` cookie; no body."),
    ep("Logout", "POST", "/api/auth/logout", "Public",
       "Revokes the current refresh token and clears both cookies. Always 200."),
    ep("Get current user (me)", "GET", "/api/auth/me", "Authenticated",
       "Returns the logged-in user with fresh role/department read from the DB."),
    ep("Forgot password", "POST", "/api/auth/forgot-password", "Public",
       "Emails a 6-digit OTP. Always returns a generic 200 (anti-enumeration). Rate-limited to 1/60s.",
       body={"email": "jane.doe@gmail.com"}),
    ep("Reset password", "POST", "/api/auth/reset-password", "Public",
       "Consumes the OTP and sets a new password in one atomic call. Revokes all sessions.",
       body={"email": "jane.doe@gmail.com", "otp": "123456", "newPassword": "N3w!Password"}),
    ep("Change password", "POST", "/api/auth/change-password", "Authenticated",
       "Change password while logged in. Current session survives; all others are revoked.",
       body={"currentPassword": "Str0ng!Pass", "newPassword": "N3w!Password"}),
])

# ---------------- Users ----------------
folder("Users", "Employee directory. `PATCH /me/profile` is self-service for any user; everything else is Admin-only.", [
    ep("Update my profile", "PATCH", "/api/users/me/profile", "Authenticated",
       "Update your own name and/or designation. Cannot change role.",
       body={"name": "Jane D.", "designation": "Senior Analyst"}),
    ep("List users", "GET", "/api/users", "Admin",
       "Paginated directory with filters.",
       query=[("page", "1", "Page number", False), ("limit", "20", "Page size (max 100)", False),
              ("q", "", "Search name or email", True), ("role", "", "ADMIN | ASSET_MANAGER | DEPT_HEAD | EMPLOYEE", True),
              ("departmentId", "{{departmentId}}", "Filter by department", True),
              ("status", "", "ACTIVE | INACTIVE", True)]),
    ep("Get user's assets", "GET", "/api/users/:id/assets", "Admin",
       "Assets currently held by a user."),
    ep("Get user's activity", "GET", "/api/users/:id/activity", "Admin",
       "Recent activity by a user.",
       query=[("limit", "5", "Max rows (max 20)", False)]),
    ep("Change user role", "PATCH", "/api/users/:id/role", "Admin",
       "Promote/demote a user. ADMIN is never accepted. DEPT_HEAD requires a department first. Cannot change your own role.",
       body={"role": "ASSET_MANAGER"}),
    ep("Assign / unassign department", "PATCH", "/api/users/:id/department", "Admin",
       "Set a user's department (or null to unassign). Cannot unassign a Dept Head.",
       body={"departmentId": "{{departmentId}}"}),
    ep("Set user status", "PATCH", "/api/users/:id/status", "Admin",
       "Activate/deactivate. Deactivating revokes all their refresh tokens. Cannot deactivate yourself.",
       body={"status": "INACTIVE"}),
])

# ---------------- Departments ----------------
folder("Departments", "Organization setup. Reads: any authenticated user. Writes: Admin only.", [
    ep("List departments", "GET", "/api/departments", "Authenticated", "All departments with employee & asset counts."),
    ep("Get department", "GET", "/api/departments/:id", "Authenticated", "Single department detail."),
    ep("Get department employees", "GET", "/api/departments/:id/employees", "Authenticated", "Members of a department."),
    ep("Get department assets", "GET", "/api/departments/:id/assets", "Authenticated", "Assets owned by a department."),
    ep("Create department", "POST", "/api/departments", "Admin",
       "Create a department. headId/parentId optional.",
       body={"name": "Engineering", "headId": None, "parentId": None}),
    ep("Update department", "PATCH", "/api/departments/:id", "Admin",
       "Partial update. A department cannot be its own parent.",
       body={"name": "R&D", "headId": "{{userId}}", "parentId": None, "status": "ACTIVE"}),
    ep("Delete department", "DELETE", "/api/departments/:id", "Admin",
       "Delete. Users' department_id is set NULL. Fails if it has child departments."),
])

# ---------------- Categories ----------------
folder("Categories", "Asset categories with per-category custom fields. Reads: any user. Writes: Admin only.", [
    ep("List categories", "GET", "/api/categories", "Authenticated", "Flat list with asset counts."),
    ep("Category tree", "GET", "/api/categories/tree", "Authenticated", "Hierarchical (parent/child) view."),
    ep("Get category", "GET", "/api/categories/:id", "Authenticated", "Single category + custom fields."),
    ep("Add custom field", "POST", "/api/categories/:id/custom-fields", "Admin",
       "Append a custom field definition. type: text | number | date | select.",
       body={"label": "Warranty Expiry", "key": "warrantyExpiry", "type": "date", "required": False,
             "options": []}),
    ep("Delete custom field", "DELETE", "/api/categories/:id/custom-fields/:fieldId", "Admin",
       "Remove a custom field by its id."),
    ep("Create category", "POST", "/api/categories", "Admin",
       "Create a category. customFields optional array; parentId/icon optional.",
       body={"name": "Laptops", "customFields": [], "parentId": None, "icon": "laptop"}),
    ep("Update category", "PATCH", "/api/categories/:id", "Admin",
       "Partial update. A category cannot be its own parent.",
       body={"name": "Ultrabooks", "customFields": [], "status": "ACTIVE", "parentId": None, "icon": "laptop"}),
    ep("Delete category", "DELETE", "/api/categories/:id", "Admin", "Delete a category."),
])

# ---------------- Assets ----------------
folder("Assets", "Asset register. List/detail are scoped (Employee → held, Dept Head → dept, Admin/AM → all). Writes: Admin/Asset Manager.", [
    ep("List assets", "GET", "/api/assets", "Authenticated (scoped)",
       "Paginated, filterable list.",
       query=[("page", "1", "Page", False), ("limit", "20", "Page size (max 100)", False),
              ("q", "", "Search name/tag/serial", True), ("categoryId", "", "Filter by category", True),
              ("departmentId", "", "Filter by department", True),
              ("status", "", "AVAILABLE|ALLOCATED|UNDER_MAINTENANCE|RETIRED|DISPOSED|LOST", True)]),
    ep("Search assets", "GET", "/api/assets/search", "Authenticated (scoped)",
       "Quick lookup by tag/serial/name (⌘K, QR scan). Returns up to 20.",
       query=[("q", "AF-0001", "Search term (required)", False)]),
    ep("Bulk delete assets", "POST", "/api/assets/bulk-delete", "Admin",
       "Delete multiple assets by id.",
       body={"ids": ["{{assetId}}"]}),
    ep("Register asset", "POST", "/api/assets", "Admin / Asset Manager",
       "Create an asset. `tag` auto-generates (AF-0001…) if omitted. customValues holds category custom-field values.",
       body={"tag": "", "name": "Dell Latitude 7440", "serialNo": "SN-123456",
             "categoryId": "{{categoryId}}", "departmentId": "{{departmentId}}", "condition": "GOOD",
             "location": "HQ / Floor 2", "roomId": None, "isBookable": False,
             "purchaseDate": "2026-01-15", "purchaseCost": 1499.00, "customValues": {}}),
    ep("Get asset", "GET", "/api/assets/:id", "Authenticated (scoped)",
       "Full detail including uploaded documents. 403 if outside your scope, 404 if missing."),
    ep("Update asset", "PATCH", "/api/assets/:id", "Admin / Asset Manager",
       "Partial update. Any subset of fields.",
       body={"name": "Dell Latitude 7440 (upgraded)", "condition": "FAIR", "location": "HQ / Floor 3",
             "isBookable": True, "status": "AVAILABLE", "customValues": {}}),
    ep("Asset history", "GET", "/api/assets/:id/history", "Authenticated",
       "Allocation + maintenance timeline for the asset."),
    ep("Upload asset document", "POST", "/api/assets/:id/documents", "Admin / Asset Manager",
       "multipart/form-data with a `file` field (max 10 MB). Uploads to Cloudinary (requires server config).",
       form=[("file", "file", "Document to upload (max 10 MB)")]),
    ep("Asset QR code", "GET", "/api/assets/:id/qr", "Authenticated",
       "Returns a PNG data-URL QR encoding the asset tag."),
    ep("Retire asset", "POST", "/api/assets/:id/retire", "Admin / Asset Manager",
       "Asset must be AVAILABLE. Moves it to RETIRED.",
       body={"reason": "End of life", "retirementDate": "2026-07-12"}),
    ep("Dispose asset", "POST", "/api/assets/:id/dispose", "Admin / Asset Manager",
       "Only from RETIRED. Moves it to DISPOSED.",
       body={"method": "Recycled", "notes": "Handed to e-waste vendor", "disposalDate": "2026-07-12"}),
    ep("Mark asset lost", "POST", "/api/assets/:id/mark-lost", "Admin / Asset Manager",
       "Marks the asset LOST.", body={}),
])

# ---------------- Locations ----------------
folder("Locations", "Buildings → Floors → Rooms cascade.", [
    ep("List locations", "GET", "/api/locations", "Authenticated",
       "Nested buildings/floors/rooms tree."),
])

# ---------------- Allocations ----------------
folder("Allocations", "Asset check-out/check-in. List scoped by holder. Create/return-approve: Admin/AM. Approve: Admin/AM/Dept Head. Return: the holder.", [
    ep("List allocations", "GET", "/api/allocations", "Authenticated (scoped)",
       "Scoped list (max 200).",
       query=[("assetId", "", "Filter by asset", True), ("employeeId", "", "Filter by holder", True),
              ("departmentId", "", "Filter by holder's department", True),
              ("status", "", "PENDING|ACTIVE|RETURN_REQUESTED|RETURNED|REJECTED", True)]),
    ep("Kanban board", "GET", "/api/allocations/kanban", "Authenticated (scoped)",
       "Allocations grouped into PENDING / ACTIVE / RETURN_REQUESTED / OVERDUE columns."),
    ep("Overdue allocations", "GET", "/api/allocations/overdue", "Authenticated (scoped)",
       "Active/return-requested allocations past their expected return date, with daysOverdue."),
    ep("Get allocation", "GET", "/api/allocations/:id", "Authenticated (scoped)", "Single allocation."),
    ep("Create allocation", "POST", "/api/allocations", "Admin / Asset Manager",
       "Allocate an AVAILABLE asset to an ACTIVE employee. Asset becomes ALLOCATED.",
       body={"assetId": "{{assetId}}", "employeeId": "{{userId}}", "purpose": "Onboarding kit",
             "expectedReturnDate": "2026-12-31"}),
    ep("Approve allocation", "POST", "/api/allocations/:id/approve", "Admin / AM / Dept Head",
       "Approve a PENDING request. Dept Head limited to their department. Body optional.", body={}),
    ep("Request return", "POST", "/api/allocations/:id/return", "Holder only",
       "Holder initiates return with a condition check-in. Moves to RETURN_REQUESTED.",
       body={"condition": "GOOD", "notes": "Returned in good shape"}),
    ep("Approve return", "POST", "/api/allocations/:id/return/approve", "Admin / Asset Manager",
       "Confirm check-in. Asset becomes AVAILABLE again. Body optional.", body={}),
])

# ---------------- Transfers ----------------
folder("Transfers", "Peer-to-peer asset transfers. Anyone can request; Admin/AM/Dept Head decide.", [
    ep("List transfers", "GET", "/api/transfers", "Authenticated (scoped)",
       "Employee → own (either side), Dept Head → own dept, Admin/AM → all.",
       query=[("status", "", "REQUESTED | APPROVED | REJECTED", True)]),
    ep("Get transfer", "GET", "/api/transfers/:id", "Authenticated (scoped)", "Single transfer request."),
    ep("Request transfer", "POST", "/api/transfers", "Authenticated",
       "Request transfer of an ALLOCATED asset to another user. Only one open request per asset.",
       body={"assetId": "{{assetId}}", "toUserId": "{{userId}}", "reason": "Moving to new project"}),
    ep("Approve transfer", "POST", "/api/transfers/:id/approve", "Admin / AM / Dept Head",
       "Approve; moves the active allocation to the target user. Dept Head limited to their dept.", body={}),
    ep("Reject transfer", "POST", "/api/transfers/:id/reject", "Admin / AM / Dept Head",
       "Reject with an optional reason.",
       body={"reason": "Asset needed by current team"}),
])

# ---------------- Resources ----------------
folder("Resources (bookable)", "Bookable assets and their calendars/availability.", [
    ep("List resources", "GET", "/api/resources", "Authenticated",
       "Bookable, in-service assets (the booking picker)."),
    ep("Resource calendar", "GET", "/api/resources/:id/calendar", "Authenticated",
       "Confirmed bookings in a window (defaults to next 7 days).",
       query=[("from", "", "ISO datetime (optional)", True), ("to", "", "ISO datetime (optional)", True)]),
    ep("Resource availability", "GET", "/api/resources/:id/availability", "Authenticated",
       "Free/busy hour grid (09:00–18:00) for a date.",
       query=[("date", "2026-07-14", "YYYY-MM-DD (required)", False)]),
])

# ---------------- Bookings ----------------
folder("Bookings", "Room/equipment bookings with conflict checking. Manage = owner, Dept Head of booker's dept, or Admin/AM.", [
    ep("List bookings", "GET", "/api/bookings", "Authenticated (scoped)",
       "Scoped list (max 200), status derived (UPCOMING/ONGOING/COMPLETED/CANCELLED).",
       query=[("resourceId", "", "Filter by resource", True),
              ("status", "", "UPCOMING|ONGOING|COMPLETED|CANCELLED", True),
              ("date", "", "YYYY-MM-DD", True)]),
    ep("My bookings", "GET", "/api/bookings/my", "Authenticated", "The current user's bookings."),
    ep("Check availability", "POST", "/api/bookings/check-availability", "Authenticated",
       "Real-time overlap check. Provide start/end ISO OR date+startTime+endTime. Suggests alternatives on conflict.",
       body={"resourceId": "{{resourceId}}", "date": "2026-07-14", "startTime": "09:00", "endTime": "10:00"}),
    ep("Create booking", "POST", "/api/bookings", "Authenticated",
       "Create a conflict-checked booking. Accepts start/end ISO OR date+startTime+endTime.",
       body={"resourceId": "{{resourceId}}", "start": "2026-07-14T09:00:00", "end": "2026-07-14T10:00:00",
             "purpose": "Sprint planning", "attendees": []}),
    ep("Create recurring booking", "POST", "/api/bookings/recurring", "Authenticated",
       "Daily/weekly series between startDate and endDate (safety cap 60 slots). Skips conflicting dates.",
       body={"resourceId": "{{resourceId}}", "frequency": "WEEKLY", "startDate": "2026-07-14",
             "endDate": "2026-08-14", "startTime": "09:00", "endTime": "10:00",
             "purpose": "Weekly standup", "attendees": []}),
    ep("Get booking", "GET", "/api/bookings/:id", "Manager of booking", "Single booking."),
    ep("Cancel booking", "POST", "/api/bookings/:id/cancel", "Manager of booking",
       "Cancel a booking. Body optional.", body={}),
    ep("Reschedule booking", "POST", "/api/bookings/:id/reschedule", "Manager of booking",
       "Move a booking; re-runs the overlap check. Provide start/end ISO OR date+startTime+endTime.",
       body={"start": "2026-07-14T11:00:00", "end": "2026-07-14T12:00:00"}),
])

# ---------------- Maintenance ----------------
folder("Maintenance", "Maintenance workflow. Anyone raises/ comments; Admin/AM approve/reject/assign/escalate; assigned technician starts/resolves.", [
    ep("List maintenance requests", "GET", "/api/maintenance", "Authenticated (scoped)",
       "Scoped list (max 200). Employees also see jobs assigned to them.",
       query=[("status", "", "PENDING|APPROVED|REJECTED|TECHNICIAN_ASSIGNED|IN_PROGRESS|RESOLVED|ESCALATED", True),
              ("priority", "", "LOW|MEDIUM|HIGH|CRITICAL", True),
              ("assetId", "", "Filter by asset", True)]),
    ep("Get maintenance request", "GET", "/api/maintenance/:id", "Authenticated",
       "Detail incl. comment count."),
    ep("Raise maintenance request", "POST", "/api/maintenance", "Authenticated",
       "Raise a request against an asset. priority defaults to MEDIUM.",
       body={"assetId": "{{assetId}}", "issue": "Screen flickering intermittently",
             "issueType": "HARDWARE", "priority": "HIGH"}),
    ep("Approve request", "POST", "/api/maintenance/:id/approve", "Admin / Asset Manager",
       "Approve a PENDING request. Asset goes UNDER_MAINTENANCE. Body optional.", body={}),
    ep("Reject request", "POST", "/api/maintenance/:id/reject", "Admin / Asset Manager",
       "Reject a PENDING request with a reason.", body={"reason": "Duplicate of existing ticket"}),
    ep("Assign technician", "POST", "/api/maintenance/:id/assign", "Admin / Asset Manager",
       "Assign a technician by user id or free-text name. Request must be APPROVED.",
       body={"technicianId": "{{userId}}", "technicianName": "External Vendor Co."}),
    ep("Start work", "POST", "/api/maintenance/:id/start", "Assigned technician / Manager",
       "Move ASSIGNED → IN_PROGRESS. Body optional.", body={}),
    ep("Resolve request", "POST", "/api/maintenance/:id/resolve", "Technician / Manager",
       "Resolve; asset returns to AVAILABLE (or ALLOCATED if still held).",
       body={"notes": "Replaced display panel", "cost": 220.50}),
    ep("Escalate request", "POST", "/api/maintenance/:id/escalate", "Admin / Asset Manager",
       "Escalate; bumps priority to CRITICAL.",
       body={"reason": "SLA breach", "escalateTo": "ADMIN"}),
    ep("List comments", "GET", "/api/maintenance/:id/comments", "Authenticated", "Comment thread."),
    ep("Add comment", "POST", "/api/maintenance/:id/comments", "Authenticated",
       "Add a comment to the request.", body={"text": "Vendor scheduled for Monday."}),
])

# ---------------- Audit Cycles ----------------
folder("Audit Cycles", "Physical audit cycles. Create/auditors/close: Admin. Mark items: assigned auditor or Admin. Reads scoped for Dept Heads.", [
    ep("List audit cycles", "GET", "/api/audit-cycles", "Authenticated (scoped)",
       "Dept Heads see org-wide + cycles covering their dept.",
       query=[("status", "", "ACTIVE | CLOSED", True)]),
    ep("Create audit cycle", "POST", "/api/audit-cycles", "Admin",
       "Creates a cycle and snapshots checklist items from assets in scope. Omit departmentIds for an org-wide (ALL) cycle.",
       body={"name": "Q3 2026 Physical Audit", "departmentIds": ["{{departmentId}}"],
             "startDate": "2026-07-15", "endDate": "2026-07-30"}),
    ep("Get audit cycle", "GET", "/api/audit-cycles/:id", "Authenticated",
       "Cycle detail + auditors + departments."),
    ep("Assign auditors", "POST", "/api/audit-cycles/:id/auditors", "Admin",
       "Assign auditors by user id (idempotent).",
       body={"userIds": ["{{userId}}"]}),
    ep("List audit items", "GET", "/api/audit-cycles/:id/items", "Authenticated",
       "The checklist, with per-status counts.",
       query=[("status", "", "PENDING|VERIFIED|DISCREPANCY|MISSING", True),
              ("q", "", "Search tag/name/serial", True)]),
    ep("Bulk update items", "PATCH", "/api/audit-cycles/:id/items/bulk-update", "Assigned auditor / Admin",
       "Mark several items at once. verification: VERIFIED | DISCREPANCY | MISSING.",
       body={"verification": "VERIFIED", "itemIds": ["{{itemId}}"], "notes": ""}),
    ep("Update single item", "PATCH", "/api/audit-cycles/:id/items/:itemId", "Assigned auditor / Admin",
       "Mark one item, optionally with a photo.",
       body={"verification": "DISCREPANCY", "notes": "Found in wrong room", "photoUrl": None}),
    ep("Cycle progress", "GET", "/api/audit-cycles/:id/progress", "Authenticated",
       "Totals + per-auditor completion breakdown."),
    ep("Discrepancy report", "GET", "/api/audit-cycles/:id/discrepancy-report", "Authenticated",
       "Flagged (DISCREPANCY/MISSING) items."),
    ep("Cycle summary", "GET", "/api/audit-cycles/:id/summary", "Authenticated",
       "Historical summary (useful for closed cycles)."),
    ep("Close cycle", "POST", "/api/audit-cycles/:id/close", "Admin",
       "Locks the cycle. MISSING items mark their assets LOST. Body optional.", body={}),
])

# ---------------- Dashboard ----------------
folder("Dashboard", "Home dashboard widgets. All scoped: Employee → own, Dept Head → dept, Admin/AM → org.", [
    ep("KPIs", "GET", "/api/dashboard/kpis", "Authenticated (scoped)", "Headline counters."),
    ep("Overdue items", "GET", "/api/dashboard/overdue", "Authenticated (scoped)", "Overdue returns list."),
    ep("Activity feed", "GET", "/api/dashboard/activity-feed", "Authenticated (scoped)",
       "Recent activity timeline.",
       query=[("limit", "10", "Max rows (max 50)", False)]),
    ep("Utilization chart", "GET", "/api/dashboard/utilization-chart", "Authenticated",
       "% of assets allocated per day.",
       query=[("days", "30", "Window 7–90", False)]),
    ep("Upcoming returns", "GET", "/api/dashboard/upcoming-returns", "Authenticated (scoped)",
       "Next returns due, flagged ON_TIME/OVERDUE.",
       query=[("limit", "5", "Max rows (max 20)", False)]),
    ep("Fleet health score", "GET", "/api/dashboard/health-score", "Authenticated",
       "Composite fleet health % with breakdown."),
])

# ---------------- Reports ----------------
folder("Reports", "Analytics reports. Admin / Asset Manager / Dept Head (dept heads scoped to their department).", [
    ep("Utilization report", "GET", "/api/reports/utilization", "Admin / AM / Dept Head",
       "Most-used and idle assets."),
    ep("Maintenance frequency", "GET", "/api/reports/maintenance-frequency", "Admin / AM / Dept Head",
       "Maintenance counts by category."),
    ep("Due for maintenance", "GET", "/api/reports/due-for-maintenance", "Admin / AM / Dept Head",
       "Assets due or nearing retirement (≥2 repairs or >4 years old)."),
    ep("Allocation summary", "GET", "/api/reports/allocation-summary", "Admin / AM / Dept Head",
       "Active allocations by department."),
    ep("Booking heatmap", "GET", "/api/reports/booking-heatmap", "Admin / AM / Dept Head",
       "Peak booking hours per resource."),
    ep("Export report (CSV)", "GET", "/api/reports/export", "Admin / AM / Dept Head",
       "Download any report as CSV.",
       query=[("type", "utilization", "utilization|maintenance-frequency|due-for-maintenance|allocation-summary|booking-heatmap", False),
              ("format", "csv", "Only csv supported", False)]),
])

# ---------------- Notifications ----------------
folder("Notifications", "Per-user notification feed and preferences. All scoped to the logged-in user.", [
    ep("List notifications", "GET", "/api/notifications", "Authenticated",
       "Own feed (max 100) + unread count.",
       query=[("unread", "true", "true = unread only", True)]),
    ep("Get preferences", "GET", "/api/notifications/preferences", "Authenticated",
       "Own notification preferences (merged with defaults)."),
    ep("Update preferences", "PATCH", "/api/notifications/preferences", "Authenticated",
       "Upsert own preferences (partial merge).",
       body={"allocation": True, "transfer": True, "maintenance": True, "booking": True,
             "audit": True, "email": False}),
    ep("Mark all read", "POST", "/api/notifications/mark-all-read", "Authenticated",
       "Mark every unread notification as read. Body optional.", body={}),
    ep("Mark one read", "PATCH", "/api/notifications/:id/read", "Authenticated (owner)",
       "Mark a single notification read.", body={}),
    ep("Dismiss notification", "DELETE", "/api/notifications/:id", "Authenticated (owner)",
       "Delete a notification."),
])

# ---------------- Activity Logs ----------------
folder("Activity Logs", "Full system audit trail. Admin only.", [
    ep("List activity logs", "GET", "/api/activity-logs", "Admin",
       "Paginated, filterable audit trail.",
       query=[("page", "1", "Page", False), ("limit", "25", "Page size (max 100)", False),
              ("actionType", "", "ALLOCATION|RETURN|TRANSFER|BOOKING|MAINTENANCE|AUDIT|ASSET|USER_CHANGE|SYSTEM", True),
              ("userId", "", "Filter by actor", True), ("entityType", "", "Filter by entity type", True),
              ("from", "", "YYYY-MM-DD", True), ("to", "", "YYYY-MM-DD", True)]),
    ep("Export activity logs (CSV)", "GET", "/api/activity-logs/export", "Admin",
       "Download the audit trail as CSV (max 5000 rows).",
       query=[("format", "csv", "Only csv supported", False), ("from", "", "YYYY-MM-DD", True),
              ("to", "", "YYYY-MM-DD", True), ("actionType", "", "Filter by action type", True)]),
])

# ---------------- Health ----------------
folder("Health", "Liveness/readiness probe (no auth, no /api prefix).", [
    ep("Health check", "GET", "/health", "Public",
       "Verifies the DB connection and reports uptime. 200 healthy / 503 degraded."),
])

# ---------- build Postman JSON ----------
VARS = {"userId", "assetId", "categoryId", "departmentId", "allocationId", "transferId",
        "bookingId", "resourceId", "maintenanceId", "cycleId", "itemId", "notificationId", "fieldId"}

# map :param in a path to a collection variable name when sensible
PARAM_MAP = {
    "/api/users/:id": "userId",
    "/api/departments/:id": "departmentId",
    "/api/categories/:id": "categoryId",
    "/api/categories/:id/custom-fields/:fieldId": ("categoryId", "fieldId"),
    "/api/assets/:id": "assetId",
    "/api/allocations/:id": "allocationId",
    "/api/transfers/:id": "transferId",
    "/api/resources/:id": "resourceId",
    "/api/bookings/:id": "bookingId",
    "/api/maintenance/:id": "maintenanceId",
    "/api/audit-cycles/:id": "cycleId",
    "/api/audit-cycles/:id/items/:itemId": ("cycleId", "itemId"),
    "/api/notifications/:id": "notificationId",
}

def var_for_segment(full_path, seg_index, seg):
    """Choose a collection variable for a :param segment based on the resource prefix."""
    # Build the resource key from the first two segments after /api
    parts = full_path.strip("/").split("/")
    resource = parts[1] if parts[0] == "api" and len(parts) > 1 else parts[0]
    mapping = {
        "users": "userId", "departments": "departmentId", "categories": "categoryId",
        "assets": "assetId", "allocations": "allocationId", "transfers": "transferId",
        "resources": "resourceId", "bookings": "bookingId", "maintenance": "maintenanceId",
        "audit-cycles": "cycleId", "notifications": "notificationId",
    }
    if seg == ":fieldId":
        return "fieldId"
    if seg == ":itemId":
        return "itemId"
    return mapping.get(resource, "id")

def build_url(path, query):
    segs = path.strip("/").split("/")
    out_segs = []
    for i, s in enumerate(segs):
        if s.startswith(":"):
            out_segs.append("{{" + var_for_segment(path, i, s) + "}}")
        else:
            out_segs.append(s)
    raw = BASE + "/" + "/".join(out_segs)
    url = {
        "raw": raw,
        "host": ["{{baseUrl}}"],
        "path": out_segs,
    }
    if query:
        raw_q = "&".join(f"{k}={v}" for k, v, d, dis in query)
        url["raw"] = raw + "?" + raw_q
        url["query"] = [
            {"key": k, "value": v, "description": d, **({"disabled": True} if dis else {})}
            for k, v, d, dis in query
        ]
    return url

def build_item(e):
    desc = e["description"]
    meta = f"\n\n**Access:** {e['roles']}"
    req = {
        "method": e["method"],
        "header": [],
        "url": build_url(e["path"], e["query"]),
        "description": desc + meta,
    }
    if e["body"] is not None:
        req["header"].append({"key": "Content-Type", "value": "application/json"})
        req["body"] = {
            "mode": "raw",
            "raw": json.dumps(e["body"], indent=2),
            "options": {"raw": {"language": "json"}},
        }
    if e["form"] is not None:
        req["body"] = {
            "mode": "formdata",
            "formdata": [
                {"key": k, "type": t, "description": d, "src": []} if t == "file"
                else {"key": k, "type": t, "value": "", "description": d}
                for k, t, d in e["form"]
            ],
        }
    item = {"name": e["name"], "request": req, "response": []}
    # Auto-capture cookies note on login already handled by Postman jar.
    return item

collection = {
    "info": {
        "name": "AssetFlow API",
        "description": (
            "Complete API collection for the AssetFlow backend — **110 endpoints** across 17 modules.\n\n"
            "## Getting started\n"
            "1. Set the `baseUrl` variable (default `http://localhost:3000`).\n"
            "2. Run **Auth → Login** (or Signup). This sets HttpOnly `at`/`rt` cookies in Postman's cookie jar; "
            "every other request is then authenticated automatically — no bearer token to copy.\n"
            "3. Fill the id variables (`assetId`, `userId`, `departmentId`, …) from list responses to exercise "
            "detail/update/action requests.\n\n"
            "## Response envelope\n"
            "All responses use `{ success, message, data }`. Errors return the same shape with `success:false`.\n\n"
            "## Roles\n"
            "ADMIN · ASSET_MANAGER · DEPT_HEAD · EMPLOYEE. Each request lists its required access under **Access**.\n\n"
            "_Generated from the route source in `src/routes/`._"
        ),
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    "item": [
        {"name": f["name"], "description": f["description"], "item": [build_item(e) for e in f["items"]]}
        for f in folders
    ],
    "variable": [
        {"key": "baseUrl", "value": "http://localhost:3000", "type": "string"},
    ] + [
        {"key": v, "value": "", "type": "string"} for v in [
            "userId", "assetId", "categoryId", "departmentId", "allocationId", "transferId",
            "bookingId", "resourceId", "maintenanceId", "cycleId", "itemId", "notificationId", "fieldId",
        ]
    ],
}

count = sum(len(f["items"]) for f in folders)
out_dir = "/Users/hits/Downloads/odoo/AssetFlow/Backend/postman"
os.makedirs(out_dir, exist_ok=True)
with open(os.path.join(out_dir, "AssetFlow.postman_collection.json"), "w") as fh:
    json.dump(collection, fh, indent=2)

print(f"Wrote collection with {count} endpoints across {len(folders)} folders.")
for f in folders:
    print(f"  {len(f['items']):>2}  {f['name']}")
