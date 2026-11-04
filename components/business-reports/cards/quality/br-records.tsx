"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WbrDetailDialog } from "@/components/dspr/wbr-detail-dialog";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import type { WbrBulkResponse, WbrBulkStore } from "@/types/business-reports.types";
import { plural } from "@/components/business-reports/cards/operations/br-shared";

type RecordKey = "feedbacks" | "complaints" | "money_owed";

/** One record list (feedbacks, complaints or money owed) across every store; each row keeps its store_label. */
export function useWbrRecords<K extends RecordKey>(feedback: WbrBulkResponse, key: K): WbrBulkStore[K] {
  return useMemo(
    () => feedback.stores.flatMap((s): unknown[] => s[key]) as WbrBulkStore[K],
    [feedback, key],
  );
}

/**
 * A record list's dialog: a sortable, paged table; clicking a row opens that
 * record's detail, and "Back" returns to the list where it was left.
 */
export function RecordsDialog<T>({
  title,
  noun,
  rows,
  columns,
  rowKey,
  initialSort,
  detailTitle,
  renderDetail,
  onClose,
}: {
  title: string;
  /** Singular, for the count badge ("record"). */
  noun: string;
  rows: T[];
  columns: PagedColumn<T>[];
  rowKey: (row: T) => string | number;
  initialSort: string;
  detailTitle: (row: T) => ReactNode;
  renderDetail: (row: T) => ReactNode;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<T | null>(null);
  return (
    <WbrDetailDialog open onOpenChange={(o) => !o && onClose()} title={title} badgeText={plural(rows.length, noun)}>
      {selected && (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px]" onClick={() => setSelected(null)}>
            <ChevronLeft className="h-3 w-3" /> Back to list
          </Button>
          <div className="space-y-2 rounded-lg border bg-background/40 p-3">
            <div className="text-sm font-semibold">{detailTitle(selected)}</div>
            <div className="space-y-1.5">{renderDetail(selected)}</div>
          </div>
        </div>
      )}
      <div className={cn(selected && "hidden")}>
        <PagedTable
          rows={rows}
          columns={columns}
          rowKey={rowKey}
          initialSort={initialSort}
          onRowClick={setSelected}
          footerNote="click a row for the details"
        />
      </div>
    </WbrDetailDialog>
  );
}
