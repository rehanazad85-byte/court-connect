export const SITE_URL = "https://www.nocksports.co.uk";
export const SITE_NAME = "Nock Sports";

export const SITE_DESCRIPTION =
  "Book padel courts, snooker tables, pool tables, darts boards and more across the UK. Real-time availability, instant confirmation.";

export const SITE_KEYWORDS =
  "sports venue booking UK, padel court booking, snooker table booking, pool table booking, darts booking, book sports courts near me, sports venue hire";

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: "en-GB",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/activity/padel?city={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    address: {
      "@type": "PostalAddress",
      addressCountry: "GB",
    },
    areaServed: {
      "@type": "Country",
      name: "United Kingdom",
    },
  };
}

interface ActivityPageVenue {
  id: string;
  name: string;
  city?: string;
}

export function activityPageJsonLd(
  activity: string,
  activityLabel: string,
  venues: ActivityPageVenue[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Book ${activityLabel} Venues — ${SITE_NAME}`,
    url: `${SITE_URL}/activity/${activity}`,
    description: `Find and book ${activityLabel.toLowerCase()} venues across the UK. Instant confirmation, real-time availability.`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: venues.slice(0, 10).map((v, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "SportsActivityLocation",
          name: v.name,
          url: `${SITE_URL}/venue/${v.id}`,
          ...(v.city
            ? {
                address: {
                  "@type": "PostalAddress",
                  addressLocality: v.city,
                  addressCountry: "GB",
                },
              }
            : {}),
        },
      })),
    },
  };
}

interface VenueJsonLdInput {
  id: string;
  name: string;
  activity?: string | null;
  city?: string | null;
  description?: string | null;
  price_per_hour_pence?: number | null;
}

export function venueJsonLd(venue: VenueJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: venue.name,
    url: `${SITE_URL}/venue/${venue.id}`,
    description:
      venue.description ??
      `Book ${venue.activity ?? "sports"} at ${venue.name}${venue.city ? ` in ${venue.city}` : ""}.`,
    ...(venue.city
      ? {
          address: {
            "@type": "PostalAddress",
            addressLocality: venue.city,
            addressCountry: "GB",
          },
        }
      : {}),
    ...(venue.price_per_hour_pence
      ? { priceRange: `From £${Math.round(venue.price_per_hour_pence / 100)} per hour` }
      : {}),
    makesOffer: {
      "@type": "Offer",
      availability: "https://schema.org/InStock",
      availabilityStarts: new Date().toISOString().split("T")[0],
    },
  };
}

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
