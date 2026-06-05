import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ArrowLeft, Calendar, User, X } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { PendingScreen } from "@/components/PendingScreen";
import { useAuth } from "@/hooks/use-auth";
import { listVendorBookings } from "@/lib/vendor.functions";
import { cancelBooking } from "@/lib/booking.functions";
import { formatPence } from "@/lib/mock-data";
import { formatDateTimeUTC } from "@/lib/date-utils";
import { toast } from "sonner";

type Filter = "today" | "upcoming" | "past" | "cancelled" | "all";

const searchSchema = z.object({
  filter: z.enum(["today", "upcoming", "past", "cancelled", "all"]).optional(),
});

export const Route = createFileRoute("/bookings-received")({
  head: () => ({ meta: [{ title: "Bookings Received — Knox Vendor" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: BookingsReceivedGate,
});

function BookingsReceivedGate() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!loading && !user) {
      void nav({ to: "/login", search: { redirect: "/bookings-received" }, replace: true });
    }
  }, [loading, user, nav]);
  if (loading || !user) return <PendingScreen label="Checking session…" />;
  return <BookingsReceivedPage userId={user.id} />;
}

function BookingsReceivedPage({ userId }: { userId: string }) {
  const search = Route.useSearch();
  const nav = useNavigate();
  const qc = useQueryClient();
  const activeFilter: Filter = search.filter ?? "all";
  const fetchFn = useServerFn(listVendorBookings);
  const cancelFn = useServerFn(cancelBooking);
  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-bookings", userId],
    queryFn: () => fetchFn(),
    staleTime: 0,
    refetchOnMount: "always",
    enabled: !!userId,
  });

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const now = Date.now();
  const todayStart = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const todayEnd = (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); })();
  const all = (data?.bookings ?? []) as any[];
  const venuesById = new Map((data?.venues ?? []).map((v: any) => [v.id, v]));

  const filtered = all.filter((b) => {
    const t = new Date(b.starts_at).getTime();
    if (activeFilter === "cancelled") return b.status === "cancelled";
    if (b.status === "cancelled") return false;
    if (activeFilter === "today") return t >= todayStart && t <= todayEnd;
    if (activeFilter === "upcoming") return t >= now;
    if (activeFilter === "past") return t < now;
    return true;
  });

  const counts = {
    all: all.length,
    today: all.filter((b) => b.status !== "cancelled" && new Date(b.starts_at).getTime() >= todayStart && new Date(b.starts_at).getTime() <= todayEnd).length,
    upcoming: all.filter((b) => b.status !== "cancelled" && new Date(b.starts_at).getTime() >= now).length,
    past: all.filter((b) => b.status !== "cancelled" && new Date(b.starts_at).getTime() < now).length,
    cancelled: all.filter((b) => b.status === "cancelled").length,
  };

  const setFilter = (f: Filter) =>
    nav({ to: "/bookings-received", search: { filter: f }, replace: true });

  const handleCancel = async (id: string) => {
    setConfirmId(null);
    setCancellingId(id);
    try {
      await cancelFn({ data: { id } });
      toast.success("Booking cancelled");
      await qc.invalidateQueries({ queryKey: ["vendor-bookings", userId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel booking");
    } finally {
      setCancellingId(null);
    }
  };

  const confirmBooking = confirmId ? all.find((b) => b.id === confirmId) : null;
  const confirmVenue = confirmBooking ? venuesById.get(confirmBooking.venue_id) : null;

  return (
    <PhoneShell>
      <div className="px-5 pt-7">
        <Link to="/vendor" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Vendor dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Bookings Received</h1>
        <p className="mt-1 text-sm text-muted-foreground">Bookings customers made at your venues.</p>
      </div>

      <div className="px-5 pt-4 flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {([
          ["all", `All (${counts.all})`],
          ["today", `Today (${counts.today})`],
          ["upcoming", `Upcoming (${counts.upcoming})`],
          ["past", `Past (${counts.past})`],
          ["cancelled", `Cancelled (${counts.cancelled})`],
        ] as [Filter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold border ${
              activeFilter === key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-5 pt-4 pb-8">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-destructive">
            Couldn't load bookings.
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No {activeFilter} bookings.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((b) => {
              const v: any = venuesById.get(b.venue_id);
              const isUpcoming = new Date(b.starts_at).getTime() > now;
              const canCancel = b.status === "confirmed" && isUpcoming;
              const isCancelling = cancellingId === b.id;

              return (
                <div key={b.id} className="rounded-2xl bg-card p-3 shadow-soft">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{v?.name ?? "Venue"}</div>
                      <div className="text-xs text-muted-foreground">{formatDateTimeUTC(b.starts_at)} → {formatDateTimeUTC(b.ends_at).split(" · ")[1]}</div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" /> {b.customer_name || "Customer"} · {b.players} players
                      </div>
                      {b.resources?.length > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {b.resources.map((r: any) => r.name).join(", ")}
                        </div>
                      )}
                      {canCancel && (
                        <button
                          disabled={isCancelling}
                          onClick={() => setConfirmId(b.id)}
                          className="mt-2 inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50"
                        >
                          <X className="h-3 w-3" />
                          {isCancelling ? "Cancelling…" : "Cancel booking"}
                        </button>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-primary">{formatPence(b.total_pence)}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{b.reference}</div>
                      <div className={`mt-1 text-[10px] font-bold ${b.status === "cancelled" ? "text-destructive" : "text-foreground"}`}>
                        {b.status}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 pb-8"
          onClick={() => setConfirmId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold">Cancel this booking?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to cancel the booking at{" "}
              <span className="font-semibold text-foreground">{(confirmVenue as any)?.name ?? "your venue"}</span>?
              {confirmBooking && (
                <>
                  {" "}Scheduled for {formatDateTimeUTC(confirmBooking.starts_at)}.
                </>
              )}
              <br />
              The customer will see this booking as cancelled.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmId(null)}
                className="flex h-11 flex-1 items-center justify-center rounded-xl border border-border text-sm font-medium"
              >
                Keep booking
              </button>
              <button
                onClick={() => handleCancel(confirmId)}
                className="flex h-11 flex-1 items-center justify-center rounded-xl bg-destructive text-sm font-bold text-destructive-foreground"
              >
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </PhoneShell>
  );
}
