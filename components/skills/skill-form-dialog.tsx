"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { SchedulingError } from "@/lib/scheduling/errors";
import type { Skill, SkillDraft } from "@/types/skills.types";

/** The one restriction there is today: no employees under 18. */
const ADULT_AGE = 18;
const NAME_MAX = 120;
const NOTE_MAX = 2000;

/**
 * Create/edit a skill. When `skill` is provided it edits, otherwise creates.
 * Errors stay inline so the input survives (e.g. a duplicate name).
 */
export function SkillFormDialog({
  open,
  onOpenChange,
  skill,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill: Skill | null;
  onSubmit: (draft: SkillDraft) => Promise<void>;
}) {
  const t = useTranslations("skills");
  const switchId = useId();
  const [name, setName] = useState("");
  const [adultsOnly, setAdultsOnly] = useState(false);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(skill?.name ?? "");
    setAdultsOnly(skill?.min_age != null);
    setNote(skill?.restriction_note ?? "");
    setError(null);
  }, [open, skill]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        // Keep a custom minimum age an edit didn't touch.
        min_age: adultsOnly ? skill?.min_age ?? ADULT_AGE : null,
        restriction_note: adultsOnly ? note.trim() || null : null,
      });
      onOpenChange(false);
    } catch (err) {
      setError((err as SchedulingError).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{skill ? t("editSkill") : t("newSkill")}</DialogTitle>
            <DialogDescription>{t("formDescription")}</DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="skill-name">{t("name")}</Label>
            <Input
              id="skill-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX}
              autoFocus
              disabled={isSaving}
            />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor={switchId}>{t("adultsOnly", { age: skill?.min_age ?? ADULT_AGE })}</Label>
              <p className="text-xs text-muted-foreground">{t("adultsOnlyHint")}</p>
            </div>
            <Switch id={switchId} checked={adultsOnly} onCheckedChange={setAdultsOnly} disabled={isSaving} />
          </div>

          {adultsOnly && (
            <div className="space-y-2">
              <Label htmlFor="skill-note">{t("restrictionNote")}</Label>
              <Textarea
                id="skill-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={NOTE_MAX}
                placeholder={t("restrictionNotePlaceholder")}
                className="min-h-20 resize-none text-sm"
                disabled={isSaving}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSaving || !name.trim()}>
              {isSaving && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
