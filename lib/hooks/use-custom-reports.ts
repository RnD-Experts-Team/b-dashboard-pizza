"use client";

import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { qaService, QAError } from "@/lib/api/services/qa.service";
import type { CustomReport, CustomReportPayload } from "@/types/qa.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function isCanceledError(err: unknown): boolean {
  if (axios.isCancel(err)) return true;
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "CanceledError") return true;
  return false;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useCustomReports — list                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseCustomReportsReturn {
  reports: CustomReport[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCustomReports(): UseCustomReportsReturn {
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await qaService.getCustomReports(signal);
      if (signal?.aborted) return;
      setReports(result);
    } catch (err) {
      if (isCanceledError(err) || signal?.aborted) return;
      setError(
        err instanceof QAError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to load custom reports."
      );
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchReports(controller.signal);
    return () => controller.abort();
  }, [fetchReports]);

  const refetch = useCallback(() => {
    fetchReports();
  }, [fetchReports]);

  return { reports, isLoading, error, refetch };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useCustomReportDetail — single report                                   */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseCustomReportDetailReturn {
  report: CustomReport | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCustomReportDetail(
  id: number | null
): UseCustomReportDetailReturn {
  const [report, setReport] = useState<CustomReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(
    async (signal?: AbortSignal) => {
      if (id === null) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await qaService.getCustomReportById(id, signal);
        if (signal?.aborted) return;
        setReport(result);
      } catch (err) {
        if (isCanceledError(err) || signal?.aborted) return;
        setError(
          err instanceof QAError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load custom report details."
        );
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    if (id === null) {
      setReport(null);
      return;
    }
    const controller = new AbortController();
    fetchDetail(controller.signal);
    return () => controller.abort();
  }, [id, fetchDetail]);

  const refetch = useCallback(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { report, isLoading, error, refetch };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useCreateCustomReport                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseCreateCustomReportReturn {
  createReport: (payload: CustomReportPayload) => Promise<CustomReport>;
  isCreating: boolean;
}

export function useCreateCustomReport(): UseCreateCustomReportReturn {
  const [isCreating, setIsCreating] = useState(false);

  const createReport = useCallback(
    async (payload: CustomReportPayload): Promise<CustomReport> => {
      setIsCreating(true);
      try {
        return await qaService.createCustomReport(payload);
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  return { createReport, isCreating };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useUpdateCustomReport                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseUpdateCustomReportReturn {
  updateReport: (id: number, payload: CustomReportPayload) => Promise<CustomReport>;
  isUpdating: boolean;
}

export function useUpdateCustomReport(): UseUpdateCustomReportReturn {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateReport = useCallback(
    async (id: number, payload: CustomReportPayload): Promise<CustomReport> => {
      setIsUpdating(true);
      try {
        return await qaService.updateCustomReport(id, payload);
      } finally {
        setIsUpdating(false);
      }
    },
    []
  );

  return { updateReport, isUpdating };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useDeleteCustomReport                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseDeleteCustomReportReturn {
  deleteReport: (id: number) => Promise<void>;
  isDeleting: boolean;
}

export function useDeleteCustomReport(): UseDeleteCustomReportReturn {
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteReport = useCallback(async (id: number): Promise<void> => {
    setIsDeleting(true);
    try {
      await qaService.deleteCustomReport(id);
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return { deleteReport, isDeleting };
}
