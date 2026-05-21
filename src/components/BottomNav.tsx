import { Link, useRouterState } from "@tanstack/react-router";
import { Home, CalendarDays, Heart, User } from "lucide-react";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/bookings", label: "Bookings", icon: CalendarDays },
  { to: "/favorites", label: "Favorites", icon: Heart },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="sticky bottom-0 z-30 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {tabs.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? path === "/" : path.startsWith(to);
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
