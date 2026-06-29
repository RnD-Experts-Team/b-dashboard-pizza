"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Store } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StoreOption {
  storeId: string;
  name: string;
}

interface StoreMultiSelectProps {
  stores: StoreOption[];
  /** The committed/applied selection — what the page is currently fetching for. */
  value: string[];
  /** Called only when the user clicks Apply. Triggers the actual fetch. */
  onApply: (value: string[]) => void;
}

export function StoreMultiSelect({
  stores,
  value,
  onApply,
}: StoreMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Draft = what the user is selecting; not committed until Apply
  const [draft, setDraft] = useState<string[]>(value);

  // Every time the popover opens, reset draft to the current committed value
  useEffect(() => {
    if (open) {
      setDraft(value);
      setSearch("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.storeId.toLowerCase().includes(q),
    );
  }, [stores, search]);

  const allSelected = stores.length > 0 && draft.length === stores.length;
  const someSelected = draft.length > 0 && draft.length < stores.length;

  function toggleStore(storeId: string) {
    setDraft((prev) =>
      prev.includes(storeId)
        ? prev.filter((id) => id !== storeId)
        : [...prev, storeId],
    );
  }

  function toggleAll() {
    setDraft(allSelected ? [] : stores.map((s) => s.storeId));
  }

  function handleApply() {
    onApply(draft);
    setOpen(false);
  }

  // Trigger label always shows the committed `value`, not the draft
  const label =
    value.length === stores.length && stores.length > 0
      ? "All stores"
      : value.length === 0
        ? "No stores"
        : value.length === 1
          ? (stores.find((s) => s.storeId === value[0])?.name ?? "1 store")
          : `${value.length} stores`;

  const hasPending =
    draft.length !== value.length ||
    draft.some((id) => !value.includes(id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
              open && "rotate-180",
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

        {/* Select / deselect all */}
        <div
          role="button"
          tabIndex={0}
          className="flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm cursor-pointer hover:bg-muted select-none"
          onClick={toggleAll}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") toggleAll();
          }}
        >
          <Checkbox
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            className="pointer-events-none"
          />
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            {allSelected ? "Deselect all" : "Select all"}
          </span>
        </div>

        <div className="my-1.5 h-px bg-border" />

        <div className="max-h-52 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/20 hover:[&::-webkit-scrollbar-thumb]:bg-foreground/35">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No stores found.
            </p>
          ) : (
            <div className="flex flex-col gap-0.5 pr-1">
              {filtered.map((store) => (
                <div
                  key={store.storeId}
                  role="button"
                  tabIndex={0}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-muted select-none"
                  onClick={() => toggleStore(store.storeId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      toggleStore(store.storeId);
                  }}
                >
                  <Checkbox
                    checked={draft.includes(store.storeId)}
                    className="pointer-events-none shrink-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium leading-tight truncate">
                      {store.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {store.storeId}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-2 pt-2 border-t">
          <Button
            size="sm"
            className="w-full"
            onClick={handleApply}
          >
            {hasPending
              ? `Apply (${draft.length} store${draft.length !== 1 ? "s" : ""})`
              : "Apply"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
