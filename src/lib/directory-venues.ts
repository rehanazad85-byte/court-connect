/**
 * Nock Sports — Venue Directory (Phase 1)
 *
 * Add venues here manually. Each entry will appear as a card on /venues.
 * Fields marked optional (?) can be left out if unknown.
 *
 * sport: use one of — football | padel | snooker | darts | tennis | pickleball | golf-sim | pool
 */

export interface DirectoryVenue {
  id: string;
  name: string;
  sport: string;
  sportLabel: string;
  city: string;
  address: string;
  phone?: string;
  website?: string;
  description: string;
}

export const directoryVenues: DirectoryVenue[] = [
  {
    id: "core-padel-tyseley",
    name: "Core Padel Tyseley",
    sport: "padel",
    sportLabel: "Padel Tennis",
    city: "Birmingham",
    address: "Hay Hall Business Park, Redfern Road, Tyseley, Birmingham B11 2BE",
    phone: "0121 820 8344",
    website: "https://corepadel.uk",
    description:
      "Indoor padel venue in Tyseley, Birmingham, offering padel courts, free parking, lockers, changing facilities and online court booking.",
  },
  {
    id: "edgbaston-priory-club",
    name: "Edgbaston Priory Club",
    sport: "padel",
    sportLabel: "Padel Tennis",
    city: "Birmingham",
    address: "Sir Harrys Road, Birmingham B15 2UZ",
    phone: "0121 440 2492",
    website: "https://edgbastonpriory.com",
    description:
      "Established Birmingham racquets club offering tennis, padel, squash, pickleball, fitness and social facilities.",
  },
  {
    id: "four-oaks-tennis-padel-club",
    name: "Four Oaks Tennis & Padel Club",
    sport: "padel",
    sportLabel: "Padel Tennis",
    city: "Sutton Coldfield",
    address: "28 Hartopp Road, Four Oaks, Sutton Coldfield B74 2QR",
    phone: "07947 752146",
    website: "https://clubspark.lta.org.uk/FourOaksTennisClub",
    description:
      "Friendly Sutton Coldfield tennis and padel club offering coaching, social play, teams and quality racquet sport facilities.",
  },
  {
    id: "cortesport-birmingham",
    name: "CorteSport",
    sport: "padel",
    sportLabel: "Padel Tennis",
    city: "Birmingham",
    address: "300 Redhill Road, Birmingham B38 9EL",
    phone: "07897940187",
    website: "https://cortesport.co.uk",
    description:
      "Birmingham padel venue offering court booking, social play and padel experiences for players of different levels.",
  },
  {
    id: "the-padel-loft-birmingham",
    name: "The Padel Loft",
    sport: "padel",
    sportLabel: "Padel Tennis",
    city: "Birmingham",
    address: "The Padel Loft, Aston, Carpark, 5 Holt Street, Birmingham B7 4BH",
    website: "https://www.thepadelloft.com",
    description:
      "Indoor padel venue in Birmingham offering court hire, coaching and social padel sessions.",
  },
  {
    id: "padel-inn",
    name: "Padel Inn",
    sport: "padel",
    sportLabel: "Padel Tennis",
    city: "Birmingham",
    address: "Units 13-15, The Great Bridge Centre Charles Street, Birmingham",
    phone: "0121 714 5543",
    website: "https://padel-inn.com/",
    description:
      "Padel venue offering court hire, coaching and social play sessions.",
  },
  {
    id: "harbour-padel-littlehampton",
    name: "Harbour Padel Littlehampton",
    sport: "padel",
    sportLabel: "Padel Tennis",
    city: "Littlehampton",
    address: "Arun Shipyard, Rope Walk, Littlehampton, BN17 5DH",
    phone: "07971843636",
    website: "https://harbourpadel.co.uk",
    description:
      "Indoor padel club in Littlehampton with two panoramic courts, social sessions, coaching and a growing local padel community.",
  },
  {
    id: "spot-on-snooker-club-sheffield",
    name: "Spot On Snooker Club",
    sport: "snooker",
    sportLabel: "Snooker",
    city: "Sheffield",
    address: "4-12 Langsett Road, Sheffield S6 2UA",
    phone: "0114 233 9609",
    website: "https://spotonsheffield.com",
    description:
      "Traditional Sheffield snooker, pool and darts club offering full-size and 3/4-size snooker tables, pool tables, leagues, competitions, food, drinks and live sports viewing.",
  },
  {
    id: "hotshots-snooker-club-tipton",
    name: "Hotshots Snooker Club",
    sport: "snooker",
    sportLabel: "Snooker",
    city: "Tipton",
    address: "Castle Works, Tipton, West Midlands DY4 8HJ",
    phone: "0121 522 3516",
    website: "https://www.facebook.com/hotshotssnookertipton",
    description:
      "Established snooker venue in Tipton offering multiple snooker tables, pool tables, darts facilities, league play, competitions and a sports bar atmosphere.",
  },
  {
    id: "atack-snooker-club-nuneaton",
    name: "Atack Snooker Club",
    sport: "snooker",
    sportLabel: "Snooker",
    city: "Nuneaton",
    address: "Regent Street, Nuneaton CV11 4BL",
    phone: "024 7638 5808",
    website: "https://www.facebook.com/AtackSnookerClub",
    description:
      "Popular snooker and pool club in Nuneaton offering full-size snooker tables, pool tables, league competition, practice facilities, refreshments and live sports viewing.",
  },
  {
    id: "snooks-snooker-pool-club-halesowen",
    name: "Snooks Snooker & Pool Club",
    sport: "snooker",
    sportLabel: "Snooker",
    city: "Halesowen",
    address: "Sydney House, 294D Long Lane, Halesowen B62 9JZ",
    phone: "0121 561 3481",
    website: "https://www.facebook.com/snooks.snooker",
    description:
      "Established Halesowen snooker and pool venue offering snooker tables, pool tables, league matches, tournaments, bar facilities and social play.",
  },
];
