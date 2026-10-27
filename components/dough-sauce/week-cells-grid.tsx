"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, Check, Clock, Moon, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WeekCell, WeekCells } from "@/lib/dough-sauce/week-cells";
import { baseQty } from "@/lib/dough-sauce/formulas";
import { todayIso } from "@/lib/dough-sauce/dates";
import type { Ingredient, IngredientKey } from "@/types/dough-sauce.types";
import { INGREDIENT_KEYS } from "@/types/dough-sauce.types";
import {
  fmtGlanceQty,
  fmtQty,
  fmtSignedGap,
  round2,
  useDayFormatter,
  useIngredientLabel,
} from "./ds-ui";

// Two accents only, both meaning "act on this": rose for short, amber for never counted.
// On target is the normal state, so it stays in neutral ink.
const OK_TEXT = "text-muted-foreground";
const SHORT_TEXT = "text-rose-600 dark:text-rose-400";
const WARN_TEXT = "text-amber-600 dark:text-amber-400";
/** Dotted underline = "hover for the original count" (a count converted to the base's unit). */
const CONVERTED = "cursor-help underline decoration-muted-foreground/40 decoration-dotted underline-offset-4";
/** The dashed edge the full report gives a day with no confirmed plan: checked against its base, scored like any other. */
const UNCONFIRMED_EDGE = "rounded-md border border-dashed border-muted-foreground/40";

/** A day with no confirmed plan whose night-before count could still be checked against that day's base. */
type CheckedNoPlan = Extract<WeekCell, { kind: "no-plan" }> & {
  counted: number;
  base: number;
  variance: number;
  ok: boolean;
};
const isCheckedNoPlan = (c: WeekCell): c is CheckedNoPlan =>
  c.kind === "no-plan" && c.counted != null && c.base != null && c.variance != null && c.ok != null;

/**
 * The 7 × 3 variance cells of one store-week. Missing ≠ zero (rule 2); not-yet ≠ missing.
 * A plain table: hairline rows, no tiles. Fine cells are neutral ink with a muted check; only the
 * short and never-counted ones take colour, so they are what you see.
 */
export function WeekCellsGrid({ cells, ingredients }: { cells: WeekCells; ingredients: Ingredient[] | null }) {
  const t = useTranslations("doughSauce.weekly.cells");
  const labelOf = useIngredientLabel(ingredients);
  const day = useDayFormatter();
  const today = todayIso();
  const byId = new Map(cells.cells.map((c) => [`${c.date}|${c.key}`, c]));
  const kinds = new Set(cells.cells.map((c) => c.kind));
  const allUnavailable = cells.cells.length > 0 && cells.cells.every((c) => c.kind === "unavailable");
  // Any stored plan will do: the legend explains the second line using the grid's own numbers.
  const sampleCell = cells.cells.find((c) => "bufferPct" in c && c.bufferPct != null && c.planned != null);
  const legendSample =
    sampleCell && "bufferPct" in sampleCell && sampleCell.planned != null && sampleCell.bufferPct != null
      ? beforeBuffer(sampleCell.planned, sampleCell.bufferPct)
      : null;

  return (
    <div className="space-y-4">
      {allUnavailable && (
        <div className={cn("flex items-start gap-2 border-s-2 border-amber-500/60 ps-3 text-xs", WARN_TEXT)}>
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t("unavailableBanner")}</span>
        </div>
      )}

      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-40 pb-2 pe-2 text-start text-xs font-medium text-muted-foreground">{t("ingredient")}</th>
              {cells.days.map((d) => {
                const isToday = d === today;
                return (
                  <th
                    key={d}
                    className={cn(
                      "px-1 pb-2 pt-1.5 text-center font-normal",
                      isToday && "bg-muted/40 shadow-[inset_0_2px_0_0_var(--foreground)]"
                    )}
                  >
                    <span className="block text-xs font-medium">{day.weekday(d)}</span>
                    <span className="block text-[11px] tabular-nums text-muted-foreground">{day.monthDay(d)}</span>
                    {isToday && <span className="block text-[10px] font-medium text-muted-foreground">{t("today")}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {INGREDIENT_KEYS.map((k) => {
              const row = cells.cells.filter((c) => c.key === k);
              // An unplanned day that was counted and checked against its base scores like a planned one,
              // so it belongs in this row's tally — the same cells the score breakdown beside it counts.
              const checked = row.filter(isCheckedNoPlan);
              const ok = row.filter((c) => c.kind === "counted" && c.ok).length + checked.filter((c) => c.ok).length;
              const planned = row.filter((c) => c.kind !== "no-plan").length + checked.length;
              return (
                <tr key={k} className="border-t">
                  <th scope="row" className="py-2.5 pe-2 text-start font-normal">
                    <span className="block whitespace-nowrap text-sm font-medium">{labelOf(k)}</span>
                    {!allUnavailable && (
                      <span className="block text-[11px] tabular-nums text-muted-foreground">
                        {planned > 0 ? t("onTargetRow", { ok, total: planned }) : t("noPlanShort")}
                      </span>
                    )}
                  </th>
                  {cells.days.map((d) => {
                    const c = byId.get(`${d}|${k}`);
                    return (
                      <td key={d} className={cn("px-1 py-2.5 text-center align-middle", d === today && "bg-muted/40")}>
                        {c ? <Cell cell={c} /> : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend: only the states actually on screen, drawn with the same marks the cells use. */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t pt-3 text-[11px] text-muted-foreground">
        {/* Each plan is scored against the night-before count, so a count appears one column after its date. */}
        {cells.cells.some((c) => c.kind !== "no-plan" && c.kind !== "unavailable") && (
          <span className="inline-flex items-center gap-1.5">
            <Moon className="h-3.5 w-3.5" /> {t("legendCountDay")}
          </span>
        )}
        {kinds.has("counted") && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <Check className={cn("h-3.5 w-3.5", OK_TEXT)} strokeWidth={2.5} />
              {t("legendOk")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <X className={cn("h-3.5 w-3.5", SHORT_TEXT)} strokeWidth={2.5} />
              {t("legendShort")}
            </span>
          </>
        )}
        {kinds.has("missing") && (
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className={cn("h-3.5 w-3.5", WARN_TEXT)} />
            {t("legendMissing")}
          </span>
        )}
        {kinds.has("awaiting") && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> {t("legendAwaiting")}
          </span>
        )}
        {cells.cells.some(isCheckedNoPlan) && (
          <span className="inline-flex items-center gap-1.5">
            <span className={cn("h-3 w-3.5", UNCONFIRMED_EDGE)} /> {t("legendUnconfirmed")}
          </span>
        )}
        {cells.cells.some((c) => c.kind === "no-plan" && !isCheckedNoPlan(c)) && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 text-center">{"–"}</span> {t("noPlan")}
          </span>
        )}
        {kinds.has("unavailable") && (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[10px] font-semibold">{t("na")}</span> {t("legendUnavailable")}
          </span>
        )}
        {/* The small number under the plan, drawn with a real example from this grid. */}
        {legendSample && (
          <span className="inline-flex items-center gap-1.5">
            <span className="whitespace-nowrap rounded border px-1 py-0.5 text-[10px] tabular-nums">{legendSample}</span>
            {t("legendCalc")}
          </span>
        )}
        {cells.cells.some((c) => c.kind === "counted" && c.edited) && (
          <span className="inline-flex items-center gap-1.5">
            <Pencil className="h-3 w-3" /> {t("legendEdited")}
          </span>
        )}
        {cells.cells.some((c) => c.kind === "counted" && c.duplicates > 0) && (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-foreground/70">{"×2"}</span> {t("legendDuplicates")}
          </span>
        )}
      </div>
    </div>
  );
}

const STACK = "flex flex-col items-center gap-1 leading-none tabular-nums";

/**
 * The number before the buffer, from the RAW stored values and rounded only here, for display.
 * It is never taken from the rounded plan (433.675 ÷ 1.10, not 433.68 ÷ 1.10). This is the target
 * a count is judged against (`WeekCell.base`), so the variance shown beside it is the scored one.
 */
function beforeBuffer(planned: number, bufferPct: number): string {
  return fmtQty(round2(baseQty(planned, bufferPct)));
}

/** The number a count is judged against, and — once counted — how far the count is from it (+ over, − short). */
function DiffLine({
  ingredient,
  base,
  variance,
  ok,
}: {
  ingredient: IngredientKey;
  base: string;
  variance?: number;
  ok?: boolean;
}) {
  return (
    <span className="whitespace-nowrap text-[11px] font-normal text-muted-foreground">
      {base}
      {variance != null && (
        <span className={cn("ms-1.5", !ok && cn("font-medium", SHORT_TEXT))}>{fmtSignedGap(ingredient, variance)}</span>
      )}
    </span>
  );
}

/**
 * The scored line of a planned cell: the number before the buffer, and how far the count is from it.
 * Nothing when there is no stored plan.
 */
function BaseLine({
  ingredient,
  planned,
  bufferPct,
  variance,
  ok,
}: {
  ingredient: IngredientKey;
  planned: number;
  bufferPct: number | null;
  variance?: number;
  ok?: boolean;
}) {
  if (bufferPct == null) return null;
  return <DiffLine ingredient={ingredient} base={beforeBuffer(planned, bufferPct)} variance={variance} ok={ok} />;
}

function Cell({ cell }: { cell: WeekCell }) {
  const t = useTranslations("doughSauce.weekly.cells");
  const day = useDayFormatter();

  /** A cell's hover text, with the number before the buffer underneath when there is a stored plan. */
  const titled = (head: string, planned: number | null, bufferPct: number | null) =>
    planned == null || bufferPct == null
      ? head
      : `${head}\n${t("beforeBuffer", { base: beforeBuffer(planned, bufferPct) })}`;

  /** Why a count differs from what inventory recorded — only when it was divided to match the base. */
  const converted = (raw: number | null, divisor: number, result: number | null) =>
    raw != null && result != null && divisor > 1
      ? `\n${t("convertedTitle", { raw: fmtQty(raw), divisor: fmtQty(divisor), result: fmtQty(result) })}`
      : "";

  /** How the on-hand number was made, when a morning count was added to the night count. */
  const withMorning = (
    night: number | null,
    morning: number | null,
    total: number | null,
    rawMorning: number | null,
    morningDivisor: number
  ) =>
    night != null && morning != null && total != null
      ? `\n${t("morningNote", { night: fmtQty(night), morning: fmtQty(morning), counted: fmtQty(total) })}` +
        (morningDivisor > 1 && rawMorning != null
          ? `\n${t("morningConvertedTitle", { raw: fmtQty(rawMorning), divisor: fmtQty(morningDivisor), result: fmtQty(morning) })}`
          : "")
      : "";

  switch (cell.kind) {
    case "counted": {
      return (
        <div
          className={STACK}
          title={
            t("countedTitle", {
              counted: fmtQty(cell.counted),
              on: day.monthDay(cell.countDate),
              base: fmtQty(round2(cell.base)),
              planned: fmtQty(round2(cell.planned)),
            }) +
            converted(cell.rawCounted, cell.divisor, cell.night) +
            withMorning(cell.night, cell.morning, cell.counted, cell.rawMorning, cell.morningDivisor)
          }
        >
          <span className={cn("inline-flex items-center gap-1 text-sm font-semibold", !cell.ok && SHORT_TEXT)}>
            {cell.ok ? (
              <Check className={cn("h-3 w-3", OK_TEXT)} strokeWidth={2.5} />
            ) : (
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            )}
            <span className={cn(cell.divisor > 1 && CONVERTED)}>{fmtGlanceQty(cell.counted)}</span>
            {cell.edited &&<Pencil className="h-2.5 w-2.5 opacity-70" aria-label={t("legendEdited")} />}
            {cell.duplicates > 0 && (
              <span className="text-[10px] font-normal text-muted-foreground" title={t("duplicates", { n: cell.duplicates })}>
                {"×"}
                {cell.duplicates + 1}
              </span>
            )}
          </span>
          <span className="text-[11px] text-muted-foreground">{t("plan", { n: fmtQty(round2(cell.planned)) })}</span>
          <BaseLine ingredient={cell.key} planned={cell.planned} bufferPct={cell.bufferPct} variance={cell.variance} ok={cell.ok} />
        </div>
      );
    }
    case "missing":
      return (
        <div className={STACK} title={titled(t("neverCounted"), cell.planned, cell.bufferPct)}>
          <span className="inline-flex items-center gap-1 text-xs font-medium">
            <AlertTriangle className={cn("h-3 w-3", WARN_TEXT)} />
            {t("notCounted")}
          </span>
          <span className="text-[11px] text-muted-foreground">{t("plan", { n: fmtQty(round2(cell.planned)) })}</span>
          <BaseLine ingredient={cell.key} planned={cell.planned} bufferPct={cell.bufferPct} />
        </div>
      );
    case "awaiting":
      return (
        <div className={STACK} title={titled(t("awaiting"), cell.planned, cell.bufferPct)}>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {t("plan", { n: fmtQty(round2(cell.planned)) })}
          </span>
          <BaseLine ingredient={cell.key} planned={cell.planned} bufferPct={cell.bufferPct} />
        </div>
      );
    case "no-plan":
      // Same reading as a planned day — count, then base ± difference — but inside the dashed edge the
      // report uses, labelled "Not confirmed": there is no buffer to show. It is scored like a planned day.
      if (isCheckedNoPlan(cell)) {
        return (
          <div
            className={cn(STACK, UNCONFIRMED_EDGE, "mx-auto w-fit px-2 py-1.5")}
            title={
              t("unplannedTitle", {
                counted: fmtQty(cell.counted),
                on: day.monthDay(cell.countDate),
                base: fmtQty(round2(cell.base)),
              }) +
              converted(cell.rawCounted, cell.divisor, cell.night) +
              withMorning(cell.night, cell.morning, cell.counted, cell.rawMorning, cell.morningDivisor)
            }
          >
            <span className={cn("inline-flex items-center gap-1 text-sm font-semibold", !cell.ok && SHORT_TEXT)}>
              {cell.ok ? (
                <Check className={cn("h-3 w-3", OK_TEXT)} strokeWidth={2.5} />
              ) : (
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              )}
              <span className={cn(cell.divisor > 1 && CONVERTED)}>{fmtGlanceQty(cell.counted)}</span>
            </span>
            <span className="text-[11px] text-muted-foreground">{t("notConfirmed")}</span>
            <DiffLine ingredient={cell.key} base={fmtQty(round2(cell.base))} variance={cell.variance} ok={cell.ok} />
          </div>
        );
      }
      return cell.counted != null ? (
        <div className={STACK} title={t("noPlan") + converted(cell.rawCounted, cell.divisor, cell.night)}>
          <span className={cn("text-sm font-semibold", cell.divisor > 1 && CONVERTED)}>{fmtGlanceQty(cell.counted)}</span>
          <span className="text-[11px] text-muted-foreground">{t("noPlanShort")}</span>
        </div>
      ) : (
        <span className="text-muted-foreground/60" title={t("noPlan")}>
          {"–"}
          <span className="sr-only">{t("noPlan")}</span>
        </span>
      );
    case "unavailable":
      return (
        <div className={STACK} title={titled(t("unavailable"), cell.planned, cell.bufferPct)}>
          <span className="text-xs font-semibold text-muted-foreground">{t("na")}</span>
          {cell.planned != null && (
            <>
              <span className="text-[11px] text-muted-foreground/70">{t("plan", { n: fmtQty(round2(cell.planned)) })}</span>
              <BaseLine ingredient={cell.key} planned={cell.planned} bufferPct={cell.bufferPct} />
            </>
          )}
        </div>
      );
  }
}
