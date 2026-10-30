"use client";

import { use } from "react";
import { CountSheet } from "@/components/storage/count-sheet";
import { StorageEmptyState } from "@/components/storage/storage-shared";
import { idParam } from "@/lib/storage/storage-url";
import { useTranslations } from "next-intl";

/** The stock count sheet (docs/MAINTENANCE-V2-UI.md §6 "Count sheet"). */
export default function StockCountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("maintenanceV2");
  const countId = idParam(id);
  if (!countId) return <StorageEmptyState description={t("storage.count.notFound")} />;
  return <CountSheet countId={countId} />;
}
