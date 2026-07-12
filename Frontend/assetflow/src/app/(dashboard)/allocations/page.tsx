"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Plus, Loader2, AlertCircle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://assetflow-production-85d2.up.railway.app/api";

// ─── Types matching backend response ────────────────────────
interface AllocationItem {
  id: string;
  status: string;
  purpose: string;
  asset: { id: string; tag: string; name: string };
  holder: { id: string; name: string };
  allocatedBy: string;
  allocatedAt: string;
  expectedReturnDate: string | null;
  returnRequestedAt: string | null;
  conditionOnReturn: string | null;
  returnNotes: string | null;
  returnedAt: string | null;
  isOverdue: boolean;
}

interface KanbanData {
  columns: {
    PENDING: { count: number; items: AllocationItem[] };
    ACTIVE: { count: number; items: AllocationItem[] };
    RETURN_REQUESTED: { count: number; items: AllocationItem[] };
    OVERDUE: { count: number; items: AllocationItem[] };
  };
}

interface ColumnConfig {
  key: keyof KanbanData["columns"];
  title: string;
  headerClassName?: string;
}

const columnConfigs: ColumnConfig[] = [
  { key: "PENDING", title: "Pending" },
  { key: "ACTIVE", title: "Active" },
  { key: "RETURN_REQUESTED", title: "Return Requested" },
  { key: "OVERDUE", title: "Overdue", headerClassName: "bg-red-50/50 dark:bg-red-950/20" },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function AllocationsPage() {
  const [kanbanData, setKanbanData] = useState<KanbanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Dialog form state
  const [availableAssets, setAvailableAssets] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedAsset, setSelectedAsset] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch kanban data from backend
  useEffect(() => {
    fetch(`${API}/allocations/kanban`, { credentials: "include" })
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setKanbanData(res.data);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Fetch assets + users for the dialog when it opens
  useEffect(() => {
    if (!dialogOpen) return;
    // Fetch available assets
    fetch(`${API}/assets?status=AVAILABLE`, { credentials: "include" })
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setAvailableAssets(res.data.assets || []);
        }
      })
      .catch(() => {});
    // Fetch users
    fetch(`${API}/users`, { credentials: "include" })
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setEmployees(res.data.users || []);
        }
      })
      .catch(() => {});
  }, [dialogOpen]);

  function handleApprove(allocationId: string) {
    fetch(`${API}/allocations/${allocationId}/approve`, {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          toast.success(res.message || "Allocation approved");
          // Refresh kanban
          fetch(`${API}/allocations/kanban`, { credentials: "include" })
            .then((r) => r.json())
            .then((res) => { if (res.success && res.data) setKanbanData(res.data); });
        } else {
          toast.error(res.message || "Approval failed");
        }
      })
      .catch((err) => toast.error(err.message || "Request failed"));
  }

  function handleApproveReturn(allocationId: string) {
    fetch(`${API}/allocations/${allocationId}/return/approve`, {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          toast.success(res.message || "Return approved");
          // Refresh kanban
          fetch(`${API}/allocations/kanban`, { credentials: "include" })
            .then((r) => r.json())
            .then((res) => { if (res.success && res.data) setKanbanData(res.data); });
        } else {
          toast.error(res.message || "Approval failed");
        }
      })
      .catch((err) => toast.error(err.message || "Request failed"));
  }

  function resetForm() {
    setSelectedAsset("");
    setSelectedEmployee("");
    setExpectedReturnDate("");
    setNotes("");
  }

  function handleSubmit() {
    if (!selectedAsset) { toast.error("Please select an asset"); return; }
    if (!selectedEmployee) { toast.error("Please select an employee"); return; }

    setSubmitting(true);
    fetch(`${API}/allocations`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: selectedAsset,
        employeeId: selectedEmployee,
        expectedReturnDate: expectedReturnDate || undefined,
        purpose: notes || undefined,
      }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          toast.success(res.message || "Asset allocated successfully");
          setDialogOpen(false);
          resetForm();
          // Refresh kanban
          fetch(`${API}/allocations/kanban`, { credentials: "include" })
            .then((r) => r.json())
            .then((res) => { if (res.success && res.data) setKanbanData(res.data); });
        } else {
          toast.error(res.message || "Allocation failed");
        }
      })
      .catch((err) => toast.error(err.message || "Request failed"))
      .finally(() => setSubmitting(false));
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-10 bg-muted animate-pulse rounded-lg" />
              <div className="h-32 bg-muted animate-pulse rounded-xl" />
              <div className="h-32 bg-muted animate-pulse rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error || !kanbanData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Unable to load allocations</h2>
        <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Allocations</h1>
          <p className="text-muted-foreground">Track asset allocations and transfers</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Allocate Asset
        </button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columnConfigs.map((col) => {
          const column = kanbanData.columns[col.key];
          return (
            <div key={col.key} className="space-y-3">
              {/* Column Header */}
              <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2", col.headerClassName || "bg-muted/50")}>
                <h3 className="text-sm font-semibold">{col.title}</h3>
                <span className="rounded-full bg-muted px-2 text-xs font-medium">
                  {column.count}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-3">
                {column.items.map((allocation) => (
                  <div
                    key={allocation.id}
                    className={cn(
                      "bg-card rounded-xl border p-4 space-y-2",
                      allocation.isOverdue && "border-l-2 border-l-red-500"
                    )}
                  >
                    {/* Asset name */}
                    <p className="text-sm font-medium">{allocation.asset.name}</p>

                    {/* Asset tag */}
                    <p className="text-xs font-mono text-muted-foreground">{allocation.asset.tag}</p>

                    {/* Purpose */}
                    {allocation.purpose && (
                      <p className="text-xs text-muted-foreground italic">{allocation.purpose}</p>
                    )}

                    {/* Holder */}
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-medium shrink-0">
                        {getInitials(allocation.holder.name)}
                      </div>
                      <span className="text-xs text-muted-foreground">{allocation.holder.name}</span>
                    </div>

                    {/* Expected return date */}
                    {allocation.expectedReturnDate && (
                      <p className={cn("text-xs", allocation.isOverdue ? "text-red-600 font-medium" : "text-muted-foreground")}>
                        {allocation.isOverdue ? "⚠ Overdue — " : "Return: "}
                        {format(new Date(allocation.expectedReturnDate), "MMM d, yyyy")}
                      </p>
                    )}

                    {/* Return notes if RETURN_REQUESTED */}
                    {allocation.status === "RETURN_REQUESTED" && allocation.returnNotes && (
                      <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 rounded px-2 py-1">
                        {allocation.returnNotes}
                      </p>
                    )}

                    {/* Action buttons for PENDING or RETURN_REQUESTED */}
                    {allocation.status === "PENDING" && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleApprove(allocation.id)}
                          className="text-xs bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 px-2 py-1 rounded hover:bg-green-200 transition"
                        >
                          Approve
                        </button>
                      </div>
                    )}
                    {allocation.status === "RETURN_REQUESTED" && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleApproveReturn(allocation.id)}
                          className="text-xs bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 px-2 py-1 rounded hover:bg-green-200 transition"
                        >
                          Approve Return
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {column.items.length === 0 && (
                  <div className="rounded-xl border border-dashed p-4 text-center">
                    <p className="text-xs text-muted-foreground">No allocations</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Allocate Asset Dialog ─────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Allocate Asset</DialogTitle>
            <DialogDescription>
              Assign an available asset to an employee.
              {availableAssets.length > 0 && ` ${availableAssets.length} assets available.`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Asset */}
            <div className="grid gap-1.5">
              <Label>Asset *</Label>
              <Select value={selectedAsset || undefined} onValueChange={(v) => setSelectedAsset(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an available asset" />
                </SelectTrigger>
                <SelectContent>
                  {availableAssets.map((asset: any) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name} ({asset.tag})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employee */}
            <div className="grid gap-1.5">
              <Label>Employee *</Label>
              <Select value={selectedEmployee || undefined} onValueChange={(v) => setSelectedEmployee(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} — {user.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Expected Return Date */}
            <div className="grid gap-1.5">
              <Label htmlFor="return-date">Expected Return Date</Label>
              <Input
                id="return-date"
                type="date"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
              />
            </div>

            {/* Purpose/Notes */}
            <div className="grid gap-1.5">
              <Label htmlFor="allocation-notes">Purpose</Label>
              <Textarea
                id="allocation-notes"
                placeholder="e.g. Development laptop, Client demos..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Allocate Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
