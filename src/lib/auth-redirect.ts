import { supabase } from "@/integrations/supabase/client";

/** Whitelist of safe in-app redirect targets. */
function safeTarget(value?: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/~oauth")) return null;
  return value;
}

export function safeRedirectTarget(value?: string | null): string {
  return safeTarget(value) ?? "/";
}

/**
 * Decide where to land after a successful sign-in.
 * - Honour an explicit redirect when safe.
 * - Otherwise route vendors to /vendor, everyone else to /.
 */
export async function resolveLandingTarget(explicitRedirect?: string | null): Promise<string> {
  const safe = safeTarget(explicitRedirect);
  if (safe && safe !== "/") return safe;
  try {
    const { data } = await supabase.from("user_roles").select("role");
    if (data?.some((r) => r.role === "vendor")) return "/vendor";
  } catch {
    // ignore — fall back to home
  }
  return safe ?? "/";
}
