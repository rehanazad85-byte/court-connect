import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MapPin, Phone, Globe, ArrowLeft } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { directoryVenues } from "@/lib/directory-venues";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/venues/$slug")({
  head: ({ params }) => {
    const venue = directoryVenues.find((v) => v.id === params.slug);
    if (!venue) return { meta: [{ title: `Venue Not Found — ${SITE_NAME}` }] };
    const title = `${venue.name} | ${venue.city} | ${SITE_NAME}`;
    const description = `View venue details, facilities, location and contact information for ${venue.name} on ${SITE_NAME}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: `${SITE_URL}/venues/${params.slug}` },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/venues/${params.slug}` }],
    };
  },
  loader: ({ params }) => {
    const venue = directoryVenues.find((v) => v.id === params.slug);
    if (!venue) throw notFound();
    return venue;
  },
  notFoundComponent: () => (
    <PhoneShell>
      <div className="px-5 pt-20 text-center">
        <h1 className="text-xl font-bold">Venue not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This venue profile doesn't exist or has been removed.
        </p>
        <Link
          to="/venues/"
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Back to directory
        </Link>
      </div>
    </PhoneShell>
  ),
  component: VenueProfilePage,
});

function VenueProfilePage() {
  const venue = Route.useLoaderData();

 const claimHref = `/claim-venue?venue=${encodeURIComponent(venue.name)}`;
  return (
    <PhoneShell>
      <div className="px-5 pt-6 pb-4">
        <Link
          to="/venues/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Venue Directory
        </Link>

        <div className="mt-4">
          <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            {venue.sportLabel}
          </span>
          <h1 className="mt-2 text-2xl font-bold leading-tight">{venue.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{venue.city}</p>
        </div>
      </div>

      <div className="px-5 pb-10 space-y-4">
        <div className="rounded-2xl bg-card p-4 shadow-soft">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {venue.description}
          </p>

          <div className="mt-4 h-px bg-border" />

          <div className="mt-4 space-y-3">
            <div className="flex items-start gap-3 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{venue.address}</span>
            </div>
            {venue.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a
                  href={`tel:${venue.phone.replace(/\s/g, "")}`}
                  className="font-medium text-primary"
                >
                  {venue.phone}
                </a>
              </div>
            )}
            {venue.website && (
              <div className="flex items-center gap-3 text-sm">
                <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a
                  href={venue.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate font-medium text-primary"
                >
                  {venue.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-dashed bg-muted/40 px-4 py-3 text-[11px] text-muted-foreground">
          This venue is not yet bookable through Nock Sports. Information is
          sourced from publicly available data.
        </div>

        <a
          href={claimHref}
          className="flex h-12 w-full items-center justify-center rounded-xl border-2 border-primary text-sm font-bold text-primary transition active:scale-[.99]"
        >
          Claim this venue →
        </a>
      </div>
    </PhoneShell>
  );
}
