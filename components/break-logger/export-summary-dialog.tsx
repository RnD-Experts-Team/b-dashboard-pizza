"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  Copy,
  FileText,
  Flag,
  LayoutList,
  Radio,
  RotateCcw,
  ShieldCheck,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { breaksService } from "@/lib/api/services/breaks.service";
import { BreakError, parseBreakError } from "@/lib/break-logger/errors";
import type { BreakDayExport, BreakEntry } from "@/types/breaks.types";
import { AllowanceBar, useBreakErrorText, useFormatTime, useFormatWorkDate } from "./break-ui";

/**
 * The day's summary, fetched from `/breaks/day/export` ONLY when this opens —
 * the dashboard polls `/breaks/day`, which doesn't render text.
 *
 * Two faces of one payload:
 *  - "Summary": a readable layout built from the structured day data.
 *  - "Plain text": the server's `text`, verbatim — its sprintf-padded columns
 *    are part of the API contract, so it is shown monospace, LTR, and it is
 *    exactly what Copy puts on the clipboard (from either tab).
 */
export function ExportSummaryDialog({
  date,
  open,
  onOpenChange,
}: {
  date: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("breaks");
  const errorText = useBreakErrorText();
  const formatWorkDate = useFormatWorkDate();
  const formatTime = useFormatTime();

  const [data, setData] = useState<BreakDayExport | null>(null);
  const [error, setError] = useState<BreakError | null>(null);
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<"summary" | "text">("summary");
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setData(null);
    setError(null);
    setCopied(false);
    breaksService
      .exportDay(date)
      .then((res) => !cancelled && setData(res))
      .catch((err) => {
        const e = parseBreakError(err);
        if (!cancelled && e.code !== "CANCELLED") setError(e);
      });
    return () => {
      cancelled = true;
    };
  }, [open, date, attempt]);

  async function copy() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.text);
      setCopied(true);
      toast.success(t("export.copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions / insecure context): show the text
      // selected so a manual copy is one keystroke away.
      setTab("text");
      requestAnimationFrame(() => {
        const node = preRef.current;
        if (!node) return;
        const range = document.createRange();
        range.selectNodeContents(node);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      });
      toast.error(t("export.copyFailed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-1 border-b px-6 pt-6 pb-4 text-start">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{t("export.title")}</DialogTitle>
            {data?.self_reported && (
              <Badge variant="outline" className="gap-1 text-[10px] font-medium text-muted-foreground">
                <ShieldCheck className="h-3 w-3" />
                {t("export.selfReported")}
              </Badge>
            )}
          </div>
          <DialogDescription>
            {formatWorkDate(date, true)}
            {data && <> · {data.user.name}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {error ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <AlertCircle className="h-7 w-7 text-destructive" />
              <p className="text-sm">{errorText(error)}</p>
              <Button size="sm" variant="outline" onClick={() => setAttempt((a) => a + 1)}>
                <RotateCcw className="me-1.5 h-3.5 w-3.5" />
                {t("actions.retry")}
              </Button>
            </div>
          ) : !data ? (
            <SummarySkeleton />
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as "summary" | "text")}>
              <TabsList className="mb-4 h-auto gap-1 p-1">
                <TabsTrigger value="summary" className="gap-1.5">
                  <LayoutList className="h-3.5 w-3.5" />
                  {t("export.tabSummary")}
                </TabsTrigger>
                <TabsTrigger value="text" className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  {t("export.tabText")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-0">
                <SummaryBody day={data} formatTime={formatTime} />
              </TabsContent>

              <TabsContent value="text" className="mt-0 space-y-2">
                <p className="text-xs text-muted-foreground">{t("export.textHint")}</p>
                <pre
                  ref={preRef}
                  dir="ltr"
                  className="overflow-x-auto whitespace-pre rounded-lg border bg-muted/40 p-4 text-start font-mono text-xs leading-relaxed"
                >
                  {data.text}
                </pre>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 border-t px-6 py-3 sm:justify-between">
          <p className="hidden text-xs text-muted-foreground sm:block">{t("export.copyHint")}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("export.close")}
            </Button>
            <Button onClick={() => void copy()} disabled={!data}>
              {copied ? <Check className="me-1.5 h-4 w-4" /> : <Copy className="me-1.5 h-4 w-4" />}
              {copied ? t("export.copiedShort") : t("export.copy")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Visual summary ───────────────────────────────────────────────────── */

function SummaryBody({
  day,
  formatTime,
}: {
  day: BreakDayExport;
  formatTime: (iso: string | null | undefined) => string;
}) {
  const t = useTranslations("breaks");
  const counted = day.entries.filter((e) => e.counts_toward_limit);
  const excluded = day.entries.filter((e) => !e.counts_toward_limit);
  const noted = day.entries.filter((e) => e.notes.length > 0);

  if (day.entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
        <LayoutList className="h-7 w-7 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("export.none")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Headline numbers — straight from the server's totals. */}
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat
            label={t("today.kpiCounted")}
            value={t("minutes", { minutes: day.counted_minutes })}
            sub={t("today.ofAllowance", { allowance: day.allowance_minutes })}
            tone={day.over_limit ? "bad" : undefined}
          />
          <Stat
            label={t("today.kpiExcluded")}
            value={t("minutes", { minutes: day.excluded_minutes })}
            tone="muted"
          />
          <Stat
            label={t("today.kpiTotal")}
            value={t("minutes", { minutes: day.total_minutes })}
            sub={t("export.breakCount", { count: day.entry_count })}
          />
        </div>
        <AllowanceBar
          countedMinutes={day.counted_minutes}
          allowanceMinutes={day.allowance_minutes}
          thresholds={day.milestones.thresholds}
        />
        <p
          className={cn(
            "text-xs font-medium tabular-nums",
            day.over_limit
              ? "text-red-600 dark:text-red-400"
              : "text-emerald-600 dark:text-emerald-400"
          )}
        >
          {day.over_limit
            ? t("allowance.over", { minutes: day.over_minutes })
            : t("allowance.left", { minutes: day.remaining_minutes })}
        </p>
      </div>

      {day.has_active_break && (
        <p className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
          <Radio className="h-3.5 w-3.5 shrink-0" />
          {t("export.runningNote", { time: formatTime(day.as_of) })}
        </p>
      )}

      {counted.length > 0 && (
        <EntrySection
          title={t("export.countedSection", { allowance: day.allowance_minutes })}
          accent="counted"
          entries={counted}
          subtotal={day.counted_minutes}
          formatTime={formatTime}
        />
      )}

      {excluded.length > 0 && (
        <EntrySection
          title={t("export.excludedSection")}
          accent="excluded"
          entries={excluded}
          subtotal={day.excluded_minutes}
          formatTime={formatTime}
        />
      )}

      {noted.length > 0 && (
        <section className="space-y-2">
          <SectionTitle>{t("notes.title")}</SectionTitle>
          <ul className="space-y-2">
            {noted.flatMap((e) =>
              e.notes.map((n) => (
                <li key={n.id} className="flex gap-2.5 rounded-md border bg-muted/30 p-2.5">
                  <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 text-sm">
                    <p className="text-xs text-muted-foreground">
                      <span className="tabular-nums">{formatTime(e.started_at)}</span> · {e.label}
                    </p>
                    <p className="whitespace-pre-wrap">{n.body}</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <SectionTitle>{t("today.milestones")}</SectionTitle>
        {day.milestones.fired.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("export.noMilestones")}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {day.milestones.fired.map((f) => (
              <span
                key={`${f.kind}-${f.threshold_minutes}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                  f.kind === "allowance"
                    ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400"
                    : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                )}
              >
                <Flag className="h-3 w-3" />
                {f.kind === "allowance"
                  ? t("today.allowanceReached", { minutes: f.threshold_minutes })
                  : t("today.milestoneReached", { minutes: f.threshold_minutes })}
                <span className="tabular-nums opacity-70">{formatTime(f.crossed_at)}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      <p className="border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
        {t("export.footer", {
          start: formatTime(day.work_day.starts_at),
          end: formatTime(day.work_day.ends_at),
        })}{" "}
        {t("today.selfReported")}
      </p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "bad" | "muted";
}) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-heading text-2xl font-semibold tabular-nums",
          tone === "bad" && "text-red-600 dark:text-red-400",
          tone === "muted" && "text-muted-foreground"
        )}
      >
        {value}
      </p>
      {sub && <p className="truncate text-[11px] tabular-nums text-muted-foreground">{sub}</p>}
    </div>
  );
}

function EntrySection({
  title,
  accent,
  entries,
  subtotal,
  formatTime,
}: {
  title: string;
  accent: "counted" | "excluded";
  entries: BreakEntry[];
  subtotal: number;
  formatTime: (iso: string | null | undefined) => string;
}) {
  const t = useTranslations("breaks");
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            accent === "counted" ? "bg-amber-500" : "bg-muted-foreground/40"
          )}
        />
        <SectionTitle>{title}</SectionTitle>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <ul className="divide-y">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-28 shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatTime(e.started_at)} – {e.running ? "…" : formatTime(e.ended_at)}
              </span>
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                <span className="truncate font-medium">{e.label}</span>
                {e.source === "manual" && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    {t("today.manual")}
                  </Badge>
                )}
                {e.running && (
                  <Badge className="bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                    {t("today.running")}
                  </Badge>
                )}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {t("minutes", { minutes: e.duration_minutes })}
              </span>
            </li>
          ))}
        </ul>
        {/* Server's subtotal — never the sum of the floored rows above. */}
        <div className="flex items-center justify-between bg-muted/40 px-3 py-2 text-sm">
          <span className="text-xs font-medium text-muted-foreground">{t("export.subtotal")}</span>
          <span className="font-semibold tabular-nums">{t("minutes", { minutes: subtotal })}</span>
        </div>
      </div>
    </section>
  );
}

function SummarySkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-32 w-full" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-28 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  );
}
