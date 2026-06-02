import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { PendingScreen } from "./components/PendingScreen";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[router-default-error]", error);
  const route = typeof window === "undefined" ? "server" : `${window.location.pathname}${window.location.search}`;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <div className="mt-4 rounded-2xl border border-dashed bg-muted/40 p-3 text-left text-[11px] text-muted-foreground">
          <div className="font-semibold text-foreground">error.message</div>
          <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-2">{error.message || "Unknown error"}</pre>
          <div className="mt-2 font-semibold text-foreground">route</div>
          <pre className="mt-1 max-h-16 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-2">{route}</pre>
          <div className="mt-2 font-semibold text-foreground">error stack</div>
          <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap rounded-xl bg-background p-2">{error.stack ?? "No stack available"}</pre>
        </div>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => reset()} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Try again</button>
          <a href="/" className="rounded-full border px-5 py-2.5 text-sm font-semibold">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: () => <PendingScreen />,
    defaultErrorComponent: DefaultErrorComponent,
    defaultPendingMs: 200,
  });

  return router;
};
