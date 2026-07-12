"use client";

import { useState } from "react";
import { allocations, assets, users } from "@/data/mock";
import { cn } from "@/lib/utils";
import { Plus, Loader2 } from "lucide-react";
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

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface KanbanColumn {
  title: string;
  status: string[];
  headerClassName?: string;
}

const columns: KanbanColumn[] = [
  { title: "Pending", status: ["PENDING"] },
  { title: "Approved", status: ["APPROVED"] },
  { title: "Active", status: ["ACTIVE"] },
  {
    title: "Overdue",
    status: ["OVERDUE"],
    headerClassName: "bg-red-50/50 dark:bg-red-950/20",
  },
];

// Filter available assets for the dialog
const availableAssets = assets.filter((a) => a.status === "AVAILABLE");

export default function AllocationsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedAsset, setSelectedAsset] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [notes, setNotes] = useState("");

  function resetForm() {
    setSelectedAsset("");
    setSelectedEmployee("");
    setExpectedReturnDate("");
    setNotes("");
  }

  function handleSubmit() {
    setSubmitting(true);
    setTimeout(() => {
      toast.success("Asset allocated successfully");
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
          <h1 className="text-2xl font-bold tracking-tight">Allocations</h1>
          <p className="text-muted-foreground">
            Track asset allocations and transfers
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
        >
          <Plus className="h-4 w-4" />
          Allocate Asset
        </button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((column) => {
          const columnAllocations = allocations.filter((a) =>
            column.status.includes(a.status)
          );

          return (
            <div key={column.title} className="space-y-3">
              {/* Column Header */}
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2",
                  column.headerClassName || "bg-muted/50"
                )}
              >
                <h3 className="text-sm font-semibold">{column.title}</h3>
                <span className="rounded-full bg-muted px-2 text-xs font-medium">
                  {columnAllocations.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-3">
                {columnAllocations.map((allocation) => (
                  <div
                    key={allocation.id}
                    className={cn(
                      "bg-card rounded-xl border p-4 space-y-2",
                      allocation.status === "OVERDUE" &&
                        "border-l-2 border-l-red-500"
                    )}
                  >
                    {/* Asset name */}
                    <p className="text-sm font-medium">
                      {allocation.asset.name}
                    </p>

                    {/* Asset tag */}
                    <p className="text-xs font-mono text-muted-foreground">
                      {allocation.asset.tag}
                    </p>

                    {/* Holder */}
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-medium shrink-0">
                        {getInitials(allocation.holder.name)}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {allocation.holder.name}
                      </span>
                    </div>

                    {/* Expected return date */}
                    {allocation.expectedReturnDate && (
                      <p className="text-xs text-muted-foreground">
                        Return:{" "}
                        {new Date(
                          allocation.expectedReturnDate
                        ).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}

                {columnAllocations.length === 0 && (
                  <div className="rounded-xl border border-dashed p-4 text-center">
                    <p className="text-xs text-muted-foreground">
                      No allocations
                    </p>
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
              Assign an available asset to an employee. {availableAssets.length} assets currently available.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Asset */}
            <div className="grid gap-1.5">
              <Label>Asset</Label>
              <Select value={selectedAsset} onValueChange={(v) => setSelectedAsset(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an available asset" />
                </SelectTrigger>
                <SelectContent>
                  {availableAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name} ({asset.tag})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employee */}
            <div className="grid gap-1.5">
              <Label>Employee</Label>
              <Select value={selectedEmployee} onValueChange={(v) => setSelectedEmployee(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} — {user.designation}
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

            {/* Notes */}
            <div className="grid gap-1.5">
              <Label htmlFor="allocation-notes">Notes</Label>
              <Textarea
                id="allocation-notes"
                placeholder="Any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
              Allocate Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
