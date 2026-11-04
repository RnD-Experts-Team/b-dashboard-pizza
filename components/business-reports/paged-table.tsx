"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { V1_NUM, V1_TBL, V1_TD, V1_TH } from "@/components/dashboard-v1/v1-ui";
import { useTableSort, type SortAccessor, type SortDir } from "@/components/labor/use-table-sort";
import { cn } from "@/lib/utils";

export interface PagedColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Makes the column sortable. */
  sortValue?: SortAccessor<T>;
  numeric?: boolean;
  className?: string;
}

const DEFAULT_PAGE_SIZE = 25;

/**
 * The V1 compact table, sortable and paged (the Labor roster's pattern), so a
 * list of thousands of rows only ever renders one page. Sorting is over every
 * row, not just the page shown.
 */
export function PagedTable<T>({
  rows,
  columns,
  rowKey,
  initialSort,
  initialDir = "desc",
  pageSize = DEFAULT_PAGE_SIZE,
  onRowClick,
  rowClassName,
  footerNote,
  className,
}: {
  rows: T[];
  columns: PagedColumn<T>[];
  rowKey: (row: T) => string | number;
  initialSort?: string;
  initialDir?: SortDir;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  /** Extra text after "Showing a–b of N" (e.g. "click a row to focus the store"). */
  footerNote?: string;
  className?: string;
}) {
  const accessors = useMemo(
    () =>
      Object.fromEntries(
        columns.filter((c) => c.sortValue).map((c) => [c.key, c.sortValue as SortAccessor<T>]),
      ),
    [columns],
  );
  const { sorted, sortKey, sortDir, toggleSort } = useTableSort<T, string>(
    rows,
    accessors,
    initialSort ?? columns.find((c) => c.sortValue)?.key ?? "",
    initialDir,
  );

  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, totalPages);
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className={V1_TBL}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={cn(V1_TH, c.numeric && "text-right", c.className)}>
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSort(c.key);
                        setPage(1);
                      }}
                      className={cn(
                        "inline-flex items-center gap-0.5 uppercase hover:text-foreground",
                        sortKey === c.key && "text-foreground",
                      )}
                      aria-label={`Sort by ${typeof c.header === "string" ? c.header : c.key}${sortKey === c.key ? ` (${sortDir})` : ""}`}
                    >
                      {c.header}
                      <ArrowUpDown className="h-2.5 w-2.5" />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && "cursor-pointer hover:bg-muted/40", rowClassName?.(row))}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn(V1_TD, c.numeric && V1_NUM, c.className)}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
          <p className="text-[10px] text-muted-foreground">
            Showing {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, sorted.length)} of{" "}
            {sorted.length.toLocaleString()}
            {footerNote ? ` · ${footerNote}` : ""}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <span className="me-1 text-[10px] text-muted-foreground">
                Page {current} of {totalPages}
              </span>
              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setPage(1)} disabled={current <= 1}>
                <span className="sr-only">First page</span>
                <ChevronsLeft className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setPage(current - 1)} disabled={current <= 1}>
                <span className="sr-only">Previous page</span>
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setPage(current + 1)} disabled={current >= totalPages}>
                <span className="sr-only">Next page</span>
                <ChevronRight className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setPage(totalPages)} disabled={current >= totalPages}>
                <span className="sr-only">Last page</span>
                <ChevronsRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
