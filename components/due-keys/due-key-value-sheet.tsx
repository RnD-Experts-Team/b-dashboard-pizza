"use client";

import { useEffect, useMemo, useState } from "react";
import { Paperclip, X as XIcon } from "lucide-react";
import type { DueKeyItem, DueKeyValuePayload } from "@/types/due-key.types";
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
  ) => Promise<void>;
}

function normalizeValueForInput(item: DueKeyItem | null): string {
  if (!item || item.value == null) return "";
  if (item.dataType === "json") {
    try {
      return JSON.stringify(item.value, null, 2);
    } catch {
      return "";
    }
  }
  return String(item.value);
}

function getFilledValueDisplay(item: DueKeyItem): { label: string; display: string; raw: unknown } {
  const v = item.value as any;
  if (v == null) return { label: "Value", display: "—", raw: null };

  if (v?.value_text != null) return { label: "Text Value", display: String(v.value_text), raw: v.value_text };
  if (v?.value_number != null) return { label: "Number Value", display: String(v.value_number), raw: v.value_number };
  if (v?.value_boolean != null) return { label: "Boolean Value", display: String(v.value_boolean), raw: v.value_boolean };
  if (v?.value_json != null) {
    try {
      return { label: "JSON Value", display: JSON.stringify(v.value_json, null, 2), raw: v.value_json };
    } catch {
      return { label: "JSON Value", display: String(v.value_json), raw: v.value_json };
    }
  }

  if (typeof item.value === "object") {
    try {
      return { label: "Value", display: JSON.stringify(item.value, null, 2), raw: item.value };
    } catch {
      return { label: "Value", display: "[Object]", raw: item.value };
    }
  }

  return { label: "Value", display: String(item.value), raw: item.value };
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
  const [attachments, setAttachments] = useState<string[]>([]);
  const [attachmentInput, setAttachmentInput] = useState("");

  useEffect(() => {
    if (!item) return;
    const normalized = normalizeValueForInput(item);
    setTextValue(item.dataType === "text" ? normalized : "");
    setNumberValue(
      item.dataType === "number" || item.dataType === "decimal" ? normalized : ""
    );
    setBooleanValue(
      item.dataType === "boolean"
        ? item.value == null
          ? "null"
          : item.value
            ? "true"
            : "false"
        : "null"
    );
    setJsonValue(item.dataType === "json" ? normalized : "");
    setJsonError(null);
    setNote("");
    setAttachments([]);
    setAttachmentInput("");
  }, [item]);

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

  const addAttachment = () => {
    const trimmed = attachmentInput.trim();
    if (!trimmed) return;
    setAttachments((prev) => [...prev, trimmed]);
    setAttachmentInput("");
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const submitMode: "created" | "updated" | "deactivated" = useMemo(() => {
    if (!item || !payload) return "updated";
    const hasNewValue =
      payload.value_text !== null ||
      payload.value_number !== null ||
      payload.value_boolean !== null ||
      payload.value_json !== null;

    if (!item.filled && hasNewValue) return "created";
    if (item.filled && !hasNewValue) return "deactivated";
    return "updated";
  }, [item, payload]);

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
    await onSubmit(
      { ...payload, note: note.trim() || null, attachments: attachments.length > 0 ? attachments : null },
      submitMode
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full p-0 sm:max-w-xl">
        <SheetHeader className="border-b pb-3">
          <SheetTitle>Due Key Value</SheetTitle>
          <SheetDescription>
            {item ? `${item.label} (#${item.keyId})` : "Select a due key"}
          </SheetDescription>
        </SheetHeader>

        {item ? (
          item.filled ? (
            /* ── Read-only detail view for filled keys ── */
            <div className="space-y-4 p-4">
              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <p>Store: {storeId}</p>
                <p>Date: {date}</p>
                <p>Data Type: {item.dataType}</p>
                <p className="flex items-center gap-1.5">
                  Status: <Badge variant="default" className="text-xs">Filled</Badge>
                </p>
              </div>

              <Separator />

              {(() => {
                const { label, display } = getFilledValueDisplay(item);
                const isJson = item.dataType === "json" || display.startsWith("{") || display.startsWith("[");
                const note = (item.value as any)?.note;
                return (
                  <>
                    <div className="space-y-2">
                      <Label>{label}</Label>
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

                    {note ? (
                      <div className="space-y-2">
                        <Label>Note</Label>
                        <div className="rounded-md border bg-muted px-3 py-2 text-sm whitespace-pre-wrap break-all">
                          {note}
                        </div>
                      </div>
                    ) : null}

                    {(() => {
                      const att = (item.value as { attachments?: string[] } | null)?.attachments;
                      if (!att || att.length === 0) return null;
                      return (
                        <div className="space-y-2">
                          <Label>Attachments</Label>
                          <div className="flex flex-wrap gap-1.5">
                            {att.map((a, i) => (
                              <Badge key={i} variant="secondary" className="gap-1 text-xs">
                                <Paperclip className="h-3 w-3" />
                                <span className="max-w-40 truncate">{a}</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            /* ── Edit form (unfilled keys, or edit mode for filled keys) ── */
            <div className="space-y-4 p-4">
              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <p>Store: {storeId}</p>
                <p>Date: {date}</p>
                <p>Data Type: {item.dataType}</p>
                <p>Status: {item.filled ? "Filled" : "Not Filled"}</p>
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
                      <SelectItem value="true">True</SelectItem>
                      <SelectItem value="false">False</SelectItem>
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
                <Label>
                  Attachments{" "}
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={attachmentInput}
                    onChange={(e) => setAttachmentInput(e.target.value)}
                    placeholder="Add attachment identifier..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addAttachment(); }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addAttachment}
                    disabled={!attachmentInput.trim()}
                  >
                    Add
                  </Button>
                </div>
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {attachments.map((att, idx) => (
                      <Badge key={idx} variant="secondary" className="gap-1 pr-1 text-xs">
                        <Paperclip className="h-3 w-3" />
                        <span className="max-w-32 truncate">{att}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          className="ml-0.5 hover:text-destructive"
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="due-key-note">
                  Note{" "}
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
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

              {submitError && <p className="text-sm text-destructive">{submitError}</p>}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Close
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting || !payload}>
                  {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </div>
          )
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No due key selected.</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
