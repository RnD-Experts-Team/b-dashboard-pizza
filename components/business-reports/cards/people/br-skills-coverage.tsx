"use client";

import { useCallback, useMemo, useState } from "react";
import { GraduationCap, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty } from "@/components/dashboard-v1/v1-ui";
import {
  SkillsCoverage,
  fmtCoverage,
  fmtStars,
  skillCoverageRows,
  type SkillCoverageRow,
} from "@/components/skills/skills-coverage";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import { ReportDialog, type ReportStat } from "@/components/business-reports/report-dialog";
import { StoreChecklist } from "@/components/business-reports/store-checklist";
import { averageRating, overviewStats, ratedCount, skillColumnStats } from "@/lib/skills/overview";
import { cn } from "@/lib/utils";
import type { Skill, SkillsOverviewEmployee, StoreSkillsOverview } from "@/types/skills.types";
import { ActiveToggle, ROW_CARD_HEIGHT, matchesActive, type ActiveFilter } from "./br-people-kit";

/* ──────────────────────────────────────────────────────────────────────────
 *  Skills & Coverage — Operations' employees × skills ratings for the loaded
 *  stores (a snapshot, not ranged): how much of the team is rated, how well,
 *  and which skills have the thinnest coverage. The dialog breaks it down by
 *  skill, by store, by employee, and lists who is missing each skill.
 * ────────────────────────────────────────────────────────────────────────── */

const PERCENT = 100;
const AMBER = "text-amber-600 dark:text-amber-400";
const BADGE_LG = "h-5 px-1.5 text-xs";

interface StoreRow {
  store: string;
  employees: SkillsOverviewEmployee[];
  coverage: number | null;
  average: number | null;
  alerted: number;
  fullyRated: number;
  /** skill id → % of the store's employees rated on it. */
  bySkill: Record<string, number | null>;
}

/** Employees with at least one of these stores ([] = every store). */
function inAnyStore(employees: SkillsOverviewEmployee[], stores: string[]): SkillsOverviewEmployee[] {
  if (stores.length === 0) return employees;
  const set = new Set(stores);
  return employees.filter((e) => e.store_numbers.some((s) => set.has(s)));
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "secondary" : "outline"} className={BADGE_LG}>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

function SkillName({ skill }: { skill: Skill }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      {skill.name}
      {skill.min_age !== null && (
        <span className={cn("inline-flex items-center gap-0.5 text-xs font-normal", AMBER)}>
          <ShieldAlert className="h-3.5 w-3.5" />
          {skill.min_age}+
        </span>
      )}
    </span>
  );
}

function SkillsDialog({ data, onClose }: { data: StoreSkillsOverview; onClose: () => void }) {
  const { params, storeName } = useReport();
  const skills = data.skills;
  const [empStores, setEmpStores] = useState<string[]>([]);
  const [empActive, setEmpActive] = useState<ActiveFilter>("active");
  const [gapStores, setGapStores] = useState<string[]>([]);

  const stats = useMemo(() => overviewStats(data.employees, skills), [data.employees, skills]);
  const skillRows = useMemo(() => skillCoverageRows(data.employees, skills), [data.employees, skills]);
  const [gapSkill, setGapSkill] = useState<string>(() => skillRows[0]?.skill.id ?? "");
  const skillCount = skills.length;

  const storeLabels = useCallback(
    (e: SkillsOverviewEmployee) => e.store_numbers.map(storeName).join(", "),
    [storeName],
  );

  /* ── Skills tab ── */
  const skillColumns = useMemo<PagedColumn<SkillCoverageRow>[]>(
    () => [
      { key: "skill", header: "Skill", render: (r) => <SkillName skill={r.skill} />, sortValue: (r) => r.skill.name },
      {
        key: "coverage",
        header: "Coverage",
        numeric: true,
        render: (r) => <span className={cn("font-semibold", r.low && AMBER)}>{fmtCoverage(r.pct)}</span>,
        sortValue: (r) => r.pct,
      },
      { key: "rated", header: "Rated", numeric: true, render: (r) => r.rated.toLocaleString(), sortValue: (r) => r.rated },
      { key: "avg", header: "Avg stars", numeric: true, render: (r) => fmtStars(r.average), sortValue: (r) => r.average },
      { key: "strong", header: "Strong (4★+)", numeric: true, render: (r) => r.strong.toLocaleString(), sortValue: (r) => r.strong },
      { key: "unrated", header: "Unrated", numeric: true, render: (r) => r.unrated.toLocaleString(), sortValue: (r) => r.unrated },
      {
        key: "note",
        header: "Restriction",
        render: (r) => <span className="text-muted-foreground">{r.skill.restriction_note ?? ""}</span>,
      },
    ],
    [],
  );

  /* ── By store tab ── */
  const storeRows = useMemo<StoreRow[]>(() => {
    const listed = new Set(data.employees.flatMap((e) => e.store_numbers));
    const stores = params.stores.filter((s) => listed.has(s));
    return stores.map((store) => {
      const employees = data.employees.filter((e) => e.store_numbers.includes(store));
      const st = overviewStats(employees, skills);
      return {
        store,
        employees,
        coverage: st.coveragePct,
        average: st.averageStars,
        alerted: st.alerted,
        fullyRated: st.fullyRated,
        bySkill: Object.fromEntries(
          skills.map((sk) => [
            sk.id,
            employees.length === 0 ? null : (skillColumnStats(employees, sk).rated / employees.length) * PERCENT,
          ]),
        ),
      };
    });
  }, [data.employees, params.stores, skills]);

  const storeColumns = useMemo<PagedColumn<StoreRow>[]>(
    () => [
      { key: "store", header: "Store", render: (r) => <span className="font-medium">{storeName(r.store)}</span>, sortValue: (r) => storeName(r.store) },
      { key: "employees", header: "Employees", numeric: true, render: (r) => r.employees.length.toLocaleString(), sortValue: (r) => r.employees.length },
      { key: "coverage", header: "Coverage", numeric: true, render: (r) => <span className="font-semibold">{fmtCoverage(r.coverage)}</span>, sortValue: (r) => r.coverage },
      { key: "avg", header: "Avg stars", numeric: true, render: (r) => fmtStars(r.average), sortValue: (r) => r.average },
      { key: "full", header: "Fully rated", numeric: true, render: (r) => r.fullyRated.toLocaleString(), sortValue: (r) => r.fullyRated },
      {
        key: "alerts",
        header: "Alerts",
        numeric: true,
        render: (r) => <span className={r.alerted > 0 ? AMBER : undefined}>{r.alerted.toLocaleString()}</span>,
        sortValue: (r) => r.alerted,
      },
      ...skills.map<PagedColumn<StoreRow>>((sk) => ({
        key: `skill-${sk.id}`,
        header: sk.name,
        numeric: true,
        render: (r) => fmtCoverage(r.bySkill[sk.id] ?? null),
        sortValue: (r) => r.bySkill[sk.id] ?? null,
      })),
    ],
    [storeName, skills],
  );

  /* ── Employees tab ── */
  const employees = useMemo(
    () => inAnyStore(data.employees, empStores).filter((e) => matchesActive(e.is_active, empActive)),
    [data.employees, empStores, empActive],
  );
  const employeeColumns = useMemo<PagedColumn<SkillsOverviewEmployee>[]>(
    () => [
      {
        key: "name",
        header: "Employee",
        render: (e) => (
          <span className="inline-flex items-center gap-1.5 font-medium">
            {e.name}
            {e.is_minor === true && (
              <Badge variant="outline" className={cn(BADGE_LG, "border-amber-500/40 bg-amber-500/10", AMBER)}>
                Minor
              </Badge>
            )}
          </span>
        ),
        sortValue: (e) => e.name,
      },
      { key: "stores", header: "Store(s)", render: (e) => storeLabels(e), sortValue: (e) => storeLabels(e) },
      { key: "status", header: "Status", render: (e) => <StatusBadge active={e.is_active} />, sortValue: (e) => (e.is_active ? 1 : 0) },
      {
        key: "rated",
        header: "Rated",
        numeric: true,
        render: (e) => (
          <span className={ratedCount(e) < skillCount ? undefined : "font-semibold text-emerald-600 dark:text-emerald-400"}>
            {ratedCount(e)} / {skillCount}
          </span>
        ),
        sortValue: (e) => ratedCount(e),
      },
      { key: "avg", header: "Avg stars", numeric: true, render: (e) => fmtStars(averageRating(e)), sortValue: (e) => averageRating(e) },
      {
        key: "alerts",
        header: "Alerts",
        numeric: true,
        render: (e) => <span className={e.alert_skill_ids.length > 0 ? cn("font-semibold", AMBER) : "text-muted-foreground"}>{e.alert_skill_ids.length}</span>,
        sortValue: (e) => e.alert_skill_ids.length,
      },
    ],
    [storeLabels, skillCount],
  );

  /* ── Gaps tab ── */
  const gapRow = skillRows.find((r) => r.skill.id === gapSkill) ?? skillRows[0];
  const missing = useMemo(
    () => (gapRow ? inAnyStore(data.employees, gapStores).filter((e) => !e.ratings[gapRow.skill.id]) : []),
    [data.employees, gapStores, gapRow],
  );
  const gapColumns = useMemo<PagedColumn<SkillsOverviewEmployee>[]>(
    () => employeeColumns.filter((c) => c.key !== "alerts"),
    [employeeColumns],
  );

  const tableStats: ReportStat[] = [
    { label: "Employees", value: stats.employees.toLocaleString(), sub: `${skillCount} skills` },
    { label: "Coverage", value: fmtCoverage(stats.coveragePct), sub: "rated cells" },
    { label: "Avg stars", value: fmtStars(stats.averageStars) },
    { label: "Fully rated", value: stats.fullyRated.toLocaleString() },
    { label: "Minors", value: stats.minors.toLocaleString(), sub: stats.noBirthDate > 0 ? `${stats.noBirthDate} without a birth date` : undefined },
    { label: "Alerts", value: stats.alerted.toLocaleString(), sub: "minors rated on restricted skills", tone: stats.alerted > 0 ? AMBER : undefined },
  ];
  const skillSearch = (r: SkillCoverageRow) => r.skill.name;
  const storeSearch = (r: StoreRow) => storeName(r.store);
  const employeeSearch = (e: SkillsOverviewEmployee) => `${e.name} ${storeLabels(e)}`;

  return (
    <ReportDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Skills & Coverage"
      category="people"
      subtitle={`Current ratings (a snapshot, not ranged) · ${params.stores.length} store${params.stores.length === 1 ? "" : "s"}`}
      stats={tableStats}
      tabs={[
        {
          key: "skills",
          label: `Skills (${skillCount})`,
          content: (
            <PagedTable
              size="lg"
              rows={skillRows}
              columns={skillColumns}
              rowKey={(r) => r.skill.id}
              initialSort="coverage"
              initialDir="asc"
              searchText={skillSearch}
              searchPlaceholder="Search skills…"
              rowClassName={(r) => (r.low ? "bg-amber-500/10 dark:bg-amber-500/15" : undefined)}
            />
          ),
        },
        {
          key: "stores",
          label: `By store (${storeRows.length})`,
          content: (
            <PagedTable
              size="lg"
              rows={storeRows}
              columns={storeColumns}
              rowKey={(r) => r.store}
              initialSort="coverage"
              initialDir="asc"
              searchText={storeSearch}
              searchPlaceholder="Search stores…"
            />
          ),
        },
        {
          key: "employees",
          label: `Employees (${data.employees.length.toLocaleString()})`,
          content: (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <ActiveToggle value={empActive} onChange={setEmpActive} />
                <StoreChecklist value={empStores} onChange={setEmpStores} />
              </div>
              <PagedTable
                key={`${empStores.join(",")}|${empActive}`}
                size="lg"
                rows={employees}
                columns={employeeColumns}
                rowKey={(e) => e.id}
                initialSort="rated"
                initialDir="asc"
                searchText={employeeSearch}
                searchPlaceholder="Search employees…"
              />
            </div>
          ),
        },
        {
          key: "gaps",
          label: "Gaps",
          content: gapRow ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={gapRow.skill.id} onValueChange={setGapSkill}>
                  <SelectTrigger size="sm" className="h-8 w-64 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {skillRows.map((r) => (
                      <SelectItem key={r.skill.id} value={r.skill.id} className="text-sm">
                        {r.skill.name} — {r.unrated} unrated
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <StoreChecklist value={gapStores} onChange={setGapStores} />
                <span className="text-sm text-muted-foreground">
                  {missing.length.toLocaleString()} employee{missing.length === 1 ? "" : "s"} not rated on {gapRow.skill.name}
                </span>
              </div>
              {missing.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Everyone here is rated on {gapRow.skill.name}.</p>
              ) : (
                <PagedTable
                  key={`${gapRow.skill.id}|${gapStores.join(",")}`}
                  size="lg"
                  rows={missing}
                  columns={gapColumns}
                  rowKey={(e) => e.id}
                  initialSort="name"
                  initialDir="asc"
                  searchText={employeeSearch}
                  searchPlaceholder="Search employees…"
                />
              )}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No skills on the list yet.</p>
          ),
        },
      ]}
    />
  );
}

export function BrSkillsCoverage({ data }: { data: StoreSkillsOverview }) {
  const { storeName } = useReport();
  const [open, setOpen] = useState(false);
  const hasData = data.skills.length > 0 && data.employees.length > 0;

  return (
    <V1Card
      reportId="br-skills-coverage"
      title="Skills & Coverage"
      category="people"
      period="R"
      showPeriodBadge={false}
      span={2}
      height={ROW_CARD_HEIGHT}
      headerNote={hasData ? `${data.skills.length} skills · current ratings` : "current ratings"}
      onExpand={hasData ? () => setOpen(true) : undefined}
    >
      {data.skills.length === 0 && data.employees.length === 0 ? (
        <V1Empty icon={GraduationCap}>No skills or employees for the loaded stores</V1Empty>
      ) : (
        <SkillsCoverage data={data} storeLabel={storeName} />
      )}

      {open && <SkillsDialog data={data} onClose={() => setOpen(false)} />}
    </V1Card>
  );
}
