"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { DsprDashboard } from "@/components/dspr";

export default function DashboardPage() {
  const t = useTranslations("dashboard");

  return (
    <div className="space-y-6">
      {/* <PageHeader
        // title={t("title")}
        title={"DSPR"}
        description={t("welcome")}
      /> */}

      {/* DSPR Dashboard — real data from the API */}
      <DsprDashboard />
      <p className="pb-2 text-center text-[10px] text-muted-foreground/50">
        LC PIZZA DASHBOARD V1.2 Beta
      </p>
    </div>
  );
}
