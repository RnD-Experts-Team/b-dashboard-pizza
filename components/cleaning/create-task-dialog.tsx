"use client";

import { useState } from "react";
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
import { CleaningError } from "@/lib/api/services/cleaning.service";
import {
  TaskFormFields,
  taskFormSchema,
  useTaskStoreOptions,
  num,
  type TaskFormValues,
} from "./task-form-fields";
import type { CleaningFrequency, CreateTaskPayload } from "@/types/cleaning.types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (payload: CreateTaskPayload) => Promise<unknown>;
}

export function CreateTaskDialog({ open, onOpenChange, onCreate }: Props) {
  const t = useTranslations("cleaningChart.createTaskDialog");
  const { options: storeOptions, isLoading: storesLoading } = useTaskStoreOptions();
  const [frequency, setFrequency] = useState<CleaningFrequency>("weekly");
  const [weekDays, setWeekDays] = useState<number[]>([]);
  const [storeIds, setStoreIds] = useState<number[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: { name: "", interval: "1" },
  });

  const toggleWeekday = (n: number) =>
    setWeekDays((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));

  const resetAll = () => {
    reset();
    setFrequency("weekly");
    setWeekDays([]);
    setStoreIds([]);
    setStartsAt("");
    setEndsAt("");
  };

  const onSubmit = async (values: TaskFormValues) => {
    if (!startsAt) return toast.error(t("toasts.startRequired"));
    if (storeIds.length === 0) return toast.error(t("toasts.storeRequired"));
    const intervalHours = num(values.intervalHours);
    if (frequency === "hourly" && !intervalHours) {
      return toast.error(t("toasts.hourlyIntervalRequired"));
    }

    const payload: CreateTaskPayload = {
      name: values.name,
      description: values.description || undefined,
      weight: num(values.weight),
      frequency,
      interval: num(values.interval) ?? 1,
      starts_at: startsAt,
      ends_at: endsAt || null,
      due_time: values.dueTime || null,
      // Only daily/monthly tasks support a second due time — a stale value left
      // over from switching frequency away and back must not be sent.
      due_time_2:
        frequency === "daily" || frequency === "monthly" ? values.dueTime2 || null : null,
      store_ids: storeIds,
      ...(frequency === "weekly" && weekDays.length > 0 ? { week_days: weekDays } : {}),
      ...(frequency === "hourly" ? { interval_hours: intervalHours ?? null } : {}),
    };

    setSubmitting(true);
    try {
      await onCreate(payload);
      toast.success(t("toasts.created", { name: values.name }));
      resetAll();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof CleaningError ? err.message : t("toasts.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetAll();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-lg">{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
          <div className="max-h-[62vh] overflow-y-auto px-6 py-5">
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
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
