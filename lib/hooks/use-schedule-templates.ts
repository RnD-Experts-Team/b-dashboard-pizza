"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  handleUnauthorized,
  schedulingService,
} from "@/lib/api/services/scheduling.service";
import { adaptTemplate } from "@/lib/scheduling/adapters";
import {
  parseSchedulingError,
  type SchedulingError,
} from "@/lib/scheduling/errors";
import type { ScheduleTemplate } from "@/types/scheduling.types";

/**
 * Saved week templates.
 *
 * Creating one NAMES A WEEK and lets the server snapshot it — the client does
 * not build and send a shift list. That matters beyond tidiness: a client-built
 * snapshot describes what the browser last rendered, while the server's
 * describes what is actually saved, and those can differ.
 *
 * Note the envelope: the list endpoint returns a RAW Laravel paginator, with no
 * outer `data` wrapper, unlike every other endpoint in this API. That is handled
 * here so no component has to know about it.
 *
 * Applying a template is not done here — it fans out into dozens of Humanity
 * writes, so it goes through the async bulk pattern (`useBulkOperation`).
 */

export interface UseScheduleTemplatesOptions {
  storeId: string | null;
}

export interface UseScheduleTemplatesResult {
  templates: ScheduleTemplate[];
  isLoading: boolean;
  isSaving: boolean;
  error: SchedulingError | null;
  clearError: () => void;
  refetch: () => void;
  /** Snapshot the given week under a name. Returns true on success. */
  saveTemplate: (input: {
    name: string;
    description?: string;
    weekStart: string;
  }) => Promise<boolean>;
  deleteTemplate: (templateId: string) => Promise<boolean>;
  /** Fetch one template including its week-relative shifts, for preview. */
  loadTemplateDetail: (templateId: string) => Promise<ScheduleTemplate | null>;
}

export function useScheduleTemplates({
  storeId,
}: UseScheduleTemplatesOptions): UseScheduleTemplatesResult {
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<SchedulingError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!storeId) {
      setTemplates([]);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    try {
      // Raw paginator: the rows are under `data`, with no outer envelope.
      const page = await schedulingService.listTemplates(
        storeId,
        { per_page: 50 },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setTemplates((page?.data ?? []).map(adaptTemplate));
    } catch (err) {
      if (controller.signal.aborted || axios.isCancel(err)) return;
      const parsed = parseSchedulingError(err, "Could not load templates.");
      if (handleUnauthorized(parsed.status)) return;
      setError(parsed);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchTemplates();
    return () => abortRef.current?.abort();
  }, [fetchTemplates]);

  const saveTemplate = useCallback<UseScheduleTemplatesResult["saveTemplate"]>(
    async ({ name, description, weekStart }) => {
      if (!storeId) return false;
      setIsSaving(true);
      setError(null);
      try {
        // No shifts in the body — the server snapshots the named week itself.
        await schedulingService.createTemplate(storeId, {
          name,
          description: description || undefined,
          week_start: weekStart,
        });
        await fetchTemplates();
        return true;
      } catch (err) {
        const parsed = parseSchedulingError(err, "Could not save this template.");
        if (handleUnauthorized(parsed.status)) return false;
        setError(parsed);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [storeId, fetchTemplates],
  );

  const deleteTemplate = useCallback(
    async (templateId: string) => {
      if (!storeId) return false;
      setError(null);
      try {
        await schedulingService.deleteTemplate(storeId, templateId);
        setTemplates((prev) => prev.filter((t) => t.id !== templateId));
        return true;
      } catch (err) {
        const parsed = parseSchedulingError(err, "Could not delete this template.");
        if (handleUnauthorized(parsed.status)) return false;
        setError(parsed);
        return false;
      }
    },
    [storeId],
  );

  const loadTemplateDetail = useCallback(
    async (templateId: string) => {
      if (!storeId) return null;
      try {
        const raw = await schedulingService.getTemplate(storeId, templateId);
        return adaptTemplate(raw);
      } catch (err) {
        const parsed = parseSchedulingError(err, "Could not load this template.");
        if (handleUnauthorized(parsed.status)) return null;
        setError(parsed);
        return null;
      }
    },
    [storeId],
  );

  return {
    templates,
    isLoading,
    isSaving,
    error,
    clearError: () => setError(null),
    refetch: fetchTemplates,
    saveTemplate,
    deleteTemplate,
    loadTemplateDetail,
  };
}
