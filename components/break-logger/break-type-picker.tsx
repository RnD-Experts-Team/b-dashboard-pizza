"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useBreaksStore } from "@/lib/store/breaks.store";
import type { BreakType } from "@/types/breaks.types";
import { useBreakErrorText } from "./break-ui";

/** Height animation shared by every collapsible block of the break UI. */
export const COLLAPSE_CONTENT =
  "overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down";

/**
 * Open/closed state for a collapsible section, remembered per viewer.
 * UI convenience only — storage failures just fall back to the default.
 */
export function usePersistedOpen(key: string, defaultOpen: boolean) {
  const storageKey = `breaks:open:${key}`;
  const [open, setOpenState] = useState(defaultOpen);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === "1" || raw === "0") setOpenState(raw === "1");
    } catch {
      // ignore
    }
  }, [storageKey]);

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // ignore
      }
    },
    [storageKey]
  );

  return [open, setOpen] as const;
}

/** One catalogue block ("Counted toward the limit" / "Special breaks") as a collapsible. */
function TypeGroup({
  label,
  counted,
  items,
  selectedId,
  onSelect,
  disabled,
}: {
  label: string;
  counted: boolean;
  items: BreakType[];
  selectedId?: number | null;
  onSelect: (type: BreakType) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("breaks.timer");
  // Folded by default; each viewer's own choice is remembered after that.
  const [open, setOpen] = usePersistedOpen(`group:${counted ? "counted" : "special"}`, false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-muted/20">
      <CollapsibleTrigger
        className={cn(
          "group/grp flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start transition-colors hover:bg-muted/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            counted ? "bg-amber-500" : "border border-muted-foreground/60"
          )}
        />
        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="rounded-md bg-muted px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground">
          {items.length}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/grp:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className={COLLAPSE_CONTENT}>
        {/* Three across at full popover width, two on phones. */}
        <div className="grid grid-cols-2 gap-1.5 px-2 pb-2 sm:grid-cols-3">
          {items.map((type) => {
            const selected = selectedId === type.id;
            return (
              <button
                key={type.id}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => onSelect(type)}
                title={type.counts_toward_limit ? type.name : `${type.name} · ${t("excluded")}`}
                className={cn(
                  "flex h-9 min-w-0 items-center rounded-lg border px-3 text-start text-xs font-medium transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : type.counts_toward_limit
                      ? "border-border bg-background hover:border-amber-500/50 hover:bg-amber-500/10 dark:hover:bg-amber-500/15"
                      : "border-dashed border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span className="truncate">{type.name}</span>
              </button>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

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
    <div data-slot="break-type-picker" className={cn("space-y-1.5", className)}>
      {groups.map((group) => (
        <TypeGroup
          key={group.label}
          label={group.label}
          counted={group.counted}
          items={group.items}
          selectedId={selectedId}
          onSelect={onSelect}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
