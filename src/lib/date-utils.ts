const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function nextDays(n: number, from = new Date()) {
  const base = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base.getTime() + i * 86400000);
    const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    return {
      iso,
      dow: DOW[d.getUTCDay()],
      day: String(d.getUTCDate()),
      mon: MON[d.getUTCMonth()],
      label: `${DOW[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`,
    };
  });
}

export function combineISO(dateISO: string, time: string) {
  const [hh, mm] = time.split(":").map(Number);
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0)).toISOString();
}

export function addMinutesToTime(time: string, min: number) {
  const [hh, mm] = time.split(":").map(Number);
  const total = (hh * 60 + mm + min) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function formatDateTimeUTC(iso: string) {
  const d = new Date(iso);
  return `${DOW[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]} · ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
