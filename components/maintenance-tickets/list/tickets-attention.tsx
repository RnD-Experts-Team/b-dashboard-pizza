"use client";

import { AlarmClock, CircleCheckBig, Stamp, Store, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { todayForApi } from "@/lib/maintenance-tickets/filters-url";
import { ATTENTION_CHIPS, type AttentionChip } from "@/lib/maintenance-workflow";
import type { IssueStatus, TicketsAnalytics, TicketsFilters } from "@/types/maintenance-tickets.types";

/** Every status an issue can be in while it is still live work. */
const LIVE: IssueStatus[] = ["new", "in_review", "waiting_on_store", "inspection", "waiting_approval", "scheduled", "work_done"];

const ICON: Record<AttentionChip, LucideIcon> = {
  waiting_on_store: Store,
  waiting_approval: Stamp,
  work_done: CircleCheckBig,
  overdue: AlarmClock,
};

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayForApi(d);
}

function sameSet(a: readonly string[] | undefined, b: readonly string[]): boolean {
  const list = a ?? [];
  return list.length === b.length && b.every((v) => list.includes(v));
}

function without(f: TicketsFilters, keys: (keyof TicketsFilters)[]): TicketsFilters {
  return Object.fromEntries(Object.entries(f).filter(([k]) => !keys.includes(k as keyof TicketsFilters))) as TicketsFilters;
}

/**
 * The "needs attention" chips (UI doc §1): Waiting on store · Waiting for
 * approval · Work done to check · Overdue. Counts come from the unnarrowed
 * analytics so they hold still while a chip filters the list. Overdue is
 * the server's count: live issues whose latest booking day has passed.
 */
export function TicketsAttention({
  baseAnalytics,
  filters,
  onFiltersChange,
  disabled,
}: {
  baseAnalytics: TicketsAnalytics | null;
  filters: TicketsFilters;
  onFiltersChange: (next: TicketsFilters) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("maintenanceV2");
  const before = yesterday();

  function countOf(chip: (typeof ATTENTION_CHIPS)[number]): number | null {
    if (!baseAnalytics) return null;
    if (chip.status === null) return baseAnalytics.attention.overdue;
    return baseAnalytics.issues.statusBreakdown.find((b) => b.status === chip.status)?.count ?? 0;
  }

  function isActive(chip: (typeof ATTENTION_CHIPS)[number]): boolean {
    if (chip.status === null) return filters.assigned_to === before && sameSet(filters.issue_statuses, LIVE);
    return sameSet(filters.issue_statuses, [chip.status]) && !filters.assigned_to;
  }

  function toggle(chip: (typeof ATTENTION_CHIPS)[number]) {
    const base = without(filters, ["issue_statuses", "assigned_from", "assigned_to", "page"]);
    if (isActive(chip)) return onFiltersChange({ ...base, page: 1 });
    if (chip.status === null) return onFiltersChange({ ...base, assigned_to: before, issue_statuses: LIVE, page: 1 });
    onFiltersChange({ ...base, issue_statuses: [chip.status], page: 1 });
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("tickets.list.attention")}>
      {ATTENTION_CHIPS.map((chip) => {
        const Icon = ICON[chip.id];
        const active = isActive(chip);
        const count = countOf(chip);
        const warn = chip.id === "overdue" && (count ?? 0) > 0;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => toggle(chip)}
            disabled={disabled}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
              active ? "border-primary bg-primary/10 text-foreground" : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
              warn && !active && "border-orange-500/40 text-orange-700 dark:text-orange-400",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {t(chip.key)}
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[11px] tabular-nums",
                warn ? "bg-orange-500/15 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400" : "bg-muted text-foreground",
              )}
            >
              {count ?? "—"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
