"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toolboxTicketsService } from "@/lib/api/services/toolbox-tickets.service";
import { parseTicketError, type TicketError } from "@/lib/toolbox-tickets/errors";
import type {
  TicketAssignment,
  TicketAssignmentFilters,
  TicketLevel,
  TicketPage,
  TicketSection,
} from "@/types/toolbox-tickets.types";

/**
 * Minimal load/reload wrapper for the admin catalogue reads. All of them are
 * cross-store and gated at pizzasys by `administer tickets` — a plain 403
 * arrives here as ADMIN_FORBIDDEN (see parseTicketError's admin scope).
 */
function useAdminResource<T>(fetcher: (signal: AbortSignal) => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<TicketError | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const next = await fetcherRef.current(controller.signal);
      if (!controller.signal.aborted) setData(next);
    } catch (err) {
      const parsed = parseTicketError(err, "admin");
      if (parsed.code !== "CANCELLED") setError(parsed);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  return { data, loading, error, reload: load };
}

/** Every section, retired ones included (the admin view). */
export function useAdminSections() {
  return useAdminResource<TicketSection[]>(
    (signal) => toolboxTicketsService.listSections({ includeInactive: true }, signal),
    "sections",
  );
}

/** The level tree (always nested). */
export function useAdminLevels() {
  return useAdminResource<TicketLevel[]>((signal) => toolboxTicketsService.listLevels(signal), "levels");
}

export function useAdminAssignments(filters: TicketAssignmentFilters) {
  const key = JSON.stringify(filters);
  return useAdminResource<TicketPage<TicketAssignment>>(
    (signal) => toolboxTicketsService.listAssignments(JSON.parse(key) as TicketAssignmentFilters, signal),
    key,
  );
}
