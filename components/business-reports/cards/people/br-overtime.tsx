"use client";

import { useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { V1Card } from "@/components/dashboard-v1/v1-card";
import { V1Empty, V1Metric, V1Toggle } from "@/components/dashboard-v1/v1-ui";
import { DASH, fmtHours, fmtNumber } from "@/components/labor/labor-format";
import { PagedTable, type PagedColumn } from "@/components/business-reports/paged-table";
import { useReport } from "@/components/business-reports/report-context";
import type { LaborOvertimeRow, LaborReport } from "@/types/business-reports.types";
import { ROW_CARD_HEIGHT, employeeName, safeDay } from "./br-people-kit";

/* ──────────────────────────────────────────────────────────────────────────
 *  Overtime — employee-weeks over the 40h / 60h thresholds across the range
 *  (covers V1's "Above 60 Hours Employees"). Thresholds come from the API.
 * ────────────────────────────────────────────────────────────────────────── */

type Band = "40" | "60";

const ROSE = "text-rose-600 dark:text-rose-400";

export function BrOvertime({ data }: { data: LaborReport }) {
  const { storeName } = useReport();
  const [band, setBand] = useState<Band>("40");
  const o = data.combined.overtime;
  const s = data.combined.summary;
  const t40 = o.over_40_hours_threshold;
  const t60 = o.over_60_hours_threshold;

  const rows = useMemo<LaborOvertimeRow[]>(() => (band === "40" ? o.over_40 : o.over_60) ?? [], [band, o.over_40, o.over_60]);

  const columns = useMemo<PagedColumn<LaborOvertimeRow>[]>(
    () => [
      {
        key: "name",
        header: "Employee",
        render: (r) => <span className="font-medium">{employeeName(r.name, r.employee_id)}</span>,
        sortValue: (r) => employeeName(r.name, r.employee_id),
      },
      { key: "store", header: "Store", render: (r) => storeName(r.store), sortValue: (r) => storeName(r.store) },
      {
        key: "position",
        header: "Position",
        render: (r) => <span className="text-muted-foreground">{r.position ?? DASH}</span>,
        sortValue: (r) => r.position,
      },
      { key: "week", header: "Week of", render: (r) => safeDay(r.week_start), sortValue: (r) => r.week_start },
      {
        key: "hours",
        header: "Hours",
        numeric: true,
        render: (r) => <span className={r.total_hours > t60 ? ROSE : "font-semibold"}>{fmtHours(r.total_hours)}</span>,
        sortValue: (r) => r.total_hours,
      },
      { key: "ot", header: "OT", numeric: true, render: (r) => fmtHours(r.overtime_hours), sortValue: (r) => r.overtime_hours },
    ],
    [storeName, t60],
  );

  const threshold = band === "40" ? t40 : t60;

  return (
    <V1Card
      reportId="br-overtime"
      title="Overtime"
      category="people"
      period="R"
      span={2}
      height={ROW_CARD_HEIGHT}
      headerControl={
        <V1Toggle<Band>
          className="ms-1.5"
          options={[
            { value: "40", label: `Over ${t40}` },
            { value: "60", label: `Over ${t60}` },
          ]}
          value={band}
          onChange={setBand}
        />
      }
    >
      <div className="flex h-full flex-col gap-1.5">
        <div className="grid shrink-0 grid-cols-2 gap-1">
          <V1Metric label={`Employee-weeks over ${t40}h`} value={fmtNumber(s.employee_weeks_over_40)} />
          <V1Metric
            label={`Employee-weeks over ${t60}h`}
            value={fmtNumber(s.employee_weeks_over_60)}
            accent={s.employee_weeks_over_60 > 0 ? ROSE : undefined}
          />
        </div>
        {rows.length === 0 ? (
          <V1Empty icon={Clock}>No one worked over {threshold} hours in a week</V1Empty>
        ) : (
          <PagedTable
            key={band}
            className="min-h-0 flex-1"
            rows={rows}
            columns={columns}
            rowKey={(r) => `${r.store}-${r.employee_id}-${r.week_start}`}
            initialSort="hours"
          />
        )}
      </div>
    </V1Card>
  );
}
