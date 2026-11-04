"use client";

import { V1Section } from "@/components/dashboard-v1/v1-section";
import type { V1Span } from "@/components/dashboard-v1/v1-card";
import { useReport, useSection } from "@/components/business-reports/report-context";
import { SectionSlot } from "@/components/business-reports/section-slot";
import { BrLaborSummary } from "@/components/business-reports/cards/people/br-labor-summary";
import { BrHeadcount } from "@/components/business-reports/cards/people/br-headcount";
import { BrTenure } from "@/components/business-reports/cards/people/br-tenure";
import { BrTurnover } from "@/components/business-reports/cards/people/br-turnover";
import { BrLaborPerformance } from "@/components/business-reports/cards/people/br-labor-performance";
import { BrOvertime } from "@/components/business-reports/cards/people/br-overtime";
import { BrLaborTrend } from "@/components/business-reports/cards/people/br-labor-trend";
import { BrPaySummary } from "@/components/business-reports/cards/people/br-pay-summary";
import { BrBirthdays } from "@/components/business-reports/cards/people/br-birthdays";
import { BrRoster } from "@/components/business-reports/cards/people/br-roster";
import { BrDebriefs } from "@/components/business-reports/cards/people/br-debriefs";

/* ──────────────────────────────────────────────────────────────────────────
 *  People & Labor — the Labor report (Hiring) and the debriefs (Data) for
 *  every loaded store over the range. Each source loads on its own.
 * ────────────────────────────────────────────────────────────────────────── */

/** The spans of the labor cards below, in order (skeletons match them). */
const FULL: V1Span = 4;
const HALF: V1Span = 2;
const QUARTER: V1Span = 1;
const LABOR_SPANS: V1Span[] = [FULL, QUARTER, QUARTER, HALF, HALF, HALF, HALF, QUARTER, QUARTER, FULL];
const DEBRIEF_SPANS: V1Span[] = [HALF];

export function PeopleSection() {
  const { rangeLabel } = useReport();
  const labor = useSection("labor");
  const debriefs = useSection("debriefs");

  return (
    <V1Section category="people" weekLabel={rangeLabel} gridClassName="gap-[7px]">
      <SectionSlot state={labor} spans={LABOR_SPANS} label="Labor report">
        {(data) => (
          <>
            <BrLaborSummary data={data} />
            <BrHeadcount data={data} />
            <BrTenure data={data} />
            <BrTurnover data={data} />
            <BrLaborPerformance data={data} />
            <BrOvertime data={data} />
            <BrLaborTrend data={data} />
            <BrPaySummary data={data} />
            <BrBirthdays data={data} />
            <BrRoster data={data} />
          </>
        )}
      </SectionSlot>
      <SectionSlot state={debriefs} spans={DEBRIEF_SPANS} label="Debriefs">
        {(data) => <BrDebriefs data={data} />}
      </SectionSlot>
    </V1Section>
  );
}
