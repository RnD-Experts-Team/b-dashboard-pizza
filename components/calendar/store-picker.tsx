"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Search, Store as StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCalendarStore } from "@/lib/store/calendar.store";
import { useCalendarStoreOptions, useCalendarStoreRef, useCalendarStores } from "@/lib/hooks/use-calendar-events";

/**
 * Which stores the Calendar shows — one or several, found by name or number.
 *
 * Every change reloads all 8 feeds, so picks are held as a DRAFT and sent with
 * Apply (the same pattern as the hiring page's store picker) instead of
 * refetching on each click. Closing without Apply drops the draft. Picking
 * exactly the dashboard's store goes back to "follow the dashboard's store".
 *
 * Hidden for someone with a single store: there is nothing to choose.
 */
export function StorePicker({ className }: { className?: string }) {
  const t = useTranslations("calendar.stores");
  const options = useCalendarStoreOptions();
  const shown = useCalendarStores();
  const dashboard = useCalendarStoreRef();
  const setStoreCodes = useCalendarStore((s) => s.setStoreCodes);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<string[]>([]);

  const committed = useMemo(() => shown.map((s) => s.code), [shown]);

  // Each time it opens: start from what the calendar shows now, with a clean
  // search. Done in the handler (not an effect) so the first frame is already
  // ticked, and `committed` changing while it is open can't wipe the user's picks.
  const onOpenChange = (next: boolean) => {
    if (next) {
      setDraft(committed);
      setSearch("");
    }
    setOpen(next);
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q)) : options;
  }, [options, search]);

  if (options.length < 2) return null;

  const draftSet = new Set(draft);
  const visibleOn = visible.filter((o) => draftSet.has(o.code)).length;
  const allVisibleOn = visible.length > 0 && visibleOn === visible.length;
  const dirty = draft.length !== committed.length || committed.some((c) => !draftSet.has(c));

  const label =
    shown.length === 1
      ? shown[0].name
      : shown.length === options.length
        ? t("all")
        : t("count", { n: shown.length });

  const toggle = (code: string) => setDraft((d) => (d.includes(code) ? d.filter((c) => c !== code) : [...d, code]));

  const toggleVisible = () =>
    setDraft((d) => {
      const codes = visible.map((o) => o.code);
      return allVisibleOn ? d.filter((c) => !codes.includes(c)) : [...new Set([...d, ...codes])];
    });

  const apply = () => {
    // Keep the picker's own order, and drop anything that is no longer pickable.
    const next = options.filter((o) => draftSet.has(o.code)).map((o) => o.code);
    if (!next.length) return;
    if (dirty) setStoreCodes(next.length === 1 && next[0] === dashboard?.code ? null : next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-slot="calendar-store-picker"
          aria-label={`${t("title")}: ${label}`}
          className={cn("min-w-0 max-w-44 justify-between gap-1.5", className)}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <StoreIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronDown className={cn("size-3.5 shrink-0 opacity-50 transition-transform duration-200", open && "rotate-180")} />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(21rem,calc(100vw-2rem))] p-0">
        <div className="space-y-2 border-b p-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-heading text-sm font-semibold">{t("title")}</h3>
            <span className="text-xs tabular-nums text-muted-foreground">
              {t("selectedOf", { n: draft.length, total: options.length })}
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
              {/* Two states only: the shared checkbox draws "partial" with the same check mark as "all". */}
              <Checkbox checked={allVisibleOn} onCheckedChange={toggleVisible} className="rounded-sm" />
              <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {allVisibleOn ? t("clearAll") : t("selectAll")}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">{visible.length}</span>
            </label>
          )}

          <div className="max-h-64 overflow-y-auto overscroll-contain">
            {visible.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t("none")}</p>
            ) : (
              visible.map((o) => (
                <label
                  key={o.code}
                  className="flex cursor-pointer select-none items-center gap-3 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-accent/50"
                >
                  <Checkbox checked={draftSet.has(o.code)} onCheckedChange={() => toggle(o.code)} className="rounded-sm" />
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

        <div className="flex items-center justify-between gap-2 border-t p-2">
          <span className="min-w-0 truncate ps-1 text-xs text-muted-foreground">{draft.length === 0 ? t("pickOne") : ""}</span>
          <Button size="sm" disabled={draft.length === 0} onClick={apply}>
            {dirty && draft.length > 0 ? t("applyN", { n: draft.length }) : t("apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
