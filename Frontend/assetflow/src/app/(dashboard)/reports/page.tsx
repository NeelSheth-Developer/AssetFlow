"use client";

import { useState } from "react";
import { utilizationData, categories, departments } from "@/data/mock";
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";
import { format } from "date-fns";
import {
  LineChart,
  Line,
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
  type PieLabelRenderProps,
} from "recharts";

// ─── Chart colors ───────────────────────────────────────────
const CHART_COLORS = ["#6366f1", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6"];

// ─── Derived data ───────────────────────────────────────────
const pieData = categories.slice(0, 4).map((cat) => ({
  name: cat.name,
  value: cat.assetCount,
}));

const barData = [...departments]
  .sort((a, b) => b.assetCount - a.assetCount)
  .slice(0, 5)
  .map((dept) => ({
    name: dept.name,
    assets: dept.assetCount,
  }));

// ─── Filter options ─────────────────────────────────────────
const FILTER_OPTIONS = ["7d", "30d", "90d", "1yr"] as const;

// ═══════════════════════════════════════════════════════════════
// REPORTS PAGE
// ═══════════════════════════════════════════════════════════════
export default function ReportsPage() {
  const [activeFilter, setActiveFilter] = useState<string>("30d");

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Reports &amp; Analytics
        </h1>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
            <Download className="h-4 w-4" />
            Export PDF
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* ─── Filter Row ────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option}
            onClick={() => setActiveFilter(option)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              activeFilter === option
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {option}
          </button>
        ))}
      </div>

      {/* ─── Chart Grid ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chart 1: Utilization Trends (Line) */}
        <div className="bg-card rounded-xl border p-5 h-[280px]">
          <h3 className="text-sm font-semibold mb-4">Utilization Trends</h3>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={utilizationData}
                margin={{ top: 4, right: 12, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => format(new Date(v), "d MMM")}
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
                  labelFormatter={(v) =>
                    format(new Date(String(v)), "MMM d, yyyy")
                  }
                  formatter={(value) => [`${value}%`, "Utilization"]}
                />
                <Line
                  type="monotone"
                  dataKey="utilization"
                  stroke={CHART_COLORS[0]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Category Distribution (Pie) */}
        <div className="bg-card rounded-xl border p-5 h-[280px]">
          <h3 className="text-sm font-semibold mb-4">Category Distribution</h3>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={(props: PieLabelRenderProps) =>
                    `${props.name ?? ""} ${(((props.percent as number) ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {pieData.map((_, idx) => (
                    <Cell
                      key={`cell-${idx}`}
                      fill={CHART_COLORS[idx % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid hsl(220, 13%, 91%)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Department Usage (Horizontal Bar) */}
        <div className="bg-card rounded-xl border p-5 h-[280px]">
          <h3 className="text-sm font-semibold mb-4">Department Usage</h3>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  opacity={0.3}
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid hsl(220, 13%, 91%)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                  formatter={(value) => [`${value} assets`, "Count"]}
                />
                <Bar dataKey="assets" radius={[0, 4, 4, 0]}>
                  {barData.map((_, idx) => (
                    <Cell
                      key={`bar-${idx}`}
                      fill={CHART_COLORS[idx % CHART_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Maintenance Costs (Placeholder) */}
        <div className="bg-card rounded-xl border p-5 h-[280px] flex flex-col">
          <h3 className="text-sm font-semibold mb-4">Maintenance Costs</h3>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
