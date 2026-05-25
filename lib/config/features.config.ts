/**
 * Feature Flags Configuration
 *
 * Central configuration file for all feature flags in the application.
 * Edit this file to enable/disable features at build time.
 *
 * ## How to use:
 * - Set `enabled: false` to disable a feature
 * - Features with `devOnly: true` are automatically disabled in production
 * - Use environment variables (envOverride) for deployment-time configuration
 *
 * ## Adding a new feature:
 * 1. Add the feature ID to FEATURE_IDS in features.types.ts
 * 2. Add the configuration object below
 * 3. Use useFeature('yourFeatureId') in components
 *
 * @module lib/config/features.config
 */

import type { FeaturesConfig, FeatureConfig } from "./features.types";

/**
 * ============================================================================
 * FEATURE FLAGS CONFIGURATION
 * ============================================================================
 *
 * Modify the `enabled` property to enable/disable features.
 * Environment variables take precedence over these defaults.
 */
export const featuresConfig: FeaturesConfig = {
  /**
   * Localization (i18n)
   *
   * Enables multi-language support with locale routing (/en/*, /ar/*).
   * When disabled, the app will run in the default locale only.
   *
   * Affects:
   * - Locale prefix routing
   * - Language switcher in UI
   * - Translation loading
   */
  localization: {
    id: "localization",
    name: "Localization (i18n)",
    description:
      "Multi-language support with locale routing. Supports English and Arabic with RTL.",
    category: "core",
    enabled: true,
    envOverride: "NEXT_PUBLIC_FEATURE_LOCALIZATION",
    runtimeToggle: false,
  },

  /**
   * Dark Mode
   *
   * Enables the light/dark theme toggle in the UI.
   * When disabled, the app will use the light theme only.
   *
   * Affects:
   * - Theme toggle button in topbar
   * - System theme detection
   * - Dark mode CSS variables
   */
  darkMode: {
    id: "darkMode",
    name: "Dark Mode",
    description:
      "Light/dark theme toggle with system preference detection.",
    category: "ui",
    enabled: true,
    envOverride: "NEXT_PUBLIC_FEATURE_DARK_MODE",
    runtimeToggle: true,
    dependencies: ["themeSystem"],
  },

  /**
   * Theme System v2
   *
   * Enables the advanced theme system with custom color palettes.
   * When disabled, the app uses basic light/dark theming only.
   *
   * Affects:
   * - Custom theme creation
   * - Theme import/export
   * - Theme settings page
   * - CSS custom properties application
   */
  themeSystem: {
    id: "themeSystem",
    name: "Theme System v2",
    description:
      "Advanced theme system with custom color palettes, import/export, and backend sync.",
    category: "ui",
    enabled: true,
    envOverride: "NEXT_PUBLIC_FEATURE_THEME_SYSTEM",
    runtimeToggle: false,
  },

  /**
   * Dashboard Personalization
   *
   * Enables drag-drop widget customization on the dashboard.
   * When disabled, the dashboard shows a fixed layout.
   *
   * Affects:
   * - Widget drag-and-drop
   * - Widget visibility toggles
   * - Saved views
   * - Edit mode toolbar
   */
  dashboardPersonalization: {
    id: "dashboardPersonalization",
    name: "Dashboard Personalization",
    description:
      "Drag-drop widgets, saved views, and per-widget configuration.",
    category: "ui",
    enabled: true,
    envOverride: "NEXT_PUBLIC_FEATURE_DASHBOARD_PERSONALIZATION",
    runtimeToggle: false,
  },

  /**
   * i18n Intelligence (Dev Tool)
   *
   * Enables the translation intelligence dev tool for detecting
   * missing translations and hardcoded strings.
   *
   * Affects:
   * - i18n Intelligence dashboard
   * - Missing translation tracking
   * - Hardcoded string detection
   */
  i18nIntelligence: {
    id: "i18nIntelligence",
    name: "i18n Intelligence",
    description:
      "Development tool for detecting missing translations and hardcoded strings.",
    category: "dev",
    enabled: true,
    envOverride: "NEXT_PUBLIC_FEATURE_I18N_INTELLIGENCE",
    runtimeToggle: true,
    devOnly: true,
    dependencies: ["localization", "devTools"],
  },

  /**
   * Security Monitor (Dev Tool)
   *
   * Enables the security audit dev tool for checking security headers
   * and configurations.
   *
   * Affects:
   * - Security monitor dashboard
   * - Security audit reports
   * - Event logging
   */
  securityMonitor: {
    id: "securityMonitor",
    name: "Security Monitor",
    description:
      "Development tool for security audits and monitoring.",
    category: "dev",
    enabled: true,
    envOverride: "NEXT_PUBLIC_FEATURE_SECURITY_MONITOR",
    runtimeToggle: true,
    devOnly: true,
    dependencies: ["devTools"],
  },

  /**
   * RTL Support
   *
   * Enables right-to-left layout support for Arabic and other RTL languages.
   * When disabled, the app only renders in LTR mode.
   *
   * Affects:
   * - HTML dir attribute
   * - CSS logical properties
   * - Arabic font loading
   */
  rtlSupport: {
    id: "rtlSupport",
    name: "RTL Support",
    description:
      "Right-to-left layout support for Arabic and other RTL languages.",
    category: "core",
    enabled: true,
    envOverride: "NEXT_PUBLIC_FEATURE_RTL_SUPPORT",
    runtimeToggle: false,
    dependencies: ["localization"],
  },

  /**
   * Dev Tools
   *
   * Master toggle for all development tools section in the sidebar.
   * When disabled, all dev tools are hidden regardless of individual settings.
   *
   * Affects:
   * - Dev tools navigation section
   * - All dev tool pages
   */
  devTools: {
    id: "devTools",
    name: "Development Tools",
    description:
      "Master toggle for all development tools in the sidebar.",
    category: "dev",
    enabled: true,
    envOverride: "NEXT_PUBLIC_FEATURE_DEV_TOOLS",
    runtimeToggle: true,
    devOnly: true,
  },

  /**
   * User Menu
   *
   * Enables the user profile dropdown menu in the sidebar.
   * When disabled, no user menu is shown.
   *
   * Affects:
   * - User avatar/name display
   * - Profile dropdown menu
   * - Logout functionality
   */
  userMenu: {
    id: "userMenu",
    name: "User Menu",
    description: "User profile dropdown menu in the sidebar.",
    category: "ui",
    enabled: true,
    envOverride: "NEXT_PUBLIC_FEATURE_USER_MENU",
    runtimeToggle: true,
  },

  /**
   * Sidebar
   *
   * Enables the collapsible sidebar navigation.
   * When disabled, an alternative minimal navigation is used.
   *
   * Affects:
   * - Sidebar component
   * - Collapse/expand functionality
   * - Navigation layout
   */
  sidebar: {
    id: "sidebar",
    name: "Sidebar Navigation",
    description: "Collapsible sidebar with navigation items.",
    category: "ui",
    enabled: true,
    envOverride: "NEXT_PUBLIC_FEATURE_SIDEBAR",
    runtimeToggle: false,
  },

  /**
   * Breadcrumbs
   *
   * Enables breadcrumb navigation in the topbar.
   * When disabled, no breadcrumbs are shown.
   *
   * Affects:
   * - Breadcrumb component in topbar
   * - Path-based navigation
   */
  breadcrumbs: {
    id: "breadcrumbs",
    name: "Breadcrumbs",
    description: "Breadcrumb navigation in the top bar.",
    category: "ui",
    enabled: true,
    envOverride: "NEXT_PUBLIC_FEATURE_BREADCRUMBS",
    runtimeToggle: true,
  },

  /**
   * Search
   *
   * Enables the global search input in the topbar.
   * Currently a stub - functionality not implemented yet.
   *
   * Affects:
   * - Search input in topbar
   * - Search results (future)
   */
  search: {
    id: "search",
    name: "Global Search",
    description: "Global search functionality in the top bar (stub).",
    category: "ui",
    enabled: true,
    envOverride: "NEXT_PUBLIC_FEATURE_SEARCH",
    runtimeToggle: true,
  },

  /**
   * Screen Project — Global PiP Mini-Player
   *
   * When enabled, navigating away from the Screen Project page while a live
   * station is active will automatically show a draggable picture-in-picture
   * mini-player that keeps the video feed alive across routes.
   *
   * Affects:
   * - Floating PiP overlay in AppShell
   * - LiveKit room lifecycle (one room kept alive across navigation)
   * - Drag position persistence
   */
  screenProjectPiP: {
    id: "screenProjectPiP",
    name: "Screen Project PiP",
    description:
      "Draggable cross-page mini-player for live station video when leaving Screen Project.",
    category: "ui",
    enabled: true,
    envOverride: "NEXT_PUBLIC_FEATURE_SCREEN_PROJECT_PIP",
    runtimeToggle: false,
  },
};

/**
 * Get a specific feature configuration
 */
export function getFeatureConfig(featureId: keyof FeaturesConfig): FeatureConfig {
  return featuresConfig[featureId];
}

/**
 * Get all feature configurations
 */
export function getAllFeatureConfigs(): FeaturesConfig {
  return featuresConfig;
}

/**
 * Get features by category
 */
export function getFeaturesByCategory(
  category: FeatureConfig["category"]
): FeatureConfig[] {
  return Object.values(featuresConfig).filter((f) => f.category === category);
}
