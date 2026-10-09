"use client";

import { useTranslations } from "next-intl";
import { CalendarX2, Database, PenLine, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_BAR, TONE_BORDER_START, TONE_SOFT, TONE_TEXT, type Tone } from "./hub-ui";
import type { HubSummary } from "./summary";

/* ────────────────────────────────────────────────────────────────────────── */
/*  KPI strip — one tile per thing the manager tracks; each opens its tab.   */
/*  "—" until loaded, never a fake 0.                                        */
/* ────────────────────────────────────────────────────────────────────────── */

function Tile({
  icon: Icon,
  label,
  value,
  total,
  caption,
  tone,
  progress,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number | null;
  total?: number | null;
  caption?: string;
  tone: Tone;
  progress?: number | null;
  onClick: () => void;
}) {
  const ready = value != null;
  return (
    <button
      type="button"
      onClick={onClick}
      data-report-target="card"
      data-report-label={label}
      className={cn(
        "group flex min-w-0 flex-col gap-1.5 rounded-xl border border-s-2 bg-card px-3 py-2.5 text-start transition-all duration-200 hover:bg-accent/40 hover:shadow-sm",
        TONE_BORDER_START[ready ? tone : "muted"],
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={cn("shrink-0 rounded p-1", TONE_SOFT[ready ? tone : "muted"])}>
          <Icon className={cn("h-3 w-3", ready ? TONE_TEXT[tone] : "text-muted-foreground")} aria-hidden="true" />
        </span>
        <span className="truncate text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </span>
      <span className="flex items-baseline gap-1">
        <span
          className={cn(
            "text-xl font-semibold leading-none tabular-nums transition-colors",
            ready && (tone === "warn" || tone === "bad") && TONE_TEXT[tone],
          )}
        >
          {ready ? value : "—"}
        </span>
        {ready && total != null && <span className="text-xs text-muted-foreground tabular-nums">/ {total}</span>}
      </span>
      <span className="min-h-4 truncate text-[11px] text-muted-foreground">{ready ? caption : " "}</span>
      {progress != null && (
        <span className="block h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <span
            className={cn(
              "block h-full rounded-full transition-[width] duration-700 ease-out",
              ready ? (progress >= 100 ? TONE_BAR.good : TONE_BAR[tone]) : "bg-transparent",
            )}
            style={{ width: `${ready ? progress : 0}%` }}
          />
        </span>
      )}
    </button>
  );
}

function pct(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 100;
}

export function HubKpis({
  summary,
  canSeeCleaning,
  employeeRangeDays,
  onGo,
}: {
  summary: HubSummary;
  canSeeCleaning: boolean;
  employeeRangeDays: number;
  onGo: (tab: "tasks" | "debriefs" | "employee-debriefs" | "missed") => void;
}) {
  const t = useTranslations("managerHub.kpis");
  const debriefsFilled = summary.debriefsTotal - summary.debriefsMissing;
  const tasksDone = summary.tasksTotal - summary.tasksOpen;

  return (
    <div className={cn("grid grid-cols-2 gap-1.5 sm:gap-2", canSeeCleaning ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
      <Tile
        icon={Database}
        label={t("debriefs")}
        value={summary.debriefsReady ? debriefsFilled : null}
        total={summary.debriefsTotal}
        tone={summary.debriefsMissing > 0 ? "warn" : "good"}
        caption={
          summary.debriefsTotal === 0
            ? t("noneDue")
            : summary.debriefsMissing > 0
              ? t("missingCount", { count: summary.debriefsMissing })
              : t("allFilled")
        }
        progress={pct(debriefsFilled, summary.debriefsTotal)}
        onClick={() => onGo("debriefs")}
      />
      {canSeeCleaning && (
        <Tile
          icon={Sparkles}
          label={t("cleaning")}
          value={summary.tasksReady ? tasksDone : null}
          total={summary.tasksTotal}
          tone={summary.tasksOverdue > 0 ? "bad" : summary.tasksOpen > 0 ? "warn" : "good"}
          caption={
            summary.tasksTotal === 0
              ? t("noneDue")
              : summary.tasksOverdue > 0
                ? t("overdueCount", { count: summary.tasksOverdue })
                : summary.tasksOpen > 0
                  ? t("pendingCount", { count: summary.tasksOpen })
                  : t("allDone")
          }
          progress={pct(tasksDone, summary.tasksTotal)}
          onClick={() => onGo("tasks")}
        />
      )}
      <Tile
        icon={CalendarX2}
        label={t("missed")}
        value={summary.backlogReady ? summary.backlogCount : null}
        tone={summary.backlogCount > 0 ? "bad" : "good"}
        caption={
          summary.backlogCount === 0
            ? t("nothingMissed")
            : canSeeCleaning
              ? t("missedSplit", { debriefs: summary.backlogDebriefs, tasks: summary.backlogTasks })
              : t("missedDebriefs", { count: summary.backlogDebriefs })
        }
        onClick={() => onGo("missed")}
      />
      <Tile
        icon={PenLine}
        label={t("employeeDebriefs", { days: employeeRangeDays })}
        value={summary.employeeReady ? summary.employeeDebriefs.length : null}
        tone="info"
        caption={t("employeeToday", { count: summary.employeeToday })}
        onClick={() => onGo("employee-debriefs")}
      />
    </div>
  );
}
