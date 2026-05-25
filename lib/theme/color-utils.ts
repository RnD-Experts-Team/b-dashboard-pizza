/**
 * Convert any CSS color value to a hex string by rendering it in a hidden
 * DOM element and reading back the computed RGB value.
 * Handles oklch, hsl, rgb, named colors, hex, and any valid CSS color.
 * Falls back to #000000 on failure or in SSR.
 */
export function cssValueToHex(value: string): string {
  if (!value || typeof window === "undefined") return "#000000";

  try {
    const el = document.createElement("div");
    el.style.position = "fixed";
    el.style.top = "-9999px";
    el.style.left = "-9999px";
    el.style.width = "1px";
    el.style.height = "1px";
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    el.style.color = value;
    document.body.appendChild(el);

    const computed = window.getComputedStyle(el).color;
    document.body.removeChild(el);

    // Parse rgb(r, g, b) or rgba(r, g, b, a)
    const match = computed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return "#000000";

    const r = parseInt(match[1]).toString(16).padStart(2, "0");
    const g = parseInt(match[2]).toString(16).padStart(2, "0");
    const b = parseInt(match[3]).toString(16).padStart(2, "0");

    return `#${r}${g}${b}`;
  } catch {
    return "#000000";
  }
}

/**
 * Resolve a CSS variable value (e.g. var(--primary)) to a hex color.
 * Reads the actual computed value from document root, then converts to hex.
 */
export function cssVarToHex(cssVar: string): string {
  if (typeof window === "undefined") return "#000000";

  try {
    const rawValue = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue(cssVar)
      .trim();

    if (!rawValue) return "#000000";
    return cssValueToHex(rawValue);
  } catch {
    return "#000000";
  }
}
