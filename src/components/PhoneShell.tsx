import { BottomNav } from "./BottomNav";

/** Mobile-first canvas. Centers a 28rem column on desktop and pins bottom nav. */
export function PhoneShell({
  children,
  hideNav,
  variant = "light",
}: {
  children: React.ReactNode;
  hideNav?: boolean;
  variant?: "light" | "dark";
}) {
  return (
    <div className={variant === "dark" ? "min-h-dvh bg-ink overflow-x-hidden" : "min-h-dvh bg-surface-muted overflow-x-hidden"}>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background shadow-pop overflow-x-hidden">
        <div className="flex-1 min-w-0">{children}</div>
        {!hideNav && <BottomNav />}
      </div>
    </div>
  );
}
