/**
 * Feature Flags Type Definitions
 *
 * Central type definitions for the feature flag configuration system.
 * These types ensure type-safe feature flag management across the application.
 *
 * @module lib/config/features.types
 */

/**
 * Feature categories for organization and filtering
 */
export type FeatureCategory = "core" | "ui" | "dev" | "experimental";

/**
 * All available feature IDs in the application.
 * Add new feature IDs here when extending the system.
 */
export const FEATURE_IDS = [
  "localization",
  "darkMode",
  "themeSystem",
  "dashboardPersonalization",
  "i18nIntelligence",
  "securityMonitor",
  "rtlSupport",
  "devTools",
  "userMenu",
  "sidebar",
  "breadcrumbs",
  "search",
  "screenProjectPiP",
  "soundFx",
  "mobileBottomNav",
] as const;

/**
 * Type-safe feature ID type derived from the FEATURE_IDS array
 */
export type FeatureId = (typeof FEATURE_IDS)[number];

/**
 * Configuration for a single feature
 */
export interface FeatureConfig {
  /** Unique identifier for the feature */
  id: FeatureId;

  /** Human-readable name for the feature */
  name: string;

  /** Detailed description of what the feature does */
  description: string;

  /** Category for organization and filtering */
  category: FeatureCategory;

  /** Whether the feature is enabled by default */
  enabled: boolean;

  /**
   * Other features this feature depends on.
   * If dependencies are disabled, this feature will also be disabled.
   */
  dependencies?: FeatureId[];

  /**
   * Environment variable name that can override the enabled state.
   * Should follow pattern: NEXT_PUBLIC_FEATURE_*
   */
  envOverride?: string;

  /**
   * Whether this feature can be toggled at runtime.
   * If false, the feature state is determined at build time.
   */
  runtimeToggle?: boolean;

  /**
   * Whether this feature is only available in development mode.
   * Will be automatically disabled in production.
   */
  devOnly?: boolean;
}

/**
 * Complete features configuration object
 */
export type FeaturesConfig = Record<FeatureId, FeatureConfig>;

/**
 * Runtime state for features that can be toggled
 */
export interface FeaturesRuntimeState {
  /** Map of feature IDs to their current enabled state */
  overrides: Partial<Record<FeatureId, boolean>>;

  /** Set a runtime override for a feature */
  setOverride: (featureId: FeatureId, enabled: boolean) => void;

  /** Clear a runtime override (revert to config default) */
  clearOverride: (featureId: FeatureId) => void;

  /** Clear all runtime overrides */
  clearAllOverrides: () => void;
}

/**
 * Feature resolution result with metadata
 */
export interface FeatureDetails {
  /** Whether the feature is currently enabled */
  enabled: boolean;

  /** The source of the enabled state */
  source: "config" | "env" | "runtime" | "dependency" | "devOnly";

  /** The full feature configuration */
  config: FeatureConfig;

  /** If disabled due to dependency, which dependency */
  disabledBy?: FeatureId;
}

/**
 * Props for the Feature gate component
 */
export interface FeatureProps {
  /** Single feature to check */
  name?: FeatureId;

  /** Multiple features required (AND logic) */
  require?: FeatureId[];

  /** Content to render when feature(s) are disabled */
  fallback?: React.ReactNode;

  /** Content to render when feature(s) are enabled */
  children: React.ReactNode;
}

/**
 * Context value for the feature provider
 */
export interface FeatureContextValue {
  /** Check if a feature is enabled */
  isEnabled: (featureId: FeatureId) => boolean;

  /** Get detailed feature info */
  getDetails: (featureId: FeatureId) => FeatureDetails;

  /** Set runtime override (for runtime-toggleable features) */
  setOverride: (featureId: FeatureId, enabled: boolean) => void;

  /** Get all feature configs */
  getAllConfigs: () => FeaturesConfig;
}
