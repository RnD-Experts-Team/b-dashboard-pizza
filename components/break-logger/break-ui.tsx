"use client";

import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BreakError, parseBreakError } from "@/lib/break-logger/errors";

/* ── Formatting ───────────────────────────────────────────────────────── */

/** Local wall-clock time (`14:02`) in the viewer's locale. */
export function useFormatTime() {
  const locale = useLocale();
  return useCallback(
    (iso: string | null | undefined) => {
      if (!iso) return "—";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—";
      return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(d);
    },
    [locale]
  );
}

/** A bare work date (`2026-09-15`) as `Tue, 15 Sep` — never shifted by time zone. */
export function useFormatWorkDate() {
  const locale = useLocale();
  return useCallback(
    (date: string, withYear = false) => {
      const [y, m, d] = date.split("-").map(Number);
      if (!y || !m || !d) return date;
      return new Intl.DateTimeFormat(locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
        ...(withYear ? { year: "numeric" } : {}),
        timeZone: "UTC",
      }).format(new Date(Date.UTC(y, m - 1, d)));
    },
    [locale]
  );
}

/**
 * Human copy for any break failure, keyed on `code` — never on the server's
 * message. VALIDATION/UNKNOWN fall back to the server's own line because it is
 * the most specific thing available there.
 */
export function useBreakErrorText() {
  const t = useTranslations("breaks.errors");
  return useCallback(
    (err: unknown): string => {
      const e = err instanceof BreakError ? err : parseBreakError(err);
      if ((e.code === "VALIDATION" || e.code === "UNKNOWN") && e.message) {
        return Object.values(e.fieldErrors)[0] ?? e.message;
      }
      return t(e.code);
    },
    [t]
  );
}

/* ── Small shared pieces ─────────────────────────────────────────────── */

/** Counted vs excluded — read from the ENTRY's snapshot, never the type's group. */
export function CountedBadge({ counted, className }: { counted: boolean; className?: string }) {
  const t = useTranslations("breaks.timer");
  return (
    <Badge
      data-slot="break-counted-badge"
      variant="outline"
      className={cn(
        "px-1.5 py-0 text-[10px] font-medium",
        counted
          ? "border-amber-500/40 text-amber-700 dark:border-amber-400/30 dark:text-amber-400"
          : "border-border text-muted-foreground",
        className
      )}
    >
      {counted ? t("counted") : t("excluded")}
    </Badge>
  );
}

/** The "Running" badge shared by Today and History. */
export function RunningBadge({ className }: { className?: string }) {
  const t = useTranslations("breaks.today");
  return (
    <Badge
      data-slot="break-running-badge"
      className={cn(
        "bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
        className
      )}
    >
      {t("running")}
    </Badge>
  );
}

/**
 * Counted minutes against the allowance, with optional milestone ticks.
 * Built by hand rather than on `Progress` so the fill grows from the logical
 * start edge in RTL as well.
 */
export function AllowanceBar({
  countedMinutes,
  allowanceMinutes,
  thresholds = [],
  className,
}: {
  countedMinutes: number;
  allowanceMinutes: number;
  thresholds?: number[];
  className?: string;
}) {
  const over = countedMinutes > allowanceMinutes;
  // Scale to whichever is larger so an overage stays visible past the mark.
  const scale = Math.max(allowanceMinutes, countedMinutes, 1);
  const fill = Math.min(100, (countedMinutes / scale) * 100);
  const allowanceAt = (allowanceMinutes / scale) * 100;
  const warn = !over && countedMinutes >= allowanceMinutes * 0.8;

  return (
    <div
      data-slot="break-allowance-bar"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={allowanceMinutes}
      aria-valuenow={countedMinutes}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn(
          "absolute inset-y-0 start-0 rounded-full transition-[width] duration-500 motion-reduce:transition-none",
          over
            ? "bg-red-500 dark:bg-red-400"
            : warn
              ? "bg-amber-500 dark:bg-amber-400"
              : "bg-emerald-500 dark:bg-emerald-400"
        )}
        style={{ width: `${fill}%` }}
      />
      {over && (
        <span
          aria-hidden
          className="absolute inset-y-0 w-0.5 bg-background"
          style={{ insetInlineStart: `${allowanceAt}%` }}
        />
      )}
      {thresholds
        .filter((m) => m < scale)
        .map((m) => (
          <span
            key={m}
            aria-hidden
            className="absolute inset-y-0 w-px bg-foreground/30"
            style={{ insetInlineStart: `${(m / scale) * 100}%` }}
          />
        ))}
    </div>
  );
}
