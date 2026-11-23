"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ACCENT_PRESETS,
  accentOf,
  contrastWarning,
  hexToRgb,
  normalizeHex,
  readableOn,
  type ContrastWarning,
} from "@/lib/announcements/colors";
import { AccentFrame } from "../display/accent-frame";
import { AccentTitle } from "../display/accent-title";

export interface AccentValue {
  /** `color_start`: a solid colour on its own. */
  start: string | null;
  /** `color_end`: with `start`, makes a gradient. Never set without `start`. */
  end: string | null;
}

export interface AccentColorPickerProps {
  value: AccentValue;
  onChange: (value: AccentValue) => void;
  /** The backend's message for `color_start` / `color_end` (a 422), shown inline. */
  error?: string | null;
  disabled?: boolean;
  /** The sample title in the preview. Defaults to a translated placeholder. */
  previewTitle?: string;
  id?: string;
  className?: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Colour helpers                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

const LIVE_HEX = /^#?[0-9a-f]{6}$/i;

function rgbToHex(r: number, g: number, b: number): string {
  const part = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Rotate a colour's hue: a sensible second stop when someone switches to Gradient. */
function shiftHue(hex: string, degrees: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  h = (h + degrees + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255);
}

/** The preset's own second colour when the start is a preset start, else a hue shift. */
function suggestEnd(start: string): string {
  const preset = ACCENT_PRESETS.find((p) => p.start === start && p.end);
  return preset?.end ?? shiftHue(start, 45);
}

function swatchBackground(start: string, end: string | null): string {
  return end ? `linear-gradient(135deg, ${start}, ${end})` : start;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  One colour input: native picker + hex field                               */
/* ────────────────────────────────────────────────────────────────────────── */

function ColorField({
  label,
  value,
  onCommit,
  disabled,
}: {
  label: string;
  /** The committed, normalised colour (or null). */
  value: string | null;
  onCommit: (hex: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("announcements.pickers.color");
  const hexId = useId();
  const [draft, setDraft] = useState(value ?? "");
  const [prev, setPrev] = useState(value);
  const [touched, setTouched] = useState(false);

  // Follow outside changes (a preset, Clear, edit mode loading) without
  // fighting what is being typed: only replace the draft if it no longer means
  // the committed value.
  if (prev !== value) {
    setPrev(value);
    if (normalizeHex(draft) !== value) setDraft(value ?? "");
  }

  const invalid = touched && draft.trim() !== "" && normalizeHex(draft) === null;

  const commitDraft = () => {
    setTouched(true);
    const hex = normalizeHex(draft);
    if (hex) {
      setDraft(hex);
      if (hex !== value) onCommit(hex);
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <label
        className={cn(
          "relative size-9 shrink-0 overflow-hidden rounded-md border shadow-xs focus-within:ring-[3px] focus-within:ring-ring/50",
          disabled && "opacity-50",
          !value && "bg-muted",
        )}
        style={value ? { backgroundColor: value } : undefined}
      >
        <span className="sr-only">{label}</span>
        <input
          type="color"
          value={value ?? "#000000"}
          disabled={disabled}
          onChange={(event) => onCommit(event.target.value.toLowerCase())}
          className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </label>

      <div className="min-w-0">
        <label htmlFor={hexId} className="sr-only">
          {t("hex", { label })}
        </label>
        <input
          id={hexId}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={7}
          value={draft}
          disabled={disabled}
          placeholder="#ff6b6b"
          aria-invalid={invalid || undefined}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            // A full six-digit code commits as you type; shorthand waits for blur.
            if (LIVE_HEX.test(next.trim())) {
              const hex = normalizeHex(next);
              if (hex && hex !== value) onCommit(hex);
            }
          }}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            }
          }}
          className="h-9 w-24 rounded-md border border-input bg-transparent px-2 font-mono text-sm uppercase outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:opacity-50 dark:bg-input/30"
        />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Picker                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

type Mode = "solid" | "gradient";

/**
 * Choose an announcement's accent: a preset swatch, or a custom solid colour
 * or gradient. Shows a live preview built from the real `AccentFrame` and
 * `AccentTitle`, and warns when the colour will be hard to see on the card in
 * the CURRENT theme (it reads the live card colour, so it follows light/dark
 * and the user's chosen theme).
 *
 * `end` can never be set without `start` (the server answers 422), and the UI
 * cannot produce that state.
 */
export function AccentColorPicker({
  value,
  onChange,
  error,
  disabled = false,
  previewTitle,
  id,
  className,
}: AccentColorPickerProps) {
  const t = useTranslations("announcements.pickers.color");
  const tPresets = useTranslations("announcements.colors.presets");
  const { resolvedTheme } = useTheme();

  const start = normalizeHex(value.start);
  const end = start ? normalizeHex(value.end) : null;

  const [mode, setMode] = useState<Mode>(end ? "gradient" : "solid");
  const [prevEnd, setPrevEnd] = useState(end);
  // A preset or an edit that brings a gradient in (or takes it out) moves the switch.
  if (prevEnd !== end) {
    setPrevEnd(end);
    setMode(end ? "gradient" : "solid");
  }

  const accent = useMemo(
    () => accentOf({ color_start: start, color_end: end }),
    [start, end],
  );

  const [warning, setWarning] = useState<ContrastWarning | null>(null);
  useEffect(() => {
    setWarning(contrastWarning(start, end));
  }, [start, end, resolvedTheme]);

  const hasAccent = !!start;

  const chooseMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    if (next === "solid") {
      if (end) onChange({ start, end: null });
    } else if (start && !end) {
      onChange({ start, end: suggestEnd(start) });
    }
  };

  return (
    <div
      id={id}
      role="group"
      aria-label={t("label")}
      data-slot="accent-color-picker"
      className={cn("space-y-3", className)}
    >
      {/* Presets */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{t("presets")}</p>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled || !hasAccent}
            onClick={() => onChange({ start: null, end: null })}
            className="text-muted-foreground"
          >
            <X aria-hidden />
            {t("clear")}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {ACCENT_PRESETS.map((preset) => {
            const selected =
              start === preset.start && (end ?? null) === (preset.end ?? null);
            const name = tPresets(preset.id);
            return (
              <button
                key={preset.id}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                aria-label={name}
                title={name}
                onClick={() => onChange({ start: preset.start, end: preset.end })}
                className={cn(
                  "relative flex size-8 items-center justify-center rounded-full border border-black/10 shadow-xs transition-[scale,box-shadow] duration-150 outline-none hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:scale-100 dark:border-white/15",
                  selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                )}
                style={{ background: swatchBackground(preset.start, preset.end) }}
              >
                {selected && (
                  <Check
                    className="size-4"
                    style={{ color: readableOn(preset.start) }}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t("custom")}</p>
          <div
            role="radiogroup"
            aria-label={t("mode")}
            className="inline-flex rounded-md bg-muted p-0.5"
          >
            {(["solid", "gradient"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={mode === option}
                disabled={disabled}
                onClick={() => chooseMode(option)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50",
                  mode === option
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(option)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <ColorField
            label={t("startColor")}
            value={start}
            disabled={disabled}
            onCommit={(hex) =>
              onChange({
                start: hex,
                end: mode === "gradient" ? (end ?? suggestEnd(hex)) : null,
              })
            }
          />
          {mode === "gradient" && (
            <>
              <span className="text-muted-foreground rtl:rotate-180" aria-hidden>
                →
              </span>
              <ColorField
                label={t("endColor")}
                value={end}
                disabled={disabled || !start}
                onCommit={(hex) => start && onChange({ start, end: hex })}
              />
            </>
          )}
        </div>
        {mode === "gradient" && !start && (
          <p className="text-[11px] text-muted-foreground">{t("pickStartFirst")}</p>
        )}
      </div>

      {/* Live preview */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("preview")}</p>
        <AccentFrame accent={accent} rounded="rounded-lg" className="w-full">
          <div className="space-y-2 p-3">
            <AccentTitle as="p" accent={accent} className="text-sm">
              {previewTitle ?? t("previewTitle")}
            </AccentTitle>
            <div className="space-y-1.5" aria-hidden>
              <div className="h-1.5 w-11/12 rounded-full bg-muted" />
              <div className="h-1.5 w-7/12 rounded-full bg-muted" />
            </div>
          </div>
        </AccentFrame>
      </div>

      {warning && (
        <p
          role="status"
          className="flex items-start gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/15 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">
            {t(warning.level === "veryLow" ? "contrastVeryLow" : "contrastLow", {
              color: t(warning.color === "start" ? "startColor" : "endColor"),
              ratio: warning.ratio.toFixed(1),
            })}
          </span>
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
