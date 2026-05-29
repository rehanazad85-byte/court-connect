import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Calendar, Clock, LayoutGrid, Users, Lock } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { PhoneShell } from "@/components/PhoneShell";
import { TopBar } from "@/components/TopBar";
import { useBooking, bookingStore } from "@/lib/booking-store";
import { formatPence } from "@/lib/mock-data";
import { addMinutesToTime, combineISO } from "@/lib/date-utils";
import { createBooking } from "@/lib/booking.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/summary")({
  head: () => ({ meta: [{ title: "Booking summary — Knox" }] }),
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: SummaryPage,
});

function SummaryPage() {
  const booking = useBooking();
  const navigate = useNavigate();
  const submit = useServerFn(createBooking);
  const [submitting, setSubmitting] = useState(false);

  if (!booking.venueId || !booking.dateISO || !booking.time || booking.resourceIds.length === 0) {
    return (
      <PhoneShell>
        <TopBar title="Booking Summary" back="/" />
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">No booking in progress. Start by picking a venue.</div>
      </PhoneShell>
    );
  }

  const hours = booking.durationMin / 60;
  const endTime = addMinutesToTime(booking.time, booking.durationMin);
  const perCourt = booking.pricePerCourtPence ?? 0;
  const subtotal = perCourt * booking.resourceIds.length;
  const fee = Math.round(subtotal * 0.02);
  const total = subtotal + fee;

  const onPay = async () => {
    setSubmitting(true);
    try {
      const res = await submit({
        data: {
          venueId: booking.venueId!,
          startsAtISO: combineISO(booking.dateISO!, booking.time!),
          durationMin: booking.durationMin,
          resourceIds: booking.resourceIds,
          players: booking.players,
        },
      });
      bookingStore.reset();
      navigate({ to: "/confirmation", search: { ref: res.reference, total: res.totalPence } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed");
      setSubmitting(false);
    }
  };

  return (
    <PhoneShell>
      <TopBar
        title="Booking Summary"
        back={{
          to: "/venue/$venueId/courts",
          params: { venueId: booking.venueId },
          search: { city: booking.searchCity ?? undefined, date: booking.dateISO, players: booking.players },
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
          <Row icon={Clock} label="Time" value={`${booking.time} – ${endTime} (${hours} hour${hours === 1 ? "" : "s"})`} />
          <Row icon={LayoutGrid} label="Courts" value={booking.resourceLabels.join(", ")} />
          <Row icon={Users} label="Players" value={`${booking.players} Players`} />
        </div>

        <h3 className="mt-6 text-base font-bold">Price Breakdown</h3>
        <div className="mt-3 space-y-2.5 rounded-2xl bg-card p-4 shadow-soft text-sm">
          <Line label={`${booking.resourceIds.length} court${booking.resourceIds.length === 1 ? "" : "s"} × ${hours}h`} value={formatPence(subtotal)} />
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
