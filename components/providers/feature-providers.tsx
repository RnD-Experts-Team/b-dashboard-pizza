/**
 * Feature-Aware Providers
 *
 * Conditional providers that wrap children based on feature flag state.
 * These providers handle cases when features are disabled gracefully.
 *
 * @module components/providers/feature-providers
 */

"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "./theme-provider";
import { ThemeSyncProvider } from "./theme-sync-provider";
import { NextThemeProvider, ThemeAnimationType } from "@space-man/react-theme-animation";
import { I18nClientProvider } from "./i18n-client-provider";
import { isFeatureEnabled } from "@/lib/config";
import { THEME_STORAGE_KEY } from "@/lib/theme/apply-theme";

interface ConditionalThemeProviderProps {
  children: ReactNode;
}

/**
 * Conditional Theme Provider
 *
 * Wraps children with theme providers only if theme features are enabled.
 * When themeSystem is disabled, provides a minimal theme context.
 * When darkMode is disabled, forces light theme.
 */
export function ConditionalThemeProvider({
  children,
}: ConditionalThemeProviderProps) {
  const themeSystemEnabled = isFeatureEnabled("themeSystem");
  const darkModeEnabled = isFeatureEnabled("darkMode");

  // If theme system is completely disabled, just render children
  // (basic Tailwind styles will still work)
  if (!themeSystemEnabled) {
    return <>{children}</>;
  }

  // If theme system enabled but dark mode disabled, force light theme
  const themeProps = darkModeEnabled
    ? {
        attribute: "class" as const,
        defaultTheme: "system",
        enableSystem: true,
        disableTransitionOnChange: true,
      }
    : {
        attribute: "class" as const,
        defaultTheme: "light",
        forcedTheme: "light",
        enableSystem: false,
        disableTransitionOnChange: true,
      };

  return (
    <NextThemeProvider
      defaultTheme={themeProps.defaultTheme as any}
      attribute="class"
      storageKey={THEME_STORAGE_KEY}
      defaultColorTheme="default"
      colorThemePrefix="theme-"
      animationType={ThemeAnimationType.BLUR_CIRCLE}
      duration={750}
    >
      {/* Same storageKey as above — this is a SEPARATE theme engine (real
          next-themes) that also toggles the .dark class; without a shared
          key the two independently resolve light/dark and fight over the
          class, and this one (mounted deeper) previously lost every time. */}
      <ThemeProvider {...themeProps} storageKey={THEME_STORAGE_KEY}>
        <ThemeSyncProvider>{children}</ThemeSyncProvider>
      </ThemeProvider>
    </NextThemeProvider>
  );
}

interface ConditionalI18nProviderProps {
  children: ReactNode;
  messages: Record<string, unknown>;
  locale: string;
}

/**
 * Conditional i18n Provider
 *
 * Wraps children with i18n provider.
 * When localization or i18nIntelligence are disabled, adjusts behavior.
 */
export function ConditionalI18nProvider({
  children,
  messages,
  locale,
}: ConditionalI18nProviderProps) {
  const localizationEnabled = isFeatureEnabled("localization");

  // Always provide i18n context (needed for translations to work)
  // The difference is in whether i18nIntelligence tracking is active
  // which is handled inside I18nClientProvider
  return (
    <I18nClientProvider messages={messages} locale={locale}>
      {children}
    </I18nClientProvider>
  );
}

interface FeatureProvidersProps {
  children: ReactNode;
  messages: Record<string, unknown>;
  locale: string;
}

/**
 * Combined Feature-Aware Providers
 *
 * Wraps all feature-conditional providers in the correct order.
 * Use this in the root layout for simplified integration.
 */
export function FeatureProviders({
  children,
  messages,
  locale,
}: FeatureProvidersProps) {
  return (
    <ConditionalThemeProvider>
      <ConditionalI18nProvider messages={messages} locale={locale}>
        {children}
      </ConditionalI18nProvider>
    </ConditionalThemeProvider>
  );
}
