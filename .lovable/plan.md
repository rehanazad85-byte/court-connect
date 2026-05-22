# Knox — Core Booking System (Stripe parked)

Goal: replace the mock flow with a real multi-vendor booking engine backed by Lovable Cloud. Payments stay stubbed; the "Pay" button just creates a `confirmed` booking for now and can later be swapped to "Pay with Stripe".

## 1. Database schema

All tables RLS-enabled. Roles live in a dedicated `user_roles` table (never on profiles) checked via a `SECURITY DEFINER` `has_role()` function.

```text
profiles            (user_id PK→auth.users, display_name, phone, avatar_url)
user_roles          (user_id, role: 'customer'|'vendor'|'admin')  UNIQUE(user_id, role)

venues              (id, vendor_id→auth.users, slug, name, activity,
                     type 'Indoor'|'Outdoor', address, city, lat, lng,
                     cover_image, description, is_published, created_at)
venue_images        (id, venue_id, url, sort_order)

resources           (id, venue_id, name, kind 'court'|'table'|'lane'|'sim',
                     is_active, sort_order)
                    -- one row per bookable unit (Court 1, Table 3…)

pricing_rules       (id, venue_id, day_of_week 0–6, start_min, end_min,
                     price_per_hour_pence, min_duration_min, slot_step_min)
                    -- peak/off-peak; lookups resolve by venue + dow + time

opening_hours       (id, venue_id, day_of_week, open_min, close_min)
blackouts           (id, venue_id, resource_id NULL, starts_at, ends_at, reason)
                    -- vendor closures / maintenance

bookings            (id, user_id, venue_id, status 'pending'|'confirmed'|'cancelled',
                     starts_at timestamptz, ends_at timestamptz,
                     players, total_pence, service_fee_pence,
                     reference text UNIQUE, created_at)
booking_resources   (booking_id, resource_id)  PK(booking_id, resource_id)
                    -- EXCLUDE constraint with tstzrange prevents double-booking
                    -- the same resource for overlapping time windows
```

Key integrity rules enforced in Postgres (not just the UI):
- `booking_resources` uses a GiST `EXCLUDE` constraint on `(resource_id WITH =, tstzrange(starts_at, ends_at) WITH &&)` joined to bookings, so two confirmed bookings can never overlap on the same court/table.
- A `create_booking(...)` SQL function does the whole thing in one transaction: validate opening hours + pricing + capacity, insert booking + resources, return reference. Capacity races become impossible.
- `handle_new_user()` trigger creates a `profiles` row + grants `'customer'` role on signup.

## 2. Auth & roles

- Email/password + Google sign-in (Lovable Cloud managed).
- Routes split into `_authenticated/` (customers must log in to book) and `_vendor/` (requires `vendor` role).
- `/login`, `/signup`, `/reset-password` public routes.

## 3. Booking engine (server-side)

TanStack server functions in `src/lib/booking.functions.ts`:
- `listVenues({ activity, city })` — public, reads published venues.
- `getVenue({ id })` — public; returns venue, images, resources, opening hours.
- `getAvailability({ venueId, date, durationMin })` — computes free slots from opening hours − blackouts − existing bookings, returns `{ time, availableResourceIds[] }[]`.
- `quote({ venueId, startsAt, durationMin, resourceIds[] })` — server-side price using `pricing_rules`. UI never trusts client-computed totals.
- `createBooking({ ... })` — auth-required; calls the `create_booking` SQL function; returns reference.
- `myBookings()` — auth-required; upcoming + past.
- `cancelBooking({ id })` — auth-required, owner only, ≥X hours before start.

## 4. Vendor rules & dashboard (`/vendor/*`)

Pages, all behind `vendor` role:
- `/vendor` — today's bookings, revenue this week, occupancy %.
- `/vendor/venues` — list + "Create venue".
- `/vendor/venues/$id` — edit details, images, publish toggle.
- `/vendor/venues/$id/resources` — add/rename/disable courts/tables.
- `/vendor/venues/$id/hours` — opening hours per day-of-week.
- `/vendor/venues/$id/pricing` — peak/off-peak pricing rules, min duration, slot step.
- `/vendor/venues/$id/blackouts` — block out maintenance windows.
- `/vendor/bookings` — incoming bookings, cancel/refund stub.

RLS: vendors can only read/write their own venues and the resources/pricing/bookings under them.

## 5. Customer flow — wired to real data

Existing screens get re-wired (no visual overhaul, just real data):
- Home → `listVenues` grouped by activity.
- `/activity/$activity` → real list, filter Indoor/Outdoor, distance hidden until geo is in scope.
- `/venue/$venueId` → real images, dates from today→+14, time slots come from `getAvailability` (greyed if `availableResourceIds` is empty).
- `/venue/$venueId/courts` → only shows resources actually free for the chosen slot.
- `/summary` → `quote()` for the total; "Pay" calls `createBooking` (status `confirmed`, payment marked `unpaid` — Stripe to be wired later).
- `/confirmation` → real booking reference from server.
- `/bookings` → `myBookings()` real data; cancel action.

## 6. Design polish (in same pass)

- Skeleton states for venue list, availability grid, summary.
- Empty states ("No slots left for this time — try another day").
- Error toasts on capacity collisions ("Just taken — pick another court").
- Login/signup screens match the dark hero + green accent system already in `styles.css`.
- Vendor dashboard uses the same tokens but a denser desktop layout (sidebar + cards) — mobile still works.

## 7. MVP roadmap & order of work

1. Migration: profiles, roles, venues, resources, pricing, hours, blackouts, bookings, booking_resources, EXCLUDE constraint, `create_booking()` function, `handle_new_user()` trigger, RLS policies. *(one migration call)*
2. Auth: email/password + Google, `/login`, `/signup`, `_authenticated` layout, header avatar/menu.
3. Seed: one demo vendor account + 2 venues + resources + pricing so the home page isn't empty.
4. Server functions for venues / availability / quote / bookings.
5. Re-wire customer routes to server functions; add skeletons + empty/error states.
6. Vendor dashboard (`_vendor` layout + the 7 pages above).
7. Admin panel (`_admin` layout): users, role grants, all venues, all bookings, force-cancel.
8. *(Later)* swap the stub "Pay" for Stripe Checkout.

## Technical notes

- All server functions live in `*.functions.ts` and use `requireSupabaseAuth` middleware where auth is needed; `attachSupabaseAuth` already in `src/start.ts` (verify).
- Capacity is enforced by the DB EXCLUDE constraint + the `create_booking` transaction — the UI's availability call is a hint, not the source of truth.
- Prices are always recomputed server-side from `pricing_rules`; the client only displays.
- This plan deliberately defers Stripe, geo/distance, reviews/ratings, vendor payouts, and notifications.

Reply with **approve** to start with step 1 (the migration), or tell me what to change.