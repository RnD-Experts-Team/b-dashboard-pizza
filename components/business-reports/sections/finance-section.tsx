"use client";

import { V1Section } from "@/components/dashboard-v1/v1-section";
import type { V1Span } from "@/components/dashboard-v1/v1-card";
import { SectionSlot } from "@/components/business-reports/section-slot";
import { useReport, useSection } from "@/components/business-reports/report-context";
import { BrCashControlCard } from "@/components/business-reports/cards/finance/br-cash-control";
import { BrTransfersCard } from "@/components/business-reports/cards/finance/br-transfers";
import { BrMoneyOwedCard } from "@/components/business-reports/cards/finance/br-money-owed";

const HALF: V1Span = 2;
const CASH_SPANS: V1Span[] = [1];
const TRANSFER_SPANS: V1Span[] = [1];
const MONEY_OWED_SPANS: V1Span[] = [HALF];

/** Finance & Cash over the range: cash control (sales), transfers (operations), money owed (hooks). */
export function FinanceSection() {
  const { rangeLabel } = useReport();
  const sales = useSection("sales");
  const operations = useSection("operations");
  const feedback = useSection("feedback");

  return (
    <V1Section category="finance" weekLabel={rangeLabel} gridClassName="gap-[7px]">
      <SectionSlot state={sales} spans={CASH_SPANS} label="Sales (cash control)">
        {(data) => <BrCashControlCard data={data} />}
      </SectionSlot>
      <SectionSlot state={operations} spans={TRANSFER_SPANS} label="Operations (transfers)">
        {(data) => <BrTransfersCard data={data} />}
      </SectionSlot>
      <SectionSlot state={feedback} spans={MONEY_OWED_SPANS} label="Money owed">
        {(data) => <BrMoneyOwedCard data={data} />}
      </SectionSlot>
    </V1Section>
  );
}
