"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doughSauceService, DoughSauceError } from "@/lib/api/services/dough-sauce.service";
import { buildIngredientMap, type IngredientMap } from "@/lib/dough-sauce/ingredient-map";
import { buildWeekCells, indexCounts, type WeekCells } from "@/lib/dough-sauce/week-cells";
import { progress, rankBy, score, type ScoreBreakdown } from "@/lib/dough-sauce/formulas";
import { addDaysIso, daysBetween, todayIso } from "@/lib/dough-sauce/dates";
import type {
  CountRow,
  CountsResponse,
  ConfirmPlanPayload,
  CreateRecipePayload,
  DailyPlanBase,
  DailyPlansResponse,
  Ingredient,
  JudgementPayload,
  Plan,
  Recipe,
  RecipeUpdateResult,
  UpdateRecipePayload,
  WeeklyPlansResponse,
} from "@/types/dough-sauce.types";

/** One panel's worth of a parallel load — each degrades on its own (§9). */
export interface Panel<T> {
  data: T | null;
  error: DoughSauceError | null;
}

const EMPTY: Panel<never> = { data: null, error: null };

function settle<T>(r: PromiseSettledResult<T>, system: DoughSauceError["system"]): Panel<T> {
  if (r.status === "fulfilled") return { data: r.value, error: null };
  const err =
    r.reason instanceof DoughSauceError
      ? r.reason
      : new DoughSauceError(String(r.reason?.message ?? r.reason), "UNKNOWN", system);
  return { data: null, error: err };
}

const isAbort = (e: unknown) =>
  (e as { name?: string })?.name === "CanceledError" || (e as { name?: string })?.name === "AbortError";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Ingredients → inventory bridge (shared, fetched once per session)         */
/* ────────────────────────────────────────────────────────────────────────── */

let ingredientsPromise: Promise<Ingredient[]> | null = null;

function loadIngredients(): Promise<Ingredient[]> {
  if (!ingredientsPromise) {
    ingredientsPromise = doughSauceService.getIngredients().catch((err) => {
      // Don't cache a failure — the next screen gets another try.
      ingredientsPromise = null;
      throw err;
    });
  }
  return ingredientsPromise;
}

/** Ingredient list + the ultimatrix mapping. Falls back to the documented codes if data is down. */
export function useIngredients() {
  const [ingredients, setIngredients] = useState<Ingredient[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadIngredients()
      .then((list) => !cancelled && setIngredients(list))
      .catch(() => !cancelled && setIngredients([]));
    return () => {
      cancelled = true;
    };
  }, []);
  const map = useMemo(() => buildIngredientMap(ingredients), [ingredients]);
  return { ingredients, map, loaded: ingredients !== null };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  §8.1 Store manager — daily plan                                           */
/* ────────────────────────────────────────────────────────────────────────── */

export interface StoreDailyPlanState {
  /** `${store}|${date}` these panels were loaded for — anything else is stale. */
  key: string | null;
  plan: Panel<Plan>;
  base: Panel<DailyPlanBase>;
  /** The count for the day BEFORE `date` — any shortage in it is owed to this day's batch. */
  counts: Panel<CountsResponse>;
  /** The previous day's plan — what that day's counts are measured against. */
  prevPlan: Panel<Plan>;
}

export function useStoreDailyPlan(storeKey: string | null, date: string, map: IngredientMap, mapReady: boolean) {
  const [state, setState] = useState<StoreDailyPlanState>({
    key: null,
    plan: EMPTY,
    base: EMPTY,
    counts: EMPTY,
    prevPlan: EMPTY,
  });
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const idsKey = map.ultimatrixIds.join(",");
  const key = storeKey ? `${storeKey}|${date}` : null;

  useEffect(() => {
    if (!storeKey || !mapReady) return;
    const controller = new AbortController();
    const loadedKey = `${storeKey}|${date}`;
    // A shortage is owed to the NEXT day's batch, so this screen reads the day before `date`.
    const prev = addDaysIso(date, -1);
    setLoading(true);
    // Fire all four in PARALLEL — contract §0.1 / §8.1.
    Promise.allSettled([
      doughSauceService.getPlan(storeKey, date, controller.signal),
      doughSauceService.getDailyPlanBase(storeKey, date, {}, controller.signal),
      doughSauceService.getCounts(storeKey, prev, prev, idsKey.split(","), controller.signal),
      doughSauceService.getPlan(storeKey, prev, controller.signal),
    ]).then(([plan, base, counts, prevPlan]) => {
      if (controller.signal.aborted) return;
      if ([plan, base, counts, prevPlan].some((r) => r.status === "rejected" && isAbort(r.reason))) return;
      setState({
        key: loadedKey,
        plan: settle(plan, "audit"),
        base: settle(base, "data"),
        counts: settle(counts, "inv"),
        prevPlan: settle(prevPlan, "audit"),
      });
      setLoading(false);
    });
    return () => controller.abort();
  }, [storeKey, date, idsKey, mapReady, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const confirm = useCallback(
    async (payload: ConfirmPlanPayload) => {
      if (!storeKey) return null;
      const saved = await doughSauceService.confirmPlan(storeKey, payload);
      const savedKey = `${storeKey}|${payload.plan_date}`;
      // The user may have switched store/date while the POST was in flight.
      setState((s) => s.key !== savedKey ? s : ({
        ...s,
        // The POST response may omit `weeks`; keep the ones we already have.
        plan: { data: { ...saved, weeks: saved.weeks ?? s.plan.data?.weeks ?? [] }, error: null },
      }));
      return saved;
    },
    [storeKey]
  );

  // Panels loaded for another store/date are never shown under this one: the
  // header would say one thing and the numbers another, and Confirm would post
  // the old base under the new key.
  const live = state.key === key ? state : { ...state, plan: EMPTY, base: EMPTY, counts: EMPTY, prevPlan: EMPTY };

  return { ...live, loading, reload, confirm };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  §8.2 Specialist — who hasn't confirmed                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export function useAllStoresDaily(date: string) {
  const [panel, setPanel] = useState<Panel<DailyPlansResponse>>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    doughSauceService
      .getDailyPlans(date, controller.signal)
      .then((data) => setPanel({ data, error: null }))
      .catch((err) => {
        if (!isAbort(err)) setPanel({ data: null, error: err as DoughSauceError });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [date, reloadKey]);

  return { ...panel, loading, reload: useCallback(() => setReloadKey((k) => k + 1), []) };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  §8.3 Specialist — weekly grid and report                                  */
/* ────────────────────────────────────────────────────────────────────────── */

/** What a saver sends: the week plus only the fields it changed. */
export type JudgementPatch = Partial<JudgementPayload> & Pick<JudgementPayload, "week_start">;

export type CountsStatus = "idle" | "loading" | "ready" | "error";

export interface StoreWeekResult {
  storeId: number;
  store: string;
  daysConfirmed: number;
  judgement: WeeklyPlansResponse["stores"][number]["judgement"];
  cells: WeekCells;
  breakdown: ScoreBreakdown;
  /** null when previous weeks have no computable score. */
  progress: number | null;
  previousScores: (number | null)[];
  /** 0 = not ranked (counts not loaded yet, or inactive). */
  rank: number;
  /**
   * Only used by the per-store FALLBACK: a store with no plan this week has no
   * cell that can be on target, so its counts can't change its score and are
   * not fetched there. (The all-stores call loads every store anyway.)
   */
  needsCounts: boolean;
  /**
   * Until `ready`, a store that needs counts has an unknown variance part, so
   * its score isn't shown (never a 0% that only means "not fetched").
   */
  countsStatus: CountsStatus;
  countsError: DoughSauceError | null;
  /** Counts couldn't be fetched for this store — score is incomplete, not zero. */
  countsUnavailable: boolean;
  /** The score is complete: counts are in. */
  scored: boolean;
  /** Nothing planned and nothing judged yet this week — shown quietly, not as a failing 0%. */
  inactive: boolean;
}

/** Stands in for the counts of a store that has no plans — nothing to compare against. */
const NO_COUNTS: Map<string, CountRow> = new Map();

interface StoreCounts {
  status: CountsStatus;
  map: Map<string, CountRow> | null;
  error: DoughSauceError | null;
}

/**
 * How the week's counts were fetched. `bulk` is the normal path: ONE call for
 * every store. `fallback` means that call answered 403 (a store manager, or the
 * pizzasys rule isn't registered yet) and counts load per store instead.
 */
type BulkState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; storesTotal: number | null; storesWithData: number | null }
  | { status: "fallback" }
  | { status: "error" };

/** Run async jobs with bounded parallelism — 44 stores shouldn't open 44 sockets at once. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

const MAX_COUNT_RANGE_DAYS = 31;

export function useWeeklyGrid(weekStart: string | undefined, map: IngredientMap, mapReady: boolean) {
  const [weekly, setWeekly] = useState<Panel<WeeklyPlansResponse>>(EMPTY);
  const [previous, setPrevious] = useState<(WeeklyPlansResponse | null)[]>([]);
  const [counts, setCounts] = useState<Record<string, StoreCounts>>({});
  const [bulk, setBulk] = useState<BulkState>({ status: "idle" });
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const mapRef = useRef(map);
  mapRef.current = map;
  const idsKey = map.ultimatrixIds.join(",");

  // The current week's counts window + abort signal, shared by on-demand loads.
  const rangeRef = useRef<{ from: string; to: string; ids: string[]; signal: AbortSignal } | null>(null);
  // Mirrors `counts[store].status` synchronously, so a double click or a
  // re-render can never fire the same request twice.
  const statusRef = useRef<Record<string, CountsStatus>>({});
  // The all-stores call is made once per week view, however often weekly.data changes.
  const bulkStartedRef = useRef(false);
  // The previous weeks' plans are only needed for the Progress column. They load
  // once per week view, in the background once counts are in. One shared
  // promise, so concurrent callers share it.
  const prevRefsRef = useRef<{ week_start: string }[]>([]);
  const prevPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!mapReady) return;
    const controller = new AbortController();
    const signal = controller.signal;
    setLoading(true);
    rangeRef.current = null;
    statusRef.current = {};
    judgementRef.current = {};
    prevRefsRef.current = [];
    prevPromiseRef.current = null;
    bulkStartedRef.current = false;
    setPrevious([]);
    setCounts({});
    setBulk({ status: "idle" });

    (async () => {
      let current: WeeklyPlansResponse;
      try {
        current = await doughSauceService.getWeeklyPlans(weekStart, signal);
        // With no week_start the server answers in the DAILY shape (§3.3:
        // "neither → tomorrow, daily shape") — no `week` object. Resolve the
        // current week from the `weeks` list it carries (rule 1: never derive
        // one locally) and ask again in the weekly shape.
        if (!current?.week) {
          const weeks = (current as { weeks?: WeeklyPlansResponse["weeks"] } | null)?.weeks ?? [];
          const resolved = weeks.find((w) => w.current) ?? weeks[0];
          if (!resolved) {
            throw new DoughSauceError("The server returned no accounting weeks.", "UNKNOWN", "audit");
          }
          current = await doughSauceService.getWeeklyPlans(resolved.week_start, signal);
          if (!current?.week) {
            throw new DoughSauceError("The server did not return a weekly plan shape.", "UNKNOWN", "audit");
          }
        }
      } catch (err) {
        if (isAbort(err) || signal.aborted) return;
        setWeekly({ data: null, error: err as DoughSauceError });
        setLoading(false);
        return;
      }
      if (signal.aborted) return;

      // Previous weeks' boundaries come from the server — rule 1. Their start
      // dates are already in this response, so the counts window needs no
      // extra request.
      const prevRefs = (current.previous_weeks ?? []).slice(0, 3);
      prevRefsRef.current = prevRefs;

      // One counts window, covering the oldest previous week through this
      // week — 28 days, inside inventory's 31-day cap.
      const starts = [current.week.week_start, ...prevRefs.map((w) => w.week_start)].sort();
      let from = starts[0];
      const to = current.week.week_end;
      if (daysBetween(from, to).length > MAX_COUNT_RANGE_DAYS) from = current.week.week_start;
      rangeRef.current = { from, to, ids: idsKey.split(","), signal };

      setWeekly({ data: current, error: null });
      setLoading(false);
    })().catch((err) => {
      // An unexpected shape must surface as an error state, never an
      // unhandled rejection that takes down the page.
      if (signal.aborted || isAbort(err)) return;
      setWeekly({
        data: null,
        error:
          err instanceof DoughSauceError
            ? err
            : new DoughSauceError(err instanceof Error ? err.message : String(err), "UNKNOWN", "audit"),
      });
      setLoading(false);
    });

    return () => controller.abort();
  }, [weekStart, idsKey, mapReady, reloadKey]);

  /** The 3 previous weeks' plans, fetched at most once per week view. */
  const ensurePrevious = useCallback((): Promise<void> => {
    const range = rangeRef.current;
    if (!range || range.signal.aborted) return Promise.resolve();
    if (prevPromiseRef.current) return prevPromiseRef.current;
    const refs = prevRefsRef.current;
    prevPromiseRef.current = Promise.allSettled(refs.map((w) => doughSauceService.getWeeklyPlans(w.week_start, range.signal))).then(
      (settled) => {
        if (range.signal.aborted) return;
        // A previous week only counts if the server answered in the weekly shape.
        setPrevious(settled.map((r) => (r.status === "fulfilled" && r.value?.week ? r.value : null)));
      }
    );
    return prevPromiseRef.current;
  }, []);

  /** Fetch one store's counts. A no-op while loading or once loaded; an error can be retried. */
  const loadCounts = useCallback(async (store: string) => {
    const range = rangeRef.current;
    if (!range || range.signal.aborted) return;
    const st = statusRef.current[store];
    if (st === "loading" || st === "ready") return;
    statusRef.current[store] = "loading";
    setCounts((c) => ({ ...c, [store]: { status: "loading", map: null, error: null } }));
    void ensurePrevious();
    try {
      const res = await doughSauceService.getCounts(store, range.from, range.to, range.ids, range.signal);
      if (range.signal.aborted) return;
      statusRef.current[store] = "ready";
      setCounts((c) => ({
        ...c,
        [store]: { status: "ready", map: indexCounts(res.data ?? [], mapRef.current), error: null },
      }));
    } catch (err) {
      if (range.signal.aborted || isAbort(err)) return;
      statusRef.current[store] = "error";
      const error =
        err instanceof DoughSauceError
          ? err
          : new DoughSauceError(err instanceof Error ? err.message : String(err), "UNKNOWN", "inv");
      setCounts((c) => ({ ...c, [store]: { status: "error", map: null, error } }));
    }
  }, [ensurePrevious]);

  /**
   * The normal path: ONE request for every store's counts, grouped by the
   * `store` every row carries. A store with no rows is "never counted" (an
   * empty map — cells become missing/awaiting), not an error.
   *
   * 403 is a designed answer, not a failure: this route needs access to every
   * active store, so a store manager gets 403 and the page falls back to the
   * per-store route for the stores that have a plan.
   */
  const loadAllStores = useCallback(
    async (stores: { store: string; hasPlans: boolean }[]) => {
      const range = rangeRef.current;
      if (!range || range.signal.aborted) return;
      setBulk({ status: "loading" });
      const names = stores.map((st) => st.store);
      const loadingState: Record<string, StoreCounts> = {};
      for (const n of names) {
        statusRef.current[n] = "loading";
        loadingState[n] = { status: "loading", map: null, error: null };
      }
      setCounts(loadingState);
      try {
        const res = await doughSauceService.getAllCounts(range.from, range.to, range.ids, range.signal);
        if (range.signal.aborted) return;
        const grouped = new Map<string, CountRow[]>();
        for (const row of res.data ?? []) {
          const list = grouped.get(row.store);
          if (list) list.push(row);
          else grouped.set(row.store, [row]);
        }
        const next: Record<string, StoreCounts> = {};
        for (const n of names) {
          statusRef.current[n] = "ready";
          next[n] = { status: "ready", map: indexCounts(grouped.get(n) ?? [], mapRef.current), error: null };
        }
        setCounts(next);
        setBulk({
          status: "ready",
          storesTotal: res.meta?.stores_total ?? null,
          storesWithData: res.meta?.stores_with_data ?? null,
        });
        void ensurePrevious();
      } catch (err) {
        if (range.signal.aborted || isAbort(err)) return;
        const error =
          err instanceof DoughSauceError
            ? err
            : new DoughSauceError(err instanceof Error ? err.message : String(err), "UNKNOWN", "inv");
        if (error.code === "FORBIDDEN") {
          for (const n of names) delete statusRef.current[n];
          setCounts({});
          setBulk({ status: "fallback" });
          const todo = stores.filter((st) => st.hasPlans).map((st) => st.store);
          if (todo.length > 0) void pool(todo, 4, loadCounts);
          return;
        }
        // Anything else: say so for every store. Opening a store retries just that one.
        const failed: Record<string, StoreCounts> = {};
        for (const n of names) {
          statusRef.current[n] = "error";
          failed[n] = { status: "error", map: null, error };
        }
        setCounts(failed);
        setBulk({ status: "error" });
      }
    },
    [ensurePrevious, loadCounts]
  );

  useEffect(() => {
    const data = weekly.data;
    if (!data || !rangeRef.current || bulkStartedRef.current) return;
    bulkStartedRef.current = true;
    void loadAllStores((data.stores ?? []).map((st) => ({ store: st.store, hasPlans: st.plans.length > 0 })));
  }, [weekly.data, loadAllStores]);

  const results: StoreWeekResult[] = useMemo(() => {
    const data = weekly.data;
    if (!data) return [];
    const today = todayIso();
    const rows = (data.stores ?? []).map((s) => {
      const sc = counts[s.store];
      const needsCounts = s.plans.length > 0;
      const countsStatus: CountsStatus = sc?.status ?? "idle";
      // Real counts only — previous weeks are scored against these, so a store
      // that skipped the fetch must not score them against an empty set.
      const storeCounts = countsStatus === "ready" ? sc!.map : null;
      const cells = buildWeekCells(
        data.week.week_start,
        data.week.week_end,
        s.plans,
        storeCounts ?? (needsCounts ? null : NO_COUNTS),
        today
      );
      const breakdown = score({
        cellsOk: cells.cellsOk,
        stickers: s.judgement?.stickers_compliance,
        quality: s.judgement?.dough_quality,
      });
      const previousScores = previous.map((p) => {
        const row = p?.stores.find((r) => r.store === s.store);
        if (!p?.week || !row || !storeCounts) return null;
        // A week with no plan and no judgement has no score to compare
        // against — it's "no data", not 0% (rule 2), or it would inflate progress.
        const judged = row.judgement?.stickers_compliance != null || row.judgement?.dough_quality != null;
        if (row.plans.length === 0 && !judged) return null;
        const prevCells = buildWeekCells(p.week.week_start, p.week.week_end, row.plans, storeCounts, today);
        return score({
          cellsOk: prevCells.cellsOk,
          stickers: row.judgement?.stickers_compliance,
          quality: row.judgement?.dough_quality,
        }).score;
      });
      const inactive =
        !cells.hasPlans && s.judgement?.stickers_compliance == null && s.judgement?.dough_quality == null;
      const scored = needsCounts ? countsStatus === "ready" : true;
      return {
        storeId: s.store_id,
        store: s.store,
        daysConfirmed: s.days_confirmed,
        judgement: s.judgement,
        cells,
        breakdown,
        previousScores,
        progress: scored ? progress(breakdown.score, previousScores) : null,
        rank: 0,
        needsCounts,
        countsStatus,
        countsError: sc?.error ?? null,
        countsUnavailable: countsStatus === "error",
        scored,
        inactive,
      };
    });
    // Only complete scores are ranked — a store whose counts aren't in yet
    // keeps its server order below them rather than ranking on a partial score.
    const rankable = rows.filter((r) => r.scored && !r.inactive);
    const ranks = rankBy(rankable, (r) => r.breakdown.score);
    const withRank = rows.map((r) => ({ ...r, rank: ranks.get(r) ?? 0 }));
    const ranked = withRank.filter((r) => r.rank > 0).sort((a, b) => a.rank - b.rank);
    const rest = withRank.filter((r) => r.rank === 0);
    return [...ranked, ...rest];
  }, [weekly.data, previous, counts]);

  const countsSummary = useMemo(() => {
    // Stores whose score depends on counts. In bulk mode every store is loaded,
    // but only those with a plan can be on target — the same set either way.
    const needing = (weekly.data?.stores ?? []).filter((st) => st.plans.length > 0).map((st) => st.store);
    let ready = 0;
    let loadingN = 0;
    let firstError: DoughSauceError | null = null;
    for (const store of needing) {
      const c = counts[store];
      if (c?.status === "ready") ready++;
      else if (c?.status === "loading" || c === undefined) loadingN++;
      else if (c.status === "error" && !firstError) firstError = c.error;
    }
    const bulkLoading = bulk.status === "loading" || bulk.status === "idle";
    const storesTotal = bulk.status === "ready" ? bulk.storesTotal : null;
    const storesWithData = bulk.status === "ready" ? bulk.storesWithData : null;
    return {
      total: needing.length,
      ready,
      loading: bulkLoading && weekly.data ? Math.max(loadingN, 1) : loadingN,
      allReady: !bulkLoading && ready === needing.length,
      firstError,
      mode: bulk.status,
      /** Active stores with no count at all in the window — from `meta`, null when unknown. */
      storesWithoutCounts:
        storesTotal != null && storesWithData != null ? Math.max(0, storesTotal - storesWithData) : null,
    };
  }, [counts, weekly.data, bulk]);

  // The PUT replaces the whole judgement. Savers send only what changed; here it is
  // merged onto the LATEST known judgement and writes for one store run one at a time,
  // so two quick changes (a verdict and a note) can't overwrite each other.
  const weeklyRef = useRef(weekly);
  weeklyRef.current = weekly;
  const judgementRef = useRef<Record<string, WeeklyPlansResponse["stores"][number]["judgement"]>>({});
  const judgementQueue = useRef<Record<string, Promise<unknown>>>({});

  const saveJudgement = useCallback((storeKey: string, patch: JudgementPatch) => {
    const run = async () => {
      const latest =
        judgementRef.current[storeKey] ??
        weeklyRef.current.data?.stores.find((s) => s.store === storeKey)?.judgement ??
        null;
      const payload: JudgementPayload = {
        stickers_compliance: latest?.stickers_compliance ?? null,
        dough_quality: latest?.dough_quality ?? null,
        note: latest?.note ?? null,
        ...patch,
      };
      await doughSauceService.saveJudgement(storeKey, payload);
      setWeekly((w) => {
        if (!w.data) return w;
        return {
          ...w,
          data: {
            ...w.data,
            stores: w.data.stores.map((s) =>
              s.store !== storeKey
                ? s
                : {
                    ...s,
                    judgement: {
                      judged_by: s.judgement?.judged_by ?? null,
                      judged_at: s.judgement?.judged_at ?? null,
                      ...payload,
                      complete: payload.stickers_compliance != null && payload.dough_quality != null,
                    },
                  }
            ),
          },
        };
      });
      const store = weeklyRef.current.data?.stores.find((s) => s.store === storeKey);
      judgementRef.current[storeKey] = {
        judged_by: store?.judgement?.judged_by ?? null,
        judged_at: store?.judgement?.judged_at ?? null,
        ...payload,
        complete: payload.stickers_compliance != null && payload.dough_quality != null,
      };
    };
    const next = (judgementQueue.current[storeKey] ?? Promise.resolve()).catch(() => undefined).then(run);
    judgementQueue.current[storeKey] = next;
    return next;
  }, []);

  return {
    weekly: weekly.data,
    error: weekly.error,
    results,
    loading,
    /** Any store's counts in flight. */
    countsLoading: countsSummary.loading > 0,
    countsSummary,
    countsError: countsSummary.firstError,
    loadCounts,
    saveJudgement,
    reload: useCallback(() => setReloadKey((k) => k + 1), []),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  §4.2 / §8.4 Recipes                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export function useRecipes(asOf: string, all: boolean) {
  const [panel, setPanel] = useState<Panel<Recipe[]>>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    doughSauceService
      .getRecipes({ asOf, all }, controller.signal)
      .then((data) => setPanel({ data, error: null }))
      .catch((err) => {
        if (!isAbort(err)) setPanel({ data: null, error: err as DoughSauceError });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [asOf, all, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const create = useCallback(
    async (payload: CreateRecipePayload) => {
      await doughSauceService.createRecipe(payload);
      reload();
    },
    [reload]
  );
  const update = useCallback(
    async (id: number, payload: UpdateRecipePayload): Promise<RecipeUpdateResult> => {
      const result = await doughSauceService.updateRecipe(id, payload);
      reload();
      return result;
    },
    [reload]
  );
  const close = useCallback(
    async (id: number) => {
      await doughSauceService.closeRecipe(id);
      reload();
    },
    [reload]
  );

  return { ...panel, loading, reload, create, update, close };
}
