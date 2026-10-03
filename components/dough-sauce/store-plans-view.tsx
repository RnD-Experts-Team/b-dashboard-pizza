"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, ChevronRight, CircleDashed, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAllStoresDaily, useIngredients } from "@/lib/hooks/use-dough-sauce";
import { tomorrowIso } from "@/lib/dough-sauce/dates";
import { INGREDIENT_KEYS } from "@/types/dough-sauce.types";
import {
  DsErrorState,
  PaginationFooter,
  fmtQty,
  personName,
  useDateTimeFormatter,
  useDayFormatter,
  useIngredientLabel,
  usePaged,
  useStoreNames,
} from "./ds-ui";

type Filter = "all" | "pending" | "confirmed";

/** §8.2 — who hasn't confirmed yet. One request, every store. */
export function StorePlansView({ onOpenStore }: { onOpenStore?: (store: string, date: string) => void }) {
  const t = useTranslations("doughSauce.stores");
  const tc = useTranslations("doughSauce.common");
  const day = useDayFormatter();
  const dateTime = useDateTimeFormatter();
  const storeNames = useStoreNames();
  const [date, setDate] = useState(tomorrowIso());
  const [filter, setFilter] = useState<Filter>("pending");
  const [query, setQuery] = useState("");
  const { data, error, loading, reload } = useAllStoresDaily(date);
  const { ingredients } = useIngredients();
  const labelOf = useIngredientLabel(ingredients);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.stores ?? [])
      .filter((s) => (filter === "all" ? true : filter === "pending" ? !s.confirmed : s.confirmed))
      .filter(
        (s) =>
          !q || s.store.toLowerCase().includes(q) || (storeNames.get(s.store) ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || a.store.localeCompare(b.store));
  }, [data, filter, query, storeNames]);

  const paged = usePaged(rows, 20, `${filter}|${query}|${date}`);
  // Pending stores have no numbers yet — don't draw columns that can only be empty.
  const showPlanColumns = filter !== "pending";
  const summary = data?.summary;
  const ratio = summary && summary.total > 0 ? summary.confirmed / summary.total : 0;
  const planDate = data?.date ?? date;

  const FILTERS: { key: Filter; count?: number }[] = [
    { key: "pending", count: summary?.pending },
    { key: "confirmed", count: summary?.confirmed },
    { key: "all", count: summary?.total },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <DatePicker value={date} onChange={(v) => v && setDate(v)} className="w-full sm:w-40" />
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchPlaceholder")} className="ps-8" />
        </div>
        <span className="hidden text-sm text-muted-foreground md:inline">{day.long(planDate)}</span>
        <Button
          variant="outline"
          size="icon"
          className="ms-auto"
          onClick={reload}
          disabled={loading}
          aria-label={tc("refresh")}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {error && !data && <DsErrorState error={error} onRetry={reload} />}
      {loading && !data && !error && <Skeleton className="h-96 w-full" />}

      {data && summary && (
        <Card className="gap-0 overflow-hidden p-0">
          {/* Filter + progress in one compact bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2.5">
            <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors",
                    filter === f.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t(`filter.${f.key}`)}
                  <span className="text-xs tabular-nums text-muted-foreground">{f.count ?? 0}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm tabular-nums">
                <span className="font-semibold">{summary.confirmed}</span>
                <span className="text-muted-foreground"> / {summary.total} {t("confirmedLabel")}</span>
              </span>
              <div
                className="h-1.5 w-32 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={Math.round(ratio * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${ratio * 100}%` }} />
              </div>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <CheckCircle2 className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {filter === "pending" && !query ? t("emptyPending") : t("empty")}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className={cn("w-full table-fixed text-sm", showPlanColumns && "min-w-[860px]")}>
                  {/* Fixed widths so every row lines up, whichever rows the filter shows. */}
                  <colgroup>
                    <col className={showPlanColumns ? "w-[24%]" : "w-[55%]"} />
                    <col className={showPlanColumns ? "w-[13%]" : "w-[30%]"} />
                    {showPlanColumns && INGREDIENT_KEYS.map((k) => <col key={k} className="w-[13%]" />)}
                    {showPlanColumns && <col className="w-[18%]" />}
                    <col className="w-14" />
                  </colgroup>
                  <thead className="bg-muted/30">
                    <tr className="text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 text-start font-medium">{t("colStore")}</th>
                      <th className="px-3 py-2.5 text-start font-medium">{t("colStatus")}</th>
                      {showPlanColumns &&
                        INGREDIENT_KEYS.map((k) => (
                          <th key={k} className="truncate px-3 py-2.5 text-end font-medium" title={labelOf(k)}>
                            {labelOf(k)}
                          </th>
                        ))}
                      {showPlanColumns && <th className="px-4 py-2.5 text-start font-medium">{t("colConfirmedBy")}</th>}
                      <th className="px-2 py-2.5">
                        <span className="sr-only">{t("colAction")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paged.pageItems.map((s) => {
                      const by = personName(s.confirmed_by);
                      const name = storeNames.get(s.store);
                      const open = () => onOpenStore?.(s.store, planDate);
                      return (
                        <tr
                          key={s.store_id}
                          onClick={open}
                          className={cn("group h-14 transition-colors", onOpenStore && "cursor-pointer hover:bg-muted/40")}
                        >
                          <td className="px-4 py-2">
                            <span className="block truncate font-medium">{name ?? s.store}</span>
                            {name && <span className="block text-xs text-muted-foreground tabular-nums">{s.store}</span>}
                          </td>
                          <td className="px-3 py-2">
                            {s.confirmed ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" />
                                {t("confirmed")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
                                <CircleDashed className="h-3 w-3" />
                                {t("pending")}
                              </span>
                            )}
                          </td>
                          {showPlanColumns &&
                            INGREDIENT_KEYS.map((k) => {
                              const line = s.confirmed ? s.lines.find((l) => l.ingredient_key === k) : undefined;
                              return (
                                <td key={k} className="px-3 py-2 text-end tabular-nums">
                                  {line ? (
                                    <>
                                      <span className="block font-semibold">{fmtQty(line.planned_qty)}</span>
                                      <span className="block text-[11px] text-muted-foreground">+{fmtQty(line.buffer_pct)}%</span>
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground/40">—</span>
                                  )}
                                </td>
                              );
                            })}
                          {showPlanColumns && (
                            <td className="px-4 py-2 text-xs">
                              {s.confirmed ? (
                                <>
                                  <span className="block truncate">{by ?? "—"}</span>
                                  {s.confirmed_at && (
                                    <span className="block text-muted-foreground tabular-nums">{dateTime(s.confirmed_at)}</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>
                          )}
                          <td className="px-2 py-2 text-end">
                            {onOpenStore && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground group-hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  open();
                                }}
                                aria-label={s.confirmed ? t("viewPlan") : t("openToConfirm")}
                                title={s.confirmed ? t("viewPlan") : t("openToConfirm")}
                              >
                                <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationFooter {...paged} />
            </>
          )}
        </Card>
      )}
    </div>
  );
}
