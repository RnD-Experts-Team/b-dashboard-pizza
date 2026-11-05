"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, PieChart, ShieldAlert, Star, UserRound, Users, type LucideIcon } from "lucide-react";
import { CATEGORIES } from "@/components/dashboard-v1/category";
import { overviewStats, skillColumnStats, type OverviewStats } from "@/lib/skills/overview";
import { cn } from "@/lib/utils";
import type { Skill, SkillsOverviewEmployee, StoreSkillsOverview } from "@/types/skills.types";

/* ──────────────────────────────────────────────────────────────────────────
 *  SkillsCoverage — how well a team is rated on the skills list, as a
 *  read-only summary: KPIs (employees, coverage of rated cells, average
 *  stars, fully rated, minors, alerts) and per-skill coverage bars with the
 *  lowest-coverage skills highlighted. Presentational only: Business
 *  Reports (many stores) and the Labor dashboard (one store) feed it.
 * ────────────────────────────────────────────────────────────────────────── */

const PEOPLE = CATEGORIES.people;
const PERCENT = 100;
/** A rating at or above this counts as "strong". */
export const STRONG_MIN_RATING = 4;
/** How many of the lowest-coverage skills are highlighted. */
const LOWEST_HIGHLIGHTED = 3;
const AVERAGE_DIGITS = 1;
const STORE_LABELS_SHOWN = 2;
const DASH = "—";
const AMBER_TEXT = "text-amber-600 dark:text-amber-400";

export interface SkillCoverageRow {
  skill: Skill;
  rated: number;
  /** % of the employees rated on it; null with no employees. */
  pct: number | null;
  average: number | null;
  /** Rated at least STRONG_MIN_RATING stars. */
  strong: number;
  unrated: number;
  /** Among the lowest-coverage skills (and not fully covered). */
  low: boolean;
}

/** Per-skill coverage over these employees, lowest coverage first. */
export function skillCoverageRows(employees: SkillsOverviewEmployee[], skills: Skill[]): SkillCoverageRow[] {
  const total = employees.length;
  const rows = skills.map((skill) => {
    const { rated, average } = skillColumnStats(employees, skill);
    const strong = employees.filter((e) => (e.ratings[skill.id]?.rating ?? 0) >= STRONG_MIN_RATING).length;
    return {
      skill,
      rated,
      pct: total === 0 ? null : (rated / total) * PERCENT,
      average,
      strong,
      unrated: total - rated,
      low: false,
    };
  });
  const sorted = [...rows].sort((a, b) => (a.pct ?? PERCENT) - (b.pct ?? PERCENT) || a.skill.name.localeCompare(b.skill.name));
  const lowIds = new Set(
    sorted
      .filter((r) => r.pct !== null && r.pct < PERCENT)
      .slice(0, LOWEST_HIGHLIGHTED)
      .map((r) => r.skill.id),
  );
  return sorted.map((r) => ({ ...r, low: lowIds.has(r.skill.id) }));
}

export function fmtStars(v: number | null): string {
  return v === null ? DASH : `${v.toFixed(AVERAGE_DIGITS)}★`;
}

export function fmtCoverage(v: number | null): string {
  return v === null ? DASH : `${Math.round(v)}%`;
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  warn,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border/50 bg-background/55 px-2.5 py-1.5">
      <p className="flex items-center gap-1 truncate text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      <p className={cn("truncate text-lg font-bold leading-tight tabular-nums", warn && AMBER_TEXT)} title={value}>
        {value}
      </p>
      {hint && <p className="truncate text-[10px] text-muted-foreground" title={hint}>{hint}</p>}
    </div>
  );
}

/** The six KPI tiles; 3 per row in a narrow container, 6 in a wide one. */
export function SkillsCoverageKpis({ stats, skillCount }: { stats: OverviewStats; skillCount: number }) {
  return (
    <div className="grid grid-cols-2 gap-1 @sm:grid-cols-3 @3xl:grid-cols-6">
      <Kpi icon={Users} label="Employees" value={stats.employees.toLocaleString()} />
      <Kpi icon={PieChart} label="Coverage" value={fmtCoverage(stats.coveragePct)} hint={`of ${skillCount} skills × employees rated`} />
      <Kpi icon={Star} label="Avg stars" value={fmtStars(stats.averageStars)} hint="over every rating" />
      <Kpi icon={CheckCircle2} label="Fully rated" value={stats.fullyRated.toLocaleString()} hint="rated on every skill" />
      <Kpi
        icon={UserRound}
        label="Minors"
        value={stats.minors.toLocaleString()}
        hint={stats.noBirthDate > 0 ? `${stats.noBirthDate} without a birth date` : undefined}
      />
      <Kpi
        icon={AlertTriangle}
        label="Alerts"
        value={stats.alerted.toLocaleString()}
        hint="minors rated on restricted skills"
        warn={stats.alerted > 0}
      />
    </div>
  );
}

/** One skill's coverage bar row. */
function SkillRow({ row }: { row: SkillCoverageRow }) {
  const width = row.pct === null ? 0 : Math.min(PERCENT, row.pct);
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_3.25rem_3rem_3.5rem] items-center gap-2 rounded-md px-1.5 py-1",
        row.low && "bg-amber-500/10 dark:bg-amber-500/15",
      )}
    >
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate text-[11.5px] font-medium" title={row.skill.name}>
          {row.skill.name}
        </span>
        {row.skill.min_age !== null && (
          <ShieldAlert
            className={cn("h-3 w-3 shrink-0", AMBER_TEXT)}
            aria-label={`Not for under ${row.skill.min_age}`}
          />
        )}
        {row.low && (
          <span className={cn("shrink-0 rounded px-1 text-[9px] font-bold uppercase", AMBER_TEXT, "bg-amber-500/15 dark:bg-amber-500/20")}>
            Low
          </span>
        )}
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
          <span
            className={cn("block h-full rounded-full", row.low && "bg-amber-500")}
            style={{ width: `${width}%`, backgroundColor: row.low ? undefined : PEOPLE.chartColors[0] }}
          />
        </span>
        <span className="w-9 shrink-0 text-end text-[11px] font-semibold tabular-nums">{fmtCoverage(row.pct)}</span>
      </span>
      <span className="text-end text-[11px] tabular-nums">{fmtStars(row.average)}</span>
      <span className="text-end text-[11px] tabular-nums text-emerald-600 dark:text-emerald-400">{row.strong}</span>
      <span className={cn("text-end text-[11px] tabular-nums", row.unrated > 0 ? "text-muted-foreground" : "text-muted-foreground/60")}>
        {row.unrated}
      </span>
    </div>
  );
}

/** The per-skill coverage list (lowest first), with its header. */
export function SkillCoverageList({ rows }: { rows: SkillCoverageRow[] }) {
  return (
    <div className="space-y-0.5">
      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_3.25rem_3rem_3.5rem] gap-2 px-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Skill</span>
        <span>% employees rated</span>
        <span className="text-end">Avg</span>
        <span className="text-end" title={`Rated ${STRONG_MIN_RATING}★ or more`}>
          Strong
        </span>
        <span className="text-end">Unrated</span>
      </div>
      {rows.map((r) => (
        <SkillRow key={r.skill.id} row={r} />
      ))}
    </div>
  );
}

/**
 * KPIs + per-skill coverage for one overview. `storeLabel` turns a store
 * number into "number · name" for the caption of which stores it covers.
 */
export function SkillsCoverage({
  data,
  storeLabel,
  className,
}: {
  data: StoreSkillsOverview;
  storeLabel?: (store: string) => string;
  className?: string;
}) {
  const stats = useMemo(() => overviewStats(data.employees, data.skills), [data]);
  const rows = useMemo(() => skillCoverageRows(data.employees, data.skills), [data]);
  const stores = useMemo(
    () => [...new Set(data.employees.flatMap((e) => e.store_numbers))].sort(),
    [data.employees],
  );

  const storeCaption = useMemo(() => {
    if (!storeLabel || stores.length === 0) return null;
    const shown = stores.slice(0, STORE_LABELS_SHOWN).map(storeLabel).join(", ");
    const more = stores.length - STORE_LABELS_SHOWN;
    return more > 0 ? `${shown} +${more} more` : shown;
  }, [stores, storeLabel]);

  if (data.skills.length === 0) {
    return (
      <p className={cn("py-6 text-center text-[12px] text-muted-foreground", className)}>
        No skills on the list yet — add them on the Skills page.
      </p>
    );
  }
  if (data.employees.length === 0) {
    return <p className={cn("py-6 text-center text-[12px] text-muted-foreground", className)}>No employees to rate.</p>;
  }

  return (
    <div className={cn("@container space-y-2", className)} data-slot="skills-coverage">
      <SkillsCoverageKpis stats={stats} skillCount={data.skills.length} />
      {storeCaption && (
        <p className="truncate text-[10px] text-muted-foreground" title={stores.map((s) => storeLabel?.(s) ?? s).join(", ")}>
          {storeCaption}
        </p>
      )}
      <SkillCoverageList rows={rows} />
    </div>
  );
}
