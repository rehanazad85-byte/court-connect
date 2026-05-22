import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, MapPin } from "lucide-react";
import { useState } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { PhoneShell } from "@/components/PhoneShell";
import { TopBar } from "@/components/TopBar";
import { activities, ACTIVITY_LABELS, formatPence } from "@/lib/mock-data";
import { listVenues } from "@/lib/booking.functions";

const venuesByActivityQuery = (activity: string) =>
  queryOptions({
    queryKey: ["venues", activity],
    queryFn: () => listVenues({ data: { activity } }),
  });

export const Route = createFileRoute("/activity/$activity")({
  head: ({ params }) => ({
    meta: [
      { title: `${ACTIVITY_LABELS[params.activity] ?? "Venues"} near you — Knox` },
      { name: "description", content: "Browse venues, type and hourly pricing." },
    ],
  }),
  loader: ({ params, context }) => context.queryClient.ensureQueryData(venuesByActivityQuery(params.activity)),
  component: ActivityPage,
});

function ActivityPage() {
  const { activity } = Route.useParams();
  const { data } = useSuspenseQuery(venuesByActivityQuery(activity));
  const meta = activities.find((a) => a.id === activity);
  const [filter, setFilter] = useState<"all" | "Indoor" | "Outdoor">("all");
  const filtered = filter === "all" ? data.venues : data.venues.filter((v) => v.type === filter);

  return (
    <PhoneShell>
      <TopBar title={meta?.name ?? ACTIVITY_LABELS[activity] ?? "Venues"} subtitle="Available now" right="filters" />

      <div className="flex gap-2 px-5 pb-3">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>All Venues</Chip>
        <Chip active={filter === "Indoor"} onClick={() => setFilter("Indoor")}>Indoor</Chip>
        <Chip active={filter === "Outdoor"} onClick={() => setFilter("Outdoor")}>Outdoor</Chip>
      </div>

      <div className="space-y-4 px-5 pb-6">
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">No {meta?.name ?? activity} venues yet.</p>
          </div>
        )}
        {filtered.map((v) => (
          <Link key={v.id} to="/venue/$venueId" params={{ venueId: v.id }} className="block overflow-hidden rounded-2xl bg-card shadow-soft transition active:scale-[.99]">
            <div className="relative">
              {v.cover_image && <img src={v.cover_image} alt={v.name} width={800} height={500} loading="lazy" className="aspect-[16/10] w-full object-cover" />}
              <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-background/95 px-2.5 py-1 text-xs font-semibold shadow-soft">
                <Star className="h-3.5 w-3.5 fill-primary text-primary" /> New
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-bold leading-tight">{v.name}</h3>
                <div className="shrink-0 text-xs text-muted-foreground">{v.city ?? ""}</div>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> {v.type} · {v.resourceCount} {v.resourceCount === 1 ? "court" : "courts"}
              </div>
              <div className="mt-2 text-sm font-semibold text-primary">
                From {formatPence(v.priceFromPence)} <span className="font-medium text-muted-foreground">/ hour</span>
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
    <button onClick={onClick} className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
      {children}
    </button>
  );
}
