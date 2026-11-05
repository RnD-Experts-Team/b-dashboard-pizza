"use client";

import { CheckCircle2, Clock, Loader2, XCircle, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { RunStatus } from "@/types/report-builder.types";

const LOOK: Record<RunStatus, { icon: LucideIcon; className: string; spin?: boolean }> = {
  queued: { icon: Clock, className: "border-border bg-muted text-muted-foreground" },
  running: {
    icon: Loader2,
    spin: true,
    className: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  done: {
    icon: CheckCircle2,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  failed: {
    icon: XCircle,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

/** A run's status: queued / running (spinning) / done / failed. */
export function RunStatusBadge({ status, className }: { status: RunStatus; className?: string }) {
  const t = useTranslations("reportBuilder.status");
  const look = LOOK[status] ?? LOOK.queued;
  const Icon = look.icon;
  return (
    <Badge data-slot="run-status-badge" variant="outline" className={cn("gap-1 font-medium", look.className, className)}>
      <Icon className={cn("h-3 w-3", look.spin && "animate-spin")} />
      {t(status)}
    </Badge>
  );
}
