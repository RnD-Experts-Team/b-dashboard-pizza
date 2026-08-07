/**
 * Call-site helper for semantic outcome sounds (success, error, notification, etc).
 * Centralizes the feature-flag + enabled + unlocked gate so individual call
 * sites don't have to duplicate it.
 */

import type { CueName } from "uisfx";
import { isFeatureEnabled } from "@/lib/config";
import { getUisfxClient } from "./client";
import { useSoundFxStore } from "./sound.store";

export function playSfx(cue: CueName) {
  if (typeof window === "undefined") return;
  if (!isFeatureEnabled("soundFx")) return;

  const { enabled, unlocked } = useSoundFxStore.getState();
  if (!enabled || !unlocked) return;

  try {
    getUisfxClient()?.play(cue);
  } catch {}
}
