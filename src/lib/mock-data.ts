import activityPadel from "@/assets/activity-padel.jpg";
import activitySnooker from "@/assets/activity-snooker.jpg";
import activityPool from "@/assets/activity-pool.jpg";
import activityDarts from "@/assets/activity-darts.jpg";

export const activities = [
  { id: "padel", name: "Padel Tennis", tagline: "Book Courts", image: activityPadel },
  { id: "snooker", name: "Snooker", tagline: "Book Tables", image: activitySnooker },
  { id: "pool", name: "Pool", tagline: "Book Tables", image: activityPool },
  { id: "darts", name: "Darts", tagline: "Book Lanes", image: activityDarts },
];

export const ACTIVITY_LABELS: Record<string, string> = {
  padel: "Padel Tennis",
  snooker: "Snooker",
  pool: "Pool",
  darts: "Darts",
  "golf-sim": "Golf Simulator",
};

export function formatPence(p: number | null | undefined) {
  if (p == null) return "—";
  return `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;
}
