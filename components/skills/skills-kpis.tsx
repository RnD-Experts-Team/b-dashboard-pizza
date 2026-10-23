"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Gauge, PieChart, Star, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OverviewStats } from "@/lib/skills/overview";

const AVERAGE_DIGITS = 1;

/** One cell of the strip, in the Storage page's KPI style. */
function StatCell({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  active,
  onClick,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn";
  active?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" />
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 font-heading text-lg font-semibold leading-none tabular-nums sm:text-xl",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{hint}</p>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          "min-w-0 bg-card px-3 py-2 text-start transition-colors hover:bg-muted/50",
          active && "bg-muted/60",
        )}
      >
        {body}
      </button>
    );
  }
  return <div className="min-w-0 bg-card px-3 py-2">{body}</div>;
}

/**
 * The overview's summary, over every employee of the picked stores (not just
 * the filtered rows). The two amber cells filter the table when clicked.
 */
export function SkillsKpis({
  stats,
  skillCount,
  activeStatus,
  onShowAlerts,
  onShowMinors,
}: {
  stats: OverviewStats;
  skillCount: number;
  activeStatus: string;
  onShowAlerts: () => void;
  onShowMinors: () => void;
}) {
  const t = useTranslations("skills");
  const dash = "—";

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm" data-slot="skills-kpis">
      <div className="grid grid-cols-1 gap-px bg-border min-[400px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCell icon={Users} label={t("kpiEmployees")} value={String(stats.employees)} />
        <StatCell
          icon={PieChart}
          label={t("kpiCoverage")}
          value={stats.coveragePct === null ? dash : `${stats.coveragePct}%`}
          hint={t("kpiCoverageHint", { skills: skillCount })}
        />
        <StatCell
          icon={Star}
          label={t("kpiAverage")}
          value={stats.averageStars === null ? dash : stats.averageStars.toFixed(AVERAGE_DIGITS)}
          hint={t("kpiAverageHint")}
        />
        <StatCell
          icon={CheckCircle2}
          label={t("kpiFullyRated")}
          value={String(stats.fullyRated)}
          hint={t("kpiFullyRatedHint")}
        />
        <StatCell
          icon={UserRound}
          label={t("kpiMinors")}
          value={String(stats.minors)}
          hint={stats.noBirthDate > 0 ? t("kpiNoBirthDate", { count: stats.noBirthDate }) : undefined}
          active={activeStatus === "minors"}
          onClick={stats.minors > 0 ? onShowMinors : undefined}
        />
        <StatCell
          icon={stats.alerted > 0 ? AlertTriangle : Gauge}
          label={t("kpiAlerts")}
          value={String(stats.alerted)}
          hint={stats.alerted > 0 ? t("kpiAlertsHint") : undefined}
          tone={stats.alerted > 0 ? "warn" : "default"}
          active={activeStatus === "alerts"}
          onClick={stats.alerted > 0 ? onShowAlerts : undefined}
        />
      </div>
    </div>
  );
}
