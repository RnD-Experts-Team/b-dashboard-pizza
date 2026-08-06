"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cleaningService, CleaningError } from "@/lib/api/services/cleaning.service";
import {
  TaskFormFields,
  TaskFormSkeleton,
  taskFormSchema,
  useTaskStoreOptions,
  num,
  type TaskFormValues,
} from "./task-form-fields";
import type {
  CleaningFrequency,
  CleaningTask,
  UpdateTaskPayload,
} from "@/types/cleaning.types";

interface Props {
  taskId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (taskId: number, payload: UpdateTaskPayload) => Promise<unknown>;
}

function sameNumberSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

/**
 * Diff the edited form against the originally-loaded task and return ONLY the
 * fields that changed — the guide requires PUT to send only changed fields.
 */
function buildUpdatePayload(
  original: CleaningTask,
  current: {
    values: TaskFormValues;
    frequency: CleaningFrequency;
    weekDays: number[];
    startsAt: string;
    endsAt: string;
    storeIds: number[];
  }
): UpdateTaskPayload {
  const payload: UpdateTaskPayload = {};
  const { values, frequency, weekDays, startsAt, endsAt, storeIds } = current;

  if (values.name.trim() !== original.name) payload.name = values.name.trim();

  const description = values.description?.trim() || undefined;
  if (description !== (original.description ?? undefined)) {
    payload.description = description;
  }

  const weight = num(values.weight);
  if ((weight ?? null) !== (original.weight ?? null)) payload.weight = weight;

  if (frequency !== original.frequency) payload.frequency = frequency;

  const interval = num(values.interval) ?? 1;
  if ((interval ?? null) !== (original.interval ?? null)) payload.interval = interval;

  if (frequency === "weekly") {
    if (!sameNumberSet(weekDays, original.weekDays ?? [])) {
      payload.week_days = weekDays;
    }
  }

  if (frequency === "hourly") {
    const intervalHours = num(values.intervalHours) ?? null;
    if (intervalHours !== (original.intervalHours ?? null)) {
      payload.interval_hours = intervalHours;
    }
  }

  if (startsAt !== (original.startsAt ?? "")) payload.starts_at = startsAt;

  const endsAtValue = endsAt || null;
  if (endsAtValue !== (original.endsAt ?? null)) payload.ends_at = endsAtValue;

  const dueTimeValue = values.dueTime || null;
  if (dueTimeValue !== (original.dueTime ?? null)) payload.due_time = dueTimeValue;

  const originalStoreIds = original.stores.map((s) => s.id);
  if (!sameNumberSet(storeIds, originalStoreIds)) payload.store_ids = storeIds;

  return payload;
}

export function EditTaskDialog({ taskId, open, onOpenChange, onUpdate }: Props) {
  const t = useTranslations("cleaningChart.editTaskDialog");
  const { options: storeOptions, isLoading: storesLoading } = useTaskStoreOptions();

  const [task, setTask] = useState<CleaningTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [frequency, setFrequency] = useState<CleaningFrequency>("weekly");
  const [weekDays, setWeekDays] = useState<number[]>([]);
  const [storeIds, setStoreIds] = useState<number[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: { name: "" },
  });

  // Fetch the full task fresh each time the dialog opens for a task.
  useEffect(() => {
    if (!open || taskId == null) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setTask(null);

    cleaningService
      .getTask(taskId)
      .then((t) => {
        if (cancelled) return;
        setTask(t);
        reset({
          name: t.name,
          description: t.description ?? "",
          weight: t.weight != null ? String(t.weight) : "",
          interval: t.interval != null ? String(t.interval) : "1",
          intervalHours: t.intervalHours != null ? String(t.intervalHours) : "",
          dueTime: t.dueTime ?? "",
        });
        setFrequency(t.frequency);
        setWeekDays(t.weekDays ?? []);
        setStartsAt(t.startsAt ?? "");
        setEndsAt(t.endsAt ?? "");
        setStoreIds(t.stores.map((s) => s.id));
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof CleaningError ? err.message : t("loadFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, taskId, reset]);

  const toggleWeekday = (n: number) =>
    setWeekDays((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));

  const onSubmit = async (values: TaskFormValues) => {
    if (!task) return;
    if (!startsAt) return toast.error(t("toasts.startRequired"));
    if (storeIds.length === 0) return toast.error(t("toasts.storeRequired"));
    if (frequency === "hourly" && !num(values.intervalHours)) {
      return toast.error(t("toasts.hourlyIntervalRequired"));
    }

    const payload = buildUpdatePayload(task, {
      values,
      frequency,
      weekDays,
      startsAt,
      endsAt,
      storeIds,
    });

    if (Object.keys(payload).length === 0) {
      toast.info(t("toasts.nothingChanged"));
      onOpenChange(false);
      return;
    }

    setSubmitting(true);
    try {
      await onUpdate(task.id, payload);
      toast.success(t("toasts.updated", { name: values.name }));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof CleaningError ? err.message : t("toasts.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-lg">{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
          <div className="max-h-[62vh] overflow-y-auto px-6 py-5">
            {loading ? (
              <TaskFormSkeleton />
            ) : loadError ? (
              <p className="py-10 text-center text-sm text-destructive">{loadError}</p>
            ) : (
              task && (
                <TaskFormFields
                  register={register}
                  errors={errors}
                  frequency={frequency}
                  setFrequency={setFrequency}
                  weekDays={weekDays}
                  toggleWeekday={toggleWeekday}
                  startsAt={startsAt}
                  setStartsAt={setStartsAt}
                  endsAt={endsAt}
                  setEndsAt={setEndsAt}
                  storeOptions={storeOptions}
                  storesLoading={storesLoading}
                  storeIds={storeIds}
                  setStoreIds={setStoreIds}
                />
              )
            )}
          </div>

          <DialogFooter className="border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={submitting || loading || !task}>
              {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
