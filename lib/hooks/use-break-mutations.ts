"use client";

import { useCallback } from "react";
import { breaksService } from "@/lib/api/services/breaks.service";
import { useBreaksStore } from "@/lib/store/breaks.store";
import type {
  BreakEntry,
  BreakNote,
  BreakSettings,
  CreateBreakInput,
  UpdateBreakInput,
} from "@/types/breaks.types";

/**
 * Every write outside start/stop (those live on the store, which the topbar
 * shares). Each one resyncs the shared store — an edit can move a break
 * across work days, reopen it, or change today's totals — and rethrows the
 * parsed `BreakError` for the caller to render inline.
 */
export function useBreakMutations() {
  const refresh = useBreaksStore((s) => s.refresh);
  const setSettings = useBreaksStore((s) => s.setSettings);

  const after = useCallback(
    async <T,>(p: Promise<T>): Promise<T> => {
      try {
        return await p;
      } finally {
        void refresh();
      }
    },
    [refresh]
  );

  const create = useCallback(
    (input: CreateBreakInput): Promise<BreakEntry> => after(breaksService.create(input)),
    [after]
  );

  const update = useCallback(
    (id: number, input: UpdateBreakInput): Promise<BreakEntry> =>
      after(breaksService.update(id, input)),
    [after]
  );

  const remove = useCallback((id: number): Promise<void> => after(breaksService.remove(id)), [after]);

  const addNote = useCallback(
    (id: number, body: string): Promise<BreakNote> => after(breaksService.addNote(id, body)),
    [after]
  );

  const saveAllowance = useCallback(
    async (minutes: number): Promise<BreakSettings> => {
      const settings = await after(breaksService.updateSettings(minutes));
      setSettings(settings);
      return settings;
    },
    [after, setSettings]
  );

  const saveMilestones = useCallback(
    async (thresholds: number[]): Promise<number[]> => {
      const saved = await after(breaksService.replaceMilestones(thresholds));
      const current = useBreaksStore.getState().settings;
      if (current) setSettings({ ...current, thresholds: saved });
      return saved;
    },
    [after, setSettings]
  );

  return { create, update, remove, addNote, saveAllowance, saveMilestones };
}
