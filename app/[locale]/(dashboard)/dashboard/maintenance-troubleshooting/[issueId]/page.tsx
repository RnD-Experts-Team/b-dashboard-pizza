"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/use-auth";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { IssueTroubleshooting } from "@/components/maintenance-tickets/troubleshooting/issue-troubleshooting";

/**
 * One issue's troubleshooting page: every guide for it, one per specific
 * problem, each step with its own files. The same page opens inside the
 * new-ticket window when a store picks this issue. Here a store can log a
 * problem the steps fixed, and catalog managers add and change guides.
 */
export default function IssueTroubleshootingPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";
  const issueId = Number(params?.issueId);
  const { canAccessRoute } = useAuth();
  const canEdit = canAccessRoute({ service: "Maintenance", method: "POST", path: "/issues/placeholder/troubleshooting-guides" });
  const storeCode = useSelectedStoreStore((s) => s.selectedStore?.storeId) ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ms-2">
        <Link href={`/${locale}/dashboard/maintenance-troubleshooting`}>
          <ArrowLeft className="me-1.5 h-4 w-4" aria-hidden="true" /> All troubleshooting
        </Link>
      </Button>

      {Number.isFinite(issueId) && issueId > 0 ? (
        <IssueTroubleshooting issueId={issueId} mode="browse" storeCode={storeCode} canEdit={canEdit} />
      ) : (
        <p className="text-sm text-muted-foreground">This issue could not be found.</p>
      )}
    </div>
  );
}
