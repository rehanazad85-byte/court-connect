import { createFileRoute } from "@tanstack/react-router";
import { PhoneShell } from "@/components/PhoneShell";

export const Route = createFileRoute("/bookings")({
  head: () => ({ meta: [{ title: "My bookings — Knox" }] }),
  component: () => (
    <PhoneShell>
      <div className="px-5 pt-8">
        <h1 className="text-2xl font-bold">My Bookings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your upcoming and past sessions will appear here.</p>
        <div className="mt-8 rounded-2xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No bookings yet.<br />Start exploring venues to make your first booking.</p>
        </div>
      </div>
    </PhoneShell>
  ),
});
