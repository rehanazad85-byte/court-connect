import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { MapPin, ArrowLeft, Search, X } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { directoryVenues } from "@/lib/directory-venues";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/venues/")({
  head: () => ({
    meta: [
      { title: `Sports Venue Directory UK — ${SITE_NAME}` },
      {
        name: "description",
        content:
          "Browse sports venues across the UK — football pitches, padel courts, snooker clubs, darts lounges and more. Find contact details, addresses and facilities.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: `Sports Venue Directory UK — ${SITE_NAME}` },
      {
        property: "og:description",
        content:
          "Browse sports venues across the UK — football pitches, padel courts, snooker clubs, darts lounges and more.",
      },
      { property: "og:url", content: `${SITE_URL}/venues` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/venues` }],
  }),
  component: VenuesPage,
});

const ALL_SPORTS = "all";

function VenuesPage() {
  const [sportFilter, setSportFilter] = useState(ALL_SPORTS);
  const [cityQuery, setCityQuery] = useState("");

  const sportOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of directoryVenues) {
      if (!seen.has(v.sport)) seen.set(v.sport, v.sportLabel);
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, []);

  const filtered = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    return directoryVenues.filter((v) => {
      const sportMatch = sportFilter === ALL_SPORTS || v.sport === sportFilter;
      const cityMatch =
        !q ||
        v.city.toLowerCase().includes(q) ||
        v.address.toLowerCase().includes(q);
      return sportMatch && cityMatch;
    });
  }, [sportFilter, cityQuery]);

  const hasFilters = sportFilter !== ALL_SPORTS || cityQuery.trim() !== "";

  function clearFilters() {
    setSportFilter(ALL_SPORTS);
    setCityQuery("");
  }

  return (
    <PhoneShell>
      <div className="px-5 pt-6 pb-2">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to home
        </Link>
        <h1 className="text-2xl font-bold">Sports Venues</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A directory of sports venues across the UK.
        </p>
      </div>

      <div className="grid gap-3 px-5 pt-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search by city or location…"
            value={cityQuery}
            onChange={(e) => setCityQuery(e.target.value)}
            className="h-11 w-full rounded-xl border bg-card pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <select
          value={sportFilter}
          onChange={(e) => setSportFilter(e.target.value)}
          className="h-11 w-full rounded-xl border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        >
          <option value={ALL_SPORTS}>All sports</option>
          {sportOptions.map(([sport, label]) => (
            <option key={sport} value={sport}>{label}</option>
          ))}
        </select>
      </div>

      <div className="px-5 pt-3 pb-1 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "venue" : "venues"} found
        </p>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary"
          >
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 px-5 py-3 pb-8 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <p className="text-sm font-semibold">No venues match your search</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try a different sport or location.
            </p>
            <button
              onClick={clearFilters}
              className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
            >
              Clear filters
            </button>
          </div>
        ) : (
          filtered.map((venue) => <VenueCard key={venue.id} venue={venue} />)
        )}
      </div>
    </PhoneShell>
  );
}

function VenueCard({ venue }: { venue: (typeof directoryVenues)[number] }) {
  return (
    <Link
      to="/venues/$slug"
      params={{ slug: venue.id }}
      className="group flex min-h-44 flex-col justify-between rounded-2xl border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div>
        <div className="mb-3 flex items-start justify-between gap-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">{venue.sportLabel}</span>
          <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">Unclaimed</span>
        </div>
        <h2 className="text-base font-bold leading-snug group-hover:text-primary">{venue.name}</h2>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{venue.city}</span>
        </p>
      </div>
      <span className="mt-5 text-xs font-semibold text-primary">View venue →</span>
    </Link>
  );
}
