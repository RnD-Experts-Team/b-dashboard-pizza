"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Loader2, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";
import { CALENDAR_CATEGORIES } from "@/lib/calendar/categories";
import { DAY, MINUTE, addDays, dayKey, fromKey, isDayKey } from "@/lib/calendar/dates";
import { lastDay } from "@/lib/calendar/layout";
import type { CalendarEvent, CalendarEventInput, CategoryKey } from "@/lib/calendar/types";
import { useCalendarMutations, useCalendarStoreRef } from "@/lib/hooks/use-calendar-events";
import { EventDot } from "./event-parts";
import { useCalendarFormat } from "./use-calendar-format";

/** What opens the editor: a new event (with a suggested start) or an existing one. */
export type EditorTarget =
  | { kind: "create"; start: Date; allDay?: boolean }
  | { kind: "edit"; event: CalendarEvent };

const TITLE_MAX = 120;
const NOTES_MAX = 500;
const TYPE_LABEL_MAX = 40;

interface FormState {
  title: string;
  category: CategoryKey;
  allDay: boolean;
  /** "YYYY-MM-DD" */
  date: string;
  /** All-day only, inclusive "YYYY-MM-DD". */
  endDate: string;
  /** "HH:mm" */
  startTime: string;
  endTime: string;
  notes: string;
  /** "other" only: the user's own name for the type. */
  typeLabel: string;
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const atTime = (day: string, time: string) => {
  const [h, m] = time.split(":").map(Number);
  const d = fromKey(day);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

function initialState(target: EditorTarget): FormState {
  if (target.kind === "edit") {
    const ev = target.event;
    return {
      title: ev.title ?? "",
      category: ev.category,
      allDay: ev.allDay,
      date: dayKey(ev.start),
      endDate: dayKey(lastDay(ev)),
      startTime: ev.allDay ? "09:00" : hhmm(ev.start),
      endTime: ev.allDay ? "10:00" : hhmm(ev.end),
      notes: ev.notes ?? "",
      typeLabel: ev.typeLabel ?? "",
    };
  }
  const start = target.start;
  // Default length: one hour, kept inside the same day.
  const end = new Date(Math.min(+start + 60 * MINUTE, +addDays(fromKey(dayKey(start)), 1) - MINUTE));
  return {
    title: "",
    category: "meeting",
    allDay: !!target.allDay,
    date: dayKey(start),
    endDate: dayKey(start),
    startTime: hhmm(start),
    endTime: hhmm(end),
    notes: "",
    typeLabel: "",
  };
}

type Errors = Partial<Record<"title" | "date" | "end", string>>;

/**
 * Add / edit an event — one dialog for both, in three short steps top to
 * bottom: what (title + type), when (all-day switch, date, times), and notes.
 *
 * Only events created here are editable; the page never opens this for
 * system events (cleaning, shifts, birthdays…), which belong to other modules.
 */
export function EventDialog({
  target,
  onOpenChange,
  onSaved,
  onDelete,
}: {
  target: EditorTarget | null;
  onOpenChange: (open: boolean) => void;
  /** After a successful create/update (e.g. to reveal the event's day). */
  onSaved: (ev: CalendarEvent) => void;
  /**
   * Edit mode only: ASK to delete. The editor stays open underneath the
   * confirmation, so Cancel returns to the form; the page closes the editor
   * once the delete is confirmed.
   */
  onDelete: (ev: CalendarEvent) => void;
}) {
  const open = target != null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        {target && (
          <EventForm
            // Fresh form state per target.
            key={target.kind === "edit" ? target.event.id : `new-${+target.start}`}
            target={target}
            onCancel={() => onOpenChange(false)}
            onSaved={(ev) => {
              onOpenChange(false);
              onSaved(ev);
            }}
            onDelete={onDelete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventForm({
  target,
  onCancel,
  onSaved,
  onDelete,
}: {
  target: EditorTarget;
  onCancel: () => void;
  onSaved: (ev: CalendarEvent) => void;
  onDelete: (ev: CalendarEvent) => void;
}) {
  const t = useTranslations("calendar.editor");
  const tc = useTranslations("calendar");
  const f = useCalendarFormat();
  const ids = useId();
  const store = useCalendarStoreRef();
  const { create, update } = useCalendarMutations();
  const editing = target.kind === "edit" ? target.event : null;

  const [form, setForm] = useState<FormState>(() => initialState(target));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((s) => ({ ...s, [k]: v }));

  /** Builds the payload, or the reasons it can't be built yet. */
  const result = useMemo((): { input: CalendarEventInput | null; errors: Errors } => {
    const e: Errors = {};
    const title = form.title.trim();
    if (!title) e.title = t("errors.title");
    if (!isDayKey(form.date)) e.date = t("errors.date");
    let start: Date | null = null;
    let end: Date | null = null;
    if (!e.date) {
      if (form.allDay) {
        if (!isDayKey(form.endDate) || form.endDate < form.date) e.end = t("errors.endDate");
        else {
          start = fromKey(form.date);
          end = addDays(fromKey(form.endDate), 1);
        }
      } else {
        start = atTime(form.date, form.startTime);
        end = atTime(form.date, form.endTime);
        if (!form.startTime || !form.endTime || end <= start) e.end = t("errors.endTime");
      }
    }
    const input =
      Object.keys(e).length || !start || !end
        ? null
        : {
            title,
            category: form.category,
            allDay: form.allDay,
            start,
            end,
            notes: form.notes,
            typeLabel: form.category === "other" ? form.typeLabel : undefined,
          };
    return { input, errors: e };
  }, [form, t]);

  // Errors show (and update live) only once the user has tried to save.
  const errors: Errors = submitted ? result.errors : {};

  // How long it lasts — from the dates alone, so it shows before a title exists.
  const summary = (() => {
    if (!isDayKey(form.date)) return null;
    if (form.allDay) {
      if (!isDayKey(form.endDate) || form.endDate < form.date) return null;
      const days = Math.round((+fromKey(form.endDate) - +fromKey(form.date)) / DAY) + 1;
      // A single all-day event needs no summary: the switch already says "All day".
      return days === 1 ? null : tc("pop.days", { n: days });
    }
    const minutes = (+atTime(form.date, form.endTime) - +atTime(form.date, form.startTime)) / MINUTE;
    return minutes > 0 ? f.duration(minutes) : null;
  })();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!result.input) {
      // Put the cursor where the first problem is.
      const first = result.errors.title ? `${ids}-title` : null;
      if (first) document.getElementById(first)?.focus();
      return;
    }
    setSaving(true);
    try {
      const ev = editing ? await update(editing.id, result.input) : await create(result.input);
      toast.success(editing ? t("updated") : t("created"), { description: f.title(ev) });
      onSaved(ev);
    } catch {
      toast.error(t("saveFailed"));
      setSaving(false);
    }
  };

  const fieldError = (msg?: string) =>
    msg ? (
      <p role="alert" className="text-xs text-destructive">
        {msg}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader className="border-b px-5 pb-4 pt-5 text-start">
        <DialogTitle className="font-heading">{editing ? t("editTitle") : t("createTitle")}</DialogTitle>
        <DialogDescription className="flex items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0" />
          {t("storeLine", { store: editing?.store.name ?? store?.name ?? "" })}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 px-5 py-5">
        {/* Step 1 — what */}
        <section className="space-y-4">
          <StepLabel n={1} label={t("steps.what")} />
          <div className="space-y-1.5">
            <Label htmlFor={`${ids}-title`}>{t("fields.title")}</Label>
            <Input
              id={`${ids}-title`}
              dir="auto"
              autoFocus
              maxLength={TITLE_MAX}
              value={form.title}
              placeholder={t("fields.titlePlaceholder")}
              aria-invalid={!!errors.title}
              onChange={(e) => set("title", e.target.value)}
            />
            {fieldError(errors.title)}
          </div>
          <div className="space-y-1.5">
            <span id={`${ids}-type`} className="text-sm font-medium leading-none">
              {t("fields.type")}
            </span>
            <div role="radiogroup" aria-labelledby={`${ids}-type`} className="flex flex-wrap gap-1.5">
              {CALENDAR_CATEGORIES.map((c) => {
                const on = form.category === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set("category", c.key)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium outline-none transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      on
                        ? "border-foreground bg-foreground text-background"
                        : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground dark:bg-input/30",
                    )}
                  >
                    <EventDot category={c.key} className={cn(on && "ring-2 ring-background")} />
                    {tc(`categories.${c.key}`)}
                  </button>
                );
              })}
            </div>
            {/* "Other" can be named, so the card says "Inspection" rather than just "Other". */}
            {form.category === "other" && (
              <div className="space-y-1.5 pt-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                <Label htmlFor={`${ids}-typeLabel`} className="text-xs text-muted-foreground">
                  {t("fields.typeLabel")} <span className="font-normal">({t("optional")})</span>
                </Label>
                <Input
                  id={`${ids}-typeLabel`}
                  dir="auto"
                  maxLength={TYPE_LABEL_MAX}
                  value={form.typeLabel}
                  placeholder={t("fields.typeLabelPlaceholder")}
                  onChange={(e) => set("typeLabel", e.target.value)}
                  className="sm:max-w-72"
                />
              </div>
            )}
          </div>
        </section>

        {/* Step 2 — when */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <StepLabel n={2} label={t("steps.when")} />
            <label htmlFor={`${ids}-allday`} className="flex cursor-pointer items-center gap-2 text-sm">
              {tc("allDay")}
              <Switch id={`${ids}-allday`} checked={form.allDay} onCheckedChange={(v) => set("allDay", v)} />
            </label>
          </div>

          {form.allDay ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("fields.startDate")}</Label>
                <DatePicker
                  value={form.date}
                  onChange={(v) => setForm((s) => ({ ...s, date: v, endDate: s.endDate < v ? v : s.endDate }))}
                />
                {fieldError(errors.date)}
              </div>
              <div className="space-y-1.5">
                <Label>{t("fields.endDate")}</Label>
                <DatePicker value={form.endDate} onChange={(v) => set("endDate", v)} />
                {fieldError(errors.end)}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-1.5">
                <Label>{t("fields.date")}</Label>
                <DatePicker value={form.date} onChange={(v) => set("date", v)} />
                {fieldError(errors.date)}
              </div>
              <div className="space-y-1.5">
                <Label>{t("fields.from")}</Label>
                <TimePicker value={form.startTime} onChange={(v) => set("startTime", v)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("fields.to")}</Label>
                <TimePicker value={form.endTime} onChange={(v) => set("endTime", v)} />
              </div>
              <div className="sm:col-span-3">{fieldError(errors.end)}</div>
            </div>
          )}
          {summary && <p className="text-xs tabular-nums text-muted-foreground">{t("lasts", { d: summary })}</p>}
        </section>

        {/* Step 3 — details */}
        <section className="space-y-3">
          <StepLabel n={3} label={t("steps.details")} optional={t("optional")} />
          <Textarea
            aria-label={t("fields.notes")}
            dir="auto"
            rows={3}
            maxLength={NOTES_MAX}
            value={form.notes}
            placeholder={t("fields.notesPlaceholder")}
            onChange={(e) => set("notes", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
            }}
            className="resize-none"
          />
          <p className="text-end text-[11px] tabular-nums text-muted-foreground">
            {form.notes.length}/{NOTES_MAX}
          </p>
        </section>
      </div>

      <DialogFooter className="flex-row items-center gap-2 border-t px-5 py-3 sm:justify-between">
        {editing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDelete(editing)}
            disabled={saving}
          >
            <Trash2 className="size-4" />
            {t("delete")}
          </Button>
        ) : (
          <span />
        )}
        <div className="ms-auto flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {editing ? t("save") : t("create")}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

function StepLabel({ n, label, optional }: { n: number; label: string; optional?: string }) {
  return (
    <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <span className="grid size-5 place-items-center rounded-full bg-muted text-[10px] tabular-nums text-foreground">
        {n}
      </span>
      {label}
      {optional && <span className="font-normal normal-case tracking-normal">({optional})</span>}
    </h3>
  );
}
