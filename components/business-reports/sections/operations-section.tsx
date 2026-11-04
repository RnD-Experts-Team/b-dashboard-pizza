"use client";

import { V1Section } from "@/components/dashboard-v1/v1-section";
import type { V1Span } from "@/components/dashboard-v1/v1-card";
import { SectionSlot } from "@/components/business-reports/section-slot";
import { useReport, useSection } from "@/components/business-reports/report-context";
import { BrPortalCard } from "@/components/business-reports/cards/operations/br-portal";
import { BrHnrCard } from "@/components/business-reports/cards/operations/br-hnr";
import { BrGoToCard } from "@/components/business-reports/cards/operations/br-goto";
import { BrPortalWeeklyCard } from "@/components/business-reports/cards/operations/br-portal-weekly";
import { BrNonNegotiableCard } from "@/components/business-reports/cards/operations/br-non-negotiable";
import { BrHnrPlusCard } from "@/components/business-reports/cards/operations/br-hnr-plus";
import { BrLaborCard } from "@/components/business-reports/cards/operations/br-labor";

const HALF: V1Span = 2;
const FULL: V1Span = 4;

/** Portal, HnR, Go-To, Portal & HNR Weekly, Non-Negotiables, HNR+. */
const OPERATIONS_SPANS: V1Span[] = [1, 1, 1, HALF, HALF, FULL];
const LABOR_SPANS: V1Span[] = [1];

/**
 * Operations & Speed over the range. Labor renders from the sales section and
 * comes after the operations cards in the DOM; the grid's dense flow puts it
 * in the first row's free cell, next to Go-To.
 */
export function OperationsSection() {
  const { rangeLabel } = useReport();
  const operations = useSection("operations");
  const sales = useSection("sales");

  return (
    <V1Section category="operations" weekLabel={rangeLabel} gridClassName="gap-[7px]">
      <SectionSlot state={operations} spans={OPERATIONS_SPANS} label="Operations">
        {(data) => (
          <>
            <BrPortalCard data={data} />
            <BrHnrCard data={data} />
            <BrGoToCard data={data} />
            <BrPortalWeeklyCard data={data} />
            <BrNonNegotiableCard data={data} />
            <BrHnrPlusCard data={data} />
          </>
        )}
      </SectionSlot>
      <SectionSlot state={sales} spans={LABOR_SPANS} label="Sales (labor %)">
        {(data) => <BrLaborCard data={data} />}
      </SectionSlot>
    </V1Section>
  );
}
