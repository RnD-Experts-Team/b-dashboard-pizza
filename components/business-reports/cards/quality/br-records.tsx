"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CATEGORIES, type CategoryKey } from "@/components/dashboard-v1/category";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { ReportBlock, ReportDialog, type ReportStat, type ReportTab } from "@/components/business-reports/report-dialog";
import { useReport } from "@/components/business-reports/report-context";
import { StoreChecklist, inStores } from "@/components/business-reports/store-checklist";
import { compareText } from "@/components/business-reports/report-format";
import type { WbrBulkResponse, WbrBulkStore } from "@/types/business-reports.types";
import {
  CountDelta,
  ShareBars,
  TrendChart,
  plural,
  storeSearch,
  useRangeWeeks,
  useWeekLabel,
  weekStartOf,
  withPrev,
} from "@/components/business-reports/cards/operations/br-shared";

type RecordKey = "feedbacks" | "complaints" | "money_owed";

const STORE_NUMBER_SEPARATOR = "-";
const TOP_STORES = 10;

const fmtWhole = (v: number): string => v.toFixed(0);
const storeOfRecord = (r: HooksStore): string => r.store;

/* ── Hooks stores → loaded stores ────────────────────────────────────────── */

/** Where a hooks record belongs: the loaded store code ("" when none matches) and its display name. */
export interface HooksStore {
  store: string;
  storeDisplay: string;
}

/** "03795-00043" → 43. */
function trailingNumber(code: string): number {
  return Number(code.split(STORE_NUMBER_SEPARATOR).pop());
}

/**
 * Hooks stores carry a short store number (43) and their own label. This maps
 * one to the loaded store code ending in that number and names it like every
 * other card ("03795-00043 · Name"); the hooks label is the fallback.
 */
export function useHooksStore(): (storeNumber: number | null | undefined, label: string) => HooksStore {
  const { params, storeName } = useReport();
  return useMemo(() => {
    const byNumber = new Map(params.stores.map((code) => [trailingNumber(code), code]));
    return (storeNumber, label) => {
      const code = storeNumber === null || storeNumber === undefined ? undefined : byNumber.get(storeNumber);
      return code ? { store: code, storeDisplay: storeName(code) } : { store: "", storeDisplay: label };
    };
  }, [params.stores, storeName]);
}

export type WbrRecord<K extends RecordKey> = WbrBulkStore[K][number] & HooksStore;

/** One record list (feedbacks, complaints or money owed) across every store, each tagged with its loaded store. */
export function useWbrRecords<K extends RecordKey>(feedback: WbrBulkResponse, key: K): Array<WbrRecord<K>> {
  const tag = useHooksStore();
  return useMemo(
    () =>
      feedback.stores.flatMap((s) => {
        const where = tag(s.store_number, s.store_label);
        return (s[key] as Array<WbrBulkStore[K][number]>).map((r) => ({ ...r, ...where }));
      }),
    [feedback, key, tag],
  );
}

/* ── Detail ──────────────────────────────────────────────────────────────── */

/** One labelled value in a record's detail panel; nothing for an empty value. */
export function DetailItem({ label, value, wide = false }: { label: string; value: ReactNode; wide?: boolean }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className={cn("min-w-0 space-y-1", wide && "sm:col-span-2")}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="whitespace-pre-wrap break-words text-sm">{value}</div>
    </div>
  );
}

/**
 * A searchable, paged record list with a store checklist; clicking a row
 * opens that record's full detail, and "Back" returns to the list where it
 * was left.
 */
export function RecordsView<T>({
  rows,
  columns,
  rowKey,
  initialSort,
  searchText,
  storeOf,
  detailTitle,
  renderDetail,
}: {
  rows: T[];
  columns: PagedColumn<T>[];
  rowKey: (row: T) => string | number;
  initialSort: string;
  searchText: (row: T) => string;
  /** The loaded store code of a row ("" when none); enables the store checklist. */
  storeOf?: (row: T) => string;
  detailTitle: (row: T) => ReactNode;
  renderDetail: (row: T) => ReactNode;
}) {
  const [stores, setStores] = useState<string[]>([]);
  const [selected, setSelected] = useState<T | null>(null);
  const offered = useMemo(
    () => (storeOf ? [...new Set(rows.map(storeOf).filter(Boolean))].sort(compareText) : []),
    [rows, storeOf],
  );
  const filtered = useMemo(() => (storeOf ? inStores(rows, stores, storeOf) : rows), [rows, stores, storeOf]);

  return (
    <div className="space-y-3">
      {selected && (
        <div className="space-y-3">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setSelected(null)}>
            <ChevronLeft className="h-4 w-4" /> Back to the list
          </Button>
          <div className="space-y-4 rounded-lg border bg-card p-5">
            <div className="text-lg font-semibold">{detailTitle(selected)}</div>
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{renderDetail(selected)}</div>
          </div>
        </div>
      )}
      <div className={cn("space-y-3", selected && "hidden")}>
        {offered.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Stores</span>
            <StoreChecklist value={stores} onChange={setStores} stores={offered} className="h-8 w-64 text-sm" />
          </div>
        )}
        <PagedTable
          size="lg"
          rows={filtered}
          columns={columns}
          rowKey={rowKey}
          initialSort={initialSort}
          searchText={searchText}
          onRowClick={setSelected}
          footerNote="click a row for the details"
        />
      </div>
    </div>
  );
}

/* ── Records by week / by store ──────────────────────────────────────────── */

export interface RecordWeek<T> {
  week_start: string;
  rows: T[];
}

/** Every week of the range (plus any other week a record falls in), oldest first, with its records. */
export function useRecordWeeks<T>(rows: T[], dateOf: (row: T) => string | null | undefined): Array<RecordWeek<T>> {
  const rangeWeeks = useRangeWeeks();
  return useMemo(() => {
    const byWeek = rows.reduce((m, r) => {
      const w = weekStartOf(dateOf(r));
      const list = w ? m.get(w) : undefined;
      if (list) list.push(r);
      else if (w) m.set(w, [r]);
      return m;
    }, new Map<string, T[]>());
    const keys = [...new Set([...rangeWeeks.map((w) => w.week_start), ...byWeek.keys()])].sort(compareText);
    return keys.map((week_start) => ({ week_start, rows: byWeek.get(week_start) ?? [] }));
  }, [rows, dateOf, rangeWeeks]);
}

export interface RecordStore<T> {
  /** The loaded store code, or "" for a hooks store no loaded store matches. */
  store: string;
  name: string;
  rows: T[];
}

/** Records grouped by store (by display name when no loaded store matches). */
export function groupByStore<T extends HooksStore>(rows: T[]): Array<RecordStore<T>> {
  const groups = rows.reduce((m, r) => {
    const key = r.store || `label:${r.storeDisplay}`;
    const g = m.get(key);
    if (g) g.rows.push(r);
    else m.set(key, { store: r.store, name: r.storeDisplay, rows: [r] });
    return m;
  }, new Map<string, RecordStore<T>>());
  return [...groups.values()];
}

interface WeekCountRow {
  week_start: string;
  count: number;
  prev: number | null;
}

/**
 * A hooks record list's dialog: the card's stats, then Overview (records per
 * week and the stores with the most), By week, By store (extra columns per
 * card) and Records (search, store checklist, full detail on click).
 */
export function RecordsDialog<T extends HooksStore>({
  title,
  category,
  noun,
  rows,
  stats,
  dateOf,
  storeColumns = [],
  columns,
  rowKey,
  initialSort,
  searchText,
  detailTitle,
  renderDetail,
  onClose,
}: {
  title: string;
  category: CategoryKey;
  /** Singular ("complaint"). */
  noun: string;
  rows: T[];
  stats: ReportStat[];
  dateOf: (row: T) => string | null | undefined;
  /** Columns after Store and the count in the By store tab. */
  storeColumns?: PagedColumn<RecordStore<T>>[];
  columns: PagedColumn<T>[];
  rowKey: (row: T) => string | number;
  initialSort: string;
  searchText: (row: T) => string;
  detailTitle: (row: T) => ReactNode;
  renderDetail: (row: T) => ReactNode;
  onClose: () => void;
}) {
  const { params, focusStore } = useReport();
  const color = CATEGORIES[category].chartColors[0];
  const weeks = useRecordWeeks(rows, dateOf);
  const labelOf = useWeekLabel(weeks);
  const stores = useMemo(() => groupByStore(rows).sort((a, b) => b.rows.length - a.rows.length), [rows]);
  const nounPlural = `${noun}s`;

  const weekRows = useMemo<WeekCountRow[]>(
    () => withPrev(weeks).map(({ row, prev }) => ({ week_start: row.week_start, count: row.rows.length, prev: prev ? prev.rows.length : null })),
    [weeks],
  );
  const chartSeries = useMemo(() => [{ name: nounPlural, data: weeks.map((w) => w.rows.length), color }], [weeks, nounPlural, color]);
  const categories = useMemo(() => weeks.map((w) => labelOf(w.week_start)), [weeks, labelOf]);

  const weekColumns = useMemo<PagedColumn<WeekCountRow>[]>(
    () => [
      { key: "week", header: "Week", sortValue: (r) => r.week_start, render: (r) => labelOf(r.week_start) },
      { key: "count", header: nounPlural, numeric: true, sortValue: (r) => r.count, render: (r) => r.count.toLocaleString() },
      { key: "delta", header: "Δ vs prev. week", numeric: true, render: (r) => <CountDelta curr={r.count} prev={r.prev} goodWhen="neutral" /> },
    ],
    [labelOf, nounPlural],
  );
  const storeTableColumns = useMemo<PagedColumn<RecordStore<T>>[]>(
    () => [
      { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
      { key: "count", header: nounPlural, numeric: true, sortValue: (r) => r.rows.length, render: (r) => r.rows.length.toLocaleString() },
      ...storeColumns,
    ],
    [nounPlural, storeColumns],
  );
  const canFocus = params.stores.length > 1;

  const tabs: ReportTab[] = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <div className="grid gap-4 lg:grid-cols-5">
          <ReportBlock title={`${title} per week`} className="lg:col-span-3">
            <TrendChart kind="bar" categories={categories} series={chartSeries} format={fmtWhole} />
          </ReportBlock>
          <ReportBlock title="Stores with the most" className="lg:col-span-2">
            <ShareBars
              size="lg"
              color={color}
              limit={TOP_STORES}
              total={rows.length}
              rows={stores.map((s) => ({ key: s.store || s.name, label: s.name, value: s.rows.length, title: s.name }))}
            />
          </ReportBlock>
        </div>
      ),
    },
    {
      key: "weeks",
      label: "By week",
      content: <PagedTable size="lg" rows={weekRows} columns={weekColumns} rowKey={(r) => r.week_start} initialSort="week" />,
    },
    {
      key: "stores",
      label: "By store",
      content: (
        <PagedTable
          size="lg"
          rows={stores}
          columns={storeTableColumns}
          rowKey={(r) => r.store || r.name}
          initialSort="count"
          searchText={storeSearch}
          onRowClick={canFocus ? (r) => r.store && focusStore(r.store) : undefined}
          footerNote={canFocus ? "click a row to focus the store" : undefined}
        />
      ),
    },
    {
      key: "records",
      label: "Records",
      content: (
        <RecordsView
          rows={rows}
          columns={columns}
          rowKey={rowKey}
          initialSort={initialSort}
          searchText={searchText}
          storeOf={storeOfRecord}
          detailTitle={detailTitle}
          renderDetail={renderDetail}
        />
      ),
    },
  ];

  return (
    <ReportDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={title}
      category={category}
      stats={[{ label: nounPlural, value: rows.length.toLocaleString(), sub: plural(stores.length, "store") }, ...stats]}
      tabs={tabs}
    />
  );
}
