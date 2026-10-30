"use client";

import { useTranslations } from "next-intl";
import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/maintenance/money";
import type { PaymentListRow } from "@/types/maintenance-v2";
import { LineTypeBadges } from "./line-type-badges";
import { formatPaidDate } from "./payment-detail-sheet";

function categoryName(row: PaymentListRow): string | null {
  const c = row.paidTo.category;
  if (!c) return null;
  return typeof c === "string" ? c : c.name;
}

/**
 * The payments list: date, paid to, stores, types, invoice, total. A
 * mistaken payment is struck through and says "Mistake" in words. Cards
 * below md; the table from md up. A row opens the detail sheet.
 */
export function PaymentsTable({ rows, onOpen }: { rows: PaymentListRow[]; onOpen: (id: number) => void }) {
  const t = useTranslations("maintenanceV2");

  const invoiceCell = (row: PaymentListRow) => (
    <span className="inline-flex items-center gap-1 text-xs">
      {row.hasInvoice && <Paperclip className="size-3.5 text-muted-foreground" aria-label={t("payments.hasInvoiceFile")} />}
      <span className="truncate">{row.invoiceNumber || (row.hasInvoice ? "" : "—")}</span>
    </span>
  );

  const mistakeBadge = (
    <Badge variant="outline" className="border-destructive/40 px-1.5 py-0 text-[10px] text-destructive">
      {t("common.mistaken")}
    </Badge>
  );

  return (
    <>
      {/* Mobile cards */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onOpen(row.id)}
              className={cn(
                "w-full rounded-lg border bg-card p-3 text-start transition-colors hover:bg-muted/40",
                row.mistaken && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={cn("truncate text-sm font-medium", row.mistaken && "line-through")}>{row.paidTo.name}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {[formatPaidDate(row.paidAt), row.stores.join(", ")].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="shrink-0 text-end">
                  <p className={cn("text-base font-semibold tabular-nums", row.mistaken && "line-through")}>{formatMoney(row.total)}</p>
                  {row.mistaken && mistakeBadge}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <LineTypeBadges types={row.types} />
                {invoiceCell(row)}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {/* Table */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">{t("common.date")}</TableHead>
              <TableHead>{t("payments.paidTo")}</TableHead>
              <TableHead>{t("common.stores")}</TableHead>
              <TableHead>{t("payments.types")}</TableHead>
              <TableHead>{t("payments.invoice")}</TableHead>
              <TableHead className="text-end">{t("common.total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                tabIndex={0}
                role="link"
                aria-label={t("payments.openPayment", { id: row.id })}
                onClick={() => onOpen(row.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(row.id);
                  }
                }}
                className={cn("cursor-pointer", row.mistaken && "text-muted-foreground")}
              >
                <TableCell className={cn("tabular-nums", row.mistaken && "line-through")}>{formatPaidDate(row.paidAt)}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    <span className={cn("font-medium", row.mistaken && "line-through")}>{row.paidTo.name}</span>
                    {row.mistaken && mistakeBadge}
                  </span>
                  {categoryName(row) && <span className="block text-[11px] text-muted-foreground">{categoryName(row)}</span>}
                </TableCell>
                <TableCell className="max-w-40 truncate text-xs tabular-nums">{row.stores.join(", ") || "—"}</TableCell>
                <TableCell>
                  <LineTypeBadges types={row.types} />
                </TableCell>
                <TableCell>{invoiceCell(row)}</TableCell>
                <TableCell className={cn("text-end font-semibold tabular-nums", row.mistaken && "line-through")}>
                  {formatMoney(row.total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
