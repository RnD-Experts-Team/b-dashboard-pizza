"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { StarPicker } from "@/components/shared/star-picker";
import { MinAgeBadge, MinorBadge } from "@/components/skills/skill-badges";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useEmployeeSkills } from "@/lib/hooks/use-employee-skills";
import type { SchedulingError } from "@/lib/scheduling/errors";
import { cn } from "@/lib/utils";
import type { EmployeeSkillRating } from "@/types/skills.types";

const NOTES_MAX = 2000;
const SKELETON_ROWS = 6;

const AMBER_ALERT = "border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/15";

/**
 * The employee profile's Skills tab: every skill with stars and notes.
 *
 * A minor rated on a skill with a minimum age (Dough, Landing) gets an alert
 * at the top and on the row. Rating them is still allowed — the warning is
 * shown before saving, never a refusal.
 */
export function EmployeeSkillsPanel({
  storeCode,
  employeeId,
}: {
  /** The store CODE from the profile URL ("03795-00001"). */
  storeCode: string;
  employeeId: string;
}) {
  const t = useTranslations("skills");
  const { canAccessRoute } = useAuthStore();
  const { data, isLoading, error, refetch, rate, remove } = useEmployeeSkills(storeCode, employeeId);

  const canRate = canAccessRoute({
    service: "Operations",
    method: "POST",
    path: "/v1/stores/*/employees/*/skills/*",
    storeId: storeCode,
  });

  if (isLoading && !data) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-md" />
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{t("loadFailed")}</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-2">
          {error.message}
          <Button size="sm" variant="outline" onClick={refetch}>
            <RotateCcw className="me-1.5 h-3.5 w-3.5" />
            {t("retry")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const alerted = data.skills.filter((s) => s.alert);
  const hasRestrictedSkills = data.skills.some((s) => s.skill.min_age !== null);

  return (
    <div className="space-y-4">
      {alerted.length > 0 && (
        <Alert className={AMBER_ALERT}>
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle>{t("minorAlertTitle", { count: alerted.length })}</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 ps-4">
              {alerted.map((s) => (
                <li key={s.skill.id}>
                  <span className="font-medium">{s.skill.name}</span>
                  {s.skill.restriction_note && <> — {s.skill.restriction_note}</>}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {data.employee.is_minor === true && <MinorBadge />}
        {data.employee.is_minor === null && hasRestrictedSkills && <span>{t("birthDateUnknown")}</span>}
        {!canRate && <span>{t("readOnly")}</span>}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {data.skills.map((row) => (
          <SkillRatingRow
            key={row.skill.id}
            row={row}
            canRate={canRate}
            onSave={(rating, notes) => rate(row.skill.id, rating, notes)}
            onRemove={() => remove(row.skill.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SkillRatingRow({
  row,
  canRate,
  onSave,
  onRemove,
}: {
  row: EmployeeSkillRating;
  canRate: boolean;
  onSave: (rating: number, notes: string | null) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const t = useTranslations("skills");
  const [rating, setRating] = useState<number | null>(row.rating);
  const [notes, setNotes] = useState(row.notes ?? "");
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A save or removal replaces the row; start again from what the server holds.
  useEffect(() => {
    setRating(row.rating);
    setNotes(row.notes ?? "");
  }, [row.rating, row.notes]);

  const changed = rating !== row.rating || notes.trim() !== (row.notes ?? "");

  async function save() {
    if (rating === null) return;
    setBusy("save");
    setError(null);
    try {
      await onSave(rating, notes.trim() || null);
    } catch (err) {
      setError((err as SchedulingError).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    setError(null);
    try {
      await onRemove();
    } catch (err) {
      setError((err as SchedulingError).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className={cn(
        "space-y-2 rounded-md border bg-card p-3",
        row.alert && "border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{row.skill.name}</p>
          {row.skill.min_age !== null && <MinAgeBadge minAge={row.skill.min_age} />}
        </div>
        <StarPicker
          value={rating}
          onChange={setRating}
          disabled={!canRate || busy !== null}
          label={t("starsFor", { skill: row.skill.name })}
        />
      </div>

      {/* Under this skill's minimum age: warn before (and after) saving. */}
      {row.restricted && (row.alert || rating !== null) && (
        <p className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {row.skill.restriction_note ?? t("underAgeFallback", { age: String(row.skill.min_age ?? "") })}
            {!row.alert && <> {t("savingStillAllowed")}</>}
          </span>
        </p>
      )}

      {canRate ? (
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={NOTES_MAX}
          placeholder={t("notesPlaceholder")}
          className="min-h-14 resize-none text-sm"
          disabled={busy !== null}
        />
      ) : (
        row.notes && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{row.notes}</p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {canRate && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={save} disabled={busy !== null || !changed || rating === null}>
            {busy === "save" && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
            {t("save")}
          </Button>
          {row.rating !== null && (
            <Button
              size="sm"
              variant="ghost"
              className="ms-auto text-destructive hover:text-destructive"
              onClick={remove}
              disabled={busy !== null}
            >
              {busy === "remove" ? (
                <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="me-1.5 h-3.5 w-3.5" />
              )}
              {t("remove")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
