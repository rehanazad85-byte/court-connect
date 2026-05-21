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
    <div className={variant === "dark" ? "min-h-dvh bg-ink" : "min-h-dvh bg-surface-muted"}>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background shadow-pop">
        <div className="flex-1">{children}</div>
        {!hideNav && <BottomNav />}
      </div>
    </div>
  );
}
