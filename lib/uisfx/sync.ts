/**
 * Side-effect module that pushes preference changes into the live `uisfx`
 * instance — the "apply-theme.ts" analog for sound, kept separate from the
 * store so the store stays a plain state container.
 */

import type { PackName } from "uisfx";
import { getUisfxClient } from "./client";

export function applyPack(pack: PackName) {
  try {
    getUisfxClient()?.setPack(pack);
  } catch {
    // Web Audio can throw in locked-down/unsupported environments — a
    // preference change should never break the app.
  }
}

export function applyVolume(volume: number) {
  try {
    getUisfxClient()?.setVolume(volume);
  } catch {}
}

export function applyEnabled(enabled: boolean) {
  try {
    getUisfxClient()?.setEnabled(enabled);
  } catch {}
}

export function initUisfx(state: { pack: PackName; volume: number; enabled: boolean }) {
  applyPack(state.pack);
  applyVolume(state.volume);
  applyEnabled(state.enabled);
}
