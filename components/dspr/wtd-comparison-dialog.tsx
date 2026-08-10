"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Dialog shell ────────────────────────────────────────────────────────────

interface WtdComparisonDialogProps {
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  badgeText?: string;
}

export function WtdComparisonDialog({
  open,
  onClose,
  onOpenChange,
  title,
  children,
  wide = false,
  badgeText = "Daily vs Week-to-Date Avg",
}: WtdComparisonDialogProps) {
  return (
    // Stop click from bubbling to the card underneath (which would re-open the dialog)
    <div onClick={(e) => e.stopPropagation()}>
      <Dialog open={open} onOpenChange={(o) => { onOpenChange?.(o); if (!o) onClose?.(); }}>
        <DialogContent
          className={cn(
            "overflow-y-auto max-h-[92vh] p-4 sm:p-6",
            wide ? "sm:!w-[95vw] sm:!max-w-[50vw]" : "sm:!max-w-5xl",
          )}
        >
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              {title}
              <Badge
                variant="outline"
                className="ms-1 gap-1 text-[9px] font-normal py-0 h-5"
              >
                <Calendar className="h-2.5 w-2.5" />
                {badgeText}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Two-column comparison layout ────────────────────────────────────────────

export function ComparisonGrid({
  daily,
  wtd,
  className,
}: {
  daily: ReactNode;
  wtd: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4", className)}>
      <div className="min-w-[240px]">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
            Today
          </span>
        </div>
        <div className="rounded-xl border bg-blue-50/40 dark:bg-blue-950/20 p-3">
          {daily}
        </div>
      </div>
      <div className="min-w-[240px]">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
          <span className="text-[11px] font-bold text-primary uppercase tracking-widest">
            Week-to-Date Avg
          </span>
        </div>
        <div className="rounded-xl border bg-primary/5 dark:bg-primary/10 p-3">
          {wtd}
        </div>
      </div>
    </div>
  );
}

// ─── Comparison table ─────────────────────────────────────────────────────────

export type ComparisonRow = {
  label: string;
  daily: string;
  wtd: string;
  dailyNum?: number;
  wtdNum?: number;
  higherIsBetter?: boolean;
};

export function ComparisonTable({
  rows,
  className,
}: {
  rows: ComparisonRow[];
  className?: string;
}) {
  return (
    <div className={cn("mt-4 overflow-hidden rounded-xl border", className)}>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/60">
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Metric
            </th>
            <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Today
            </th>
            <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-primary uppercase tracking-wider">
              WTD Avg
            </th>
            <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Change
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const { dailyNum, wtdNum, higherIsBetter = true } = row;
            let delta: string | null = null;
            let direction: "up" | "down" | "same" | null = null;

            if (dailyNum !== undefined && wtdNum !== undefined) {
              const diff = dailyNum - wtdNum;
              direction =
                Math.abs(diff) < 0.001 ? "same" : diff > 0 ? "up" : "down";
              if (wtdNum !== 0) {
                const pct = ((diff / Math.abs(wtdNum)) * 100).toFixed(1);
                delta = `${diff >= 0 ? "+" : ""}${pct}%`;
              }
            }

            const isGood =
              direction === null ||
              direction === "same" ||
              (higherIsBetter ? direction === "up" : direction === "down");

            return (
              <tr
                key={row.label}
                className={cn(
                  "border-b last:border-0 transition-colors hover:bg-muted/30",
                  i % 2 === 1 && "bg-muted/20",
                )}
              >
                <td className="px-4 py-2.5 font-medium text-foreground">
                  {row.label}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-mono text-blue-700 dark:text-blue-300">
                  {row.daily}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-mono text-foreground">
                  {row.wtd}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {direction !== null && (
                    <span
                      className={cn(
                        "inline-flex items-center justify-end gap-0.5 text-[10px] font-semibold",
                        direction === "same"
                          ? "text-muted-foreground"
                          : isGood
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-500 dark:text-red-400",
                      )}
                    >
                      {direction === "up" ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : direction === "down" ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : (
                        <Minus className="h-3 w-3" />
                      )}
                      {delta}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}