"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CalendarIcon,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDueKeys, useSetDueKeyValue } from "@/lib/hooks/use-due-keys";
import { cn } from "@/lib/utils";
import type { DueKeyItem, DueKeyValue, DueKeyValuePayload } from "@/types/due-key.types";

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

interface InlineDueKeyInputProps {
  storeId: string | null;
  onSuccess?: (date: string, keyId: number, value: DueKeyValue) => void;
}

export function InlineDueKeyInput({
  storeId,
  onSuccess,
}: InlineDueKeyInputProps) {
  const [textValue, setTextValue] = useState("");
  const [numberValue, setNumberValue] = useState("");
  const [booleanValue, setBooleanValue] = useState<"null" | "true" | "false">("null");
  const [jsonValue, setJsonValue] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isHoveringAttach, setIsHoveringAttach] = useState(false);
  const [submissionDate, setSubmissionDate] = useState<string>(() => todayDateStr());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [keySearch, setKeySearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { setDueKeyValue, isSubmitting, error, clearError } = useSetDueKeyValue();

  const {
    data: dueKeysData,
    isLoading: isKeysLoading,
    isRefreshing: isKeysRefreshing,
  } = useDueKeys(storeId, submissionDate);

  const items = dueKeysData?.items ?? [];

  const selectedKey = useMemo(
    () => items.find((k) => k.keyId === selectedKeyId) ?? null,
    [items, selectedKeyId]
  );

  const filteredItems = useMemo(() => {
    const q = keySearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((k) => k.label.toLowerCase().includes(q));
  }, [items, keySearch]);

  // Reset fields when selected key changes
  useEffect(() => {
    setTextValue("");
    setNumberValue("");
    setBooleanValue("null");
    setJsonValue("");
    setJsonError(null);
    setNote("");
    setNoteExpanded(false);
    setAttachments([]);
    clearError();
  }, [selectedKey?.keyId, clearError]);

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

  const payload = useMemo<DueKeyValuePayload | null>(() => {
    if (!selectedKey) return null;

    if (selectedKey.dataType === "json") {
      if (!jsonValue.trim()) {
        return {
          key_id: selectedKey.keyId,
          value_text: null,
          value_number: null,
          value_boolean: null,
          value_json: null,
        };
      }
      try {
        const parsed = JSON.parse(jsonValue);
        return {
          key_id: selectedKey.keyId,
          value_text: null,
          value_number: null,
          value_boolean: null,
          value_json: parsed,
        };
      } catch {
        return null;
      }
    }

    if (selectedKey.dataType === "text") {
      return {
        key_id: selectedKey.keyId,
        value_text: textValue.trim() || null,
        value_number: null,
        value_boolean: null,
        value_json: null,
      };
    }

    if (selectedKey.dataType === "number" || selectedKey.dataType === "decimal") {
      const hasNumber = numberValue.trim().length > 0;
      const parsed = hasNumber ? Number(numberValue) : null;
      if (hasNumber && Number.isNaN(parsed)) return null;
      return {
        key_id: selectedKey.keyId,
        value_text: null,
        value_number: parsed,
        value_boolean: null,
        value_json: null,
      };
    }

    // boolean
    return {
      key_id: selectedKey.keyId,
      value_text: null,
      value_number: null,
      value_boolean:
        booleanValue === "null" ? null : booleanValue === "true",
      value_json: null,
    };
  }, [selectedKey, textValue, numberValue, booleanValue, jsonValue]);

  const hasValue = useMemo(() => {
    if (!payload) return false;
    return (
      payload.value_text !== null ||
      payload.value_number !== null ||
      payload.value_boolean !== null ||
      payload.value_json !== null
    );
  }, [payload]);

  const canSubmit =
    !isSubmitting && !!storeId && !!selectedKey && !!payload;

  async function handleSubmit() {
    if (!canSubmit || !storeId || !payload) return;

    if (selectedKey!.dataType === "json" && jsonValue.trim()) {
      try {
        JSON.parse(jsonValue);
        setJsonError(null);
      } catch {
        setJsonError("Invalid JSON — fix before submitting.");
        return;
      }
    }

    const finalPayload: DueKeyValuePayload = {
      ...payload,
      note: note.trim() || null,
      attachments: attachments.length > 0 ? attachments : null,
    };

    const result = await setDueKeyValue(storeId, submissionDate, finalPayload);
    if (result) {
      // Enrich the server response with the current user's name
      // (this endpoint doesn't return user_name, so we read it from local auth storage)
      let userName: string | null = null;
      try {
        const raw = localStorage.getItem("auth-user");
        if (raw) userName = (JSON.parse(raw) as { name?: string }).name ?? null;
      } catch { /* ignore */ }
      onSuccess?.(submissionDate, finalPayload.key_id, { ...result, userName });
      const action = !selectedKey!.filled && hasValue
        ? "created"
        : selectedKey!.filled && !hasValue
          ? "deactivated"
          : "updated";
      toast.success(
        action === "created"
          ? `"${selectedKey!.label}" submitted.`
          : action === "deactivated"
            ? `"${selectedKey!.label}" cleared.`
            : `"${selectedKey!.label}" updated.`
      );
      // Reset form — do NOT refresh the feed
      setTextValue("");
      setNumberValue("");
      setBooleanValue("null");
      setJsonValue("");
      setJsonError(null);
      setNote("");
      setNoteExpanded(false);
      setAttachments([]);
      setSubmissionDate(todayDateStr());
    }
  }

  const disabled = !selectedKey || !storeId;

  return (
    <div className="border-t border-border/60 bg-card/60 backdrop-blur-sm">
      {/* Key selector + date picker row */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        {/* Key combobox */}
        <Popover open={keyOpen} onOpenChange={setKeyOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={isKeysLoading}
              className={cn(
                "flex flex-1 min-w-0 h-8 items-center justify-between overflow-hidden rounded-md border border-input bg-background px-3 text-xs text-left transition-colors hover:bg-muted/50",
                !selectedKey && "text-muted-foreground"
              )}
            >
              {isKeysLoading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading keys…
                </span>
              ) : (
                <>
                  <span className="flex flex-1 min-w-0 items-center gap-1.5 truncate">
                    {selectedKey ? (
                      <>
                        {selectedKey.filled && (
                          <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
                        )}
                        <span className="truncate">{selectedKey.label}</span>
                      </>
                    ) : (
                      "Choose a key to submit…"
                    )}
                  </span>
                  {selectedKey ? (
                    <X
                      className="h-3.5 w-3.5 shrink-0 ml-1.5 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedKeyId(null);
                        setKeySearch("");
                        clearError();
                      }}
                    />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 ml-1.5 text-muted-foreground" />
                  )}
                </>
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
                placeholder="Search key…"
                value={keySearch}
                onChange={(e) => setKeySearch(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="max-h-44 overflow-y-auto py-1">
              {filteredItems.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  {items.length === 0 ? "No keys for this date." : "No keys match your search."}
                </p>
              ) : (
                filteredItems.map((k) => (
                  <button
                    key={k.keyId}
                    type="button"
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-accent hover:text-accent-foreground transition-colors",
                      selectedKeyId === k.keyId && "bg-accent text-accent-foreground font-medium"
                    )}
                    onClick={() => {
                      setSelectedKeyId(k.keyId);
                      setKeySearch("");
                      setKeyOpen(false);
                      clearError();
                    }}
                  >
                    {k.filled && (
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
                    )}
                    <span className="flex-1 truncate">{k.label}</span>
                    {k.tags.length > 0 && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        [{k.tags[0].name}]
                      </span>
                    )}
                  </button>
                ))
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
              {isKeysRefreshing ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
              ) : (
                <CalendarIcon className="h-3 w-3 shrink-0" />
              )}
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

      {/* Key context strip — shown when a key is selected */}
      {selectedKey && (
        <div className="flex items-center gap-1.5 px-3 pb-1.5">
          <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
            {selectedKey.dataType}
          </Badge>
          {selectedKey.tags.length > 0 && (
            <span className="text-[10px] text-muted-foreground truncate">
              {selectedKey.tags.map((t) => t.name).join(", ")}
            </span>
          )}
          {selectedKey.filled && (
            <Badge variant="default" className="text-[10px]">Filled</Badge>
          )}
          <button
            type="button"
            onClick={() => setSelectedKeyId(null)}
            className="ml-auto text-[10px] text-muted-foreground/70 underline-offset-2 hover:text-muted-foreground hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Value input row */}
      <div className="flex items-start gap-2 px-3 pb-2">
        <div className="flex-1 min-w-0">
          {/* Text */}
          {(!selectedKey || selectedKey.dataType === "text") && (
            <Input
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              disabled={disabled}
              placeholder={disabled ? "No key selected" : "Enter text value…"}
              className="h-9 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSubmit(); }
              }}
            />
          )}

          {/* Number / Decimal */}
          {selectedKey && (selectedKey.dataType === "number" || selectedKey.dataType === "decimal") && (
            <Input
              type="number"
              step={selectedKey.dataType === "decimal" ? "0.01" : "1"}
              value={numberValue}
              onChange={(e) => setNumberValue(e.target.value)}
              disabled={disabled}
              placeholder="Enter number…"
              className="h-9 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); void handleSubmit(); }
              }}
            />
          )}

          {/* Boolean — two toggle buttons */}
          {selectedKey && selectedKey.dataType === "boolean" && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setBooleanValue((prev) => (prev === "true" ? "null" : "true"))}
                className={cn(
                  "flex-1 h-9 rounded-md border text-sm font-medium transition-colors",
                  booleanValue === "true"
                    ? "border-green-500/60 bg-green-500/15 text-green-700 dark:text-green-400"
                    : "border-border/60 bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                  disabled && "cursor-not-allowed opacity-40"
                )}
              >
                Yes
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setBooleanValue((prev) => (prev === "false" ? "null" : "false"))}
                className={cn(
                  "flex-1 h-9 rounded-md border text-sm font-medium transition-colors",
                  booleanValue === "false"
                    ? "border-red-500/60 bg-red-500/15 text-red-700 dark:text-red-400"
                    : "border-border/60 bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                  disabled && "cursor-not-allowed opacity-40"
                )}
              >
                No
              </button>
            </div>
          )}

          {/* JSON */}
          {selectedKey && selectedKey.dataType === "json" && (
            <div className="space-y-1">
              <Textarea
                value={jsonValue}
                onChange={(e) => {
                  setJsonValue(e.target.value);
                  if (jsonError) setJsonError(null);
                }}
                disabled={disabled}
                placeholder='{"key": "value"}'
                className="min-h-18 resize-none text-sm font-mono"
              />
              {jsonError && (
                <p className="text-xs text-destructive">{jsonError}</p>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 pt-0.5">
          {/* Note toggle */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setNoteExpanded((p) => !p)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors",
              !disabled && "hover:bg-muted hover:text-foreground",
              noteExpanded && "bg-muted text-foreground",
              disabled && "opacity-40 cursor-not-allowed"
            )}
            title="Toggle note"
          >
            {noteExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {/* Attach */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            onMouseEnter={() => setIsHoveringAttach(true)}
            onMouseLeave={() => setIsHoveringAttach(false)}
            className={cn(
              "relative flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors",
              !disabled && "hover:bg-muted hover:text-foreground",
              disabled && "opacity-40 cursor-not-allowed"
            )}
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
              if (picked.length > 0) {
                setAttachments((prev) => [...prev, ...picked]);
              }
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
            title="Submit"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Note textarea (collapsible) */}
      {noteExpanded && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              placeholder="Add a note… (optional)"
              className="min-h-14 resize-none text-sm pr-12"
            />
            {note.length > 0 && (
              <span
                className={cn(
                  "pointer-events-none absolute bottom-2 right-2 text-[10px]",
                  note.length >= 2000
                    ? "text-destructive font-medium"
                    : note.length >= 1600
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-muted-foreground"
                )}
              >
                {note.length}/2000
              </span>
            )}
          </div>
        </div>
      )}

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
