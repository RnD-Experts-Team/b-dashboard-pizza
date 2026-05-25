export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  // Sidebar colors
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
  // Utility colors
  skeletonBase: string;
  skeletonHighlight: string;
  scrollbarThumb: string;
  scrollbarTrack: string;
  // Layout
  shellBackground: string;
}

export interface ThemeRadius {
  base: string;
}

export interface ThemeMetadata {
  author?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Theme {
  id: string;
  name: string;
  version: string;
  isDefault?: boolean;
  colors: {
    light: ThemeColors;
    dark: ThemeColors;
  };
  radius: ThemeRadius;
  metadata?: ThemeMetadata;
}

export interface ThemeState {
  themes: Theme[];
  activeThemeId: string;
  activeTheme: Theme;
  syncPending: boolean;
  lastSynced: Date | null;
}

// API types for backend sync
export interface ThemeApiResponse {
  success: boolean;
  theme?: Theme;
  error?: string;
}

export interface ThemeApiListResponse {
  success: boolean;
  themes?: Theme[];
  error?: string;
}

export interface ThemeApiError {
  success: false;
  error: string;
}

export interface CreateThemeRequest {
  name: string;
  colors: Theme["colors"];
  radius: Theme["radius"];
  metadata?: ThemeMetadata;
}

export interface UpdateThemeRequest {
  name?: string;
  colors?: Theme["colors"];
  radius?: Theme["radius"];
  metadata?: ThemeMetadata;
}
