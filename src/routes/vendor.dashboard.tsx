import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/vendor/dashboard")({
  beforeLoad: () => { throw redirect({ to: "/vendor" }); },
});
