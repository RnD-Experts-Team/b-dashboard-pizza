"use client";

import { useMemo } from "react";
import type { ManagerHubData, HubSection } from "@/lib/hooks/use-manager-hub";
import {
  cleaningBacklog,
  countEntries,
  debriefBacklog,
  hubSeverity,
  mergeBacklog,
  openTasks,
  todayMissing,
  unfilledDebriefs,
  type HubSeverity,
  type MissingDay,
  type MissingEntry,
} from "@/lib/manager-hub/missing";
import { flattenEmployeeDebriefs, type DatedEmployeeDebrief } from "@/lib/manager-hub/employee-debriefs";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Everything the alert, the KPI strip and the tabs count — derived once.   */
/* ────────────────────────────────────────────────────────────────────────── */

export interface HubSummary {
  severity: HubSeverity;
  /** At least one tracked section failed — counts may be incomplete. */
  partial: boolean;
  today: MissingEntry[];
  debriefsTotal: number;
  debriefsMissing: number;
  tasksTotal: number;
  tasksOpen: number;
  tasksOverdue: number;
  todayDone: number;
  todayTotal: number;
  debriefsReady: boolean;
  tasksReady: boolean;
  debriefBacklog: MissingDay[];
  cleaningBacklog: MissingDay[];
  backlog: MissingDay[];
  backlogDebriefs: number;
  backlogTasks: number;
  backlogCount: number;
  backlogReady: boolean;
  employeeDebriefs: DatedEmployeeDebrief[];
  employeeToday: number;
  employeeReady: boolean;
}

/** Loaded or failed — either way, nothing more is coming for now. */
function settled(s: HubSection<unknown>): boolean {
  return !s.enabled || (!s.loading && (s.data != null || s.error != null));
}

export function useHubSummary(data: ManagerHubData): HubSummary {
  const { anchor, canSeeCleaning, debriefsToday, debriefsBacklog, cleaningToday, cleaningBacklog: clBacklog, employeeDebriefs } =
    data;

  return useMemo(() => {
    const dkItems = debriefsToday.data?.items ?? null;
    const clItems = canSeeCleaning ? (cleaningToday.data?.items ?? null) : [];
    const today = todayMissing(dkItems, clItems, anchor);
    const dBacklog = debriefBacklog(debriefsBacklog.data);
    const cBacklog = canSeeCleaning ? cleaningBacklog(clBacklog.data?.days, anchor) : [];
    const backlog = mergeBacklog(dBacklog, cBacklog);

    const debriefsTotal = dkItems?.length ?? 0;
    const debriefsMissing = unfilledDebriefs(dkItems).length;
    const tasksTotal = clItems?.length ?? 0;
    const tasksOpen = openTasks(clItems).length;
    const tasksOverdue = (clItems ?? []).filter((i) => i.status === "overdue").length;

    const tracked = [debriefsToday, debriefsBacklog, ...(canSeeCleaning ? [cleaningToday, clBacklog] : [])];
    const ready = tracked.every(settled);
    const partial = tracked.some((s) => s.error != null);
    const backlogCount = countEntries(backlog);

    const employee = flattenEmployeeDebriefs(employeeDebriefs.data);

    return {
      severity: hubSeverity({
        ready,
        today: today.length,
        backlog: backlogCount,
        anyOverdueToday: tasksOverdue > 0,
      }),
      partial,
      today,
      debriefsTotal,
      debriefsMissing,
      tasksTotal,
      tasksOpen,
      tasksOverdue,
      todayDone: debriefsTotal - debriefsMissing + (tasksTotal - tasksOpen),
      todayTotal: debriefsTotal + tasksTotal,
      debriefsReady: debriefsToday.data != null,
      tasksReady: !canSeeCleaning || cleaningToday.data != null,
      debriefBacklog: dBacklog,
      cleaningBacklog: cBacklog,
      backlog,
      backlogDebriefs: countEntries(dBacklog),
      backlogTasks: countEntries(cBacklog),
      backlogCount,
      backlogReady: settled(debriefsBacklog) && (!canSeeCleaning || settled(clBacklog)),
      employeeDebriefs: employee,
      employeeToday: employee.filter((e) => e.day === anchor).length,
      employeeReady: employeeDebriefs.data != null,
    };
  }, [anchor, canSeeCleaning, debriefsToday, debriefsBacklog, cleaningToday, clBacklog, employeeDebriefs]);
}
