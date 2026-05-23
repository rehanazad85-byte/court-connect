import { supabase } from "@/integrations/supabase/client";

export type AuthDebugEntry = {
  at: string;
  label: string;
  details?: Record<string, unknown>;
};

const KEY = "knox_auth_debug";
const MAX = 40;

function inBrowser() {
  return typeof window !== "undefined";
}

export function readAuthDebug(): AuthDebugEntry[] {
  if (!inBrowser()) return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as AuthDebugEntry[];
  } catch {
    return [];
  }
}

export function clearAuthDebug() {
  if (!inBrowser()) return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("knox-auth-debug"));
}

export function logAuthDebug(label: string, details?: Record<string, unknown>) {
  if (!inBrowser()) return;
  const entry: AuthDebugEntry = { at: new Date().toISOString(), label, details };
  const next = [entry, ...readAuthDebug()].slice(0, MAX);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("knox-auth-debug"));
}

export async function snapshotAuthDebug(label: string, details?: Record<string, unknown>) {
  if (!inBrowser()) return;
  try {
    const { data, error } = await supabase.auth.getSession();
    logAuthDebug(label, {
      route: window.location.pathname + window.location.search,
      storedRedirect: window.sessionStorage.getItem("knox_auth_redirect"),
      sessionExists: Boolean(data.session),
      userIdExists: Boolean(data.session?.user?.id),
      userId: data.session?.user?.id ?? null,
      authError: error?.message ?? null,
      ...details,
    });
  } catch (error) {
    logAuthDebug(label, {
      route: window.location.pathname + window.location.search,
      storedRedirect: window.sessionStorage.getItem("knox_auth_redirect"),
      authError: error instanceof Error ? error.message : String(error),
      ...details,
    });
  }
}