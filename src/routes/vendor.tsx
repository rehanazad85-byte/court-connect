import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Calendar, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PhoneShell } from "@/components/PhoneShell";
import { PendingScreen } from "@/components/PendingScreen";
import { listMyVenues, listVendorBookings, myRoles, claimVendor, createVenue, setVenuePublished, getVenueSettings, updateVenueSettings } from "@/lib/vendor.functions";
import { formatPence, ACTIVITY_LABELS } from "@/lib/mock-data";
import { formatDateTimeUTC } from "@/lib/date-utils";
import { toast } from "sonner";
import { NumberField } from "@/components/form/NumberField";

const rolesQuery = queryOptions({ queryKey: ["my-roles"], queryFn: () => myRoles() });
const myVenuesQuery = queryOptions({ queryKey: ["my-venues"], queryFn: () => listMyVenues() });
const vendorBookingsQuery = queryOptions({ queryKey: ["vendor-bookings"], queryFn: () => listVendorBookings() });

export const Route = createFileRoute("/vendor")({
  head: () => ({ meta: [{ title: "Vendor dashboard — Knox" }] }),
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login", search: { redirect: location.pathname } });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(rolesQuery),
  pendingComponent: () => <PendingScreen label="Loading vendor dashboard…" />,
  pendingMs: 0,
  component: () => (
    <Suspense fallback={<PendingScreen label="Loading vendor dashboard…" />}>
      <VendorPage />
    </Suspense>
  ),
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
  const qc = useQueryClient();
  const venues = useSuspenseQuery(myVenuesQuery);
  const bookings = useSuspenseQuery(vendorBookingsQuery);
  const togglePublish = useServerFn(setVenuePublished);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const now = Date.now();
  const upcoming = bookings.data.bookings.filter((b) => b.status === "confirmed" && new Date(b.starts_at).getTime() >= now);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const today = upcoming.filter((b) => new Date(b.starts_at).getTime() <= todayEnd.getTime());
  const revenue7d = bookings.data.bookings
    .filter((b) => b.status === "confirmed" && new Date(b.starts_at).getTime() >= now - 7 * 86400000)
    .reduce((s, b) => s + b.total_pence, 0);

  const onTogglePublish = async (venueId: string, next: boolean) => {
    try {
      await togglePublish({ data: { venueId, isPublished: next } });
      toast.success(next ? "Venue published" : "Venue unpublished");
      await qc.invalidateQueries({ queryKey: ["my-venues"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <PhoneShell>
      <div className="px-5 pt-7">
        <h1 className="text-2xl font-bold">Vendor</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage venues, courts and bookings.</p>
      </div>

      <div className="px-5 pt-5 grid grid-cols-3 gap-2">
        <Stat label="Today" value={String(today.length)} />
        <Stat label="Upcoming" value={String(upcoming.length)} />
        <Stat label="7-day rev" value={formatPence(revenue7d)} />
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
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No venues yet. Tap "New".</div>
          )}
          {venues.data.venues.map((v) => (
            <div key={v.id} className="rounded-2xl bg-card p-3 shadow-soft">
              <div className="flex items-center gap-3">
                {v.cover_image && <img src={v.cover_image} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold truncate">{v.name}</div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${v.is_published ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {v.is_published ? "Live" : "Draft"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {ACTIVITY_LABELS[v.activity] ?? v.activity} · {v.type} · {(v as any).resourceCount ?? 0} courts
                  </div>
                </div>
                <Link to="/venue/$venueId" params={{ venueId: v.id }} className="text-xs font-bold text-primary">View</Link>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 border-t pt-2 text-[11px] font-semibold">
                <button onClick={() => onTogglePublish(v.id, !v.is_published)} className="rounded-full border px-2.5 py-1 hover:bg-muted">
                  {v.is_published ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => setEditingId(editingId === v.id ? null : v.id)} className="rounded-full border px-2.5 py-1 hover:bg-muted">
                  {editingId === v.id ? "Close" : "Edit"}
                </button>
              </div>
              {editingId === v.id && <EditVenueForm venueId={v.id} onDone={() => setEditingId(null)} />}
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

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
      {help && <span className="mt-1 block text-[11px] text-muted-foreground">{help}</span>}
    </label>
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
    resourceCount: 4 as number | null,
    resourceKind: "court" as "court" | "table" | "lane" | "sim" | "board",
    pricePerHourPound: 30 as number | null,
    openHour: 7 as number | null,
    closeHour: 22 as number | null,
  });

  const sub = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const priceNum = form.pricePerHourPound;
      const resCount = form.resourceCount;
      const openH = form.openHour;
      const closeH = form.closeHour;
      if (priceNum == null || priceNum <= 0) throw new Error("Enter a valid price");
      if (resCount == null || resCount < 1) throw new Error("Enter number of resources");
      if (openH == null || closeH == null || closeH <= openH) throw new Error("Enter valid opening/closing hours");
      await create({
        data: {
          name: form.name,
          activity: form.activity,
          type: form.type,
          city: form.city || undefined,
          description: form.description || undefined,
          coverImage: form.coverImage || undefined,
          resourceCount: resCount,
          resourceKind: form.resourceKind,
          pricePerHourPence: Math.round(priceNum * 100),
          openMin: openH * 60,
          closeMin: closeH * 60,
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

  const cls = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary";


  return (
    <form onSubmit={sub} className="mt-3 space-y-3 rounded-2xl border bg-card p-4">
      <Field label="Business / Venue Name" help="This is the public name customers will see — not your personal name."><input required placeholder="e.g. Birmingham Padel Club" className={cls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Activity">
          <select className={cls} value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })}>
            <option value="padel">Padel</option><option value="snooker">Snooker</option>
            <option value="pool">Pool</option><option value="darts">Darts</option>
            <option value="golf-sim">Golf Sim</option>
          </select>
        </Field>
        <Field label="Type">
          <select className={cls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
            <option>Indoor</option><option>Outdoor</option>
          </select>
        </Field>
      </div>
      <Field label="City"><input className={cls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
      <Field label="Cover image URL"><input className={cls} placeholder="https://..." value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })} /></Field>
      <Field label="Description"><textarea className={`${cls} h-16 py-2`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="# of resources"><NumberField className={cls} min={1} max={40} value={form.resourceCount} onChange={(v) => setForm({ ...form, resourceCount: v })} /></Field>
        <Field label="Resource kind">
          <select className={cls} value={form.resourceKind} onChange={(e) => setForm({ ...form, resourceKind: e.target.value as any })}>
            <option value="court">Court</option><option value="table">Table</option>
            <option value="lane">Lane</option><option value="sim">Sim Bay</option><option value="board">Board</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="£ / hr"><NumberField className={cls} allowDecimal min={1} max={500} value={form.pricePerHourPound} onChange={(v) => setForm({ ...form, pricePerHourPound: v })} /></Field>
        <Field label="Opens (hr)"><NumberField className={cls} min={0} max={23} value={form.openHour} onChange={(v) => setForm({ ...form, openHour: v })} /></Field>
        <Field label="Closes (hr)"><NumberField className={cls} min={1} max={24} value={form.closeHour} onChange={(v) => setForm({ ...form, closeHour: v })} /></Field>
      </div>
      <button disabled={busy} className="h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60">{busy ? "Creating..." : "Create venue"}</button>
    </form>
  );
}

function EditVenueForm({ venueId, onDone }: { venueId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getVenueSettings);
  const updateFn = useServerFn(updateVenueSettings);
  const settingsQuery = useQuery({
    queryKey: ["venue-settings", venueId],
    queryFn: () => getFn({ data: { venueId } }),
  });
  const [form, setForm] = useState<{ name: string; city: string; description: string; coverImage: string; pricePerHourPound: string; openHour: string; closeHour: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (settingsQuery.isLoading) return <div className="mt-3 text-xs text-muted-foreground">Loading...</div>;
  if (settingsQuery.error) return <div className="mt-3 text-xs text-destructive">Failed to load</div>;
  const s = settingsQuery.data!;
  const f = form ?? {
    name: s.venue.name,
    city: s.venue.city ?? "",
    description: s.venue.description ?? "",
    coverImage: s.venue.cover_image ?? "",
    pricePerHourPound: (s.pricePerHourPence / 100).toString(),
    openHour: Math.floor(s.openMin / 60).toString(),
    closeHour: Math.floor(s.closeMin / 60).toString(),
  };

  const cls = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary";

  const sub = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const priceNum = parseFloat(f.pricePerHourPound);
      const openH = parseInt(f.openHour, 10);
      const closeH = parseInt(f.closeHour, 10);
      if (!Number.isFinite(priceNum) || priceNum <= 0) throw new Error("Enter a valid price");
      if (!Number.isFinite(openH) || !Number.isFinite(closeH) || closeH <= openH) throw new Error("Enter valid opening/closing hours");
      await updateFn({
        data: {
          venueId,
          name: f.name,
          city: f.city || undefined,
          description: f.description || undefined,
          coverImage: f.coverImage || undefined,
          pricePerHourPence: Math.round(priceNum * 100),
          openMin: openH * 60,
          closeMin: closeH * 60,
        },
      });
      toast.success("Venue updated");
      await qc.invalidateQueries({ queryKey: ["my-venues"] });
      await qc.invalidateQueries({ queryKey: ["venue", venueId] });
      await qc.invalidateQueries({ queryKey: ["venue-settings", venueId] });
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={sub} className="mt-3 space-y-3 rounded-2xl border bg-background p-3">
      <Field label="Business / Venue Name" help="This is the public name customers will see — not your personal name."><input required className={cls} value={f.name} onChange={(e) => setForm({ ...f, name: e.target.value })} /></Field>
      <Field label="City"><input className={cls} value={f.city} onChange={(e) => setForm({ ...f, city: e.target.value })} /></Field>
      <Field label="Cover image URL"><input className={cls} placeholder="https://..." value={f.coverImage} onChange={(e) => setForm({ ...f, coverImage: e.target.value })} /></Field>
      <Field label="Description"><textarea className={`${cls} h-16 py-2`} value={f.description} onChange={(e) => setForm({ ...f, description: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="£ / hr"><input type="text" inputMode="decimal" className={cls} value={f.pricePerHourPound} onChange={(e) => setForm({ ...f, pricePerHourPound: e.target.value.replace(/[^0-9.]/g, "") })} /></Field>
        <Field label="Opens (hr)"><input type="text" inputMode="numeric" pattern="[0-9]*" className={cls} value={f.openHour} onChange={(e) => setForm({ ...f, openHour: e.target.value.replace(/[^0-9]/g, "") })} /></Field>
        <Field label="Closes (hr)"><input type="text" inputMode="numeric" pattern="[0-9]*" className={cls} value={f.closeHour} onChange={(e) => setForm({ ...f, closeHour: e.target.value.replace(/[^0-9]/g, "") })} /></Field>
      </div>
      <button disabled={busy} className="h-11 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60">{busy ? "Saving..." : "Save changes"}</button>
    </form>
  );
}
