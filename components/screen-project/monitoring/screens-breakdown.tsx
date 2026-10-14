"use client";

import { useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDuration, type ScreenRow } from "@/lib/screen-usage/aggregate";

interface ScreensBreakdownProps {
  rows: ScreenRow[];
}

/** Per station: time in the main tile, mic and camera — split per manager. Most-watched first. */
export function ScreensBreakdown({ rows }: ScreensBreakdownProps) {
  const t = useTranslations("screenMonitoring");
  const maxMain = Math.max(1, ...rows.map((r) => r.mainMs));

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.station")}</TableHead>
            <TableHead>{t("columns.manager")}</TableHead>
            <TableHead className="w-1/3">{t("columns.mainTile")}</TableHead>
            <TableHead className="text-end">{t("columns.micOpen")}</TableHead>
            <TableHead className="text-end">{t("columns.camera")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const lines = row.byUser.length > 0 ? row.byUser : [null];
            return lines.map((line, i) => (
              <TableRow key={`${row.station.id}-${line?.user.id ?? "none"}`} className={i > 0 ? "border-t-0" : undefined}>
                {i === 0 && (
                  <TableCell rowSpan={lines.length} className="align-top font-medium">
                    {row.station.name}
                    <div className="text-xs font-normal text-muted-foreground tabular-nums">
                      {formatDuration(row.mainMs)}
                    </div>
                  </TableCell>
                )}
                <TableCell className={line ? undefined : "text-muted-foreground"}>
                  {line ? line.user.name : t("neverWatched")}
                </TableCell>
                <TableCell>
                  {line && (
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(line.mainMs / maxMain) * 100}%` }}
                        />
                      </div>
                      <span className="w-16 text-end text-xs tabular-nums">{formatDuration(line.mainMs)}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-end tabular-nums">{line ? formatDuration(line.micMs) : ""}</TableCell>
                <TableCell className="text-end tabular-nums">{line ? formatDuration(line.camMs) : ""}</TableCell>
              </TableRow>
            ));
          })}
        </TableBody>
      </Table>
    </div>
  );
}
