# Stabilisation & Refactor Pass

Goal: clean up the MVP without adding new features. Each section below is scoped, low-risk, and verifiable in the preview.

## 1. Auth & session stability

- Centralise auth state in a single `useAuth()` hook backed by one `onAuthStateChange` listener (already in `__root.tsx`). Remove ad-hoc `supabase.auth.getUser()` calls scattered across routes.
- Replace `resolveLandingTarget` duplication in `login.tsx` and `__root.tsx` with one shared helper in `src/lib/auth-redirect.ts`.
- Drop the 15s timeout hack in `onGoogle`; rely on `lovable.auth.signInWithOAuth` result + a single inline `busy` state.
- Ensure `SIGNED_OUT` clears query cache (already done) and navigates to `/` to avoid stuck protected routes.
- Keep `PendingScreen` as the only loading fallback; add it to vendor child routes consistently.

## 2. Routing & navigation

- Introduce `src/routes/_authenticated.tsx` pathless layout for vendor routes; move `vendor.tsx` under it as `_authenticated/vendor.tsx`. Customer routes stay public.
- Delete the redundant `vendor.dashboard.tsx` / `vendor.venues.tsx` redirect stubs.
- Make `BottomNav` hide on vendor routes and vice-versa so flows don't bleed into each other.

## 3. Forms & inputs

- Add `src/components/form/NumberField.tsx` and `TimeField.tsx`: controlled string state internally, emit number on blur, allow empty while typing (fixes the "0 can't be deleted" bug everywhere).
- Use them in the venue create form and venue settings form.
- Add a shared `<FormField label helper>` wrapper so labels/helper text are consistent (e.g. "Venue Name" + helper).

## 4. Vendor dashboard structure

- Split `vendor.tsx` into:
  - `vendor/VendorShell.tsx` (tabs + layout)
  - `vendor/VenueList.tsx`
  - `vendor/VenueForm.tsx` (shared by create + edit)
  - `vendor/BookingsList.tsx`
- One server-fn module `vendor.functions.ts` already exists; keep as-is but consolidate `getVenueSettings`/`updateVenueSettings`/`createVenue` to share a `VenueInput` zod schema.

## 5. Booking flow simplification

- In the venue detail/date-time screen, replace the "View Courts" CTA with **"Continue Booking"**.
- On click, call a new server fn `reserveAnyResource({ venueId, startsAt, endsAt, players })` that:
  - lists active resources for the venue
  - checks `booking_resources` overlap server-side
  - picks the first free resource and calls `create_booking` RPC with it
  - returns `{ bookingId, reference }` or `{ unavailable: true }`
- On success: navigate straight to `/confirmation?ref=…`.
- On unavailable: inline message "No courts available for this slot — try another time."
- Remove the manual courts-picker route from the customer flow (keep file but redirect to detail for now to avoid breaking links).

## 6. Error handling & UX polish

- Audit every route loader: wrap server-fn calls so loaders never throw raw `Unauthorized` (return `{ error }` shape, render empty state).
- Confirm root `errorComponent` + `PendingScreen` cover every route; add `notFoundComponent` where missing.
- Tidy toast usage: one `toast.error(message)` helper that falls back to "Something went wrong".
- BottomNav: ensure safe-area padding + active state; verify on 390px viewport.

## 7. Cleanup

- Remove unused imports, dead `vendor.dashboard.tsx` / `vendor.venues.tsx` redirects, and duplicated slug/labelFor helpers (move to `src/lib/venue-utils.ts`).
- Run a typecheck pass via the build.

## Out of scope (explicitly not touched)

- Payments, real Stripe/Paddle wiring
- New marketplace features, search, filters
- Notifications/emails
- Schema changes beyond what's needed for `reserveAnyResource` (none expected — uses existing tables + RPC)

## Verification

- Sign in with Google as vendor → lands on `/vendor` without flicker.
- Sign out → lands on `/`, no 401s in console.
- Edit venue → number/time fields can be cleared and retyped.
- Customer picks date+time → "Continue Booking" → confirmation page with a court auto-assigned.
- Try same slot twice → second attempt shows "No courts available".

Approve and I'll execute the pass in that order.