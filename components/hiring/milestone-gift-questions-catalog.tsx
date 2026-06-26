"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
  ListChecks,
  RefreshCw,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { milestoneGiftService } from "@/lib/api/services/milestone-gift.service";
import { parseApiError, type ParsedApiError } from "@/lib/api/utils/error";
import type {
  MilestoneGiftQuestion,
  MilestoneGiftQuestionType,
} from "@/types/milestone-gift.types";

interface MilestoneGiftQuestionsCatalogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Numeric store id used to create store-specific questions (null = global only) */
  storeId?: number | string | null;
  storeName?: string | null;
}

export function MilestoneGiftQuestionsCatalog({
  open,
  onOpenChange,
  storeId,
  storeName,
}: MilestoneGiftQuestionsCatalogProps) {
  const [questions, setQuestions] = useState<MilestoneGiftQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Question form
  const [formMode, setFormMode] = useState<"none" | "create" | "edit">("none");
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [fText, setFText] = useState("");
  const [fType, setFType] = useState<MilestoneGiftQuestionType>("single_select");
  const [fSortOrder, setFSortOrder] = useState("0");
  const [fStoreSpecific, setFStoreSpecific] = useState(false);
  const [formError, setFormError] = useState<ParsedApiError | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Per-option editing
  const [editingOption, setEditingOption] = useState<{
    questionId: number;
    optionId: number;
  } | null>(null);
  const [optionEditText, setOptionEditText] = useState("");
  const [addOptionText, setAddOptionText] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

  // Delete-question confirmation
  const [deleteTarget, setDeleteTarget] = useState<MilestoneGiftQuestion | null>(
    null,
  );

  // Inactive questions are collapsed by default
  const [showInactive, setShowInactive] = useState(false);

  const loadQuestions = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const qs = await milestoneGiftService.getAllQuestions(signal);
      setQuestions([...qs].sort((a, b) => a.sort_order - b.sort_order));
    } catch (err) {
      if (err instanceof Error && err.name === "CanceledError") return;
      setLoadError(
        err instanceof Error ? err.message : "Failed to load questions.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void loadQuestions(controller.signal);
    return () => controller.abort();
  }, [open, loadQuestions]);

  function resetForm() {
    setFormMode("none");
    setEditingQuestionId(null);
    setFText("");
    setFType("single_select");
    setFSortOrder("0");
    setFStoreSpecific(false);
    setFormError(null);
  }

  function openCreate() {
    resetForm();
    setFormMode("create");
  }

  function openEdit(q: MilestoneGiftQuestion) {
    setFormMode("edit");
    setEditingQuestionId(q.id);
    setFText(q.question_text);
    setFType(q.question_type);
    setFSortOrder(String(q.sort_order));
    setFStoreSpecific(q.store_id != null);
    setFormError(null);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (fText.trim() === "") return;
    setFormSubmitting(true);
    setFormError(null);
    try {
      const sortOrder = Number(fSortOrder) || 0;
      if (formMode === "create") {
        await milestoneGiftService.createQuestion({
          question_text: fText.trim(),
          question_type: fType,
          sort_order: sortOrder,
          store_id:
            fStoreSpecific && storeId != null ? Number(storeId) : null,
        });
        toast.success("Question created.");
      } else if (formMode === "edit" && editingQuestionId !== null) {
        await milestoneGiftService.updateQuestion(editingQuestionId, {
          question_text: fText.trim(),
          question_type: fType,
          sort_order: sortOrder,
        });
        toast.success("Question updated.");
      }
      resetForm();
      await loadQuestions();
    } catch (err) {
      setFormError(parseApiError(err, "Failed to save question."));
    } finally {
      setFormSubmitting(false);
    }
  }

  async function confirmDeleteQuestion() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await milestoneGiftService.deleteQuestion(deleteTarget.id);
      toast.success("Question deactivated.");
      setDeleteTarget(null);
      await loadQuestions();
    } catch (err) {
      toast.error(parseApiError(err, "Failed to delete question.").message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddOption(questionId: number) {
    const text = (addOptionText[questionId] ?? "").trim();
    if (text === "") return;
    setBusy(true);
    try {
      await milestoneGiftService.addOption(questionId, { option_text: text });
      setAddOptionText((prev) => ({ ...prev, [questionId]: "" }));
      await loadQuestions();
    } catch (err) {
      toast.error(parseApiError(err, "Failed to add option.").message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveOption() {
    if (!editingOption || optionEditText.trim() === "") return;
    setBusy(true);
    try {
      await milestoneGiftService.updateOption(
        editingOption.questionId,
        editingOption.optionId,
        { option_text: optionEditText.trim() },
      );
      setEditingOption(null);
      setOptionEditText("");
      await loadQuestions();
    } catch (err) {
      toast.error(parseApiError(err, "Failed to update option.").message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteOption(questionId: number, optionId: number) {
    setBusy(true);
    try {
      await milestoneGiftService.deleteOption(questionId, optionId);
      await loadQuestions();
    } catch (err) {
      toast.error(parseApiError(err, "Failed to delete option.").message);
    } finally {
      setBusy(false);
    }
  }

  const canCreateStoreSpecific = storeId != null;

  const activeQuestions = questions.filter((q) => q.is_active);
  const inactiveQuestions = questions.filter((q) => !q.is_active);

  const renderQuestionCard = (q: MilestoneGiftQuestion) => (
    <div
      key={q.id}
      className={`rounded-lg border p-4 space-y-3 ${
        q.is_active ? "" : "opacity-70"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <p className="text-sm font-medium leading-snug">{q.question_text}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">
              {q.question_type === "multi_select"
                ? "Multi Select"
                : "Single Select"}
            </Badge>
            <Badge variant={q.store_id == null ? "default" : "outline"}>
              {q.store_id == null ? "Global" : "Store"}
            </Badge>
            {!q.is_active && <Badge variant="destructive">Inactive</Badge>}
            <span className="text-xs text-muted-foreground">
              order {q.sort_order}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => openEdit(q)}
            disabled={busy}
            aria-label="Edit question"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(q)}
            disabled={busy || !q.is_active}
            aria-label="Delete question"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Options */}
      <div className="space-y-1.5 ps-1">
        {q.options.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No options yet.</p>
        )}
        {[...q.options]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((opt) => {
            const isEditing =
              editingOption?.questionId === q.id &&
              editingOption?.optionId === opt.id;
            return (
              <div
                key={opt.id}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5"
              >
                {isEditing ? (
                  <>
                    <Input
                      value={optionEditText}
                      onChange={(e) => setOptionEditText(e.target.value)}
                      className="h-7 text-sm"
                      maxLength={255}
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={handleSaveOption}
                      disabled={busy || optionEditText.trim() === ""}
                      aria-label="Save option"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => {
                        setEditingOption(null);
                        setOptionEditText("");
                      }}
                      disabled={busy}
                      aria-label="Cancel edit"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm">
                      {opt.option_text}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => {
                        setEditingOption({
                          questionId: q.id,
                          optionId: opt.id,
                        });
                        setOptionEditText(opt.option_text);
                      }}
                      disabled={busy}
                      aria-label="Edit option"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteOption(q.id, opt.id)}
                      disabled={busy}
                      aria-label="Delete option"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            );
          })}

        {/* Add option */}
        <div className="flex items-center gap-2 pt-1">
          <Input
            value={addOptionText[q.id] ?? ""}
            onChange={(e) =>
              setAddOptionText((prev) => ({
                ...prev,
                [q.id]: e.target.value,
              }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddOption(q.id);
              }
            }}
            placeholder="Add an option…"
            className="h-8 text-sm"
            maxLength={255}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            onClick={() => handleAddOption(q.id)}
            disabled={busy || (addOptionText[q.id] ?? "").trim() === ""}
          >
            <Plus className="me-1 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex w-[95vw] max-w-2xl flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              Milestone Gift Questions
            </DialogTitle>
            <DialogDescription>
              Manage the rating questions used across milestone gift requests.
              Global questions apply to every store; store questions only appear
              for {storeName ?? "the selected store"}.
            </DialogDescription>
          </DialogHeader>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadQuestions()}
              disabled={isLoading || busy}
            >
              <RefreshCw
                className={isLoading ? "me-2 h-4 w-4 animate-spin" : "me-2 h-4 w-4"}
              />
              Refresh
            </Button>
            {formMode === "none" && (
              <Button size="sm" onClick={openCreate}>
                <Plus className="me-2 h-4 w-4" />
                New Question
              </Button>
            )}
          </div>

          {loadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          {/* Question form (create / edit) */}
          {formMode !== "none" && (
            <form
              onSubmit={submitForm}
              className="rounded-lg border p-4 space-y-3 bg-muted/30"
            >
              <p className="text-sm font-semibold">
                {formMode === "create" ? "New Question" : "Edit Question"}
              </p>

              {formError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <span>{formError.message}</span>
                    {formError.details.length > 0 && (
                      <ul className="mt-1 list-disc ps-4 text-xs space-y-0.5">
                        {formError.details.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="q-text">
                  Question Text <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="q-text"
                  value={fText}
                  onChange={(e) => setFText(e.target.value)}
                  placeholder="e.g. How would you rate this employee's attendance?"
                  maxLength={500}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>
                    Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={fType}
                    onValueChange={(v) =>
                      setFType(v as MilestoneGiftQuestionType)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single_select">
                        Single Select
                      </SelectItem>
                      <SelectItem value="multi_select">Multi Select</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="q-sort">Sort Order</Label>
                  <Input
                    id="q-sort"
                    type="number"
                    value={fSortOrder}
                    onChange={(e) => setFSortOrder(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Scope — only choosable on create */}
              {formMode === "create" ? (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="q-store-specific"
                    checked={fStoreSpecific}
                    onCheckedChange={(c) => setFStoreSpecific(c === true)}
                    disabled={!canCreateStoreSpecific}
                  />
                  <Label
                    htmlFor="q-store-specific"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Store-specific (only {storeName ?? "this store"})
                    {!canCreateStoreSpecific && (
                      <span className="text-muted-foreground ms-1">
                        — no store selected, will be global
                      </span>
                    )}
                  </Label>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Scope:{" "}
                  <span className="font-medium text-foreground">
                    {fStoreSpecific ? "Store-specific" : "Global"}
                  </span>{" "}
                  (cannot be changed after creation)
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetForm}
                  disabled={formSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={formSubmitting || fText.trim() === ""}
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : formMode === "create" ? (
                    "Create"
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Questions list */}
          <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-3">
            {isLoading && questions.length === 0 ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))
            ) : questions.length === 0 && !loadError ? (
              <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
                No questions yet. Create one to get started.
              </div>
            ) : (
              <>
                {/* Active questions */}
                {activeQuestions.map(renderQuestionCard)}

                {activeQuestions.length === 0 && (
                  <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
                    No active questions.
                  </div>
                )}

                {/* Inactive questions — collapsed by default */}
                {inactiveQuestions.length > 0 && (
                  <div className="space-y-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowInactive((v) => !v)}
                      className="flex w-full items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
                    >
                      {showInactive ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )}
                      <span className="font-medium">
                        Inactive questions ({inactiveQuestions.length})
                      </span>
                    </button>
                    {showInactive && inactiveQuestions.map(renderQuestionCard)}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete question confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this question?</AlertDialogTitle>
            <AlertDialogDescription>
              It will no longer appear on rating forms. Existing answers are
              preserved. This can be re-created if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteQuestion();
              }}
              disabled={busy}
            >
              {busy ? "Deactivating…" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
