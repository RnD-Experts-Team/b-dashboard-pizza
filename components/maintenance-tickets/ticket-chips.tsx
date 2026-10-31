"use client";

/**
 * The status and priority badges every ticket surface uses (tickets list,
 * ticket page, peek sheet, Dashboard V1 card, DSPR table, analytics, history
 * panels), and the shared dense-select skin. Colours come from
 * `status-accent.ts`; the words from the maintenance vocabulary, so a status
 * reads the same — in colour and in text — wherever it appears.
 */

import { ArrowDown, ArrowRight, ArrowUp, ChevronsUp, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ISSUE_STATUSES, PRIORITIES, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import type { Priority } from "@/types/maintenance-tickets.types";
import { knownPriority, PRIORITY_ACCENT, priorityAccent, statusAccent } from "./status-accent";

/**
 * House dropdown skin for the dense panels: a fixed 192px cap plus a thin
 * custom scrollbar. Deliberately denser than the app-wide 240px used
 * everywhere else.
 */
export const SELECT_CONTENT_CLS =
  "text-[11px] min-w-[100px] max-h-48 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40";

export type BadgeSize = "xs" | "sm" | "md";

const SIZE: Record<BadgeSize, { pill: string; dot: string; icon: string }> = {
  /** Dashboard cards (V1 / DSPR): 10px type. */
  xs: { pill: "gap-1 px-1.5 py-px text-[10px]", dot: "h-1.5 w-1.5", icon: "h-2.5 w-2.5" },
  /** Dense tables and history rows. */
  sm: { pill: "gap-1 px-1.5 py-0.5 text-[11px]", dot: "h-1.5 w-1.5", icon: "h-3 w-3" },
  /** The tickets list and the ticket page. */
  md: { pill: "gap-1.5 px-2 py-0.5 text-xs", dot: "h-2 w-2", icon: "h-3 w-3" },
};

const PILL = "inline-flex max-w-full items-center whitespace-nowrap rounded-full border font-medium leading-5";

/** A status: tinted fill, a dot in the status colour, and the word. */
export function StatusBadge({
  status,
  label,
  size = "md",
  className,
}: {
  status: string;
  /** The server's label, used when the status is not one this app knows. */
  label?: string;
  size?: BadgeSize;
  className?: string;
}) {
  const t = useTranslations("maintenanceSystem");
  const accent = statusAccent(status);
  const s = SIZE[size];
  return (
    <span className={cn(PILL, "border-transparent", s.pill, accent.pill, className)} data-slot="status-badge">
      <span className={cn("shrink-0 rounded-full", s.dot, accent.bar)} aria-hidden="true" />
      <span className="truncate">{vocabText(t, vocabEntry(ISSUE_STATUSES, status, label))}</span>
    </span>
  );
}

export const PRIORITY_ICON: Record<Priority, LucideIcon> = {
  urgent: ChevronsUp,
  high: ArrowUp,
  medium: ArrowRight,
  low: ArrowDown,
};

/** A priority: outlined, an arrow for its level, and the word. */
export function PriorityBadge({
  priority,
  label,
  size = "md",
  className,
}: {
  priority: string;
  label?: string;
  size?: BadgeSize;
  className?: string;
}) {
  const t = useTranslations("maintenanceSystem");
  const known = knownPriority(priority);
  const Icon = PRIORITY_ICON[known ?? "medium"];
  const s = SIZE[size];
  return (
    <span className={cn(PILL, s.pill, known ? PRIORITY_ACCENT[known].pill : "border-border bg-card text-foreground", className)} data-slot="priority-badge">
      <Icon className={cn("shrink-0", s.icon)} aria-hidden="true" />
      <span className="truncate">{vocabText(t, vocabEntry(PRIORITIES, priority, label))}</span>
    </span>
  );
}

/** Kept for the history panels: the same badge as everywhere else, dense. */
export function StatusChip({ value, label }: { value: string; label: string }) {
  return <StatusBadge status={value} label={label} size="sm" />;
}

/** Solid dot colour per priority (for pickers that show a dot next to the word). */
export const PRIORITY_DOT_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(PRIORITY_ACCENT).map(([k, v]) => [k, v.bar]),
);

/** A priority as "Priority: ● High" in running text (trip stops, pickers). */
export function PriorityChip({ value, label, prefix = "Priority:" }: { value: string; label: string; prefix?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {prefix ? <span className="font-medium text-foreground/70">{prefix}</span> : null}
      <span className={cn("h-2 w-2 shrink-0 rounded-full", priorityAccent(value).bar)} aria-hidden="true" />
      <span className={cn(knownPriority(value) && value !== "low" ? priorityAccent(value).text : undefined)}>{label}</span>
    </span>
  );
}
