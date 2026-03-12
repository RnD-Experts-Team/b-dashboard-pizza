"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Eraser, Loader2, Send } from "lucide-react";
import type { CreateDebriefPayload } from "@/lib/hooks/use-employee-debriefs";

const DRAFT_KEY = "employee-debrief-draft";
const MAX_NAME = 255;
const MAX_NOTE = 5000;

function formatTodayDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface DraftData {
  employeeName: string;
  note: string;
  date: string;
}

function loadDraft(): DraftData {
  if (typeof window === "undefined") {
    return { employeeName: "", note: "", date: formatTodayDate() };
  }
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return { employeeName: "", note: "", date: formatTodayDate() };
    const parsed = JSON.parse(raw) as Partial<DraftData>;
    return {
      employeeName: parsed.employeeName ?? "",
      note: parsed.note ?? "",
      date: parsed.date ?? formatTodayDate(),
    };
  } catch {
    return { employeeName: "", note: "", date: formatTodayDate() };
  }
}

function saveDraft(draft: DraftData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function clearDraft(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DRAFT_KEY);
}

function charCountColor(count: number, max: number): string {
  const ratio = count / max;
  if (ratio >= 1) return "text-destructive font-medium";
  if (ratio >= 0.8) return "text-yellow-600 dark:text-yellow-400";
  return "text-muted-foreground";
}

interface CreateEmployeeDebriefFormProps {
  storeId: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  onSubmit: (payload: CreateDebriefPayload) => Promise<boolean>;
  onClearError: () => void;
}

export function CreateEmployeeDebriefForm({
  storeId,
  isSubmitting,
  submitError,
  onSubmit,
  onClearError,
}: CreateEmployeeDebriefFormProps) {
  const [employeeName, setEmployeeName] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(formatTodayDate());
  const [draftSavedFlash, setDraftSavedFlash] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load draft on mount (client only)
  useEffect(() => {
    const draft = loadDraft();
    setEmployeeName(draft.employeeName);
    setNote(draft.note);
    setDate(draft.date);
    setHydrated(true);
  }, []);

  // Auto-save draft 600ms after last keystroke
  useEffect(() => {
    if (!hydrated) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveDraft({ employeeName, note, date });
      if (employeeName || note) {
        setDraftSavedFlash(true);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setDraftSavedFlash(false), 2000);
      }
    }, 600);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [employeeName, note, date, hydrated]);

  const hasDraft = !!(employeeName || note);
  const isToday = date === formatTodayDate();

  const isNameValid = employeeName.trim().length > 0 && employeeName.length <= MAX_NAME;
  const isNoteValid = note.trim().length > 0 && note.length <= MAX_NOTE;
  const isDateValid = !!date.trim();
  const isFormValid = isNameValid && isNoteValid && isDateValid;

  const handleClear = () => {
    setEmployeeName("");
    setNote("");
    setDate(formatTodayDate());
    clearDraft();
    onClearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !isFormValid) return;

    const success = await onSubmit({
      date: date.trim(),
      employee_name: employeeName.trim(),
      note: note.trim(),
    });

    if (success) {
      setEmployeeName("");
      setNote("");
      setDate(formatTodayDate());
      clearDraft();
      setSuccessFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setSuccessFlash(false), 4000);
    }
  };

  return (
    <Card className="flex flex-col border-0 shadow-none bg-transparent">
      <div className="flex items-center justify-between px-0 pt-2 pb-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Form Fields</p>
        <div className="shrink-0">
          {draftSavedFlash ? (
            <Badge variant="secondary" className="gap-1 text-[11px]">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Saved
            </Badge>
          ) : hasDraft ? (
            <Badge variant="outline" className="gap-1 text-[11px] text-muted-foreground border-gray-200/60 dark:border-gray-700/60">
              <Clock className="h-2.5 w-2.5" />
              Draft
            </Badge>
          ) : null}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="contents">
        <CardContent className="flex flex-col gap-2.5 pt-2 px-0">
          {/* Date */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="debrief-date" className="text-[11px] font-medium">
                Date
              </Label>
              {isToday && (
                <span className="text-[11px] text-muted-foreground">Today</span>
              )}
            </div>
            <Input
              id="debrief-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="h-8 text-xs"
            />
          </div>

          {/* Employee name */}
          <div className="space-y-1">
            <Label htmlFor="debrief-employee-name" className="text-[11px] font-medium">
              Employee Name
            </Label>
            <Input
              id="debrief-employee-name"
              placeholder="Enter employee name…"
              value={employeeName}
              onChange={(e) => {
                setEmployeeName(e.target.value.slice(0, MAX_NAME));
                onClearError();
              }}
              required
              autoComplete="off"
              className="h-8 text-xs"
            />
          </div>

          {/* Note */}
          <div className="space-y-1">
            <Label htmlFor="debrief-note" className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Note
            </Label>
            <Textarea
              id="debrief-note"
              placeholder="Write your debrief notes here…"
              value={note}
              onChange={(e) => {
                setNote(e.target.value.slice(0, MAX_NOTE));
                onClearError();
              }}
              required
              className="min-h-25 resize-y text-xs leading-relaxed border-gray-200/60 dark:border-gray-700/60 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
            />
            <p className={cn("text-right text-[11px] tabular-nums font-medium", note.length > MAX_NOTE * 0.8 ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground")}>
              {note.length} / {MAX_NOTE}
            </p>
          </div>

          {/* Error banner */}
          {submitError && (
            <div className="rounded-lg border border-gray-200/60 dark:border-gray-700/60 px-3 py-2">
              <p className="text-xs text-foreground font-medium">{submitError}</p>
            </div>
          )}

          {/* Success flash */}
          {successFlash && (
            <div className="flex items-center gap-2 rounded-lg border border-gray-200/60 dark:border-gray-700/60 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <p className="text-xs text-foreground font-medium">
                Debrief submitted successfully.
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="gap-2 pt-2 pb-1 px-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={isSubmitting || !hasDraft}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Eraser className="h-3.5 w-3.5" />
            Clear draft
          </Button>

          <Button
            type="submit"
            size="sm"
            className="ms-auto gap-1.5"
            disabled={!isFormValid || !storeId || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {isSubmitting ? "Submitting…" : "Submit Debrief"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
