const RESOURCE_MAP: Record<string, [string, string]> = {
  padel:      ["Court",  "Courts"],
  tennis:     ["Court",  "Courts"],
  pickleball: ["Court",  "Courts"],
  snooker:    ["Table",  "Tables"],
  pool:       ["Table",  "Tables"],
  darts:      ["Board",  "Boards"],
  football:   ["Pitch",  "Pitches"],
};

/**
 * Returns the capitalized resource label for a venue's activity.
 * Pass count=1 for singular, any other number for plural.
 * Falls back to "Resource" / "Resources" for unknown activities.
 *
 * @example
 * resourceLabel("snooker")      // "Table"
 * resourceLabel("snooker", 2)   // "Tables"
 * resourceLabel("football", 11) // "Pitches"
 */
export function resourceLabel(
  activity: string | null | undefined,
  count = 1,
): string {
  const [s, p] = RESOURCE_MAP[(activity ?? "").toLowerCase()] ?? ["Resource", "Resources"];
  return count === 1 ? s : p;
}
