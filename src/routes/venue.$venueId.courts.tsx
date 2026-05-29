import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { PhoneShell } from "@/components/PhoneShell";
import { TopBar } from "@/components/TopBar";
import { useBooking, bookingStore } from "@/lib/booking-store";
import { getAvailability } from "@/lib/booking.functions";

export const Route = createFileRoute("/venue/$venueId/courts")({
  validateSearch: z.object({
    city: z.string().min(1).max(80).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    players: z.number().int().min(1).max(64).optional(),
  }),
  component: ResourcePage,
});

function ResourcePage() {
  const { venueId } = Route.useParams();
  const { city, date, players } = Route.useSearch();
  const booking = useBooking();
  const navigate = useNavigate();

  const availability = useQuery({
    queryKey: ["availability", venueId, booking.dateISO, booking.durationMin],
    queryFn: () => getAvailability({ data: { venueId, dateISO: booking.dateISO!, durationMin: booking.durationMin } }),
    enabled: !!booking.dateISO && !!booking.time,
  });

  if (!booking.venueId || !booking.dateISO || !booking.time) {
    return (
      <PhoneShell>
        <TopBar title="Choose resource" back={{ to: "/venue/$venueId", params: { venueId }, search: { city, date, players } }} />
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">No booking in progress. Pick a time first.</div>
      </PhoneShell>
    );
  }

  const slot = availability.data?.slots.find((s) => s.time === booking.time);
  const availableIds = slot?.availableResourceIds ?? [];
  const resources = (availability.data?.resources ?? []).filter((r) => availableIds.includes(r.id));

  return (
    <PhoneShell>
      <TopBar title="Choose resource" subtitle={booking.venueName ?? undefined} back={{ to: "/venue/$venueId", params: { venueId }, search: { city, date: booking.dateISO, players: booking.players } }} />
      <div className="px-5 pt-4 pb-32">
        {availability.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />)}</div>
        ) : resources.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No resources available for this time.</div>
        ) : (
          <div className="space-y-2">
            {resources.map((r) => {
              const active = booking.resourceIds.includes(r.id);
              return (
                <button key={r.id} onClick={() => bookingStore.set({ resourceIds: [r.id], resourceLabels: [r.name], pricePerCourtPence: slot?.pricePence ?? booking.pricePerCourtPence })} className={`flex h-14 w-full items-center justify-between rounded-2xl border px-4 text-sm font-semibold ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
                  <span>{r.name}</span><span>{active ? "Selected" : "Available"}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="sticky bottom-[60px] border-t bg-card/95 backdrop-blur px-5 py-3">
        <button disabled={booking.resourceIds.length === 0} onClick={() => navigate({ to: "/summary" })} className="h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground">Continue to Summary</button>
      </div>
    </PhoneShell>
  );
}
