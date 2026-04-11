"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  AlertCircle,
  Paperclip,
  Pencil,
  X,
  Loader2,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { separationService } from "@/lib/api/services/separation.service";
import { hiringService } from "@/lib/api/services/hiring.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type {
  SeparationReasonType,
  SeparationType,
  SeparationReasonRecord,
  SeparationAttachmentInput,
  UpdatedAttachmentItem,
} from "@/types/separation.types";

interface ExistingAttachmentEntry {
  id: number;
  attatchment_path: string;
  attatchment_note: string;
  originalNote: string;
  deleted: boolean;
}

interface EditSeparationRequestDialogProps {
  separationId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const SEPARATION_TYPES: { value: SeparationType; label: string }[] = [
  { value: "termination", label: "Termination" },
  { value: "resignation", label: "Resignation" },
];

const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|bmp|svg)$/i;

function ExistingFileThumb({ url }: { url: string }) {
  const isImg = IMAGE_EXTS.test(url.split("?")[0]);
  if (isImg) {
    return (
      <img
        src={url}
        alt="attachment"
        className="h-8 w-8 rounded object-cover shrink-0"
      />
    );
  }
  return (
    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
      <FileText className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function NewAttachmentThumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImg = IMAGE_EXTS.test(file.name);

  useEffect(() => {
    if (!isImg) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file, isImg]);

  if (isImg && url) {
    return (
      <img
        src={url}
        alt={file.name}
        className="h-8 w-8 rounded object-cover shrink-0"
      />
    );
  }
  return (
    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
      <FileText className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

export function EditSeparationRequestDialog({
  separationId,
  open,
  onOpenChange,
  onSuccess,
}: EditSeparationRequestDialogProps) {
  const { selectedStore } = useSelectedStoreStore();

  const [separationReasons, setSeparationReasons] = useState<SeparationReasonRecord[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Display-only employee name
  const [employeeName, setEmployeeName] = useState("");

  // Form fields
  const [finalWorkDate, setFinalWorkDate] = useState("");
  const [separationType, setSeparationType] = useState<SeparationType | "">("");
  const [reasonType, setReasonType] = useState<SeparationReasonType | "">("");
  const [reasonId, setReasonId] = useState<string>("");
  const [reasonTitle, setReasonTitle] = useState("");
  const [otherNotes, setOtherNotes] = useState("");
  const [terminationLetter, setTerminationLetter] = useState("");

  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [existingAttachments, setExistingAttachments] = useState<ExistingAttachmentEntry[]>([]);
  const [newAttachments, setNewAttachments] = useState<{ file: File; note: string }[]>([]);

  const resetForm = useCallback(() => {
    setEmployeeName("");
    setFinalWorkDate("");
    setSeparationType("");
    setReasonType("");
    setReasonId("");
    setReasonTitle("");
    setOtherNotes("");
    setTerminationLetter("");
    setExistingAttachments([]);
    setNewAttachments([]);
    setIsDirty(false);
    setError(null);
    setLoadError(null);
  }, []);

  // Fetch the request + separation reasons when dialog opens
  useEffect(() => {
    if (!open || separationId === null || !selectedStore?.storeId) return;

    let cancelled = false;
    setIsLoadingData(true);
    setLoadError(null);

    Promise.all([
      separationService.getSeparationRequest(selectedStore.storeId, separationId),
      hiringService.getCreateEmployeePage(selectedStore.storeId),
    ])
      .then(([detail, pageData]) => {
        if (cancelled) return;

        // Employee display name
        const profile = detail.employee?.employee_profile;
        setEmployeeName(
          profile
            ? [profile.first_name, profile.middle_name, profile.last_name]
                .filter(Boolean)
                .join(" ")
            : `Employee #${detail.employee_id}`,
        );

        setFinalWorkDate(detail.final_work_date ?? "");
        const sepType = (detail.separation_type as SeparationType) ?? "";
        setSeparationType(sepType);

        // Prefer top-level reason fields; fall back to first attachment's reason
        const firstAttachment = detail.separation_attachments?.[0];
        const resolvedReasonType: SeparationReasonType | "" =
          (detail.reason_type as SeparationReasonType | undefined) ??
          (firstAttachment?.reason?.reason_type as SeparationReasonType | undefined) ??
          (sepType as SeparationReasonType | "") ??
          "";
        const resolvedReasonId: string =
          detail.reason_id != null
            ? String(detail.reason_id)
            : firstAttachment?.reason?.id != null
              ? String(firstAttachment.reason.id)
              : "";

        setReasonType(resolvedReasonType);
        setReasonId(resolvedReasonId);
        setReasonTitle(detail.reason_title ?? "");
        setOtherNotes(detail.other_notes ?? "");
        setTerminationLetter(detail.termination_letter ?? "");
        setExistingAttachments(
          (detail.separation_attachments ?? []).map((a) => ({
            id: a.id,
            attatchment_path: a.attatchment_path,
            attatchment_note: a.attatchment_note ?? "",
            originalNote: a.attatchment_note ?? "",
            deleted: false,
          })),
        );
        setNewAttachments([]);
        setIsDirty(false);

        setSeparationReasons(pageData.separationReasons as SeparationReasonRecord[]);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof Error && err.name === "CanceledError") return;
        setLoadError(
          err instanceof Error ? err.message : "Failed to load separation request.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoadingData(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, separationId, selectedStore?.storeId]);

  // When separation type changes, auto-align reason_type and reset reason selection
  useEffect(() => {
    if (!isDirty) return;
    if (separationType === "termination" || separationType === "resignation") {
      setReasonType((prev) => (prev === "other" ? prev : separationType));
      setReasonId("");
      setReasonTitle("");
    }
  }, [separationType, isDirty]);

  const filteredReasons = separationReasons.filter(
    (r) => r.reason_type === reasonType,
  );

  function markDirty() {
    if (!isDirty) setIsDirty(true);
  }

  function handleClose() {
    if (isDirty && !isSubmitting) {
      setShowConfirmExit(true);
      return;
    }
    resetForm();
    onOpenChange(false);
  }

  function confirmExit() {
    setShowConfirmExit(false);
    resetForm();
    onOpenChange(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files) {
      markDirty();
      setNewAttachments((prev) => [
        ...prev,
        ...Array.from(files).map((f) => ({ file: f, note: "" })),
      ]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeNewAttachment(index: number) {
    setNewAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  function updateNewAttachmentNote(index: number, note: string) {
    setNewAttachments((prev) =>
      prev.map((a, i) => (i === index ? { ...a, note } : a)),
    );
  }

  const activeAttachmentsCount =
    existingAttachments.filter((a) => !a.deleted).length + newAttachments.length;

  const isFormValid =
    finalWorkDate.trim() !== "" &&
    separationType !== "" &&
    reasonType !== "" &&
    (reasonType === "other" || reasonId !== "") &&
    (separationType !== "termination" || terminationLetter.trim() !== "") &&
    activeAttachmentsCount > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid || separationId === null) return;

    if (!selectedStore?.storeId) {
      setError("No store selected. Please select a store from the sidebar.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const deletedAttachment = existingAttachments.filter((a) => a.deleted).map((a) => a.id);
      const keptAttachment = existingAttachments
        .filter((a) => !a.deleted && a.attatchment_note === a.originalNote)
        .map((a) => a.id);
      const updatedAttachmentItems: UpdatedAttachmentItem[] = existingAttachments
        .filter((a) => !a.deleted && a.attatchment_note !== a.originalNote)
        .map((a) => ({ file: a.attatchment_path, note: a.attatchment_note || null }));
      const attPayload: SeparationAttachmentInput[] | undefined =
        newAttachments.length > 0
          ? newAttachments.map((a) => ({ file: a.file, note: a.note || null }))
          : undefined;

      await separationService.updateSeparationRequest(
        selectedStore.storeId,
        separationId,
        {
          final_work_date: finalWorkDate,
          separation_type: separationType as SeparationType,
          reason_type: reasonType as SeparationReasonType,
          reason_id: reasonType !== "other" && reasonId ? Number(reasonId) : null,
          reason_title: reasonTitle || null,
          other_notes: otherNotes || null,
          termination_letter:
            separationType === "termination" ? terminationLetter : null,
          attachments: attPayload,
          deletedAttachment: deletedAttachment.length > 0 ? deletedAttachment : undefined,
          keptAttachment: keptAttachment.length > 0 ? keptAttachment : undefined,
          updatedAttachment: updatedAttachmentItems.length > 0 ? updatedAttachmentItems : undefined,
        },
      );

      toast.success("Separation request updated successfully.");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "CanceledError") return;
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update separation request.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Separation Request #{separationId}
            </DialogTitle>
            <DialogDescription>
              Update the separation request details below.
            </DialogDescription>
          </DialogHeader>

          {loadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          {isLoadingData ? (
            <div className="space-y-4 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Employee (read-only) */}
              {employeeName && (
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Input value={employeeName} readOnly disabled />
                </div>
              )}

              {/* Final Work Date */}
              <div className="space-y-2">
                <Label htmlFor="edit-sep-final-work-date">
                  Final Work Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-sep-final-work-date"
                  type="date"
                  value={finalWorkDate}
                  onChange={(e) => {
                    markDirty();
                    setFinalWorkDate(e.target.value);
                  }}
                  required
                />
              </div>

              {/* Separation Type */}
              <div className="space-y-2">
                <Label>
                  Separation Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={separationType}
                  onValueChange={(v) => {
                    markDirty();
                    setSeparationType(v as SeparationType);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select separation type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEPARATION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Termination Letter — required when termination */}
              {separationType === "termination" && (
                <div className="space-y-2">
                  <Label htmlFor="edit-sep-termination-letter">
                    Termination Letter{" "}
                    <span className="text-destructive">*</span>
                    <span className="text-muted-foreground text-xs ms-1">
                      (max 255)
                    </span>
                  </Label>
                  <Input
                    id="edit-sep-termination-letter"
                    value={terminationLetter}
                    onChange={(e) => {
                      markDirty();
                      setTerminationLetter(e.target.value);
                    }}
                    placeholder="Reason for termination"
                    maxLength={255}
                  />
                </div>
              )}

              {/* ── Reason & Attachments ─────────────────────────────── */}
              {separationType !== "" && (
                <div className="rounded-md border p-4 space-y-4">
                  <p className="text-sm font-medium leading-none">
                    Reason &amp; Attachments
                  </p>

                  {/* "Other" reason toggle */}
                  <div className="flex items-center gap-2">
                    <input
                      id="edit-sep-reason-other"
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={reasonType === "other"}
                      onChange={(e) => {
                        markDirty();
                        if (e.target.checked) {
                          setReasonType("other");
                          setReasonId("");
                        } else {
                          setReasonType(separationType as SeparationReasonType);
                          setReasonId("");
                          setReasonTitle("");
                        }
                      }}
                    />
                    <Label
                      htmlFor="edit-sep-reason-other"
                      className="text-sm font-normal"
                    >
                      Other reason
                    </Label>
                  </div>

                  {/* Standard reason dropdown (termination | resignation) */}
                  {reasonType !== "" && reasonType !== "other" && (
                    <div className="space-y-2">
                      <Label>
                        Reason <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={reasonId}
                        onValueChange={(v) => {
                          markDirty();
                          setReasonId(v);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a reason" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredReasons.map((r) => (
                            <SelectItem key={r.id} value={String(r.id)}>
                              {r.reason_title}
                            </SelectItem>
                          ))}
                          {filteredReasons.length === 0 && (
                            <SelectItem value="_none" disabled>
                              No reasons available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* "Other" mode — optional existing other-type reasons + free-text title */}
                  {reasonType === "other" && (
                    <>
                      {filteredReasons.length > 0 && (
                        <div className="space-y-2">
                          <Label>
                            Available Other Reasons{" "}
                            <span className="text-muted-foreground text-xs">
                              (optional)
                            </span>
                          </Label>
                          <Select
                            value={reasonId}
                            onValueChange={(v) => {
                              markDirty();
                              setReasonId(v);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select an existing reason" />
                            </SelectTrigger>
                            <SelectContent>
                              {filteredReasons.map((r) => (
                                <SelectItem key={r.id} value={String(r.id)}>
                                  {r.reason_title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="edit-sep-reason-title">
                          Reason Title{" "}
                          <span className="text-muted-foreground text-xs">
                            (max 255)
                          </span>
                        </Label>
                        <Input
                          id="edit-sep-reason-title"
                          value={reasonTitle}
                          onChange={(e) => {
                            markDirty();
                            setReasonTitle(e.target.value);
                          }}
                          placeholder="Brief title for the reason"
                          maxLength={255}
                        />
                      </div>
                    </>
                  )}

                  {/* Existing attachments */}
                  {existingAttachments.length > 0 && (
                    <ul className="space-y-2">
                      {existingAttachments.map((att, i) => (
                        <li
                          key={att.id}
                          className={`flex flex-col gap-1 rounded-md border p-2 transition-opacity ${
                            att.deleted ? "opacity-50" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <ExistingFileThumb url={att.attatchment_path} />
                            <span className="truncate text-sm flex-1">
                              {decodeURIComponent(
                                att.attatchment_path.split("/").pop() ?? "file",
                              )}
                            </span>
                            {att.deleted ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="ms-auto h-6 px-2 text-xs"
                                onClick={() =>
                                  setExistingAttachments((prev) =>
                                    prev.map((a, j) =>
                                      j === i ? { ...a, deleted: false } : a,
                                    ),
                                  )
                                }
                              >
                                Restore
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 shrink-0 ms-auto"
                                onClick={() => {
                                  markDirty();
                                  setExistingAttachments((prev) =>
                                    prev.map((a, j) =>
                                      j === i ? { ...a, deleted: true } : a,
                                    ),
                                  );
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          {!att.deleted && (
                            <Input
                              placeholder="Note (optional, max 255)"
                              value={att.attatchment_note}
                              onChange={(e) => {
                                markDirty();
                                setExistingAttachments((prev) =>
                                  prev.map((a, j) =>
                                    j === i
                                      ? { ...a, attatchment_note: e.target.value }
                                      : a,
                                  ),
                                );
                              }}
                              maxLength={255}
                              className="h-8 text-xs"
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Add new attachments */}
                  <div className="space-y-2">
                    <Label>
                      Attachments <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Paperclip className="me-2 h-4 w-4" />
                        Add Files
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>
                    {newAttachments.length > 0 && (
                      <ul className="space-y-2 mt-2">
                        {newAttachments.map((att, i) => (
                          <li
                            key={`${att.file.name}-${i}`}
                            className="flex flex-col gap-1 rounded-md border border-dashed p-2"
                          >
                            <div className="flex items-center gap-2">
                              <NewAttachmentThumb file={att.file} />
                              <span className="truncate text-sm flex-1">{att.file.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 shrink-0 ms-auto"
                                onClick={() => removeNewAttachment(i)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <Input
                              placeholder="Note (optional, max 255)"
                              value={att.note}
                              onChange={(e) =>
                                updateNewAttachmentNote(i, e.target.value)
                              }
                              maxLength={255}
                              className="h-8 text-xs"
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                    {activeAttachmentsCount === 0 && (
                      <p className="text-xs text-muted-foreground">
                        At least one attachment is required.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Other Notes */}
              <div className="space-y-2">
                <Label htmlFor="edit-sep-other-notes">
                  Other Notes{" "}
                  <span className="text-muted-foreground text-xs">(max 255)</span>
                </Label>
                <Textarea
                  id="edit-sep-other-notes"
                  value={otherNotes}
                  onChange={(e) => {
                    markDirty();
                    setOtherNotes(e.target.value);
                  }}
                  placeholder="Additional notes..."
                  rows={3}
                  maxLength={255}
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!isFormValid || isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Unsaved changes confirmation */}
      <AlertDialog open={showConfirmExit} onOpenChange={setShowConfirmExit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to close?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExit}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
