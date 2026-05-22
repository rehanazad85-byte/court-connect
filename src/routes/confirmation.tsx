import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Check, X } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { formatPence } from "@/lib/mock-data";

export const Route = createFileRoute("/confirmation")({
  validateSearch: z.object({ ref: z.string().optional(), total: z.number().optional() }),
  head: () => ({ meta: [{ title: "Booking confirmed — Knox" }] }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const { ref, total } = Route.useSearch();
  return (
    <div className="min-h-dvh bg-ink">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-ink text-ink-foreground shadow-pop">
        <div className="flex items-center justify-between px-5 pt-5">
          <Link to="/" className="-ml-1 flex h-9 w-9 items-center justify-center"><X className="h-6 w-6" /></Link>
        </div>

        <div className="flex flex-col items-center px-6 pt-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Check className="h-9 w-9 text-primary-foreground" strokeWidth={3} />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Booking Confirmed!</h1>
          <p className="mt-2 text-center text-sm text-white/70">Your booking is locked in.<br />See you on court.</p>
        </div>

        <div className="mx-5 mt-8 rounded-2xl bg-card p-5 text-card-foreground text-center shadow-pop">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Booking Reference</div>
          <div className="mt-1 text-xl font-bold">{ref ?? "—"}</div>
          {total != null && <div className="mt-3 text-sm text-muted-foreground">Total <span className="font-bold text-primary">{formatPence(total)}</span></div>}
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
