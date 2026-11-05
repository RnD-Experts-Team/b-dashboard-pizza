"use client";

import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BellRing, CalendarPlus, Globe, ListChecks, Loader2, Lock, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TimePicker } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";
import { MINUTE, addDays, dayKey, fromKey, isDayKey } from "@/lib/calendar/dates";
import { FEED_MAX_STORES } from "@/lib/calendar/feed-types";
import { PRIORITIES, SCOPES, type CreateItemInput, type Priority, type Scope } from "@/lib/calendar/toolbox-write";
import { useAuthStore } from "@/lib/auth/auth.store";
import { CalendarWriteError } from "@/lib/api/services/calendar-toolbox.service";
import { useCalendarStoreOptions, useCalendarStores, useCalendarToolbox } from "@/lib/hooks/use-calendar-events";
import { StepLabel } from "./step-label";
import { StoreMultiSelect } from "./store-multi-select";
import { useCalendarFormat } from "./use-calendar-format";

type Kind = "event" | "task" | "reminder";

const KINDS: readonly { key: Kind; icon: LucideIcon }[] = [
  { key: "event", icon: CalendarPlus },
  { key: "task", icon: ListChecks },
  { key: "reminder", icon: BellRing },
];

/** "Remind me in…" shortcuts, in minutes. Anything else is a picked moment. */
const REMIND_PRESETS = [10, 30, 60, 180] as const;
/** The API takes a reminder up to a year ahead. */
const MAX_REMIND_MINUTES = 525_600;

const TITLE_MAX = 120;
const NOTES_MAX = 500;
const CATEGORY_MAX = 40;

interface FormState {
  kind: Kind;
  title: string;
  /** Events and tasks: chosen stores (everyone), every store or only me (super admin). */
  scope: Scope;
  stores: string[];
  /** "YYYY-MM-DD" */
  date: string;
  /** Event: no times. */
  allDay: boolean;
  /** "HH:mm". For a task this is the deadline. */
  startTime: string;
  endTime: string;
  /** Task: a deadline time at all (else end of day). */
  hasDeadline: boolean;
  category: string;
  priority: Priority;
  notes: string;
  proof: "none" | "note";
  requiresReview: boolean;
  /** Reminder: minutes from now, or "at" for a picked moment. */
  remind: number | "at";
  remindDate: string;
  remindTime: string;
}

type Errors = Partial<Record<"title" | "stores" | "date" | "end" | "remind", string>>;

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const atTime = (day: string, time: string) => {
  const [h, m] = time.split(":").map(Number);
  const d = fromKey(day);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

function initialState(start: Date, allDay: boolean, stores: string[]): FormState {
  // Default length: one hour, kept inside the same day.
  const end = new Date(Math.min(+start + 60 * MINUTE, +addDays(fromKey(dayKey(start)), 1) - MINUTE));
  return {
    kind: "event",
    title: "",
    scope: "custom",
    stores,
    date: dayKey(start),
    allDay,
    startTime: hhmm(start),
    endTime: hhmm(end),
    hasDeadline: false,
    category: "",
    priority: "medium",
    notes: "",
    proof: "none",
    requiresReview: true,
    remind: 10,
    remindDate: dayKey(start),
    remindTime: hhmm(start),
  };
}

/** A row of pill choices (one of several). Module-level so it keeps its identity, and its focus, between renders. */
function Segmented<T extends string | number>({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: T;
  items: readonly { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium leading-none">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {items.map((it) => {
          const on = it.value === value;
          return (
            <button
              key={String(it.value)}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(it.value)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium outline-none transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                on
                  ? "border-foreground bg-foreground text-background"
                  : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground dark:bg-input/30",
              )}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Add something to the calendar: an event, a task for stores, or a reminder for
 * yourself. They are saved in Toolbox (the page then reloads that feed). The
 * form shows only what the chosen kind needs.
 */
export function NewItemForm({
  start,
  allDay = false,
  onCancel,
  onSaved,
}: {
  start: Date;
  allDay?: boolean;
  onCancel: () => void;
  /** After a successful save, with where it landed (to reveal that day). */
  onSaved: (landed: { start: Date }) => void;
}) {
  const t = useTranslations("calendar.new");
  const tc = useTranslations("calendar");
  const f = useCalendarFormat();
  const ids = useId();
  const options = useCalendarStoreOptions();
  const shown = useCalendarStores();
  const { create } = useCalendarToolbox();

  // Starts with ONE store (the first the calendar shows), never every shown store:
  // an event or task for 39 stores is a deliberate choice, not a default.
  const [form, setForm] = useState<FormState>(() => initialState(start, allDay, shown[0] ? [shown[0].code] : []));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((s) => ({ ...s, [k]: v }));

  const withStores = form.kind !== "reminder";
  const isAdmin = useAuthStore((s) => s.isSuperAdmin());
  /** Proof + approval apply to store tasks only. */
  const hasTaskRules = form.kind === "task" && form.scope !== "private";

  /** The payload, or the reasons it can't be built yet. */
  const result = useMemo((): { input: CreateItemInput | null; landed: Date | null; errors: Errors } => {
    const e: Errors = {};
    const title = form.title.trim();
    if (!title) e.title = t("errors.title");

    if (form.kind === "reminder") {
      let when: { inMinutes: number } | { at: Date } | null = null;
      let landed: Date | null = null;
      if (form.remind === "at") {
        const at = isDayKey(form.remindDate) && form.remindTime ? atTime(form.remindDate, form.remindTime) : null;
        const ahead = at ? (+at - Date.now()) / MINUTE : 0;
        if (!at || ahead < 1) e.remind = t("errors.remindPast");
        else if (ahead > MAX_REMIND_MINUTES) e.remind = t("errors.remindFar");
        else {
          when = { at };
          landed = at;
        }
      } else {
        when = { inMinutes: form.remind };
        landed = new Date(Date.now() + form.remind * MINUTE);
      }
      const input = Object.keys(e).length || !when ? null : ({ type: "reminder", title, when } satisfies CreateItemInput);
      return { input, landed, errors: e };
    }

    // Only chosen stores need a pick; public goes to every store, private to none.
    if (form.scope === "custom") {
      if (!form.stores.length) e.stores = t("errors.stores");
      else if (form.stores.length > FEED_MAX_STORES) e.stores = t("errors.storesMax", { n: FEED_MAX_STORES });
    }
    if (!isDayKey(form.date)) e.date = t("errors.date");

    if (!e.date) {
      if (form.kind === "event" && !form.allDay && (!form.startTime || !form.endTime || atTime(form.date, form.endTime) <= atTime(form.date, form.startTime))) {
        e.end = t("errors.endTime");
      }
      if (form.kind === "task") {
        const due = atTime(form.date, form.hasDeadline ? form.startTime : "23:59");
        if (+due < Date.now()) e.date = t("errors.taskPast");
      }
    }

    const shared = {
      title,
      scope: form.scope,
      stores: form.stores,
      date: form.date,
      description: form.notes,
      category: form.category,
      priority: form.priority,
    };
    const landed = isDayKey(form.date) ? atTime(form.date, form.kind === "event" && !form.allDay ? form.startTime : "00:00") : null;
    if (Object.keys(e).length) return { input: null, landed, errors: e };
    if (form.kind === "event") {
      return {
        input: { type: "event", ...shared, startTime: form.allDay ? undefined : form.startTime, endTime: form.allDay ? undefined : form.endTime },
        landed,
        errors: e,
      };
    }
    return {
      input: {
        type: "task",
        ...shared,
        startTime: form.hasDeadline ? form.startTime : undefined,
        proof: form.proof,
        requiresReview: form.requiresReview,
      },
      landed,
      errors: e,
    };
  }, [form, t]);

  const errors: Errors = submitted ? result.errors : {};

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setSubmitted(true);
    setServerError(null);
    if (!result.input || !result.landed) {
      if (result.errors.title) document.getElementById(`${ids}-title`)?.focus();
      return;
    }
    setSaving(true);
    try {
      await create(result.input);
      toast.success(t(`created.${form.kind}`), {
        // A reminder says WHEN it will ring, so it is clear it was set.
        description: form.kind === "reminder" ? `${result.input.title} · ${f.shortDate(result.landed)} · ${f.time(result.landed)}` : result.input.title,
      });
      onSaved({ start: result.landed });
    } catch (err) {
      const e = err instanceof CalendarWriteError ? err : null;
      // Toolbox's own 422 text says what is wrong ("Unknown store: …"); the rest get a plain sentence.
      // A 403 on "all stores" / "only me" means the right to make those is missing.
      const kind = e?.kind === "forbidden" && form.scope !== "custom" ? "forbiddenScope" : (e?.kind ?? "other");
      // On a 403 also show Toolbox's own words (the service falls back to "Not allowed." when it sent none),
      // so the exact missing permission is visible instead of only our summary.
      const said = e?.kind === "forbidden" && e.message && e.message !== "Not allowed." ? e.message : null;
      setServerError(
        e?.kind === "invalid" && e.message
          ? e.message
          : said
            ? `${t(`saveFailed.${kind}`)} ${t("saveFailed.serverSaid", { message: said })}`
            : t(`saveFailed.${kind}`),
      );
      setSaving(false);
    }
  };

  const fieldError = (msg?: string) =>
    msg ? (
      <p role="alert" className="text-xs text-destructive">
        {msg}
      </p>
    ) : null;

  const storeLine = options.length < 2 ? (shown[0]?.name ?? "") : null;

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader className="border-b px-5 pb-4 pt-5 text-start">
        <DialogTitle className="font-heading">{t("heading")}</DialogTitle>
        <DialogDescription>{t(`hint.${form.kind}`)}</DialogDescription>
      </DialogHeader>

      <div className="space-y-6 px-5 py-5">
        {/* Step 1: what */}
        <section className="space-y-4">
          <StepLabel n={1} label={t("steps.what")} />
          <div role="radiogroup" aria-label={t("kindLabel")} className="grid grid-cols-3 gap-2">
            {KINDS.map(({ key, icon: Icon }) => {
              const on = form.kind === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    set("kind", key);
                    setServerError(null);
                  }}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-1 rounded-lg border text-[13px] font-medium outline-none transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    on ? "border-foreground bg-foreground text-background" : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground dark:bg-input/30",
                  )}
                >
                  <Icon className="size-4" />
                  {t(`kinds.${key}`)}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${ids}-title`}>{tc("editor.fields.title")}</Label>
            <Input
              id={`${ids}-title`}
              dir="auto"
              autoFocus
              maxLength={TITLE_MAX}
              value={form.title}
              placeholder={t(`titlePlaceholder.${form.kind}`)}
              aria-invalid={!!errors.title}
              onChange={(e) => set("title", e.target.value)}
            />
            {fieldError(errors.title)}
          </div>

          {/* "All stores" and "Only me" exist for super admins only (Toolbox answers 403 to anyone else). */}
          {withStores && isAdmin && (
            <Segmented
              label={t("fields.scope")}
              value={form.scope}
              items={SCOPES.map((s) => ({ value: s, label: t(`scope.${s}`) }))}
              onChange={(v) => set("scope", v)}
            />
          )}

          {withStores && form.scope !== "custom" && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {form.scope === "private" ? <Lock className="size-3.5 shrink-0" /> : <Globe className="size-3.5 shrink-0" />}
              {t(`scopeHint.${form.scope}`)}
            </p>
          )}

          {withStores && form.scope === "custom" && (
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-stores`}>{t("fields.stores")}</Label>
              {storeLine != null ? (
                <p className="text-sm text-muted-foreground">{storeLine}</p>
              ) : (
                <StoreMultiSelect
                  id={`${ids}-stores`}
                  options={options}
                  value={form.stores}
                  onChange={(v) => set("stores", v)}
                  invalid={!!errors.stores}
                />
              )}
              {fieldError(errors.stores)}
            </div>
          )}

          {form.kind !== "reminder" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${ids}-category`}>
                  {t("fields.category")} <span className="font-normal text-muted-foreground">({tc("editor.optional")})</span>
                </Label>
                <Input
                  id={`${ids}-category`}
                  dir="auto"
                  maxLength={CATEGORY_MAX}
                  value={form.category}
                  placeholder={t("fields.categoryPlaceholder")}
                  onChange={(e) => set("category", e.target.value)}
                />
              </div>
              <Segmented
                label={t("fields.priority")}
                value={form.priority}
                items={PRIORITIES.map((p) => ({ value: p, label: t(`priorities.${p}`) }))}
                onChange={(v) => set("priority", v)}
              />
            </div>
          )}
        </section>

        {/* Step 2: when */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <StepLabel n={2} label={form.kind === "reminder" ? t("steps.remind") : t("steps.when")} />
            {form.kind === "event" && (
              <label htmlFor={`${ids}-allday`} className="flex cursor-pointer items-center gap-2 text-sm">
                {tc("allDay")}
                <Switch id={`${ids}-allday`} checked={form.allDay} onCheckedChange={(v) => set("allDay", v)} />
              </label>
            )}
            {form.kind === "task" && (
              <label htmlFor={`${ids}-deadline`} className="flex cursor-pointer items-center gap-2 text-sm">
                {t("fields.deadline")}
                <Switch id={`${ids}-deadline`} checked={form.hasDeadline} onCheckedChange={(v) => set("hasDeadline", v)} />
              </label>
            )}
          </div>

          {form.kind === "reminder" ? (
            <div className="space-y-3">
              <Segmented
                label={t("fields.remindIn")}
                value={form.remind}
                items={[
                  ...REMIND_PRESETS.map((m) => ({ value: m as number | "at", label: t(`remindIn.${m}`) })),
                  { value: "at" as const, label: t("remindIn.at") },
                ]}
                onChange={(v) => set("remind", v)}
              />
              {form.remind === "at" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("fields.date")}</Label>
                    <DatePicker value={form.remindDate} onChange={(v) => set("remindDate", v)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("fields.time")}</Label>
                    <TimePicker value={form.remindTime} onChange={(v) => set("remindTime", v)} />
                  </div>
                </div>
              )}
              {fieldError(errors.remind)}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-1.5">
                <Label>{t("fields.date")}</Label>
                <DatePicker value={form.date} onChange={(v) => set("date", v)} />
                {fieldError(errors.date)}
              </div>
              {form.kind === "event" && !form.allDay && (
                <>
                  <div className="space-y-1.5">
                    <Label>{tc("editor.fields.from")}</Label>
                    <TimePicker value={form.startTime} onChange={(v) => set("startTime", v)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{tc("editor.fields.to")}</Label>
                    <TimePicker value={form.endTime} onChange={(v) => set("endTime", v)} />
                  </div>
                  <div className="sm:col-span-3">{fieldError(errors.end)}</div>
                </>
              )}
              {form.kind === "task" && form.hasDeadline && (
                <div className="space-y-1.5">
                  <Label>{t("fields.dueTime")}</Label>
                  <TimePicker value={form.startTime} onChange={(v) => set("startTime", v)} />
                </div>
              )}
              {form.kind === "task" && !form.hasDeadline && (
                <p className="self-end pb-2 text-xs text-muted-foreground sm:col-span-2">{t("fields.endOfDay")}</p>
              )}
            </div>
          )}
        </section>

        {/* Step 3: how (store tasks — a private task is only done or not), details (events, tasks) */}
        {hasTaskRules && (
          <section className="space-y-4">
            <StepLabel n={3} label={t("steps.task")} />
            <Segmented
              label={t("fields.proof")}
              value={form.proof}
              items={[
                { value: "none", label: t("proof.none") },
                { value: "note", label: t("proof.note") },
              ]}
              onChange={(v) => set("proof", v)}
            />
            <label htmlFor={`${ids}-review`} className="flex cursor-pointer items-start justify-between gap-4">
              <span className="space-y-0.5">
                <span className="block text-sm font-medium leading-none">{t("fields.requiresReview")}</span>
                <span className="block text-xs text-muted-foreground">{t("fields.requiresReviewHint")}</span>
              </span>
              <Switch id={`${ids}-review`} checked={form.requiresReview} onCheckedChange={(v) => set("requiresReview", v)} />
            </label>
          </section>
        )}

        {form.kind !== "reminder" && (
          <section className="space-y-3">
            <StepLabel n={hasTaskRules ? 4 : 3} label={tc("editor.steps.details")} optional={tc("editor.optional")} />
            <Textarea
              aria-label={tc("editor.fields.notes")}
              dir="auto"
              rows={3}
              maxLength={NOTES_MAX}
              value={form.notes}
              placeholder={tc("editor.fields.notesPlaceholder")}
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
        )}

        {serverError && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        )}
      </div>

      <DialogFooter className="flex-row items-center gap-2 border-t px-5 py-3 sm:justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          {tc("editor.cancel")}
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t(`submit.${form.kind}`)}
        </Button>
      </DialogFooter>
    </form>
  );
}
