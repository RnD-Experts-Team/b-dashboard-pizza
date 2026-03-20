"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  ClipboardCheck,
  Paperclip,
  X,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react";
import {
  useEntitiesForCameraForm,
  useUpdateCameraForm,
  useCameraFormDetail,
} from "@/lib/hooks/use-camera-form";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuthStore } from "@/lib/auth/auth.store";
import type {
  CameraFormUpdateEntityEntry,
  CameraFormAttachment,
} from "@/types/qa.types";
import { useRouter, useParams } from "next/navigation";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Constants                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

const RATINGS = [
  { id: 1, key: "pass" },
  { id: 2, key: "fail" },
  { id: 3, key: "notDone" },
  { id: 4, key: "cameraFail" },
  { id: 5, key: "autoFail" },
  { id: 6, key: "urgent" },
] as const;

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_PREFIX = "image/";
const REPORT_TYPE_ALL = "__all__";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

interface NoteEntry {
  existingId?: number;
  note: string;
  files: File[];
  existingAttachments: CameraFormAttachment[];
  removedAttachmentIds: number[];
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Component                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

interface EditCameraFormProps {
  formId: number;
}

export function EditCameraForm({ formId }: EditCameraFormProps) {
  const t = useTranslations("editCameraForm");
  const tCreate = useTranslations("createCameraForm");
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  // ── Data hooks ─────────────────────────────────────────────────────────
  const overviewStores = useAuthStore((state) => state.overviewStores);
  const authLoading = useAuthStore((state) => state.isLoading);

  const stores = useMemo(() => {
    return (overviewStores ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      storeId: s.storeId ?? s.id,
    }));
  }, [overviewStores]);

  const isStoresLoading = authLoading && stores.length === 0;
  const storesError: string | null = null;

  const {
    entities,
    categories,
    isLoading: isEntitiesLoading,
    error: entitiesError,
  } = useEntitiesForCameraForm();

  const {
    audit,
    isLoading: isAuditLoading,
    error: auditError,
  } = useCameraFormDetail(formId);

  const {
    updateCameraForm,
    isSubmitting,
    error: submitError,
    clearError,
  } = useUpdateCameraForm();

  // ── Tab / filter state ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<string>("daily");
  const [reportType, setReportType] = useState<string>(REPORT_TYPE_ALL);

  // ── Form state ─────────────────────────────────────────────────────────
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [entityRatings, setEntityRatings] = useState<Record<string, string>>({});
  const [entityNotes, setEntityNotes] = useState<Record<string, NoteEntry[]>>({});
  const [removedNoteIds, setRemovedNoteIds] = useState<number[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPrePopulated, setIsPrePopulated] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [collapsedEntities, setCollapsedEntities] = useState<Record<string, boolean>>({});
  const [hoveredAttachmentKey, setHoveredAttachmentKey] = useState<{
    tab: string;
    entityId: number;
    noteIdx: number;
  } | null>(null);

  // ── Key helpers ────────────────────────────────────────────────────────
  const eKey = (tab: string, entityId: number) => `${tab}_${entityId}`;
  const cKey = (tab: string, catId: number) => `${tab}_${catId}`;

  const normalizeStoreValue = (value: string | number | null | undefined) =>
    String(value ?? "").trim().toLowerCase();

  // ── Pre-populate store from fetched audit detail once store options are ready ──
  useEffect(() => {
    if (!audit || selectedStoreId) return;
    if (isStoresLoading || stores.length === 0) return;

    const auditStoreId = normalizeStoreValue(audit.storeId);
    const auditStoreCode = normalizeStoreValue(audit.store?.store);

    const matchedStore = stores.find((store) => {
      const optionId = normalizeStoreValue(store.id);
      const optionStoreCode = normalizeStoreValue(store.storeId);
      const optionName = normalizeStoreValue(store.name);

      if (auditStoreId && optionId === auditStoreId) return true;
      if (!auditStoreCode) return false;

      return (
        optionStoreCode === auditStoreCode ||
        optionName === auditStoreCode ||
        optionId === auditStoreCode
      );
    });

    if (matchedStore) {
      setSelectedStoreId(String(matchedStore.id));
    }
  }, [audit, stores, selectedStoreId, isStoresLoading]);

  // ── Pre-populate ratings/notes/tab from audit data ─────────────────────
  useEffect(() => {
    if (!audit || isPrePopulated || entities.length === 0) return;

    const dateOnly = audit.date.includes("T") ? audit.date.split("T")[0] : audit.date;
    setSelectedDate(dateOnly);

    const ratings: Record<string, string> = {};
    const notes: Record<string, NoteEntry[]> = {};

    for (const cf of audit.cameraForms) {
      // Find the entity to determine its dateRangeType
      const entityDef = entities.find((e) => e.id === cf.entityId);
      const tab = entityDef?.dateRangeType?.toLowerCase() || "daily";
      const key = eKey(tab, cf.entityId);

      ratings[key] = String(cf.ratingId);

      if (cf.notes && cf.notes.length > 0) {
        notes[key] = cf.notes.map((n) => ({
          existingId: n.id,
          note: n.note || "",
          files: [],
          existingAttachments: n.attachments || [],
          removedAttachmentIds: [],
        }));
      } else {
        notes[key] = [{ note: "", files: [], existingAttachments: [], removedAttachmentIds: [] }];
      }
    }

    setEntityRatings(ratings);
    setEntityNotes(notes);

    // Auto-detect tab
    const auditEntityIds = new Set(audit.cameraForms.map((cf) => cf.entityId));
    const matched = entities.find((e) => auditEntityIds.has(e.id));
    if (matched) {
      setActiveTab(matched.dateRangeType.toLowerCase());
      if (matched.reportType) {
        setReportType(matched.reportType);
      }
    }

    setIsPrePopulated(true);
  }, [audit, entities, isPrePopulated]);

  // ── Filter entities per tab ────────────────────────────────────────────
  const getFilteredEntities = useCallback(
    (dateRangeType: string) => {
      return entities.filter((entity) => {
        if (!entity.active) return false;
        if (entity.dateRangeType.toLowerCase() !== dateRangeType.toLowerCase()) return false;
        if (reportType && reportType !== REPORT_TYPE_ALL) {
          if (!entity.reportType || entity.reportType.toLowerCase() !== reportType.toLowerCase()) return false;
        }
        return true;
      });
    },
    [entities, reportType]
  );

  const dailyEntities = useMemo(() => getFilteredEntities("daily"), [getFilteredEntities]);
  const weeklyEntities = useMemo(() => getFilteredEntities("weekly"), [getFilteredEntities]);

  const getGroupedEntities = useCallback(
    (filtered: typeof entities) => {
      const groups: Record<number, { categoryId: number; categoryLabel: string; entities: typeof filtered }> = {};
      for (const entity of filtered) {
        const catId = entity.categoryId;
        if (!groups[catId]) {
          const category = categories.find((c) => c.id === catId);
          groups[catId] = {
            categoryId: catId,
            categoryLabel: entity.categoryLabel || category?.label || `Category ${catId}`,
            entities: [],
          };
        }
        groups[catId].entities.push(entity);
      }
      return Object.values(groups).sort((a, b) => {
        const catA = categories.find((c) => c.id === a.categoryId);
        const catB = categories.find((c) => c.id === b.categoryId);
        return (catA?.sortOrder ?? 0) - (catB?.sortOrder ?? 0);
      });
    },
    [categories]
  );

  const dailyGrouped = useMemo(() => getGroupedEntities(dailyEntities), [getGroupedEntities, dailyEntities]);
  const weeklyGrouped = useMemo(() => getGroupedEntities(weeklyEntities), [getGroupedEntities, weeklyEntities]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleRatingChange = useCallback(
    (tab: string, entityId: number, ratingId: string | null) => {
      const key = eKey(tab, entityId);
      setEntityRatings((prev) => {
        if (ratingId === null) {
          const next = { ...prev };
          delete next[key];
          return next;
        }
        return { ...prev, [key]: ratingId };
      });
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[`entity_${entityId}`];
        delete next.entities;
        return next;
      });
    },
    []
  );

  const getNotesForEntity = useCallback(
    (tab: string, entityId: number): NoteEntry[] => {
      return entityNotes[eKey(tab, entityId)] || [{ note: "", files: [], existingAttachments: [], removedAttachmentIds: [] }];
    },
    [entityNotes]
  );

  const handleNoteTextChange = useCallback(
    (tab: string, entityId: number, noteIndex: number, text: string) => {
      const key = eKey(tab, entityId);
      setEntityNotes((prev) => {
        const current = prev[key] || [{ note: "", files: [], existingAttachments: [], removedAttachmentIds: [] }];
        const updated = [...current];
        updated[noteIndex] = { ...updated[noteIndex], note: text };
        return { ...prev, [key]: updated };
      });
    },
    []
  );

  const handleNoteFilesChange = useCallback(
    (tab: string, entityId: number, noteIndex: number, files: FileList | null) => {
      if (!files || files.length === 0) return;
      const incoming = Array.from(files);
      const valid: File[] = [];
      let hasInvalid = false;
      for (const file of incoming) {
        if (file.type.startsWith(ALLOWED_IMAGE_MIME_PREFIX) && file.size <= MAX_ATTACHMENT_BYTES) {
          valid.push(file);
        } else {
          hasInvalid = true;
        }
      }
      if (valid.length === 0 && hasInvalid) {
        setValidationErrors((prev) => ({
          ...prev,
          [`entity_${entityId}_files`]:
            tCreate("entities.attachmentInvalid") || "Only image files up to 5MB are allowed.",
        }));
        return;
      }
      if (!hasInvalid) {
        setValidationErrors((prev) => {
          const next = { ...prev };
          delete next[`entity_${entityId}_files`];
          return next;
        });
      }
      const key = eKey(tab, entityId);
      setEntityNotes((prev) => {
        const current = prev[key] || [{ note: "", files: [], existingAttachments: [], removedAttachmentIds: [] }];
        const updated = [...current];
        updated[noteIndex] = {
          ...updated[noteIndex],
          files: [...updated[noteIndex].files, ...valid],
        };
        return { ...prev, [key]: updated };
      });
    },
    [tCreate]
  );

  const handleRemoveNoteFile = useCallback(
    (tab: string, entityId: number, noteIndex: number, fileIndex: number) => {
      const key = eKey(tab, entityId);
      setEntityNotes((prev) => {
        const current = prev[key] || [{ note: "", files: [], existingAttachments: [], removedAttachmentIds: [] }];
        const updated = [...current];
        updated[noteIndex] = {
          ...updated[noteIndex],
          files: updated[noteIndex].files.filter((_, i) => i !== fileIndex),
        };
        return { ...prev, [key]: updated };
      });
    },
    []
  );

  const handleRemoveExistingAttachment = useCallback(
    (tab: string, entityId: number, noteIndex: number, attachmentId: number) => {
      const key = eKey(tab, entityId);
      setEntityNotes((prev) => {
        const current = prev[key] || [{ note: "", files: [], existingAttachments: [], removedAttachmentIds: [] }];
        const updated = [...current];
        updated[noteIndex] = {
          ...updated[noteIndex],
          existingAttachments: updated[noteIndex].existingAttachments.filter((a) => a.id !== attachmentId),
          removedAttachmentIds: [...updated[noteIndex].removedAttachmentIds, attachmentId],
        };
        return { ...prev, [key]: updated };
      });
    },
    []
  );

  const handleAddNote = useCallback(
    (tab: string, entityId: number) => {
      const key = eKey(tab, entityId);
      setEntityNotes((prev) => {
        const current = prev[key] || [{ note: "", files: [], existingAttachments: [], removedAttachmentIds: [] }];
        return { ...prev, [key]: [...current, { note: "", files: [], existingAttachments: [], removedAttachmentIds: [] }] };
      });
    },
    []
  );

  const handleRemoveNote = useCallback(
    (tab: string, entityId: number, noteIndex: number) => {
      const key = eKey(tab, entityId);
      setEntityNotes((prev) => {
        const current = prev[key] || [{ note: "", files: [], existingAttachments: [], removedAttachmentIds: [] }];
        const removed = current[noteIndex];
        // Track existing note id for deletion on server
        if (removed?.existingId) {
          setRemovedNoteIds((ids) => [...ids, removed.existingId!]);
        }
        const updated = current.filter((_, i) => i !== noteIndex);
        return {
          ...prev,
          [key]: updated.length > 0 ? updated : [{ note: "", files: [], existingAttachments: [], removedAttachmentIds: [] }],
        };
      });
    },
    []
  );

  // ── Clipboard paste ────────────────────────────────────────────────────
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!hoveredAttachmentKey) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const images: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith(ALLOWED_IMAGE_MIME_PREFIX)) {
          const file = item.getAsFile();
          if (file && file.size <= MAX_ATTACHMENT_BYTES) images.push(file);
        }
      }
      if (images.length === 0) return;
      e.preventDefault();
      const { tab, entityId, noteIdx } = hoveredAttachmentKey;
      const key = `${tab}_${entityId}`;
      setEntityNotes((prev) => {
        const current = prev[key] || [{ note: "", files: [], existingAttachments: [], removedAttachmentIds: [] }];
        const updated = [...current];
        updated[noteIdx] = {
          ...updated[noteIdx],
          files: [...(updated[noteIdx]?.files ?? []), ...images],
        };
        return { ...prev, [key]: updated };
      });
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [hoveredAttachmentKey]);

  // ── Validation ─────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!selectedStoreId) errors.store = tCreate("validation.storeRequired");
    if (!selectedDate) {
      errors.date = tCreate("validation.dateRequired");
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(selectedDate) || isNaN(Date.parse(selectedDate))) {
        errors.date = tCreate("validation.dateInvalid");
      }
    }
    if (dailyEntities.length === 0 && weeklyEntities.length === 0) {
      errors.entities = tCreate("validation.entitiesRequired");
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Build update entity entries for a tab ──────────────────────────────
  const buildEntityEntries = (tab: string, filtered: typeof entities): CameraFormUpdateEntityEntry[] => {
    return filtered.map((entity) => {
      const key = eKey(tab, entity.id);
      const rating = entityRatings[key];
      const notes = entityNotes[key] || [{ note: "", files: [], existingAttachments: [], removedAttachmentIds: [] }];

      const entry: CameraFormUpdateEntityEntry = {
        entity_id: entity.id,
        ...(rating && { rating_id: Number(rating) }),
      };

      // Build notes array
      const noteEntries = notes
        .filter((n) => n.note.trim() || n.files.length > 0 || n.existingId || n.removedAttachmentIds.length > 0)
        .map((n) => ({
          ...(n.existingId != null ? { id: n.existingId } : {}),
          ...(n.note.trim() ? { note: n.note.trim() } : {}),
          ...(n.files.length > 0 ? { images: n.files } : {}),
          ...(n.removedAttachmentIds.length > 0 ? { remove_attachment_ids: n.removedAttachmentIds } : {}),
        }));

      if (noteEntries.length > 0) {
        entry.notes = noteEntries;
      }

      // Track removed notes for this entity
      const entityRemovedNotes = removedNoteIds.filter((nid) => {
        // Only include if relevant to this entity's original notes
        if (!audit) return false;
        const cf = audit.cameraForms.find((c) => c.entityId === entity.id);
        return cf?.notes?.some((n) => n.id === nid) ?? false;
      });
      if (entityRemovedNotes.length > 0) {
        entry.remove_note_ids = entityRemovedNotes;
      }

      return entry;
    });
  };

  // ── Submit handler ─────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    clearError();
    if (!validate()) return;

    const allEntries = [
      ...buildEntityEntries("daily", dailyEntities),
      ...buildEntityEntries("weekly", weeklyEntities),
    ];

    if (allEntries.length === 0) {
      setValidationErrors({ entities: tCreate("validation.entitiesRequired") });
      return;
    }

    const success = await updateCameraForm(formId, Number(selectedStoreId), selectedDate, allEntries);
    if (success) {
      setSuccessMessage(t("success"));
      setTimeout(() => {
        router.push(`/${locale}/dashboard/quality-assurance`);
      }, 1500);
    }
  };

  // ── Loading / error states ─────────────────────────────────────────────
  const isDataLoading = isStoresLoading || isEntitiesLoading || isAuditLoading;

  if (isAuditLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (auditError) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{auditError}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => router.push(`/${locale}/dashboard/quality-assurance`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back")}
        </Button>
      </div>
    );
  }

  // ── Render entity card ────────────────────────────────────────────────
  const renderEntityCard = (tab: string, entity: (typeof entities)[0]) => {
    const key = eKey(tab, entity.id);
    const ratingValue = entityRatings[key] || "";
    const notes = getNotesForEntity(tab, entity.id);
    const isEntityOpen = collapsedEntities[key] !== false;

    return (
      <Collapsible
        key={entity.id}
        open={isEntityOpen}
        onOpenChange={(open) =>
          setCollapsedEntities((prev) => ({ ...prev, [key]: open }))
        }
      >
        <div
          className={`overflow-hidden rounded-lg border transition-colors ${
            ratingValue ? "border-primary/30 bg-primary/5" : "border-border"
          }`}
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2.5 text-start"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-xs font-medium leading-tight">{entity.entityLabel}</span>
                {ratingValue && (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    {RATINGS.find((r) => String(r.id) === ratingValue)
                      ? tCreate(`entities.${RATINGS.find((r) => String(r.id) === ratingValue)!.key}`)
                      : ""}
                  </Badge>
                )}
              </div>
              {isEntityOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="space-y-2 border-t px-3 pb-3 pt-2">
              {/* Rating Selection — toggle buttons */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">{tCreate("entities.rating")}</Label>
                <div className="flex flex-wrap gap-1">
                  {RATINGS.map((rating) => {
                    const isSelected = ratingValue === String(rating.id);
                    return (
                      <Button
                        key={rating.id}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className="h-7 px-2 text-[10px]"
                        disabled={isSubmitting}
                        onClick={() => handleRatingChange(tab, entity.id, isSelected ? null : String(rating.id))}
                      >
                        {tCreate(`entities.${rating.key}`)}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Notes (multi) */}
              <div className="space-y-2">
                {notes.map((noteEntry, noteIdx) => (
                  <div key={noteIdx} className="space-y-1 rounded border border-dashed border-muted-foreground/30 p-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] text-muted-foreground">
                        {tCreate("entities.note")} {notes.length > 1 ? `#${noteIdx + 1}` : ""}
                      </Label>
                      {notes.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          disabled={isSubmitting}
                          onClick={() => handleRemoveNote(tab, entity.id, noteIdx)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <Textarea
                      placeholder={tCreate("entities.notePlaceholder")}
                      value={noteEntry.note}
                      onChange={(e) => handleNoteTextChange(tab, entity.id, noteIdx, e.target.value)}
                      disabled={isSubmitting}
                      rows={2}
                      className="resize-none text-xs"
                    />

                    {/* Existing attachments */}
                    {noteEntry.existingAttachments.length > 0 && (
                      <div className="space-y-1">
                        {noteEntry.existingAttachments.map((attachment) => (
                          <div key={attachment.id} className="flex items-center gap-1.5 rounded bg-muted/50 px-1.5 py-0.5 text-[10px]">
                            <Paperclip className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="min-w-0 flex-1 truncate text-primary underline-offset-2 hover:underline"
                            >
                              {attachment.path}
                            </a>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0"
                              disabled={isSubmitting}
                              onClick={() => handleRemoveExistingAttachment(tab, entity.id, noteIdx, attachment.id)}
                            >
                              <X className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Attachment button + new files for this note */}
                    <div className="space-y-1">
                      <Tooltip
                        open={
                          hoveredAttachmentKey?.tab === tab &&
                          hoveredAttachmentKey?.entityId === entity.id &&
                          hoveredAttachmentKey?.noteIdx === noteIdx
                        }
                      >
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px]"
                            disabled={isSubmitting}
                            onMouseEnter={() => setHoveredAttachmentKey({ tab, entityId: entity.id, noteIdx })}
                            onMouseLeave={() => setHoveredAttachmentKey(null)}
                            onClick={() => document.getElementById(`file-${tab}-${entity.id}-${noteIdx}`)?.click()}
                          >
                            <Paperclip className="me-1 h-3 w-3" />
                            {tCreate("entities.attachment")}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px]">
                          Ctrl+V to paste image
                        </TooltipContent>
                      </Tooltip>
                      <Input
                        id={`file-${tab}-${entity.id}-${noteIdx}`}
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        disabled={isSubmitting}
                        onChange={(e) => handleNoteFilesChange(tab, entity.id, noteIdx, e.target.files)}
                      />
                      {validationErrors[`entity_${entity.id}_files`] && (
                        <p className="text-[10px] text-destructive">{validationErrors[`entity_${entity.id}_files`]}</p>
                      )}
                      {noteEntry.files.length > 0 && (
                        <div className="space-y-1">
                          {noteEntry.files.map((file, fileIdx) => (
                            <div key={fileIdx} className="flex items-center gap-1.5 rounded bg-muted/50 px-1.5 py-0.5 text-[10px]">
                              <Paperclip className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1 truncate">{file.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0"
                                disabled={isSubmitting}
                                onClick={() => handleRemoveNoteFile(tab, entity.id, noteIdx, fileIdx)}
                              >
                                <X className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px]"
                  disabled={isSubmitting}
                  onClick={() => handleAddNote(tab, entity.id)}
                >
                  <Plus className="me-1 h-3 w-3" />
                  {tCreate("entities.addNote")}
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

  // ── Render tab content ─────────────────────────────────────────────────
  const renderTabContent = (
    tab: string,
    grouped: ReturnType<typeof getGroupedEntities>,
    filtered: typeof entities
  ) => {
    if (isEntitiesLoading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      );
    }

    if (filtered.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <ClipboardCheck className="mb-2 h-10 w-10" />
          <p>{tCreate("entities.noEntities")}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {grouped.map((group) => {
          const catKey = cKey(tab, group.categoryId);
          const isOpen = collapsedCategories[catKey] !== false;

          return (
            <Collapsible
              key={group.categoryId}
              open={isOpen}
              onOpenChange={(open) =>
                setCollapsedCategories((prev) => ({ ...prev, [catKey]: open }))
              }
            >
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5 text-start transition-colors hover:bg-muted/80"
                >
                  <div>
                    <h3 className="text-sm font-semibold">{group.categoryLabel}</h3>
                    <p className="text-xs text-muted-foreground">
                      {group.entities.length} {group.entities.length === 1 ? "entity" : "entities"}
                    </p>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.entities.map((entity) => renderEntityCard(tab, entity))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Alerts */}
      {successMessage && (
        <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}
      {storesError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{storesError}</AlertDescription>
        </Alert>
      )}
      {entitiesError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{entitiesError}</AlertDescription>
        </Alert>
      )}

      {/* ── Section 1: Store & Date ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{tCreate("basicInfo.title")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Store */}
            <div className="space-y-2">
              <Label htmlFor="store">
                {tCreate("basicInfo.store")} <span className="text-destructive">*</span>
              </Label>
              {isStoresLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={selectedStoreId}
                  onValueChange={(value) => {
                    setSelectedStoreId(value);
                    if (validationErrors.store) {
                      setValidationErrors((prev) => {
                        const next = { ...prev };
                        delete next.store;
                        return next;
                      });
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="store" className={validationErrors.store ? "border-destructive" : ""}>
                    <SelectValue
                      placeholder={isStoresLoading ? tCreate("basicInfo.storeLoading") : tCreate("basicInfo.storePlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    style={{ maxHeight: "160px", overflowY: "auto" }}
                    className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
                  >
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={String(store.id)}>
                        {store.storeId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {validationErrors.store && <p className="text-sm text-destructive">{validationErrors.store}</p>}
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">
                {tCreate("basicInfo.date")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  if (validationErrors.date) {
                    setValidationErrors((prev) => {
                      const next = { ...prev };
                      delete next.date;
                      return next;
                    });
                  }
                }}
                disabled={isSubmitting}
                aria-invalid={!!validationErrors.date}
                className={validationErrors.date ? "border-destructive" : ""}
              />
              {validationErrors.date && <p className="text-sm text-destructive">{validationErrors.date}</p>}
            </div>

            {/* Report Type */}
            <div className="space-y-2">
              <Label htmlFor="reportType">{tCreate("filterEntities.reportType")}</Label>
              <Select value={reportType} onValueChange={setReportType} disabled={isSubmitting}>
                <SelectTrigger id="reportType">
                  <SelectValue placeholder={tCreate("filterEntities.reportTypePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={REPORT_TYPE_ALL}>{tCreate("filterEntities.allReports")}</SelectItem>
                  <SelectItem value="main">{tCreate("filterEntities.main")}</SelectItem>
                  <SelectItem value="secondary">{tCreate("filterEntities.secondary")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Daily / Weekly Tabs ───────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
              <CardTitle>{tCreate("entities.title")}</CardTitle>
            </div>
            {!isEntitiesLoading && (
              <div className="flex gap-2">
                <Badge variant="secondary">
                  {tCreate("filterEntities.daily")}: {dailyEntities.length}
                </Badge>
                <Badge variant="secondary">
                  {tCreate("filterEntities.weekly")}: {weeklyEntities.length}
                </Badge>
              </div>
            )}
          </div>
          {validationErrors.entities && (
            <p className="text-sm text-destructive">{validationErrors.entities}</p>
          )}
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex justify-center">
              <TabsList>
                <TabsTrigger value="daily">
                  {tCreate("filterEntities.daily")}
                  {dailyEntities.length > 0 && (
                    <Badge variant="outline" className="ms-1.5 h-5 px-1.5 text-[10px]">
                      {dailyEntities.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="weekly">
                  {tCreate("filterEntities.weekly")}
                  {weeklyEntities.length > 0 && (
                    <Badge variant="outline" className="ms-1.5 h-5 px-1.5 text-[10px]">
                      {weeklyEntities.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="daily" className="mt-4">
              {renderTabContent("daily", dailyGrouped, dailyEntities)}
            </TabsContent>
            <TabsContent value="weekly" className="mt-4">
              {renderTabContent("weekly", weeklyGrouped, weeklyEntities)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Submit Actions ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" disabled={isSubmitting || isDataLoading} className="min-w-45">
          {isSubmitting ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {t("submitting")}
            </>
          ) : (
            t("submit")
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/${locale}/dashboard/quality-assurance`)}
          disabled={isSubmitting}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
