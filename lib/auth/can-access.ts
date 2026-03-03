import type { AuthRule } from "@/types/auth-rule.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CanAccessParams {
  /** Backend service identifier, e.g. "Data", "QA" */
  service: string;
  /** HTTP method, e.g. "GET", "POST" */
  method: string;
  /** Path to test against path_regex, e.g. "/engine/keys" */
  path: string;
  /**
   * Required when the matched rule has store_scope_mode === "scoped".
   * Pass the currently-selected store's id.
   */
  storeId?: string;
}

// ---------------------------------------------------------------------------
// Regex helpers
// ---------------------------------------------------------------------------

/**
 * PHP-style regex delimiters produced by the backend look like:
 *   #^/export/[^/]+$#
 *
 * Strip leading/trailing delimiter char so we get a plain JS regex string.
 */
function stripPhpDelimiters(raw: string): string {
  if (raw.length < 2) return raw;
  const delimiter = raw[0];
  // Find the last occurrence of the delimiter (ignore flags after it)
  const lastIndex = raw.lastIndexOf(delimiter, raw.length - 1);
  if (lastIndex <= 0) return raw;
  return raw.slice(1, lastIndex);
}

function buildRegex(raw: string): RegExp | null {
  try {
    return new RegExp(stripPhpDelimiters(raw));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Pure authorization check — no React, no Zustand.
 *
 * @param params        What resource the user wants to access
 * @param globalPerms   Set of global permission names for the current user
 * @param storePerms    Map of storeId → Set of permission names
 * @param authRules     The (currently mocked) list of auth rules
 * @returns             `true` if the user is authorized, `false` otherwise
 */
export function canAccess(
  params: CanAccessParams,
  globalPerms: Set<string>,
  storePerms: Record<string, Set<string>>,
  authRules: AuthRule[]
): boolean {
  const { service, method, path, storeId } = params;

  // ------------------------------------------------------------------
  // Step 1 — Find the highest-priority matching active rule
  // ------------------------------------------------------------------
  const candidates = authRules
    .filter((r) => {
      if (!r.isActive && !r.is_active) return false;
      const rService = r.service;
      const rMethod = r.method;
      if (
        rService.toLowerCase() !== service.toLowerCase() ||
        rMethod.toUpperCase() !== method.toUpperCase()
      ) {
        return false;
      }
      const rawRegex = r.pathRegex ?? r.path_regex;
      if (!rawRegex) return false;
      const regex = buildRegex(rawRegex);
      return regex ? regex.test(path) : false;
    })
    // lower priority number = higher priority (sort ascending)
    .sort((a, b) => a.priority - b.priority);

  if (candidates.length === 0) {
    // Default deny — no matching rule found
    return false;
  }

  const rule = candidates[0];

  // ------------------------------------------------------------------
  // Step 2/3 — Determine scope and evaluate permissions
  // ------------------------------------------------------------------
  const scopeMode = rule.storeScopeMode ?? rule.store_scope_mode ?? "none";

  const any = rule.permissionsAny ?? rule.permissions_any;
  const all = rule.permissionsAll ?? rule.permissions_all;

  function passesAgainst(permSet: Set<string>): boolean {
    if (any && any.length > 0) {
      if (!any.some((p) => permSet.has(p))) return false;
    }
    if (all && all.length > 0) {
      if (!all.every((p) => permSet.has(p))) return false;
    }
    return true;
  }

  // Scoped rules require store-specific permissions only.
  if (scopeMode === "scoped") {
    if (!storeId) return false; // scoped rule but no store selected
    const storeSet = storePerms[String(storeId)] ?? new Set();
    return passesAgainst(storeSet);
  }

  // Non-scoped rules: if a storeId is present, check store-specific perms first,
  // and if that check fails, fall back to global permissions.
  if (storeId) {
    const storeSet = storePerms[String(storeId)];
    if (storeSet !== undefined) {
      if (passesAgainst(storeSet)) return true;
      // else fall through to global perms
    }
  }

  // Default to global permissions for non-scoped rules (or when no store-specific set)
  return passesAgainst(globalPerms);
}

// ---------------------------------------------------------------------------
// Normalisation helpers (used by the auth store)
// ---------------------------------------------------------------------------

export interface NormalizedAuthState {
  globalPermissions: Set<string>;
  storePermissions: Record<string, Set<string>>;
}

/**
 * Derive globalPermissions and storePermissions from the raw /auth/me payload.
 *
 * global_roles[].permissions[]  → globalPermissions
 * stores[].effective_permissions[]  → storePermissions[storeId]
 */
export function normalizeAuthPermissions(user: {
  // Accept both API snake_case and frontend camelCase shapes.
  // Prefer already-flattened lists when present.
  all_permissions?: Array<{ name: string }>;
  allPermissions?: Array<{ name: string }>;
  global_roles?: Array<{ permissions?: Array<{ name: string }> }>;
  globalRoles?: Array<{ permissions?: Array<{ name: string }> }>;
  stores?: Array<{
    store: { id: string | number; store_id?: string };
    // API shape
    effective_permissions?: Array<{ name: string }>;
    // Frontend transformed shape
    effectivePermissions?: Array<{ name: string }>;
  }>;
} | null): NormalizedAuthState {
  const globalPermissions = new Set<string>();
  const storePermissions: Record<string, Set<string>> = {};

  if (!user) return { globalPermissions, storePermissions };

  // Global permissions — explicitly read from `global_permissions` and
  // `global_roles` (supporting both API snake_case and frontend camelCase).
  const gp: any[] = (user as any).globalPermissions ?? (user as any).global_permissions ?? [];
  if (Array.isArray(gp) && gp.length > 0) {
    gp.forEach((p: any) => {
      if (!p) return;
      if (typeof p === "string") globalPermissions.add(p);
      else if (typeof p.name === "string") globalPermissions.add(p.name);
    });
  }

  const roles = (user as any).globalRoles ?? (user as any).global_roles ?? [];
  if (Array.isArray(roles) && roles.length > 0) {
    roles.forEach((role: any) => {
      role?.permissions?.forEach((p: any) => {
        if (!p) return;
        if (typeof p === "string") globalPermissions.add(p);
        else if (typeof p.name === "string") globalPermissions.add(p.name);
      });
    });
  }

  // Store-scoped permissions — from effective_permissions per store
  // Store-scoped permissions — support both API and frontend key names.
  user.stores?.forEach((assignment) => {
    const id = String(assignment.store.store_id ?? assignment.store.id);
    const set = new Set<string>();
    const eff = (assignment as any).effectivePermissions ?? assignment.effective_permissions;
    eff?.forEach((p: { name: string }) => set.add(p.name));
    storePermissions[id] = set;
  });

  return { globalPermissions, storePermissions };
}
