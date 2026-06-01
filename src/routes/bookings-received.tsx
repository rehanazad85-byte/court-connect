import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ArrowLeft, Calendar, User } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { PendingScreen } from "@/components/PendingScreen";
import { useAuth } from "@/hooks/use-auth";
import { listVendorBookings } from "@/lib/vendor.functions";
import { formatPence } from "@/lib/mock-data";
import { formatDateTimeUTC } from "@/lib/date-utils";

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
  return <BookingsReceivedPage />;
}

function BookingsReceivedPage() {
  const search = Route.useSearch();
  const nav = useNavigate();
  const activeFilter: Filter = search.filter ?? "upcoming";
  const fetch = useServerFn(listVendorBookings);
  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-bookings"],
    queryFn: () => fetch(),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const now = Date.now();
  const todayEnd = (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); })();
  const all = (data?.bookings ?? []) as any[];
  const venuesById = new Map((data?.venues ?? []).map((v: any) => [v.id, v]));

  const filtered = all.filter((b) => {
    const t = new Date(b.starts_at).getTime();
    if (activeFilter === "cancelled") return b.status === "cancelled";
    if (b.status === "cancelled") return false;
    if (activeFilter === "today") return t >= now - 12 * 3600_000 && t <= todayEnd;
    if (activeFilter === "upcoming") return t >= now;
    if (activeFilter === "past") return t < now;
    return true;
  });

  const counts = {
    today: all.filter((b) => b.status !== "cancelled" && new Date(b.starts_at).getTime() >= now - 12 * 3600_000 && new Date(b.starts_at).getTime() <= todayEnd).length,
    upcoming: all.filter((b) => b.status !== "cancelled" && new Date(b.starts_at).getTime() >= now).length,
    past: all.filter((b) => b.status !== "cancelled" && new Date(b.starts_at).getTime() < now).length,
    cancelled: all.filter((b) => b.status === "cancelled").length,
  };

  const setFilter = (f: Filter) =>
    nav({ to: "/bookings-received", search: { filter: f }, replace: true });

  return (
    <PhoneShell>
      <div className="px-5 pt-7">
        <Link to="/vendor" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Vendor dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Bookings Received</h1>
        <p className="mt-1 text-sm text-muted-foreground">Bookings customers made at your venues.</p>
      </div>

      <VendorBookingsDebug debug={(data as any)?.debug} error={error} />

      <div className="px-5 pt-4 flex gap-2 overflow-x-auto no-scrollbar">
        {([
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
              return (
                <div key={b.id} className="rounded-2xl bg-card p-3 shadow-soft">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
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
                    </div>
                    <div className="text-right">
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
    </PhoneShell>
  );
}

function VendorBookingsDebug({ debug, error }: { debug: any; error?: unknown }) {
  const walsall = debug?.walsallPadel ?? [];
  return (
    <div className="px-5 pt-4">
      <div className="rounded-2xl border border-dashed bg-card p-3 text-[11px] text-muted-foreground">
        <div className="mb-2 text-xs font-bold text-foreground">Vendor bookings debug</div>
        <div><span className="font-semibold text-foreground">Authenticated user:</span> {debug?.authenticatedUserId ?? "not returned"}</div>
        <div><span className="font-semibold text-foreground">Roles:</span> {(debug?.roles ?? []).join(", ") || "none"}</div>
        <div><span className="font-semibold text-foreground">Owned venue ids:</span> {(debug?.venueIds ?? []).join(", ") || "none"}</div>
        <div><span className="font-semibold text-foreground">Bookings found:</span> {debug?.bookingCount ?? 0}</div>
        <div><span className="font-semibold text-foreground">Latest refs:</span> {(debug?.latestReferences ?? []).join(" | ") || "none"}</div>
        <div><span className="font-semibold text-foreground">Query:</span> {debug?.query ?? "not returned"}</div>
        <div><span className="font-semibold text-foreground">Errors:</span> {error instanceof Error ? error.message : (debug?.errors ?? []).join(" | ") || "none"}</div>
        <div className="mt-2 font-semibold text-foreground">Walsall Padel ownership</div>
        {walsall.length === 0 ? (
          <div>Walsall Padel not visible to this account.</div>
        ) : walsall.map((v: any) => (
          <div key={v.id} className="break-words">
            {v.name}: {v.id} · vendor {v.vendor_id} · {v.ownedByCurrentUser ? "owned by current user" : "not owned by current user"}
          </div>
        ))}
      </div>
    </div>
  );
}
