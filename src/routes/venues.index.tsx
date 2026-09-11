import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { MapPin, Phone, Globe, ArrowLeft, Search, X } from "lucide-react";
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

      <div className="px-5 pt-4 space-y-2">
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

      <div className="space-y-4 px-5 py-2 pb-6">
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
 const claimHref = `/claim-venue?venue=${encodeURIComponent(venue.name)}`;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold leading-tight">{venue.name}</h2>
          <span className="mt-1 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            {venue.sportLabel}
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{venue.description}</p>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{venue.address}</span>
        </div>
        {venue.phone && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <a href={`tel:${venue.phone.replace(/\s/g, "")}`} className="hover:text-foreground">
              {venue.phone}
            </a>
          </div>
        )}
        {venue.website && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Globe className="h-3.5 w-3.5 shrink-0" />
            <a
              href={venue.website}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate hover:text-foreground"
            >
              {venue.website.replace(/^https?:\/\//, "")}
            </a>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-dashed bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
        This venue is not yet bookable through Nock Sports.
      </div>

      <div className="mt-4 flex items-center justify-between">
        <a
          href={claimHref}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary"
        >
          Claim this venue
        </a>
        <Link
          to="/venues/$slug"
          params={{ slug: venue.id }}
          className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground transition active:scale-[.99]"
        >
          View venue →
        </Link>
      </div>
    </div>
  );
}
