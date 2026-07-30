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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CheckCircle2, ChevronDown, Clock, Eraser, FileImage, Loader2, Paperclip, Send, Trash2, X } from "lucide-react";
import type { CreateDebriefPayload } from "@/lib/hooks/use-employee-debriefs";
import type { Employee } from "@/types/due-key.types";
import type { EmployeeDebriefType } from "@/types/employee-debrief.types";

const MAX_NOTE = 5000;

/** Each store keeps its own independent draft. */
function draftKey(storeId: string | null): string {
  return `employee-debrief-draft:${storeId ?? "none"}`;
}

function formatTodayDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface DraftData {
  note: string;
  date: string;
}

function loadDraft(storeId: string | null): DraftData {
  if (typeof window === "undefined") {
    return { note: "", date: formatTodayDate() };
  }
  try {
    const raw = localStorage.getItem(draftKey(storeId));
    if (!raw) return { note: "", date: formatTodayDate() };
    const parsed = JSON.parse(raw) as Partial<DraftData>;
    return {
      note: parsed.note ?? "",
      date: parsed.date ?? formatTodayDate(),
    };
  } catch {
    return { note: "", date: formatTodayDate() };
  }
}

function saveDraft(storeId: string | null, draft: DraftData): void {
  if (typeof window === "undefined" || !storeId) return;
  localStorage.setItem(draftKey(storeId), JSON.stringify(draft));
}

function clearDraft(storeId: string | null): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(draftKey(storeId));
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
  employees?: Employee[];
  debriefTypes?: EmployeeDebriefType[];
}

export function CreateEmployeeDebriefForm({
  storeId,
  isSubmitting,
  submitError,
  onSubmit,
  onClearError,
  employees = [],
  debriefTypes = [],
}: CreateEmployeeDebriefFormProps) {
  // Employee selection (id-based; not persisted to draft)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedDisplayName, setSelectedDisplayName] = useState("");

  // Debrief type (optional; not persisted to draft)
  const [selectedType, setSelectedType] = useState<string>("none");

  const [note, setNote] = useState("");
  const [date, setDate] = useState(formatTodayDate());
  const [draftSavedFlash, setDraftSavedFlash] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Employee combobox state
  const [empOpen, setEmpOpen] = useState(false);
  const [empSearch, setEmpSearch] = useState("");

  // Attachments
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isHoveringAttachments, setIsHoveringAttachments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load this store's draft — runs on mount and whenever the store changes.
  useEffect(() => {
    const draft = loadDraft(storeId);
    setNote(draft.note);
    setDate(draft.date);
    setHydrated(true);
  }, [storeId]);

  // Reset employee selection whenever the store changes
  useEffect(() => {
    setSelectedEmployeeId(null);
    setSelectedDisplayName("");
    setEmpSearch("");
    setEmpOpen(false);
    setSelectedType("none");
  }, [storeId]);

  // Auto-save draft 600ms after last keystroke
  useEffect(() => {
    if (!hydrated) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveDraft(storeId, { note, date });
      if (note) {
        setDraftSavedFlash(true);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setDraftSavedFlash(false), 2000);
      }
    }, 600);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [note, date, hydrated, storeId]);

  // Clipboard paste into attachment area on hover
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isHoveringAttachments) return;
      const clipItems = e.clipboardData?.items;
      if (!clipItems) return;
      const images: File[] = [];
      for (let i = 0; i < clipItems.length; i++) {
        const ci = clipItems[i];
        if (ci.type.startsWith("image/")) {
          const file = ci.getAsFile();
          if (file) images.push(file);
        }
      }
      if (images.length === 0) return;
      e.preventDefault();
      setAttachments((prev) => [...prev, ...images]);
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [isHoveringAttachments]);

  const hasDraft = !!note;
  const isToday = date === formatTodayDate();

  const isEmployeeValid = selectedEmployeeId !== null;
  const isNoteValid = note.trim().length > 0 && note.length <= MAX_NOTE;
  const isDateValid = !!date.trim();
  const isFormValid = isEmployeeValid && isNoteValid && isDateValid;

  const handleClear = () => {
    setSelectedEmployeeId(null);
    setSelectedDisplayName("");
    setEmpSearch("");
    setNote("");
    setDate(formatTodayDate());
    setAttachments([]);
    setSelectedType("none");
    clearDraft(storeId);
    onClearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !isFormValid || selectedEmployeeId === null) return;

    const success = await onSubmit({
      date: date.trim(),
      employee_id: selectedEmployeeId,
      note: note.trim(),
      type: selectedType === "none" ? undefined : selectedType,
      attachments: attachments.length > 0 ? attachments : null,
    });

    if (success) {
      setSelectedEmployeeId(null);
      setSelectedDisplayName("");
      setEmpSearch("");
      setNote("");
      setDate(formatTodayDate());
      setAttachments([]);
      setSelectedType("none");
      clearDraft(storeId);
      setSuccessFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setSuccessFlash(false), 4000);
    }
  };

  return (
    <Card className="flex flex-col border-0 shadow-none p-0 gap-0 bg-transparent">
      <div className="flex items-center justify-between px-0 pt-0 pb-0">
        {/* <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Form Fields</p> */}
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
            <Popover open={empOpen} onOpenChange={setEmpOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-full flex items-center justify-between h-8 rounded-md border border-input bg-background px-3 text-xs text-left",
                    "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    !selectedDisplayName && "text-muted-foreground"
                  )}
                >
                  <span className="truncate">{selectedDisplayName || "Select employee…"}</span>
                  {selectedDisplayName ? (
                    <X
                      className="h-3.5 w-3.5 shrink-0 ml-1 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEmployeeId(null);
                        setSelectedDisplayName("");
                        setEmpSearch("");
                        onClearError();
                      }}
                    />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 ml-1 text-muted-foreground" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="p-0 w-(--radix-popover-trigger-width)"
                align="start"
                sideOffset={4}
              >
                {/* Search input */}
                <div className="p-2 border-b border-border">
                  <Input
                    autoFocus
                    placeholder="Search employee…"
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
                {/* Filtered list */}
                <div className="max-h-40 overflow-y-auto py-1">
                  {(() => {
                    const q = empSearch.trim().toLowerCase();
                    const filtered = employees.filter((emp) => {
                      const full = `${emp.firstName} ${emp.middleName ?? ""} ${emp.lastName}`.toLowerCase();
                      return !q || full.includes(q);
                    });
                    if (filtered.length === 0) {
                      return (
                        <p className="px-3 py-2 text-xs text-muted-foreground">No employees found.</p>
                      );
                    }
                    return filtered.map((emp) => {
                      const fullName = [emp.firstName, emp.middleName, emp.lastName]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-accent hover:text-accent-foreground transition-colors",
                            selectedEmployeeId === emp.id && "bg-accent text-accent-foreground font-medium"
                          )}
                          onClick={() => {
                            setSelectedEmployeeId(emp.id);
                            setSelectedDisplayName(fullName);
                            setEmpSearch("");
                            setEmpOpen(false);
                            onClearError();
                          }}
                        >
                          <span className="flex-1 truncate">{fullName}</span>
                          {!emp.active && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1 border-0 bg-gray-200/60 dark:bg-gray-700/60 text-muted-foreground">
                              inactive
                            </Badge>
                          )}
                        </button>
                      );
                    });
                  })()}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Debrief type (optional) */}
          {debriefTypes.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="debrief-type" className="text-[11px] font-medium">
                Type (optional)
              </Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger id="debrief-type" size="sm" className="h-8 w-full text-xs">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {debriefTypes.map((t) => (
                    <SelectItem key={t.id} value={t.slug}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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

          {/* Attachments */}
          <div
            className="space-y-1.5"
            onMouseEnter={() => setIsHoveringAttachments(true)}
            onMouseLeave={() => setIsHoveringAttachments(false)}
          >
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium">
                Attachments
                {isHoveringAttachments && (
                  <span className="ml-2 font-normal text-muted-foreground/70">· Ctrl+V to paste</span>
                )}
              </Label>
              {attachments.length > 0 && (
                <span className="text-[11px] text-muted-foreground">{attachments.length} file{attachments.length > 1 ? "s" : ""}</span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                setAttachments((prev) => {
                  const existing = new Set(prev.map((f) => f.name + f.size));
                  return [...prev, ...files.filter((f) => !existing.has(f.name + f.size))];
                });
                e.target.value = "";
              }}
            />
            {attachments.length > 0 && (
              <ul className="space-y-1">
                {attachments.map((file, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 rounded-md border border-gray-200/60 dark:border-gray-700/60 bg-muted/30 px-2 py-1.5 text-xs"
                  >
                    {file.type.startsWith("image/") ? (
                      <FileImage className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                    ) : (
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate text-foreground/80">{file.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                    <button
                      type="button"
                      className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-8 gap-1.5 border-dashed border-gray-200/60 dark:border-gray-700/60 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-3.5 w-3.5" />
              Attach files
            </Button>
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
