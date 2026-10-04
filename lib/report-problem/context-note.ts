import type { TargetKind } from "./attributes";
import type { SectionSource } from "./candidates";

/* ────────────────────────────────────────────────────────────────────────── */
/*  The automatic note attached to every report. Fixed English `key: value`  */
/*  lines — it's read by whoever fixes the problem, searched, and pasted     */
/*  into bug reports, so it doesn't follow the reporter's UI language.       */
/*  Never contains page TEXT beyond the picked part's own label. Kept short  */
/*  on purpose — the screenshot rides on this note, so it needs no mention.  */
/* ────────────────────────────────────────────────────────────────────────── */

export interface ContextNoteInput {
  pageLabel: string;
  pathname: string;
  search: string;
  kind: TargetKind;
  label: string;
  id: string | null;
  sectionKey: string;
  /** Where the area came from — or "reporter" when they changed it by hand. */
  sectionSource: SectionSource | "reporter";
  /** The key the pick asked for, when it isn't set up and General was used instead. */
  wantedSectionKey?: string | null;
  store: { code: string; name: string | null } | null;
  viewport: { width: number; height: number; dpr: number };
  theme: string;
  locale: string;
  dir: string;
  layoutVariant: string;
  sidebarCollapsed: boolean;
  pickedAt: Date;
  impersonating: boolean;
}

const NOTE_MAX = 10_000;
const SENSITIVE_PARAM = /token|secret|password|passwd|auth|signature|sig$|key$/i;

/** Drops query params that might carry credentials; keeps the rest (dates, ids, tabs). */
export function sanitizeSearch(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const kept = new URLSearchParams();
  params.forEach((value, key) => {
    if (!SENSITIVE_PARAM.test(key)) kept.append(key, value);
  });
  const qs = kept.toString();
  return qs ? `?${qs}` : "";
}

function timeLine(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  let zone = "";
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    zone = "";
  }
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}` +
    ` (${zone ? `${zone}, ` : ""}UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)})`
  );
}

const SOURCE_TEXT: Record<SectionSource | "reporter", string> = {
  element: "set on the picked part",
  region: "set for this part of the app",
  page: "set for this page",
  fallback: "no area set for this page",
  reporter: "chosen by the reporter",
};

export function buildContextNote(c: ContextNoteInput): string {
  const lines = [
    "Reported with \"Report a problem\".",
    `Page: ${c.pageLabel} (${c.pathname}${sanitizeSearch(c.search)})`,
    `Picked: ${c.kind} · "${c.label}"${c.id ? ` (id: ${c.id})` : ""}`,
    c.wantedSectionKey
      ? `Area: ${c.sectionKey} (wanted ${c.wantedSectionKey}, which isn't set up yet)`
      : `Area: ${c.sectionKey} (${SOURCE_TEXT[c.sectionSource]})`,
    `Store: ${c.store ? `${c.store.code}${c.store.name ? ` · ${c.store.name}` : ""}` : "none selected"}`,
    `Screen: ${c.viewport.width}×${c.viewport.height} @${c.viewport.dpr}x · ${c.theme} theme · ${c.locale} (${c.dir}) · layout ${c.layoutVariant} · sidebar ${c.sidebarCollapsed ? "collapsed" : "expanded"}`,
    `Time: ${timeLine(c.pickedAt)}`,
  ];
  if (c.impersonating) lines.push("Impersonating: yes — filed under the impersonated account.");
  const note = lines.join("\n");
  return note.length > NOTE_MAX ? note.slice(0, NOTE_MAX) : note;
}
