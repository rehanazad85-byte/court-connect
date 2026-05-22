import { createFileRoute, Link } from "@tanstack/react-router";
import { Menu, Search, MapPin, Calendar, Users, MessageCircle, Star } from "lucide-react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import heroImg from "@/assets/hero-padel.jpg";
import { PhoneShell } from "@/components/PhoneShell";
import { activities, formatPence, ACTIVITY_LABELS } from "@/lib/mock-data";
import { listVenues } from "@/lib/booking.functions";

const allVenuesQuery = queryOptions({
  queryKey: ["venues", "all"],
  queryFn: () => listVenues({ data: {} }),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Knox — Book Padel, Snooker, Pool & More" },
      { name: "description", content: "Instant bookings, real-time availability. Play your game, your way." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(allVenuesQuery),
  component: Home,
});

function Home() {
  const { data } = useSuspenseQuery(allVenuesQuery);
  const featured = data.venues.slice(0, 6);

  return (
    <PhoneShell>
      <section className="relative overflow-hidden bg-ink text-ink-foreground">
        <img src={heroImg} alt="Padel player at sunset" width={1024} height={1280} className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/60 to-ink" />
        <div className="relative px-5 pt-5 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KnoxMark />
              <span className="text-lg font-bold tracking-tight">Knox</span>
            </div>
            <Link to="/profile" aria-label="Menu"><Menu className="h-6 w-6" /></Link>
          </div>

          <p className="mt-10 text-[11px] font-semibold tracking-[0.2em] text-primary">PLAY MORE. BOOK EASY.</p>
          <h1 className="mt-2 text-[34px] font-bold leading-[1.05]">Book Padel<br />Courts,<br />Snooker Tables<br />&amp; More</h1>
          <p className="mt-3 text-sm text-white/70">Instant bookings.<br />Real-time availability.<br />Play your game, your way.</p>

          <div className="mt-5 rounded-2xl bg-card text-card-foreground shadow-pop">
            <SearchRow icon={MessageCircle} label="What are you looking for?" value="Padel Tennis" />
            <SearchRow icon={MapPin} label="Location" value="Anywhere" />
            <SearchRow icon={Calendar} label="Date" value="This week" />
            <SearchRow icon={Users} label="Players" value="2 Players" />
            <div className="p-2">
              <Link to="/activity/$activity" params={{ activity: "padel" }} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition active:scale-[.98]">
                <Search className="h-4 w-4" /> Search
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Popular activities</h2>
        </div>
        <div className="mt-3 -mx-5 overflow-x-auto px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-3 pb-2">
            {activities.map((a) => (
              <Link key={a.id} to="/activity/$activity" params={{ activity: a.id }} className="group w-[110px] shrink-0">
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                  <img src={a.image} alt={a.name} width={600} height={600} loading="lazy" className="h-full w-full object-cover transition group-active:scale-95" />
                </div>
                <div className="mt-2 text-[13px] font-semibold leading-tight">{a.name}</div>
                <div className="text-[11px] text-muted-foreground">{a.tagline}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pt-6 pb-8">
        <h2 className="text-lg font-bold">Featured venues</h2>
        {featured.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">No venues yet.</p>
            <Link to="/vendor" className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">List your venue</Link>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            {featured.map((v) => (
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
                    <MapPin className="h-3.5 w-3.5" />
                    {ACTIVITY_LABELS[v.activity] ?? v.activity} · {v.type} · {v.resourceCount} {v.resourceCount === 1 ? "court" : "courts"}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-primary">
                    From {formatPence(v.priceFromPence)} <span className="font-medium text-muted-foreground">/ hour</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PhoneShell>
  );
}

function SearchRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function KnoxMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4v16M5 12l8-8M5 12l8 8" />
    </svg>
  );
}
