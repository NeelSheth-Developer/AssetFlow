"use client";

import { useState } from "react";
import { assets } from "@/data/mock";
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
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import {
  LayoutList,
  LayoutGrid,
  Plus,
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
  Search,
  Loader2,
} from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
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

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function AssetsPage() {
  const [view, setView] = useState<"list" | "grid">("list");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [assetName, setAssetName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [category, setCategory] = useState("");
  const [purchaseValue, setPurchaseValue] = useState("");
  const [condition, setCondition] = useState("");
  const [location, setLocation] = useState("");
  const [isBookable, setIsBookable] = useState(false);

  const filteredAssets = assets
    .filter(
      (asset) =>
        asset.name.toLowerCase().includes(search.toLowerCase()) ||
        asset.tag.toLowerCase().includes(search.toLowerCase()) ||
        (asset.category?.name || "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  function resetForm() {
    setAssetName("");
    setSerialNumber("");
    setCategory("");
    setPurchaseValue("");
    setCondition("");
    setLocation("");
    setIsBookable(false);
  }

  function handleSubmit() {
    setSubmitting(true);
    setTimeout(() => {
      toast.success("Asset registered successfully — Tag: AF-0016");
      setSubmitting(false);
      setDialogOpen(false);
      resetForm();
    }, 500);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assets</h1>
          <p className="text-muted-foreground">
            Manage and track all organizational assets
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
        >
          <Plus className="h-4 w-4" />
          Register Asset
        </button>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <button
            onClick={() => setView("list")}
            className={cn(
              "rounded-md p-1.5 transition",
              view === "list"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutList className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView("grid")}
            className={cn(
              "rounded-md p-1.5 transition",
              view === "grid"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* List View */}
      {view === "list" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tag</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Date Added</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssets.map((asset) => (
              <TableRow key={asset.id}>
                <TableCell className="font-mono text-xs">
                  {asset.tag}
                </TableCell>
                <TableCell className="font-medium">{asset.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {asset.category?.name || "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={asset.status} />
                </TableCell>
                <TableCell>
                  {asset.assignedTo ? (
                    <div className="flex items-center gap-1.5">
                      <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium">
                        {getInitials(asset.assignedTo.name)}
                      </div>
                      <span className="text-sm">{asset.assignedTo.name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {asset.location || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(asset.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Grid View */}
      {view === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAssets.map((asset) => {
            const categoryIcon = asset.category?.icon || "Monitor";
            const IconComponent = iconMap[categoryIcon] || Monitor;

            return (
              <div
                key={asset.id}
                className="bg-card rounded-xl border overflow-hidden hover:shadow-md transition"
              >
                {/* Top colored section */}
                <div className="h-20 bg-muted/30 flex items-center justify-center">
                  <IconComponent className="h-8 w-8 text-muted-foreground" />
                </div>

                {/* Body */}
                <div className="p-4 space-y-2">
                  <p className="font-medium text-sm leading-tight">
                    {asset.name}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {asset.tag}
                  </p>
                  <StatusBadge status={asset.status} />
                  <div className="pt-1">
                    {asset.assignedTo ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-medium">
                          {getInitials(asset.assignedTo.name)}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {asset.assignedTo.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Unassigned
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Register Asset Dialog ─────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register New Asset</DialogTitle>
            <DialogDescription>
              Fill in the details to register a new asset in the system.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Asset Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="asset-name">Asset Name</Label>
              <Input
                id="asset-name"
                placeholder="e.g. MacBook Pro 14&quot; M3"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
              />
            </div>

            {/* Serial Number */}
            <div className="grid gap-1.5">
              <Label htmlFor="serial-number">Serial Number</Label>
              <Input
                id="serial-number"
                placeholder="e.g. NX-LAP-2024-0042"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
              />
            </div>

            {/* Category */}
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IT">IT</SelectItem>
                  <SelectItem value="Furniture">Furniture</SelectItem>
                  <SelectItem value="Equipment">Equipment</SelectItem>
                  <SelectItem value="Vehicles">Vehicles</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Purchase Value */}
            <div className="grid gap-1.5">
              <Label htmlFor="purchase-value">Purchase Value (₹)</Label>
              <Input
                id="purchase-value"
                type="number"
                placeholder="e.g. 189900"
                value={purchaseValue}
                onChange={(e) => setPurchaseValue(e.target.value)}
              />
            </div>

            {/* Condition */}
            <div className="grid gap-1.5">
              <Label>Condition</Label>
              <Select value={condition} onValueChange={(v) => setCondition(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="Refurbished">Refurbished</SelectItem>
                  <SelectItem value="Used">Used</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Location */}
            <div className="grid gap-1.5">
              <Label>Location</Label>
              <Select value={location} onValueChange={(v) => setLocation(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mumbai HQ">Mumbai HQ</SelectItem>
                  <SelectItem value="Bangalore Tech Park">Bangalore Tech Park</SelectItem>
                  <SelectItem value="Pune Dev Center">Pune Dev Center</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Is Bookable */}
            <div className="flex items-center justify-between">
              <Label htmlFor="is-bookable">Is Bookable</Label>
              <Switch
                checked={isBookable}
                onCheckedChange={(checked) => setIsBookable(checked)}
                id="is-bookable"
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
              Register Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
