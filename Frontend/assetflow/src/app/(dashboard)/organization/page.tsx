"use client";

import { useState, useEffect, useCallback } from "react";
import { departmentsApi, categoriesApi, usersApi, authApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Building2, Users, FolderTree, Plus, Loader2, Search, Pencil, Trash2,
  ChevronRight, ChevronDown, Monitor, Laptop, Armchair, Wrench, Car, Printer,
  Mouse, Tablet, Smartphone, Camera, Video, Archive, Table as TableIcon, Package,
  UserPlus, UserX, UserCheck, AlertTriangle, Eye,
} from "lucide-react";
import { toast } from "sonner";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Monitor, Laptop, Armchair, Wrench, Car, Printer, Mouse, Tablet, Smartphone,
  Camera, Video, Archive, Table: TableIcon, Package,
  laptop: Laptop, monitor: Monitor, car: Car, wrench: Wrench,
};

const roleBadgeColors: Record<string, string> = {
  ADMIN: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
  ASSET_MANAGER: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  DEPT_HEAD: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  EMPLOYEE: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function isValidEmail(email: string): boolean {
  const atIdx = email.indexOf("@");
  if (atIdx < 1) return false;
  return email.slice(atIdx + 1).includes(".");
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://assetflow-production-85d2.up.railway.app/api";

function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirm", variant = "destructive", onConfirm, loading = false }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; confirmLabel?: string; variant?: "destructive" | "default"; onConfirm: () => void; loading?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl shadow-lg sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><AlertTriangle className={cn("size-5", variant === "destructive" ? "text-destructive" : "text-primary")} />{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="px-4 py-2 rounded-lg" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button variant={variant} className="px-4 py-2 rounded-lg" onClick={onConfirm} disabled={loading}>{loading && <Loader2 className="size-4 animate-spin mr-2" />}{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DepartmentDetailDialog({ dept, open, onOpenChange }: { dept: any; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !dept) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/departments/${dept.id}/employees`, { credentials: "include" }).then((r) => r.json()).catch(() => ({ data: { employees: [] } })),
      fetch(`${API_BASE}/departments/${dept.id}/assets`, { credentials: "include" }).then((r) => r.json()).catch(() => ({ data: { assets: [] } })),
    ]).then(([empRes, assetRes]) => {
      setEmployees(empRes?.data?.employees || []);
      setAssets(assetRes?.data?.assets || []);
    }).finally(() => setLoading(false));
  }, [open, dept]);

  if (!dept) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl shadow-lg sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Building2 className="size-5 text-primary" />{dept.name}</DialogTitle>
          <DialogDescription>Employees and assets in this department</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4 py-2">
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Users className="size-4" /> Employees ({employees.length})</h4>
              {employees.length === 0 ? <p className="text-xs text-muted-foreground italic">No employees</p> : (
                <div className={cn("space-y-1", employees.length > 8 && "max-h-[200px] overflow-y-auto")}>
                  {employees.map((emp: any) => (
                    <div key={emp.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium">{getInitials(emp.name || "")}</div>
                      <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{emp.name}</p><p className="text-[10px] text-muted-foreground truncate">{emp.email}</p></div>
                      <Badge variant="secondary" className="text-[10px]">{emp.role || "EMPLOYEE"}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Package className="size-4" /> Assets ({assets.length})</h4>
              {assets.length === 0 ? <p className="text-xs text-muted-foreground italic">No assets</p> : (
                <div className={cn("space-y-1", assets.length > 8 && "max-h-[200px] overflow-y-auto")}>
                  {assets.map((asset: any) => (
                    <div key={asset.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <Package className="size-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{asset.name}</p><p className="text-[10px] text-muted-foreground font-mono">{asset.tag}</p></div>
                      <Badge variant="secondary" className="text-[10px]">{asset.status || "AVAILABLE"}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DepartmentsTab({ triggerCreate }: { triggerCreate: number }) {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN";
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [detailDept, setDetailDept] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [deptName, setDeptName] = useState("");
  const [deptHead, setDeptHead] = useState("");
  const [deptParent, setDeptParent] = useState("");
  const [deptStatus, setDeptStatus] = useState("ACTIVE");
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  const fetchDepartments = useCallback(() => {
    departmentsApi.list().then((res: any) => { if (res.success && res.data) setDepartments(res.data.departments || []); }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);
  useEffect(() => { if (triggerCreate > 0) { resetForm(); setDialogOpen(true); } }, [triggerCreate]);
  useEffect(() => { if (dialogOpen || editDialog) { usersApi.list({ limit: 100 }).then((res: any) => { if (res.success && res.data) setAllUsers(res.data.users || []); }).catch(() => {}); } }, [dialogOpen, editDialog]);

  function resetForm() { setDeptName(""); setDeptHead(""); setDeptParent(""); setDeptStatus("ACTIVE"); setFormErrors({}); }
  function handleCreate() {
    if (!deptName.trim()) { setFormErrors({ name: true }); toast.error("Name is required"); return; }
    setSubmitting(true);
    departmentsApi.create({ name: deptName.trim(), headId: deptHead || undefined, parentId: deptParent || undefined })
      .then((res: any) => { toast.success(res.message || "Created"); setDialogOpen(false); resetForm(); fetchDepartments(); })
      .catch((e: Error) => toast.error(e.message)).finally(() => setSubmitting(false));
  }
  function handleUpdate() {
    if (!editDialog || !deptName.trim()) { setFormErrors({ name: true }); toast.error("Name is required"); return; }
    setSubmitting(true);
    departmentsApi.update(editDialog.id, { name: deptName.trim(), headId: deptHead || undefined, parentId: deptParent || undefined, status: deptStatus })
      .then((res: any) => { toast.success(res.message || "Updated"); setEditDialog(null); resetForm(); fetchDepartments(); })
      .catch((e: Error) => toast.error(e.message)).finally(() => setSubmitting(false));
  }
  function handleDelete() {
    if (!deleteConfirm) return;
    setSubmitting(true);
    departmentsApi.delete(deleteConfirm.id).then((res: any) => { toast.success(res.message || "Deleted"); setDeleteConfirm(null); fetchDepartments(); }).catch((e: Error) => toast.error(e.message)).finally(() => setSubmitting(false));
  }
  function openEdit(dept: any) { setDeptName(dept.name || ""); setDeptHead(dept.head?.id || ""); setDeptParent(dept.parentId || ""); setDeptStatus(dept.status || "ACTIVE"); setFormErrors({}); setEditDialog(dept); }

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>;

  return (
    <>
      <div className={cn("grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4", departments.length > 8 && "max-h-[500px] overflow-y-auto pr-2")}>
        {departments.length === 0 ? <p className="text-sm text-muted-foreground col-span-full text-center py-12">No departments yet.</p> : departments.map((dept: any) => (
          <div key={dept.id} className="bg-card rounded-xl border p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailDept(dept)}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Building2 className="size-5 text-primary" /></div>
                <div><h3 className="font-semibold text-sm">{dept.name}</h3><span className={cn("text-xs font-medium", dept.status === "ACTIVE" ? "text-emerald-600" : "text-muted-foreground")}>{dept.status}</span></div>
              </div>
              {isAdmin && (<div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => openEdit(dept)} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center"><Pencil className="size-3.5 text-muted-foreground" /></button>
                <button onClick={() => setDeleteConfirm(dept)} className="h-8 w-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center"><Trash2 className="size-3.5 text-destructive" /></button>
              </div>)}
            </div>
            {dept.head ? (<div className="flex items-center gap-2 mb-3"><div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">{getInitials(dept.head.name)}</div><span className="text-xs text-muted-foreground">{dept.head.name}</span></div>) : (<p className="text-xs text-muted-foreground mb-3 italic">No head assigned</p>)}
            <div className="flex flex-wrap gap-2"><Badge variant="secondary" className="text-xs"><Users className="size-3 mr-1" />{dept.employeeCount ?? 0} employees</Badge><Badge variant="secondary" className="text-xs"><Package className="size-3 mr-1" />{dept.assetCount ?? 0} assets</Badge></div>
            <div className="mt-2 flex items-center gap-1 text-[11px] text-primary"><Eye className="size-3" /> Click to view details</div>
          </div>
        ))}
      </div>
      <DepartmentDetailDialog dept={detailDept} open={!!detailDept} onOpenChange={(o) => { if (!o) setDetailDept(null); }} />
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); setDialogOpen(o); }}>
        <DialogContent className="rounded-2xl shadow-lg sm:max-w-md">
          <DialogHeader><DialogTitle>Create Department</DialogTitle><DialogDescription>Add a new department.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5"><Label>Name <span className="text-destructive">*</span></Label><Input placeholder="e.g. Engineering" value={deptName} onChange={(e) => { setDeptName(e.target.value); setFormErrors({}); }} className={cn(formErrors.name && "border-destructive")} />{formErrors.name && <p className="text-xs text-destructive">Required</p>}</div>
            <div className="grid gap-1.5"><Label>Head</Label><Select value={deptHead || undefined} onValueChange={(v) => setDeptHead(v ?? "")}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent>{allUsers.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Parent</Label><Select value={deptParent || undefined} onValueChange={(v) => setDeptParent(v ?? "")}><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger><SelectContent>{departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" className="px-4 py-2 rounded-lg" onClick={() => { setDialogOpen(false); resetForm(); }} disabled={submitting}>Cancel</Button><Button className="px-4 py-2 rounded-lg" onClick={handleCreate} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editDialog} onOpenChange={(o) => { if (!o) { setEditDialog(null); resetForm(); } }}>
        <DialogContent className="rounded-2xl shadow-lg sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Department</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5"><Label>Name <span className="text-destructive">*</span></Label><Input value={deptName} onChange={(e) => { setDeptName(e.target.value); setFormErrors({}); }} className={cn(formErrors.name && "border-destructive")} /></div>
            <div className="grid gap-1.5"><Label>Head</Label><Select value={deptHead || undefined} onValueChange={(v) => setDeptHead(v ?? "")}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{allUsers.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Parent</Label><Select value={deptParent || undefined} onValueChange={(v) => setDeptParent(v ?? "")}><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger><SelectContent>{departments.filter((d: any) => d.id !== editDialog?.id).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Status</Label><Select value={deptStatus} onValueChange={(v) => setDeptStatus(v ?? "ACTIVE")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="INACTIVE">Inactive</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" className="px-4 py-2 rounded-lg" onClick={() => { setEditDialog(null); resetForm(); }} disabled={submitting}>Cancel</Button><Button className="px-4 py-2 rounded-lg" onClick={handleUpdate} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }} title="Delete Department" description={`Delete "${deleteConfirm?.name}"? Members will be unassigned.`} confirmLabel="Delete" variant="destructive" onConfirm={handleDelete} loading={submitting} />
    </>
  );
}

function CategoryRow({ category, depth }: { category: any; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const [assets, setAssets] = useState<any[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const hasChildren = category.children && category.children.length > 0;
  const hasFields = category.customFields && category.customFields.length > 0;
  const Icon = iconMap[category.icon] || Package;

  function handleToggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && assets.length === 0 && (category.assetCount ?? 0) > 0) {
      setLoadingAssets(true);
      fetch(`${API_BASE}/assets?categoryId=${category.id}&limit=20`, { credentials: "include" })
        .then((r) => r.json())
        .then((res) => { if (res.success && res.data) setAssets(res.data.assets || []); })
        .catch(() => {})
        .finally(() => setLoadingAssets(false));
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" style={{ paddingLeft: `${depth * 20 + 12}px` }} onClick={handleToggle}>
        {(hasChildren || hasFields || (category.assetCount ?? 0) > 0) ? (expanded ? <ChevronDown className="size-4 text-muted-foreground shrink-0" /> : <ChevronRight className="size-4 text-muted-foreground shrink-0" />) : <span className="w-4 shrink-0" />}
        <Icon className="size-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium flex-1">{category.name}</span>
        {hasFields && <Badge variant="outline" className="text-[10px] mr-2">{category.customFields.length} fields</Badge>}
        <Badge variant="secondary" className="text-xs">{category.assetCount ?? 0} assets</Badge>
      </div>
      {expanded && (
        <div className="py-2 px-3 mb-1 rounded-lg bg-muted/30 border border-dashed space-y-2" style={{ marginLeft: `${depth * 20 + 36}px` }}>
          {hasFields && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">Custom Fields:</p>
              <div className="flex flex-wrap gap-1.5">{category.customFields.map((f: any) => <Badge key={f.id || f.key} variant="outline" className="text-[10px]">{f.label || f.key} ({f.type})</Badge>)}</div>
            </div>
          )}
          {loadingAssets && <div className="flex items-center gap-2 py-2"><Loader2 className="size-3 animate-spin" /><span className="text-[11px] text-muted-foreground">Loading assets...</span></div>}
          {!loadingAssets && assets.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">Assets ({assets.length}):</p>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {assets.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-2 p-1.5 rounded bg-background/50">
                    <Package className="size-3 text-muted-foreground shrink-0" />
                    <span className="text-[11px] font-medium flex-1 truncate">{a.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{a.tag}</span>
                    <Badge variant="secondary" className="text-[9px]">{a.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!loadingAssets && assets.length === 0 && (category.assetCount ?? 0) === 0 && (
            <p className="text-[11px] text-muted-foreground italic">No assets in this category</p>
          )}
        </div>
      )}
      {expanded && hasChildren && category.children.map((c: any) => <CategoryRow key={c.id} category={c} depth={depth + 1} />)}
    </>
  );
}

function CategoriesTab({ triggerCreate }: { triggerCreate: number }) {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [catName, setCatName] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  const fetchCategories = useCallback(() => { categoriesApi.tree().then((res: any) => { if (res.success && res.data) setCategories(res.data.tree || res.data.categories || res.data || []); }).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { if (triggerCreate > 0) { setCatName(""); setFormErrors({}); setDialogOpen(true); } }, [triggerCreate]);

  function handleCreate() {
    if (!catName.trim()) { setFormErrors({ name: true }); toast.error("Name required"); return; }
    setSubmitting(true);
    categoriesApi.create({ name: catName.trim() }).then((res: any) => { toast.success(res.message || "Created"); setDialogOpen(false); setCatName(""); fetchCategories(); }).catch((e: Error) => toast.error(e.message)).finally(() => setSubmitting(false));
  }

  if (loading) return <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded-lg" />)}</div>;
  return (
    <>
      <div className={cn("bg-card rounded-xl border p-3", categories.length > 8 && "max-h-[500px] overflow-y-auto")}>
        {categories.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No categories yet</p> : categories.map((cat: any) => <CategoryRow key={cat.id} category={cat} depth={0} />)}
      </div>
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setCatName(""); setFormErrors({}); } setDialogOpen(o); }}>
        <DialogContent className="rounded-2xl shadow-lg sm:max-w-md">
          <DialogHeader><DialogTitle>Create Category</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5"><Label>Name <span className="text-destructive">*</span></Label><Input placeholder="e.g. Laptops" value={catName} onChange={(e) => { setCatName(e.target.value); setFormErrors({}); }} className={cn(formErrors.name && "border-destructive")} />{formErrors.name && <p className="text-xs text-destructive">Required</p>}</div>
          </div>
          <DialogFooter><Button variant="outline" className="px-4 py-2 rounded-lg" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button><Button className="px-4 py-2 rounded-lg" onClick={handleCreate} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EmployeesTab({ triggerCreate }: { triggerCreate: number }) {
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === "ADMIN";
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<any>(null);
  const [editRole, setEditRole] = useState("");
  const [editDept, setEditDept] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteErrors, setInviteErrors] = useState<Record<string, boolean>>({});
  const [statusConfirm, setStatusConfirm] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);

  const fetchEmployees = useCallback(() => { usersApi.list({ limit: 100 }).then((res: any) => { if (res.success && res.data) setEmployees(res.data.users || []); }).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { fetchEmployees(); departmentsApi.list().then((res: any) => { if (res.success && res.data) setDepartments(res.data.departments || []); }).catch(() => {}); }, [fetchEmployees]);
  useEffect(() => { if (triggerCreate > 0) { resetInvite(); setInviteOpen(true); } }, [triggerCreate]);

  const filtered = employees.filter((u: any) => (u.name || "").toLowerCase().includes(search.toLowerCase()) || (u.email || "").toLowerCase().includes(search.toLowerCase()));
  function resetInvite() { setInviteName(""); setInviteEmail(""); setInvitePassword(""); setInviteErrors({}); }
  function openEdit(u: any) { setEditUser(u); setEditRole(u.role || "EMPLOYEE"); setEditDept(u.departmentId || u.department?.id || ""); }

  async function handleSave() {
    if (!editUser) return; setSubmitting(true);
    try {
      if (editRole && editRole !== editUser.role) await usersApi.changeRole(editUser.id, editRole);
      const cur = editUser.departmentId || editUser.department?.id || "";
      if (editDept !== cur) await usersApi.changeDepartment(editUser.id, editDept || null);
      toast.success("Updated"); setEditUser(null); fetchEmployees();
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  }

  async function handleToggleStatus() {
    if (!statusConfirm) return; setSubmitting(true);
    try { await usersApi.changeStatus(statusConfirm.id, statusConfirm.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"); toast.success("Status updated"); setStatusConfirm(null); fetchEmployees(); } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  }

  async function handleDeleteUser() {
    if (!deleteConfirm) return; setSubmitting(true);
    try { await usersApi.changeStatus(deleteConfirm.id, "INACTIVE"); toast.success("User removed"); setDeleteConfirm(null); fetchEmployees(); } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  }

  async function handleInvite() {
    const errors: Record<string, boolean> = {};
    if (!inviteName.trim()) errors.name = true;
    if (!inviteEmail.trim()) errors.email = true;
    else if (!isValidEmail(inviteEmail.trim())) errors.emailFormat = true;
    if (!invitePassword.trim()) errors.password = true;
    else if (invitePassword.length < 8) errors.passwordLength = true;
    setInviteErrors(errors);
    if (Object.keys(errors).length > 0) { toast.error(errors.emailFormat ? "Invalid email" : errors.passwordLength ? "Password min 8 chars" : "Fill all fields"); return; }
    setSubmitting(true);
    try {
      await authApi.signup({ name: inviteName.trim(), email: inviteEmail.trim(), password: invitePassword.trim() });
      toast.success(`Employee "${inviteName.trim()}" created`); setInviteOpen(false); resetInvite(); fetchEmployees();
    } catch (e: any) { toast.error(e.message || "Failed"); } finally { setSubmitting(false); }
  }

  if (loading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}</div>;
  return (
    <>
      <div className="relative max-w-sm mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" /><Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
      <div className={cn("bg-card rounded-xl border overflow-hidden", filtered.length > 8 && "max-h-[500px] overflow-y-auto")}>
        <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Department</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead>{isAdmin && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
          <TableBody>{filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No employees</TableCell></TableRow> : filtered.map((u: any) => (
            <TableRow key={u.id}>
              <TableCell><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0">{getInitials(u.name || "")}</div><span className="text-sm font-medium">{u.name}</span></div></TableCell>
              <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
              <TableCell><Badge variant="secondary" className="text-xs">{u.department?.name || "—"}</Badge></TableCell>
              <TableCell><span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", roleBadgeColors[u.role] || roleBadgeColors.EMPLOYEE)}>{(u.role || "EMPLOYEE").replace(/_/g, " ")}</span></TableCell>
              <TableCell><span className={cn("inline-flex items-center gap-1.5 text-xs", u.status === "ACTIVE" ? "text-emerald-600" : "text-gray-500")}><span className={cn("h-1.5 w-1.5 rounded-full", u.status === "ACTIVE" ? "bg-emerald-500" : "bg-gray-400")} />{u.status || "ACTIVE"}</span></TableCell>
              {isAdmin && <TableCell className="text-right"><div className="flex justify-end gap-1">
                <button onClick={() => openEdit(u)} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center"><Pencil className="size-3.5 text-muted-foreground" /></button>
                <button onClick={() => setStatusConfirm(u)} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center">{u.status === "ACTIVE" ? <UserX className="size-3.5 text-orange-500" /> : <UserCheck className="size-3.5 text-emerald-500" />}</button>
                <button onClick={() => setDeleteConfirm(u)} className="h-8 w-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center"><Trash2 className="size-3.5 text-destructive" /></button>
              </div></TableCell>}
            </TableRow>
          ))}</TableBody></Table>
      </div>
      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null); }}><DialogContent className="rounded-2xl shadow-lg sm:max-w-md"><DialogHeader><DialogTitle>Edit — {editUser?.name}</DialogTitle></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-1.5"><Label>Role</Label><Select value={editRole || undefined} onValueChange={(v) => setEditRole(v ?? "")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EMPLOYEE">Employee</SelectItem><SelectItem value="ASSET_MANAGER">Asset Manager</SelectItem><SelectItem value="DEPT_HEAD">Department Head</SelectItem></SelectContent></Select></div><div className="grid gap-1.5"><Label>Department</Label><Select value={editDept || undefined} onValueChange={(v) => setEditDept(v ?? "")}><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger><SelectContent>{departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button variant="outline" className="px-4 py-2 rounded-lg" onClick={() => setEditUser(null)} disabled={submitting}>Cancel</Button><Button className="px-4 py-2 rounded-lg" onClick={handleSave} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Save</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={inviteOpen} onOpenChange={(o) => { if (!o) resetInvite(); setInviteOpen(o); }}><DialogContent className="rounded-2xl shadow-lg sm:max-w-md"><DialogHeader><DialogTitle>Create Employee</DialogTitle><DialogDescription>Create a new employee account.</DialogDescription></DialogHeader><div className="grid gap-4 py-2">
        <div className="grid gap-1.5"><Label>Full Name <span className="text-destructive">*</span></Label><Input placeholder="John Doe" value={inviteName} onChange={(e) => { setInviteName(e.target.value); setInviteErrors({}); }} className={cn(inviteErrors.name && "border-destructive")} />{inviteErrors.name && <p className="text-xs text-destructive">Required</p>}</div>
        <div className="grid gap-1.5"><Label>Email <span className="text-destructive">*</span></Label><Input type="email" placeholder="john@company.com" value={inviteEmail} onChange={(e) => { setInviteEmail(e.target.value); setInviteErrors({}); }} className={cn((inviteErrors.email || inviteErrors.emailFormat) && "border-destructive")} />{inviteErrors.email && <p className="text-xs text-destructive">Required</p>}{inviteErrors.emailFormat && <p className="text-xs text-destructive">Invalid email</p>}</div>
        <div className="grid gap-1.5"><Label>Password <span className="text-destructive">*</span></Label><Input type="password" placeholder="Min 8 characters" value={invitePassword} onChange={(e) => { setInvitePassword(e.target.value); setInviteErrors({}); }} className={cn((inviteErrors.password || inviteErrors.passwordLength) && "border-destructive")} />{inviteErrors.password && <p className="text-xs text-destructive">Required</p>}{inviteErrors.passwordLength && <p className="text-xs text-destructive">Min 8 characters</p>}</div>
      </div><DialogFooter><Button variant="outline" className="px-4 py-2 rounded-lg" onClick={() => { setInviteOpen(false); resetInvite(); }} disabled={submitting}>Cancel</Button><Button className="px-4 py-2 rounded-lg" onClick={handleInvite} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Create Employee</Button></DialogFooter></DialogContent></Dialog>
      <ConfirmDialog open={!!statusConfirm} onOpenChange={(o) => { if (!o) setStatusConfirm(null); }} title={statusConfirm?.status === "ACTIVE" ? "Deactivate User" : "Activate User"} description={`${statusConfirm?.status === "ACTIVE" ? "Deactivate" : "Activate"} "${statusConfirm?.name}"?`} confirmLabel={statusConfirm?.status === "ACTIVE" ? "Deactivate" : "Activate"} variant={statusConfirm?.status === "ACTIVE" ? "destructive" : "default"} onConfirm={handleToggleStatus} loading={submitting} />
      <ConfirmDialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }} title="Remove User" description={`Remove "${deleteConfirm?.name}"? This deactivates their account.`} confirmLabel="Remove" variant="destructive" onConfirm={handleDeleteUser} loading={submitting} />
    </>
  );
}

export default function OrganizationPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN";
  const [activeTab, setActiveTab] = useState("departments");
  const [deptTrigger, setDeptTrigger] = useState(0);
  const [catTrigger, setCatTrigger] = useState(0);
  const [empTrigger, setEmpTrigger] = useState(0);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Organization</h1><p className="text-muted-foreground text-sm">Manage departments, categories, and employees</p></div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setActiveTab("departments")} className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors", activeTab === "departments" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}><Building2 className="size-4" />Departments</button>
          <button onClick={() => setActiveTab("categories")} className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors", activeTab === "categories" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}><FolderTree className="size-4" />Categories</button>
          <button onClick={() => setActiveTab("employees")} className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors", activeTab === "employees" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}><Users className="size-4" />Employees</button>
        </div>
        {isAdmin && activeTab === "departments" && <Button className="px-4 py-2 rounded-lg" onClick={() => setDeptTrigger((p) => p + 1)}><Plus className="size-4 mr-1.5" />Add Department</Button>}
        {isAdmin && activeTab === "categories" && <Button className="px-4 py-2 rounded-lg" onClick={() => setCatTrigger((p) => p + 1)}><Plus className="size-4 mr-1.5" />Add Category</Button>}
        {isAdmin && activeTab === "employees" && <Button className="px-4 py-2 rounded-lg" onClick={() => setEmpTrigger((p) => p + 1)}><UserPlus className="size-4 mr-1.5" />Create Employee</Button>}
      </div>
      {activeTab === "departments" && <DepartmentsTab triggerCreate={deptTrigger} />}
      {activeTab === "categories" && <CategoriesTab triggerCreate={catTrigger} />}
      {activeTab === "employees" && <EmployeesTab triggerCreate={empTrigger} />}
    </div>
  );
}
