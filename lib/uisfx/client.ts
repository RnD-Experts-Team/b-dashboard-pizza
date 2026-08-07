/**
 * Lazy singleton wrapper around the `uisfx` player instance.
 *
 * Constructed without `preferences`, so the library never persists to its own
 * localStorage key — `lib/uisfx/sound.store.ts` is the single source of truth
 * for pack/volume/enabled, and this instance is kept in sync as a side effect
 * (see `lib/uisfx/sync.ts`).
 */

import { createUISFX, type UISFXPlayer } from "uisfx";

let instance: UISFXPlayer | null = null;

export function getUisfxClient(): UISFXPlayer | null {
  if (typeof window === "undefined") return null;
  if (!instance) {
    instance = createUISFX({ pack: "mechanical" });
  }
  return instance;
}
