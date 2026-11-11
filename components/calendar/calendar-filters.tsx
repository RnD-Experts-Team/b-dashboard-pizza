"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ListFilter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CALENDAR_CATEGORIES } from "@/lib/calendar/categories";
import { CATEGORY_KEYS, type CategoryKey } from "@/lib/calendar/types";
import { useCalendarStore } from "@/lib/store/calendar.store";
import { EventDot } from "./event-parts";

/** Gap between chips in px: Tailwind `gap-1`, used by the row and by the hidden measuring copy. */
const GAP = 4;

type ChipKey = "all" | "custom" | CategoryKey;

interface Chip {
  key: ChipKey;
  label: string;
  active: boolean;
  /** Events of this type in the visible range; undefined = not shown (the Year view). */
  count?: number;
}

/** One chip's look. Quiet when off, a soft pill when on; the same classes style the hidden measuring copy. */
const chipClass = (active: boolean) =>
  cn(
    "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/50",
    active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
  );

function ChipBody({ chip, format }: { chip: Chip; format: (n: number) => string }) {
  const isCategory = chip.key !== "all" && chip.key !== "custom";
  return (
    <>
      {/* The colour dot only says "this one" — on the selected chip. The rest stay plain words. */}
      {isCategory && chip.active && <EventDot category={chip.key as CategoryKey} />}
      {chip.label}
      {chip.count !== undefined && (
        <span className="text-xs font-normal tabular-nums text-muted-foreground/80">{format(chip.count)}</span>
      )}
      {chip.key === "custom" && <X className="size-3.5 text-muted-foreground" aria-hidden />}
    </>
  );
}

/**
 * Event-type filter: "All", or one type at a time (combinations come from the
 * Filter popover and show as one "3 types ×" chip). Counts cover the visible
 * range with search applied but types NOT, so a hidden type still shows how
 * much it is hiding.
 *
 * It never clips and never scrolls sideways: the row measures the room it has
 * and moves what doesn't fit into a "N more" menu — the selected type always
 * stays on the row. ←/→ move between the chips.
 */
export function CategoryTabs({
  counts,
  total,
  hideCounts = false,
  disabled = false,
}: {
  counts: Record<CategoryKey, number>;
  total: number;
  /** The Year view counts by status, not by type: its chips carry no numbers. */
  hideCounts?: boolean;
  /** The Year view ignores types: the chips are shown but off. */
  disabled?: boolean;
}) {
  const t = useTranslations("calendar");
  const tc = useTranslations("calendar.categories");
  const locale = useLocale();
  const rtl = locale === "ar";
  const format = useMemo(() => {
    const nf = new Intl.NumberFormat(locale);
    return (n: number) => nf.format(n);
  }, [locale]);

  const filters = useCalendarStore((s) => s.filters);
  const showAll = useCalendarStore((s) => s.showAll);
  const onlyCategory = useCalendarStore((s) => s.onlyCategory);
  const all = filters.length === CATEGORY_KEYS.length;
  const single = filters.length === 1 ? filters[0] : null;
  const custom = !all && !single && filters.length > 0;

  const chips: Chip[] = useMemo(
    () => [
      { key: "all", label: t("tabs.all"), active: all, count: hideCounts ? undefined : total },
      ...(custom ? [{ key: "custom" as const, label: t("tabs.custom", { n: filters.length }), active: true }] : []),
      ...CALENDAR_CATEGORIES.map((c) => ({
        key: c.key,
        label: tc(c.key),
        active: single === c.key,
        count: hideCounts ? undefined : counts[c.key],
      })),
    ],
    [t, tc, all, custom, filters.length, single, total, counts, hideCounts],
  );

  /* ── Fit: which chips stay on the row; the rest go to "N more". `null` = not measured yet (all). ── */
  const hostRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<ReadonlySet<ChipKey> | null>(null);
  const signature = chips.map((c) => `${c.key}|${c.label}|${c.count ?? ""}|${c.active ? 1 : 0}`).join(";") + locale;

  useLayoutEffect(() => {
    const host = hostRef.current;
    const ghost = ghostRef.current;
    if (!host || !ghost) return;

    const fit = () => {
      const room = host.clientWidth - 4; // minus the 2px padding on each side
      const width = new Map<string, number>();
      for (const el of ghost.querySelectorAll<HTMLElement>("[data-chip]")) width.set(el.dataset.chip!, el.offsetWidth);
      const moreWidth = ghost.querySelector<HTMLElement>("[data-more]")?.offsetWidth ?? 0;
      const w = (c: Chip) => width.get(c.key) ?? 0;

      const everything = chips.reduce((sum, c, i) => sum + w(c) + (i ? GAP : 0), 0);
      if (everything <= room) {
        setShown((prev) => (prev === null ? prev : null));
        return;
      }

      // These always stay: All, the "N types" chip, and the selected type.
      const keep = new Set<ChipKey>(chips.filter((c) => c.key === "all" || c.key === "custom" || c.active).map((c) => c.key));
      let used = chips.filter((c) => keep.has(c.key)).reduce((sum, c, i) => sum + w(c) + (i ? GAP : 0), 0);
      const budget = room - moreWidth - GAP;
      // Then as many of the rest as fit, in their usual order (no gaps in the row).
      for (const c of chips) {
        if (keep.has(c.key)) continue;
        if (used + GAP + w(c) > budget) break;
        keep.add(c.key);
        used += GAP + w(c);
      }
      setShown((prev) => (prev && prev.size === keep.size && [...keep].every((k) => prev.has(k)) ? prev : keep));
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    return () => ro.disconnect();
    // `chips` is covered by `signature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const onRow = shown ? chips.filter((c) => shown.has(c.key)) : chips;
  const overflow = shown ? chips.filter((c) => !shown.has(c.key)) : [];

  const press = (c: Chip) => {
    if (c.key === "all" || c.key === "custom") showAll();
    else onlyCategory(c.key);
  };

  return (
    <div
      ref={hostRef}
      role="group"
      aria-label={t("tabs.label")}
      aria-disabled={disabled || undefined}
      title={disabled ? t("tabs.yearOff") : undefined}
      // Off in the Year view: not focusable, not clickable, and plainly dimmed.
      inert={disabled}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const stops = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-stop]"));
        const i = stops.indexOf(document.activeElement as HTMLElement);
        if (i < 0) return;
        // Stops the page's own ←/→ paging shortcut.
        e.preventDefault();
        const forward = (e.key === "ArrowRight") !== rtl;
        stops[(i + (forward ? 1 : -1) + stops.length) % stops.length].focus();
      }}
      // Clipped, never spilling into the search box beside it; the 2px padding (and matching negative
      // margin, so the chips still line up with the page) leaves room for a chip's focus ring.
      className={cn("relative -mx-0.5 flex min-w-0 items-center gap-1 overflow-hidden px-0.5 py-0.5", disabled && "opacity-50")}
    >
      {onRow.map((c) => (
        <button
          key={c.key}
          type="button"
          data-stop=""
          aria-pressed={c.active}
          aria-label={c.key === "custom" ? t("tabs.clearCustom") : undefined}
          onClick={() => press(c)}
          className={chipClass(c.active)}
        >
          <ChipBody chip={c} format={format} />
        </button>
      ))}

      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" data-stop="" className={chipClass(false)}>
              {t("tabs.more", { n: overflow.length })}
              <ChevronDown className="size-3.5" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            {overflow.map((c) => (
              <DropdownMenuItem key={c.key} onSelect={() => press(c)} className="gap-2">
                {c.key !== "all" && c.key !== "custom" && <EventDot category={c.key} />}
                <span className="min-w-0 flex-1 truncate">{c.label}</span>
                {c.count !== undefined && (
                  <span className={cn("text-xs tabular-nums text-muted-foreground", c.count === 0 && "opacity-60")}>{format(c.count)}</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* A hidden copy of every chip, measured to decide what fits. It takes no room and no clicks. */}
      <div ref={ghostRef} aria-hidden inert className="pointer-events-none invisible absolute start-0 top-0 flex gap-1 whitespace-nowrap">
        {chips.map((c) => (
          <span key={c.key} data-chip={c.key} className={chipClass(c.active)}>
            <ChipBody chip={c} format={format} />
          </span>
        ))}
        <span data-more="" className={chipClass(false)}>
          {t("tabs.more", { n: CATEGORY_KEYS.length })}
          <ChevronDown className="size-3.5" />
        </span>
      </div>
    </div>
  );
}

/** Filter popover: combine several event types, or pick "Only" one. (Stores: `StorePicker`.) */
export function FilterPopover({ counts, disabled = false }: { counts: Record<CategoryKey, number>; disabled?: boolean }) {
  const t = useTranslations("calendar.filter");
  const tc = useTranslations("calendar.categories");
  const scopeId = useId();
  const { filters, toggleCategory, onlyCategory, showAll, hideAll } = useCalendarStore();
  const all = filters.length === CATEGORY_KEYS.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
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
      </PopoverContent>
    </Popover>
  );
}
