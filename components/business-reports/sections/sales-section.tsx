"use client";

import { V1Section } from "@/components/dashboard-v1/v1-section";
import { SectionSlot } from "@/components/business-reports/section-slot";
import { useReport, useSection } from "@/components/business-reports/report-context";
import { BR_SALES_TREND_SPAN, BrSalesTrendCard } from "@/components/business-reports/cards/sales/br-sales-trend";
import { BR_SALES_SUMMARY_SPAN, BrSalesSummaryCard } from "@/components/business-reports/cards/sales/br-sales-summary";
import { BR_PHONE_INSTORE_SPAN, BrPhoneInStoreCard } from "@/components/business-reports/cards/sales/br-phone-instore";
import {
  BR_HOURLY_CHANNELS_SPAN,
  BrHourlyChannelsCard,
} from "@/components/business-reports/cards/sales/br-hourly-channels";
import { BR_CHANNEL_SALES_SPAN, BrChannelSalesCard } from "@/components/business-reports/cards/sales/br-channel-sales";
import {
  BR_ORDERS_VS_SALES_SPAN,
  BrOrdersVsSalesCard,
} from "@/components/business-reports/cards/sales/br-orders-vs-sales";
import { BR_UPSELLING_SPAN, BrUpsellingCard } from "@/components/business-reports/cards/sales/br-upselling";

/* ──────────────────────────────────────────────────────────────────────────
 *  SalesSection — the "Sales & Trends" band. One slot per data source so
 *  each renders as soon as its own section lands: sales (trend, summary,
 *  phone, hourly, channels — Channel Sales fills its orders-only cells
 *  later), operations (Orders vs Sales) and orders (Upselling).
 * ────────────────────────────────────────────────────────────────────────── */

const SALES_SPANS = [
  BR_SALES_TREND_SPAN,
  BR_SALES_SUMMARY_SPAN,
  BR_PHONE_INSTORE_SPAN,
  BR_HOURLY_CHANNELS_SPAN,
  BR_CHANNEL_SALES_SPAN,
];

export function SalesSection() {
  const { rangeLabel } = useReport();
  const sales = useSection("sales");
  const operations = useSection("operations");
  const orders = useSection("orders");

  return (
    <V1Section category="sales" weekLabel={rangeLabel} gridClassName="gap-[7px]">
      <SectionSlot state={sales} spans={SALES_SPANS} label="Sales">
        {(data) => (
          <>
            <BrSalesTrendCard data={data} />
            <BrSalesSummaryCard data={data} />
            <BrPhoneInStoreCard data={data} />
            <BrHourlyChannelsCard data={data} />
            <BrChannelSalesCard data={data} />
          </>
        )}
      </SectionSlot>
      <SectionSlot state={operations} spans={[BR_ORDERS_VS_SALES_SPAN]} label="Orders vs Sales">
        {(data) => <BrOrdersVsSalesCard data={data} />}
      </SectionSlot>
      <SectionSlot state={orders} spans={[BR_UPSELLING_SPAN]} label="Upselling">
        {(data) => <BrUpsellingCard data={data} />}
      </SectionSlot>
    </V1Section>
  );
}
