"use client";

import { useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useDebriefActionStore } from "@/lib/store/debrief-action.store";
import { cleaningChartHref, employeeHistoryHref } from "@/lib/manager-hub/links";
import type { DueItem } from "@/types/cleaning.types";
import type { DueKeyItem } from "@/types/due-key.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Every hub action, in one place. The hub itself is read-only:             */
/*   1. PRIMARY — the floating debrief panel, opened on the exact item/day.  */
/*      Its bubble is hidden on this page, but the panel opens on request.   */
/*   2. SECONDARY — the full page, landing on the same spot (deep link).     */
/*  When the panel isn't available (no debrief-create permission) a cleaning */
/*  action falls back to the page, and a debrief action explains why not.    */
/* ────────────────────────────────────────────────────────────────────────── */

export interface HubActions {
  panelAvailable: boolean;
  /** Fill / edit one debrief value — opens the value sheet on that key + day. */
  fillDebrief: (item: DueKeyItem, date: string) => void;
  /** The panel's Debrief tab on a day (e.g. to "Fill all"). */
  openDebriefs: (date: string) => void;
  /** Complete one cleaning task — the panel's Cleaning tab, form open. */
  doTask: (item: DueItem, date: string) => void;
  /** The panel's Cleaning tab on a day. */
  openCleaning: (date: string) => void;
  /** The panel's Employee Debrief form. */
  addEmployeeDebrief: () => void;
  goCleaningChart: (date: string, taskId?: number | null) => void;
  goEmployeeHistory: (employeeId?: number | null) => void;
}

export function useHubActions(storeCode: string | null): HubActions {
  const t = useTranslations("managerHub.actions");
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const panelAvailable = useDebriefActionStore((s) => s.taskCounts.panelAvailable);
  const openDebriefKey = useDebriefActionStore((s) => s.openDebriefKey);
  const openDebriefPanel = useDebriefActionStore((s) => s.openDebriefPanel);
  const openCleaningTask = useDebriefActionStore((s) => s.openCleaningTask);

  const noPanel = useCallback(() => {
    toast.error(t("panelUnavailableTitle"), { description: t("panelUnavailableBody") });
  }, [t]);

  const goCleaningChart = useCallback(
    (date: string, taskId?: number | null) => router.push(cleaningChartHref(locale, { date, taskId })),
    [router, locale],
  );

  const goEmployeeHistory = useCallback(
    (employeeId?: number | null) => router.push(employeeHistoryHref(locale, { storeCode, employeeId })),
    [router, locale, storeCode],
  );

  return useMemo<HubActions>(
    () => ({
      panelAvailable,
      fillDebrief: (item, date) => {
        if (!panelAvailable || !storeCode) return noPanel();
        openDebriefKey(item.keyId, date, storeCode);
      },
      openDebriefs: (date) => {
        if (!panelAvailable || !storeCode) return noPanel();
        openDebriefPanel("due-keys", { date, storeId: storeCode });
      },
      doTask: (item, date) => {
        if (!panelAvailable || !storeCode) return goCleaningChart(date, item.taskId);
        openCleaningTask(item.taskId, date, storeCode);
      },
      openCleaning: (date) => {
        if (!panelAvailable || !storeCode) return goCleaningChart(date);
        openDebriefPanel("cleaning-chart", { date, storeId: storeCode });
      },
      addEmployeeDebrief: () => {
        if (!panelAvailable || !storeCode) return noPanel();
        openDebriefPanel("debrief", { storeId: storeCode });
      },
      goCleaningChart,
      goEmployeeHistory,
    }),
    [
      panelAvailable,
      storeCode,
      noPanel,
      openDebriefKey,
      openDebriefPanel,
      openCleaningTask,
      goCleaningChart,
      goEmployeeHistory,
    ],
  );
}
