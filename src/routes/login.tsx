import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { resolveLandingTarget } from "@/lib/auth-redirect";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      const target = await resolveLandingTarget(search.redirect);
      throw redirect({ href: target });
    }
  },
  head: () => ({ meta: [{ title: "Sign in — Knox" }] }),
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await snapshotAuthDebug("email login started", { requestedRedirect: search.redirect ?? null });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        logAuthDebug("email login failed", { authError: error.message });
        return toast.error(error.message);
      }
      const target = await resolveLandingTarget(search.redirect);
      await snapshotAuthDebug("email login success", { target });
      nav({ href: target, replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-ink text-ink-foreground">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-12 pb-8">
        <Link to="/" className="text-2xl font-bold tracking-tight">Knox</Link>
        <div className="mt-12">
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm text-white/70">Sign in to book and manage sessions.</p>
        </div>

        <form onSubmit={onEmail} className="mt-8 space-y-3">
          <input className="h-12 w-full rounded-xl bg-white/5 px-4 text-sm outline-none placeholder:text-white/40 focus:bg-white/10" placeholder="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="h-12 w-full rounded-xl bg-white/5 px-4 text-sm outline-none placeholder:text-white/40 focus:bg-white/10" placeholder="Password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button disabled={busy} type="submit" className="h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60">Sign in</button>
        </form>

        <p className="mt-6 text-center text-sm text-white/60">No account? <Link to="/signup" className="font-semibold text-primary">Create one</Link></p>
      </div>
      <AuthDebugPanel title="Login auth debug" />
    </div>
  );
}
