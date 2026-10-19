"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MultiSelectOption } from "@/components/daily-pay/multi-select";

/* ────────────────────────────────────────────────────────────────────────── */
/*  A multi-select where "nothing chosen" is shown as "everything chosen".    */
/*                                                                            */
/*  The filters' real state is unchanged: `[]` means "no restriction", which  */
/*  is what the API gets. This component only DRAWS it as all-checked, so a   */
/*  person can see that the list covers every store/area/status. Apply        */
/*  normalises back: nothing, or everything, ticked → `[]`.                   */
/*                                                                            */
/*  Same stage-then-Apply behaviour as the shared MultiSelect (one request    */
/*  per Apply, not per tick) — that one is used by other pages, so it stays  */
/*  as it is.                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

interface AllMultiSelectProps<TValue extends string | number> {
  options: MultiSelectOption<TValue>[];
  /** Committed selection. `[]` = everything. */
  selected: TValue[];
  onChange: (values: TValue[]) => void;
  /** "All stores" */
  allLabel: string;
  /** "3 stores" */
  countLabel: (count: number) => string;
  disabled?: boolean;
  /** Shown instead of `allLabel` while the options are still loading. */
  loadingLabel?: string;
  className?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  id?: string;
  "aria-label"?: string;
}

function sameSet<T>(a: T[], b: T[]) {
  return a.length === b.length && a.every((v) => b.includes(v));
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
      )}
    >
      {checked && <Check className="h-3 w-3" />}
    </span>
  );
}

export function AllMultiSelect<TValue extends string | number>({
  options,
  selected,
  onChange,
  allLabel,
  countLabel,
  disabled,
  loadingLabel,
  className,
  searchPlaceholder,
  emptyText,
  id,
  "aria-label": ariaLabel,
}: AllMultiSelectProps<TValue>) {
  const t = useTranslations("toolboxTickets.filters");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const allValues = useMemo(() => options.map((o) => o.value), [options]);
  const everything = selected.length === 0;
  const startDraft = () => (everything ? allValues : selected);
  const [draft, setDraft] = useState<TValue[]>(startDraft);

  useEffect(() => {
    if (open) {
      setDraft(everything ? allValues : selected);
      setQuery("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const draftSet = useMemo(() => new Set(draft), [draft]);
  const draftIsAll = options.length > 0 && options.every((o) => draftSet.has(o.value));
  const next: TValue[] = draft.length === 0 || draftIsAll ? [] : draft;
  const pending = !sameSet(next, selected);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.hint ? o.hint.toLowerCase().includes(q) : false),
    );
  }, [options, query]);

  const toggle = (value: TValue) =>
    setDraft((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  // Trigger text always reflects the COMMITTED selection, not the draft.
  const label = disabled && loadingLabel
    ? loadingLabel
    : everything
      ? allLabel
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? countLabel(1))
        : countLabel(selected.length);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between gap-2 px-3 text-sm font-normal",
            !everything && "border-primary/40 bg-primary/5",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {everything && !disabled && <CheckBox checked />}
            <span className="truncate">{label}</span>
          </span>
          {!everything && !disabled ? (
            <Badge variant="secondary" className="ms-auto h-4 min-w-4 px-1 text-[10px] leading-none">
              {selected.length}
            </Badge>
          ) : (
            <ChevronsUpDown className="ms-auto h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-56 p-0" align="start">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-7 border-0 p-0 text-sm shadow-none focus-visible:ring-0"
          />
        </div>

        {options.length > 0 && (
          <>
            <button
              type="button"
              // A toggle: ticked → untick everything; otherwise tick everything.
              onClick={() => setDraft(draftIsAll ? [] : allValues)}
              className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <CheckBox checked={draftIsAll} />
              {allLabel}
            </button>
            <div className="border-b" />
          </>
        )}

        <div className="max-h-[240px] overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => toggle(option.value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <CheckBox checked={draftSet.has(option.value)} />
                <span className="flex-1 truncate">{option.label}</span>
                {option.hint && <span className="shrink-0 text-xs text-muted-foreground">{option.hint}</span>}
              </button>
            ))
          )}
        </div>

        <div className="border-t p-1.5">
          <Button
            type="button"
            size="sm"
            className="h-8 w-full"
            // Nothing ticked can't be applied. Everything ticked CAN: `next` is `[]` then,
            // the same request as no filter at all.
            disabled={draft.length === 0}
            onClick={() => {
              if (pending) onChange(next);
              setOpen(false);
            }}
          >
            {t("apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
