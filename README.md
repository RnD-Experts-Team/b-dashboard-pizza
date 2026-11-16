# B-Dashboard (Pizza)

The internal operations dashboard for the pizza-store network. One Next.js app that fronts a set of separate backend services (auth/pizzasys, DSPR, Data, QA, Hiring, Operations, Maintenance, Toolbox, Notifications, Sensors, Screens, Inventory…) and gives store managers, HQ and specialists a single place to run stores day to day.

> **Working on the code?** Read [`CLAUDE.md`](./CLAUDE.md) first — it holds the rulebook (Core vs Extension zones, the 4-layer data flow, styling system) and the per-feature notes. [`docs/DEVELOPER-GUIDE.md`](./docs/DEVELOPER-GUIDE.md) has the long-form version.

## What's in it

Pages live under `app/[locale]/(dashboard)/dashboard/`:

| Area | Routes |
|------|--------|
| **Daily operations** | DSPR dashboard (home), Dashboard V1 (`v1`), Labor, Scheduling, Cleaning Chart, Manager Hub (`due-keys`), Employee Debriefs + history, Break Logger, Calendar, Goals, Announcements |
| **Food & inventory** | Dough & Sauce (+ weekly report), Inventory, Storage, Quality Assurance, Sensors |
| **Maintenance** | Tickets, Trips (plus the public technician page at `/{locale}/trip/[token]`), Payments (`daily-pay` redirects here), Technicians & Suppliers, Analytics, Troubleshooting |
| **Reporting** | Business Reports, WBR Reports, Report Builder (flagged off by default), Custom Reports, Camera Report, Export/Import |
| **Screens** | Screen Project (LiveKit station tiles, Drive-Thru, usage monitoring) |
| **People & access** | Employees + profile, Users, Roles, Permissions, Auth Rules, Skills, Tags, Hierarchy, Stores, User–Store Assignment, Entities & Categories, Assignments, Hiring Requests, Keys, Service Clients |
| **Toolbox** | Tickets (internal), Workbooks, Report a Problem inspector, Store Passport |
| **Settings & dev** | Profile, account, appearance, preferences, themes; Dev Tools (i18n Intelligence) |

Cross-cutting features: English + Arabic with full RTL, a live user-editable theme system (7 named themes, light/dark, JSON import/export), four layout variants (classic, inset, floating, top-nav), a mobile bottom nav, drag-and-drop dashboard personalisation, sound effects, and feature flags (`lib/config/features.config.ts`).

For what each business feature *does* (roles, DSPR, keys, sensors, stores, QA), see the VitePress site in `docs/pizza-dashboard-docs/`. Scheduling has its own reference: [`docs/SCHEDULING-FEATURES.md`](./docs/SCHEDULING-FEATURES.md). Screen Project: [`docs/SCREEN-PROJECT.md`](./docs/SCREEN-PROJECT.md).

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router), React 19.2, TypeScript (`strict`) |
| Styling | Tailwind CSS v4 (CSS-first — tokens in `app/globals.css`, no `tailwind.config.js`) |
| UI | shadcn/ui ("new-york"), Radix, lucide-react |
| State | Zustand (no React Query / SWR) |
| i18n | next-intl (`en`, `ar`) |
| Forms / validation | react-hook-form, Zod 4 |
| HTTP | Axios |
| Charts | ApexCharts (`react-apexcharts`, always `ssr: false`) |
| Realtime / media | LiveKit, Laravel Echo + Pusher (Reverb), MediaPipe (on-device face detection) |
| Other | dnd-kit, TipTap, framer-motion, date-fns, uisfx |
| Package manager | pnpm |

## Getting started

### Prerequisites

- Node.js 20+
- pnpm

### Install and run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/en` (or `/ar`).

There are **no demo credentials**. Login goes through the real auth backend (`NEXT_PUBLIC_API_URL`), so you need an account on the pizzasys environment you point the app at.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm tsc --noEmit` | Type check |
| `pnpm analyze:i18n` | Scan for hardcoded UI strings |
| `pnpm docs:dev` / `docs:build` / `docs:preview` | The VitePress business-domain docs |

Notes:

- **No test framework is configured.** There is no `pnpm test`.
- **`pnpm lint` currently fails** before any rule runs. Use `tsc` for checking and the i18n analyzer for strings.

## Project structure

Flat layout — no `src/`. The `@/*` alias points at the repo root.

```
.
├── app/
│   ├── [locale]/
│   │   ├── (auth)/              # Login and auth pages
│   │   ├── (dashboard)/dashboard/  # All dashboard pages (see table above)
│   │   └── trip/[token]/        # Public technician trip page (no login)
│   └── api/                     # Internal routes: auth check → proxy to upstream
├── components/
│   ├── ui/                      # shadcn primitives (Core)
│   ├── layout/                  # AppShell, Sidebar, Topbar, BottomNav
│   ├── providers/               # Context providers (Core)
│   ├── dspr/  dashboard-v1/     # DSPR dashboard and its V1 re-skin
│   └── <feature>/               # One folder per feature (scheduling, cleaning,
│                                #   dough-sauce, calendar, maintenance-*, storage, …)
├── lib/
│   ├── api/services/            # Per-feature API services
│   ├── hooks/                   # use-<feature> hooks
│   ├── store/                   # Feature-scoped Zustand stores
│   ├── dashboard/store/         # Dashboard layout store (Core)
│   ├── auth/  theme/  config/   # Auth store, theme system, feature flags (Core)
│   ├── i18n/                    # i18n config + locales/{en,ar}.json
│   └── <feature>/               # Pure logic per feature (no React)
├── i18n/                        # next-intl request config
├── proxy.ts                     # Locale routing (next-intl middleware)
├── public/                      # Static assets (incl. vendored MediaPipe files)
├── scripts/                     # analyze-hardcoded-strings.ts
├── types/
└── docs/                        # Guides, ADRs, feature references, VitePress site
```

### Data flow

```
Component → hook (lib/hooks/use-<feature>.ts)
          → service (lib/api/services/<feature>.service.ts)
          → internal route (app/api/<feature>/…/route.ts)
          → external upstream API
```

The internal route validates auth (`app/api/_lib/auth.ts`) and forwards with the user's token. Persisted client state (auth, theme, dashboard layout) goes through Zustand stores instead.

### Core vs Extension

Don't modify Core without approval: `lib/config/**`, `lib/theme/**`, `lib/i18n/config.ts` + `request.ts`, `lib/dashboard/store/**`, `components/ui/**`, `components/providers/**`, `proxy.ts`, `i18n/**`, and (apart from one-line mounts) `components/layout/app-shell.tsx` and `topbar.tsx`. Prefer adding a new file or wrapper. Full list and carve-outs are in `CLAUDE.md`.

## Conventions

- **i18n:** user-facing strings go through next-intl. Add keys to both `lib/i18n/locales/en.json` and `ar.json`, then `useTranslations("section")`. The in-house ESLint rule `no-hardcoded-strings` warns on literal JSX text.
- **RTL:** use logical properties (`ms-*`, `pe-*`, `text-start`), not `ml-*`, `pr-*`, `text-left`.
- **Theming:** use semantic classes (`bg-background`, `text-foreground`, `border-border`, `bg-card`) — never hardcoded colours for surfaces/text. Pair light colours with `dark:` variants. Themes are applied at runtime by `lib/theme/apply-theme.ts`; the picker is at Settings → Themes.
- **Pages:** new dashboard page = `app/[locale]/(dashboard)/dashboard/<name>/page.tsx` inside `<div className="space-y-6">` with a `<PageHeader>`; add the sidebar entry in `components/layout/sidebar.tsx` (nav items only). Loading uses `<PizzaLoader />`, errors use the route `error.tsx` dialog.
- **Dates:** never `new Date()` a date-only string; always show the backend's own error message.
- **Feature flags:** `lib/config/features.config.ts` + `useFeature()` / `<Feature name="…">`. Check there before assuming something is dead code (e.g. `reportBuilder` is off by default, but its pages open by URL).

## Documentation

> Some docs are stale — check the `_Last updated_` line (or ADR `## Date`) before trusting one.

**Current**
- [`CLAUDE.md`](./CLAUDE.md) — rulebook and per-feature notes
- [Developer Guide](./docs/DEVELOPER-GUIDE.md), [Architecture](./docs/ARCHITECTURE.md), [Feature Flags guide](./docs/DEVELOPER-GUIDE-FEATURE-FLAGS.md)
- [Scheduling features](./docs/SCHEDULING-FEATURES.md) · [Scheduling backend guide](./docs/SCHEDULING-BACKEND-GUIDE.md)
- [Screen Project](./docs/SCREEN-PROJECT.md) · [Maintenance UI](./docs/MAINTENANCE-UI.md) · [Dough & Sauce access](./docs/DOUGH-SAUCE-ACCESS.md) · [Authorization dev guide](./docs/AUTHORIZATION-DEV-GUIDE.md) · [Calendar event priority](./docs/CALENDAR-EVENT-PRIORITY.md) · [Security](./docs/SECURITY.md)
- [`docs/pizza-dashboard-docs/`](./docs/pizza-dashboard-docs/) — business-domain VitePress site (roles, DSPR, keys, sensors, stores, QA; last updated 2026-03, doesn't yet cover Dashboard V1 / Screen Project / Drive-Thru)

**Decisions (ADRs)** — [0001 State](./docs/ADR/0001-state-management.md), [0002 API layer](./docs/ADR/0002-api-layer.md), [0003 Routing](./docs/ADR/0003-routing-layouts.md), [0004 Localization](./docs/ADR/0004-localization.md), [0005 Theme v2](./docs/ADR/0005-theme-system-v2.md), [0006 Personalization](./docs/ADR/0006-dashboard-personalization.md), [0006 i18n Intelligence](./docs/ADR/0006-i18n-intelligence.md), [0007 Dashboard V1 taxonomy](./docs/ADR/0007-dashboard-v1-category-taxonomy.md)

**Historical — don't use for current behaviour:** the `docs/BACKEND-*.md` files describe an earlier mock-data phase that no longer exists (the app now calls live APIs); `PLAN*.md` / `TASKS*.md` are old planning notes.

## License

MIT
