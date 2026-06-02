import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Component, useEffect, useRef, type ErrorInfo, type ReactNode } from "react";
import { Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bookingStore } from "@/lib/booking-store";


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

function currentPath() {
  if (typeof window === "undefined") return "server";
  return `${window.location.pathname}${window.location.search}`;
}

function ErrorComponent({ error, reset, info }: { error: Error; reset: () => void; info?: { componentStack?: string } }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">The app caught the crash instead of showing a blank page.</p>
        <CrashDetails error={error} componentStack={info?.componentStack} />
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

class GlobalReactErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; componentStack: string | null }> {
  state = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error) {
    return { error, componentStack: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[global-react-error-boundary]", { error, componentStack: info.componentStack, route: currentPath() });
    this.setState({ error, componentStack: info.componentStack ?? null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">A crash was caught before the app went blank.</p>
          <CrashDetails error={this.state.error} componentStack={this.state.componentStack} />
          <div className="mt-6 flex justify-center gap-2">
            <button onClick={() => window.location.reload()} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Refresh</button>
            <a href="/" className="rounded-full border px-5 py-2.5 text-sm font-semibold">Go home</a>
          </div>
        </div>
      </div>
    );
  }
}

function CrashDetails({ error, componentStack }: { error: Error; componentStack?: string | null }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed bg-muted/40 p-3 text-left text-[11px] text-muted-foreground">
      <DebugLine label="error.message" value={error.message || "Unknown error"} />
      <DebugLine label="route" value={currentPath()} />
      <DebugLine label="pathname" value={typeof window === "undefined" ? "server" : window.location.pathname} />
      <DebugLine label="search params" value={typeof window === "undefined" ? "" : window.location.search || "none"} />
      <div className="mt-2 font-semibold text-foreground">component stack</div>
      <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-2">{componentStack || "Not provided by React/TanStack for this error"}</pre>
      <div className="mt-2 font-semibold text-foreground">error stack</div>
      <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-2">{error.stack ?? "No stack available"}</pre>
    </div>
  );
}

function DebugLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1 flex items-start justify-between gap-3">
      <span>{label}</span>
      <span className="max-w-[58%] break-words text-right font-mono font-semibold text-foreground">{value}</span>
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
      <GlobalReactErrorBoundary>
        <AuthSync />
        <Outlet />
        <Toaster position="top-center" richColors />
      </GlobalReactErrorBoundary>
    </QueryClientProvider>
  );
}

function AuthSync() {
  const router = useRouter();
  const qc = useQueryClient();
  const lastUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Fire-and-forget; never await inside the callback.
      window.setTimeout(() => {
        void (async () => {
          const nextUserId = session?.user?.id ?? null;
          if (nextUserId && lastUserIdRef.current && nextUserId !== lastUserIdRef.current) {
            qc.clear();
            bookingStore.reset();
          }
          if (nextUserId) lastUserIdRef.current = nextUserId;
          if (event === "SIGNED_OUT") {
            qc.clear();
            bookingStore.reset();
            lastUserIdRef.current = null;
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

