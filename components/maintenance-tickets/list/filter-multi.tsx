"use client";

import { useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface FilterOption<T extends string | number> {
  value: T;
  label: string;
}

const SEARCH_FROM = 8;

/**
 * One compact filter in the tickets' flat filter row: a button that says
 * what is picked ("Status: 2"), opening a checklist. An empty selection
 * means "no restriction" and reads as the `allLabel`.
 */
export function FilterMulti<T extends string | number>({
  label,
  allLabel,
  options,
  value,
  onChange,
  disabled,
  single = false,
  deferred = false,
}: {
  label: string;
  allLabel: string;
  options: FilterOption<T>[];
  value: T[];
  onChange: (next: T[]) => void;
  disabled?: boolean;
  /** Pick at most one. */
  single?: boolean;
  /** Hold the picks and report them once, when the list closes (costly filters such as stores). */
  deferred?: boolean;
}) {
  const t = useTranslations("maintenanceSystem");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<T[] | null>(null);
  const current = deferred && draft ? draft : value;
  const emit = (next: T[]) => (deferred ? setDraft(next) : onChange(next));
  const shown = query.trim() ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())) : options;
  const first = options.find((o) => o.value === value[0]);
  const summary = value.length === 1 && first ? first.label : t("tickets.list.picked", { count: value.length });

  function setOpenState(next: boolean) {
    setOpen(next);
    if (next) return setDraft(deferred ? value : null);
    setQuery("");
    if (deferred && draft && (draft.length !== value.length || draft.some((v) => !value.includes(v)))) onChange(draft);
    setDraft(null);
  }

  function toggle(v: T) {
    if (single) {
      onChange(current.includes(v) ? [] : [v]);
      setOpen(false);
      return;
    }
    emit(current.includes(v) ? current.filter((x) => x !== v) : [...current, v]);
  }

  return (
    <Popover open={open} onOpenChange={setOpenState}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn("h-9 max-w-56 justify-between gap-1.5 font-normal", value.length && "border-primary/50 bg-primary/5")}
          aria-label={label}
        >
          <span className="truncate">
            <span className="text-muted-foreground">{label}: </span>
            {value.length ? summary : allLabel}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        {options.length > SEARCH_FROM ? (
          <div className="border-b px-2 py-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("common.search")}
                aria-label={t("common.search")}
                className="w-full bg-transparent py-1 ps-7 pe-2 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
        ) : null}
        <div className="max-h-64 overflow-y-auto p-1" role="listbox" aria-multiselectable={!single} aria-label={label}>
          {shown.length === 0 ? <p className="px-2 py-3 text-center text-xs text-muted-foreground">{t("tickets.list.noOptions")}</p> : null}
          {shown.map((o) => {
            const on = current.includes(o.value);
            return (
              <button
                key={String(o.value)}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => toggle(o.value)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm hover:bg-accent"
              >
                <span
                  className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-input")}
                  aria-hidden="true"
                >
                  {on ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
        {current.length ? (
          <div className="border-t p-1">
            <Button variant="ghost" size="sm" className="h-8 w-full text-xs" onClick={() => emit([])}>
              {t("tickets.list.clearThis")}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
