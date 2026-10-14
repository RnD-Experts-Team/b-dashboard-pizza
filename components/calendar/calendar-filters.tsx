"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CALENDAR_CATEGORIES } from "@/lib/calendar/categories";
import { CATEGORY_KEYS, type CategoryKey } from "@/lib/calendar/types";
import { useCalendarStore } from "@/lib/store/calendar.store";
import { useCalendarStoreRef } from "@/lib/hooks/use-calendar-events";
import { EventDot } from "./event-parts";

/** Which ends of a horizontal scroller have hidden content (RTL-safe). */
function useScrollEdges(ref: React.RefObject<HTMLElement | null>) {
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // RTL scrollLeft runs 0 → negative in Chromium/Firefox; abs() covers both.
      const pos = Math.abs(el.scrollLeft);
      const max = el.scrollWidth - el.clientWidth;
      setEdges({ start: pos > 1, end: max - pos > 1 });
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [ref]);
  return edges;
}

/**
 * Category tabs: "All scheduled" or one type at a time. Counts cover the
 * visible range with search applied but categories NOT, so a hidden type
 * still shows how much it is hiding.
 *
 * The strip scrolls sideways when it can't fit (it shares the row with
 * search + Filter): edges fade only while there is more to see, the selected
 * tab scrolls into view, and ←/→ move focus between tabs.
 */
export function CategoryTabs({ counts, total }: { counts: Record<CategoryKey, number>; total: number }) {
  const t = useTranslations("calendar");
  const rtl = useLocale() === "ar";
  const filters = useCalendarStore((s) => s.filters);
  const showAll = useCalendarStore((s) => s.showAll);
  const onlyCategory = useCalendarStore((s) => s.onlyCategory);
  const all = filters.length === CATEGORY_KEYS.length;
  const single = filters.length === 1 ? filters[0] : null;
  const activeKey = all ? "all" : single;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const edges = useScrollEdges(scrollerRef);

  // Keep the selected tab visible: instantly on mount/resize, smoothly when it
  // changes. Horizontal scrollBy only (physical px, so RTL works) — never
  // scrollIntoView, which can also scroll the page.
  const lastKey = useRef(activeKey);
  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const reveal = (behavior: ScrollBehavior) => {
      const el = sc.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!el) return;
      const pad = 24;
      const er = el.getBoundingClientRect();
      const sr = sc.getBoundingClientRect();
      if (er.right > sr.right - pad) sc.scrollBy({ left: er.right - sr.right + pad, behavior });
      else if (er.left < sr.left + pad) sc.scrollBy({ left: er.left - sr.left - pad, behavior });
    };
    reveal(lastKey.current === activeKey ? "instant" : "smooth");
    lastKey.current = activeKey;
    const ro = new ResizeObserver(() => reveal("instant"));
    ro.observe(sc);
    return () => ro.disconnect();
  }, [activeKey]);

  const items = [
    { key: "all" as const, label: t("tabs.all"), active: all, count: total },
    ...CALENDAR_CATEGORIES.map((c) => ({
      key: c.key,
      label: t(`categories.${c.key}`),
      active: single === c.key,
      count: counts[c.key],
    })),
  ];

  const fade = 28;
  const dir = rtl ? "to left" : "to right";
  const mask =
    edges.start || edges.end
      ? `linear-gradient(${dir}, ${edges.start ? "transparent" : "#000"} 0, #000 ${edges.start ? fade : 0}px, #000 calc(100% - ${edges.end ? fade : 0}px), ${edges.end ? "transparent" : "#000"} 100%)`
      : undefined;

  return (
    <div
      ref={scrollerRef}
      role="tablist"
      aria-label={t("tabs.label")}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'));
        const i = tabs.indexOf(document.activeElement as HTMLElement);
        if (i < 0) return;
        // Stops the page's own ←/→ paging shortcut.
        e.preventDefault();
        const forward = (e.key === "ArrowRight") !== rtl;
        tabs[(i + (forward ? 1 : -1) + tabs.length) % tabs.length].focus();
      }}
      className="cal-no-scrollbar -mb-px flex overflow-x-auto pe-1"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="tab"
          aria-selected={it.active}
          tabIndex={it.active || (!activeKey && it.key === "all") ? 0 : -1}
          onClick={() => (it.key === "all" ? showAll() : onlyCategory(it.key))}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-1.5 pb-2.5 pt-1 text-[13px] font-medium outline-none transition-colors duration-200 focus-visible:text-foreground rounded-t-md focus-visible:bg-muted/50",
            it.active
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          {it.key !== "all" && (
            <EventDot category={it.key} className={cn("transition-opacity duration-200", !it.active && "opacity-60")} />
          )}
          {it.label}
          <span
            className={cn(
              "ms-0.5 min-w-4.5 rounded-full px-1 py-px text-center text-[10px] font-semibold tabular-nums transition-colors duration-200",
              // Inactive counts only where the row has room for all of them.
              it.active ? "bg-foreground text-background" : "hidden bg-muted text-muted-foreground 2xl:inline",
            )}
          >
            {it.count}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Filter popover: combine several types, "Only" one, and pick the store scope. */
export function FilterPopover({ counts }: { counts: Record<CategoryKey, number> }) {
  const t = useTranslations("calendar.filter");
  const tc = useTranslations("calendar.categories");
  const scopeId = useId();
  const store = useCalendarStoreRef();
  const { filters, scope, toggleCategory, onlyCategory, showAll, hideAll, setScope } = useCalendarStore();
  const all = filters.length === CATEGORY_KEYS.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <ListFilter className="size-4" />
          {t("button")}
          {!all && (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-foreground px-1 text-[10px] font-semibold tabular-nums text-background">
              {filters.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-(--radix-popover-content-available-height) w-68 overflow-y-auto p-2">
        <div className="flex items-center justify-between px-2 pb-1">
          <h3 className="font-heading text-sm font-semibold">{t("title")}</h3>
          <button
            type="button"
            onClick={all ? hideAll : showAll}
            className="rounded px-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {all ? t("hideAll") : t("showAll")}
          </button>
        </div>
        <div className="space-y-px">
          {CALENDAR_CATEGORIES.map((c) => {
            const on = filters.includes(c.key);
            const id = `${scopeId}-${c.key}`;
            return (
              <div
                key={c.key}
                className="group/f flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-accent/50"
              >
                <Checkbox id={id} checked={on} onCheckedChange={() => toggleCategory(c.key)} className="rounded-sm" />
                <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                  <EventDot category={c.key} className={cn(!on && "opacity-40")} />
                  <span className={cn("min-w-0 flex-1 truncate text-sm transition-colors duration-150", !on && "text-muted-foreground")}>
                    {tc(c.key)}
                  </span>
                </label>
                <span className="relative grid min-w-9 justify-items-end">
                  <span className="text-xs tabular-nums text-muted-foreground transition-opacity duration-150 group-hover/f:opacity-0 group-focus-within/f:opacity-0">
                    {counts[c.key]}
                  </span>
                  <button
                    type="button"
                    onClick={() => onlyCategory(c.key)}
                    className="absolute inset-y-0 end-0 text-[11px] font-medium text-muted-foreground opacity-0 outline-none transition-opacity duration-150 hover:text-foreground focus-visible:opacity-100 group-hover/f:opacity-100"
                  >
                    {t("only")}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
        {store && (
          <div className="mt-2 border-t px-2 pt-2.5 pb-1">
            <h3 className="pb-1.5 font-heading text-sm font-semibold">{t("scopeTitle")}</h3>
            <div className="flex items-start justify-between gap-3">
              <label htmlFor={`${scopeId}-scope`} className="min-w-0 cursor-pointer">
                <span className="block truncate text-sm">{t("scopeStore", { store: store.name })}</span>
                <span className="block text-xs text-muted-foreground">{t("scopeStoreHint")}</span>
              </label>
              <Switch
                id={`${scopeId}-scope`}
                checked={scope === "store"}
                onCheckedChange={(v) => setScope(v ? "store" : "all")}
                className="mt-0.5"
              />
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
