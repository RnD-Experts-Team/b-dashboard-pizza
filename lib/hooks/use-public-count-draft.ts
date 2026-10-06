"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Per-item unit counts, kept as the raw input strings the form edits. */
export type PublicCountDraft = Record<number, { u1: string; u2: string; u3: string }>;

/** 3-day TTL — a count link is used within a shift, stale drafts are dropped on load. */
const DRAFT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

interface StoredDraft {
  data: PublicCountDraft;
  savedAt: number;
}

function draftKey(token: string) {
  return `inv-count-draft-${token}`;
}

function loadFromStorage(key: string): PublicCountDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const stored: StoredDraft = JSON.parse(raw);
    if (Date.now() - (stored.savedAt ?? 0) > DRAFT_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return stored.data && typeof stored.data === "object" ? stored.data : null;
  } catch {
    return null;
  }
}

function saveToStorage(key: string, data: PublicCountDraft) {
  try {
    const stored: StoredDraft = { data, savedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(stored));
  } catch {
    /* Ignore QuotaExceededError / private mode */
  }
}

/**
 * Device-local draft of the public inventory count, keyed by link token.
 *
 * Employees count on a phone, and mobile browsers reload background tabs
 * freely — without this, switching apps or refreshing threw away every number
 * entered so far. Saves on every change (no debounce: the tab can be killed
 * at any moment and the payload is tiny), restores on mount, and is cleared
 * once the link is submitted or turns out to be dead.
 */
export function usePublicCountDraft(token: string) {
  const key = draftKey(token);
  const [counts, setCountsRaw] = useState<PublicCountDraft>({});
  const [restored, setRestored] = useState(false);
  // Once cleared (submitted / dead link), stop writing so a late edit can't
  // resurrect the draft.
  const clearedRef = useRef(false);

  useEffect(() => {
    clearedRef.current = false;
    const saved = loadFromStorage(key);
    const hasValues =
      !!saved && Object.values(saved).some((c) => c && (c.u1 || c.u2 || c.u3));
    setCountsRaw(saved ?? {});
    setRestored(hasValues);
  }, [key]);

  /** Saves inside the update, so storage only ever sees user edits — never the initial empty state. */
  const setCounts = useCallback(
    (updater: (prev: PublicCountDraft) => PublicCountDraft) => {
      setCountsRaw((prev) => {
        const next = updater(prev);
        if (!clearedRef.current) saveToStorage(key, next);
        return next;
      });
    },
    [key]
  );

  const clearDraft = useCallback(() => {
    clearedRef.current = true;
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setRestored(false);
  }, [key]);

  return { counts, setCounts, restored, dismissRestored: () => setRestored(false), clearDraft };
}
