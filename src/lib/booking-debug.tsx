import { useEffect, useState } from "react";
import { bookingStore, type BookingState } from "@/lib/booking-store";
import { supabase } from "@/integrations/supabase/client";

export type BookingDebugSnapshot = {
  component: string;
  message: string;
  stack: string | null;
  route: string;
  venueId: string | null;
  date: string | null;
  time: string | null;
  duration: number | null;
  resourceIds: string[];
  sessionIdPresent: boolean | null;
  summaryDataExists: boolean;
  createBookingCalled: boolean;
  payload?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
};

type BookingFlowDebugStatus = {
  userId: string | null;
  profileLoaded: boolean;
  profileExists: boolean | null;
  roles: string[];
  authChecked: boolean;
  authError: string | null;
};

const initialStatus: BookingFlowDebugStatus = {
  userId: null,
  profileLoaded: false,
  profileExists: null,
  roles: [],
  authChecked: false,
  authError: null,
};

export function isBookingDebugEnabled() {
  if (typeof window === "undefined") return false;
  return import.meta.env.DEV || window.location.hostname.includes("-preview--") || window.location.hostname === "localhost";
}

function currentRoute() {
  if (typeof window === "undefined") return "server";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function summaryDataExists(booking: BookingState) {
  return Boolean(booking.venueId && booking.dateISO && booking.time && booking.resourceIds.length > 0);
}

export function buildBookingDebugSnapshot({
  component,
  error,
  booking = bookingStore.get(),
  sessionIdPresent = null,
  createBookingCalled = false,
  payload = null,
  result = null,
}: {
  component: string;
  error: unknown;
  booking?: BookingState;
  sessionIdPresent?: boolean | null;
  createBookingCalled?: boolean;
  payload?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
}): BookingDebugSnapshot {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown booking flow error";
  const stack = error instanceof Error ? error.stack ?? null : new Error(message).stack ?? null;
  return {
    component,
    message,
    stack,
    route: currentRoute(),
    venueId: booking.venueId,
    date: booking.dateISO,
    time: booking.time,
    duration: booking.durationMin ?? null,
    resourceIds: booking.resourceIds,
    sessionIdPresent,
    summaryDataExists: summaryDataExists(booking),
    createBookingCalled,
    payload,
    result,
  };
}

export function logBookingDebug(snapshot: BookingDebugSnapshot) {
  console.error("[booking-flow-debug]", snapshot);
}

export function useBookingFlowDebugStatus() {
  const [status, setStatus] = useState<BookingFlowDebugStatus>(initialStatus);

  useEffect(() => {
    if (!isBookingDebugEnabled()) return;
    let active = true;

    async function load() {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id ?? null;
        if (sessionError) throw sessionError;
        if (!userId) {
          if (active) setStatus({ ...initialStatus, authChecked: true });
          return;
        }

        const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] = await Promise.all([
          supabase.from("profiles").select("user_id, display_name, phone, avatar_url").eq("user_id", userId).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", userId),
        ]);
        if (profileError) throw profileError;
        if (rolesError) throw rolesError;
        if (active) {
          setStatus({
            userId,
            profileLoaded: true,
            profileExists: !!profile,
            roles: (roles ?? []).map((r) => String(r.role)),
            authChecked: true,
            authError: null,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load booking debug auth state";
        console.error("[booking-flow-debug-auth]", error);
        if (active) setStatus({ ...initialStatus, authChecked: true, authError: message });
      }
    }

    void load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void load();
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return status;
}

export function BookingDebugPanel({ snapshot }: { snapshot: BookingDebugSnapshot }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed bg-muted/40 p-3 text-[11px] text-muted-foreground">
      <div className="font-bold text-foreground">Booking debug error</div>
      <DebugLine label="Error message" value={snapshot.message} />
      <DebugLine label="Component" value={snapshot.component} />
      <DebugLine label="Current route" value={snapshot.route} />
      <DebugLine label="Selected venueId" value={snapshot.venueId ?? "missing"} />
      <DebugLine label="Selected date" value={snapshot.date ?? "missing"} />
      <DebugLine label="Selected time" value={snapshot.time ?? "missing"} />
      <DebugLine label="Duration" value={snapshot.duration == null ? "missing" : `${snapshot.duration} min`} />
      <DebugLine label="Selected resourceIds" value={snapshot.resourceIds.length ? snapshot.resourceIds.join(", ") : "missing"} />
      <DebugLine label="User/session id present" value={snapshot.sessionIdPresent === null ? "unknown" : snapshot.sessionIdPresent ? "true" : "false"} />
      <DebugLine label="Summary data exists" value={snapshot.summaryDataExists ? "true" : "false"} />
      <DebugLine label="createBooking called" value={snapshot.createBookingCalled ? "true" : "false"} />
      {snapshot.payload && <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-2">{JSON.stringify(snapshot.payload, null, 2)}</pre>}
      {snapshot.result && <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-2">{JSON.stringify(snapshot.result, null, 2)}</pre>}
      {snapshot.stack && <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-2">{snapshot.stack}</pre>}
    </div>
  );
}

export function BookingRouteErrorPanel({ component, error }: { component: string; error: unknown }) {
  const snapshot = buildBookingDebugSnapshot({ component, error });
  logBookingDebug(snapshot);
  return <BookingDebugPanel snapshot={snapshot} />;
}

export function BookingFlowDebugPanel({
  routeName,
  booking = bookingStore.get(),
  venueId,
  quoteLoaded,
  createBookingCalled = false,
  latestCreateBookingError = null,
}: {
  routeName: string;
  booking?: BookingState;
  venueId?: string | null;
  quoteLoaded?: boolean;
  createBookingCalled?: boolean;
  latestCreateBookingError?: string | null;
}) {
  const status = useBookingFlowDebugStatus();
  if (!isBookingDebugEnabled()) return null;

  const snapshot = {
    routeName,
    route: currentRoute(),
    authenticatedUserId: status.userId,
    profileLoaded: status.profileLoaded,
    profileExists: status.profileExists,
    roles: status.roles,
    authChecked: status.authChecked,
    authError: status.authError,
    venueId: venueId ?? booking.venueId,
    selectedDate: booking.dateISO,
    selectedTime: booking.time,
    duration: booking.durationMin,
    players: booking.players,
    selectedResourceIds: booking.resourceIds,
    quoteLoaded: quoteLoaded ?? booking.pricePerCourtPence != null,
    createBookingCalled,
    latestCreateBookingError,
  };

  console.info("[booking-flow-debug-panel]", snapshot);

  return (
    <div className="mt-4 rounded-2xl border border-dashed bg-muted/40 p-3 text-[11px] text-muted-foreground">
      <div className="font-bold text-foreground">Booking flow debug</div>
      <DebugLine label="Route" value={snapshot.routeName} />
      <DebugLine label="Path/search" value={snapshot.route} />
      <DebugLine label="Authenticated user id" value={snapshot.authenticatedUserId ?? "missing"} />
      <DebugLine label="Profile loaded" value={snapshot.profileLoaded ? "true" : "false"} />
      <DebugLine label="Profile row exists" value={snapshot.profileExists === null ? "unknown" : snapshot.profileExists ? "true" : "false"} />
      <DebugLine label="User roles" value={snapshot.roles.length ? snapshot.roles.join(", ") : "none"} />
      <DebugLine label="VenueId" value={snapshot.venueId ?? "missing"} />
      <DebugLine label="Selected date" value={snapshot.selectedDate ?? "missing"} />
      <DebugLine label="Selected time" value={snapshot.selectedTime ?? "missing"} />
      <DebugLine label="Duration" value={`${snapshot.duration} min`} />
      <DebugLine label="Players" value={String(snapshot.players)} />
      <DebugLine label="Selected resourceIds" value={snapshot.selectedResourceIds.length ? snapshot.selectedResourceIds.join(", ") : "missing"} />
      <DebugLine label="Quote loaded" value={snapshot.quoteLoaded ? "true" : "false"} />
      <DebugLine label="createBooking called" value={snapshot.createBookingCalled ? "true" : "false"} />
      <DebugLine label="Latest createBooking error" value={snapshot.latestCreateBookingError ?? "none"} />
      {snapshot.authError && <DebugLine label="Auth/profile error" value={snapshot.authError} />}
    </div>
  );
}

function DebugLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1 flex items-start justify-between gap-3">
      <span>{label}</span>
      <span className="max-w-[58%] break-words text-right font-mono font-semibold text-foreground">{value}</span>
    </div>
  );
}