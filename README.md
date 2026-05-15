# B-Dashboard

A scalable, enterprise-grade dashboard foundation built with Next.js 16, Tailwind CSS v4, shadcn/ui, and Zustand.

## Features

- 🌍 **Internationalization** - Full i18n support with English & Arabic (RTL)
- 🎨 **Theme System v2** - Import/export JSON themes, save custom themes
- 🔐 **Authentication** - Login flow with protected routes
- 📊 **Dashboard Shell** - Collapsible sidebar, topbar, breadcrumbs
- 🧩 **Dashboard Personalization** - Drag-drop widgets, saved layouts, edit mode
- ⚙️ **Settings Module** - Profile, account, appearance, preferences, themes
- 🛠️ **Developer Tools** - i18n Intelligence for translation monitoring
- 🎯 **Type-Safe** - Full TypeScript with strict mode
- 📁 **Scalable Architecture** - Clean separation of concerns

## Tech Stack

| Layer            | Technology              |
| ---------------- | ----------------------- |
| Framework        | Next.js 16 (App Router) |
| Styling          | Tailwind CSS v4         |
| UI Components    | shadcn/ui               |
| State Management | Zustand                 |
| i18n             | next-intl               |
| Validation       | Zod                     |
| HTTP Client      | Axios                   |
| Icons            | Lucide React            |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd b-dashboard

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Demo Credentials

```
Email: admin@example.com
Password: password
```

## Project Structure

```
b-dashboard/
├── app/
│   ├── [locale]/               # Locale-prefixed routes
│   │   ├── (auth)/             # Auth route group
│   │   └── (dashboard)/        # Dashboard route group
│   └── api/                    # API routes
├── components/
│   ├── layout/                 # AppShell, Sidebar, Topbar
│   ├── ui/                     # shadcn/ui components
│   ├── shared/                 # Business components
│   └── providers/              # Context providers
├── lib/
│   ├── api/                    # Axios client & services
│   ├── auth/                   # Auth store & utilities
│   ├── i18n/                   # i18n config & locales
│   ├── theme/                  # Theme system v2
│   └── store/                  # Zustand stores
├── i18n/                       # next-intl configuration
├── types/                      # TypeScript types
└── docs/                       # Documentation
```

## Localization (i18n)

The app supports multiple languages with RTL support:

- **English (en)** - Default, LTR
- **Arabic (ar)** - RTL support with Noto Sans Arabic font

### Adding a Translation Key

1. Add the key to `lib/i18n/locales/en.json`:

```json
{
  "mySection": {
    "newKey": "English text"
  }
}
```

2. Add the Arabic translation to `lib/i18n/locales/ar.json`:

```json
{
  "mySection": {
    "newKey": "النص العربي"
  }
}
```

3. Use in your component:

```tsx
import { useTranslations } from "next-intl";

function MyComponent() {
  const t = useTranslations("mySection");
  return <span>{t("newKey")}</span>;
}
```

### Adding a New Locale

1. Create a new locale file:

```bash
touch lib/i18n/locales/fr.json
```

2. Update `lib/i18n/config.ts`:

```typescript
export const locales = ["en", "ar", "fr"] as const;
export const localeNames: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
  fr: "Français",
};
export const localeDirections: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
  fr: "ltr",
};
```

### RTL Best Practices

Use logical CSS properties for RTL compatibility:

- `me-*` / `ms-*` instead of `mr-*` / `ml-*`
- `pe-*` / `ps-*` instead of `pr-*` / `pl-*`
- `start` / `end` instead of `left` / `right`

## Theme System

The app includes a powerful theme system with JSON import/export support.

### Theme Structure

Themes follow this JSON schema:

```json
{
  "name": "My Theme",
  "version": "1.0.0",
  "colors": {
    "light": {
      "background": "oklch(1 0 0)",
      "foreground": "oklch(0.145 0 0)",
      "primary": "oklch(0.205 0 0)",
      "primaryForeground": "oklch(0.985 0 0)",
      "secondary": "oklch(0.97 0 0)",
      "secondaryForeground": "oklch(0.205 0 0)",
      "muted": "oklch(0.97 0 0)",
      "mutedForeground": "oklch(0.556 0 0)",
      "accent": "oklch(0.97 0 0)",
      "accentForeground": "oklch(0.205 0 0)",
      "destructive": "oklch(0.577 0.245 27.325)",
      "border": "oklch(0.922 0 0)",
      "input": "oklch(0.922 0 0)",
      "ring": "oklch(0.708 0 0)"
    },
    "dark": {
      // ... dark mode colors
    }
  },
  "radius": {
    "base": "0.625rem"
  },
  "metadata": {
    "author": "Your Name",
    "description": "A custom theme"
  }
}
```

### Importing a Theme

1. Navigate to **Settings → Themes**
2. Click **Import**
3. Paste the theme JSON or upload a `.json` file
4. Click **Import** to add the theme

### Exporting a Theme

1. Navigate to **Settings → Themes**
2. Click the download icon on any theme card
3. Choose JSON or CSS format
4. Download or copy to clipboard

### Using Themes Programmatically

```typescript
import { useThemeStore } from "@/lib/theme";

function MyComponent() {
  const { themes, activeThemeId, setActiveTheme, importTheme } =
    useThemeStore();

  // Switch theme
  setActiveTheme("ocean");

  // Import new theme
  const result = importTheme(jsonString);
  if (result.success) {
    console.log("Theme imported:", result.theme);
  }
}
```

### Backend Theme Sync

The theme system is designed to be backend-ready. API endpoints:

- `GET /api/themes` - List themes
- `POST /api/themes` - Create theme
- `PATCH /api/themes/[id]` - Update theme
- `DELETE /api/themes/[id]` - Delete theme
- `GET/PUT /api/themes/active` - Get/set active theme
- `POST /api/themes/sync` - Sync local themes with server

## Adding New Pages

### Dashboard Page

```tsx
// app/[locale]/(dashboard)/dashboard/your-page/page.tsx
import { PageHeader } from "@/components/layout/page-header";
import { useTranslations } from "next-intl";

export default function YourPage() {
  const t = useTranslations("yourPage");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      {/* Your content */}
    </div>
  );
}
```

### Add to Sidebar

```tsx
// components/layout/sidebar.tsx
const navItems = [
  // ... existing items
  {
    title: t("yourPage"),
    href: `/${locale}/dashboard/your-page`,
    icon: YourIcon,
  },
];
```

## Scripts

| Command             | Description                |
| ------------------- | -------------------------- |
| `pnpm dev`          | Start development server   |
| `pnpm build`        | Build for production       |
| `pnpm start`        | Start production server    |
| `pnpm lint`         | Run ESLint                 |
| `pnpm tsc --noEmit` | TypeScript check           |
| `pnpm analyze:i18n` | Scan for hardcoded strings |

## Developer Tools

### i18n Intelligence

A built-in developer tool for monitoring translation coverage and detecting issues.

**Access:** Dashboard → Dev Tools → i18n Intelligence

**Features:**

- Real-time missing key detection
- Translation health score dashboard
- Issue tracking with severity levels
- Hardcoded string detection (CLI + ESLint)
- Export reports (JSON, CSV, Markdown)

**CLI Analyzer:**

```bash
# Scan codebase for hardcoded strings
pnpm analyze:i18n
```

For more developer tools ideas, see [Dev Tools Roadmap](./docs/DEV-TOOLS-ROADMAP.md).

## Documentation

> **⚠️ IMPORTANT:** Before making any changes, read the [Developer Guide](./docs/DEVELOPER-GUIDE.md) to understand what files are CORE infrastructure (do not modify) vs extension points (safe to modify).

- [**Developer Guide**](./docs/DEVELOPER-GUIDE.md) - ⭐ Start here! Core vs extension zones
- [**Backend Integration**](./docs/BACKEND-INTEGRATION.md) - API integration guide
- [**Dev Tools Roadmap**](./docs/DEV-TOOLS-ROADMAP.md) - Future developer tools ideas
- [Implementation Plan](./docs/PLAN.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [i18n + Theme Plan](./docs/PLAN-I18N-THEME.md)
- [i18n + Theme Tasks](./docs/TASKS-I18N-THEME.md)
- [Problems Fixed](./docs/PROBLEMS.md)

### Architecture Decision Records (ADRs)

- [ADR-0001: State Management](./docs/ADR/0001-state-management.md)
- [ADR-0002: API Layer](./docs/ADR/0002-api-layer.md)
- [ADR-0003: Routing](./docs/ADR/0003-routing-layouts.md)
- [ADR-0004: Localization](./docs/ADR/0004-localization.md)
- [ADR-0005: Theme System v2](./docs/ADR/0005-theme-system-v2.md)
- [ADR-0006: Dashboard Personalization](./docs/ADR/0006-dashboard-personalization.md)
- [ADR-0006: i18n Intelligence](./docs/ADR/0006-i18n-intelligence.md)

### i18n Intelligence System (✅ Implemented)

- [Product Specification](./docs/i18n-intelligence/PRODUCT-SPEC.md)
- [Data Model](./docs/i18n-intelligence/DATA-MODEL.md)
- [Detection Engine](./docs/i18n-intelligence/DETECTION-ENGINE.md)
- [Dashboard UI Design](./docs/i18n-intelligence/DASHBOARD-UI.md)
- [Implementation Summary](./docs/i18n-intelligence/IMPLEMENTATION-SUMMARY.md)

## License

MIT

fhdsklfhdskjfhdasjklfhdaskjfhjadskfhadsklfhadsjklhjklh

CICD
