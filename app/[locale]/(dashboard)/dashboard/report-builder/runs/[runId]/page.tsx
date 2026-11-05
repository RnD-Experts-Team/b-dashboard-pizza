"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, Download, FileSpreadsheet, Loader2, Pencil, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/report-builder/error-state";
import { ReportGrid, type GridSort } from "@/components/report-builder/report-grid";
import { RunStatusBadge } from "@/components/report-builder/run-status-badge";
import { useErrorText } from "@/components/report-builder/use-error-text";
import { reportBuilderService } from "@/lib/api/services/report-builder.service";
import { isActiveRun, useReportRun } from "@/lib/hooks/use-report-runs";
import { useReportRunRows } from "@/lib/hooks/use-report-run-rows";
import { useReportTemplate } from "@/lib/hooks/use-report-templates";
import { formatCell } from "@/lib/report-builder/format";
import { gridQueryFromParams, gridQueryToParams, type GridQuery } from "@/lib/report-builder/url-state";
import type { ReportRun, RunFormat } from "@/types/report-builder.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  One run — the page the in-app and emailed links land on.                  */
/*  Queued / running: the status, polled every 3 s. Done: the report grid,    */
/*  paged from the run's CSV (`/runs/{id}/rows?page&per`), with header sort   */
/*  and search on the loaded page (both in the URL), plus the downloads.      */
/* ────────────────────────────────────────────────────────────────────────── */

const NO_LABELS = { yes: "", no: "" };
const HTTP_NOT_FOUND = 404;
const HTTP_GONE = 410;

export default function RunPage() {
  return (
    <Suspense fallback={<RunSkeleton />}>
      <RunScreen />
    </Suspense>
  );
}

function skippedStores(run: ReportRun): number {
  const skipped = run.meta?.["skipped_stores"];
  return Array.isArray(skipped) ? skipped.length : 0;
}

function RunScreen() {
  const t = useTranslations("reportBuilder");
  const errorText = useErrorText();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const runId = String(params?.runId ?? "");
  const base = `/${locale}/dashboard/report-builder`;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const query = useMemo(() => gridQueryFromParams(new URLSearchParams(qs)), [qs]);

  const setQuery = useCallback(
    (patch: Partial<GridQuery>) => {
      const next = gridQueryToParams({ ...query, ...patch }).toString();
      // history.replaceState, not router.replace: no server request, so sorting, searching
      // and paging are never held up behind the run's polling.
      window.history.replaceState(null, "", next ? `${pathname}?${next}` : pathname);
    },
    [query, pathname],
  );

  const { run, isLoading, error, reload } = useReportRun(runId);
  const done = run?.status === "done";
  const rows = useReportRunRows(runId, query.page, query.perPage, done);
  const template = useReportTemplate(run?.template_id != null ? String(run.template_id) : null);
  const [downloading, setDownloading] = useState<RunFormat | null>(null);

  const download = async (format: RunFormat) => {
    setDownloading(format);
    try {
      await reportBuilderService.downloadRun(runId, format);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setDownloading(null);
    }
  };

  if (isLoading && !run) return <RunSkeleton />;
  if (!run) return <ErrorState message={error ? errorText(error) : t("errors.notFound")} onRetry={reload} />;

  const name = run.template_name || template.template?.name || t("runPage.untitled");
  const date = (v: string | null) => (v ? formatCell(v, { type: "date" }, locale, NO_LABELS) : "");
  const when = (v: string | null | undefined) => (v ? formatCell(v, { type: "datetime" }, locale, NO_LABELS) : "");
  const hasXlsx = run.format === "xlsx" || Boolean(run.xlsx_path);
  const expired = rows.error?.status === HTTP_GONE || rows.error?.status === HTTP_NOT_FOUND;
  const skipped = skippedStores(run);
  const sort: GridSort = { sortId: query.sortId, sortOrder: query.sortOrder };

  return (
    <div className="space-y-6">
      <Link href={`${base}?tab=runs`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
        {t("actions.backToRuns")}
      </Link>

      <PageHeader title={name} description={t("runPage.description")}>
        {run.template_id != null && (
          <Button variant="outline" asChild>
            <Link href={`${base}/${run.template_id}`}>
              <Pencil className="me-1.5 h-4 w-4" />
              {t("actions.openTemplate")}
            </Link>
          </Button>
        )}
        <Button variant="outline" disabled={!done || downloading !== null || expired} onClick={() => void download("csv")}>
          {downloading === "csv" ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" /> : <Download className="me-1.5 h-4 w-4" />}
          {t("actions.downloadCsv")}
        </Button>
        <Button
          variant="outline"
          disabled={!done || !hasXlsx || downloading !== null || expired}
          title={hasXlsx ? undefined : t("runPage.noXlsx")}
          onClick={() => void download("xlsx")}
        >
          {downloading === "xlsx" ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="me-1.5 h-4 w-4" />}
          {t("actions.downloadXlsx")}
        </Button>
      </PageHeader>

      <p className="-mt-3 text-xs text-muted-foreground">{t("runPage.downloadHelp")}</p>

      <Card className="py-3">
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 text-sm">
          <RunStatusBadge status={run.status} />
          {error && (
            <span role="status" className="text-xs text-destructive">
              {t("runPage.refreshFailed", { reason: errorText(error) })}
            </span>
          )}
          {run.period_from && run.period_to && (
            <Fact label={t("runs.period")} value={t("runs.periodRange", { from: date(run.period_from), to: date(run.period_to) })} />
          )}
          {run.row_count != null && <Fact label={t("runs.rows")} value={formatCell(run.row_count, { type: "integer" }, locale, NO_LABELS)} />}
          {run.started_at ? (
            <Fact label={t("runs.started")} value={when(run.started_at)} />
          ) : (
            run.created_at && <Fact label={t("runs.requested")} value={when(run.created_at)} />
          )}
          {run.finished_at && <Fact label={t("runs.finished")} value={when(run.finished_at)} />}
          {run.expires_at && <Fact label={t("runs.expires")} value={when(run.expires_at)} />}
        </CardContent>
      </Card>

      {skipped > 0 && <Note text={t("runPage.skippedStores", { count: skipped })} />}

      {isActiveRun(run) && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <h2 className="font-heading text-lg font-semibold">
            {run.status === "queued" ? t("runPage.queuedTitle") : t("runPage.runningTitle")}
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">{t("runPage.activeDescription")}</p>
        </div>
      )}

      {run.status === "failed" && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-destructive/40 py-16 text-center">
          <XCircle className="h-8 w-8 text-destructive" />
          <h2 className="font-heading text-lg font-semibold">{t("runPage.failedTitle")}</h2>
          {run.error && <p className="max-w-xl text-sm text-muted-foreground">{run.error}</p>}
        </div>
      )}

      {done && expired && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <FileSpreadsheet className="h-10 w-10 text-muted-foreground/60" />
          <h2 className="font-heading text-lg font-semibold">{t("runPage.expiredTitle")}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{t("runPage.expiredDescription")}</p>
        </div>
      )}

      {done && !expired && rows.error && !rows.result && <ErrorState message={errorText(rows.error)} onRetry={rows.reload} />}
      {done && !expired && !rows.result && rows.isLoading && <Skeleton className="h-96 w-full" />}
      {done && !expired && rows.result && (
        <ReportGrid
          columns={rows.result.columns}
          rows={rows.result.rows}
          sort={sort}
          onSortChange={(s) => setQuery(s)}
          search={query.search}
          onSearchChange={(search) => setQuery({ search })}
          refreshing={rows.isLoading}
          rowOffset={(query.page - 1) * query.perPage}
          bodyClassName="max-h-[70vh]"
          paging={{
            page: query.page,
            perPage: query.perPage,
            total: rows.result.total ?? run.row_count ?? null,
            onPageChange: (page) => setQuery({ page }),
            onPerPageChange: (perPage) => setQuery({ perPage, page: 1 }),
          }}
        />
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-[11px] tabular-nums">{value}</p>
    </div>
  );
}

function Note({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
      {text}
    </p>
  );
}

function RunSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
