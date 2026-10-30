"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export interface ComboGroup {
  label?: string;
  options: ComboOption[];
}

/**
 * One searchable single-choice picker for the payment screens: optional
 * groups (Technicians · Suppliers), an optional footer that receives the
 * typed text (inline "Add supplier" / "Create part"), and a clear button.
 * Dropdown height is fixed like every picker in the app; wheel events stop
 * here so the dialog behind does not scroll.
 */
export function EntityCombobox({
  id,
  groups,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  clearLabel,
  loading,
  disabled,
  invalid,
  className,
  footer,
}: {
  id?: string;
  groups: ComboGroup[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  /** aria-label of the clear button; omit to hide it. */
  clearLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  footer?: (query: string, close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => groups.flatMap((g) => g.options).find((o) => o.value === value) ?? null,
    [groups, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        options: q ? g.options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q)) : g.options,
      }))
      .filter((g) => g.options.length > 0);
  }, [groups, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
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
              "h-9 w-full justify-between gap-1.5 pe-8 text-sm font-normal",
              !selected && "text-muted-foreground",
              invalid && "border-destructive",
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />}
              <span className="truncate">{selected ? selected.label : placeholder}</span>
              {selected?.hint && <span className="shrink-0 truncate text-xs text-muted-foreground">{selected.hint}</span>}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-60 p-0" align="start">
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
              filtered.map((group, gi) => (
                <div key={group.label ?? gi} role="group" aria-label={group.label}>
                  {group.label && (
                    <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </p>
                  )}
                  {group.options.map((option) => {
                    const isSelected = option.value === value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={option.disabled}
                        onClick={() => {
                          onChange(option.value);
                          close();
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors",
                          option.disabled ? "cursor-not-allowed opacity-50" : "hover:bg-accent hover:text-accent-foreground",
                          isSelected && "bg-accent/60",
                        )}
                      >
                        <Check className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                        <span className="flex-1 truncate">{option.label}</span>
                        {option.hint && <span className="shrink-0 text-xs text-muted-foreground">{option.hint}</span>}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          {footer && <div className="border-t p-1">{footer(query, close)}</div>}
        </PopoverContent>
      </Popover>
      {clearLabel && selected && !disabled && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={clearLabel}
          className="absolute end-7 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
