"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarPicker } from "@/components/shared/star-picker";
import type { SchedulingError } from "@/lib/scheduling/errors";
import type { Skill } from "@/types/skills.types";

const NOTES_MAX = 2000;

/**
 * One overview cell's rating editor: stars, notes, save/remove, in a popover.
 *
 * A minor under the skill's minimum age gets the warning before saving, and
 * saving still goes through — the alert never blocks.
 */
export function SkillCellEditor({
  employeeName,
  skill,
  rating,
  notes,
  restricted,
  onSave,
  onRemove,
  children,
}: {
  employeeName: string;
  skill: Skill;
  rating: number | null;
  notes: string | null;
  /** The employee is under this skill's minimum age. */
  restricted: boolean;
  onSave: (rating: number, notes: string | null) => Promise<void>;
  onRemove: () => Promise<void>;
  /** The cell content, which opens the editor. */
  children: ReactNode;
}) {
  const t = useTranslations("skills");
  const [open, setOpen] = useState(false);
  const [draftRating, setDraftRating] = useState<number | null>(rating);
  const [draftNotes, setDraftNotes] = useState(notes ?? "");
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start from what the server holds every time it opens.
  useEffect(() => {
    if (!open) return;
    setDraftRating(rating);
    setDraftNotes(notes ?? "");
    setError(null);
  }, [open, rating, notes]);

  const changed = draftRating !== rating || draftNotes.trim() !== (notes ?? "");

  async function run(kind: "save" | "remove", action: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await action();
      setOpen(false);
    } catch (err) {
      setError((err as SchedulingError).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="center">
        <div>
          <p className="text-sm font-medium">{skill.name}</p>
          <p className="text-xs text-muted-foreground">{employeeName}</p>
        </div>

        <StarPicker
          value={draftRating}
          onChange={setDraftRating}
          disabled={busy !== null}
          label={t("starsFor", { skill: skill.name })}
        />

        {restricted && (
          <p className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {skill.restriction_note ?? t("underAgeFallback", { age: String(skill.min_age ?? "") })}{" "}
              {t("savingStillAllowed")}
            </span>
          </p>
        )}

        <Textarea
          value={draftNotes}
          onChange={(e) => setDraftNotes(e.target.value)}
          maxLength={NOTES_MAX}
          placeholder={t("notesPlaceholder")}
          className="min-h-14 resize-none text-sm"
          disabled={busy !== null}
        />

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={busy !== null || !changed || draftRating === null}
            onClick={() => draftRating !== null && run("save", () => onSave(draftRating, draftNotes.trim() || null))}
          >
            {busy === "save" && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
            {t("save")}
          </Button>
          {rating !== null && (
            <Button
              size="sm"
              variant="ghost"
              className="ms-auto text-destructive hover:text-destructive"
              disabled={busy !== null}
              onClick={() => run("remove", onRemove)}
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
      </PopoverContent>
    </Popover>
  );
}
