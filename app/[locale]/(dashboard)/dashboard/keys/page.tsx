"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useKeysList, useDeactivateKey } from "@/lib/hooks/use-keys";
import { PageHeader } from "@/components/layout/page-header";
import { KeyDetailsSheet } from "@/components/keys/key-details-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type { EngineKey } from "@/types/key.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Skeleton                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function KeysTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">ID</TableHead>
            <TableHead>Label</TableHead>
            <TableHead className="hidden sm:table-cell">Data Type</TableHead>
            <TableHead className="hidden md:table-cell">Status</TableHead>
            <TableHead className="hidden lg:table-cell">Store Rules</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-8" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-40" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="h-5 w-16" />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <Skeleton className="h-4 w-8" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-8 w-8" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main page                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export default function KeysPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { canAccessRoute, overviewStores } = useAuthStore();
  const { selectedStore } = useSelectedStoreStore();

  // Keep store selection behavior aligned with sidebar authorization checks.
  const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;
  const createKeyRequirements = [
    {
      service: "Data",
      method: "POST",
      path: "/engine/keys",
      storeId: effectiveStoreId,
    },
  ];
  const canCreateKey = createKeyRequirements.some((requirement) =>
    canAccessRoute(requirement)
  );
  const updateKeyRequirements = [
    {
      service: "Data",
      method: "PUT",
      path: "/engine/keys/",
      storeId: effectiveStoreId,
    },
  ];
  const deactivateKeyRequirements = [
    {
      service: "Data",
      method: "DELETE",
      path: "/engine/keys/id",
      storeId: effectiveStoreId,
    },
  ];
  const canUpdateKey = updateKeyRequirements.some((requirement) =>
    canAccessRoute(requirement)
  );
  const canDeactivateKeyAction = deactivateKeyRequirements.some((requirement) =>
    canAccessRoute(requirement)
  );
  const canManageKeys = canUpdateKey || canDeactivateKeyAction;

  const {
    data,
    page,
    setPage,
    isLoading,
    isRefreshing,
    error,
    refetch,
    clearError,
  } = useKeysList();

  const {
    deactivateKey,
    isDeactivating,
  } = useDeactivateKey();

  // Sheet state
  const [sheetKeyId, setSheetKeyId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Deactivate dialog state
  const [deactivateTarget, setDeactivateTarget] = useState<EngineKey | null>(
    null
  );

  const handleRowClick = (key: EngineKey) => {
    setSheetKeyId(key.id);
    setSheetOpen(true);
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget || !canDeactivateKeyAction) return;
    const success = await deactivateKey(deactivateTarget.id);
    if (success) {
      toast.success("Key deactivated successfully.");
      setDeactivateTarget(null);
      refetch();
    } else {
      toast.error("Failed to deactivate key.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Keys" description="View and manage engine keys across your stores.">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={isLoading || isRefreshing}
          >
            <RefreshCw
              className={cn(
                "me-2 h-4 w-4",
                isRefreshing && "animate-spin"
              )}
            />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
          {canCreateKey && (
            <Button asChild size="sm">
              <Link href={`/${locale}/dashboard/keys/create`}>
                <Plus className="me-2 h-4 w-4" />
                Create Key
              </Link>
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Error */}
      {error && !data && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="me-2 h-4 w-4" />
              Retry
            </Button>
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !data && <KeysTableSkeleton />}

      {/* Table */}
      {data && (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Data Type
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    Status
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Store Rules
                  </TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No keys found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.data.map((key) => (
                    <TableRow
                      key={key.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(key)}
                    >
                      <TableCell className="font-mono text-xs">
                        {key.id}
                      </TableCell>
                      <TableCell className="font-medium">
                        {key.label}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">{key.dataType}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge
                          variant={key.isActive ? "default" : "secondary"}
                        >
                          {key.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                        {key.storeRules.length} rule(s)
                      </TableCell>
                      <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canUpdateKey && (
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/${locale}/dashboard/keys/${key.id}/update`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Pencil className="me-2 h-4 w-4" />
                                    Update Key
                                  </Link>
                                </DropdownMenuItem>
                              )}
                             
                              {canDeactivateKeyAction && (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeactivateTarget(key);
                                  }}
                                >
                                  <Power className="me-2 h-4 w-4" />
                                  Deactivate Key
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data.pagination.lastPage > 1 && (
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm text-muted-foreground">
                {data.pagination.from != null && data.pagination.to != null
                  ? `Showing ${data.pagination.from}-${data.pagination.to} of ${data.pagination.total} key(s)`
                  : `${data.pagination.total} key(s) total`}
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.hasPrevPage || isLoading || isRefreshing}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="me-1 h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {data.pagination.currentPage} of{" "}
                  {data.pagination.lastPage}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.hasNextPage || isLoading || isRefreshing}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                  <ChevronRight className="ms-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Refreshing overlay */}
          {isRefreshing && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Refreshing…
            </div>
          )}
        </>
      )}

      {/* Details Sheet */}
      <KeyDetailsSheet
        keyId={sheetKeyId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{" "}
              <strong>{deactivateTarget?.label}</strong>? This action will mark
              the key as inactive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeactivating}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              disabled={isDeactivating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeactivating ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  Deactivating…
                </>
              ) : (
                "Deactivate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
