import { createElement, type ReactNode } from "react";
import DOMPurify, { type DOMPurify as DOMPurifyInstance } from "dompurify";
import { find } from "linkifyjs";

/**
 * Rendering announcement text safely.
 *
 * Two entry points, and nothing else may put announcement content on the page:
 *
 *  - `renderAnnouncementHtml(html)`: an announcement BODY (HTML written in the
 *    rich-text editor, possibly an older body from v1). Always render the
 *    result, never the raw body, and never with `dangerouslySetInnerHTML` of
 *    anything else.
 *  - `linkifyToNodes(text)`: a COMMENT (plain text). Returns React nodes, so no
 *    HTML is ever parsed.
 *
 * Browser only. On the server `renderAnnouncementHtml` returns "" (the
 * dashboard layout renders a loader on the server and bodies only ever arrive
 * from client fetches).
 */

export const ANNOUNCEMENT_LINK_CLASS = "ann-link";
const LINK_REL = "noopener noreferrer nofollow";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Allowlists                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "a",
  "ul", "ol", "li", "blockquote", "h2", "h3", "h4",
  "code", "pre", "hr", "mark", "span",
];

/**
 * `target`, `rel` and `class` are NOT here on purpose: an author must not be
 * able to set them. The afterSanitizeAttributes hook puts them back on anchors
 * (and only anchors) itself.
 */
const ALLOWED_ATTR = ["href", "style"];

/** The only URL schemes a link may use. */
const ALLOWED_URI = /^(?:https?|mailto|tel):/i;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Inline styles                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
/** rgb(…), hsl(…), oklch(…) …: one flat function call, no nesting, no url(). */
const COLOR_FUNCTION = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[0-9a-z.%\s,/+-]*\)$/i;
/** red, transparent, inherit, currentcolor … (an identifier cannot hurt). */
const COLOR_KEYWORD = /^[a-z]{3,24}$/i;
const TEXT_ALIGN = /^(?:left|right|center|justify|start|end)$/i;

function isSafeColor(value: string): boolean {
  return HEX_COLOR.test(value) || COLOR_FUNCTION.test(value) || COLOR_KEYWORD.test(value);
}

const STYLE_VALIDATORS: Record<string, (value: string) => boolean> = {
  color: isSafeColor,
  "background-color": isSafeColor,
  "text-align": (v) => TEXT_ALIGN.test(v),
};

/**
 * Keep only `color`, `background-color` and `text-align`, each with a
 * validated value. Everything else (position, url(...), expression, custom
 * properties, !important …) is dropped. Returns "" when nothing survives.
 */
export function filterStyle(style: string): string {
  const kept: string[] = [];
  for (const declaration of style.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    const validate = STYLE_VALIDATORS[property];
    if (validate && value && validate(value)) kept.push(`${property}: ${value}`);
  }
  return kept.join("; ");
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Links                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function hasAllowedProtocol(href: string): boolean {
  // Whitespace and control characters inside a scheme ("java\tscript:") are
  // how filters get bypassed; strip them before testing.
  // eslint-disable-next-line no-control-regex
  return ALLOWED_URI.test(href.replace(/[\u0000- \u007f-\u009f]/g, ""));
}

function opensInNewTab(href: string): boolean {
  return /^https?:/i.test(href.trim());
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  The sanitizer instance                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

let instance: DOMPurifyInstance | null = null;

/**
 * Our own DOMPurify instance, created on first use in the browser. A private
 * instance (instead of hooks on the shared default one) means the hooks below
 * are registered exactly once, even if this module is re-evaluated by hot
 * reload, and can't leak into anything else that uses DOMPurify.
 */
function getPurifier(): DOMPurifyInstance | null {
  if (typeof window === "undefined") return null;
  if (instance) return instance;

  const purify = DOMPurify(window);
  if (!purify.isSupported) return null;

  purify.addHook("uponSanitizeAttribute", (_node, event) => {
    if (event.attrName !== "style") return;
    const cleaned = filterStyle(event.attrValue);
    if (cleaned) {
      event.attrValue = cleaned;
    } else {
      event.keepAttr = false;
    }
  });

  purify.addHook("afterSanitizeAttributes", (node) => {
    if (node.nodeName !== "A") return;
    const href = node.getAttribute("href");
    if (href && hasAllowedProtocol(href)) {
      node.setAttribute("class", ANNOUNCEMENT_LINK_CLASS);
      node.setAttribute("rel", LINK_REL);
      if (opensInNewTab(href)) node.setAttribute("target", "_blank");
      else node.removeAttribute("target");
    } else {
      // No (or a disallowed) destination: leave plain text, not a dead link.
      node.removeAttribute("href");
      node.removeAttribute("target");
      node.removeAttribute("rel");
      node.removeAttribute("class");
    }
  });

  instance = purify;
  return purify;
}

const SANITIZE_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOWED_URI_REGEXP: ALLOWED_URI,
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
} as const;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Body HTML                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Turn bare URLs and e-mail addresses in TEXT NODES into anchors, skipping
 * anything already inside an a, code or pre. Anchors are built with
 * createElement + textContent, never by string concatenation.
 */
function linkifyTextNodes(fragment: DocumentFragment): void {
  const doc = fragment.ownerDocument;
  const walker = doc.createTreeWalker(fragment, 4 /* NodeFilter.SHOW_TEXT */);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  for (const node of textNodes) {
    const text = node.nodeValue ?? "";
    if (!text) continue;
    if (node.parentElement?.closest("a, code, pre")) continue;

    const matches = find(text).filter(
      (m) => m.isLink && (m.type === "url" || m.type === "email") && hasAllowedProtocol(m.href),
    );
    if (matches.length === 0) continue;

    const replacement = doc.createDocumentFragment();
    let cursor = 0;
    for (const match of matches) {
      if (match.start > cursor) {
        replacement.appendChild(doc.createTextNode(text.slice(cursor, match.start)));
      }
      const anchor = doc.createElement("a");
      anchor.setAttribute("href", match.href);
      anchor.textContent = match.value;
      replacement.appendChild(anchor);
      cursor = match.end;
    }
    if (cursor < text.length) {
      replacement.appendChild(doc.createTextNode(text.slice(cursor)));
    }
    node.parentNode?.replaceChild(replacement, node);
  }
}

const CACHE_LIMIT = 200;
const cache = new Map<string, string>();

/**
 * Sanitized, linkified HTML for an announcement body. Safe to hand to
 * `dangerouslySetInnerHTML`. Returns "" on the server.
 */
export function renderAnnouncementHtml(html: string | null | undefined): string {
  if (!html) return "";
  const purify = getPurifier();
  if (!purify) return "";

  const cached = cache.get(html);
  if (cached !== undefined) return cached;

  // Pass 1: sanitize into a DOM fragment, then linkify the text nodes in it.
  const fragment = purify.sanitize(html, {
    ...SANITIZE_CONFIG,
    RETURN_DOM_FRAGMENT: true,
  });
  linkifyTextNodes(fragment);

  // Serialise inside the inert document, then sanitize that string once more.
  // The second pass makes the result independent of how a browser re-parses
  // our serialisation (the usual mutation-XSS gap) and re-applies the anchor
  // attributes to the anchors pass 1 created.
  const holder = fragment.ownerDocument.createElement("div");
  holder.appendChild(fragment);
  const result = purify.sanitize(holder.innerHTML, SANITIZE_CONFIG);

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(html, result);
  return result;
}

/**
 * The text of a body with no markup, blocks separated by spaces. For aria
 * labels, previews and search. Returns "" on the server.
 */
export function announcementPlainText(html: string | null | undefined): string {
  if (!html) return "";
  const purify = getPurifier();
  if (!purify) return "";
  const spaced = html.replace(/<\/(?:p|li|h[1-6]|blockquote|pre)>|<br\s*\/?>|<hr\s*\/?>/gi, " ");
  const fragment = purify.sanitize(spaced, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    RETURN_DOM_FRAGMENT: true,
  });
  return (fragment.textContent ?? "").replace(/\s+/g, " ").trim();
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Comments (plain text)                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Plain text with its URLs and e-mail addresses turned into links, as React
 * nodes. Render inside an element with `whitespace-pre-wrap break-words`.
 */
export function linkifyToNodes(text: string | null | undefined): ReactNode[] {
  if (!text) return [];

  const matches = find(text).filter(
    (m) => m.isLink && (m.type === "url" || m.type === "email") && hasAllowedProtocol(m.href),
  );
  if (matches.length === 0) return [text];

  const nodes: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((match, index) => {
    if (match.start > cursor) nodes.push(text.slice(cursor, match.start));
    nodes.push(
      createElement(
        "a",
        {
          key: `${index}:${match.start}`,
          href: match.href,
          className: ANNOUNCEMENT_LINK_CLASS,
          rel: LINK_REL,
          ...(opensInNewTab(match.href) ? { target: "_blank" } : {}),
        },
        match.value,
      ),
    );
    cursor = match.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
