"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** 1-5 stars, or none. Clicking the current star again clears it. */
export function StarPicker({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value != null && n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            disabled={disabled}
            onClick={() => onChange(value === n ? null : n)}
            className="rounded p-0.5 transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Star className={cn("h-4 w-4", on ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50")} />
          </button>
        );
      })}
      <span className="ms-1 text-xs tabular-nums text-muted-foreground">
        {value == null ? "No stars" : `${value} of 5`}
      </span>
    </div>
  );
}
