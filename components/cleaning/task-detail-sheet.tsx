"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CalendarClock,
  CalendarDays,
  Camera,
  Clock,
  Hash,
  Loader2,
  Pencil,
  Repeat,
  SprayCan,
  Store as StoreIcon,
  Trash2,
  Weight,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cleaningService, CleaningError } from "@/lib/api/services/cleaning.service";
import type { CleaningTask } from "@/types/cleaning.types";
import { formatDate } from "./cleaning-ui";

/** A compact labelled stat tile. */
function Field({
  icon,
  label,
  children,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-card/50 p-3", className)}>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

interface Props {
  taskId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Show an Edit action in the header, wired to the caller's edit dialog. */
  onEdit?: () => void;
  /** Show a Delete action in the header, wired to the caller's confirm dialog. */
  onDelete?: () => void;
}

export function TaskDetailSheet({ taskId, open, onOpenChange, onEdit, onDelete }: Props) {
  const t = useTranslations("cleaningChart.taskDetail");
  const tFreq = useTranslations("cleaningChart.frequency");
  const tWeekday = useTranslations("cleaningChart.weekday");
  const [task, setTask] = useState<CleaningTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || taskId == null) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setTask(null);
    cleaningService
      .getTask(taskId, controller.signal)
      .then((t) => !cancelled && setTask(t))
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof CleaningError ? err.message : t("loadFailed"));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, taskId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {/* Hero header */}
        <SheetHeader className="space-y-0 border-b bg-muted/30 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <SprayCan className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-xl">
                {task?.name ?? t("fallbackTitle")}
              </SheetTitle>
              {task && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{tFreq(task.frequency)}</Badge>
                  <Badge variant={task.photoRequired ? "default" : "outline"}>
                    <Camera className="me-1 h-3 w-3" />
                    {task.photoRequired ? t("photoRequired") : t("photoOptional")}
                  </Badge>
                  <Badge variant="outline">
                    <Hash className="me-0.5 h-3 w-3" />
                    {task.id}
                  </Badge>
                </div>
              )}
            </div>
            {task && (onEdit || onDelete) && (
              <div className="flex shrink-0 items-center gap-1.5">
                {onEdit && (
                  <Button variant="outline" size="sm" onClick={onEdit}>
                    <Pencil className="me-1.5 h-3.5 w-3.5" />
                    {t("edit")}
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={onDelete}
                    title={t("deleteTitle")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </SheetHeader>

        <div className="px-6 py-5">
          {loading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="me-2 h-5 w-5 animate-spin" /> {t("loading")}
            </div>
          )}
          {error && <p className="py-6 text-sm text-destructive">{error}</p>}

          {task && (
            <div className="space-y-5">
              {task.description && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {task.description}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field icon={<Repeat className="h-3.5 w-3.5" />} label={t("frequency")}>
                  {tFreq(task.frequency)}
                  {task.interval && task.interval > 1 && (
                    <span className="ms-1 font-normal text-muted-foreground">
                      {t("every", { interval: task.interval })}
                    </span>
                  )}
                </Field>

                {task.frequency === "hourly" ? (
                  <Field icon={<Clock className="h-3.5 w-3.5" />} label={t("interval")}>
                    {task.intervalHours ? t("everyHours", { hours: task.intervalHours }) : "—"}
                  </Field>
                ) : (
                  <Field icon={<Weight className="h-3.5 w-3.5" />} label={t("weight")}>
                    {task.weight ?? "—"}
                  </Field>
                )}

                <Field icon={<CalendarClock className="h-3.5 w-3.5" />} label={t("startsOn")}>
                  {formatDate(task.startsAt)}
                </Field>

                <Field icon={<CalendarClock className="h-3.5 w-3.5" />} label={t("endsOn")}>
                  {task.endsAt ? (
                    formatDate(task.endsAt)
                  ) : (
                    <span className="font-normal text-muted-foreground">
                      {t("repeatsForever")}
                    </span>
                  )}
                </Field>

                {task.frequency === "hourly" && (
                  <Field icon={<Weight className="h-3.5 w-3.5" />} label={t("weight")}>
                    {task.weight ?? "—"}
                  </Field>
                )}

                {task.dueTime && (
                  <Field icon={<Clock className="h-3.5 w-3.5" />} label={t("dueTime")}>
                    {task.dueTime}
                  </Field>
                )}
              </div>

              {task.frequency === "weekly" && task.weekDays && task.weekDays.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" /> {t("weekdays")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <span
                        key={d}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-medium",
                          task.weekDays?.includes(d)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {tWeekday(String(d))}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <StoreIcon className="h-3.5 w-3.5" /> {t("assignedStores", { count: task.stores.length })}
                </p>
                {task.stores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("noStoresAssigned")}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {task.stores.map((s) => (
                      <Badge key={s.id} variant="outline" className="font-normal">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
