"use client";

import { useMemo, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import type { DueKeyItem, DueKeyValuePayload } from "@/types/due-key.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";

interface FillAllKeysSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: DueKeyItem[];
  storeId: string;
  date: string;
  isSubmitting: boolean;
  submitError: string | null;
  onSubmit: (payload: { items: DueKeyValuePayload[] }) => Promise<boolean>;
}

export function FillAllKeysSheet({
  open,
  onOpenChange,
  items,
  storeId,
  date,
  isSubmitting,
  submitError,
  onSubmit,
}: FillAllKeysSheetProps) {
  const unfilledItems = useMemo(() => items.filter((it) => !it.filled), [items]);

  const [values, setValues] = useState<Record<number, { text?: string; number?: string; boolean?: "null" | "true" | "false"; json?: string; note?: string }>>(() => {
    const initial: Record<number, { text: string; number: string; boolean: "null" | "true" | "false"; json: string; note: string }> = {};
    for (const it of items) {
      initial[it.keyId] = { text: "", number: "", boolean: "null", json: "", note: "" };
    }
    return initial;
  });

  const [attachmentsMap, setAttachmentsMap] = useState<Record<number, File[]>>({});
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const [jsonErrors, setJsonErrors] = useState<Record<number, string | null>>({});

  // keep values in sync when items change
  const resetOnItems = useMemo(() => items.map((i) => i.keyId).join(","), [items]);
  if (resetOnItems) {
    // noop: value initialization above is enough for now; avoid re-initializing to preserve user edits
  }

  const handleChange = (keyId: number, field: string, v: string) => {
    setValues((prev) => ({ ...prev, [keyId]: { ...(prev[keyId] || {}), [field]: v } }));
    if (field === "json") {
      setJsonErrors((prev) => ({ ...prev, [keyId]: null }));
    }
  };

  const buildPayload = (): { items: DueKeyValuePayload[] } | null => {
    const payloadItems: DueKeyValuePayload[] = [];

    for (const it of unfilledItems) {
      const v = values[it.keyId] || { text: "", number: "", boolean: "null", json: "" };

      if (it.dataType === "json") {
        if (!((v.json || "").trim())) {
          payloadItems.push({ key_id: it.keyId, value_text: null, value_number: null, value_boolean: null, value_json: null });
          continue;
        }

        try {
          const parsed = JSON.parse(v.json || "");
          payloadItems.push({ key_id: it.keyId, value_text: null, value_number: null, value_boolean: null, value_json: parsed });
        } catch (err) {
          setJsonErrors((prev) => ({ ...prev, [it.keyId]: "Invalid JSON." }));
          return null;
        }

        continue;
      }

      if (it.dataType === "text") {
        payloadItems.push({ key_id: it.keyId, value_text: (v.text || "").trim() ? (v.text || "").trim() : null, value_number: null, value_boolean: null, value_json: null });
        continue;
      }

      if (it.dataType === "number" || it.dataType === "decimal") {
        const hasNumber = ((v.number || "") as string).trim().length > 0;
        const parsed = hasNumber ? Number(v.number) : null;
        if (hasNumber && Number.isNaN(parsed)) {
          toast.error(`Invalid number for key ${it.keyId}`);
          return null;
        }
        payloadItems.push({ key_id: it.keyId, value_text: null, value_number: parsed, value_boolean: null, value_json: null });
        continue;
      }

      // boolean
      payloadItems.push({ key_id: it.keyId, value_text: null, value_number: null, value_boolean: v.boolean === "null" ? null : v.boolean === "true", value_json: null });
    }

    const enrichedItems = payloadItems.map((p) => ({
      ...p,
      note: ((values[p.key_id]?.note ?? "").trim()) || null,
      attachments: (attachmentsMap[p.key_id] ?? []).length > 0 ? attachmentsMap[p.key_id] : null,
    }));
    return { items: enrichedItems };
  };

  const handleSubmit = async () => {
    const payload = buildPayload();
    if (!payload) return;

    // determine per-key mode for toasts after a successful save
    const modes: Record<number, "created" | "updated" | "deactivated"> = {};
    for (const it of unfilledItems) {
      const p = payload.items.find((x) => x.key_id === it.keyId)!;
      const hasNew = p.value_text !== null || p.value_number !== null || p.value_boolean !== null || p.value_json !== null;
      if (!it.filled && hasNew) modes[it.keyId] = "created";
      else if (it.filled && !hasNew) modes[it.keyId] = "deactivated";
      else modes[it.keyId] = "updated";
    }

    const ok = await onSubmit(payload);
    if (!ok) return;

    for (const it of unfilledItems) {
      const m = modes[it.keyId];
      if (m === "created") toast.success(`${it.label} created.`);
      else if (m === "deactivated") toast.success(`${it.label} deactivated.`);
      else toast.success(`${it.label} updated.`);
    }

    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full p-0 sm:max-w-3xl">
        <SheetHeader className="border-b pb-3">
          <SheetTitle>Fill All Keys</SheetTitle>
          <SheetDescription>Fill values for all keys for the selected store and date.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-4">
          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <p>Store: {storeId}</p>
            <p>Date: {date}</p>
            <p>Keys to fill: {unfilledItems.length}</p>
            <p />
          </div>

          <Separator />

          <div className="space-y-4 max-h-[60vh] overflow-auto pr-2">
            {unfilledItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">All keys are already filled.</p>
            ) : null}
            {unfilledItems.map((it) => (
              <div key={it.keyId} className="rounded-md border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-medium">{it.label} <span className="text-xs text-muted-foreground">#{it.keyId}</span></div>
                  <div className="text-sm text-muted-foreground">{it.dataType}</div>
                </div>

                <div className="mt-3">
                  {it.dataType === "text" && (
                    <div className="space-y-2">
                      <Label>Text</Label>
                      <Input value={values[it.keyId]?.text || ""} onChange={(e) => handleChange(it.keyId, "text", e.target.value)} />
                    </div>
                  )}

                  {(it.dataType === "number" || it.dataType === "decimal") && (
                    <div className="space-y-2">
                      <Label>Number</Label>
                      <Input type="number" step={it.dataType === "decimal" ? "0.01" : "1"} value={values[it.keyId]?.number || ""} onChange={(e) => handleChange(it.keyId, "number", e.target.value)} />
                    </div>
                  )}

                  {it.dataType === "boolean" && (
                    <div className="space-y-2">
                      <Label>Boolean</Label>
                      <Select value={values[it.keyId]?.boolean || "null"} onValueChange={(v) => handleChange(it.keyId, "boolean", v)}>
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

                  {it.dataType === "json" && (
                    <div className="space-y-2">
                      <Label>JSON</Label>
                      <Textarea value={values[it.keyId]?.json || ""} onChange={(e) => handleChange(it.keyId, "json", e.target.value)} className="min-h-28" />
                      {jsonErrors[it.keyId] && <p className="text-xs text-destructive">{jsonErrors[it.keyId]}</p>}
                    </div>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  <Label>
                    Note{" "}
                    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    value={values[it.keyId]?.note ?? ""}
                    onChange={(e) => handleChange(it.keyId, "note", e.target.value)}
                    maxLength={2000}
                    placeholder="Add a note..."
                    className="min-h-16 resize-none"
                  />
                </div>

                {/* Attachments */}
                <div className="mt-3 space-y-2">
                  <Label>
                    Attachments{" "}
                    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => fileInputRefs.current[it.keyId]?.click()}
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      Add files
                    </Button>
                    {(attachmentsMap[it.keyId]?.length ?? 0) > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {attachmentsMap[it.keyId].length} file{attachmentsMap[it.keyId].length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <input
                    ref={(el) => { fileInputRefs.current[it.keyId] = el; }}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const picked = Array.from(e.target.files ?? []);
                      if (picked.length > 0) {
                        setAttachmentsMap((prev) => ({
                          ...prev,
                          [it.keyId]: [...(prev[it.keyId] ?? []), ...picked],
                        }));
                      }
                      e.target.value = "";
                    }}
                  />
                  {(attachmentsMap[it.keyId]?.length ?? 0) > 0 && (
                    <ul className="space-y-1">
                      {attachmentsMap[it.keyId].map((file, fidx) => (
                        <li
                          key={`${file.name}-${fidx}`}
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
                              setAttachmentsMap((prev) => ({
                                ...prev,
                                [it.keyId]: prev[it.keyId].filter((_, i) => i !== fidx),
                              }))
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
              </div>
            ))}
          </div>

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Close</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save All"}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
