"use client";

/* ──────────────────────────────────────────────────────────────────────
 *  Shared formatting helpers for the WBR / hooks / hiring dashboard cards.
 *  Centralises what used to be copy-pasted in every wbr-* card.
 * ────────────────────────────────────────────────────────────────────── */

import type { ReactNode } from "react";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { DeltaBadge } from "@/components/wbr-reports/primitives";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/* ── Currency ─────────────────────────────────────────────────────────── */

/** USD, no decimals — for sales/deposit figures. */
export const fmt$ = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

/** USD, 2 decimals — for pay/tips/expense amounts. */
export const fmt$2 = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/* ── Plain numbers ────────────────────────────────────────────────────── */

/** Integer with thousands separators. */
export const fmtNum = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 });

/** Number with up to `dp` decimals. */
export const fmtNumD = (n: number | null | undefined, dp = 1) =>
  (n ?? 0).toLocaleString("en-US", { maximumFractionDigits: dp });

/* ── Percentages ──────────────────────────────────────────────────────── */

/** Percent with 1 decimal (value already in percent units). */
export const fmtPct = (n: number | null | undefined) => `${(n ?? 0).toFixed(1)}%`;

/** Percent with 2 decimals (e.g. LTO 0.35% — value already in percent units). */
export const fmtPct2 = (n: number | null | undefined) => `${(n ?? 0).toFixed(2)}%`;

/* ── Dates / times ────────────────────────────────────────────────────── */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Format an ISO date/datetime string as a date only, e.g. "Jun 3, 2026".
 * Accepts both "2026-06-03" and "2026-06-03T21:13:42.000000Z".
 */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  // Take only the date portion so timezone never shifts the calendar day.
  const datePart = iso.slice(0, 10);
  const d = parseISO(datePart);
  if (!isValid(d)) return iso;
  return format(d, "MMM d, yyyy");
}

/** Format a "HH:MM:SS" (or "HH:MM") time string as "h:mm AM/PM". */
export function fmtTime(t: string | null | undefined): string {
  if (!t) return "—";
  const [hStr, mStr] = t.split(":");
  const hour = parseInt(hStr, 10);
  if (Number.isNaN(hour)) return t;
  const min = mStr ?? "00";
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${min} ${ampm}`;
}

/** Combine a date and time into "Jun 7, 2026 · 10:26 AM". */
export function fmtDateTime(
  date: string | null | undefined,
  time: string | null | undefined,
): string {
  if (!date) return "—";
  return time ? `${fmtDate(date)} · ${fmtTime(time)}` : fmtDate(date);
}

/**
 * Duration between a start date+time and an end date+time, e.g. "12h 55m".
 * Returns null when either endpoint is missing/invalid or the span is negative.
 */
export function fmtDuration(
  date: string | null | undefined,
  time: string | null | undefined,
  date2: string | null | undefined,
  time2: string | null | undefined,
): string | null {
  if (!date || !time || !date2 || !time2) return null;
  const start = new Date(`${date.slice(0, 10)}T${time}`);
  const end = new Date(`${date2.slice(0, 10)}T${time2}`);
  const ms = end.getTime() - start.getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/* ── Comparisons ──────────────────────────────────────────────────────── */

/**
 * Percentage change of `curr` vs `prev`. Returns null when there is no usable
 * baseline (prev is 0/missing) so callers can render "—" instead of Infinity.
 */
export function pctChangeOrNull(
  curr: number | null | undefined,
  prev: number | null | undefined,
): number | null {
  if (!prev) return null;
  return (((curr ?? 0) - prev) / Math.abs(prev)) * 100;
}

/* ── Promo helper ─────────────────────────────────────────────────────── */

/** Strip a leading "Punchh promo code: " prefix from a promo modification reason. */
export function stripPunchh(reason: string): string {
  return reason.replace(/^Punchh promo code:\s*/i, "").trim();
}

/* ── WbrCardSkeleton — generic 280px card skeleton for loading states ──── */

export function WbrCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("flex h-[280px] flex-col gap-0 py-1.5", className)}>
      <CardHeader className="shrink-0 px-3 pb-1">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="ml-auto h-3.5 w-8 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-2 px-3 pb-2">
        <div className="grid grid-cols-2 gap-1.5">
          <Skeleton className="h-12 rounded-md" />
          <Skeleton className="h-12 rounded-md" />
        </div>
        <Skeleton className="h-5 w-full rounded-md" />
        <Skeleton className="h-5 w-full rounded-md" />
        <Skeleton className="h-5 w-4/5 rounded-md" />
        <Skeleton className="h-5 w-3/5 rounded-md" />
      </CardContent>
    </Card>
  );
}

/* ── StatTile — small labeled value tile used across the WBR cards ────── */

export function StatTile({
  label,
  value,
  sub,
  valueClass,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  valueClass?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md bg-background/50 px-2 py-1.5", className)}>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "flex items-center gap-1 text-[13px] font-semibold tabular-nums",
          valueClass,
        )}
      >
        {value}
        {sub}
      </p>
    </div>
  );
}

/* ── Delta — DeltaBadge for a number, muted dash for null ─────────────── */

export function Delta({
  value,
  suffix = "%",
}: {
  value: number | null;
  suffix?: string;
}) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <DeltaBadge value={value} suffix={suffix} />;
}
