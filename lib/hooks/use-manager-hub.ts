"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dueKeysService } from "@/lib/api/services/due-keys.service";
import { cleaningService } from "@/lib/api/services/cleaning.service";
import { employeeDebriefService } from "@/lib/api/services/employee-debriefs.service";
import { useAuthStore } from "@/lib/auth/auth.store";
import { canAccessCleaningTab } from "@/lib/auth/cleaning-access";
import { useDebriefActionStore } from "@/lib/store/debrief-action.store";
import { useEffectiveStoreCode, useEffectiveStoreId } from "@/lib/hooks/use-cleaning";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { hubWindow, rangeStart, type EmployeeDebriefRange } from "@/lib/manager-hub/dates";
import type { DueKeysResponse, DueKeyItem } from "@/types/due-key.types";
import type { DueRangeResponse, DueResponse } from "@/types/cleaning.types";
import type { EmployeeDebriefItem } from "@/types/employee-debrief.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  useManagerHub — the five independent reads behind the Manager Hub.       */
/*                                                                            */
/*  Each section loads, fails and retries on its own: a 403 on cleaning never */
/*  blanks the debriefs. Refetches after a write (the floating panel bumps   */
/*  `revision`) are SILENT — data already on screen stays while it reloads.  */
/*                                                                            */
/*  Deliberately not useCleaningStore: the floating panel writes `dueData`   */
/*  there for whatever date IT is on, which would overwrite the hub's.       */
/* ────────────────────────────────────────────────────────────────────────── */

/** What the UI needs from any of the three services' error classes. */
export interface HubError {
  message: string;
  code: string;
  retryable: boolean;
}

export interface HubSection<T> {
  data: T | null;
  /** First load for this store/date — nothing to show yet. */
  loading: boolean;
  /** Reloading in the background over data already on screen. */
  refreshing: boolean;
  error: HubError | null;
  /** Epoch ms of the last successful load. */
  updatedAt: number | null;
  /** False when the section doesn't apply (no store, or no access). */
  enabled: boolean;
  reload: () => void;
}

export function toHubError(err: unknown): HubError {
  if (err instanceof Error) {
    const e = err as Error & { code?: unknown; retryable?: unknown };
    return {
      message: e.message || "Something went wrong.",
      code: typeof e.code === "string" ? e.code : "UNKNOWN",
      retryable: typeof e.retryable === "boolean" ? e.retryable : true,
    };
  }
  return { message: "Something went wrong.", code: "UNKNOWN", retryable: true };
}

interface SectionState<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: HubError | null;
  updatedAt: number | null;
}

const IDLE = { data: null, loading: false, refreshing: false, error: null, updatedAt: null };

/**
 * One section. `key` identifies WHAT is loaded (store + dates); a new key is a
 * hard load (old data dropped), the same key with a new `tick` is a quiet one.
 */
function useHubSection<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
  tick: string,
): HubSection<T> {
  const [state, setState] = useState<SectionState<T>>(IDLE);
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (key == null) {
      lastKey.current = null;
      setState(IDLE);
      return;
    }
    const sameKey = lastKey.current === key;
    lastKey.current = key;
    const ctrl = new AbortController();
    setState((prev) =>
      sameKey && prev.data != null
        ? { ...prev, refreshing: true }
        : { data: null, loading: true, refreshing: false, error: null, updatedAt: null },
    );
    loadRef
      .current(ctrl.signal)
      .then((data) => {
        if (ctrl.signal.aborted) return;
        setState({ data, loading: false, refreshing: false, error: null, updatedAt: Date.now() });
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setState((prev) => ({ ...prev, loading: false, refreshing: false, error: toHubError(err) }));
      });
    return () => ctrl.abort();
  }, [key, tick, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, enabled: key != null, reload };
}

export interface ManagerHubData {
  storeCode: string | null;
  storeName: string | null;
  canSeeCleaning: boolean;
  anchor: string;
  backlogFrom: string;
  backlogTo: string;
  employeeDebriefFrom: string;
  debriefsToday: HubSection<DueKeysResponse>;
  debriefsBacklog: HubSection<{ date: string; items: DueKeyItem[] }[]>;
  cleaningToday: HubSection<DueResponse>;
  cleaningBacklog: HubSection<DueRangeResponse>;
  employeeDebriefs: HubSection<Record<string, EmployeeDebriefItem[]>>;
  /** Any section reloading (first load or background). */
  busy: boolean;
  /** Newest successful load across sections. */
  updatedAt: number | null;
  refreshAll: () => void;
}

export function useManagerHub(anchor: string, employeeRange: EmployeeDebriefRange): ManagerHubData {
  const storeCode = useEffectiveStoreCode();
  const cleaningId = useEffectiveStoreId();
  const { selectedStore } = useSelectedStoreStore();
  const { canAccessRoute, hasAnyRole, overviewStores } = useAuthStore();
  const revision = useDebriefActionStore((s) => s.revision);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const tick = `${revision}:${refreshNonce}`;

  const accessStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;
  const canSeeCleaning = canAccessCleaningTab("due", { canAccessRoute, hasAnyRole }, accessStoreId);
  const storeName =
    selectedStore?.name ??
    overviewStores?.find((s) => s.storeId === storeCode)?.name ??
    storeCode;

  const { backlogFrom, backlogTo } = hubWindow(anchor);
  const employeeDebriefFrom = rangeStart(anchor, employeeRange);
  const cleaningKeyBase = canSeeCleaning && cleaningId != null ? `${cleaningId}` : null;

  const debriefsToday = useHubSection(
    storeCode ? `dk|${storeCode}|${anchor}` : null,
    (signal) => dueKeysService.getDueKeys(storeCode as string, anchor, signal),
    tick,
  );
  const debriefsBacklog = useHubSection(
    storeCode ? `dkr|${storeCode}|${backlogFrom}|${backlogTo}` : null,
    (signal) => dueKeysService.getDueRange(storeCode as string, backlogFrom, backlogTo, signal),
    tick,
  );
  const cleaningToday = useHubSection(
    cleaningKeyBase ? `cl|${cleaningKeyBase}|${anchor}` : null,
    (signal) => cleaningService.getDue(cleaningId as number, anchor, signal),
    tick,
  );
  const cleaningBacklog = useHubSection(
    cleaningKeyBase ? `clr|${cleaningKeyBase}|${backlogFrom}|${backlogTo}` : null,
    (signal) => cleaningService.getDueRange(cleaningId as number, backlogFrom, backlogTo, signal),
    tick,
  );
  const employeeDebriefs = useHubSection(
    storeCode ? `ed|${storeCode}|${employeeDebriefFrom}|${anchor}` : null,
    (signal) => employeeDebriefService.listRange(storeCode as string, employeeDebriefFrom, anchor, signal),
    tick,
  );

  const sections = [debriefsToday, debriefsBacklog, cleaningToday, cleaningBacklog, employeeDebriefs];
  const busy = sections.some((s) => s.loading || s.refreshing);
  const updatedAt = useMemo(() => {
    const stamps = [
      debriefsToday.updatedAt,
      debriefsBacklog.updatedAt,
      cleaningToday.updatedAt,
      cleaningBacklog.updatedAt,
      employeeDebriefs.updatedAt,
    ].filter((n): n is number => n != null);
    return stamps.length ? Math.max(...stamps) : null;
  }, [
    debriefsToday.updatedAt,
    debriefsBacklog.updatedAt,
    cleaningToday.updatedAt,
    cleaningBacklog.updatedAt,
    employeeDebriefs.updatedAt,
  ]);

  const refreshAll = useCallback(() => setRefreshNonce((n) => n + 1), []);

  return {
    storeCode,
    storeName: storeName ?? null,
    canSeeCleaning,
    anchor,
    backlogFrom,
    backlogTo,
    employeeDebriefFrom,
    debriefsToday,
    debriefsBacklog,
    cleaningToday,
    cleaningBacklog,
    employeeDebriefs,
    busy,
    updatedAt,
    refreshAll,
  };
}
