"use client";

import { useEffect } from "react";
import { useFeature } from "@/lib/config";
import { useSoundFxStore } from "@/lib/uisfx/sound.store";
import { getUisfxClient } from "@/lib/uisfx/client";
import { initUisfx } from "@/lib/uisfx/sync";
import { playSfx } from "@/lib/uisfx/play";

/**
 * Any element whose click counts as a genuine "press" — not plain text/card
 * backgrounds. Includes common ARIA roles used by Radix UI primitives
 * (dropdown menu items, select options, tabs) which render as
 * `<div role="...">` rather than a native `<button>`.
 */
const INTERACTIVE_SELECTOR = [
  "button",
  "a",
  "[role='button']",
  "[role='menuitem']",
  "[role='menuitemcheckbox']",
  "[role='menuitemradio']",
  "[role='option']",
  "[role='tab']",
  "[role='switch']",
  "[role='checkbox']",
  "[role='radio']",
  "input[type='button']",
  "input[type='submit']",
  "input[type='checkbox']",
  "input[type='radio']",
  "select",
  "summary",
].join(", ");

/**
 * Global sound-fx singleton.
 *
 * Mounted once in AppShell and persists across route changes. Owns:
 * 1. The first-trusted-interaction unlock required by uisfx's Web Audio
 *    autoplay policy — merged into the same click handler as #2 below so the
 *    very first click both unlocks AND plays its own press sound, instead of
 *    silently arming the AudioContext and only producing sound from the
 *    *second* click onward.
 * 2. A single delegated click listener that plays the "press" cue for any
 *    genuine interactive-element click, site-wide — no per-component wiring.
 *
 * Always renders null.
 */
export function SoundFxInit() {
  const soundFxEnabled = useFeature("soundFx");
  const pack = useSoundFxStore((s) => s.pack);
  const volume = useSoundFxStore((s) => s.volume);
  const enabled = useSoundFxStore((s) => s.enabled);

  // Sync current preferences into the client whenever they change (covers the
  // case where this component mounts before the store finishes rehydrating).
  useEffect(() => {
    if (!soundFxEnabled) return;
    initUisfx({ pack, volume, enabled });
  }, [soundFxEnabled, pack, volume, enabled]);

  // Keyboard-only first interaction (e.g. tabbing without ever clicking)
  // still arms the AudioContext even when no click event follows it.
  useEffect(() => {
    if (!soundFxEnabled) return;
    if (useSoundFxStore.getState().unlocked) return;

    const handleUnlock = () => {
      getUisfxClient()
        ?.unlock()
        .then((ok) => {
          if (ok) useSoundFxStore.getState().setUnlocked(true);
        });
    };

    window.addEventListener("keydown", handleUnlock, { once: true });
    return () => window.removeEventListener("keydown", handleUnlock);
  }, [soundFxEnabled]);

  // Global delegated press/click sound. Also unlocks on the very first click
  // (awaited before playing) so that first click can make sound itself,
  // instead of only silently arming the AudioContext for later clicks.
  useEffect(() => {
    if (!soundFxEnabled) return;

    const handleClick = async (event: MouseEvent) => {
      const target = event.target as Element | null;
      const isInteractive = Boolean(target?.closest(INTERACTIVE_SELECTOR));

      if (!useSoundFxStore.getState().unlocked) {
        const ok = await getUisfxClient()?.unlock();
        if (ok) useSoundFxStore.getState().setUnlocked(true);
      }

      if (isInteractive) {
        playSfx("press");
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [soundFxEnabled]);

  return null;
}
