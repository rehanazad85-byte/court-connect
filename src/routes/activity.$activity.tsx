import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, MapPin } from "lucide-react";
import { useState } from "react";
import { PhoneShell } from "@/components/PhoneShell";
import { TopBar } from "@/components/TopBar";
import { venues, activities } from "@/lib/mock-data";
import { bookingStore } from "@/lib/booking-store";

export const Route = createFileRoute("/activity/$activity")({
  head: ({ params }) => ({
    meta: [
      { title: `${activities.find((a) => a.id === params.activity)?.name ?? "Venues"} near you — Knox` },
      { name: "description", content: "Browse venues, ratings, court type and hourly pricing." },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const { activity } = Route.useParams();
  const meta = activities.find((a) => a.id === activity) ?? activities[0];
  const [filter, setFilter] = useState<"all" | "Indoor" | "Outdoor">("all");

  const list = venues.filter((v) => v.activity === activity || activity === "padel");
  const filtered = filter === "all" ? list : list.filter((v) => v.type === filter);

  return (
    <PhoneShell>
      <TopBar title={meta.name} subtitle="Manchester, UK" right="filters" />

      <div className="flex gap-2 px-5 pb-3">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>All Venues</Chip>
        <Chip active={filter === "Indoor"} onClick={() => setFilter("Indoor")}>Indoor</Chip>
        <Chip active={filter === "Outdoor"} onClick={() => setFilter("Outdoor")}>Outdoor</Chip>
      </div>

      <div className="space-y-4 px-5 pb-6">
        {filtered.map((v) => (
          <Link
            key={v.id}
            to="/venue/$venueId"
            params={{ venueId: v.id }}
            onClick={() => bookingStore.set({ venueId: v.id })}
            className="block overflow-hidden rounded-2xl bg-card shadow-soft transition active:scale-[.99]"
          >
            <div className="relative">
              <img
                src={v.image}
                alt={v.name}
                width={800}
                height={600}
                loading="lazy"
                className="aspect-[16/10] w-full object-cover"
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-background/95 px-2.5 py-1 text-xs font-semibold shadow-soft">
                <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                {v.rating}
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-bold leading-tight">{v.name}</h3>
                <div className="shrink-0 text-xs text-muted-foreground">{v.distance}</div>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {v.type} · {v.courts} Courts
              </div>
              <div className="mt-2 text-sm font-semibold text-primary">
                £{v.priceLow}–£{v.priceHigh} <span className="font-medium text-muted-foreground">/ hour</span>
              </div>
            </div>
          </Link>
        ))}
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
