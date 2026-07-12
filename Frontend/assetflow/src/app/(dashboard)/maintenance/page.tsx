"use client";

import { useState, useEffect } from "react";
import { maintenanceApi, assetsApi } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus, Wrench, Circle, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";

// ─── Pipeline stages ────────────────────────────────────────
const PIPELINE_STAGES = ["PENDING", "APPROVED", "TECHNICIAN_ASSIGNED", "IN_PROGRESS", "RESOLVED"] as const;
type PipelineStage = (typeof PIPELINE_STAGES)[number];

const stageLabels: Record<PipelineStage, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  TECHNICIAN_ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
};

// ─── Priority dot colors ────────────────────────────────────
const priorityColors: Record<string, string> = {
  LOW: "text-green-500",
  MEDIUM: "text-amber-500",
  HIGH: "text-orange-500",
  CRITICAL: "text-red-500",
};

// ─── Status badge colors ────────────────────────────────────
const statusClasses: Record<string, string> = {
  PENDING:
    "bg-gray-100/80 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  APPROVED:
    "bg-blue-100/80 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  ASSIGNED:
    "bg-indigo-100/80 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
  TECHNICIAN_ASSIGNED:
    "bg-indigo-100/80 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
  IN_PROGRESS:
    "bg-amber-100/80 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  RESOLVED:
    "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  REJECTED:
    "bg-rose-100/80 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  ESCALATED:
    "bg-orange-100/80 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
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
// MAINTENANCE PAGE
// ═══════════════════════════════════════════════════════════════
export default function MaintenancePage() {
  const [selectedStage, setSelectedStage] = useState<PipelineStage | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Data state
  const [maintenanceRequests, setMaintenanceRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assetsList, setAssetsList] = useState<any[]>([]);

  // Form state
  const [selectedAsset, setSelectedAsset] = useState("");
  const [issueType, setIssueType] = useState("");
  const [priority, setPriority] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    maintenanceApi.list()
      .then((res: any) => {
        if (res.success && res.data) {
          setMaintenanceRequests(res.data.requests || res.data.items || res.data || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch assets when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      assetsApi.list()
        .then((res: any) => {
          if (res.success && res.data) {
            setAssetsList(res.data.assets || res.data.items || res.data || []);
          }
        })
        .catch(() => {});
    }
  }, [dialogOpen]);

  // Count per stage
  const stageCounts = PIPELINE_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = maintenanceRequests.filter((r: any) => r.status === stage).length;
      return acc;
    },
    {} as Record<PipelineStage, number>
  );

  // Filter requests
  const filteredRequests = selectedStage
    ? maintenanceRequests.filter((r: any) => r.status === selectedStage)
    : maintenanceRequests;

  function resetForm() {
    setSelectedAsset("");
    setIssueType("");
    setPriority("");
    setDescription("");
  }

  function handleApproveRequest(id: string) {
    maintenanceApi.approve(id)
      .then((res: any) => {
        if (res.success) {
          toast.success(res.message || "Request approved");
          maintenanceApi.list().then((r: any) => {
            if (r.success && r.data) {
              setMaintenanceRequests(r.data.requests || r.data.items || r.data || []);
            }
          });
        } else {
          toast.error(res.message || "Approval failed");
        }
      })
      .catch((err: Error) => toast.error(err.message || "Failed"));
  }

  function handleRejectRequest(id: string) {
    const reason = prompt("Rejection reason:");
    if (!reason) return;
    maintenanceApi.reject(id, reason)
      .then((res: any) => {
        if (res.success) {
          toast.success(res.message || "Request rejected");
          maintenanceApi.list().then((r: any) => {
            if (r.success && r.data) {
              setMaintenanceRequests(r.data.requests || r.data.items || r.data || []);
            }
          });
        } else {
          toast.error(res.message || "Rejection failed");
        }
      })
      .catch((err: Error) => toast.error(err.message || "Failed"));
  }

  function handleSubmit() {
    if (!selectedAsset) { toast.error("Please select an asset"); return; }
    if (!description.trim()) { toast.error("Please describe the issue"); return; }

    setSubmitting(true);
    maintenanceApi.create({
      assetId: selectedAsset,
      issue: description,
      issueType: issueType || undefined,
      priority: priority || undefined,
    }).then(() => {
      toast.success("Maintenance request submitted");
      setSubmitting(false);
      setDialogOpen(false);
      resetForm();
      // Refresh
      maintenanceApi.list().then((res: any) => {
        if (res.success && res.data) {
          setMaintenanceRequests(res.data.requests || res.data.items || res.data || []);
        }
      }).catch(() => {});
    }).catch((err: Error) => {
      toast.error(err.message || "Request failed");
      setSubmitting(false);
    });
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-40 bg-muted animate-pulse rounded" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-24 bg-muted animate-pulse rounded-full" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Maintenance</h1>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Wrench className="h-4 w-4" />
          <Plus className="h-4 w-4" />
          New Request
        </button>
      </div>

      {/* ─── Pipeline Stepper ──────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {PIPELINE_STAGES.map((stage) => (
          <button
            key={stage}
            onClick={() =>
              setSelectedStage(selectedStage === stage ? null : stage)
            }
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              selectedStage === stage
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {stageLabels[stage]} ({stageCounts[stage]})
          </button>
        ))}
      </div>

      {/* ─── Data Table ────────────────────────────────── */}
      {filteredRequests.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No maintenance requests found</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Priority</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Issue Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Raised By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((req: any, idx: number) => (
                <TableRow key={req.id || idx}>
                  {/* Priority */}
                  <TableCell>
                    <Circle
                      className={cn(
                        "h-3 w-3 fill-current",
                        priorityColors[req.priority] || "text-gray-400",
                        req.priority === "CRITICAL" && "animate-pulse"
                      )}
                    />
                  </TableCell>

                  {/* Asset */}
                  <TableCell>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {req.asset?.name || req.assetName || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {req.asset?.tag || req.assetTag || "—"}
                      </p>
                    </div>
                  </TableCell>

                  {/* Issue Type */}
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {formatStatus(req.issueType || req.issue_type || "OTHER")}
                    </Badge>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        statusClasses[req.status] || ""
                      )}
                    >
                      {formatStatus(req.status || "PENDING")}
                    </Badge>
                  </TableCell>

                  {/* Assigned To */}
                  <TableCell>
                    {req.technician ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
                          {getInitials(req.technician.name || req.technician)}
                        </span>
                        <span className="text-sm">{req.technician.name || req.technician}</span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Unassigned
                      </span>
                    )}
                  </TableCell>

                  {/* Raised By */}
                  <TableCell className="text-sm">
                    {req.raisedBy?.name || req.reporter?.name || "—"}
                  </TableCell>

                  {/* Date */}
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {req.createdAt
                      ? format(new Date(req.createdAt), "MMM d, yyyy")
                      : "—"}
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    {req.status === "PENDING" && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleApproveRequest(req.id)}
                          className="text-xs bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 px-2 py-1 rounded hover:bg-green-200 transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectRequest(req.id)}
                          className="text-xs bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 px-2 py-1 rounded hover:bg-red-200 transition"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ─── New Maintenance Request Dialog ────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Maintenance Request</DialogTitle>
            <DialogDescription>
              Report an issue with an asset for maintenance or repair.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Asset */}
            <div className="grid gap-1.5">
              <Label>Asset</Label>
              <Select value={selectedAsset} onValueChange={(v) => setSelectedAsset(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an asset" />
                </SelectTrigger>
                <SelectContent>
                  {assetsList.length > 0 ? (
                    assetsList.map((asset: any) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name} ({asset.tag || "No tag"})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="loading" disabled>Loading assets...</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Issue Type */}
            <div className="grid gap-1.5">
              <Label>Issue Type</Label>
              <Select value={issueType} onValueChange={(v) => setIssueType(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select issue type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HARDWARE">Hardware</SelectItem>
                  <SelectItem value="SOFTWARE">Software</SelectItem>
                  <SelectItem value="PHYSICAL_DAMAGE">Physical Damage</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label htmlFor="maint-description">Description</Label>
              <Textarea
                id="maint-description"
                placeholder="Describe the issue in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
