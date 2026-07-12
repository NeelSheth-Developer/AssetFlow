"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Download,
  TrendingUp,
  Wrench,
  AlertTriangle,
  Building2,
  Clock,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// ─── API Base ───────────────────────────────────────────────
const API = "https://assetflow-production-85d2.up.railway.app/api";

// ─── Custom Bar Shape with fade effect ──────────────────────
function FadeBar(props: any) {
  const { x, y, width, height, fill, activeIndex, index } = props;
  const isActive = activeIndex === null || activeIndex === index;
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={5}
      ry={5}
      fill={fill}
      opacity={isActive ? 1 : 0.25}
      style={{ transition: "opacity 0.3s ease", filter: isActive ? "none" : "blur(0.5px)" }}
    />
  );
}

// ─── Chart Colors ───────────────────────────────────────────
const COLORS = ["#6366f1", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

// ─── Types ──────────────────────────────────────────────────
interface UtilizationData {
  mostUsed: { asset: string; count: number }[];
  idle: { asset: string; idleDays: number }[];
}

interface MaintenanceFreqData {
  byCategory: { category: string; count: number }[];
}

interface DueForMaintenanceData {
  dueOrNearingRetirement: { asset: string; note: string }[];
}

interface AllocationSummaryData {
  byDepartment: { department: string; allocatedCount: number }[];
}

interface BookingHeatmapData {
  heatmap: { resource: string; peakHour: string; bookings: number }[];
}

// ─── Animation Variants ─────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

// ═══════════════════════════════════════════════════════════════
// REPORTS PAGE
// ═══════════════════════════════════════════════════════════════
export default function ReportsPage() {
  const [utilization, setUtilization] = useState<UtilizationData | null>(null);
  const [maintenanceFreq, setMaintenanceFreq] = useState<MaintenanceFreqData | null>(null);
  const [dueForMaintenance, setDueForMaintenance] = useState<DueForMaintenanceData | null>(null);
  const [allocationSummary, setAllocationSummary] = useState<AllocationSummaryData | null>(null);
  const [bookingHeatmap, setBookingHeatmap] = useState<BookingHeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeBarIndex1, setActiveBarIndex1] = useState<number | null>(null);
  const [activeBarIndex2, setActiveBarIndex2] = useState<number | null>(null);
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);
  const [activeAllocIndex, setActiveAllocIndex] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([
      fetch(`${API}/reports/utilization`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API}/reports/maintenance-frequency`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API}/reports/due-for-maintenance`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API}/reports/allocation-summary`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API}/reports/booking-heatmap`, { credentials: "include" }).then((r) => r.json()),
    ]).then(([utilRes, maintRes, dueRes, allocRes, heatRes]) => {
      if (!mounted) return;

      if (utilRes.status === "fulfilled") {
        const d = utilRes.value?.data ?? utilRes.value;
        if (d?.mostUsed || d?.idle) setUtilization(d);
      }
      if (maintRes.status === "fulfilled") {
        const d = maintRes.value?.data ?? maintRes.value;
        if (d?.byCategory) setMaintenanceFreq(d);
      }
      if (dueRes.status === "fulfilled") {
        const d = dueRes.value?.data ?? dueRes.value;
        if (d?.dueOrNearingRetirement) setDueForMaintenance(d);
      }
      if (allocRes.status === "fulfilled") {
        const d = allocRes.value?.data ?? allocRes.value;
        if (d?.byDepartment) setAllocationSummary(d);
      }
      if (heatRes.status === "fulfilled") {
        const d = heatRes.value?.data ?? heatRes.value;
        if (d?.heatmap) setBookingHeatmap(d);
      }
    }).finally(() => {
      if (mounted) setLoading(false);
    });

    return () => { mounted = false; };
  }, []);

  // Export CSV handler
  const handleExport = async (type: string) => {
    try {
      const res = await fetch(`${API}/reports/export?type=${type}&format=csv`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-report.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-56 bg-slate-100 animate-pulse rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[250px] bg-white animate-pulse rounded-2xl border border-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Reports & Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Operational insights across your asset ecosystem
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport("allocation-summary")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <Download className="h-4 w-4 text-indigo-500" />
            Export CSV
          </button>
        </div>
      </motion.div>

      {/* ─── Cards Grid ────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
      >
        {/* Card 1: Most Used Assets — Bar Chart */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 h-fit">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                <TrendingUp className="size-3.5 text-indigo-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Most Used Assets</h3>
            </div>
            <button
              onClick={() => handleExport("utilization")}
              className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-indigo-500 transition-colors"
            >
              <Download className="size-3.5" />
            </button>
          </div>

          {utilization?.mostUsed && utilization.mostUsed.length > 0 ? (
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={utilization.mostUsed.slice(0, 6)}
                  margin={{ top: 4, right: 4, left: -15, bottom: 0 }}
                  onMouseMove={(state) => {
                    if (state?.activeTooltipIndex !== undefined) {
                      setActiveBarIndex1(Number(state.activeTooltipIndex));
                    }
                  }}
                  onMouseLeave={() => setActiveBarIndex1(null)}
                >
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#a5b4fc" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.06} vertical={false} />
                  <XAxis dataKey="asset" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.split("—")[0]?.trim().slice(0, 7) || v.slice(0, 7)} />
                  <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={false}
                    contentStyle={{ fontSize: 11, borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.1)", padding: "8px 14px" }}
                    formatter={(value) => [`${value} allocations`, "Usage"]}
                  />
                  <Bar dataKey="count" fill="url(#barGrad)" shape={(props: any) => <FadeBar {...props} activeIndex={activeBarIndex1} />} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-10">No data available</p>
          )}
        </motion.div>

        {/* Card 2: Maintenance Frequency — Donut */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 h-fit">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <Wrench className="size-3.5 text-amber-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Maintenance Frequency</h3>
            </div>
            <button
              onClick={() => handleExport("maintenance-frequency")}
              className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-indigo-500 transition-colors"
            >
              <Download className="size-3.5" />
            </button>
          </div>

          {maintenanceFreq?.byCategory && maintenanceFreq.byCategory.length > 0 ? (
            <div className="flex items-center gap-3 h-[180px]">
              <div className="flex-1 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart onMouseLeave={() => setActivePieIndex(null)}>
                    <Pie
                      data={maintenanceFreq.byCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="category"
                      onMouseEnter={(_, idx) => setActivePieIndex(idx)}
                      onMouseLeave={() => setActivePieIndex(null)}
                    >
                      {maintenanceFreq.byCategory.map((_, idx) => (
                        <Cell
                          key={idx}
                          fill={COLORS[idx % COLORS.length]}
                          opacity={activePieIndex === null || activePieIndex === idx ? 1 : 0.25}
                          style={{ transition: "opacity 0.3s ease, filter 0.3s ease", filter: activePieIndex === null || activePieIndex === idx ? "none" : "blur(0.5px)" }}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.1)", padding: "8px 14px" }} formatter={(value, name) => [`${value}`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 shrink-0 w-28">
                {maintenanceFreq.byCategory.slice(0, 5).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 cursor-pointer rounded-md px-1 py-0.5 transition-all"
                    style={{ opacity: activePieIndex === null || activePieIndex === idx ? 1 : 0.4 }}
                    onMouseEnter={() => setActivePieIndex(idx)}
                    onMouseLeave={() => setActivePieIndex(null)}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-[10px] text-slate-600 truncate">{item.category}</span>
                    <span className="text-[10px] text-slate-400 ml-auto font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-10">No data available</p>
          )}
        </motion.div>

        {/* Card 3: Allocation Summary — Progress Bars */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 h-fit">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <Building2 className="size-3.5 text-blue-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Allocation by Dept</h3>
            </div>
            <button
              onClick={() => handleExport("allocation-summary")}
              className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-indigo-500 transition-colors"
            >
              <Download className="size-3.5" />
            </button>
          </div>

          {allocationSummary?.byDepartment && allocationSummary.byDepartment.length > 0 ? (
            <div className="space-y-4 pt-2" onMouseLeave={() => setActiveAllocIndex(null)}>
              {allocationSummary.byDepartment.slice(0, 6).map((dept, idx) => {
                const max = Math.max(...allocationSummary.byDepartment.map((d) => d.allocatedCount));
                const pct = max > 0 ? (dept.allocatedCount / max) * 100 : 0;
                const isActive = activeAllocIndex === null || activeAllocIndex === idx;
                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setActiveAllocIndex(idx)}
                    className="cursor-pointer transition-all duration-300"
                    style={{ opacity: isActive ? 1 : 0.3, filter: isActive ? "none" : "blur(0.5px)" }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-slate-700">{dept.department}</span>
                      <span className="text-xs font-bold text-slate-800">{dept.allocatedCount}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.4 + idx * 0.1, duration: 0.6, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ background: COLORS[idx % COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-10">No data available</p>
          )}
        </motion.div>

        {/* Card 4: Booking Heatmap — Bar */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 h-fit">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center">
                <Clock className="size-3.5 text-cyan-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Booking Heatmap</h3>
            </div>
            <button
              onClick={() => handleExport("booking-heatmap")}
              className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-indigo-500 transition-colors"
            >
              <Download className="size-3.5" />
            </button>
          </div>

          {bookingHeatmap?.heatmap && bookingHeatmap.heatmap.length > 0 ? (
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={bookingHeatmap.heatmap.slice(0, 6)}
                  margin={{ top: 4, right: 4, left: -15, bottom: 0 }}
                  onMouseMove={(state) => {
                    if (state?.activeTooltipIndex !== undefined) {
                      setActiveBarIndex2(Number(state.activeTooltipIndex));
                    }
                  }}
                  onMouseLeave={() => setActiveBarIndex2(null)}
                >
                  <defs>
                    <linearGradient id="heatGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#67e8f9" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.06} vertical={false} />
                  <XAxis dataKey="resource" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 10) + "…" : v} />
                  <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={false}
                    contentStyle={{ fontSize: 11, borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.1)", padding: "8px 14px" }}
                    formatter={(value, _name, props) => [`${value} bookings · Peak: ${(props.payload as any)?.peakHour || "—"}`]}
                  />
                  <Bar dataKey="bookings" fill="url(#heatGrad)" shape={(props: any) => <FadeBar {...props} activeIndex={activeBarIndex2} />} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-10">No data available</p>
          )}
        </motion.div>

        {/* Card 5: Due for Maintenance — List */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 h-fit md:col-span-2 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center">
                <AlertTriangle className="size-3.5 text-rose-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Due for Maintenance</h3>
            </div>
            <div className="flex items-center gap-2">
              {utilization?.idle && (
                <span className="text-[10px] bg-emerald-50 text-emerald-600 font-semibold px-2 py-0.5 rounded-full">
                  {utilization.idle.length} idle assets
                </span>
              )}
              <button
                onClick={() => handleExport("due-for-maintenance")}
                className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-indigo-500 transition-colors"
              >
                <Download className="size-3.5" />
              </button>
            </div>
          </div>

          {dueForMaintenance?.dueOrNearingRetirement && dueForMaintenance.dueOrNearingRetirement.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {dueForMaintenance.dueOrNearingRetirement.slice(0, 8).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/60 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-700 truncate">{item.asset}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{item.note}</p>
                  </div>
                  <span className="text-[9px] font-bold bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ml-2">
                    Needs attention
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-10">All assets healthy</p>
          )}

          {/* Idle assets sub-section */}
          {utilization?.idle && utilization.idle.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="size-3.5 text-emerald-500" />
                <h4 className="text-xs font-bold text-slate-700">Idle Assets</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {utilization.idle.slice(0, 6).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/60">
                    <span className="text-[11px] font-medium text-slate-600 truncate">{item.asset}</span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0 ml-2">
                      {item.idleDays}d
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}