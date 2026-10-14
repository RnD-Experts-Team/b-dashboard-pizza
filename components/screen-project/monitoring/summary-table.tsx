"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDuration, percent, type UserSummary } from "@/lib/screen-usage/aggregate";
import type { UsageStation } from "@/lib/screen-usage/types";

interface SummaryTableProps {
  rows: UserSummary[];
  stations: UsageStation[];
}

/** One row per manager: time on Screen Project, presence, camera, mic, favorite screen. */
export function SummaryTable({ rows, stations }: SummaryTableProps) {
  const t = useTranslations("screenMonitoring");
  const stationName = (id: number | null) =>
    id === null ? "—" : (stations.find((s) => s.id === id)?.name ?? `#${id}`);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.manager")}</TableHead>
            <TableHead className="text-end">{t("columns.onScreen")}</TableHead>
            <TableHead className="text-end">{t("columns.present")}</TableHead>
            <TableHead className="text-end">{t("columns.away")}</TableHead>
            <TableHead className="text-end">{t("columns.noFace")}</TableHead>
            <TableHead className="text-end">{t("columns.covered")}</TableHead>
            <TableHead className="text-end">{t("columns.micOpen")}</TableHead>
            <TableHead className="text-end">{t("columns.talking")}</TableHead>
            <TableHead className="text-end">{t("columns.silent")}</TableHead>
            <TableHead className="text-end">{t("columns.deadMic")}</TableHead>
            <TableHead className="text-end">{t("columns.talkAll")}</TableHead>
            <TableHead className="text-end">{t("columns.pip")}</TableHead>
            <TableHead>{t("columns.favorite")}</TableHead>
            <TableHead className="text-end">{t("columns.kicks")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.user.id}>
              <TableCell className="font-medium">{r.user.name}</TableCell>
              <TableCell className="text-end tabular-nums">{formatDuration(r.onScreenMs)}</TableCell>
              <TableCell className="text-end tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400">{formatDuration(r.presentMs)}</span>
                <span className="ms-1 text-xs text-muted-foreground">{percent(r.presentMs, r.onScreenMs)}</span>
              </TableCell>
              <TableCell className="text-end tabular-nums">{formatDuration(r.awayMs)}</TableCell>
              <TableCell className="text-end tabular-nums">
                {r.noFaceMs > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">{formatDuration(r.noFaceMs)}</span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {r.coveredMs > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">{formatDuration(r.coveredMs)}</span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-end tabular-nums">{formatDuration(r.micOpenMs)}</TableCell>
              <TableCell className="text-end tabular-nums">
                {formatDuration(r.talkingMs)}
                <span className="ms-1 text-xs text-muted-foreground">{percent(r.talkingMs, r.micOpenMs)}</span>
              </TableCell>
              <TableCell className="text-end tabular-nums">{formatDuration(r.silentMs)}</TableCell>
              <TableCell className="text-end tabular-nums">
                {r.deadMicMs > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">{formatDuration(r.deadMicMs)}</span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-end tabular-nums">{formatDuration(r.talkAllMs)}</TableCell>
              <TableCell className="text-end tabular-nums">{formatDuration(r.pipMs)}</TableCell>
              <TableCell>
                {stationName(r.favoriteStationId)}
                {r.favoriteMs > 0 && (
                  <span className="ms-1 text-xs text-muted-foreground tabular-nums">
                    {formatDuration(r.favoriteMs)}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {r.kicks > 0 ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {r.kicks}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{t("kicksHint")}</TooltipContent>
                  </Tooltip>
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
