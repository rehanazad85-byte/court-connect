import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, LayoutGrid, Users, Lock } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { PhoneShell } from "@/components/PhoneShell";
import { TopBar } from "@/components/TopBar";
import { useBooking, bookingStore } from "@/lib/booking-store";
import { formatPence } from "@/lib/mock-data";
import { addMinutesToTime, combineISO } from "@/lib/date-utils";
import { createBooking, ensureCustomerAccountRecords } from "@/lib/booking.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BookingDebugPanel, BookingFlowDebugPanel, BookingRouteErrorPanel, buildBookingDebugSnapshot, isBookingDebugEnabled, logBookingDebug, summaryDataExists, type BookingDebugSnapshot } from "@/lib/booking-debug";

type BookingDebug = {
  clickFired: boolean;
  authenticated: boolean | null;
  createBookingCalled: boolean;
  payload: Record<string, unknown> | null;
  error: BookingDebugSnapshot | null;
  result: Record<string, unknown> | null;
};

const initialDebug: BookingDebug = {
  clickFired: false,
  authenticated: null,
  createBookingCalled: false,
  payload: null,
  error: null,
  result: null,
};

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
  const [debug, setDebug] = useState<BookingDebug>(initialDebug);
  const hasSummaryData = summaryDataExists(booking);

  const missingSummarySnapshot = useMemo(() => {
    if (hasSummaryData) return null;
    return buildBookingDebugSnapshot({
      component: "SummaryPage",
      error: new Error("Missing booking summary data. Please choose the venue and time again."),
      booking,
      sessionIdPresent: null,
      createBookingCalled: false,
    });
  }, [booking, hasSummaryData]);

  useEffect(() => {
    if (missingSummarySnapshot) logBookingDebug(missingSummarySnapshot);
  }, [missingSummarySnapshot]);

  if (!hasSummaryData) {
    const chooseAgainTarget = booking.venueId
      ? { to: "/venue/$venueId" as const, params: { venueId: booking.venueId }, search: { city: booking.searchCity ?? undefined, date: booking.dateISO ?? undefined, players: booking.players } }
      : null;
    return (
      <PhoneShell>
        <TopBar title="Booking Summary" back="/" />
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          No booking in progress. Please choose the venue and time again.
          <button onClick={() => navigate(chooseAgainTarget ?? { to: "/" })} className="mt-5 h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground">Choose venue again</button>
          <BookingFlowDebugPanel routeName="SummaryPage.missingState" quoteLoaded={false} createBookingCalled={false} />
          {missingSummarySnapshot && <BookingDebugPanel snapshot={missingSummarySnapshot} />}
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
    const startsAtISO = combineISO(dateISO, selectedTime);
    const startMs = new Date(startsAtISO).getTime();
    if (Number.isNaN(startMs)) {
      const error = new Error("Invalid booking date or time. Please choose the venue and time again.");
      const snapshot = buildBookingDebugSnapshot({ component: "SummaryPage.onPay", error, booking, sessionIdPresent: null, createBookingCalled: false });
      logBookingDebug(snapshot);
      setDebug((d) => ({ ...d, clickFired: true, error: snapshot }));
      toast.error(error.message);
      setSubmitting(false);
      return;
    }
    const endsAtISO = new Date(startMs + durationMin * 60_000).toISOString();
    const debugPayload = {
          venueId,
      startsAtISO,
      endsAtISO,
      durationMin,
      resourceIds: booking.resourceIds,
      players,
      resourceLabels: booking.resourceLabels,
      clientQuote: {
        perResourcePence: booking.pricePerCourtPence,
        subtotalPence: subtotal,
        serviceFeePence: fee,
        totalPence: total,
      },
    };
    setDebug({ ...initialDebug, clickFired: true, payload: debugPayload });
    try {
      // Re-check auth before submitting — if session lapsed, redirect to login.
      const { data: u } = await supabase.auth.getUser();
      setDebug((d) => ({ ...d, authenticated: !!u.user, payload: { ...debugPayload, userId: u.user?.id ?? null } }));
      if (!u.user) {
        const error = new Error("You need to sign in to confirm a booking.");
        const snapshot = buildBookingDebugSnapshot({ component: "SummaryPage.onPay", error, booking, sessionIdPresent: false, createBookingCalled: false, payload: debugPayload });
        logBookingDebug(snapshot);
        setDebug((d) => ({ ...d, error: snapshot }));
        toast.error(error.message);
        navigate({ to: "/login", search: { redirect: "/summary" } });
        return;
      }
      const missing = [
        !booking.venueId ? "venueId" : null,
        !startsAtISO ? "startsAt" : null,
        !endsAtISO ? "endsAt" : null,
        !durationMin ? "durationMin" : null,
        booking.resourceIds.length === 0 ? "resourceIds" : null,
        !players ? "players" : null,
        booking.pricePerCourtPence == null ? "total/quote data" : null,
      ].filter(Boolean) as string[];
      if (missing.length > 0) {
        const error = new Error(`Missing booking data: ${missing.join(", ")}`);
        const snapshot = buildBookingDebugSnapshot({ component: "SummaryPage.onPay", error, booking, sessionIdPresent: true, createBookingCalled: false, payload: debugPayload });
        logBookingDebug(snapshot);
        setDebug((d) => ({ ...d, error: snapshot }));
        toast.error(error.message);
        setSubmitting(false);
        return;
      }
      await ensureAccountRecords();
      setDebug((d) => ({ ...d, createBookingCalled: true }));
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
      setDebug((d) => ({ ...d, result: { id: res.id, reference: res.reference, totalPence: res.totalPence } }));
      bookingStore.reset();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-bookings"] }),
        qc.invalidateQueries({ queryKey: ["vendor-bookings"] }),
      ]);
      navigate({ to: "/confirmation", search: { ref: res.reference, total: res.totalPence } });
    } catch (e) {
      const msg = errorMessage(e);
      const snapshot = buildBookingDebugSnapshot({ component: "SummaryPage.onPay", error: e, booking, sessionIdPresent: true, createBookingCalled: true, payload: debugPayload });
      logBookingDebug(snapshot);
      setDebug((d) => ({ ...d, error: snapshot }));
      toast.error(msg, { description: "Please try again or pick a different time." });
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
          {booking.venueImage && <img src={booking.venueImage} alt={booking.venueName ?? ""} width={80} height={80} loading="lazy" className="h-16 w-16 rounded-xl object-cover" />}
          <div>
            <div className="text-sm font-bold">{booking.venueName}</div>
            <div className="text-xs text-muted-foreground">{booking.resourceIds.length} {booking.resourceIds.length === 1 ? "court" : "courts"}</div>
          </div>
        </div>

        <h3 className="mt-6 text-base font-bold">Booking Details</h3>
        <div className="mt-3 space-y-3 rounded-2xl bg-card p-4 shadow-soft">
          <Row icon={Calendar} label="Date" value={booking.dateLabel ?? ""} />
          <Row icon={Clock} label="Time" value={`${selectedTime} – ${endTime} (${hours} hour${hours === 1 ? "" : "s"})`} />
          <Row icon={LayoutGrid} label="Courts" value={booking.resourceLabels.join(", ")} />
        <Row icon={Users} label="Players" value={`${players} Players`} />
        </div>

        <h3 className="mt-6 text-base font-bold">Price Breakdown</h3>
        <div className="mt-3 space-y-2.5 rounded-2xl bg-card p-4 shadow-soft text-sm">
          <Line label={`${booking.resourceIds.length} court${booking.resourceIds.length === 1 ? "" : "s"} × ${hours}h`} value={formatPence(subtotal)} />
          <Line label="Service fee (2%)" value={formatPence(fee)} />
          <div className="h-px bg-border" />
          <Line label="Total" value={formatPence(total)} bold />
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">Payment is stubbed for now — booking is confirmed instantly.</p>

        <BookingFlowDebugPanel
          routeName="SummaryPage"
          quoteLoaded={booking.pricePerCourtPence != null}
          createBookingCalled={debug.createBookingCalled}
          latestCreateBookingError={debug.error?.message ?? null}
        />

        {isBookingDebugEnabled() && debug.clickFired && (
          <div className="mt-4 rounded-2xl border border-dashed bg-muted/40 p-3 text-[11px] text-muted-foreground">
            <div className="font-bold text-foreground">Booking debug</div>
            <DebugLine label="Button click fired" value={debug.clickFired ? "yes" : "no"} />
            <DebugLine label="Authenticated" value={debug.authenticated === null ? "checking" : debug.authenticated ? "yes" : "no"} />
            <DebugLine label="createBooking called" value={debug.createBookingCalled ? "yes" : "no"} />
            {debug.payload && <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-2">{JSON.stringify(debug.payload, null, 2)}</pre>}
            {debug.error && <BookingDebugPanel snapshot={debug.error} />}
            {debug.result && <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-2">{JSON.stringify(debug.result, null, 2)}</pre>}
          </div>
        )}
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

function DebugLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1 flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="font-mono font-semibold text-foreground">{value}</span>
    </div>
  );
}
