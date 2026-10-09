# Dough & Sauce — Roles & Permissions Workflow

_Last updated: 2026-10-09 — source of truth for who sees what. Code: `lib/dough-sauce/access.ts`
(+ hook `lib/hooks/use-dough-sauce-access.ts`). The rules themselves live in **pizzasys**, not in this repo._

> **2026-10-09:** `reports view` no longer opens Dough & Sauce. Only `dough and sauce` does: a
> **worker** holds it per store (the Dough and Sauce role at that store), the **Specialist** (head)
> also holds it globally. A Store Manager without that role has no entry and no access. Below,
> the "Store Manager" column now means that per-store worker.

## 1. The two roles

| | **Store Manager** | **Specialist** |
|---|---|---|
| Pizzasys permission | `dough and sauce` (store role) | `dough and sauce` (global role) |
| Granted | per store (store role) | globally (global role) |
| Sees | **Daily plan** page only | **every page**: Daily plan · Weekly grid · Recipes · Full report |
| Can do | read & confirm **their** store's plan | everything: confirm any plan, set weekly judgements, manage recipes, read all stores |
| Sidebar / bottom-nav entry | shown (opens Daily plan, no tab bar) | shown (all tabs) |
| Anyone else | no entry, `/dough-sauce` and `/dough-sauce/report` show the no-access card | |

A user holding **neither** permission sees nothing. Super admins bypass everything (`canAccessRoute`).
The frontend never decides by role *name* — it asks the pizzasys rules (contract §2).

## 2. Role × endpoint matrix (13 endpoints)

| # | System | Method & path | Page / action | Store Manager | Specialist |
|---|---|---|---|:-:|:-:|
| 1 | audit (QA) | `GET /stores/{store_id}/dough-sauce/plan` | Daily plan — state, default buffers | ✅ own store | ✅ |
| 2 | audit (QA) | `POST /stores/{store_id}/dough-sauce/plan` | Confirm / re-confirm plan | ✅ own store | ✅ |
| 3 | audit (QA) | `GET /dough-sauce/plans` | Weekly grid · Report · who hasn't confirmed | ❌ | ✅ |
| 4 | audit (QA) | `GET /stores/{store_id}/dough-sauce/week` | One store's week (no UI caller yet) | ❌ | ✅ |
| 5 | audit (QA) | `PUT /stores/{store_id}/dough-sauce/judgement` | Stickers / Dough quality / note | ❌ | ✅ |
| 6 | data | `GET /stores/{store_id}/dough-sauce/daily-plan` | Daily plan — base, source days, unmapped | ✅ own store | ✅ |
| 7 | data | `GET /dough-sauce/ingredients` | Labels, divisors, inventory codes (background) | ✅ ⚠ see finding 1 | ✅ |
| 8 | data | `GET /dough-sauce/recipes` | Recipes tab | ❌ | ✅ |
| 9 | data | `POST /dough-sauce/recipes` | Add recipe (Recipes tab, "Add recipe" on unmapped items) | ❌ | ✅ |
| 10 | data | `PUT /dough-sauce/recipes/{recipe}` | Change a recipe | ❌ | ✅ |
| 11 | data | `DELETE /dough-sauce/recipes/{recipe}` | Close a recipe | ❌ | ✅ |
| 12 | inventory | `GET /inventory/stores/{store_id}/counts` | Daily plan — plan vs count; per-store fallback | ✅ own store | ✅ |
| 13 | inventory | `GET /inventory/counts` _(new)_ | Weekly grid / report — every store in one call | ❌ `403` by design | ✅ |

Manager endpoints = **#1 #2 #6 #7 #12**. Everything else is Specialist.

## 3. Pizzasys rules to register (copy-paste)

All: **Priority 1**, **Route Name** `-` (except #13, see below). "Scoped" = `store_scope_mode: scoped`.

| # | Service | Method | Path DSL | Path regex | Permissions (any) | Store scope |
|---|---|---|---|---|---|---|
| 1 | QA | GET | `/stores/*/dough-sauce/plan` | `#^/stores/[^/]+/dough\-sauce/plan$#` | `dough and sauce` | Scoped |
| 2 | QA | POST | `/stores/*/dough-sauce/plan` | `#^/stores/[^/]+/dough\-sauce/plan$#` | `dough and sauce` | Scoped |
| 3 | QA | GET | `/dough-sauce/plans` | `#^/dough\-sauce/plans$#` | `dough and sauce` | None |
| 4 | QA | GET | `/stores/*/dough-sauce/week` | `#^/stores/[^/]+/dough\-sauce/week$#` | `dough and sauce` | Scoped |
| 5 | QA | PUT | `/stores/*/dough-sauce/judgement` | `#^/stores/[^/]+/dough\-sauce/judgement$#` | `dough and sauce` | Scoped |
| 6 | Data | GET | `/stores/*/dough-sauce/daily-plan` | `#^/stores/[^/]+/dough\-sauce/daily\-plan$#` | `dough and sauce` | Scoped |
| 7 | Data | GET | `/dough-sauce/ingredients` | `#^/dough\-sauce/ingredients$#` | `dough and sauce` | **None** _(was Scoped — finding 1)_ |
| 8 | Data | GET | `/dough-sauce/recipes` | `#^/dough\-sauce/recipes$#` | `dough and sauce` | None |
| 9 | Data | POST | `/dough-sauce/recipes` | `#^/dough\-sauce/recipes$#` | `dough and sauce` | None |
| 10 | Data | PUT | `/dough-sauce/recipes/*` | `#^/dough\-sauce/recipes/[^/]+$#` | `dough and sauce` | None |
| 11 | Data | DELETE | `/dough-sauce/recipes/*` | `#^/dough\-sauce/recipes/[^/]+$#` | `dough and sauce` | None |
| 12 | Inventory | GET | `/inventory/stores/*/counts` | `#^/inventory/stores/[^/]+/counts$#` | `dough and sauce` | Scoped |
| 13 | Inventory | GET | `/inventory/counts` | `#^/inventory/counts$#` | `dough and sauce` | **All stores** _(was None — finding 2)_, route name `inventory.counts.index` |

## 4. Findings in the rules as pasted (to fix in pizzasys)

1. **#7 ingredients is "Scoped" but its path has no store.** A scoped rule with no store is denied by the rule
   engine (and the server reads the store out of the path by parameter name). A storeless route can't be satisfied
   by a store-level permission under *either* mode. _(Now scoped with a global fallback and `dough and sauce` only.)_
   Without it, or the app falls back to its built-in inventory codes (`lib/dough-sauce/ingredient-map.ts`) —
   which it already does silently when this call fails, so nothing breaks either way.
2. **#13 should be `all_stores`**, not `None` (04-WHATS-NEW: route name `inventory.counts.index`,
   `store_scope_mode "all_stores"` = "user must see every active store"). Until registered it returns `403` for
   everyone and the Weekly grid falls back to per-store counts.
3. _(Resolved 2026-10-09: confirm now needs `dough and sauce`; `reports view` no longer opens any dough & sauce route.)_ **#2 confirm was authorised by `reports view`** — a generic read permission can write (confirm) for its stores.
   Accepted by decision (`reports view` = Store Manager); if `reports view` is held by other roles they can also
   confirm Dough & Sauce plans for their stores. A dedicated permission (e.g. `dough and sauce plan`) would close this.
4. **A Specialist holds `dough and sauce` globally, but #1 #2 #4 #5 #6 #12 are "Scoped".** The frontend engine
   evaluates a scoped rule against **store-level** permissions only. So the app never uses a scoped per-store rule
   to *detect* the Specialist — it uses the unscoped #3. (If the server also requires a store-level grant for those
   routes, the Specialist needs the permission at store level too — check on the first real login.)

## 5. How the frontend decides

`canAccessRoute({ service, method, path, storeId })` (`lib/auth/can-access.ts`): finds the highest-priority active rule
matching service + method + path regex → **scoped**: needs `storeId`, checks only `storePermissions[storeId]` →
**none / all_stores**: store set first (if a `storeId` is passed) then global. `storeId` is the **numeric** store id
(`overviewStores[].id`), never the `03795-…` text code.

| Question | Check |
|---|---|
| Is this user a Specialist? | #3 (unscoped, no store → global `dough and sauce`) |
| Can this user open Daily plan? | Specialist **or** #1 passes for any of their stores |
| Weekly grid · Full report | Specialist (#3) |
| Recipes tab | #8 |
| Confirm plan in store S | Specialist **or** #2 for S |
| Set judgements for store S | Specialist **or** #5 for S |
| Add / change / close recipe | #9 / #10 / #11 |

Wiring: tabs → `dough-sauce/page.tsx` (single allowed tab ⇒ no tab bar; a disallowed `?tab=` falls back to the first
allowed one); report page guard → `dough-sauce/report/page.tsx`; nav → `sidebar.tsx` + `bottom-nav-items.ts`
(`requirements`); actions → `daily-plan-view`, `weekly-grid-view`, `weekly-report-view`, `recipes-view`.
The server stays the authority: a `403` still renders the existing no-access states.

## 6. Test it

- `node --experimental-strip-types` script feeding the 13 rules above + fixture users into `buildDoughSauceAccess`
  (manager / specialist / none / store-level-only) — all expectations are in section 1–2.
- In the app, with real accounts: a Store Manager sees the sidebar entry → Daily plan, no tab bar,
  `?tab=weekly` and `/dough-sauce/report` show "no access"; a Specialist sees all four pages and every action.
- `/dashboard/auth-rules` → row menu → **Test** only checks path-DSL matching, not permissions or scope.
