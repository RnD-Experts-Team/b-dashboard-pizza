"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Clock,
  SearchX,
  ServerCrash,
  ShieldAlert,
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
import { errorKind, type TicketError, type TicketErrorKind } from "@/lib/toolbox-tickets/errors";

/* ── Error card ──────────────────────────────────────────────────────────── */

const KIND_ICON: Record<TicketErrorKind, LucideIcon> = {
  notFound: SearchX,
  storeUnknown: Store,
  noStore: Store,
  envForbidden: ShieldAlert,
  adminForbidden: ShieldOff,
  auth: ShieldOff,
  network: WifiOff,
  timeout: Clock,
  server: ServerCrash,
  generic: XCircle,
};

interface TicketsErrorStateProps {
  error: TicketError;
  onRetry?: () => void;
  /** "Back to tickets" — for a detail page that 404'd. */
  showBack?: boolean;
  compact?: boolean;
  className?: string;
}

export function TicketsErrorState({ error, onRetry, showBack, compact, className }: TicketsErrorStateProps) {
  const t = useTranslations("toolboxTickets.errors");
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const kind = errorKind(error);
  const Icon = KIND_ICON[kind];

  // A 404 is NEVER "deleted": a ticket you have no relationship to answers 404
  // on purpose. For known kinds our sentence replaces the server's.
  const title = kind === "generic" ? t("title") : t(`${kind}.title`);
  const body =
    kind === "generic"
      ? error.message
      : kind === "storeUnknown"
        ? t("storeUnknown.body", { store: error.storeNumber ?? "—" })
        : t(`${kind}.body`);

  return (
    <Card className={cn("border-destructive/40 animate-in fade-in-0", className)}>
      <CardHeader className={cn("items-center text-center", compact && "py-4")}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <Icon className="h-6 w-6 text-destructive" />
        </div>
        <CardTitle className="font-heading font-semibold text-destructive">{title}</CardTitle>
        <CardDescription className="mx-auto max-w-md">{body}</CardDescription>
        {kind !== "generic" && kind !== "notFound" && error.message && (
          <p className="mx-auto max-w-md break-words font-mono text-[11px] text-muted-foreground/80">
            {error.message}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-wrap justify-center gap-2">
        {(error.retryable || kind === "generic") && onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t("retry")}
          </Button>
        )}
        {showBack && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${locale}/dashboard/tickets`}>{t("back")}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Inline, one-line error for panels inside a page (not the whole page). */
export function TicketsInlineError({ error, onRetry }: { error: TicketError; onRetry?: () => void }) {
  const t = useTranslations("toolboxTickets.errors");
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
    >
      <XCircle className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 break-words">{error.message}</span>
      {onRetry && (
        <Button variant="outline" size="sm" className="h-7" onClick={onRetry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}

/* ── Empty state (dashed, muted icon, instructional copy) ────────────────── */

export function TicketsEmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
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

/* ── Skeletons ───────────────────────────────────────────────────────────── */

export function TicketsListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function TicketDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-3">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-[420px] w-full rounded-xl" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}
