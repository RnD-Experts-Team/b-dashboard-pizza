"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Palette,
  Check,
  RotateCcw,
  Save,
  ChevronDown,
  ChevronRight,
  Upload,
  Copy,
  Download,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useThemeStore, COLOR_VAR_MAP, generateThemeCSS, getCurrentMode } from "@/lib/theme";
import { cssValueToHex } from "@/lib/theme/color-utils";
import type { Theme, ThemeColors } from "@/lib/theme/types";

/* ─── Color section definitions (no charts) ─────────────────────────── */

interface ColorToken {
  key: keyof ThemeColors;
  label: string;
  description: string;
}

interface ColorSection {
  id: string;
  label: string;
  tokens: ColorToken[];
}

const COLOR_SECTIONS: ColorSection[] = [
  {
    id: "base",
    label: "Base",
    tokens: [
      { key: "shellBackground", label: "Shell Canvas", description: "Outer wrapper behind sidebar & content panels" },
      { key: "background", label: "Page Background", description: "Main content area background" },
      { key: "foreground", label: "Foreground", description: "Primary text" },
    ],
  },
  {
    id: "card",
    label: "Card",
    tokens: [
      { key: "card", label: "Card", description: "Card background" },
      { key: "cardForeground", label: "Card Text", description: "Text inside cards" },
    ],
  },
  {
    id: "popover",
    label: "Popover",
    tokens: [
      { key: "popover", label: "Popover", description: "Dropdown/popover background" },
      { key: "popoverForeground", label: "Popover Text", description: "Text inside popovers" },
    ],
  },
  {
    id: "primary",
    label: "Primary",
    tokens: [
      { key: "primary", label: "Primary", description: "Buttons, key actions, links" },
      { key: "primaryForeground", label: "Primary Text", description: "Text on primary color" },
    ],
  },
  {
    id: "secondary",
    label: "Secondary",
    tokens: [
      { key: "secondary", label: "Secondary", description: "Secondary buttons & surfaces" },
      { key: "secondaryForeground", label: "Secondary Text", description: "Text on secondary" },
    ],
  },
  {
    id: "muted",
    label: "Muted",
    tokens: [
      {
        key: "muted",
        label: "Muted",
        description: "Muted surfaces, subtle fills & secondary backgrounds",
      },
      { key: "mutedForeground", label: "Muted Text", description: "Subdued text & placeholders" },
    ],
  },
  {
    id: "accent",
    label: "Accent",
    tokens: [
      { key: "accent", label: "Accent", description: "Hover states & accent surfaces" },
      { key: "accentForeground", label: "Accent Text", description: "Text on accent" },
    ],
  },
  {
    id: "destructive",
    label: "Destructive",
    tokens: [
      { key: "destructive", label: "Destructive", description: "Error & danger color" },
      {
        key: "destructiveForeground",
        label: "Destructive Text",
        description: "Text on destructive",
      },
    ],
  },
  {
    id: "borders",
    label: "Borders & Input",
    tokens: [
      { key: "border", label: "Border", description: "Default border color" },
      { key: "input", label: "Input Border", description: "Input field border" },
      { key: "ring", label: "Focus Ring", description: "Focus outline color" },
    ],
  },
  {
    id: "sidebar",
    label: "Sidebar",
    tokens: [
      { key: "sidebar", label: "Sidebar BG", description: "Sidebar background" },
      { key: "sidebarForeground", label: "Sidebar Text", description: "Sidebar text" },
      { key: "sidebarPrimary", label: "Active Item", description: "Active nav item color" },
      {
        key: "sidebarPrimaryForeground",
        label: "Active Item Text",
        description: "Active nav text",
      },
      { key: "sidebarAccent", label: "Hover BG", description: "Sidebar hover/accent" },
      { key: "sidebarAccentForeground", label: "Hover Text", description: "Sidebar hover text" },
      { key: "sidebarBorder", label: "Sidebar Border", description: "Sidebar dividers" },
      { key: "sidebarRing", label: "Sidebar Ring", description: "Sidebar focus ring" },
    ],
  },
  {
    id: "utilities",
    label: "Utilities",
    tokens: [
      { key: "skeletonBase", label: "Skeleton Base", description: "Loading skeleton base" },
      {
        key: "skeletonHighlight",
        label: "Skeleton Shine",
        description: "Loading skeleton highlight",
      },
      { key: "scrollbarThumb", label: "Scrollbar Thumb", description: "Scrollbar handle color" },
      { key: "scrollbarTrack", label: "Scrollbar Track", description: "Scrollbar track color" },
    ],
  },
];

/* ─── ColorRow ───────────────────────────────────────────────────────── */

interface ColorRowProps {
  token: ColorToken;
  value: string;
  onChange: (key: keyof ThemeColors, value: string) => void;
}

function ColorRow({ token, value, onChange }: ColorRowProps) {
  const [textValue, setTextValue] = useState(value);
  const [hexValue, setHexValue] = useState("#000000");
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Sync when external value changes
  useEffect(() => {
    setTextValue(value);
    if (typeof window !== "undefined") {
      const hex = cssValueToHex(value);
      setHexValue(hex);
    }
  }, [value]);

  const commit = useCallback(
    (newValue: string) => {
      const trimmed = newValue.trim();
      if (!trimmed) return;
      onChange(token.key, trimmed);
      const hex = cssValueToHex(trimmed);
      setHexValue(hex);
    },
    [token.key, onChange]
  );

  // Attach native "change" event (fires once when the picker is closed/committed)
  // so we only push to React state once per pick, not on every drag tick.
  useEffect(() => {
    const input = colorInputRef.current;
    if (!input) return;
    const handleNativeChange = () => commit(input.value);
    input.addEventListener("change", handleNativeChange);
    return () => input.removeEventListener("change", handleNativeChange);
  }, [commit]);

  // React's onChange fires on every drag tick — only update local state +
  // direct DOM CSS-var so the swatch reacts instantly without re-rendering
  // the whole editor.
  const handlePickerInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    setHexValue(hex);
    setTextValue(hex);
    // Direct DOM preview — bypasses the React state → useEffect → applyDraftToDom chain
    const cssVar = COLOR_VAR_MAP[token.key];
    if (cssVar && typeof document !== "undefined") {
      document.documentElement.style.setProperty(cssVar, hex);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTextValue(e.target.value);
  };

  const handleTextBlur = () => commit(textValue);
  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commit(textValue);
      e.currentTarget.blur();
    }
  };

  return (
    <div className="flex items-center gap-2 py-1.5 group">
      {/* Color swatch + picker */}
      <div className="relative shrink-0">
        <button
          type="button"
          className="h-8 w-8 rounded-md border border-border shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ backgroundColor: value }}
          onClick={() => colorInputRef.current?.click()}
          title={`Pick color for ${token.label}`}
        />
        <input
          ref={colorInputRef}
          type="color"
          value={hexValue}
          onChange={handlePickerInput}
          className="sr-only"
          tabIndex={-1}
        />
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium leading-tight">{token.label}</p>
        <p className="text-xs text-muted-foreground leading-tight truncate hidden group-hover:block">
          {token.description}
        </p>
      </div>

      {/* Text input */}
      <Input
        value={textValue}
        onChange={handleTextChange}
        onBlur={handleTextBlur}
        onKeyDown={handleTextKeyDown}
        className="w-40 text-xs font-mono h-8 px-2"
        placeholder="oklch(...) or #hex"
        spellCheck={false}
      />
    </div>
  );
}

/* ─── Collapsible color section ──────────────────────────────────────── */

interface SectionProps {
  section: ColorSection;
  colors: ThemeColors;
  onChange: (key: keyof ThemeColors, value: string) => void;
  defaultOpen?: boolean;
}

function ColorSectionPanel({ section, colors, onChange, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/70 transition-colors text-start"
      >
        <div className="flex items-center gap-2">
          {/* Mini color preview dots */}
          <div className="flex gap-0.5">
            {section.tokens.slice(0, 3).map((t) => (
              <div
                key={t.key}
                className="h-3 w-3 rounded-full border border-border/40 shrink-0"
                style={{ backgroundColor: colors[t.key] }}
              />
            ))}
          </div>
          <span className="text-xs font-semibold">{section.label}</span>
        </div>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="px-3 py-1 divide-y divide-border/30">
          {section.tokens.map((token) => (
            <ColorRow
              key={token.key}
              token={token}
              value={colors[token.key] || ""}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Quick theme picker strip ───────────────────────────────────────── */

interface QuickThemeCardProps {
  theme: Theme;
  isActive: boolean;
  onSelect: () => void;
}

function QuickThemeCard({ theme, isActive, onSelect }: QuickThemeCardProps) {
  const { primary, secondary, accent, background } = theme.colors.light;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative shrink-0 rounded-lg border-2 overflow-hidden transition-all hover:scale-105",
        isActive ? "border-primary shadow-md" : "border-border/50 hover:border-primary/50"
      )}
      title={theme.name}
    >
      <div className="flex h-8 w-16">
        <div className="flex-1" style={{ backgroundColor: primary }} />
        <div className="flex-1" style={{ backgroundColor: secondary }} />
        <div className="flex-1" style={{ backgroundColor: accent }} />
        <div className="flex-1" style={{ backgroundColor: background }} />
      </div>
      {isActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Check className="h-3 w-3 text-white drop-shadow" />
        </div>
      )}
      <p className="text-[9px] font-medium text-center py-0.5 bg-background/80 leading-tight truncate px-1">
        {theme.name}
      </p>
    </button>
  );
}

/* ─── Main ThemeEditor component ─────────────────────────────────────── */

interface ThemeEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type EditMode = "light" | "dark";

export function ThemeEditor({ open, onOpenChange }: ThemeEditorProps) {
  const {
    themes,
    activeThemeId,
    activeTheme,
    setActiveTheme,
    addTheme,
    updateTheme,
    importTheme,
    exportTheme,
  } = useThemeStore();

  const [editMode, setEditMode] = useState<EditMode>("light");
  const [draftLight, setDraftLight] = useState<ThemeColors>({ ...activeTheme.colors.light });
  const [draftDark, setDraftDark] = useState<ThemeColors>({ ...activeTheme.colors.dark });
  const [draftRadius, setDraftRadius] = useState(
    parseFloat(activeTheme.radius.base) || 0.625
  );
  const [isDirty, setIsDirty] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [copied, setCopied] = useState(false);

  const originalThemeRef = useRef<Theme>(activeTheme);

  /* Initialize draft when sheet opens or active theme changes externally */
  useEffect(() => {
    if (open) {
      originalThemeRef.current = activeTheme;
      setDraftLight({ ...activeTheme.colors.light });
      setDraftDark({ ...activeTheme.colors.dark });
      setDraftRadius(parseFloat(activeTheme.radius.base) || 0.625);
      setSaveName(`${activeTheme.name} Copy`);
      setIsDirty(false);
      setShowSaveInput(false);
      setEditMode(getCurrentMode()); // sync tab to actual doc mode
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Sync when user picks a different built-in theme from the quick picker */
  const handleQuickThemeSelect = (themeId: string) => {
    const theme = themes.find((t) => t.id === themeId);
    if (!theme) return;
    setActiveTheme(themeId); // applies to DOM via store
    originalThemeRef.current = theme;
    setDraftLight({ ...theme.colors.light });
    setDraftDark({ ...theme.colors.dark });
    setDraftRadius(parseFloat(theme.radius.base) || 0.625);
    setSaveName(`${theme.name} Copy`);
    setIsDirty(false);
    setShowSaveInput(false);
  };

  /* Apply draft colors directly to DOM (live preview) */
  const applyDraftToDom = useCallback(
    (
      light: ThemeColors,
      dark: ThemeColors,
      radius: number
    ) => {
      if (typeof window === "undefined") return;
      // Always preview using the actual current document mode so we never
      // accidentally overwrite dark-mode vars with light-mode values.
      const colors = getCurrentMode() === "dark" ? dark : light;
      const root = document.documentElement;
      for (const [key, cssVar] of Object.entries(COLOR_VAR_MAP)) {
        const value = colors[key as keyof ThemeColors];
        if (value) root.style.setProperty(cssVar, value);
      }
      root.style.setProperty("--radius", `${radius}rem`);
    },
    []
  );

  /* Re-apply whenever draft changes */
  useEffect(() => {
    if (open) {
      applyDraftToDom(draftLight, draftDark, draftRadius);
    }
  }, [draftLight, draftDark, draftRadius, open, applyDraftToDom]);

  const handleColorChange = useCallback(
    (key: keyof ThemeColors, value: string) => {
      setIsDirty(true);
      if (editMode === "light") {
        setDraftLight((prev) => ({ ...prev, [key]: value }));
      } else {
        setDraftDark((prev) => ({ ...prev, [key]: value }));
      }
    },
    [editMode]
  );

  const handleRadiusChange = (values: number[]) => {
    setIsDirty(true);
    setDraftRadius(values[0]);
  };

  /* Revert to original theme */
  const handleReset = () => {
    const original = originalThemeRef.current;
    setDraftLight({ ...original.colors.light });
    setDraftDark({ ...original.colors.dark });
    setDraftRadius(parseFloat(original.radius.base) || 0.625);
    setActiveTheme(original.id);
    setIsDirty(false);
  };

  /* Save as new custom theme */
  const handleSaveNew = () => {
    const name = saveName.trim() || "Custom Theme";
    const newTheme: Theme = {
      id: `custom-${Date.now()}`,
      name,
      version: "1.0.0",
      isDefault: false,
      colors: { light: { ...draftLight }, dark: { ...draftDark } },
      radius: { base: `${draftRadius}rem` },
      metadata: { description: "Custom theme", createdAt: new Date().toISOString() },
    };
    addTheme(newTheme);
    setActiveTheme(newTheme.id);
    originalThemeRef.current = newTheme;
    setIsDirty(false);
    setShowSaveInput(false);
  };

  /* Update existing custom theme */
  const handleUpdateCurrent = () => {
    if (activeTheme.isDefault) {
      // Fork built-in → new custom
      setShowSaveInput(true);
      return;
    }
    updateTheme(activeThemeId, {
      colors: { light: { ...draftLight }, dark: { ...draftDark } },
      radius: { base: `${draftRadius}rem` },
      metadata: { ...activeTheme.metadata, updatedAt: new Date().toISOString() },
    });
    setIsDirty(false);
  };

  /* JSON import */
  const handleImportJson = () => {
    setImportError(null);
    const result = importTheme(importJson);
    if (result.success && result.theme) {
      handleQuickThemeSelect(result.theme.id);
      setImportJson("");
      setShowImport(false);
    } else {
      setImportError(result.error || "Invalid JSON");
    }
  };

  /* JSON export copy */
  const handleCopyJson = () => {
    const json = exportTheme(activeThemeId);
    if (json) {
      navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  /* Close — restore original theme */
  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && isDirty) {
      // Reapply original so closing doesn't leave staged colors
      applyDraftToDom(
        originalThemeRef.current.colors.light,
        originalThemeRef.current.colors.dark,
        parseFloat(originalThemeRef.current.radius.base) || 0.625
      );
      // Restore via store
      setActiveTheme(originalThemeRef.current.id);
    }
    onOpenChange(nextOpen);
  };

  const currentColors = editMode === "light" ? draftLight : draftDark;
  const radiusDisplayValue = draftRadius.toFixed(3).replace(/\.?0+$/, "");

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="w-full sm:w-120 sm:max-w-120 p-0 flex flex-col overflow-hidden"
      >
        {/* ── Header ── */}
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            <SheetTitle className="text-base">Theme Editor</SheetTitle>
            {isDirty && (
              <Badge variant="secondary" className="text-xs py-0 h-4">
                unsaved
              </Badge>
            )}
          </div>
          <SheetDescription className="text-xs">
            Edit live — changes apply instantly to the page
          </SheetDescription>
        </SheetHeader>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

          {/* Quick theme picker */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Presets
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
              {themes.map((theme) => (
                <QuickThemeCard
                  key={theme.id}
                  theme={theme}
                  isActive={theme.id === activeThemeId && !isDirty}
                  onSelect={() => handleQuickThemeSelect(theme.id)}
                />
              ))}
            </div>
          </div>

          <Separator />

          {/* Mode toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
            {(["light", "dark"] as EditMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setEditMode(m)}
                className={cn(
                  "flex-1 py-1.5 capitalize transition-colors",
                  editMode === m
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {m === "light" ? "☀️ Light" : "🌙 Dark"}
              </button>
            ))}
          </div>

          {/* Color sections */}
          <div className="space-y-2">
            {COLOR_SECTIONS.map((section, i) => (
              <ColorSectionPanel
                key={section.id}
                section={section}
                colors={currentColors}
                onChange={handleColorChange}
                defaultOpen={i < 2}
              />
            ))}
          </div>

          <Separator />

          {/* Border radius */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold">Border Radius</Label>
              <span className="text-xs font-mono text-muted-foreground">{radiusDisplayValue}rem</span>
            </div>
            <Slider
              min={0}
              max={1.5}
              step={0.025}
              value={[draftRadius]}
              onValueChange={handleRadiusChange}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0 (square)</span>
              <span>1.5rem (pill)</span>
            </div>
            {/* Preview */}
            <div className="flex gap-2 mt-3">
              {[0.25, 0.5, 1].map((factor) => (
                <div
                  key={factor}
                  className="h-8 flex-1 bg-primary/20 border border-primary/30"
                  style={{ borderRadius: `${draftRadius * factor}rem` }}
                />
              ))}
            </div>
          </div>

          <Separator />

          {/* JSON Import/Export */}
          <div>
            <button
              type="button"
              onClick={() => setShowImport((v) => !v)}
              className="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <span className="flex items-center gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                JSON Import / Export
              </span>
              {showImport ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
            {showImport && (
              <div className="space-y-2">
                <Textarea
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder='Paste a theme JSON here, e.g. {"name": "My Theme", "version": "1.0.0", ...}'
                  className="h-28 text-xs font-mono resize-none"
                />
                {importError && (
                  <p className="text-xs text-destructive">{importError}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs h-7"
                    onClick={handleImportJson}
                    disabled={!importJson.trim()}
                  >
                    <Upload className="h-3 w-3 me-1" />
                    Apply JSON
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs h-7"
                    onClick={handleCopyJson}
                  >
                    {copied ? (
                      <Check className="h-3 w-3 me-1" />
                    ) : (
                      <Copy className="h-3 w-3 me-1" />
                    )}
                    {copied ? "Copied!" : "Copy Current"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="shrink-0 border-t border-border px-4 py-3 space-y-2">
          {showSaveInput ? (
            <div className="flex gap-2">
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Theme name…"
                className="h-8 text-sm flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveNew();
                  if (e.key === "Escape") setShowSaveInput(false);
                }}
              />
              <Button size="sm" className="h-8 text-xs" onClick={handleSaveNew}>
                <Save className="h-3 w-3 me-1" />
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => setShowSaveInput(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={handleUpdateCurrent}
                disabled={!isDirty}
              >
                <Save className="h-3 w-3 me-1" />
                {activeTheme.isDefault ? "Save as New" : "Save Changes"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => {
                  setSaveName(`${activeTheme.name} Copy`);
                  setShowSaveInput(true);
                }}
                disabled={!isDirty}
              >
                Fork
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={handleReset}
                disabled={!isDirty}
                title="Discard changes"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground text-center">
            Theme is auto-saved to browser storage
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
