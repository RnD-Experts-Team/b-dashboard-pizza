/* ────────────────────────────────────────────────────────────────────────── */
/*  "Report a problem" — the attribute contract between pages and the        */
/*  inspector. Pages describe themselves with these; the inspector never     */
/*  needs to know about any page's internals.                                */
/* ────────────────────────────────────────────────────────────────────────── */

export const ATTR = {
  /** Explicit target + kind. Beats a nearer generic match (e.g. a bare shadcn Card). */
  target: "data-report-target",
  /** Human label shown in the chip, the dialog and the ticket note. */
  label: "data-report-label",
  /** Stable id for engineers (falls back to `data-guide-id`). */
  id: "data-report-id",
  /** Routing override — the nearest ancestor wins. Value is an `area.page` section key. */
  section: "data-ticket-section",
  /** Our own overlay / dialog — never hit-tested, never captured. */
  ui: "data-report-ui",
  /** Temporary marker recording a scroll offset for the screenshot clone. */
  scroll: "data-rp-scroll",
} as const;

export type TargetKind =
  | "card"
  | "section"
  | "header"
  | "sidebar"
  | "topbar"
  | "bottomnav"
  | "floating"
  | "overlay";

/** Whole-block regions, in hit priority order (topmost layer first). */
export const REGION_KINDS = ["overlay", "floating", "bottomnav", "topbar", "sidebar"] as const;
export type RegionKind = (typeof REGION_KINDS)[number];

/**
 * How each region is found. The topbar and sidebar are Core files that are
 * NOT annotated; they're found through `data-font-scope="primary"`, which
 * only those two roots carry. Renaming that attribute (or the bottom nav's
 * id) silently makes the region unpickable — keep this map in sync.
 */
export const REGION_SELECTORS: Record<RegionKind, string> = {
  overlay: `[${ATTR.target}="overlay"]`,
  floating: `[${ATTR.target}="floating"]`,
  bottomnav: "#bottom-nav-bar",
  topbar: 'header[data-font-scope="primary"]',
  sidebar: '[data-font-scope="primary"]:not(header)',
};

/** Fixed-position chrome that a screenshot clone may drop without changing layout. */
export const OUT_OF_FLOW_SELECTOR = [
  REGION_SELECTORS.overlay,
  REGION_SELECTORS.floating,
  REGION_SELECTORS.bottomnav,
  "[data-sonner-toaster]",
].join(",");

export interface ReportAttrsInput {
  target?: TargetKind;
  label?: string | null;
  id?: string | null;
  section?: string | null;
}

/** Spread onto a JSX element: `<div {...reportAttrs({ target: "card", label: title })}>`. */
export function reportAttrs({ target, label, id, section }: ReportAttrsInput): Record<string, string> {
  const out: Record<string, string> = {};
  if (target) out[ATTR.target] = target;
  if (label) out[ATTR.label] = label;
  if (id) out[ATTR.id] = id;
  if (section) out[ATTR.section] = section;
  return out;
}

/** True for our own overlay / dialog nodes. */
export function isReportUi(node: Element | null): boolean {
  return Boolean(node?.closest?.(`[${ATTR.ui}]`));
}
