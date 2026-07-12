"use client";

import { useState, useEffect, useCallback } from "react";
import { assetsApi, categoriesApi, locationsApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import {
  LayoutList, LayoutGrid, Plus, Monitor, Laptop, Armchair, Wrench, Car, Printer,
  Mouse, Tablet, Smartphone, Camera, Video, Archive, Table as TableIcon, Search,
  Loader2, Eye, Pencil, AlertTriangle,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format } from "date-fns";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Monitor, Laptop, Armchair, Wrench, Car, Printer, Mouse, Tablet, Smartphone,
  Camera, Video, Archive, Table: TableIcon,
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function AssetsPage() {
  const user = useAuthStore((s) => s.user);
  const canWrite = user?.role === "ADMIN" || user?.role === "ASSET_MANAGER";

  const [view, setView] = useState<"list" | "grid">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [condition, setCondition] = useState("NEW");
  const [location, setLocation] = useState("");
  const [isBookable, setIsBookable] = useState(false);
  const [purchaseCost, setPurchaseCost] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  // Detail dialog
  const [detailAsset, setDetailAsset] = useState<any>(null);
  const [detailHistory, setDetailHistory] = useState<any>(null);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<any>(null);

  // Action dialogs
  const [actionType, setActionType] = useState<"retire" | "dispose" | "markLost" | null>(null);
  const [actionAsset, setActionAsset] = useState<any>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionDate, setActionDate] = useState("");
  const [actionMethod, setActionMethod] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const fetchAssets = useCallback(() => {
    const params: any = {};
    if (statusFilter) params.status = statusFilter;
    assetsApi.list(params)
      .then((res: any) => { if (res.success && res.data) setAssets(res.data.assets || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  useEffect(() => {
    categoriesApi.list().then((res: any) => { if (res.success && res.data) setCategories(res.data.categories || []); }).catch(() => {});
    locationsApi.list().then((res: any) => { if (res.success && res.data) setLocations(res.data.locations || []); }).catch(() => {});
  }, []);

  // Fetch detail + history when detail dialog opens
  useEffect(() => {
    if (detailAsset) {
      assetsApi.history(detailAsset.id).then((res: any) => { if (res.success && res.data) setDetailHistory(res.data); }).catch(() => setDetailHistory(null));
    }
  }, [detailAsset]);

  const filteredAssets = assets.filter((a: any) =>
    (a.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (a.tag || "").toLowerCase().includes(search.toLowerCase()) ||
    (a.category?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  // ─── Create ─────────────────────────────────────────
  function resetCreate() { setAssetName(""); setSerialNo(""); setCategoryId(""); setDepartmentId(""); setCondition("NEW"); setLocation(""); setIsBookable(false); setPurchaseCost(""); setPurchaseDate(""); setFormErrors({}); }

  function handleCreate() {
    const errors: Record<string, boolean> = {};
    if (!assetName.trim()) errors.name = true;
    if (!categoryId) errors.category = true;
    if (purchaseCost && Number(purchaseCost) < 0) { toast.error("Cost cannot be negative"); return; }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) { toast.error("Fill required fields"); return; }

    setSubmitting(true);
    assetsApi.create({
      name: assetName.trim(),
      serialNo: serialNo.trim() || undefined,
      categoryId,
      departmentId: departmentId || undefined,
      condition: condition || "NEW",
      location: location || undefined,
      isBookable,
      acquisitionCost: purchaseCost ? Number(purchaseCost) : undefined,
      acquisitionDate: purchaseDate || undefined,
    })
      .then((res: any) => {
        toast.success(`Asset registered — Tag: ${res.data?.asset?.tag || "Created"}`);
        setCreateOpen(false); resetCreate(); fetchAssets();
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setSubmitting(false));
  }

  // ─── Edit ───────────────────────────────────────────
  function openEdit(asset: any) {
    setEditAsset(asset);
    setAssetName(asset.name || "");
    setSerialNo(asset.serialNo || "");
    setCategoryId(asset.category?.id || "");
    setCondition(asset.condition || "");
    setLocation(asset.location || "");
    setIsBookable(asset.isBookable || false);
    setPurchaseCost(asset.purchaseCost?.toString() || asset.acquisitionCost?.toString() || "");
    setEditOpen(true);
  }

  function handleEdit() {
    if (!editAsset || !assetName.trim()) { toast.error("Name required"); return; }
    if (purchaseCost && Number(purchaseCost) < 0) { toast.error("Cost cannot be negative"); return; }
    setSubmitting(true);
    assetsApi.update(editAsset.id, {
      name: assetName.trim(),
      serialNo: serialNo.trim() || undefined,
      categoryId: categoryId || undefined,
      condition: condition || undefined,
      location: location || undefined,
      isBookable,
      purchaseCost: purchaseCost ? Number(purchaseCost) : undefined,
    })
      .then((res: any) => { toast.success(res.message || "Updated"); setEditOpen(false); setEditAsset(null); resetCreate(); fetchAssets(); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setSubmitting(false));
  }

  // ─── Lifecycle actions ──────────────────────────────
  function openAction(asset: any, type: "retire" | "dispose" | "markLost") {
    setActionAsset(asset); setActionType(type); setActionReason(""); setActionDate(""); setActionMethod("");
  }

  function handleLifecycleAction() {
    if (!actionAsset || !actionType) return;
    setActionSubmitting(true);

    let promise: Promise<any>;
    if (actionType === "retire") {
      if (!actionReason.trim() || !actionDate) { toast.error("Reason and date required"); setActionSubmitting(false); return; }
      promise = assetsApi.retire(actionAsset.id, { reason: actionReason.trim(), retirementDate: actionDate });
    } else if (actionType === "dispose") {
      if (!actionMethod.trim() || !actionDate) { toast.error("Method and date required"); setActionSubmitting(false); return; }
      promise = assetsApi.dispose(actionAsset.id, { method: actionMethod.trim(), notes: actionReason, disposalDate: actionDate });
    } else {
      promise = assetsApi.markLost(actionAsset.id);
    }

    promise
      .then((res: any) => { toast.success(res.message || "Done"); setActionType(null); setActionAsset(null); fetchAssets(); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setActionSubmitting(false));
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-32 bg-muted animate-pulse rounded" />
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Assets</h1><p className="text-muted-foreground text-sm">Manage and track all organizational assets</p></div>
        {canWrite && <Button onClick={() => { resetCreate(); setCreateOpen(true); }} className="px-4 py-2 rounded-lg"><Plus className="size-4 mr-1.5" />Register Asset</Button>}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search assets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={statusFilter || undefined} onValueChange={(v) => setStatusFilter(v ?? "")}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="AVAILABLE">Available</SelectItem>
            <SelectItem value="ALLOCATED">Allocated</SelectItem>
            <SelectItem value="UNDER_MAINTENANCE">Under Maintenance</SelectItem>
            <SelectItem value="RETIRED">Retired</SelectItem>
            <SelectItem value="DISPOSED">Disposed</SelectItem>
            <SelectItem value="LOST">Lost</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <button onClick={() => setView("list")} className={cn("rounded-md p-1.5 transition", view === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}><LayoutList className="h-4 w-4" /></button>
          <button onClick={() => setView("grid")} className={cn("rounded-md p-1.5 transition", view === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}><LayoutGrid className="h-4 w-4" /></button>
        </div>
      </div>

      {filteredAssets.length === 0 && <div className="text-center py-12"><p className="text-muted-foreground">No assets found</p></div>}

      {/* List View */}
      {view === "list" && filteredAssets.length > 0 && (
        <div className="bg-card rounded-xl border overflow-hidden max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Condition</TableHead>
                {canWrite && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.map((asset: any) => (
                <TableRow key={asset.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDetailAsset(asset)}>
                  <TableCell className="font-mono text-xs">{asset.tag || "—"}</TableCell>
                  <TableCell className="font-medium text-sm">{asset.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{asset.category?.name || "—"}</TableCell>
                  <TableCell><StatusBadge status={asset.status || "AVAILABLE"} /></TableCell>
                  <TableCell>
                    {(asset.currentHolder || asset.assignedTo) ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium">{getInitials((asset.currentHolder || asset.assignedTo)?.name || "")}</div>
                        <span className="text-sm">{(asset.currentHolder || asset.assignedTo)?.name}</span>
                      </div>
                    ) : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{asset.location || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{asset.condition || "—"}</TableCell>
                  {canWrite && (
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(asset)} className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center" title="Edit"><Pencil className="size-3.5 text-muted-foreground" /></button>
                        {asset.status === "AVAILABLE" && <button onClick={() => openAction(asset, "retire")} className="text-[10px] px-2 py-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 hover:bg-amber-200">Retire</button>}
                        {asset.status === "RETIRED" && <button onClick={() => openAction(asset, "dispose")} className="text-[10px] px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 hover:bg-red-200">Dispose</button>}
                        {(asset.status === "AVAILABLE" || asset.status === "ALLOCATED") && <button onClick={() => openAction(asset, "markLost")} className="text-[10px] px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 hover:bg-red-200">Lost</button>}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Grid View */}
      {view === "grid" && filteredAssets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto">
          {filteredAssets.map((asset: any) => {
            const IconComp = iconMap[asset.category?.icon || "Monitor"] || Monitor;
            return (
              <div key={asset.id} className="bg-card rounded-xl border overflow-hidden hover:shadow-md transition cursor-pointer" onClick={() => setDetailAsset(asset)}>
                <div className="h-16 bg-muted/30 flex items-center justify-center"><IconComp className="h-7 w-7 text-muted-foreground" /></div>
                <div className="p-4 space-y-1.5">
                  <p className="font-medium text-sm leading-tight">{asset.name}</p>
                  <p className="text-xs font-mono text-muted-foreground">{asset.tag || "—"}</p>
                  <StatusBadge status={asset.status || "AVAILABLE"} />
                  {(asset.currentHolder || asset.assignedTo) && (
                    <p className="text-xs text-muted-foreground">{(asset.currentHolder || asset.assignedTo)?.name}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Asset Detail Dialog ───────────────────────── */}
      <Dialog open={!!detailAsset} onOpenChange={(o) => { if (!o) { setDetailAsset(null); setDetailHistory(null); } }}>
        <DialogContent className="rounded-2xl shadow-lg sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailAsset?.name}</DialogTitle>
            <DialogDescription className="font-mono">{detailAsset?.tag} — {detailAsset?.status}</DialogDescription>
          </DialogHeader>
          {detailAsset && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Category:</span> <span className="font-medium">{detailAsset.category?.name || "—"}</span></div>
                <div><span className="text-muted-foreground">Condition:</span> <span className="font-medium">{detailAsset.condition || "—"}</span></div>
                <div><span className="text-muted-foreground">Location:</span> <span className="font-medium">{detailAsset.location || "—"}</span></div>
                <div><span className="text-muted-foreground">Serial:</span> <span className="font-medium">{detailAsset.serialNo || "—"}</span></div>
                <div><span className="text-muted-foreground">Holder:</span> <span className="font-medium">{(detailAsset.currentHolder || detailAsset.assignedTo)?.name || "None"}</span></div>
                <div><span className="text-muted-foreground">Bookable:</span> <span className="font-medium">{detailAsset.isBookable ? "Yes" : "No"}</span></div>
                <div><span className="text-muted-foreground">Cost:</span> <span className="font-medium">{detailAsset.purchaseCost || detailAsset.acquisitionCost ? `₹${detailAsset.purchaseCost || detailAsset.acquisitionCost}` : "—"}</span></div>
                <div><span className="text-muted-foreground">Department:</span> <span className="font-medium">{detailAsset.department?.name || "—"}</span></div>
              </div>

              {/* History */}
              {detailHistory && (
                <div className="space-y-2">
                  {detailHistory.allocationHistory && detailHistory.allocationHistory.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Allocation History</p>
                      <div className="space-y-1 max-h-[150px] overflow-y-auto">
                        {detailHistory.allocationHistory.map((h: any, i: number) => (
                          <div key={i} className="text-xs bg-muted/50 rounded p-2 flex justify-between">
                            <span>{h.event}</span>
                            <span className="text-muted-foreground">{h.date ? format(new Date(h.date), "MMM d, yyyy") : ""}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailHistory.maintenanceHistory && detailHistory.maintenanceHistory.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Maintenance History</p>
                      <div className="space-y-1 max-h-[150px] overflow-y-auto">
                        {detailHistory.maintenanceHistory.map((h: any, i: number) => (
                          <div key={i} className="text-xs bg-muted/50 rounded p-2 flex justify-between">
                            <span>{h.event}</span>
                            <Badge variant="secondary" className="text-[10px]">{h.status}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Create Asset Dialog ───────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) resetCreate(); setCreateOpen(o); }}>
        <DialogContent className="rounded-2xl shadow-lg sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Register New Asset</DialogTitle><DialogDescription>Fill in the details to register a new asset.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5"><Label>Name <span className="text-destructive">*</span></Label><Input placeholder="MacBook Pro 14" value={assetName} onChange={(e) => { setAssetName(e.target.value); setFormErrors({}); }} className={cn(formErrors.name && "border-destructive")} />{formErrors.name && <p className="text-xs text-destructive">Required</p>}</div>
            <div className="grid gap-1.5"><Label>Serial Number</Label><Input placeholder="NX-LAP-2024-0042" value={serialNo} onChange={(e) => setSerialNo(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Category <span className="text-destructive">*</span></Label>
              <Select value={categoryId || undefined} onValueChange={(v) => { setCategoryId(v ?? ""); setFormErrors({}); }}><SelectTrigger className={cn(formErrors.category && "border-destructive")}><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>{formErrors.category && <p className="text-xs text-destructive">Required</p>}</div>
            <div className="grid gap-1.5"><Label>Condition</Label>
              <Select value={condition || undefined} onValueChange={(v) => setCondition(v ?? "NEW")}><SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                <SelectContent><SelectItem value="NEW">New</SelectItem><SelectItem value="GOOD">Good</SelectItem><SelectItem value="FAIR">Fair</SelectItem><SelectItem value="REFURBISHED">Refurbished</SelectItem></SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Location</Label><Input placeholder="e.g. HQ / Floor 3" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Purchase Cost (₹)</Label><Input type="number" min={0} placeholder="0" value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Purchase Date</Label><Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></div>
            <div className="flex items-center justify-between"><Label>Bookable</Label><Switch checked={isBookable} onCheckedChange={setIsBookable} /></div>
          </div>
          <DialogFooter><Button variant="outline" className="px-4 py-2 rounded-lg" onClick={() => { setCreateOpen(false); resetCreate(); }} disabled={submitting}>Cancel</Button><Button className="px-4 py-2 rounded-lg" onClick={handleCreate} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Register</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Asset Dialog ─────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={(o) => { if (!o) { setEditOpen(false); setEditAsset(null); resetCreate(); } }}>
        <DialogContent className="rounded-2xl shadow-lg sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Asset</DialogTitle><DialogDescription>{editAsset?.tag}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5"><Label>Name</Label><Input value={assetName} onChange={(e) => setAssetName(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Serial Number</Label><Input value={serialNo} onChange={(e) => setSerialNo(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Category</Label>
              <Select value={categoryId || undefined} onValueChange={(v) => setCategoryId(v ?? "")}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Condition</Label>
              <Select value={condition || undefined} onValueChange={(v) => setCondition(v ?? "")}><SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                <SelectContent><SelectItem value="NEW">New</SelectItem><SelectItem value="GOOD">Good</SelectItem><SelectItem value="FAIR">Fair</SelectItem><SelectItem value="REFURBISHED">Refurbished</SelectItem></SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Purchase Cost (₹)</Label><Input type="number" min={0} value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} /></div>
            <div className="flex items-center justify-between"><Label>Bookable</Label><Switch checked={isBookable} onCheckedChange={setIsBookable} /></div>
          </div>
          <DialogFooter><Button variant="outline" className="px-4 py-2 rounded-lg" onClick={() => { setEditOpen(false); setEditAsset(null); resetCreate(); }} disabled={submitting}>Cancel</Button><Button className="px-4 py-2 rounded-lg" onClick={handleEdit} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Lifecycle Action Dialog ───────────────────── */}
      <Dialog open={!!actionType} onOpenChange={(o) => { if (!o) { setActionType(null); setActionAsset(null); } }}>
        <DialogContent className="rounded-2xl shadow-lg sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              {actionType === "retire" && "Retire Asset"}
              {actionType === "dispose" && "Dispose Asset"}
              {actionType === "markLost" && "Mark as Lost"}
            </DialogTitle>
            <DialogDescription>{actionAsset?.name} ({actionAsset?.tag})</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {actionType === "retire" && (
              <>
                <div className="grid gap-1.5"><Label>Reason <span className="text-destructive">*</span></Label><Input placeholder="End of life" value={actionReason} onChange={(e) => setActionReason(e.target.value)} /></div>
                <div className="grid gap-1.5"><Label>Retirement Date <span className="text-destructive">*</span></Label><Input type="date" value={actionDate} onChange={(e) => setActionDate(e.target.value)} /></div>
              </>
            )}
            {actionType === "dispose" && (
              <>
                <div className="grid gap-1.5"><Label>Method <span className="text-destructive">*</span></Label><Input placeholder="Recycled, Donated, Sold" value={actionMethod} onChange={(e) => setActionMethod(e.target.value)} /></div>
                <div className="grid gap-1.5"><Label>Notes</Label><Input placeholder="Additional notes" value={actionReason} onChange={(e) => setActionReason(e.target.value)} /></div>
                <div className="grid gap-1.5"><Label>Disposal Date <span className="text-destructive">*</span></Label><Input type="date" value={actionDate} onChange={(e) => setActionDate(e.target.value)} /></div>
              </>
            )}
            {actionType === "markLost" && <p className="text-sm text-muted-foreground">This will flag the asset as lost. Are you sure?</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" className="px-4 py-2 rounded-lg" onClick={() => { setActionType(null); setActionAsset(null); }} disabled={actionSubmitting}>Cancel</Button>
            <Button variant="destructive" className="px-4 py-2 rounded-lg" onClick={handleLifecycleAction} disabled={actionSubmitting}>
              {actionSubmitting && <Loader2 className="size-4 animate-spin mr-2" />}
              {actionType === "retire" && "Retire"}
              {actionType === "dispose" && "Dispose"}
              {actionType === "markLost" && "Mark Lost"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
