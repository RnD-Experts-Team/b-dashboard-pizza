"use client";

import { V1Section } from "@/components/dashboard-v1/v1-section";
import { SectionSlot } from "@/components/business-reports/section-slot";
import { useReport, useSection } from "@/components/business-reports/report-context";
import { BR_TOP_ITEMS_SPAN, BrTopItemsCard } from "@/components/business-reports/cards/menu/br-top-items";
import {
  BR_TOP_INGREDIENTS_SPAN,
  BrTopIngredientsCard,
} from "@/components/business-reports/cards/menu/br-top-ingredients";
import { BR_LTO_SPAN, BrLtoCard } from "@/components/business-reports/cards/menu/br-lto";
import { BR_PORTIONING_SPAN, BrPortioningCard } from "@/components/business-reports/cards/menu/br-portioning";
import { BR_PROMOS_SPAN, BrPromosCard } from "@/components/business-reports/cards/menu/br-promos";

/* ──────────────────────────────────────────────────────────────────────────
 *  MenuSection — the "Menu & Product" band. The menu slot renders Top Items,
 *  Top Ingredients, LTO and Portioning; Promos come from the orders section
 *  in their own slot (the dense grid backfills it into the first row).
 * ────────────────────────────────────────────────────────────────────────── */

const MENU_SPANS = [BR_TOP_ITEMS_SPAN, BR_TOP_INGREDIENTS_SPAN, BR_LTO_SPAN, BR_PORTIONING_SPAN];

export function MenuSection() {
  const { rangeLabel } = useReport();
  const menu = useSection("menu");
  const orders = useSection("orders");

  return (
    <V1Section category="menu" weekLabel={rangeLabel} gridClassName="gap-[7px]">
      <SectionSlot state={menu} spans={MENU_SPANS} label="Menu">
        {(data) => (
          <>
            <BrTopItemsCard data={data} />
            <BrTopIngredientsCard data={data} />
            <BrLtoCard data={data} />
            <BrPortioningCard data={data} />
          </>
        )}
      </SectionSlot>
      <SectionSlot state={orders} spans={[BR_PROMOS_SPAN]} label="Promos">
        {(data) => <BrPromosCard data={data} />}
      </SectionSlot>
    </V1Section>
  );
}
