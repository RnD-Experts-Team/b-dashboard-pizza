import { z } from "zod/v4";

// Color validation - accepts oklch, hsl, rgb, hex formats
const colorSchema = z.string().refine(
  (val) => {
    // Accept oklch, hsl, rgb, hex, or CSS color variables
    const patterns = [
      /^oklch\([^)]+\)$/,
      /^hsl\([^)]+\)$/,
      /^hsla\([^)]+\)$/,
      /^rgb\([^)]+\)$/,
      /^rgba\([^)]+\)$/,
      /^#[0-9a-fA-F]{3,8}$/,
      /^[a-z]+$/i, // Named colors
    ];
    return patterns.some((pattern) => pattern.test(val.trim()));
  },
  { message: "Must be a valid CSS color (oklch, hsl, rgb, hex, or named)" }
);

// Theme colors schema
const themeColorsSchema = z.object({
  background: colorSchema,
  foreground: colorSchema,
  card: colorSchema,
  cardForeground: colorSchema,
  popover: colorSchema,
  popoverForeground: colorSchema,
  primary: colorSchema,
  primaryForeground: colorSchema,
  secondary: colorSchema,
  secondaryForeground: colorSchema,
  muted: colorSchema,
  mutedForeground: colorSchema,
  accent: colorSchema,
  accentForeground: colorSchema,
  destructive: colorSchema,
  destructiveForeground: colorSchema.optional().default("oklch(0.985 0 0)"),
  border: colorSchema,
  input: colorSchema,
  ring: colorSchema,
  // Sidebar colors
  sidebar: colorSchema,
  sidebarForeground: colorSchema,
  sidebarPrimary: colorSchema,
  sidebarPrimaryForeground: colorSchema,
  sidebarAccent: colorSchema,
  sidebarAccentForeground: colorSchema,
  sidebarBorder: colorSchema,
  sidebarRing: colorSchema,
  // Utility colors
  skeletonBase: colorSchema.optional().default("oklch(0.92 0 0)"),
  skeletonHighlight: colorSchema.optional().default("oklch(0.97 0 0)"),
  scrollbarThumb: colorSchema.optional().default("oklch(0.78 0 0)"),
  scrollbarTrack: colorSchema.optional().default("oklch(0.95 0 0)"),
  shellBackground: colorSchema.optional().default("oklch(0.97 0 0)"),
});

// Radius schema
const radiusSchema = z.object({
  base: z.string().regex(/^[\d.]+rem$/, "Must be a valid rem value (e.g., '0.625rem')"),
});

// Metadata schema
const metadataSchema = z.object({
  author: z.string().optional(),
  description: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// Full theme schema
export const themeSchema = z.object({
  id: z.string().optional(), // Will be generated if not provided
  name: z.string().min(1, "Name is required").max(50, "Name too long"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must be in semver format (e.g., '1.0.0')"),
  isDefault: z.boolean().optional(),
  colors: z.object({
    light: themeColorsSchema,
    dark: themeColorsSchema,
  }),
  radius: radiusSchema,
  metadata: metadataSchema.optional(),
});

// Type inference from schema
export type ThemeSchemaType = z.infer<typeof themeSchema>;

// Validation function
export function validateTheme(data: unknown): { success: boolean; data?: ThemeSchemaType; error?: string } {
  try {
    const result = themeSchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
      return { success: false, error: messages.join("; ") };
    }
    return { success: false, error: "Invalid theme format" };
  }
}

// Safe parse function
export function safeParseTheme(data: unknown) {
  return themeSchema.safeParse(data);
}
