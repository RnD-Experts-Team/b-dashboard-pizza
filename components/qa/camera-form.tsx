"use client";

import { useState, useMemo, useCallback } from "react";
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
} from "lucide-react";
import {
  useEntitiesForCameraForm,
  useCreateCameraForm,
} from "@/lib/hooks/use-camera-form";
import { useAuthStore } from "@/lib/auth/auth.store";
import type { CameraFormEntityEntry } from "@/types/qa.types";
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

const REPORT_TYPE_ALL = "__all__";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Component                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export function CameraForm() {
  const t = useTranslations("createCameraForm");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  // ── Data hooks ─────────────────────────────────────────────────────────
  const userStores = useAuthStore((state) => state.user?.stores ?? []);
  const authLoading = useAuthStore((state) => state.isLoading);

  const stores = useMemo(() => {
    const uniqueStores = new Map<
      number,
      { name: string; assignmentId: string }
    >();

    for (const assignment of userStores) {
      const storeId =
        assignment.store.internalId ?? Number.parseInt(assignment.store.id, 10);

      if (!Number.isFinite(storeId)) continue;
      if (!uniqueStores.has(storeId)) {
        uniqueStores.set(storeId, {
          name: assignment.store.name,
          assignmentId: assignment.store.id,
        });
      }
    }

    return Array.from(uniqueStores, ([id, store]) => ({
      id,
      name: store.name,
      assignmentId: store.assignmentId,
    }));
  }, [userStores]);

  const isStoresLoading = authLoading && stores.length === 0;
  const storesError = null;

  const {
    entities,
    categories,
    isLoading: isEntitiesLoading,
    error: entitiesError,
  } = useEntitiesForCameraForm();

  const {
    submitCameraForm,
    isSubmitting,
    error: submitError,
    clearError,
  } = useCreateCameraForm();

  // ── Filter state ───────────────────────────────────────────────────────
  const [dateRangeType, setDateRangeType] = useState<string>("daily");
  const [reportType, setReportType] = useState<string>(REPORT_TYPE_ALL);

  // ── Form state ─────────────────────────────────────────────────────────
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [entityRatings, setEntityRatings] = useState<Record<number, string>>(
    {}
  );
  const [entityNotes, setEntityNotes] = useState<Record<number, string>>({});
  const [entityFiles, setEntityFiles] = useState<Record<number, File[]>>({});
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ── Filtered entities ──────────────────────────────────────────────────
  const filteredEntities = useMemo(() => {
    return entities.filter((entity) => {
      // Only show active entities
      if (!entity.active) return false;

      // Filter by date range type
      if (
        dateRangeType &&
        entity.dateRangeType.toLowerCase() !== dateRangeType.toLowerCase()
      ) {
        return false;
      }

      // Filter by report type
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

    // Sort groups by category sort order
    return Object.values(groups).sort((a, b) => {
      const catA = categories.find((c) => c.id === a.categoryId);
      const catB = categories.find((c) => c.id === b.categoryId);
      return (catA?.sortOrder ?? 0) - (catB?.sortOrder ?? 0);
    });
  }, [filteredEntities, categories]);

  // ── Rating update handler ──────────────────────────────────────────────
  const handleRatingChange = useCallback(
    (entityId: number, ratingId: string) => {
      setEntityRatings((prev) => ({ ...prev, [entityId]: ratingId }));
      // Clear any related validation errors
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
      setEntityFiles((prev) => ({
        ...prev,
        [entityId]: [...(prev[entityId] || []), ...Array.from(files)],
      }));
    },
    []
  );

  const handleRemoveFile = useCallback(
    (entityId: number, fileIndex: number) => {
      setEntityFiles((prev) => ({
        ...prev,
        [entityId]: (prev[entityId] || []).filter((_, i) => i !== fileIndex),
      }));
    },
    []
  );

  // ── Validation ─────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!selectedStoreId) {
      errors.store = t("validation.storeRequired");
    }

    if (!selectedDate) {
      errors.date = t("validation.dateRequired");
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(selectedDate) || isNaN(Date.parse(selectedDate))) {
        errors.date = t("validation.dateInvalid");
      }
    }

    if (filteredEntities.length === 0) {
      errors.entities = t("validation.entitiesRequired");
    } else {
      // Check that all displayed entities have a rating
      const unrated = filteredEntities.filter(
        (e) => !entityRatings[e.id]
      );
      if (unrated.length > 0) {
        errors.entities = t("validation.ratingRequired");
        for (const e of unrated) {
          errors[`entity_${e.id}`] = t("validation.ratingRequired");
        }
      }
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

    const entityEntries: CameraFormEntityEntry[] = filteredEntities
      .filter((entity) => entityRatings[entity.id])
      .map((entity) => ({
        entity_id: entity.id,
        rating_id: Number(entityRatings[entity.id]),
        ...(entityNotes[entity.id]?.trim() && {
          note: entityNotes[entity.id].trim(),
        }),
        ...(entityFiles[entity.id]?.length && {
          attachments: entityFiles[entity.id],
        }),
      }));

    const success = await submitCameraForm(
      Number(selectedStoreId),
      selectedDate,
      entityEntries
    );

    if (success) {
      setSuccessMessage(t("success"));
      handleReset();
      router.push(`/${locale}/dashboard/quality-assurance`);
    }
  };

  // ── Reset handler ──────────────────────────────────────────────────────
  const handleReset = () => {
    setSelectedStoreId("");
    setSelectedDate("");
    setEntityRatings({});
    setEntityNotes({});
    setEntityFiles({});
    setValidationErrors({});
    setSuccessMessage(null);
    clearError();
  };

  // ── Loading state ──────────────────────────────────────────────────────
  const isDataLoading = isStoresLoading || isEntitiesLoading;

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
            <CardTitle>{t("filterEntities.title")}</CardTitle>
          </div>
          <CardDescription>
            {t("description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Date Range Type */}
            <div className="space-y-2">
              <Label htmlFor="dateRangeType">
                {t("filterEntities.dateRangeType")}
              </Label>
              <Select
                value={dateRangeType}
                onValueChange={setDateRangeType}
                disabled={isSubmitting}
              >
                <SelectTrigger id="dateRangeType">
                  <SelectValue
                    placeholder={t("filterEntities.dateRangeTypePlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">
                    {t("filterEntities.daily")}
                  </SelectItem>
                  <SelectItem value="weekly">
                    {t("filterEntities.weekly")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Report Type */}
            <div className="space-y-2">
              <Label htmlFor="reportType">
                {t("filterEntities.reportType")}
              </Label>
              <Select
                value={reportType}
                onValueChange={setReportType}
                disabled={isSubmitting}
              >
                <SelectTrigger id="reportType">
                  <SelectValue
                    placeholder={t("filterEntities.reportTypePlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={REPORT_TYPE_ALL}>
                    {t("filterEntities.allReports")}
                  </SelectItem>
                  <SelectItem value="main">
                    {t("filterEntities.main")}
                  </SelectItem>
                  <SelectItem value="secondary">
                    {t("filterEntities.secondary")}
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
            <CardTitle>{t("basicInfo.title")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Store Selection */}
            <div className="space-y-2">
              <Label htmlFor="store">
                {t("basicInfo.store")}{" "}
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
                          ? t("basicInfo.storeLoading")
                          : t("basicInfo.storePlaceholder")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={String(store.id)}>
                        {store.name} (ID: {store.assignmentId})
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
                {t("basicInfo.date")}{" "}
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
              <CardTitle>{t("entities.title")}</CardTitle>
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
              <p>{t("entities.noEntities")}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedEntities.map((group, groupIdx) => (
                <div key={group.categoryId}>
                  {groupIdx > 0 && <Separator className="mb-6" />}

                  {/* Category Header */}
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold">
                      {group.categoryLabel}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {group.entities.length}{" "}
                      {group.entities.length === 1 ? "entity" : "entities"}
                    </p>
                  </div>

                  {/* Entity Cards */}
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {group.entities.map((entity) => (
                      <div
                        key={entity.id}
                        className={`rounded-lg border p-4 transition-colors ${
                          validationErrors[`entity_${entity.id}`]
                            ? "border-destructive bg-destructive/5"
                            : entityRatings[entity.id]
                              ? "border-primary/30 bg-primary/5"
                              : "border-border"
                        }`}
                      >
                        {/* Entity Name */}
                        <div className="mb-3 flex items-center justify-between">
                          <Label className="text-sm font-medium">
                            {entity.entityLabel}
                          </Label>
                          {entityRatings[entity.id] && (
                            <Badge variant="outline" className="text-xs">
                              {RATINGS.find(
                                (r) =>
                                  String(r.id) === entityRatings[entity.id]
                              )
                                ? t(
                                    `entities.${RATINGS.find((r) => String(r.id) === entityRatings[entity.id])!.key}`
                                  )
                                : ""}
                            </Badge>
                          )}
                        </div>

                        {/* Rating Selection */}
                        <div className="mb-3 space-y-1.5">
                          <Label
                            htmlFor={`rating-${entity.id}`}
                            className="text-xs text-muted-foreground"
                          >
                            {t("entities.rating")}{" "}
                            <span className="text-destructive">*</span>
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
                              className={`h-9 ${
                                validationErrors[`entity_${entity.id}`]
                                  ? "border-destructive"
                                  : ""
                              }`}
                            >
                              <SelectValue
                                placeholder={t("entities.ratingPlaceholder")}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {RATINGS.map((rating) => (
                                <SelectItem
                                  key={rating.id}
                                  value={String(rating.id)}
                                >
                                  {t(`entities.${rating.key}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Note / Attachment */}
                        <div className="space-y-1.5">
                          <Label
                            htmlFor={`note-${entity.id}`}
                            className="text-xs text-muted-foreground"
                          >
                            {t("entities.note")}
                          </Label>
                          <Textarea
                            id={`note-${entity.id}`}
                            placeholder={t("entities.notePlaceholder")}
                            value={entityNotes[entity.id] || ""}
                            onChange={(e) =>
                              handleNoteChange(entity.id, e.target.value)
                            }
                            disabled={isSubmitting}
                            rows={2}
                            className="resize-none text-sm"
                          />
                        </div>

                        {/* File Attachment */}
                        <div className="mt-3 space-y-1.5">
                          <Label
                            htmlFor={`file-${entity.id}`}
                            className="text-xs text-muted-foreground"
                          >
                            {t("entities.attachment")}
                          </Label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              disabled={isSubmitting}
                              onClick={() => {
                                document
                                  .getElementById(`file-${entity.id}`)
                                  ?.click();
                              }}
                            >
                              <Paperclip className="me-1.5 h-3.5 w-3.5" />
                              {t("entities.attachment")}
                            </Button>
                            <Input
                              id={`file-${entity.id}`}
                              type="file"
                              multiple
                              accept="image/*,.pdf,.doc,.docx"
                              className="hidden"
                              disabled={isSubmitting}
                              onChange={(e) =>
                                handleFilesChange(
                                  entity.id,
                                  e.target.files
                                )
                              }
                            />
                          </div>
                          {/* Attached files list */}
                          {entityFiles[entity.id] &&
                            entityFiles[entity.id].length > 0 && (
                              <div className="mt-2 space-y-1">
                                {entityFiles[entity.id].map(
                                  (file, fileIdx) => (
                                    <div
                                      key={`${entity.id}-${fileIdx}`}
                                      className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1 text-xs"
                                    >
                                      <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                                      <span className="min-w-0 flex-1 truncate">
                                        {file.name}
                                      </span>
                                      <span className="shrink-0 text-muted-foreground">
                                        {(file.size / 1024).toFixed(0)}KB
                                      </span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0"
                                        disabled={isSubmitting}
                                        onClick={() =>
                                          handleRemoveFile(
                                            entity.id,
                                            fileIdx
                                          )
                                        }
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
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
          onClick={handleReset}
          disabled={isSubmitting}
        >
          {t("reset")}
        </Button>
      </div>
    </form>
  );
}
