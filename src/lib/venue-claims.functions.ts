import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

function adminSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export const submitVenueClaim = createServerFn({ method: "POST" })
  .inputValidator((input: {
    venueName: string;
    claimantName: string;
    email: string;
    phone?: string;
    role: string;
  }) => {
    const venueName = input.venueName.trim();
    const claimantName = input.claimantName.trim();
    const email = input.email.trim();
    const phone = input.phone?.trim() || null;
    const role = input.role.trim();

    if (!venueName) throw new Error("Venue name is required");
    if (!claimantName) throw new Error("Name is required");
    if (!email || !email.includes("@")) throw new Error("A valid email is required");
    if (!role) throw new Error("Role is required");

    return { venueName, claimantName, email, phone, role };
  })
  .handler(async ({ data }) => {
    const supabase = adminSupabase();

    const { error } = await supabase.from("venue_claims").insert({
      venue_name: data.venueName,
      claimant_name: data.claimantName,
      email: data.email,
      phone: data.phone,
      role: data.role,
    });

    if (error) throw new Error(error.message);

    return { ok: true };
  });
