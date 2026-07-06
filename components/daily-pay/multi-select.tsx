"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface MultiSelectOption {
  value: number;
  label: string;
  hint?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  /** The committed/applied selection — what the page is currently fetching for. */
  selected: number[];
  /** Called only when the user clicks Apply. Triggers the actual fetch. */
  onChange: (values: number[]) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}

/**
 * Lightweight multi-select built on Popover + a searchable checkbox list.
 * Selections are staged locally (`draft`) and only committed — firing
 * `onChange` — when the user clicks Apply, to avoid a request per checkbox click.
 */
export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select…",
  icon,
  disabled,
  className,
  searchPlaceholder = "Search…",
  emptyText = "No results.",
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Draft = what the user is checking/unchecking; not committed until Apply.
  const [draft, setDraft] = useState<number[]>(selected);

  useEffect(() => {
    if (open) {
      setDraft(selected);
      setQuery("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint ? o.hint.toLowerCase().includes(q) : false)
    );
  }, [options, query]);

  const draftSet = useMemo(() => new Set(draft), [draft]);

  function toggle(value: number) {
    setDraft((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function toggleAll() {
    setDraft(draft.length === options.length ? [] : options.map((o) => o.value));
  }

  function handleApply() {
    onChange(draft);
    setOpen(false);
  }

  // Trigger label/count always reflects the committed `selected`, not the draft.
  const count = selected.length;
  const hasPending =
    draft.length !== selected.length || draft.some((v) => !selected.includes(v));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between gap-1.5 text-sm font-normal",
            count > 0 && "border-primary/40 bg-primary/5",
            className
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            {icon}
            <span className="truncate text-muted-foreground">
              {count === 0 ? placeholder : `${count} selected`}
            </span>
          </span>
          {count > 0 ? (
            <Badge
              variant="secondary"
              className="ms-auto h-4 min-w-4 px-1 text-[10px] leading-none"
            >
              {count}
            </Badge>
          ) : (
            <ChevronsUpDown className="ms-auto h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-52 p-0"
        align="start"
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-7 border-0 p-0 text-sm shadow-none focus-visible:ring-0"
          />
          {draft.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-destructive"
              onClick={() => setDraft([])}
            >
              <X className="me-0.5 h-3 w-3" />
              Clear
            </Button>
          )}
        </div>

        {options.length > 0 && (
          <>
            <button
              type="button"
              onClick={toggleAll}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  draft.length === options.length
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input"
                )}
              >
                {draft.length === options.length && <Check className="h-3 w-3" />}
              </span>
              {draft.length === options.length ? "Deselect all" : "Select all"}
            </button>
            <div className="border-b" />
          </>
        )}

        <div className="max-h-[240px] overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </p>
          ) : (
            filtered.map((option) => {
              const isSelected = draftSet.has(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggle(option.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors",
                    "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input"
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="flex-1 truncate">{option.label}</span>
                  {option.hint && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {option.hint}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="border-t p-1.5">
          <Button size="sm" className="h-8 w-full" onClick={handleApply}>
            {hasPending ? `Apply (${draft.length})` : "Apply"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
