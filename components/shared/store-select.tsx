"use client";

import { useMemo, useState } from "react";
import { Check, Store as StoreIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type { Store, StoreMetadata } from "@/types/store.types";

/** The picked store sits halfway down the list: (free space) / 2 above it. */
const HALVES = 2;

/** Shared look of the trigger: the compact h-6 header controls (same as WeekSelect `compact`). */
const TRIGGER_CLASS = "h-6 gap-1 px-2 text-xs font-medium";

/**
 * A screen with no header row of its own (no store / error / no data) carries
 * the store picker above its content, so a failed switch — e.g. a store the
 * user can't see the report for — is undone right there, not from the sidebar.
 */
export function WithStoreSelect({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <StoreSelect />
      </div>
      {children}
    </div>
  );
}

/**
 * Picks the dashboard's store from a header chip — the same list and the same
 * global selection as the sidebar's "Select Store" dialog, so every page, the
 * sidebar and the topbar follow a pick made here exactly as they follow one
 * made there. Looks and behaves like WeekSelect: click the chip, scroll or type
 * a name / store number, Enter picks the first match.
 *
 * A user with one store (or none) gets the same chip without a menu.
 */
export function StoreSelect({ className }: { className?: string }) {
  const overviewStores = useAuthStore((s) => s.overviewStores);
  const selectedStore = useSelectedStoreStore((s) => s.selectedStore);
  const setSelectedStore = useSelectedStoreStore((s) => s.setSelectedStore);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Built EXACTLY like the sidebar's list (components/layout/sidebar.tsx), so
  // the persisted selection has the same shape whichever control wrote it.
  const stores = useMemo<Store[]>(
    () =>
      (overviewStores ?? []).map((s) => ({
        id: s.id,
        storeId: s.storeId ?? s.id,
        name: s.name,
        metadata: (s.metadata ?? {}) as StoreMetadata,
        isActive: s.isActive,
        createdAt: "",
        updatedAt: "",
      })),
    [overviewStores],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (s) => s.name.toLowerCase().includes(q) || s.storeId.toLowerCase().includes(q),
    );
  }, [stores, query]);

  const value = selectedStore?.id ?? "";
  const label = selectedStore ? `Store ${selectedStore.storeId}` : "Select store";

  function pick(store: Store) {
    setOpen(false);
    // Same store again: nothing to do — a fresh object would wake every subscriber.
    if (store.id === selectedStore?.id) return;
    setSelectedStore(store);
  }

  const chipContent = (
    <span className="inline-flex items-center gap-1">
      <StoreIcon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );

  // Nothing to choose between: the chip, without a menu.
  if (stores.length <= 1) {
    return (
      <div
        data-slot="store-select"
        className={cn(
          "inline-flex items-center rounded-md border bg-background shadow-xs dark:border-input dark:bg-input/30",
          TRIGGER_CLASS,
          !selectedStore && "text-muted-foreground",
          className,
        )}
      >
        {chipContent}
      </div>
    );
  }

  return (
    <div data-slot="store-select" className={cn("inline-flex items-center", className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={selectedStore ? `${label} (${selectedStore.name}), change store` : label}
            title={selectedStore?.name}
            className={cn(TRIGGER_CLASS, !selectedStore && "text-muted-foreground")}
          >
            {chipContent}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-1.5"
          align="start"
          onOpenAutoFocus={(e) => {
            // Straight into the search box with a mouse; on a touch screen that would pop the
            // keyboard every time, so the list is shown and the box is one tap away.
            e.preventDefault();
            if (window.matchMedia("(pointer: fine)").matches) {
              (e.currentTarget as HTMLElement).querySelector("input")?.focus({ preventScroll: true });
            }
          }}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Only once something is typed: an Enter in the empty box would
              // otherwise switch to the list's FIRST store, reloading the page
              // for a store nobody chose. isComposing: an IME's Enter confirms
              // the text, it doesn't pick.
              if (e.key === "Enter" && !e.nativeEvent.isComposing && query.trim() && matches[0]) {
                e.preventDefault();
                pick(matches[0]);
              }
            }}
            placeholder="Search name or number"
            aria-label="Find a store"
            className="mb-1 h-7 text-xs"
          />
          {/* onWheel: keep a scroll past the list's end from moving the page under it
              (house style — shared/searchable-select.tsx does the same). */}
          <div
            className="max-h-64 overflow-y-auto"
            role="listbox"
            onWheel={(e) => e.stopPropagation()}
          >
            {matches.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">No such store</p>
            ) : (
              matches.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={s.id === value}
                  ref={(el) => {
                    // Centre the picked store in the list by scrolling the list alone. scrollIntoView
                    // also scrolls the page frame (see scroll-to-section.ts), sliding the whole app up
                    // off the screen on a tablet and leaving it stuck there.
                    const list = el?.parentElement;
                    if (el && list && s.id === value && !query) {
                      const offset = el.getBoundingClientRect().top - list.getBoundingClientRect().top;
                      list.scrollTop += offset - (list.clientHeight - el.clientHeight) / HALVES;
                    }
                  }}
                  onClick={() => pick(s)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-start text-xs hover:bg-accent hover:text-accent-foreground",
                    s.id === value && "bg-accent/60 font-medium",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{s.storeId}</span>
                  <Check
                    className={cn("size-3.5 shrink-0", s.id !== value && "invisible")}
                    aria-hidden="true"
                  />
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
