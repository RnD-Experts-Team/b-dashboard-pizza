/**
 * Section (and level) keys are the contract with the backend: lowercase,
 * starting with [a-z0-9], then [a-z0-9._-]*, max 64 chars. Convention: `area.page`.
 */
export const KEY_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export function isValidKey(key: string): boolean {
  return KEY_RE.test(key);
}

/** Best-effort suggestion from a display name: "Main dashboard - inventory" → "main-dashboard-inventory". */
export function suggestKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/-+/g, "-")
    .replace(/-$/, "")
    .slice(0, 64);
}
