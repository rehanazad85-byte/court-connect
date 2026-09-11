import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { PhoneShell } from "@/components/PhoneShell";

export const Route = createFileRoute("/claim-venue")({
  component: ClaimVenuePage,
});

function ClaimVenuePage() {
  const [submitted, setSubmitted] = useState(false);
  const venueName = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("venue") ?? "" : "";

  if (submitted) {
    return (
      <PhoneShell>
        <main className="px-5 py-8">
          <CheckCircle className="h-10 w-10 text-primary" />

          <h1 className="mt-4 text-2xl font-bold">
            Claim request received
          </h1>

          <p className="mt-3 text-sm text-muted-foreground">
            Thanks. We&apos;ll review your venue claim and contact you using
            the details provided.
          </p>

          <Link
            to="/venues"
            className="mt-6 inline-block font-semibold text-primary"
          >
            Back to venue directory
          </Link>
        </main>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <main className="px-5 py-6">
        <Link
          to="/venues"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Venue Directory
        </Link>

        <h1 className="mt-6 text-2xl font-bold">Claim your venue</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Are you the owner or manager of a venue listed on Nock Sports?
          Submit your details below and we&apos;ll review your claim.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
        >
          <label className="block">
            <span className="text-sm font-semibold">Venue name</span>
            <input
              name="venue"
          defaultValue={venueName}
              required
              className="mt-2 w-full rounded-xl border px-4 py-3"
              placeholder="Your venue name"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold">Your name</span>
            <input
              name="name"
              required
              className="mt-2 w-full rounded-xl border px-4 py-3"
              placeholder="Full name"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold">Email address</span>
            <input
              type="email"
              name="email"
              required
              className="mt-2 w-full rounded-xl border px-4 py-3"
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold">Phone number</span>
            <input
              type="tel"
              name="phone"
              className="mt-2 w-full rounded-xl border px-4 py-3"
              placeholder="Phone number"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold">
              Your role at the venue
            </span>
            <input
              name="role"
              required
              className="mt-2 w-full rounded-xl border px-4 py-3"
              placeholder="Owner, manager, etc."
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-full bg-primary px-5 py-4 font-bold text-primary-foreground"
          >
            Submit venue claim
          </button>
        </form>
      </main>
    </PhoneShell>
  );
}