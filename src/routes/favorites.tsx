import { createFileRoute } from "@tanstack/react-router";
import { PhoneShell } from "@/components/PhoneShell";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [{ title: "Favorites — Knox" }] }),
  component: () => (
    <PhoneShell>
      <div className="px-5 pt-8">
        <h1 className="text-2xl font-bold">Favorites</h1>
        <p className="mt-2 text-sm text-muted-foreground">Save venues you love for quick rebooking.</p>
      </div>
    </PhoneShell>
  ),
});
