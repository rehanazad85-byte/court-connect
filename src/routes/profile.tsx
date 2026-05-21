import { createFileRoute } from "@tanstack/react-router";
import { PhoneShell } from "@/components/PhoneShell";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Knox" }] }),
  component: () => (
    <PhoneShell>
      <div className="px-5 pt-8">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage your account, payment methods and notifications.</p>
      </div>
    </PhoneShell>
  ),
});
