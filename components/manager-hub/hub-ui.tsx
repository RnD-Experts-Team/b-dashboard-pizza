"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Lock, RefreshCw, Search, WifiOff, X, XCircle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { addDaysIso } from "@/lib/dough-sauce/dates";
import { formatDateOnly, formatDateOnlyWithWeekday } from "@/lib/utils/date-display";
import type { HubError } from "@/lib/hooks/use-manager-hub";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Manager Hub primitives — calm, neutral surfaces; colour only where it    */
/*  carries meaning, always paired with an icon or a number:                  */
/*    yellow = still to do · red = overdue/missed · everything else neutral   */
/*  ("good" and "info" stay as names so call sites read naturally, but they  */
/*  render neutral — the hub deliberately uses no green or blue.)            */
/* ────────────────────────────────────────────────────────────────────────── */

export type Tone = "good" | "warn" | "bad" | "info" | "muted";

export const TONE_TEXT: Record<Tone, string> = {
  good: "text-muted-foreground",
  warn: "text-yellow-700 dark:text-yellow-400",
  bad: "text-red-600 dark:text-red-400",
  info: "text-muted-foreground",
  muted: "text-muted-foreground",
};

export const TONE_SOFT: Record<Tone, string> = {
  good: "bg-muted",
  warn: "bg-yellow-500/15 dark:bg-yellow-500/20",
  bad: "bg-red-500/15 dark:bg-red-500/20",
  info: "bg-muted",
  muted: "bg-muted",
};

export const TONE_BAR: Record<Tone, string> = {
  good: "bg-muted-foreground/40",
  warn: "bg-yellow-500",
  bad: "bg-red-500",
  info: "bg-muted-foreground/40",
  muted: "bg-muted-foreground/40",
};

export const TONE_BORDER_START: Record<Tone, string> = {
  good: "border-s-border",
  warn: "border-s-yellow-500",
  bad: "border-s-red-500",
  info: "border-s-border",
  muted: "border-s-border",
};

/** Neutral pill for a debrief type — the shared DebriefTypeBadge is orange. */
export function TypePill({ label }: { label: string }) {
  return (
    <span className="inline-flex h-5 shrink-0 items-center rounded-md border bg-muted/50 px-1.5 text-[10px] font-medium text-foreground">
      {label}
    </span>
  );
}

/** Tab-panel / swapped-content entrance, same as the store-passport tabs. */
export const HUB_ENTER =
  "animate-in fade-in-0 slide-in-from-bottom-1 animation-duration-200 ease-out motion-reduce:animate-none";

/* ── Count pill ──────────────────────────────────────────────────────────── */

export function CountPill({
  value,
  tone = "muted",
  className,
}: {
  value: number | string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums transition-colors",
        TONE_SOFT[tone],
        tone === "muted" ? "text-muted-foreground" : TONE_TEXT[tone],
        className,
      )}
    >
      {value}
    </span>
  );
}

/* ── Section card ────────────────────────────────────────────────────────── */

export function SectionCard({
  icon: Icon,
  title,
  subtitle,
  count,
  countTone,
  actions,
  children,
  className,
  bodyClassName,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  count?: number | string;
  countTone?: Tone;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      data-report-target="card"
      data-report-label={title}
      className={cn("flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card", className)}
    >
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-heading text-sm font-semibold">{title}</h2>
            {count != null && <CountPill value={count} tone={countTone} />}
          </div>
          {subtitle && <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </header>
      <div className={cn("min-w-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ── Segmented filter (cleaning Due tab look) ────────────────────────────── */

export function SegmentedFilter<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string; count?: number; tone?: Tone }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("flex w-full gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1 sm:w-auto", className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:flex-none",
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="truncate">{opt.label}</span>
            {opt.count != null && (
              <CountPill value={opt.count} tone={opt.count > 0 ? (opt.tone ?? "muted") : "muted"} />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Filter chips (tags, debrief types, ranges) ──────────────────────────── */

export function FilterChip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {children}
      {count != null && (
        <span className={cn("tabular-nums", active ? "opacity-80" : "text-muted-foreground/80")}>{count}</span>
      )}
    </button>
  );
}

export function ChipRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5", className)}>{children}</div>;
}

/* ── Search ──────────────────────────────────────────────────────────────── */

/** Debounced search box — the inline Search-icon + Input pattern, plus clear/Escape. */
export function HubSearch({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const t = useTranslations("managerHub");
  const [draft, setDraft] = useState(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => onChangeRef.current(draft), 250);
    return () => clearTimeout(timer);
  }, [draft, value]);

  const clear = () => {
    setDraft("");
    onChange("");
  };

  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search
        className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && draft) {
            e.preventDefault();
            clear();
          }
          if (e.key === "Enter") onChange(draft);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 ps-8 pe-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          onClick={clear}
          aria-label={t("search.clear")}
          className="absolute end-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground animate-in fade-in-0 zoom-in-95"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/* ── Rows ────────────────────────────────────────────────────────────────── */

/**
 * A list row: the whole row opens the detail (stretched button), the trailing
 * slot (status + quick action) sits above it and stays separately clickable.
 */
export function HubRow({
  tone,
  icon: Icon,
  title,
  meta,
  excerpt,
  trailing,
  onOpen,
  openLabel,
}: {
  tone: Tone;
  icon?: LucideIcon;
  title: React.ReactNode;
  meta?: React.ReactNode;
  /** A line or two of free text (notes) under the meta line. */
  excerpt?: string | null;
  trailing?: React.ReactNode;
  onOpen: () => void;
  openLabel: string;
}) {
  return (
    <li className="group relative flex min-w-0 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40 has-[>button:focus-visible]:bg-muted/40 animate-in fade-in-0 motion-reduce:animate-none">
      <span className={cn("h-8 w-1 shrink-0 self-center rounded-full", TONE_BAR[tone])} aria-hidden="true" />
      {Icon && (
        <span
          className={cn("hidden h-7 w-7 shrink-0 items-center justify-center rounded-md sm:flex", TONE_SOFT[tone])}
          aria-hidden="true"
        >
          <Icon className={cn("h-3.5 w-3.5", TONE_TEXT[tone])} />
        </span>
      )}
      <button
        type="button"
        onClick={onOpen}
        aria-label={openLabel}
        className="min-w-0 flex-1 text-start outline-none after:absolute after:inset-0 after:content-['']"
      >
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        {meta && (
          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {meta}
          </span>
        )}
        {excerpt && (
          <span className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground/90">{excerpt}</span>
        )}
      </button>
      {trailing && <div className="relative z-10 flex shrink-0 items-center gap-1.5">{trailing}</div>}
    </li>
  );
}

export function HubList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <ul className={cn("divide-y divide-border/60", className)}>{children}</ul>;
}

/** Thin dot-separated meta item that never wraps mid-phrase. */
export function Meta({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex min-w-0 items-center gap-1 truncate", className)}>{children}</span>;
}

/* ── Day headings ────────────────────────────────────────────────────────── */

export function useDayLabel() {
  const t = useTranslations("managerHub.days");
  return (date: string, anchor: string): { primary: string; secondary: string } => {
    const full = formatDateOnlyWithWeekday(date);
    if (date === anchor) return { primary: t("today"), secondary: full };
    if (date === addDaysIso(anchor, -1)) return { primary: t("yesterday"), secondary: full };
    for (let n = 2; n <= 31; n++) {
      if (date === addDaysIso(anchor, -n)) return { primary: full, secondary: t("daysAgo", { count: n }) };
    }
    return { primary: full, secondary: formatDateOnly(date) };
  };
}

export function DayHeading({
  date,
  anchor,
  count,
  tone = "muted",
  action,
}: {
  date: string;
  anchor: string;
  count?: number;
  tone?: Tone;
  action?: React.ReactNode;
}) {
  const label = useDayLabel()(date, anchor);
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-card/95 px-4 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{label.primary}</span>
      <span className="truncate text-[11px] text-muted-foreground">{label.secondary}</span>
      {count != null && <CountPill value={count} tone={tone} />}
      {action && <span className="ms-auto shrink-0">{action}</span>}
    </div>
  );
}

/* ── States ──────────────────────────────────────────────────────────────── */

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border/60" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-8 w-1 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-6 w-16 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function HubEmpty({
  icon: Icon,
  title,
  body,
  tone = "muted",
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  tone?: Tone;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "m-3 flex flex-col items-center justify-center gap-2.5 rounded-lg border border-dashed px-4 py-10 text-center animate-in fade-in-0 motion-reduce:animate-none",
        className,
      )}
    >
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-full", TONE_SOFT[tone])}>
        <Icon className={cn("h-5 w-5", TONE_TEXT[tone])} aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {body && <p className="mx-auto max-w-sm text-xs text-muted-foreground">{body}</p>}
      </div>
      {action}
    </div>
  );
}

const NO_RETRY = new Set(["FORBIDDEN", "NOT_AUTHENTICATED", "UNAUTHORIZED"]);

function errorKind(code: string): "forbidden" | "auth" | "network" | "timeout" | "server" | "notFound" | "generic" {
  switch (code) {
    case "FORBIDDEN":
      return "forbidden";
    case "NOT_AUTHENTICATED":
    case "UNAUTHORIZED":
      return "auth";
    case "NETWORK_ERROR":
      return "network";
    case "TIMEOUT":
      return "timeout";
    case "SERVER_ERROR":
      return "server";
    case "NOT_FOUND":
      return "notFound";
    default:
      return "generic";
  }
}

/** A section that failed to load: what happened in plain words + the server's own message. */
export function HubErrorState({ error, onRetry }: { error: HubError; onRetry?: () => void }) {
  const t = useTranslations("managerHub.errors");
  const kind = errorKind(error.code);
  const Icon = kind === "forbidden" || kind === "auth" ? Lock : kind === "network" ? WifiOff : AlertTriangle;
  return (
    <div
      role="alert"
      className="m-3 flex flex-col items-center gap-2.5 rounded-lg border border-destructive/40 px-4 py-8 text-center animate-in fade-in-0 motion-reduce:animate-none"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
        <Icon className="h-5 w-5 text-destructive" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-destructive">{t(`${kind}.title`)}</p>
        <p className="mx-auto max-w-sm text-xs text-muted-foreground">{t(`${kind}.body`)}</p>
      </div>
      {error.message && (
        <p className="mx-auto max-w-md break-words rounded-md bg-muted/60 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
          {error.message}
          {error.code !== "UNKNOWN" && <span className="ms-1.5 opacity-70">· {error.code}</span>}
        </p>
      )}
      {onRetry && !NO_RETRY.has(error.code) && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          {t("retry")}
        </Button>
      )}
    </div>
  );
}

/**
 * One-line error above content that is still shown: a background refresh that
 * failed over older data ("refresh"), or one source of a merged list that never
 * loaded while the other did ("partial").
 */
export function HubInlineError({
  error,
  onRetry,
  mode = "refresh",
}: {
  error: HubError;
  onRetry?: () => void;
  mode?: "refresh" | "partial";
}) {
  const t = useTranslations("managerHub.errors");
  return (
    <div
      role="alert"
      className="mx-3 mt-3 flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive animate-in fade-in-0 slide-in-from-top-1 motion-reduce:animate-none"
    >
      <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 break-words">{t(mode === "partial" ? "partialFailed" : "refreshFailed", { message: error.message })}</span>
      {onRetry && !NO_RETRY.has(error.code) && (
        <Button variant="outline" size="sm" className="h-7" onClick={onRetry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}

/**
 * Standard section body switch: loading → error → (inline error +) content.
 * `isEmpty` content is the caller's own empty state, passed as children.
 */
export function SectionBody({
  loading,
  error,
  hasData,
  onRetry,
  skeletonRows,
  children,
}: {
  loading: boolean;
  error: HubError | null;
  hasData: boolean;
  onRetry: () => void;
  skeletonRows?: number;
  children: React.ReactNode;
}) {
  if (loading && !hasData) return <ListSkeleton rows={skeletonRows} />;
  if (error && !hasData) return <HubErrorState error={error} onRetry={onRetry} />;
  return (
    <>
      {error && <HubInlineError error={error} onRetry={onRetry} />}
      {children}
    </>
  );
}
