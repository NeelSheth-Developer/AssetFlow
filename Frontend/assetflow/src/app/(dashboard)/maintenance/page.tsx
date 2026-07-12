"use client";

import { useState, useEffect } from "react";
import { maintenanceApi, assetsApi, usersApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Plus, Wrench, Circle, Loader2, MessageSquare, Send } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";

// ─── Pipeline stages ────────────────────────────────────────
const PIPELINE_STAGES = ["PENDING", "APPROVED", "TECHNICIAN_ASSIGNED", "IN_PROGRESS", "RESOLVED"] as const;
type PipelineStage = (typeof PIPELINE_STAGES)[number];

const stageLabels: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  TECHNICIAN_ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  REJECTED: "Rejected",
  ESCALATED: "Escalated",
};

const priorityColors: Record<string, string> = {
  LOW: "text-green-500",
  MEDIUM: "text-amber-500",
  HIGH: "text-orange-500",
  CRITICAL: "text-red-500",
};

const statusClasses: Record<string, string> = {
  PENDING: "bg-gray-100/80 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  APPROVED: "bg-blue-100/80 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  TECHNICIAN_ASSIGNED: "bg-indigo-100/80 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
  IN_PROGRESS: "bg-amber-100/80 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  RESOLVED: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  REJECTED: "bg-rose-100/80 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  ESCALATED: "bg-orange-100/80 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function formatStatus(status: string) {
  return stageLabels[status] || status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export default function MaintenancePage() {
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === "ADMIN" || user?.role === "ASSET_MANAGER";

  const [activeTab, setActiveTab] = useState<"pipeline" | "all">("pipeline");
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Data
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assetsList, setAssetsList] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Create form
  const [selectedAsset, setSelectedAsset] = useState("");
  const [issueType, setIssueType] = useState("");
  const [priority, setPriority] = useState("");
  const [description, setDescription] = useState("");

  // Detail/Action dialog
  const [detailReq, setDetailReq] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [assignTech, setAssignTech] = useState("");
  const [assignTechName, setAssignTechName] = useState("");
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolveCost, setResolveCost] = useState("");
  const [escalateReason, setEscalateReason] = useState("");

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  function fetchRequests() {
    maintenanceApi.list()
      .then((res: any) => { if (res.success && res.data) setRequests(res.data.requests || res.data.items || res.data || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { fetchRequests(); }, []);

  useEffect(() => {
    if (dialogOpen) {
      assetsApi.list().then((res: any) => { if (res.success && res.data) setAssetsList(res.data.assets || []); }).catch(() => {});
    }
  }, [dialogOpen]);

  useEffect(() => {
    if (detailReq) {
      maintenanceApi.getComments(detailReq.id).then((res: any) => { if (res.success && res.data) setComments(res.data.comments || []); }).catch(() => setComments([]));
      usersApi.list({ limit: 100 }).then((res: any) => { if (res.success && res.data) setAllUsers(res.data.users || []); }).catch(() => {});
    }
  }, [detailReq]);

  // Pipeline counts
  const stageCounts: Record<string, number> = {};
  PIPELINE_STAGES.forEach((s) => { stageCounts[s] = requests.filter((r: any) => r.status === s).length; });
  stageCounts["REJECTED"] = requests.filter((r: any) => r.status === "REJECTED").length;
  stageCounts["ESCALATED"] = requests.filter((r: any) => r.status === "ESCALATED").length;

  const filteredRequests = selectedStage
    ? requests.filter((r: any) => r.status === selectedStage)
    : requests;

  // ─── Handlers ─────────────────────────────────────────
  function resetForm() { setSelectedAsset(""); setIssueType(""); setPriority(""); setDescription(""); }

  function handleCreate() {
    if (!selectedAsset) { toast.error("Select an asset"); return; }
    if (!description.trim()) { toast.error("Describe the issue"); return; }
    setSubmitting(true);
    maintenanceApi.create({ assetId: selectedAsset, issue: description, issueType: issueType || undefined, priority: priority || undefined })
      .then(() => { toast.success("Request submitted"); setDialogOpen(false); resetForm(); fetchRequests(); })
      .catch((e: Error) => toast.error(e.message)).finally(() => setSubmitting(false));
  }

  function handleApprove(id: string) {
    maintenanceApi.approve(id).then((res: any) => { toast.success(res.message || "Approved"); fetchRequests(); if (detailReq?.id === id) setDetailReq({ ...detailReq, status: "APPROVED" }); }).catch((e: Error) => toast.error(e.message));
  }

  function handleReject(id: string) {
    setRejectId(id);
    setRejectReason("");
    setRejectOpen(true);
  }

  function confirmReject() {
    if (!rejectId || !rejectReason.trim()) { toast.error("Please provide a reason"); return; }
    maintenanceApi.reject(rejectId, rejectReason.trim()).then((res: any) => { toast.success(res.message || "Rejected"); fetchRequests(); setDetailReq(null); setRejectOpen(false); setRejectId(null); }).catch((e: Error) => toast.error(e.message));
  }

  function handleAssign(id: string) {
    if (!assignTech && !assignTechName.trim()) { toast.error("Select a technician or enter name"); return; }
    maintenanceApi.assign(id, { technicianId: assignTech || undefined, technicianName: assignTechName.trim() || undefined })
      .then((res: any) => { toast.success(res.message || "Assigned"); fetchRequests(); setDetailReq(null); setAssignTech(""); setAssignTechName(""); })
      .catch((e: Error) => toast.error(e.message));
  }

  function handleStart(id: string) {
    maintenanceApi.start(id).then((res: any) => { toast.success(res.message || "Started"); fetchRequests(); if (detailReq?.id === id) setDetailReq({ ...detailReq, status: "IN_PROGRESS" }); }).catch((e: Error) => toast.error(e.message));
  }

  function handleResolve(id: string) {
    if (!resolveNotes.trim()) { toast.error("Resolution notes required"); return; }
    maintenanceApi.resolve(id, { notes: resolveNotes, cost: resolveCost ? Number(resolveCost) : undefined })
      .then((res: any) => { toast.success(res.message || "Resolved"); fetchRequests(); setDetailReq(null); setResolveNotes(""); setResolveCost(""); })
      .catch((e: Error) => toast.error(e.message));
  }

  function handleEscalate(id: string) {
    if (!escalateReason.trim()) { toast.error("Reason required"); return; }
    maintenanceApi.escalate(id, { reason: escalateReason })
      .then((res: any) => { toast.success(res.message || "Escalated"); fetchRequests(); setDetailReq(null); setEscalateReason(""); })
      .catch((e: Error) => toast.error(e.message));
  }

  function handleAddComment() {
    if (!newComment.trim() || !detailReq) return;
    maintenanceApi.addComment(detailReq.id, newComment.trim())
      .then((res: any) => {
        if (res.success) { setComments([...comments, res.data?.comment || { id: Date.now(), text: newComment, author: { name: user?.name }, createdAt: new Date().toISOString() }]); setNewComment(""); }
      }).catch(() => {});
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-40 bg-muted animate-pulse rounded" />
        <div className="flex gap-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 w-24 bg-muted animate-pulse rounded-full" />)}</div>
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Maintenance</h1>
          <p className="text-muted-foreground text-sm">Manage repair requests and track maintenance workflows</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="px-4 py-2 rounded-lg">
          <Wrench className="size-4 mr-1.5" /><Plus className="size-4 mr-1.5" />New Request
        </Button>
      </div>

      {/* Tab buttons: Pipeline / All */}
      <div className="flex items-center gap-2">
        <button onClick={() => setActiveTab("pipeline")} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", activeTab === "pipeline" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>Pipeline View</button>
        <button onClick={() => setActiveTab("all")} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", activeTab === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>All Requests</button>
      </div>

      {/* Pipeline filter chips */}
      {activeTab === "pipeline" && (
        <div className="flex flex-wrap items-center gap-2">
          {[...PIPELINE_STAGES, "REJECTED" as const, "ESCALATED" as const].map((stage) => (
            <button
              key={stage}
              onClick={() => setSelectedStage(selectedStage === stage ? null : stage)}
              className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition-colors", selectedStage === stage ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
            >
              {stageLabels[stage] || stage} ({stageCounts[stage] || 0})
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {filteredRequests.length === 0 ? (
        <div className="text-center py-12"><p className="text-muted-foreground">No maintenance requests found</p></div>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Priority</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Raised By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((req: any, idx: number) => (
                <TableRow key={req.id || idx} className="cursor-pointer hover:bg-muted/30" onClick={() => setDetailReq(req)}>
                  <TableCell><Circle className={cn("h-3 w-3 fill-current", priorityColors[req.priority] || "text-gray-400", req.priority === "CRITICAL" && "animate-pulse")} /></TableCell>
                  <TableCell>
                    <div><p className="font-medium text-sm truncate">{req.asset?.name || "Unknown"}</p><p className="text-xs text-muted-foreground">{req.asset?.tag || "—"}</p></div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{req.issue || req.issueType || "—"}</TableCell>
                  <TableCell><Badge variant="secondary" className={cn("text-xs", statusClasses[req.status] || "")}>{formatStatus(req.status || "PENDING")}</Badge></TableCell>
                  <TableCell>
                    {req.technician ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">{getInitials(req.technician.name || req.technician)}</span>
                        <span className="text-sm">{req.technician.name || req.technician}</span>
                      </span>
                    ) : (<span className="text-sm text-muted-foreground">Unassigned</span>)}
                  </TableCell>
                  <TableCell className="text-sm">{req.raisedBy?.name || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{req.createdAt ? format(new Date(req.createdAt), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {canManage && req.status === "PENDING" && (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => handleApprove(req.id)} className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 hover:bg-emerald-200 transition">Approve</button>
                        <button onClick={() => handleReject(req.id)} className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 hover:bg-red-200 transition">Reject</button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ─── New Request Dialog ─────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New Maintenance Request</DialogTitle><DialogDescription>Report an issue with an asset.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5"><Label>Asset *</Label>
              <Select value={selectedAsset || undefined} onValueChange={(v) => setSelectedAsset(v ?? "")}><SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                <SelectContent>{assetsList.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.tag || "—"})</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Issue Type</Label>
              <Select value={issueType || undefined} onValueChange={(v) => setIssueType(v ?? "")}><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HARDWARE">Hardware</SelectItem><SelectItem value="SOFTWARE">Software</SelectItem>
                  <SelectItem value="PHYSICAL_DAMAGE">Physical Damage</SelectItem><SelectItem value="OTHER">Other</SelectItem>
                </SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Priority</Label>
              <Select value={priority || undefined} onValueChange={(v) => setPriority(v ?? "")}><SelectTrigger><SelectValue placeholder="Medium (default)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem><SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem><SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Description *</Label><Textarea placeholder="Describe the issue..." value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Detail / Action Dialog ────────────────────── */}
      <Dialog open={!!detailReq} onOpenChange={(o) => { if (!o) { setDetailReq(null); setComments([]); } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Circle className={cn("h-3 w-3 fill-current shrink-0", priorityColors[detailReq?.priority] || "text-gray-400")} />
              {detailReq?.asset?.name || "Maintenance Request"}
            </DialogTitle>
            <DialogDescription>{detailReq?.asset?.tag} — {formatStatus(detailReq?.status || "")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Issue:</span> <span className="font-medium">{detailReq?.issue || "—"}</span></div>
              <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{detailReq?.issueType || "—"}</span></div>
              <div><span className="text-muted-foreground">Priority:</span> <span className="font-medium">{detailReq?.priority || "—"}</span></div>
              <div><span className="text-muted-foreground">Raised by:</span> <span className="font-medium">{detailReq?.raisedBy?.name || "—"}</span></div>
              <div><span className="text-muted-foreground">Technician:</span> <span className="font-medium">{detailReq?.technician?.name || "Unassigned"}</span></div>
              <div><span className="text-muted-foreground">Created:</span> <span className="font-medium">{detailReq?.createdAt ? format(new Date(detailReq.createdAt), "MMM d, yyyy") : "—"}</span></div>
            </div>

            {/* Action sections based on status */}
            {canManage && detailReq?.status === "PENDING" && (
              <div className="border rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium">Actions</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleApprove(detailReq.id)} className="px-3 py-1.5 rounded-lg text-xs">Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleReject(detailReq.id)} className="px-3 py-1.5 rounded-lg text-xs">Reject</Button>
                </div>
              </div>
            )}

            {canManage && detailReq?.status === "APPROVED" && (
              <div className="border rounded-lg p-3 space-y-3">
                <p className="text-sm font-medium">Assign Technician</p>
                <Select value={assignTech || undefined} onValueChange={(v) => setAssignTech(v ?? "")}><SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>{allUsers.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select>
                <Input placeholder="Or enter external technician name" value={assignTechName} onChange={(e) => setAssignTechName(e.target.value)} />
                <Button size="sm" onClick={() => handleAssign(detailReq.id)} className="px-3 py-1.5 rounded-lg text-xs">Assign</Button>
              </div>
            )}

            {(detailReq?.status === "TECHNICIAN_ASSIGNED") && (
              <div className="border rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium">Start Work</p>
                <Button size="sm" onClick={() => handleStart(detailReq.id)} className="px-3 py-1.5 rounded-lg text-xs">Mark In Progress</Button>
              </div>
            )}

            {(detailReq?.status === "IN_PROGRESS") && (
              <div className="border rounded-lg p-3 space-y-3">
                <p className="text-sm font-medium">Resolve</p>
                <Textarea placeholder="Resolution notes..." value={resolveNotes} onChange={(e) => setResolveNotes(e.target.value)} className="text-sm" />
                <Input placeholder="Cost (optional)" type="number" min={0} value={resolveCost} onChange={(e) => setResolveCost(e.target.value)} />
                <Button size="sm" onClick={() => handleResolve(detailReq.id)} className="px-3 py-1.5 rounded-lg text-xs">Resolve</Button>
              </div>
            )}

            {canManage && detailReq?.status !== "RESOLVED" && detailReq?.status !== "REJECTED" && detailReq?.status !== "ESCALATED" && (
              <div className="border rounded-lg p-3 space-y-3">
                <p className="text-sm font-medium">Escalate</p>
                <Input placeholder="Reason for escalation" value={escalateReason} onChange={(e) => setEscalateReason(e.target.value)} />
                <Button size="sm" variant="outline" onClick={() => handleEscalate(detailReq.id)} className="px-3 py-1.5 rounded-lg text-xs">Escalate</Button>
              </div>
            )}

            {/* Comments */}
            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-sm font-medium flex items-center gap-1.5"><MessageSquare className="size-4" />Comments ({comments.length})</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {comments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet</p>}
                {comments.map((c: any, i: number) => (
                  <div key={c.id || i} className="bg-muted/50 rounded-lg p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{c.author?.name || "Unknown"}</span>
                      <span className="text-[10px] text-muted-foreground">{c.createdAt ? format(new Date(c.createdAt), "MMM d, HH:mm") : ""}</span>
                    </div>
                    <p className="text-xs mt-0.5">{c.text}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Add a comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} className="text-sm" onKeyDown={(e) => { if (e.key === "Enter") handleAddComment(); }} />
                <Button size="sm" variant="ghost" onClick={handleAddComment} disabled={!newComment.trim()}><Send className="size-4" /></Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* ─── Reject Reason Dialog ──────────────────────── */}
      <Dialog open={rejectOpen} onOpenChange={(o) => { if (!o) { setRejectOpen(false); setRejectId(null); setRejectReason(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Maintenance Request</DialogTitle>
            <DialogDescription>Provide a reason for rejecting this request.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Reason <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Why is this request being rejected?"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className={cn(!rejectReason.trim() && rejectReason !== "" && "border-destructive")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="px-4 py-2 rounded-lg" onClick={() => { setRejectOpen(false); setRejectId(null); }}>Cancel</Button>
            <Button variant="destructive" className="px-4 py-2 rounded-lg" onClick={confirmReject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
