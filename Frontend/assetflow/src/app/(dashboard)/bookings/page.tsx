"use client";

import { useState } from "react";
import { bookings, assets } from "@/data/mock";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { format } from "date-fns";
import { Calendar, Plus, Loader2 } from "lucide-react";
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";

// ─── Status badge colors ────────────────────────────────────
const bookingStatusClasses: Record<string, string> = {
  UPCOMING:
    "bg-blue-100/80 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  ONGOING:
    "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  COMPLETED:
    "bg-gray-100/80 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  CANCELLED:
    "bg-rose-100/80 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
};

// ─── Calendar helpers ───────────────────────────────────────
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDay, daysInMonth };
}

function getBookingDates(): Set<number> {
  const now = new Date();
  const dates = new Set<number>();
  bookings.forEach((b) => {
    const d = new Date(b.date);
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      dates.add(d.getDate());
    }
  });
  return dates;
}

// ─── Time slots (30-min intervals from 08:00 to 18:00) ─────
const TIME_SLOTS: string[] = [];
for (let h = 8; h <= 18; h++) {
  TIME_SLOTS.push(`${h.toString().padStart(2, "0")}:00`);
  if (h < 18) {
    TIME_SLOTS.push(`${h.toString().padStart(2, "0")}:30`);
  }
}

// ─── Bookable assets ────────────────────────────────────────
const bookableAssets = assets.filter((a) => a.isBookable);

// ═══════════════════════════════════════════════════════════════
// BOOKINGS PAGE
// ═══════════════════════════════════════════════════════════════
export default function BookingsPage() {
  const [activeTab, setActiveTab] = useState("calendar");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [resource, setResource] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [purpose, setPurpose] = useState("");

  const now = new Date();
  const { firstDay, daysInMonth } = getMonthDays(now.getFullYear(), now.getMonth());
  const bookingDates = getBookingDates();
  const today = now.getDate();

  function resetForm() {
    setResource("");
    setDate("");
    setStartTime("");
    setEndTime("");
    setPurpose("");
  }

  function handleSubmit() {
    setSubmitting(true);
    setTimeout(() => {
      toast.success("Booking created successfully");
      setSubmitting(false);
      setDialogOpen(false);
      resetForm();
    }, 500);
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Resource Booking</h1>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Calendar className="h-4 w-4" />
          <Plus className="h-4 w-4" />
          New Booking
        </button>
      </div>

      {/* ─── Tabs ──────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as string)}>
        <TabsList>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="my-bookings">My Bookings</TabsTrigger>
        </TabsList>

        {/* Calendar Tab */}
        <TabsContent value="calendar">
          <div className="bg-card rounded-xl border p-5 mt-4">
            <h3 className="text-sm font-semibold mb-4">
              {format(now, "MMMM yyyy")}
            </h3>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS_OF_WEEK.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-muted-foreground py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells before first day */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-10" />
              ))}

              {/* Actual days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const isToday = day === today;
                const hasBooking = bookingDates.has(day);

                return (
                  <div
                    key={day}
                    className={cn(
                      "h-10 flex flex-col items-center justify-center rounded-lg text-sm relative transition-colors",
                      isToday && "bg-primary text-primary-foreground font-semibold",
                      !isToday && "hover:bg-muted/50"
                    )}
                  >
                    {day}
                    {hasBooking && (
                      <span
                        className={cn(
                          "absolute bottom-1 h-1.5 w-1.5 rounded-full",
                          isToday ? "bg-primary-foreground" : "bg-primary"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* My Bookings Tab */}
        <TabsContent value="my-bookings">
          <div className="bg-card rounded-xl border mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => {
                  const isPast =
                    booking.status === "COMPLETED" || booking.status === "CANCELLED";

                  return (
                    <TableRow
                      key={booking.id}
                      className={cn(isPast && "opacity-60")}
                    >
                      <TableCell className="font-medium">
                        {booking.resource.name}
                      </TableCell>
                      <TableCell>
                        {format(new Date(booking.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {booking.startTime} – {booking.endTime}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {booking.purpose}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs",
                            bookingStatusClasses[booking.status]
                          )}
                        >
                          {booking.status.charAt(0) +
                            booking.status.slice(1).toLowerCase()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── New Booking Dialog ────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Booking</DialogTitle>
            <DialogDescription>
              Book a shared resource for your team.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Resource */}
            <div className="grid gap-1.5">
              <Label>Resource</Label>
              <Select value={resource} onValueChange={(v) => setResource(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a bookable resource" />
                </SelectTrigger>
                <SelectContent>
                  {bookableAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name} ({asset.tag})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="grid gap-1.5">
              <Label htmlFor="booking-date">Date</Label>
              <Input
                id="booking-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Start Time */}
            <div className="grid gap-1.5">
              <Label>Start Time</Label>
              <Select value={startTime} onValueChange={(v) => setStartTime(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select start time" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* End Time */}
            <div className="grid gap-1.5">
              <Label>End Time</Label>
              <Select value={endTime} onValueChange={(v) => setEndTime(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select end time" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Purpose */}
            <div className="grid gap-1.5">
              <Label htmlFor="booking-purpose">Purpose</Label>
              <Input
                id="booking-purpose"
                placeholder="e.g. Sprint planning meeting"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
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
              Create Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
