import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, X, MapPin, Users, Hash, CreditCard } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
import { PendingScreen } from "@/components/PendingScreen";
import { myBookings, cancelBooking } from "@/lib/booking.functions";
import { useAuth } from "@/hooks/use-auth";
import { formatPence } from "@/lib/mock-data";
import { formatDateTimeUTC } from "@/lib/date-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/bookings")({
  head: () => ({ meta: [{ title: "My bookings — Knox" }] }),
  component: BookingsPage,
});

function BookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const fetchBookings = useServerFn(myBookings);
  const cancel = useServerFn(cancelBooking);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      void nav({ to: "/login", search: { redirect: "/bookings" }, replace: true });
    }
  }, [authLoading, user, nav]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-bookings", user?.id ?? "anon"],
    queryFn: () => fetchBookings(),
    enabled: !!user,
  });

  if (authLoading || !user) {
    return <PendingScreen label="Checking session…" />;
  }

  const bookings = (data?.bookings ?? []) as any[];
  const now = Date.now();
  const upcoming = bookings.filter((b) => new Date(b.starts_at).getTime() >= now && b.status !== "cancelled");
  const past = bookings.filter((b) => new Date(b.starts_at).getTime() < now && b.status !== "cancelled");
  const cancelled = bookings.filter((b) => b.status === "cancelled");

  const onCancel = async (id: string) => {
    try {
      await cancel({ data: { id } });
      toast.success("Booking cancelled");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      setOpenId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    }
  };

  const openBooking = bookings.find((b) => b.id === openId) ?? null;

  return (
    <PhoneShell>
      <div className="px-5 pt-7">
        <h1 className="text-2xl font-bold">My Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Bookings you made as a customer.</p>
      </div>

      {isLoading ? (
        <div className="px-5 pt-8 text-sm text-muted-foreground">Loading bookings…</div>
      ) : error ? (
        <div className="px-5 pt-6">
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Couldn't load bookings. Please try again.
          </div>
        </div>
      ) : bookings.length === 0 ? (
        <div className="px-5 pt-6">
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No bookings yet. <Link to="/" className="text-primary font-semibold">Find a venue</Link>
          </div>
        </div>
      ) : (
        <>
          <Section title="Upcoming" items={upcoming} onOpen={setOpenId} emptyLabel="No upcoming sessions." />
          <Section title="Past" items={past} onOpen={setOpenId} emptyLabel="No past sessions yet." />
          {cancelled.length > 0 && (
            <Section title="Cancelled" items={cancelled} onOpen={setOpenId} emptyLabel="" />
          )}
          <div className="pb-8" />
        </>
      )}

      {openBooking && (
        <DetailsModal
          b={openBooking}
          onClose={() => setOpenId(null)}
          onCancel={onCancel}
        />
      )}
    </PhoneShell>
  );
}

function Section({
  title,
  items,
  onOpen,
  emptyLabel,
}: {
  title: string;
  items: any[];
  onOpen: (id: string) => void;
  emptyLabel: string;
}) {
  return (
    <div className="px-5 pt-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {items.length === 0 ? (
        emptyLabel ? (
          <div className="mt-3 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : null
      ) : (
        <div className="mt-3 space-y-3">
          {items.map((b) => (
            <BookingCard key={b.id} b={b} onOpen={() => onOpen(b.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingCard({ b, onOpen }: { b: any; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full text-left overflow-hidden rounded-2xl bg-card shadow-soft hover:bg-accent/20 transition-colors"
    >
      <div className="flex items-center gap-3 p-3">
        {b.venues?.cover_image && <img src={b.venues.cover_image} alt="" className="h-14 w-14 rounded-xl object-cover" />}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate">{b.venues?.name}</div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" /> {formatDateTimeUTC(b.starts_at)}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground overflow-hidden">
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono truncate max-w-[130px] shrink-0">{b.reference}</span>
            <span className="font-semibold text-primary shrink-0">{formatPence(b.total_pence)}</span>
            {b.status === "cancelled" && <span className="text-destructive shrink-0">Cancelled</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

function DetailsModal({
  b,
  onClose,
  onCancel,
}: {
  b: any;
  onClose: () => void;
  onCancel: (id: string) => void;
}) {
  const start = new Date(b.starts_at);
  const end = new Date(b.ends_at);
  const isUpcoming = start.getTime() > Date.now();
  const cancellable = isUpcoming && b.status !== "cancelled" && start.getTime() - Date.now() > 3600_000;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Booking</div>
            <div className="mt-0.5 font-mono text-sm font-bold">{b.reference}</div>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          {b.venues?.cover_image && <img src={b.venues.cover_image} alt="" className="h-16 w-16 rounded-xl object-cover" />}
          <div className="flex-1 min-w-0">
            <div className="font-bold">{b.venues?.name}</div>
            {(b.venues?.city || b.venues?.address) && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {b.venues?.address ?? b.venues?.city}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2 rounded-2xl border p-3 text-sm">
          <Row icon={<Calendar className="h-4 w-4" />} label="Date" value={formatDateTimeUTC(b.starts_at).split(" · ")[0]} />
          <Row
            icon={<Calendar className="h-4 w-4" />}
            label="Time"
            value={`${String(start.getUTCHours()).padStart(2, "0")}:${String(start.getUTCMinutes()).padStart(2, "0")} – ${String(end.getUTCHours()).padStart(2, "0")}:${String(end.getUTCMinutes()).padStart(2, "0")}`}
          />
          <Row
            icon={<Hash className="h-4 w-4" />}
            label="Resource"
            value={b.resources?.length ? b.resources.map((r: any) => r.name).join(", ") : "—"}
          />
          <Row icon={<Users className="h-4 w-4" />} label="Players" value={String(b.players)} />
          <Row icon={<CreditCard className="h-4 w-4" />} label="Total" value={formatPence(b.total_pence)} />
          <Row icon={<CreditCard className="h-4 w-4" />} label="Payment" value="Pay at venue" />
          <Row
            icon={<Calendar className="h-4 w-4" />}
            label="Status"
            value={b.status}
            valueClass={b.status === "cancelled" ? "text-destructive" : b.status === "confirmed" ? "text-primary" : ""}
          />
        </div>

        {cancellable ? (
          <button
            onClick={() => onCancel(b.id)}
            className="mt-4 h-11 w-full rounded-xl border border-destructive text-sm font-bold text-destructive"
          >
            Cancel booking
          </button>
        ) : isUpcoming && b.status !== "cancelled" ? (
          <p className="mt-3 text-center text-xs text-muted-foreground">Cancellations must be made at least 1 hour before start.</p>
        ) : null}
      </div>
    </div>
  );
}

function Row({ icon, label, value, valueClass }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        {icon} {label}
      </span>
      <span className={`text-sm font-semibold capitalize text-right break-words max-w-[55%] ${valueClass ?? ""}`}>{value}</span>
    </div>
  );
}
