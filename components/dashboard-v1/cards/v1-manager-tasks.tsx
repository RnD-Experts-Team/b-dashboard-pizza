"use client";

import { format, parseISO, isValid } from "date-fns";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDebriefActionStore,
  type DebriefPanelTab,
} from "@/lib/store/debrief-action.store";
import { V1Card } from "../v1-card";
import { V1Empty, V1Metric, V1MetricGrid, V1SubLabel } from "../v1-ui";

/* ──────────────────────────────────────────────────────────────────────────
 *  V1ManagerTasksCard — outstanding manager to-dos for TODAY: unfilled
 *  debrief (due key) items and pending cleaning-chart tasks, listed by name.
 *  Built from the same V1 primitives (V1Metric/V1MetricGrid/V1SubLabel) as
 *  the rest of Dashboard V1, so it reads as one system with the other cards.
 *
 *  Reads counts + labels published by the floating debrief panel
 *  (components/layout/floating-debrief-button.tsx → debrief-action.store), so
 *  it never re-fetches and its numbers always match that panel's own badge.
 *  Clicking a metric tile (or one of the listed items) opens that panel
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

const CLEAR_ACCENT = "text-emerald-600 dark:text-emerald-400";
const PENDING_ACCENT = "text-amber-600 dark:text-amber-400";

function TaskMetric({
  label,
  count,
  total,
  ready,
  onOpen,
}: {
  label: string;
  count: number;
  total: number;
  ready: boolean;
  onOpen?: () => void;
}) {
  const isClear = ready && count === 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      className={cn(
        "block w-full text-start transition-opacity",
        onOpen && "hover:opacity-80",
      )}
    >
      <V1Metric
        label={label}
        value={!ready ? "—" : isClear ? "0" : count}
        accent={!ready ? undefined : isClear ? CLEAR_ACCENT : PENDING_ACCENT}
        sub={
          !ready ? undefined : isClear ? "All clear" : `of ${total} total`
        }
        size="lg"
      />
    </button>
  );
}

function TaskList({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: string[];
  onOpen?: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <V1SubLabel className="mb-1">{title}</V1SubLabel>
      <div className="space-y-1">
        {items.map((item, i) => (
          <button
            key={`${item}-${i}`}
            type="button"
            onClick={onOpen}
            disabled={!onOpen}
            className={cn(
              "flex w-full items-center gap-2 rounded-md bg-background/55 px-2.5 py-1.5 text-start transition-colors",
              onOpen && "hover:bg-muted/60",
            )}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            <span className="truncate text-[11px] font-medium">{item}</span>
          </button>
        ))}
      </div>
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
      ) : canSeeCleaning ? (
        <V1MetricGrid cols={2}>
          <TaskMetric
            label="Debrief"
            count={dueKeysUnfilled}
            total={dueKeysTotal}
            ready={dueKeysReady}
            onOpen={open("due-keys")}
          />
          <TaskMetric
            label="Cleaning"
            count={cleaningPending}
            total={cleaningTotal}
            ready={cleaningReady}
            onOpen={open("cleaning-chart")}
          />
        </V1MetricGrid>
      ) : (
        <TaskMetric
          label="Debrief"
          count={dueKeysUnfilled}
          total={dueKeysTotal}
          ready={dueKeysReady}
          onOpen={open("due-keys")}
        />
      )}

      {!allClear && (
        <div className="mt-3 space-y-3">
          <TaskList
            title="Debrief — Unfilled"
            items={dueKeysReady ? dueKeysUnfilledLabels : []}
            onOpen={open("due-keys")}
          />
          {canSeeCleaning && (
            <TaskList
              title="Cleaning — Pending"
              items={cleaningReady ? cleaningPendingLabels : []}
              onOpen={open("cleaning-chart")}
            />
          )}
          {panelAvailable && (
            <p className="flex items-center gap-1 text-[9.5px] text-muted-foreground">
              <ClipboardList className="h-2.5 w-2.5 shrink-0" />
              Tap a tile or item to open the debrief panel
            </p>
          )}
        </div>
      )}
    </V1Card>
  );
}
