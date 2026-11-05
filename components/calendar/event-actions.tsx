"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AlarmClock, BellPlus, BellRing, Ban, Check, Loader2, Play, RotateCcw, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MINUTE } from "@/lib/calendar/dates";
import { feedPath } from "@/lib/calendar/feed-links";
import type { CalendarEvent } from "@/lib/calendar/types";
import {
  awaitingReview,
  canCancel,
  canRemind,
  isLiveReminder,
  isPrivate,
  PER_STORE_CANCEL,
  taskActionsFor,
  toolboxIdOf,
  type TaskAction,
} from "@/lib/calendar/toolbox-write";
import { CalendarWriteError } from "@/lib/api/services/calendar-toolbox.service";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useCalendarToolbox } from "@/lib/hooks/use-calendar-events";
import { usePeek } from "./event-peek";
import { useCalendarFormat } from "./use-calendar-format";

type Mode = null | "remind" | "snooze" | "note" | "reason" | "cancel";

const NOTE_MAX = 500;
const TITLE_MAX = 120;
/** "Remind me in…" and "Snooze for…" shortcuts, in minutes. */
const REMIND_PRESETS = [10, 60, 180] as const;
const SNOOZE_PRESETS = [10, 60, 180, 1440] as const;

function tomorrowAtNine(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

const BTN = "h-7 gap-1 px-2 text-xs";

/**
 * What Toolbox refused this user (`cancel|review:userId:toolboxId`). The feed
 * doesn't always say who created an item, so a refusal is the proof: that action
 * (Cancel, or Approve + Return) is never offered again for it until the page reloads.
 */
const denied = new Set<string>();

/**
 * What can be DONE with an event from its card, kept inside the card (no
 * dialogs: a dialog opened from a popover would count as "outside" it):
 *
 * - a task: start, submit (with a note when it asks for proof), approve or
 *   return (the creator's two; anyone else gets Toolbox's 403, said plainly);
 * - my reminder: snooze, done, remove;
 * - an event or task: cancel (creator only);
 * - any event: "Remind me".
 *
 * Choices that need a second step (a note, a time, a confirmation) open inline
 * and pin the card, so moving the pointer away can't lose what was typed.
 * After a write succeeds the card closes and the views reload.
 */
export function EventActions({
  ev,
  onDone,
  reminders,
}: {
  ev: CalendarEvent;
  onDone: () => void;
  /** Reminders already set for this event (from the loaded feed). */
  reminders?: readonly CalendarEvent[];
}) {
  const t = useTranslations("calendar.actions");
  const f = useCalendarFormat();
  const { pin } = usePeek();
  const toolbox = useCalendarToolbox();
  const user = useAuthStore((s) => s.user);
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  /** When the reminder just made fires, until the feed brings it back as one of `reminders`. */
  const [justSet, setJustSet] = useState<string | null>(null);

  const id = toolboxIdOf(ev);
  const viewer = user ? { id: user.id, name: user.name } : null;
  const cancelKey = id != null ? `cancel:${user?.id ?? ""}:${id}` : null;
  const reviewKey = id != null ? `review:${user?.id ?? ""}:${id}` : null;
  const reviewDenied = !!reviewKey && denied.has(reviewKey);
  // Approve and Return are the creator's: hidden from anyone else (see `mayBeCreator`).
  const taskActions = taskActionsFor(ev, viewer).filter((a) => !(reviewDenied && (a === "approve" || a === "return")));
  const liveReminder = isLiveReminder(ev);
  // Only the creator may cancel: hide the button from anyone else (see `canCancel`).
  const cancellable = canCancel(ev, viewer) && !(cancelKey && denied.has(cancelKey));
  const remindable = canRemind(ev);
  const waiting = awaitingReview(ev) && !taskActions.length;
  if (!taskActions.length && !liveReminder && !cancellable && !remindable && !waiting && !reminders?.length) return null;

  const whenLabel = (d: Date) => `${f.shortDate(d)} · ${f.time(d)}`;

  const needsNote = ev.extra?.proof === "note";

  const go = (next: Mode) => {
    if (next) pin();
    setText("");
    setAttempted(false);
    setMode(next);
  };

  const run = async (
    fn: () => Promise<void>,
    ok: string,
    {
      forbidden = "forbidden",
      onForbidden,
      description,
      after = onDone,
    }: {
      forbidden?: "forbidden" | "forbiddenReview" | "forbiddenCancel";
      /** Runs when Toolbox answers 403 (to take the offer away). */
      onForbidden?: () => void;
      /** Second line of the success toast. */
      description?: string;
      /** What happens once it worked (default: close the card). */
      after?: () => void;
    } = {},
  ) => {
    setBusy(true);
    try {
      await fn();
      toast.success(t(`done.${ok}`), description ? { description } : undefined);
      after();
      setBusy(false);
    } catch (err) {
      const e = err instanceof CalendarWriteError ? err : null;
      // Toolbox's own 422 text says what is wrong; anything else gets a plain sentence.
      toast.error(e?.kind === "invalid" && e.message ? e.message : t(`errors.${e?.kind === "forbidden" ? forbidden : (e?.kind ?? "other")}`));
      if (e?.kind === "forbidden") onForbidden?.();
      setBusy(false);
    }
  };

  const storeCode = ev.store.code;
  const storeName = ev.store.name || storeCode;
  // A store's copy of an event/task can be cancelled on its own once Toolbox supports it
  // (`PER_STORE_CANCEL`); until then Cancel is for every store and the dialog says so.
  // A private item has no store.
  const perStore = PER_STORE_CANCEL && !isPrivate(ev) && !!storeCode;
  const cancelsAll = !PER_STORE_CANCEL && !isPrivate(ev) && !!storeCode;
  const doCancel = (store: string | undefined) =>
    void run(() => toolbox.cancel(id!, store), "cancelEvent", {
      forbidden: "forbiddenCancel",
      onForbidden: () => {
        if (cancelKey) denied.add(cancelKey);
        go(null);
      },
    });
  const doTask =(action: TaskAction, body: { note?: string; reason?: string } = {}) =>
    run(() => toolbox.taskAction(id!, action, storeCode, body), action, {
      forbidden: action === "approve" || action === "return" ? "forbiddenReview" : "forbidden",
      onForbidden:
        action === "approve" || action === "return"
          ? () => {
              if (reviewKey) denied.add(reviewKey);
              go(null);
            }
          : undefined,
    });

  const onTaskAction = (action: TaskAction) => {
    if (action === "return") return go("reason");
    if (action === "submit" && needsNote) return go("note");
    void doTask(action);
  };

  // The card STAYS open after a reminder is set and says so in it (plus the toast with
  // the exact time): closing it would leave nothing on screen to show it worked.
  const remind = (when: { inMinutes: number } | { at: Date }) => {
    const at = "at" in when ? when.at : new Date(Date.now() + when.inMinutes * MINUTE);
    const label = whenLabel(at);
    return run(
      () =>
        toolbox.create({
          type: "reminder",
          title: f.title(ev).slice(0, TITLE_MAX),
          when,
          target: { ref: ev.id, title: f.title(ev).slice(0, TITLE_MAX), link: feedPath(ev) },
        }),
      "remind",
      {
        description: t("reminderSetFor", { when: label }),
        after: () => {
          setJustSet(label);
          setMode(null);
        },
      },
    );
  };

  const taskIcon: Record<TaskAction, ReactNode> = {
    start: <Play className="size-3" />,
    submit: <Send className="size-3" />,
    approve: <Check className="size-3" />,
    return: <Undo2 className="size-3" />,
    // A private task: just done, or not done again.
    done: <Check className="size-3" />,
    reopen: <RotateCcw className="size-3" />,
  };

  const preset = (label: string, onPick: () => void) => (
    <Button key={label} type="button" variant="outline" size="sm" className={BTN} disabled={busy} onClick={onPick}>
      {label}
    </Button>
  );

  const composer = (kind: "note" | "reason") => {
    const required = kind === "reason" || needsNote;
    const missing = attempted && required && !text.trim();
    return (
      <div className="space-y-2">
        <label className="block text-xs font-medium" htmlFor={`${ev.id}-${kind}`}>
          {t(kind === "note" ? "noteLabel" : "reasonLabel")}
        </label>
        <Textarea
          id={`${ev.id}-${kind}`}
          dir="auto"
          autoFocus
          rows={3}
          maxLength={NOTE_MAX}
          value={text}
          placeholder={t(kind === "note" ? "notePlaceholder" : "reasonPlaceholder")}
          aria-invalid={missing}
          onChange={(e) => setText(e.target.value)}
          className="min-h-0 resize-none text-xs"
        />
        {missing && (
          <p role="alert" className="text-xs text-destructive">
            {t(kind === "note" ? "noteRequired" : "reasonRequired")}
          </p>
        )}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            className={BTN}
            disabled={busy}
            onClick={() => {
              setAttempted(true);
              if (required && !text.trim()) return;
              void doTask(kind === "note" ? "submit" : "return", kind === "note" ? { note: text.trim() } : { reason: text.trim() });
            }}
          >
            {busy && <Loader2 className="size-3 animate-spin" />}
            {t("confirm")}
          </Button>
          <Button type="button" variant="ghost" size="sm" className={BTN} disabled={busy} onClick={() => go(null)}>
            {t("back")}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div data-slot="calendar-event-actions" className="space-y-2 border-t pt-2.5">
      {waiting && <p className="text-xs text-muted-foreground">{t("awaitingReview")}</p>}

      {/* Proof that a reminder exists: the ones in the feed, or (until it reloads) the one just made. */}
      {mode === null && (reminders?.length || justSet) ? (
        <ul className="space-y-1">
          {reminders?.length ? (
            reminders.map((r) => (
              <li key={r.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BellRing className="size-3 shrink-0" />
                <span className="tabular-nums">{t("reminderSetFor", { when: whenLabel(r.start) })}</span>
              </li>
            ))
          ) : (
            <li className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Check className="size-3 shrink-0" />
              <span className="tabular-nums">{t("reminderSetFor", { when: justSet! })}</span>
            </li>
          )}
        </ul>
      ) : null}

      {mode === null && (
        <div className="flex flex-wrap items-center gap-1.5">
          {taskActions.map((a, i) => (
            <Button
              key={a}
              type="button"
              size="sm"
              variant={i === 0 ? "default" : "outline"}
              className={BTN}
              disabled={busy}
              onClick={() => onTaskAction(a)}
            >
              {busy && i === 0 ? <Loader2 className="size-3 animate-spin" /> : taskIcon[a]}
              {t(`task.${a}`)}
            </Button>
          ))}

          {liveReminder && (
            <>
              <Button type="button" size="sm" className={BTN} disabled={busy} onClick={() => void run(() => toolbox.reminderAction(id!, "done"), "reminderDone")}>
                <Check className="size-3" />
                {t("reminderDone")}
              </Button>
              <Button type="button" variant="outline" size="sm" className={BTN} disabled={busy} onClick={() => go("snooze")}>
                <AlarmClock className="size-3" />
                {t("snooze")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(BTN, "text-muted-foreground")}
                disabled={busy}
                onClick={() => void run(() => toolbox.reminderAction(id!, "cancel"), "reminderCancel")}
              >
                {t("reminderCancel")}
              </Button>
            </>
          )}

          {remindable && (
            <Button type="button" variant="outline" size="sm" className={BTN} disabled={busy} onClick={() => go("remind")}>
              <BellPlus className="size-3" />
              {t("remindMe")}
            </Button>
          )}

          {cancellable && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(BTN, "ms-auto text-destructive hover:bg-destructive/10 hover:text-destructive")}
              disabled={busy}
              onClick={() => go("cancel")}
            >
              <Ban className="size-3" />
              {t(ev.feedType === "task" ? "cancelTask" : "cancelEvent")}
            </Button>
          )}
        </div>
      )}

      {mode === "remind" && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium">{t("remindIn")}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {REMIND_PRESETS.map((m) => preset(t(`presets.${m}`), () => void remind({ inMinutes: m })))}
            {preset(t("presets.tomorrow"), () => void remind({ at: tomorrowAtNine() }))}
            <Button type="button" variant="ghost" size="sm" className={BTN} disabled={busy} onClick={() => go(null)}>
              {t("back")}
            </Button>
          </div>
        </div>
      )}

      {mode === "snooze" && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium">{t("snoozeFor")}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {SNOOZE_PRESETS.map((m) => preset(t(`presets.${m}`), () => void run(() => toolbox.reminderAction(id!, "snooze", { minutes: m }), "snooze")))}
            <Button type="button" variant="ghost" size="sm" className={BTN} disabled={busy} onClick={() => go(null)}>
              {t("back")}
            </Button>
          </div>
        </div>
      )}

      {(mode === "note" || mode === "reason") && composer(mode)}

      {mode === "cancel" && (
        <div className="space-y-2">
          <p className="text-xs">
            {perStore ? t("cancelAskStores", { store: storeName }) : cancelsAll ? t("cancelAskAll", { store: storeName }) : t("cancelAsk")}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className={BTN}
              disabled={busy}
              onClick={() => doCancel(perStore ? storeCode : undefined)}
            >
              {busy && <Loader2 className="size-3 animate-spin" />}
              {perStore ? t("cancelThisStore", { store: storeName }) : t("cancelYes")}
            </Button>
            {/* A multi-store item can also be cancelled everywhere (no `stores` in the request). */}
            {perStore && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(BTN, "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive")}
                disabled={busy}
                onClick={() => doCancel(undefined)}
              >
                {t("cancelAllStores")}
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" className={BTN} disabled={busy} onClick={() => go(null)}>
              {t("keep")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
