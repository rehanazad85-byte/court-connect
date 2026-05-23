import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/vendor/venues")({
  beforeLoad: () => { throw redirect({ to: "/vendor" }); },
});
