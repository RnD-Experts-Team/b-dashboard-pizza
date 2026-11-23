"use client";

import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, BellRing, CalendarPlus, Check, Globe, ListChecks, Loader2, Lock, Play, Send, UsersRound, type LucideIcon } from "lucide-react";
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
import { PRIORITIES, SCOPES, type CalendarPerson, type CreateItemInput, type Priority, type Scope } from "@/lib/calendar/toolbox-write";
import { useAuthStore } from "@/lib/auth/auth.store";
import { CalendarWriteError } from "@/lib/api/services/calendar-toolbox.service";
import { useCalendarStoreOptions, useCalendarStores, useCalendarToolbox } from "@/lib/hooks/use-calendar-events";
import { PEOPLE_MAX, PeopleMultiSelect, runsAnyOf } from "./people-multi-select";
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
  /** Events and tasks: chosen stores (everyone), every store, only me or chosen people (super admin). */
  scope: Scope;
  stores: string[];
  /**
   * "Chosen people": the stores whose managers are offered (picked first, in their own
   * field). Only a filter for the manager field — never sent: a people item has no stores.
   */
  peopleStores: string[];
  /** "Chosen people": the store managers picked (kept whole, so their names show whatever the search). */
  people: CalendarPerson[];
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

type Errors = Partial<Record<"title" | "stores" | "peopleStores" | "people" | "date" | "end" | "remind", string>>;

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
    peopleStores: [],
    people: [],
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

/** A segmented choice (one of several): a soft track with the chosen one lifted. Module-level so it keeps its identity, and its focus, between renders. */
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
      <div role="radiogroup" aria-label={label} className="flex w-fit max-w-full flex-wrap gap-0.5 rounded-lg bg-muted/60 p-0.5">
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
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium outline-none transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                on ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
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

/** A section's title, with an optional control on its right (a switch). */
function SectionTitle({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-3">
      <h3 className="font-heading text-sm font-semibold">{title}</h3>
      {aside}
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

  // Events and tasks are for a super admin only (user-requested 2026-11-23); everyone else can set
  // a reminder for themselves, so that is all their form offers (and where it starts).
  const isAdmin = useAuthStore((s) => s.isSuperAdmin());
  const kinds = isAdmin ? KINDS : KINDS.filter((k) => k.key === "reminder");

  // Starts with ONE store (the first the calendar shows), never every shown store:
  // an event or task for 39 stores is a deliberate choice, not a default.
  const [form, setForm] = useState<FormState>(() => ({
    ...initialState(start, allDay, shown[0] ? [shown[0].code] : []),
    kind: isAdmin ? "event" : "reminder",
  }));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  /** Toolbox's 422 per-field messages ("Not a store manager: 30."), shown under their field. */
  const [serverFields, setServerFields] = useState<Partial<Record<"people" | "stores", string>>>({});
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((s) => ({ ...s, [k]: v }));

  const withStores = form.kind !== "reminder";
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

    // Chosen stores and chosen people need a pick; public goes to every store, private to none.
    if (form.scope === "custom") {
      if (!form.stores.length) e.stores = t("errors.stores");
      else if (form.stores.length > FEED_MAX_STORES) e.stores = t("errors.storesMax", { n: FEED_MAX_STORES });
    }
    if (form.scope === "people") {
      if (!form.peopleStores.length && !form.people.length) e.peopleStores = t("errors.peopleStores");
      else if (!form.people.length) e.people = t("errors.people");
      else if (form.people.length > PEOPLE_MAX) e.people = t("errors.peopleMax", { n: PEOPLE_MAX });
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
      people: form.people.map((p) => p.id),
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
    setServerFields({});
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
      // A 422 about the picked people or stores also goes under that field.
      if (e?.kind === "invalid") setServerFields({ people: e.fields.people?.[0], stores: e.fields.stores?.[0] });
      // Toolbox's own 422 text says what is wrong ("Unknown store: …"); the rest get a plain sentence.
      // A 403 on "all stores" / "only me" / "chosen people" means the right to make those is missing.
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
  const storeNames = useMemo(() => new Map(options.map((o) => [o.code, o.name])), [options]);

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader className="flex flex-col gap-4 border-b px-6 pb-4 pt-5 text-start sm:flex-row sm:items-center sm:justify-between sm:pe-14">
        <div className="min-w-0 space-y-1">
          <DialogTitle className="font-heading">{t("heading")}</DialogTitle>
          <DialogDescription>{t(`hint.${form.kind}`)}</DialogDescription>
        </div>
        {kinds.length > 1 && (
        <div role="radiogroup" aria-label={t("kindLabel")} className="inline-flex w-fit shrink-0 gap-0.5 rounded-lg bg-muted/60 p-0.5">
          {kinds.map(({ key, icon: Icon }) => {
            const on = form.kind === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  // "Chosen people" is for tasks only (user-requested 2026-11-23): leaving tasks drops it.
                  setForm((s) => ({ ...s, kind: key, scope: key !== "task" && s.scope === "people" ? "custom" : s.scope }));
                  setServerError(null);
                }}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium outline-none transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  on ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {t(`kinds.${key}`)}
              </button>
            );
          })}
        </div>
        )}
      </DialogHeader>

      {/* Two columns from lg: what it is and who gets it on the left, when and how it moves on the right —
          wide enough that the dialog doesn't need to scroll. */}
      <div className="grid gap-x-10 gap-y-6 px-6 py-4 lg:grid-cols-2">
        <div className="space-y-4">
          <SectionTitle title={t("steps.what")} />

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

          {/* "All stores", "Only me" and "Chosen people" exist for super admins only (Toolbox answers 403 to anyone else). */}
          {withStores && isAdmin && (
            <Segmented
              label={t("fields.scope")}
              value={form.scope}
              items={SCOPES.filter((s) => s !== "people" || form.kind === "task").map((s) => ({ value: s, label: t(`scope.${s}`) }))}
              onChange={(v) => set("scope", v)}
            />
          )}

          {withStores && form.scope !== "custom" && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {form.scope === "private" ? (
                <Lock className="size-3.5 shrink-0" />
              ) : form.scope === "people" ? (
                <UsersRound className="size-3.5 shrink-0" />
              ) : (
                <Globe className="size-3.5 shrink-0" />
              )}
              {t(`scopeHint.${form.scope}`)}
            </p>
          )}

          {/* Chosen people: store managers by name, instead of stores (FRONTEND_CALENDAR_CHANGES 2026-11-18).
              Two separate fields (user-requested 2026-11-22): the stores first, then their managers. */}
          {withStores && form.scope === "people" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor={`${ids}-people-stores`}>{t("fields.peopleStores")}</Label>
                <StoreMultiSelect
                  id={`${ids}-people-stores`}
                  options={options}
                  value={form.peopleStores}
                  onChange={(next) =>
                    // A manager stays picked only while one of their stores still is.
                    setForm((s) => {
                      const keep = new Set(next);
                      return { ...s, peopleStores: next, people: s.people.filter((p) => runsAnyOf(p, keep)) };
                    })
                  }
                  invalid={!!errors.peopleStores}
                />
                {fieldError(errors.peopleStores)}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${ids}-people`}>{t("fields.people")}</Label>
                <PeopleMultiSelect
                  id={`${ids}-people`}
                  value={form.people}
                  onChange={(v) => {
                    set("people", v);
                    setServerFields((s) => ({ ...s, people: undefined }));
                  }}
                  stores={form.peopleStores}
                  storeNames={storeNames}
                  invalid={!!(errors.people ?? serverFields.people)}
                />
                {fieldError(errors.people ?? serverFields.people)}
              </div>
            </>
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
                  invalid={!!(errors.stores ?? serverFields.stores)}
                />
              )}
              {fieldError(errors.stores ?? serverFields.stores)}
            </div>
          )}

          {form.kind !== "reminder" && (
            <>
              {/* The type takes what the priority switch leaves, so the four priorities stay on one line. */}
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
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
            </>
          )}
        </div>

        <div className="space-y-4">
          <SectionTitle
            title={form.kind === "reminder" ? t("steps.remind") : t("steps.when")}
            aside={
              form.kind === "event" ? (
                <label htmlFor={`${ids}-allday`} className="flex cursor-pointer items-center gap-2 text-sm">
                  {tc("allDay")}
                  <Switch id={`${ids}-allday`} checked={form.allDay} onCheckedChange={(v) => set("allDay", v)} />
                </label>
              ) : form.kind === "task" ? (
                <label htmlFor={`${ids}-deadline`} className="flex cursor-pointer items-center gap-2 text-sm">
                  {t("fields.deadline")}
                  <Switch id={`${ids}-deadline`} checked={form.hasDeadline} onCheckedChange={(v) => set("hasDeadline", v)} />
                </label>
              ) : undefined
            }
          />

          {form.kind === "reminder" ? (
            <div className="space-y-4">
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
                <div className="grid gap-4 sm:grid-cols-2">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={cn("space-y-1.5", form.kind === "event" && !form.allDay && "sm:col-span-2")}>
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
                  <div className="sm:col-span-2 empty:hidden">{fieldError(errors.end)}</div>
                </>
              )}
              {form.kind === "task" && form.hasDeadline && (
                <div className="space-y-1.5">
                  <Label>{t("fields.dueTime")}</Label>
                  <TimePicker value={form.startTime} onChange={(v) => set("startTime", v)} />
                </div>
              )}
              {form.kind === "task" && !form.hasDeadline && (
                <p className="self-end pb-2 text-xs text-muted-foreground">{t("fields.endOfDay")}</p>
              )}
            </div>
          )}

          {/* How a store task moves (a private task is only done or not): the proof it asks for, who approves,
              and the signs it will show along the way — the same icons as on the calendar. */}
          {hasTaskRules && (
            <div className="space-y-4 border-t pt-5">
              <SectionTitle title={t("steps.task")} />
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
                  <span className="block text-xs text-muted-foreground">
                    {t(form.scope === "people" ? "fields.requiresReviewHintPeople" : "fields.requiresReviewHint")}
                  </span>
                </span>
                <Switch id={`${ids}-review`} checked={form.requiresReview} onCheckedChange={(v) => set("requiresReview", v)} />
              </label>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{t("flow.title")}</span>
                <span className="inline-flex items-center gap-1">
                  <Play className="size-3" aria-hidden />
                  {tc("signs.started")}
                </span>
                <ArrowRight className="size-3 rtl:rotate-180" aria-hidden />
                <span className="inline-flex items-center gap-1">
                  <Send className="size-3" aria-hidden />
                  {form.requiresReview ? tc("signs.submitted") : t("flow.submit")}
                </span>
                <ArrowRight className="size-3 rtl:rotate-180" aria-hidden />
                <span className="inline-flex items-center gap-1">
                  <Check className="size-3" aria-hidden />
                  {form.requiresReview ? tc("signs.approved") : t("flow.autoDone")}
                </span>
              </div>
            </div>
          )}

          {/* Details sit under the date and rules (right column): the left column is the tall one
              (title, who, stores, managers, type), so this keeps the whole form on one screen. */}
          {form.kind !== "reminder" && (
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor={`${ids}-notes`}>
                  {tc("editor.steps.details")} <span className="font-normal text-muted-foreground">({tc("editor.optional")})</span>
                </Label>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {form.notes.length}/{NOTES_MAX}
                </span>
              </div>
              <Textarea
                id={`${ids}-notes`}
                dir="auto"
                rows={form.kind === "task" ? 2 : 3}
                maxLength={NOTES_MAX}
                value={form.notes}
                placeholder={tc("editor.fields.notesPlaceholder")}
                onChange={(e) => set("notes", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
                }}
                className="resize-none"
              />
            </div>
          )}
        </div>
      </div>

      {serverError && (
        <p role="alert" className="mx-6 mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      )}

      <DialogFooter className="flex-row items-center gap-2 border-t px-6 py-3 sm:justify-end">
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
