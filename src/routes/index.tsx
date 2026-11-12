import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Menu, Search, MapPin, Calendar, Users, MessageCircle, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import heroImg from "@/assets/hero-padel.jpg";
import { PhoneShell } from "@/components/PhoneShell";
import { activities, formatPence, ACTIVITY_LABELS } from "@/lib/mock-data";
import { listVenues } from "@/lib/booking.functions";
import { resourceLabel } from "@/lib/resource-labels";
import { directoryVenues } from "@/lib/directory-venues";

const allVenuesQuery = queryOptions({
  queryKey: ["venues", "all"],
  queryFn: () => listVenues({ data: {} }),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NockSports — Book Padel, Snooker, Pool & More" },
      { name: "description", content: "Instant bookings, real-time availability. Play your game, your way." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(allVenuesQuery),
  component: Home,
});

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Home() {
  const { data } = useSuspenseQuery(allVenuesQuery);
  const featured = data.venues.slice(0, 6);

  return (
    <PhoneShell>
      <section className="relative overflow-hidden bg-ink text-ink-foreground">
        <img src={heroImg} alt="Padel player at sunset" width={1024} height={1280} className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/60 to-ink" />
        <div className="relative mx-auto max-w-6xl px-5 pt-5 pb-6 md:px-8 md:pt-8 md:pb-12">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <NockSportsMark />
              <span className="text-lg font-bold tracking-tight">NockSports</span>
            </div>
            <Link to="/profile" aria-label="Menu"><Menu className="h-6 w-6" /></Link>
            <Link to="/venues" className="text-xs font-semibold text-primary">Venue directory</Link>
          </div>

          <p className="mt-10 md:mt-16 text-[11px] font-semibold tracking-[0.2em] text-primary">PLAY MORE. BOOK EASY.</p>
          <h1 className="mt-2 text-[34px] md:text-5xl font-bold leading-[1.05]">Book Padel<br />Courts,<br />Snooker Tables<br />&amp; More</h1>
          <p className="mt-3 text-sm text-white/70">Instant bookings.<br />Real-time availability.<br />Play your game, your way.</p>

          <div className="md:flex md:justify-center"><SearchPanel /></div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-9 md:px-8 md:pt-12">
        <div className="mb-5 text-center">
          <h2 className="text-xl font-bold md:text-2xl">Find your next game</h2>
          <p className="mt-1 text-sm text-muted-foreground">Explore courts, tables and venues for your favourite sports.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {activities.map((a) => (
            <Link key={a.id} to="/activity/$activity" params={{ activity: a.id }} className="group relative isolate block aspect-[4/5] overflow-hidden rounded-2xl bg-ink shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:aspect-[4/4.5]">
              <img src={a.image} alt={a.name} width={600} height={750} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/5" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-white md:p-5">
                <h3 className="text-lg font-bold leading-tight md:text-xl">{a.name}</h3>
                <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-white/90 md:text-sm">Explore venues <span aria-hidden="true">→</span></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
        <h2 className="text-lg font-bold md:text-center">Featured venues</h2>
        {featured.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">No venues yet.</p>
            <Link to="/vendor" className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">List your venue</Link>
          </div>
        ) : (
          <div className={`mt-3 grid gap-4 ${featured.length === 1 ? "mx-auto max-w-sm" : featured.length === 2 ? "mx-auto max-w-3xl md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"}`}>
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
                    {ACTIVITY_LABELS[v.activity] ?? v.activity} · {v.type} · {v.resourceCount} {resourceLabel(v.activity, v.resourceCount).toLowerCase()}
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

      <section className="mx-auto max-w-6xl px-5 pb-12 md:px-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Explore more local venues</h2>
            <p className="mt-1 text-sm text-muted-foreground">Discover sports venues around the West Midlands. Listings marked unclaimed cannot yet be booked here.</p>
          </div>
          <Link to="/venues" className="text-sm font-semibold text-primary">View full directory →</Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {directoryVenues.filter((v) => ["Walsall", "Bloxwich", "Great Wyrley", "Willenhall", "West Bromwich", "Wolverhampton", "Dudley", "Birmingham"].includes(v.city)).slice(0, 9).map((venue) => {
            const activityImage = activities.find((a) => a.id === venue.sport)?.image;
            return (
              <Link key={venue.id} to="/venues/$slug" params={{ slug: venue.id }} className="overflow-hidden rounded-2xl border bg-card shadow-soft transition hover:shadow-md">
                <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                  {activityImage && <img src={activityImage} alt={`${venue.sportLabel} illustration — not a photo of ${venue.name}`} loading="lazy" className="h-full w-full object-cover" />}
                  <span className="absolute bottom-2 left-2 rounded-md bg-background/90 px-2 py-1 text-[10px] font-medium">Illustrative image</span>
                </div>
                <div className="p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="font-bold leading-snug">{venue.name}</h3>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">Unclaimed</span>
                  </div>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{venue.city} · {venue.sportLabel}</p>
                  <p className="mt-3 text-xs font-semibold text-primary">View details →</p>
                </div>
              </Link>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Directory listings are independent, not endorsements or booking partnerships. Venue owners can claim their profiles.</p>
      </section>
    </PhoneShell>
  );
}

function SearchPanel() {
  const navigate = useNavigate();
  const [activity, setActivity] = useState<string>("padel");
  const [city, setCity] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [players, setPlayers] = useState<number>(2);
  useEffect(() => {
    if (!date) setDate(todayISO());
  }, [date]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({
      to: "/activity/$activity",
      params: { activity },
      search: {
        city: city.trim() || undefined,
        date: date || undefined,
        players,
      },
    });
  };

  const activityLabel = ACTIVITY_LABELS[activity] ?? activity;

  return (
    <form onSubmit={onSubmit} className="mt-5 w-full max-w-xl rounded-2xl bg-card text-card-foreground shadow-pop">
      <FieldRow icon={MessageCircle} label="What are you looking for?" value={activityLabel}>
        <select
          aria-label="Activity"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          {activities.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </FieldRow>
      <FieldRow icon={MapPin} label="Location" value={city.trim() || "Anywhere"}>
        <input
          aria-label="Location"
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Anywhere"
          className="absolute inset-0 h-full w-full bg-transparent pl-12 pr-4 pt-5 text-sm font-semibold text-transparent caret-foreground outline-none placeholder:text-transparent"
        />
      </FieldRow>
      <FieldRow icon={Calendar} label="Date" value={date ? formatDateLabel(date) : "Any date"}>
        <input
          aria-label="Date"
          type="date"
          value={date}
          min={todayISO()}
          onChange={(e) => setDate(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </FieldRow>
      <FieldRow icon={Users} label="Players" value={`${players} ${players === 1 ? "Player" : "Players"}`}>
        <select
          aria-label="Players"
          value={players}
          onChange={(e) => setPlayers(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </FieldRow>
      <div className="p-2">
        <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition active:scale-[.98]">
          <Search className="h-4 w-4" /> Search
        </button>
      </div>
    </form>
  );
}

function FieldRow({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-semibold">{value}</div>
      </div>
      {children}
    </div>
  );
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatDateLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DOW_LABELS[dt.getUTCDay()]} ${dt.getUTCDate()} ${MON_LABELS[dt.getUTCMonth()]}`;
}

function NockSportsMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4v16M5 12l8-8M5 12l8 8" />
    </svg>
  );
}
