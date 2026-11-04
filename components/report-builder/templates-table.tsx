"use client";

import Link from "next/link";
import { CalendarClock, Globe2, Loader2, Lock, Pencil, Play, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCell } from "@/lib/report-builder/format";
import type { ReportTemplate } from "@/types/report-builder.types";

interface TemplatesTableProps {
  templates: ReportTemplate[];
  /** The signed-in user's id — only their own templates can be deleted. */
  currentUserId: string | null;
  /** Template id whose run is being queued, for the button spinner. */
  startingId: string | null;
  canRun: boolean;
  /** May create schedules — shows the Schedule action. */
  canSchedule: boolean;
  onRun: (template: ReportTemplate) => void;
  onSchedule: (template: ReportTemplate) => void;
  onDelete: (template: ReportTemplate) => void;
}

export function TemplatesTable({ templates, currentUserId, startingId, canRun, canSchedule, onRun, onSchedule, onDelete }: TemplatesTableProps) {
  const t = useTranslations("reportBuilder");
  const ts = useTranslations("reportBuilder.schedules.actions");
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const base = `/${locale}/dashboard/report-builder`;

  return (
    <div data-slot="templates-table" className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="min-w-[220px]">{t("templates.name")}</TableHead>
              <TableHead>{t("templates.visibility")}</TableHead>
              <TableHead className="text-end">{t("templates.columns")}</TableHead>
              <TableHead>{t("templates.updated")}</TableHead>
              <TableHead className="text-end">
                <span className="sr-only">{t("templates.actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((tpl) => {
              const own = currentUserId !== null && String(tpl.owner_user_id) === currentUserId;
              const starting = startingId === String(tpl.id);
              const isOrg = tpl.visibility === "org";
              const VisibilityIcon = isOrg ? Globe2 : Lock;
              return (
                <TableRow key={tpl.id}>
                  <TableCell className="max-w-[360px]">
                    <Link href={`${base}/${tpl.id}`} className="block truncate font-medium hover:underline">
                      {tpl.name}
                    </Link>
                    {tpl.description && <p className="truncate text-xs text-muted-foreground">{tpl.description}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1 font-normal">
                      <VisibilityIcon className="h-3 w-3" />
                      {t(isOrg ? "visibility.orgShort" : "visibility.privateShort")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end tabular-nums text-muted-foreground">
                    {Array.isArray(tpl.definition?.columns) ? tpl.definition.columns.length : 0}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                    {formatCell(tpl.updated_at, { type: "datetime" }, locale, { yes: "", no: "" })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-8" disabled={!canRun || starting} onClick={() => onRun(tpl)}>
                        {starting ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="me-1.5 h-3.5 w-3.5" />}
                        {t("actions.runNow")}
                      </Button>
                      {canSchedule && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => onSchedule(tpl)}
                          aria-label={ts("schedule")}
                          title={ts("schedule")}
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                        <Link href={`${base}/${tpl.id}`} aria-label={t(own ? "actions.edit" : "actions.open")}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      {own && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => onDelete(tpl)}
                          aria-label={t("actions.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
