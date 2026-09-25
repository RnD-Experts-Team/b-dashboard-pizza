"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  Loader2,
  RotateCcw,
  Square,
  StickyNote,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useBreaksStore } from "@/lib/store/breaks.store";
import { breaksService } from "@/lib/api/services/breaks.service";
import { BreakError, parseBreakError } from "@/lib/break-logger/errors";
import { CUSTOM_LABEL_MAX, NOTE_MAX, cleanLabel } from "@/lib/break-logger/payload";
import { formatClock } from "@/lib/break-logger/work-date";
import type { BreakRunningRef, BreakType } from "@/types/breaks.types";
import { BreakTypePicker } from "./break-type-picker";
import {
  AllowanceBar,
  CountedBadge,
  useBreakErrorText,
  useFormatTime,
} from "./break-ui";

const LAST_TYPE_KEY = "breaks:last-type-id";

function readLastTypeId(): number | null {
  try {
    const raw = localStorage.getItem(LAST_TYPE_KEY);
    return raw ? Number(raw) || null : null;
  } catch {
    return null;
  }
}

function writeLastTypeId(id: number) {
  try {
    localStorage.setItem(LAST_TYPE_KEY, String(id));
  } catch {
    // UI convenience only — ignore storage failures.
  }
}

interface PendingSwitch {
  running: BreakRunningRef;
  next: BreakType;
  label?: string;
}

/**
 * Body of the topbar break popover. Two states:
 *
 *  - idle:    today's allowance + the catalogue; one tap starts a break
 *             (a custom type asks for its label first).
 *  - running: the live clock, stop, and a quick note.
 *
 * ALREADY_ON_BREAK is a normal flow here (a second tab, a stale view), so it
 * becomes a "switch?" confirmation rather than an error toast.
 */
export function BreakPopoverBody({
  liveCountedMinutes,
  runningSeconds,
  onClose,
}: {
  liveCountedMinutes: number;
  runningSeconds: number;
  onClose: () => void;
}) {
  const t = useTranslations("breaks");
  const errorText = useBreakErrorText();
  const formatTime = useFormatTime();
  const locale = (useParams()?.locale as string) ?? "en";

  const settings = useBreaksStore((s) => s.settings);
  const types = useBreaksStore((s) => s.types);
  const active = useBreaksStore((s) => s.active);
  const ready = useBreaksStore((s) => s.ready);
  const syncError = useBreaksStore((s) => s.syncError);
  const start = useBreaksStore((s) => s.start);
  const stop = useBreaksStore((s) => s.stop);
  const switchTo = useBreaksStore((s) => s.switchTo);
  const bootstrap = useBreaksStore((s) => s.bootstrap);

  const [busy, setBusy] = useState<"start" | "stop" | "note" | null>(null);
  const [error, setError] = useState<BreakError | null>(null);
  const [customType, setCustomType] = useState<BreakType | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const [labelError, setLabelError] = useState<string | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [lastTypeId, setLastTypeId] = useState<number | null>(null);

  useEffect(() => setLastTypeId(readLastTypeId()), []);

  // A break that started/ended elsewhere invalidates whatever sub-view is open.
  useEffect(() => {
    setCustomType(null);
    setPendingSwitch(null);
    setNoteOpen(false);
    setError(null);
  }, [active?.id]);

  const allowance = settings?.daily_allowance_minutes ?? 0;
  const over = liveCountedMinutes > allowance;
  const lastType = types.find((x) => x.id === lastTypeId) ?? null;

  async function doStart(type: BreakType, label?: string) {
    setBusy("start");
    setError(null);
    setLabelError(null);
    try {
      await start(type.id, label);
      writeLastTypeId(type.id);
      setLastTypeId(type.id);
      setCustomType(null);
      setCustomLabel("");
    } catch (err) {
      const e = parseBreakError(err);
      if (e.code === "ALREADY_ON_BREAK" && e.running) {
        setPendingSwitch({ running: e.running, next: type, label });
      } else if (e.code === "BREAK_CUSTOM_LABEL_REQUIRED" || e.code === "BREAK_CUSTOM_LABEL_NOT_ALLOWED") {
        setLabelError(errorText(e));
      } else if (e.code !== "CANCELLED") {
        setError(e);
      }
    } finally {
      setBusy(null);
    }
  }

  function onPick(type: BreakType) {
    if (type.requires_custom_label) {
      setCustomType(type);
      setCustomLabel("");
      setLabelError(null);
      return;
    }
    void doStart(type);
  }

  function submitCustom() {
    if (!customType) return;
    const label = cleanLabel(customLabel);
    if (!label) {
      setLabelError(t("errors.BREAK_CUSTOM_LABEL_REQUIRED"));
      return;
    }
    void doStart(customType, label);
  }

  async function confirmSwitch() {
    if (!pendingSwitch) return;
    setBusy("start");
    setError(null);
    try {
      await switchTo(pendingSwitch.running.id, pendingSwitch.next.id, pendingSwitch.label);
      writeLastTypeId(pendingSwitch.next.id);
      setPendingSwitch(null);
    } catch (err) {
      const e = parseBreakError(err);
      setPendingSwitch(null);
      if (e.code !== "CANCELLED") setError(e);
    } finally {
      setBusy(null);
    }
  }

  async function doStop() {
    setBusy("stop");
    setError(null);
    try {
      await stop();
    } catch (err) {
      const e = parseBreakError(err);
      if (e.code !== "CANCELLED") setError(e);
    } finally {
      setBusy(null);
    }
  }

  async function saveNote() {
    if (!active) return;
    const body = note.trim();
    if (!body) return;
    setBusy("note");
    setError(null);
    try {
      await breaksService.addNote(active.id, body);
      toast.success(t("notes.added"));
      void useBreaksStore.getState().refresh();
      setNote("");
      setNoteOpen(false);
    } catch (err) {
      const e = parseBreakError(err);
      if (e.code !== "CANCELLED") setError(e);
    } finally {
      setBusy(null);
    }
  }

  /* ── Loading / hard failure ─────────────────────────────────────── */

  if (!ready || (!settings && !syncError)) {
    return (
      <div className="space-y-3 p-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-sm">{syncError ? errorText(syncError) : t("loadError")}</p>
        <Button size="sm" variant="outline" onClick={() => void bootstrap()}>
          <RotateCcw className="me-1.5 h-3.5 w-3.5" />
          {t("actions.retry")}
        </Button>
      </div>
    );
  }

  /* ── Switch confirmation ────────────────────────────────────────── */

  if (pendingSwitch) {
    return (
      <div className="space-y-3" role="alertdialog" aria-labelledby="break-switch-title">
        <p id="break-switch-title" className="font-heading text-sm font-semibold">
          {t("switch.title")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("switch.description", {
            label: pendingSwitch.running.label,
            time: formatTime(pendingSwitch.running.started_at),
            next: pendingSwitch.label ?? pendingSwitch.next.name,
          })}
        </p>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setPendingSwitch(null)} disabled={busy != null}>
            {t("switch.cancel")}
          </Button>
          <Button size="sm" onClick={() => void confirmSwitch()} disabled={busy != null}>
            {busy === "start" && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
            {t("switch.confirm")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Allowance — always first: it's the number people glance for. */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-medium tabular-nums">
            {t("allowance.used", { used: liveCountedMinutes, allowance })}
          </span>
          <span
            className={cn(
              "tabular-nums",
              over ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground"
            )}
          >
            {over
              ? t("allowance.over", { minutes: liveCountedMinutes - allowance })
              : t("allowance.left", { minutes: allowance - liveCountedMinutes })}
          </span>
        </div>
        <AllowanceBar
          countedMinutes={liveCountedMinutes}
          allowanceMinutes={allowance}
          thresholds={settings.thresholds}
        />
        {over && (
          <p className="text-[11px] leading-snug text-muted-foreground">{t("allowance.softLimit")}</p>
        )}
      </div>

      {active ? (
        /* ── Running ─────────────────────────────────────────────── */
        <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 dark:border-amber-400/20 dark:bg-amber-500/10">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                {t("timer.onBreak")}
              </p>
              <p className="truncate font-medium">{active.label}</p>
              <p className="text-xs text-muted-foreground">
                {t("timer.since", { time: formatTime(active.started_at) })}
              </p>
            </div>
            <span className="font-heading text-2xl font-bold tabular-nums" aria-live="off">
              {formatClock(runningSeconds)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <CountedBadge counted={active.counts_toward_limit} />
            {active.belongs_to_previous_work_day && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 px-1.5 text-[10px] font-medium text-sky-700 dark:text-sky-400"
                title={t("timer.belongsToYesterdayHint")}
              >
                <CalendarClock className="h-3 w-3" />
                {t("timer.belongsToYesterday")}
              </span>
            )}
          </div>
          {active.belongs_to_previous_work_day && (
            <p className="text-[11px] leading-snug text-muted-foreground">
              {t("timer.belongsToYesterdayHint")}
            </p>
          )}

          {noteOpen ? (
            <div className="space-y-1.5">
              <Textarea
                autoFocus
                value={note}
                maxLength={NOTE_MAX}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("notes.placeholder")}
                className="min-h-16 text-sm"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {t("notes.count", { count: note.length, max: NOTE_MAX })}
                </span>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => setNoteOpen(false)}>
                    {t("timer.back")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!note.trim() || busy != null}
                    onClick={() => void saveNote()}
                  >
                    {busy === "note" && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
                    {t("notes.add")}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
                onClick={() => void doStop()}
                disabled={busy != null}
              >
                {busy === "stop" ? (
                  <Loader2 className="me-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Square className="me-1.5 h-3.5 w-3.5 fill-current" />
                )}
                {busy === "stop" ? t("timer.stopping") : t("timer.stop")}
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label={t("timer.addNote")}
                title={t("timer.addNote")}
                onClick={() => setNoteOpen(true)}
                disabled={busy != null}
              >
                <StickyNote className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      ) : customType ? (
        /* ── Custom label step ───────────────────────────────────── */
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitCustom();
          }}
        >
          <label htmlFor="break-custom-label" className="text-xs font-medium">
            {t("timer.customLabel")}
          </label>
          <Input
            id="break-custom-label"
            autoFocus
            value={customLabel}
            maxLength={CUSTOM_LABEL_MAX}
            placeholder={t("timer.customLabelPlaceholder")}
            aria-invalid={!!labelError}
            aria-describedby={labelError ? "break-custom-label-error" : undefined}
            onChange={(e) => {
              setCustomLabel(e.target.value);
              setLabelError(null);
            }}
          />
          {labelError && (
            <p id="break-custom-label-error" className="text-xs text-destructive">
              {labelError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setCustomType(null)}>
              {t("timer.back")}
            </Button>
            <Button type="submit" size="sm" disabled={busy != null}>
              {busy === "start" && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
              {t("timer.start")}
            </Button>
          </div>
        </form>
      ) : (
        /* ── Idle: pick & go ─────────────────────────────────────── */
        <div className="space-y-3">
          {lastType && !lastType.requires_custom_label && (
            <Button
              className="w-full justify-start"
              onClick={() => void doStart(lastType)}
              disabled={busy != null}
            >
              {busy === "start" ? (
                <Loader2 className="me-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="me-1.5 h-4 w-4" />
              )}
              {t("timer.quickStart", { label: lastType.name })}
            </Button>
          )}
          <div className="space-y-2">
            <p className="text-xs font-medium">{t("timer.pickType")}</p>
            <BreakTypePicker types={types} onSelect={onPick} disabled={busy != null} />
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{errorText(error)}</span>
          {error.retryable && (
            <button
              type="button"
              className="shrink-0 font-medium underline underline-offset-2"
              onClick={() => {
                setError(null);
                void useBreaksStore.getState().refresh();
              }}
            >
              {t("actions.retry")}
            </button>
          )}
        </div>
      )}

      <div className="border-t pt-2">
        <Link
          href={`/${locale}/dashboard/break-logger`}
          prefetch={false}
          onClick={onClose}
          className="flex items-center justify-between rounded-md px-1 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("openPage")}
          <ArrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
        </Link>
      </div>
    </div>
  );
}
