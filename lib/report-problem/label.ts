import { ATTR, type TargetKind } from "./attributes";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Human labels for picked parts — what the chip, the dialog and the note   */
/*  call it. Only ever reads the text of SMALL nodes (titles, headings);     */
/*  never `textContent` of a section, which can be a whole table.            */
/* ────────────────────────────────────────────────────────────────────────── */

export const MAX_LABEL = 80;

export function cleanText(raw: string | null | undefined, max = MAX_LABEL): string {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** Text of a node we already know is small (a title, a heading, a tab). */
function smallText(el: Element | null): string {
  return el ? cleanText(el.textContent) : "";
}

const HEADINGS = 'h1,h2,h3,h4,[role="heading"]';

/**
 * Best label for a candidate, or "" when it has none of its own (the caller
 * then summarises its cards or falls back to the kind name).
 *
 * `ownerOf(heading)` must return the nearest candidate that contains the
 * heading — a heading that belongs to a nested card must not name the
 * section around it.
 */
export function deriveLabel(
  el: Element,
  kind: TargetKind,
  ownerOf: (node: Element) => Element | null,
): string {
  const explicit = el.getAttribute(ATTR.label);
  if (explicit) return cleanText(explicit);

  if (kind === "card") {
    const title = el.querySelector('[data-slot="card-title"]');
    if (title) {
      // V1Card keeps the title in span.truncate next to badges and controls.
      const text = smallText(title.querySelector(".truncate")) || smallText(title);
      if (text) return text;
    }
  }

  const headings = el.querySelectorAll(HEADINGS);
  for (let i = 0; i < headings.length && i < 12; i++) {
    const h = headings[i];
    if (ownerOf(h) === el) {
      const text = smallText(h);
      if (text) return text;
    }
  }

  const aria = el.getAttribute("aria-label");
  if (aria) return cleanText(aria);
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    // Radix tab panels point at their trigger — the active tab's name.
    const text = labelledBy
      .split(/\s+/)
      .map((id) => smallText(document.getElementById(id)))
      .filter(Boolean)
      .join(" ");
    if (text) return cleanText(text);
  }
  return "";
}
