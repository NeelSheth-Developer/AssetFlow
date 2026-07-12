"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  ClipboardCheck,
  Plus,
  Loader2,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Users,
  Lock,
  Search,
  UserPlus,
} from "lucide-react";
import { format } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { auditsApi, usersApi } from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────
interface CycleStats {
  total: number;
  verified: number;
  discrepancy: number;
  missing: number;
  pending: number;
  completionPercent: number;
}

interface AuditCycle {
  id: string;
  name: string;
  scopeType: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
  closedAt: string | null;
  stats: CycleStats;
  auditors?: { id: string; name: string; email: string }[];
  departments?: { id: string; name: string }[];
}

interface AuditItem {
  id: string;
  asset: { id: string; tag: string; name: string; serial: string; status: string };
  expectedLocation: string;
  verification: string;
  notes: string | null;
  photo: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

interface ProgressData {
  total: number;
  verified: number;
  discrepancy: number;
  missing: number;
  pending: number;
  completionPercent: number;
  byAuditor: { auditor: { id: string; name: string }; completed: number }[];
}

// ─── Colors ─────────────────────────────────────────────────
const STAT_COLORS = {
  verified: "#10b981",
  discrepancy: "#f59e0b",
  missing: "#ef4444",
  pending: "#cbd5e1",
};

// ─── Animation ──────────────────────────────────────────────
const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } } };

// ─── Helpers ────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const verificationConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  PENDING: { icon: Clock, color: "text-slate-500", bg: "bg-slate-50", label: "Pending" },
  VERIFIED: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Verified" },
  DISCREPANCY: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", label: "Discrepancy" },
  MISSING: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Missing" },
};

// ═══════════════════════════════════════════════════════════════
export default function AuditsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN";

  const [cycles, setCycles] = useState<AuditCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Detail
  const [selectedCycle, setSelectedCycle] = useState<AuditCycle | null>(null);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [itemFilter, setItemFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [auditName, setAuditName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Assign auditors dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);

  // Hover state for pie
  const [activePieIdx, setActivePieIdx] = useState<number | null>(null);

  // Notes dialog for marking items
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [pendingMark, setPendingMark] = useState<{ itemId: string; verification: string } | null>(null);
  const [markNotes, setMarkNotes] = useState("");

  // ─── Fetch cycles ─────────────────────────────────────
  useEffect(() => { fetchCycles(); }, []);

  async function fetchCycles() {
    setLoading(true);
    try {
      const res: any = await auditsApi.list();
      const data = res.data ?? res;
      setCycles(data.cycles || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load audit cycles");
    } finally {
      setLoading(false);
    }
  }

  // ─── Open detail ──────────────────────────────────────
  async function openDetail(cycle: AuditCycle) {
    setSelectedCycle(cycle);
    setDetailLoading(true);
    setItemFilter("ALL");
    setSearchQuery("");
    try {
      const [detailRes, itemsRes, progressRes]: any[] = await Promise.all([
        auditsApi.get(cycle.id),
        auditsApi.getItems(cycle.id),
        auditsApi.progress(cycle.id),
      ]);
      const detail = detailRes.data?.cycle ?? detailRes.cycle ?? cycle;
      setSelectedCycle(detail);
      const itemsData = itemsRes.data ?? itemsRes;
      setItems(itemsData.items || []);
      const prog = progressRes.data ?? progressRes;
      setProgress(prog);
    } catch (e: any) {
      toast.error(e.message || "Failed to load details");
    } finally {
      setDetailLoading(false);
    }
  }

  // ─── Mark item ────────────────────────────────────────
  async function markItem(itemId: string, verification: string, notes?: string) {
    if (!selectedCycle) return;
    try {
      await auditsApi.updateItem(selectedCycle.id, itemId, { verification, notes });
      toast.success(`Marked as ${verification.toLowerCase()}`);
      openDetail(selectedCycle);
    } catch (e: any) {
      toast.error(e.message || "Failed to mark item");
    }
  }

  // Open notes dialog for discrepancy/missing
  function openNotesDialog(itemId: string, verification: string) {
    setPendingMark({ itemId, verification });
    setMarkNotes("");
    setNotesDialogOpen(true);
  }

  // Submit mark with notes
  async function submitMarkWithNotes() {
    if (!pendingMark) return;
    await markItem(pendingMark.itemId, pendingMark.verification, markNotes || undefined);
    setNotesDialogOpen(false);
    setPendingMark(null);
    setMarkNotes("");
  }

  // ─── Close cycle ──────────────────────────────────────
  async function closeCycle() {
    if (!selectedCycle) return;
    try {
      const res: any = await auditsApi.close(selectedCycle.id);
      const data = res.data ?? res;
      toast.success(`Cycle closed. ${data.cycle?.assetsMarkedLost || 0} assets marked LOST`);
      setSelectedCycle(null);
      fetchCycles();
    } catch (e: any) {
      toast.error(e.message || "Failed to close cycle");
    }
  }

  // ─── Create cycle ─────────────────────────────────────
  async function handleCreate() {
    if (!auditName || auditName.length < 3) { toast.error("Name must be at least 3 characters"); return; }
    setSubmitting(true);
    try {
      const body: any = { name: auditName };
      if (startDate) body.startDate = startDate;
      if (endDate) body.endDate = endDate;
      await auditsApi.create(body);
      toast.success("Audit cycle created");
      setCreateOpen(false);
      setAuditName(""); setStartDate(""); setEndDate("");
      fetchCycles();
    } catch (e: any) {
      toast.error(e.message || "Failed to create cycle");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Assign auditors ─────────────────────────────────
  async function openAssignDialog() {
    setAssignOpen(true);
    setSelectedUsers([]);
    try {
      const res: any = await usersApi.list({ limit: 100 });
      const data = res.data ?? res;
      setAllUsers(data.users || []);
    } catch {
      toast.error("Failed to load users");
    }
  }

  async function handleAssign() {
    if (!selectedCycle || selectedUsers.length === 0) return;
    setAssigning(true);
    try {
      await auditsApi.assignAuditors(selectedCycle.id, selectedUsers);
      toast.success(`${selectedUsers.length} auditor(s) assigned`);
      setAssignOpen(false);
      openDetail(selectedCycle);
    } catch (e: any) {
      toast.error(e.message || "Failed to assign auditors");
    } finally {
      setAssigning(false);
    }
  }

  // ─── Filter ───────────────────────────────────────────
  const filteredItems = items.filter((item) => {
    const matchStatus = itemFilter === "ALL" || item.verification === itemFilter;
    const matchSearch = !searchQuery || item.asset.tag.toLowerCase().includes(searchQuery.toLowerCase()) || item.asset.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });
  const filteredCycles = cycles.filter((c) => statusFilter === "ALL" || c.status === statusFilter);

  // ═══════════════════════════════════════════════════════
  // DETAIL VIEW
  // ═══════════════════════════════════════════════════════
  if (selectedCycle) {
    const pieData = progress ? [
      { name: "Verified", value: progress.verified, color: STAT_COLORS.verified },
      { name: "Discrepancy", value: progress.discrepancy, color: STAT_COLORS.discrepancy },
      { name: "Missing", value: progress.missing, color: STAT_COLORS.missing },
      { name: "Pending", value: progress.pending, color: STAT_COLORS.pending },
    ].filter((d) => d.value > 0) : [];

    return (
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4">
          <button onClick={() => setSelectedCycle(null)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <ArrowLeft className="size-5 text-slate-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-800 truncate">{selectedCycle.name}</h1>
            <p className="text-sm text-slate-500">
              {selectedCycle.startDate && format(new Date(selectedCycle.startDate), "MMM d")} – {selectedCycle.endDate && format(new Date(selectedCycle.endDate), "MMM d, yyyy")}
              <span className={cn("ml-3 text-xs font-semibold px-2.5 py-0.5 rounded-full", selectedCycle.status === "ACTIVE" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600")}>
                {selectedCycle.status}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && selectedCycle.status === "ACTIVE" && (
              <>
                <Button onClick={openAssignDialog} variant="outline" size="sm" className="border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                  <UserPlus className="size-4 mr-1.5" /> Assign Auditors
                </Button>
                <Button onClick={closeCycle} variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50">
                  <Lock className="size-4 mr-1.5" /> Close Cycle
                </Button>
              </>
            )}
          </div>
        </motion.div>

        {detailLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-indigo-500" /></div>
        ) : (
          <>
            {/* Stats row */}
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* Pie chart card */}
              <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 col-span-2 md:col-span-2 flex items-center gap-4" onMouseLeave={() => setActivePieIdx(null)}>
                <div className="h-[120px] w-[120px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={2}
                        onMouseEnter={(_, idx) => setActivePieIdx(idx)}
                        onMouseLeave={() => setActivePieIdx(null)}
                      >
                        {pieData.map((d, idx) => (
                          <Cell key={idx} fill={d.color} opacity={activePieIdx === null || activePieIdx === idx ? 1 : 0.25} style={{ transition: "opacity 0.3s" }} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.1)", padding: "8px 14px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-slate-800">{progress?.completionPercent ?? 0}%</p>
                  <p className="text-xs text-slate-400">Completion</p>
                  <div className="space-y-1.5 mt-2">
                    {pieData.map((d, idx) => (
                      <div key={idx} className="flex items-center gap-2 cursor-pointer" style={{ opacity: activePieIdx === null || activePieIdx === idx ? 1 : 0.4, transition: "opacity 0.3s" }}
                        onMouseEnter={() => setActivePieIdx(idx)} onMouseLeave={() => setActivePieIdx(null)}>
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-xs text-slate-600">{d.name}</span>
                        <span className="text-xs text-slate-400 ml-auto font-semibold">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Stat cards */}
              {[
                { label: "Verified", value: progress?.verified ?? 0, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "Discrepancy", value: progress?.discrepancy ?? 0, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
                { label: "Missing", value: progress?.missing ?? 0, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
              ].map((stat) => (
                <motion.div key={stat.label} variants={itemVariants} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", stat.bg)}>
                    <stat.icon className={cn("size-4", stat.color)} />
                  </div>
                  <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* Auditors */}
            {progress?.byAuditor && progress.byAuditor.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="size-4 text-indigo-500" />
                  <h3 className="text-sm font-bold text-slate-800">Auditor Progress</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {progress.byAuditor.map((a) => (
                    <div key={a.auditor.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/60">
                      <span className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                        {getInitials(a.auditor.name)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{a.auditor.name}</p>
                        <p className="text-xs text-slate-400">{a.completed} items completed</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Checklist */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <ClipboardCheck className="size-4 text-indigo-500" /> Asset Checklist ({filteredItems.length})
                </h3>
                <div className="flex items-center gap-2 ml-auto flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                    <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 w-44" />
                  </div>
                  {["ALL", "PENDING", "VERIFIED", "DISCREPANCY", "MISSING"].map((f) => (
                    <button key={f} onClick={() => setItemFilter(f)}
                      className={cn("px-3 py-1.5 text-xs font-semibold rounded-full transition-all", itemFilter === f ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                      {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="bg-card rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-sm text-muted-foreground">
                          No items found
                        </TableCell>
                      </TableRow>
                    ) : filteredItems.map((item) => {
                      const cfg = verificationConfig[item.verification] || verificationConfig.PENDING;
                      const Icon = cfg.icon;
                      return (
                        <TableRow key={item.id}>
                          {/* Asset */}
                          <TableCell>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">
                                {item.asset.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.asset.tag}
                              </p>
                            </div>
                          </TableCell>

                          {/* Location */}
                          <TableCell className="text-sm">
                            {item.expectedLocation || "—"}
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={cn("text-xs", cfg.bg, cfg.color)}
                            >
                              <Icon className="size-3 mr-1" />
                              {cfg.label}
                            </Badge>
                          </TableCell>

                          {/* Notes */}
                          <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                            {item.notes || "—"}
                          </TableCell>

                          {/* Actions */}
                          <TableCell>
                            {item.verification === "PENDING" && selectedCycle.status === "ACTIVE" ? (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => openNotesDialog(item.id, "VERIFIED")}
                                  className="text-xs bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 px-2 py-1 rounded hover:bg-green-200 transition"
                                >
                                  Verified
                                </button>
                                <button
                                  onClick={() => openNotesDialog(item.id, "DISCREPANCY")}
                                  className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 px-2 py-1 rounded hover:bg-amber-200 transition"
                                >
                                  Discrepancy
                                </button>
                                <button
                                  onClick={() => openNotesDialog(item.id, "MISSING")}
                                  className="text-xs bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 px-2 py-1 rounded hover:bg-red-200 transition"
                                >
                                  Missing
                                </button>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}

        {/* Notes Dialog for Verified/Discrepancy/Missing */}
        <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {pendingMark?.verification === "VERIFIED" ? "Mark as Verified" : pendingMark?.verification === "DISCREPANCY" ? "Report Discrepancy" : "Report Missing"}
              </DialogTitle>
              <DialogDescription>
                Add optional notes about this asset.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5">
                <Label>Notes (optional)</Label>
                <textarea
                  value={markNotes}
                  onChange={(e) => setMarkNotes(e.target.value)}
                  placeholder={
                    pendingMark?.verification === "VERIFIED"
                      ? "e.g. Physically verified on floor walk"
                      : pendingMark?.verification === "DISCREPANCY"
                      ? "e.g. Found in room 305 instead of 204"
                      : "e.g. Not found on any floor"
                  }
                  className="w-full min-h-[80px] p-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 resize-none"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={submitMarkWithNotes}
                className={cn(
                  "text-white",
                  pendingMark?.verification === "VERIFIED"
                    ? "bg-emerald-500 hover:bg-emerald-600"
                    : pendingMark?.verification === "DISCREPANCY"
                    ? "bg-amber-500 hover:bg-amber-600"
                    : "bg-red-500 hover:bg-red-600"
                )}
              >
                {pendingMark?.verification === "VERIFIED" ? "Mark Verified" : pendingMark?.verification === "DISCREPANCY" ? "Mark Discrepancy" : "Mark Missing"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Auditors Dialog */}
        <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Assign Auditors</DialogTitle>
              <DialogDescription>Select employees to assign as auditors for this cycle.</DialogDescription>
            </DialogHeader>
            <div className="max-h-[300px] overflow-y-auto space-y-1.5 py-2">
              {allUsers.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">Loading users...</p>
              ) : allUsers.map((u: any) => (
                <label key={u.id} className={cn("flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors", selectedUsers.includes(u.id) ? "bg-indigo-50 border border-indigo-200" : "hover:bg-slate-50 border border-transparent")}>
                  <input type="checkbox" checked={selectedUsers.includes(u.id)} onChange={(e) => {
                    if (e.target.checked) setSelectedUsers([...selectedUsers, u.id]);
                    else setSelectedUsers(selectedUsers.filter((id) => id !== u.id));
                  }} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0">
                    {getInitials(u.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{u.name}</p>
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                  </div>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
              <Button onClick={handleAssign} disabled={assigning || selectedUsers.length === 0} className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white">
                {assigning && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Assign ({selectedUsers.length})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-100 animate-pulse rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (<div key={i} className="h-[180px] bg-white animate-pulse rounded-2xl border border-slate-100" />))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Asset Audits</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage verification cycles and track asset health</p>
        </div>
        {isAdmin && (
          <button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-200/50 hover:shadow-indigo-300/50 hover:-translate-y-0.5 transition-all">
            <Plus className="h-4 w-4" /> Create Audit Cycle
          </button>
        )}
      </motion.div>

      <div className="flex items-center gap-2">
        {["ALL", "ACTIVE", "CLOSED"].map((f) => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={cn("px-4 py-1.5 text-xs font-semibold rounded-full transition-all", statusFilter === f ? "bg-indigo-500 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50")}>
            {f === "ALL" ? "All Cycles" : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {filteredCycles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-4"><ClipboardCheck className="size-6 text-slate-400" /></div>
          <p className="text-sm text-slate-500">No audit cycles found</p>
          {isAdmin && <p className="text-xs text-slate-400 mt-1">Create one to get started</p>}
        </div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCycles.map((cycle) => (
            <motion.div key={cycle.id} variants={itemVariants} whileHover={{ y: -3 }} onClick={() => openDetail(cycle)}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 cursor-pointer hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{cycle.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {cycle.startDate && format(new Date(cycle.startDate), "MMM d")} – {cycle.endDate && format(new Date(cycle.endDate), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1", cycle.status === "ACTIVE" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                    {cycle.status === "ACTIVE" && <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                    {cycle.status}
                  </span>
                  <ChevronRight className="size-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400 font-medium">Progress</span>
                  <span className="text-sm font-bold text-slate-700">{cycle.stats?.completionPercent ?? 0}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500" style={{ width: `${cycle.stats?.completionPercent ?? 0}%` }} />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="size-3" /> {cycle.stats?.verified ?? 0} Verified
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">
                  <AlertTriangle className="size-3" /> {cycle.stats?.discrepancy ?? 0} Discrepancy
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-600">
                  <XCircle className="size-3" /> {cycle.stats?.missing ?? 0} Missing
                </span>
                <span className="text-xs text-slate-400 ml-auto font-medium">{cycle.stats?.total ?? 0} total</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Audit Cycle</DialogTitle>
            <DialogDescription>All non-disposed assets in scope will be snapshotted into a checklist.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Audit Name</Label>
              <Input placeholder="e.g. Q3 2026 Full Audit" value={auditName} onChange={(e) => setAuditName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Start Date (optional)</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>End Date (optional)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting} className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white">
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create Audit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}