import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

export function PendingScreen({ timeoutMs = 12000, label = "Loading…" }: { timeoutMs?: number; label?: string }) {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(t);
  }, [timeoutMs]);

  if (timedOut) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-lg font-semibold">This is taking longer than expected</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your sign-in or data load didn't complete. Please try again.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Reload
            </button>
            <Link to="/login" className="rounded-full border px-5 py-2.5 text-sm font-semibold">
              Sign in again
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
