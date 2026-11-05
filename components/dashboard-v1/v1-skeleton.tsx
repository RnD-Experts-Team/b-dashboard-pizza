"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { WbrCardSkeleton } from "@/components/dspr/wbr-format";
import { cn } from "@/lib/utils";
import { CATEGORIES, type CategoryKey } from "./category";
import { SPAN_CLASS, type V1Span } from "./v1-card";

/**
 * Dashboard V1's loading state: the summary strip and every section with a
 * skeleton for EVERY card, at the card's own span, so the page keeps its shape
 * while the report loads. Keep the spans in step with `dashboard-v1.tsx`.
 */
const S: V1Span = 1;
const M: V1Span = 2;
const L: V1Span = 4;

const V1_LAYOUT: { category: CategoryKey; spans: V1Span[] }[] = [
  // Weekly Sales, Store Score, Manager Tasks, Customer & Sales, Phone, Hourly, Orders vs Sales, Channel Sales, Sales History
  { category: "sales", spans: [M, S, S, S, S, M, M, M, L] },
  // Portal, HNR, Labor, Go-To, Portal & HNR Weekly, Non-Negotiable, HNR+
  { category: "operations", spans: [S, S, S, S, M, M, L] },
  // Top Items, Top Ingredients, Promos, LTO
  { category: "menu", spans: [S, S, S, S] },
  // Current Employees, High Hours, Birthdays, Average Pay
  { category: "people", spans: [M, M, M, M] },
  // Cash Control, Transfers, Money Owed
  { category: "finance", spans: [S, S, M] },
  // QA Ratings, Maintenance, Complaints, Feedback, Cleaning, Customer Service, Portioning
  { category: "quality", spans: [M, M, M, M, M, M, L] },
];

const SUMMARY_TILES = 8;

/** One band of card skeletons with a V1Section-shaped header. */
export function V1SectionSkeleton({ category, spans }: { category: CategoryKey; spans: V1Span[] }) {
  const cat = CATEGORIES[category];
  return (
    <section className={cn("space-y-1 rounded-md border-l-2 pl-3", cat.border)} aria-hidden="true">
      <div className="flex items-center gap-1.5 px-0.5">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-40" />
        <div className="ms-1 h-px flex-1 bg-linear-to-r from-border to-transparent" />
      </div>
      <div className="grid grid-cols-1 gap-[7px] md:grid-cols-2 lg:grid-cols-4 [grid-auto-flow:dense]">
        {spans.map((span, i) => (
          <WbrCardSkeleton key={i} className={SPAN_CLASS[span]} />
        ))}
      </div>
    </section>
  );
}

export function V1DashboardSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-label="Loading the dashboard">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-6 w-32 rounded-md" />
        <Skeleton className="h-6 w-36 rounded-md" />
        <Skeleton className="ms-auto h-6 w-6 rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: SUMMARY_TILES }, (_, i) => (
          <Skeleton key={i} className="h-[42px] rounded-lg" />
        ))}
      </div>
      {V1_LAYOUT.map((s) => (
        <V1SectionSkeleton key={s.category} category={s.category} spans={s.spans} />
      ))}
    </div>
  );
}
