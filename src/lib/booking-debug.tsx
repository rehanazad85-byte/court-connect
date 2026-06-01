import { bookingStore, type BookingState } from "@/lib/booking-store";

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

function DebugLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1 flex items-start justify-between gap-3">
      <span>{label}</span>
      <span className="max-w-[58%] break-words text-right font-mono font-semibold text-foreground">{value}</span>
    </div>
  );
}