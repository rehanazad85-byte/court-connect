import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PhoneShell } from "@/components/PhoneShell";
import { useAuth } from "@/hooks/use-auth";
import { Building2, LogOut, User, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Knox" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();

  return (
    <PhoneShell>
      <div className="px-5 pt-7">
        <h1 className="text-2xl font-bold">Profile</h1>
      </div>

      <div className="px-5 pt-6 space-y-3">
        {loading ? (
          <div className="h-20 animate-pulse rounded-2xl bg-muted" />
        ) : user ? (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                <User className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">{user.user_metadata?.display_name ?? user.email}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </div>
            </div>

            <Link to="/bookings" className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted"><Building2 className="h-4 w-4" /></div>
              <div className="flex-1 text-sm font-semibold">My bookings</div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link to="/vendor" className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary"><Building2 className="h-4 w-4" /></div>
              <div className="flex-1">
                <div className="text-sm font-semibold">List your venue</div>
                <div className="text-xs text-muted-foreground">Become a Knox vendor</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <button onClick={async () => { await signOut(); nav({ to: "/" }); }} className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 shadow-soft text-destructive">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-destructive/10"><LogOut className="h-4 w-4" /></div>
              <div className="flex-1 text-left text-sm font-semibold">Sign out</div>
            </button>
          </>
        ) : (
          <div className="rounded-2xl bg-card p-6 text-center shadow-soft">
            <p className="text-sm text-muted-foreground">Sign in to manage bookings and list venues.</p>
            <div className="mt-4 flex gap-2 justify-center">
              <Link to="/login" className="rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground">Sign in</Link>
              <Link to="/signup" className="rounded-full border px-5 py-2 text-xs font-bold">Sign up</Link>
            </div>
          </div>
        )}
      </div>
    </PhoneShell>
  );
}
