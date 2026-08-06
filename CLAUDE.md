# CLAUDE.md

Guidance for Claude Code (and any developer) working in this repo. This file is a map and rulebook, not an encyclopedia — it states what can't be safely inferred and points elsewhere for the rest.

## Project Snapshot

- Next.js 16 (App Router), React 19.2, TypeScript (`strict: true`), pnpm.
- Tailwind CSS v4 — **CSS-first config, there is no `tailwind.config.js`**. All theme tokens live in `app/globals.css`.
- State: **Zustand only** (no React Query / SWR yet, despite `docs/ARCHITECTURE.md` calling it "future").
- UI kit: shadcn/ui, `"new-york"` style (see `components.json`).
- Flat root layout — no `src/` directory. Path alias: `@/*` → repo root.
- For business-domain concepts (roles, DSPR, keys, sensors, stores, QA) see `docs/pizza-dashboard-docs/` (a VitePress site) — that's the current source of truth for *what the features do*. This file is about *how the code and UI are built*.

## ⚠️ Stale Docs — Do Not Trust (and Freshness Notes)

- `README.md` is unmodified template boilerplate (demo credentials, generic copy). It does not describe this project. Don't use it for onboarding and don't propagate its claims.
- `docs/BACKEND-INTEGRATION*.md` describes an earlier "mock data, backend-agnostic" phase that no longer exists — the app now calls dozens of live external APIs (Laravel/Django-style backends). Don't use it to infer current API behavior.
- `docs/DEVELOPER-GUIDE.md` and `docs/ARCHITECTURE.md` each carry a `_Last updated: YYYY-MM-DD_` line under their H1 — check it before trusting either blindly; these two were themselves ~7 months stale as of 2026-08-04 (silently missing three feature areas built in the meantime) until refreshed on that date. Don't assume "current" just because a doc looks authoritative — check the date line.
- `docs/ADR/*` records point-in-time decisions and doesn't go stale the same way prose docs do — read each ADR's own `## Date` and judge whether the codebase still matches it, rather than trusting the folder as a whole.
- `docs/pizza-dashboard-docs/` (business-domain VitePress site) was last touched 2026-03 and is trustworthy for the topics it covers (roles, DSPR, keys, sensors, stores, QA) — but treat it as silently incomplete on anything built after that, e.g. Dashboard V1, Screen Project, Drive Thru.
- If asked to update docs: fix or flag `README.md` / `BACKEND-INTEGRATION*.md` rather than copying their claims forward, and bump the `_Last updated_` line on `DEVELOPER-GUIDE.md`/`ARCHITECTURE.md` whenever you substantively edit them (see the anti-staleness convention below).

## Core vs Extension Zones

Golden rule: **ADD, don't MODIFY.** Prefer a new file or a wrapper component over editing a Core file.

**Core (do not modify without explicit user approval):**
`lib/config/**`, `lib/theme/**`, `lib/i18n/config.ts` + `request.ts`, `lib/dashboard/store/**` + its types, `components/ui/**`, `components/providers/**`, `proxy.ts`, `i18n/**`.

**Core with a narrow carve-out:**
`components/layout/app-shell.tsx` and `components/layout/topbar.tsx` — the one sanctioned edit is a one-line `<NewOverlay />` mount (app-shell) or a one-line indicator mount in the icon cluster (topbar); everything else in those files stays off-limits. `components/layout/sidebar.tsx` — add nav items only. Precedent already in the codebase: `ScreenProjectPiPOverlay`, `DriveThruOverlay`, `FloatingDebriefButton`, `AnnouncementOnLoadPopup` (mounted in app-shell), `DriveThruButton` (mounted in topbar).

**Extension (safe to add to):**
`app/[locale]/(dashboard)/dashboard/**/page.tsx`, `components/widgets/**`, `components/features/**`, `components/dashboard-v1/**` (Dashboard V1 re-skin, reuses DSPR's hooks/services), `components/dspr/**` (DSPR dashboard — what Dashboard V1 re-skins), `components/screen-project/**` (incl. `drive-thru/**`), `components/cleaning/**` (Cleaning Chart feature — task scheduling/completion, evaluation grid, reports; tab-level access gated by `lib/auth/cleaning-access.ts`, not a feature flag), `lib/api/services/**`, `lib/store/**` (feature-scoped Zustand stores — distinct from the Core `lib/dashboard/store/**`), `lib/notifications/**` (notification → page-segment routing, shared by the bell/panel click-routing and the sidebar unread-dot indicator), `types/**`.

**Anti-staleness convention:** if you add a new top-level `components/<feature>/**` directory, or a new global layout overlay / topbar indicator, add one line to the Extension zone table (or carve-out note) in `docs/DEVELOPER-GUIDE.md` **and** this file, in the same session — don't let it wait months for someone to notice, the way this list itself just had to be backfilled for Dashboard V1/Screen Project/Drive Thru.

Full rationale and edge cases: `docs/DEVELOPER-GUIDE.md`.

## Architecture — 4-Layer Data Flow

This pattern isn't written down anywhere else, so it's spelled out here in full:

```
Component → hook (lib/hooks/use-<feature>.ts)
          → service (lib/api/services/<feature>.service.ts)
          → internal route (app/api/<feature>/.../route.ts)
          → external upstream API
```

- The internal route checks auth via `app/api/_lib/auth.ts`, then forwards to the upstream API using an env-var fallback chain, e.g. `process.env.X_API_URL || process.env.NEXT_PUBLIC_X_API_URL || "<hardcoded prod url>"`. Concrete example: `lib/hooks/use-labor-dashboard.ts` → `lib/api/services/labor.service.ts` → `app/api/hiring-management/[storeId]/labor/[date]/route.ts`. Exact env var names live in `app/api/_lib/` and the individual route files — not enumerated here, they drift.
- For persisted/shared client state (auth, theme, dashboard layout) there's a variant: `Component → hook → Zustand store action → service → axios client → API` (see `lib/auth/auth.store.ts`).
- Rate limiting lives in `app/api/_lib/rate-limit.ts`.
- State management is Zustand only — don't assume request caching/invalidation beyond what `persist` middleware gives the auth/theme/dashboard-layout stores.

## Testing

**No test framework is configured.** No vitest/jest/playwright config, no `*.test.ts(x)`/`*.spec.ts(x)` files, `lib/api/services/__tests__/` is empty. Don't assume tests exist, and don't write instructions that expect `pnpm test` to work unless a framework has just been added.

## i18n Intelligence Gotcha

A custom in-house ESLint plugin (`@b-dashboard/i18n-intelligence`, rule `no-hardcoded-strings`) warns on hardcoded JSX text outside `components/ui/**`. New user-facing strings should go through the i18n system rather than literal JSX text. See `lib/i18n/` for the mechanics.

## Feature Flags

`lib/config/features.config.ts` + `useFeature()` hook / `<Feature name="...">` component gate feature rollout. Check here before assuming something is dead code — it may just be flagged off.

---

## Styling System

The app has a **live, user-editable theme system** — never hardcode a color for anything theme-relevant. Use semantic classes instead.

### Design Tokens & Theming

- Tailwind v4 is CSS-first: no `tailwind.config.js`. All tokens are defined in `app/globals.css` inside `@theme inline { ... }`, mapping CSS custom properties to Tailwind utility names.
- Tokens are OKLCH CSS variables, declared in `:root` and mirrored in `.dark`: `--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--ring`, `--chart-1` through `--chart-5`, `--sidebar`, `--skeleton-base`, `--scrollbar-thumb`, `--radius`.
- **Hard rule:** use the semantic Tailwind classes — `bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-muted-foreground` — never a hardcoded hex or a fixed Tailwind color scale for anything background/border/text-surface related.
- This isn't static: `lib/theme/default-theme.ts` defines 7 full named themes (default, ocean, emerald, obsidian, crimson, amber, finalWithDark2), each with a full light + dark `ThemeColors` set including `shellBackground`. `lib/theme/apply-theme.ts` applies the active theme by setting the same CSS variables inline on `document.documentElement` at runtime. An inline FOUC-prevention `<script>` in `app/[locale]/layout.tsx` applies the saved theme before hydration. Picker UI: `app/[locale]/(dashboard)/dashboard/settings/themes/page.tsx`.

### Dark Mode

- `next-themes`, class-based (`.dark` on `<html>`), with `@custom-variant dark (&:is(.dark *));` declared in `app/globals.css`.
- Convention: always pair a light-mode color with a `dark:` variant, e.g. `text-emerald-600 dark:text-emerald-400`, `bg-emerald-500/15 dark:bg-emerald-500/20`.

### Typography

- Fonts via `next/font/google`: Geist (default sans/UI), Geist Mono, Noto Sans Arabic (RTL).
- User-selectable font pairs — Space Grotesk, Playfair Display, IBM Plex Mono, Oswald, Instrument Sans — switched via `html[data-primary-font="..."]` / `html[data-secondary-font="..."]` attributes (default: Oswald for headings, Instrument Sans for body, unless overridden in `localStorage`). Wired to Tailwind via `--font-sans` / `--font-heading`.
- Headings (`h1`–`h6`, `CardTitle`, `DialogTitle`) always use `font-heading font-semibold`. Page `<PageHeader>` H1 class: `font-heading text-2xl font-bold tracking-tight`; its description uses `text-muted-foreground`.
- Dense dashboard card micro-typography: labels `text-[9px] font-semibold uppercase tracking-wider`, values `text-[11px]` / `text-base` / `text-xl`, all numeric values `tabular-nums`.

### Layout & Spacing

- Page container: `max-w-7xl` when the sidebar is expanded, `max-w-400` when collapsed (Tailwind v4 bare-number spacing = 100rem), both `mx-auto` with `transition-[max-width] duration-300` (`components/layout/app-shell.tsx`).
- Page padding: `px-4 py-4 md:px-6 md:py-6 pb-2`. Standard page root wrapper: `<div className="space-y-6">`.
- `AppShell` supports 4 selectable layout variants (`classic`, `inset`, `floating`, `top-nav`), all sharing the outer canvas color `bg-shell-background/40` (`/50` for floating).
- KPI/metric grids: `grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6`. Dashboard V1 card spans use a `SPAN_CLASS` map (1–4 → `lg:col-span-1..4`).
- Breakpoints actually exercised in the code: `sm` (640px), `md` (768px), `lg` (1024px). `xl`/`2xl` are rare — don't reach for them by default.
- Density: tight dashboard rows use `gap-1` / `gap-1.5` / `gap-2`; normal page sections use `gap-4` / `gap-6`.
- RTL is first-class: `dir={effectiveDir}` on `<html>`, and logical properties are preferred — `ms-1`, `pe-0`, `text-start` instead of `ml-`, `pr-`, `text-left`.

### Component Library

- shadcn/ui "new-york" style + Radix primitives, in `components/ui/*.tsx` (~30 files: button, card, badge, table, dialog, alert-dialog, input, select, dropdown-menu, tabs, sheet, skeleton, sonner toasts, calendar, date-picker, rich-text-editor, etc.).
- Variants via `class-variance-authority` (`cva`) + `cn()` (clsx + tailwind-merge, `lib/utils.ts`).
- Follow shadcn's `data-slot="..."` attribute convention on new components, same as the existing primitives.
- Icons: `lucide-react` exclusively. Small icon boxes inside dashboard cards use `h-3 w-3` / `h-3.5 w-3.5`; `Button`/`Badge` auto-size unlabeled SVGs via `[&_svg:not([class*='size-'])]:size-4`.

### Dashboard V1 Mini Design-System

`components/dashboard-v1/` is a self-contained kit built on top of shadcn — reuse it rather than hand-rolling a new look for V1-style cards.

- `category.ts` defines a 6-category color taxonomy. Every card belongs to exactly one category, and the category owns *all* its colors — recoloring a whole group is editing one object:

  | Category | text / icon accent | iconBg | left border | chart ramp |
  |---|---|---|---|---|
  | `sales` (Sales & Trends) | `text-emerald-600 dark:text-emerald-400` | `bg-emerald-500/15 dark:bg-emerald-500/20` | `border-l-emerald-500` | `#10b981` `#34d399` `#a7f3d0` |
  | `operations` (Operations & Speed) | `text-sky-600 dark:text-sky-400` | `bg-sky-500/15 dark:bg-sky-500/20` | `border-l-sky-500` | `#0ea5e9` `#38bdf8` `#bae6fd` |
  | `menu` (Menu & Product) | `text-amber-600 dark:text-amber-400` | `bg-amber-500/15 dark:bg-amber-500/20` | `border-l-amber-500` | `#f59e0b` `#fbbf24` `#fde68a` |
  | `people` (People & Labor) | `text-violet-600 dark:text-violet-400` | `bg-violet-500/15 dark:bg-violet-500/20` | `border-l-violet-500` | `#8b5cf6` `#a78bfa` `#ddd6fe` |
  | `finance` (Finance & Cash) | `text-rose-600 dark:text-rose-400` | `bg-rose-500/15 dark:bg-rose-500/20` | `border-l-rose-500` | `#f43f5e` `#fb7185` `#fecdd3` |
  | `quality` (Quality & Voice of Customer) | `text-cyan-600 dark:text-cyan-400` | `bg-cyan-500/15 dark:bg-cyan-500/20` | `border-l-cyan-500` | `#06b6d4` `#22d3ee` `#a5f3fc` |

  Each category also carries a `gradient` wash (e.g. sales: `bg-linear-to-br from-emerald-50/80 via-emerald-50/30 to-transparent dark:from-emerald-950/30 dark:via-emerald-950/10 dark:to-transparent`) and `cardBorder` (e.g. `border border-emerald-500/25 dark:border-emerald-400/15`). Add a new category by adding one entry here — don't hand-pick colors on a per-card basis.
- `v1-ui.tsx` — shared content primitives to reuse: `V1SubLabel`, `V1Metric`, `V1MetricGrid`, `V1DataRow`, `V1Progress`, `V1StackedBar`, `V1_TBL`/`V1_TH`/`V1_TD`/`V1_NUM` (compact table classes), `V1Toggle`, `V1Empty`.
- `v1-card.tsx` — `V1Card` is the mandatory shared shell for every V1 card: fixed height, header (icon + title + period badge + optional expand button), scrollable body.
- Cards that support drill-down add `cursor-pointer hover:shadow-md` plus the `.dspr-card-hover` CSS class (defined in `app/globals.css`) for a subtle full-card tint on hover.

### Charts

- ApexCharts (`apexcharts` + `react-apexcharts`), always loaded via `next/dynamic({ ssr: false })` with a `Skeleton` loading fallback — this exact pattern repeats in every chart component (e.g. `components/dspr/sales-chart.tsx`).
- ApexCharts needs literal hex colors, not CSS variables — components branch manually on `next-themes`' `resolvedTheme === "dark"` for `foreColor`, axis border, and grid colors.
- Default 3-series comparison palette: `["#008FFB", "#00E396", "#FEB019"]`. Dashboard V1 cards use their own category's `chartColors` ramp instead — don't mix the two systems.
- A recurring "labor %" traffic-light convention exists (red ≤10% or >39%, yellow/orange mid-range, green 20–24% "good" band) — reuse this semantic coloring for labor-adjacent metrics rather than inventing a new scale.

### Page-Level Conventions

- Loading: route-level `loading.tsx` renders `<PizzaLoader />` (`components/shared/pizza-loader.tsx`) — this is the app-wide loading convention, not a generic spinner.
- Errors: route-level `error.tsx` forces open a shadcn `AlertDialog` with "Try again" (calls `reset()`) and "Go home" — errors are a modal, not an inline banner.
- Standard page shape:
  1. Outer `<div className="space-y-6">`
  2. `<PageHeader title=... description=...>` with controls as header-slot children
  3. Conditional skeleton while loading
  4. Conditional empty state — dashed border, muted icon, instructional copy: `flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center`
  5. Loaded state — KPI summary strip, then `<Tabs>` with a horizontally-scrollable `TabsList` (`-mx-1 overflow-x-auto px-1` wrapper, `h-auto w-max flex-nowrap gap-1 p-1`)
- Dashboard V1 alternate shape: currently renders `DaySummaryStats` (from `components/dspr`) at the top, then a responsive grid of category-colored `V1Card`s. `components/dashboard-v1/index.ts` also exports a `KpiHero` component, but it is not actually used in `dashboard-v1.tsx` as of 2026-08-04 — don't assume it's live without checking.
- `app/[locale]/(dashboard)/dashboard/layout.tsx` already gates on `useAuthStore`, shows `<PizzaLoader />` while resolving, and wraps content in `<AppShell>` plus global overlays (`AnnouncementOnLoadPopup`, `FloatingDebriefButton`, `ScreenProjectPiPOverlay`, `DriveThruOverlay`) — new dashboard pages inherit this and don't need to reimplement it.

---

## Where to Look for More

- Business/domain questions (roles, DSPR, sensors, stores, keys, QA) → `docs/pizza-dashboard-docs/` (current for those topics as of 2026-03; doesn't yet cover Dashboard V1 / Screen Project / Drive Thru)
- Core/Extension zone edge cases and rationale → `docs/DEVELOPER-GUIDE.md` (check its `_Last updated_` line before trusting it)
- Full architecture diagram, naming conventions, decision history → `docs/ARCHITECTURE.md` (check its `_Last updated_` line), `docs/ADR/0001`–`0007`
- Screen Project / Drive Thru deep-dive (LiveKit integration, station management, media library) → `docs/SCREEN-PROJECT.md`
- Dashboard V1's category-color taxonomy and dual-mount view-toggle pattern → `docs/ADR/0007-dashboard-v1-category-taxonomy.md`
- Actual env var names and fallback chains → `app/api/_lib/` and the individual route files (not listed here — they change often)
- Full API/page route inventory (~35 API groups, ~40 dashboard areas) → browse `app/api/**` and `app/[locale]/(dashboard)/dashboard/**` directly
- shadcn/ui config → `components.json`
