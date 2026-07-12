"use client";

import { useState } from "react";
import { auditCycles } from "@/data/mock";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ClipboardCheck, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";

// ─── Status badge colors ────────────────────────────────────
const auditStatusClasses: Record<string, string> = {
  SCHEDULED:
    "bg-gray-100/80 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  IN_PROGRESS:
    "bg-amber-100/80 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  COMPLETED:
    "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  CLOSED:
    "bg-slate-100/80 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
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

function formatStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

// ═══════════════════════════════════════════════════════════════
// AUDITS PAGE
// ═══════════════════════════════════════════════════════════════
export default function AuditsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [auditName, setAuditName] = useState("");
  const [scope, setScope] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function resetForm() {
    setAuditName("");
    setScope("");
    setStartDate("");
    setEndDate("");
  }

  function handleSubmit() {
    setSubmitting(true);
    setTimeout(() => {
      toast.success("Audit cycle created successfully");
      setSubmitting(false);
      setDialogOpen(false);
      resetForm();
    }, 500);
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Asset Audits</h1>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <ClipboardCheck className="h-4 w-4" />
          <Plus className="h-4 w-4" />
          Create Audit Cycle
        </button>
      </div>

      {/* ─── Card Grid ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {auditCycles.map((cycle) => (
          <div
            key={cycle.id}
            className="bg-card rounded-xl border p-5 space-y-4"
          >
            {/* Title + Badges */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">{cycle.name}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {cycle.scopeType === "DEPARTMENT" ? "Department" : "Location"}
                </Badge>
                <Badge
                  variant="secondary"
                  className={cn("text-xs", auditStatusClasses[cycle.status])}
                >
                  {cycle.status === "IN_PROGRESS" && (
                    <span className="relative flex h-2 w-2 mr-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                  )}
                  {formatStatus(cycle.status)}
                </Badge>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Progress</span>
                <span className="text-xs font-medium">{cycle.progress}%</span>
              </div>
              <Progress value={cycle.progress} className="h-2" />
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Verified: {cycle.verifiedItems}</span>
              <span>Discrepancies: {cycle.discrepancies}</span>
              <span>Missing: {cycle.missing}</span>
            </div>

            {/* Date range */}
            <p className="text-xs text-muted-foreground">
              {format(new Date(cycle.startDate), "MMM d")} –{" "}
              {format(new Date(cycle.endDate), "MMM d, yyyy")}
            </p>

            {/* Auditors avatar stack */}
            <div className="flex items-center -space-x-2">
              {cycle.auditors.slice(0, 3).map((auditor, idx) => (
                <span
                  key={auditor.id}
                  className={cn(
                    "h-7 w-7 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-medium",
                    idx > 0 && "-ml-2"
                  )}
                  title={auditor.name}
                >
                  {getInitials(auditor.name)}
                </span>
              ))}
              {cycle.auditors.length > 3 && (
                <span className="h-7 w-7 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-medium -ml-2">
                  +{cycle.auditors.length - 3}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ─── Create Audit Cycle Dialog ─────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Audit Cycle</DialogTitle>
            <DialogDescription>
              Set up a new audit cycle to verify asset records.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Audit Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="audit-name">Audit Name</Label>
              <Input
                id="audit-name"
                placeholder="e.g. Q1 2025 IT Audit"
                value={auditName}
                onChange={(e) => setAuditName(e.target.value)}
              />
            </div>

            {/* Scope */}
            <div className="grid gap-1.5">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={(v) => setScope(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select audit scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEPARTMENT">Department</SelectItem>
                  <SelectItem value="LOCATION">Location</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="grid gap-1.5">
              <Label htmlFor="audit-start">Start Date</Label>
              <Input
                id="audit-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* End Date */}
            <div className="grid gap-1.5">
              <Label htmlFor="audit-end">End Date</Label>
              <Input
                id="audit-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Audit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
