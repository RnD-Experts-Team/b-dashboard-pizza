"use client";

import { useState } from "react";
import { ChevronDown, Store } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { V1Span } from "@/components/dashboard-v1/v1-card";
import { useReport, useSection } from "@/components/business-reports/report-context";
import { SectionSlot } from "@/components/business-reports/section-slot";
import { BrStoreComparison } from "@/components/business-reports/cards/stores/br-store-comparison";
import { BrStoreScoreWeeks } from "@/components/business-reports/cards/stores/br-store-score-weeks";
import { BrWeeklySalesByStore } from "@/components/business-reports/cards/stores/br-weekly-sales-by-store";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────
 *  Stores — store-vs-store comparison over the range. Not one of V1's
 *  categories, so it is a V1Section look-alike in the neutral primary
 *  tokens (same header, divider, collapse and grid).
 * ────────────────────────────────────────────────────────────────────────── */

const FULL: V1Span = 4;
const ONE_FULL: V1Span[] = [FULL];

export function StoresSection() {
  const { rangeLabel, params } = useReport();
  const sales = useSection("sales");
  const storeScore = useSection("storeScore");
  const [open, setOpen] = useState(true);

  return (
    <section className="space-y-1 rounded-md border-l-2 border-l-primary pl-3">
      <Collapsible open={open} onOpenChange={setOpen} className="space-y-1">
        <CollapsibleTrigger className="flex w-full items-center gap-1.5 px-0.5 text-start transition-opacity hover:opacity-80">
          <div className="rounded bg-primary/15 p-0.5 dark:bg-primary/20">
            <Store className="h-3.5 w-3.5 text-primary" />
          </div>
          <h2 className="text-[12px] font-bold uppercase tracking-wide text-primary">Stores</h2>
          <span className="text-[11px] font-normal text-muted-foreground">{rangeLabel}</span>
          <div className="ms-1 h-px flex-1 bg-linear-to-r from-border to-transparent" />
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-primary transition-transform", open && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="grid [grid-auto-flow:dense] grid-cols-1 gap-[7px] md:grid-cols-2 lg:grid-cols-4">
            <SectionSlot state={sales} spans={ONE_FULL} label="Sales">
              {(data) => <BrStoreComparison data={data} />}
            </SectionSlot>
            {/* Only when "Load store scores" was ticked for this load. */}
            {params.withStoreScore && (
              <SectionSlot state={storeScore} spans={ONE_FULL} label="Store score">
                {(data) => <BrStoreScoreWeeks data={data} />}
              </SectionSlot>
            )}
            {/* A failed sales load is already reported by the comparison slot. */}
            {!sales.error && (
              <SectionSlot state={sales} spans={ONE_FULL} label="Sales">
                {(data) => <BrWeeklySalesByStore data={data} />}
              </SectionSlot>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
