"use client";

import type { ComponentType } from "react";
import { format, parseISO, isValid } from "date-fns";
import { CheckCircle2, ClipboardList, Sparkles, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDebriefActionStore,
  type DebriefPanelTab,
} from "@/lib/store/debrief-action.store";
import { V1Card } from "../v1-card";
import { V1Empty } from "../v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1ManagerTasksCard — outstanding manager to-dos for TODAY: unfilled
 *  debrief (due key) items and pending cleaning-chart tasks, listed by name.
 *
 *  Reads counts + labels published by the floating debrief panel
 *  (components/layout/floating-debrief-button.tsx → debrief-action.store), so
 *  it never re-fetches and its numbers always match that panel's own badge.
 *  Clicking a section header (or one of its listed items) opens that panel
 *  already switched to the matching tab.
 * ────────────────────────────────────────────────────────────────────────── */

function localTodayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** "Today" when the published date is today, otherwise the actual date. */
function periodLabel(dates: (string | null)[]): string {
  const today = localTodayIso();
  const known = dates.filter((d): d is string => Boolean(d));
  if (known.length === 0 || known.every((d) => d === today)) return "Today";
  const d = parseISO(known[0]);
  return isValid(d) ? format(d, "MMM d") : known[0];
}

function TaskSection({
  icon: Icon,
  label,
  count,
  total,
  unit,
  items,
  ready,
  onOpen,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  count: number;
  total: number;
  unit: string;
  items: string[];
  ready: boolean;
  onOpen?: () => void;
}) {
  const isClear = ready && count === 0;

  return (
    <div>
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-start transition-colors",
          onOpen && "hover:bg-muted/50",
        )}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-medium">
          <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
          {label}
        </span>
        <span className="flex items-center gap-1 text-[11px] font-semibold">
          {!ready ? (
            <span className="text-muted-foreground">—</span>
          ) : isClear ? (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Done
            </span>
          ) : (
            <>
              <span className="text-amber-600 dark:text-amber-400">
                {count} {unit}
              </span>
              {total > 0 && (
                <span className="text-[10px] font-normal text-muted-foreground">
                  of {total}
                </span>
              )}
            </>
          )}
        </span>
      </button>

      {ready && items.length > 0 && (
        <ul className="space-y-0 pl-5">
          {items.map((item, i) => (
            <li key={`${item}-${i}`}>
              <button
                type="button"
                onClick={onOpen}
                disabled={!onOpen}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded px-1 py-px text-start text-[10px] text-muted-foreground transition-colors",
                  onOpen && "hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <span className="h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                <span className="truncate">{item}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function V1ManagerTasksCard({
  span = 1,
  className,
}: {
  span?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const taskCounts = useDebriefActionStore((s) => s.taskCounts);
  const openDebriefPanel = useDebriefActionStore((s) => s.openDebriefPanel);

  const {
    dueKeysUnfilled,
    dueKeysTotal,
    dueKeysUnfilledLabels,
    dueKeysDate,
    dueKeysReady,
    cleaningPending,
    cleaningTotal,
    cleaningPendingLabels,
    cleaningDate,
    cleaningReady,
    canSeeCleaning,
    panelAvailable,
  } = taskCounts;

  const open = (tab: DebriefPanelTab) =>
    panelAvailable ? () => openDebriefPanel(tab) : undefined;

  const label = periodLabel(
    canSeeCleaning ? [dueKeysDate, cleaningDate] : [dueKeysDate],
  );

  // "All caught up" only once every visible section has actually loaded.
  const cleaningClear = !canSeeCleaning || (cleaningReady && cleaningPending === 0);
  const allClear = dueKeysReady && dueKeysUnfilled === 0 && cleaningClear;

  return (
    <V1Card
      title="Manager Tasks"
      category="sales"
      period="D"
      showPeriodBadge={false}
      span={span}
      className={className}
      headerNote={label}
    >
      {allClear ? (
        <V1Empty icon={CheckCircle2}>All caught up for {label.toLowerCase()}</V1Empty>
      ) : (
        <div className="space-y-1">
          <TaskSection
            icon={KeyRound}
            label="Debrief"
            count={dueKeysUnfilled}
            total={dueKeysTotal}
            unit="unfilled"
            items={dueKeysUnfilledLabels}
            ready={dueKeysReady}
            onOpen={open("due-keys")}
          />
          {canSeeCleaning && (
            <TaskSection
              icon={Sparkles}
              label="Cleaning Tasks"
              count={cleaningPending}
              total={cleaningTotal}
              unit="pending"
              items={cleaningPendingLabels}
              ready={cleaningReady}
              onOpen={open("cleaning-chart")}
            />
          )}
          {panelAvailable && (
            <p className="flex items-center gap-1 pt-1 text-[9px] text-muted-foreground">
              <ClipboardList className="h-2.5 w-2.5 shrink-0" />
              Tap a row to open the debrief panel
            </p>
          )}
        </div>
      )}
    </V1Card>
  );
}
