/* ────────────────────────────────────────────────────────────────────────── */
/*  Role list handling — pure, and deliberately dumb.                        */
/*                                                                            */
/*  Role names are free text that must match pizzasys exactly. The server    */
/*  trims and de-duplicates, nothing more, and so do we: no case-folding, no */
/*  hyphen/underscore "fixing" (the estate uses both: qa-auditor,            */
/*  hiring_manager).                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export function normalizeRoles(roles: string[]): string[] {
  const out: string[] = [];
  for (const r of roles) {
    const v = r.trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/** Split pasted/typed text on commas and newlines only — names never contain those. */
export function splitRoleInput(raw: string): string[] {
  return raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
}

/** Roles shared by two lists — shown next to the picker when nested items both use roles. */
export function sharedRoles(a: string[] | null, b: string[] | null): string[] | null {
  if (!a || !b) return null;
  return a.filter((r) => b.includes(r));
}
