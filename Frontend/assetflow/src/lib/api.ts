const API_BASE = "https://assetflow-production-85d2.up.railway.app/api";

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Silent refresh — called automatically when any request gets 401.
 * Rotates the refresh token (rt cookie) and gets a new access token (at cookie).
 * Backend handles everything via Set-Cookie — frontend just needs credentials: include.
 */
async function silentRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/**
 * Core fetch wrapper for the AssetFlow API.
 * 
 * Auth flow (from backend §6):
 * - Tokens travel in HttpOnly cookies (at=access, rt=refresh)
 * - Frontend NEVER sees/stores the JWT — just uses credentials: "include"
 * - On 401: auto-calls POST /auth/refresh → retries original request
 * - If refresh also fails: session expired → redirect to /login
 */
async function apiFetch<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: "include",
  };

  let res = await fetch(`${API_BASE}${endpoint}`, fetchOptions);

  // 401 = access token expired → silent refresh + retry once
  if (res.status === 401 && !endpoint.includes("/auth/")) {
    const refreshed = await silentRefresh();
    if (refreshed) {
      res = await fetch(`${API_BASE}${endpoint}`, fetchOptions);
    } else {
      // Refresh failed — all sessions dead
      if (typeof window !== "undefined") {
        localStorage.removeItem("assetflow-auth");
        window.location.href = "/login";
      }
      throw new Error("Session expired. Please log in again.");
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: `Request failed (${res.status})` }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// ═══════════════════════════════════════════════════
// AUTH — §8
// ═══════════════════════════════════════════════════
export const authApi = {
  /** §8.1 — name, email, password (role always EMPLOYEE) */
  signup: (data: { name: string; email: string; password: string }) =>
    apiFetch("/auth/signup", { method: "POST", body: JSON.stringify(data) }),

  /** §8.2 — email + password */
  login: (email: string, password: string) =>
    apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  /** §8.3 — rotate refresh token (no body, rt cookie sent automatically) */
  refresh: () =>
    apiFetch("/auth/refresh", { method: "POST" }),

  /** §8.4 — clear cookies */
  logout: () =>
    apiFetch("/auth/logout", { method: "POST" }),

  /** §8.5 — rehydrate user from access token cookie */
  me: () =>
    apiFetch("/auth/me"),

  /** §8.6 — send OTP email */
  forgotPassword: (email: string) =>
    apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),

  /** §8.7 — verify OTP + set new password (atomic) */
  resetPassword: (email: string, otp: string, newPassword: string) =>
    apiFetch("/auth/reset-password", { method: "POST", body: JSON.stringify({ email, otp, newPassword }) }),

  /** §8.8 — change own password */
  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
};

// ═══════════════════════════════════════════════════
// USERS — §9
// ═══════════════════════════════════════════════════
export const usersApi = {
  list: (params?: { page?: number; limit?: number; q?: string; role?: string; departmentId?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined) searchParams.set(k, String(v)); });
    }
    return apiFetch(`/users?${searchParams.toString()}`);
  },
  changeRole: (userId: string, role: string) =>
    apiFetch(`/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  changeDepartment: (userId: string, departmentId: string | null) =>
    apiFetch(`/users/${userId}/department`, { method: "PATCH", body: JSON.stringify({ departmentId }) }),
  changeStatus: (userId: string, status: string) =>
    apiFetch(`/users/${userId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
};

// ═══════════════════════════════════════════════════
// DEPARTMENTS & CATEGORIES — §10
// ═══════════════════════════════════════════════════
export const departmentsApi = {
  list: () => apiFetch("/departments"),
  get: (id: string) => apiFetch(`/departments/${id}`),
  create: (data: { name: string; headId?: string; parentId?: string }) =>
    apiFetch("/departments", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; headId?: string; parentId?: string; status?: string }) =>
    apiFetch(`/departments/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch(`/departments/${id}`, { method: "DELETE" }),
};

export const categoriesApi = {
  list: () => apiFetch("/categories"),
  tree: () => apiFetch("/categories/tree"),
  create: (data: { name: string; customFields?: Array<{ key: string; label: string; type: string }> }) =>
    apiFetch("/categories", { method: "POST", body: JSON.stringify(data) }),
};

// ═══════════════════════════════════════════════════
// DASHBOARD — §17.1
// ═══════════════════════════════════════════════════
export const dashboardApi = {
  kpis: () => apiFetch("/dashboard/kpis"),
  overdue: () => apiFetch("/dashboard/overdue"),
  activityFeed: (limit = 10) => apiFetch(`/dashboard/activity-feed?limit=${limit}`),
  utilizationChart: (days = 30) => apiFetch(`/dashboard/utilization-chart?days=${days}`),
  upcomingReturns: (limit = 5) => apiFetch(`/dashboard/upcoming-returns?limit=${limit}`),
  healthScore: () => apiFetch("/dashboard/health-score"),
};

// ═══════════════════════════════════════════════════
// ASSETS — §17.2
// ═══════════════════════════════════════════════════
export const assetsApi = {
  list: (params?: { q?: string; categoryId?: string; departmentId?: string; status?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined) searchParams.set(k, String(v)); });
    }
    return apiFetch(`/assets?${searchParams.toString()}`);
  },
  search: (q: string) => apiFetch(`/assets/search?q=${encodeURIComponent(q)}`),
  get: (id: string) => apiFetch(`/assets/${id}`),
  create: (data: {
    name: string;
    serialNo?: string;
    categoryId: string;
    departmentId?: string;
    condition?: string;
    location?: string;
    roomId?: string;
    isBookable?: boolean;
    acquisitionCost?: number;
    acquisitionDate?: string;
    warrantyEndDate?: string;
    customValues?: Record<string, unknown>;
  }) => apiFetch("/assets", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    apiFetch(`/assets/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  history: (id: string) => apiFetch(`/assets/${id}/history`),
  retire: (id: string, data: { reason: string; retirementDate: string }) =>
    apiFetch(`/assets/${id}/retire`, { method: "POST", body: JSON.stringify(data) }),
  dispose: (id: string, data: { method: string; notes: string; disposalDate: string }) =>
    apiFetch(`/assets/${id}/dispose`, { method: "POST", body: JSON.stringify(data) }),
  markLost: (id: string) =>
    apiFetch(`/assets/${id}/mark-lost`, { method: "POST" }),
};

// ═══════════════════════════════════════════════════
// LOCATIONS — §17.3
// ═══════════════════════════════════════════════════
export const locationsApi = {
  list: () => apiFetch("/locations"),
};

// ═══════════════════════════════════════════════════
// ALLOCATIONS — §17.4
// ═══════════════════════════════════════════════════
export const allocationsApi = {
  list: (params?: { assetId?: string; employeeId?: string; departmentId?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined) searchParams.set(k, String(v)); });
    }
    return apiFetch(`/allocations?${searchParams.toString()}`);
  },
  kanban: () => apiFetch("/allocations/kanban"),
  overdue: () => apiFetch("/allocations/overdue"),
  get: (id: string) => apiFetch(`/allocations/${id}`),
  create: (data: { assetId: string; employeeId: string; purpose?: string; expectedReturnDate?: string }) =>
    apiFetch("/allocations", { method: "POST", body: JSON.stringify(data) }),
  approve: (id: string) =>
    apiFetch(`/allocations/${id}/approve`, { method: "POST" }),
  returnRequest: (id: string, data: { condition: string; notes?: string }) =>
    apiFetch(`/allocations/${id}/return`, { method: "POST", body: JSON.stringify(data) }),
  returnApprove: (id: string) =>
    apiFetch(`/allocations/${id}/return/approve`, { method: "POST" }),
};

// ═══════════════════════════════════════════════════
// TRANSFERS — §17.5
// ═══════════════════════════════════════════════════
export const transfersApi = {
  list: (params?: { status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    return apiFetch(`/transfers?${searchParams.toString()}`);
  },
  get: (id: string) => apiFetch(`/transfers/${id}`),
  create: (data: { assetId: string; toUserId: string; reason: string }) =>
    apiFetch("/transfers", { method: "POST", body: JSON.stringify(data) }),
  approve: (id: string) =>
    apiFetch(`/transfers/${id}/approve`, { method: "POST" }),
  reject: (id: string, reason: string) =>
    apiFetch(`/transfers/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
};

// ═══════════════════════════════════════════════════
// BOOKINGS & RESOURCES — §17.6
// ═══════════════════════════════════════════════════
export const resourcesApi = {
  list: () => apiFetch("/resources"),
  calendar: (id: string, from: string, to: string) =>
    apiFetch(`/resources/${id}/calendar?from=${from}&to=${to}`),
  availability: (id: string, date: string) =>
    apiFetch(`/resources/${id}/availability?date=${date}`),
};

export const bookingsApi = {
  list: (params?: { resourceId?: string; status?: string; date?: string }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined) searchParams.set(k, String(v)); });
    }
    return apiFetch(`/bookings?${searchParams.toString()}`);
  },
  my: () => apiFetch("/bookings/my"),
  get: (id: string) => apiFetch(`/bookings/${id}`),
  create: (data: { resourceId: string; date: string; startTime: string; endTime: string; purpose: string }) =>
    apiFetch("/bookings", { method: "POST", body: JSON.stringify(data) }),
  checkAvailability: (data: { resourceId: string; date: string; startTime: string; endTime: string }) =>
    apiFetch("/bookings/check-availability", { method: "POST", body: JSON.stringify(data) }),
  recurring: (data: { resourceId: string; frequency: string; startDate: string; endDate: string; startTime: string; endTime: string; purpose?: string }) =>
    apiFetch("/bookings/recurring", { method: "POST", body: JSON.stringify(data) }),
  cancel: (id: string) =>
    apiFetch(`/bookings/${id}/cancel`, { method: "POST" }),
  reschedule: (id: string, data: { date: string; startTime: string; endTime: string }) =>
    apiFetch(`/bookings/${id}/reschedule`, { method: "POST", body: JSON.stringify(data) }),
};

// ═══════════════════════════════════════════════════
// MAINTENANCE — §17.7
// ═══════════════════════════════════════════════════
export const maintenanceApi = {
  list: (params?: { status?: string; priority?: string; assetId?: string }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined) searchParams.set(k, String(v)); });
    }
    return apiFetch(`/maintenance?${searchParams.toString()}`);
  },
  get: (id: string) => apiFetch(`/maintenance/${id}`),
  create: (data: { assetId: string; issue: string; issueType?: string; priority?: string }) =>
    apiFetch("/maintenance", { method: "POST", body: JSON.stringify(data) }),
  approve: (id: string) =>
    apiFetch(`/maintenance/${id}/approve`, { method: "POST" }),
  reject: (id: string, reason: string) =>
    apiFetch(`/maintenance/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  assign: (id: string, data: { technicianId?: string; technicianName?: string }) =>
    apiFetch(`/maintenance/${id}/assign`, { method: "POST", body: JSON.stringify(data) }),
  start: (id: string) =>
    apiFetch(`/maintenance/${id}/start`, { method: "POST" }),
  resolve: (id: string, data: { notes: string; cost?: number }) =>
    apiFetch(`/maintenance/${id}/resolve`, { method: "POST", body: JSON.stringify(data) }),
  escalate: (id: string, data: { reason: string; escalateTo?: string }) =>
    apiFetch(`/maintenance/${id}/escalate`, { method: "POST", body: JSON.stringify(data) }),
  getComments: (id: string) => apiFetch(`/maintenance/${id}/comments`),
  addComment: (id: string, text: string) =>
    apiFetch(`/maintenance/${id}/comments`, { method: "POST", body: JSON.stringify({ text }) }),
};

// ═══════════════════════════════════════════════════
// AUDIT — §17.8
// ═══════════════════════════════════════════════════
export const auditsApi = {
  list: (params?: { status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    return apiFetch(`/audit-cycles?${searchParams.toString()}`);
  },
  get: (id: string) => apiFetch(`/audit-cycles/${id}`),
  create: (data: { name: string; departmentIds?: string[]; startDate?: string; endDate?: string }) =>
    apiFetch("/audit-cycles", { method: "POST", body: JSON.stringify(data) }),
  assignAuditors: (id: string, userIds: string[]) =>
    apiFetch(`/audit-cycles/${id}/auditors`, { method: "POST", body: JSON.stringify({ userIds }) }),
  getItems: (id: string, params?: { status?: string; q?: string }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined) searchParams.set(k, String(v)); });
    }
    return apiFetch(`/audit-cycles/${id}/items?${searchParams.toString()}`);
  },
  updateItem: (cycleId: string, itemId: string, data: { verification: string; notes?: string; photoUrl?: string }) =>
    apiFetch(`/audit-cycles/${cycleId}/items/${itemId}`, { method: "PATCH", body: JSON.stringify(data) }),
  bulkUpdateItems: (cycleId: string, data: { itemIds: string[]; verification: string; notes?: string }) =>
    apiFetch(`/audit-cycles/${cycleId}/items/bulk-update`, { method: "PATCH", body: JSON.stringify(data) }),
  progress: (id: string) => apiFetch(`/audit-cycles/${id}/progress`),
  discrepancyReport: (id: string) => apiFetch(`/audit-cycles/${id}/discrepancy-report`),
  summary: (id: string) => apiFetch(`/audit-cycles/${id}/summary`),
  close: (id: string) =>
    apiFetch(`/audit-cycles/${id}/close`, { method: "POST" }),
};

// ═══════════════════════════════════════════════════
// REPORTS — §17.9
// ═══════════════════════════════════════════════════
export const reportsApi = {
  utilization: () => apiFetch("/reports/utilization"),
  maintenanceFrequency: () => apiFetch("/reports/maintenance-frequency"),
  dueForMaintenance: () => apiFetch("/reports/due-for-maintenance"),
  allocationSummary: () => apiFetch("/reports/allocation-summary"),
  bookingHeatmap: () => apiFetch("/reports/booking-heatmap"),
  export: (type: string, format = "csv") =>
    `${API_BASE}/reports/export?type=${type}&format=${format}`, // Returns URL for download
};

// ═══════════════════════════════════════════════════
// NOTIFICATIONS — §17.10
// ═══════════════════════════════════════════════════
export const notificationsApi = {
  list: (unread?: boolean) => {
    const params = unread ? "?unread=true" : "";
    return apiFetch(`/notifications${params}`);
  },
  markRead: (id: string) =>
    apiFetch(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () =>
    apiFetch("/notifications/mark-all-read", { method: "POST" }),
  dismiss: (id: string) =>
    apiFetch(`/notifications/${id}`, { method: "DELETE" }),
  getPreferences: () => apiFetch("/notifications/preferences"),
  updatePreferences: (prefs: Record<string, boolean>) =>
    apiFetch("/notifications/preferences", { method: "PATCH", body: JSON.stringify(prefs) }),
};

// ═══════════════════════════════════════════════════
// ACTIVITY LOGS — §17.11
// ═══════════════════════════════════════════════════
export const activityApi = {
  list: (params?: { actionType?: string; userId?: string; entityType?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined) searchParams.set(k, String(v)); });
    }
    return apiFetch(`/activity-logs?${searchParams.toString()}`);
  },
  exportUrl: (format = "csv") => `${API_BASE}/activity-logs/export?format=${format}`,
};
