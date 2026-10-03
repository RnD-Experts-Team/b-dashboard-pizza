import type { CanAccessParams } from "@/lib/auth/can-access";

/**
 * Who sees what in Dough & Sauce — decided by the pizzasys auth rules for the
 * 13 endpoints, never by role names.
 *
 *   Store Manager  holds `reports view`    (store-level)  → Daily plan only
 *   Specialist     holds `dough and sauce` (global)       → every page, every action
 *
 * The rules are the single source of truth; this file only asks the rule engine
 * (`canAccessRoute`) the same question the server will be asked. The server still
 * enforces: a 403 stays the backstop and keeps rendering its no-access state.
 * Full workflow + rule table: docs/DOUGH-SAUCE-ACCESS.md
 */

export type DoughSauceTab = "daily" | "weekly" | "recipes" | "report";

export type RouteCheck = (params: CanAccessParams) => boolean;

/* ── The 13 endpoints as rule-engine inputs ──────────────────────────────── */

const QA = "QA"; // AuditApp
const DATA = "Data"; // LC_PIZZA_DATA
const INV = "Inventory";

/** `storeId` is the NUMERIC store id (keys `storePermissions`), not the 03795-… text code. */
const stores = (service: string, method: string, tail: string, storeId: string): CanAccessParams => ({
  service,
  method,
  path: `/stores/*/dough-sauce/${tail}`,
  storeId,
});

export const DS_ROUTES = {
  /* 1 */ planGet: (id: string) => stores(QA, "GET", "plan", id),
  /* 2 */ planPost: (id: string) => stores(QA, "POST", "plan", id),
  /* 3 */ plans: (): CanAccessParams => ({ service: QA, method: "GET", path: "/dough-sauce/plans" }),
  /* 4 */ week: (id: string) => stores(QA, "GET", "week", id),
  /* 5 */ judgement: (id: string) => stores(QA, "PUT", "judgement", id),
  /* 6 */ dailyPlan: (id: string) => stores(DATA, "GET", "daily-plan", id),
  /* 7 */ ingredients: (id: string): CanAccessParams => ({
    service: DATA,
    method: "GET",
    path: "/dough-sauce/ingredients",
    storeId: id,
  }),
  /* 8 */ recipesGet: (): CanAccessParams => ({ service: DATA, method: "GET", path: "/dough-sauce/recipes" }),
  /* 9 */ recipesPost: (): CanAccessParams => ({ service: DATA, method: "POST", path: "/dough-sauce/recipes" }),
  /* 10 */ recipesPut: (): CanAccessParams => ({ service: DATA, method: "PUT", path: "/dough-sauce/recipes/*" }),
  /* 11 */ recipesDelete: (): CanAccessParams => ({ service: DATA, method: "DELETE", path: "/dough-sauce/recipes/*" }),
  /* 12 */ countsStore: (id: string): CanAccessParams => ({
    service: INV,
    method: "GET",
    path: "/inventory/stores/*/counts",
    storeId: id,
  }),
  /* 13 */ countsAll: (): CanAccessParams => ({ service: INV, method: "GET", path: "/inventory/counts" }),
} as const;

/* ── Access model ────────────────────────────────────────────────────────── */

export type DoughSauceRole = "specialist" | "manager" | "none";

export interface DoughSauceAccess {
  role: DoughSauceRole;
  tabs: Record<DoughSauceTab, boolean>;
  /** First tab this user may open — where /dough-sauce lands. */
  firstTab: DoughSauceTab | null;
  can: {
    /** Confirm / re-confirm a store's daily plan (#2). */
    confirmPlan: (storeId: string | number) => boolean;
    /** Set a store's weekly Stickers / Dough Quality verdicts and note (#5). */
    judge: (storeId: string | number) => boolean;
    /** Recipes (#9 / #10 / #11). */
    addRecipe: boolean;
    editRecipe: boolean;
    closeRecipe: boolean;
    /** One call for every store's counts (#13); the weekly views fall back to per-store (#12) without it. */
    allStoresCounts: boolean;
  };
}

const TAB_ORDER: DoughSauceTab[] = ["daily", "weekly", "recipes", "report"];

/**
 * Pure — pass in `canAccessRoute` from the auth store and the user's numeric
 * store ids (`overviewStores[].id`).
 *
 * Why the Specialist is detected with an UNSCOPED rule (#3) and no store:
 * the Specialist holds `dough and sauce` globally, while the per-store rules
 * (#1 #2 #4 #5 #6 #12) are "Scoped Stores" — and the client engine checks a scoped
 * rule against STORE-level permissions only (lib/auth/can-access.ts). Asking a scoped
 * rule about a global-only user would hide pages from the very role that sees all.
 * #3 is unscoped, so it reads the global permission, exactly as the server does.
 */
export function buildDoughSauceAccess(auth: { canAccessRoute: RouteCheck }, storeIds: string[]): DoughSauceAccess {
  const ok = auth.canAccessRoute;
  const specialist = ok(DS_ROUTES.plans());
  const managerDaily = !specialist && storeIds.some((id) => ok(DS_ROUTES.planGet(id)));

  const tabs: Record<DoughSauceTab, boolean> = {
    daily: specialist || managerDaily,
    // Specialist-only pages: they need the all-stores plans list (#3).
    weekly: specialist,
    report: specialist,
    recipes: ok(DS_ROUTES.recipesGet()),
  };

  const id = (s: string | number) => String(s);
  return {
    role: specialist ? "specialist" : managerDaily ? "manager" : "none",
    tabs,
    firstTab: TAB_ORDER.find((tab) => tabs[tab]) ?? null,
    can: {
      confirmPlan: (s) => specialist || ok(DS_ROUTES.planPost(id(s))),
      judge: (s) => specialist || ok(DS_ROUTES.judgement(id(s))),
      addRecipe: ok(DS_ROUTES.recipesPost()),
      editRecipe: ok(DS_ROUTES.recipesPut()),
      closeRecipe: ok(DS_ROUTES.recipesDelete()),
      allStoresCounts: ok(DS_ROUTES.countsAll()),
    },
  };
}
