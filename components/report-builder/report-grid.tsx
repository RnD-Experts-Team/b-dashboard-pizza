"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { compareCells, formatCell, isNumericColumn, type CellLabels } from "@/lib/report-builder/format";
import { PER_PAGE_CHOICES, cycleSort, sameSearch } from "@/lib/report-builder/url-state";
import type { GridColumn } from "@/types/report-builder.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  The report grid — shared by the builder preview and the run page.         */
/*  Same look and sort cycle as components/workbooks/workbook-grid.tsx +      */
/*  grid-pagination.tsx. Search and header sort work on the rows it is given  */
/*  (the loaded page); paging, when present, belongs to the caller.           */
/* ────────────────────────────────────────────────────────────────────────── */

const SEARCH_DEBOUNCE_MS = 300;

export interface GridSort {
  sortId: string | null;
  sortOrder: "asc" | "desc";
}

interface GridPaging {
  page: number;
  perPage: number;
  /** Total rows across all pages, when known. */
  total: number | null;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

interface ReportGridProps {
  columns: GridColumn[];
  rows: unknown[][];
  sort: GridSort;
  onSortChange: (sort: GridSort) => void;
  search: string;
  onSearchChange: (search: string) => void;
  refreshing?: boolean;
  paging?: GridPaging;
  /** Extra classes for the scroll box, e.g. a max height in the builder. */
  bodyClassName?: string;
  /** First row number shown in the # column (page offset). */
  rowOffset?: number;
}

const isEmpty = (v: unknown) => v === null || v === undefined || v === "";

export function ReportGrid({
  columns,
  rows,
  sort,
  onSortChange,
  search,
  onSearchChange,
  refreshing,
  paging,
  bodyClassName,
  rowOffset = 0,
}: ReportGridProps) {
  const t = useTranslations("reportBuilder.grid");
  const tc = useTranslations("reportBuilder.cell");
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const labels: CellLabels = useMemo(() => ({ yes: tc("yes"), no: tc("no") }), [tc]);

  // Local text so typing stays snappy; the caller hears about it after a pause.
  const [draft, setDraft] = useState(search);
  // A new `search` from outside (URL, reset) replaces the draft — adjusted during render.
  // The URL keeps the text trimmed, so our own echo of "foo " ("foo") must not eat the space being typed.
  const [seenSearch, setSeenSearch] = useState(search);
  if (search !== seenSearch) {
    setSeenSearch(search);
    if (!sameSearch(search, draft)) setDraft(search);
  }
  useEffect(() => {
    if (sameSearch(draft, search)) return;
    const id = setTimeout(() => onSearchChange(draft), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [draft, search, onSearchChange]);

  const text = useMemo(
    () => rows.map((r) => columns.map((c, i) => formatCell(r[i], c, locale, labels))),
    [rows, columns, locale, labels],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const indexes = rows.map((_, i) => i);
    const matching = needle
      ? indexes.filter((i) => text[i].some((cell) => cell.toLowerCase().includes(needle)))
      : indexes;
    const col = columns.findIndex((c) => c.id === sort.sortId);
    if (col < 0) return matching;
    const dir = sort.sortOrder === "desc" ? -1 : 1;
    // Empty cells stay at the bottom in both directions.
    return [...matching].sort((a, b) => {
      const va = rows[a][col];
      const vb = rows[b][col];
      if (isEmpty(va) || isEmpty(vb)) return Number(isEmpty(va)) - Number(isEmpty(vb));
      return dir * compareCells(va, vb, columns[col]);
    });
  }, [rows, text, columns, search, sort]);

  const sortIcon = (c: GridColumn) => {
    if (sort.sortId !== c.id) return <ArrowUpDown className="h-3 w-3 opacity-40 group-hover/th:opacity-80" />;
    return sort.sortOrder === "desc" ? (
      <ArrowDown className="h-3 w-3 text-primary" />
    ) : (
      <ArrowUp className="h-3 w-3 text-primary" />
    );
  };

  const ariaSort = (c: GridColumn) => {
    if (sort.sortId !== c.id) return undefined;
    return sort.sortOrder === "desc" ? "descending" : "ascending";
  };

  return (
    <div data-slot="report-grid" className="space-y-3">
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          className="h-8 ps-8 text-sm"
        />
      </div>

      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-card shadow-sm transition-opacity",
          refreshing && "pointer-events-none opacity-60",
        )}
      >
        <div className={cn("overflow-auto", bodyClassName)} onWheel={(e) => e.stopPropagation()}>
          <table className="w-full min-w-max border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-muted">
                <th className="w-12 border-e bg-muted px-2 py-2 text-end text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  #
                </th>
                {columns.map((c) => (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={ariaSort(c)}
                    className="min-w-[120px] max-w-[320px] bg-muted px-1 py-1 text-start align-bottom font-normal"
                  >
                    <button
                      type="button"
                      onClick={() => onSortChange(cycleSort(sort, c.id))}
                      className={cn(
                        "group/th flex w-full items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-accent",
                        isNumericColumn(c) ? "flex-row-reverse text-end" : "text-start",
                      )}
                      title={t("sortBy", { name: c.label })}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-foreground">{c.label}</span>
                        <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{c.id}</span>
                      </span>
                      {sortIcon(c)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((i) => (
                <tr key={i} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="border-e px-2 py-1.5 text-end text-[11px] tabular-nums text-muted-foreground">
                    {rowOffset + i + 1}
                  </td>
                  {columns.map((c, ci) => (
                    <td
                      key={c.id}
                      className={cn(
                        "max-w-[320px] truncate px-3 py-1.5",
                        isNumericColumn(c) && "text-end tabular-nums",
                      )}
                      title={text[i][ci]}
                    >
                      {text[i][ci]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {rows.length === 0 ? t("empty") : t("noMatches")}
            </p>
          )}
        </div>
      </div>

      {paging && <ReportGridPagination paging={paging} loadedRows={rows.length} />}
    </div>
  );
}

/** PaginationBar from components/workbooks/grid-pagination.tsx, for server pages. */
function ReportGridPagination({ paging, loadedRows }: { paging: GridPaging; loadedRows: number }) {
  const t = useTranslations("reportBuilder.pagination");
  const tc = useTranslations("reportBuilder.common");
  const { page, perPage, total } = paging;
  // Without a total, a short page is the last one; a full page may have more after it.
  const lastPage = total !== null ? Math.max(1, Math.ceil(total / perPage)) : page + Number(loadedRows >= perPage);
  const isFirst = page <= 1;
  const isLast = page >= lastPage;
  const from = loadedRows > 0 ? (page - 1) * perPage + 1 : 0;
  const to = (page - 1) * perPage + loadedRows;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm tabular-nums text-muted-foreground">
          {total !== null && loadedRows > 0
            ? t("showing", { from, to, total })
            : t("page", { current: page, total: lastPage })}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{t("perPage")}</span>
          <div className="w-20">
            <SearchableSelect<string>
              options={PER_PAGE_CHOICES.map((n) => ({ value: String(n), label: String(n) }))}
              value={String(perPage)}
              onChange={(v) => paging.onPerPageChange(Number(v))}
              searchPlaceholder={tc("search")}
              emptyText={tc("noResults")}
              className="h-8"
            />
          </div>
        </div>
      </div>
      {lastPage > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={isFirst} onClick={() => paging.onPageChange(1)} aria-label={t("first")}>
            <ChevronFirst className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={isFirst}
            onClick={() => paging.onPageChange(page - 1)}
            aria-label={t("previous")}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <span className="px-2 text-xs tabular-nums text-muted-foreground">
            {t("page", { current: page, total: lastPage })}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={isLast}
            onClick={() => paging.onPageChange(page + 1)}
            aria-label={t("next")}
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={isLast || total === null}
            onClick={() => paging.onPageChange(lastPage)}
            aria-label={t("last")}
          >
            <ChevronLast className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      )}
    </div>
  );
}
