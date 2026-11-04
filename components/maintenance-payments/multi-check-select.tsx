"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface CheckOption {
  id: number;
  label: string;
  hint?: string;
}

/**
 * Pick several (a line's tickets): ticking applies at once — inside a form
 * an "Apply" step is one click too many. Chosen items show as removable
 * chips under the trigger.
 */
export function MultiCheckSelect({
  id,
  options,
  selected,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  removeLabel,
  loading,
  disabled,
  invalid,
}: {
  id?: string;
  options: CheckOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  /** aria-label for a chip's remove button, given the item's label. */
  removeLabel: (label: string) => string;
  loading?: boolean;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const toggle = (value: number) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <div className="space-y-1.5">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            className={cn(
              "h-9 w-full justify-between gap-1.5 text-sm font-normal text-muted-foreground",
              invalid && "border-destructive",
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />}
              <span className="truncate">{placeholder}</span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-7 border-0 p-0 text-sm shadow-none focus-visible:ring-0"
              autoFocus
            />
          </div>
          <div className="max-h-[240px] overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
            ) : (
              filtered.map((option) => {
                const isOn = selected.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={isOn}
                    onClick={() => toggle(option.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                      isOn && "bg-accent/60",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        isOn ? "border-primary bg-primary text-primary-foreground" : "border-input",
                      )}
                    >
                      {isOn && <Check className="h-3 w-3" />}
                    </span>
                    <span className="flex-1 truncate">{option.label}</span>
                    {option.hint && <span className="shrink-0 text-xs text-muted-foreground">{option.hint}</span>}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((value) => {
            const label = byId.get(value)?.label ?? `#${value}`;
            return (
              <Badge key={value} variant="secondary" className="max-w-full gap-1 pe-1 font-normal">
                <span className="truncate">{label}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => toggle(value)}
                    aria-label={removeLabel(label)}
                    className="rounded-sm p-0.5 hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
