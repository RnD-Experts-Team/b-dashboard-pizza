"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, CalendarX2, CheckCircle2, Database, PenLine, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getValueDisplay } from "@/components/due-keys/due-key-value-format";
import { formatDateOnly } from "@/lib/utils/date-display";
import { matchesSearch, searchTerms } from "@/lib/manager-hub/search";
import type { DueKeyItem } from "@/types/due-key.types";
import {
  ChipRow,
  DayHeading,
  FilterChip,
  HubEmpty,
  HubList,
  HubSearch,
  SectionBody,
  SectionCard,
  SegmentedFilter,
} from "../hub-ui";
import { DebriefRow } from "../rows";
import type { HubTabProps } from "./tab-props";

/* ────────────────────────────────────────────────────────────────────────── */
/*  My Debriefs — the store's debrief (due key) values for the day, then the */
/*  days in the last week left unfilled. "Fill" opens the panel's sheet on   */
/*  that exact key and day.                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

type FillFilter = "missing" | "filled" | "all";

export function DebriefsTab({ data, summary, actions, onDetail, isToday }: HubTabProps) {
  const t = useTranslations("managerHub.debriefs");
  const [fill, setFill] = useState<FillFilter>("all");
  const [tagId, setTagId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const { anchor, debriefsToday, debriefsBacklog } = data;

  const items = useMemo(() => debriefsToday.data?.items ?? [], [debriefsToday.data]);
  const terms = useMemo(() => searchTerms(query), [query]);

  const tags = useMemo(() => {
    const map = new Map<number, { id: number; name: string; count: number }>();
    for (const it of items)
      for (const tag of it.tags) {
        const cur = map.get(tag.id) ?? { id: tag.id, name: tag.name, count: 0 };
        cur.count += 1;
        map.set(tag.id, cur);
      }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const matches = (item: DueKeyItem) =>
    (tagId == null || item.tags.some((tag) => tag.id === tagId)) &&
    matchesSearch(terms, [
      item.label,
      item.dataType,
      item.tags.map((tag) => tag.name).join(" "),
      item.filled ? getValueDisplay(item.value).display : null,
      item.value?.userName,
      item.value?.note,
    ]);

  const counts = useMemo(() => {
    const scoped = items.filter((i) => tagId == null || i.tags.some((tag) => tag.id === tagId));
    const missing = scoped.filter((i) => !i.filled).length;
    return { all: scoped.length, missing, filled: scoped.length - missing };
  }, [items, tagId]);

  // Missing first — that's what the manager is here for.
  const visible = useMemo(
    () =>
      items
        .filter((i) => (fill === "all" || (fill === "missing" ? !i.filled : i.filled)) && matches(i))
        .sort((a, b) => Number(a.filled) - Number(b.filled)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, fill, tagId, terms],
  );

  const missedDays = useMemo(
    () =>
      summary.debriefBacklog
        .map((d) => ({ ...d, entries: d.entries.filter((e) => e.kind === "debrief" && matches(e.item)) }))
        .filter((d) => d.entries.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [summary.debriefBacklog, tagId, terms],
  );

  const day = isToday ? t("todayTitle") : t("dayTitle", { date: formatDateOnly(anchor, "MMM d") });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SegmentedFilter
          value={fill}
          onChange={setFill}
          options={[
            { value: "all", label: t("filters.all"), count: counts.all },
            { value: "missing", label: t("filters.missing"), count: counts.missing, tone: "warn" },
            { value: "filled", label: t("filters.filled"), count: counts.filled, tone: "good" },
          ]}
        />
        <HubSearch value={query} onChange={setQuery} placeholder={t("searchPlaceholder")} className="sm:ms-auto" />
        <Button size="sm" className="h-9 gap-1.5" onClick={() => actions.openDebriefs(anchor)}>
          <PenLine className="h-3.5 w-3.5" />
          {summary.debriefsMissing > 0 ? t("fillAllInPanel") : t("openInPanel")}
        </Button>
      </div>

      {tags.length > 0 && (
        <ChipRow>
          <FilterChip active={tagId == null} onClick={() => setTagId(null)}>
            {t("allTags")}
          </FilterChip>
          {tags.map((tag) => (
            <FilterChip
              key={tag.id}
              active={tagId === tag.id}
              count={tag.count}
              onClick={() => setTagId((cur) => (cur === tag.id ? null : tag.id))}
            >
              {tag.name}
            </FilterChip>
          ))}
        </ChipRow>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SectionCard
          icon={Database}
          title={day}
          subtitle={t("todaySubtitle")}
          count={debriefsToday.data ? summary.debriefsMissing : undefined}
          countTone={summary.debriefsMissing > 0 ? "warn" : "good"}
          bodyClassName="max-h-[32rem] overflow-y-auto"
        >
          <SectionBody
            loading={debriefsToday.loading}
            error={debriefsToday.error}
            hasData={debriefsToday.data != null}
            onRetry={debriefsToday.reload}
          >
            {items.length === 0 ? (
              <HubEmpty icon={Database} title={t("noneTitle")} body={t("noneBody")} />
            ) : visible.length === 0 ? (
              <HubEmpty icon={SearchX} title={t("noMatchTitle")} body={t("noMatchBody")} />
            ) : (
              <HubList>
                {visible.map((item) => (
                  <DebriefRow
                    key={item.keyId}
                    item={item}
                    onOpen={() => onDetail({ kind: "debrief", item, date: anchor, missed: false })}
                    onFill={() => actions.fillDebrief(item, anchor)}
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
          count={debriefsBacklog.data ? summary.backlogDebriefs : undefined}
          countTone={summary.backlogDebriefs > 0 ? "bad" : "good"}
          bodyClassName="max-h-[32rem] overflow-y-auto"
        >
          <SectionBody
            loading={debriefsBacklog.loading}
            error={debriefsBacklog.error}
            hasData={debriefsBacklog.data != null}
            onRetry={debriefsBacklog.reload}
          >
            {summary.backlogDebriefs === 0 ? (
              <HubEmpty icon={CheckCircle2} tone="good" title={t("missedClearTitle")} body={t("missedClearBody")} />
            ) : missedDays.length === 0 ? (
              <HubEmpty icon={SearchX} title={t("noMatchTitle")} body={t("noMatchBody")} />
            ) : (
              missedDays.map((d) => (
                <div key={d.date}>
                  <DayHeading
                    date={d.date}
                    anchor={anchor}
                    count={d.entries.length}
                    tone="bad"
                    action={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-2 text-[11px]"
                        onClick={() => actions.openDebriefs(d.date)}
                      >
                        {t("fillDay")}
                        <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                      </Button>
                    }
                  />
                  <HubList>
                    {d.entries.map((entry) =>
                      entry.kind === "debrief" ? (
                        <DebriefRow
                          key={entry.key}
                          item={entry.item}
                          missed
                          onOpen={() => onDetail({ kind: "debrief", item: entry.item, date: entry.date, missed: true })}
                          onFill={() => actions.fillDebrief(entry.item, entry.date)}
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
