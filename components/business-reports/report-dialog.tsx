"use client";

import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CATEGORIES, type CategoryKey } from "@/components/dashboard-v1/category";
import { cn } from "@/lib/utils";
import { useReport } from "./report-context";

/* ──────────────────────────────────────────────────────────────────────────
 *  ReportDialog — the expand view of every Business Reports card.
 *
 *  Built for big ranges: wide (up to 1280px) and tall (88vh), a category-
 *  coloured header with the range, a row of large KPI tiles, then tabs whose
 *  content scrolls on its own. Tables inside use the roomier `RD_*` classes
 *  (12.5px, zebra rows, sticky header) or `PagedTable size="lg"`.
 * ────────────────────────────────────────────────────────────────────────── */

export interface ReportStat {
  label: string;
  value: ReactNode;
  /** Small line under the value. */
  sub?: ReactNode;
  /** Tailwind text colour for the value. */
  tone?: string;
}

export interface ReportTab {
  key: string;
  label: string;
  content: ReactNode;
}

export function ReportDialog({
  open,
  onOpenChange,
  title,
  category,
  subtitle,
  stats,
  tabs,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  category: CategoryKey;
  /** Defaults to the loaded range and store count. */
  subtitle?: string;
  stats?: ReportStat[];
  /** Tabbed body; when absent, `children` is the body. */
  tabs?: ReportTab[];
  children?: ReactNode;
}) {
  const { rangeLabel } = useReport();
  const cat = CATEGORIES[category];
  const Icon = cat.icon;
  const [tab, setTab] = useState(tabs?.[0]?.key ?? "");
  const activeTab = tabs?.find((t) => t.key === tab) ?? tabs?.[0];

  return (
    // Keep clicks inside from reaching the card underneath (which would reopen it).
    <div onClick={(e) => e.stopPropagation()} className="contents">
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[88vh] max-h-[88vh] w-[96vw] max-w-[1280px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1280px]">
          <DialogHeader className={cn("shrink-0 border-b px-5 py-3 text-start", cat.gradient)}>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <span className={cn("rounded p-1", cat.iconBg)}>
                <Icon className={cn("h-4 w-4", cat.text)} />
              </span>
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs">{subtitle ?? rangeLabel}</DialogDescription>
          </DialogHeader>

          {stats && stats.length > 0 && (
            <div className="grid shrink-0 grid-cols-2 gap-2 border-b bg-muted/20 px-5 py-3 sm:grid-cols-3 lg:grid-cols-6">
              {stats.map((s) => (
                <div key={s.label} className="min-w-0 rounded-lg border bg-card px-3 py-2">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <p className={cn("truncate font-heading text-xl font-bold leading-tight tabular-nums", s.tone)}>{s.value}</p>
                  {s.sub && <p className="truncate text-[11px] text-muted-foreground">{s.sub}</p>}
                </div>
              ))}
            </div>
          )}

          {tabs && tabs.length > 1 && (
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b px-5 py-2" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab?.key === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    activeTab?.key === t.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {tabs ? activeTab?.content : children}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** A titled block inside a dialog body. */
export function ReportBlock({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2 rounded-lg border bg-card p-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/* Roomier table classes for dialogs (the cards keep V1_*). */
export const RD_TBL = "w-full border-collapse text-[12.5px] [&_tbody_tr:nth-child(even)]:bg-muted/25 [&_tbody_tr:hover]:bg-muted/50";
export const RD_TH =
  "sticky top-0 z-[1] whitespace-nowrap border-b bg-muted px-3 py-2 text-start text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
export const RD_TD = "whitespace-nowrap border-b border-border/40 px-3 py-1.5";
export const RD_NUM = "text-end tabular-nums";
