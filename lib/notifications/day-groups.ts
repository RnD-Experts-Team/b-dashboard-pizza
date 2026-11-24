/**
 * Split a newest-first notification list into "Today" / "Yesterday" /
 * "Earlier" for the bell drawer. Days are the viewer's local calendar days;
 * `created_at` is a full timestamp, never a date-only string. Order inside a
 * group is kept, and empty groups are left out.
 */

export type DayGroupKey = "today" | "yesterday" | "earlier";

export interface DayGroup<T> {
  key: DayGroupKey;
  items: T[];
}

export function groupByDay<T extends { created_at: string }>(
  items: readonly T[],
  now: Date = new Date()
): DayGroup<T>[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();

  const buckets: Record<DayGroupKey, T[]> = { today: [], yesterday: [], earlier: [] };
  for (const item of items) {
    const t = new Date(item.created_at).getTime();
    // An unparseable or future timestamp still belongs somewhere: "today".
    if (!Number.isFinite(t) || t >= startOfToday) buckets.today.push(item);
    else if (t >= startOfYesterday) buckets.yesterday.push(item);
    else buckets.earlier.push(item);
  }

  return (["today", "yesterday", "earlier"] as const)
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({ key, items: buckets[key] }));
}
