"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { motion } from "framer-motion";
import { Package, Calendar, Wrench, AlertCircle } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ─── API Base ───────────────────────────────────────────────
const API = "https://assetflow-production-85d2.up.railway.app/api";

// ─── KPI Config ─────────────────────────────────────────────
const kpiCards = [
  {
    label: "Assets Available",
    key: "assetsAvailable" as const,
    accent: "bg-green-500",
    trend: "↑ 8%",
    trendColor: "text-green-600",
  },
  {
    label: "Assets Allocated",
    key: "assetsAllocated" as const,
    accent: "bg-blue-500",
    trend: "↑ 3%",
    trendColor: "text-blue-600",
  },
  {
    label: "Under Maintenance",
    key: "underMaintenance" as const,
    accent: "bg-orange-500",
    trend: null,
    trendColor: "",
  },
  {
    label: "Active Bookings",
    key: "activeBookings" as const,
    accent: "bg-indigo-500",
    trend: null,
    trendColor: "",
  },
  {
    label: "Pending Transfers",
    key: "pendingTransfers" as const,
    accent: "bg-amber-500",
    trend: null,
    trendColor: "",
  },
  {
    label: "Upcoming Returns",
    key: "upcomingReturns" as const,
    accent: "bg-red-500",
    trend: "⚠ Action needed",
    trendColor: "text-red-600",
  },
];

// ─── Color map for activity type dots ───────────────────────
const activityTypeColor: Record<string, string> = {
  ALLOCATION: "bg-blue-500",
  RETURN: "bg-green-500",
  MAINTENANCE: "bg-orange-500",
  BOOKING: "bg-indigo-500",
  TRANSFER: "bg-amber-500",
  AUDIT: "bg-purple-500",
  ASSET: "bg-emerald-500",
  ASSET_CREATED: "bg-emerald-500",
  ASSET_UPDATED: "bg-slate-500",
  USER_CHANGE: "bg-slate-500",
  SYSTEM: "bg-gray-400",
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

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return format(date, "MMM d");
}

// ─── Animation Variants ─────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

// ═══════════════════════════════════════════════════════════════
// DASHBOARD PAGE
// ═══════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const [kpis, setKpis] = useState<Record<string, number> | null>(null);
  const [activityLog, setActivityLog] = useState<any[] | null>(null);
  const [utilizationData, setUtilizationData] = useState<any[] | null>(null);
  const [upcomingReturns, setUpcomingReturns] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([
      fetch(`${API}/dashboard/kpis`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API}/dashboard/activity-feed?limit=8`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API}/dashboard/utilization-chart?days=30`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API}/dashboard/upcoming-returns?limit=5`, { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([kpisRes, activityRes, chartRes, returnsRes]) => {
        if (!mounted) return;

        let anySuccess = false;

        // KPIs
        if (kpisRes.status === "fulfilled" && kpisRes.value.success) {
          setKpis(kpisRes.value.data);
          anySuccess = true;
        }

        // Activity Feed
        if (activityRes.status === "fulfilled" && activityRes.value.success) {
          setActivityLog(activityRes.value.data.activities || []);
          anySuccess = true;
        }

        // Utilization Chart
        if (chartRes.status === "fulfilled" && chartRes.value.success) {
          setUtilizationData(chartRes.value.data.dataPoints || []);
          anySuccess = true;
        }

        // Upcoming Returns
        if (returnsRes.status === "fulfilled" && returnsRes.value.success) {
          setUpcomingReturns(returnsRes.value.data.returns || []);
          anySuccess = true;
        }

        if (!anySuccess) setError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 h-64 bg-muted animate-pulse rounded-xl" />
          <div className="lg:col-span-2 h-64 bg-muted animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Unable to load data</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          We couldn't fetch dashboard data from the server. Please check your
          connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Greeting Row ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {getGreeting()}, {user?.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/allocations"
            className="glass-light rounded-full px-4 py-2 text-sm font-medium flex items-center gap-2 hover:scale-[1.02] transition-transform"
          >
            <Package className="h-4 w-4" />
            Allocate
          </Link>
          <Link
            href="/bookings"
            className="glass-light rounded-full px-4 py-2 text-sm font-medium flex items-center gap-2 hover:scale-[1.02] transition-transform"
          >
            <Calendar className="h-4 w-4" />
            Book
          </Link>
          <Link
            href="/maintenance"
            className="glass-light rounded-full px-4 py-2 text-sm font-medium flex items-center gap-2 hover:scale-[1.02] transition-transform"
          >
            <Wrench className="h-4 w-4" />
            Maintenance
          </Link>
        </div>
      </div>

      {/* ─── KPI Row ─────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3"
      >
        {kpiCards.map((kpi) => (
          <motion.div
            key={kpi.key}
            variants={itemVariants}
            className="glass-light rounded-xl p-5 flex gap-3"
          >
            {/* Accent bar */}
            <div className={cn("w-[3px] rounded-full shrink-0", kpi.accent)} />

            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground truncate">
                {kpi.label}
              </p>
              <p className="text-2xl font-bold mt-1 flex items-center gap-2">
                {kpis?.[kpi.key] ?? 0}
                {/* Pulsing dot for upcoming returns with overdue items */}
                {kpi.key === "upcomingReturns" &&
                  (kpis?.upcomingReturns || 0) > 0 && (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                    </span>
                  )}
              </p>
              {kpi.trend && (
                <p className={cn("text-xs mt-0.5", kpi.trendColor)}>
                  {kpi.trend}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ─── Main Content Grid ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
        {/* Left — Recent Activity (col-span-3) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <Link
              href="/activity"
              className="text-sm text-primary hover:underline"
            >
              View all →
            </Link>
          </div>

          <div className="bg-card rounded-xl border p-5">
            {!activityLog || activityLog.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recent activity
              </p>
            ) : (
              activityLog.map((log: any, idx: number) => (
                <div
                  key={log.id || idx}
                  className="flex items-center gap-3 py-3 border-b border-border/30 last:border-0"
                >
                  {/* Color dot based on activity type */}
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      activityTypeColor[log.actionType || log.type] ?? "bg-slate-400"
                    )}
                  />

                  {/* Avatar */}
                  <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                    {log.actor?.name ? getInitials(log.actor.name) : "?"}
                  </span>

                  {/* Description */}
                  <p className="text-sm truncate">
                    <span className="font-medium">
                      {log.actor?.name || "System"}
                    </span>{" "}
                    {log.description || ""}
                  </p>

                  {/* Relative time */}
                  <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap shrink-0">
                    {log.createdAt ? timeAgo(log.createdAt) : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right — Widgets (col-span-2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Widget 1: Asset Utilization Chart */}
          <div className="bg-card rounded-xl border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Asset Utilization</h3>
              <span className="text-xs text-muted-foreground">
                Last 30 days
              </span>
            </div>

            {!utilizationData || utilizationData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                No data available
              </p>
            ) : (
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={utilizationData}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="utilizationGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="hsl(238, 84%, 60%)"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="100%"
                          stopColor="hsl(238, 84%, 60%)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: string) => {
                        try {
                          return format(new Date(v), "d MMM");
                        } catch {
                          return v;
                        }
                      }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid hsl(220, 13%, 91%)",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                      labelFormatter={(v) => {
                        try {
                          return format(new Date(String(v)), "MMM d, yyyy");
                        } catch {
                          return String(v);
                        }
                      }}
                      formatter={(value) => [`${value}%`, "Utilization"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="utilization"
                      stroke="hsl(238, 84%, 60%)"
                      strokeWidth={2}
                      fill="url(#utilizationGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Widget 2: Upcoming Returns */}
          <div className="bg-card rounded-xl border p-5">
            <h3 className="text-sm font-semibold mb-4">Upcoming Returns</h3>

            {!upcomingReturns || upcomingReturns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No upcoming returns
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingReturns.map((item: any, idx: number) => (
                  <div
                    key={item.allocationId || item.id || idx}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium truncate",
                          item.status === "OVERDUE" && "text-red-600"
                        )}
                      >
                        {item.asset?.name || "Unknown Asset"}
                        {item.asset?.tag && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({item.asset.tag})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.holder?.name || "Unknown"}
                      </p>
                    </div>

                    {item.status === "OVERDUE" ? (
                      <span className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-xs rounded-full px-2 py-0.5 whitespace-nowrap font-medium">
                        {item.daysOverdue
                          ? `${item.daysOverdue}d overdue`
                          : "Overdue"}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {item.expectedReturnDate
                          ? format(
                              new Date(item.expectedReturnDate),
                              "MMM d, yyyy"
                            )
                          : "—"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
