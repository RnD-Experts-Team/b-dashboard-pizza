"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { DsErrorState, WeeklyReportView } from "@/components/dough-sauce";
import { DoughSauceError } from "@/lib/api/services/dough-sauce.service";
import { useDoughSauceAccess } from "@/lib/hooks/use-dough-sauce-access";

/** Full weekly report — every store, every day × ingredient, one compact table. */
export default function DoughSauceReportPage() {
  const t = useTranslations("doughSauce.report");
  const access = useDoughSauceAccess();
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      {access.tabs.report ? (
        // useSearchParams (preselected week) needs a Suspense boundary
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <WeeklyReportView />
        </Suspense>
      ) : (
        // Specialist only — the same pizzasys rules that gate the Weekly grid.
        <DsErrorState error={new DoughSauceError("", "FORBIDDEN", "audit", 403)} />
      )}
    </div>
  );
}
