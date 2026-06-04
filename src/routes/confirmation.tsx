import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Check, X, Calendar, Clock, LayoutGrid, MapPin, Users } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { formatPence } from "@/lib/mock-data";
import { formatDateTimeUTC } from "@/lib/date-utils";
import { supabase } from "@/integrations/supabase/client";
import { getBookingByReference } from "@/lib/booking.functions";

const bookingByRef = (reference: string) =>
  queryOptions({
    queryKey: ["booking", "ref", reference],
    queryFn: () => getBookingByReference({ data: { reference } }),
    retry: 1,
  });

export const Route = createFileRoute("/confirmation")({
  validateSearch: z.object({ ref: z.string().optional(), total: z.number().optional() }),
  head: () => ({ meta: [{ title: "Booking confirmed — Knox" }] }),
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  errorComponent: ({ error }) => (
    <div className="min-h-dvh bg-ink text-ink-foreground">
      <div className="mx-auto max-w-md px-5 py-10 text-center">
        <h1 className="text-xl font-bold">We couldn't load your booking</h1>
        <p className="mt-2 text-sm text-white/70">{error instanceof Error ? error.message : "Unknown error"}</p>
        <Link to="/bookings" className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">Go to My Bookings</Link>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-dvh bg-ink p-10 text-center text-ink-foreground">
      <h1 className="text-xl font-bold">Booking not found</h1>
      <Link to="/bookings" className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">My Bookings</Link>
    </div>
  ),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const { ref, total } = Route.useSearch();
  return (
    <div className="min-h-dvh bg-ink">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-ink text-ink-foreground shadow-pop">
        <div className="flex items-center justify-between px-5 pt-5">
          <Link to="/" className="-ml-1 flex h-11 w-11 items-center justify-center"><X className="h-6 w-6" /></Link>
        </div>

        <div className="flex flex-col items-center px-6 pt-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Check className="h-9 w-9 text-primary-foreground" strokeWidth={3} />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Booking Confirmed!</h1>
          <p className="mt-2 text-center text-sm text-white/70">Your booking is locked in.<br />See you on court.</p>
        </div>

        <div className="mx-5 mt-6 rounded-2xl bg-card p-5 text-card-foreground shadow-pop">
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Booking Reference</div>
            <div className="mt-1 text-xl font-bold font-mono">{ref ?? "—"}</div>
          </div>
          {ref && <BookingDetails reference={ref} fallbackTotal={total} />}
        </div>

        <div className="flex-1" />

        <div className="space-y-2 px-5 pb-4 pt-6">
          <Link to="/bookings" className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">View My Bookings</Link>
          <Link to="/" className="flex h-12 w-full items-center justify-center rounded-xl border border-white/20 text-sm font-bold">Back to Home</Link>
        </div>

        <div className="bg-ink"><BottomNav /></div>
      </div>
    </div>
  );
}

function BookingDetails({ reference, fallbackTotal }: { reference: string; fallbackTotal?: number }) {
  const { data, isLoading, error } = useQuery(bookingByRef(reference));
  if (isLoading) {
    return <div className="mt-4 text-center text-sm text-muted-foreground">Loading booking…</div>;
  }
  if (error) {
    return (
      <div className="mt-4 text-center text-xs text-muted-foreground">
        Couldn't load full details. Reference saved above.
        {fallbackTotal != null && (
          <div className="mt-1">Total <span className="font-bold text-primary">{formatPence(fallbackTotal)}</span></div>
        )}
      </div>
    );
  }
  const b = data?.booking;
  if (!b) {
    return fallbackTotal != null ? (
      <div className="mt-3 text-center text-sm text-muted-foreground">Total <span className="font-bold text-primary">{formatPence(fallbackTotal)}</span></div>
    ) : null;
  }
  const venue = (b as any).venues as { name?: string; city?: string; address?: string } | null;
  const resources = data?.resources ?? [];
  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <Row icon={MapPin} label="Venue" value={venue?.name ?? ""} sub={venue?.address || venue?.city || undefined} />
      <Row icon={Calendar} label="When" value={formatDateTimeUTC(b.starts_at)} />
      <Row icon={Clock} label="Duration" value={`${Math.round((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000)} min`} />
      <Row icon={LayoutGrid} label={resources.length === 1 ? "Court" : "Courts"} value={resources.map((r) => r.name).join(", ") || "—"} />
      <Row icon={Users} label="Players" value={`${b.players} ${b.players === 1 ? "Player" : "Players"}`} />
      <div className="mt-1 flex items-center justify-between border-t pt-3">
        <span className="text-sm font-bold">Total paid</span>
        <span className="text-base font-bold text-primary">{formatPence(b.total_pence)}</span>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3 text-left">
      <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold truncate">{value}</div>
        {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
      </div>
    </div>
  );
}
