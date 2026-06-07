"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export interface IssueDraft {
  /** For the "assign" action inline form */
  assignDate: string;
  assignHour: string;
  assignTechs: number[];
  /** For the "defer" action inline form */
  deferReason: string;
  /** For the "cancel" action inline form */
  cancelReason: string;
  /** For diagnosis and warranty actions */
  diagnosisBody: string;
  warrantyBody: string;
  warrantyExpiry: string;
  /** For attendance action */
  attendanceTechnicianId: string;
  attendanceStartClock: string;
  attendanceEndClock: string;
  attendanceStartBreak: string;
  attendanceEndBreak: string;
  attendanceStartPartsRun: string;
  attendanceEndPartsRun: string;
  /** For part usage action */
  partId: string;
  partCost: string;
  /** For pay entry action */
  payTechnicianId: string;
  basePay: string;
  performancePay: string;
  drivingBasePay: string;
  drivingPerformancePay: string;
  drivingTime: string;
  milesDriven: string;
  perMileRate: string;
  /** For attach/change technicians */
  attachTechs: number[];
  changeTechs: number[];
  changeAssignmentId: string;
  /** For assignment delay */
  delayAssignmentId: string;
  delayNewDate: string;
  delayNewHour: string;
  delayReason: string;
}

export interface TicketDraft {
  /**
   * Issue IDs that the user explicitly expanded.
   * All other issues default to collapsed.
   */
  expandedIssues: number[];
  /** Per-issue form drafts, keyed by issue id as string */
  issues: Record<string, IssueDraft>;
}

export const EMPTY_ISSUE_DRAFT: IssueDraft = {
  assignDate: "",
  assignHour: "",
  assignTechs: [],
  deferReason: "",
  cancelReason: "",
  diagnosisBody: "",
  warrantyBody: "",
  warrantyExpiry: "",
  attendanceTechnicianId: "",
  attendanceStartClock: "",
  attendanceEndClock: "",
  attendanceStartBreak: "",
  attendanceEndBreak: "",
  attendanceStartPartsRun: "",
  attendanceEndPartsRun: "",
  partId: "",
  partCost: "",
  payTechnicianId: "",
  basePay: "",
  performancePay: "",
  drivingBasePay: "",
  drivingPerformancePay: "",
  drivingTime: "",
  milesDriven: "",
  perMileRate: "",
  attachTechs: [],
  changeTechs: [],
  changeAssignmentId: "",
  delayAssignmentId: "",
  delayNewDate: "",
  delayNewHour: "",
  delayReason: "",
};

export const EMPTY_TICKET_DRAFT: TicketDraft = {
  expandedIssues: [],
  issues: {},
};

/** 7-day TTL — stale drafts are silently removed on load */
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface StoredDraft {
  data: TicketDraft;
  savedAt: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Internal storage helpers                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function draftKey(storeId: string, ticketId: number) {
  return `mt-draft-${storeId}-${ticketId}`;
}

function loadFromStorage(key: string): TicketDraft {
  try {
    if (typeof window === "undefined") return EMPTY_TICKET_DRAFT;
    const raw = localStorage.getItem(key);
    if (!raw) return EMPTY_TICKET_DRAFT;
    const stored: StoredDraft = JSON.parse(raw);
    if (Date.now() - (stored.savedAt ?? 0) > DRAFT_TTL_MS) {
      localStorage.removeItem(key);
      return EMPTY_TICKET_DRAFT;
    }
    const loaded = stored.data ?? EMPTY_TICKET_DRAFT;
    // Always start with all issues collapsed — expand state is transient UX, not draft data
    return { ...loaded, expandedIssues: [] };
  } catch {
    return EMPTY_TICKET_DRAFT;
  }
}

function saveToStorage(key: string, data: TicketDraft) {
  try {
    const stored: StoredDraft = { data, savedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(stored));
  } catch {
    /* Ignore QuotaExceededError or SSR */
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Hook                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export function useTicketDraft(storeId: string, ticketId: number | null) {
  const key = ticketId ? draftKey(storeId, ticketId) : null;

  const [draft, setDraftRaw] = useState<TicketDraft>(EMPTY_TICKET_DRAFT);
  const [hydrated, setHydrated] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Load draft whenever the key changes (ticket switch or initial mount) */
  useEffect(() => {
    if (!key) {
      setDraftRaw(EMPTY_TICKET_DRAFT);
      setHydrated(true);
      return;
    }
    setDraftRaw(loadFromStorage(key));
    setHydrated(true);
  }, [key]);

  /** Debounced autosave: 600 ms after last change */
  const setDraft = useCallback(
    (updater: TicketDraft | ((prev: TicketDraft) => TicketDraft)) => {
      setDraftRaw((prev) => {
        const next =
          typeof updater === "function" ? updater(prev) : updater;
        if (key) {
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(() => {
            saveToStorage(key, next);
            setLastSavedAt(Date.now());
          }, 600);
        }
        return next;
      });
    },
    [key]
  );

  const clearDraft = useCallback(() => {
    if (key) localStorage.removeItem(key);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setDraftRaw(EMPTY_TICKET_DRAFT);
    setLastSavedAt(null);
  }, [key]);

  /** Get the draft for a specific issue (fallback to empty) */
  const getIssueDraft = useCallback(
    (issueId: number): IssueDraft =>
      draft.issues[String(issueId)] ?? { ...EMPTY_ISSUE_DRAFT },
    [draft.issues]
  );

  /** Merge a partial patch into a specific issue draft */
  const patchIssueDraft = useCallback(
    (
      issueId: number,
      patch:
        | Partial<IssueDraft>
        | ((prev: IssueDraft) => Partial<IssueDraft>)
    ) => {
      setDraft((prev) => {
        const current =
          prev.issues[String(issueId)] ?? { ...EMPTY_ISSUE_DRAFT };
        const resolved =
          typeof patch === "function" ? patch(current) : patch;
        return {
          ...prev,
          issues: {
            ...prev.issues,
            [String(issueId)]: { ...current, ...resolved },
          },
        };
      });
    },
    [setDraft]
  );

  /** Reset specific keys in one issue draft after a successful action submit */
  const clearIssueDraftFields = useCallback(
    (issueId: number, keys: Array<keyof IssueDraft>) => {
      setDraft((prev) => {
        const current = prev.issues[String(issueId)] ?? { ...EMPTY_ISSUE_DRAFT };
        const reset = { ...current };
        keys.forEach((key) => {
          const emptyValue = EMPTY_ISSUE_DRAFT[key];
          (reset as Record<string, unknown>)[key as string] = emptyValue as unknown;
        });
        return {
          ...prev,
          issues: {
            ...prev.issues,
            [String(issueId)]: reset,
          },
        };
      });
    },
    [setDraft]
  );

  /** Returns true only if the issue id is in the expandedIssues list */
  const isIssueExpanded = useCallback(
    (issueId: number) => (draft.expandedIssues ?? []).includes(issueId),
    [draft.expandedIssues]
  );

  const toggleIssueExpanded = useCallback(
    (issueId: number) => {
      setDraft((prev) => {
        const list = prev.expandedIssues ?? [];
        const already = list.includes(issueId);
        return {
          ...prev,
          expandedIssues: already
            ? list.filter((id) => id !== issueId)
            : [...list, issueId],
        };
      });
    },
    [setDraft]
  );

  return {
    draft,
    setDraft,
    clearDraft,
    hydrated,
    lastSavedAt,
    getIssueDraft,
    patchIssueDraft,
    clearIssueDraftFields,
    isIssueExpanded,
    toggleIssueExpanded,
  };
}
