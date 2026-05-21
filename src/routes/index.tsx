import { createFileRoute, Link } from "@tanstack/react-router";
import { Menu, Search, MapPin, Calendar, Users, MessageCircle } from "lucide-react";
import heroImg from "@/assets/hero-padel.jpg";
import { PhoneShell } from "@/components/PhoneShell";
import { activities } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Knox — Book Padel, Snooker, Pool & More" },
      { name: "description", content: "Instant bookings, real-time availability. Play your game, your way." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <PhoneShell>
      {/* Dark hero */}
      <section className="relative overflow-hidden bg-ink text-ink-foreground">
        <img
          src={heroImg}
          alt="Padel player at sunset"
          width={1024}
          height={1280}
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/60 to-ink" />
        <div className="relative px-5 pt-5 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KnoxMark />
              <span className="text-lg font-bold tracking-tight">Knox</span>
            </div>
            <Menu className="h-6 w-6" />
          </div>

          <p className="mt-10 text-[11px] font-semibold tracking-[0.2em] text-primary">
            PLAY MORE. BOOK EASY.
          </p>
          <h1 className="mt-2 text-[34px] font-bold leading-[1.05]">
            Book Padel<br />Courts,<br />Snooker Tables<br />&amp; More
          </h1>
          <p className="mt-3 text-sm text-white/70">
            Instant bookings.<br />
            Real-time availability.<br />
            Play your game, your way.
          </p>

          {/* Search card */}
          <div className="mt-5 rounded-2xl bg-card text-card-foreground shadow-pop">
            <SearchRow icon={MessageCircle} label="What are you looking for?" value="Padel Tennis" />
            <SearchRow icon={MapPin} label="Location" value="Manchester, UK" />
            <SearchRow icon={Calendar} label="Date" value="Sat, 24 May" />
            <SearchRow icon={Users} label="Players" value="2 Players" />
            <div className="p-2">
              <Link
                to="/activity/$activity"
                params={{ activity: "padel" }}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition active:scale-[.98]"
              >
                <Search className="h-4 w-4" />
                Search
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Popular activities */}
      <section className="px-5 pt-6 pb-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Popular activities</h2>
          <Link to="/activity/$activity" params={{ activity: "padel" }} className="text-xs font-semibold text-primary">
            See all
          </Link>
        </div>
        <div className="mt-3 -mx-5 overflow-x-auto px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-3 pb-2">
            {activities.map((a) => (
              <Link
                key={a.id}
                to="/activity/$activity"
                params={{ activity: a.id }}
                className="group w-[110px] shrink-0"
              >
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                  <img
                    src={a.image}
                    alt={a.name}
                    width={600}
                    height={600}
                    loading="lazy"
                    className="h-full w-full object-cover transition group-active:scale-95"
                  />
                </div>
                <div className="mt-2 text-[13px] font-semibold leading-tight">{a.name}</div>
                <div className="text-[11px] text-muted-foreground">{a.tagline}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PhoneShell>
  );
}

function SearchRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <button className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </button>
  );
}

function KnoxMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4v16M5 12l8-8M5 12l8 8" />
    </svg>
  );
}
