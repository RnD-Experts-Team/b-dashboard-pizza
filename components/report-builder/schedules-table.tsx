"use client";

import { CirclePause, CirclePlay, Loader2, Pencil, Trash2, Users } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { describeSchedule, lastRunLabel, nextRunLabel, recipientIds } from "@/lib/report-builder/schedule";
import type { ReportSchedule } from "@/types/report-builder.types";

interface SchedulesTableProps {
  schedules: ReportSchedule[];
  /** template id → name, for schedules whose payload does not carry the name. */
  templateNames: Map<string, string>;
  /** The signed-in user's id — only the owner can change or delete a schedule. */
  currentUserId: string | null;
  /** Schedule id with a pause / resume / delete in flight, for the spinner. */
  busyId: string | null;
  onEdit: (schedule: ReportSchedule) => void;
  onToggle: (schedule: ReportSchedule) => void;
  onDelete: (schedule: ReportSchedule) => void;
}

function ToggleIcon({ busy, active }: { busy: boolean; active: boolean }) {
  if (busy) return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  const Icon = active ? CirclePause : CirclePlay;
  return <Icon className="h-3.5 w-3.5" />;
}

export function SchedulesTable({ schedules, templateNames, currentUserId, busyId, onEdit, onToggle, onDelete }: SchedulesTableProps) {
  const t = useTranslations("reportBuilder.schedules");
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  const nameOf = (s: ReportSchedule) =>
    s.template_name || templateNames.get(String(s.template_id)) || t("unknownTemplate", { id: String(s.template_id) });

  return (
    <div data-slot="schedules-table" className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="min-w-[200px]">{t("columns.report")}</TableHead>
              <TableHead className="min-w-[200px]">{t("columns.runs")}</TableHead>
              <TableHead className="text-end">{t("columns.recipients")}</TableHead>
              <TableHead>{t("columns.delivery")}</TableHead>
              <TableHead>{t("columns.nextRun")}</TableHead>
              <TableHead>{t("columns.lastRun")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead className="text-end">
                <span className="sr-only">{t("columns.actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((s) => {
              const own = currentUserId !== null && String(s.owner_user_id) === currentUserId;
              const busy = busyId === String(s.id);
              const count = recipientIds(s).length;
              const next = nextRunLabel(s, locale);
              const last = lastRunLabel(s, locale);
              return (
                <TableRow key={s.id} className={cn(!s.is_active && "text-muted-foreground")}>
                  <TableCell className="max-w-[320px] truncate font-medium">{nameOf(s)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{describeSchedule(s, t)}</TableCell>
                  <TableCell className="text-end">
                    <span
                      className="inline-flex items-center gap-1 tabular-nums"
                      title={t("recipientsCount", { count: String(count) })}
                      aria-label={t("recipientsCount", { count: String(count) })}
                    >
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {count}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {t(`format.${s.format}`)} · {t(`delivery.${s.delivery}`)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs tabular-nums">{next || (s.is_active ? "" : t("status.paused"))}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{last || t("never")}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-medium",
                        s.is_active
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {t(s.is_active ? "status.active" : "status.paused")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {own && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={busy}
                          onClick={() => onToggle(s)}
                          aria-label={t(s.is_active ? "actions.pause" : "actions.resume")}
                          title={t(s.is_active ? "actions.pause" : "actions.resume")}
                        >
                          <ToggleIcon busy={busy} active={s.is_active} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={busy}
                          onClick={() => onEdit(s)}
                          aria-label={t("actions.edit")}
                          title={t("actions.edit")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          disabled={busy}
                          onClick={() => onDelete(s)}
                          aria-label={t("actions.delete")}
                          title={t("actions.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
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
