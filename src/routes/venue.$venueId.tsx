import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Calendar } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { TopBar } from "@/components/TopBar";
import { getVenue, dateOptions, timeSlots, unavailableSlots } from "@/lib/mock-data";
import { bookingStore, useBooking } from "@/lib/booking-store";

export const Route = createFileRoute("/venue/$venueId")({
  head: ({ params }) => {
    const v = getVenue(params.venueId);
    return {
      meta: [
        { title: `${v.name} — Select date & time | Knox` },
        { name: "description", content: `Pick your preferred date and time at ${v.name}. See real-time availability.` },
        { property: "og:image", content: v.image },
      ],
    };
  },
  component: VenuePage,
});

function VenuePage() {
  const { venueId } = Route.useParams();
  const venue = getVenue(venueId);
  const booking = useBooking();
  const navigate = useNavigate();

  return (
    <PhoneShell>
      <TopBar title={venue.name} subtitle={`${venue.type} · ${venue.courts} Courts`} back={`/activity/padel`} right="heart" />

      <div className="px-5">
        <img
          src={venue.image}
          alt={venue.name}
          width={800}
          height={600}
          loading="eager"
          className="aspect-[16/10] w-full rounded-2xl object-cover"
        />
      </div>

      <div className="px-5 pt-6">
        <h2 className="text-base font-bold">Select Date</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {dateOptions.map((d) => {
            const label = `${d.dow}, ${d.day} ${d.mon}`;
            const active = booking.date === label;
            return (
              <button
                key={label}
                onClick={() => bookingStore.set({ date: label })}
                className={`flex w-[60px] shrink-0 flex-col items-center rounded-xl border py-2 text-[11px] font-semibold transition ${
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                }`}
              >
                <span className={active ? "opacity-80" : "text-muted-foreground"}>{d.dow}</span>
                <span className="text-lg font-bold leading-tight">{d.day}</span>
                <span className={active ? "opacity-80" : "text-muted-foreground"}>{d.mon}</span>
              </button>
            );
          })}
          <button className="flex w-[60px] shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
            <Calendar className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="px-5 pt-6 pb-32">
        <h2 className="text-base font-bold">Select Time</h2>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {timeSlots.map((t) => {
            const disabled = unavailableSlots.has(t);
            const active = booking.time === t;
            return (
              <button
                key={t}
                disabled={disabled}
                onClick={() => bookingStore.set({ time: t })}
                className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                  disabled
                    ? "border-border bg-muted text-muted-foreground/50"
                    : active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* sticky CTA */}
      <div className="sticky bottom-[60px] border-t bg-card/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-semibold leading-tight">{booking.date}</div>
              <div className="text-xs text-muted-foreground">{booking.time}</div>
            </div>
          </div>
          <Link
            to="/venue/$venueId/courts"
            params={{ venueId }}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            View Courts
          </Link>
        </div>
      </div>
    </PhoneShell>
  );
}
