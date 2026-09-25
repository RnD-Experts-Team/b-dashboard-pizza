"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBreakMutations } from "@/lib/hooks/use-break-mutations";
import { parseBreakError } from "@/lib/break-logger/errors";
import { NOTE_MAX } from "@/lib/break-logger/payload";
import type { BreakEntry, BreakNote } from "@/types/breaks.types";
import { useBreakErrorText, useFormatTime, useFormatWorkDate } from "./break-ui";

/**
 * A break's notes: read the embedded list, append one more.
 *
 * Text only — the API has no attachment support on breaks, so there is no
 * upload affordance. Notes can't be edited or deleted either (no endpoint).
 * Adding works while running and long after — explaining yesterday's long
 * break is the normal case.
 */
export function BreakNotesDialog({
  entry,
  onOpenChange,
  onAdded,
}: {
  entry: BreakEntry | null;
  onOpenChange: (open: boolean) => void;
  onAdded?: () => void;
}) {
  const t = useTranslations("breaks");
  const errorText = useBreakErrorText();
  const formatTime = useFormatTime();
  const formatWorkDate = useFormatWorkDate();
  const { addNote } = useBreakMutations();

  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local copy so a new note appears immediately (POST returns only the note).
  const [notes, setNotes] = useState<BreakNote[]>([]);

  useEffect(() => {
    setNotes(entry?.notes ?? []);
    setBody("");
    setError(null);
  }, [entry]);

  async function submit() {
    if (!entry || !body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const note = await addNote(entry.id, body.trim());
      setNotes((n) => [...n, note]);
      setBody("");
      toast.success(t("notes.added"));
      onAdded?.();
    } catch (err) {
      const e = parseBreakError(err);
      if (e.code === "CANCELLED") return;
      if (e.code === "NOT_FOUND") {
        toast.error(errorText(e));
        onOpenChange(false);
        onAdded?.();
        return;
      }
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={entry != null} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("notes.title")}</DialogTitle>
          {entry && (
            <DialogDescription>
              {entry.label} · {formatWorkDate(entry.work_date)} · {formatTime(entry.started_at)}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {notes.length === 0 ? (
            <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <StickyNote className="h-4 w-4" />
              {t("notes.empty")}
            </p>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="rounded-md border bg-muted/30 p-2.5">
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("notes.by", {
                    name: n.creator?.name ?? "—",
                    time: `${formatTime(n.created_at)}`,
                  })}
                </p>
              </div>
            ))
          )}
        </div>

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Textarea
            value={body}
            maxLength={NOTE_MAX}
            placeholder={t("notes.placeholder")}
            aria-invalid={!!error}
            onChange={(e) => {
              setBody(e.target.value);
              setError(null);
            }}
            className="min-h-20"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {t("notes.count", { count: body.length, max: NOTE_MAX })}
            </span>
            <Button type="submit" size="sm" disabled={!body.trim() || saving}>
              {saving && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
              {saving ? t("notes.adding") : t("notes.add")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
