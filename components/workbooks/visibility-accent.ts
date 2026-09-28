/* ────────────────────────────────────────────────────────────────────────── */
/*  Visibility tag colours — same dash-and-label vocabulary as               */
/*  components/maintenance-tickets/status-accent.ts.                         */
/*                                                                            */
/*  Colour follows the AUDIENCE (who can see it); the Eye / Pencil icon on   */
/*  the chip carries view-vs-edit. Keyed by prefix so a tag added to the     */
/*  catalogue later still lands in the right family.                         */
/* ────────────────────────────────────────────────────────────────────────── */

export interface VisibilityAccent {
  bar: string;
  text: string;
  /** Soft fill for the selected radio card in the editor. */
  soft: string;
}

const OWNER: VisibilityAccent = {
  bar: "bg-purple-500",
  text: "text-purple-700 dark:text-purple-400",
  soft: "border-purple-500/40 bg-purple-500/10 dark:bg-purple-500/15",
};
const STORE: VisibilityAccent = {
  bar: "bg-blue-500",
  text: "text-blue-700 dark:text-blue-400",
  soft: "border-blue-500/40 bg-blue-500/10 dark:bg-blue-500/15",
};
const ROLES: VisibilityAccent = {
  bar: "bg-amber-500",
  text: "text-amber-700 dark:text-amber-400",
  soft: "border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/15",
};
const ALL: VisibilityAccent = {
  bar: "bg-green-500",
  text: "text-green-700 dark:text-green-400",
  soft: "border-green-500/40 bg-green-500/10 dark:bg-green-500/15",
};
const FALLBACK: VisibilityAccent = {
  bar: "bg-muted-foreground/40",
  text: "text-foreground",
  soft: "border-primary/40 bg-primary/5",
};

export function visibilityAccent(value: string): VisibilityAccent {
  if (value === "owner_only") return OWNER;
  if (value.startsWith("store_role")) return ROLES;
  if (value.startsWith("store_")) return STORE;
  if (value.startsWith("all_stores")) return ALL;
  return FALLBACK;
}

/** View-only vs editable, by the tag's suffix. The catalogue's `grants_edit` wins when known. */
export function tagGrantsEdit(value: string, grantsEdit?: boolean): boolean {
  if (typeof grantsEdit === "boolean") return grantsEdit;
  return value === "owner_only" || value.endsWith("_edit");
}
