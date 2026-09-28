"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertCircle, Loader2, Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useBreaksStore } from "@/lib/store/breaks.store";
import { useBreakMutations } from "@/lib/hooks/use-break-mutations";
import { parseBreakError } from "@/lib/break-logger/errors";
import { MINUTES_MAX, MINUTES_MIN, normaliseThresholds } from "@/lib/break-logger/payload";
import { AllowanceBar, useBreakErrorText, useFormatTime } from "./break-ui";

function parseMinutes(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw);
  return n >= MINUTES_MIN && n <= MINUTES_MAX ? n : null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Personal settings: the daily allowance (soft) and milestone thresholds.
 * Milestones save as a whole-list replace; the chips re-render from what the
 * server returns, since it silently de-dupes and sorts.
 */
export function SettingsView({
  onDirtyChange,
}: {
  /** Tells the page when either card has unsaved edits (for the tab dot). */
  onDirtyChange?: (dirty: boolean) => void;
} = {}) {
  const t = useTranslations("breaks");
  const errorText = useBreakErrorText();
  const formatTime = useFormatTime();
  const settings = useBreaksStore((s) => s.settings);
  const workDayStart = useBreaksStore((s) => s.today?.work_day.starts_at ?? null);
  const ready = useBreaksStore((s) => s.ready);
  const syncError = useBreaksStore((s) => s.syncError);
  const bootstrap = useBreaksStore((s) => s.bootstrap);
  const reloadMilestones = useBreaksStore((s) => s.reloadMilestones);
  const hasSettings = settings != null;

  // Fresh thresholds when Settings opens — another tab may have changed them.
  // Quiet on failure: the copy from `break-settings` is still shown.
  useEffect(() => {
    if (hasSettings) reloadMilestones().catch(() => {});
  }, [hasSettings, reloadMilestones]);
  const { saveAllowance, saveMilestones } = useBreakMutations();

  const [allowance, setAllowance] = useState("");
  const [allowanceError, setAllowanceError] = useState<string | null>(null);
  const [savingAllowance, setSavingAllowance] = useState(false);

  const [thresholds, setThresholds] = useState<number[]>([]);
  const [draft, setDraft] = useState("");
  const [milestoneError, setMilestoneError] = useState<string | null>(null);
  const [savingMilestones, setSavingMilestones] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setAllowance(String(settings.daily_allowance_minutes));
    setThresholds(settings.thresholds);
  }, [settings]);

  const allowanceDirty = !!settings && allowance !== String(settings.daily_allowance_minutes);
  const milestonesDirty =
    !!settings &&
    JSON.stringify(normaliseThresholds(thresholds)) !== JSON.stringify(settings.thresholds);
  const dirty = allowanceDirty || milestonesDirty;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Clear the tab dot if the view unmounts mid-edit (edits are discarded).
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  if (!settings) {
    if (!ready) {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-52" />
          <Skeleton className="h-52" />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm">{syncError ? errorText(syncError) : t("loadError")}</p>
        <Button variant="outline" size="sm" onClick={() => void bootstrap()}>
          <RotateCcw className="me-1.5 h-3.5 w-3.5" />
          {t("actions.retry")}
        </Button>
      </div>
    );
  }

  const max = settings.max_milestones;
  // Preview against the allowance being typed, falling back to the saved one.
  const previewAllowance = parseMinutes(allowance) ?? settings.daily_allowance_minutes;
  const atOrPastAllowance = thresholds.some((m) => m >= previewAllowance);

  async function submitAllowance() {
    const minutes = parseMinutes(allowance);
    if (minutes == null) {
      setAllowanceError(t("settings.rangeError"));
      return;
    }
    setSavingAllowance(true);
    setAllowanceError(null);
    try {
      await saveAllowance(minutes);
      toast.success(t("settings.saved"));
    } catch (err) {
      const e = parseBreakError(err);
      if (e.code === "CANCELLED") return;
      setAllowanceError(e.fieldErrors.daily_allowance_minutes ?? errorText(e));
    } finally {
      setSavingAllowance(false);
    }
  }

  function addDraft() {
    const minutes = parseMinutes(draft);
    if (minutes == null) {
      setMilestoneError(t("settings.rangeError"));
      return;
    }
    if (thresholds.includes(minutes)) {
      setMilestoneError(t("settings.duplicate"));
      return;
    }
    if (thresholds.length >= max) {
      setMilestoneError(t("settings.tooMany", { max }));
      return;
    }
    setThresholds(normaliseThresholds([...thresholds, minutes]));
    setDraft("");
    setMilestoneError(null);
  }

  async function submitMilestones() {
    setSavingMilestones(true);
    setMilestoneError(null);
    try {
      const saved = await saveMilestones(normaliseThresholds(thresholds));
      setThresholds(saved);
      toast.success(t("settings.milestonesSaved"));
    } catch (err) {
      const e = parseBreakError(err);
      if (e.code === "CANCELLED") return;
      const fieldMsg = Object.entries(e.fieldErrors).find(([k]) => k.startsWith("thresholds"))?.[1];
      setMilestoneError(fieldMsg ?? errorText(e));
    } finally {
      setSavingMilestones(false);
    }
  }

  const cutoff = `${pad(settings.work_day.cutoff_hour)}:00`;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Allowance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("settings.allowanceTitle")}</CardTitle>
            <CardDescription>{t("settings.allowanceDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-2"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void submitAllowance();
              }}
            >
              <Label htmlFor="break-allowance">{t("settings.allowanceLabel")}</Label>
              <div className="flex gap-2">
                <Input
                  id="break-allowance"
                  type="number"
                  inputMode="numeric"
                  min={MINUTES_MIN}
                  max={MINUTES_MAX}
                  step={1}
                  value={allowance}
                  aria-invalid={!!allowanceError}
                  aria-describedby={allowanceError ? "break-allowance-error" : undefined}
                  onChange={(e) => {
                    setAllowance(e.target.value);
                    setAllowanceError(null);
                  }}
                  className="w-32 tabular-nums"
                />
                <Button type="submit" disabled={!allowanceDirty || savingAllowance}>
                  {savingAllowance && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
                  {savingAllowance ? t("settings.saving") : t("settings.save")}
                </Button>
              </div>
              {allowanceError && (
                <p id="break-allowance-error" className="text-xs text-destructive">
                  {allowanceError}
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Milestones */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("settings.milestonesTitle")}</CardTitle>
            <CardDescription>{t("settings.milestonesDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex min-h-8 flex-wrap gap-1.5">
              {thresholds.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("settings.milestonesOff")}</p>
              ) : (
                thresholds.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 ps-2.5 pe-1 text-sm tabular-nums"
                  >
                    {t("minutes", { minutes: m })}
                    <button
                      type="button"
                      aria-label={t("settings.removeMilestone", { minutes: m })}
                      onClick={() => {
                        setThresholds(thresholds.filter((x) => x !== m));
                        setMilestoneError(null);
                      }}
                      className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>

            <form
              className="flex gap-2"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                addDraft();
              }}
            >
              <Input
                type="number"
                inputMode="numeric"
                min={MINUTES_MIN}
                max={MINUTES_MAX}
                step={1}
                value={draft}
                placeholder={t("settings.milestonePlaceholder")}
                aria-label={t("settings.milestonePlaceholder")}
                aria-invalid={!!milestoneError}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setMilestoneError(null);
                }}
                className="w-32 tabular-nums"
                disabled={thresholds.length >= max}
              />
              <Button type="submit" variant="outline" disabled={!draft || thresholds.length >= max}>
                <Plus className="me-1 h-4 w-4" />
                {t("settings.addMilestone")}
              </Button>
            </form>
            {milestoneError && <p className="text-xs text-destructive">{milestoneError}</p>}

            {thresholds.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  {t("settings.milestonePreview", { allowance: previewAllowance })}
                </p>
                <AllowanceBar
                  countedMinutes={0}
                  allowanceMinutes={previewAllowance}
                  thresholds={thresholds}
                  className="bg-muted"
                />
                <div className="relative h-4 text-[10px] tabular-nums text-muted-foreground">
                  {thresholds
                    .filter((m) => m < previewAllowance)
                    .map((m) => (
                      <span
                        key={m}
                        className="absolute -translate-x-1/2 rtl:translate-x-1/2"
                        style={{ insetInlineStart: `${(m / previewAllowance) * 100}%` }}
                      >
                        {t("minutes", { minutes: m })}
                      </span>
                    ))}
                  <span className="absolute end-0">
                    {t("minutes", { minutes: previewAllowance })}
                  </span>
                </div>
                {atOrPastAllowance && (
                  <p className="text-xs text-muted-foreground">
                    {t("settings.milestoneAtAllowance", { allowance: previewAllowance })}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <p className="text-xs text-muted-foreground">
                {milestonesDirty ? t("settings.unsaved") : t("settings.maxMilestones", { max })}
              </p>
              <Button
                size="sm"
                onClick={() => void submitMilestones()}
                disabled={!milestonesDirty || savingMilestones}
              >
                {savingMilestones && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
                {savingMilestones ? t("settings.saving") : t("settings.save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        {workDayStart
          ? t("settings.workDayLocal", {
              start: formatTime(workDayStart),
              cutoff,
              tz: settings.work_day.timezone,
            })
          : t("settings.workDay", { cutoff, tz: settings.work_day.timezone })}
      </p>
    </div>
  );
}
