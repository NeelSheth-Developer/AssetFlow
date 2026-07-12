import { create } from "zustand";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  entityId: string | null;
  entityType: string | null;
  createdAt: string;
}

const API = process.env.NEXT_PUBLIC_API_BASE || "https://assetflow-production-85d2.up.railway.app/api";

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismiss: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async () => {
    try {
      set({ loading: true });
      const res = await fetch(`${API}/notifications`, { credentials: "include" });
      const data = await res.json();
      if (data.success && data.data) {
        const notifs = data.data.notifications || data.data || [];
        set({
          notifications: notifs,
          unreadCount: data.data.unreadCount ?? notifs.filter((n: Notification) => !n.read).length,
          loading: false,
        });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  markAsRead: async (id) => {
    set((s) => {
      const updated = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return { notifications: updated, unreadCount: updated.filter((n) => !n.read).length };
    });
    try {
      await fetch(`${API}/notifications/${id}/read`, { method: "PATCH", credentials: "include" });
    } catch { /* ignore */ }
  },

  markAllAsRead: async () => {
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
    try {
      await fetch(`${API}/notifications/mark-all-read`, { method: "POST", credentials: "include" });
    } catch { /* ignore */ }
  },

  dismiss: async (id) => {
    set((s) => {
      const filtered = s.notifications.filter((n) => n.id !== id);
      return { notifications: filtered, unreadCount: filtered.filter((n) => !n.read).length };
    });
    try {
      await fetch(`${API}/notifications/${id}`, { method: "DELETE", credentials: "include" });
    } catch { /* ignore */ }
  },
}));
