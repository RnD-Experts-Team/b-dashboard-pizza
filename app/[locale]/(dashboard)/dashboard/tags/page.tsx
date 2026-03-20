"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  useTagsList,
  useCreateTag,
  useDeleteTag,
  useDeleteTagsBulk,
} from "@/lib/hooks/use-tags";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CanAccessParams } from "@/lib/auth/can-access";
import { useAuth } from "@/lib/auth/use-auth";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import {
  Loader2,
  Plus,
  RefreshCw,
  Tag,
  Trash2,
  AlertCircle,
  Tags,
} from "lucide-react";
import type { Tag as TagType } from "@/types/tag.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Skeleton                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function TagsTableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-32 flex-1" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Create Tag Dialog                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

interface CreateTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<void>;
  isCreating: boolean;
}

function CreateTagDialog({
  open,
  onOpenChange,
  onCreate,
  isCreating,
}: CreateTagDialogProps) {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setName("");
      setNameError(null);
    }
  }, [open]);

  function validate(): boolean {
    if (!name.trim()) {
      setNameError("Name is required.");
      return false;
    }
    if (name.trim().length > 255) {
      setNameError("Name must not exceed 255 characters.");
      return false;
    }
    setNameError(null);
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    await onCreate(name.trim());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Tag</DialogTitle>
          <DialogDescription>
            Add a new tag to the system.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tag-name"
              placeholder="Enter tag name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              maxLength={255}
              disabled={isCreating}
              autoFocus
            />
            {nameError && (
              <p className="text-sm text-destructive">{nameError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {name.length} / 255 characters
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              Create Tag
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Tags Page                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

type DeleteTarget =
  | { type: "single"; tag: TagType }
  | { type: "bulk"; ids: number[] };

export default function TagsPage() {
  const { canAccessRoute } = useAuth();
  const { selectedStore } = useSelectedStoreStore();

  const { data, isLoading, isRefreshing, error, refetch, clearError } =
    useTagsList();
  const { createTag, isCreating, error: createError, clearError: clearCreateError } =
    useCreateTag();
  const { deleteTag, isDeleting: isSingleDeleting } = useDeleteTag();
  const { deleteTagsBulk, isDeleting: isBulkDeleting } = useDeleteTagsBulk();

  const effectiveStoreId = selectedStore?.id ? String(selectedStore.id) : undefined;
  const createTagRequirements: CanAccessParams[] = [
    { service: "Data", method: "POST", path: "/tags", storeId: effectiveStoreId },
  ];
  const deleteTagRequirements: CanAccessParams[] = [
    { service: "Data", method: "DELETE", path: "/tags/id", storeId: effectiveStoreId },
  ];
  const deleteBulkTagsRequirements: CanAccessParams[] = [
    { service: "Data", method: "DELETE", path: "/tags/bulk", storeId: effectiveStoreId },
  ];

  const canCreateTag = createTagRequirements.some((requirement) =>
    canAccessRoute(requirement)
  );
  const canDeleteTag = deleteTagRequirements.some((requirement) =>
    canAccessRoute(requirement)
  );
  const canDeleteBulkTags = deleteBulkTagsRequirements.some((requirement) =>
    canAccessRoute(requirement)
  );

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const tags = data?.data ?? [];
  const isMutating = isSingleDeleting || isBulkDeleting;

  // Clear selection when tags data changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [data]);

  /* ---- Selection helpers ---- */
  const isAllSelected = tags.length > 0 && selectedIds.size === tags.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < tags.length;

  function toggleAll() {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tags.map((t) => t.id)));
    }
  }

  function toggleOne(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  /* ---- Create ---- */
  async function handleCreate(name: string) {
    if (!canCreateTag) {
      toast.error("You do not have permission to create tags.");
      return;
    }

    const created = await createTag({ name });
    if (created) {
      toast.success(`Tag "${created.name}" created successfully.`);
      setIsCreateDialogOpen(false);
      refetch();
    } else if (createError) {
      toast.error(createError);
      clearCreateError();
    }
  }

  /* ---- Delete single ---- */
  async function handleConfirmDelete() {
    if (!deleteTarget) return;

    if (deleteTarget.type === "single") {
      if (!canDeleteTag) {
        toast.error("You do not have permission to delete tags.");
        return;
      }

      const ok = await deleteTag(deleteTarget.tag.id);
      if (ok) {
        toast.success(`Tag "${deleteTarget.tag.name}" deleted.`);
        refetch();
      } else {
        toast.error("Failed to delete tag.");
      }
    } else {
      if (!canDeleteBulkTags) {
        toast.error("You do not have permission to bulk delete tags.");
        return;
      }

      const ok = await deleteTagsBulk(deleteTarget.ids);
      if (ok) {
        toast.success(
          `${deleteTarget.ids.length} tag${deleteTarget.ids.length === 1 ? "" : "s"} deleted.`
        );
        setSelectedIds(new Set());
        refetch();
      } else {
        toast.error("Failed to delete selected tags.");
      }
    }

    setDeleteTarget(null);
  }

  /* ---- Alert dialog content ---- */
  const dialogTitle =
    deleteTarget?.type === "bulk"
      ? `Delete ${deleteTarget.ids.length} Tag${deleteTarget.ids.length === 1 ? "" : "s"}`
      : `Delete "${deleteTarget?.type === "single" ? deleteTarget.tag.name : ""}"`;

  const dialogDescription =
    deleteTarget?.type === "bulk"
      ? `Are you sure you want to permanently delete ${deleteTarget.ids.length} selected tag${deleteTarget.ids.length === 1 ? "" : "s"}? This action cannot be undone.`
      : `Are you sure you want to permanently delete this tag? This action cannot be undone.`;

  /* ---- Render ---- */
  return (
    <div className="space-y-6">
      <PageHeader title="Tags" description="Manage data tags.">
        <Button
          variant="outline"
          size="sm"
          onClick={refetch}
          disabled={isLoading || isRefreshing}
        >
          <RefreshCw
            className={`me-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
        {canCreateTag && (
          <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="me-2 h-4 w-4" />
            Create Tag
          </Button>
        )}
      </PageHeader>

      {/* Global load error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearError();
                refetch();
              }}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Tags className="h-4 w-4" />
                Tags
                {!isLoading && (
                  <Badge variant="secondary" className="ms-1">
                    {tags.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                All tags available in the system.
              </CardDescription>
            </div>

            {/* Bulk delete button — visible only when items are selected */}
            {selectedIds.size > 0 && canDeleteBulkTags && (
              <Button
                variant="destructive"
                size="sm"
                disabled={isMutating}
                onClick={() =>
                  setDeleteTarget({
                    type: "bulk",
                    ids: Array.from(selectedIds),
                  })
                }
              >
                {isBulkDeleting ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="me-2 h-4 w-4" />
                )}
                Delete Selected ({selectedIds.size})
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <TagsTableSkeleton />
          ) : tags.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
              <Tag className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                No tags found
              </p>
              <p className="text-xs text-muted-foreground">
                Get started by creating your first tag.
              </p>
              {canCreateTag && (
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <Plus className="me-2 h-4 w-4" />
                  Create Tag
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 px-4">
                      {/* Select-all checkbox */}
                      <Checkbox
                        checked={isAllSelected}
                        ref={(el) => {
                          if (el)
                            (el as HTMLButtonElement).dataset.indeterminate =
                              String(isIndeterminate);
                        }}
                        onCheckedChange={toggleAll}
                        aria-label="Select all tags"
                        className={
                          isIndeterminate ? "data-[state=checked]:opacity-50" : ""
                        }
                        data-state={
                          isIndeterminate
                            ? "indeterminate"
                            : isAllSelected
                            ? "checked"
                            : "unchecked"
                        }
                      />
                    </TableHead>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Created At
                    </TableHead>
                    <TableHead className="w-20 text-end">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.map((tag) => (
                    <TableRow
                      key={tag.id}
                      data-selected={selectedIds.has(tag.id)}
                      className="data-[selected=true]:bg-muted/50"
                    >
                      <TableCell className="px-4">
                        <Checkbox
                          checked={selectedIds.has(tag.id)}
                          onCheckedChange={() => toggleOne(tag.id)}
                          aria-label={`Select tag ${tag.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {tag.id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="font-medium">{tag.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {tag.createdAt
                          ? new Date(tag.createdAt).toLocaleDateString(
                              undefined,
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )
                          : "—"}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={isMutating || !canDeleteTag}
                          onClick={() =>
                            setDeleteTarget({ type: "single", tag })
                          }
                          aria-label={`Delete tag ${tag.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Tag Dialog */}
      <CreateTagDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreate={handleCreate}
        isCreating={isCreating}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isMutating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isMutating && (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
