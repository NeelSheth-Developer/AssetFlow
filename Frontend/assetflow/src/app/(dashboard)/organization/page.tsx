"use client";

import { useState } from "react";
import { departments, users } from "@/data/mock";
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
import { categories } from "@/data/mock";
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
} from "lucide-react";
import type { Category } from "@/lib/types";

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

// ===== DEPARTMENTS TAB =====
function DepartmentsTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {departments.map((dept) => {
        const head = users.find((u) => u.id === dept.headId);
        return (
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

            {head && (
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                  {getInitials(head.name)}
                </div>
                <div>
                  <p className="text-sm font-medium leading-none">{head.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {head.designation}
                  </p>
                </div>
              </div>
            )}
            {!head && (
              <p className="text-sm text-muted-foreground mb-4">No head assigned</p>
            )}

            <div className="flex items-center gap-2">
              <Badge variant="secondary">{dept.employeeCount} employees</Badge>
              <Badge variant="secondary">{dept.assetCount} assets</Badge>
            </div>
          </div>
        );
      })}

      {/* Add Department card */}
      <div className="rounded-xl border border-dashed p-5 flex items-center justify-center hover:bg-muted/50 transition cursor-pointer">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Plus className="h-8 w-8" />
          <span className="text-sm font-medium">Add Department</span>
        </div>
      </div>
    </div>
  );
}

// ===== CATEGORIES TAB =====
function CategoryRow({
  category,
  depth = 0,
}: {
  category: Category;
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
          {category.assetCount}
        </Badge>
      </div>
      {expanded &&
        hasChildren &&
        category.children.map((child) => (
          <CategoryRow key={child.id} category={child} depth={depth + 1} />
        ))}
    </>
  );
}

function CategoriesTab() {
  return (
    <div className="space-y-1">
      {categories.map((category) => (
        <CategoryRow key={category.id} category={category} />
      ))}
    </div>
  );
}

// ===== EMPLOYEES TAB =====
function EmployeesTab() {
  const [search, setSearch] = useState("");

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.designation.toLowerCase().includes(search.toLowerCase())
  );

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
          {filteredUsers.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0">
                    {getInitials(user.name)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.designation}
                    </p>
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
                  {user.role.replace(/_/g, " ")}
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
                  {user.status}
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
