"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDoughSauceAccess } from "@/lib/hooks/use-dough-sauce-access";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  ImageDown,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { StorePicker, type StoreOption } from "@/components/cleaning";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { doughSauceService, DoughSauceError } from "@/lib/api/services/dough-sauce.service";
import { useIngredients, useStoreDailyPlan } from "@/lib/hooks/use-dough-sauce";
import { plannedQty, variance } from "@/lib/dough-sauce/formulas";
import { indexCounts } from "@/lib/dough-sauce/week-cells";
import { addDaysIso, todayIso, tomorrowIso } from "@/lib/dough-sauce/dates";
import {
  INGREDIENT_KEYS,
  type BaseIngredient,
  type IngredientKey,
  type PlanLine,
  type UnmappedItem,
} from "@/types/dough-sauce.types";
import {
  DsErrorState,
  MissingValue,
  PENDING_PILL,
  StepperInput,
  exportNodeAsPng,
  fmtQty,
  personName,
  round4,
  useDateTimeFormatter,
  useDayFormatter,
  useIngredientLabel,
  useSystemLabel,
} from "./ds-ui";
import { DailyPlanSheet } from "./daily-plan-sheet";
import { RecipeDialog, type RecipeDraft } from "./recipe-dialog";

type Buffers = Record<IngredientKey, string>;
const EMPTY_BUFFERS: Buffers = { dough_18oz: "", dough_10oz: "", sauce: "" };
const UNMAPPED_PREVIEW = 5;
/** Table row order: sauce first, then the small dough, then the large. */
const ROW_ORDER: IngredientKey[] = ["sauce", "dough_10oz", "dough_18oz"];

/** A store's key for every Dough & Sauce path is its TEXT code, not the numeric id. */
function useStoreOptions(): StoreOption[] {
  const { overviewStores } = useAuthStore();
  return useMemo(
    () =>
      // A store without its TEXT code can't be addressed — the numeric id is a 404 (contract §9).
      (overviewStores ?? [])
        .filter((s) => !!s.storeId)
        .map((s) => ({
          id: Number(s.id),
          code: s.storeId as string,
          name: s.name,
        })),
    [overviewStores]
  );
}

/** Another tab asking the daily view to open a specific store/date. */
export interface DailyFocus {
  store: string;
  date: string;
  nonce: number;
}

export function DailyPlanView({ focus }: { focus?: DailyFocus | null }) {
  const t = useTranslations("doughSauce.daily");
  const tc = useTranslations("doughSauce.common");
  const systemLabel = useSystemLabel();
  const day = useDayFormatter();
  const dateTime = useDateTimeFormatter();
  const options = useStoreOptions();
  const { selectedStore } = useSelectedStoreStore();

  const [store, setStore] = useState<StoreOption | null>(null);
  const [date, setDate] = useState<string>(tomorrowIso());
  const [buffers, setBuffers] = useState<Buffers>(EMPTY_BUFFERS);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [recipeDraft, setRecipeDraft] = useState<Partial<RecipeDraft> | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  // The downloadable sheet only exists in the DOM (off-screen) while it is being exported.
  const [sheetOpen, setSheetOpen] = useState(false);

  const access = useDoughSauceAccess();
  // View-only for someone who may read this store's plan but has no POST rule for it.
  const canConfirmHere = !!store && access.can.confirmPlan(store.id);
  const { ingredients, map, loaded: mapReady } = useIngredients();
  const labelOf = useIngredientLabel(ingredients);
  const { plan, base, counts, prevPlan, loading, reload, confirm } = useStoreDailyPlan(
    store?.code ?? null,
    date,
    map,
    mapReady
  );

  // Default to the globally-selected store, else the first accessible one.
  useEffect(() => {
    if (store) return;
    if (selectedStore?.storeId) {
      setStore({ id: Number(selectedStore.id), code: selectedStore.storeId, name: selectedStore.name });
    } else if (options.length > 0) {
      setStore(options[0]);
    }
  }, [store, selectedStore, options]);

  // Opened from the All stores tab.
  useEffect(() => {
    if (!focus) return;
    const hit = options.find((o) => o.code === focus.store);
    setStore(hit ?? { id: -1, code: focus.store, name: focus.store });
    setDate(focus.date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  const planData = plan.data;
  const confirmed = !!planData?.confirmed;
  const showFrozen = confirmed && !editing;
  const maxPct = planData?.buffer_max_pct ?? 100;
  const confirmedBy = personName(planData?.confirmed_by);

  // The buffers this screen starts from: the stored plan's own when confirmed,
  // else the store's last-confirmed defaults.
  const initialBuffers = useMemo(() => {
    const next = { ...EMPTY_BUFFERS };
    if (!planData) return next;
    if (planData.confirmed) {
      for (const l of planData.lines) next[l.ingredient_key] = String(l.buffer_pct);
    } else if (planData.default_buffers) {
      for (const k of INGREDIENT_KEYS) {
        const v = planData.default_buffers[k];
        if (v != null) next[k] = String(v);
      }
    }
    return next;
  }, [planData]);

  // Start over only for a different store / date / plan state — NOT when the same plan is
  // refetched (refresh, a recipe was added), which would wipe the buffers being edited.
  const resetKey = `${store?.code ?? ""}|${date}|${planData ? `${planData.confirmed}|${planData.confirmed_at ?? ""}` : "none"}`;
  useEffect(() => {
    setBuffers(initialBuffers);
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const dirty = INGREDIENT_KEYS.some((k) => buffers[k] !== initialBuffers[k]);

  const baseByKey = useMemo(() => {
    const m: Partial<Record<IngredientKey, BaseIngredient>> = {};
    for (const i of base.data?.ingredients ?? []) m[i.key] = i;
    return m;
  }, [base.data]);

  const bufferErrors = useMemo(() => {
    const errs: Partial<Record<IngredientKey, string>> = {};
    for (const k of INGREDIENT_KEYS) {
      const raw = buffers[k].trim();
      const n = Number(raw);
      if (raw === "" || !Number.isFinite(n)) errs[k] = t("bufferRequired");
      else if (n < 0 || n > maxPct) errs[k] = t("bufferRange", { max: maxPct });
    }
    return errs;
  }, [buffers, maxPct, t]);

  const canConfirm =
    !!store &&
    !!planData &&
    !!base.data &&
    // A missing base must never be confirmed as a plan of 0 (rule 2).
    INGREDIENT_KEYS.every((k) => Number.isFinite(baseByKey[k]?.base) && !bufferErrors[k]) &&
    !loading &&
    !saving;

  const onConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    try {
      await confirm({
        plan_date: date,
        // All three lines or none — a two-line plan is a 422 (§3.2).
        lines: INGREDIENT_KEYS.map((k) => ({
          ingredient_key: k,
          buffer_pct: Number(buffers[k]),
          planned_qty: round4(plannedQty(baseByKey[k]!.base, Number(buffers[k]))),
        })),
      });
      toast.success(t("confirmed"));
    } catch (err) {
      toast.error(err instanceof DoughSauceError ? err.message : t("confirmFailed"));
    } finally {
      setSaving(false);
    }
  };

  const onExport = async () => {
    setExporting(true);
    try {
      setSheetOpen(true);
      // Let React mount the off-screen sheet, then wait for its photos: a picture taken before they load has holes.
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      const sheet = sheetRef.current;
      if (!sheet) throw new Error("sheet");
      await Promise.all(Array.from(sheet.querySelectorAll("img"), (img) => img.decode().catch(() => undefined)));
      await exportNodeAsPng(sheet, `dough-sauce-${store?.code ?? "store"}-${date}.png`);
      toast.success(t("imageDownloaded"));
    } catch {
      toast.error(t("imageFailed"));
    } finally {
      setSheetOpen(false);
      setExporting(false);
    }
  };

  /* ── Shortage in the PREVIOUS day's count vs that day's confirmed plan ── */
  const today = todayIso();
  const tomorrow = tomorrowIso();
  const prevDay = addDaysIso(date, -1);
  const shortage = useMemo(() => {
    const tp = prevPlan.data;
    if (!counts.data || !tp?.confirmed) return null;
    const idx = indexCounts(counts.data.data ?? [], map);
    return tp.lines.map((l) => {
      const row = idx.get(`${prevDay}|${l.ingredient_key}`);
      return {
        key: l.ingredient_key,
        planned: l.planned_qty,
        counted: row ? row.total_in_unit_1 : null,
        variance: row ? variance(row.total_in_unit_1, l.planned_qty) : null,
      };
    });
  }, [prevPlan.data, counts.data, map, prevDay]);
  const shortLines = shortage?.filter((s) => s.variance != null && s.variance < 0) ?? [];
  // A plan for today or later is still to be produced, so the previous day's
  // shortage is owed to it. For a day already gone it's just history.
  const makeUpTomorrow = date >= today;
  const makeUpByKey = useMemo(() => {
    const m: Partial<Record<IngredientKey, number>> = {};
    if (!makeUpTomorrow) return m;
    for (const s of shortLines) m[s.key] = round4(Math.abs(s.variance!));
    return m;
  }, [makeUpTomorrow, shortLines]);

  if (options.length === 0 && !store) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
        <Store className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">{t("noStore")}</p>
      </div>
    );
  }

  const firstLoad = loading && !planData && !plan.error;
  const relative = date === today ? t("relToday") : date === tomorrow ? t("relTomorrow") : date < today ? t("relPast") : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StorePicker options={options} value={store?.id ?? null} onChange={setStore} loading={options.length === 0} />
          <DatePicker value={date} onChange={(v) => v && setDate(v)} className="w-full sm:w-40" />
          <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
            {[
              { iso: today, label: t("relToday") },
              { iso: tomorrow, label: t("relTomorrow") },
            ].map((q) => (
              <button
                key={q.iso}
                type="button"
                onClick={() => setDate(q.iso)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  date === q.iso ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
        <Button variant="outline" size="icon" onClick={reload} disabled={loading || !store} aria-label={tc("refresh")}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {firstLoad && (
        <DailySkeleton
          relative={relative}
          title={day.long(date)}
          store={store}
          prevLabel={day.short(prevDay)}
          labelOf={labelOf}
        />
      )}

      {/* [audit] down → nothing works. Say so plainly (§9). */}
      {plan.error && <DsErrorState error={plan.error} onRetry={reload} />}

      {planData && (
        <>
          {/* ① The previous day's count can't be read — the table below simply has no count column */}
          {counts.error && (
            <Notice tone="muted" icon={AlertTriangle}>
              {counts.error.code === "FORBIDDEN"
                ? t("countsForbidden")
                : t("countsUnavailable", { system: systemLabel("inv") })}
            </Notice>
          )}

          {/* [data] down → no base. Show the stored plan; disable Confirm. */}
          {base.error && (
            <Notice tone="warn" icon={AlertTriangle}>
              {base.error.code === "FORBIDDEN"
                ? t("baseForbidden")
                : t("baseUnavailable", { system: systemLabel("data"), message: base.error.message })}
            </Notice>
          )}

          {/* ② The plan. The downloadable picture is a separate sheet (DailyPlanSheet), not this card. */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <PlanCardHeader
                relative={relative}
                title={day.long(date)}
                store={store}
                status={
                  <StatusPill
                    confirmed={confirmed}
                    editing={editing}
                    by={confirmedBy}
                    at={planData.confirmed_at ? dateTime(planData.confirmed_at) : null}
                  />
                }
              />

              <PlanTable
                keys={ROW_ORDER}
                labelOf={labelOf}
                baseByKey={baseByKey}
                lines={planData.lines}
                frozen={showFrozen}
                sourceDates={base.data?.source_dates ?? []}
                buffers={buffers}
                onBuffer={(k, v) => setBuffers((s) => ({ ...s, [k]: v }))}
                bufferErrors={bufferErrors}
                maxPct={maxPct}
                shortDay={day.short}
                makeUpByKey={showFrozen ? makeUpByKey : {}}
                prevRows={counts.error ? null : shortage}
                prevDateLabel={day.short(prevDay)}
                weekday={base.data?.weekday}
                lookback={base.data?.lookback}
              />

              {shortLines.length > 0 && (
                <p className="border-t bg-muted/20 px-4 py-2 text-xs text-muted-foreground sm:px-5">
                  {makeUpTomorrow ? t("makeUpHint") : t("prevPastHint")}
                </p>
              )}

              {base.data && (
                <div className={PLAN_FOOT}>
                  <span className="inline-flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5" />
                    {t("sourceSummary", {
                      weekday: base.data.weekday,
                      found: base.data.days_found,
                      lookback: base.data.lookback,
                    })}
                  </span>
                  {base.data.days_found < base.data.lookback && (
                    <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {t("fewerDays", { found: base.data.days_found, lookback: base.data.lookback })}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ③ Confirm — the bar says what state the plan is in, then offers the next step */}
          <div className={CONFIRM_BAR}>
            {showFrozen && (
              <span className="me-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                {t("frozenNote")}
              </span>
            )}
            {!canConfirmHere && <span className="me-auto text-xs text-muted-foreground">{t("viewOnly")}</span>}
            {canConfirmHere && !showFrozen && !dirty && <span className="me-auto text-xs text-muted-foreground">{t("confirmHint")}</span>}
            {canConfirmHere && !showFrozen && dirty && (
              <span className="me-auto inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {t("unsaved")}
                <button
                  type="button"
                  onClick={() => setBuffers(initialBuffers)}
                  className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  <RotateCcw className="h-3 w-3" />
                  {t("resetBuffers")}
                </button>
              </span>
            )}
            {confirmed && (
              <Button variant="outline" onClick={onExport} disabled={exporting || editing || loading}>
                {exporting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ImageDown className="me-2 h-4 w-4" />}
                {t("exportImage")}
              </Button>
            )}
            {!canConfirmHere ? null : showFrozen ? (
              <Button variant="outline" onClick={() => setEditing(true)} disabled={!base.data || loading}>
                <Pencil className="me-2 h-4 w-4" />
                {t("editPlan")}
              </Button>
            ) : (
              <>
                {editing && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditing(false);
                      setBuffers(initialBuffers);
                    }}
                    disabled={saving}
                  >
                    {tc("cancel")}
                  </Button>
                )}
                <Button onClick={onConfirm} disabled={!canConfirm}>
                  {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="me-2 h-4 w-4" />}
                  {editing ? t("reconfirm") : t("confirm")}
                </Button>
              </>
            )}
          </div>

          {/* ④ Unmapped items — the warning and its fix on the same card (§8.4) */}
          {base.data && base.data.unmapped.length > 0 && (
            <UnmappedCard
              items={base.data.unmapped}
              onAddRecipe={
                access.can.addRecipe
                  ? (item) =>
                      setRecipeDraft({
                        item_id: item.item_id,
                        menu_item_name: item.name,
                        menu_item_account: item.account,
                      })
                  : undefined
              }
            />
          )}
        </>
      )}

      {sheetOpen && planData && store && (
        <div aria-hidden style={{ position: "fixed", left: -100000, top: 0, pointerEvents: "none" }}>
          <DailyPlanSheet
            ref={sheetRef}
            weekday={day.weekday(date)}
            dateLabel={day.monthDay(date)}
            storeCode={store.code}
            // Total to make = the confirmed plan + whatever yesterday's shortage adds (same figure as the table's last column).
            totals={Object.fromEntries(
              ROW_ORDER.map((k) => {
                const line = planData.lines.find((l) => l.ingredient_key === k);
                return [k, line ? round4(line.planned_qty + (makeUpByKey[k] ?? 0)) : null];
              })
            )}
          />
        </div>
      )}

      <RecipeDialog
        mode="create"
        open={recipeDraft !== null}
        onOpenChange={(o) => !o && setRecipeDraft(null)}
        ingredients={ingredients}
        draft={recipeDraft ?? undefined}
        onCreate={async (payload) => {
          await doughSauceService.createRecipe(payload);
          reload();
        }}
      />
    </div>
  );
}

/* ── Pieces ────────────────────────────────────────────────────────────── */

function Notice({
  tone,
  icon: Icon,
  children,
}: {
  tone: "muted" | "warn" | "ok";
  icon: typeof AlertTriangle;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
        tone === "muted" && "border-dashed text-muted-foreground",
        tone === "warn" && "border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/15",
        tone === "ok" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          tone === "warn" && "text-amber-600 dark:text-amber-400"
        )}
      />
      <span>{children}</span>
    </div>
  );
}

interface PrevRow {
  key: IngredientKey;
  planned: number;
  counted: number | null;
  variance: number | null;
}

function StatusPill({
  confirmed,
  editing,
  by,
  at,
}: {
  confirmed: boolean;
  editing: boolean;
  by: string | null;
  at: string | null;
}) {
  const t = useTranslations("doughSauce.daily");
  if (editing) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", PENDING_PILL)}>
        <Pencil className="h-3.5 w-3.5" />
        {t("editingBadge")}
      </span>
    );
  }
  if (!confirmed) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", PENDING_PILL)}>
        <CircleDashed className="h-3.5 w-3.5" />
        {t("notConfirmedBadge")}
      </span>
    );
  }
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {by ? t("confirmedBy", { name: by }) : t("confirmedBadge")}
      </span>
      {at && <span className="text-[10px] text-muted-foreground tabular-nums">{at}</span>}
    </div>
  );
}

/* Shared by PlanTable and DailySkeleton, so the loading state is built from the same cell styles. */
const NUM = "text-end tabular-nums";
const HEAD = "text-[10px] font-semibold uppercase tracking-wider";
const GROUP = "h-8 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground";
const PLAN_FOOT =
  "flex flex-wrap items-center gap-x-4 gap-y-1 border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground sm:px-5";
const CONFIRM_BAR = "flex flex-wrap items-center justify-end gap-2 rounded-xl border bg-muted/20 px-4 py-3";

/** Column title with a one-line "what is this" under it. */
function HeadHint({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <span className="flex flex-col items-end gap-0.5">
      <span>{children}</span>
      <span className="text-[9px] font-normal normal-case tracking-normal text-muted-foreground">{hint}</span>
    </span>
  );
}

/**
 * The plan as a table — one row per ingredient, read left to right:
 * last count → source days → average → base + buffer → planned (→ make-up → total).
 * Rule 4 holds: a confirmed plan renders exactly what was stored, never base × current buffer.
 */
function PlanTable({
  keys,
  labelOf,
  baseByKey,
  lines,
  frozen,
  sourceDates,
  buffers,
  onBuffer,
  bufferErrors,
  maxPct,
  shortDay,
  makeUpByKey,
  prevRows,
  prevDateLabel,
  weekday,
  lookback,
}: {
  keys: IngredientKey[];
  labelOf: (k: IngredientKey) => string;
  baseByKey: Partial<Record<IngredientKey, BaseIngredient>>;
  lines: PlanLine[];
  frozen: boolean;
  sourceDates: string[];
  buffers: Buffers;
  onBuffer: (k: IngredientKey, v: string) => void;
  bufferErrors: Partial<Record<IngredientKey, string>>;
  maxPct: number;
  shortDay: (iso: string) => string;
  /** Units short in the previous day's count, owed on top of this plan. */
  makeUpByKey: Partial<Record<IngredientKey, number>>;
  /** Null when the previous day can't be checked (no counts, or its plan wasn't confirmed). */
  prevRows: PrevRow[] | null;
  prevDateLabel: string;
  weekday?: string;
  lookback?: number;
}) {
  const t = useTranslations("doughSauce.daily");
  const showCounted = prevRows != null;
  const showSources = !frozen && sourceDates.length > 0 && Object.keys(baseByKey).length > 0;
  const showMakeUp = frozen && keys.some((k) => (makeUpByKey[k] ?? 0) > 0);

  return (
    <Table>
      <TableHeader>
        {/* Group labels — say what each block of columns is for. */}
        <TableRow className="hover:bg-transparent">
          <TableHead colSpan={showCounted ? 2 : 1} className={cn(GROUP, "ps-4 sm:ps-5")}>
            {showCounted ? t("groupCheck") : ""}
          </TableHead>
          {showSources && (
            <TableHead colSpan={sourceDates.length + 1} className={cn(GROUP, "border-s text-center")}>
              {t("groupSources", { lookback: lookback ?? sourceDates.length, weekday: weekday ?? "" })}
            </TableHead>
          )}
          <TableHead colSpan={showMakeUp ? 5 : 3} className={cn(GROUP, "border-s text-center")}>
            {t("groupPlan")}
          </TableHead>
        </TableRow>
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableHead className="ps-4 text-[10px] font-semibold uppercase tracking-wider sm:ps-5">{t("colIngredient")}</TableHead>
          {showCounted && (
            <TableHead className={cn(NUM, HEAD)}>
              {t("colCounted", { date: prevDateLabel })}
            </TableHead>
          )}
          {showSources &&
            sourceDates.map((d) => (
              <TableHead key={d} className={cn(NUM, "text-[10px] font-semibold tracking-wider")}>
                {shortDay(d)}
              </TableHead>
            ))}
          {showSources && (
            <TableHead className={cn(NUM, HEAD)}><HeadHint hint={t("hintAverage")}>{t("colAverage")}</HeadHint></TableHead>
          )}
          <TableHead className={cn(NUM, HEAD)}><HeadHint hint={t("hintBase")}>{t("colBase")}</HeadHint></TableHead>
          <TableHead className={cn(NUM, HEAD)}><HeadHint hint={t("hintBuffer")}>{t("colBuffer")}</HeadHint></TableHead>
          <TableHead className={cn(NUM, HEAD, !showMakeUp && "pe-4 sm:pe-5")}>
            <HeadHint hint={t("hintPlanned")}>{t("colPlanned")}</HeadHint>
          </TableHead>
          {showMakeUp && (
            <>
              <TableHead className={cn(NUM, "text-[10px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400")}>
                <HeadHint hint={t("hintMakeUp")}>{t("colMakeUp")}</HeadHint>
              </TableHead>
              <TableHead className={cn(NUM, "pe-4 text-[10px] font-semibold uppercase tracking-wider sm:pe-5")}><HeadHint hint={t("hintTotal")}>{t("colTotal")}</HeadHint></TableHead>
            </>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.map((k) => {
          const label = labelOf(k);
          const base = baseByKey[k];
          const line = lines.find((l) => l.ingredient_key === k);
          const buffer = buffers[k];
          const bufferError = bufferErrors[k];
          const planned = frozen
            ? line?.planned_qty ?? null
            : base && Number.isFinite(base.base) && !bufferError
              ? plannedQty(base.base, Number(buffer))
              : null;
          const baseValue = frozen ? line?.base_qty ?? null : base?.base ?? null;
          const bufferShown = frozen ? line?.buffer_pct ?? null : bufferError ? null : Number(buffer);
          const prev = prevRows?.find((r) => r.key === k);
          const isShort = prev?.variance != null && prev.variance < 0;
          const makeUp = makeUpByKey[k] ?? 0;

          return (
            <TableRow key={k}>
              <TableCell className="ps-4 sm:ps-5">
                <p className="font-medium">{label}</p>
                {base?.unit && <p className="text-[11px] text-muted-foreground">{base.unit}</p>}
              </TableCell>

              {showCounted && (
                <TableCell className={NUM}>
                  {!prev || prev.counted == null ? (
                    <span className="inline-flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                      <CircleDashed className="h-3.5 w-3.5" />
                      {t("prevNotCounted")}
                    </span>
                  ) : (
                    <>
                      <p className="font-semibold">{fmtQty(prev.counted)}</p>
                      <p
                        className={cn(
                          "text-[11px]",
                          isShort ? "font-medium text-rose-700 dark:text-rose-400" : "text-muted-foreground"
                        )}
                      >
                        {isShort ? t("prevShort", { by: fmtQty(Math.abs(prev.variance!)) }) : t("prevMet")}
                      </p>
                    </>
                  )}
                </TableCell>
              )}

              {/* The source days — a day far out of line is how a manager spots bad data. */}
              {showSources &&
                sourceDates.map((d, i) => {
                  const v = base?.values?.[i];
                  return (
                    <TableCell key={d} className={cn(NUM, "text-muted-foreground")}>
                      {v == null ? <MissingValue reason={t("noSalesThatDay")} /> : fmtQty(v)}
                    </TableCell>
                  );
                })}
              {showSources && (
                <TableCell className={NUM}>{base?.average != null ? fmtQty(base.average) : <MissingValue />}</TableCell>
              )}

              <TableCell className={NUM}>
                {baseValue != null ? fmtQty(baseValue) : <MissingValue />}
                {!frozen && base && base.divisor > 1 && (
                  <span className="ms-1 text-[10px] font-normal text-muted-foreground">{t("divisor", { divisor: base.divisor })}</span>
                )}
              </TableCell>

              <TableCell className={NUM}>
                {frozen ? (
                  line?.buffer_pct != null ? `+${fmtQty(line.buffer_pct)}%` : <MissingValue />
                ) : (
                  <div className="flex flex-col items-end">
                    <StepperInput
                      value={buffer}
                      onChange={(v) => onBuffer(k, v)}
                      min={0}
                      max={maxPct}
                      invalid={!!bufferError}
                      label={t("bufferFor", { ingredient: label })}
                      suffix="%"
                    />
                    {bufferError && buffer !== "" && <p className="mt-1 text-[10px] text-destructive">{bufferError}</p>}
                  </div>
                )}
              </TableCell>

              <TableCell className={cn(NUM, "bg-muted/20", !showMakeUp && "pe-4 sm:pe-5")}>
                <span className="font-heading text-xl font-semibold leading-none">
                  {planned != null ? fmtQty(planned) : <MissingValue />}
                </span>
                {baseValue != null && planned != null && bufferShown != null && (
                  <p className="mt-1 whitespace-nowrap text-[10px] font-normal text-muted-foreground">
                    {t("calcShort", { base: fmtQty(baseValue), buffer: fmtQty(bufferShown) })}
                  </p>
                )}
              </TableCell>

              {showMakeUp && (
                <>
                  <TableCell className={cn(NUM, makeUp > 0 ? "font-medium text-rose-700 dark:text-rose-400" : "text-muted-foreground")}>
                    {makeUp > 0 ? `+${fmtQty(makeUp)}` : "—"}
                  </TableCell>
                  <TableCell className={cn(NUM, "pe-4 sm:pe-5")}>
                    <span className="font-heading text-xl font-semibold leading-none">
                      {planned != null ? fmtQty(round4(planned + makeUp)) : <MissingValue />}
                    </span>
                  </TableCell>
                </>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function UnmappedCard({ items, onAddRecipe }: { items: UnmappedItem[]; onAddRecipe?: (item: UnmappedItem) => void }) {
  const t = useTranslations("doughSauce.daily");
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(() => [...items].sort((a, b) => b.quantity - a.quantity), [items]);
  const visible = showAll ? sorted : sorted.slice(0, UNMAPPED_PREVIEW);
  const total = items.reduce((a, i) => a + i.quantity, 0);

  return (
    <Card className="border-amber-500/40">
      <CardContent className="space-y-3 p-4">
        <div className="space-y-1">
          <p className="flex items-center gap-2 font-heading text-base font-semibold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            {t("unmappedTitle", { count: items.length, units: fmtQty(total) })}
          </p>
          <p className="text-xs text-muted-foreground">{t("unmappedDescription")}</p>
        </div>
        <ul className="divide-y rounded-md border bg-background">
          {visible.map((item) => (
            <li key={item.item_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {item.item_id} · {item.account}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">{t("unmappedQty", { qty: fmtQty(item.quantity) })}</span>
                {onAddRecipe && (
                  <Button size="sm" variant="outline" onClick={() => onAddRecipe(item)}>
                    <Plus className="me-1 h-3.5 w-3.5" />
                    {t("addRecipe")}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
        {sorted.length > UNMAPPED_PREVIEW && (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAll((s) => !s)}>
            <ChevronDown className={cn("me-1 h-4 w-4 transition-transform", showAll && "rotate-180")} />
            {showAll ? t("showLess") : t("showAll", { count: sorted.length })}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Plan card header. Everything but the status is known the moment a store and date are picked. */
function PlanCardHeader({
  relative,
  title,
  store,
  status,
}: {
  relative: string | null;
  title: string;
  store: StoreOption | null;
  status: React.ReactNode;
}) {
  const t = useTranslations("doughSauce.daily");
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t("planFor")}</span>
          {relative && (
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
              {relative}
            </span>
          )}
        </div>
        <h3 className="mt-1 font-heading text-2xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Store className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{store?.name}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums">{store?.code}</span>
        </p>
      </div>
      {status}
    </div>
  );
}

/** Source-day columns the loaded table shows (the base looks back over four same weekdays). */
const SKELETON_SOURCE_COLS = 4;

/** One line of text's worth of height with a bar in it, so a skeleton row is as tall as the real one. */
function Bar({ line, bar, className }: { line: string; bar: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-end", line, className)}>
      <Skeleton className={bar} />
    </div>
  );
}

/**
 * The loading state IS the layout: the header, the group labels, the column titles and the
 * ingredient names are real — they're known before any request returns — and only what
 * the server fills in is a bar. It draws the editable layout (the widest one); a confirmed
 * plan drops the source-day columns once it lands.
 */
function DailySkeleton({
  relative,
  title,
  store,
  prevLabel,
  labelOf,
}: {
  relative: string | null;
  title: string;
  store: StoreOption | null;
  prevLabel: string;
  labelOf: (k: IngredientKey) => string;
}) {
  const t = useTranslations("doughSauce.daily");
  const tc = useTranslations("doughSauce.common");
  const sources = Array.from({ length: SKELETON_SOURCE_COLS }, (_, i) => i);

  return (
    <div className="flex flex-col gap-4" role="status" aria-busy="true">
      <span className="sr-only">{tc("loading")}</span>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <PlanCardHeader
            relative={relative}
            title={title}
            store={store}
            status={
              <div className="flex flex-col items-end gap-1">
                <Skeleton className="h-7 w-44 rounded-full" />
                <Skeleton className="h-2.5 w-24" />
              </div>
            }
          />

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead colSpan={2} className={cn(GROUP, "ps-4 sm:ps-5")}>
                  {t("groupCheck")}
                </TableHead>
                <TableHead colSpan={SKELETON_SOURCE_COLS + 1} className={cn(GROUP, "border-s")}>
                  <Skeleton className="mx-auto h-2.5 w-44" />
                </TableHead>
                <TableHead colSpan={3} className={cn(GROUP, "border-s text-center")}>
                  {t("groupPlan")}
                </TableHead>
              </TableRow>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className={cn(HEAD, "ps-4 sm:ps-5")}>{t("colIngredient")}</TableHead>
                <TableHead className={cn(NUM, HEAD)}>{t("colCounted", { date: prevLabel })}</TableHead>
                {sources.map((i) => (
                  <TableHead key={i} className={NUM}>
                    <Skeleton className="ms-auto h-3 w-14" />
                  </TableHead>
                ))}
                <TableHead className={cn(NUM, HEAD)}>
                  <HeadHint hint={t("hintAverage")}>{t("colAverage")}</HeadHint>
                </TableHead>
                <TableHead className={cn(NUM, HEAD)}>
                  <HeadHint hint={t("hintBase")}>{t("colBase")}</HeadHint>
                </TableHead>
                <TableHead className={cn(NUM, HEAD)}>
                  <HeadHint hint={t("hintBuffer")}>{t("colBuffer")}</HeadHint>
                </TableHead>
                <TableHead className={cn(NUM, HEAD, "pe-4 sm:pe-5")}>
                  <HeadHint hint={t("hintPlanned")}>{t("colPlanned")}</HeadHint>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROW_ORDER.map((k) => (
                <TableRow key={k} className="hover:bg-transparent">
                  <TableCell className="ps-4 sm:ps-5">
                    <p className="font-medium">{labelOf(k)}</p>
                    <Bar line="h-4" bar="h-2.5 w-14" className="justify-start" />
                  </TableCell>
                  <TableCell className={NUM}>
                    <Bar line="h-5" bar="h-3.5 w-8" />
                    <Bar line="h-4" bar="h-2.5 w-14" />
                  </TableCell>
                  {sources.map((i) => (
                    <TableCell key={i} className={NUM}>
                      <Bar line="h-5" bar="h-3.5 w-9" />
                    </TableCell>
                  ))}
                  <TableCell className={NUM}>
                    <Bar line="h-5" bar="h-3.5 w-10" />
                  </TableCell>
                  <TableCell className={NUM}>
                    <Bar line="h-5" bar="h-3.5 w-12" />
                  </TableCell>
                  <TableCell className={NUM}>
                    <Skeleton className="ms-auto h-9 w-32" />
                  </TableCell>
                  <TableCell className={cn(NUM, "bg-muted/20 pe-4 sm:pe-5")}>
                    <Bar line="h-5" bar="h-5 w-14" />
                    <Bar line="mt-1 h-3.5" bar="h-2.5 w-20" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className={PLAN_FOOT}>
            <span className="inline-flex items-center gap-1.5">
              <Skeleton className="h-3.5 w-3.5" />
              <Skeleton className="h-3 w-56" />
            </span>
          </div>
        </CardContent>
      </Card>

      <div className={CONFIRM_BAR}>
        <Skeleton className="me-auto h-3 w-64 max-w-full" />
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}
