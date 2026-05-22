import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Create account — Knox" }] }),
  component: SignupPage,
});

function SignupPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name }, emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome to Knox!");
    nav({ to: "/" });
  };

  return (
    <div className="min-h-dvh bg-ink text-ink-foreground">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-12 pb-8">
        <Link to="/" className="text-2xl font-bold tracking-tight">Knox</Link>
        <div className="mt-12">
          <h1 className="text-3xl font-bold">Create your account</h1>
          <p className="mt-2 text-sm text-white/70">Book courts, tables and lanes in seconds.</p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-3">
          <input className="h-12 w-full rounded-xl bg-white/5 px-4 text-sm outline-none placeholder:text-white/40 focus:bg-white/10" placeholder="Your name" required value={name} onChange={(e) => setName(e.target.value)} />
          <input className="h-12 w-full rounded-xl bg-white/5 px-4 text-sm outline-none placeholder:text-white/40 focus:bg-white/10" placeholder="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="h-12 w-full rounded-xl bg-white/5 px-4 text-sm outline-none placeholder:text-white/40 focus:bg-white/10" placeholder="Password (min 6)" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button disabled={busy} type="submit" className="h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60">Create account</button>
        </form>

        <p className="mt-6 text-center text-sm text-white/60">Already have an account? <Link to="/login" className="font-semibold text-primary">Sign in</Link></p>
      </div>
    </div>
  );
}
