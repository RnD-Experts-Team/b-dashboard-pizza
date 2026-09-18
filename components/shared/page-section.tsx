"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The page rhythm.
 *
 * THE PROBLEM. Every block on these pages was `rounded-lg border bg-card`.
 * Scrolling, there was nothing to tell you which block you were looking at, so
 * finding a control meant reading the whole page again each time.
 *
 * THE IDEA, from the person who uses this: piano keys. Every white key is
 * identical -- you cannot tell C from F by looking at one. What makes a
 * keyboard navigable is the black keys grouping into TWO then THREE. Because
 * that pattern is asymmetric, any local view tells you where you are globally.
 * An alternating pattern would not: it looks the same from everywhere.
 *
 * So sections come in a group of two, a heavier break, then a group of three --
 * and rank is carried by THREE dimensions moving together. One dimension alone
 * reads as an accident; three together read as a rule.
 *
 *   primary    raised, roomy, accent bar + tinted icon   the thing you came for
 *   secondary  flat, normal, hairline only               supporting detail
 *   tertiary   borderless, tight, tinted ground          reference and history
 *
 * ON COLOUR. The theme exposes 28 tokens and they are all greys, except
 * `--destructive` and `--chart-1..5`. Themes are swapped at runtime by writing
 * those same names onto the document, so a hardcoded hue stops following the
 * user's theme -- which is why `components/dashboard-v1/category.ts` cannot be
 * reused here as-is. The five chart ramps are the only themeable hues we have,
 * and five section identities is enough.
 */

export type SectionRank = "primary" | "secondary" | "tertiary";

/** One of the five themeable ramps. Not a meaning -- an identity, so a section
 *  is recognisable at a glance and stays recognisable when the theme changes. */
export type SectionAccent = 1 | 2 | 3 | 4 | 5;

const ACCENT_BAR: Record<SectionAccent, string> = {
  1: "border-s-[var(--color-chart-1)]",
  2: "border-s-[var(--color-chart-2)]",
  3: "border-s-[var(--color-chart-3)]",
  4: "border-s-[var(--color-chart-4)]",
  5: "border-s-[var(--color-chart-5)]",
};

const ACCENT_ICON: Record<SectionAccent, string> = {
  1: "bg-[var(--color-chart-1)]/15 text-[var(--color-chart-1)]",
  2: "bg-[var(--color-chart-2)]/15 text-[var(--color-chart-2)]",
  3: "bg-[var(--color-chart-3)]/15 text-[var(--color-chart-3)]",
  4: "bg-[var(--color-chart-4)]/15 text-[var(--color-chart-4)]",
  5: "bg-[var(--color-chart-5)]/15 text-[var(--color-chart-5)]",
};

const RANK_SHELL: Record<SectionRank, string> = {
  // Raised and roomy. The accent bar is a LOGICAL border (border-s), so it sits
  // on the correct side when the app is in Arabic.
  primary: "rounded-xl border border-s-2 bg-card p-4 shadow-sm",
  secondary: "rounded-lg border bg-card p-3",
  // No border at all -- the absence is the signal. Reference, not content.
  tertiary: "rounded-lg bg-muted/20 p-2.5",
};

const RANK_TITLE: Record<SectionRank, string> = {
  primary: "font-heading text-sm font-semibold",
  secondary: "font-heading text-sm font-medium",
  tertiary: "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
};

export interface PageSectionProps {
  rank?: SectionRank;
  /** Ignored on anything but `primary` -- if every rank were accented, the
   *  accent would stop meaning "this is the important one". */
  accent?: SectionAccent;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  /** Right-hand slot in the header: a button, a count, a toggle. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** For `aria-labelledby` on the section. */
  id?: string;
}

export function PageSection({
  rank = "secondary",
  accent = 1,
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  id,
}: PageSectionProps) {
  const isPrimary = rank === "primary";
  const hasHeader = Boolean(title || action);

  return (
    <section
      id={id}
      className={cn(
        RANK_SHELL[rank],
        isPrimary && ACCENT_BAR[accent],
        className
      )}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            // Only the primary earns a rule under its header. Putting one on
            // every rank would flatten the hierarchy again.
            isPrimary ? "mb-3 border-b pb-2.5" : "mb-2"
          )}
        >
          {Icon && isPrimary && (
            <span className={cn("flex h-6 w-6 items-center justify-center rounded-md", ACCENT_ICON[accent])}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          )}
          {Icon && !isPrimary && (
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}

          {title && <h2 className={RANK_TITLE[rank]}>{title}</h2>}

          {description && (
            <span className="text-xs text-muted-foreground">{description}</span>
          )}

          {action && <span className="ms-auto flex items-center gap-2">{action}</span>}
        </div>
      )}

      {children}
    </section>
  );
}

/**
 * The gap between the group of two and the group of three.
 *
 * Deliberately heavier than the space between sections within a group -- that
 * difference IS the landmark. A rule of the same weight everywhere would tell
 * you nothing, which is the state we are leaving.
 */
export function SectionBreak({ className }: { className?: string }) {
  return (
    <div
      role="presentation"
      className={cn("my-6 h-px bg-border", className)}
    />
  );
}

/**
 * Wraps a run of sections so the spacing within a group is visibly tighter than
 * the break between groups. Two-then-three is the caller's job; this just keeps
 * the inner rhythm consistent.
 */
export function SectionGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-3", className)}>{children}</div>;
}
