"use client";

import { ClipboardList, Store } from "lucide-react";
import { useTranslations } from "next-intl";

interface TicketsEmptyStateProps {
  type: "no-store" | "no-data";
}

export function TicketsEmptyState({ type }: TicketsEmptyStateProps) {
  const t = useTranslations("maintenanceTickets");

  if (type === "no-store") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <Store className="mb-4 h-10 w-10 text-muted-foreground" />
        <h3 className="text-lg font-semibold">{t("noStore.title")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("noStore.description")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
      <ClipboardList className="mb-4 h-10 w-10 text-muted-foreground" />
      <h3 className="text-lg font-semibold">{t("noData.title")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t("noData.description")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t("noData.hint")}</p>
    </div>
  );
}
