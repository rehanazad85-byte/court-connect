import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Calendar } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { TopBar } from "@/components/TopBar";
import { getVenueDetails, getAvailability } from "@/lib/booking.functions";
import { ACTIVITY_LABELS } from "@/lib/mock-data";
import { bookingStore } from "@/lib/booking-store";
import { nextDays } from "@/lib/date-utils";

const venueQuery = (venueId: string) =>
  queryOptions({
    queryKey: ["venue", venueId],
    queryFn: () => getVenueDetails({ data: { venueId } }),
  });

export const Route = createFileRoute("/venue/$venueId")({
  head: () => ({
    meta: [
      { title: "Select date & time — Knox" },
      { name: "description", content: "Pick your preferred date and time with real-time availability." },
    ],
  }),
  loader: ({ params, context }) => context.queryClient.ensureQueryData(venueQuery(params.venueId)),
  component: VenuePage,
});

function VenuePage() {
  const { venueId } = Route.useParams();
  const { data } = useSuspenseQuery(venueQuery(venueId));
  const venue = data.venue;
  const navigate = useNavigate();

  const days = useMemo(() => nextDays(14), []);
  const [dateISO, setDateISO] = useState<string>(days[0].iso);
  const [time, setTime] = useState<string | null>(null);
  const [durationMin, setDurationMin] = useState(60);

  const availabilityQuery = useQuery({
    queryKey: ["availability", venueId, dateISO, durationMin],
    queryFn: () => getAvailability({ data: { venueId, dateISO, durationMin } }),
    enabled: !!venue,
  });

  if (!venue) {
    return (
      <PhoneShell>
        <TopBar title="Venue" back="/" />
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">This venue isn't available.</div>
      </PhoneShell>
    );
  }

  const slots = availabilityQuery.data?.slots ?? [];
  const dayLabel = days.find((d) => d.iso === dateISO)?.label ?? "";

  const canContinue = time !== null;
  const goNext = () => {
    if (!time) return;
    bookingStore.set({
      venueId: venue.id,
      venueName: venue.name,
      venueImage: venue.cover_image,
      dateISO,
      dateLabel: dayLabel,
      time,
      durationMin,
      resourceIds: [],
      resourceLabels: [],
      pricePerCourtPence: slots.find((s) => s.time === time)?.pricePence ?? null,
    });
    navigate({ to: "/venue/$venueId/courts", params: { venueId: venue.id } });
  };

  return (
    <PhoneShell>
      <TopBar title={venue.name} subtitle={`${venue.type} · ${ACTIVITY_LABELS[venue.activity] ?? venue.activity}`} back="/" right="heart" />

      <div className="px-5">
        {venue.cover_image && (
          <img src={venue.cover_image} alt={venue.name} width={800} height={600} loading="eager" className="aspect-[16/10] w-full rounded-2xl object-cover" />
        )}
        {venue.description && <p className="mt-3 text-sm text-muted-foreground">{venue.description}</p>}
      </div>

      <div className="px-5 pt-6">
        <h2 className="text-base font-bold">Select Date</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {days.map((d) => {
            const active = dateISO === d.iso;
            return (
              <button
                key={d.iso}
                onClick={() => { setDateISO(d.iso); setTime(null); }}
                className={`flex w-[60px] shrink-0 flex-col items-center rounded-xl border py-2 text-[11px] font-semibold transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
              >
                <span className={active ? "opacity-80" : "text-muted-foreground"}>{d.dow}</span>
                <span className="text-lg font-bold leading-tight">{d.day}</span>
                <span className={active ? "opacity-80" : "text-muted-foreground"}>{d.mon}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 pt-5">
        <h2 className="text-base font-bold">Duration</h2>
        <div className="mt-3 flex gap-2">
          {[60, 90, 120].map((m) => (
            <button
              key={m}
              onClick={() => { setDurationMin(m); setTime(null); }}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${durationMin === m ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
            >
              {m === 60 ? "1 hour" : m === 90 ? "1.5 hours" : "2 hours"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pt-6 pb-32">
        <h2 className="text-base font-bold">Select Time</h2>
        {availabilityQuery.isLoading ? (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {Array.from({ length: 16 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : slots.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Closed on this date.</p>
        ) : (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {slots.map((s) => {
              const disabled = s.availableResourceIds.length === 0;
              const active = time === s.time;
              return (
                <button
                  key={s.time}
                  disabled={disabled}
                  onClick={() => setTime(s.time)}
                  className={`rounded-xl border py-2.5 text-sm font-semibold transition ${disabled ? "border-border bg-muted text-muted-foreground/50" : active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
                >
                  {s.time}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="sticky bottom-[60px] border-t bg-card/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-semibold leading-tight">{dayLabel}</div>
              <div className="text-xs text-muted-foreground">{time ?? "Select a time"}</div>
            </div>
          </div>
          <button
            onClick={goNext}
            disabled={!canContinue}
            className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${canContinue ? "bg-primary text-primary-foreground" : "pointer-events-none bg-muted text-muted-foreground"}`}
          >
            View Courts
          </button>
        </div>
      </div>
    </PhoneShell>
  );
}
