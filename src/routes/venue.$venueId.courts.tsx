import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { TopBar } from "@/components/TopBar";
import { getVenue, courts } from "@/lib/mock-data";
import { bookingStore, useBooking } from "@/lib/booking-store";

export const Route = createFileRoute("/venue/$venueId/courts")({
  head: ({ params }) => ({
    meta: [
      { title: `Select court — ${getVenue(params.venueId).name} | Knox` },
      { name: "description", content: "View all available courts for the selected time and choose one or more." },
    ],
  }),
  component: CourtsPage,
});

function CourtsPage() {
  const { venueId } = Route.useParams();
  const venue = getVenue(venueId);
  const booking = useBooking();
  const [filter, setFilter] = useState<"all" | "Indoor" | "Outdoor">("all");
  const [selected, setSelected] = useState<number[]>(booking.courtIds);

  const list = filter === "all" ? courts : courts.filter((c) => c.type === filter);
  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const totalPerHour = selected.length * 32;

  return (
    <PhoneShell>
      <TopBar title={venue.name} subtitle={`${booking.date} · ${booking.time}`} back={`/venue/${venueId}`} right="filters" />

      <div className="px-5">
        <h2 className="text-lg font-bold">Select Court</h2>
        <p className="text-xs text-muted-foreground">Choose one or more courts</p>

        <div className="mt-3 flex gap-2">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>All Courts</Chip>
          <Chip active={filter === "Indoor"} onClick={() => setFilter("Indoor")}>Indoor</Chip>
          <Chip active={filter === "Outdoor"} onClick={() => setFilter("Outdoor")}>Outdoor</Chip>
        </div>
      </div>

      <div className="space-y-2.5 px-5 pt-4 pb-40">
        {list.map((c) => {
          const isSel = selected.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                isSel ? "border-primary bg-accent" : "border-border bg-card"
              }`}
            >
              <div className="grid h-12 w-12 shrink-0 grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-md bg-primary/15 p-1">
                {[0,1,2,3].map((i) => <div key={i} className="bg-primary/30" />)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.type}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-primary">£{c.price} / hour</div>
              </div>
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                  isSel ? "border-primary bg-primary" : "border-border bg-background"
                }`}
              >
                {isSel && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-[60px] border-t bg-card/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <div>
            <div className="text-sm font-semibold">
              {selected.length} {selected.length === 1 ? "Court" : "Courts"} Selected
            </div>
            <div className="text-xs text-muted-foreground">£{totalPerHour} / hour</div>
          </div>
          <Link
            to="/summary"
            onClick={() => bookingStore.set({ courtIds: selected })}
            disabled={selected.length === 0}
            className={`rounded-xl px-6 py-3 text-sm font-semibold transition ${
              selected.length === 0
                ? "pointer-events-none bg-muted text-muted-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            Continue
          </Link>
        </div>
      </div>
    </PhoneShell>
  );
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
        active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
      }`}
    >
      {children}
    </button>
  );
}
