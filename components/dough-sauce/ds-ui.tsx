"use client";

import { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth/auth.store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DoughSauceError } from "@/lib/api/services/dough-sauce.service";
import type { Ingredient, IngredientKey, PersonRef, Week } from "@/types/dough-sauce.types";

/* ── Number formatting ─────────────────────────────────────────────────── */

const qtyFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const pctFmt = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 });
const signedPctFmt = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const signedQtyFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, signDisplay: "exceptZero" });

export const fmtQty = (n: number) => qtyFmt.format(n);
export const fmtSignedQty = (n: number) => signedQtyFmt.format(n);
export const fmtPct = (n: number) => pctFmt.format(n);
export const fmtSignedPct = (n: number) => signedPctFmt.format(n);

/*
 * Glance formatting for dense grids: whole units from 100 up, one decimal below. Display only:
 * the exact value stays in the cell's tooltip, and ok/short is decided on the unrounded numbers.
 */
const glanceWhole = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const glanceOne = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const glanceWholeSigned = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0, signDisplay: "exceptZero" });
const glanceOneSigned = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, signDisplay: "exceptZero" });

export const fmtGlanceQty = (n: number) => (Math.abs(n) >= 100 ? glanceWhole : glanceOne).format(n);
/** A tiny shortfall must not round to "0" next to a red ✕, so values under 0.05 keep their precision. */
export const fmtSignedGlanceQty = (n: number) =>
  n !== 0 && Math.abs(n) < 0.05
    ? signedQtyFmt.format(n)
    : (Math.abs(n) >= 100 ? glanceWholeSigned : glanceOneSigned).format(n);

/** Planned quantities are sent at 4-decimal precision, matching the contract's examples. */
export const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/* ── People ────────────────────────────────────────────────────────────── */

/**
 * `confirmed_by` / `judged_by` may arrive as a name or as a user object.
 * Passing an object straight into a translation makes next-intl fail and
 * print the raw key — so every render goes through here.
 */
export function personName(p: PersonRef | undefined): string | null {
  if (p == null || p === "") return null;
  if (typeof p === "string") return p;
  if (typeof p === "number") return `#${p}`;
  return p.name || p.email || (p.id != null ? `#${p.id}` : null);
}

/* ── Stores ────────────────────────────────────────────────────────────── */

/** Store code → display name, from the stores this user can access. */
export function useStoreNames() {
  const overviewStores = useAuthStore((s) => s.overviewStores);
  return useMemo(() => {
    const m = new Map<string, string>();
    for (const s of overviewStores ?? []) if (s.storeId) m.set(s.storeId, s.name);
    return m;
  }, [overviewStores]);
}

/* ── Dates ─────────────────────────────────────────────────────────────── */

/** "Wed, Sep 30" for an ISO calendar date, parsed as a LOCAL day (no UTC shift). */
export function useDayFormatter() {
  const locale = useLocale();
  return useMemo(() => {
    const long = new Intl.DateTimeFormat(locale, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
    const short = new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" });
    const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const monthDay = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
    const toDate = (iso: string) => {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    };
    return {
      long: (iso: string) => long.format(toDate(iso)),
      short: (iso: string) => short.format(toDate(iso)),
      /** "Wed" / "Sep 30" — for column headers that stack the two. */
      weekday: (iso: string) => weekday.format(toDate(iso)),
      monthDay: (iso: string) => monthDay.format(toDate(iso)),
    };
  }, [locale]);
}

export function useDateTimeFormatter() {
  const locale = useLocale();
  return useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    return (iso: string) => {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? iso : f.format(d);
    };
  }, [locale]);
}

/* ── Score tone ────────────────────────────────────────────────────────── */

/** Traffic-light for a 0–1 score: ≥ 80% good, ≥ 60% watch, below that needs attention. */
export function scoreTone(score: number) {
  if (score >= 0.8)
    return { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" };
  if (score >= 0.6) return { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" };
  return { text: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500" };
}

/* ── Pending pill (amber — pending is "waiting", not an error) ─────────── */

export const PENDING_TEXT = "text-amber-700 dark:text-amber-400";
export const PENDING_PILL = "bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400";

/* ── Number stepper ────────────────────────────────────────────────────── */

export function StepperInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  invalid,
  label,
  suffix,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  step?: number;
  invalid?: boolean;
  label: string;
  suffix?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("doughSauce.common");
  const num = Number(value);
  const bump = (dir: 1 | -1) => {
    const base = value.trim() === "" || !Number.isFinite(num) ? 0 : num;
    const next = Math.min(max, Math.max(min, Math.round((base + dir * step) * 100) / 100));
    onChange(String(next));
  };
  return (
    <div
      className={cn(
        "inline-flex h-9 items-center rounded-md border bg-background",
        invalid && "border-destructive",
        disabled && "opacity-50"
      )}
    >
      <button
        type="button"
        onClick={() => bump(-1)}
        disabled={disabled || (Number.isFinite(num) && num <= min)}
        className="flex h-full w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
        aria-label={t("decrease", { label })}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        aria-invalid={invalid}
        className="h-full w-12 bg-transparent text-center text-sm font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {suffix && <span className="pe-1 text-xs text-muted-foreground">{suffix}</span>}
      <button
        type="button"
        onClick={() => bump(1)}
        disabled={disabled || (Number.isFinite(num) && num >= max)}
        className="flex h-full w-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
        aria-label={t("increase", { label })}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ── Missing value (rule 2) ────────────────────────────────────────────── */

/**
 * "Never counted" / "no data" — must look different from a real 0. A dash in
 * the amber accent, with an explanation on hover.
 */
export function MissingValue({ reason, className }: { reason?: string; className?: string }) {
  const t = useTranslations("doughSauce.common");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-block cursor-help font-semibold text-amber-600 tabular-nums dark:text-amber-400",
            className
          )}
          aria-label={reason ?? t("missing")}
        >
          —
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason ?? t("missing")}</TooltipContent>
    </Tooltip>
  );
}

/* ── Ingredient label ──────────────────────────────────────────────────── */

export function useIngredientLabel(ingredients: Ingredient[] | null) {
  const t = useTranslations("doughSauce.ingredients");
  return (key: IngredientKey) => ingredients?.find((i) => i.key === key)?.name || t(key);
}

/* ── System label ──────────────────────────────────────────────────────── */

export function useSystemLabel() {
  const t = useTranslations("doughSauce.systems");
  return (system: DoughSauceError["system"]) => t(system);
}

/* ── Error / no-access state ───────────────────────────────────────────── */

export function DsErrorState({
  error,
  onRetry,
  compact,
}: {
  error: DoughSauceError;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const t = useTranslations("doughSauce.errorState");
  const systemLabel = useSystemLabel();
  const forbidden = error.code === "FORBIDDEN";
  const Icon = forbidden ? Lock : AlertTriangle;

  return (
    <Card className={cn(forbidden ? "border-dashed" : "border-destructive/30")}>
      <CardContent
        className={cn("flex flex-col items-center gap-3 text-center", compact ? "py-6" : "py-12")}
      >
        <Icon className={cn("h-8 w-8", forbidden ? "text-muted-foreground" : "text-destructive")} />
        <div className="space-y-1">
          <p className="font-medium">
            {forbidden ? t("noAccessTitle") : t("failedTitle", { system: systemLabel(error.system) })}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            {forbidden ? t("noAccessDescription") : error.message}
          </p>
        </div>
        {onRetry && !forbidden && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="me-2 h-4 w-4" />
            {t("retry")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Week picker (rule 1 — only ever from the server's `weeks` list) ───── */

export function WeekPicker({
  weeks,
  value,
  onChange,
  disabled,
}: {
  weeks: Week[];
  value: string | undefined;
  onChange: (weekStart: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("doughSauce.common");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedRef = useRef<HTMLButtonElement>(null);
  const labelOf = (w: Week) =>
    w.label ?? t("weekLabel", { week: w.week_no, year: w.fiscal_year });

  const selected = weeks.find((w) => w.week_start === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return weeks;
    return weeks.filter((w) =>
      `${w.label ?? ""} ${w.week_no} ${w.fiscal_year} ${w.week_start} ${w.week_end}`.toLowerCase().includes(q)
    );
  }, [weeks, query]);

  const pick = (w: Week) => {
    onChange(w.week_start);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setQuery("");
          // The list is 5 rows tall — bring the selected week into view.
          requestAnimationFrame(() => selectedRef.current?.scrollIntoView({ block: "center" }));
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || weeks.length === 0}
          className="w-full justify-between gap-2 font-normal sm:w-auto sm:min-w-72"
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="whitespace-nowrap font-medium">{labelOf(selected)}</span>
              <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                {selected.week_start} → {selected.week_end}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{t("selectWeek")}</span>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-80 p-0">
        <div className="relative border-b p-2">
          <Search className="pointer-events-none absolute start-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered.length > 0) {
                e.preventDefault();
                pick(filtered[0]);
              }
            }}
            placeholder={t("searchWeek")}
            className="h-8 ps-8 text-sm"
          />
        </div>
        {/* 5 rows of 44px — the rest scrolls. */}
        <div className="max-h-[220px] overflow-y-auto p-1" role="listbox">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("noWeeks")}</p>
          ) : (
            filtered.map((w) => {
              const isSelected = w.week_start === value;
              return (
                <button
                  key={w.week_start}
                  ref={isSelected ? selectedRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => pick(w)}
                  className={cn(
                    "flex h-11 w-full items-center gap-2 rounded-md px-2.5 text-start transition-colors hover:bg-accent",
                    isSelected && "bg-accent"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{labelOf(w)}</span>
                      {w.current && (
                        <span className="rounded bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                          {t("current")}
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {w.week_start} → {w.week_end}
                    </span>
                  </span>
                  {isSelected && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ── Client-side pagination ────────────────────────────────────────────── */

export const PAGE_SIZES = [10, 20, 50] as const;

/**
 * Slice a list into pages. Resets to page 1 only when `resetKey` changes (a new
 * filter or search) — NOT when the data is refetched after an add / edit /
 * delete, so you stay on the page you were on. If the current page vanishes
 * (its last row was deleted) the page is clamped to the new last one.
 */
export function usePaged<T>(items: T[], initialSize: number = 20, resetKey: string = "") {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setPage(1);
  }
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    page: current,
    pageCount,
    pageSize,
    total: items.length,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, items.length),
    setPage,
    setPageSize: (n: number) => {
      setPageSize(n);
      setPage(1);
    },
  };
}

export function PaginationFooter({
  page,
  pageCount,
  pageSize,
  total,
  from,
  to,
  setPage,
  setPageSize,
}: Pick<
  ReturnType<typeof usePaged>,
  "page" | "pageCount" | "pageSize" | "total" | "from" | "to" | "setPage" | "setPageSize"
>) {
  const t = useTranslations("doughSauce.common");
  if (total <= PAGE_SIZES[0]) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
      <span className="tabular-nums">{t("pageRange", { from, to, total })}</span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span>{t("perPage")}</span>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="h-7 w-16 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            aria-label={t("prevPage")}
          >
            <ChevronLeft className="h-3.5 w-3.5 rtl:-scale-x-100" />
          </Button>
          <span className="min-w-14 text-center tabular-nums">{t("pageOf", { page, count: pageCount })}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
            aria-label={t("nextPage")}
          >
            <ChevronRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── PNG export ────────────────────────────────────────────────────────── */

export async function exportNodeAsPng(node: HTMLElement, filename: string) {
  const { toPng } = await import("html-to-image");
  const bg = getComputedStyle(node).backgroundColor || "#ffffff";
  const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: bg, cacheBust: true });
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
