"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  History,
  RotateCcw,
  StickyNote,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBreaksStore } from "@/lib/store/breaks.store";
import { useBreakHistory } from "@/lib/hooks/use-break-history";
import { cn } from "@/lib/utils";
import {
  floorMinutes,
  isIsoDate,
  retentionMinDate,
  shiftDate,
} from "@/lib/break-logger/work-date";
import type { BreakHistoryFilters, BreakSource } from "@/types/breaks.types";
import { BreakEntryActions, type BreakEntryHandlers } from "./break-entry-actions";
import {
  CountedBadge,
  RunningBadge,
  useBreakErrorText,
  useFormatTime,
  useFormatWorkDate,
} from "./break-ui";

type CountedFilter = "all" | "yes" | "no";
type SourceFilter = "all" | BreakSource;
type QuickRange = "last7" | "last30";

const PER_PAGE_OPTIONS = [10, 25, 50, 100];
const QUICK_RANGES: QuickRange[] = ["last7", "last30"];

/**
 * Break history — `GET breaks`, newest first, a BARE Laravel paginator.
 *
 * Dates here are WORK dates (the API compares them to the stored
 * `work_date`), which is what the pickers hand over — never a derived local
 * calendar date. "Counted" is sent as 0/1 and omitted for "both".
 */
export function HistoryView({
  handlers,
  reloadKey,
  onOpenDay,
}: {
  handlers: BreakEntryHandlers;
  /** Bumped by the page after any edit so the list refetches. */
  reloadKey: number;
  /** Jump to the Today tab on this work date. */
  onOpenDay: (workDate: string) => void;
}) {
  const t = useTranslations("breaks");
  const errorText = useBreakErrorText();
  const formatTime = useFormatTime();
  const formatWorkDate = useFormatWorkDate();
  const types = useBreaksStore((s) => s.types);
  const todayDate = useBreaksStore((s) => s.today?.work_date ?? null);

  function rangeFor(range: QuickRange, today: string) {
    return range === "last7"
      ? { from: shiftDate(today, -6), to: today }
      : { from: retentionMinDate(today), to: today };
  }

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [counted, setCounted] = useState<CountedFilter>("all");
  const [typeIds, setTypeIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const filters = useMemo<BreakHistoryFilters>(
    () => ({
      from: isIsoDate(from) ? from : undefined,
      to: isIsoDate(to) ? to : undefined,
      source: source === "all" ? undefined : source,
      countsTowardLimit: counted === "all" ? undefined : counted === "yes",
      breakTypeIds: typeIds.length ? typeIds : undefined,
      page,
      perPage,
    }),
    [from, to, source, counted, typeIds, page, perPage]
  );

  const { page: result, loading, error, reload } = useBreakHistory(filters);

  useEffect(() => {
    if (reloadKey > 0) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  // Any filter change goes back to page 1.
  function withReset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  const hasFilters = !!(from || to || source !== "all" || counted !== "all" || typeIds.length);

  function clearAll() {
    setFrom("");
    setTo("");
    setSource("all");
    setCounted("all");
    setTypeIds([]);
    setPage(1);
  }

  const rows = result?.data ?? [];
  const lastPage = Math.max(1, result?.last_page ?? 1);

  const activeRange = todayDate
    ? QUICK_RANGES.find((r) => {
        const range = rangeFor(r, todayDate);
        return range.from === from && range.to === to;
      })
    : undefined;

  function applyRange(range: QuickRange) {
    if (!todayDate) return;
    const next = rangeFor(range, todayDate);
    setFrom(next.from);
    setTo(next.to);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* Filters — two per row on phones, one wrapping line from sm up. */}
      <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
        {todayDate && (
          <div className="col-span-2 flex h-9 items-center gap-0.5 rounded-md border p-0.5 sm:inline-flex">
            {QUICK_RANGES.map((r) => (
              <Button
                key={r}
                type="button"
                size="sm"
                variant={activeRange === r ? "secondary" : "ghost"}
                aria-pressed={activeRange === r}
                className="h-7 flex-1 px-2.5 text-xs sm:flex-none"
                onClick={() => applyRange(r)}
              >
                {t(`history.${r}`)}
              </Button>
            ))}
          </div>
        )}
        <div className="min-w-0 space-y-1">
          <Label className="text-xs">{t("history.from")}</Label>
          <DatePicker value={from} onChange={withReset(setFrom)} className="w-full sm:w-40" />
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="text-xs">{t("history.to")}</Label>
          <DatePicker value={to} onChange={withReset(setTo)} className="w-full sm:w-40" />
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="text-xs">{t("history.source")}</Label>
          <Select value={source} onValueChange={(v) => withReset(setSource)(v as SourceFilter)}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("history.sourceAll")}</SelectItem>
              <SelectItem value="timer">{t("history.sourceTimer")}</SelectItem>
              <SelectItem value="manual">{t("history.sourceManual")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="text-xs">{t("history.counted")}</Label>
          <Select value={counted} onValueChange={(v) => withReset(setCounted)(v as CountedFilter)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("history.countedAll")}</SelectItem>
              <SelectItem value="yes">{t("history.countedYes")}</SelectItem>
              <SelectItem value="no">{t("history.countedNo")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="text-xs">{t("history.types")}</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between font-normal sm:w-40">
                <span className="truncate">
                  {typeIds.length
                    ? t("history.typesCount", { count: typeIds.length })
                    : t("history.typesAll")}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
              <DropdownMenuLabel>{t("history.types")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {types.map((ty) => (
                <DropdownMenuCheckboxItem
                  key={ty.id}
                  checked={typeIds.includes(ty.id)}
                  // Keep the menu open for multi-select.
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(checked) =>
                    withReset(setTypeIds)(
                      checked ? [...typeIds, ty.id] : typeIds.filter((id) => id !== ty.id)
                    )
                  }
                >
                  {ty.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="mb-0.5 justify-self-start">
            <X className="me-1 h-3.5 w-3.5" />
            {t("history.clear")}
          </Button>
        )}
      </div>

      {/* Results */}
      {error ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm">{errorText(error)}</p>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RotateCcw className="me-1.5 h-3.5 w-3.5" />
            {t("actions.retry")}
          </Button>
        </div>
      ) : loading && !result ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <History className="h-8 w-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">{t("history.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("history.emptyHint")}</p>
          </div>
        </div>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">{t("history.colTime")}</TableHead>
                  <TableHead>{t("history.colType")}</TableHead>
                  <TableHead className="text-end">{t("history.colDuration")}</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">{t("history.colActions")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((entry, i) => (
                  <Fragment key={entry.id}>
                    {/* Day header whenever the work date changes. Deliberately no
                        per-day total: a page can cut a day in half. */}
                    {(i === 0 || rows[i - 1].work_date !== entry.work_date) && (
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell colSpan={4} className="py-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenDay(entry.work_date)}
                            aria-label={t("history.openDay", {
                              date: formatWorkDate(entry.work_date, true),
                            })}
                            className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                          >
                            {formatWorkDate(entry.work_date)}
                            <ChevronRight className="h-3 w-3 text-muted-foreground rtl:-scale-x-100" />
                          </button>
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow>
                      <TableCell className="hidden whitespace-nowrap text-xs tabular-nums text-muted-foreground sm:table-cell">
                        {formatTime(entry.started_at)} –{" "}
                        {entry.running ? "…" : formatTime(entry.ended_at)}
                      </TableCell>
                      {/* whitespace-normal: long labels + badges wrap instead of
                          forcing the table wider than a phone. */}
                      <TableCell className="whitespace-normal">
                        <p className="mb-0.5 whitespace-nowrap text-xs tabular-nums text-muted-foreground sm:hidden">
                          {formatTime(entry.started_at)} –{" "}
                          {entry.running ? "…" : formatTime(entry.ended_at)}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium">{entry.label}</span>
                          <CountedBadge counted={entry.counts_toward_limit} />
                          {entry.source === "manual" && (
                            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                              {t("today.manual")}
                            </Badge>
                          )}
                          {entry.running && <RunningBadge />}
                          {entry.notes.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handlers.onNotes(entry)}
                              className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
                              aria-label={t("actions.notes")}
                            >
                              <StickyNote className="h-3 w-3" />
                              {entry.notes.length}
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-end text-sm tabular-nums",
                          entry.counts_toward_limit
                            ? "font-semibold"
                            : "font-normal text-muted-foreground"
                        )}
                      >
                        {t("minutes", { minutes: floorMinutes(entry.duration_seconds) })}
                      </TableCell>
                      <TableCell>
                        <BreakEntryActions entry={entry} {...handlers} />
                      </TableCell>
                    </TableRow>
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-muted-foreground tabular-nums">
              {t("history.summary", {
                page: result?.current_page ?? 1,
                last: lastPage,
                total: result?.total ?? 0,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">{t("history.perPage")}</Label>
              <Select
                value={String(perPage)}
                onValueChange={(v) => withReset(setPerPage)(Number(v))}
              >
                <SelectTrigger className="h-8 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PER_PAGE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label={t("history.prev")}
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label={t("history.next")}
                disabled={page >= lastPage || loading}
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              >
                <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
