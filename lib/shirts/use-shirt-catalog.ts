"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { shirtCatalogService } from "@/lib/api/services/shirt-catalog.service";
import type { ShirtCatalog } from "@/types/shirt-milestone.types";

/**
 * Module-level cache, keyed on `includeInactive` because the two responses
 * differ. The catalog changes rarely and the entry dialog is opened once per
 * row, so refetching it on every open is pure latency in front of the form.
 * `reload()` busts it — the admin screen calls that after every write.
 */
const CATALOG_CACHE = new Map<boolean, ShirtCatalog>();

export interface UseShirtCatalogResult {
  catalog: ShirtCatalog | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

export function useShirtCatalog(opts: {
  enabled: boolean;
  includeInactive?: boolean;
}): UseShirtCatalogResult {
  const { enabled, includeInactive = false } = opts;

  const [catalog, setCatalog] = useState<ShirtCatalog | null>(
    () => CATALOG_CACHE.get(includeInactive) ?? null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => {
    CATALOG_CACHE.delete(includeInactive);
    setNonce((n) => n + 1);
  }, [includeInactive]);

  useEffect(() => {
    if (!enabled) return;

    const cached = CATALOG_CACHE.get(includeInactive);
    if (cached) {
      setCatalog(cached);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    shirtCatalogService
      .getCatalog(includeInactive, controller.signal)
      .then((data) => {
        CATALOG_CACHE.set(includeInactive, data);
        setCatalog(data);
      })
      .catch((err: unknown) => {
        if (axios.isCancel(err)) return;
        setError(
          axios.isAxiosError(err) && err.response?.status === 403
            ? "You do not have access to the shirt catalog."
            : "Could not load the shirt catalog.",
        );
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [enabled, includeInactive, nonce]);

  return { catalog, isLoading, error, reload };
}
