/* ────────────────────────────────────────────────────────────────────────── */
/*  Daily Pay — aggregation warning copy                                     */
/*                                                                            */
/*  Every payment returns what the gather could not make sense of. NONE of it */
/*  blocks anything — a person decides. So this module produces advisory copy */
/*  and never a fix action.                                                   */
/*                                                                            */
/*  `context` comes from a source we do not control, so every lookup here is  */
/*  guarded and every unknown code degrades to readable text rather than      */
/*  vanishing from the panel.                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

import type { DailyPayAggregationWarning } from "@/types/daily-pay.types";

/** Codes for half-filled clock pairs carry a `:<bucket>` suffix. */
export interface ParsedWarningCode {
  base: string;
  /** "work" | "travel" | "break" | "parts_run", or null for unsuffixed codes. */
  bucket: string | null;
}

export function parseWarningCode(code: string): ParsedWarningCode {
  const idx = code.indexOf(":");
  if (idx === -1) return { base: code, bucket: null };
  return { base: code.slice(0, idx), bucket: code.slice(idx + 1) || null };
}

/** "parts_run" → "Parts run" */
function humanise(value: string): string {
  const spaced = value.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Reads a context key defensively — it is `unknown`, from an external source. */
function ctxText(context: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = context[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return null;
}

/** Reads a context key expected to hold a list of record ids. */
function ctxIds(context: Record<string, unknown>, ...keys: string[]): number[] {
  for (const key of keys) {
    const value = context[key];
    if (Array.isArray(value)) {
      const ids = value.filter((v): v is number => typeof v === "number");
      if (ids.length) return ids;
    }
  }
  return [];
}

export interface WarningCopy {
  title: string;
  /** Optional second line, e.g. the ids involved. */
  detail?: string;
}

/**
 * Advisory copy for one warning, following the wording the backend suggested.
 * An unrecognised code renders as its humanised self — a new backend warning
 * should show up as text, not disappear.
 */
export function warningCopy(warning: DailyPayAggregationWarning): WarningCopy {
  const { base, bucket } = parseWarningCode(warning.code);
  const ctx = warning.context ?? {};
  const where = bucket ? ` (${humanise(bucket).toLowerCase()})` : "";

  switch (base) {
    case "overlapping_entries": {
      const ids = ctxIds(ctx, "attendance_entry_ids", "entry_ids", "ids");
      return {
        title: "Possible double-clock",
        detail: ids.length
          ? `Both were counted — check entries ${ids.map((id) => `#${id}`).join(" and ")}.`
          : "Two clock windows for the same person overlap. Both were counted.",
      };
    }
    case "entry_outside_date":
      return {
        title: "Entry recorded on a different date",
        detail: "Counted anyway — night shifts cross midnight.",
      };
    case "part_usage_spans_stores": {
      const store = ctxText(ctx, "store_number", "store", "store_id");
      return {
        title: store ? `Receipt spans stores — assigned to ${store}` : "Receipt spans stores",
        detail: "Attributed whole to the store with the most of its issues; never split.",
      };
    }
    case "already_claimed_same_date":
      return {
        title: "Already paid on this sheet",
        detail: "Another payment here already claimed that receipt, so it was skipped.",
      };
    case "claimed_on_other_entry": {
      const sheet = ctxText(ctx, "daily_pay_entry_id", "entry_id", "sheet_id");
      return {
        title: sheet ? `Also claimed on sheet #${sheet} — check` : "Also claimed on another sheet",
        detail: "Counted here, and flagged.",
      };
    }
    case "incomplete_pair":
      return { title: `Missing clock-out${where}`, detail: "Counted as zero." };
    case "inverted_pair":
      return { title: `Clock times are backwards${where}`, detail: "Counted as zero." };
    case "implausible_pair":
      return { title: `Over 24h — clamped${where}`, detail: "Clamped to 24 hours." };
    default:
      // Unknown code: show it rather than swallowing it.
      return { title: humanise(base) + where };
  }
}
