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
  CardDescription,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Filter,
  FileText,
  ClipboardCheck,
  Paperclip,
  X,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  useEntitiesForCameraForm,
  useUpdateCameraForm,
  useCameraFormDetail,
} from "@/lib/hooks/use-camera-form";
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

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // Backend limit: 5MB
const ALLOWED_IMAGE_MIME_PREFIX = "image/";

const REPORT_TYPE_ALL = "__all__";

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

  // ── Filter state ───────────────────────────────────────────────────────
  const [dateRangeType, setDateRangeType] = useState<string>("");
  const [reportType, setReportType] = useState<string>(REPORT_TYPE_ALL);

  // ── Form state ─────────────────────────────────────────────────────────
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [entityRatings, setEntityRatings] = useState<Record<number, string>>(
    {}
  );
  const [entityNotes, setEntityNotes] = useState<Record<number, string>>({});
  const [entityNoteIds, setEntityNoteIds] = useState<Record<number, number>>(
    {}
  );
  const [entityFiles, setEntityFiles] = useState<Record<number, File[]>>({});
  const [existingAttachments, setExistingAttachments] = useState<
    Record<number, CameraFormAttachment[]>
  >({});
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<
    Record<number, number[]>
  >({});
  const [removedNoteIds, setRemovedNoteIds] = useState<number[]>([]);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPrePopulated, setIsPrePopulated] = useState(false);
  const [collapsedEntities, setCollapsedEntities] = useState<Record<number, boolean>>({});

  // ── Pre-populate form data from audit ──────────────────────────────────
  useEffect(() => {
    if (!audit || isPrePopulated) return;

    setSelectedStoreId(String(audit.storeId));
    const dateOnly = audit.date.includes("T")
      ? audit.date.split("T")[0]
      : audit.date;
    setSelectedDate(dateOnly);

    const ratings: Record<number, string> = {};
    const notes: Record<number, string> = {};
    const noteIds: Record<number, number> = {};
    const attachments: Record<number, CameraFormAttachment[]> = {};

    for (const cf of audit.cameraForms) {
      ratings[cf.entityId] = String(cf.ratingId);
      const firstNote = cf.notes?.[0];
      if (firstNote) {
        noteIds[cf.entityId] = firstNote.id;
        if (firstNote.note) {
          notes[cf.entityId] = firstNote.note;
        }
        if (firstNote.attachments?.length) {
          attachments[cf.entityId] = firstNote.attachments;
        }
      }
    }

    setEntityRatings(ratings);
    setEntityNotes(notes);
    setEntityNoteIds(noteIds);
    setExistingAttachments(attachments);
    setIsPrePopulated(true);
  }, [audit, isPrePopulated]);

  // Ensure filters include the entities that belong to the loaded audit.
  useEffect(() => {
    if (!audit || entities.length === 0) return;

    const auditEntityIds = new Set(audit.cameraForms.map((cf) => cf.entityId));
    const matchedEntity = entities.find((entity) => auditEntityIds.has(entity.id));

    if (matchedEntity) {
      setDateRangeType((prev) => (prev ? prev : matchedEntity.dateRangeType));
      setReportType((prev) =>
        prev && prev !== REPORT_TYPE_ALL
          ? prev
          : matchedEntity.reportType || REPORT_TYPE_ALL
      );
    }
  }, [audit, entities]);

  // ── Filtered entities ──────────────────────────────────────────────────
  const filteredEntities = useMemo(() => {
    return entities.filter((entity) => {
      if (!entity.active) return false;
      if (
        dateRangeType &&
        entity.dateRangeType.toLowerCase() !== dateRangeType.toLowerCase()
      ) {
        return false;
      }
      if (reportType && reportType !== REPORT_TYPE_ALL) {
        if (
          !entity.reportType ||
          entity.reportType.toLowerCase() !== reportType.toLowerCase()
        ) {
          return false;
        }
      }
      return true;
    });
  }, [entities, dateRangeType, reportType]);

  // ── Entities grouped by category ───────────────────────────────────────
  const groupedEntities = useMemo(() => {
    const groups: Record<
      number,
      {
        categoryId: number;
        categoryLabel: string;
        entities: typeof filteredEntities;
      }
    > = {};

    for (const entity of filteredEntities) {
      const catId = entity.categoryId;
      if (!groups[catId]) {
        const category = categories.find((c) => c.id === catId);
        groups[catId] = {
          categoryId: catId,
          categoryLabel:
            entity.categoryLabel || category?.label || `Category ${catId}`,
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
  }, [filteredEntities, categories]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleRatingChange = useCallback(
    (entityId: number, ratingId: string) => {
      setEntityRatings((prev) => ({ ...prev, [entityId]: ratingId }));
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[`entity_${entityId}`];
        delete next.entities;
        return next;
      });
    },
    []
  );

  const handleNoteChange = useCallback(
    (entityId: number, note: string) => {
      setEntityNotes((prev) => ({ ...prev, [entityId]: note }));
    },
    []
  );

  const handleFilesChange = useCallback(
    (entityId: number, files: FileList | null) => {
      if (!files || files.length === 0) return;

      const incomingFiles = Array.from(files);
      const validFiles: File[] = [];
      let hasInvalid = false;

      for (const file of incomingFiles) {
        const isImage = file.type?.startsWith(ALLOWED_IMAGE_MIME_PREFIX);
        const withinSize = file.size <= MAX_ATTACHMENT_BYTES;
        if (isImage && withinSize) {
          validFiles.push(file);
        } else {
          hasInvalid = true;
        }
      }

      if (validFiles.length === 0 && hasInvalid) {
        setValidationErrors((prev) => ({
          ...prev,
          [`entity_${entityId}_files`]:
            tCreate("entities.attachmentInvalid") ||
            "Only image files up to 5MB are allowed.",
        }));
        return;
      }

      setValidationErrors((prev) => {
        const next = { ...prev };
        if (hasInvalid) {
          next[`entity_${entityId}_files`] =
            tCreate("entities.attachmentInvalid") ||
            "Only image files up to 5MB are allowed.";
        } else {
          delete next[`entity_${entityId}_files`];
        }
        return next;
      });

      setEntityFiles((prev) => ({
        ...prev,
        [entityId]: [...(prev[entityId] || []), ...validFiles],
      }));
    },
    [tCreate]
  );

  const handleRemoveFile = useCallback(
    (entityId: number, fileIndex: number) => {
      setEntityFiles((prev) => {
        const nextFiles = (prev[entityId] || []).filter((_, i) => i !== fileIndex);
        if (nextFiles.length === 0) {
          setValidationErrors((prevErrors) => {
            const nextErrors = { ...prevErrors };
            delete nextErrors[`entity_${entityId}_files`];
            return nextErrors;
          });
        }
        return {
          ...prev,
          [entityId]: nextFiles,
        };
      });
    },
    []
  );

  const handleRemoveExistingAttachment = useCallback(
    (entityId: number, attachmentId: number) => {
      setExistingAttachments((prev) => ({
        ...prev,
        [entityId]: (prev[entityId] || []).filter((a) => a.id !== attachmentId),
      }));
      setRemovedAttachmentIds((prev) => ({
        ...prev,
        [entityId]: [...(prev[entityId] || []), attachmentId],
      }));
    },
    []
  );

  // ── Validation ─────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!selectedStoreId) {
      errors.store = tCreate("validation.storeRequired");
    }

    if (!selectedDate) {
      errors.date = tCreate("validation.dateRequired");
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(selectedDate) || isNaN(Date.parse(selectedDate))) {
        errors.date = tCreate("validation.dateInvalid");
      }
    }

    if (filteredEntities.length === 0) {
      errors.entities = tCreate("validation.entitiesRequired");
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit handler ─────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    clearError();

    if (!validate()) return;

    const entityEntries: CameraFormUpdateEntityEntry[] = filteredEntities
      .map((entity) => {
        const noteText = entityNotes[entity.id]?.trim();
        const existingNoteId = entityNoteIds[entity.id];
        const newFiles = entityFiles[entity.id];
        const removedAttachIds = removedAttachmentIds[entity.id];

        const hasNote = !!noteText;
        const hasNewFiles = newFiles && newFiles.length > 0;
        const hasRemovedAttachments =
          removedAttachIds && removedAttachIds.length > 0;

        const entry: CameraFormUpdateEntityEntry = {
          entity_id: entity.id,
          ...(entityRatings[entity.id] && {
            rating_id: Number(entityRatings[entity.id]),
          }),
        };

        // Build notes array if there's any note-related data
        if (hasNote || hasNewFiles || hasRemovedAttachments || existingNoteId) {
          entry.notes = [
            {
              ...(existingNoteId != null ? { id: existingNoteId } : {}),
              ...(hasNote ? { note: noteText } : {}),
              ...(hasNewFiles ? { images: newFiles } : {}),
              ...(hasRemovedAttachments
                ? { remove_attachment_ids: removedAttachIds }
                : {}),
            },
          ];
        }

        return entry;
      });

    if (entityEntries.length === 0) {
      setValidationErrors({
        entities: tCreate("validation.entitiesRequired"),
      });
      return;
    }

    const success = await updateCameraForm(
      formId,
      Number(selectedStoreId),
      selectedDate,
      entityEntries
    );

    if (success) {
      setSuccessMessage(t("success"));
      setTimeout(() => {
        router.push(`/${locale}/dashboard/quality-assurance`);
      }, 1500);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────
  const isDataLoading = isStoresLoading || isEntitiesLoading || isAuditLoading;

  if (isAuditLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-40 w-full" />
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
        <Button
          variant="outline"
          onClick={() =>
            router.push(`/${locale}/dashboard/quality-assurance`)
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Success Alert */}
      {successMessage && (
        <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Submit Error Alert */}
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {/* Data Load Errors */}
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

      {/* ────────────────────────────────────────────────────────────────── */}
      {/*  Section 1: Filter Entities                                       */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{tCreate("filterEntities.title")}</CardTitle>
          </div>
          <CardDescription>{tCreate("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Date Range Type */}
            <div className="space-y-2">
              <Label htmlFor="dateRangeType">
                {tCreate("filterEntities.dateRangeType")}
              </Label>
              <Select
                value={dateRangeType}
                onValueChange={setDateRangeType}
                disabled={isSubmitting}
              >
                <SelectTrigger id="dateRangeType">
                  <SelectValue
                    placeholder={tCreate(
                      "filterEntities.dateRangeTypePlaceholder"
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">
                    {tCreate("filterEntities.daily")}
                  </SelectItem>
                  <SelectItem value="weekly">
                    {tCreate("filterEntities.weekly")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Report Type */}
            <div className="space-y-2">
              <Label htmlFor="reportType">
                {tCreate("filterEntities.reportType")}
              </Label>
              <Select
                value={reportType}
                onValueChange={setReportType}
                disabled={isSubmitting}
              >
                <SelectTrigger id="reportType">
                  <SelectValue
                    placeholder={tCreate(
                      "filterEntities.reportTypePlaceholder"
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={REPORT_TYPE_ALL}>
                    {tCreate("filterEntities.allReports")}
                  </SelectItem>
                  <SelectItem value="main">
                    {tCreate("filterEntities.main")}
                  </SelectItem>
                  <SelectItem value="secondary">
                    {tCreate("filterEntities.secondary")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/*  Section 2: Basic Information                                     */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{tCreate("basicInfo.title")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Store Selection */}
            <div className="space-y-2">
              <Label htmlFor="store">
                {tCreate("basicInfo.store")}{" "}
                <span className="text-destructive">*</span>
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
                  <SelectTrigger
                    id="store"
                    className={
                      validationErrors.store ? "border-destructive" : ""
                    }
                  >
                    <SelectValue
                      placeholder={
                        isStoresLoading
                          ? tCreate("basicInfo.storeLoading")
                          : tCreate("basicInfo.storePlaceholder")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent
                      position="popper"
                      style={{ maxHeight: "160px", overflowY: "auto" }}
                      className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
                    >
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={String(store.id)}>
                        {store.name} ({store.storeId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {validationErrors.store && (
                <p className="text-sm text-destructive">
                  {validationErrors.store}
                </p>
              )}
            </div>

            {/* Date Selection */}
            <div className="space-y-2">
              <Label htmlFor="date">
                {tCreate("basicInfo.date")}{" "}
                <span className="text-destructive">*</span>
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
              {validationErrors.date && (
                <p className="text-sm text-destructive">
                  {validationErrors.date}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/*  Section 3: Entities / Ratings                                    */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
              <CardTitle>{tCreate("entities.title")}</CardTitle>
            </div>
            {!isEntitiesLoading && (
              <Badge variant="secondary">
                {filteredEntities.length}{" "}
                {filteredEntities.length === 1 ? "entity" : "entities"}
              </Badge>
            )}
          </div>
          {validationErrors.entities && (
            <p className="text-sm text-destructive">
              {validationErrors.entities}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {isEntitiesLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ))}
            </div>
          ) : filteredEntities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <ClipboardCheck className="mb-2 h-10 w-10" />
              <p>{tCreate("entities.noEntities")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedEntities.map((group, groupIdx) => (
                <div key={group.categoryId}>
                  {groupIdx > 0 && <Separator className="mb-4" />}

                  {/* Category Header */}
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">
                        {group.categoryLabel}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {group.entities.length}{" "}
                        {group.entities.length === 1 ? "entity" : "entities"}
                      </p>
                    </div>
                  </div>

                  {/* Entity Cards - 4 col responsive grid */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {group.entities.map((entity) => {
                      const isCollapsed = collapsedEntities[entity.id] ?? true;
                      return (
                        <div
                          key={entity.id}
                          className={`rounded-lg border p-3 transition-colors ${
                            entityRatings[entity.id]
                              ? "border-primary/30 bg-primary/5"
                              : "border-border"
                          }`}
                        >
                          {/* Entity Header with collapse toggle */}
                          <div
                            className="flex cursor-pointer items-center justify-between gap-1"
                            onClick={() =>
                              setCollapsedEntities((prev) => ({
                                ...prev,
                                [entity.id]: !isCollapsed,
                              }))
                            }
                          >
                            <Label className="pointer-events-none text-xs font-medium leading-tight">
                              {entity.entityLabel}
                            </Label>
                            <div className="flex shrink-0 items-center gap-1">
                              {entityRatings[entity.id] && (
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                                  {RATINGS.find(
                                    (r) =>
                                      String(r.id) === entityRatings[entity.id]
                                  )
                                    ? tCreate(
                                        `entities.${RATINGS.find((r) => String(r.id) === entityRatings[entity.id])!.key}`
                                      )
                                    : ""}
                                </Badge>
                              )}
                              {isCollapsed ? (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </div>
                          </div>

                          {/* Collapsible content */}
                          {!isCollapsed && (
                            <div className="mt-2 space-y-2">
                              {/* Rating Selection */}
                              <div className="space-y-1">
                                <Label
                                  htmlFor={`rating-${entity.id}`}
                                  className="text-[10px] text-muted-foreground"
                                >
                                  {tCreate("entities.rating")}
                                </Label>
                                <Select
                                  value={entityRatings[entity.id] || ""}
                                  onValueChange={(value) =>
                                    handleRatingChange(entity.id, value)
                                  }
                                  disabled={isSubmitting}
                                >
                                  <SelectTrigger
                                    id={`rating-${entity.id}`}
                                    className="h-8 text-xs"
                                  >
                                    <SelectValue
                                      placeholder={tCreate(
                                        "entities.ratingPlaceholder"
                                      )}
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {RATINGS.map((rating) => (
                                      <SelectItem
                                        key={rating.id}
                                        value={String(rating.id)}
                                      >
                                        {tCreate(`entities.${rating.key}`)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Note */}
                              <div className="space-y-1">
                                <Label
                                  htmlFor={`note-${entity.id}`}
                                  className="text-[10px] text-muted-foreground"
                                >
                                  {tCreate("entities.note")}
                                </Label>
                                <Textarea
                                  id={`note-${entity.id}`}
                                  placeholder={tCreate("entities.notePlaceholder")}
                                  value={entityNotes[entity.id] || ""}
                                  onChange={(e) =>
                                    handleNoteChange(entity.id, e.target.value)
                                  }
                                  disabled={isSubmitting}
                                  rows={2}
                                  className="resize-none text-xs"
                                />
                              </div>

                              {/* File Attachment */}
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[10px]"
                                    disabled={isSubmitting}
                                    onClick={() => {
                                      document
                                        .getElementById(`file-${entity.id}`)
                                        ?.click();
                                    }}
                                  >
                                    <Paperclip className="me-1 h-3 w-3" />
                                    {tCreate("entities.attachment")}
                                  </Button>
                                  <Input
                                    id={`file-${entity.id}`}
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    className="hidden"
                                    disabled={isSubmitting}
                                    onChange={(e) =>
                                      handleFilesChange(entity.id, e.target.files)
                                    }
                                  />
                                </div>
                                {validationErrors[`entity_${entity.id}_files`] && (
                                  <p className="text-[10px] text-destructive">
                                    {validationErrors[`entity_${entity.id}_files`]}
                                  </p>
                                )}

                                {/* Existing attachments */}
                                {existingAttachments[entity.id]?.length ? (
                                  <div className="space-y-1">
                                    {existingAttachments[entity.id].map(
                                      (attachment) => (
                                        <div
                                          key={attachment.id}
                                          className="flex items-center gap-1.5 rounded bg-muted/50 px-1.5 py-0.5 text-[10px]"
                                        >
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
                                            onClick={() =>
                                              handleRemoveExistingAttachment(
                                                entity.id,
                                                attachment.id
                                              )
                                            }
                                          >
                                            <X className="h-2.5 w-2.5" />
                                          </Button>
                                        </div>
                                      )
                                    )}
                                  </div>
                                ) : null}

                                {/* New attached files */}
                                {entityFiles[entity.id] &&
                                  entityFiles[entity.id].length > 0 && (
                                    <div className="space-y-1">
                                      {entityFiles[entity.id].map(
                                        (file, fileIdx) => (
                                          <div
                                            key={`${entity.id}-${fileIdx}`}
                                            className="flex items-center gap-1.5 rounded bg-muted/50 px-1.5 py-0.5 text-[10px]"
                                          >
                                            <Paperclip className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                                            <span className="min-w-0 flex-1 truncate">
                                              {file.name}
                                            </span>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="h-4 w-4 p-0"
                                              disabled={isSubmitting}
                                              onClick={() =>
                                                handleRemoveFile(
                                                  entity.id,
                                                  fileIdx
                                                )
                                              }
                                            >
                                              <X className="h-2.5 w-2.5" />
                                            </Button>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/*  Submit Actions                                                   */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          disabled={isSubmitting || isDataLoading}
          className="min-w-45"
        >
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
          onClick={() =>
            router.push(`/${locale}/dashboard/quality-assurance`)
          }
          disabled={isSubmitting}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
