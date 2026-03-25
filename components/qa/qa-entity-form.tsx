"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useCreateQAEntity, useQAEntityCategories } from "@/lib/hooks/use-qa-entities";
import type { CreateQAEntityPayload } from "@/types/qa.types";

const ENTITY_LABEL_MAX_LENGTH = 255;
const REPORT_TYPE_NONE = "__none__";

export function QAEntityForm() {
  const t = useTranslations("qaEntities");
  const tCommon = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "en";

  const { createEntity, isCreating, error, clearError } =
    useCreateQAEntity();
  const {
    categories,
    isLoading: isCategoriesLoading,
    error: categoriesError,
  } = useQAEntityCategories();

  const [entityLabel, setEntityLabel] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [dateRangeType, setDateRangeType] = useState<string>("");
  const [reportType, setReportType] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<string>("");
  const [active, setActive] = useState<boolean>(true);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!entityLabel.trim()) {
      errors.entityLabel = t("validation.entityLabelRequired");
    } else if (entityLabel.trim().length > ENTITY_LABEL_MAX_LENGTH) {
      errors.entityLabel = t("validation.entityLabelMaxLength", {
        max: ENTITY_LABEL_MAX_LENGTH,
      });
    }

    if (!dateRangeType) {
      errors.dateRangeType = t("validation.dateRangeTypeRequired");
    }

    if (sortOrder && isNaN(Number(sortOrder))) {
      errors.sortOrder = t("validation.sortOrderNumber");
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    clearError();

    if (!validate()) return;

    const payload: CreateQAEntityPayload = {
      entity_label: entityLabel.trim(),
      date_range_type: dateRangeType as "daily" | "weekly",
      active,
      ...(categoryId && { category_id: Number(categoryId) }),
      report_type: reportType && reportType !== REPORT_TYPE_NONE ? reportType : null,
      ...(sortOrder && { sort_order: Number(sortOrder) }),
    };

    const result = await createEntity(payload);

    if (result) {
      // Redirect to Entities & Categories page for better UX
      router.push(`/${locale}/dashboard/entities-and-categories`);
    }
  };

  const handleReset = () => {
    setEntityLabel("");
    setCategoryId("");
    setDateRangeType("");
    setReportType("");
    setSortOrder("");
    setActive(true);
    setValidationErrors({});
    setSuccessMessage(null);
    clearError();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Success Alert */}
      {successMessage && (
        <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Categories load error */}
      {categoriesError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{categoriesError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("formTitle")}</CardTitle>
          <CardDescription>{t("formDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Entity Label Field */}
          <div className="space-y-2">
            <Label htmlFor="entityLabel">
              {t("fields.entityLabel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="entityLabel"
              type="text"
              placeholder={t("fields.entityLabelPlaceholder")}
              value={entityLabel}
              onChange={(e) => {
                setEntityLabel(e.target.value);
                if (validationErrors.entityLabel) {
                  setValidationErrors((prev) => {
                    const next = { ...prev };
                    delete next.entityLabel;
                    return next;
                  });
                }
              }}
              maxLength={ENTITY_LABEL_MAX_LENGTH}
              disabled={isCreating}
              aria-invalid={!!validationErrors.entityLabel}
              aria-describedby={
                validationErrors.entityLabel ? "entityLabel-error" : undefined
              }
              className={validationErrors.entityLabel ? "border-destructive" : ""}
            />
            <div className="flex items-center justify-between">
              {validationErrors.entityLabel ? (
                <p id="entityLabel-error" className="text-sm text-destructive">
                  {validationErrors.entityLabel}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("fields.entityLabelHint")}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {entityLabel.length}/{ENTITY_LABEL_MAX_LENGTH}
              </p>
            </div>
          </div>

          {/* Choose Category Field */}
          <div className="space-y-2">
            <Label htmlFor="categoryId">{t("fields.category")}</Label>
            <Select
              value={categoryId}
              onValueChange={(value) => {
                setCategoryId(value);
                if (validationErrors.categoryId) {
                  setValidationErrors((prev) => {
                    const next = { ...prev };
                    delete next.categoryId;
                    return next;
                  });
                }
              }}
              disabled={isCreating || isCategoriesLoading}
            >
              <SelectTrigger
                id="categoryId"
                className={validationErrors.categoryId ? "border-destructive" : ""}
              >
                <SelectValue
                  placeholder={
                    isCategoriesLoading
                      ? t("fields.categoryLoading")
                      : t("fields.categoryPlaceholder")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {validationErrors.categoryId ? (
              <p id="categoryId-error" className="text-sm text-destructive">
                {validationErrors.categoryId}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("fields.categoryHint")}
              </p>
            )}
          </div>

          {/* Date Range Type Field */}
          <div className="space-y-2">
            <Label htmlFor="dateRangeType">
              {t("fields.dateRangeType")} <span className="text-destructive">*</span>
            </Label>
            <Select
              value={dateRangeType}
              onValueChange={(value) => {
                setDateRangeType(value);
                if (validationErrors.dateRangeType) {
                  setValidationErrors((prev) => {
                    const next = { ...prev };
                    delete next.dateRangeType;
                    return next;
                  });
                }
              }}
              disabled={isCreating}
            >
              <SelectTrigger
                id="dateRangeType"
                aria-invalid={!!validationErrors.dateRangeType}
                className={validationErrors.dateRangeType ? "border-destructive" : ""}
              >
                <SelectValue placeholder={t("fields.dateRangeTypePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t("fields.dateRangeDaily")}</SelectItem>
                <SelectItem value="weekly">{t("fields.dateRangeWeekly")}</SelectItem>
              </SelectContent>
            </Select>
            {validationErrors.dateRangeType ? (
              <p id="dateRangeType-error" className="text-sm text-destructive">
                {validationErrors.dateRangeType}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("fields.dateRangeTypeHint")}
              </p>
            )}
          </div>

          {/* Report Type Field */}
          <div className="space-y-2">
            <Label htmlFor="reportType">{t("fields.reportType")}</Label>
            <Select
              value={reportType}
              onValueChange={setReportType}
              disabled={isCreating}
            >
              <SelectTrigger id="reportType">
                <SelectValue placeholder={t("fields.reportTypePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={REPORT_TYPE_NONE}>{t("fields.reportTypeNone")}</SelectItem>
                <SelectItem value="main">{t("fields.reportTypeMain")}</SelectItem>
                <SelectItem value="secondary">{t("fields.reportTypeSecondary")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("fields.reportTypeHint")}
            </p>
          </div>

          {/* Sort Order Field */}
          <div className="space-y-2">
            <Label htmlFor="sortOrder">{t("fields.sortOrder")}</Label>
            <Input
              id="sortOrder"
              type="number"
              placeholder={t("fields.sortOrderPlaceholder")}
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value);
                if (validationErrors.sortOrder) {
                  setValidationErrors((prev) => {
                    const next = { ...prev };
                    delete next.sortOrder;
                    return next;
                  });
                }
              }}
              disabled={isCreating}
              aria-invalid={!!validationErrors.sortOrder}
              aria-describedby={
                validationErrors.sortOrder ? "sortOrder-error" : undefined
              }
              className={validationErrors.sortOrder ? "border-destructive" : ""}
            />
            {validationErrors.sortOrder ? (
              <p id="sortOrder-error" className="text-sm text-destructive">
                {validationErrors.sortOrder}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("fields.sortOrderHint")}
              </p>
            )}
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="active" className="text-base">
                {t("fields.active")} <span className="text-destructive">*</span>
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("fields.activeHint")}
              </p>
            </div>
            <Switch
              id="active"
              checked={active}
              onCheckedChange={setActive}
              disabled={isCreating}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isCreating} className="min-w-35">
          {isCreating ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {t("creating")}
            </>
          ) : (
            t("create")
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={isCreating}
        >
          {tCommon("cancel")}
        </Button>
      </div>
    </form>
  );
}
