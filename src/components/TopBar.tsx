import { Link, type LinkProps } from "@tanstack/react-router";
import { ChevronLeft, SlidersHorizontal, Heart } from "lucide-react";

export function TopBar({
  title,
  subtitle,
  back = "/",
  right,
  tone = "light",
}: {
  title: string;
  subtitle?: string;
  back?: LinkProps["to"] | LinkProps;
  right?: "filters" | "heart" | null;
  tone?: "light" | "dark";
}) {
  const text = tone === "dark" ? "text-ink-foreground" : "text-foreground";
  const sub = tone === "dark" ? "text-primary" : "text-primary";
  const backProps = typeof back === "string" ? { to: back } : back;
  return (
    <div className={`flex items-center justify-between px-4 pt-5 pb-3 ${text}`}>
      <Link {...backProps} className="flex h-11 w-11 items-center justify-center -ml-2 shrink-0">
        <ChevronLeft className="h-6 w-6" />
      </Link>
      <div className="flex-1 min-w-0 text-center px-1">
        <div className="text-[15px] font-semibold leading-tight truncate">{title}</div>
        {subtitle && <div className={`text-xs ${sub} font-medium truncate`}>{subtitle}</div>}
      </div>
      <div className="flex h-11 w-11 items-center justify-center -mr-2 shrink-0">
        {right === "filters" && <SlidersHorizontal className="h-5 w-5" />}
        {right === "heart" && <Heart className="h-5 w-5" />}
      </div>
    </div>
  );
}
