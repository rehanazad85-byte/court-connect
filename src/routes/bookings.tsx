import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, X } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";
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
  const qc = useQueryClient();
  const fetchBookings = useServerFn(myBookings);
  const cancel = useServerFn(cancelBooking);

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-bookings", user?.id ?? "anon"],
    queryFn: () => fetchBookings(),
    enabled: !!user,
  });

  const bookings = data?.bookings ?? [];
  const now = Date.now();
  const upcoming = bookings.filter((b: any) => new Date(b.starts_at).getTime() >= now && b.status !== "cancelled");
  const past = bookings.filter((b: any) => new Date(b.starts_at).getTime() < now || b.status === "cancelled");

  const onCancel = async (id: string) => {
    try {
      await cancel({ data: { id } });
      toast.success("Booking cancelled");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    }
  };

  return (
    <PhoneShell>
      <div className="px-5 pt-7">
        <h1 className="text-2xl font-bold">My Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your upcoming and past sessions.</p>
      </div>

      {authLoading ? (
        <div className="px-5 pt-8 text-sm text-muted-foreground">Loading…</div>
      ) : !user ? (
        <div className="px-5 pt-6">
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sign in to see your bookings.
            <div className="mt-3">
              <Link to="/login" search={{ redirect: "/bookings" }} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      ) : isLoading ? (
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
          <div className="px-5 pt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Upcoming</h2>
            {upcoming.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No upcoming sessions. <Link to="/" className="text-primary font-semibold">Find a venue</Link>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {upcoming.map((b: any) => <BookingCard key={b.id} b={b} onCancel={onCancel} cancellable />)}
              </div>
            )}
          </div>

          <div className="px-5 pt-8 pb-8">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Past</h2>
              <div className="h-px flex-1 bg-border" />
            </div>
            {past.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No past sessions yet.</div>
            ) : (
              <div className="mt-3 space-y-3">
                {past.map((b: any) => <BookingCard key={b.id} b={b} />)}
              </div>
            )}
          </div>
        </>
      )}
    </PhoneShell>
  );
}

function BookingCard({ b, cancellable, onCancel }: { b: any; cancellable?: boolean; onCancel?: (id: string) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-soft">
      <div className="flex items-center gap-3 p-3">
        {b.venues?.cover_image && <img src={b.venues.cover_image} alt="" className="h-14 w-14 rounded-xl object-cover" />}
        <div className="flex-1">
          <div className="text-sm font-bold">{b.venues?.name}</div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" /> {formatDateTimeUTC(b.starts_at)}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono">{b.reference}</span>
            <span className="font-semibold text-primary">{formatPence(b.total_pence)}</span>
            {b.status === "cancelled" && <span className="text-destructive">Cancelled</span>}
          </div>
        </div>
        {cancellable && onCancel && (
          <button onClick={() => onCancel(b.id)} className="flex h-8 w-8 items-center justify-center rounded-full border text-muted-foreground hover:text-destructive" aria-label="Cancel">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
