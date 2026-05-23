import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/venue/$venueId/courts")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/venue/$venueId", params: { venueId: params.venueId } });
  },
});
