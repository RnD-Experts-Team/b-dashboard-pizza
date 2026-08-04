# B-Dashboard Developer Guide

_Last updated: 2026-08-04 (bump this whenever you substantively edit this file)_

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
| `components/screen-project/**` | Screen Project live-video monitoring (incl. `drive-thru/**` global hotline overlay) |
| `lib/store/**` | Feature-scoped Zustand stores (e.g. `dspr.store.ts`, `selected-store.store.ts`, `drive-thru.store.ts`) — distinct from the Core `lib/dashboard/store/**` |
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

**Exception — adding a global overlay or topbar indicator:** a one-line `<NewOverlay />` render in `app-shell.tsx` (or a one-line indicator mount in `topbar.tsx`'s icon cluster) is the one sanctioned edit — everything else in those files (shell structure, layout-variant logic, sidebar/topbar wiring itself) stays off-limits, same spirit as the sidebar's "ADD nav items only" rule above. Precedent already in the codebase: `ScreenProjectPiPOverlay`, `DriveThruOverlay`, `FloatingDebriefButton`, and `AnnouncementOnLoadPopup` are all mounted this way in `app-shell.tsx`; `DriveThruButton` is mounted this way in `topbar.tsx`.

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
