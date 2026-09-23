"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Single global scratchpad — deliberately not scoped per store. */
const STORAGE_KEY = "notepad-draft";
const MAX_CHARS = 20000;
/** Debounce before writing to localStorage, same as the debrief form's draft. */
const AUTOSAVE_MS = 600;
/** How long the "Saved" badge stays up after a write. */
const SAVED_FLASH_MS = 2000;
/** How long the Clear button stays armed before falling back to its idle label. */
const CLEAR_ARM_MS = 3000;

function loadNote(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveNote(text: string): void {
  if (typeof window === "undefined") return;
  try {
    if (text) localStorage.setItem(STORAGE_KEY, text);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private-mode / quota failures are not worth interrupting the manager over.
  }
}

/**
 * Free-form personal notepad for the floating debrief panel. Frontend only —
 * the text never leaves this device, so there is no store, service or route
 * behind it, just a debounced localStorage write.
 */
export function DebriefNotepad() {
  const t = useTranslations("notepad");
  const [text, setText] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [clearArmed, setClearArmed] = useState(false);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearArmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestText = useRef("");

  // Read the saved note once on mount. Rendering starts empty so the server and
  // client agree on the first paint; `hydrated` then unblocks the save effect.
  useEffect(() => {
    const stored = loadNote();
    setText(stored);
    latestText.current = stored;
    setHydrated(true);
  }, []);

  // Auto-save AUTOSAVE_MS after the last keystroke.
  useEffect(() => {
    if (!hydrated) return;
    latestText.current = text;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveNote(text);
      setSavedFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setSavedFlash(false), SAVED_FLASH_MS);
    }, AUTOSAVE_MS);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [text, hydrated]);

  // Flush on unmount — the whole panel disappears on /due-keys routes and when
  // permissions change, which would otherwise drop the last <600ms of typing.
  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (clearArmTimer.current) clearTimeout(clearArmTimer.current);
      saveNote(latestText.current);
    };
  }, []);

  const handleClearClick = () => {
    if (clearArmTimer.current) clearTimeout(clearArmTimer.current);
    if (!clearArmed) {
      setClearArmed(true);
      clearArmTimer.current = setTimeout(() => setClearArmed(false), CLEAR_ARM_MS);
      return;
    }
    setClearArmed(false);
    setText("");
    latestText.current = "";
    saveNote("");
  };

  const ratio = text.length / MAX_CHARS;

  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
        placeholder={t("placeholder")}
        spellCheck={false}
        className="min-h-64 resize-none text-xs leading-relaxed border-border/60 focus-visible:ring-1"
      />

      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground">{t("hint")}</p>
        <div className="flex shrink-0 items-center gap-2">
          {ratio >= 0.8 && (
            <span
              className={cn(
                "text-[10px] tabular-nums",
                ratio >= 1
                  ? "font-medium text-destructive"
                  : "text-yellow-600 dark:text-yellow-400"
              )}
            >
              {t("charCount", { count: text.length, max: MAX_CHARS })}
            </span>
          )}
          {savedFlash && (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" />
              {t("saved")}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 gap-1.5 px-2 text-[11px]",
              clearArmed && "text-destructive hover:text-destructive"
            )}
            onClick={handleClearClick}
            disabled={!text}
          >
            <Eraser className="h-3 w-3" />
            {clearArmed ? t("clearConfirm") : t("clear")}
          </Button>
        </div>
      </div>
    </div>
  );
}
