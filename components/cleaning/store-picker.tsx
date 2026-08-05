"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface StoreOption {
  id: number;
  code: string;
  name: string;
}

interface Props {
  options: StoreOption[];
  value: number | null;
  onChange: (store: StoreOption) => void;
  className?: string;
  loading?: boolean;
}

/** Searchable store selector (by name or number), matching the app's switcher. */
export function StorePicker({ options, value, onChange, className, loading }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const current = options.find((o) => o.id === value) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q)
    );
  }, [query, options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={loading}
          className={cn(
            "h-11 w-full justify-between gap-2 rounded-lg ps-2 sm:w-auto sm:min-w-[250px]",
            className
          )}
        >
          <span className="flex items-center gap-2.5 truncate">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Store className="h-4 w-4" />
            </span>
            {current ? (
              <span className="flex items-center gap-2 truncate">
                <span className="truncate font-semibold">{current.name}</span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {current.code}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">
                {loading ? "Loading stores…" : "Select store…"}
              </span>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-0">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or number…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div
          className="max-h-72 overflow-y-auto p-1"
          onWheel={(e) => e.stopPropagation()}
        >
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No stores found.
            </p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground",
                  o.id === value && "bg-accent/60"
                )}
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    o.id === value ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{o.name}</span>
                  <span className="block text-xs text-muted-foreground">{o.code}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
