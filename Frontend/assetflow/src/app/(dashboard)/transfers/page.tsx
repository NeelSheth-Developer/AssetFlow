"use client";

import { useState, useEffect } from "react";
import { transfersApi, assetsApi, usersApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Plus, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

export default function TransfersPage() {
  const user = useAuthStore((s) => s.user);
  const canApprove = user?.role === "ADMIN" || user?.role === "ASSET_MANAGER" || user?.role === "DEPT_HEAD";

  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [assets, setAssets] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedAsset, setSelectedAsset] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [reason, setReason] = useState("");

  function fetchTransfers() {
    transfersApi.list()
      .then((res: any) => { if (res.success && res.data) setTransfers(res.data.transfers || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { fetchTransfers(); }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    assetsApi.list({ status: "ALLOCATED" })
      .then((res: any) => { if (res.success && res.data) setAssets(res.data.assets || []); }).catch(() => {});
    usersApi.list({ limit: 100 })
      .then((res: any) => { if (res.success && res.data) setEmployees(res.data.users || []); }).catch(() => {});
  }, [dialogOpen]);

  function handleCreate() {
    if (!selectedAsset) { toast.error("Select an asset"); return; }
    if (!selectedUser) { toast.error("Select a recipient"); return; }
    if (!reason.trim()) { toast.error("Provide a reason"); return; }
    setSubmitting(true);
    transfersApi.create({ assetId: selectedAsset, toUserId: selectedUser, reason: reason.trim() })
      .then((res: any) => {
        toast.success(res.message || "Transfer requested");
        setDialogOpen(false);
        setSelectedAsset(""); setSelectedUser(""); setReason("");
        fetchTransfers();
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setSubmitting(false));
  }

  function handleApprove(id: string) {
    transfersApi.approve(id)
      .then((res: any) => { toast.success(res.message || "Approved"); fetchTransfers(); })
      .catch((e: Error) => toast.error(e.message));
  }

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  function handleReject(id: string) {
    setRejectId(id);
    setRejectReason("");
    setRejectOpen(true);
  }

  function confirmReject() {
    if (!rejectId || !rejectReason.trim()) { toast.error("Provide a reason"); return; }
    transfersApi.reject(rejectId, rejectReason.trim())
      .then((res: any) => { toast.success(res.message || "Rejected"); setRejectOpen(false); setRejectId(null); fetchTransfers(); })
      .catch((e: Error) => toast.error(e.message));
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transfers</h1>
          <p className="text-muted-foreground text-sm">Request and manage asset transfers between users</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="rounded-lg">
          <Plus className="size-4 mr-1.5" />Request Transfer
        </Button>
      </div>

      {transfers.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No transfer requests</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                {canApprove && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{t.asset?.name || "—"}</p>
                      <p className="text-xs text-muted-foreground font-mono">{t.asset?.tag || ""}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{t.from?.name || "—"}</TableCell>
                  <TableCell className="text-sm">{t.to?.name || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{t.reason || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-xs", statusColors[t.status] || "")}>
                      {t.status || "REQUESTED"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.createdAt ? format(new Date(t.createdAt), "MMM d, yyyy") : "—"}
                  </TableCell>
                  {canApprove && (
                    <TableCell className="text-right">
                      {t.status === "REQUESTED" && (
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => handleApprove(t.id)} className="h-7 w-7 rounded-md bg-emerald-100 dark:bg-emerald-950/40 hover:bg-emerald-200 flex items-center justify-center">
                            <Check className="size-3.5 text-emerald-700" />
                          </button>
                          <button onClick={() => handleReject(t.id)} className="h-7 w-7 rounded-md bg-red-100 dark:bg-red-950/40 hover:bg-red-200 flex items-center justify-center">
                            <X className="size-3.5 text-red-700" />
                          </button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Request Transfer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Transfer</DialogTitle>
            <DialogDescription>Transfer an allocated asset to another user.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Asset (allocated) *</Label>
              <Select value={selectedAsset || undefined} onValueChange={(v) => setSelectedAsset(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                <SelectContent>
                  {assets.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.tag})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Transfer to *</Label>
              <Select value={selectedUser || undefined} onValueChange={(v) => setSelectedUser(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  {employees.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Reason *</Label>
              <Textarea placeholder="Why is this transfer needed?" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={rejectOpen} onOpenChange={(o) => { if (!o) { setRejectOpen(false); setRejectId(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Transfer</DialogTitle>
            <DialogDescription>Provide a reason for rejection.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Reason <span className="text-destructive">*</span></Label>
              <Textarea placeholder="Why is this transfer being rejected?" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
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
