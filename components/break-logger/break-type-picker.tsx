"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { BreakType } from "@/types/breaks.types";

/**
 * The break catalogue as tappable chips, grouped under the API's own
 * `group_label` headers ("Counted toward the limit" / "Special breaks").
 *
 * `group` decides only WHICH BLOCK a type renders in — whether a recorded
 * break counts is always read from the entry's own snapshot.
 */
export function BreakTypePicker({
  types,
  selectedId,
  onSelect,
  disabled,
  className,
}: {
  types: BreakType[];
  selectedId?: number | null;
  onSelect: (type: BreakType) => void;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("breaks.timer");

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; counted: boolean; items: BreakType[] }>();
    for (const type of [...types].sort((a, b) => a.sort_order - b.sort_order)) {
      const key = type.group;
      if (!map.has(key)) {
        map.set(key, { label: type.group_label, counted: type.counts_toward_limit, items: [] });
      }
      map.get(key)!.items.push(type);
    }
    // Counted block first, like the API's own ordering.
    return [...map.values()].sort((a, b) => Number(b.counted) - Number(a.counted));
  }, [types]);

  return (
    <div data-slot="break-type-picker" className={cn("space-y-3", className)}>
      {groups.map((group) => (
        <div key={group.label} className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {group.items.map((type) => {
              const selected = selectedId === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => onSelect(type)}
                  title={type.counts_toward_limit ? undefined : t("excluded")}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : type.counts_toward_limit
                        ? "border-border bg-background hover:border-amber-500/50 hover:bg-amber-500/10 dark:hover:bg-amber-500/15"
                        : "border-dashed border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {type.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
