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
import { BookingRouteErrorPanel, buildBookingDebugSnapshot, logBookingDebug } from "@/lib/booking-debug";

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
  errorComponent: ({ error, reset }) => (
    <div className="min-h-dvh bg-background p-8 text-center">
      <h1 className="text-lg font-bold">We couldn't load this venue</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</p>
      <div className="mt-6 flex justify-center gap-2">
        <button onClick={() => reset()} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Try again</button>
        <a href="/" className="rounded-full border px-5 py-2.5 text-sm font-semibold">Go home</a>
      </div>
      <BookingRouteErrorPanel component="VenueRoute.errorComponent" error={error} />
    </div>
  ),
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
  const backSearch = { city, date: dateISO, players };

  const availabilityQuery = useQuery({
    queryKey: ["availability", venueId, dateISO, durationMin],
    queryFn: () => getAvailability({ data: { venueId, dateISO, durationMin } }),
    enabled: !!venue,
    staleTime: 0,
    // Refetch every 60 s when viewing today so past slots disappear automatically.
    refetchInterval: dateISO === days[0]?.iso ? 60_000 : false,
  });

  if (!venue) {
    return (
      <PhoneShell>
        <TopBar title="Venue" back="/" />
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">This venue isn't available.</div>
      </PhoneShell>
    );
  }

  const rawSlots = availabilityQuery.data?.slots ?? [];

  // Client-side past-slot guard — safety net against stale cache and timezone skew.
  // The slot's `time` field ("HH:MM") represents the displayed venue-local time.
  // We compare it against the user's current local clock so that if the user sees
  // "13:00" it disappears the moment local time passes 13:00, regardless of UTC offset.
  const isDateToday = (() => {
    const u = new Date();
    const utcISO = `${u.getUTCFullYear()}-${String(u.getUTCMonth() + 1).padStart(2, "0")}-${String(u.getUTCDate()).padStart(2, "0")}`;
    return dateISO === utcISO;
  })();
  const slots = isDateToday
    ? rawSlots.filter((s) => {
        // Post-midnight overnight slots (startMin >= 1440) are on the next calendar
        // day — they are always in the future relative to today's viewing session.
        if (s.startMin >= 1440) return true;
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const [slotH, slotM] = s.time.split(":").map(Number);
        return slotH * 60 + slotM > nowMins;
      })
    : rawSlots;

  const dayLabel = days.find((d) => d.iso === dateISO)?.label ?? "";
  const canContinue = time !== null && !submitting;

  const goNext = async () => {
    if (!time) return;
    setSubmitting(true);
    const slot = slots.find((s) => s.time === time);
    const payload = {
      venueId: venue.id,
      // Use the server-authoritative startsAtISO when available (required for overnight slots)
      startsAt: slot?.startsAtISO ?? `${dateISO}T${time}`,
      durationMin,
      availableResourceIds: slot?.availableResourceIds ?? [],
      players,
      pricePerResourcePence: slot?.pricePence ?? null,
    };
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!slot || slot.availableResourceIds.length === 0) {
        const error = new Error("No resources are available for that time. Please choose another slot.");
        logBookingDebug(buildBookingDebugSnapshot({ component: "VenuePage.goNext", error, sessionIdPresent: !!u.user, createBookingCalled: false, payload }));
        toast.error(error.message);
        return;
      }
      const selectedResourceId = slot.availableResourceIds[0];
      const selectedResource = availabilityQuery.data?.resources.find((r) => r.id === selectedResourceId);
      bookingStore.set({
        venueId: venue.id,
        venueName: venue.name,
        venueImage: venue.cover_image,
        dateISO, dateLabel: dayLabel, time, durationMin, players,
        // startsAtISO from the server is the authoritative UTC datetime for this slot.
        // For overnight venues a "01:00" slot on Friday actually starts on Saturday
        // morning — combineISO(dateISO, time) would produce the wrong datetime.
        startsAtISO: slot.startsAtISO,
        resourceIds: [selectedResourceId], resourceLabels: [selectedResource?.name ?? "Court"],
        pricePerCourtPence: slot.pricePence,
        searchActivity: venue.activity,
        searchCity: city ?? venue.city ?? null,
      });
      if (!u.user) {
        logBookingDebug(buildBookingDebugSnapshot({ component: "VenuePage.goNext", error: new Error("Not authenticated — redirecting to login."), sessionIdPresent: false, createBookingCalled: false, payload }));
        const qs = new URLSearchParams({ date: dateISO, players: String(players) });
        if (city) qs.set("city", city);
        navigate({ to: "/login", search: { redirect: `/venue/${venue.id}?${qs.toString()}` } });
        return;
      }
      navigate({ to: "/summary" });
    } catch (e) {
      logBookingDebug(buildBookingDebugSnapshot({ component: "VenuePage.goNext", error: e, sessionIdPresent: null, createBookingCalled: false, payload }));
      toast.error(e instanceof Error ? e.message : "Booking failed");
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
              className={`min-h-[44px] rounded-full px-4 py-2 text-xs font-semibold transition ${durationMin === m ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
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
