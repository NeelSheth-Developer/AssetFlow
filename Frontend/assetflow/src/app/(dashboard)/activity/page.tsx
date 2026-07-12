"use client";

import { activityLog } from "@/data/mock";
import { useNotificationStore } from "@/stores/notification-store";
import { cn } from "@/lib/utils";
import { Bell, Check } from "lucide-react";

// ─── Color map for activity dots ────────────────────────────
const dotColorMap: Record<string, string> = {
  blue: "bg-blue-500",
  orange: "bg-orange-500",
  green: "bg-green-500",
  purple: "bg-purple-500",
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  violet: "bg-violet-500",
  slate: "bg-slate-500",
};

// ─── Helpers ────────────────────────────────────────────────
function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY PAGE
// ═══════════════════════════════════════════════════════════════
export default function ActivityPage() {
  const { notifications, markAllAsRead } = useNotificationStore();

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────── */}
      <h1 className="text-2xl font-semibold tracking-tight">
        Activity &amp; Notifications
      </h1>

      {/* ─── Two-column layout ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column: Activity Logs */}
        <div className="lg:col-span-3 space-y-4">
          <h2 className="font-semibold">Activity Logs</h2>

          <div className="bg-card rounded-xl border p-5">
            {activityLog.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 py-3 border-b border-border/30 last:border-0"
              >
                {/* Color dot */}
                <span
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    dotColorMap[log.color] ?? "bg-slate-400"
                  )}
                />

                {/* Avatar */}
                <span className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                  {log.entities.user
                    ? getInitials(log.entities.user.name)
                    : "?"}
                </span>

                {/* Description */}
                <p className="text-sm truncate min-w-0 flex-1">
                  <span className="font-medium">
                    {log.entities.user?.name}
                  </span>{" "}
                  {log.description}
                </p>

                {/* Relative time */}
                <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap shrink-0">
                  {log.relativeTime}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: Notifications */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </h2>
            <button
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
              Mark all read
            </button>
          </div>

          <div className="glass-light rounded-xl p-4 space-y-1">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={cn(
                  "flex gap-3 p-3 rounded-lg transition-colors",
                  !notif.read && "bg-primary/[0.03]"
                )}
              >
                {/* Unread dot */}
                <div className="pt-1.5 shrink-0">
                  {!notif.read ? (
                    <span className="block h-2 w-2 rounded-full bg-blue-500" />
                  ) : (
                    <span className="block h-2 w-2" />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-medium text-sm truncate">{notif.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notif.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeTime(notif.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
