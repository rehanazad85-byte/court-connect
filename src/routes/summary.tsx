import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, Clock, LayoutGrid, Users, Lock } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { TopBar } from "@/components/TopBar";
import { getVenue } from "@/lib/mock-data";
import { useBooking } from "@/lib/booking-store";

export const Route = createFileRoute("/summary")({
  head: () => ({
    meta: [
      { title: "Booking summary — Knox" },
      { name: "description", content: "Review your booking details, price breakdown and complete payment securely." },
    ],
  }),
  component: SummaryPage,
});

function SummaryPage() {
  const booking = useBooking();
  const venue = getVenue(booking.venueId);
  const hours = booking.durationHrs;
  const endTime = addHours(booking.time, hours);
  const subtotal = booking.courtIds.length * 32 * hours;
  const fee = +(subtotal * 0.02).toFixed(2);
  const total = +(subtotal + fee).toFixed(2);

  return (
    <PhoneShell>
      <TopBar title="Booking Summary" back={`/venue/${venue.id}/courts`} />

      <div className="px-5 pb-40">
        <div className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
          <img src={venue.image} alt={venue.name} width={80} height={80} loading="lazy" className="h-16 w-16 rounded-xl object-cover" />
          <div>
            <div className="text-sm font-bold">{venue.name}</div>
            <div className="text-xs text-muted-foreground">{venue.type} · {venue.courts} Courts</div>
          </div>
        </div>

        <h3 className="mt-6 text-base font-bold">Booking Details</h3>
        <div className="mt-3 space-y-3 rounded-2xl bg-card p-4 shadow-soft">
          <Row icon={Calendar} label="Date" value={booking.date.replace("May", "May 2025")} />
          <Row icon={Clock} label="Time" value={`${booking.time} – ${endTime} (${hours} hours)`} />
          <Row icon={LayoutGrid} label="Courts" value={`${booking.courtIds.length} Courts (${booking.courtIds.map((i) => `Court ${i}`).join(", ")})`} />
          <Row icon={Users} label="Players" value={`${booking.players} Players`} />
        </div>

        <h3 className="mt-6 text-base font-bold">Price Breakdown</h3>
        <div className="mt-3 space-y-2.5 rounded-2xl bg-card p-4 shadow-soft text-sm">
          <Line label={`${booking.courtIds.length} Courts x ${hours} Hours`} value={`£${subtotal.toFixed(2)}`} />
          <Line label="Service Fee (2%)" value={`£${fee.toFixed(2)}`} />
          <div className="h-px bg-border" />
          <Line label="Total" value={`£${total.toFixed(2)}`} bold />
        </div>

        <h3 className="mt-6 text-base font-bold">Payment Method</h3>
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft">
          <div className="flex h-8 w-12 items-center justify-center rounded-md bg-primary/15 text-[10px] font-bold text-primary">VISA</div>
          <div className="flex-1 text-sm font-semibold">···· 4242</div>
          <button className="text-xs font-semibold text-primary">Change</button>
        </div>
      </div>

      <div className="sticky bottom-[60px] border-t bg-card/95 backdrop-blur">
        <div className="px-5 py-3">
          <Link
            to="/confirmation"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition active:scale-[.99]"
          >
            <Lock className="h-4 w-4" />
            Pay £{total.toFixed(2)}
          </Link>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">Secure payment powered by Stripe</p>
        </div>
      </div>
    </PhoneShell>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
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

function addHours(t: string, h: number) {
  const [hh, mm] = t.split(":").map(Number);
  const total = (hh + h) % 24;
  return `${String(total).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
