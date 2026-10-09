"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toolboxTicketsService } from "@/lib/api/services/toolbox-tickets.service";
import { parseTicketError, TicketError } from "@/lib/toolbox-tickets/errors";
import { mergeTicket } from "@/lib/toolbox-tickets/scope-and-merge";
import { usePollWhileVisible } from "@/lib/hooks/use-toolbox-tickets-poll";
import type {
  ParticipantRole,
  TicketRecipients,
  TicketStatus,
  ToolboxTicket,
  UpdateTicketPayload,
} from "@/types/toolbox-tickets.types";

const POLL_MS = 30_000;

/**
 * One ticket (`GET …/tickets/{id}` — the only read with the full thread).
 *
 * Every mutation re-fetches afterwards: `viewer.can` can change between
 * requests (assignment is resolved live), the reporter's edit window closes
 * when the ticket leaves `pending`, and update/status responses omit the
 * thread entirely. The immediate response is merged first so the screen
 * never flickers back.
 */
export function useToolboxTicket(storeCode: string | null, ticketId: number | null) {
  const [ticket, setTicket] = useState<ToolboxTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<TicketError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * `background` keeps what's on screen on failure (poll / manual refresh /
   * after a mutation). Returns the error so a MANUAL refresh can say why it
   * didn't work — a poll stays silent.
   */
  const load = useCallback(
    async (background: boolean): Promise<TicketError | null> => {
      if (!storeCode || ticketId === null) return null;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (background) setRefreshing(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const next = await toolboxTicketsService.getTicket(storeCode, ticketId, controller.signal);
        if (!controller.signal.aborted) {
          setTicket(next);
          setError(null);
        }
        return null;
      } catch (err) {
        const parsed = parseTicketError(err);
        if (parsed.code === "CANCELLED") return null;
        // A 404 in the background means access was lost mid-session — show it.
        if (!background || parsed.code === "NOT_FOUND") {
          setError(parsed);
          setTicket(null);
        }
        return parsed;
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [storeCode, ticketId],
  );

  useEffect(() => {
    setTicket(null);
    void load(false);
    return () => abortRef.current?.abort();
  }, [load]);

  const refetch = useCallback(() => load(true), [load]);
  usePollWhileVisible(refetch, POLL_MS, Boolean(ticket));

  /** Run a mutation, merge what it returns, then re-read the full ticket. */
  const mutate = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        const result = await fn();
        if (result && typeof result === "object" && "id" in (result as object) && "status" in (result as object)) {
          setTicket((prev) => mergeTicket(prev, result as unknown as ToolboxTicket));
        }
        return result;
      } finally {
        // Also after a failure: a 403 / 409 means our copy of `viewer.can` or
        // `allowed_transitions` is stale.
        void load(true);
      }
    },
    [load],
  );

  const code = storeCode ?? "";
  const id = ticketId ?? 0;
  const actions = {
    update: (p: UpdateTicketPayload) => mutate(() => toolboxTicketsService.updateTicket(code, id, p)),
    changeStatus: (status: TicketStatus, reason?: string) =>
      mutate(() => toolboxTicketsService.changeStatus(code, id, status, reason)),
    reopen: (reason: string) => mutate(() => toolboxTicketsService.reopen(code, id, reason)),
    respond: (body: string, files: File[]) => mutate(() => toolboxTicketsService.addResponse(code, id, body, files)),
    note: (body: string, files: File[]) => mutate(() => toolboxTicketsService.addNote(code, id, body, files)),
    attach: (files: File[]) => mutate(() => toolboxTicketsService.addAttachments(code, id, files)),
    addParticipant: (userId: number, role: ParticipantRole) =>
      mutate(() => toolboxTicketsService.addParticipant(code, id, userId, role)),
    // Removal is silent upstream (no broadcast) — the refetch in `mutate` is what shows it.
    removeParticipant: (userId: number) => mutate(() => toolboxTicketsService.removeParticipant(code, id, userId)),
  };

  return { ticket, loading, refreshing, error, refetch, reload: () => load(false), actions };
}

export type ToolboxTicketActions = ReturnType<typeof useToolboxTicket>["actions"];

/**
 * Deep links carry no store code — resolve it through the inbox. Once a
 * ticket's store is known it's kept: clicking a notification for the ticket
 * already on screen drops `?store=` from the URL, and that must not blank
 * the page and re-scan the inbox.
 */
export function useResolveTicketStore(ticketId: number | null, knownStore: string | null) {
  const [resolved, setResolved] = useState<{ id: number | null; store: string | null }>({
    id: ticketId,
    store: knownStore ?? (ticketId !== null ? toolboxTicketsService.cachedTicketStore(ticketId) : null),
  });
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<TicketError | null>(null);
  const [attempt, setAttempt] = useState(0);

  const alreadyKnown = resolved.id === ticketId && resolved.store !== null;

  useEffect(() => {
    if (knownStore) {
      setResolved({ id: ticketId, store: knownStore });
      setResolving(false);
      setError(null);
      return;
    }
    if (ticketId === null || alreadyKnown) return;
    const cached = toolboxTicketsService.cachedTicketStore(ticketId);
    if (cached) {
      setResolved({ id: ticketId, store: cached });
      return;
    }
    const controller = new AbortController();
    setResolving(true);
    setError(null);
    toolboxTicketsService
      .findTicketStore(ticketId, controller.signal)
      .then((code) => {
        if (controller.signal.aborted) return;
        if (code) setResolved({ id: ticketId, store: code });
        else setError(new TicketError({ code: "NOT_FOUND", message: "Ticket not found." }));
      })
      .catch((err) => {
        const parsed = parseTicketError(err);
        if (parsed.code !== "CANCELLED") setError(parsed);
      })
      .finally(() => {
        if (!controller.signal.aborted) setResolving(false);
      });
    return () => controller.abort();
  }, [ticketId, knownStore, alreadyKnown, attempt]);

  return {
    store: resolved.id === ticketId ? resolved.store : null,
    resolving: resolving || (!alreadyKnown && !knownStore && ticketId !== null && !error),
    error,
    retry: () => setAttempt((n) => n + 1),
  };
}

/** Routing debug — who the section reaches vs who actually receives. */
export function useTicketRecipients(storeCode: string | null, ticketId: number | null, enabled: boolean) {
  const [data, setData] = useState<TicketRecipients | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<TicketError | null>(null);

  const load = useCallback(async () => {
    if (!storeCode || ticketId === null) return;
    setLoading(true);
    setError(null);
    try {
      setData(await toolboxTicketsService.getRecipients(storeCode, ticketId));
    } catch (err) {
      setError(parseTicketError(err));
    } finally {
      setLoading(false);
    }
  }, [storeCode, ticketId]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  return { data, loading, error, reload: load };
}
