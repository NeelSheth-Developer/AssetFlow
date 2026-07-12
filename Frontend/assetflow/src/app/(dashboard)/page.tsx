"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { motion } from "framer-motion";
import { Package, Calendar, Wrench, AlertCircle, TrendingUp, ArrowUpRight, Clock, RotateCcw } from "lucide-react";
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
    icon: Package,
    gradient: "from-emerald-500 to-green-500",
    bgLight: "bg-emerald-50",
    iconColor: "text-emerald-600",
    trend: "+8%",
    trendLabel: "vs last week",
  },
  {
    label: "Assets Allocated",
    key: "assetsAllocated" as const,
    icon: ArrowUpRight,
    gradient: "from-blue-500 to-indigo-500",
    bgLight: "bg-blue-50",
    iconColor: "text-blue-600",
    trend: "+3%",
    trendLabel: "vs last week",
  },
  {
    label: "Under Maintenance",
    key: "underMaintenance" as const,
    icon: Wrench,
    gradient: "from-amber-500 to-orange-500",
    bgLight: "bg-amber-50",
    iconColor: "text-amber-600",
    trend: null,
    trendLabel: "",
  },
  {
    label: "Active Bookings",
    key: "activeBookings" as const,
    icon: Calendar,
    gradient: "from-indigo-500 to-violet-500",
    bgLight: "bg-indigo-50",
    iconColor: "text-indigo-600",
    trend: null,
    trendLabel: "",
  },
  {
    label: "Pending Transfers",
    key: "pendingTransfers" as const,
    icon: RotateCcw,
    gradient: "from-purple-500 to-fuchsia-500",
    bgLight: "bg-purple-50",
    iconColor: "text-purple-600",
    trend: null,
    trendLabel: "",
  },
  {
    label: "Upcoming Returns",
    key: "upcomingReturns" as const,
    icon: Clock,
    gradient: "from-rose-500 to-red-500",
    bgLight: "bg-rose-50",
    iconColor: "text-rose-600",
    trend: "Action needed",
    trendLabel: "",
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
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
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

        if (kpisRes.status === "fulfilled" && kpisRes.value.success) {
          setKpis(kpisRes.value.data);
          anySuccess = true;
        }

        if (activityRes.status === "fulfilled" && activityRes.value.success) {
          setActivityLog(activityRes.value.data.activities || []);
          anySuccess = true;
        }

        if (chartRes.status === "fulfilled" && chartRes.value.success) {
          setUtilizationData(chartRes.value.data.dataPoints || []);
          anySuccess = true;
        }

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
        <div className="h-8 w-64 bg-slate-100 animate-pulse rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[130px] bg-white/80 animate-pulse rounded-2xl border border-slate-100" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 h-72 bg-white/80 animate-pulse rounded-2xl border border-slate-100" />
          <div className="lg:col-span-2 h-72 bg-white/80 animate-pulse rounded-2xl border border-slate-100" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">Unable to load data</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          We couldn&apos;t fetch dashboard data from the server. Please check your
          connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-indigo-200/50 transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Greeting Row ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            {getGreeting()}, {user?.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {[
            { href: "/allocations", icon: Package, label: "Allocate" },
            { href: "/bookings", icon: Calendar, label: "Book" },
            { href: "/maintenance", icon: Wrench, label: "Maintenance" },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="bg-white rounded-xl px-4 py-2.5 text-sm font-medium flex items-center gap-2 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200"
            >
              <action.icon className="h-4 w-4 text-indigo-500" />
              {action.label}
            </Link>
          ))}
        </div>
      </motion.div>

      {/* ─── KPI Row ─────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4"
      >
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.key}
              variants={itemVariants}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group"
            >
              {/* Subtle gradient overlay on hover */}
              <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-[0.03] transition-opacity bg-gradient-to-br", kpi.gradient)} />

              <div className="relative z-10">
                {/* Icon */}
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", kpi.bgLight)}>
                  <Icon className={cn("size-4", kpi.iconColor)} />
                </div>

                {/* Value */}
                <p className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  {kpis?.[kpi.key] ?? 0}
                  {kpi.key === "upcomingReturns" &&
                    (kpis?.upcomingReturns || 0) > 0 && (
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                      </span>
                    )}
                </p>

                {/* Label */}
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  {kpi.label}
                </p>

                {/* Trend */}
                {kpi.trend && (
                  <div className="flex items-center gap-1 mt-2">
                    <span className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                      kpi.key === "upcomingReturns" 
                        ? "bg-rose-50 text-rose-600" 
                        : "bg-emerald-50 text-emerald-600"
                    )}>
                      {kpi.trend}
                    </span>
                    {kpi.trendLabel && (
                      <span className="text-[10px] text-slate-400">{kpi.trendLabel}</span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ─── Main Content Grid ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-2">
        {/* Left — Recent Activity (col-span-3) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="lg:col-span-3 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Recent Activity</h2>
            <Link
              href="/activity"
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
            >
              View all →
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            {!activityLog || activityLog.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                No recent activity
              </p>
            ) : (
              <div className="space-y-0.5">
                {activityLog.map((log: any, idx: number) => (
                  <div
                    key={log.id || idx}
                    className="flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-slate-50/80 transition-colors border-b border-slate-50 last:border-0"
                  >
                    {/* Color dot */}
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        activityTypeColor[log.actionType || log.type] ?? "bg-slate-400"
                      )}
                    />

                    {/* Avatar */}
                    <span className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-[10px] font-semibold text-indigo-700 shrink-0">
                      {log.actor?.name ? getInitials(log.actor.name) : "?"}
                    </span>

                    {/* Description */}
                    <p className="text-sm text-slate-600 truncate flex-1">
                      <span className="font-semibold text-slate-800">
                        {log.actor?.name || "System"}
                      </span>{" "}
                      {log.description || ""}
                    </p>

                    {/* Time */}
                    <span className="text-xs text-slate-400 ml-auto whitespace-nowrap shrink-0 font-medium">
                      {log.createdAt ? timeAgo(log.createdAt) : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Right — Widgets (col-span-2) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="lg:col-span-2 space-y-6"
        >
          {/* Widget 1: Asset Utilization Chart */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <TrendingUp className="size-3.5 text-indigo-500" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Asset Utilization</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium bg-slate-50 px-2 py-1 rounded-full">
                Last 30 days
              </span>
            </div>

            {!utilizationData || utilizationData.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">
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
                          stopColor="#6366f1"
                          stopOpacity={0.15}
                        />
                        <stop
                          offset="100%"
                          stopColor="#6366f1"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
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
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip
                      cursor={{ stroke: "rgba(99,102,241,0.1)", strokeWidth: 1 }}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 12,
                        border: "none",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                        background: "white",
                        padding: "8px 12px",
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
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#utilizationGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Widget 2: Upcoming Returns */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center">
                <Clock className="size-3.5 text-rose-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Upcoming Returns</h3>
            </div>

            {!upcomingReturns || upcomingReturns.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                No upcoming returns
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingReturns.map((item: any, idx: number) => (
                  <div
                    key={item.allocationId || item.id || idx}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm font-semibold truncate",
                          item.status === "OVERDUE" ? "text-rose-600" : "text-slate-700"
                        )}
                      >
                        {item.asset?.name || "Unknown Asset"}
                        {item.asset?.tag && (
                          <span className="text-xs text-slate-400 ml-1 font-normal">
                            ({item.asset.tag})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {item.holder?.name || "Unknown"}
                      </p>
                    </div>

                    {item.status === "OVERDUE" ? (
                      <span className="bg-rose-50 text-rose-600 text-[10px] rounded-full px-2.5 py-1 whitespace-nowrap font-semibold">
                        {item.daysOverdue
                          ? `${item.daysOverdue}d overdue`
                          : "Overdue"}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 whitespace-nowrap font-medium">
                        {item.expectedReturnDate
                          ? format(
                              new Date(item.expectedReturnDate),
                              "MMM d"
                            )
                          : "—"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}