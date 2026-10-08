/* ────────────────────────────────────────────────────────────────────────── */
/*  Secondary redirects — the full page, landing on the exact spot.          */
/*  The primary path for every hub action is the floating debrief panel;     */
/*  these are for when the manager wants the whole page instead.             */
/*                                                                            */
/*  Each target reads its params once on arrival:                            */
/*   - cleaning-chart/page.tsx          ?tab=due&date=YYYY-MM-DD&task=ID      */
/*   - employee-debrief-history/page.tsx ?store=CODE&employee=ID               */
/* ────────────────────────────────────────────────────────────────────────── */

export function cleaningChartHref(locale: string, opts: { date: string; taskId?: number | null }): string {
  const q = new URLSearchParams({ tab: "due", date: opts.date });
  if (opts.taskId != null) q.set("task", String(opts.taskId));
  return `/${locale}/dashboard/cleaning-chart?${q.toString()}`;
}

export function employeeHistoryHref(
  locale: string,
  opts: { storeCode: string | null; employeeId?: number | null },
): string {
  const q = new URLSearchParams();
  if (opts.storeCode) q.set("store", opts.storeCode);
  if (opts.employeeId != null) q.set("employee", String(opts.employeeId));
  const qs = q.toString();
  return `/${locale}/dashboard/employee-debrief-history${qs ? `?${qs}` : ""}`;
}
