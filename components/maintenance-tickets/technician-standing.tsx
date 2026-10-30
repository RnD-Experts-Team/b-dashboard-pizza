"use client";

import { Siren, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { TechnicianStandingView } from "@/lib/maintenance-tickets/technician-ranking";

const PILL = "rounded-full px-1.5 py-px text-[10px] font-semibold";

/**
 * "Covers store", "Covers issue", "Emergency", "Call first" and the stars,
 * beside a technician's name in a picker. Renders nothing when none applies.
 * Every badge carries text — never colour alone.
 */
export function TechnicianStandingBadges({
  standing,
  className,
}: {
  standing: TechnicianStandingView;
  className?: string;
}) {
  const t = useTranslations("maintenanceV2.technicians.standing");
  const any = standing.coversStore || standing.coversIssue || standing.callFirst || standing.emergency || standing.stars != null;
  if (!any) return null;

  return (
    <span className={cn("flex shrink-0 flex-wrap items-center gap-1", className)}>
      {standing.coversStore && (
        <span className={cn(PILL, "bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300")}>{t("coversStore")}</span>
      )}
      {standing.coversIssue && (
        <span className={cn(PILL, "bg-indigo-500/15 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300")}>
          {t("coversIssue")}
        </span>
      )}
      {standing.emergency && (
        <span className={cn(PILL, "inline-flex items-center gap-0.5 bg-rose-500/15 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300")}>
          <Siren className="h-2.5 w-2.5" aria-hidden="true" />
          {t("emergency")}
        </span>
      )}
      {standing.callFirst && (
        <span className={cn(PILL, "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300")}>
          {t("callFirst")}
        </span>
      )}
      {standing.stars != null && (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] tabular-nums text-muted-foreground"
          title={standing.starsForIssue ? t("starsForIssue") : t("starsAverage")}
        >
          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" aria-hidden="true" />
          {standing.stars}
          {!standing.starsForIssue && <span>{t("avg")}</span>}
        </span>
      )}
    </span>
  );
}
