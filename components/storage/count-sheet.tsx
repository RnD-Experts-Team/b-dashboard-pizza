"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Loader2,
  MinusCircle,
  MoreHorizontal,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { isCancelled } from "@/lib/api/maintenance-tickets-errors";
import { usePartsCatalog } from "@/lib/hooks/use-storage";
import { useStockCount } from "@/lib/hooks/use-stock-count";
import { formatMoney, formatQuantity } from "@/lib/maintenance/money";
import { PART_UNITS, vocabEntry, vocabText } from "@/lib/maintenance/vocabulary";
import { partHint } from "@/lib/storage/stock-forms";
import { partIdOf, type CountLineState, type CountLineView } from "@/lib/storage/stock-count";
import { formatWireDateTime } from "@/lib/utils/date-display";
import { CountStatusBadge, countPlaceLabel } from "./counts-tab";
import { StorageEmptyState, StorageErrorState, StorageSkeleton, TBL, TD, TH } from "./storage-shared";
import type { StockCountLine } from "@/types/maintenance-v2";

/**
 * The count sheet (`/dashboard/storage/counts/[id]`): type what is really on
 * the shelf, part by part (Enter moves down), see the difference as you go,
 * save a draft, then Apply — one Stock count movement corrects every
 * difference. Applied counts are read-only.
 */

const DIFF_STYLE: Record<CountLineState, { icon: typeof Circle; tone: string }> = {
  missing: { icon: MinusCircle, tone: "text-red-600 dark:text-red-400" },
  extra: { icon: PlusCircle, tone: "text-emerald-600 dark:text-emerald-400" },
  match: { icon: CheckCircle2, tone: "text-muted-foreground" },
  not_counted: { icon: Circle, tone: "text-muted-foreground" },
};

function useDiffText() {
  const t = useTranslations("maintenanceV2");
  return (view: CountLineView): string => {
    const amount = formatQuantity(Math.abs(view.difference ?? 0));
    if (view.state === "missing") return t("common.missing", { count: amount });
    if (view.state === "extra") return t("common.extra", { count: amount });
    if (view.state === "match") return t("storage.count.matches");
    return t("storage.count.notCounted");
  };
}

function DiffCell({ view }: { view: CountLineView }) {
  const diffText = useDiffText();
  const { icon: Icon, tone } = DIFF_STYLE[view.state];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap font-medium", tone)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {diffText(view)}
    </span>
  );
}

export function CountSheet({ countId }: { countId: number }) {
  const t = useTranslations("maintenanceV2");
  const locale = useLocale();
  const router = useRouter();
  const sheet = useStockCount(countId);
  const { count, views, totals, corrections, edits, setCounted, hasUnsavedChanges, save, apply, addPart, remove } = sheet;
  const { parts } = usePartsCatalog();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [confirmApply, setConfirmApply] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adding, setAdding] = useState<number | "">("");

  const lines: StockCountLine[] = useMemo(() => count?.lines ?? [], [count]);
  const isDraft = count?.status === "draft";
  const busy = save.isPending || apply.isPending || addPart.isPending || remove.isPending;
  const backHref = `/${locale}/dashboard/storage?tab=counts`;

  // Leaving with typed counts asks first (the browser's own prompt).
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);

  const onSheet = useMemo(() => new Set(lines.map(partIdOf)), [lines]);
  const addOptions = useMemo(
    () => parts.filter((p) => !onSheet.has(p.id)).map((p) => ({ value: p.id, label: p.name, hint: partHint(p) || undefined })),
    [parts, onSheet],
  );

  if (sheet.isLoading && !count) return <StorageSkeleton rows={8} />;
  if (sheet.error && !count) {
    return <StorageErrorState message={sheet.error.message} onRetry={() => void sheet.refresh()} />;
  }
  if (!count) return null;

  const valueOf = (line: StockCountLine): string => {
    const id = partIdOf(line);
    if (Object.prototype.hasOwnProperty.call(edits, id)) return edits[id];
    return line.counted == null ? "" : formatQuantity(line.counted);
  };

  function focusRow(index: number) {
    const el = inputs.current[index];
    if (el) {
      el.focus();
      el.select();
    }
  }

  async function doSave() {
    try {
      await save.run();
      toast.success(t("storage.count.draftSaved"));
    } catch (err) {
      if (!isCancelled(err)) toast.error(err instanceof Error ? err.message : t("common.saveError"));
    }
  }

  async function doApply() {
    try {
      await apply.run();
      setConfirmApply(false);
      toast.success(t("storage.count.applied"));
    } catch (err) {
      if (!isCancelled(err)) toast.error(err instanceof Error ? err.message : t("common.saveError"));
    }
  }

  async function doDelete() {
    try {
      await remove.run();
      toast.success(t("storage.count.deleted"));
      router.push(backHref);
    } catch (err) {
      if (!isCancelled(err)) toast.error(err instanceof Error ? err.message : t("common.saveError"));
    }
  }

  async function doAdd() {
    if (adding === "") return;
    try {
      await addPart.run(adding);
      setAdding("");
      toast.success(t("storage.count.partAdded"));
    } catch (err) {
      if (!isCancelled(err)) toast.error(err instanceof Error ? err.message : t("common.saveError"));
    }
  }

  const title = countPlaceLabel(count) || t("storage.counts.countNumber", { id: count.id });

  return (
    <div className="space-y-6 pb-24">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Link href={backHref}>
            <ArrowLeft className="me-1 h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
            {t("storage.count.back")}
          </Link>
        </Button>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground tabular-nums">{t("storage.counts.countNumber", { id: count.id })}</p>
            <h1 className="font-heading text-2xl font-bold tracking-tight">{title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <CountStatusBadge status={count.status} />
              {count.startedAt && (
                <span className="tabular-nums">
                  {t("storage.count.startedBy", {
                    date: formatWireDateTime(count.startedAt, { dateTimePattern: "MMM d, yyyy h:mm a" }),
                    name: count.creator?.name ?? "—",
                  })}
                </span>
              )}
              {count.appliedAt && (
                <span className="tabular-nums">
                  {t("storage.count.appliedBy", {
                    date: formatWireDateTime(count.appliedAt, { dateTimePattern: "MMM d, yyyy h:mm a" }),
                    name: count.applier?.name ?? "—",
                  })}
                </span>
              )}
            </div>
            {count.notesText && <p className="text-sm">{count.notesText}</p>}
          </div>
          {isDraft && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label={t("storage.count.more")}>
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setConfirmDelete(true)} className="text-destructive focus:text-destructive">
                  <Trash2 className="me-2 h-3.5 w-3.5" aria-hidden="true" />
                  {t("storage.count.deleteDraft")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {isDraft && <p className="text-sm text-muted-foreground">{t("storage.count.help")}</p>}
      </div>

      {lines.length === 0 ? (
        <StorageEmptyState icon={ClipboardCheck} description={t("storage.count.emptySheet")} />
      ) : (
        <div className="overflow-x-auto rounded-md border bg-card">
          <table className={TBL}>
            <thead>
              <tr>
                <th className={TH}>{t("storage.stock.part")}</th>
                <th className={TH}>{t("storage.parts.unit")}</th>
                <th className={cn(TH, "text-end")}>{t("stock.expected")}</th>
                <th className={cn(TH, "text-end")}>{t("stock.counted")}</th>
                <th className={TH}>{t("stock.difference")}</th>
                <th className={cn(TH, "text-end")}>{t("stock.value")}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const view = views[i];
                const name = line.part?.name ?? `#${partIdOf(line)}`;
                const unit = vocabText(t, vocabEntry(PART_UNITS, line.part?.unit ?? "each"));
                return (
                  <tr key={line.id} className={cn(view.state === "not_counted" && isDraft && "bg-muted/20")}>
                    <td className={cn(TD, "align-middle text-sm font-medium")}>{name}</td>
                    <td className={cn(TD, "align-middle text-muted-foreground")}>{unit}</td>
                    <td className={cn(TD, "align-middle text-end text-sm tabular-nums")}>{formatQuantity(view.expected)}</td>
                    <td className={cn(TD, "align-middle text-end")}>
                      {isDraft ? (
                        <Input
                          ref={(el) => {
                            inputs.current[i] = el;
                          }}
                          type="text"
                          inputMode="decimal"
                          value={valueOf(line)}
                          onChange={(e) => setCounted(partIdOf(line), e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "ArrowDown") {
                              e.preventDefault();
                              focusRow(i + 1);
                            }
                            if (e.key === "ArrowUp") {
                              e.preventDefault();
                              focusRow(i - 1);
                            }
                          }}
                          onFocus={(e) => e.target.select()}
                          aria-label={t("storage.count.countedFor", { part: name })}
                          className="ms-auto h-10 w-28 text-end text-base font-semibold tabular-nums"
                          disabled={busy}
                        />
                      ) : (
                        <span className="text-sm font-semibold tabular-nums">{view.counted == null ? "—" : formatQuantity(view.counted)}</span>
                      )}
                    </td>
                    <td className={cn(TD, "align-middle")}>
                      <DiffCell view={view} />
                    </td>
                    <td className={cn(TD, "align-middle text-end tabular-nums", DIFF_STYLE[view.state].tone)}>
                      {view.valueDifference == null || view.valueDifference === 0 ? "—" : formatMoney(view.valueDifference)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isDraft && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="w-full space-y-1 sm:w-80">
            <p className="text-xs font-medium">{t("storage.count.addPart")}</p>
            <SearchableSelect
              options={addOptions}
              value={adding}
              onChange={(id) => setAdding(id)}
              placeholder={t("storage.record.partPlaceholder")}
              searchPlaceholder={t("storage.record.partSearch")}
              emptyText={t("storage.record.noParts")}
            />
          </div>
          <Button variant="outline" onClick={() => void doAdd()} disabled={adding === "" || busy}>
            {addPart.isPending && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {t("storage.count.addToSheet")}
          </Button>
          <p className="text-[11px] text-muted-foreground sm:pb-2">{t("storage.count.addPartHelp")}</p>
        </div>
      )}

      {/* Sticky totals bar */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="tabular-nums">
            {t("stock.countedProgress", { counted: totals.countedLines, total: totals.totalLines })}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums text-red-600 dark:text-red-400">
            <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {t("storage.count.missingTotal", { value: formatMoney(totals.missingValue) })}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums text-emerald-600 dark:text-emerald-400">
            <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {t("storage.count.extraTotal", { value: formatMoney(totals.extraValue) })}
          </span>
          {hasUnsavedChanges && <span className="text-xs text-amber-700 dark:text-amber-400">{t("storage.count.unsaved")}</span>}
          {isDraft && (
            <div className="flex w-full gap-2 sm:ms-auto sm:w-auto">
              <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => void doSave()} disabled={busy || !hasUnsavedChanges}>
                {save.isPending && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {t("stock.saveDraft")}
              </Button>
              <Button className="flex-1 sm:flex-none" onClick={() => setConfirmApply(true)} disabled={busy || totals.countedLines === 0}>
                {t("stock.applyCount")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Apply: summarise the corrections first */}
      <AlertDialog open={confirmApply} onOpenChange={(o) => !apply.isPending && setConfirmApply(o)}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading font-semibold">{t("stock.applyCount")}</AlertDialogTitle>
            <AlertDialogDescription>
              {corrections.length > 0 ? t("stock.applyConfirm", { count: corrections.length }) : t("storage.count.applyNoChanges")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {corrections.length > 0 && (
            <ul className="max-h-60 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
              {corrections.map((view) => {
                const line = lines.find((l) => partIdOf(l) === view.partId);
                return (
                  <li key={view.partId} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{line?.part?.name ?? `#${view.partId}`}</span>
                    <DiffCell view={view} />
                    <span className="w-20 text-end text-xs tabular-nums text-muted-foreground">
                      {view.valueDifference == null ? "—" : formatMoney(view.valueDifference)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            {t("storage.count.applySummary", {
              missing: formatMoney(totals.missingValue),
              extra: formatMoney(totals.extraValue),
              uncounted: totals.totalLines - totals.countedLines,
            })}
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={apply.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={apply.isPending}
              onClick={(e) => {
                e.preventDefault();
                void doApply();
              }}
            >
              {apply.isPending && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {t("stock.applyCount")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={(o) => !remove.isPending && setConfirmDelete(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading font-semibold">{t("storage.count.deleteDraft")}</AlertDialogTitle>
            <AlertDialogDescription>{t("storage.count.deleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                void doDelete();
              }}
            >
              {remove.isPending && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
