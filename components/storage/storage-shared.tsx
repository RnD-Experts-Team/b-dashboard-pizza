"use client";

import { createElement } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  ClipboardCheck,
  Inbox,
  MapPin,
  Package,
  PackageOpen,
  PackageX,
  RotateCcw,
  ShoppingCart,
  Undo2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQuantity } from "@/lib/maintenance/money";
import { MOVEMENT_TYPES, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import { placeLabel } from "@/lib/storage/stock-forms";
import type { StockPlaceLine } from "@/types/storage.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Shared shells for the Storage tabs and the count sheet                   */
/* ────────────────────────────────────────────────────────────────────────── */

const DEFAULT_SKELETON_ROWS = 6;

export function StorageSkeleton({ rows = DEFAULT_SKELETON_ROWS }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

/** The CLAUDE.md empty state: dashed border, muted icon, one sentence, one action. */
export function StorageEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title?: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-1 px-4">
        {title && <p className="text-sm font-medium">{title}</p>}
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

/** A failed read, with Retry. */
export function StorageErrorState({ message, onRetry }: { message?: string | null; onRetry?: () => void }) {
  const t = useTranslations("maintenanceV2");
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/50 py-16 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
      <div className="space-y-1 px-4">
        <p className="text-sm font-medium">{t("common.loadError")}</p>
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

/* ── Compact table classes, matching the dense dashboard idiom ───────────── */

export const TBL = "w-full text-xs";
export const TH = "px-2.5 py-1.5 text-start text-[9px] font-semibold uppercase tracking-wider text-muted-foreground";
export const TD = "px-2.5 py-2 border-t border-border align-top";

const SIGN_TONE = {
  negative: "text-red-600 dark:text-red-400",
  positive: "text-emerald-600 dark:text-emerald-400",
  zero: "text-muted-foreground",
} as const;

/** The tint for a signed amount (always paired with a sign or words, never alone). */
export function signTone(value: number): string {
  if (value < 0) return SIGN_TONE.negative;
  if (value > 0) return SIGN_TONE.positive;
  return SIGN_TONE.zero;
}

/** A quantity that carries its sign. Negative is meaningful, never clamped; colour is never alone (the sign is the text). */
export function SignedQty({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", signTone(value), className)}>
      {value > 0 ? "+" : ""}
      {formatQuantity(value)}
    </span>
  );
}

export function PaginationBar({
  currentPage,
  lastPage,
  onPageChange,
  disabled,
}: {
  currentPage: number;
  lastPage: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("maintenanceV2");
  if (lastPage <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 pt-3">
      <p className="text-xs text-muted-foreground tabular-nums">
        {t("storage.pagination.pageOf", { page: currentPage, last: lastPage })}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={disabled || currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          {t("storage.pagination.previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={disabled || currentPage >= lastPage}
          onClick={() => onPageChange(currentPage + 1)}
        >
          {t("storage.pagination.next")}
        </Button>
      </div>
    </div>
  );
}

/* ── Spots ───────────────────────────────────────────────────────────────── */

/** "Zone A › Shelf S", or a muted "Spot not set" (empty means nobody has said, not "nowhere"). */
export function PlaceBreadcrumb({ place, className }: { place: StockPlaceLine[]; className?: string }) {
  const t = useTranslations("maintenanceV2");
  const label = placeLabel(place);
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", label ? "text-foreground" : "text-muted-foreground", className)}>
      <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      {label || t("storage.spot.notSet")}
    </span>
  );
}

/* ── Movement types: plain words + an icon ───────────────────────────────── */

const ICONS: Record<string, LucideIcon> = {
  ShoppingCart,
  Wrench,
  Undo2,
  ArrowLeftRight,
  PackageOpen,
  ClipboardCheck,
  PackageX,
  RotateCcw,
};

/** The lucide icon for a vocabulary/stock-action icon name. */
export function stockIcon(name: string | undefined): LucideIcon {
  return (name && ICONS[name]) || Package;
}

/** Renders a vocabulary/stock-action icon by name (decorative). */
export function StockIcon({ name, className }: { name: string | undefined; className?: string }) {
  return createElement(stockIcon(name), { className, "aria-hidden": true });
}

/** Which way a movement type changes stock, for its icon tint (the label carries the meaning). */
const TYPE_TINT: Record<string, string> = {
  bought: "text-emerald-600 dark:text-emerald-400",
  returned: "text-emerald-600 dark:text-emerald-400",
  opening_stock: "text-emerald-600 dark:text-emerald-400",
  used: "text-sky-600 dark:text-sky-400",
  moved: "text-sky-600 dark:text-sky-400",
  stock_count: "text-amber-600 dark:text-amber-400",
  damaged_lost: "text-red-600 dark:text-red-400",
  undone: "text-muted-foreground",
};

export function MovementTypeLabel({
  type,
  serverLabel,
  className,
}: {
  type: string;
  serverLabel?: string | null;
  className?: string;
}) {
  const t = useTranslations("maintenanceV2");
  const entry = vocabEntry(MOVEMENT_TYPES, type, serverLabel);
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <StockIcon name={entry?.icon} className={cn("h-3.5 w-3.5 shrink-0", TYPE_TINT[type] ?? "text-muted-foreground")} />
      <span>{vocabText(t, entry)}</span>
    </span>
  );
}
