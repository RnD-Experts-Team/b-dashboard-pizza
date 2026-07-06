"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ItemForm } from "@/components/inventory/item-form";
import { useItem } from "@/lib/hooks/use-inventory-items";

/** Skeleton that mirrors the ItemForm card/field layout exactly. */
function ItemFormSkeleton() {
  return (
    <div className="space-y-6">
      {/* ── Details card ── */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-14" />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Altametrics ID */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
          {/* Names 3-col */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
          {/* Details textareas 3-col */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Units & conversions card ── */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Unit 1 + Unit 2 */}
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
          {/* U2 per U1 */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-full" />
          </div>
          {/* Unit 3 + ratio */}
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Availability & image card ── */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Types checkboxes */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-10" />
            <div className="flex flex-wrap gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}
            </div>
          </div>
          {/* All stores toggle row */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
          {/* Image picker */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-md" />
              <Skeleton className="h-8 w-28 rounded-md" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit row */}
      <div className="flex justify-end">
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}

/** Edit-item page — loads the item, then renders the shared ItemForm. */
export default function EditItemPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const id = Number(params?.id);
  const listHref = `/${locale}/dashboard/inventory/items`;

  const { item, isLoading, error } = useItem(Number.isFinite(id) ? id : null);

  return (
    <div className="space-y-6">
      <PageHeader title="Edit item" description="Update this catalog item.">
        <Button variant="outline" onClick={() => router.push(listHref)}>
          <ArrowLeft className="me-2 h-4 w-4" />
          Back
        </Button>
      </PageHeader>

      {isLoading ? (
        <ItemFormSkeleton />
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : item ? (
        <ItemForm item={item} onSuccess={() => router.push(listHref)} />
      ) : null}
    </div>
  );
}
