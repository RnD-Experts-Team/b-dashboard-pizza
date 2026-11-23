"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";

/**
 * "5m ago" / "yesterday" in the viewer's language through
 * `Intl.RelativeTimeFormat` (no hand-rolled English). Older than a week it
 * switches to a plain date.
 */
export function formatRelativeTime(
  value: string | number | Date | null | undefined,
  locale: string,
  now: number = Date.now(),
): string {
  if (value === null || value === undefined) return "";
  const then = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(then)) return "";

  const seconds = Math.round((then - now) / 1000); // negative = in the past
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });

  if (abs < 45) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 7 * 86_400) return rtf.format(Math.round(seconds / 86_400), "day");
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(then);
}

/** The full date and time, for a tooltip. */
export function formatFullDateTime(
  value: string | number | Date | null | undefined,
  locale: string,
): string {
  if (value === null || value === undefined) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short" }).format(date);
}

interface RelativeTimeProps {
  value: string | number | Date | null | undefined;
  className?: string;
}

/** A `<time>` that keeps itself fresh (every 30 s) and carries the full date as its title. */
export function RelativeTime({ value, className }: RelativeTimeProps) {
  const locale = useLocale();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const text = formatRelativeTime(value, locale, now);
  if (!text) return null;

  const date = value instanceof Date ? value : new Date(value as string | number);
  return (
    <time
      dateTime={Number.isNaN(date.getTime()) ? undefined : date.toISOString()}
      title={formatFullDateTime(value, locale)}
      className={className}
    >
      {text}
    </time>
  );
}
