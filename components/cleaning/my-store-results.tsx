"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Award,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Clock,
  FileText,
  Image as ImageIcon,
  SprayCan,
  Store,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ValueBadge, ScoreText, PhotoThumbs } from "./cleaning-ui";
import { PeriodPicker } from "./period-picker";
import { useCleaningEvaluation, useEffectiveStoreId } from "@/lib/hooks/use-cleaning";
import type { ChartCell, ItemCell } from "@/types/cleaning.types";

interface DetailTarget {
  label: string;
  note: string | null;
  photos: string[];
}

const EMPTY_ITEM_CELL: ItemCell = { value: "empty", weight: 1, note: null, photos: [] };

/** True once a cell carries a note and/or at least one photo. */
function isAnnotated(cell: { note: string | null; photos: string[] }): boolean {
  return Boolean(cell.note?.trim()) || cell.photos.length > 0;
}

/** Threshold-coloured progress fill — same bands as ScoreText's passOnly tone. */
function scoreFillTone(pct: number): string {
  if (pct >= 80) return "bg-green-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

/** Score tile for the header strip — a number plus a fill bar so the score's
 * quality reads at a glance, not just as text. Same shape for Item/Chart/Final
 * Score. `pct: null` (final score only — migration guide §15: nothing
 * scoreable yet, NOT a zero) renders a dash and an empty bar instead of
 * treating null as 0. */
function ScoreTile({
  icon: Icon,
  label,
  pct,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  pct: number | null;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {pct == null ? (
            <span className="text-xl font-semibold tabular-nums text-muted-foreground/40">
              --
            </span>
          ) : (
            <ScoreText pct={pct} variant="passOnly" className="text-xl" />
          )}
          {hint && (
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{hint}</p>
          )}
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            pct == null ? "bg-transparent" : scoreFillTone(pct)
          )}
          style={{ width: `${pct == null ? 0 : Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

/** Per-frequency icon (no color) so the four chart groups are still visually
 * distinguishable at a glance without adding accent color. */
const GROUP_ACCENT: Record<"daily" | "weekly" | "monthly" | "hourly", { icon: React.ElementType }> = {
  daily: { icon: CalendarDays },
  weekly: { icon: CalendarRange },
  monthly: { icon: CalendarClock },
  hourly: { icon: Clock },
};

/** Section label used above both the Inspection Items list and the Cleaning Chart grid. */
function SectionHeading({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
    </div>
  );
}

/** Tiny "has note" / "has N photos" clarification chips shown under an item's name. */
function AnnotationHints({
  note,
  photos,
  t,
}: {
  note: string | null;
  photos: string[];
  t: ReturnType<typeof useTranslations>;
}) {
  if (!note?.trim() && photos.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
      {note?.trim() && (
        <span className="inline-flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {t("hasNote")}
        </span>
      )}
      {photos.length > 0 && (
        <span className="inline-flex items-center gap-1">
          <ImageIcon className="h-3 w-3" />
          {photos.length === 1
            ? t("hasPhoto", { count: photos.length })
            : t("hasPhotoPlural", { count: photos.length })}
        </span>
      )}
    </div>
  );
}

/**
 * Read-only evaluation results for the logged-in store manager's own store —
 * the same grid data the Evaluation tab edits, with no editing controls and
 * no Finalize. The backend also enforces the store scope; filtering to the
 * effective store here is presentation only.
 */
export function MyStoreResults() {
  const t = useTranslations("cleaningChart.myStore");
  const storeId = useEffectiveStoreId();
  const { grid, gridLoading, gridError, periodType, periodKey, fetchGrid } =
    useCleaningEvaluation();
  const [detail, setDetail] = useState<DetailTarget | null>(null);

  const row = useMemo(
    () => grid?.rows.find((r) => r.storeId === storeId) ?? null,
    [grid, storeId]
  );

  const chartGroups: { key: "daily" | "weekly" | "monthly" | "hourly"; label: string }[] = [
    { key: "daily", label: t("chartGroups.daily") },
    { key: "weekly", label: t("chartGroups.weekly") },
    { key: "monthly", label: t("chartGroups.monthly") },
    { key: "hourly", label: t("chartGroups.hourly") },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PeriodPicker periodType={periodType} periodKey={periodKey} onChange={fetchGrid} />

      {gridLoading && !grid && (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("loading")}</p>
      )}

      {gridError && !grid && (
        <p className="py-10 text-center text-sm text-destructive">{gridError.message}</p>
      )}

      {grid && !row && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <Store className="h-8 w-8 text-muted-foreground" />
          <p className="max-w-sm text-sm text-muted-foreground">{t("noRow")}</p>
        </div>
      )}

      {row && (
        <div className="space-y-6">
          {/* Hero score strip */}
          <div className="grid gap-3 sm:grid-cols-3">
            <ScoreTile icon={ClipboardList} label={t("itemScore")} pct={row.itemScore} />
            <ScoreTile icon={SprayCan} label={t("chartScoreLabel")} pct={row.chartScore} />
            <ScoreTile
              icon={Award}
              label={t("finalScoreLabel")}
              pct={row.finalScore}
              hint={
                row.finalScore != null && row.scoreSides.length === 1
                  ? t(`scoreSide.${row.scoreSides[0]}`)
                  : undefined
              }
            />
          </div>

          {/* Inspection items — same table shell as the Due Today list */}
          <section>
            <SectionHeading icon={ClipboardList} title={t("inspectionItems")} />
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("itemColumn")}</TableHead>
                    <TableHead className="text-end">{t("resultColumn")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grid!.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                        {t("noItems")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    grid!.items.map((item) => {
                      const cell = row.itemValues[item.name] ?? EMPTY_ITEM_CELL;
                      const annotated = isAnnotated(cell);
                      return (
                        <TableRow
                          key={item.id}
                          role={annotated ? "button" : undefined}
                          tabIndex={annotated ? 0 : undefined}
                          onClick={
                            annotated
                              ? () =>
                                  setDetail({
                                    label: item.name,
                                    note: cell.note,
                                    photos: cell.photos,
                                  })
                              : undefined
                          }
                          onKeyDown={
                            annotated
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setDetail({ label: item.name, note: cell.note, photos: cell.photos });
                                  }
                                }
                              : undefined
                          }
                          className={cn(annotated && "cursor-pointer")}
                        >
                          <TableCell className="max-w-[280px]">
                            <p className="truncate font-medium">{item.name}</p>
                            <AnnotationHints note={cell.note} photos={cell.photos} t={t} />
                          </TableCell>
                          <TableCell className="text-end">
                            <ValueBadge value={cell.value} />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* Cleaning chart */}
          <section>
            <SectionHeading icon={SprayCan} title={t("cleaningChart")} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {chartGroups.map((g) => {
                const cells = row.chart[g.key] as ChartCell[];
                const accent = GROUP_ACCENT[g.key];
                return (
                  <div key={g.key} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <accent.icon className="h-3.5 w-3.5" />
                      </span>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.label}
                      </p>
                    </div>
                    {cells.length === 0 ? (
                      <p className="text-xs text-muted-foreground/60">—</p>
                    ) : (
                      <ul className="space-y-2.5">
                        {cells.map((cell) => {
                          const annotated = isAnnotated(cell);
                          return (
                            <li key={cell.taskId} className="space-y-1">
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="truncate text-foreground">{cell.name}</span>
                                <span
                                  className={cn(
                                    "shrink-0 font-semibold uppercase tracking-wide",
                                    cell.verdict === "pass"
                                      ? "text-green-600 dark:text-green-400"
                                      : cell.verdict === "fail"
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-muted-foreground/60"
                                  )}
                                >
                                  {cell.verdict ? t(`verdict.${cell.verdict}`) : "—"}
                                </span>
                              </div>
                              {annotated && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDetail({
                                      label: cell.name,
                                      note: cell.note,
                                      photos: cell.photos,
                                    })
                                  }
                                  className="flex items-center gap-2.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                                >
                                  {cell.note?.trim() && (
                                    <span className="inline-flex items-center gap-1">
                                      <FileText className="h-3 w-3" />
                                      {t("hasNote")}
                                    </span>
                                  )}
                                  {cell.photos.length > 0 && (
                                    <span className="inline-flex items-center gap-1">
                                      <ImageIcon className="h-3 w-3" />
                                      {cell.photos.length === 1
                                        ? t("hasPhoto", { count: cell.photos.length })
                                        : t("hasPhotoPlural", { count: cell.photos.length })}
                                    </span>
                                  )}
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* Read-only detail — full note + a real preview (thumbnails → lightbox) */}
      <Dialog open={detail != null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{detail?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {detail?.note?.trim() && (
              <blockquote className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm italic text-foreground">
                “{detail.note}”
              </blockquote>
            )}
            {detail && detail.photos.length > 0 && <PhotoThumbs photos={detail.photos} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
