import { create } from "zustand";
import type { Notification } from "@/lib/types";
import { notifications as mockNotifications } from "@/data/mock";

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismiss: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: mockNotifications,
  unreadCount: mockNotifications.filter((n) => !n.read).length,
  markAsRead: (id) => {
    set((s) => {
      const updated = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return { notifications: updated, unreadCount: updated.filter((n) => !n.read).length };
    });
  },
  markAllAsRead: () => {
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },
  dismiss: (id) => {
    set((s) => {
      const filtered = s.notifications.filter((n) => n.id !== id);
      return { notifications: filtered, unreadCount: filtered.filter((n) => !n.read).length };
    });
  },
}));
