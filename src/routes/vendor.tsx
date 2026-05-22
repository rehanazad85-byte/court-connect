import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Calendar, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PhoneShell } from "@/components/PhoneShell";
import { listMyVenues, listVendorBookings, myRoles, claimVendor, createVenue } from "@/lib/vendor.functions";
import { formatPence, ACTIVITY_LABELS } from "@/lib/mock-data";
import { formatDateTimeUTC } from "@/lib/date-utils";
import { toast } from "sonner";

const rolesQuery = queryOptions({ queryKey: ["my-roles"], queryFn: () => myRoles() });
const myVenuesQuery = queryOptions({ queryKey: ["my-venues"], queryFn: () => listMyVenues() });
const vendorBookingsQuery = queryOptions({ queryKey: ["vendor-bookings"], queryFn: () => listVendorBookings() });

export const Route = createFileRoute("/vendor")({
  head: () => ({ meta: [{ title: "Vendor dashboard — Knox" }] }),
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(rolesQuery),
  component: VendorPage,
});

function VendorPage() {
  const qc = useQueryClient();
  const claim = useServerFn(claimVendor);
  const { data: roles } = useSuspenseQuery(rolesQuery);
  const isVendor = roles.roles.includes("vendor");

  if (!isVendor) {
    return (
      <PhoneShell>
        <div className="px-5 pt-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">List your venue on Knox</h1>
          <p className="mt-2 text-sm text-muted-foreground">Padel, snooker, pool, darts, golf sims — set hours and pricing, accept bookings in real time.</p>
          <button
            onClick={async () => {
              try {
                await claim();
                await qc.invalidateQueries({ queryKey: ["my-roles"] });
                toast.success("You're now a Knox vendor");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground"
          >
            Become a vendor
          </button>
        </div>
      </PhoneShell>
    );
  }

  return <VendorDashboard />;
}

function VendorDashboard() {
  const venues = useSuspenseQuery(myVenuesQuery);
  const bookings = useSuspenseQuery(vendorBookingsQuery);
  const [showCreate, setShowCreate] = useState(false);

  const now = Date.now();
  const upcoming = bookings.data.bookings.filter((b) => b.status === "confirmed" && new Date(b.starts_at).getTime() >= now);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const today = upcoming.filter((b) => new Date(b.starts_at).getTime() <= todayEnd.getTime());
  const revenue7d = bookings.data.bookings
    .filter((b) => b.status === "confirmed" && new Date(b.starts_at).getTime() >= now - 7 * 86400000)
    .reduce((s, b) => s + b.total_pence, 0);

  return (
    <PhoneShell>
      <div className="px-5 pt-7">
        <h1 className="text-2xl font-bold">Vendor</h1>
        <p className="mt-1 text-sm text-muted-foreground">Today: {today.length} sessions · Week: {formatPence(revenue7d)}</p>
      </div>

      <div className="px-5 pt-6 grid grid-cols-2 gap-3">
        <Stat label="Venues" value={String(venues.data.venues.length)} />
        <Stat label="Upcoming" value={String(upcoming.length)} />
      </div>

      <div className="px-5 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">My venues</h2>
          <button onClick={() => setShowCreate((s) => !s)} className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>

        {showCreate && <CreateVenueForm onDone={() => setShowCreate(false)} />}

        <div className="mt-3 space-y-2">
          {venues.data.venues.length === 0 && (
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No venues yet. Tap “New”.</div>
          )}
          {venues.data.venues.map((v) => (
            <div key={v.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
              {v.cover_image && <img src={v.cover_image} alt="" className="h-12 w-12 rounded-lg object-cover" />}
              <div className="flex-1">
                <div className="text-sm font-bold">{v.name}</div>
                <div className="text-xs text-muted-foreground">{ACTIVITY_LABELS[v.activity] ?? v.activity} · {v.type} · {v.is_published ? "Live" : "Draft"}</div>
              </div>
              <Link to="/venue/$venueId" params={{ venueId: v.id }} className="text-xs font-bold text-primary">View</Link>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 pt-7 pb-8">
        <h2 className="text-base font-bold">Upcoming bookings</h2>
        <div className="mt-3 space-y-2">
          {upcoming.length === 0 && <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing booked yet.</div>}
          {upcoming.slice(0, 20).map((b) => {
            const v = bookings.data.venues.find((x) => x.id === b.venue_id);
            return (
              <div key={b.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary"><Calendar className="h-4 w-4" /></div>
                <div className="flex-1">
                  <div className="text-sm font-bold">{v?.name}</div>
                  <div className="text-xs text-muted-foreground">{formatDateTimeUTC(b.starts_at)} · {b.players} players</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-primary">{formatPence(b.total_pence)}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">{b.reference}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PhoneShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function CreateVenueForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const create = useServerFn(createVenue);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    activity: "padel",
    type: "Indoor" as "Indoor" | "Outdoor",
    city: "",
    description: "",
    coverImage: "",
    resourceCount: 4,
    resourceKind: "court" as "court" | "table" | "lane" | "sim" | "board",
    pricePerHourPound: 30,
    openMin: 7 * 60,
    closeMin: 22 * 60,
  });

  const sub = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await create({
        data: {
          name: form.name,
          activity: form.activity,
          type: form.type,
          city: form.city || undefined,
          description: form.description || undefined,
          coverImage: form.coverImage || undefined,
          resourceCount: form.resourceCount,
          resourceKind: form.resourceKind,
          pricePerHourPence: Math.round(form.pricePerHourPound * 100),
          openMin: form.openMin,
          closeMin: form.closeMin,
        },
      });
      toast.success("Venue created");
      await qc.invalidateQueries({ queryKey: ["my-venues"] });
      await qc.invalidateQueries({ queryKey: ["venues", "all"] });
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const Input = (p: { label: string; children: React.ReactNode }) => (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{p.label}</span>
      <div className="mt-1">{p.children}</div>
    </label>
  );
  const cls = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary";

  return (
    <form onSubmit={sub} className="mt-3 space-y-3 rounded-2xl border bg-card p-4">
      <Input label="Name"><input required className={cls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Input>
      <div className="grid grid-cols-2 gap-2">
        <Input label="Activity">
          <select className={cls} value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })}>
            <option value="padel">Padel</option><option value="snooker">Snooker</option>
            <option value="pool">Pool</option><option value="darts">Darts</option>
            <option value="golf-sim">Golf Sim</option>
          </select>
        </Input>
        <Input label="Type">
          <select className={cls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
            <option>Indoor</option><option>Outdoor</option>
          </select>
        </Input>
      </div>
      <Input label="City"><input className={cls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Input>
      <Input label="Cover image URL"><input className={cls} placeholder="https://..." value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })} /></Input>
      <Input label="Description"><textarea className={`${cls} h-16 py-2`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Input>
      <div className="grid grid-cols-2 gap-2">
        <Input label="# of resources"><input type="number" min={1} max={40} className={cls} value={form.resourceCount} onChange={(e) => setForm({ ...form, resourceCount: +e.target.value })} /></Input>
        <Input label="Resource kind">
          <select className={cls} value={form.resourceKind} onChange={(e) => setForm({ ...form, resourceKind: e.target.value as any })}>
            <option value="court">Court</option><option value="table">Table</option>
            <option value="lane">Lane</option><option value="sim">Sim Bay</option><option value="board">Board</option>
          </select>
        </Input>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Input label="£ / hr"><input type="number" min={1} className={cls} value={form.pricePerHourPound} onChange={(e) => setForm({ ...form, pricePerHourPound: +e.target.value })} /></Input>
        <Input label="Opens (hr)"><input type="number" min={0} max={24} className={cls} value={form.openMin / 60} onChange={(e) => setForm({ ...form, openMin: +e.target.value * 60 })} /></Input>
        <Input label="Closes (hr)"><input type="number" min={1} max={24} className={cls} value={form.closeMin / 60} onChange={(e) => setForm({ ...form, closeMin: +e.target.value * 60 })} /></Input>
      </div>
      <button disabled={busy} className="h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60">{busy ? "Creating..." : "Create venue"}</button>
    </form>
  );
}
