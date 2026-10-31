"use client";

import { useTranslations } from "next-intl";
import { Clock, Ellipsis, Fuel, Package, ScanSearch, Tag, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PAYMENT_LINE_TYPES, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import type { PaymentLineType } from "@/types/maintenance-system";

/** The vocabulary's icon names, resolved here so lib stays React-free. */
export const LINE_TYPE_ICONS: Record<PaymentLineType, LucideIcon> = {
  hourly: Clock,
  fixed: Tag,
  inspection: ScanSearch,
  parts: Package,
  gas: Fuel,
  other: Ellipsis,
};

/** A payment's line types as small badges: icon + words (never colour alone). */
export function LineTypeBadges({ types, className }: { types: readonly PaymentLineType[]; className?: string }) {
  const t = useTranslations("maintenanceSystem");
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {types.map((type) => {
        const Icon = LINE_TYPE_ICONS[type] ?? Ellipsis;
        return (
          <Badge key={type} variant="outline" className="gap-1 px-1.5 py-0 text-[10px] font-normal">
            <Icon className="size-3" aria-hidden="true" />
            {vocabText(t, vocabEntry(PAYMENT_LINE_TYPES, type))}
          </Badge>
        );
      })}
    </span>
  );
}
