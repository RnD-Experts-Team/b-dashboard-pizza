"use client";

import { Construction } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";

/**
 * Stand-in body for a maintenance page that is being rebuilt for v2
 * (docs/MAINTENANCE-V2-UI.md). Each page builder replaces its page's use of
 * this with the real screen; delete this file once nothing renders it.
 */
export function BeingRebuilt({ titleKey }: { titleKey: string }) {
  const t = useTranslations("maintenanceV2");
  return (
    <div className="space-y-6">
      <PageHeader title={t(titleKey)} description={t("rebuilding.description")} />
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
        <Construction className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t("rebuilding.body")}</p>
      </div>
    </div>
  );
}
