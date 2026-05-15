"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSetDueKeyValue } from "@/lib/hooks/use-due-keys";
import { cn } from "@/lib/utils";
import type { DueKeyItem, DueKeyValuePayload } from "@/types/due-key.types";

interface InlineDueKeyInputProps {
  storeId: string | null;
  selectedKey: DueKeyItem | null;
  today: string;
}

export function InlineDueKeyInput({
  storeId,
  selectedKey,
  today,
}: InlineDueKeyInputProps) {
  const [textValue, setTextValue] = useState("");
  const [numberValue, setNumberValue] = useState("");
  const [booleanValue, setBooleanValue] = useState<"null" | "true" | "false">("null");
  const [jsonValue, setJsonValue] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { setDueKeyValue, isSubmitting, error, clearError } = useSetDueKeyValue();

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

    const ok = await setDueKeyValue(storeId, today, finalPayload);
    if (ok) {
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
    }
  }

  const disabled = !selectedKey || !storeId;

  return (
    <div className="border-t border-border/60 bg-card/60 backdrop-blur-sm">
      {/* Key info pill */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        {selectedKey ? (
          <>
            <Badge variant="secondary" className="gap-1 text-[11px] font-medium">
              {selectedKey.label}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
              {selectedKey.dataType}
            </Badge>
            {selectedKey.tags.length > 0 && (
              <span className="text-[10px] text-muted-foreground truncate">
                {selectedKey.tags.map((t) => t.name).join(", ")}
              </span>
            )}
            {selectedKey.filled && (
              <Badge variant="default" className="text-[10px] ml-auto shrink-0">
                Filled
              </Badge>
            )}
          </>
        ) : (
          <span className="text-xs text-muted-foreground italic">
            Select a key from the sidebar to submit a value
          </span>
        )}
      </div>

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

          {/* Boolean */}
          {selectedKey && selectedKey.dataType === "boolean" && (
            <Select
              value={booleanValue}
              onValueChange={(v) => setBooleanValue(v as "null" | "true" | "false")}
              disabled={disabled}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select value" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">No Value</SelectItem>
                <SelectItem value="true">True</SelectItem>
                <SelectItem value="false">False</SelectItem>
              </SelectContent>
            </Select>
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
            className={cn(
              "relative flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors",
              !disabled && "hover:bg-muted hover:text-foreground",
              disabled && "opacity-40 cursor-not-allowed"
            )}
            title="Attach files"
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
