import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, LayoutGrid, Users, Lock } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { PhoneShell } from "@/components/PhoneShell";
import { TopBar } from "@/components/TopBar";
import { useBooking, bookingStore } from "@/lib/booking-store";
import { formatPence } from "@/lib/mock-data";
import { resourceLabel } from "@/lib/resource-labels";
import { addMinutesToTime, combineISO } from "@/lib/date-utils";
import { createBooking, ensureCustomerAccountRecords } from "@/lib/booking.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BookingRouteErrorPanel, buildBookingDebugSnapshot, logBookingDebug, summaryDataExists } from "@/lib/booking-debug";

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Booking failed";
  }
}

export const Route = createFileRoute("/summary")({
  head: () => ({ meta: [{ title: "Booking summary — Knox" }] }),
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  errorComponent: ({ error, reset }) => (
    <div className="min-h-dvh bg-background p-8 text-center">
      <h1 className="text-lg font-bold">Something went wrong on the booking summary</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
      <div className="mt-6 flex justify-center gap-2">
        <button onClick={() => reset()} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Try again</button>
        <a href="/" className="rounded-full border px-5 py-2.5 text-sm font-semibold">Go home</a>
      </div>
      <BookingRouteErrorPanel component="SummaryRoute.errorComponent" error={error} />
    </div>
  ),
  component: SummaryPage,
});

function SummaryPage() {
  const booking = useBooking();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submit = useServerFn(createBooking);
  const ensureAccountRecords = useServerFn(ensureCustomerAccountRecords);
  const [submitting, setSubmitting] = useState(false);
  const hasSummaryData = summaryDataExists(booking);

  if (!hasSummaryData) {
    const chooseAgain = () => {
      if (booking.venueId) {
        navigate({
          to: "/venue/$venueId",
          params: { venueId: booking.venueId },
          search: { city: booking.searchCity ?? undefined, date: booking.dateISO ?? undefined, players: booking.players },
        });
        return;
      }
      navigate({ to: "/" });
    };
    return (
      <PhoneShell>
        <TopBar title="Booking Summary" back="/" />
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          No booking in progress. Please choose the venue and time again.
          <button onClick={chooseAgain} className="mt-5 h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground">Choose venue again</button>
        </div>
      </PhoneShell>
    );
  }

  const venueId = booking.venueId!;
  const dateISO = booking.dateISO!;
  const selectedTime = booking.time!;
  const durationMin = Number.isFinite(booking.durationMin) && booking.durationMin > 0 ? booking.durationMin : 60;
  const players = Number.isFinite(booking.players) && booking.players > 0 ? booking.players : 2;
  const hours = durationMin / 60;
  const endTime = addMinutesToTime(selectedTime, durationMin);
  const perCourt = booking.pricePerCourtPence ?? 0;
  const subtotal = perCourt * booking.resourceIds.length;
  const fee = Math.round(subtotal * 0.02);
  const total = subtotal + fee;

  const onPay = async () => {
    setSubmitting(true);
    // Prefer the server-authoritative startsAtISO stored in the booking store.
    // For overnight venues the slot "01:00" on Friday actually falls on Saturday
    // morning — combineISO(dateISO, time) would produce the wrong UTC datetime.
    const startsAtISO = booking.startsAtISO ?? combineISO(dateISO, selectedTime);
    const startMs = new Date(startsAtISO).getTime();
    if (Number.isNaN(startMs)) {
      const error = new Error("Invalid booking date or time. Please choose the venue and time again.");
      logBookingDebug(buildBookingDebugSnapshot({ component: "SummaryPage.onPay", error, booking, sessionIdPresent: null, createBookingCalled: false }));
      toast.error(error.message);
      setSubmitting(false);
      return;
    }
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        toast.error("You need to sign in to confirm a booking.");
        navigate({ to: "/login", search: { redirect: "/summary" } });
        return;
      }
      const missing = [
        !booking.venueId ? "venueId" : null,
        !startsAtISO ? "startsAt" : null,
        !durationMin ? "durationMin" : null,
        booking.resourceIds.length === 0 ? "resourceIds" : null,
        !players ? "players" : null,
        booking.pricePerCourtPence == null ? "total/quote data" : null,
      ].filter(Boolean) as string[];
      if (missing.length > 0) {
        toast.error(`Missing booking data: ${missing.join(", ")}`);
        setSubmitting(false);
        return;
      }
      await ensureAccountRecords();
      const res = await submit({
        data: {
          venueId,
          startsAtISO,
          durationMin,
          resourceIds: booking.resourceIds,
          players,
        },
      });
      if (!res.reference) throw new Error("Booking succeeded but no confirmation reference was returned.");
      bookingStore.reset();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-bookings"] }),
        qc.invalidateQueries({ queryKey: ["vendor-bookings"] }),
      ]);
      navigate({ to: "/confirmation", search: { ref: res.reference, total: res.totalPence } });
    } catch (e) {
      logBookingDebug(buildBookingDebugSnapshot({ component: "SummaryPage.onPay", error: e, booking, sessionIdPresent: true, createBookingCalled: true }));
      toast.error(errorMessage(e), { description: "Please try again or pick a different time." });
      setSubmitting(false);
    }
  };

  return (
    <PhoneShell>
      <TopBar
        title="Booking Summary"
        back={{
          to: "/venue/$venueId/courts",
          params: { venueId },
          search: { city: booking.searchCity ?? undefined, date: dateISO, players: booking.players },
        }}
      />

      <div className="px-5 pb-40">
        <div className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
          {booking.venueImage && <img src={booking.venueImage} alt={booking.venueName ?? ""} width={80} height={80} loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate">{booking.venueName}</div>
            <div className="text-xs text-muted-foreground">{booking.resourceIds.length} {resourceLabel(booking.searchActivity, booking.resourceIds.length).toLowerCase()}</div>
          </div>
        </div>

        <h3 className="mt-6 text-base font-bold">Booking Details</h3>
        <div className="mt-3 space-y-3 rounded-2xl bg-card p-4 shadow-soft">
          <Row icon={Calendar} label="Date" value={booking.dateLabel ?? ""} />
          <Row icon={Clock} label="Time" value={`${selectedTime} – ${endTime} (${hours} hour${hours === 1 ? "" : "s"})`} />
          <Row icon={LayoutGrid} label={resourceLabel(booking.searchActivity, booking.resourceIds.length)} value={booking.resourceLabels.join(", ")} />
          <Row icon={Users} label="Players" value={`${players} Players`} />
        </div>

        <h3 className="mt-6 text-base font-bold">Price Breakdown</h3>
        <div className="mt-3 space-y-2.5 rounded-2xl bg-card p-4 shadow-soft text-sm">
          <Line label={`${booking.resourceIds.length} ${resourceLabel(booking.searchActivity, booking.resourceIds.length).toLowerCase()} × ${hours}h`} value={formatPence(subtotal)} />
          <Line label="Service fee (2%)" value={formatPence(fee)} />
          <div className="h-px bg-border" />
          <Line label="Total" value={formatPence(total)} bold />
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">Payment is stubbed for now — booking is confirmed instantly.</p>
      </div>

      <div className="sticky bottom-[60px] border-t bg-card/95 backdrop-blur">
        <div className="px-5 py-3">
          <button
            onClick={onPay}
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition active:scale-[.99] disabled:opacity-60"
          >
            <Lock className="h-4 w-4" />
            {submitting ? "Booking..." : `Confirm Booking · ${formatPence(total)}`}
          </button>
        </div>
      </div>
    </PhoneShell>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-bold" : "text-muted-foreground"}>{label}</span>
      <span className={bold ? "text-base font-bold text-primary" : "font-semibold"}>{value}</span>
    </div>
  );
}
