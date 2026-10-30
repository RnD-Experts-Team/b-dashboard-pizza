"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Ratings are whole stars, 1 to this (UpsertTechnicianAbilityRequest: between:1,5). */
const MAX_STARS = 5;
const STARS = Array.from({ length: MAX_STARS }, (_, i) => i + 1);

/** Read-only stars with the number beside them ("★ 4.5"); "Not rated" when null. */
export function StarValue({ value, className }: { value: number | string | null | undefined; className?: string }) {
  const t = useTranslations("maintenanceV2.technicians");
  const n = value == null || value === "" ? null : Number(value);
  if (n == null || !Number.isFinite(n)) {
    return <span className={cn("text-xs text-muted-foreground", className)}>{t("notRated")}</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", className)}>
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500 dark:fill-amber-300 dark:text-amber-300" aria-hidden="true" />
      <span className="sr-only">{t("ratingOutOf", { value: n.toFixed(1) })}</span>
      <span aria-hidden="true">{n.toFixed(1)}</span>
    </span>
  );
}

/**
 * Whole-star editor, 1–5. A radio group (arrow keys move, each star says
 * "3 of 5 stars"); clicking the current star again clears the rating.
 */
export function StarRatingInput({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  disabled?: boolean;
  /** What is being rated, for screen readers ("Rating for Ovens"). */
  label: string;
}) {
  const t = useTranslations("maintenanceV2.technicians");
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex items-center gap-0.5">
      {STARS.map((n) => {
        const on = value != null && n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={t("starsOfFive", { count: n })}
            disabled={disabled}
            onClick={() => onChange(value === n ? null : n)}
            className="cursor-pointer rounded-sm p-0.5 transition-transform duration-100 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Star
              className={cn(
                "h-5 w-5",
                on ? "fill-amber-400 text-amber-500 dark:fill-amber-300 dark:text-amber-300" : "text-muted-foreground/50",
              )}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
