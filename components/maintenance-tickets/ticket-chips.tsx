"use client";

/**
 * Status and priority chips, and the shared dense-select skin.
 *
 * Extracted verbatim from ticket-detail-sheet.tsx, which had grown to 4,424
 * lines with thirteen module-private panels inside it. Nothing here changed on
 * the way out -- the point of the move is that the new ticket page can compose
 * the same pieces instead of a second copy of them being written.
 */

import { cn } from "@/lib/utils";
import { statusAccent } from "./status-accent";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Color-coded chips                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * House dropdown skin for this sheet: a fixed 192px cap plus a thin custom
 * scrollbar. Deliberately denser than the app-wide 240px used everywhere else —
 * this is the compact text-[11px] navigator/panel skin, and consistency WITHIN
 * a skin beats consistency across skins.
 *
 * Module-scoped so every panel in the file can reach it; it used to live inside
 * TicketNavigator, which is why three selects further down had no cap at all.
 */
export const SELECT_CONTENT_CLS =
  "text-[11px] min-w-[100px] max-h-48 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40";

export function StatusChip({ value, label }: { value: string; label: string }) {
  const accent = statusAccent(value);
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-card px-1.5 py-0.5">
      <span className={cn("h-2.5 w-1 shrink-0 rounded-full", accent.bar)} />
      <span className={cn("text-[11px] font-semibold uppercase tracking-wide", accent.text)}>
        {label}
      </span>
    </span>
  );
}

/** Priority levels: urgent = Emergency (store cannot operate), high = affects operations,
 *  medium = Normal (store can operate), low = cosmetic. Colors mirror that severity order. */
export const PRIORITY_DOT_COLORS: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
};

export function PriorityChip({ value, label, prefix = "Priority:" }: { value: string; label: string; prefix?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/70">{prefix}</span>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", PRIORITY_DOT_COLORS[value] ?? "bg-muted-foreground/40")} />
      {label}
    </span>
  );
}

