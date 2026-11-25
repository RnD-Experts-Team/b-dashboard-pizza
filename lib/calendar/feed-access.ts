import { canAccess, hasMatchingRule, type CanAccessParams } from "@/lib/auth/can-access";
import type { AuthRule } from "@/types/auth-rule.types";
import type { FeedSource } from "./feed-types";

/**
 * Which stores each calendar layer may be asked for (FRONTEND_CALENDAR_ROLES_PERMISSIONS.md §3).
 * Pure functions — no React, no store.
 *
 * Every feed has its own pizzasys rule (`GET` on the project's calendar route). The rule is
 * "scoped": for EACH store sent (`stores=`) the user must hold one of its permissions AT THAT
 * STORE (a Store Manager holds `reports view` at their stores), or hold one of its roles
 * GLOBALLY (a specialist sees their layer for every store). ONE store that fails makes the
 * WHOLE request 403 — so a user with many stores, only some of them theirs to manage, would
 * lose a layer for all of them. The page therefore sends each layer only the stores that pass,
 * and nothing at all when none does (no request, no 403), mirroring the server's own decision
 * with the rules the auth server already gave the client (`canAccess`).
 *
 * Never hides what it cannot judge: no rule for the route (rules not loaded yet, not seeded)
 * → every store goes, and the server decides (a 403 is still hidden silently, as before).
 */

/** The pizzasys rule behind each feed: its service and path (without `/api`), `GET`. */
export const FEED_RULES: Readonly<Record<FeedSource, { service: string; path: string }>> = {
  inventory: { service: "Inventory", path: "/inventory/calendar/feed" },
  auditapp: { service: "QA", path: "/cleaning/calendar/feed" },
  maintenance: { service: "Maintenance", path: "/calendar/feed" },
  data: { service: "Data", path: "/calendar/feed" },
  operations: { service: "Operations", path: "/v1/calendar/feed" },
  hiring: { service: "Hiring", path: "/v1/calendar/feed" },
  toolbox: { service: "Toolbox", path: "/v1/calendar/feed" },
  notifications: { service: "Notifications", path: "/announcements/calendar/feed" },
};

/** What the decision needs from the auth store. */
export interface FeedAccessContext {
  isSuperAdmin: boolean;
  authRules: readonly AuthRule[];
  globalPermissions: Set<string>;
  /** Permissions held at a store, by the store's NUMERIC id (the key the auth store uses). */
  storePermissions: Record<string, Set<string>>;
  /** Names of the roles the user holds globally. */
  globalRoles: readonly string[];
  /** Store number ("03795-00001") → numeric store id ("48"). */
  storeIds: ReadonlyMap<string, string>;
}

/** The part of `useAuthStore`'s state this needs (so the caller can pass `getState()` straight in). */
export interface AuthStateLike {
  isSuperAdmin: () => boolean;
  authRules: AuthRule[];
  globalPermissions: Set<string>;
  storePermissions: Record<string, Set<string>>;
  user: { globalRoles?: { name: string }[] | null } | null;
  overviewStores: { id: string; storeId?: string }[];
}

export function feedAccessContext(state: AuthStateLike): FeedAccessContext {
  const storeIds = new Map<string, string>();
  for (const s of state.overviewStores ?? []) if (s.storeId) storeIds.set(s.storeId, s.id);
  return {
    isSuperAdmin: state.isSuperAdmin(),
    authRules: state.authRules ?? [],
    globalPermissions: state.globalPermissions,
    storePermissions: state.storePermissions,
    globalRoles: (state.user?.globalRoles ?? []).map((r) => r.name),
    storeIds,
  };
}

/** The stores of `codes` this layer may be asked for, in their order. */
export function storesForFeed(source: FeedSource, codes: readonly string[], ctx: FeedAccessContext): string[] {
  if (ctx.isSuperAdmin) return [...codes];
  const rule = FEED_RULES[source];
  const base: CanAccessParams = { service: rule.service, method: "GET", path: rule.path };
  // No rule to judge by: leave it to the server.
  if (!hasMatchingRule(base, ctx.authRules as AuthRule[])) return [...codes];
  const roles = [...ctx.globalRoles];
  return codes.filter((code) =>
    canAccess({ ...base, storeId: ctx.storeIds.get(code) }, ctx.globalPermissions, ctx.storePermissions, ctx.authRules as AuthRule[], roles),
  );
}
