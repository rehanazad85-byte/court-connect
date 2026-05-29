import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  durationMin: number,
) {
  return pricing.find(
    (p) => p.day_of_week === dow && startMin >= p.start_min && startMin + durationMin <= p.end_min,
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
    const sb = supabaseAdmin;
    const [y, m, d] = data.dateISO.split("-").map(Number);
    const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
    const dow = dayStart.getUTCDay();

    const [{ data: venue }, { data: resources }, { data: hours }, { data: pricing }, { data: blackouts }] =
      await Promise.all([
        sb.from("venues").select("id").eq("id", data.venueId).eq("is_published", true).maybeSingle(),
        sb.from("resources").select("id, name").eq("venue_id", data.venueId).eq("is_active", true).order("sort_order"),
        sb.from("opening_hours").select("day_of_week, open_min, close_min").eq("venue_id", data.venueId).eq("day_of_week", dow),
        sb.from("pricing_rules").select("day_of_week, start_min, end_min, price_per_hour_pence, slot_step_min, min_duration_min").eq("venue_id", data.venueId).eq("day_of_week", dow),
        sb.from("blackouts").select("resource_id, starts_at, ends_at").eq("venue_id", data.venueId).lt("starts_at", dayEnd.toISOString()).gt("ends_at", dayStart.toISOString()),
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
      .lt("starts_at", dayEnd.toISOString())
      .gt("ends_at", dayStart.toISOString());

    const validSteps = (pricing ?? []).map((p) => p.slot_step_min).filter((n) => Number.isFinite(n) && n > 0);
    const step = validSteps.length > 0 ? Math.min(...validSteps) : 30;
    const slots: { time: string; startMin: number; pricePence: number; availableResourceIds: string[] }[] = [];
    const nowMs = Date.now();

    for (let startMin = open.open_min; startMin + data.durationMin <= open.close_min; startMin += step) {
      const rule = pricingFor(pricing ?? [], dow, startMin, data.durationMin);
      if (!rule) continue;
      if (data.durationMin < rule.min_duration_min) continue;

      const slotStart = new Date(Date.UTC(y, m - 1, d, 0, startMin, 0)).getTime();
      if (slotStart <= nowMs) continue;
      const slotEnd = slotStart + data.durationMin * 60_000;

      const available = resources.filter((r) => {
        const conflictBooking = (bookings ?? []).some(
          (b) =>
            (b.status === "confirmed" || b.status === "pending") &&
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
      .select("id, reference, status, starts_at, ends_at, players, total_pence, service_fee_pence, venue_id, venues(name, cover_image, city, address)")
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

    // Pricing
    const { data: pricing, error: pe } = await supabase
      .from("pricing_rules")
      .select("day_of_week, start_min, end_min, price_per_hour_pence, min_duration_min")
      .eq("venue_id", data.venueId);
    if (pe) throw new Error(pe.message);
    const rule = (pricing ?? []).find(
      (p) => p.day_of_week === dow && startMin >= p.start_min && startMin < p.end_min,
    );
    if (!rule) return { ok: false as const, reason: "No pricing for selected time" };
    if (data.durationMin < rule.min_duration_min) return { ok: false as const, reason: "Slot too short" };

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
        (b) => b.status === "confirmed" && b.resource_id === r.id &&
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
