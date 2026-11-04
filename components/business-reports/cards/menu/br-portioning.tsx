"use client";

import { useMemo, useState } from "react";
import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { V1Card, type V1Span } from "@/components/dashboard-v1/v1-card";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { fmt$2, fmtNum, fmtPct2 } from "@/components/business-reports/report-format";
import type { MenuSection, PortioningBlock } from "@/types/business-reports.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  BrPortioningCard — V1 "Portioning" over the range: theoretical usage and
 *  each tracked ingredient's variance (positive = used more than theoretical,
 *  red; negative = less, green). Expand: per store, one column per ingredient.
 * ────────────────────────────────────────────────────────────────────────── */

export const BR_PORTIONING_SPAN: V1Span = 4;

interface StoreRow {
  store: string;
  theo: number;
  pct: Record<string, number>;
}

function fmtVariance(n: number): string {
  return `${n > 0 ? "+" : ""}${fmt$2(n)}`;
}

function varianceClass(n: number): string | undefined {
  if (n > 0) return "text-red-600 dark:text-red-400";
  if (n < 0) return "text-emerald-600 dark:text-emerald-400";
  return undefined;
}

export function BrPortioningCard({ data }: { data: MenuSection }) {
  const [open, setOpen] = useState(false);
  const { theo_usage, variance_breakdown, by_store } = data.portioning;

  return (
    <V1Card
      reportId="br-portioning"
      title="Portioning"
      category="menu"
      period="R"
      span={BR_PORTIONING_SPAN}
      onExpand={() => setOpen(true)}
    >
      <div className="flex h-full flex-col gap-2">
        <div className="shrink-0 rounded-md bg-background/55 px-3 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Theoretical Usage</p>
          <p className="text-base font-bold tabular-nums">{fmt$2(theo_usage)}</p>
        </div>

        {variance_breakdown.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-4 text-center text-muted-foreground">
            <Scale className="h-5 w-5 opacity-50" />
            <p className="text-[11px]">No variance data in this range.</p>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-4">
            {variance_breakdown.map((entry) => (
              <div key={entry.ingredient_id} className="rounded-md bg-background/45 px-2.5 py-2">
                <p
                  className="truncate text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
                  title={entry.ingredient_description}
                >
                  {entry.ingredient_description}
                </p>
                <p
                  className={cn(
                    "flex items-baseline gap-1.5 text-[13px] font-bold tabular-nums",
                    varianceClass(entry.variance_value),
                  )}
                >
                  {fmtVariance(entry.variance_value)}
                  <span className="text-[9px] font-medium text-muted-foreground">
                    {fmtPct2(entry.percentage_of_theo_usage)}
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <WbrDetailDialog
        open={open}
        onOpenChange={setOpen}
        title="Portioning — by store"
        badgeText={`${fmtNum(Object.keys(by_store).length)} stores`}
        className="sm:max-w-6xl"
      >
        {open && <PortioningStores combined={variance_breakdown} byStore={by_store} />}
      </WbrDetailDialog>
    </V1Card>
  );
}

function PortioningStores({
  combined,
  byStore,
}: {
  combined: PortioningBlock["variance_breakdown"];
  byStore: Record<string, PortioningBlock>;
}) {
  const { storeName, focusStore } = useReport();

  const rows = useMemo<StoreRow[]>(
    () =>
      Object.entries(byStore).map(([store, b]) => ({
        store,
        theo: b.theo_usage,
        pct: Object.fromEntries(b.variance_breakdown.map((v) => [v.ingredient_id, v.percentage_of_theo_usage])),
      })),
    [byStore],
  );

  const columns = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      {
        key: "store",
        header: "Store",
        sortValue: (r) => storeName(r.store),
        render: (r) => <span className="font-medium">{storeName(r.store)}</span>,
      },
      {
        key: "theo",
        header: "Theo Usage",
        numeric: true,
        sortValue: (r) => r.theo,
        render: (r) => fmt$2(r.theo),
      },
      ...combined.map<PagedColumn<StoreRow>>((ing) => ({
        key: `ing-${ing.ingredient_id}`,
        header: ing.ingredient_description,
        numeric: true,
        sortValue: (r) => r.pct[ing.ingredient_id] ?? null,
        render: (r) => {
          const v = r.pct[ing.ingredient_id];
          if (v === undefined) return <span className="text-muted-foreground">—</span>;
          return <span className={cn("font-medium", varianceClass(v))}>{fmtPct2(v)}</span>;
        },
      })),
    ],
    [combined, storeName],
  );

  return (
    <div className="overflow-x-auto">
      <PagedTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.store}
        initialSort="theo"
        onRowClick={(r) => focusStore(r.store)}
        footerNote="variance as % of theoretical usage · click a row to focus the store"
      />
    </div>
  );
}
