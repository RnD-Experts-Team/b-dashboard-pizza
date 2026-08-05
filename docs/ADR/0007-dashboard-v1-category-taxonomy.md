# ADR 0007: Dashboard V1 Category Color Taxonomy & Dual-Mount View Toggle

## Status
Accepted (patterns) — note Dashboard V1 itself is still actively iterating (footer reads "V1.2 Beta" as of 2026-08-04)

## Date
2026-08-04

## Context
Dashboard V1 (`components/dashboard-v1/**`) is a presentation-layer re-skin of the existing DSPR dashboard — it reuses 100% of the DSPR data layer (hooks, services, routes) and adds no new data system. Building it surfaced two reusable UI patterns that don't exist elsewhere in the codebase and aren't covered by ADR 0005 (Theme System v2) or ADR 0006 (Dashboard Personalization):

1. Every other dashboard area hardcodes colors per-component (e.g. one chart picks its own hex values, one card picks its own `text-emerald-600`). This doesn't scale as the number of card types grows and produces visual drift between related cards.
2. Users need to switch between the classic DSPR dashboard and the new Dashboard V1 layout without a jarring refetch or loading flash, since both read from the same (already-fetched) DSPR hooks.

## Decision

### Category Color Taxonomy (`components/dashboard-v1/category.ts`)
Define a single object per business category — `sales`, `operations`, `menu`, `people`, `finance`, `quality` — that owns every color a card in that category needs: text/icon accent, icon background, left border, gradient wash, card border, and a 3-step chart color ramp. A card declares its category once; every visual property derives from that one lookup instead of being hand-picked per component.

| Category | text/icon accent | left border | chart ramp |
|---|---|---|---|
| `sales` | `text-emerald-600 dark:text-emerald-400` | `border-l-emerald-500` | `#10b981` `#34d399` `#a7f3d0` |
| `operations` | `text-sky-600 dark:text-sky-400` | `border-l-sky-500` | `#0ea5e9` `#38bdf8` `#bae6fd` |
| `menu` | `text-amber-600 dark:text-amber-400` | `border-l-amber-500` | `#f59e0b` `#fbbf24` `#fde68a` |
| `people` | `text-violet-600 dark:text-violet-400` | `border-l-violet-500` | `#8b5cf6` `#a78bfa` `#ddd6fe` |
| `finance` | `text-rose-600 dark:text-rose-400` | `border-l-rose-500` | `#f43f5e` `#fb7185` `#fecdd3` |
| `quality` | `text-cyan-600 dark:text-cyan-400` | `border-l-cyan-500` | `#06b6d4` `#22d3ee` `#a5f3fc` |

**Decision:** Adding a new card category means adding one entry to `category.ts` — never hand-picking colors on a per-card basis. Recommended for any future dashboard area with more than ~4 related card types.

### Dual-Mount View Toggle (`components/dspr/dashboard-view-toggle.tsx`)
The main dashboard page mounts both `DsprDashboard` and `DashboardV1` simultaneously and toggles visibility with CSS, rather than conditionally rendering one or the other. Both components read from the same already-fetched hooks (`useWbrCard`/`useDspr`, `useManagerDashboard`, `useHooksWbr`), so a conditional-render toggle would force a refetch (or a loading flash) every time the user switches views.

**Decision:** For any future "alternate view of the same data" toggle, mount both variants and hide the inactive one via CSS rather than conditionally rendering — the data layer is shared, so unmounting is pure loss with no memory benefit worth the refetch cost.

## Consequences

### Positive
- Recoloring or adding a card category is a one-line change in `category.ts`, not a hunt-and-replace across components.
- View toggling is instant, with no loading flash and no duplicate network requests.
- Establishes a reusable pattern for future "reskin" features that sit on top of an existing data layer.

### Negative
- Both dashboard variants stay mounted (and in the DOM) simultaneously, costing some extra render/memory overhead versus a true conditional unmount.
- The category taxonomy is Dashboard V1-local (`components/dashboard-v1/category.ts`) — other dashboards (DSPR classic, Manager Dashboard) still hardcode colors per-component; this ADR does not retroactively migrate them.

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Category object grows unbounded with unrelated one-off styling | Keep the object to the documented color/gradient properties; anything else belongs on the component |
| Dual-mount pattern copied for toggles with genuinely different/expensive data sources | Only appropriate when both variants share the same hook/service layer — flag in code review otherwise |

## Related ADRs
- ADR 0005: Theme System v2 (the OKLCH/semantic-token system Dashboard V1's Tailwind utility classes map to)
- ADR 0006: Dashboard Personalization System (unrelated data/store layer — Dashboard V1 has zero imports from `lib/dashboard/store/**`, confirmed via grep)
