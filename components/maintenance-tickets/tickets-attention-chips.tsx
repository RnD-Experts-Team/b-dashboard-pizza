"use client";

import { useMemo } from "react";
import { CalendarClock, AlarmClock, PauseCircle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { todayForApi } from "@/lib/maintenance-tickets/filters-url";
import type { IssueStatus, TicketsAnalytics, TicketsFilters } from "@/types/maintenance-tickets.types";

/**
 * The "what needs me" row.
 *
 * Every figure here is a plain fact the backend already computed over the SAME
 * filtered set the list is showing -- it rides along on ?include_analytics=1,
 * so this row costs no extra request. Nothing here is a judgement about
 * urgency: this system has no due dates and no SLA, so "overdue" means only
 * that a date the coordinator themselves picked has passed.
 *
 * Each chip is a toggle. Pressing it narrows the list; pressing it again
 * restores. That is the whole interaction -- no menu, no Apply.
 */

/** The statuses an issue can sit in while still being live work. Mirrors
 *  IssueStatus::terminal() upstream, inverted. If a status is added there,
 *  add it here too or "overdue" will quietly stop counting it. */
const LIVE_STATUSES: IssueStatus[] = ["pending", "assigned", "in_progress", "waiting"];

type ChipId = "today" | "overdue" | "waiting" | "unassigned";

interface Chip {
  id: ChipId;
  label: string;
  hint: string;
  count: number | null;
  icon: typeof CalendarClock;
  /** Colour only where it carries meaning -- overdue is the one that is bad. */
  tone?: "warning";
  isActive: (f: TicketsFilters) => boolean;
  apply: (f: TicketsFilters) => TicketsFilters;
  clear: (f: TicketsFilters) => TicketsFilters;
}

function sameSet(a: readonly string[] | undefined, b: readonly string[]): boolean {
  if (!a || a.length !== b.length) return false;
  return b.every((v) => a.includes(v));
}

function withoutKeys(f: TicketsFilters, keys: Array<keyof TicketsFilters>): TicketsFilters {
  const next = { ...f };
  for (const k of keys) delete next[k];
  return next;
}

interface TicketsAttentionChipsProps {
  analytics: TicketsAnalytics | null;
  filters: TicketsFilters;
  onFiltersChange: (filters: TicketsFilters) => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function TicketsAttentionChips({
  analytics,
  filters,
  onFiltersChange,
  isLoading = false,
  disabled = false,
  className,
}: TicketsAttentionChipsProps) {
  const today = todayForApi();
  /** Yesterday, so "overdue" is strictly before today -- matching the backend,
   *  which counts assigned_date < today. */
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return todayForApi(d);
  }, []);

  const pendingCount = useMemo(() => {
    const row = analytics?.issues.statusBreakdown.find((b) => b.status === "pending");
    return row?.count ?? null;
  }, [analytics]);

  const chips: Chip[] = [
    {
      id: "today",
      label: "Scheduled today",
      hint: "Issues you booked a technician for today",
      // No count: "how many are scheduled today" is a different query from the
      // one the list just ran, and inventing a number here would be a guess.
      count: null,
      icon: CalendarClock,
      isActive: (f) => f.assigned_from === today && f.assigned_to === today,
      apply: (f) => ({ ...withoutKeys(f, ["assigned_from", "assigned_to", "issue_statuses"]), assigned_from: today, assigned_to: today }),
      clear: (f) => withoutKeys(f, ["assigned_from", "assigned_to"]),
    },
    {
      id: "overdue",
      label: "Date has passed",
      hint: "Still open, and the day you booked has already gone by",
      count: analytics?.attention.overdue ?? null,
      icon: AlarmClock,
      tone: "warning",
      isActive: (f) => f.assigned_to === yesterday && sameSet(f.issue_statuses, LIVE_STATUSES),
      apply: (f) => ({ ...withoutKeys(f, ["assigned_from", "assigned_to"]), assigned_to: yesterday, issue_statuses: LIVE_STATUSES }),
      clear: (f) => withoutKeys(f, ["assigned_from", "assigned_to", "issue_statuses"]),
    },
    {
      id: "waiting",
      label: "Waiting",
      hint: "Paused on purpose -- parts, access, or the branch",
      count: analytics?.attention.stuck ?? null,
      icon: PauseCircle,
      isActive: (f) => sameSet(f.issue_statuses, ["waiting"]),
      apply: (f) => ({ ...withoutKeys(f, ["assigned_from", "assigned_to"]), issue_statuses: ["waiting"] }),
      clear: (f) => withoutKeys(f, ["issue_statuses"]),
    },
    {
      id: "unassigned",
      label: "Nobody booked yet",
      hint: "Reported, but no technician and no date",
      count: pendingCount,
      icon: Inbox,
      isActive: (f) => sameSet(f.issue_statuses, ["pending"]),
      apply: (f) => ({ ...withoutKeys(f, ["assigned_from", "assigned_to"]), issue_statuses: ["pending"] }),
      clear: (f) => withoutKeys(f, ["issue_statuses"]),
    },
  ];

  function toggle(chip: Chip) {
    const active = chip.isActive(filters);
    const next = active ? chip.clear(filters) : chip.apply(filters);
    // Any change to what is being shown resets to the first page -- otherwise
    // you land on page 4 of a 2-page result and see nothing.
    onFiltersChange({ ...next, page: 1 });
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {chips.map((chip) => {
        const Icon = chip.icon;
        const active = chip.isActive(filters);
        const showCount = chip.count != null;
        const isWarning = chip.tone === "warning" && (chip.count ?? 0) > 0;

        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => toggle(chip)}
            disabled={disabled}
            aria-pressed={active}
            title={chip.hint}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-50",
              active
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
              isWarning && !active && "border-amber-500/40 text-amber-700 dark:text-amber-400"
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{chip.label}</span>
            {showCount && (
              <span
                className={cn(
                  "tabular-nums rounded-md px-1.5 py-0.5 text-[11px]",
                  isWarning
                    ? "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                    : "bg-muted text-foreground"
                )}
              >
                {chip.count}
              </span>
            )}
            {/* A dash, not a zero. Before the first analytics response lands we
                do not know the number, and 0 would claim we do. */}
            {!showCount && chip.id !== "today" && (
              <span className="text-[11px] text-muted-foreground">{isLoading ? "…" : "—"}</span>
            )}
          </button>
        );
      })}

      {analytics?.attention.asOf && (
        <span className="text-[11px] text-muted-foreground">
          as of {analytics.attention.asOf}
        </span>
      )}
    </div>
  );
}
