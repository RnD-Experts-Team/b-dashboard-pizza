"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine } from "lucide-react";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric, V1MetricGrid, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { ReportBlock, ReportDialog, type ReportTab } from "@/components/business-reports/report-dialog";
import { useReport } from "@/components/business-reports/report-context";
import { compareText, fmt$2, fmt$Compact, fmtDate, fmtNum } from "@/components/business-reports/report-format";
import type { OperationsSection, TransferRow } from "@/types/business-reports.types";
import {
  CARD_LIST_LIMIT,
  Count,
  Money,
  ShareBars,
  TrendChart,
  plural,
  storeSearch,
  useStoreFocus,
  useWeekLabel,
} from "@/components/business-reports/cards/operations/br-shared";
import { DetailItem, RecordsView, useRecordWeeks } from "@/components/business-reports/cards/quality/br-records";

/** In = into a loaded store from outside; out = the reverse; between = both ends loaded. */
type Direction = "in" | "out" | "between";

interface Transfer extends TransferRow {
  key: string;
  direction: Direction;
  fromLabel: string;
  toLabel: string;
}

interface StoreTransfers {
  store: string;
  name: string;
  inCount: number;
  inCost: number;
  outCount: number;
  outCost: number;
}

interface IngredientTransfers {
  key: string;
  name: string;
  count: number;
  cost: number;
}

const DIRECTION_ICON: Record<Direction, { icon: typeof ArrowDownToLine; className: string; label: string }> = {
  in: { icon: ArrowDownToLine, className: "text-emerald-500", label: "In" },
  out: { icon: ArrowUpFromLine, className: "text-amber-500", label: "Out" },
  between: { icon: ArrowLeftRight, className: "text-muted-foreground", label: "Between" },
};

const [IN_COLOR, OUT_COLOR] = CATEGORIES.finance.chartColors;
const BAR_COLOR = CATEGORIES.finance.chartColors[0];
const TOP_INGREDIENTS = 12;

function directionOf(row: TransferRow, loaded: Set<string>): Direction {
  const toLoaded = loaded.has(row.to_store_number);
  const fromLoaded = loaded.has(row.from_store_number);
  if (toLoaded && fromLoaded) return "between";
  return toLoaded ? "in" : "out";
}

function DirectionIcon({ direction, large = false }: { direction: Direction; large?: boolean }) {
  const { icon: Icon, className, label } = DIRECTION_ICON[direction];
  return <Icon className={`${large ? "h-4 w-4" : "h-3 w-3"} shrink-0 ${className}`} aria-label={label} />;
}

const dateOf = (r: Transfer) => r.date;
/** The loaded store a transfer belongs to for the store checklist: the receiving one for "in", else the sender. */
const storeOf = (r: Transfer) => (r.direction === "in" ? r.to_store_number : r.from_store_number);
const searchText = (r: Transfer) => `${r.ing_des} ${r.fromLabel} ${r.toLabel}`;

const COLUMNS: PagedColumn<Transfer>[] = [
  { key: "date", header: "Date", sortValue: dateOf, render: (r) => fmtDate(r.date), className: "whitespace-nowrap" },
  {
    key: "dir",
    header: "Direction",
    sortValue: (r) => r.direction,
    render: (r) => (
      <span className="inline-flex items-center gap-1.5">
        <DirectionIcon direction={r.direction} large />
        {DIRECTION_ICON[r.direction].label}
      </span>
    ),
  },
  { key: "from", header: "From", sortValue: (r) => r.fromLabel, render: (r) => r.fromLabel },
  { key: "to", header: "To", sortValue: (r) => r.toLabel, render: (r) => r.toLabel },
  { key: "item", header: "Ingredient", sortValue: (r) => r.ing_des, render: (r) => r.ing_des },
  { key: "qty", header: "Qty", numeric: true, sortValue: (r) => r.quantity, render: (r) => `${fmtNum(r.quantity)} ${r.unit}` },
  { key: "cost", header: "Cost", numeric: true, sortValue: (r) => r.total_cost, render: (r) => fmt$2(r.total_cost) },
];

const STORE_COLUMNS: PagedColumn<StoreTransfers>[] = [
  { key: "store", header: "Store", sortValue: (r) => r.name, render: (r) => r.name },
  { key: "in_count", header: "In", numeric: true, sortValue: (r) => r.inCount, render: (r) => fmtNum(r.inCount) },
  { key: "in_cost", header: "In $", numeric: true, sortValue: (r) => r.inCost, render: (r) => fmt$2(r.inCost) },
  { key: "out_count", header: "Out", numeric: true, sortValue: (r) => r.outCount, render: (r) => fmtNum(r.outCount) },
  { key: "out_cost", header: "Out $", numeric: true, sortValue: (r) => r.outCost, render: (r) => fmt$2(r.outCost) },
  { key: "net", header: "Net $ (in − out)", numeric: true, sortValue: (r) => r.inCost - r.outCost, render: (r) => fmt$2(r.inCost - r.outCost) },
];

const INGREDIENT_COLUMNS: PagedColumn<IngredientTransfers>[] = [
  { key: "name", header: "Ingredient", sortValue: (r) => r.name, render: (r) => r.name },
  { key: "count", header: "Transfers", numeric: true, sortValue: (r) => r.count, render: (r) => fmtNum(r.count) },
  { key: "cost", header: "Cost", numeric: true, sortValue: (r) => r.cost, render: (r) => fmt$2(r.cost) },
];
const ingredientSearch = (r: IngredientTransfers) => r.name;

function TransferDetail({ r }: { r: Transfer }) {
  return (
    <>
      <DetailItem label="Date" value={fmtDate(r.date)} />
      <DetailItem
        label="Direction"
        value={
          <span className="inline-flex items-center gap-1.5">
            <DirectionIcon direction={r.direction} large />
            {DIRECTION_ICON[r.direction].label}
          </span>
        }
      />
      <DetailItem label="From" value={r.fromLabel} />
      <DetailItem label="To" value={r.toLabel} />
      <DetailItem label="Ingredient" value={r.ing_des} />
      <DetailItem label="Quantity" value={`${fmtNum(r.quantity)} ${r.unit}`} />
      <DetailItem label="Cost" value={fmt$2(r.total_cost)} />
    </>
  );
}

function TransfersDialog({ data, rows, onClose }: { data: OperationsSection; rows: Transfer[]; onClose: () => void }) {
  const { params, storeName } = useReport();
  const focus = useStoreFocus<StoreTransfers>();
  const weeks = useRecordWeeks(rows, dateOf);
  const labelOf = useWeekLabel(weeks);
  const categories = useMemo(() => weeks.map((w) => labelOf(w.week_start)), [weeks, labelOf]);
  const series = useMemo(
    () => [
      { name: "In $", data: weeks.map((w) => w.rows.filter((r) => r.direction !== "out").reduce((s, r) => s + r.total_cost, 0)), color: IN_COLOR },
      { name: "Out $", data: weeks.map((w) => w.rows.filter((r) => r.direction !== "in").reduce((s, r) => s + r.total_cost, 0)), color: OUT_COLOR },
    ],
    [weeks],
  );
  const stores = useMemo<StoreTransfers[]>(
    () =>
      params.stores.map((store) => {
        const ins = rows.filter((r) => r.to_store_number === store);
        const outs = rows.filter((r) => r.from_store_number === store);
        return {
          store,
          name: storeName(store),
          inCount: ins.length,
          inCost: ins.reduce((s, r) => s + r.total_cost, 0),
          outCount: outs.length,
          outCost: outs.reduce((s, r) => s + r.total_cost, 0),
        };
      }),
    [params.stores, rows, storeName],
  );
  const ingredients = useMemo<IngredientTransfers[]>(() => {
    const byName = rows.reduce((m, r) => {
      const g = m.get(r.ing_des);
      if (g) {
        g.count += 1;
        g.cost += r.total_cost;
      } else m.set(r.ing_des, { key: r.ing_des, name: r.ing_des, count: 1, cost: r.total_cost });
      return m;
    }, new Map<string, IngredientTransfers>());
    return [...byName.values()].sort((a, b) => b.cost - a.cost);
  }, [rows]);
  const between = rows.filter((r) => r.direction === "between").length;
  const t = data.totals;
  const totalCost = ingredients.reduce((s, r) => s + r.cost, 0);

  const tabs: ReportTab[] = [
    {
      key: "overview",
      label: "Overview",
      content: (
        <div className="grid gap-4 lg:grid-cols-5">
          <ReportBlock title="Transfer cost per week" description="Transfers between two loaded stores count on both sides." className="lg:col-span-3">
            <TrendChart kind="bar" categories={categories} series={series} format={fmt$Compact} />
          </ReportBlock>
          <ReportBlock title="Ingredients by cost" className="lg:col-span-2">
            <ShareBars
              size="lg"
              color={BAR_COLOR}
              limit={TOP_INGREDIENTS}
              total={totalCost}
              rows={ingredients.map((r) => ({ key: r.key, label: r.name, value: r.cost, display: fmt$Compact(r.cost), title: fmt$2(r.cost) }))}
            />
          </ReportBlock>
        </div>
      ),
    },
    {
      key: "stores",
      label: "By store",
      content: (
        <PagedTable
          size="lg"
          rows={stores}
          columns={STORE_COLUMNS}
          rowKey={(r) => r.store}
          initialSort="out_cost"
          searchText={storeSearch}
          onRowClick={focus.onRowClick}
          footerNote={focus.footerNote}
        />
      ),
    },
    {
      key: "ingredients",
      label: "By ingredient",
      content: (
        <PagedTable
          size="lg"
          rows={ingredients}
          columns={INGREDIENT_COLUMNS}
          rowKey={(r) => r.key}
          initialSort="cost"
          searchText={ingredientSearch}
          searchPlaceholder="Search ingredients…"
        />
      ),
    },
    {
      key: "records",
      label: "Transfers",
      content: (
        <RecordsView
          rows={rows}
          columns={COLUMNS}
          rowKey={(r) => r.key}
          initialSort="date"
          searchText={searchText}
          storeOf={storeOf}
          detailTitle={(r) => (
            <span className="flex flex-wrap items-baseline justify-between gap-2">
              <span>{r.ing_des}</span>
              <span className="tabular-nums">{fmt$2(r.total_cost)}</span>
            </span>
          )}
          renderDetail={(r) => <TransferDetail r={r} />}
        />
      ),
    },
  ];

  return (
    <ReportDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Ingredient Transfers"
      category="finance"
      stats={[
        { label: "Transfers", value: fmtNum(rows.length), sub: `${fmtNum(between)} between loaded stores` },
        { label: "In", value: fmtNum(t.transfers_in_count), tone: "text-emerald-600 dark:text-emerald-400" },
        { label: "In $", value: fmt$Compact(t.transfers_in_cost), sub: fmt$2(t.transfers_in_cost) },
        { label: "Out", value: fmtNum(t.transfers_out_count), tone: "text-amber-600 dark:text-amber-400" },
        { label: "Out $", value: fmt$Compact(t.transfers_out_cost), sub: fmt$2(t.transfers_out_cost) },
        { label: "Ingredients", value: fmtNum(ingredients.length) },
      ]}
      tabs={tabs}
    />
  );
}

/** Ingredient transfers touching the loaded stores: in/out counts and cost, then the list. */
export function BrTransfersCard({ data }: { data: OperationsSection }) {
  const { params, storeName } = useReport();
  const [open, setOpen] = useState(false);
  const t = data.totals;

  const rows = useMemo<Transfer[]>(() => {
    const loaded = new Set(params.stores);
    return data.transfers
      .map((r, i) => ({
        ...r,
        key: `${r.date}-${r.from_store_number}-${r.to_store_number}-${r.ing_des}-${i}`,
        direction: directionOf(r, loaded),
        fromLabel: storeName(r.from_store_number),
        toLabel: storeName(r.to_store_number),
      }))
      .sort((a, b) => compareText(b.date, a.date));
  }, [data.transfers, params.stores, storeName]);
  const empty = rows.length === 0;

  return (
    <V1Card
      reportId="br-transfers"
      title="Transfers In/Out"
      category="finance"
      period="R"
      span={1}
      headerNote={plural(rows.length, "transfer")}
      onExpand={empty ? undefined : () => setOpen(true)}
    >
      <div className="space-y-2">
        <V1MetricGrid cols={2}>
          <V1Metric
            label="In"
            value={<Count value={t.transfers_in_count} />}
            sub={<Money value={t.transfers_in_cost} />}
            accent="text-emerald-600 dark:text-emerald-400"
            size="sm"
          />
          <V1Metric
            label="Out"
            value={<Count value={t.transfers_out_count} />}
            sub={<Money value={t.transfers_out_cost} />}
            accent="text-amber-600 dark:text-amber-400"
            size="sm"
          />
        </V1MetricGrid>
        {empty ? (
          <V1Empty icon={ArrowLeftRight}>No transfers in this range.</V1Empty>
        ) : (
          <div>
            <V1SubLabel className="mb-0.5">Latest</V1SubLabel>
            {rows.slice(0, CARD_LIST_LIMIT).map((r) => (
              <div key={r.key} className="flex items-center justify-between gap-2 border-b border-border/40 py-1 last:border-0">
                <span className="flex min-w-0 items-center gap-1 text-[11px] font-medium">
                  <DirectionIcon direction={r.direction} />
                  <span className="truncate">{r.ing_des}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-[11px] tabular-nums">
                  <span className="max-w-[90px] truncate text-[10px] text-muted-foreground" title={`${r.fromLabel} → ${r.toLabel}`}>
                    {r.direction === "in" ? r.toLabel : r.fromLabel}
                  </span>
                  <span className="font-semibold">
                    <Money value={r.total_cost} />
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {open && <TransfersDialog data={data} rows={rows} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
