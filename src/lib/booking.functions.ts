import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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
  .inputValidator((input: { activity?: string } | undefined) =>
    z.object({ activity: z.string().min(1).max(40).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const sb = publicSupabase();
    let q = sb
      .from("venues")
      .select("id, slug, name, activity, type, city, cover_image, description")
      .eq("is_published", true)
      .order("created_at", { ascending: false });
    if (data.activity) q = q.eq("activity", data.activity);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Attach resource counts + price-from for each venue (small N is fine for MVP)
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

// ---------- Availability ----------

function minsOfDay(d: Date) {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function pricingFor(
  pricing: { day_of_week: number; start_min: number; end_min: number; price_per_hour_pence: number; slot_step_min: number; min_duration_min: number }[],
  dow: number,
  startMin: number,
) {
  return pricing.find(
    (p) => p.day_of_week === dow && startMin >= p.start_min && startMin < p.end_min,
  );
}

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
    // Day window in UTC (simple MVP — venue-local TZ is a future iteration)
    const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
    const dow = dayStart.getUTCDay();

    const [{ data: resources }, { data: hours }, { data: pricing }, { data: bookings }, { data: blackouts }] =
      await Promise.all([
        sb.from("resources").select("id, name").eq("venue_id", data.venueId).eq("is_active", true).order("sort_order"),
        sb.from("opening_hours").select("day_of_week, open_min, close_min").eq("venue_id", data.venueId).eq("day_of_week", dow),
        sb.from("pricing_rules").select("day_of_week, start_min, end_min, price_per_hour_pence, slot_step_min, min_duration_min").eq("venue_id", data.venueId).eq("day_of_week", dow),
        sb.from("booking_resources").select("resource_id, starts_at, ends_at, status").gte("starts_at", dayStart.toISOString()).lte("ends_at", dayEnd.toISOString()),
        sb.from("blackouts").select("resource_id, starts_at, ends_at").eq("venue_id", data.venueId).gte("starts_at", dayStart.toISOString()).lte("ends_at", dayEnd.toISOString()),
      ]);

    const open = hours?.[0];
    if (!open || !resources || resources.length === 0) {
      return { slots: [], resources: resources ?? [] };
    }

    // Use the first matching pricing rule's slot_step for the day, or default 30.
    const step = pricing?.[0]?.slot_step_min ?? 30;
    const slots: { time: string; startMin: number; pricePence: number; availableResourceIds: string[] }[] = [];

    for (let startMin = open.open_min; startMin + data.durationMin <= open.close_min; startMin += step) {
      const rule = pricingFor(pricing ?? [], dow, startMin);
      if (!rule) continue;
      if (data.durationMin < rule.min_duration_min) continue;

      const slotStart = new Date(Date.UTC(y, m - 1, d, 0, startMin, 0)).getTime();
      const slotEnd = slotStart + data.durationMin * 60_000;

      const available = resources.filter((r) => {
        const conflictBooking = (bookings ?? []).some(
          (b) =>
            b.status === "confirmed" &&
            b.resource_id === r.id &&
            new Date(b.starts_at).getTime() < slotEnd &&
            new Date(b.ends_at).getTime() > slotStart,
        );
        if (conflictBooking) return false;
        const conflictBlackout = (blackouts ?? []).some(
          (bo) =>
            (bo.resource_id === null || bo.resource_id === r.id) &&
            new Date(bo.starts_at).getTime() < slotEnd &&
            new Date(bo.ends_at).getTime() > slotStart,
        );
        return !conflictBlackout;
      });

      const hh = String(Math.floor(startMin / 60)).padStart(2, "0");
      const mm = String(startMin % 60).padStart(2, "0");
      const pricePence = Math.round((rule.price_per_hour_pence * data.durationMin) / 60);
      slots.push({
        time: `${hh}:${mm}`,
        startMin,
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
    const rule = (pricing ?? []).find(
      (p) => p.day_of_week === dow && startMin >= p.start_min && startMin < p.end_min,
    );
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
    const end = new Date(start.getTime() + data.durationMin * 60_000);

    // Recompute price server-side
    const { data: pricing, error: pe } = await supabase
      .from("pricing_rules")
      .select("day_of_week, start_min, end_min, price_per_hour_pence")
      .eq("venue_id", data.venueId);
    if (pe) throw new Error(pe.message);

    const dow = start.getUTCDay();
    const startMin = minsOfDay(start);
    const rule = (pricing ?? []).find(
      (p) => p.day_of_week === dow && startMin >= p.start_min && startMin < p.end_min,
    );
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
      // Surface friendly capacity message
      throw new Error(error.message);
    }
    const row = Array.isArray(rpc) ? rpc[0] : rpc;
    return { id: row?.id as string, reference: row?.reference as string, totalPence: total };
  });

export const myBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("bookings")
      .select("id, status, starts_at, ends_at, players, total_pence, reference, venues(id, name, cover_image, type)")
      .eq("user_id", userId)
      .order("starts_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { bookings: data ?? [] };
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing, error: se } = await supabase
      .from("bookings")
      .select("id, starts_at, user_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (se) throw new Error(se.message);
    if (!existing || existing.user_id !== userId) throw new Error("Booking not found");
    if (existing.status === "cancelled") return { ok: true };
    if (new Date(existing.starts_at).getTime() - Date.now() < 60 * 60 * 1000) {
      throw new Error("Cannot cancel within 1 hour of start");
    }
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabase.from("booking_resources").update({ status: "cancelled" }).eq("booking_id", data.id);
    return { ok: true };
  });
