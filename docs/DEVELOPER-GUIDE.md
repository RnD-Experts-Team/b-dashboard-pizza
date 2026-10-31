# B-Dashboard Developer Guide

_Last updated: 2026-10-30 (bump this whenever you substantively edit this file)_

> **⚠️ IMPORTANT: This document defines what parts of the codebase are considered CORE infrastructure and should NOT be modified by developers or AI agents who want to maintain sync compatibility with upstream.**

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Core vs Extension Zones](#core-vs-extension-zones)
- [Do Not Modify (Core Infrastructure)](#do-not-modify-core-infrastructure)
- [Safe to Modify (Extension Points)](#safe-to-modify-extension-points)
- [Feature Flags System](#feature-flags-system)
- [Dashboard Personalization System](#dashboard-personalization-system)
- [Theme System](#theme-system)
- [Localization System](#localization-system)
- [i18n Intelligence (Dev Tools)](#i18n-intelligence-dev-tools)
- [Adding Features Without Breaking Sync](#adding-features-without-breaking-sync)

---

## Architecture Overview

B-Dashboard is built as a **foundation template** with clearly defined boundaries between:

1. **Core Infrastructure** - Framework setup, shared utilities, base layouts
2. **Extension Points** - Where you add your business logic, pages, widgets

```
┌─────────────────────────────────────────────────────────────┐
│                     YOUR CODE                                │
│  (Pages, Widgets, Business Logic, Custom Components)         │
├─────────────────────────────────────────────────────────────┤
│                  EXTENSION POINTS                            │
│  (Widget Registry, Translation Keys, Custom Themes)          │
├─────────────────────────────────────────────────────────────┤
│               CORE INFRASTRUCTURE ⛔                         │
│  (Theme System, i18n Engine, Dashboard Store, Base Layouts)  │
└─────────────────────────────────────────────────────────────┘
```

---

## Core vs Extension Zones

### 🔴 Core Zone (DO NOT MODIFY)

These files form the foundation and MUST NOT be modified to maintain GitHub sync compatibility:

| Path | Purpose |
|------|---------|
| `lib/config/**` | Feature flags configuration system |
| `lib/theme/**` | Theme System v2 engine |
| `lib/i18n/config.ts` | i18n configuration |
| `lib/i18n/request.ts` | Server-side i18n |
| `lib/dashboard/store/**` | Dashboard state management |
| `lib/dashboard/types/**` | Dashboard type definitions |
| `lib/dashboard/registry/widget-registry.ts` | Base widget registry (only ADD, don't modify existing) |
| `lib/dashboard/registry/skeleton-registry.ts` | Skeleton component mapping |
| `components/ui/**` | shadcn/ui base components |
| `components/layout/app-shell.tsx` | Main shell structure — ⚠️ global overlay mounts only, see carve-out below |
| `components/layout/sidebar.tsx` | Sidebar navigation (structure only) |
| `components/layout/topbar.tsx` | Top navigation bar — ⚠️ indicator mounts only, see carve-out below |
| `components/providers/**` | Context providers |
| `components/dashboard/draggable-widget.tsx` | Drag-drop wrapper |
| `components/dashboard/widget-grid.tsx` | Widget grid with DnD context |
| `components/dashboard/edit-mode-toolbar.tsx` | Edit mode controls |
| `components/dashboard/skeletons/**` | Skeleton loading components |
| `app/[locale]/(dashboard)/layout.tsx` | Dashboard layout wrapper |
| `app/[locale]/(auth)/layout.tsx` | Auth layout wrapper |
| `proxy.ts` | Routing proxy (formerly middleware) |
| `i18n/**` | next-intl configuration |

### 🟡 Configurable Zone (EDIT CONFIG ONLY)

These files can be configured but the structure should not change:

| Path | Purpose |
|------|---------|
| `lib/config/features.config.ts` | Enable/disable features (edit `enabled` values) |

### 🟢 Extension Zone (SAFE TO MODIFY)

These areas are designed for customization:

| Path | Purpose |
|------|---------|
| `app/[locale]/(dashboard)/dashboard/**/page.tsx` | Your dashboard pages |
| `components/widgets/**` | Your custom widget components |
| `components/features/**` | Your feature-specific components |
| `lib/i18n/locales/en.json` | ADD new translation keys |
| `lib/i18n/locales/ar.json` | ADD new translation keys |
| `lib/api/services/**` | Your API service files |
| `components/dashboard-v1/**` | Dashboard V1 re-skin components — reuses DSPR's hooks/services, no new data layer |
| `components/dspr/**` | DSPR dashboard components (data source for the classic dashboard and Dashboard V1) |
| `components/screen-project/**` | Screen Project live-video monitoring (incl. `drive-thru/**` global hotline overlay, `usage/**` per-tile usage probe, `monitoring/**` HQ usage report) |
| `lib/screen-usage/**` | Screen Project usage monitoring pure logic: fire-and-forget recorder (managers' mic/camera/main-screen segments → ScreensPizza) with an exact, crash-safe localStorage journal, plus the report's types, formatting and chart colours (the report is aggregated server-side, across stores) — see `docs/SCREEN-PROJECT.md` §16 |
| `components/scheduling/**` | Weekly scheduling grid, wired to the OperationsPizza API. `day-view.tsx` / `month-overview.tsx` are PARKED — kept on disk but not mounted; the week grid is the only live view |
| `components/skills/**` | Employee skills (OperationsPizza, through the scheduling proxy): the employee profile's Skills tab, the `/dashboard/skills` overview (several stores via `GET /v1/skills/overview?storeIds[]=`, the /employees-style filter row, a KPI strip, cells rated in place) and the shared skills list; the schedule grid shows a read-only skills chip per employee (`components/scheduling/employee-skills-summary.tsx`). Pure filter/stat logic lives in `lib/skills/**`. A minor rated on a skill with a `min_age` (Dough, Landing) is only WARNED about, never blocked; the API returns `is_minor`/`restricted`/`alert`, never the birth date |
| `lib/scheduling/**` | Scheduling support: presentation constants, week identity + date-display helpers, snake_case API adapters, error parsing |
| `components/cleaning/**` | Cleaning Chart feature (task scheduling/completion, evaluation grid, reports) — tab visibility gated by `lib/auth/cleaning-access.ts`, not a feature flag |
| `components/dough-sauce/**` | Dough & Sauce (QA Management → `dashboard/dough-sauce`): daily plan, all-stores confirmation, weekly grid/score/rank, recipes, plus a compact all-stores weekly report page (`dashboard/dough-sauce/report`, `weekly-report-view.tsx`). Spans three backends — AuditApp (`QA_API_URL`, via `app/api/dough-sauce/**`), LC_PIZZA_DATA (`DATA_API_URL`, same routes), inventory counts (`app/api/inventory/stores/[storeId]/counts` for one store — Daily plan, entry "Plan vs counted" — and `app/api/inventory/counts` for EVERY store in one call, which the Weekly grid uses; it has no store parameter, so a store manager gets 403 by design and the grid falls back to the per-store route; `plan_date` is a production date in the future, `date_from`/`date_to` are counting dates in the past — never one variable for both). The client computes variance/score/progress/rank; weeks always come from the server's `weeks` list; a missing count is never rendered as 0. Access follows the pizzasys auth rules (`lib/dough-sauce/access.ts`, `useDoughSauceAccess`): a worker with `dough and sauce` at a store → that store's Daily plan; Specialist (`dough and sauce` globally) → every page and action; `reports view` alone (Store Manager) → nothing — see `docs/DOUGH-SAUCE-ACCESS.md`; a 403 still shows that tab's no-access state |
| `lib/dough-sauce/**` | Dough & Sauce pure logic: `formulas.ts` (contract §6 — weights are constants: variance 0.50, plan confirmed on all 7 days 0.10 (all or nothing), stickers 0.20, dough quality 0.20; a count is judged against the BASE via `targetQty`, never the buffered `planned_qty`; the score's variance part divides by the cells actually judged — planned cells due a count, plus unplanned days that were counted and checked against their on-demand base (see `unplannedCountedDays`; bases come from ONE all-stores `daily-plans` request, falling back to one `daily-plan` request per day; a day is judged on the first-shift `morning_count` of that day when one was entered (0 counts) — typed in raw portions so ÷12 (10 OZ only) / as typed (sauce, 18 OZ — the sauce is NOT ÷80, user 2026-10-29) — which REPLACES the night count; `null` = not counted, so the night count is used; the Daily plan shows ONE "On hand" check cell (what it was judged on, which count was used, short/over chip), and the Weekly grid + report read the morning counts from the same all-stores `daily-plans` request via `lookupDays`), `cellsScored`, not 21), `week-cells.ts` (7×3 cell grid, counted/missing/no-plan kept distinct; a plan dated D is paired with the count dated D − 1), `ingredient-map.ts` (ultimatrix id ⇄ ingredient key, from `inventory_ref` with a documented fallback), `dates.ts` (calendar days only, nothing week-related), `access.ts` (who sees which Dough & Sauce page/action, from the pizzasys auth rules) |
| `lib/store/**` | Feature-scoped Zustand stores (e.g. `dspr.store.ts`, `selected-store.store.ts`, `drive-thru.store.ts`, `cleaning.store.ts`) — distinct from the Core `lib/dashboard/store/**` |
| `lib/notifications/**` | Notification → page-segment routing helper, shared by notification click-routing and the sidebar unread-dot indicator; `notification-groups.ts` — the feature groups behind the bell panel's type-filter chips (and their red unread dots) |
| `components/uisfx/**` | Sound-fx UI: global click-sound + unlock singleton (`sound-fx-init.tsx`, mounted once in AppShell), topbar mute toggle (`sound-toggle.tsx`) |
| `lib/uisfx/**` | Sound-fx logic: `sound.store.ts` (persisted Zustand preferences — pack/volume/enabled), `client.ts` (lazy `uisfx` singleton), `sync.ts` (store→library side effects), `play.ts` (`playSfx(cue)` call-site helper, gated on the `soundFx` feature flag + enabled + unlocked) |
| `lib/nav/**` | Bottom-nav-eligible link list + permission filtering (`bottom-nav-items.ts`, `bottom-nav-access.ts`) for the mobile/tablet `BottomNav` bar — mirrors `sidebar.tsx`'s nav metadata/order independently rather than importing from that Core file, gated on the `mobileBottomNav` feature flag |
| `components/maintenance-tickets/**` | Maintenance tickets: the list (flat filter row, attention chips) and the ticket page after the owner's mockup — header, 8-dot progress strip, tabs Overview / Work / Costs / Activity (`?tab=`, `?issue=`), and a sticky footer whose primary button is the server's `workflow.next[0]`; every workflow action is ONE small dialog with only its fields. The workflow runs per issue (statuses new → in_review → waiting_on_store → inspection → waiting_approval → scheduled → work_done → closed / cancelled). Screens and UX rules: `docs/MAINTENANCE-UI.md`; API: `../MaintenancePizza/docs/MAINTENANCE.md` |
| `lib/maintenance-workflow/**` | Workflow pure logic, no React: the 8-dot strip, action labels/icons, the close checklist and its exempt resolutions, whose turn, overdue, attention chips, status tones |
| `lib/maintenance-tickets/**` | Ticket-list helpers: filters ⇄ query string, and technician ranking that only reads the server's `standing` (ranking happens server-side) |
| `components/maintenance-trips/**` | Trips — how technicians clock their time. `/dashboard/maintenance-trips`: On the clock now / Today & upcoming / History, the New trip dialog, and the trip drawer (link Copy/Share/New link, stops, sessions with paid time, purchases, audits; every correction needs a reason). A link can only be copied when it is issued — the server keeps only its hash |
| `components/trip-portal/**` | The PUBLIC technician page `app/[locale]/trip/[token]` (outside `(dashboard)`, no login), proxied by `app/api/public/maintenance-trips/[token]/**` with no user token. Mobile-first: one giant Clock in / Clock out button, ≥ 48 px controls, full-page expired / not-found / offline states |
| `lib/maintenance-trips/**` | Trips pure logic: durations formatting, the trip link URL and share text, state → big buttons, office-side state from the open session |
| `components/maintenance-payments/**` | Payments — one payment = one invoice we paid, to ONE technician or supplier, split into typed lines per store. The page (filters in the URL, Unpaid work panel), the shared `PaymentDialog` (also opened from the ticket Costs tab and Storage "Parts bought") where each line's type is a Select that reveals its one-sentence explanation and only its fields, and the detail sheet. `/dashboard/daily-pay` redirects here |
| `lib/maintenance-payments/**` | Payments pure logic: which fields each line type shows, the form state (lines, sessions → hours, typed-over flag, prefills from unpaid work / a ticket / storage), client-side preview totals (the server is authoritative), 422 → field errors, filters ⇄ URL |
| `components/maintenance-technicians/**` + `components/maintenance-suppliers/**` | Technicians & Suppliers (`?tab=`): technicians with an editable category, emergency availability, hourly rate, stores and issues covered with a ★ per issue (overall = average); suppliers are where parts are bought. Names are unique ignoring case and spaces — live check via `lib/maintenance/names.ts` |
| `components/maintenance-analytics/**` | Analytics (`?tab=` overview, finances, coverage): shared filter bar, finances charts and ranked bars (every chart has "Show as table"), the store × issue coverage grid with gaps marked by icon + word |
| `lib/maintenance/**` | Shared Maintenance words and helpers: `vocabulary.ts` (technician never "payee"; Bought / Used / Returned / Moved / Opening stock / Stock count / Damaged or lost), `money.ts`, `names.ts` (the backend's name key) |
| `components/storage/**` | Storage — GLOBAL (not store-scoped). Tabs Stock / Movements / Stock counts / Locations, the part sheet (details, serial-numbered units, price history), Record stock (one small dialog per action; "Parts bought" opens the payment dialog), and the count sheet at `dashboard/storage/counts/[id]` |
| `lib/storage/**` | Stock pure logic, no React: `movement-types.ts` (the type→direction table), `stock-actions.ts` (what people say happened → movement type, so the jargon never reaches the screen), `stock-forms.ts` (fields per action, checks, request body), `stock-count.ts` (differences, values, totals), `storage-url.ts`. A mistaken movement STILL COUNTS toward every balance — the correction is its Undone movement |
| `components/store-passport/**` | Store Passport — the topbar dialog describing the selected store (identity/contact, trading hours, team, facilities, and an access tab of shared logins and door codes, masked behind per-row reveal). Static placeholder data for now, from `lib/mock/store-passport.mock.ts` |
| `components/layout/topbar-tools-cluster.tsx` | The collapsible topbar drawer holding `BreakTimerButton` + `StorePassportButton`. Forces itself open while a break is running (read from `useBreaksStore().active`), so the live counter is never hidden |
| `components/calendar/**` | Calendar — the store calendar (birthdays, cleaning, shifts, anniversaries, maintenance, meetings) at `/dashboard/calendar` (sidebar Toolbox group + bottom-nav mirror) and `CalendarTopbarButton` (topbar, next to Drive-Thru: today badge + Today panel). Ported from `../calendar-template` into React. `?view=`/`?date=` live in the URL; filters/scope/seen-day persist in `lib/store/calendar.store.ts`. ONE page-wide peek popover (`event-peek.tsx`, virtual anchor) serves every event — don't give events their own Popover. On sm+ `use-fit-height.ts` measures the space the shell's scroller leaves (any of the four layout variants) and sizes the page to it, so the page never scrolls and only the calendar body does — don't reintroduce a `calc(100dvh - …)` height. Deliberately MONOCHROME: a category's colour is only ever a small dot. Seven types; the last, a neutral "other", can be named per event (`typeLabel`, user events only). Adding a category means a `calendar-prefs` persist-version bump + migrate, or users who had every type on will have the new one filtered out. Mock data through `lib/api/services/calendar.service.ts` (the single swap point for a real API). CRUD: only events people create (`source: "user"`, stored by `lib/mock/calendar-user-events.mock.ts` in localStorage) are editable; system events stay read-only. `event-dialog.tsx` is the single add/edit form. Adding is deliberately GLOBAL, not per-day: the page's New event button (or `N`), and the topbar calendar panel's New event, which opens the same dialog on any dashboard page; writes go through `useCalendarMutations`, which bumps the store's `revision` so every mounted view refetches; every delete asks first (`delete-event-dialog.tsx`, an AlertDialog stacked over the editor so Cancel returns to the form), then shows an Undo toast |
| `lib/calendar/**` | Calendar pure logic: types, the category taxonomy (`categories.ts`, owns every category colour), date-fns date math (`dates.ts`, week starts Monday), and the layout engines (`layout.ts`: `byDay`, the month/all-day `lanes` packer with "+N more" splitting, the hour-grid `overlapLayout`). No React |
| `components/break-logger/**` | Breaks — self-service break timer on ToolboxPizza's API (proxied by `app/api/toolbox/**`, base `TOOLBOX_API_URL`, which already ends in `/api/v1`). The topbar popover body, the `/dashboard/break-logger` page (Today / History / Settings), and the entry, notes, delete and export dialogs. `BreakTimerButton` owns the only poller (`lib/hooks/use-breaks.ts`), which runs only while a break is open. `GET breaks/active` and `GET breaks/day` WRITE upstream — never prefetch or cache them |
| `lib/break-logger/**` | Breaks pure logic, no React: `errors.ts` (normalises domain / Laravel-validation / not-found / proxy error bodies into a code-keyed `BreakError`), `work-date.ts` (work-date math from the server's `cutoff_hour` + `timezone` — never hardcoded), `payload.ts` (manual-entry body, changed-keys-only update body — `ended_at: null` reopens a break — and the history query with `0`/`1` booleans) |
| `components/workbooks/**` | Workbooks (ToolboxPizza, via `app/api/toolbox/**` and `TOOLBOX_API_URL`): nested folders → user-defined tables (typed columns + rows), each folder/workbook/row carrying a visibility tag where the most restrictive tag up the chain wins. Folder browser at `dashboard/workbooks` (`?folder=`), grid at `dashboard/workbooks/[workbookId]`. Every control renders from the server's `viewer.can` and explains a refusal from `effective_visibility.capped_by` — never re-derive the tag rules client-side. A read 404 means "not found OR no access", never "deleted". The sidebar "Toolbox" item (and its bottom-nav mirror) is gated on the Toolbox `GET /v1/workbook-folders` auth rule, probed with no storeId because the path carries none; the page adds no gate of its own and the upstream still filters every list to what the caller may see |
| `lib/workbooks/**` | Workbook pure logic, no React: `errors.ts` (error kind from the server's `error.code`, 422 flattening, the 409 force-delete counts, cell type-mismatch `allowed` values), `cells.ts` (per-type display/editor values — dates read from the ISO string's calendar part, never `new Date()`; numbers stay strings), `columns-diff.ts` (column editor model; the columns endpoint is a WHOLE-LIST replace, so this works out which columns a save would delete), `roles.ts` (trim + de-dupe only), `grid-url.ts` (grid query ⇄ URL) |
| `components/toolbox-tickets/**` | Tickets (ToolboxPizza, via `app/api/toolbox/tickets`, `stores/[storeId]/tickets/**`, `ticket-sections/**`, `ticket-levels/**`, `ticket-assignments/**` and `TOOLBOX_API_URL`): raise a ticket against a section KEY and it routes itself to that section's assignees at that store. Page at `dashboard/tickets` (My inbox / Store queue / Admin tabs, filters in the URL), ticket at `dashboard/tickets/[ticketId]?store=CODE`; a link without `store` (notification deep links `/toolbox/tickets/{id}`) resolves the store through the inbox. Status buttons render from `allowed_transitions` and every action from `viewer.can` — never computed client-side; every mutation re-fetches. The store queue lists every row the server returns (the backend guarantees each is openable by that user, super admins included), so the list does not filter by `viewer.can.view`; the ticket page still renders its buttons from `viewer.can`; every filter area (inbox, store queue, each admin sub-tab) is ONE flat row like the /employees top bar — search, the filters, then Clear all / Refresh / New — and `filter-multi-select.tsx` draws an EMPTY selection as all-checked "All stores/areas/statuses" — the real filter state stays `[]` (= no restriction), never the full list. The sidebar item (and its bottom-nav mirror) is gated on the Toolbox `GET /v1/tickets` auth rule, probed with no storeId; the page adds no gate of its own, but the Admin tab is hidden (and `?tab=admin` falls back to the inbox) unless the Toolbox `POST /v1/ticket-sections` rule passes, probed with no storeId (store scope none); the panels still show the upstream `administer tickets` 403 as their own card. No realtime yet — 30s/60s visible-tab polling |
| `lib/toolbox-tickets/**` | Tickets pure logic, no React: `errors.ts` (the four error shapes → one code-keyed `TicketError`; a code-less 403 is `ADMIN_FORBIDDEN` on admin routes and `ENV_FORBIDDEN` on ticket routes — not a user permission message), `filters-url.ts` (filters ⇄ URL, and → `statuses[]`/`section_keys[]`/`stores[]` API query), `uploads.ts` (the real upload allowlist — the server sniffs content), `level-tree.ts` (flatten, self+descendants to keep the parent picker cycle-free), `scope-and-merge.ts` (effective store scope = most permissive wins; merge a partial ticket without wiping `viewer` or the thread), `sections.ts` (key format), `status.ts` (status visuals only) |
| `components/report-problem/**` | "Report a problem" — a global inspector on top of Tickets. The sidebar button (it replaced the external Support link; tablets and up only) or, in the top-nav layout, a topbar button starts INSPECT MODE: a full-screen catcher (z 10040, above the Screen PiP's 9999) takes every pointer event so no page handler runs, the page dims, pickable parts get dashed outlines on one canvas, the part under the pointer lights up. Dashboards pick single cards, every other page picks a header or section; the sidebar, top bar, bottom bar, debrief button and Screen PiP are whole blocks. The instruction card (ⓘ icon) explains what happens; the highlight waits ~140ms of rest before moving and glides over 400ms. The pick is screenshotted (html2canvas-pro on a pruned clone — never mutates the live page) and a fixed-height dialog (z 10050/10051, pickers 10060) creates a ticket through the Tickets service with an automatic note (English `key: value` lines) carrying the screenshot. Mounted once in `app/[locale]/(dashboard)/dashboard/layout.tsx` (`ReportProblemRoot`). `?reportDebug=1` labels every candidate |
| `lib/report-problem/**` | Report-a-problem pure logic (DOM, no React): `attributes.ts` (the contract — `data-report-target/label/id`, `data-ticket-section` routing override, `data-report-ui`; the topbar/sidebar are found through their existing `data-font-scope="primary"`, the bottom bar through `#bottom-nav-bar`), `pages.ts` (route → page label, area key and pick mode; region keys; the `app.general` fallback; `allReportKeys()` feeds Tickets → Admin → Coverage), `candidates.ts` (candidate index + picking + area resolution), `capture.ts` (visible-rect crop, clone pruning, animation kill, WebKit foreignObject handling, WebP/PNG encode), `context-note.ts`, `geometry.ts` (never scrolls an `overflow:hidden` box, never `scrollIntoView`), `guard.ts` (when inspect mode may start), `label.ts`. The note is deliberately short: page, picked part, area, store, screen, time. To make a component pickable or route it elsewhere, add the attributes — don't teach the inspector about the page |
| `components/manager-hub/**` | Manager Hub — the page at `/dashboard/due-keys` (sidebar label "Manager Hub"; the old filter-sidebar + combined-feed page is kept fully commented out in `due-keys/_legacy/`). Shows the selected store's cleaning-chart tasks and debriefs (due keys) with what is still MISSING today plus a "missed in the last 7 days" backlog, and the employee debriefs written lately: an alert hero (the KPI strip in `hub-kpis.tsx` is commented out of the page), then tabs Overview / My Tasks / My Debriefs / Employee Debriefs (tab + date in the URL). READ-ONLY by design — every action opens the floating debrief panel on the exact key/task/day (`openDebriefKey`, `openDebriefPanel(tab, { date, storeId })`, `openCleaningTask` in `lib/store/debrief-action.store.ts`), second choice a deep link (`/cleaning-chart?tab=due&date=&task=`, `/employee-debrief-history?store=&employee=`). The floating button is shown on this page like everywhere else; the hub just asks its panel to open, and the panel bumps `revision` after every write so the hub refetches quietly. The hub uses only red (overdue/missed) and yellow (still to do) — everything else is neutral. Data comes from `lib/hooks/use-manager-hub.ts`, which deliberately does NOT use `useCleaningStore` (the panel writes `dueData` there for its own date) |
| `lib/manager-hub/**` | Manager Hub pure logic: `missing.ts` (counts what is missing — statuses always come from the server; cleaning backlog is de-duplicated per task + period and skips periods still running on the anchor day), `dates.ts` (date-only string math, never `new Date("YYYY-MM-DD")`), `employee-debriefs.ts` (range `days` → newest-first list, type chips), `search.ts` (accent-insensitive multi-word match), `links.ts` (the deep-link builders) |
| `types/**` | Your custom TypeScript types |

---

## Do Not Modify (Core Infrastructure)

### ❌ Theme System Core

```
lib/theme/
├── theme.types.ts      ❌ DO NOT MODIFY
├── theme.schema.ts     ❌ DO NOT MODIFY  
├── theme.store.ts      ❌ DO NOT MODIFY
├── theme.service.ts    ❌ DO NOT MODIFY
├── default-themes.ts   ❌ DO NOT MODIFY (add via UI instead)
├── theme-sync.ts       ❌ DO NOT MODIFY
└── index.ts            ❌ DO NOT MODIFY
```

**Why:** The theme system uses a specific schema and sync mechanism. Modifying it will break theme import/export and backend synchronization.

**What to do instead:**
- Create themes via Settings → Themes → Import
- Export themes to JSON for sharing
- Use the Theme API endpoints for backend integration

### ❌ Dashboard Personalization Core

```
lib/dashboard/
├── store/
│   ├── dashboard.store.ts   ❌ DO NOT MODIFY
│   ├── selectors.ts         ❌ DO NOT MODIFY
│   └── index.ts             ❌ DO NOT MODIFY
├── types/
│   ├── widget.types.ts      ❌ DO NOT MODIFY
│   ├── user-widget.types.ts ❌ DO NOT MODIFY
│   ├── layout.types.ts      ❌ DO NOT MODIFY
│   ├── view.types.ts        ❌ DO NOT MODIFY
│   ├── config.types.ts      ❌ DO NOT MODIFY
│   └── index.ts             ❌ DO NOT MODIFY
├── registry/
│   ├── widget-registry.ts   ⚠️ ADD ONLY - see below
│   └── skeleton-registry.ts ⚠️ ADD ONLY - see below
└── index.ts                 ❌ DO NOT MODIFY
```

**Why:** The dashboard store manages widget positions, layouts, and persistence. Changing its structure breaks saved user preferences.

### ❌ Base Layout Components

```
components/layout/
├── app-shell.tsx      ⚠️ ADD global overlay mounts only
├── sidebar.tsx        ⚠️ ADD nav items only
├── topbar.tsx         ⚠️ ADD topbar indicator mounts only
├── page-header.tsx    ❌ DO NOT MODIFY
└── breadcrumbs.tsx    ❌ DO NOT MODIFY
```

**Why:** These form the responsive shell that all pages inherit. Modifications break the consistent UX.

**Exception — adding a global overlay or topbar indicator:** a one-line `<NewOverlay />` render in `app-shell.tsx` (or a one-line indicator mount in `topbar.tsx`'s icon cluster) is the one sanctioned edit — everything else in those files (shell structure, layout-variant logic, sidebar/topbar wiring itself) stays off-limits, same spirit as the sidebar's "ADD nav items only" rule above. Precedent already in the codebase: `ScreenProjectPiPOverlay`, `DriveThruOverlay`, `FloatingDebriefButton`, `AnnouncementOnLoadPopup`, and `BottomNav` are all mounted this way in `app-shell.tsx`; `ReportProblemRoot` (the report-a-problem inspector + dialog) is mounted the same one-line way in `app/[locale]/(dashboard)/dashboard/layout.tsx`, next to `AnnouncementOnLoadPopup`; `DriveThruButton`, `CalendarTopbarButton`, `TopbarToolsCluster` and `ReportProblemTopbarButton` (renders only in the top-nav layout) are mounted this way in `topbar.tsx`'s icon cluster (the cluster is the collapsible drawer that now holds `BreakTimerButton` and `StorePassportButton`). `BottomNav` (a mobile/tablet quick-nav tab bar) sources its link list from the independent `lib/nav/**` (Extension zone) rather than importing from `sidebar.tsx`.

### ❌ UI Component Library

```
components/ui/
├── button.tsx         ❌ DO NOT MODIFY
├── card.tsx           ❌ DO NOT MODIFY
├── dialog.tsx         ❌ DO NOT MODIFY
├── skeleton.tsx       ❌ DO NOT MODIFY
└── ... (all files)    ❌ DO NOT MODIFY
```

**Why:** These are shadcn/ui base components. Modify via Tailwind classes or create wrapper components instead.

---

## Safe to Modify (Extension Points)

### ✅ Adding New Dashboard Pages

Create new pages in the dashboard route group:

```tsx
// app/[locale]/(dashboard)/dashboard/analytics/page.tsx
"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      {/* Your content here */}
    </div>
  );
}
```

### ✅ Adding Navigation Items

Add items to the sidebar navigation array (don't modify the sidebar structure):

```tsx
// In sidebar.tsx - ADD to navItems array
{
  title: t("nav.analytics"),
  href: `/${locale}/dashboard/analytics`,
  icon: BarChart3,
}
```

### ✅ Adding Translation Keys

Add NEW keys to locale files (don't modify existing core keys):

```json
// lib/i18n/locales/en.json - ADD new sections
{
  "analytics": {
    "title": "Analytics",
    "description": "View your analytics data"
  }
}
```

### ✅ Registering New Widgets

Add to the widget registry (don't modify existing widgets):

```typescript
// In widget-registry.ts - ADD new widgets
{
  id: "my-custom-chart",
  type: "chart-line",
  titleKey: "dashboard.widgets.myCustomChart.title",
  descriptionKey: "dashboard.widgets.myCustomChart.description",
  defaultSize: { cols: 2, rows: 2, minCols: 1, maxCols: 4, minRows: 1, maxRows: 3 },
  category: "charts",
  roles: ["admin", "manager", "viewer"],
  isDefault: false, // Not shown by default
  defaultConfig: {
    showLegend: true,
    dataSource: "my-api-endpoint"
  }
}
```

### ✅ Creating Custom Widget Components

Create your widget implementations in a separate folder:

```tsx
// components/widgets/my-custom-chart.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserWidgetInstance } from "@/lib/dashboard";

interface MyCustomChartProps {
  widget: UserWidgetInstance;
  title: string;
}

export function MyCustomChart({ widget, title }: MyCustomChartProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Your chart implementation */}
      </CardContent>
    </Card>
  );
}
```

---

## Feature Flags System

The feature flags system allows developers to enable/disable features without code changes.

### Quick Reference

```tsx
import { useFeature, Feature } from '@/lib/config';

// Check feature in component
const isDarkModeEnabled = useFeature('darkMode');

// Conditional rendering
<Feature name="darkMode">
  <ThemeToggle />
</Feature>
```

### Disabling a Feature

Edit `lib/config/features.config.ts`:

```ts
darkMode: {
  enabled: false, // Change to disable
  // ...
}
```

### Available Features

| Feature ID | Description |
|------------|-------------|
| `localization` | Multi-language support (i18n) |
| `darkMode` | Light/dark theme toggle |
| `themeSystem` | Custom theme system v2 |
| `dashboardPersonalization` | Drag-drop widgets |
| `devTools` | Dev tools section |
| `i18nIntelligence` | Translation issue detection |
| `securityMonitor` | Security audit tool |

**Full documentation:** See [DEVELOPER-GUIDE-FEATURE-FLAGS.md](./DEVELOPER-GUIDE-FEATURE-FLAGS.md)

---

## Dashboard Personalization System

### How It Works

The dashboard uses a **widget registry + user layout** pattern:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Widget Registry │ ──▶ │ Dashboard Store │ ──▶ │   Widget Grid   │
│ (Definitions)   │     │ (User Layout)   │     │   (Rendering)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

1. **Widget Registry**: Defines available widgets, their types, sizes, and role access
2. **Dashboard Store**: Manages user's selected widgets, positions, and visibility
3. **Widget Grid**: Renders widgets in a draggable grid with edit mode

### Adding Widgets Safely

1. **Register the widget** (ADD to widget-registry.ts)
2. **Add translation keys** (ADD to locale files)
3. **Create the component** (NEW file in components/widgets/)
4. **Add to WidgetRenderer** (ADD case in switch statement)

### User Persistence

Widget layouts are persisted in localStorage by default. The system is designed to support backend sync:

- Layouts can be exported/imported
- API endpoints can be added for server persistence
- Role-based defaults can be configured per widget

---

## Theme System

### Creating Themes (Recommended Way)

1. Go to **Settings → Themes**
2. Click **Import** and paste your theme JSON
3. Or use the Theme Store API:

```typescript
import { useThemeStore } from "@/lib/theme";

const { importTheme } = useThemeStore();
importTheme(myThemeJson);
```

### Theme JSON Format

```json
{
  "name": "My Custom Theme",
  "version": "1.0.0",
  "colors": {
    "light": { /* OKLCH colors */ },
    "dark": { /* OKLCH colors */ }
  },
  "radius": { "base": "0.5rem" },
  "metadata": {
    "author": "Your Name",
    "description": "Theme description"
  }
}
```

### ⚠️ Do Not Edit default-themes.ts

Add themes via the UI or API instead. This ensures:
- Themes can be synced across instances
- User-created themes don't conflict with updates
- Clean upgrade path when pulling from upstream

---

## Localization System

### Safe Translation Key Patterns

```json
// ✅ SAFE - Add new namespaces
{
  "myFeature": {
    "title": "My Feature",
    "actions": {
      "save": "Save",
      "cancel": "Cancel"
    }
  }
}

// ❌ UNSAFE - Modifying core keys
{
  "common": {
    "save": "Submit"  // DON'T change existing keys
  }
}
```

### Adding a New Locale

1. Create the locale file: `lib/i18n/locales/fr.json`
2. Update config (ADD to arrays, don't replace):

```typescript
// lib/i18n/config.ts
export const locales = ["en", "ar", "fr"] as const;
```

---

## i18n Intelligence (Dev Tools)

### Overview

i18n Intelligence is a developer tool for detecting and monitoring translation issues in real-time. Access it at **Dev Tools → i18n Intelligence**.

### Features

- **Real-time Detection**: Intercepts missing translation keys as they occur
- **Health Score Dashboard**: Overall translation coverage metrics
- **Issue Tracking**: Track missing keys, fallback usage, RTL issues
- **Hardcoded String Detection**: ESLint plugin + CLI analyzer
- **Export Reports**: Export issues as JSON, CSV, or Markdown
- **RTL Support**: Full RTL layout compatibility

### ESLint Integration (v1.2.0)

The i18n Intelligence ESLint plugin is integrated into the project's ESLint configuration. Hardcoded strings are flagged as warnings in:
- VS Code Problems panel (squiggly underlines)
- Terminal when running `pnpm lint`
- CI/CD pipelines

```javascript
// Configured in eslint.config.mjs
// Rule: @b-dashboard/i18n-intelligence/no-hardcoded-strings
// Level: warn (non-blocking)
// Excluded: test-detection/**, components/ui/**
```

**What gets flagged:**
- JSX text content (e.g., `<Button>Click me</Button>`)
- String attributes: `placeholder`, `title`, `alt`, `aria-label`

**What is ignored:**
- URLs, colors, CSS values, classNames
- Code/Pre/Script components
- Single characters, numbers, constants
- Files in excluded patterns

### Running the CLI Analyzer

```bash
# Scan codebase for hardcoded strings
pnpm analyze:i18n

# Results saved to: .i18n-intelligence/hardcoded-strings.json
# View results in Dev Tools dashboard
```

### File Structure

```
lib/i18n-intelligence/
├── store/              # Zustand store for issue tracking
├── analyzers/          # Detection engine and interceptors  
├── utils/              # Export utilities (JSON, CSV, Markdown)
├── eslint/             # ESLint plugin (plugin.ts, analyzer.ts)
└── types/              # TypeScript type definitions

scripts/
└── analyze-hardcoded-strings.ts  # CLI analyzer

components/i18n-intelligence/
├── detection-controls.tsx    # Start/pause detection
├── health-score-card.tsx     # Overall health metrics
├── issue-list.tsx            # Issue management with export
├── issue-summary-cards.tsx   # Issue type breakdown
├── locale-health-cards.tsx   # Per-locale health
├── hardcoded-strings-panel.tsx # CLI analysis results
└── index.ts                  # Barrel exports
```

### Extending i18n Intelligence

Safe to modify:
- Add new detection rules in `detectors/`
- Add export formats in `utils/export.ts`
- Customize the dashboard layout

Core (don't modify):
- Store structure in `store/i18n-intelligence.store.ts`
- Detection engine interceptors
- ESLint plugin rule structure

---

## Adding Features Without Breaking Sync

### The Golden Rules

1. **ADD, don't MODIFY** - Extend existing arrays/objects, don't change them
2. **NEW FILES, not edits** - Create new files instead of editing core files
3. **WRAPPER PATTERN** - Wrap core components instead of modifying them
4. **COMPOSITION** - Use component composition over inheritance

### Example: Custom Stats Card

```tsx
// ❌ WRONG - Modifying the core component
// components/ui/card.tsx (editing existing)

// ✅ CORRECT - Creating a wrapper
// components/features/enhanced-card.tsx (new file)
import { Card } from "@/components/ui/card";

export function EnhancedCard({ glow, ...props }) {
  return (
    <Card className={glow ? "shadow-glow" : ""} {...props} />
  );
}
```

### Staying In Sync

To pull updates from upstream without conflicts:

1. **Never modify core files** listed in the ❌ section
2. **Track your additions** in separate files/folders
3. **Use feature flags** for experimental features
4. **Test after pulls** with `pnpm build`

---

## Quick Reference Card

| Action | Status | Location |
|--------|--------|----------|
| Add dashboard page | ✅ Safe | `app/[locale]/(dashboard)/dashboard/*/page.tsx` |
| Add widget | ✅ Safe | Add to registry + new component file |
| Add translation key | ✅ Safe | Add to locale JSON files |
| Add nav item | ✅ Safe | Add to navItems array in sidebar |
| Create theme | ✅ Safe | Use UI or Theme Store API |
| Add API service | ✅ Safe | `lib/api/services/*.ts` |
| Add dev tool | ✅ Safe | `app/[locale]/(dashboard)/dashboard/dev-tools/*/page.tsx` |
| Add detection rule | ✅ Safe | `lib/i18n-intelligence/detectors/*.ts` |
| Add export format | ✅ Safe | `lib/i18n-intelligence/utils/export.ts` |
| Add global overlay | ⚠️ Carve-out | One-line `<NewOverlay />` mount in `app-shell.tsx` only |
| Add topbar indicator | ⚠️ Carve-out | One-line mount in `topbar.tsx`'s icon cluster only |
| Modify theme engine | ❌ Core | Use themes via API instead |
| Modify dashboard store | ❌ Core | Use store actions instead |
| Edit UI components | ❌ Core | Create wrapper components |
| Change base layouts | ❌ Core | Extend via children/slots |
| Modify i18n store | ❌ Core | Use store actions instead |

---

## Support

If you need to modify core functionality:

1. **Fork the repository** - Create your own version
2. **Open an issue** - Request the feature upstream
3. **Submit a PR** - Propose changes with tests

This ensures the community benefits and your changes don't break on updates.
