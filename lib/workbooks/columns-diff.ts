import type { ColumnDraftPayload, ColumnTypeOption, WorkbookColumn } from "@/types/workbooks.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Column editor model — pure.                                              */
/*                                                                            */
/*  The columns endpoint is a WHOLE-LIST replace: keep = send the id, add =  */
/*  omit the id, delete = omit the column (and its cells go with it, for     */
/*  good). This file works out what a submit would destroy so the UI can     */
/*  say so before sending.                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ColumnDraft {
  /** Client-only stable key for React + dnd-kit. */
  key: string;
  /** Present for an existing column. */
  id?: number;
  name: string;
  type: string;
  required: boolean;
  options: string[];
}

let _seq = 0;
export function newDraftKey(): string {
  _seq += 1;
  return `new-${Date.now().toString(36)}-${_seq}`;
}

export function draftsFromColumns(columns: WorkbookColumn[]): ColumnDraft[] {
  return columns.map((c) => ({
    key: `col-${c.id}`,
    id: c.id,
    name: c.name,
    type: c.type,
    required: c.required,
    options: c.options ?? [],
  }));
}

export function blankDraft(type = "text"): ColumnDraft {
  return { key: newDraftKey(), name: "", type, required: false, options: [] };
}

/** Existing columns missing from the draft list — these will be DELETED. */
export function removedColumns(original: WorkbookColumn[], drafts: ColumnDraft[]): WorkbookColumn[] {
  const kept = new Set(drafts.filter((d) => d.id != null).map((d) => d.id));
  return original.filter((c) => !kept.has(c.id));
}

export function needsOptions(type: string, types: ColumnTypeOption[]): boolean {
  return types.find((t) => t.value === type)?.needsOptions ?? type === "select";
}

/**
 * Per-draft problems, as i18n keys under `workbooks.columns.errors`.
 * Only structural checks the server would also refuse — nothing clever.
 */
export function validateDrafts(
  drafts: ColumnDraft[],
  types: ColumnTypeOption[],
): { byKey: Record<string, string>; form: string | null } {
  const byKey: Record<string, string> = {};
  if (drafts.length === 0) return { byKey, form: "atLeastOne" };

  const seen = new Map<string, string>();
  for (const d of drafts) {
    const name = d.name.trim();
    if (!name) {
      byKey[d.key] = "nameRequired";
      continue;
    }
    const lower = name.toLowerCase();
    if (seen.has(lower)) {
      byKey[d.key] = "duplicateName";
      continue;
    }
    seen.set(lower, d.key);
    if (needsOptions(d.type, types) && d.options.filter((o) => o.trim()).length === 0) {
      byKey[d.key] = "optionsRequired";
    }
  }
  return { byKey, form: null };
}

/** Existing columns send id + name + required (+ options); the type is fixed once created. */
export function toColumnPayload(drafts: ColumnDraft[], types: ColumnTypeOption[]): ColumnDraftPayload[] {
  return drafts.map((d) => {
    const base: ColumnDraftPayload = { name: d.name.trim(), required: d.required };
    if (d.id != null) base.id = d.id;
    else base.type = d.type;
    if (needsOptions(d.type, types)) {
      base.options = Array.from(new Set(d.options.map((o) => o.trim()).filter(Boolean)));
    }
    return base;
  });
}

/** Map a server 422 key like "columns.2.name" back onto a draft key. */
export function draftKeyForErrorField(field: string, drafts: ColumnDraft[]): string | null {
  const m = field.match(/^columns\.(\d+)/);
  if (!m) return null;
  return drafts[Number(m[1])]?.key ?? null;
}
