"use client";

import { useState, useEffect } from "react";
import { departmentsApi, categoriesApi, usersApi } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  Monitor,
  Laptop,
  Armchair,
  Wrench,
  Car,
  Printer,
  Mouse,
  Tablet,
  Smartphone,
  Camera,
  Video,
  Archive,
  Table as TableIcon,
  Plus,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

// ===== ICON MAP =====
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Monitor,
  Laptop,
  Armchair,
  Wrench,
  Car,
  Printer,
  Mouse,
  Tablet,
  Smartphone,
  Camera,
  Video,
  Archive,
  Table: TableIcon,
};

// ===== ROLE BADGE COLORS =====
const roleBadgeColors: Record<string, string> = {
  ADMIN: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
  ASSET_MANAGER: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  DEPT_HEAD: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  EMPLOYEE: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

// ===== HELPERS =====
function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ===== LOADING SKELETON =====
function LoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl border p-5 animate-pulse">
          <div className="h-5 w-32 bg-muted rounded mb-3" />
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="space-y-1">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-2 w-16 bg-muted rounded" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-5 w-20 bg-muted rounded" />
            <div className="h-5 w-16 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-9 w-64 bg-muted rounded" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-12 w-full bg-muted rounded" />
        ))}
      </div>
    </div>
  );
}

function TreeSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 py-2 px-3">
          <div className="h-4 w-4 bg-muted rounded" />
          <div className="h-4 w-4 bg-muted rounded" />
          <div className="h-4 w-28 bg-muted rounded" />
          <div className="h-5 w-8 bg-muted rounded ml-auto" />
        </div>
      ))}
    </div>
  );
}

// ===== DEPARTMENTS TAB =====
function DepartmentsTab() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [deptHead, setDeptHead] = useState("");
  const [deptParent, setDeptParent] = useState("");
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    departmentsApi.list()
      .then((res: any) => {
        if (res.success && res.data) {
          setDepartments(res.data.departments || res.data || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (dialogOpen) {
      usersApi.list({ limit: 100 })
        .then((res: any) => {
          if (res.success && res.data) {
            setUsers(res.data.users || []);
          }
        })
        .catch(() => {});
    }
  }, [dialogOpen]);

  function resetForm() {
    setDeptName("");
    setDeptHead("");
    setDeptParent("");
  }

  function handleCreateDepartment() {
    if (!deptName.trim()) {
      toast.error("Department name is required");
      return;
    }

    setSubmitting(true);
    departmentsApi.create({
      name: deptName.trim(),
      headId: deptHead || undefined,
      parentId: deptParent || undefined,
    })
      .then((res: any) => {
        if (res.success) {
          toast.success(res.message || "Department created successfully");
          setDialogOpen(false);
          resetForm();
          // Refresh
          departmentsApi.list().then((r: any) => {
            if (r.success && r.data) {
              setDepartments(r.data.departments || r.data || []);
            }
          });
        } else {
          toast.error(res.message || "Failed to create department");
        }
      })
      .catch((err: Error) => toast.error(err.message || "Failed to create department"))
      .finally(() => setSubmitting(false));
  }

  if (loading) return <LoadingSkeleton count={6} />;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept: any) => (
          <div
            key={dept.id}
            className="bg-card rounded-xl border p-5 hover:shadow-md transition"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">{dept.name}</h3>
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  dept.status === "ACTIVE" ? "bg-green-500" : "bg-gray-400"
                )}
              />
            </div>

            {dept.head ? (
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                  {getInitials(dept.head.name)}
                </div>
                <div>
                  <p className="text-sm font-medium leading-none">{dept.head.name}</p>
                  <p className="text-xs text-muted-foreground">Department Head</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">No head assigned</p>
            )}

            <div className="flex items-center gap-2">
              <Badge variant="secondary">{dept.employeeCount ?? 0} employees</Badge>
              <Badge variant="secondary">{dept.assetCount ?? 0} assets</Badge>
            </div>
          </div>
        ))}

        {/* Add Department card */}
        <div
          onClick={() => setDialogOpen(true)}
          className="rounded-xl border border-dashed p-5 flex items-center justify-center hover:bg-muted/50 transition cursor-pointer"
        >
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Plus className="h-8 w-8" />
            <span className="text-sm font-medium">Add Department</span>
          </div>
        </div>
      </div>

      {/* Create Department Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Department</DialogTitle>
            <DialogDescription>
              Add a new department to your organization.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="dept-name">Department Name *</Label>
              <Input
                id="dept-name"
                placeholder="e.g. Engineering"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Department Head</Label>
              <Select value={deptHead} onValueChange={(v) => setDeptHead(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a head (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} — {user.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>Parent Department</Label>
              <Select value={deptParent} onValueChange={(v) => setDeptParent(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept: any) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateDepartment} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ===== CATEGORIES TAB =====
function CategoryRow({
  category,
  depth = 0,
}: {
  category: any;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = category.children && category.children.length > 0;
  const IconComponent = iconMap[category.icon] || Monitor;

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer",
          depth > 0 && "pl-6"
        )}
        style={{ paddingLeft: depth > 0 ? `${depth * 24 + 12}px` : undefined }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <IconComponent className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium">{category.name}</span>
        <Badge variant="secondary" className="ml-auto">
          {category.assetCount ?? 0}
        </Badge>
      </div>
      {expanded &&
        hasChildren &&
        category.children.map((child: any) => (
          <CategoryRow key={child.id} category={child} depth={depth + 1} />
        ))}
    </>
  );
}

function CategoriesTab() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [catName, setCatName] = useState("");

  useEffect(() => {
    categoriesApi.tree()
      .then((res: any) => {
        if (res.success && res.data) {
          setCategories(res.data.tree || res.data.categories || res.data || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleCreateCategory() {
    if (!catName.trim()) {
      toast.error("Category name is required");
      return;
    }
    setSubmitting(true);
    categoriesApi.create({ name: catName.trim() })
      .then((res: any) => {
        if (res.success) {
          toast.success(res.message || "Category created");
          setDialogOpen(false);
          setCatName("");
          categoriesApi.tree().then((r: any) => {
            if (r.success && r.data) {
              setCategories(r.data.tree || r.data.categories || r.data || []);
            }
          });
        } else {
          toast.error(res.message || "Failed");
        }
      })
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setSubmitting(false));
  }

  if (loading) return <TreeSkeleton rows={8} />;

  return (
    <>
      <div className="space-y-1">
        {categories.map((category: any) => (
          <CategoryRow key={category.id} category={category} />
        ))}
      </div>
      <div className="mt-4">
        <Button variant="outline" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Category</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Category Name *</Label>
              <Input
                placeholder="e.g. Laptops"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleCreateCategory} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ===== EMPLOYEES TAB =====
function EmployeesTab() {
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.list({ limit: 100 })
      .then((res: any) => {
        if (res.success && res.data) {
          setEmployees(res.data.users || res.data || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = employees.filter(
    (user: any) =>
      (user.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (user.email || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <TableSkeleton rows={6} />;

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search employees..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.map((user: any) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0">
                    {getInitials(user.name || "")}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{user.name}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm">{user.email}</TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {user.department?.name || "—"}
                </Badge>
              </TableCell>
              <TableCell>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    roleBadgeColors[user.role] || roleBadgeColors.EMPLOYEE
                  )}
                >
                  {(user.role || "EMPLOYEE").replace(/_/g, " ")}
                </span>
              </TableCell>
              <TableCell>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs",
                    user.status === "ACTIVE"
                      ? "text-green-600"
                      : "text-gray-500"
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      user.status === "ACTIVE" ? "bg-green-500" : "bg-gray-400"
                    )}
                  />
                  {user.status || "ACTIVE"}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ===== MAIN PAGE =====
export default function OrganizationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organization</h1>
        <p className="text-muted-foreground">
          Manage departments, categories, and employees
        </p>
      </div>

      <Tabs defaultValue="departments">
        <TabsList variant="line">
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
        </TabsList>

        <TabsContent value="departments" className="mt-6">
          <DepartmentsTab />
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <CategoriesTab />
        </TabsContent>

        <TabsContent value="employees" className="mt-6">
          <EmployeesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
