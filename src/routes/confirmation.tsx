import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, X, Calendar, Clock, LayoutGrid, Users, Copy } from "lucide-react";
import { getVenue } from "@/lib/mock-data";
import { useBooking } from "@/lib/booking-store";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/confirmation")({
  head: () => ({
    meta: [
      { title: "Booking confirmed — Knox" },
      { name: "description", content: "Instant confirmation with booking reference and email receipt." },
    ],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const booking = useBooking();
  const venue = getVenue(booking.venueId);
  const hours = booking.durationHrs;
  const endTime = addHours(booking.time, hours);
  const total = (booking.courtIds.length * 32 * hours * 1.02).toFixed(2);

  return (
    <div className="min-h-dvh bg-ink">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-ink text-ink-foreground shadow-pop">
        <div className="flex items-center justify-between px-5 pt-5">
          <Link to="/" className="-ml-1 flex h-9 w-9 items-center justify-center">
            <X className="h-6 w-6" />
          </Link>
        </div>

        <div className="flex flex-col items-center px-6 pt-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Check className="h-9 w-9 text-primary-foreground" strokeWidth={3} />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Booking Confirmed!</h1>
          <p className="mt-2 text-center text-sm text-white/70">
            Your booking has been confirmed and<br />payment was successful.
          </p>
        </div>

        <div className="mx-5 mt-6 rounded-2xl bg-card p-4 text-card-foreground shadow-pop">
          <div className="flex items-center gap-3">
            <img src={venue.image} alt={venue.name} width={80} height={80} loading="lazy" className="h-14 w-14 rounded-xl object-cover" />
            <div>
              <div className="text-sm font-bold">{venue.name}</div>
              <div className="text-xs text-muted-foreground">{venue.type} · {venue.courts} Courts</div>
            </div>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <Row icon={Calendar} value={booking.date.replace("May", "May 2025")} />
            <Row icon={Clock} value={`${booking.time} – ${endTime} (${hours} hours)`} />
            <Row icon={LayoutGrid} value={booking.courtIds.map((i) => `Court ${i}`).join(", ")} />
            <Row icon={Users} value={`${booking.players} Players`} />
          </div>
          <div className="mt-4 flex items-center justify-between border-t pt-3">
            <span className="text-sm font-semibold">Total Paid</span>
            <span className="text-base font-bold text-primary">£{total}</span>
          </div>
        </div>

        <div className="mx-5 mt-5 text-center">
          <div className="text-[11px] uppercase tracking-wider text-white/50">Booking Reference</div>
          <button className="mx-auto mt-1 inline-flex items-center gap-2 text-sm font-bold">
            KNOX-78291 <Copy className="h-3.5 w-3.5 text-white/60" />
          </button>
          <p className="mt-4 text-xs text-white/60">
            A confirmation email has been sent to<br />you at alex@example.com
          </p>
        </div>

        <div className="flex-1" />

        <div className="space-y-2 px-5 pb-4 pt-6">
          <Link to="/bookings" className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            View My Bookings
          </Link>
          <Link to="/" className="flex h-12 w-full items-center justify-center rounded-xl border border-white/20 text-sm font-bold">
            Back to Home
          </Link>
        </div>

        <div className="bg-ink">
          <BottomNav />
        </div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, value }: { icon: any; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium">{value}</span>
    </div>
  );
}

function addHours(t: string, h: number) {
  const [hh, mm] = t.split(":").map(Number);
  const total = (hh + h) % 24;
  return `${String(total).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
