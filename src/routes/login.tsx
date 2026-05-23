import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getUser();
    const target = search.redirect && search.redirect.startsWith("/") ? search.redirect : "/";
    if (data.user) throw redirect({ to: target });
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    nav({ to: search.redirect ?? "/" });
  };

  const onGoogle = async () => {
    setBusy(true);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + (search.redirect ?? "/") });
    setBusy(false);
    if (res?.error) toast.error(res.error.message ?? "Sign-in failed");
  };

  return (
    <div className="min-h-dvh bg-ink text-ink-foreground">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-12 pb-8">
        <Link to="/" className="text-2xl font-bold tracking-tight">Knox</Link>
        <div className="mt-12">
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm text-white/70">Sign in to book and manage sessions.</p>
        </div>

        <button onClick={onGoogle} disabled={busy} className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white text-sm font-semibold text-black disabled:opacity-60">
          <GoogleIcon /> Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-[11px] text-white/40">
          <div className="h-px flex-1 bg-white/10" /> OR <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={onEmail} className="space-y-3">
          <input className="h-12 w-full rounded-xl bg-white/5 px-4 text-sm outline-none placeholder:text-white/40 focus:bg-white/10" placeholder="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="h-12 w-full rounded-xl bg-white/5 px-4 text-sm outline-none placeholder:text-white/40 focus:bg-white/10" placeholder="Password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button disabled={busy} type="submit" className="h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60">Sign in</button>
        </form>

        <p className="mt-6 text-center text-sm text-white/60">No account? <Link to="/signup" className="font-semibold text-primary">Create one</Link></p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5"><path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h6c-.3 1.4-1 2.5-2.2 3.3v2.7h3.6c2.1-2 3.3-4.9 3.3-7.9z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.3 1.1-3.7 1.1-2.8 0-5.2-1.9-6.1-4.5H2.2v2.8C4 20.7 7.7 23 12 23z"/><path fill="#FBBC04" d="M5.9 14.2C5.7 13.5 5.6 12.8 5.6 12s.1-1.5.3-2.2V7H2.2C1.4 8.5 1 10.2 1 12s.4 3.5 1.2 5z"/><path fill="#EA4335" d="M12 5.5c1.6 0 3 .5 4.1 1.6l3.1-3.1C17.5 2.2 15 1 12 1 7.7 1 4 3.3 2.2 7l3.7 2.8c.9-2.6 3.3-4.3 6.1-4.3z"/></svg>
  );
}
