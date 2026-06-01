import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Calendar } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { TopBar } from "@/components/TopBar";
import { getVenueDetails, getAvailability } from "@/lib/booking.functions";
import { ACTIVITY_LABELS } from "@/lib/mock-data";
import { bookingStore } from "@/lib/booking-store";
import { nextDays } from "@/lib/date-utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ContinueDebug = {
  clickFired: boolean;
  authenticated: boolean | null;
  payload: Record<string, unknown> | null;
  error: string | null;
};

const initialContinueDebug: ContinueDebug = {
  clickFired: false,
  authenticated: null,
  payload: null,
  error: null,
};

const venueQuery = (venueId: string) =>
  queryOptions({
    queryKey: ["venue", venueId],
    queryFn: () => getVenueDetails({ data: { venueId } }),
  });

const venueSearchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  players: z.number().int().min(1).max(64).optional(),
  city: z.string().min(1).max(80).optional(),
});

export const Route = createFileRoute("/venue/$venueId")({
  validateSearch: venueSearchSchema,
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
  const { date: prefilledDate, players: prefilledPlayers, city } = Route.useSearch();
  const { data } = useSuspenseQuery(venueQuery(venueId));
  const venue = data.venue;
  const navigate = useNavigate();

  const days = useMemo(() => nextDays(14), []);
  const initialDate = prefilledDate && days.some((d) => d.iso === prefilledDate) ? prefilledDate : days[0].iso;
  const [dateISO, setDateISO] = useState<string>(initialDate);
  const [time, setTime] = useState<string | null>(null);
  const [durationMin, setDurationMin] = useState(60);
  const [players] = useState<number>(prefilledPlayers ?? 2);
  const [submitting, setSubmitting] = useState(false);
  const [debug, setDebug] = useState<ContinueDebug>(initialContinueDebug);
  const backSearch = { city, date: dateISO, players };

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
  const canContinue = time !== null && !submitting;

  const goNext = async () => {
    if (!time) return;
    setSubmitting(true);
    const slot = slots.find((s) => s.time === time);
    const payload = {
      venueId: venue.id,
      startsAt: `${dateISO}T${time}`,
      durationMin,
      availableResourceIds: slot?.availableResourceIds ?? [],
      players,
      pricePerResourcePence: slot?.pricePence ?? null,
    };
    setDebug({ ...initialContinueDebug, clickFired: true, payload });
    try {
      // Require auth before reserving; bounce to login otherwise.
      const { data: u } = await supabase.auth.getUser();
      setDebug((d) => ({ ...d, authenticated: !!u.user, payload: { ...payload, userId: u.user?.id ?? null } }));
      if (!slot || slot.availableResourceIds.length === 0) {
        const msg = "No resources are available for that time. Please choose another slot.";
        setDebug((d) => ({ ...d, error: msg }));
        toast.error(msg);
        return;
      }
      bookingStore.set({
        venueId: venue.id,
        venueName: venue.name,
        venueImage: venue.cover_image,
        dateISO, dateLabel: dayLabel, time, durationMin, players,
        resourceIds: [], resourceLabels: [],
        pricePerCourtPence: slots.find((s) => s.time === time)?.pricePence ?? null,
        searchActivity: venue.activity,
        searchCity: city ?? venue.city ?? null,
      });
      if (!u.user) {
        setDebug((d) => ({ ...d, error: "Not authenticated — redirecting to login." }));
        const qs = new URLSearchParams({ date: dateISO, players: String(players) });
        if (city) qs.set("city", city);
        navigate({ to: "/login", search: { redirect: `/venue/${venue.id}?${qs.toString()}` } });
        return;
      }
      navigate({ to: "/venue/$venueId/courts", params: { venueId: venue.id }, search: { city, date: dateISO, players } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Booking failed";
      setDebug((d) => ({ ...d, error: msg }));
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PhoneShell>
      <TopBar title={venue.name} subtitle={`${venue.type} · ${ACTIVITY_LABELS[venue.activity] ?? venue.activity}`} back={{ to: "/activity/$activity", params: { activity: venue.activity }, search: backSearch }} right="heart" />

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
          <div className="mt-4 rounded-2xl border border-dashed p-5 text-center">
            <p className="text-sm font-semibold">No slots available for this date/duration.</p>
            <p className="mt-1 text-xs text-muted-foreground">Try another date or duration for this venue.</p>
          </div>

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
        {debug.clickFired && (
          <div className="mt-4 rounded-2xl border border-dashed bg-muted/40 p-3 text-[11px] text-muted-foreground">
            <div className="font-bold text-foreground">Booking debug</div>
            <DebugLine label="Continue click fired" value={debug.clickFired ? "yes" : "no"} />
            <DebugLine label="Authenticated" value={debug.authenticated === null ? "checking" : debug.authenticated ? "yes" : "no"} />
            {debug.payload && <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-2">{JSON.stringify(debug.payload, null, 2)}</pre>}
            {debug.error && <div className="mt-2 font-semibold text-destructive">Error: {debug.error}</div>}
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
            {submitting ? "Booking…" : "Continue Booking"}
          </button>
        </div>
      </div>
    </PhoneShell>
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
