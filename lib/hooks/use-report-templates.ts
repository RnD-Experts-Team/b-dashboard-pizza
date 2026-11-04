"use client";

import { useCallback, useEffect, useState } from "react";
import { reportBuilderService } from "@/lib/api/services/report-builder.service";
import { isCancelled, readReportError, type ReportError } from "@/lib/report-builder/errors";
import type { ReportTemplate, TemplateInput } from "@/types/report-builder.types";

interface UseReportTemplatesResult {
  /** The caller's own templates plus org-wide ones (Data decides). */
  templates: ReportTemplate[];
  isLoading: boolean;
  error: ReportError | null;
  reload: () => void;
  /** Deletes one (owner only — Data refuses anyone else) and drops it from the list. */
  remove: (id: ReportTemplate["id"]) => Promise<void>;
}

/** Data `GET /report-builder/templates`. */
export function useReportTemplates(): UseReportTemplatesResult {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ReportError | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        setTemplates(await reportBuilderService.listTemplates(controller.signal));
      } catch (err) {
        if (!isCancelled(err)) setError(readReportError(err));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const remove = useCallback(async (id: ReportTemplate["id"]) => {
    await reportBuilderService.deleteTemplate(id);
    setTemplates((list) => list.filter((t) => String(t.id) !== String(id)));
  }, []);

  return { templates, isLoading, error, reload, remove };
}

interface UseReportTemplateResult {
  template: ReportTemplate | null;
  isLoading: boolean;
  error: ReportError | null;
  reload: () => void;
}

/** One template by id (`null` id = a new, unsaved report: nothing to load). */
export function useReportTemplate(id: string | null): UseReportTemplateResult {
  const [template, setTemplate] = useState<ReportTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(id !== null);
  const [error, setError] = useState<ReportError | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (id === null) return;
    const controller = new AbortController();
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        setTemplate(await reportBuilderService.getTemplate(id, controller.signal));
      } catch (err) {
        if (!isCancelled(err)) setError(readReportError(err));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [id, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { template, isLoading, error, reload };
}

interface UseTemplateSaveResult {
  isSaving: boolean;
  /** Creates when `id` is null, else updates. Resolves with the saved template. */
  save: (id: ReportTemplate["id"] | null, input: TemplateInput) => Promise<ReportTemplate>;
}

export function useTemplateSave(): UseTemplateSaveResult {
  const [isSaving, setIsSaving] = useState(false);
  const save = useCallback(async (id: ReportTemplate["id"] | null, input: TemplateInput) => {
    setIsSaving(true);
    try {
      return id === null
        ? await reportBuilderService.createTemplate(input)
        : await reportBuilderService.updateTemplate(id, input);
    } finally {
      setIsSaving(false);
    }
  }, []);
  return { isSaving, save };
}
