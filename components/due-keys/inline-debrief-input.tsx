"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CalendarIcon,
  ChevronDown,
  Loader2,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useCreateEmployeeDebrief,
  type CreateDebriefPayload,
} from "@/lib/hooks/use-employee-debriefs";
import { cn } from "@/lib/utils";
import type { Employee } from "@/types/due-key.types";
import type { EmployeeDebriefItem } from "@/types/employee-debrief.types";

// ── date helpers ─────────────────────────────────────────────────────────────
function strToDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayDateStr(): string {
  return dateToStr(new Date());
}

const MAX_NOTE = 5000;

// ── component ────────────────────────────────────────────────────────────────
interface InlineDebriefInputProps {
  storeId: string | null;
  employees: Employee[];
  onSuccess?: (item: EmployeeDebriefItem) => void;
}

export function InlineDebriefInput({ storeId, employees, onSuccess }: InlineDebriefInputProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedDisplayName, setSelectedDisplayName] = useState("");
  const [empOpen, setEmpOpen] = useState(false);
  const [empSearch, setEmpSearch] = useState("");
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isHoveringAttach, setIsHoveringAttach] = useState(false);
  const [submissionDate, setSubmissionDate] = useState<string>(() => todayDateStr());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { createDebrief, isSubmitting, error, clearError } = useCreateEmployeeDebrief();

  // Reset employee selection when store changes
  useEffect(() => {
    setSelectedEmployeeId(null);
    setSelectedDisplayName("");
    setEmpSearch("");
    setEmpOpen(false);
    clearError();
  }, [storeId, clearError]);

  // Clipboard paste into attachment area on hover
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isHoveringAttach) return;
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
  }, [isHoveringAttach]);

  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) => {
      const full = [emp.firstName, emp.middleName, emp.lastName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return full.includes(q);
    });
  }, [employees, empSearch]);

  const canSubmit =
    !isSubmitting && !!storeId && !!selectedEmployeeId && note.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit || !storeId || !selectedEmployeeId) return;
    const payload: CreateDebriefPayload = {
      date: submissionDate,
      employee_id: selectedEmployeeId,
      note: note.trim(),
      attachments: attachments.length > 0 ? attachments : null,
    };
    const ok = await createDebrief(storeId, payload);
    if (ok) {
      onSuccess?.(ok);
      toast.success("Debrief submitted.");
      setNote("");
      setAttachments([]);
      setSubmissionDate(todayDateStr());
    }
  }

  return (
    <div className="border-t border-border/60 bg-card/60 backdrop-blur-sm">
      {/* Employee selector + date picker row */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        {/* Employee combobox trigger */}
        <Popover open={empOpen} onOpenChange={setEmpOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex flex-1 min-w-0 h-8 items-center justify-between overflow-hidden rounded-md border border-input bg-background px-3 text-xs text-left transition-colors hover:bg-muted/50",
                !selectedDisplayName && "text-muted-foreground"
              )}
            >
              <span className="truncate">
                {selectedDisplayName || "Select employee…"}
              </span>
              {selectedDisplayName ? (
                <X
                  className="h-3.5 w-3.5 shrink-0 ml-1.5 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEmployeeId(null);
                    setSelectedDisplayName("");
                    setEmpSearch("");
                    clearError();
                  }}
                />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 ml-1.5 text-muted-foreground" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="p-0 w-(--radix-popover-trigger-width)"
            align="start"
            sideOffset={4}
          >
            <div className="p-2 border-b border-border">
              <Input
                autoFocus
                placeholder="Search employee…"
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="max-h-44 overflow-y-auto py-1">
              {filteredEmployees.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  No employees found.
                </p>
              ) : (
                filteredEmployees.map((emp) => {
                  const fullName = [emp.firstName, emp.middleName, emp.lastName]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      className={cn(
                        "w-full flex items-center px-3 py-1.5 text-xs text-left hover:bg-accent hover:text-accent-foreground transition-colors",
                        selectedEmployeeId === emp.id &&
                          "bg-accent text-accent-foreground font-medium"
                      )}
                      onClick={() => {
                        setSelectedEmployeeId(emp.id);
                        setSelectedDisplayName(fullName);
                        setEmpSearch("");
                        setEmpOpen(false);
                        clearError();
                      }}
                    >
                      <span className="flex-1 truncate">{fullName}</span>
                    </button>
                  );
                })
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Submission date picker */}
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors hover:bg-muted shrink-0",
                submissionDate !== todayDateStr()
                  ? "border-primary/50 bg-primary/5 text-primary"
                  : "border-border/60 bg-background/60 text-muted-foreground"
              )}
            >
              <CalendarIcon className="h-3 w-3 shrink-0" />
              {submissionDate === todayDateStr()
                ? "Today"
                : format(strToDate(submissionDate), "MMM d, yyyy")}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end" sideOffset={4}>
            <div className="border-b border-border px-3 py-2.5">
              <p className="text-xs font-semibold text-foreground">Submission Date</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {submissionDate === todayDateStr()
                  ? "Submitting for today"
                  : `Submitting for ${format(strToDate(submissionDate), "EEEE, MMM d, yyyy")}`}
              </p>
            </div>
            <Calendar
              mode="single"
              selected={strToDate(submissionDate)}
              onSelect={(d) => {
                if (!d) return;
                setSubmissionDate(dateToStr(d));
                setDatePickerOpen(false);
              }}
              disabled={(date) => date > new Date()}
              initialFocus
            />
            {submissionDate !== todayDateStr() && (
              <div className="border-t border-border p-2">
                <button
                  type="button"
                  onClick={() => {
                    setSubmissionDate(todayDateStr());
                    setDatePickerOpen(false);
                  }}
                  className="w-full rounded-md px-2 py-1.5 text-center text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Reset to today
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Note textarea + action buttons */}
      <div className="flex items-start gap-2 px-3 pb-2">
        <div className="relative flex-1">
          <Textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value.slice(0, MAX_NOTE));
              if (error) clearError();
            }}
            placeholder="Write debrief notes… (Ctrl+Enter to submit)"
            className="min-h-18 resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
          />
          {note.length > MAX_NOTE * 0.8 && (
            <span
              className={cn(
                "pointer-events-none absolute bottom-2 right-2 text-[10px]",
                note.length >= MAX_NOTE
                  ? "text-destructive font-medium"
                  : "text-yellow-600 dark:text-yellow-400"
              )}
            >
              {note.length}/{MAX_NOTE}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col items-center gap-1 pt-0.5">
          {/* Attach */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onMouseEnter={() => setIsHoveringAttach(true)}
            onMouseLeave={() => setIsHoveringAttach(false)}
            className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Attach files · Ctrl+V to paste"
          >
            <Paperclip className="h-4 w-4" />
            {attachments.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {attachments.length}
              </span>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              if (picked.length > 0) setAttachments((prev) => [...prev, ...picked]);
              e.target.value = "";
            }}
          />
          {/* Submit */}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity",
              canSubmit ? "hover:opacity-90" : "opacity-40 cursor-not-allowed"
            )}
            title="Submit debrief"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Attachment chip list */}
      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 px-3 pb-2">
          {attachments.map((file, idx) => (
            <li
              key={`${file.name}-${idx}`}
              className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px]"
            >
              <Paperclip className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
              <span className="max-w-30 truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          <span>{error}</span>
          <button type="button" onClick={clearError} className="shrink-0 hover:opacity-70">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
