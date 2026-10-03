"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ClipboardCheck, Equal, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DoughSauceError, doughSauceService } from "@/lib/api/services/dough-sauce.service";
import { useIngredients } from "@/lib/hooks/use-dough-sauce";
import { buildEntryComparison, entryHasPlanItems, type ComparisonRow } from "@/lib/dough-sauce/entry-comparison";
import type { Plan } from "@/types/dough-sauce.types";
import type { EntryItem } from "@/types/inventory.types";
import { fmtPct, fmtQty, fmtSignedQty, useDayFormatter, useIngredientLabel } from "./ds-ui";

interface EntryPlanComparisonProps {
  /** Store text key, e.g. "03795-00001" — the entry's `store.store_number`. */
  storeKey: string | undefined;
  /** The entry's date — the plan for THIS day is what the count is measured against. */
  date: string;
  items: EntryItem[];
}

type PlanState =
  | { status: "loading" }
  | { status: "ready"; plan: Plan }
  | { status: "error"; error: DoughSauceError };

const isAbort = (e: unknown) =>
  (e as { name?: string })?.name === "CanceledError" || (e as { name?: string })?.name === "AbortError";

/**
 * Submitted count vs. the plan the store confirmed for that day, for the three
 * dough & sauce items. Sits above the entry's item table. Deliberately plain —
 * one table, no color coding: the words and signs carry the meaning. Renders
 * nothing when the entry has none of those items, or when the viewer can't see
 * the plan; it is an aid to the reader, never something in the way.
 */
export function EntryPlanComparison({ storeKey, date, items }: EntryPlanComparisonProps) {
  const t = useTranslations("doughSauce.entryCompare");
  const day = useDayFormatter();
  const { ingredients, map, loaded } = useIngredients();
  const labelOf = useIngredientLabel(ingredients);
  const relevant = loaded && entryHasPlanItems(items, map);
  const [state, setState] = useState<PlanState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!relevant || !storeKey) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    doughSauceService
      .getPlan(storeKey, date, controller.signal)
      .then((plan) => setState({ status: "ready", plan }))
      .catch((err) => {
        if (isAbort(err) || controller.signal.aborted) return;
        setState({
          status: "error",
          error: err instanceof DoughSauceError ? err : new DoughSauceError(String(err?.message ?? err), "UNKNOWN", "audit"),
        });
      });
    return () => controller.abort();
  }, [relevant, storeKey, date, reloadKey]);

  const comparison = useMemo(
    () => (state.status === "ready" && state.plan.confirmed ? buildEntryComparison(state.plan, items, map) : null),
    [state, items, map]
  );

  if (!relevant || !storeKey) return null;
  // No access to the Audit plan — the reader simply doesn't get this aid.
  if (state.status === "error" && state.error.code === "FORBIDDEN") return null;

  const compared = comparison?.rows.filter((r) => r.kind === "compared").length ?? 0;

  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-label={t("title")}>
      <header className="flex items-start gap-2.5 px-4 py-3">
        <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <h3 className="font-heading text-sm font-semibold leading-tight">{t("title")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("subtitle", { date: day.long(date) })}</p>
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
            {state.error.code === "NOT_FOUND"
              ? t("noPlan", { date: day.long(date) })
              : t("loadFailed", { message: state.error.message })}
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
          {t("notConfirmed", { date: day.long(date) })}
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
                  <th className="px-4 py-2 text-end font-medium">{t("colPlanned")}</th>
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
        <td className="px-4 py-3 text-end align-top tabular-nums">{fmtQty(row.planned)}</td>
        <td className="px-4 py-3 text-end align-top text-muted-foreground" colSpan={2}>
          {t("notInEntry")}
        </td>
      </tr>
    );
  }

  const under = !row.ok;
  const met = row.ok && row.variance === 0;
  const StatusIcon = under ? ArrowDown : met ? Equal : ArrowUp;

  return (
    <tr className="border-t">
      <td className="px-4 py-3 align-top">
        <p className={cn("leading-tight", under ? "font-semibold" : "font-medium")}>{row.name}</p>
        {row.unit && <p className="mt-0.5 text-xs text-muted-foreground">{row.unit}</p>}
      </td>
      <td className="px-4 py-3 text-end align-top tabular-nums">
        <p className="font-medium">{fmtQty(row.planned)}</p>
        {row.base != null && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("baseBuffer", { base: fmtQty(row.base), buffer: fmtPct(row.bufferPct / 100) })}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-end align-top font-medium tabular-nums">{fmtQty(row.counted)}</td>
      <td className="px-4 py-3 text-end align-top tabular-nums">
        <p className={cn("inline-flex items-center gap-1", under ? "font-semibold" : "font-medium")}>
          <StatusIcon className="h-3.5 w-3.5" aria-hidden />
          {fmtSignedQty(row.variance)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {under ? t("statusUnder") : met ? t("statusMet") : t("statusOver")}
        </p>
      </td>
    </tr>
  );
}
