"use client";

import type { ReactNode } from "react";
import { Maximize2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CATEGORIES, PERIOD_LABEL, type CategoryKey, type Period } from "./category";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1Card — the single card shell for Dashboard V1.
 *
 *  It owns the category color (gradient + left accent + tinted icon), the
 *  period badge, the optional expand affordance, and the grid column span.
 *  Card bodies stay tiny: they just render content into `children` and, when
 *  they have a detail view, own their own dialog + pass `onExpand`.
 * ────────────────────────────────────────────────────────────────────────── */

const SPAN_CLASS: Record<1 | 2 | 3 | 4, string> = {
  1: "col-span-1 md:col-span-1 lg:col-span-1",
  2: "col-span-1 md:col-span-1 lg:col-span-2",
  3: "col-span-1 md:col-span-1 lg:col-span-3",
  4: "col-span-1 md:col-span-2 lg:col-span-4",
};

export interface V1CardProps {
  title: string;
  category: CategoryKey;
  period: Period;
  /** Grid column span. Reserve 4 (full-width) for a rare, deliberately bigger feature card. */
  span?: 1 | 2 | 3 | 4;
  /** Right-aligned note in the header (e.g. a week range). */
  headerNote?: ReactNode;
  /** Inline control rendered after the period badge (e.g. a Day/WTD toggle). */
  headerControl?: ReactNode;
  /** Hide the static period badge (e.g. "Day · WTD") — use when the header already has its own interactive toggle making it redundant. Defaults to shown. */
  showPeriodBadge?: boolean;
  /** When provided, renders an expand button and makes the card clickable. */
  onExpand?: () => void;
  /** Override the default fixed height (e.g. for chart cards). */
  bodyClassName?: string;
  /** Override the default 280px card height, in pixels. */
  height?: number;
  className?: string;
  children: ReactNode;
}

export function V1Card({
  title,
  category,
  period,
  span = 1,
  headerNote,
  headerControl,
  showPeriodBadge = true,
  onExpand,
  bodyClassName,
  height,
  className,
  children,
}: V1CardProps) {
  const cat = CATEGORIES[category];
  const Icon = cat.icon;
  const clickable = Boolean(onExpand);

  return (
    <Card
      onClick={onExpand}
      style={height ? { height } : undefined}
      className={cn(
        "flex flex-col gap-0 overflow-hidden border-l-2 py-1.5 transition-shadow",
        !height && "h-[280px]",
        cat.cardBorder ?? "border-none",
        cat.border,
        cat.gradient,
        clickable && "cursor-pointer hover:shadow-md",
        SPAN_CLASS[span],
        className,
      )}
    >
      <CardHeader className="shrink-0 px-3 pb-1">
        <CardTitle className="flex items-center gap-1.5 text-[11px] font-semibold">
          <div className={cn("rounded p-0.5", cat.iconBg)}>
            <Icon className={cn("h-3 w-3", cat.text)} />
          </div>
          <span className="truncate">{title}</span>
          {showPeriodBadge && (
            <Badge
              variant="outline"
              className="ms-1 h-4 shrink-0 border-current/30 px-1.5 py-0 text-[8px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {PERIOD_LABEL[period]}
            </Badge>
          )}
          {headerControl}
          <div className="ms-auto flex items-center gap-1.5">
            {headerNote && (
              <span className="text-[10px] font-normal text-muted-foreground">
                {headerNote}
              </span>
            )}
            {clickable && (
              <Maximize2 className={cn("h-3 w-3 shrink-0 opacity-50", cat.text)} />
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn("min-h-0 flex-1 overflow-y-auto px-3 pb-1", bodyClassName)}
      >
        {children}
      </CardContent>
    </Card>
  );
}
