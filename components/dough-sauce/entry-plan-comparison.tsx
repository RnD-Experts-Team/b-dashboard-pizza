"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ClipboardCheck, Equal, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DoughSauceError, doughSauceService } from "@/lib/api/services/dough-sauce.service";
import { useIngredients } from "@/lib/hooks/use-dough-sauce";
import { addDaysIso } from "@/lib/dough-sauce/dates";
import { buildEntryComparison, entryHasPlanItems, targetsFor, type ComparisonRow } from "@/lib/dough-sauce/entry-comparison";
import type { DailyPlanBase, Plan } from "@/types/dough-sauce.types";
import type { EntryItem } from "@/types/inventory.types";
import { fmtGap, fmtQty, fmtSignedGap, useDayFormatter, useIngredientLabel } from "./ds-ui";

interface EntryPlanComparisonProps {
  /** Store text key, e.g. "03795-00001" — the entry's `store.store_number`. */
  storeKey: string | undefined;
  /** The entry's date — the count taken that night is judged against the base of the NEXT day. */
  date: string;
  items: EntryItem[];
}

type CompareState =
  | { status: "loading" }
  | { status: "ready"; plan: Plan | null; base: DailyPlanBase | null; baseError: DoughSauceError | null }
  | { status: "error"; error: DoughSauceError };

const isAbort = (e: unknown) =>
  (e as { name?: string })?.name === "CanceledError" || (e as { name?: string })?.name === "AbortError";

const asError = (err: unknown) =>
  err instanceof DoughSauceError ? err : new DoughSauceError(String((err as Error)?.message ?? err), "UNKNOWN", "audit");

/**
 * Submitted count vs. the BASE it feeds, for the three dough & sauce items — the same check the Daily plan makes:
 * the inventory taken on the night of the 12th is what has to meet the 13th's base (before the buffer, no morning
 * count), and "short by / over by" is shown in whole steps, rounded down. Sits above the entry's item table.
 * Deliberately plain — one table, no color coding: the words and signs carry the meaning. Renders nothing when the
 * entry has none of those items, or when the viewer can't see the data; it is an aid to the reader, never in the way.
 */
export function EntryPlanComparison({ storeKey, date, items }: EntryPlanComparisonProps) {
  const t = useTranslations("doughSauce.entryCompare");
  const day = useDayFormatter();
  const { ingredients, map, loaded } = useIngredients();
  const labelOf = useIngredientLabel(ingredients);
  const relevant = loaded && entryHasPlanItems(items, map);
  const [state, setState] = useState<CompareState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  // The day this count feeds.
  const target = addDaysIso(date, 1);

  useEffect(() => {
    if (!relevant || !storeKey) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    // The base comes from the data service; a plan confirmed for that day (if any) supplies its own base line.
    Promise.allSettled([
      doughSauceService.getPlan(storeKey, target, controller.signal),
      doughSauceService.getDailyPlanBase(storeKey, target, {}, controller.signal),
    ]).then(([plan, base]) => {
      if (controller.signal.aborted) return;
      if ([plan, base].some((r) => r.status === "rejected" && isAbort(r.reason))) return;
      // No plan for that day is the normal case (not confirmed yet): the base alone is enough.
      const planValue = plan.status === "fulfilled" ? plan.value : null;
      if (base.status === "fulfilled") {
        setState({ status: "ready", plan: planValue, base: base.value, baseError: null });
      } else if (planValue?.confirmed) {
        setState({ status: "ready", plan: planValue, base: null, baseError: asError(base.reason) });
      } else {
        setState({ status: "error", error: asError(base.reason) });
      }
    });
    return () => controller.abort();
  }, [relevant, storeKey, target, reloadKey]);

  const comparison = useMemo(() => {
    if (state.status !== "ready") return null;
    const targets = targetsFor(state.plan, state.base);
    return Object.keys(targets).length > 0 ? buildEntryComparison(targets, items, map) : null;
  }, [state, items, map]);

  if (!relevant || !storeKey) return null;
  // No access to the base — the reader simply doesn't get this aid.
  if (state.status === "error" && state.error.code === "FORBIDDEN") return null;

  const compared = comparison?.rows.filter((r) => r.kind === "compared").length ?? 0;

  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-label={t("title")}>
      <header className="flex items-start gap-2.5 px-4 py-3">
        <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <h3 className="font-heading text-sm font-semibold leading-tight">{t("title")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("subtitle", { date: day.long(target) })}</p>
        </div>
      </header>

      {state.status === "loading" ? (
        <div className="space-y-2 border-t p-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : state.status === "error" ? (
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" />
            {t("loadFailed", { message: state.error.message })}
          </span>
          {state.error.retryable && (
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="shrink-0 text-xs font-medium text-foreground underline underline-offset-2"
            >
              {t("retry")}
            </button>
          )}
        </div>
      ) : !comparison ? (
        <p className="flex items-center gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
          <Info className="h-4 w-4 shrink-0" />
          {t("noBase", { date: day.long(target) })}
        </p>
      ) : (
        <>
          {compared > 0 && (
            <p className="border-t px-4 py-2.5 text-sm font-medium">
              {comparison.short.length > 0
                ? t("summaryUnder", { n: comparison.short.length })
                : t("summaryOk")}
            </p>
          )}

          <div className="overflow-x-auto border-t">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-start font-medium">{t("colItem")}</th>
                  <th className="px-4 py-2 text-end font-medium">{t("colBase")}</th>
                  <th className="px-4 py-2 text-end font-medium">{t("colCounted")}</th>
                  <th className="px-4 py-2 text-end font-medium">{t("colDifference")}</th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <Row key={row.key} row={row} label={labelOf(row.key)} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">{t("footnote")}</p>
        </>
      )}
    </section>
  );
}

function Row({ row, label }: { row: ComparisonRow; label: string }) {
  const t = useTranslations("doughSauce.entryCompare");

  if (row.kind === "not-counted") {
    return (
      <tr className="border-t">
        <td className="px-4 py-3 align-top font-medium">{label}</td>
        <td className="px-4 py-3 text-end align-top tabular-nums">{fmtQty(row.target)}</td>
        <td className="px-4 py-3 text-end align-top text-muted-foreground" colSpan={2}>
          {t("notInEntry")}
        </td>
      </tr>
    );
  }

  const StatusIcon = row.short ? ArrowDown : row.over ? ArrowUp : Equal;

  return (
    <tr className="border-t">
      <td className="px-4 py-3 align-top">
        <p className={cn("leading-tight", row.short ? "font-semibold" : "font-medium")}>{row.name}</p>
        {row.unit && <p className="mt-0.5 text-xs text-muted-foreground">{row.unit}</p>}
      </td>
      <td className="px-4 py-3 text-end align-top font-medium tabular-nums">{fmtQty(row.target)}</td>
      <td className="px-4 py-3 text-end align-top tabular-nums">
        <p className="font-medium">{fmtQty(row.counted)}</p>
        {row.divisor > 1 && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("converted", { raw: fmtQty(row.rawCounted), divisor: fmtQty(row.divisor) })}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-end align-top tabular-nums">
        <p className={cn("inline-flex items-center gap-1", row.short ? "font-semibold" : "font-medium")}>
          <StatusIcon className="h-3.5 w-3.5" aria-hidden />
          {fmtSignedGap(row.key, row.variance)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {row.short
            ? t("statusShort", { by: fmtGap(row.key, row.variance) })
            : row.over
              ? t("statusOver", { by: fmtGap(row.key, row.variance) })
              : t("statusMet")}
        </p>
      </td>
    </tr>
  );
}
