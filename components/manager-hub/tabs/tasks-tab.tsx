"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarX2, CheckCircle2, ExternalLink, Lock, SearchX, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateOnly } from "@/lib/utils/date-display";
import { matchesSearch, searchTerms } from "@/lib/manager-hub/search";
import type { DueItem, DueStatus } from "@/types/cleaning.types";
import {
  DayHeading,
  HubEmpty,
  HubList,
  HubSearch,
  SectionBody,
  SectionCard,
  SegmentedFilter,
} from "../hub-ui";
import { TaskRow, formatPeriod } from "../rows";
import type { HubTabProps } from "./tab-props";

/* ────────────────────────────────────────────────────────────────────────── */
/*  My Tasks — the store's cleaning-chart tasks for the day, then the ones   */
/*  never done in the last 7 days. Read-only: "Complete" opens the panel.    */
/* ────────────────────────────────────────────────────────────────────────── */

type StatusFilter = "all" | DueStatus;

export function TasksTab({ data, summary, actions, onDetail, isToday }: HubTabProps) {
  const t = useTranslations("managerHub.tasks");
  const tFreq = useTranslations("cleaningChart.frequency");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const { anchor, cleaningToday, cleaningBacklog } = data;

  const terms = useMemo(() => searchTerms(query), [query]);
  const matches = (item: DueItem) =>
    matchesSearch(terms, [
      item.label,
      item.description,
      item.note,
      tFreq(item.frequency),
      item.doneBy.join(" "),
      formatPeriod(item.period),
    ]);

  const items = useMemo(() => cleaningToday.data?.items ?? [], [cleaningToday.data]);
  const counts = useMemo(() => {
    const c = { all: items.length, pending: 0, done: 0, overdue: 0 };
    for (const it of items) c[it.status]++;
    return c;
  }, [items]);

  // Overdue first, then pending, then done — the order they need attention in.
  const visible = useMemo(() => {
    const order: Record<DueStatus, number> = { overdue: 0, pending: 1, done: 2 };
    return items
      .filter((i) => (status === "all" || i.status === status) && matches(i))
      .sort((a, b) => order[a.status] - order[b.status]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, status, terms]);

  const missedDays = useMemo(
    () =>
      summary.cleaningBacklog
        .map((d) => ({ ...d, entries: d.entries.filter((e) => e.kind === "cleaning" && matches(e.item)) }))
        .filter((d) => d.entries.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [summary.cleaningBacklog, terms],
  );

  if (!data.canSeeCleaning) {
    return (
      <div className="rounded-xl border bg-card">
        <HubEmpty icon={Lock} title={t("noAccessTitle")} body={t("noAccessBody")} />
      </div>
    );
  }

  const day = isToday ? t("todayTitle") : t("dayTitle", { date: formatDateOnly(anchor, "MMM d") });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SegmentedFilter
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: t("filters.all"), count: counts.all },
            { value: "overdue", label: t("filters.overdue"), count: counts.overdue, tone: "bad" },
            { value: "pending", label: t("filters.pending"), count: counts.pending, tone: "warn" },
            { value: "done", label: t("filters.done"), count: counts.done, tone: "good" },
          ]}
        />
        <HubSearch value={query} onChange={setQuery} placeholder={t("searchPlaceholder")} className="sm:ms-auto" />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 flex-1 gap-1.5 sm:flex-none" onClick={() => actions.openCleaning(anchor)}>
            <Sparkles className="h-3.5 w-3.5" />
            {t("openInPanel")}
          </Button>
          <Button variant="ghost" size="sm" className="h-9 flex-1 gap-1.5 sm:flex-none" onClick={() => actions.goCleaningChart(anchor)}>
            <ExternalLink className="h-3.5 w-3.5" />
            {t("openChart")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SectionCard
          icon={Sparkles}
          title={day}
          subtitle={t("todaySubtitle")}
          count={cleaningToday.data ? summary.tasksOpen : undefined}
          countTone={summary.tasksOverdue > 0 ? "bad" : summary.tasksOpen > 0 ? "warn" : "good"}
          bodyClassName="max-h-[32rem] overflow-y-auto"
        >
          <SectionBody
            loading={cleaningToday.loading}
            error={cleaningToday.error}
            hasData={cleaningToday.data != null}
            onRetry={cleaningToday.reload}
          >
            {items.length === 0 ? (
              <HubEmpty icon={Sparkles} title={t("noneTitle")} body={t("noneBody")} />
            ) : visible.length === 0 ? (
              <HubEmpty icon={SearchX} title={t("noMatchTitle")} body={t("noMatchBody")} />
            ) : (
              <HubList>
                {visible.map((item) => (
                  <TaskRow
                    key={item.taskId}
                    item={item}
                    onOpen={() => onDetail({ kind: "cleaning", item, date: anchor, missed: false })}
                    onDo={() => actions.doTask(item, anchor)}
                  />
                ))}
              </HubList>
            )}
          </SectionBody>
        </SectionCard>

        <SectionCard
          icon={CalendarX2}
          title={t("missedTitle")}
          subtitle={t("missedSubtitle")}
          count={cleaningBacklog.data ? summary.backlogTasks : undefined}
          countTone={summary.backlogTasks > 0 ? "bad" : "good"}
          bodyClassName="max-h-[32rem] overflow-y-auto"
        >
          <SectionBody
            loading={cleaningBacklog.loading}
            error={cleaningBacklog.error}
            hasData={cleaningBacklog.data != null}
            onRetry={cleaningBacklog.reload}
          >
            {summary.backlogTasks === 0 ? (
              <HubEmpty icon={CheckCircle2} tone="good" title={t("missedClearTitle")} body={t("missedClearBody")} />
            ) : missedDays.length === 0 ? (
              <HubEmpty icon={SearchX} title={t("noMatchTitle")} body={t("noMatchBody")} />
            ) : (
              missedDays.map((d) => (
                <div key={d.date}>
                  <DayHeading date={d.date} anchor={anchor} count={d.entries.length} tone="bad" />
                  <HubList>
                    {d.entries.map((entry) =>
                      entry.kind === "cleaning" ? (
                        <TaskRow
                          key={entry.key}
                          item={entry.item}
                          missed
                          onOpen={() => onDetail({ kind: "cleaning", item: entry.item, date: entry.date, missed: true })}
                          onDo={() => actions.doTask(entry.item, entry.date)}
                        />
                      ) : null,
                    )}
                  </HubList>
                </div>
              ))
            )}
          </SectionBody>
        </SectionCard>
      </div>
    </div>
  );
}
