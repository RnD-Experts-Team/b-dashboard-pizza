"use client";

import * as React from "react";
import { Store as StoreIcon, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { StoreSelection } from "@/types/business-reports.types";

export interface StoreOption {
  /** Identifier forwarded to the endpoints (store.id by default). */
  id: string;
  /** Display label. */
  name: string;
}

interface StoreMultiSelectProps {
  options: StoreOption[];
  value: StoreSelection;
  onChange: (value: StoreSelection) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Multi-select store picker with an "All Stores" toggle.
 *
 * `value` is either the literal "all" or an explicit array of store ids.
 * Selecting every store individually is kept as an explicit list — only the
 * "All Stores" row emits the sentinel "all" (which the endpoints understand
 * as every store the caller can access).
 */
export function StoreMultiSelect({
  options,
  value,
  onChange,
  disabled,
  className,
}: StoreMultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const allIds = React.useMemo(() => options.map((o) => o.id), [options]);
  const isAll = value === "all";
  const selectedIds = React.useMemo(
    () => (isAll ? allIds : value),
    [isAll, allIds, value],
  );
  const selectedSet = React.useMemo(
    () => new Set(selectedIds),
    [selectedIds],
  );

  const summary = isAll
    ? "All Stores"
    : selectedIds.length === 0
      ? "Select stores"
      : selectedIds.length === 1
        ? (options.find((o) => o.id === selectedIds[0])?.name ?? "1 store")
        : `${selectedIds.length} stores`;

  function toggleAll(next: boolean) {
    onChange(next ? "all" : []);
  }

  function toggleStore(id: string, next: boolean) {
    // Leaving "all" mode: materialise the full list first, then edit it.
    const base = isAll ? allIds : [...value];
    const set = new Set(base);
    if (next) set.add(id);
    else set.delete(id);
    const list = allIds.filter((x) => set.has(x));
    // If the edit re-selects every store, keep it as an explicit list
    // (the user un-checked "All", so respect that intent).
    onChange(list);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn("w-48 justify-between font-normal", className)}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <StoreIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{summary}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        <div className="border-b px-2 py-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted/60">
            <Checkbox
              checked={isAll}
              onCheckedChange={(c) => toggleAll(c === true)}
            />
            All Stores
          </label>
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {options.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              No stores available
            </p>
          )}
          {options.map((o) => {
            const checked = selectedSet.has(o.id);
            return (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => toggleStore(o.id, c === true)}
                />
                <span className="min-w-0 flex-1 truncate">{o.name}</span>
                {checked && <Check className="h-3.5 w-3.5 text-primary" />}
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
