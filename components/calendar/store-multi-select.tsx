"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Search, Store as StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CalendarStoreRef } from "@/lib/calendar/types";

/**
 * Pick one or more stores for something being created. Unlike the page's
 * `StorePicker` there is nothing to reload, so every tick applies at once (no
 * Apply step). Found by name or number.
 */
export function StoreMultiSelect({
  options,
  value,
  onChange,
  invalid,
  id,
}: {
  options: readonly CalendarStoreRef[];
  value: readonly string[];
  onChange: (codes: string[]) => void;
  invalid?: boolean;
  id?: string;
}) {
  const t = useTranslations("calendar.stores");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q)) : options;
  }, [options, search]);

  const on = new Set(value);
  const allVisibleOn = visible.length > 0 && visible.every((o) => on.has(o.code));
  const selected = options.filter((o) => on.has(o.code));
  const label =
    selected.length === 1 ? selected[0].name : selected.length === options.length && options.length > 0 ? t("all") : t("count", { n: selected.length });

  const toggle = (code: string) => onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  const toggleVisible = () => {
    const codes = visible.map((o) => o.code);
    onChange(allVisibleOn ? value.filter((c) => !codes.includes(c)) : [...new Set([...value, ...codes])]);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setSearch("");
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={invalid}
          className={cn("w-full justify-between gap-1.5 font-normal", invalid && "border-destructive")}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <StoreIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{selected.length ? label : t("pickOne")}</span>
          </span>
          <ChevronDown className={cn("size-3.5 shrink-0 opacity-50 transition-transform duration-200", open && "rotate-180")} />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[min(21rem,calc(100vw-2rem))] p-0">
        <div className="space-y-2 border-b p-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-heading text-sm font-semibold">{t("title")}</h3>
            <span className="text-xs tabular-nums text-muted-foreground">
              {t("selectedOf", { n: selected.length, total: options.length })}
            </span>
          </div>
          <label className="relative block">
            <span className="sr-only">{t("searchLabel")}</span>
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              autoFocus
              autoComplete="off"
              value={search}
              placeholder={t("search")}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full rounded-md border bg-background pe-2.5 ps-8 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 [&::-webkit-search-cancel-button]:hidden"
            />
          </label>
        </div>

        <div className="p-1.5">
          {visible.length > 0 && (
            <label className="flex cursor-pointer select-none items-center gap-3 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-accent/50">
              <Checkbox checked={allVisibleOn} onCheckedChange={toggleVisible} className="rounded-sm" />
              <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {allVisibleOn ? t("clearAll") : t("selectAll")}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">{visible.length}</span>
            </label>
          )}
          <div className="max-h-56 overflow-y-auto overscroll-contain">
            {visible.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t("none")}</p>
            ) : (
              visible.map((o) => (
                <label
                  key={o.code}
                  className="flex cursor-pointer select-none items-center gap-3 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-accent/50"
                >
                  <Checkbox checked={on.has(o.code)} onCheckedChange={() => toggle(o.code)} className="rounded-sm" />
                  <span className="min-w-0 flex-1">
                    <span dir="auto" className="block truncate text-start text-sm font-medium leading-tight">
                      {o.name}
                    </span>
                    <span className="block text-xs tabular-nums text-muted-foreground">{o.code}</span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
