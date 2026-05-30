# Knox

Knox is a mobile-first marketplace for booking sports and activity venues (courts, tables, lanes, sim bays, boards). Customers find a venue, pick a time, and confirm a booking. Vendors list venues, configure resources, opening hours and pricing, and manage incoming bookings.

## Overview

### What Knox does
- Lets customers discover venues by activity, date, players and location.
- Computes real-time availability against opening hours, pricing rules, blackouts and existing bookings.
- Auto-assigns a free resource on booking to avoid double-booking.
- Gives vendors a dashboard to create venues, add resources, set hours and pricing, publish/unpublish and see bookings.

### Customer flow
`home → search/activity → venue → select date & time → resource auto-assigned → summary → confirm booking → /bookings`

### Vendor flow
`signup/login → claim vendor role → /vendor → create venue → add resources → set opening hours & pricing → publish → venue appears publicly → manage bookings`

## Technology stack

- **Frontend**: React 19, TanStack Router/Start v1 (file-based routing, SSR), TanStack Query, Tailwind CSS v4, shadcn/ui, Vite 7.
- **Backend**: TanStack Start server functions (`createServerFn`) running on Cloudflare Workers (`workerd`) with `nodejs_compat`. No standalone API server.
- **Database**: Postgres via Lovable Cloud (Supabase) with Row-Level Security.
- **Authentication**: Supabase Auth (email/password + Google OAuth) through the Lovable Cloud auth bridge. Sessions persisted in `localStorage`; bearer token attached to server-fn calls by `attachSupabaseAuth` middleware.

## Route structure

Customer-facing:
- `/` — Home with search (activity, date, players, location).
- `/activity/$activity` — Filtered venue results.
- `/venue/$venueId` — Venue detail, date/time picker, "Continue Booking".
- `/venue/$venueId/courts` — (Legacy) manual resource picker; flow now auto-assigns.
- `/summary` — Booking summary before confirm.
- `/confirmation` — Booking confirmation with reference.
- `/bookings` — Authenticated user's upcoming/past bookings.
- `/favorites` — Saved venues.
- `/profile` — Authenticated user profile.

Auth:
- `/login`, `/signup` — Email + Google sign-in.

Vendor:
- `/vendor` — Vendor shell: venues list, create venue, edit venue (hours/pricing/resources), bookings list, publish toggle.

System:
- `/api/public/*` — Reserved for webhooks/public APIs (none currently in use).

## Database architecture

- **profiles** — One row per auth user (`user_id`, `display_name`, `avatar_url`, `phone`). Created automatically by the `handle_new_user` trigger.
- **user_roles** — `(user_id, role)` with `role` enum `customer | vendor | admin`. Roles are stored separately from profiles to prevent privilege escalation. Checked via `has_role()` security-definer function.
- **venues** — Vendor-owned venue (`vendor_id`, `slug`, `name`, `activity`, `type` Indoor/Outdoor, `city`, `address`, `description`, `cover_image`, `is_published`).
- **resources** — Bookable units inside a venue (court/table/lane/sim/board) with `is_active` and `sort_order`.
- **opening_hours** — Per-`day_of_week` open/close in minutes from midnight (UTC).
- **pricing_rules** — Per-day price windows (`start_min`, `end_min`, `price_per_hour_pence`, `min_duration_min`, `slot_step_min`).
- **blackouts** — Venue- or resource-scoped time ranges that block bookings.
- **bookings** — Customer booking (`user_id`, `venue_id`, `starts_at`, `ends_at`, `players`, `total_pence`, `service_fee_pence`, `status`, `reference`).
- **booking_resources** — Join from a booking to one or more resources, with the same time range. Exclusion constraint prevents overlapping confirmed bookings on the same resource.
- **venue_images** — Additional gallery images per venue.

## Authentication and roles

- **customer** (default, assigned on signup): browse venues, create/view/cancel own bookings, manage own profile.
- **vendor** (granted via `claim_vendor_role` RPC when a user opens `/vendor`): everything a customer can do, plus create/update/delete own venues, manage own resources/hours/pricing/blackouts, and view bookings against own venues.
- **admin**: full access via `has_role(uid, 'admin')` checks embedded in RLS policies. Granted manually.

All access is enforced by Postgres RLS, not the client. Server functions use the user's bearer token so RLS applies as that user; an admin client (`client.server.ts`) is reserved for trusted server-side operations.

## Booking architecture

### Availability calculation
For a `(venueId, date, durationMin)`:
1. Look up `opening_hours` for the date's day-of-week.
2. Look up `pricing_rules` covering candidate start times (`start_min..end_min`, satisfying `min_duration_min`, stepping by `slot_step_min`).
3. List active `resources` for the venue.
4. Exclude any candidate slot that overlaps `blackouts` or existing confirmed `booking_resources` for every resource (a slot is available if ≥1 resource is free).
5. Return the list of selectable start times; empty state shown when none.

### Pricing calculation
`total_pence = price_per_hour_pence * (durationMin / 60) * resourceCount` plus optional `service_fee_pence`. The rule covering the start time wins.

### Booking creation
Handled by the `create_booking(_venue_id, _starts_at, _ends_at, _resource_ids, _players, _total_pence, _service_fee_pence)` SECURITY DEFINER RPC, which re-validates:
- Authenticated user; future time; valid range.
- Venue is published; resources belong to the venue and are active.
- Slot lies inside opening hours and a matching pricing rule.
- No overlapping blackout.
- Generates a human reference (`KX-XXXXXXXX`) and inserts into `bookings` + `booking_resources` atomically.

### Conflict prevention
`booking_resources` carries a Postgres exclusion constraint on `(resource_id, tstzrange(starts_at, ends_at))` for confirmed rows. Concurrent attempts to book the same resource/time raise `exclusion_violation`, which `create_booking` translates into a user-friendly "just booked — pick another slot" error. Cancellation is via `cancel_booking` RPC (customers ≥1h before start; vendors/admins anytime).

## Deployment

### Run locally
```bash
bun install
bun dev
```
The dev server runs Vite + the TanStack Start plugin and serves SSR through the local Worker runtime.

### Production
The app is deployed on Cloudflare Workers via Lovable. `wrangler.jsonc` declares the entry (`src/server.ts`) and `nodejs_compat`. The managed Postgres + Auth backend is provided by Lovable Cloud (Supabase) and is always-on; no separate deploy step is needed for backend logic since all server code ships inside the Worker bundle as TanStack server functions.

Preview URL: `https://id-preview--1c40e45e-e327-4fe5-89e0-bec8b5f1fea1.lovable.app`

## Environment variables

Managed automatically by Lovable Cloud in `.env` — do not edit by hand.

Client (Vite, build-time inlined):
- `VITE_SUPABASE_URL` — Backend project URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Anon/publishable key; safe in the browser, scoped by RLS.
- `VITE_SUPABASE_PROJECT_ID` — Project reference id.

Server (Worker runtime, never bundled to the client):
- `SUPABASE_URL` — Same backend URL, read inside server functions.
- `SUPABASE_PUBLISHABLE_KEY` — Used by the auth middleware to build an RLS-scoped client from the user's bearer token.
- `SUPABASE_SERVICE_ROLE_KEY` — Service-role key for `supabaseAdmin` (bypasses RLS). Only imported from `*.server.ts` modules.
- `SUPABASE_DB_URL` — Direct Postgres connection string for migrations/tooling.
- `LOVABLE_API_KEY` — Reserved for Lovable AI Gateway calls.
