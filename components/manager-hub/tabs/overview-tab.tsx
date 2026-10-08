"use client";

import { useTranslations } from "next-intl";
import { ArrowRight, CalendarX2, CheckCircle2, ListTodo, PenLine, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateOnly } from "@/lib/utils/date-display";
import type { MissingEntry } from "@/lib/manager-hub/missing";
import {
  DayHeading,
  HubEmpty,
  HubErrorState,
  HubInlineError,
  HubList,
  ListSkeleton,
  SectionBody,
  SectionCard,
} from "../hub-ui";
import { EmployeeDebriefRow, MissingRow } from "../rows";
import type { HubTabProps } from "./tab-props";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Overview — "what do I still owe": today's open items (both kinds,        */
/*  overdue first) beside everything missed this week, then the latest       */
/*  employee debriefs.                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

export const MISSED_SECTION_ID = "hub-missed";
const RECENT_EMPLOYEE_DEBRIEFS = 5;

export function OverviewTab({ data, summary, actions, onDetail, isToday, goTab }: HubTabProps) {
  const t = useTranslations("managerHub.overview");
  const { anchor, debriefsToday, cleaningToday, canSeeCleaning } = data;

  const open = (entry: MissingEntry, missed: boolean) =>
    entry.kind === "debrief"
      ? onDetail({ kind: "debrief", item: entry.item, date: entry.date, missed })
      : onDetail({ kind: "cleaning", item: entry.item, date: entry.date, missed });
  const act = (entry: MissingEntry) =>
    entry.kind === "debrief" ? actions.fillDebrief(entry.item, entry.date) : actions.doTask(entry.item, entry.date);

  // Today's list merges two sources: show what loaded, flag what didn't.
  const todaySources = [debriefsToday, ...(canSeeCleaning ? [cleaningToday] : [])];
  const todayLoading = todaySources.some((s) => s.loading && s.data == null);
  const todayAllFailed = todaySources.every((s) => s.data == null && s.error != null);
  const todayFailed = todaySources.filter((s) => s.error != null);

  const backlogSources = [data.debriefsBacklog, ...(canSeeCleaning ? [data.cleaningBacklog] : [])];
  const backlogLoading = backlogSources.some((s) => s.loading && s.data == null);
  const backlogAllFailed = backlogSources.every((s) => s.data == null && s.error != null);
  const backlogFailed = backlogSources.filter((s) => s.error != null);

  const dayLabel = isToday ? t("todayTitle") : t("dayTitle", { date: formatDateOnly(anchor, "MMM d") });
  const recent = summary.employeeDebriefs.slice(0, RECENT_EMPLOYEE_DEBRIEFS);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          icon={ListTodo}
          title={dayLabel}
          subtitle={t("todaySubtitle")}
          count={todayLoading ? undefined : summary.today.length}
          countTone={summary.tasksOverdue > 0 ? "bad" : summary.today.length > 0 ? "warn" : "good"}
          actions={
            summary.debriefsMissing > 0 && (
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => actions.openDebriefs(anchor)}>
                {t("fillAll")}
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </Button>
            )
          }
          bodyClassName="max-h-[28rem] overflow-y-auto"
        >
          {todayLoading && summary.today.length === 0 ? (
            <ListSkeleton />
          ) : todayAllFailed ? (
            <HubErrorState error={todayFailed[0].error!} onRetry={() => todayFailed.forEach((s) => s.reload())} />
          ) : (
            <>
              {todayFailed.map((s, i) => (
                <HubInlineError
                  key={i}
                  error={s.error!}
                  onRetry={s.reload}
                  mode={s.data == null ? "partial" : "refresh"}
                />
              ))}
              {summary.today.length === 0 ? (
                <HubEmpty
                  icon={CheckCircle2}
                  tone="good"
                  title={isToday ? t("todayClearTitle") : t("dayClearTitle")}
                  body={t("todayClearBody")}
                />
              ) : (
                <HubList>
                  {summary.today.map((entry) => (
                    <MissingRow
                      key={entry.key}
                      entry={entry}
                      onOpen={() => open(entry, false)}
                      onAct={() => act(entry)}
                    />
                  ))}
                </HubList>
              )}
            </>
          )}
        </SectionCard>

        <section id={MISSED_SECTION_ID} className="scroll-mt-20">
          <SectionCard
            icon={CalendarX2}
            title={t("missedTitle")}
            subtitle={t("missedSubtitle", {
              from: formatDateOnly(data.backlogFrom, "MMM d"),
              to: formatDateOnly(data.backlogTo, "MMM d"),
            })}
            count={backlogLoading ? undefined : summary.backlogCount}
            countTone={summary.backlogCount > 0 ? "bad" : "good"}
            className="h-full"
            bodyClassName="max-h-[28rem] overflow-y-auto"
          >
            {backlogLoading && summary.backlog.length === 0 ? (
              <ListSkeleton />
            ) : backlogAllFailed ? (
              <HubErrorState error={backlogFailed[0].error!} onRetry={() => backlogFailed.forEach((s) => s.reload())} />
            ) : (
              <>
                {backlogFailed.map((s, i) => (
                  <HubInlineError
                    key={i}
                    error={s.error!}
                    onRetry={s.reload}
                    mode={s.data == null ? "partial" : "refresh"}
                  />
                ))}
                {summary.backlog.length === 0 ? (
                  <HubEmpty icon={CheckCircle2} tone="good" title={t("missedClearTitle")} body={t("missedClearBody")} />
                ) : (
                  summary.backlog.map((day) => (
                    <div key={day.date}>
                      <DayHeading date={day.date} anchor={anchor} count={day.entries.length} tone="bad" />
                      <HubList>
                        {day.entries.map((entry) => (
                          <MissingRow
                            key={entry.key}
                            entry={entry}
                            missed
                            onOpen={() => open(entry, true)}
                            onAct={() => act(entry)}
                          />
                        ))}
                      </HubList>
                    </div>
                  ))
                )}
              </>
            )}
          </SectionCard>
        </section>
      </div>

      <SectionCard
        icon={PenLine}
        title={t("recentTitle")}
        subtitle={t("recentSubtitle")}
        count={data.employeeDebriefs.data ? summary.employeeDebriefs.length : undefined}
        countTone="info"
        actions={
          <>
            {summary.employeeDebriefs.length > RECENT_EMPLOYEE_DEBRIEFS && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => goTab("employee-debriefs")}
              >
                {t("seeAll")}
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={actions.addEmployeeDebrief}
              aria-label={t("addDebrief")}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("addDebrief")}</span>
            </Button>
          </>
        }
      >
        <SectionBody
          loading={data.employeeDebriefs.loading}
          error={data.employeeDebriefs.error}
          hasData={data.employeeDebriefs.data != null}
          onRetry={data.employeeDebriefs.reload}
          skeletonRows={3}
        >
          {recent.length === 0 ? (
            <HubEmpty icon={PenLine} title={t("recentEmptyTitle")} body={t("recentEmptyBody")} />
          ) : (
            <HubList>
              {recent.map((entry) => (
                <EmployeeDebriefRow
                  key={entry.item.id}
                  entry={entry}
                  onOpen={() => onDetail({ kind: "employee", entry })}
                />
              ))}
            </HubList>
          )}
        </SectionBody>
      </SectionCard>
    </div>
  );
}
