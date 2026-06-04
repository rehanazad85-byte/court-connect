import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Public (anon) supabase client used inside server fns for unauthenticated reads.
// Built per-call to stay stateless across worker invocations.
function publicSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const SERVICE_FEE_RATE = 0.02;

// ---------- Public reads ----------

export const listVenues = createServerFn({ method: "GET" })
  .inputValidator((input: { activity?: string; city?: string } | undefined) =>
    z.object({
      activity: z.string().min(1).max(40).optional(),
      city: z.string().min(1).max(80).optional(),
    }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const sb = publicSupabase();
    let q = sb
      .from("venues")
      .select("id, slug, name, activity, type, city, cover_image, description")
      .eq("is_published", true)
      .order("created_at", { ascending: false });
    if (data.activity) q = q.eq("activity", data.activity);
    if (data.city) q = q.ilike("city", `%${data.city}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.id);
    if (ids.length === 0) return { venues: [] };

    const [{ data: rc }, { data: pr }] = await Promise.all([
      sb.from("resources").select("venue_id, id").in("venue_id", ids).eq("is_active", true),
      sb.from("pricing_rules").select("venue_id, price_per_hour_pence").in("venue_id", ids),
    ]);

    const countByVenue = new Map<string, number>();
    rc?.forEach((r) => countByVenue.set(r.venue_id, (countByVenue.get(r.venue_id) ?? 0) + 1));

    const priceByVenue = new Map<string, { min: number; max: number }>();
    pr?.forEach((p) => {
      const cur = priceByVenue.get(p.venue_id);
      const v = p.price_per_hour_pence;
      if (!cur) priceByVenue.set(p.venue_id, { min: v, max: v });
      else priceByVenue.set(p.venue_id, { min: Math.min(cur.min, v), max: Math.max(cur.max, v) });
    });

    return {
      venues: (rows ?? []).map((v) => ({
        ...v,
        resourceCount: countByVenue.get(v.id) ?? 0,
        priceFromPence: priceByVenue.get(v.id)?.min ?? null,
        priceToPence: priceByVenue.get(v.id)?.max ?? null,
      })),
    };
  });

export const getVenueDetails = createServerFn({ method: "GET" })
  .inputValidator((input: { venueId: string }) =>
    z.object({ venueId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const sb = publicSupabase();
    const { data: venue, error } = await sb
      .from("venues")
      .select("id, slug, name, activity, type, city, address, cover_image, description, is_published")
      .eq("id", data.venueId)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!venue) return { venue: null, resources: [], hours: [], pricing: [] };

    const [{ data: resources }, { data: hours }, { data: pricing }, { data: images }] =
      await Promise.all([
        sb.from("resources").select("id, name, kind, sort_order").eq("venue_id", venue.id).eq("is_active", true).order("sort_order"),
        sb.from("opening_hours").select("day_of_week, open_min, close_min").eq("venue_id", venue.id),
        sb.from("pricing_rules").select("day_of_week, start_min, end_min, price_per_hour_pence, min_duration_min, slot_step_min").eq("venue_id", venue.id),
        sb.from("venue_images").select("url").eq("venue_id", venue.id).order("sort_order"),
      ]);

    return {
      venue,
      resources: resources ?? [],
      hours: hours ?? [],
      pricing: pricing ?? [],
      images: images ?? [],
    };
  });

// ---------- Availability helpers ----------

/** Minutes of day from a UTC Date (0–1439). */
function minsOfDay(d: Date) {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

type PricingRow = {
  day_of_week: number;
  start_min: number;
  end_min: number;
  price_per_hour_pence: number;
  slot_step_min: number;
  min_duration_min: number;
};

/**
 * Find a pricing rule for a slot that may use a normalized startMin (>= 1440 for
 * overnight slots within getAvailability's loop).
 *
 * end_min of overnight rules is stored as raw minutes-past-midnight of the next day
 * (e.g. 120 for 02:00). We normalize it to end_min + 1440 when end_min < start_min.
 */
function pricingForNormalized(
  pricing: PricingRow[],
  dow: number,
  startMin: number,
  durationMin: number,
): PricingRow | undefined {
  return pricing.find((p) => {
    if (p.day_of_week !== dow) return false;
    const normEnd = p.end_min < p.start_min ? p.end_min + 1440 : p.end_min;
    return startMin >= p.start_min && startMin + durationMin <= normEnd;
  });
}

type PricingLookupRow = {
  day_of_week: number;
  start_min: number;
  end_min: number;
  price_per_hour_pence: number;
  min_duration_min?: number;
};

/**
 * Find a pricing rule from a real UTC booking start.
 * Handles both:
 *   - Normal slots: startMin is within the same day as dow.
 *   - Overnight slots: startMin is in the early hours of dow, but the pricing rule
 *     belongs to the PREVIOUS day (prevDow) with end_min > startMin (post-midnight close).
 *
 * Overnight rules may be stored in two forms:
 *   A) Raw:        start_min=1080, end_min=120   (end_min < start_min)
 *   B) Normalised: start_min=1080, end_min=1620  (end_min = raw_end + 1440, end_min > 1440)
 * Both are handled in the overnight fallback below.
 */
function findPricingRule(
  pricing: PricingLookupRow[],
  dow: number,
  startMin: number,
  durationMin: number,
): PricingLookupRow | undefined {
  // Direct same-day match (handles both normal and overnight rules within that day)
  const direct = pricing.find((p) => {
    if (p.day_of_week !== dow) return false;
    const normEnd = p.end_min < p.start_min ? p.end_min + 1440 : p.end_min;
    return startMin >= p.start_min && startMin + durationMin <= normEnd;
  });
  if (direct) return direct;

  // Overnight match: the booking's real UTC start (e.g. 00:30 on Friday, startMin=30)
  // belongs to the previous evening's session (e.g. Thursday 18:00–02:00).
  const prevDow = (dow + 6) % 7;
  return pricing.find((p) => {
    if (p.day_of_week !== prevDow) return false;
    // Form A: raw storage — end_min < start_min (e.g. start=1080, end=120)
    if (p.end_min < p.start_min) {
      return startMin + durationMin <= p.end_min;
    }
    // Form B: normalised storage — end_min > 1440 (e.g. start=1080, end=1620)
    // The real UTC startMin (e.g. 30) must be shifted +1440 to compare against
    // the normalised range (e.g. 1470 falls within 1080–1620).
    if (p.end_min > 1440) {
      const normStartMin = startMin + 1440;
      return normStartMin >= p.start_min && normStartMin + durationMin <= p.end_min;
    }
    return false;
  });
}

// ---------- Availability ----------

export const getAvailability = createServerFn({ method: "GET" })
  .inputValidator((input: { venueId: string; dateISO: string; durationMin: number }) =>
    z.object({
      venueId: z.string().uuid(),
      dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      durationMin: z.number().int().min(30).max(8 * 60),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const sb = publicSupabase();
    const [y, m, d] = data.dateISO.split("-").map(Number);
    const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    // Always query a 2-day window so overnight bookings/blackouts are captured.
    const queryEnd = new Date(Date.UTC(y, m - 1, d + 2, 0, 0, 0));
    const dow = dayStart.getUTCDay();

    // Determine if the requested date is today (UTC) for past-slot filtering.
    const nowMs = Date.now();
    const nowUtc = new Date(nowMs);
    const todayISO = `${nowUtc.getUTCFullYear()}-${String(nowUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(nowUtc.getUTCDate()).padStart(2, "0")}`;
    const isToday = data.dateISO === todayISO;

    const [{ data: venue }, { data: resources }, { data: hours }, { data: pricing }, { data: blackouts }] =
      await Promise.all([
        sb.from("venues").select("id").eq("id", data.venueId).eq("is_published", true).maybeSingle(),
        sb.from("resources").select("id, name").eq("venue_id", data.venueId).eq("is_active", true).order("sort_order"),
        sb.from("opening_hours").select("day_of_week, open_min, close_min").eq("venue_id", data.venueId).eq("day_of_week", dow),
        sb.from("pricing_rules").select("day_of_week, start_min, end_min, price_per_hour_pence, slot_step_min, min_duration_min").eq("venue_id", data.venueId).eq("day_of_week", dow),
        // Extended window covers overnight sessions that end on day+1
        sb.from("blackouts").select("resource_id, starts_at, ends_at").eq("venue_id", data.venueId).lt("starts_at", queryEnd.toISOString()).gt("ends_at", dayStart.toISOString()),
      ]);

    const open = hours?.[0];
    if (!venue || !open || !resources || resources.length === 0) {
      return { slots: [], resources: resources ?? [], reason: !venue ? "venue_unavailable" : !open ? "closed" : "no_resources" };
    }

    const resourceIds = resources.map((r) => r.id);
    const { data: bookings } = await sb
      .from("booking_resources")
      .select("resource_id, starts_at, ends_at, status")
      .in("resource_id", resourceIds)
      .in("status", ["confirmed", "pending"])
      // Extended window covers overnight bookings
      .lt("starts_at", queryEnd.toISOString())
      .gt("ends_at", dayStart.toISOString());

    // Overnight support: if close_min < open_min (e.g. open=1080, close=120)
    // the venue closes after midnight. Normalize close_min by adding 1440.
    const isOvernight = open.close_min < open.open_min;
    const closeMinNormalized = isOvernight ? open.close_min + 1440 : open.close_min;

    const validSteps = (pricing ?? []).map((p) => p.slot_step_min).filter((n) => Number.isFinite(n) && n > 0);
    const step = validSteps.length > 0 ? Math.min(...validSteps) : 30;

    const slots: {
      time: string;
      startMin: number;
      startsAtISO: string;
      pricePence: number;
      availableResourceIds: string[];
    }[] = [];

    for (let startMin = open.open_min; startMin + data.durationMin <= closeMinNormalized; startMin += step) {
      // Pricing lookup using normalized startMin (handles overnight slots >= 1440)
      const rule = pricingForNormalized(pricing ?? [], dow, startMin, data.durationMin);
      if (!rule) continue;
      if (data.durationMin < rule.min_duration_min) continue;

      // Compute the actual UTC ms for this slot start.
      // startMin may be >= 1440 for post-midnight overnight slots.
      const slotDayOffset = Math.floor(startMin / 1440);
      const slotTimeMin = startMin % 1440;
      const slotStartMs = new Date(Date.UTC(y, m - 1, d + slotDayOffset, 0, slotTimeMin, 0)).getTime();

      // Only hide past slots when the requested date is today (UTC).
      // For future dates every slot is in the future so no filtering needed.
      if (isToday && slotStartMs <= nowMs) continue;

      const slotEndMs = slotStartMs + data.durationMin * 60_000;

      const available = resources.filter((r) => {
        const conflictBooking = (bookings ?? []).some(
          (b) =>
            (b.status === "confirmed" || b.status === "pending") &&
            b.resource_id === r.id &&
            new Date(b.starts_at).getTime() < slotEndMs &&
            new Date(b.ends_at).getTime() > slotStartMs,
        );
        if (conflictBooking) return false;
        const conflictBlackout = (blackouts ?? []).some(
          (bo) =>
            (bo.resource_id === null || bo.resource_id === r.id) &&
            new Date(bo.starts_at).getTime() < slotEndMs &&
            new Date(bo.ends_at).getTime() > slotStartMs,
        );
        return !conflictBlackout;
      });

      const hh = String(Math.floor(slotTimeMin / 60)).padStart(2, "0");
      const mm = String(slotTimeMin % 60).padStart(2, "0");
      const pricePence = Math.round((rule.price_per_hour_pence * data.durationMin) / 60);
      slots.push({
        time: `${hh}:${mm}`,
        startMin,
        // Carry the exact UTC datetime so the client never has to re-derive it from
        // dateISO + time (which would be wrong for post-midnight overnight slots).
        startsAtISO: new Date(slotStartMs).toISOString(),
        pricePence,
        availableResourceIds: available.map((r) => r.id),
      });
    }

    return { slots, resources };
  });

// ---------- Quote ----------

export const quoteBooking = createServerFn({ method: "POST" })
  .inputValidator((input: { venueId: string; startsAtISO: string; durationMin: number; resourceIds: string[] }) =>
    z.object({
      venueId: z.string().uuid(),
      startsAtISO: z.string(),
      durationMin: z.number().int().min(30).max(8 * 60),
      resourceIds: z.array(z.string().uuid()).min(1).max(20),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const sb = publicSupabase();
    const { data: pricing, error } = await sb
      .from("pricing_rules")
      .select("day_of_week, start_min, end_min, price_per_hour_pence")
      .eq("venue_id", data.venueId);
    if (error) throw new Error(error.message);

    const start = new Date(data.startsAtISO);
    const dow = start.getUTCDay();
    const startMin = minsOfDay(start);
    const rule = findPricingRule(pricing ?? [], dow, startMin, data.durationMin);
    if (!rule) throw new Error("No pricing for selected time");

    const perCourtPence = Math.round((rule.price_per_hour_pence * data.durationMin) / 60);
    const subtotalPence = perCourtPence * data.resourceIds.length;
    const feePence = Math.round(subtotalPence * SERVICE_FEE_RATE);
    const totalPence = subtotalPence + feePence;
    return { perCourtPence, subtotalPence, feePence, totalPence };
  });

// ---------- Authenticated mutations ----------

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { venueId: string; startsAtISO: string; durationMin: number; resourceIds: string[]; players: number }) =>
    z.object({
      venueId: z.string().uuid(),
      startsAtISO: z.string(),
      durationMin: z.number().int().min(30).max(8 * 60),
      resourceIds: z.array(z.string().uuid()).min(1).max(20),
      players: z.number().int().min(1).max(64),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const start = new Date(data.startsAtISO);
    if (Number.isNaN(start.getTime())) throw new Error("Invalid booking start time");

    // Server-side guard: reject bookings in the past even if UI is manipulated.
    if (start.getTime() <= Date.now()) throw new Error("Cannot confirm a booking in the past");

    const end = new Date(start.getTime() + data.durationMin * 60_000);

    // Recompute price server-side
    const { data: pricing, error: pe } = await supabase
      .from("pricing_rules")
      .select("day_of_week, start_min, end_min, price_per_hour_pence")
      .eq("venue_id", data.venueId);
    if (pe) throw new Error(pe.message);

    const dow = start.getUTCDay();
    const startMin = minsOfDay(start);
    const endMin = startMin + data.durationMin;
    // findPricingRule handles both normal and overnight (post-midnight) slots.
    const rule = findPricingRule(pricing ?? [], dow, startMin, data.durationMin);
    // [TEMP LOG] overnight pricing diagnostic
    console.log("[createBooking] slot:", {
      startsAtISO: data.startsAtISO,
      dow,
      startMin,
      endMin,
      normStartMin: endMin > 1440 || startMin < 60 ? startMin + 1440 : startMin,
      durationMin: data.durationMin,
      pricingRules: (pricing ?? []).map((p) => ({ dow: p.day_of_week, start: p.start_min, end: p.end_min })),
      ruleFound: rule ? { dow: rule.day_of_week, start: rule.start_min, end: rule.end_min } : null,
    });
    if (!rule) throw new Error("No pricing for selected time");
    const subtotal = Math.round((rule.price_per_hour_pence * data.durationMin) / 60) * data.resourceIds.length;
    const fee = Math.round(subtotal * SERVICE_FEE_RATE);
    const total = subtotal + fee;

    const { data: rpc, error } = await supabase.rpc("create_booking", {
      _venue_id: data.venueId,
      _starts_at: start.toISOString(),
      _ends_at: end.toISOString(),
      _resource_ids: data.resourceIds,
      _players: data.players,
      _total_pence: total,
      _service_fee_pence: fee,
    });
    if (error) {
      throw new Error(error.message);
    }
    const row = Array.isArray(rpc) ? rpc[0] : rpc;
    if (!row?.id || !row?.reference) throw new Error("Booking was created but no confirmation reference was returned");
    return { id: row?.id as string, reference: row?.reference as string, totalPence: total };
  });

export const ensureCustomerAccountRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const typedClaims = claims as { email?: string; user_metadata?: { display_name?: string } };
    const email = typedClaims.email ?? null;
    const displayName = typedClaims.user_metadata?.display_name ?? email?.split("@")[0] ?? "Customer";

    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: userId, display_name: displayName }, { onConflict: "user_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const myBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("bookings")
      .select("id, status, starts_at, ends_at, players, total_pence, service_fee_pence, reference, venue_id, venues(id, name, cover_image, type, city, address, activity)")
      .eq("user_id", userId)
      .order("starts_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const bookings = data ?? [];
    const ids = bookings.map((b) => b.id);
    const resourcesByBooking = new Map<string, { name: string; kind: string }[]>();
    if (ids.length > 0) {
      const { data: brs } = await supabase
        .from("booking_resources")
        .select("booking_id, resources(name, kind)")
        .in("booking_id", ids);
      (brs ?? []).forEach((r: any) => {
        const list = resourcesByBooking.get(r.booking_id) ?? [];
        if (r.resources) list.push({ name: r.resources.name, kind: r.resources.kind });
        resourcesByBooking.set(r.booking_id, list);
      });
    }
    return {
      bookings: bookings.map((b) => ({ ...b, resources: resourcesByBooking.get(b.id) ?? [] })),
    };
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("cancel_booking", { _booking_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getBookingByReference = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) =>
    z.object({ reference: z.string().min(3).max(40) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id, reference, status, starts_at, ends_at, players, total_pence, service_fee_pence, venue_id, venues(name, cover_image, city, address, activity)")
      .eq("reference", data.reference)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!booking) return { booking: null, resources: [] };
    const { data: brs } = await supabase
      .from("booking_resources")
      .select("resource_id, resources(name)")
      .eq("booking_id", booking.id);
    return {
      booking,
      resources: (brs ?? []).map((r: any) => ({ id: r.resource_id, name: r.resources?.name as string })),
    };
  });

// ---------- Auto-assign + book in one call ----------

export const reserveAnyAvailable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { venueId: string; startsAtISO: string; durationMin: number; players: number }) =>
    z.object({
      venueId: z.string().uuid(),
      startsAtISO: z.string(),
      durationMin: z.number().int().min(30).max(8 * 60),
      players: z.number().int().min(1).max(64),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const start = new Date(data.startsAtISO);
    if (start.getTime() <= Date.now()) {
      return { ok: false as const, reason: "Cannot book a time in the past" };
    }
    const end = new Date(start.getTime() + data.durationMin * 60_000);
    const dow = start.getUTCDay();
    const startMin = minsOfDay(start);

    // Pricing — findPricingRule handles overnight sessions
    const { data: pricing, error: pe } = await supabase
      .from("pricing_rules")
      .select("day_of_week, start_min, end_min, price_per_hour_pence, min_duration_min")
      .eq("venue_id", data.venueId);
    if (pe) throw new Error(pe.message);
    const rule = findPricingRule(pricing ?? [], dow, startMin, data.durationMin);
    if (!rule) return { ok: false as const, reason: "No pricing for selected time" };
    if (rule.min_duration_min != null && data.durationMin < rule.min_duration_min) return { ok: false as const, reason: "Slot too short" };

    // Candidate resources + conflicts
    const [{ data: resources }, { data: existing }, { data: blackouts }] = await Promise.all([
      supabase.from("resources").select("id, name, sort_order").eq("venue_id", data.venueId).eq("is_active", true).order("sort_order"),
      supabase.from("booking_resources").select("resource_id, starts_at, ends_at, status").lt("starts_at", end.toISOString()).gt("ends_at", start.toISOString()),
      supabase.from("blackouts").select("resource_id, starts_at, ends_at").eq("venue_id", data.venueId).lt("starts_at", end.toISOString()).gt("ends_at", start.toISOString()),
    ]);
    if (!resources || resources.length === 0) {
      return { ok: false as const, reason: "This venue has no courts configured" };
    }

    const startMs = start.getTime();
    const endMs = end.getTime();
    const pick = resources.find((r) => {
      const busy = (existing ?? []).some(
        (b) => (b.status === "confirmed" || b.status === "pending") && b.resource_id === r.id &&
          new Date(b.starts_at).getTime() < endMs && new Date(b.ends_at).getTime() > startMs,
      );
      if (busy) return false;
      const blocked = (blackouts ?? []).some(
        (bo) => (bo.resource_id === null || bo.resource_id === r.id) &&
          new Date(bo.starts_at).getTime() < endMs && new Date(bo.ends_at).getTime() > startMs,
      );
      return !blocked;
    });

    if (!pick) return { ok: false as const, reason: "No courts available for that slot. Try another time." };

    const subtotal = Math.round((rule.price_per_hour_pence * data.durationMin) / 60);
    const fee = Math.round(subtotal * SERVICE_FEE_RATE);
    const total = subtotal + fee;

    const { data: rpc, error } = await supabase.rpc("create_booking", {
      _venue_id: data.venueId,
      _starts_at: start.toISOString(),
      _ends_at: end.toISOString(),
      _resource_ids: [pick.id],
      _players: data.players,
      _total_pence: total,
      _service_fee_pence: fee,
    });
    if (error) return { ok: false as const, reason: error.message };
    const row = Array.isArray(rpc) ? rpc[0] : rpc;
    return {
      ok: true as const,
      id: row?.id as string,
      reference: row?.reference as string,
      totalPence: total,
      resourceName: pick.name,
    };
  });
