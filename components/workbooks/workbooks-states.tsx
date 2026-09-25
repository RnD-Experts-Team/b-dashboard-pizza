"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Clock,
  FolderSearch,
  Lock,
  ServerCrash,
  ShieldOff,
  Store,
  WifiOff,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKind, type WorkbookErrorKind } from "@/lib/workbooks/errors";
import type { WorkbooksErrorState } from "@/types/workbooks.types";

/* ── Error card (TicketsErrorCard shape) ─────────────────────────────────── */

const KIND_ICON: Record<WorkbookErrorKind, LucideIcon> = {
  notFound: FolderSearch,
  noAccess: ShieldOff,
  storeUnknown: Store,
  noStore: Store,
  auth: ShieldOff,
  network: WifiOff,
  timeout: Clock,
  server: ServerCrash,
  generic: XCircle,
};

interface WorkbooksErrorCardProps {
  error: WorkbooksErrorState;
  onRetry?: () => void;
  /** Show "Back to workbooks" — for a detail page that 404'd. */
  showBack?: boolean;
  compact?: boolean;
  className?: string;
}

export function WorkbooksErrorCard({ error, onRetry, showBack, compact, className }: WorkbooksErrorCardProps) {
  const t = useTranslations("workbooks.errors");
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const kind = errorKind(error);
  const Icon = KIND_ICON[kind];

  // A 404 is NEVER "deleted": every forbidden read answers 404 on purpose.
  // For the known kinds our own sentence replaces the server's; otherwise the
  // server's message is the most specific thing we have.
  const title = kind === "generic" ? t("title") : t(`${kind}.title`);
  const body = kind === "generic" ? error.message : t(`${kind}.body`);

  return (
    <Card className={cn("border-destructive/50 animate-in fade-in-0", className)}>
      <CardHeader className={cn("items-center text-center", compact && "py-4")}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <Icon className="h-6 w-6 text-destructive" />
        </div>
        <CardTitle className="text-destructive">{title}</CardTitle>
        <CardDescription className="mx-auto max-w-md">{body}</CardDescription>
        {kind === "noAccess" && (
          <p className="mx-auto max-w-md text-xs text-muted-foreground">{t("noAccess.rulesHint")}</p>
        )}
        {kind !== "generic" && kind !== "notFound" && error.message && (
          <p className="mx-auto max-w-md font-mono text-[11px] text-muted-foreground/80">{error.message}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-wrap justify-center gap-2">
        {error.retryable && onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t("retry")}
          </Button>
        )}
        {showBack && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${locale}/dashboard/workbooks`}>{t("backToWorkbooks")}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Empty state (dashed, muted icon, instructional copy) ────────────────── */

interface WorkbooksEmptyStateProps {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}

export function WorkbooksEmptyState({ icon: Icon, title, body, action, className }: WorkbooksEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-16 text-center animate-in fade-in-0",
        className,
      )}
    >
      <Icon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {body && <p className="mx-auto max-w-sm text-xs text-muted-foreground">{body}</p>}
      </div>
      {action}
    </div>
  );
}

/** Nothing at all is permitted — distinct from "permitted but empty". */
export function WorkbooksNoAccess() {
  const t = useTranslations("workbooks.noAccess");
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
      <Lock className="h-8 w-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("title")}</p>
        <p className="max-w-sm text-xs text-muted-foreground">{t("body")}</p>
      </div>
    </div>
  );
}

/* ── Skeletons ───────────────────────────────────────────────────────────── */

export function BrowserSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Skeleton className="hidden h-[420px] rounded-xl lg:block" />
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="overflow-hidden rounded-xl border">
        <Skeleton className="h-9 w-full rounded-none" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-2 border-t px-3 py-2">
            <Skeleton className="h-5 w-8" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="hidden h-5 flex-1 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
