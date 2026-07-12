const API_BASE = "https://anyone-mummified-irritable.ngrok-free.dev/api";

interface FetchOptions extends RequestInit {
  token?: string;
}

export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  signup: (data: { name: string; email: string; password: string; department: string; designation: string }) =>
    apiFetch("/auth/signup", { method: "POST", body: JSON.stringify(data) }),
  me: (token: string) =>
    apiFetch("/auth/me", { token }),
  logout: (token: string) =>
    apiFetch("/auth/logout", { method: "POST", token }),
};

// Dashboard
export const dashboardApi = {
  kpis: (token: string) => apiFetch("/dashboard/kpis", { token }),
  activityFeed: (token: string) => apiFetch("/dashboard/activity-feed", { token }),
  utilizationChart: (token: string) => apiFetch("/dashboard/utilization-chart", { token }),
  upcomingReturns: (token: string) => apiFetch("/dashboard/upcoming-returns", { token }),
  healthScore: (token: string) => apiFetch("/dashboard/health-score", { token }),
};

// Departments
export const departmentsApi = {
  list: (token: string) => apiFetch("/departments", { token }),
  create: (token: string, data: unknown) => apiFetch("/departments", { method: "POST", token, body: JSON.stringify(data) }),
};

// Categories
export const categoriesApi = {
  tree: (token: string) => apiFetch("/categories/tree", { token }),
  list: (token: string) => apiFetch("/categories", { token }),
};

// Users
export const usersApi = {
  list: (token: string) => apiFetch("/users", { token }),
  changeRole: (token: string, userId: string, role: string) =>
    apiFetch(`/users/${userId}/role`, { method: "PATCH", token, body: JSON.stringify({ role }) }),
};

// Assets
export const assetsApi = {
  list: (token: string) => apiFetch("/assets", { token }),
  create: (token: string, data: unknown) => apiFetch("/assets", { method: "POST", token, body: JSON.stringify(data) }),
  get: (token: string, id: string) => apiFetch(`/assets/${id}`, { token }),
};

// Allocations
export const allocationsApi = {
  list: (token: string) => apiFetch("/allocations", { token }),
  kanban: (token: string) => apiFetch("/allocations/kanban", { token }),
  create: (token: string, data: unknown) => apiFetch("/allocations", { method: "POST", token, body: JSON.stringify(data) }),
};

// Bookings
export const bookingsApi = {
  list: (token: string) => apiFetch("/bookings", { token }),
  create: (token: string, data: unknown) => apiFetch("/bookings", { method: "POST", token, body: JSON.stringify(data) }),
  checkAvailability: (token: string, data: unknown) =>
    apiFetch("/bookings/check-availability", { method: "POST", token, body: JSON.stringify(data) }),
};

// Maintenance
export const maintenanceApi = {
  list: (token: string) => apiFetch("/maintenance", { token }),
  create: (token: string, data: unknown) => apiFetch("/maintenance", { method: "POST", token, body: JSON.stringify(data) }),
  approve: (token: string, id: string) => apiFetch(`/maintenance/${id}/approve`, { method: "POST", token }),
};

// Audits
export const auditsApi = {
  list: (token: string) => apiFetch("/audit-cycles", { token }),
  create: (token: string, data: unknown) => apiFetch("/audit-cycles", { method: "POST", token, body: JSON.stringify(data) }),
};

// Notifications
export const notificationsApi = {
  list: (token: string) => apiFetch("/notifications", { token }),
  markRead: (token: string, id: string) => apiFetch(`/notifications/${id}/read`, { method: "PATCH", token }),
  markAllRead: (token: string) => apiFetch("/notifications/mark-all-read", { method: "POST", token }),
};

// Activity Logs
export const activityApi = {
  list: (token: string) => apiFetch("/activity-logs", { token }),
};

// Reports
export const reportsApi = {
  utilization: (token: string) => apiFetch("/reports/utilization", { token }),
  bookingHeatmap: (token: string) => apiFetch("/reports/booking-heatmap", { token }),
  allocationSummary: (token: string) => apiFetch("/reports/allocation-summary", { token }),
};
