"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCell } from "@/lib/report-builder/format";
import type { ReportRun } from "@/types/report-builder.types";
import { RunStatusBadge } from "./run-status-badge";

interface RunsTableProps {
  runs: ReportRun[];
  /** template id → name, for runs whose payload does not carry the name. */
  templateNames: Map<string, string>;
}

const NO_LABELS = { yes: "", no: "" };

export function RunsTable({ runs, templateNames }: RunsTableProps) {
  const t = useTranslations("reportBuilder.runs");
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const base = `/${locale}/dashboard/report-builder/runs`;
  const date = (v: string | null) => (v ? formatCell(v, { type: "date" }, locale, NO_LABELS) : "");
  const when = (v: string | null | undefined) => (v ? formatCell(v, { type: "datetime" }, locale, NO_LABELS) : "");

  const nameOf = (run: ReportRun) => {
    if (run.template_name) return run.template_name;
    const known = run.template_id !== null ? templateNames.get(String(run.template_id)) : undefined;
    return known ?? t("unknownTemplate", { id: String(run.template_id ?? "—") });
  };

  return (
    <div data-slot="runs-table" className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="min-w-[200px]">{t("report")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("period")}</TableHead>
              <TableHead className="text-end">{t("rows")}</TableHead>
              <TableHead>{t("started")}</TableHead>
              <TableHead>{t("expires")}</TableHead>
              <TableHead className="text-end">
                <span className="sr-only">{t("open")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell className="max-w-[320px]">
                  <Link href={`${base}/${run.id}`} className="block truncate font-medium hover:underline">
                    {nameOf(run)}
                  </Link>
                  {run.status === "failed" && run.error && (
                    <p className="truncate text-xs text-destructive" title={run.error}>
                      {run.error}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <RunStatusBadge status={run.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs tabular-nums">
                  {run.period_from && run.period_to ? t("periodRange", { from: date(run.period_from), to: date(run.period_to) }) : ""}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {run.row_count !== null && run.row_count !== undefined ? formatCell(run.row_count, { type: "integer" }, locale, NO_LABELS) : ""}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                  {when(run.started_at ?? run.created_at)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{when(run.expires_at)}</TableCell>
                <TableCell className="text-end">
                  <Button size="sm" variant="ghost" className="h-8" asChild>
                    <Link href={`${base}/${run.id}`}>
                      <ExternalLink className="me-1.5 h-3.5 w-3.5" />
                      {t("open")}
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
