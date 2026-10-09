import {
  ATTR,
  REGION_KINDS,
  REGION_SELECTORS,
  isReportUi,
  type RegionKind,
  type TargetKind,
} from "./attributes";
import { containsPoint, isVisibleEl, sameBox, toBox, visibleChildren } from "./geometry";
import { cleanText, deriveLabel } from "./label";
import {
  FALLBACK_SECTION_KEY,
  REGION_SECTION_KEYS,
  type PickMode,
  type ReportPage,
} from "./pages";

/* ────────────────────────────────────────────────────────────────────────── */
/*  The candidate index: every part of the current screen that can be       */
/*  picked, built once per inspect session (and rebuilt when <main> changes).*/
/*                                                                            */
/*  Picking walks up from the element under the pointer to the first         */
/*  candidate — so the innermost allowed part wins:                          */
/*    • regions (PiP, debrief button, bottom bar, top bar, sidebar) whole;   */
/*    • "specific" pages (dashboards): single cards, then sections;          */
/*    • "general" pages: sections and headers only.                          */
/* ────────────────────────────────────────────────────────────────────────── */

export interface Candidate {
  el: Element;
  kind: TargetKind;
  /** Own label; "" when it has none. */
  label: string;
  /** Labels of the cards inside, for a section with no title of its own. */
  contents: string[];
  /** `data-report-id`, else `data-guide-id`. */
  id: string | null;
  /** Drawn as an outline. Coarse wrappers are pickable but not drawn. */
  outlined: boolean;
  /** The page root itself — the last resort, labelled "Whole page". */
  wholePage: boolean;
  /** Rect-fallback priority, lower first. */
  rank: number;
}

export interface CandidateIndex {
  mode: PickMode;
  main: HTMLElement | null;
  map: Map<Element, Candidate>;
  /** Outlined candidates in document order (keyboard cycling). */
  list: Candidate[];
}

const CARD_SELECTOR = `[${ATTR.target}="card"],[data-slot="card"]`;
const SECTION_SELECTOR = [
  "section",
  "aside",
  "nav",
  "form",
  '[role="tabpanel"]',
  '[data-slot="tabs-content"]',
  "[data-guide-id]",
].join(",");

export function isRegionKind(kind: TargetKind): kind is RegionKind {
  return (REGION_KINDS as readonly string[]).includes(kind);
}

/** Section-sized: wide enough to be a band of the page, or tall enough to be a column. */
function sectionSized(el: Element, rootW: number, mainH: number): boolean {
  const r = el.getBoundingClientRect();
  return (r.width >= 0.45 * rootW && r.height >= 40) || (r.height >= 0.5 * mainH && r.width >= 160);
}

/** A box that clips its content (a scroller) — the visible unit, never descend past it. */
function clipsContent(el: Element): boolean {
  const cs = getComputedStyle(el);
  return cs.overflowX !== "visible" || cs.overflowY !== "visible";
}

/**
 * Follow single-visible-child chains: wrapper > wrapper > the real thing.
 * Stops early where `stop` says so — at something already indexed (a V1
 * `<section>` must not hand over to the collapsible inside it) or at a
 * scroller (the schedule grid's scroll box, not the 2,500px table in it).
 */
function descendSingle(el: Element, stop?: (n: Element) => boolean): Element {
  let node = el;
  for (let i = 0; i < 10; i++) {
    if (stop?.(node)) break;
    const kids = visibleChildren(node);
    if (kids.length !== 1) break;
    node = kids[0];
  }
  return node;
}

/** `main > div` (the shell's width container), then down single-child wrappers. */
export function findPageRoot(main: Element): Element | null {
  const container = main.firstElementChild;
  return container ? descendSingle(container) : null;
}

/**
 * The page's top-level parts. A child that fills ≥80% of the page and has
 * ≥2 parts of its own is a wrapper (e.g. the dashboard view toggle around
 * the V1 dashboard) — use its children instead, up to three levels.
 */
function pageSections(
  root: Element,
  isIndexed: (el: Element) => boolean,
): { sections: Element[]; wrappers: Element[] } {
  const rootH = root.getBoundingClientRect().height || 1;
  const wrappers: Element[] = [];
  const stop = (n: Element) => isIndexed(n) || clipsContent(n);
  let level = visibleChildren(root).map((c) => descendSingle(c, stop));
  for (let depth = 0; depth < 3; depth++) {
    let changed = false;
    const next: Element[] = [];
    for (const k of level) {
      const kids = visibleChildren(k);
      const isWrapper =
        k.getBoundingClientRect().height >= 0.8 * rootH &&
        kids.length >= 2 &&
        !k.hasAttribute(ATTR.target) &&
        !k.matches('[data-slot="card"]');
      if (isWrapper) {
        wrappers.push(k);
        next.push(...kids.map((c) => descendSingle(c, stop)));
        changed = true;
      } else {
        next.push(k);
      }
    }
    level = next;
    if (!changed) break;
  }
  return { sections: level, wrappers };
}

function documentOrder(a: Candidate, b: Candidate): number {
  if (a.el === b.el) return 0;
  return a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

export function buildIndex(mode: PickMode): CandidateIndex {
  const map = new Map<Element, Candidate>();
  const main = document.querySelector("main");

  const add = (el: Element, kind: TargetKind, rank: number, extra: Partial<Candidate> = {}) => {
    if (map.has(el) || isReportUi(el)) return;
    map.set(el, {
      el,
      kind,
      label: "",
      contents: [],
      id: el.getAttribute(ATTR.id) ?? el.getAttribute("data-guide-id"),
      outlined: true,
      wholePage: false,
      rank,
      ...extra,
    });
  };

  /* 1. Whole-block regions. */
  REGION_KINDS.forEach((kind, i) => {
    document.querySelectorAll(REGION_SELECTORS[kind]).forEach((el) => {
      if (main?.contains(el)) return;
      if (kind === "sidebar" && el.closest("header")) return;
      if (!isVisibleEl(el)) return;
      add(el, kind, i);
    });
  });

  if (main) {
    const pageRoot = findPageRoot(main);
    const rootW = (pageRoot ?? main).getBoundingClientRect().width || main.clientWidth;
    const mainH = main.getBoundingClientRect().height || window.innerHeight;
    const inMain = (el: Element | null) => Boolean(el && main.contains(el));

    /* 2. Cards — dashboards only. An annotated card is the unit: bare shadcn
          cards nested inside it are its insides, not separate targets. */
    if (mode === "specific") {
      main.querySelectorAll(CARD_SELECTOR).forEach((el) => {
        const explicit = el.getAttribute(ATTR.target);
        if (explicit && explicit !== "card") return;
        if (!explicit && inMain(el.parentElement?.closest(`[${ATTR.target}="card"]`) ?? null)) return;
        if (!isVisibleEl(el)) return;
        add(el, "card", 10);
      });
    }

    /* 3. Explicit headers / sections (cards were handled above). */
    main.querySelectorAll(`[${ATTR.target}]`).forEach((el) => {
      const kind = el.getAttribute(ATTR.target) as TargetKind;
      if (kind === "card" || isRegionKind(kind)) return;
      if (!isVisibleEl(el)) return;
      add(el, kind, kind === "header" ? 20 : 30);
    });

    /* 4. Structural sections — only when they're section-sized, so a
          toolbar button with a guide id or an item card never qualifies. */
    main.querySelectorAll(SECTION_SELECTOR).forEach((el) => {
      if (map.has(el) || !isVisibleEl(el)) return;
      if (!sectionSized(el, rootW, mainH)) return;
      add(el, "section", 40);
    });

    /* 5. General pages: a top-level card (no card around it) is a section. */
    if (mode === "general") {
      main.querySelectorAll('[data-slot="card"]').forEach((el) => {
        if (map.has(el)) return;
        if (inMain(el.parentElement?.closest('[data-slot="card"]') ?? null)) return;
        if (!isVisibleEl(el) || !sectionSized(el, rootW, mainH)) return;
        add(el, "section", 45);
      });
    }

    /* 6. The page's own top-level parts, the wrappers around them (pickable,
          not drawn), and the page root as the very last resort. */
    if (pageRoot) {
      const { sections, wrappers } = pageSections(pageRoot, (el) => map.has(el));
      sections.forEach((el) => {
        if (!map.has(el) && isVisibleEl(el) && sectionSized(el, rootW, mainH)) add(el, "section", 50);
      });
      wrappers.forEach((el) => add(el, "section", 60, { outlined: false }));
      add(pageRoot, "section", 70, { outlined: false, wholePage: true });
    }
  }

  /* 7. Two sections drawing the same box (a wrapper and its only child) —
        keep one: the annotated one if either is, else the outer. */
  const ownerOf = (node: Element): Element | null => {
    let p: Element | null = node.parentElement;
    while (p) {
      if (map.has(p)) return p;
      p = p.parentElement;
    }
    return null;
  };
  for (const c of [...map.values()]) {
    if (!map.has(c.el) || c.kind !== "section" || c.wholePage) continue;
    const parent = ownerOf(c.el);
    const outer = parent ? map.get(parent) : undefined;
    if (!outer || outer.kind !== "section" || outer.wholePage) continue;
    if (!sameBox(toBox(c.el.getBoundingClientRect()), toBox(outer.el.getBoundingClientRect()))) continue;
    const innerMarked = c.el.hasAttribute(ATTR.target) || c.el.hasAttribute("data-guide-id");
    const outerMarked = outer.el.hasAttribute(ATTR.target) || outer.el.hasAttribute("data-guide-id");
    // Drop the twin from the index entirely, so picking can't land on it and
    // its heading falls to the survivor when labels are derived below.
    if (innerMarked && !outerMarked) {
      if (!c.id) c.id = outer.id;
      map.delete(outer.el);
    } else {
      if (!outer.id) outer.id = c.id;
      map.delete(c.el);
    }
  }

  /* 8. Labels. A heading names only the candidate that directly owns it. */
  const ownerOfNode = (node: Element): Element | null => {
    let p: Element | null = node;
    while (p) {
      if (map.has(p)) return p;
      p = p.parentElement;
    }
    return null;
  };
  map.forEach((c) => {
    c.label = deriveLabel(c.el, c.kind, ownerOfNode);
  });
  map.forEach((c) => {
    if (c.label || c.kind !== "section") return;
    const names: string[] = [];
    map.forEach((inner) => {
      if (names.length < 3 && inner !== c && inner.kind === "card" && inner.label && c.el.contains(inner.el)) {
        names.push(inner.label);
      }
    });
    c.contents = names;
  });

  const list = [...map.values()].filter((c) => c.outlined).sort(documentOrder);
  return { mode, main, map, list };
}

/** Innermost candidate at a point — walk up from the topmost real element. */
export function pickAt(index: CandidateIndex, x: number, y: number): Candidate | null {
  const stack = document.elementsFromPoint(x, y);
  const hit = stack.find((el) => !isReportUi(el));
  let node: Element | null = hit ?? null;
  while (node) {
    const c = index.map.get(node);
    if (c && node.isConnected) return c;
    node = node.parentElement;
  }
  return pickByRects(index, x, y);
}

/**
 * Fallback when hit-testing finds nothing (pointer-events:none, `inert`,
 * a body stuck with pointer-events off): the cached candidates whose box
 * contains the point — regions first, then cards, then the smallest.
 */
export function pickByRects(index: CandidateIndex, x: number, y: number): Candidate | null {
  let best: Candidate | null = null;
  let bestArea = Infinity;
  index.map.forEach((c) => {
    if (!c.el.isConnected) return;
    const r = c.el.getBoundingClientRect();
    if (!containsPoint(toBox(r), x, y)) return;
    const area = r.width * r.height;
    if (!best || c.rank < best.rank || (c.rank === best.rank && area < bestArea)) {
      best = c;
      bestArea = area;
    }
  });
  return best;
}

export type SectionSource = "element" | "region" | "page" | "fallback";

/** Which area a pick routes to, and why (shown in the dialog and the note). */
export function resolveSection(c: Candidate, page: ReportPage): { key: string; source: SectionSource } {
  const own = c.el.closest(`[${ATTR.section}]`)?.getAttribute(ATTR.section);
  if (own) return { key: cleanText(own, 64), source: "element" };
  if (isRegionKind(c.kind)) return { key: REGION_SECTION_KEYS[c.kind], source: "region" };
  if (page.path !== "*") return { key: page.sectionKey, source: "page" };
  return { key: FALLBACK_SECTION_KEY, source: "fallback" };
}
