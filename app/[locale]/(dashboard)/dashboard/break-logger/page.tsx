"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBreakDay } from "@/lib/hooks/use-break-day";
import { isIsoDate } from "@/lib/break-logger/work-date";
import type { BreakEntry } from "@/types/breaks.types";
import { TodayView } from "@/components/break-logger/today-view";
import { HistoryView } from "@/components/break-logger/history-view";
import { SettingsView } from "@/components/break-logger/settings-view";
import {
  BreakEntryDialog,
  type BreakEntryDialogMode,
} from "@/components/break-logger/break-entry-dialog";
import { BreakNotesDialog } from "@/components/break-logger/break-notes-dialog";
import { BreakDeleteDialog } from "@/components/break-logger/break-delete-dialog";
import { ExportSummaryDialog } from "@/components/break-logger/export-summary-dialog";
import type { BreakEntryHandlers } from "@/components/break-logger/break-entry-actions";

const TABS = ["today", "history", "settings"] as const;
type Tab = (typeof TABS)[number];

/**
 * Breaks — the full view behind the topbar timer.
 *
 * `?tab=` and `?date=` live in the URL, so a notification's
 * `action_url` (`/toolbox/breaks?date={work_date}`) deep-links straight to
 * the day it's about. `date` is a WORK date; absent means "current work day",
 * which the server resolves itself.
 *
 * Not prefetched anywhere: rendering this page reads `breaks/day`, which
 * writes upstream while the day is open.
 */
function BreakLoggerPageInner() {
  const t = useTranslations("breaks");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(rawTab ?? "") ? (rawTab as Tab) : "today";
  const rawDate = searchParams.get("date");
  const date = isIsoDate(rawDate) ? rawDate : null;

  const setParams = useCallback(
    (next: { tab?: Tab; date?: string | null }) => {
      const qs = new URLSearchParams(searchParams.toString());
      if (next.tab !== undefined) {
        if (next.tab === "today") qs.delete("tab");
        else qs.set("tab", next.tab);
      }
      if (next.date !== undefined) {
        if (next.date) qs.set("date", next.date);
        else qs.delete("date");
      }
      const s = qs.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const { day, loading, error, isToday, reload } = useBreakDay(date);

  const [entryDialog, setEntryDialog] = useState<BreakEntryDialogMode | null>(null);
  const [notesFor, setNotesFor] = useState<BreakEntry | null>(null);
  const [deleteFor, setDeleteFor] = useState<BreakEntry | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [settingsDirty, setSettingsDirty] = useState(false);

  const afterChange = useCallback(() => {
    void reload();
    setHistoryKey((k) => k + 1);
  }, [reload]);

  const handlers = useMemo<BreakEntryHandlers>(
    () => ({
      onEdit: (entry) => setEntryDialog({ kind: "edit", entry }),
      onNotes: (entry) => setNotesFor(entry),
      onDelete: (entry) => setDeleteFor(entry),
    }),
    []
  );

  return (
    // pb-20 keeps the floating Debrief button off the last row's actions.
    <div className="space-y-6 pb-20">
      <PageHeader title={t("title")} description={t("description")} />

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v as Tab })}>
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
            {TABS.map((key) => (
              <TabsTrigger key={key} value={key} className="gap-1.5">
                {t(`tabs.${key}`)}
                {key === "settings" && settingsDirty && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-foreground"
                    role="img"
                    aria-label={t("settings.unsavedTab")}
                  />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="today" className="mt-4">
          <TodayView
            date={date}
            onDateChange={(d) => setParams({ date: d })}
            day={day}
            loading={loading}
            error={error}
            isToday={isToday}
            onRetry={() => void reload()}
            onAdd={() => setEntryDialog({ kind: "create" })}
            onExport={() => setExportOpen(true)}
            handlers={handlers}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryView
            handlers={handlers}
            reloadKey={historyKey}
            onOpenDay={(d) => setParams({ tab: "today", date: d })}
          />
        </TabsContent>

        {/* Kept mounted so unsaved edits survive a tab switch (the dot says so). */}
        <TabsContent value="settings" forceMount className="mt-4 data-[state=inactive]:hidden">
          <SettingsView onDirtyChange={setSettingsDirty} />
        </TabsContent>
      </Tabs>

      {entryDialog && (
        <BreakEntryDialog
          open
          mode={entryDialog}
          onOpenChange={(o) => !o && setEntryDialog(null)}
          onSaved={afterChange}
        />
      )}
      <BreakNotesDialog
        entry={notesFor}
        onOpenChange={(o) => !o && setNotesFor(null)}
        onAdded={afterChange}
      />
      <BreakDeleteDialog
        entry={deleteFor}
        onOpenChange={(o) => !o && setDeleteFor(null)}
        onDeleted={afterChange}
      />
      {day && (
        <ExportSummaryDialog date={day.work_date} open={exportOpen} onOpenChange={setExportOpen} />
      )}
    </div>
  );
}

export default function BreakLoggerPage() {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96" />
        </div>
      }
    >
      <BreakLoggerPageInner />
    </Suspense>
  );
}
