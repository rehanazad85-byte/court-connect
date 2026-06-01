import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

// Grant the current user the 'vendor' role via SECURITY DEFINER RPC.
export const claimVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("claim_vendor_role");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getVenueSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { venueId: string }) =>
    z.object({ venueId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: v, error } = await supabase
      .from("venues")
      .select("id, name, activity, type, city, address, description, cover_image")
      .eq("id", data.venueId)
      .eq("vendor_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!v) throw new Error("Venue not found");
    const { data: oh } = await supabase
      .from("opening_hours")
      .select("open_min, close_min")
      .eq("venue_id", data.venueId)
      .order("day_of_week")
      .limit(1);
    const { data: pr } = await supabase
      .from("pricing_rules")
      .select("price_per_hour_pence")
      .eq("venue_id", data.venueId)
      .order("day_of_week")
      .limit(1);
    return {
      venue: v,
      openMin: oh?.[0]?.open_min ?? 420,
      closeMin: oh?.[0]?.close_min ?? 1320,
      pricePerHourPence: pr?.[0]?.price_per_hour_pence ?? 3000,
    };
  });

export const updateVenueSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    venueId: string; name: string; city?: string; description?: string; coverImage?: string;
    pricePerHourPence: number; openMin: number; closeMin: number;
  }) =>
    z.object({
      venueId: z.string().uuid(),
      name: z.string().min(1).max(120),
      city: z.string().max(80).optional(),
      description: z.string().max(2000).optional(),
      coverImage: z.string().url().max(500).optional().or(z.literal("")),
      pricePerHourPence: z.number().int().min(100).max(50000),
      openMin: z.number().int().min(0).max(1440),
      closeMin: z.number().int().min(0).max(1440),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.closeMin <= data.openMin) throw new Error("Closing must be after opening");
    const { data: venue, error: ve } = await supabase
      .from("venues")
      .update({
        name: data.name,
        city: data.city ?? null,
        description: data.description ?? null,
        cover_image: data.coverImage ? data.coverImage : null,
      })
      .eq("id", data.venueId)
      .eq("vendor_id", userId)
      .select("id")
      .single();
    if (ve) throw new Error(ve.message);
    if (!venue) throw new Error("Venue not found");

    await supabase.from("opening_hours").delete().eq("venue_id", data.venueId);
    await supabase.from("pricing_rules").delete().eq("venue_id", data.venueId);
    const hours = Array.from({ length: 7 }, (_, dow) => ({
      venue_id: data.venueId, day_of_week: dow, open_min: data.openMin, close_min: data.closeMin,
    }));
    const pricing = Array.from({ length: 7 }, (_, dow) => ({
      venue_id: data.venueId, day_of_week: dow, start_min: data.openMin, end_min: data.closeMin,
      price_per_hour_pence: data.pricePerHourPence, min_duration_min: 60, slot_step_min: 30,
    }));
    const { error: he } = await supabase.from("opening_hours").insert(hours);
    if (he) throw new Error(he.message);
    const { error: pe } = await supabase.from("pricing_rules").insert(pricing);
    if (pe) throw new Error(pe.message);
    return { ok: true };
  });

export const myRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { roles: (data ?? []).map((r) => r.role as string) };
  });

export const listMyVenues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("venues")
      .select("id, name, slug, activity, type, city, is_published, cover_image, created_at")
      .eq("vendor_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const venues = data ?? [];
    const ids = venues.map((v) => v.id);
    let countByVenue = new Map<string, number>();
    if (ids.length > 0) {
      const { data: rs } = await supabase
        .from("resources")
        .select("venue_id, id")
        .in("venue_id", ids)
        .eq("is_active", true);
      rs?.forEach((r) => countByVenue.set(r.venue_id, (countByVenue.get(r.venue_id) ?? 0) + 1));
    }
    return { venues: venues.map((v) => ({ ...v, resourceCount: countByVenue.get(v.id) ?? 0 })) };
  });

export const setVenuePublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { venueId: string; isPublished: boolean }) =>
    z.object({ venueId: z.string().uuid(), isPublished: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("venues")
      .update({ is_published: data.isPublished })
      .eq("id", data.venueId)
      .eq("vendor_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listVendorBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const errors: string[] = [];
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesError) errors.push(`user_roles: ${rolesError.message}`);

    const { data: walsallVenues, error: walsallError } = await supabase
      .from("venues")
      .select("id, name, vendor_id, is_published")
      .ilike("name", "%Walsall Padel%")
      .limit(5);
    if (walsallError) errors.push(`walsall lookup: ${walsallError.message}`);

    const { data: venues, error: venuesError } = await supabase
      .from("venues")
      .select("id, name")
      .eq("vendor_id", userId);
    if (venuesError) {
      errors.push(`venues: ${venuesError.message}`);
      return {
        bookings: [],
        venues: [],
        debug: {
          authenticatedUserId: userId,
          roles: (rolesData ?? []).map((r) => r.role as string),
          venueIds: [],
          bookingCount: 0,
          latestReferences: [],
          errors,
          walsallPadel: (walsallVenues ?? []).map((v) => ({
            ...v,
            ownedByCurrentUser: v.vendor_id === userId,
          })),
          query: "bookings.venue_id IN venue ids where venues.vendor_id = authenticated user id",
        },
      };
    }
    const ids = (venues ?? []).map((v) => v.id);
    if (ids.length === 0) return {
      bookings: [],
      venues: [],
      debug: {
        authenticatedUserId: userId,
        roles: (rolesData ?? []).map((r) => r.role as string),
        venueIds: [],
        bookingCount: 0,
        latestReferences: [],
        errors,
        walsallPadel: (walsallVenues ?? []).map((v) => ({
          ...v,
          ownedByCurrentUser: v.vendor_id === userId,
        })),
        query: "bookings.venue_id IN venue ids where venues.vendor_id = authenticated user id",
      },
    };
    const { data, error } = await supabase
      .from("bookings")
      .select("id, reference, status, starts_at, ends_at, players, total_pence, venue_id, user_id")
      .in("venue_id", ids)
      .order("starts_at", { ascending: false })
      .limit(300);
    if (error) {
      errors.push(`bookings: ${error.message}`);
      return {
        bookings: [],
        venues: venues ?? [],
        debug: {
          authenticatedUserId: userId,
          roles: (rolesData ?? []).map((r) => r.role as string),
          venueIds: ids,
          bookingCount: 0,
          latestReferences: [],
          errors,
          walsallPadel: (walsallVenues ?? []).map((v) => ({
            ...v,
            ownedByCurrentUser: v.vendor_id === userId,
          })),
          query: "bookings.venue_id IN venue ids where venues.vendor_id = authenticated user id",
        },
      };
    }
    const bookings = data ?? [];
    const bookingIds = bookings.map((b) => b.id);
    const userIds = Array.from(new Set(bookings.map((b) => b.user_id)));

    const [resRes, profRes] = await Promise.all([
      bookingIds.length
        ? supabase
            .from("booking_resources")
            .select("booking_id, resources(name, kind)")
            .in("booking_id", bookingIds)
        : Promise.resolve({ data: [] as any[] }),
      userIds.length
        ? supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", userIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    if ("error" in resRes && resRes.error) errors.push(`booking_resources: ${resRes.error.message}`);
    if ("error" in profRes && profRes.error) errors.push(`profiles: ${profRes.error.message}`);

    const resourcesByBooking = new Map<string, { name: string; kind: string }[]>();
    (resRes.data ?? []).forEach((r: any) => {
      const list = resourcesByBooking.get(r.booking_id) ?? [];
      if (r.resources) list.push({ name: r.resources.name, kind: r.resources.kind });
      resourcesByBooking.set(r.booking_id, list);
    });
    const nameByUser = new Map<string, string>();
    (profRes.data ?? []).forEach((p: any) => nameByUser.set(p.user_id, p.display_name ?? ""));

    const enriched = bookings.map((b) => ({
      ...b,
      customer_name: nameByUser.get(b.user_id) ?? "Customer",
      resources: resourcesByBooking.get(b.id) ?? [],
    }));
    return {
      bookings: enriched,
      venues: venues ?? [],
      debug: {
        authenticatedUserId: userId,
        roles: (rolesData ?? []).map((r) => r.role as string),
        venueIds: ids,
        bookingCount: enriched.length,
        latestReferences: enriched.slice(0, 10).map((b) => `${b.reference} (${b.status}, ${b.starts_at})`),
        errors,
        walsallPadel: (walsallVenues ?? []).map((v) => ({
          ...v,
          ownedByCurrentUser: v.vendor_id === userId,
        })),
        query: "bookings.venue_id IN venue ids where venues.vendor_id = authenticated user id",
      },
    };
  });

export const createVenue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    name: string; activity: string; type: "Indoor" | "Outdoor"; city?: string;
    address?: string; description?: string; coverImage?: string;
    resourceCount: number; resourceKind: "court" | "table" | "lane" | "sim" | "board";
    pricePerHourPence: number; openMin: number; closeMin: number;
  }) =>
    z.object({
      name: z.string().min(1).max(120),
      activity: z.string().min(1).max(40),
      type: z.enum(["Indoor", "Outdoor"]),
      city: z.string().max(80).optional(),
      address: z.string().max(200).optional(),
      description: z.string().max(2000).optional(),
      coverImage: z.string().url().max(500).optional(),
      resourceCount: z.number().int().min(1).max(40),
      resourceKind: z.enum(["court", "table", "lane", "sim", "board"]),
      pricePerHourPence: z.number().int().min(100).max(50000),
      openMin: z.number().int().min(0).max(1440),
      closeMin: z.number().int().min(0).max(1440),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const slug = `${slugify(data.name)}-${Math.random().toString(36).slice(2, 6)}`;

    const { data: venue, error } = await supabase
      .from("venues")
      .insert({
        vendor_id: userId,
        slug,
        name: data.name,
        activity: data.activity,
        type: data.type,
        city: data.city ?? null,
        address: data.address ?? null,
        description: data.description ?? null,
        cover_image: data.coverImage ?? null,
        is_published: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const resources = Array.from({ length: data.resourceCount }, (_, i) => ({
      venue_id: venue.id,
      name: `${labelFor(data.resourceKind)} ${i + 1}`,
      kind: data.resourceKind,
      sort_order: i,
    }));
    const { error: re } = await supabase.from("resources").insert(resources);
    if (re) throw new Error(re.message);

    // Hours + pricing rule for every day
    const hours = Array.from({ length: 7 }, (_, dow) => ({
      venue_id: venue.id,
      day_of_week: dow,
      open_min: data.openMin,
      close_min: data.closeMin,
    }));
    const pricing = Array.from({ length: 7 }, (_, dow) => ({
      venue_id: venue.id,
      day_of_week: dow,
      start_min: data.openMin,
      end_min: data.closeMin,
      price_per_hour_pence: data.pricePerHourPence,
      min_duration_min: 60,
      slot_step_min: 30,
    }));
    await supabase.from("opening_hours").insert(hours);
    await supabase.from("pricing_rules").insert(pricing);
    return { id: venue.id };
  });

function labelFor(k: string) {
  switch (k) {
    case "court": return "Court";
    case "table": return "Table";
    case "lane": return "Lane";
    case "sim": return "Sim Bay";
    case "board": return "Board";
    default: return "Resource";
  }
}
