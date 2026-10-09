"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, Check, Clock, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WeekCell, WeekCells } from "@/lib/dough-sauce/week-cells";
import { todayIso } from "@/lib/dough-sauce/dates";
import type { Ingredient } from "@/types/dough-sauce.types";
import { INGREDIENT_KEYS } from "@/types/dough-sauce.types";
import { fmtGlanceQty, fmtQty, fmtSignedGlanceQty, useDayFormatter, useIngredientLabel } from "./ds-ui";

// Two accents only, both meaning "act on this": rose for short, amber for never counted.
// On target is the normal state, so it stays in neutral ink.
const OK_TEXT = "text-muted-foreground";
const SHORT_TEXT = "text-rose-600 dark:text-rose-400";
const WARN_TEXT = "text-amber-600 dark:text-amber-400";

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
              const ok = row.filter((c) => c.kind === "counted" && c.ok).length;
              const planned = row.filter((c) => c.kind !== "no-plan").length;
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
        {kinds.has("no-plan") && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 text-center">{"–"}</span> {t("noPlan")}
          </span>
        )}
        {kinds.has("unavailable") && (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[10px] font-semibold">{t("na")}</span> {t("legendUnavailable")}
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

function Cell({ cell }: { cell: WeekCell }) {
  const t = useTranslations("doughSauce.weekly.cells");

  switch (cell.kind) {
    case "counted": {
      return (
        <div
          className={STACK}
          title={t("countedTitle", { counted: fmtQty(cell.counted), planned: fmtQty(cell.planned) })}
        >
          <span className={cn("inline-flex items-center gap-1 text-sm font-semibold", !cell.ok && SHORT_TEXT)}>
            {cell.ok ? (
              <Check className={cn("h-3 w-3", OK_TEXT)} strokeWidth={2.5} />
            ) : (
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            )}
            {fmtGlanceQty(cell.counted)}
            {cell.edited && <Pencil className="h-2.5 w-2.5 opacity-70" aria-label={t("legendEdited")} />}
            {cell.duplicates > 0 && (
              <span className="text-[10px] font-normal text-muted-foreground" title={t("duplicates", { n: cell.duplicates })}>
                {"×"}
                {cell.duplicates + 1}
              </span>
            )}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {t("plan", { n: fmtGlanceQty(cell.planned) })}
            <span className={cn("ms-1.5", !cell.ok && cn("font-medium", SHORT_TEXT))}>{fmtSignedGlanceQty(cell.variance)}</span>
          </span>
        </div>
      );
    }
    case "missing":
      return (
        <div className={STACK} title={t("neverCounted")}>
          <span className="inline-flex items-center gap-1 text-xs font-medium">
            <AlertTriangle className={cn("h-3 w-3", WARN_TEXT)} />
            {t("notCounted")}
          </span>
          <span className="text-[11px] text-muted-foreground">{t("plan", { n: fmtGlanceQty(cell.planned) })}</span>
        </div>
      );
    case "awaiting":
      return (
        <div className={STACK} title={t("awaiting")}>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {t("plan", { n: fmtGlanceQty(cell.planned) })}
          </span>
        </div>
      );
    case "no-plan":
      return cell.counted != null ? (
        <div className={STACK} title={t("noPlan")}>
          <span className="text-sm font-semibold">{fmtGlanceQty(cell.counted)}</span>
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
        <div className={STACK} title={t("unavailable")}>
          <span className="text-xs font-semibold text-muted-foreground">{t("na")}</span>
          {cell.planned != null && (
            <span className="text-[11px] text-muted-foreground/70">{t("plan", { n: fmtGlanceQty(cell.planned) })}</span>
          )}
        </div>
      );
  }
}
