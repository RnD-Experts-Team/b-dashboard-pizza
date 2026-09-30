"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toolboxTicketsService } from "@/lib/api/services/toolbox-tickets.service";
import { parseTicketError, type TicketError } from "@/lib/toolbox-tickets/errors";
import { usePollWhileVisible } from "@/lib/hooks/use-toolbox-tickets-poll";
import { useToolboxTicketsCatalog } from "@/lib/store/toolbox-tickets-catalog.store";
import type { TicketListFilters, TicketPage, ToolboxTicket } from "@/types/toolbox-tickets.types";

const POLL_MS = 60_000;

export type TicketListMode = "inbox" | "store";

/**
 * One page of tickets — the cross-store inbox (filtered upstream to the
 * caller) or one store's whole queue (NOT filtered — rows may carry
 * `viewer.can.view === false`). `loading` is the first load for a filter set;
 * `refreshing` is a background poll / manual refresh with data on screen.
 */
export function useToolboxTicketsList(
  mode: TicketListMode,
  filters: TicketListFilters,
  storeCode: string | null,
) {
  const [page, setPage] = useState<TicketPage<ToolboxTicket> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<TicketError | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Stable dependency for an object the caller rebuilds every render.
  const key = JSON.stringify({ mode, filters, storeCode });

  /** Returns the error so a MANUAL refresh can report it; polls stay silent. */
  const run = useCallback(
    async (background: boolean): Promise<TicketError | null> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const { mode: m, filters: f, storeCode: code } = JSON.parse(key) as {
        mode: TicketListMode;
        filters: TicketListFilters;
        storeCode: string | null;
      };
      if (background) setRefreshing(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const result =
          m === "inbox"
            ? await toolboxTicketsService.listInbox(f, controller.signal)
            : await toolboxTicketsService.listStoreQueue(code ?? "", f, controller.signal);
        if (!controller.signal.aborted) {
          setPage(result);
          setError(null);
        }
        return null;
      } catch (err) {
        const parsed = parseTicketError(err);
        if (parsed.code === "CANCELLED") return null;
        // A failed background refresh keeps what's on screen.
        if (!background) {
          setError(parsed);
          setPage(null);
        }
        return parsed;
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [key],
  );

  useEffect(() => {
    void run(false);
    return () => abortRef.current?.abort();
  }, [run]);

  const refresh = useCallback(() => run(true), [run]);
  usePollWhileVisible(refresh, POLL_MS, !error);

  return { page, loading, refreshing, error, reload: () => run(false), refresh };
}

/** Active sections for pickers/filters — loads once per session. */
export function useTicketSections() {
  const { sections, loading, error, load, reload } = useToolboxTicketsCatalog();
  useEffect(() => {
    void load();
  }, [load]);
  return { sections, loading: loading || (!sections && !error), error, reload };
}
