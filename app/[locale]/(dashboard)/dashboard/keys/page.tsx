"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  useKeysList,
  useDeactivateKey,
  useRestoreKey,
  useForceDeleteKey,
} from "@/lib/hooks/use-keys";
import { useTagsList } from "@/lib/hooks/use-tags";
import { PageHeader } from "@/components/layout/page-header";
import { KeyDetailsSheet } from "@/components/keys/key-details-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  ChevronsUpDown,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type { EngineKey } from "@/types/key.types";

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  Skeleton                                                                */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  Dialog variants                                                         */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

type ActionTarget =
  | { type: "deactivate"; key: EngineKey }
  | { type: "restore"; key: EngineKey }
  | { type: "forceDelete"; key: EngineKey };

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
/*  Main page                                                               */
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export default function KeysPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { canAccessRoute, overviewStores } = useAuthStore();
  const { selectedStore } = useSelectedStoreStore();

  const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;

  const createKeyRequirements = [
    { service: "Data", method: "POST", path: "/engine/keys", storeId: effectiveStoreId },
  ];
  const canCreateKey = createKeyRequirements.some((r) => canAccessRoute(r));

  const updateKeyRequirements = [
    { service: "Data", method: "PUT", path: "/engine/keys/{id}", storeId: effectiveStoreId },
  ];
  const canUpdateKey = updateKeyRequirements.some((r) => canAccessRoute(r));

  const deactivateKeyRequirements = [
    { service: "Data", method: "DELETE", path: "/engine/keys/{id}", storeId: effectiveStoreId },
  ];
  const canDeactivateKeyAction = deactivateKeyRequirements.some((r) =>
    canAccessRoute(r)
  );

  // Restore and force-delete share the same permission check pattern;
  // adjust if the backend exposes different route permissions.
  const canRestoreKey = canDeactivateKeyAction;
  const canForceDeleteKey = canDeactivateKeyAction;

  const canManageKeys = canUpdateKey || canDeactivateKeyAction;

  const {
    data,
    page,
    setPage,
    tagsFilter,
    setTagsFilter,
    isLoading,
    isRefreshing,
    error,
    refetch,
    clearError,
  } = useKeysList();

  const { data: tagsData } = useTagsList();

  const { deactivateKey, isDeactivating } = useDeactivateKey();
  const { restoreKey, isRestoring } = useRestoreKey();
  const { forceDeleteKey, isDeleting } = useForceDeleteKey();

  const isMutating = isDeactivating || isRestoring || isDeleting;

  // Sheet state
  const [sheetKeyId, setSheetKeyId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Unified action dialog state
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);

  const handleRowClick = (key: EngineKey) => {
    setSheetKeyId(key.id);
    setSheetOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!actionTarget) return;

    const { type, key } = actionTarget;

    if (type === "deactivate") {
      if (!canDeactivateKeyAction) return;
      const ok = await deactivateKey(key.id);
      if (ok) {
        toast.success(`"${key.label}" has been deactivated.`);
        setActionTarget(null);
        refetch();
      } else {
        toast.error("Failed to deactivate key. Please try again.");
      }
    } else if (type === "restore") {
      if (!canRestoreKey) return;
      const ok = await restoreKey(key.id);
      if (ok) {
        toast.success(`"${key.label}" has been reactivated.`);
        setActionTarget(null);
        refetch();
      } else {
        toast.error("Failed to restore key. Please try again.");
      }
    } else if (type === "forceDelete") {
      if (!canForceDeleteKey) return;
      const ok = await forceDeleteKey(key.id);
      if (ok) {
        toast.success(`"${key.label}" has been permanently deleted.`);
        setActionTarget(null);
        refetch();
      } else {
        toast.error("Failed to delete key. Please try again.");
      }
    }
  };

  /* â”€â”€ dialog copy helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const dialogTitle = () => {
    if (!actionTarget) return "";
    if (actionTarget.type === "deactivate") return "Deactivate Key";
    if (actionTarget.type === "restore") return "Reactivate Key";
    return "Permanently Delete Key";
  };

  const dialogDescription = () => {
    if (!actionTarget) return null;
    const name = actionTarget.key.label;
    if (actionTarget.type === "deactivate")
      return (
        <>
          Are you sure you want to deactivate <strong>{name}</strong>? The key
          will be marked as inactive but can be restored later.
        </>
      );
    if (actionTarget.type === "restore")
      return (
        <>
          Are you sure you want to reactivate <strong>{name}</strong>? The key
          will become active again immediately.
        </>
      );
    return (
      <>
        Are you sure you want to <strong>permanently delete</strong>{" "}
        <strong>{name}</strong>? This action{" "}
        <span className="text-destructive font-semibold">cannot be undone</span>{" "}
        and all associated data will be lost.
      </>
    );
  };

  const dialogActionLabel = () => {
    if (!actionTarget) return "";
    if (isMutating) {
      if (actionTarget.type === "deactivate") return "Deactivatingâ€¦";
      if (actionTarget.type === "restore") return "Reactivatingâ€¦";
      return "Deletingâ€¦";
    }
    if (actionTarget.type === "deactivate") return "Deactivate";
    if (actionTarget.type === "restore") return "Reactivate";
    return "Delete Permanently";
  };

  const isDestructiveAction = actionTarget?.type === "forceDelete";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Keys"
        description="View and manage engine keys across your stores."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={isLoading || isRefreshing}
          >
            <RefreshCw
              className={cn("me-2 h-4 w-4", isRefreshing && "animate-spin")}
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

      {/* Tags filter */}
      {tagsData && tagsData.data.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                Filter by Tags
                {tagsFilter.length > 0 && (
                  <Badge variant="secondary" className="ms-1 px-1.5 py-0 text-xs">
                    {tagsFilter.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="max-h-52 overflow-y-auto space-y-1">
                {tagsData.data.map((tag) => {
                  const selected = tagsFilter.includes(tag.id);
                  return (
                    <label
                      key={tag.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(checked) => {
                          setTagsFilter(
                            checked
                              ? [...tagsFilter, tag.id]
                              : tagsFilter.filter((id) => id !== tag.id)
                          );
                        }}
                      />
                      <span className="flex-1 text-sm">{tag.name}</span>
                    </label>
                  );
                })}
              </div>
              {tagsFilter.length > 0 && (
                <div className="mt-2 border-t pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-full text-xs text-muted-foreground"
                    onClick={() => setTagsFilter([])}
                  >
                    Clear filter
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          {tagsFilter.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tagsFilter.map((id) => {
                const tag = tagsData.data.find((t) => t.id === id);
                return (
                  <Badge key={id} variant="secondary" className="gap-1 pe-1 text-xs">
                    {tag?.name ?? `Tag #${id}`}
                    <button
                      type="button"
                      className="rounded-sm opacity-70 hover:opacity-100"
                      onClick={() => setTagsFilter(tagsFilter.filter((t) => t !== id))}
                    >
                      <span className="sr-only">Remove</span>
                      ×
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      )}

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
                  <TableHead className="hidden md:table-cell">Status</TableHead>
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
                      className={cn(
                        "cursor-pointer hover:bg-muted/50",
                        !key.isActive && "opacity-60"
                      )}
                      onClick={() => handleRowClick(key)}
                    >
                      <TableCell className="font-mono text-xs">
                        {key.id}
                      </TableCell>
                      <TableCell className="font-medium">{key.label}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">{key.dataType}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={key.isActive ? "default" : "secondary"}>
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

                            {/* Activate / Deactivate toggle */}
                            {canDeactivateKeyAction && key.isActive && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActionTarget({ type: "deactivate", key });
                                }}
                              >
                                <Power className="me-2 h-4 w-4" />
                                Deactivate
                              </DropdownMenuItem>
                            )}

                            {canRestoreKey && !key.isActive && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActionTarget({ type: "restore", key });
                                }}
                              >
                                <RotateCcw className="me-2 h-4 w-4" />
                                Reactivate
                              </DropdownMenuItem>
                            )}

                            {canForceDeleteKey && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActionTarget({ type: "forceDelete", key });
                                  }}
                                >
                                  <Trash2 className="me-2 h-4 w-4" />
                                  Delete Permanently
                                </DropdownMenuItem>
                              </>
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
              Refreshingâ€¦
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

      {/* Unified Confirmation Dialog */}
      <AlertDialog
        open={!!actionTarget}
        onOpenChange={(open) => {
          if (!open && !isMutating) setActionTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogTitle()}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <p>{dialogDescription()}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={isMutating}
              className={cn(
                isDestructiveAction &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
            >
              {isMutating ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {dialogActionLabel()}
                </>
              ) : (
                dialogActionLabel()
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
