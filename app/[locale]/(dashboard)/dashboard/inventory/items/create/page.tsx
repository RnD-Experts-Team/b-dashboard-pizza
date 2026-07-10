"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ItemForm } from "@/components/inventory/item-form";

/** Create-item page — wraps the shared ItemForm. */
export default function CreateItemPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const listHref = `/${locale}/dashboard/inventory/items`;

  return (
    <div className="space-y-6">
      <PageHeader title="New item" description="Add an item to the inventory catalog.">
        <Button variant="outline" onClick={() => router.push(listHref)}>
          <ArrowLeft className="me-2 h-4 w-4" />
          Back
        </Button>
      </PageHeader>

      <ItemForm onSuccess={() => router.push(listHref)} />
    </div>
  );
}
