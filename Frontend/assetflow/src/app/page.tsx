"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Package,
  ArrowLeftRight,
  Calendar,
  Wrench,
  ClipboardCheck,
  BarChart3,
  ShieldCheck,
  QrCode,
  Bell,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const features = [
  {
    icon: Package,
    title: "Asset Registry",
    description:
      "Every asset tagged, categorized and QR-coded — with custom fields per category and full document trails.",
  },
  {
    icon: ArrowLeftRight,
    title: "Allocations & Transfers",
    description:
      "Check assets out to people, approve returns with condition check-ins, and transfer between employees with an audit trail.",
  },
  {
    icon: Calendar,
    title: "Resource Booking",
    description:
      "Conflict-checked booking for shared resources — meeting rooms, vehicles, equipment — with recurring series.",
  },
  {
    icon: Wrench,
    title: "Maintenance Workflow",
    description:
      "Raise → approve → assign technician → resolve. Assets automatically leave and re-enter service.",
  },
  {
    icon: ClipboardCheck,
    title: "Physical Audits",
    description:
      "Snapshot checklists per cycle, multi-auditor verification, discrepancy reports, and automatic lost-asset marking.",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    description:
      "Utilization, idle assets, maintenance frequency, booking heatmaps — all exportable to CSV.",
  },
];

const highlights = [
  { icon: ShieldCheck, label: "Role-based access — Admin, Asset Manager, Dept Head, Employee" },
  { icon: QrCode, label: "QR codes on every asset for instant scanning" },
  { icon: Bell, label: "Real-time notifications for every hand-off" },
];

export default function LandingPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Nav — floating glass pill ── */}
      <header className="sticky top-4 z-50 px-4">
        <div className="mx-auto max-w-5xl h-14 px-3 sm:px-5 flex items-center justify-between rounded-full border border-white/50 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg shadow-primary/10 ring-1 ring-primary/10">
          <Link href="/" className="inline-flex">
            <Logo markClassName="h-8 w-8" />
          </Link>

          {/* section links */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              ["Features", "#features"],
              ["Modules", "#features"],
              ["Roles", "#features"],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="rounded-full px-3.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-primary/5 transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>

          <nav className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className={cn(
                  buttonVariants(),
                  "rounded-full bg-gradient-to-r from-primary to-violet-500 hover:opacity-90 shadow-md shadow-primary/25"
                )}
              >
                Open Dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className={cn(buttonVariants({ variant: "ghost" }), "rounded-full")}
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className={cn(
                    buttonVariants(),
                    "rounded-full bg-gradient-to-r from-primary to-violet-500 hover:opacity-90 shadow-md shadow-primary/25"
                  )}
                >
                  Get started <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Layered background: gradient glows + grid */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {/* grid pattern, faded out radially */}
          <div
            className="absolute inset-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.08)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_35%,black,transparent)]"
          />
          {/* gradient glows */}
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[480px] w-[720px] rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute top-40 -left-32 h-[320px] w-[320px] rounded-full bg-violet-500/15 blur-[100px]" />
          <div className="absolute top-24 -right-24 h-[300px] w-[300px] rounded-full bg-sky-400/15 blur-[100px]" />
          <div className="absolute top-96 right-1/4 h-[180px] w-[180px] rounded-full bg-amber-400/10 blur-[80px]" />
        </div>

        {/* Floating module chips */}
        {[
          { icon: Package, label: "AF-0042 allocated", cls: "left-[6%] top-36", delay: 0 },
          { icon: Calendar, label: "Room B2 · 10:00", cls: "right-[7%] top-32", delay: 1.2 },
          { icon: Wrench, label: "Repair approved", cls: "left-[10%] top-[26rem]", delay: 0.6 },
          { icon: ClipboardCheck, label: "Audit 92% done", cls: "right-[9%] top-[24rem]", delay: 1.8 },
        ].map((chip) => (
          <motion.div
            key={chip.label}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: [0, -12, 0] }}
            transition={{
              opacity: { delay: chip.delay, duration: 0.6 },
              y: { repeat: Infinity, duration: 5, ease: "easeInOut", delay: chip.delay },
            }}
            className={`hidden lg:flex absolute ${chip.cls} items-center gap-2 rounded-full border border-border/60 bg-card/80 backdrop-blur px-3.5 py-2 text-xs font-medium shadow-lg shadow-primary/5`}
          >
            <chip.icon className="h-3.5 w-3.5 text-primary" />
            {chip.label}
          </motion.div>
        ))}

        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex justify-center mb-8"
            >
              {/* Full brand lockup: mark + wordmark + tagline */}
              <div className="relative inline-flex items-center gap-4 sm:gap-5">
                <div
                  aria-hidden
                  className="absolute -inset-8 rounded-full bg-gradient-to-r from-primary/25 via-violet-500/20 to-sky-400/25 blur-3xl opacity-80"
                />
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }}
                  className="relative shrink-0"
                >
                  <LogoMark className="h-20 w-20 sm:h-24 sm:w-24 drop-shadow-[0_8px_24px_rgba(88,101,242,0.35)]" />
                </motion.div>
                <div className="relative text-left">
                  <p className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-none">
                    Asset
                    <span className="bg-gradient-to-r from-primary via-indigo-500 to-violet-500 bg-clip-text text-transparent">
                      Flow
                    </span>
                  </p>
                  <p className="mt-2 text-sm sm:text-lg font-medium tracking-wide text-muted-foreground">
                    Track. Manage. Optimize.
                  </p>
                </div>
              </div>
            </motion.div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-6">
              <Sparkles className="h-3 w-3" />
              Enterprise Asset & Resource Management
            </span>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight">
              Every asset. Every hand-off.
              <br />
              <span className="bg-gradient-to-r from-primary via-indigo-500 to-violet-500 bg-clip-text text-transparent">
                One flow.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              AssetFlow digitizes how your organization tracks, allocates, books, maintains and
              audits physical assets — from laptops to meeting rooms to vehicles.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={isAuthenticated ? "/dashboard" : "/signup"}
                className={cn(buttonVariants({ size: "lg" }), "px-8")}
              >
                {isAuthenticated ? "Open Dashboard" : "Start free"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link href="/login" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "px-8")}>
                Sign in
              </Link>
            </div>
          </motion.div>

          {/* highlight strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8"
          >
            {highlights.map((h) => (
              <span key={h.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                <h.icon className="h-4 w-4 text-primary shrink-0" />
                {h.label}
              </span>
            ))}
          </motion.div>

          {/* ── Dashboard preview mock ── */}
          <motion.div
            initial={{ opacity: 0, y: 40, rotateX: 8 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 0.35, duration: 0.7, ease: "easeOut" }}
            style={{ perspective: 1200 }}
            className="relative mt-16 mx-auto max-w-4xl"
          >
            {/* glow under the panel */}
            <div aria-hidden className="absolute -inset-6 rounded-[2rem] bg-gradient-to-r from-primary/25 via-violet-500/20 to-sky-400/25 blur-2xl" />
            <div className="relative rounded-2xl border border-border/60 bg-card/90 backdrop-blur shadow-2xl overflow-hidden text-left">
              {/* window chrome */}
              <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2.5 bg-muted/40">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-3 text-xs text-muted-foreground flex items-center gap-1.5">
                  <LogoMark className="h-3.5 w-3.5" /> AssetFlow — Dashboard
                </span>
              </div>

              <div className="p-5 grid grid-cols-12 gap-4">
                {/* KPI tiles */}
                {[
                  { label: "Available", value: "128", bar: "w-3/4", color: "bg-emerald-500" },
                  { label: "Allocated", value: "86", bar: "w-1/2", color: "bg-blue-500" },
                  { label: "Maintenance", value: "7", bar: "w-1/4", color: "bg-orange-500" },
                  { label: "Bookings", value: "23", bar: "w-2/3", color: "bg-indigo-500" },
                ].map((k) => (
                  <div key={k.label} className="col-span-6 sm:col-span-3 rounded-xl border border-border/50 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
                    <p className="text-xl font-bold mt-0.5">{k.value}</p>
                    <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${k.color} ${k.bar}`} />
                    </div>
                  </div>
                ))}

                {/* area chart mock */}
                <div className="col-span-12 sm:col-span-8 rounded-xl border border-border/50 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                    Asset utilization · 30 days
                  </p>
                  <svg viewBox="0 0 400 96" className="w-full h-24" preserveAspectRatio="none" aria-hidden>
                    <defs>
                      <linearGradient id="lp-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,72 C40,60 60,78 90,64 C120,50 150,58 180,42 C210,28 240,44 270,34 C300,24 330,30 360,18 L400,12 L400,96 L0,96 Z"
                      fill="url(#lp-area)"
                    />
                    <path
                      d="M0,72 C40,60 60,78 90,64 C120,50 150,58 180,42 C210,28 240,44 270,34 C300,24 330,30 360,18 L400,12"
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                {/* health donut mock */}
                <div className="col-span-12 sm:col-span-4 rounded-xl border border-border/50 p-3 flex items-center gap-3">
                  <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90 shrink-0" aria-hidden>
                    <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" className="stroke-muted" />
                    <circle
                      cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" strokeLinecap="round"
                      strokeDasharray="82 97.4" className="stroke-emerald-500"
                    />
                  </svg>
                  <div>
                    <p className="text-lg font-bold leading-none">84</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Fleet health</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Good standing</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-16 w-full scroll-mt-24">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-2xl sm:text-3xl font-bold tracking-tight"
        >
          The complete asset lifecycle
        </motion.h2>
        <p className="text-center text-muted-foreground mt-2 mb-10">
          Registration → allocation → booking → maintenance → audit → retirement.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.4 }}
              className="group bg-card rounded-2xl border p-6 hover:border-primary/40 hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mx-auto max-w-6xl px-6 pb-20 w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="rounded-3xl bg-gradient-to-br from-primary via-indigo-600 to-violet-600 p-10 sm:p-14 text-center text-white shadow-xl"
        >
          <h2 className="text-2xl sm:text-3xl font-bold">Stop tracking assets in spreadsheets</h2>
          <p className="mt-3 text-white/85 max-w-xl mx-auto">
            Sign up in seconds — your admin promotes you when you&apos;re ready to manage.
          </p>
          <Link
            href={isAuthenticated ? "/dashboard" : "/signup"}
            className={cn(buttonVariants({ size: "lg", variant: "secondary" }), "mt-7 px-8 inline-flex")}
          >
            {isAuthenticated ? "Open Dashboard" : "Create your account"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-border/40 bg-card/40">
        <div className="mx-auto max-w-6xl px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 space-y-3">
            <Logo withTagline markClassName="h-9 w-9" />
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
              Enterprise asset & resource management for offices, schools, hospitals, factories
              and agencies.
            </p>
          </div>

          {/* Modules */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Modules
            </p>
            <ul className="space-y-2 text-sm">
              {[
                ["Dashboard", "/dashboard"],
                ["Assets", "/assets"],
                ["Allocations", "/allocations"],
                ["Bookings", "/bookings"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-muted-foreground hover:text-foreground transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Operations */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Operations
            </p>
            <ul className="space-y-2 text-sm">
              {[
                ["Maintenance", "/maintenance"],
                ["Audits", "/audits"],
                ["Reports", "/reports"],
                ["Activity Log", "/activity"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-muted-foreground hover:text-foreground transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Account
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors">
                  Sign in
                </Link>
              </li>
              <li>
                <Link href="/signup" className="text-muted-foreground hover:text-foreground transition-colors">
                  Create account
                </Link>
              </li>
              <li>
                <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground transition-colors">
                  Forgot password
                </Link>
              </li>
              <li>
                <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
                  Settings
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/40">
          <div className="mx-auto max-w-6xl px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} AssetFlow · Enterprise Asset & Resource Management
            </p>
            <p className="text-xs text-muted-foreground">
              Role-based · QR-enabled · Audit-ready
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
