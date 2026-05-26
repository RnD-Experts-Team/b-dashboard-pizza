"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useKeyDetail, useUpdateKey } from "@/lib/hooks/use-keys";
import { PageHeader } from "@/components/layout/page-header";
import { KeyForm } from "@/components/keys/key-form";
import type { KeyFormValues } from "@/components/keys/key-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, RefreshCw } from "lucide-react";
import type { CreateKeyPayload, FrequencyType } from "@/types/key.types";

export default function UpdateKeyPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "en";
  const keyId = Number(params?.id);

  const { key: engineKey, isLoading, error: loadError, refetch } = useKeyDetail(
    isNaN(keyId) ? null : keyId
  );
  const { updateKey, isSubmitting, error: updateError, clearError } = useUpdateKey();

  const handleSubmit = async (payload: CreateKeyPayload) => {
    clearError();
    const result = await updateKey(keyId, payload);
    if (result) {
      toast.success("Key updated successfully.");
      router.push(`/${locale}/dashboard/keys`);
    }
  };

  // Build initial form values from loaded key.
  // Group store rules that share identical settings into a single form entry
  // with all matching store_ids collected together (multi-select).
  const initialValues: Partial<KeyFormValues> | undefined = engineKey
    ? (() => {
        const grouped = new Map<
          string,
          { store_ids: string[]; idx: number }
        >();
        const storeRules: KeyFormValues["store_rules"] = [];

        for (const sr of engineKey.storeRules) {
          // Fingerprint every field except store_id so identical rules are merged
          const fingerprint = JSON.stringify([
            sr.frequencyType,
            sr.interval,
            JSON.stringify((sr.weekDays ?? []).slice().sort()),
            sr.monthDay,
            sr.weekOfMonth,
            sr.weekDay,
            sr.yearMonth,
            sr.startsAt,
            sr.endsAt ?? "",
            sr.fillMode,
            JSON.stringify((sr.roleNames ?? []).slice().sort()),
            sr.time ?? null,
          ]);

          const existing = grouped.get(fingerprint);
          if (existing) {
            storeRules[existing.idx].store_ids.push(sr.storeId);
          } else {
            const idx = storeRules.length;
            grouped.set(fingerprint, { store_ids: [sr.storeId], idx });
            storeRules.push({
              store_ids: [sr.storeId],
              frequency_type: sr.frequencyType as FrequencyType,
              interval: sr.interval,
              week_days: sr.weekDays ?? [],
              month_day: sr.monthDay,
              week_of_month: sr.weekOfMonth,
              week_day: sr.weekDay,
              year_month: sr.yearMonth,
              starts_at: sr.startsAt,
              ends_at: sr.endsAt ?? "",
              fill_mode: sr.fillMode,
              role_names: sr.roleNames ?? [],
              time: sr.time ?? null,
            });
          }
        }

        return {
          label: engineKey.label,
          data_type: engineKey.dataType,
          is_active: engineKey.isActive,
          tags: engineKey.tags,
          store_rules: storeRules,
        };
      })()
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Update Key"
        description={
          engineKey
            ? `Editing key: ${engineKey.label}`
            : "Loading key details…"
        }
      >
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${locale}/dashboard/keys`}>
            <ArrowLeft className="me-2 h-4 w-4" />
            Back to Keys
          </Link>
        </Button>
      </PageHeader>

      <div className="mx-auto max-w-3xl">
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {loadError && !engineKey && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={refetch}
            >
              <RefreshCw className="me-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        )}

        {engineKey && initialValues && (
          <KeyForm
            key={engineKey.id}
            initialValues={initialValues}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            error={updateError}
            submitLabel="Update Key"
          />
        )}
      </div>
    </div>
  );
}
