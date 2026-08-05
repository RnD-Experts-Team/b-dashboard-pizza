"use client";

/* eslint-disable @next/next/no-img-element -- lightbox image is served via the
   same-origin /cleaning-storage proxy; next/image remote config is unnecessary. */

import { useState } from "react";
import Image from "next/image";
import { ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DueStatus, ItemValue, ChartVerdict } from "@/types/cleaning.types";

/** Shared table cell border — matches across Evaluation and Reports. */
export const cellBorder = "border-e border-border/70";
/** Shared table header cell classes. */
export const headerCell = "px-3 py-2 text-[11px] font-bold uppercase tracking-wide";

/**
 * Format an API date/datetime to a plain `YYYY-MM-DD`.
 * Handles bare dates and ISO datetimes ("2026-08-02T00:00:00.000000Z").
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/*
 * Resolve a photo path from the API into a loadable URL.
 * Relative `/storage/...` paths are routed through the same-origin
 * `/cleaning-storage/...` rewrite (see next.config.ts) so they stay same-origin.
 */
export function resolvePhotoUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  // `/storage/cleaning/x.jpg` → `/cleaning-storage/cleaning/x.jpg`
  if (normalized.startsWith("/storage/")) {
    return normalized.replace(/^\/storage\//, "/cleaning-storage/");
  }
  return `/cleaning-storage${normalized}`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Shared accent tokens — same recipe as components/maintenance-tickets/     */
/*  status-accent.ts: a small solid colour bar + coloured text, no filled     */
/*  background. Keeps the UI low on saturated colour ("less colors") while    */
/*  still reading clearly at a glance.                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export interface CleaningAccent {
  /** Solid fill for the small colour dash. */
  bar: string;
  /** Foreground colour for the label/value text. */
  text: string;
}

const DUE_STATUS_ACCENT: Record<DueStatus, CleaningAccent> = {
  pending: { bar: "bg-yellow-500", text: "text-yellow-700 dark:text-yellow-400" },
  done: { bar: "bg-green-500", text: "text-green-700 dark:text-green-400" },
  overdue: { bar: "bg-red-500", text: "text-red-700 dark:text-red-400" },
};
const STATUS_LABEL: Record<DueStatus, string> = {
  pending: "Pending",
  done: "Done",
  overdue: "Overdue",
};

/** Small accent-bar + text badge, matching the Maintenance Tickets status pill. */
export function AccentBadge({
  accent,
  label,
  className,
}: {
  accent: CleaningAccent;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1",
        className
      )}
    >
      <span className={cn("h-3 w-1 shrink-0 rounded-full", accent.bar)} />
      <span className={cn("text-[11px] font-semibold uppercase tracking-wide", accent.text)}>
        {label}
      </span>
    </span>
  );
}

export function StatusPill({ status }: { status: DueStatus }) {
  return <AccentBadge accent={DUE_STATUS_ACCENT[status]} label={STATUS_LABEL[status]} />;
}

/* ── Evaluation / report value accents (Pass · Fail · Auto · Empty) ── */
export const VALUE_ACCENT: Record<ItemValue, CleaningAccent> = {
  pass: { bar: "bg-green-500", text: "text-green-700 dark:text-green-400" },
  fail: { bar: "bg-red-500", text: "text-red-700 dark:text-red-400" },
  auto_fail: { bar: "bg-foreground/70", text: "text-foreground" },
  empty: { bar: "bg-muted-foreground/40", text: "text-muted-foreground" },
};
export const ITEM_VALUE_LABEL: Record<ItemValue, string> = {
  pass: "Pass",
  fail: "Fail",
  auto_fail: "Auto",
  empty: "—",
};

/** Chart verdicts reuse the same three accents (no "empty" state). */
export const VERDICT_ACCENT: Record<ChartVerdict, CleaningAccent> = {
  pass: VALUE_ACCENT.pass,
  fail: VALUE_ACCENT.fail,
  auto_fail: VALUE_ACCENT.auto_fail,
};

/**
 * Pass/Fail/Auto badge — display or interactive (pass an onClick). The same
 * compact pill renders identically wherever it's used (Evaluation grid,
 * Reports table) so the two pages read as one system.
 *
 * "Empty" is intentionally NOT a coloured badge — there's nothing to signal —
 * so it renders as a plain muted dash with no bar and no border.
 */
export function ValueBadge({
  value,
  onClick,
  disabled,
  className,
}: {
  value: ItemValue;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  if (value === "empty") {
    if (!onClick) {
      return (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-lg border bg-card px-2 py-1 text-muted-foreground/40",
            className
          )}
        >
          —
        </span>
      );
    }
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "inline-flex h-full w-full items-center justify-center rounded-lg border bg-card text-muted-foreground/40 transition-colors hover:bg-muted/60 hover:text-muted-foreground disabled:opacity-50",
          className
        )}
      >
        —
      </button>
    );
  }

  const accent = VALUE_ACCENT[value];
  const content = (
    <>
      <span className={cn("h-3 w-1 shrink-0 rounded-full", accent.bar)} />
      <span className={cn("text-[11px] font-semibold uppercase tracking-wide", accent.text)}>
        {ITEM_VALUE_LABEL[value]}
      </span>
    </>
  );

  if (!onClick) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1",
          className
        )}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1 transition-colors hover:bg-muted/60 disabled:opacity-50",
        className
      )}
    >
      {content}
    </button>
  );
}

/**
 * Threshold-coloured percentage text — shared between Evaluation and Reports.
 *
 * - "passOnly" — green when passing (≥80%), plain otherwise (Reports: only
 *                the pass score is coloured; nothing is coloured red).
 * - "failOnly" — red only when clearly failing (<50%), plain otherwise
 *                (Evaluation: score columns stay white except for a fail).
 * - "plain"    — always plain foreground text, no color at all.
 */
export function ScoreText({
  pct,
  className,
  variant = "passOnly",
}: {
  pct: number;
  className?: string;
  variant?: "passOnly" | "failOnly" | "plain";
}) {
  const tone =
    variant === "plain"
      ? "text-foreground"
      : variant === "failOnly"
        ? pct < 50
          ? "text-red-600 dark:text-red-400"
          : "text-foreground"
        : pct >= 80
          ? "text-green-600 dark:text-green-400"
          : "text-foreground";
  return <span className={cn("font-semibold tabular-nums", tone, className)}>{pct}%</span>;
}

/**
 * Renders a plain muted "--" when the store hasn't been evaluated at all yet
 * (no inspection items scored AND no chart verdicts set) instead of a
 * misleading "0%" — a real 0% (something was scored and failed) still shows
 * as a real score via ScoreText.
 */
export function ScoreOrDash({
  pct,
  unevaluated,
  className,
  variant,
}: {
  pct: number;
  unevaluated: boolean;
  className?: string;
  variant?: "passOnly" | "failOnly" | "plain";
}) {
  if (unevaluated) {
    return <span className={cn("text-muted-foreground/40", className)}>--</span>;
  }
  return <ScoreText pct={pct} className={className} variant={variant} />;
}

/**
 * Full-screen image lightbox — built on the real Dialog primitive (not a
 * hand-rolled overlay) so it nests correctly inside a Sheet's own dismissable
 * layer stack (matches the pattern used by the inventory item-detail sheet).
 */
export function ImageLightbox({
  src,
  alt,
  open,
  onOpenChange,
}: {
  src: string;
  alt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-fit max-w-none border-0 bg-transparent p-0 shadow-none sm:max-w-none [&>button]:rounded-full [&>button]:bg-white/20 [&>button]:p-1.5 [&>button]:text-white [&>button]:hover:bg-white/30">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <img
          src={src}
          alt={alt}
          className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain shadow-2xl"
        />
      </DialogContent>
    </Dialog>
  );
}

/* ── Photo thumbnails (click to open the lightbox, like the inventory item sheet) ── */
export function PhotoThumbs({ photos }: { photos: string[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  if (!photos?.length) return null;

  const active = activeIndex != null ? photos[activeIndex] : null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => {
          const url = resolvePhotoUrl(p);
          return (
            <button
              key={`${p}-${i}`}
              type="button"
              onClick={() => setActiveIndex(i)}
              className="group relative h-16 w-16 overflow-hidden rounded-md border bg-muted"
            >
              {/* unoptimized: photos come from an external storage origin */}
              <Image
                src={url}
                alt={`Photo ${i + 1}`}
                fill
                unoptimized
                sizes="64px"
                className="object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-colors group-hover:bg-black/40 group-hover:opacity-100">
                <ZoomIn className="h-4 w-4 text-white" />
              </span>
            </button>
          );
        })}
      </div>

      {active && (
        <ImageLightbox
          src={resolvePhotoUrl(active)}
          alt="Task photo"
          open={activeIndex != null}
          onOpenChange={(o) => !o && setActiveIndex(null)}
        />
      )}
    </>
  );
}
