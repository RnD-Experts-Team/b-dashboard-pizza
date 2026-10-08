"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PenLine, Plus, SearchX, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateOnly } from "@/lib/utils/date-display";
import { matchesSearch, searchTerms } from "@/lib/manager-hub/search";
import { EMPLOYEE_DEBRIEF_RANGES, type EmployeeDebriefRange } from "@/lib/manager-hub/dates";
import { UNTYPED, groupByDay, typesInUse } from "@/lib/manager-hub/employee-debriefs";
import {
  ChipRow,
  DayHeading,
  FilterChip,
  HubEmpty,
  HubList,
  HubSearch,
  SectionBody,
  SectionCard,
} from "../hub-ui";
import { EmployeeDebriefRow } from "../rows";
import type { HubTabProps } from "./tab-props";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Employee Debriefs — notes written about employees, newest first, grouped */
/*  by day. Information, not a to-do list, so there is no "missing" here.    */
/* ────────────────────────────────────────────────────────────────────────── */

export function EmployeeDebriefsTab({
  data,
  summary,
  actions,
  onDetail,
  range,
  onRangeChange,
}: HubTabProps & { range: EmployeeDebriefRange; onRangeChange: (range: EmployeeDebriefRange) => void }) {
  const t = useTranslations("managerHub.employeeDebriefs");
  const [query, setQuery] = useState("");
  const [typeSlug, setTypeSlug] = useState<string | null>(null);
  const { anchor, employeeDebriefs } = data;

  const entries = summary.employeeDebriefs;
  const knownTypes = data.debriefsToday.data?.employeeDebriefTypes;
  const types = useMemo(() => typesInUse(entries, knownTypes ?? []), [entries, knownTypes]);
  const untypedCount = useMemo(() => entries.filter((e) => !e.item.type).length, [entries]);
  const terms = useMemo(() => searchTerms(query), [query]);

  const visible = useMemo(
    () =>
      entries.filter(
        (e) =>
          (typeSlug == null || (typeSlug === UNTYPED ? !e.item.type : e.item.type?.slug === typeSlug)) &&
          matchesSearch(terms, [e.item.employeeName, e.item.authorName, e.item.notes, e.item.type?.label]),
      ),
    [entries, typeSlug, terms],
  );
  const days = useMemo(() => groupByDay(visible), [visible]);
  const employees = useMemo(() => new Set(visible.map((e) => e.item.employeeId ?? e.item.employeeName)).size, [visible]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <ChipRow className="sm:mx-0 sm:px-0">
          {EMPLOYEE_DEBRIEF_RANGES.map((days) => (
            <FilterChip key={days} active={range === days} onClick={() => onRangeChange(days)}>
              {t("lastDays", { count: days })}
            </FilterChip>
          ))}
        </ChipRow>
        <HubSearch value={query} onChange={setQuery} placeholder={t("searchPlaceholder")} className="sm:ms-auto" />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="h-9 flex-1 gap-1.5 sm:flex-none" onClick={() => actions.goEmployeeHistory()}>
            <UserRound className="h-3.5 w-3.5" />
            {t("history")}
          </Button>
          <Button size="sm" className="h-9 flex-1 gap-1.5 sm:flex-none" onClick={actions.addEmployeeDebrief}>
            <Plus className="h-3.5 w-3.5" />
            {t("add")}
          </Button>
        </div>
      </div>

      {(types.length > 0 || untypedCount > 0) && (
        <ChipRow>
          <FilterChip active={typeSlug == null} count={entries.length} onClick={() => setTypeSlug(null)}>
            {t("allTypes")}
          </FilterChip>
          {types.map(({ type, count }) => (
            <FilterChip
              key={type.slug}
              active={typeSlug === type.slug}
              count={count}
              onClick={() => setTypeSlug((cur) => (cur === type.slug ? null : type.slug))}
            >
              {type.label}
            </FilterChip>
          ))}
          {untypedCount > 0 && (
            <FilterChip
              active={typeSlug === UNTYPED}
              count={untypedCount}
              onClick={() => setTypeSlug((cur) => (cur === UNTYPED ? null : UNTYPED))}
            >
              {t("noType")}
            </FilterChip>
          )}
        </ChipRow>
      )}

      <SectionCard
        icon={PenLine}
        title={t("title")}
        subtitle={t("subtitle", {
          from: formatDateOnly(data.employeeDebriefFrom, "MMM d"),
          to: formatDateOnly(anchor, "MMM d"),
          employees,
        })}
        count={employeeDebriefs.data ? visible.length : undefined}
        countTone="info"
        bodyClassName="max-h-[70vh] overflow-y-auto"
      >
        <SectionBody
          loading={employeeDebriefs.loading}
          error={employeeDebriefs.error}
          hasData={employeeDebriefs.data != null}
          onRetry={employeeDebriefs.reload}
          skeletonRows={6}
        >
          {entries.length === 0 ? (
            <HubEmpty
              icon={PenLine}
              title={t("emptyTitle")}
              body={t("emptyBody", { count: range })}
              action={
                <Button size="sm" variant="outline" className="gap-1.5" onClick={actions.addEmployeeDebrief}>
                  <Plus className="h-3.5 w-3.5" />
                  {t("add")}
                </Button>
              }
            />
          ) : days.length === 0 ? (
            <HubEmpty icon={SearchX} title={t("noMatchTitle")} body={t("noMatchBody")} />
          ) : (
            days.map((d) => (
              <div key={d.date}>
                <DayHeading date={d.date} anchor={anchor} count={d.items.length} tone="info" />
                <HubList>
                  {d.items.map((entry) => (
                    <EmployeeDebriefRow
                      key={entry.item.id}
                      entry={entry}
                      onOpen={() => onDetail({ kind: "employee", entry })}
                    />
                  ))}
                </HubList>
              </div>
            ))
          )}
        </SectionBody>
      </SectionCard>
    </div>
  );
}
