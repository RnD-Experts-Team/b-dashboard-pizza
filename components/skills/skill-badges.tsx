"use client";

import { useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const AMBER_CHIP = "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400";

/** "Not for under 18" on a skill with a minimum age. */
export function MinAgeBadge({ minAge, className }: { minAge: number; className?: string }) {
  const t = useTranslations("skills");
  return (
    <Badge variant="outline" className={cn(AMBER_CHIP, "gap-1 text-[10px]", className)}>
      <ShieldAlert className="h-3 w-3" />
      {t("notUnderAge", { age: minAge })}
    </Badge>
  );
}

/** Marks an employee hiring says is under 18. */
export function MinorBadge({ className }: { className?: string }) {
  const t = useTranslations("skills");
  return (
    <Badge variant="outline" className={cn(AMBER_CHIP, "text-[10px]", className)}>
      {t("minor")}
    </Badge>
  );
}
