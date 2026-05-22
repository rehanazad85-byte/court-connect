import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { TopBar } from "@/components/TopBar";
import { getAvailability } from "@/lib/booking.functions";
import { bookingStore, useBooking } from "@/lib/booking-store";
import { formatPence } from "@/lib/mock-data";

export const Route = createFileRoute("/venue/$venueId/courts")({
  head: () => ({ meta: [{ title: "Select court — Knox" }] }),
  component: CourtsPage,
});

function CourtsPage() {
  const { venueId } = Route.useParams();
  const booking = useBooking();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>(booking.resourceIds);

  const availabilityQuery = useQuery({
    queryKey: ["availability", venueId, booking.dateISO, booking.durationMin],
    queryFn: () => getAvailability({ data: { venueId, dateISO: booking.dateISO!, durationMin: booking.durationMin } }),
    enabled: !!booking.dateISO && !!booking.time,
  });

  const slot = availabilityQuery.data?.slots.find((s) => s.time === booking.time);
  const availableIds = new Set(slot?.availableResourceIds ?? []);
  const resources = availabilityQuery.data?.resources ?? [];
  const perCourtPence = slot?.pricePence ?? 0;
  const totalPence = perCourtPence * selected.length;

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const cont = () => {
    if (selected.length === 0) return;
    const labels = resources.filter((r) => selected.includes(r.id)).map((r) => r.name);
    bookingStore.set({ resourceIds: selected, resourceLabels: labels, pricePerCourtPence: perCourtPence });
    navigate({ to: "/summary" });
  };

  return (
    <PhoneShell>
      <TopBar title={booking.venueName ?? "Courts"} subtitle={`${booking.dateLabel} · ${booking.time}`} back={`/venue/${venueId}`} right="filters" />

      <div className="px-5">
        <h2 className="text-lg font-bold">Select Court</h2>
        <p className="text-xs text-muted-foreground">Choose one or more</p>
      </div>

      <div className="space-y-2.5 px-5 pt-4 pb-40">
        {availabilityQuery.isLoading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}
        {resources.length === 0 && !availabilityQuery.isLoading && (
          <p className="text-sm text-muted-foreground">No courts at this venue.</p>
        )}
        {resources.map((c) => {
          const isAvail = availableIds.has(c.id);
          const isSel = selected.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => isAvail && toggle(c.id)}
              disabled={!isAvail}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${!isAvail ? "border-border bg-muted opacity-60" : isSel ? "border-primary bg-accent" : "border-border bg-card"}`}
            >
              <div className="grid h-12 w-12 shrink-0 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-md bg-primary/15 p-1">
                {[0,1,2,3].map((i) => <div key={i} className="bg-primary/30" />)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground">{isAvail ? "Available" : "Booked"}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-primary">{formatPence(perCourtPence)}</div>
              </div>
              <div className={`flex h-5 w-5 items-center justify-center rounded-md border ${isSel ? "border-primary bg-primary" : "border-border bg-background"}`}>
                {isSel && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-[60px] border-t bg-card/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <div>
            <div className="text-sm font-semibold">{selected.length} {selected.length === 1 ? "Court" : "Courts"} Selected</div>
            <div className="text-xs text-muted-foreground">{formatPence(totalPence)}</div>
          </div>
          <button
            onClick={cont}
            disabled={selected.length === 0}
            className={`rounded-xl px-6 py-3 text-sm font-semibold transition ${selected.length === 0 ? "pointer-events-none bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}
          >
            Continue
          </button>
        </div>
      </div>
    </PhoneShell>
  );
}
