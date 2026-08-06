"use client";

import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { z } from "zod";
import { Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { MultiSelect, type MultiSelectOption } from "@/components/daily-pay/multi-select";
import { cn } from "@/lib/utils";
import { useStores } from "@/lib/hooks/use-stores";
import type { CleaningFrequency } from "@/types/cleaning.types";

/**
 * Stable reference — passed to useStores. A fresh object literal here would make
 * the hook's effect re-run every render (infinite fetch loop).
 */
export const STORE_PARAMS = { perPage: 500 } as const;

export const FREQUENCIES: { value: CleaningFrequency; label: string; hint: string }[] = [
  { value: "daily", label: "Daily", hint: "Photo required" },
  { value: "weekly", label: "Weekly", hint: "Photo required" },
  { value: "monthly", label: "Monthly", hint: "Photo required" },
  { value: "hourly", label: "Hourly", hint: "Photo optional" },
];
export const INTERVAL_UNIT: Record<CleaningFrequency, string> = {
  daily: "day(s)",
  weekly: "week(s)",
  monthly: "month(s)",
  hourly: "cycle(s)",
};
export const WEEKDAYS = [
  { n: 1, label: "Mon" },
  { n: 2, label: "Tue" },
  { n: 3, label: "Wed" },
  { n: 4, label: "Thu" },
  { n: 5, label: "Fri" },
  { n: 6, label: "Sat" },
  { n: 7, label: "Sun" },
];

export const taskFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(1000).optional(),
  weight: z.string().optional(),
  interval: z.string().optional(),
  intervalHours: z.string().optional(),
  dueTime: z.string().optional(),
});
export type TaskFormValues = z.infer<typeof taskFormSchema>;

export function num(v: string | undefined): number | undefined {
  if (v == null || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Reusable store-options loader — shared by Create and Edit dialogs. */
export function useTaskStoreOptions() {
  const { stores, isLoading } = useStores(STORE_PARAMS);
  const options: MultiSelectOption<number>[] = stores.map((s) => ({
    value: Number(s.id),
    label: s.name || s.storeId,
    hint: s.storeId,
  }));
  return { options, isLoading };
}

interface TaskFormFieldsProps {
  register: UseFormRegister<TaskFormValues>;
  errors: FieldErrors<TaskFormValues>;
  frequency: CleaningFrequency;
  setFrequency: (f: CleaningFrequency) => void;
  weekDays: number[];
  toggleWeekday: (n: number) => void;
  startsAt: string;
  setStartsAt: (v: string) => void;
  endsAt: string;
  setEndsAt: (v: string) => void;
  storeOptions: MultiSelectOption<number>[];
  storesLoading: boolean;
  storeIds: number[];
  setStoreIds: (ids: number[]) => void;
}

/**
 * The task create/edit form body — no Dialog wrapper, no footer, so both
 * CreateTaskDialog and EditTaskDialog render an IDENTICAL form (per the
 * guide: "Edit reuses the same form, prefilled").
 */
export function TaskFormFields({
  register,
  errors,
  frequency,
  setFrequency,
  weekDays,
  toggleWeekday,
  startsAt,
  setStartsAt,
  endsAt,
  setEndsAt,
  storeOptions,
  storesLoading,
  storeIds,
  setStoreIds,
}: TaskFormFieldsProps) {
  return (
    <div className="space-y-6">
      {/* ── Basics ── */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Task details
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ct-name">
              Task name <span className="text-destructive">*</span>
            </Label>
            <Input id="ct-name" {...register("name")} placeholder="e.g. Clean the oven" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ct-desc">Description</Label>
            <Textarea
              id="ct-desc"
              {...register("description")}
              rows={2}
              placeholder="What exactly needs to be done?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-weight">Weight (0–100)</Label>
            <Input
              id="ct-weight"
              type="number"
              min={0}
              max={100}
              placeholder="Optional"
              {...register("weight")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-due-time">Due time</Label>
            <Input id="ct-due-time" type="time" {...register("dueTime")} />
          </div>
        </div>
      </section>

      {/* ── Schedule ── */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Schedule
        </h3>

        <div className="space-y-1.5">
          <Label>Frequency</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FREQUENCIES.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFrequency(f.value)}
                className={cn(
                  "flex flex-col items-start rounded-lg border px-3 py-2 text-start transition-colors",
                  frequency === f.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "hover:bg-muted"
                )}
              >
                <span className="text-sm font-medium">{f.label}</span>
                <span className="text-[11px] text-muted-foreground">{f.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ct-interval">Repeat every</Label>
            <div className="flex items-center gap-2">
              <Input
                id="ct-interval"
                type="number"
                min={1}
                className="w-20"
                {...register("interval")}
              />
              <span className="text-sm text-muted-foreground">{INTERVAL_UNIT[frequency]}</span>
            </div>
          </div>

          {frequency === "hourly" && (
            <div className="space-y-1.5">
              <Label htmlFor="ct-hours">
                Every X hours (1–24) <span className="text-destructive">*</span>
              </Label>
              <Input id="ct-hours" type="number" min={1} max={24} {...register("intervalHours")} />
            </div>
          )}
        </div>

        {frequency === "weekly" && (
          <div className="space-y-1.5">
            <Label>Weekdays (optional)</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.n}
                  type="button"
                  onClick={() => toggleWeekday(d.n)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    weekDays.includes(d.n)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>
              Starts on <span className="text-destructive">*</span>
            </Label>
            <DatePicker value={startsAt} onChange={setStartsAt} />
          </div>
          <div className="space-y-1.5">
            <Label>
              Ends on{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (blank = repeats forever)
              </span>
            </Label>
            <DatePicker value={endsAt} onChange={setEndsAt} />
          </div>
        </div>
      </section>

      {/* ── Stores ── */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Assign to stores
        </h3>
        <div className="space-y-1.5">
          <Label>
            Stores <span className="text-destructive">*</span>
          </Label>
          <MultiSelect<number>
            options={storeOptions}
            selected={storeIds}
            onChange={setStoreIds}
            icon={<Store className="h-4 w-4 text-muted-foreground" />}
            placeholder={storesLoading ? "Loading stores…" : "Select stores"}
            searchPlaceholder="Search stores…"
            emptyText={storesLoading ? "Loading…" : "No stores found."}
            disabled={storesLoading}
          />
          {storeIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {storeIds.length} store{storeIds.length > 1 ? "s" : ""} selected
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

/** Skeleton shown while EditTaskDialog fetches the full task before rendering the form. */
export function TaskFormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-9 animate-pulse rounded-md bg-muted" />
        <div className="h-16 animate-pulse rounded-md bg-muted" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-9 animate-pulse rounded-md bg-muted" />
          <div className="h-9 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
      <div className="space-y-4">
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-9 animate-pulse rounded-md bg-muted" />
          <div className="h-9 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
      <div className="space-y-4">
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        <div className="h-9 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}
