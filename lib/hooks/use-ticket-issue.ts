"use client";

/**
 * The ticket page's data: every issue of the ticket (the issue switcher) and
 * the workflow actions. A successful action swaps the returned issue into
 * place — no refetch needed — and keeps any NEW trip link so the page can
 * open the "Trip link" dialog (Copy / Share) once.
 *
 *   const { issues, issue, act, pending, lastTripLink } = useTicketIssues(store, ticketId, issueId);
 *   await act((key) => maintenanceWorkflowService.scheduleWork(key, payload));
 */

import { useCallback, useMemo, useState } from "react";
import { maintenanceWorkflowService, type IssueKey } from "@/lib/api/services/maintenance-workflow.service";
import { useMaintenanceMutation, useMaintenanceResource } from "@/lib/hooks/use-maintenance-resource";
import type { TicketIssueV2, TripLinkIssued, WorkflowResult } from "@/types/maintenance-v2";

export { maintenanceWorkflowService };
export type { IssueKey };

export function useTicketIssues(store: string | null, ticketId: number | null, selectedIssueId?: number | null) {
  const enabled = Boolean(store && ticketId);
  const res = useMaintenanceResource(enabled ? `ticket-issues:${store}:${ticketId}` : null, (signal) =>
    maintenanceWorkflowService.listIssues(store as string, ticketId as number, signal),
  );
  const issues = useMemo(() => res.data ?? [], [res.data]);
  const setIssues = res.setData;
  const issue = useMemo(
    () => issues.find((i) => i.id === selectedIssueId) ?? issues[0] ?? null,
    [issues, selectedIssueId],
  );
  const [lastTripLink, setLastTripLink] = useState<TripLinkIssued | null>(null);

  const replaceIssue = useCallback(
    (next: TicketIssueV2) => setIssues((prev) => (prev ?? []).map((i) => (i.id === next.id ? next : i))),
    [setIssues],
  );

  const mutation = useMaintenanceMutation(async (fn: (key: IssueKey) => Promise<WorkflowResult>) => {
    if (!store || !ticketId || !issue) throw new Error("No issue selected.");
    const result = await fn({ store, ticketId, issueId: issue.id });
    replaceIssue(result.issue);
    if (result.tripLink) setLastTripLink(result.tripLink);
    return result;
  });

  const key: IssueKey | null = store && ticketId && issue ? { store, ticketId, issueId: issue.id } : null;

  return {
    ...res,
    issues,
    issue,
    key,
    /** Runs one workflow step on the selected issue. */
    act: mutation.run,
    pending: mutation.isPending,
    actionError: mutation.error,
    resetActionError: mutation.reset,
    replaceIssue,
    /** A NEW trip link from the last booking (show once, then clear). */
    lastTripLink,
    clearTripLink: () => setLastTripLink(null),
  };
}

/** One issue on its own (e.g. a peek or a notification). */
export function useTicketIssue(key: IssueKey | null) {
  const res = useMaintenanceResource(key ? `ticket-issue:${key.store}:${key.ticketId}:${key.issueId}` : null, (signal) =>
    maintenanceWorkflowService.getIssue(key as IssueKey, signal),
  );
  return { ...res, issue: res.data };
}

/**
 * The ticket page: the ticket (store, opener) and every issue, read without a
 * store segment so a bare deep link works; `storeFromLink` (the store NUMBER
 * on `?store=`) only scopes the auth rule. Actions run on the selected issue
 * under the ticket's own store number and swap the returned issue in place.
 */
export function useTicketPage(ticketId: number | null, storeFromLink: string | null, selectedIssueId?: number | null) {
  const res = useMaintenanceResource(ticketId ? `ticket-page:${ticketId}:${storeFromLink ?? ""}` : null, (signal) =>
    maintenanceWorkflowService.getTicketWithIssues(ticketId as number, storeFromLink, signal),
  );
  const setData = res.setData;
  const ticket = res.data?.ticket ?? null;
  const issues = useMemo(() => res.data?.issues ?? [], [res.data]);
  const issue = useMemo(
    () => issues.find((i) => i.id === selectedIssueId) ?? issues[0] ?? null,
    [issues, selectedIssueId],
  );
  const store = ticket?.storeNumber ?? null;
  const [lastTripLink, setLastTripLink] = useState<TripLinkIssued | null>(null);

  const replaceIssue = useCallback(
    (next: TicketIssueV2) =>
      setData((prev) => (prev ? { ...prev, issues: prev.issues.map((i) => (i.id === next.id ? next : i)) } : prev)),
    [setData],
  );

  const mutation = useMaintenanceMutation(async (fn: (key: IssueKey) => Promise<WorkflowResult>) => {
    if (!store || !ticketId || !issue) throw new Error("No issue selected.");
    const result = await fn({ store, ticketId, issueId: issue.id });
    replaceIssue(result.issue);
    if (result.tripLink) setLastTripLink(result.tripLink);
    return result;
  });

  const key: IssueKey | null = store && ticketId && issue ? { store, ticketId, issueId: issue.id } : null;

  return {
    ...res,
    ticket,
    issues,
    issue,
    key,
    act: mutation.run,
    pending: mutation.isPending,
    actionError: mutation.error,
    resetActionError: mutation.reset,
    replaceIssue,
    lastTripLink,
    clearTripLink: () => setLastTripLink(null),
  };
}
