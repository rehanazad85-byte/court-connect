import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";


import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">This page doesn't exist.</p>
        <Link to="/" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          Back to Knox
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">Try again or head home.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Try again
          </button>
          <a href="/" className="rounded-full border px-5 py-2.5 text-sm font-semibold">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Knox — Book Padel, Snooker, Pool & More" },
      { name: "description", content: "Instant bookings for padel courts, snooker tables, pool, darts and golf simulators. Real-time availability. Play your game, your way." },
      { name: "theme-color", content: "#0b1220" },
      { property: "og:title", content: "Knox — Book recreational venues" },
      { property: "og:description", content: "Real-time availability for padel, snooker, pool, darts and more." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />
      <Outlet />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}

function AuthSync() {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Fire-and-forget; never await inside the callback.
      window.setTimeout(() => {
        void (async () => {
          if (event === "SIGNED_OUT") {
            qc.clear();
            window.sessionStorage.removeItem("knox_auth_redirect");
            if (window.location.pathname !== "/") {
              await router.navigate({ to: "/", replace: true });
            }
            return;
          }
          if (event === "SIGNED_IN" && session?.user) {
            const path = window.location.pathname;
            const stored = window.sessionStorage.getItem("knox_auth_redirect");
            // Only redirect from auth pages or when an explicit redirect was stored.
            if (stored || path === "/login" || path === "/signup") {
              window.sessionStorage.removeItem("knox_auth_redirect");
              const { resolveLandingTarget } = await import("@/lib/auth-redirect");
              const target = await resolveLandingTarget(stored);
              const here = window.location.pathname + window.location.search;
              if (target && target !== here && target !== path) {
                await router.navigate({ href: target, replace: true });
              }
              return;
            }
            qc.invalidateQueries();
          }
          // Intentionally ignore INITIAL_SESSION / TOKEN_REFRESHED / USER_UPDATED
          // — they fire on mount and background refresh; navigating on them
          // causes a replaceState loop.
        })();
      }, 0);
    });
    return () => subscription.unsubscribe();
  }, [router, qc]);
  return null;
}

