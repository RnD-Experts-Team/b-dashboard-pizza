/* ────────────────────────────────────────────────────────────────────────── */
/*  Daily Pay — revision snapshot parsing                                    */
/*                                                                            */
/*  Revisions carry a `schema_version`, and old snapshots are NEVER rewritten,*/
/*  so both shapes live in history permanently:                              */
/*                                                                            */
/*    1 → { date, lines: [...] }                       (pre-v2)              */
/*    2 → { date, payments: [{ …, lines: [...] }] }                          */
/*                                                                            */
/*  A renderer that assumes v2 shows every pre-migration revision as BLANK.   */
/*  That is the failure this module exists to prevent, so it never returns    */
/*  "nothing" — an unrecognised payload comes back tagged `unknown` and the    */
/*  viewer renders it as raw JSON.                                            */
/*                                                                            */
/*  Snapshots are raw snake_case API JSON and are deliberately NOT run through*/
/*  the service transformers: they hold ids rather than names, and decimals as*/
/*  strings. Resolve ids against the catalogs at the render site.             */
/* ────────────────────────────────────────────────────────────────────────── */

import type {
  ApiDailyPaySnapshotLineV1,
  ApiDailyPaySnapshotPaymentV2,
} from "@/types/daily-pay.types";

export type ParsedSnapshot =
  | { kind: "v1"; date: string | null; lines: ApiDailyPaySnapshotLineV1[] }
  | { kind: "v2"; date: string | null; payments: ApiDailyPaySnapshotPaymentV2[] }
  | { kind: "unknown"; raw: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readDate(snapshot: Record<string, unknown>): string | null {
  const date = snapshot.date;
  return typeof date === "string" ? date : null;
}

function readArray(snapshot: Record<string, unknown>, key: string): unknown[] | null {
  const value = snapshot[key];
  return Array.isArray(value) ? value : null;
}

/**
 * Parses one revision snapshot into a tagged shape the viewer can switch on.
 *
 * `schemaVersion` is authoritative when present. When it is null — rows written
 * before the column existed — the shape is inferred: a `payments` array means
 * v2, a `lines` array means v1. Anything else is `unknown`.
 *
 * A declared version that disagrees with the payload loses to the payload: a
 * snapshot claiming v2 while carrying `lines` still renders as v1, because
 * rendering the data we can actually see beats honouring a wrong label.
 */
export function parseRevisionSnapshot(
  schemaVersion: number | null,
  snapshot: unknown
): ParsedSnapshot {
  if (!isRecord(snapshot)) return { kind: "unknown", raw: snapshot };

  const date = readDate(snapshot);
  const payments = readArray(snapshot, "payments");
  const lines = readArray(snapshot, "lines");

  if (schemaVersion === 2 && payments) {
    return { kind: "v2", date, payments: payments as ApiDailyPaySnapshotPaymentV2[] };
  }
  if (schemaVersion === 1 && lines) {
    return { kind: "v1", date, lines: lines as ApiDailyPaySnapshotLineV1[] };
  }

  // No version, or a version that disagrees with the payload — infer from shape.
  if (payments) {
    return { kind: "v2", date, payments: payments as ApiDailyPaySnapshotPaymentV2[] };
  }
  if (lines) {
    return { kind: "v1", date, lines: lines as ApiDailyPaySnapshotLineV1[] };
  }

  return { kind: "unknown", raw: snapshot };
}

/**
 * Snapshot decimals are strings ("18.0000") or numbers, depending on how they
 * were serialised at the time. Parses either; returns null for anything else.
 */
export function snapshotNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/** The label to show for a revision row: "v1" / "v2" / "?" */
export function snapshotVersionLabel(parsed: ParsedSnapshot): string {
  if (parsed.kind === "v1") return "v1";
  if (parsed.kind === "v2") return "v2";
  return "?";
}
