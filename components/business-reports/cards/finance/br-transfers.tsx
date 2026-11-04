"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine } from "lucide-react";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric, V1MetricGrid, V1SubLabel } from "@/components/dashboard-v1/v1-ui";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { fmt$2, fmtDate, fmtNum } from "@/components/business-reports/report-format";
import type { OperationsSection, TransferRow } from "@/types/business-reports.types";
import { CARD_LIST_LIMIT, plural } from "@/components/business-reports/cards/operations/br-shared";

/** In = into a loaded store from outside; out = the reverse; between = both ends loaded. */
type Direction = "in" | "out" | "between";

interface Transfer extends TransferRow {
  key: string;
  direction: Direction;
  fromLabel: string;
  toLabel: string;
}

const DIRECTION_ICON: Record<Direction, { icon: typeof ArrowDownToLine; className: string; label: string }> = {
  in: { icon: ArrowDownToLine, className: "text-emerald-500", label: "In" },
  out: { icon: ArrowUpFromLine, className: "text-amber-500", label: "Out" },
  between: { icon: ArrowLeftRight, className: "text-muted-foreground", label: "Between" },
};

function directionOf(row: TransferRow, loaded: Set<string>): Direction {
  const toLoaded = loaded.has(row.to_store_number);
  const fromLoaded = loaded.has(row.from_store_number);
  if (toLoaded && fromLoaded) return "between";
  return toLoaded ? "in" : "out";
}

function DirectionIcon({ direction }: { direction: Direction }) {
  const { icon: Icon, className, label } = DIRECTION_ICON[direction];
  return <Icon className={`h-3 w-3 shrink-0 ${className}`} aria-label={label} />;
}

const COLUMNS: PagedColumn<Transfer>[] = [
  { key: "date", header: "Date", sortValue: (r) => r.date, render: (r) => fmtDate(r.date), className: "whitespace-nowrap" },
  {
    key: "dir",
    header: "Dir.",
    sortValue: (r) => r.direction,
    render: (r) => (
      <span className="inline-flex items-center gap-1">
        <DirectionIcon direction={r.direction} />
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
      .sort((a, b) => b.date.localeCompare(a.date));
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
            value={fmtNum(t.transfers_in_count)}
            sub={fmt$2(t.transfers_in_cost)}
            accent="text-emerald-600 dark:text-emerald-400"
            size="sm"
          />
          <V1Metric
            label="Out"
            value={fmtNum(t.transfers_out_count)}
            sub={fmt$2(t.transfers_out_cost)}
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
                  <span className="font-semibold">{fmt$2(r.total_cost)}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {open && (
        <WbrDetailDialog
          open
          onOpenChange={(o) => !o && setOpen(false)}
          title="Ingredient Transfers"
          badgeText={plural(rows.length, "transfer")}
        >
          <PagedTable rows={rows} columns={COLUMNS} rowKey={(r) => r.key} initialSort="date" />
        </WbrDetailDialog>
      )}
    </V1Card>
  );
}
