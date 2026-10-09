/**
 * Calendar-day helpers only. Nothing here knows about accounting weeks — those
 * always come from the server's `weeks` list (contract rule 1).
 */

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayIso(): string {
  return toIso(new Date());
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toIso(new Date(y, m - 1, d + days));
}

export function tomorrowIso(): string {
  return addDaysIso(todayIso(), 1);
}

/** Every calendar day from `from` to `to`, inclusive — for server-given week bounds. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let cur = from; cur <= to && out.length < 62; cur = addDaysIso(cur, 1)) out.push(cur);
  return out;
}
