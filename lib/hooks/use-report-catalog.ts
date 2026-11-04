"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { reportBuilderService } from "@/lib/api/services/report-builder.service";
import { catalogIndex, flattenCatalog } from "@/lib/report-builder/access";
import { isCancelled, readReportError, type ReportError } from "@/lib/report-builder/errors";
import type { CatalogDatasetRef, ReportCatalog } from "@/types/report-builder.types";

/** Data caches the merged catalog for 10 minutes too; it is code, identical for every user. */
const CATALOG_TTL_MS = 600_000;

let cached: { catalog: ReportCatalog; at: number } | null = null;

const freshCatalog = (): ReportCatalog | null =>
  cached && Date.now() - cached.at < CATALOG_TTL_MS ? cached.catalog : null;

interface UseReportCatalogResult {
  catalog: ReportCatalog | null;
  /** Every dataset of every service, tagged with its service (access NOT applied). */
  datasets: CatalogDatasetRef[];
  /** By dataset key. */
  index: Map<string, CatalogDatasetRef>;
  isLoading: boolean;
  error: ReportError | null;
  reload: () => void;
}

/** The merged dataset catalog from Data `GET /report-builder/catalog`, cached per tab. */
export function useReportCatalog(): UseReportCatalogResult {
  const [catalog, setCatalog] = useState<ReportCatalog | null>(freshCatalog);
  const [isLoading, setIsLoading] = useState(() => freshCatalog() === null);
  const [error, setError] = useState<ReportError | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const fresh = freshCatalog();
    if (fresh) {
      setCatalog(fresh);
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const next = await reportBuilderService.getCatalog(controller.signal);
        cached = { catalog: next, at: Date.now() };
        setCatalog(next);
      } catch (err) {
        if (!isCancelled(err)) setError(readReportError(err));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [nonce]);

  const reload = useCallback(() => {
    cached = null;
    setNonce((n) => n + 1);
  }, []);

  const datasets = useMemo(() => flattenCatalog(catalog), [catalog]);
  const index = useMemo(() => catalogIndex(datasets), [datasets]);

  return { catalog, datasets, index, isLoading, error, reload };
}
