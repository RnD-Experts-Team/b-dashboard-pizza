"use client";

import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown, Store } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InventoryStoreOption {
  storeId: string;
  name: string;
}

interface InventoryStoreSelectProps {
  stores: InventoryStoreOption[];
  value: string;
  onChange: (storeId: string) => void;
}

/**
 * Single-store selector for inventory pages.
 * Same visual language as StoreMultiSelect (trigger button, search input,
 * name + number rows) but selects one store and closes on click — no checkboxes,
 * no Select All, no Apply button.
 */
export function InventoryStoreSelect({
  stores,
  value,
  onChange,
}: InventoryStoreSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.storeId.toLowerCase().includes(q)
    );
  }, [stores, search]);

  const selected = stores.find((s) => s.storeId === value);

  const label = selected ? selected.name : "Select store";

  function handleSelect(storeId: string) {
    onChange(storeId);
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 min-w-[150px] max-w-[220px] justify-between"
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <Store className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform",
              open && "rotate-180"
            )}
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-2" align="start">
        <Input
          placeholder="Search by name or number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 mb-2"
          autoFocus
        />

        <div className="max-h-64 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/20 hover:[&::-webkit-scrollbar-thumb]:bg-foreground/35" onWheel={(e) => e.stopPropagation()}>
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No stores found.
            </p>
          ) : (
            <div className="flex flex-col gap-0.5 pr-1">
              {filtered.map((store) => {
                const isSelected = store.storeId === value;
                return (
                  <div
                    key={store.storeId}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "flex items-center justify-between gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-muted select-none",
                      isSelected && "bg-muted"
                    )}
                    onClick={() => handleSelect(store.storeId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        handleSelect(store.storeId);
                    }}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium leading-tight truncate">
                        {store.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {store.storeId}
                      </span>
                    </div>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
