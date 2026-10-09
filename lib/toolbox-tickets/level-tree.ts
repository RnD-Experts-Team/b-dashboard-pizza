import type { TicketLevel } from "@/types/toolbox-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Level tree helpers. `GET /ticket-levels` is always the nested tree.      */
/* ────────────────────────────────────────────────────────────────────────── */

export interface FlatLevel {
  level: TicketLevel;
  depth: number;
  /** "Operations › Hiring" */
  path: string;
}

export function flattenLevels(tree: TicketLevel[], depth = 0, prefix = ""): FlatLevel[] {
  const out: FlatLevel[] = [];
  const sorted = [...tree].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
  );
  for (const level of sorted) {
    const path = prefix ? `${prefix} › ${level.name}` : level.name;
    out.push({ level, depth, path });
    out.push(...flattenLevels(level.children, depth + 1, path));
  }
  return out;
}

export function findLevel(tree: TicketLevel[], id: number): TicketLevel | null {
  for (const level of tree) {
    if (level.id === id) return level;
    const hit = findLevel(level.children, id);
    if (hit) return hit;
  }
  return null;
}

/**
 * The level itself plus everything beneath it. A level's parent picker must
 * exclude these — choosing one would make a cycle (TICKET_LEVEL_CYCLE).
 */
export function selfAndDescendantIds(tree: TicketLevel[], id: number): Set<number> {
  const out = new Set<number>();
  const walk = (l: TicketLevel) => {
    out.add(l.id);
    l.children.forEach(walk);
  };
  const root = findLevel(tree, id);
  if (root) walk(root);
  else out.add(id);
  return out;
}

/** True when deactivating this level would cut active levels/sections off from those above it. */
export function hasActiveDescendants(level: TicketLevel): boolean {
  return level.sections.length > 0 || level.children.some((c) => c.active || hasActiveDescendants(c));
}
