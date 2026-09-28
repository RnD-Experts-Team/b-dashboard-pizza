"use client";

import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBreaksStore } from "@/lib/store/breaks.store";
import type { BreakType } from "@/types/breaks.types";
import { useBreakErrorText } from "./break-ui";

/**
 * What to show instead of a blank block when the catalogue is empty or
 * failed: the reason, and a retry. Also retries once on mount, since the
 * bootstrap read may have happened before the service had types.
 */
export function BreakTypesEmpty({ className }: { className?: string }) {
  const t = useTranslations("breaks");
  const errorText = useBreakErrorText();
  const typesError = useBreaksStore((s) => s.typesError);
  const loading = useBreaksStore((s) => s.typesLoading);
  const reloadTypes = useBreaksStore((s) => s.reloadTypes);

  useEffect(() => {
    void reloadTypes();
  }, [reloadTypes]);

  return (
    <div
      data-slot="break-types-empty"
      className={cn("flex flex-col items-start gap-2 text-xs text-muted-foreground", className)}
    >
      <p>{typesError ? errorText(typesError) : t("timer.noTypes")}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        disabled={loading}
        onClick={() => void reloadTypes()}
      >
        {loading ? (
          <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <RotateCcw className="me-1.5 h-3.5 w-3.5" />
        )}
        {t("actions.retry")}
      </Button>
    </div>
  );
}

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

  if (types.length === 0) return <BreakTypesEmpty className={className} />;

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
