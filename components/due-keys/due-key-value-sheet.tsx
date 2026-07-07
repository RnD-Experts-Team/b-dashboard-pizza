"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Clock, History, Paperclip, Pencil, X } from "lucide-react";
import type { DueKeyItem, DueKeyValue, DueKeyValuePayload } from "@/types/due-key.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getValueDisplay, formatDateTime } from "@/components/due-keys/due-key-value-format";
import { DueKeyHistoryDialog } from "@/components/due-keys/due-key-history-dialog";

interface DueKeyValueSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DueKeyItem | null;
  storeId: string;
  date: string;
  isSubmitting: boolean;
  submitError: string | null;
  onSubmit: (
    payload: DueKeyValuePayload,
    mode: "created" | "updated" | "deactivated"
  ) => Promise<DueKeyValue | null>;
}

function normalizeValueForInput(
  value: DueKeyValue | null,
  dataType: DueKeyItem["dataType"]
): string {
  if (value == null) return "";
  if (dataType === "text") return value.valueText ?? "";
  if (dataType === "number" || dataType === "decimal")
    return value.valueNumber != null ? String(value.valueNumber) : "";
  if (dataType === "boolean") return ""; // handled separately via setBooleanValue
  if (dataType === "json") {
    try {
      return value.valueJson != null ? JSON.stringify(value.valueJson, null, 2) : "";
    } catch {
      return "";
    }
  }
  return "";
}

export function DueKeyValueSheet({
  open,
  onOpenChange,
  item,
  storeId,
  date,
  isSubmitting,
  submitError,
  onSubmit,
}: DueKeyValueSheetProps) {
  const [textValue, setTextValue] = useState("");
  const [numberValue, setNumberValue] = useState("");
  const [booleanValue, setBooleanValue] = useState<"null" | "true" | "false">("null");
  const [jsonValue, setJsonValue] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isHoveringAttachments, setIsHoveringAttachments] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [savedValue, setSavedValue] = useState<DueKeyValue | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [fullHistoryOpen, setFullHistoryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The current value the sheet displays: freshly-saved value takes precedence over the
  // value that came from the daily grid, so the history + correction show immediately.
  const currentValue = savedValue ?? item?.value ?? null;
  const effectiveFilled = (item?.filled ?? false) || savedValue != null;
  const history = currentValue?.mistakenVersions ?? [];
  const wasEdited = (currentValue?.correctedFromId ?? null) != null || history.length > 0;
  const showEditForm = !!item && (!effectiveFilled || isEditing);

  // Reset per-key view state when a different key is opened.
  useEffect(() => {
    setSavedValue(null);
    setIsEditing(false);
    setHistoryOpen(false);
    setFullHistoryOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.keyId]);

  // Initialise the edit inputs from the current value (pre-fill when correcting a filled key).
  useEffect(() => {
    if (!item) return;
    const src = savedValue ?? item.value ?? null;
    const normalized = normalizeValueForInput(src, item.dataType);
    setTextValue(item.dataType === "text" ? normalized : "");
    setNumberValue(
      item.dataType === "number" || item.dataType === "decimal" ? normalized : ""
    );
    setBooleanValue(
      item.dataType === "boolean"
        ? src?.valueBoolean == null
          ? "null"
          : src.valueBoolean
            ? "true"
            : "false"
        : "null"
    );
    setJsonValue(item.dataType === "json" ? normalized : "");
    setJsonError(null);
    setNote(src?.note ?? "");
    setAttachments([]);
  }, [item, savedValue, isEditing]);

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

  const payload = useMemo<DueKeyValuePayload | null>(() => {
    if (!item) return null;

    if (item.dataType === "json") {
      if (!jsonValue.trim()) {
        return {
          key_id: item.keyId,
          value_text: null,
          value_number: null,
          value_boolean: null,
          value_json: null,
        };
      }

      try {
        const parsed = JSON.parse(jsonValue);
        return {
          key_id: item.keyId,
          value_text: null,
          value_number: null,
          value_boolean: null,
          value_json: parsed,
        };
      } catch {
        return null;
      }
    }

    if (item.dataType === "text") {
      return {
        key_id: item.keyId,
        value_text: textValue.trim() ? textValue : null,
        value_number: null,
        value_boolean: null,
        value_json: null,
      };
    }

    if (item.dataType === "number" || item.dataType === "decimal") {
      const hasNumber = numberValue.trim().length > 0;
      const parsed = hasNumber ? Number(numberValue) : null;
      if (hasNumber && Number.isNaN(parsed)) return null;

      return {
        key_id: item.keyId,
        value_text: null,
        value_number: parsed,
        value_boolean: null,
        value_json: null,
      };
    }

    return {
      key_id: item.keyId,
      value_text: null,
      value_number: null,
      value_boolean:
        booleanValue === "null" ? null : booleanValue === "true" ? true : false,
      value_json: null,
    };
  }, [item, textValue, numberValue, booleanValue, jsonValue]);

  const submitMode: "created" | "updated" | "deactivated" = useMemo(() => {
    if (!item || !payload) return "updated";
    const hasNewValue =
      payload.value_text !== null ||
      payload.value_number !== null ||
      payload.value_boolean !== null ||
      payload.value_json !== null;

    if (!effectiveFilled && hasNewValue) return "created";
    if (effectiveFilled && !hasNewValue) return "deactivated";
    return "updated";
  }, [item, payload, effectiveFilled]);

  const handleSubmit = async () => {
    if (!item) return;

    if (item.dataType === "json" && jsonValue.trim()) {
      try {
        JSON.parse(jsonValue);
        setJsonError(null);
      } catch {
        setJsonError("Invalid JSON format.");
        return;
      }
    }

    if (!payload) return;
    const result = await onSubmit(
      { ...payload, note: note.trim() || null, attachments: attachments.length > 0 ? attachments : null },
      submitMode
    );
    if (result) {
      // Show the fresh current value + whatever it just superseded, without closing the sheet.
      setSavedValue(result);
      setIsEditing(false);
      setAttachments([]);
      setHistoryOpen((result.mistakenVersions?.length ?? 0) > 0);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full p-0 sm:max-w-xl">
        <SheetHeader className="border-b pb-3">
          <SheetTitle className="text-base leading-snug">
            {item ? item.label : "Select a debrief item"}
          </SheetTitle>
          <SheetDescription>
            {item ? `Debrief Value · Key #${item.keyId}` : "Select a debrief key"}
          </SheetDescription>
        </SheetHeader>

        {item ? (
          !showEditForm ? (
            /* ── Read-only detail view for filled keys ── */
            <div className="space-y-4 p-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-primary/10 px-3 py-1.5 text-lg font-bold text-primary">
                    Store {storeId}
                  </span>
                  <span className="rounded-md bg-primary/10 px-3 py-1.5 text-lg font-bold text-primary">
                    {date}
                  </span>
                </div>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  Status: <Badge variant="default" className="text-xs">Filled</Badge>
                </p>
              </div>

              <Separator />

              {(() => {
                const { label, display } = getValueDisplay(currentValue);
                const isJson = item.dataType === "json" || display.startsWith("{") || display.startsWith("[");
                const storedNote = currentValue?.note ?? null;
                const storedAttachments = currentValue?.attachments ?? [];
                return (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label>{label}</Label>
                        {wasEdited && (
                          <Badge
                            variant="secondary"
                            className="gap-1 text-[10px] text-amber-700 bg-amber-500/15 dark:text-amber-400 border-0"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                            Edited
                          </Badge>
                        )}
                      </div>
                      {isJson ? (
                        <pre className="rounded-md border bg-muted p-3 text-xs overflow-auto max-h-60 whitespace-pre-wrap break-all">
                          {display}
                        </pre>
                      ) : (
                        <div className="rounded-md border bg-muted px-3 py-2 text-sm break-all">
                          {display}
                        </div>
                      )}
                    </div>

                    {storedNote ? (
                      <div className="space-y-2">
                        <Label>Note</Label>
                        <div className="rounded-md border bg-muted px-3 py-2 text-sm whitespace-pre-wrap break-all">
                          {storedNote}
                        </div>
                      </div>
                    ) : null}

                    {storedAttachments.length > 0 ? (
                      <div className="space-y-2">
                        <Label>Attachments</Label>
                        <ul className="space-y-1">
                          {storedAttachments.map((a) => (
                            <li key={a.id} className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs">
                              <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <a
                                href={a.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 truncate text-primary hover:underline"
                              >
                                {a.originalName}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {/* ── Correction history ── */}
                    {wasEdited && (
                      <div className="space-y-2 rounded-md border border-amber-500/25 bg-amber-500/5 p-3">
                        {history.length > 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setHistoryOpen((o) => !o)}
                              className="flex w-full items-center gap-2 text-xs font-medium text-foreground"
                            >
                              <History className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                              Previous values ({history.length})
                              <ChevronDown
                                className={cn(
                                  "ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform",
                                  historyOpen && "rotate-180"
                                )}
                              />
                            </button>
                            {historyOpen && (
                              <ul className="space-y-2 pt-1">
                                {history.map((h) => {
                                  const hv = getValueDisplay(h);
                                  return (
                                    <li key={h.id} className="rounded-md border border-border/60 bg-background/60 px-2.5 py-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <span className="text-sm break-all line-through decoration-muted-foreground/50 text-muted-foreground">
                                          {hv.display}
                                        </span>
                                        {h.supersededAt && (
                                          <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                                            <Clock className="h-2.5 w-2.5" />
                                            {formatDateTime(h.supersededAt)}
                                          </span>
                                        )}
                                      </div>
                                      <p className="mt-0.5 text-[10px] text-muted-foreground/80">
                                        {h.userName ?? `User #${h.userId}`}
                                      </p>
                                      {h.note ? (
                                        <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-all">
                                          {h.note}
                                        </p>
                                      ) : null}
                                      {h.attachments.length > 0 && (
                                        <ul className="mt-1 space-y-1">
                                          {h.attachments.map((a) => (
                                            <li key={a.id} className="flex items-center gap-1.5 text-[11px]">
                                              <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                                              <a
                                                href={a.attachmentUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="truncate text-primary hover:underline"
                                              >
                                                {a.originalName}
                                              </a>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setFullHistoryOpen(true)}
                            className="flex w-full items-center gap-2 text-[11px] font-medium text-amber-700 transition-colors hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                          >
                            <History className="h-3.5 w-3.5" />
                            This value was corrected. View full history…
                          </button>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button onClick={() => setIsEditing(true)} className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </div>
            </div>
          ) : (
            /* ── Edit form (unfilled keys, or edit mode for filled keys) ── */
            <div className="space-y-4 p-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-primary/10 px-3 py-1.5 text-lg font-bold text-primary">
                    Store {storeId}
                  </span>
                  <span className="rounded-md bg-primary/10 px-3 py-1.5 text-lg font-bold text-primary">
                    {date}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Status: {effectiveFilled ? "Correcting value" : "Not Filled"}
                </p>
              </div>

              <Separator />

              {item.dataType === "text" && (
                <div className="space-y-2">
                  <Label htmlFor="due-key-text">Text Value</Label>
                  <Input
                    id="due-key-text"
                    value={textValue}
                    onChange={(event) => setTextValue(event.target.value)}
                    placeholder="Enter value"
                  />
                </div>
              )}

              {(item.dataType === "number" || item.dataType === "decimal") && (
                <div className="space-y-2">
                  <Label htmlFor="due-key-number">Number Value</Label>
                  <Input
                    id="due-key-number"
                    type="number"
                    step={item.dataType === "decimal" ? "0.01" : "1"}
                    value={numberValue}
                    onChange={(event) => setNumberValue(event.target.value)}
                    placeholder="Enter number"
                  />
                </div>
              )}

              {item.dataType === "boolean" && (
                <div className="space-y-2">
                  <Label>Boolean Value</Label>
                  <Select value={booleanValue} onValueChange={(v) => setBooleanValue(v as "null" | "true" | "false")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select value" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null">No Value</SelectItem>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {item.dataType === "json" && (
                <div className="space-y-2">
                  <Label htmlFor="due-key-json">JSON Value</Label>
                  <Textarea
                    id="due-key-json"
                    value={jsonValue}
                    onChange={(event) => {
                      setJsonValue(event.target.value);
                      if (jsonError) setJsonError(null);
                    }}
                    className="min-h-36"
                    placeholder='{"example": "value"}'
                  />
                  {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="due-key-note">
                  Note{" "}
                  <span className="text-xs font-normal text-muted-foreground">(optional, max 2000)</span>
                </Label>
                <Textarea
                  id="due-key-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={2000}
                  placeholder="Add a note..."
                  className="min-h-20 resize-none"
                />
                {note.length > 0 && (
                  <p className="text-right text-xs text-muted-foreground">{note.length}/2000</p>
                )}
              </div>

              {/* Attachments */}
              <div
                className="space-y-2"
                onMouseEnter={() => setIsHoveringAttachments(true)}
                onMouseLeave={() => setIsHoveringAttachments(false)}
              >
                <Label>
                  Attachments{" "}
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  {isHoveringAttachments && (
                    <span className="ml-2 text-xs text-muted-foreground/70">· Ctrl+V to paste</span>
                  )}
                </Label>
                {effectiveFilled && (currentValue?.attachments.length ?? 0) > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {currentValue!.attachments.length} existing file
                    {currentValue!.attachments.length !== 1 ? "s" : ""} will be kept unless you add new ones below.
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    Add files
                  </Button>
                  {attachments.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {attachments.length} file{attachments.length !== 1 ? "s" : ""} selected
                    </span>
                  )}
                </div>
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
                    // reset so the same file can be re-added after removal
                    e.target.value = "";
                  }}
                />
                {attachments.length > 0 && (
                  <ul className="space-y-1">
                    {attachments.map((file, idx) => (
                      <li
                        key={`${file.name}-${idx}`}
                        className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs"
                      >
                        <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{file.name}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {(file.size / 1024).toFixed(0)} KB
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setAttachments((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="shrink-0 rounded text-muted-foreground hover:text-destructive transition-colors"
                          aria-label={`Remove ${file.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {submitError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <span className="flex-1">{submitError}</span>
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => (effectiveFilled ? setIsEditing(false) : onOpenChange(false))}
                  disabled={isSubmitting}
                >
                  {effectiveFilled ? "Cancel" : "Close"}
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting || !payload}>
                  {isSubmitting
                    ? "Submitting..."
                    : effectiveFilled
                      ? "Save correction"
                      : "Submit"}
                </Button>
              </div>
            </div>
          )
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No due key selected.</p>
        )}
      </SheetContent>

      {item && (
        <DueKeyHistoryDialog
          open={fullHistoryOpen}
          onOpenChange={setFullHistoryOpen}
          storeId={storeId}
          keyId={item.keyId}
          date={date}
          label={item.label}
        />
      )}
    </Sheet>
  );
}
