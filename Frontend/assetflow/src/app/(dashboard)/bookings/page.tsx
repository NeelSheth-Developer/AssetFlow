"use client";

import { useState, useEffect } from "react";
import { bookingsApi, resourcesApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar, Plus, Loader2, X, Clock, RefreshCw, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  UPCOMING: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  ONGOING: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  COMPLETED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  CANCELLED: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
};

const TIME_SLOTS: string[] = [];
for (let h = 9; h <= 18; h++) {
  TIME_SLOTS.push(`${h.toString().padStart(2, "0")}:00`);
  if (h < 18) TIME_SLOTS.push(`${h.toString().padStart(2, "0")}:30`);
}

export default function BookingsPage() {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<"my" | "all" | "availability">("my");
  const [bookings, setBookings] = useState<any[]>([]);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resource, setResource] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [purpose, setPurpose] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  // Recurring dialog
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [recurFrequency, setRecurFrequency] = useState("WEEKLY");
  const [recurStartDate, setRecurStartDate] = useState("");
  const [recurEndDate, setRecurEndDate] = useState("");
  const [recurStartTime, setRecurStartTime] = useState("");
  const [recurEndTime, setRecurEndTime] = useState("");
  const [recurPurpose, setRecurPurpose] = useState("");
  const [recurResource, setRecurResource] = useState("");

  // Reschedule dialog
  const [rescheduleBooking, setRescheduleBooking] = useState<any>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleStart, setRescheduleStart] = useState("");
  const [rescheduleEnd, setRescheduleEnd] = useState("");

  // Availability check
  const [availResource, setAvailResource] = useState("");
  const [availDate, setAvailDate] = useState("");
  const [availSlots, setAvailSlots] = useState<any[]>([]);
  const [availLoading, setAvailLoading] = useState(false);

  // Cancel confirm
  const [cancelBooking, setCancelBooking] = useState<any>(null);

  function fetchMyBookings() {
    bookingsApi.my().then((res: any) => { if (res.success && res.data) setBookings(res.data.bookings || []); }).catch(() => {}).finally(() => setLoading(false));
  }

  function fetchAllBookings() {
    bookingsApi.list().then((res: any) => { if (res.success && res.data) setAllBookings(res.data.bookings || []); }).catch(() => {});
  }

  useEffect(() => {
    fetchMyBookings();
    fetchAllBookings();
    resourcesApi.list().then((res: any) => { if (res.success && res.data) setResources(res.data.resources || []); }).catch(() => {});
  }, []);

  // ─── Create Booking ─────────────────────────────────
  function handleCreate() {
    const errors: Record<string, boolean> = {};
    if (!resource) errors.resource = true;
    if (!date) errors.date = true;
    if (!startTime) errors.startTime = true;
    if (!endTime) errors.endTime = true;
    if (!purpose.trim()) errors.purpose = true;
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) { toast.error("Fill all required fields"); return; }
    if (startTime >= endTime) { toast.error("End time must be after start time"); return; }

    setSubmitting(true);
    // First check availability
    bookingsApi.checkAvailability({ resourceId: resource, date, startTime, endTime })
      .then((res: any) => {
        if (res.success && res.data && res.data.available === false) {
          const conflict = res.data.conflict;
          const altNames = (res.data.alternatives || []).map((a: any) => a.resourceName).join(", ");
          toast.error(`Slot conflicts with ${conflict?.bookedBy || "another booking"}.${altNames ? ` Try: ${altNames}` : ""}`);
          setSubmitting(false);
          return;
        }
        // No conflict — proceed to book
        return bookingsApi.create({ resourceId: resource, date, startTime, endTime, purpose: purpose.trim() })
          .then((res: any) => { toast.success(res.message || "Booking created"); setCreateOpen(false); resetCreate(); fetchMyBookings(); fetchAllBookings(); });
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setSubmitting(false));
  }

  function resetCreate() { setResource(""); setDate(""); setStartTime(""); setEndTime(""); setPurpose(""); setFormErrors({}); }

  // ─── Recurring Booking ──────────────────────────────
  function handleRecurring() {
    if (!recurResource || !recurStartDate || !recurEndDate || !recurStartTime || !recurEndTime) { toast.error("Fill all fields"); return; }
    if (recurStartTime >= recurEndTime) { toast.error("End time must be after start"); return; }
    setSubmitting(true);
    bookingsApi.recurring({
      resourceId: recurResource, frequency: recurFrequency,
      startDate: recurStartDate, endDate: recurEndDate,
      startTime: recurStartTime, endTime: recurEndTime,
      purpose: recurPurpose || undefined,
    })
      .then((res: any) => {
        const data = res.data || res;
        toast.success(`Created ${data.bookingsCreated || 0} bookings${data.conflicts?.length ? ` (${data.conflicts.length} conflicts skipped)` : ""}`);
        setRecurringOpen(false); fetchMyBookings(); fetchAllBookings();
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setSubmitting(false));
  }

  // ─── Cancel Booking ─────────────────────────────────
  function handleCancel() {
    if (!cancelBooking) return;
    setSubmitting(true);
    bookingsApi.cancel(cancelBooking.id)
      .then((res: any) => { toast.success(res.message || "Cancelled"); setCancelBooking(null); fetchMyBookings(); fetchAllBookings(); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setSubmitting(false));
  }

  // ─── Reschedule ─────────────────────────────────────
  function handleReschedule() {
    if (!rescheduleBooking || !rescheduleDate || !rescheduleStart || !rescheduleEnd) { toast.error("Fill all fields"); return; }
    if (rescheduleStart >= rescheduleEnd) { toast.error("End must be after start"); return; }
    setSubmitting(true);
    bookingsApi.reschedule(rescheduleBooking.id, { date: rescheduleDate, startTime: rescheduleStart, endTime: rescheduleEnd })
      .then((res: any) => { toast.success(res.message || "Rescheduled"); setRescheduleBooking(null); fetchMyBookings(); fetchAllBookings(); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setSubmitting(false));
  }

  // ─── Check Availability ─────────────────────────────
  function checkAvailability() {
    if (!availResource || !availDate) { toast.error("Select resource and date"); return; }
    setAvailLoading(true);
    resourcesApi.availability(availResource, availDate)
      .then((res: any) => { if (res.success && res.data) setAvailSlots(res.data.slots || []); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setAvailLoading(false));
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  const displayBookings = activeTab === "my" ? bookings : allBookings;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight">Resource Booking</h1><p className="text-muted-foreground text-sm">Book shared resources and manage your reservations</p></div>
        <div className="flex gap-2">
          <Button onClick={() => { resetCreate(); setCreateOpen(true); }} className="px-4 py-2 rounded-lg"><Plus className="size-4 mr-1.5" />New Booking</Button>
          <Button variant="outline" onClick={() => setRecurringOpen(true)} className="px-4 py-2 rounded-lg"><RefreshCw className="size-4 mr-1.5" />Recurring</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button onClick={() => setActiveTab("my")} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", activeTab === "my" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>My Bookings</button>
        <button onClick={() => setActiveTab("all")} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", activeTab === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>All Bookings</button>
        <button onClick={() => setActiveTab("availability")} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", activeTab === "availability" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>Check Availability</button>
      </div>

      {/* Availability Tab */}
      {activeTab === "availability" && (
        <div className="bg-card rounded-xl border p-5 space-y-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="grid gap-1.5 flex-1 min-w-[180px]">
              <Label>Resource</Label>
              <Select value={availResource || undefined} onValueChange={(v) => setAvailResource(v ?? "")}><SelectTrigger><SelectValue placeholder="Select resource" /></SelectTrigger>
                <SelectContent>{resources.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name} {r.location ? `(${r.location})` : ""}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Date</Label>
              <Input type="date" value={availDate} onChange={(e) => setAvailDate(e.target.value)} />
            </div>
            <Button onClick={checkAvailability} disabled={availLoading} className="px-4 py-2 rounded-lg">{availLoading ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4 mr-1.5" />}Check</Button>
          </div>
          {availSlots.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {availSlots.map((slot: any, i: number) => (
                <div key={i} className={cn("rounded-lg p-2.5 text-center text-xs font-medium border", slot.available ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-400" : "bg-red-50 border-red-200 text-red-600 dark:bg-red-950/20 dark:border-red-900 dark:text-red-400")}>
                  {slot.start} – {slot.end}
                  <p className="text-[10px] mt-0.5 opacity-70">{slot.available ? "Available" : "Booked"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bookings Table */}
      {activeTab !== "availability" && (
        displayBookings.length === 0 ? (
          <div className="text-center py-16"><p className="text-muted-foreground">No bookings found</p></div>
        ) : (
          <div className="bg-card rounded-xl border overflow-hidden max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Booked By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayBookings.map((b: any, idx: number) => {
                  const bDate = b.date || (b.start ? b.start.split("T")[0] : "");
                  const bStart = b.startTime || (b.start ? (() => { try { return format(new Date(b.start), "HH:mm"); } catch { return ""; } })() : "");
                  const bEnd = b.endTime || (b.end ? (() => { try { return format(new Date(b.end), "HH:mm"); } catch { return ""; } })() : "");
                  const canManage = b.status === "UPCOMING" || b.status === "CONFIRMED";

                  return (
                    <TableRow key={b.id || idx}>
                      <TableCell className="font-medium text-sm">{b.resource?.name || "—"}</TableCell>
                      <TableCell className="text-sm">
                        <div>{bDate ? (() => { try { return format(new Date(bDate), "MMM d, yyyy"); } catch { return bDate; } })() : "—"}</div>
                        <div className="text-xs text-muted-foreground">{bStart} – {bEnd}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{b.purpose || "—"}</TableCell>
                      <TableCell className="text-sm">{b.bookedBy?.name || "—"}</TableCell>
                      <TableCell><Badge variant="secondary" className={cn("text-xs", statusColors[b.status] || "")}>{b.status || "UPCOMING"}</Badge></TableCell>
                      <TableCell className="text-right">
                        {canManage && (
                          <div className="flex justify-end gap-1">
                            <button onClick={() => { setRescheduleBooking(b); setRescheduleDate(bDate); setRescheduleStart(bStart); setRescheduleEnd(bEnd); }} className="text-[10px] px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 hover:bg-blue-200 transition">Reschedule</button>
                            <button onClick={() => setCancelBooking(b)} className="text-[10px] px-2 py-1 rounded bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 hover:bg-red-200 transition">Cancel</button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )
      )}

      {/* ─── Create Booking Dialog ─────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) resetCreate(); setCreateOpen(o); }}>
        <DialogContent className="rounded-2xl shadow-lg sm:max-w-md">
          <DialogHeader><DialogTitle>New Booking</DialogTitle><DialogDescription>Book a shared resource.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5"><Label>Resource <span className="text-destructive">*</span></Label>
              <Select value={resource || undefined} onValueChange={(v) => { setResource(v ?? ""); setFormErrors({}); }}><SelectTrigger className={cn(formErrors.resource && "border-destructive")}><SelectValue placeholder="Select resource" /></SelectTrigger>
                <SelectContent>{resources.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name} {r.location ? `(${r.location})` : ""}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Date <span className="text-destructive">*</span></Label><Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setFormErrors({}); }} className={cn(formErrors.date && "border-destructive")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Start <span className="text-destructive">*</span></Label>
                <Select value={startTime || undefined} onValueChange={(v) => { setStartTime(v ?? ""); setFormErrors({}); }}><SelectTrigger className={cn(formErrors.startTime && "border-destructive")}><SelectValue placeholder="Start" /></SelectTrigger>
                  <SelectContent>{TIME_SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-1.5"><Label>End <span className="text-destructive">*</span></Label>
                <Select value={endTime || undefined} onValueChange={(v) => { setEndTime(v ?? ""); setFormErrors({}); }}><SelectTrigger className={cn(formErrors.endTime && "border-destructive")}><SelectValue placeholder="End" /></SelectTrigger>
                  <SelectContent>{TIME_SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid gap-1.5"><Label>Purpose <span className="text-destructive">*</span></Label><Input placeholder="e.g. Sprint planning" value={purpose} onChange={(e) => { setPurpose(e.target.value); setFormErrors({}); }} className={cn(formErrors.purpose && "border-destructive")} /></div>
          </div>
          <DialogFooter><Button variant="outline" className="px-4 py-2 rounded-lg" onClick={() => { setCreateOpen(false); resetCreate(); }} disabled={submitting}>Cancel</Button><Button className="px-4 py-2 rounded-lg" onClick={handleCreate} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Book</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Recurring Dialog ──────────────────────────── */}
      <Dialog open={recurringOpen} onOpenChange={setRecurringOpen}>
        <DialogContent className="rounded-2xl shadow-lg sm:max-w-md">
          <DialogHeader><DialogTitle>Recurring Booking</DialogTitle><DialogDescription>Create a daily or weekly recurring series.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5"><Label>Resource *</Label>
              <Select value={recurResource || undefined} onValueChange={(v) => setRecurResource(v ?? "")}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{resources.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Frequency</Label>
              <Select value={recurFrequency} onValueChange={(v) => setRecurFrequency(v ?? "WEEKLY")}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="DAILY">Daily</SelectItem><SelectItem value="WEEKLY">Weekly</SelectItem></SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Start Date *</Label><Input type="date" value={recurStartDate} onChange={(e) => setRecurStartDate(e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>End Date *</Label><Input type="date" value={recurEndDate} onChange={(e) => setRecurEndDate(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Start Time *</Label>
                <Select value={recurStartTime} onValueChange={(v) => setRecurStartTime(v ?? "")}><SelectTrigger><SelectValue placeholder="Start" /></SelectTrigger>
                  <SelectContent>{TIME_SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-1.5"><Label>End Time *</Label>
                <Select value={recurEndTime} onValueChange={(v) => setRecurEndTime(v ?? "")}><SelectTrigger><SelectValue placeholder="End" /></SelectTrigger>
                  <SelectContent>{TIME_SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid gap-1.5"><Label>Purpose</Label><Input placeholder="e.g. Weekly standup" value={recurPurpose} onChange={(e) => setRecurPurpose(e.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" className="px-4 py-2 rounded-lg" onClick={() => setRecurringOpen(false)} disabled={submitting}>Cancel</Button><Button className="px-4 py-2 rounded-lg" onClick={handleRecurring} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Create Series</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reschedule Dialog ─────────────────────────── */}
      <Dialog open={!!rescheduleBooking} onOpenChange={(o) => { if (!o) setRescheduleBooking(null); }}>
        <DialogContent className="rounded-2xl shadow-lg sm:max-w-sm">
          <DialogHeader><DialogTitle>Reschedule Booking</DialogTitle><DialogDescription>{rescheduleBooking?.resource?.name}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5"><Label>New Date *</Label><Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Start *</Label>
                <Select value={rescheduleStart} onValueChange={(v) => setRescheduleStart(v ?? "")}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIME_SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-1.5"><Label>End *</Label>
                <Select value={rescheduleEnd} onValueChange={(v) => setRescheduleEnd(v ?? "")}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIME_SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" className="px-4 py-2 rounded-lg" onClick={() => setRescheduleBooking(null)} disabled={submitting}>Cancel</Button><Button className="px-4 py-2 rounded-lg" onClick={handleReschedule} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Reschedule</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Cancel Confirm ────────────────────────────── */}
      <Dialog open={!!cancelBooking} onOpenChange={(o) => { if (!o) setCancelBooking(null); }}>
        <DialogContent className="rounded-2xl shadow-lg sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="size-5 text-destructive" />Cancel Booking</DialogTitle>
            <DialogDescription>Are you sure you want to cancel this booking for {cancelBooking?.resource?.name}?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="px-4 py-2 rounded-lg" onClick={() => setCancelBooking(null)} disabled={submitting}>Keep</Button>
            <Button variant="destructive" className="px-4 py-2 rounded-lg" onClick={handleCancel} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin mr-2" />}Cancel Booking</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
