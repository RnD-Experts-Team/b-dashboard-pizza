"use client";

import { useCallback, useEffect, useState } from "react";
import { reportBuilderService } from "@/lib/api/services/report-builder.service";
import { isCancelled, readReportError, type ReportError } from "@/lib/report-builder/errors";
import { scheduleToInput } from "@/lib/report-builder/schedule";
import type { ReportSchedule, ScheduleInput } from "@/types/report-builder.types";

interface UseReportSchedulesResult {
  /** The caller's schedules (Data decides which). */
  schedules: ReportSchedule[];
  isLoading: boolean;
  error: ReportError | null;
  reload: () => void;
  /** Creates one and loads the list again. A 503 means the token could not be minted: nothing was created. */
  create: (input: ScheduleInput) => Promise<ReportSchedule>;
  /** Replaces one (full body) and loads the list again. */
  update: (id: ReportSchedule["id"], input: ScheduleInput) => Promise<ReportSchedule>;
  /** Pauses or resumes one and loads the list again. */
  toggleActive: (schedule: ReportSchedule) => Promise<ReportSchedule>;
  /** Deletes one and loads the list again. A 503 means the token could not be revoked: it is still there. */
  remove: (id: ReportSchedule["id"]) => Promise<void>;
}

/**
 * Data `GET /report-builder/schedules`. `enabled` false loads nothing (the
 * Schedules tab is closed); the mutations work either way and the list is
 * fetched again after each one.
 */
export function useReportSchedules(enabled = true): UseReportSchedulesResult {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<ReportError | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        setSchedules(await reportBuilderService.listSchedules(controller.signal));
      } catch (err) {
        if (!isCancelled(err)) setError(readReportError(err));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const create = useCallback(async (input: ScheduleInput) => {
    const saved = await reportBuilderService.createSchedule(input);
    setNonce((n) => n + 1);
    return saved;
  }, []);

  const update = useCallback(async (id: ReportSchedule["id"], input: ScheduleInput) => {
    const saved = await reportBuilderService.updateSchedule(id, input);
    setNonce((n) => n + 1);
    return saved;
  }, []);

  const toggleActive = useCallback(
    (schedule: ReportSchedule) => update(schedule.id, scheduleToInput(schedule, { is_active: !schedule.is_active })),
    [update],
  );

  const remove = useCallback(async (id: ReportSchedule["id"]) => {
    await reportBuilderService.deleteSchedule(id);
    setNonce((n) => n + 1);
  }, []);

  return { schedules, isLoading, error, reload, create, update, toggleActive, remove };
}
