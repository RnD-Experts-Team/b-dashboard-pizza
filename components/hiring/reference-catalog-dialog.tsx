"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  AlertCircle,
  Loader2,
  RefreshCw,
  Paperclip,
  IdCard,
  Heart,
  Briefcase,
  Tag,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { referenceCatalogService } from "@/lib/api/services/reference-catalog.service";
import { useReferenceCatalogStore } from "@/lib/store/reference-catalog.store";
import type { ReferenceCatalogItem, ReferenceCatalogRecord } from "@/types/hiring.types";

/* ------------------------------------------------------------------ */
/*  Local state shapes                                                 */
/* ------------------------------------------------------------------ */

type ItemState = {
  /** Stable local-only key (never sent to the API) */
  _key: string;
  id?: number | null;
  label: string;
  description: string;
  /** Tag IDs linked to this item (attachment_types only) */
  tagIds: number[];
  /** True = will be sent in the delete_ids array and hidden in the UI */
  pendingDelete: boolean;
  /** True = currently being edited */
  editing: boolean;
  /** True = existing row was edited and confirmed */
  modified: boolean;
  /** Draft values while editing */
  draftLabel: string;
  draftDescription: string;
  draftTagIds: number[];
};

type CatalogKey =
  | "attachment_types"
  | "id_types"
  | "marital_statuses"
  | "positions"
  | "tags";

type CatalogState = Record<CatalogKey, ItemState[]>;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

let _keyCounter = 0;
function nextKey() {
  return `item-${++_keyCounter}`;
}

function toItemState(raw: ReferenceCatalogItem | ReferenceCatalogRecord): ItemState {
  return {
    _key: nextKey(),
    id: raw.id ?? null,
    label: raw.label,
    description: raw.description ?? "",
    tagIds: (raw as unknown as { tag_ids?: number[] }).tag_ids ?? [],
    pendingDelete: false,
    editing: false,
    modified: false,
    draftLabel: raw.label,
    draftDescription: raw.description ?? "",
    draftTagIds: (raw as unknown as { tag_ids?: number[] }).tag_ids ?? [],
  };
}

function emptyItemState(): ItemState {
  return {
    _key: nextKey(),
    id: null,
    label: "",
    description: "",
    tagIds: [],
    pendingDelete: false,
    editing: true,
    modified: false,
    draftLabel: "",
    draftDescription: "",
    draftTagIds: [],
  };
}

const EMPTY_CATALOG: CatalogState = {
  attachment_types: [],
  id_types: [],
  marital_statuses: [],
  positions: [],
  tags: [],
};

function hasChanges(state: CatalogState): boolean {
  return (Object.keys(state) as CatalogKey[]).some((key) =>
    state[key].some((item) => item.pendingDelete || !item.id || item.modified),
  );
}

/* ------------------------------------------------------------------ */
/*  Tab config                                                         */
/* ------------------------------------------------------------------ */

const TABS: {
  key: CatalogKey;
  label: string;
  icon: React.ReactNode;
  deleteKey: string;
}[] = [
  {
    key: "attachment_types",
    label: "Attachment Types",
    icon: <Paperclip className="h-4 w-4" />,
    deleteKey: "attachment_type_delete_ids",
  },
  {
    key: "id_types",
    label: "ID Types",
    icon: <IdCard className="h-4 w-4" />,
    deleteKey: "id_type_delete_ids",
  },
  {
    key: "marital_statuses",
    label: "Marital Statuses",
    icon: <Heart className="h-4 w-4" />,
    deleteKey: "marital_status_delete_ids",
  },
  {
    key: "positions",
    label: "Positions",
    icon: <Briefcase className="h-4 w-4" />,
    deleteKey: "position_delete_ids",
  },
  {
    key: "tags",
    label: "Tags",
    icon: <Tag className="h-4 w-4" />,
    deleteKey: "tag_delete_ids",
  },
];

/* ------------------------------------------------------------------ */
/*  Sub-component: single catalog tab                                  */
/* ------------------------------------------------------------------ */

type TagOption = { id: number; label: string };

function CatalogTab({
  items,
  availableTags,
  onAdd,
  onConfirmEdit,
  onCancelEdit,
  onStartEdit,
  onDelete,
  onDraftChange,
  onDraftTagsChange,
}: {
  items: ItemState[];
  /** Pass only for the attachment_types tab */
  availableTags?: TagOption[];
  onAdd: () => void;
  onConfirmEdit: (key: string) => void;
  onCancelEdit: (key: string) => void;
  onStartEdit: (key: string) => void;
  onDelete: (key: string) => void;
  onDraftChange: (key: string, field: "label" | "description", value: string) => void;
  onDraftTagsChange?: (key: string, tagIds: number[]) => void;
}) {
  const visible = items.filter((i) => !i.pendingDelete);
  const deletedCount = items.filter((i) => i.pendingDelete && i.id).length;

  return (
    <div className="flex flex-col gap-3">
      {/* Pending-delete notice */}
      {deletedCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {deletedCount} item{deletedCount > 1 ? "s" : ""} marked for deletion. Save to apply.
        </p>
      )}

      {visible.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No items yet. Click <strong>Add Item</strong> to get started.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {visible.map((item) => (
          <div
            key={item._key}
            className="rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/30"
          >
            {item.editing ? (
              /* ---- edit form ---- */
              <div className="flex flex-col gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Label *</Label>
                  <Input
                    value={item.draftLabel}
                    onChange={(e) =>
                      onDraftChange(item._key, "label", e.target.value)
                    }
                    placeholder="e.g. Full-Time"
                    autoFocus
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">
                    Description{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Textarea
                    value={item.draftDescription}
                    onChange={(e) =>
                      onDraftChange(item._key, "description", e.target.value)
                    }
                    placeholder="Short description…"
                    rows={2}
                    className="resize-none"
                  />
                </div>

                {/* Tag selector — attachment_types only */}
                {availableTags !== undefined && (
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium">
                      Tags{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    {availableTags.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        No tags yet — add tags in the Tags tab first.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {availableTags.map((tag) => {
                          const selected = item.draftTagIds.includes(tag.id);
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => {
                                if (!onDraftTagsChange) return;
                                const next = selected
                                  ? item.draftTagIds.filter((id) => id !== tag.id)
                                  : [...item.draftTagIds, tag.id];
                                onDraftTagsChange(item._key, next);
                              }}
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                                selected
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background text-muted-foreground border-border hover:bg-muted"
                              }`}
                            >
                              <Tag className="h-3 w-3" />
                              {tag.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => onConfirmEdit(item._key)}
                    disabled={!item.draftLabel.trim()}
                  >
                    <Check className="me-1.5 h-3.5 w-3.5" />
                    {item.id ? "Update" : "Add"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onCancelEdit(item._key)}
                  >
                    <X className="me-1.5 h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              /* ---- display row ---- */
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{item.label}</span>
                    {!item.id && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        New
                      </Badge>
                    )}
                    {item.modified && !!item.id && (
                      <Badge
                        variant="outline"
                        className="text-xs shrink-0 text-amber-600 border-amber-300"
                      >
                        Edited
                      </Badge>
                    )}
                  </div>
                  {item.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  {/* Tag chips — attachment_types only */}
                  {availableTags !== undefined && item.tagIds.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {item.tagIds.map((tagId) => {
                        const tag = availableTags.find((t) => t.id === tagId);
                        return (
                          <Badge
                            key={tagId}
                            variant="secondary"
                            className="gap-1 text-xs"
                          >
                            <Tag className="h-3 w-3" />
                            {tag?.label ?? `#${tagId}`}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onStartEdit(item._key)}
                    aria-label="Edit item"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onDelete(item._key)}
                    aria-label="Delete item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={onAdd}
      >
        <Plus className="me-1.5 h-4 w-4" />
        Add Item
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton for tab content                                  */
/* ------------------------------------------------------------------ */

function TabLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <div className="flex gap-1">
              <Skeleton className="h-7 w-7 rounded-md" />
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ReferenceCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ------------------------------------------------------------------ */
/*  Main dialog                                                        */
/* ------------------------------------------------------------------ */

export function ReferenceCatalogDialog({
  open,
  onOpenChange,
}: ReferenceCatalogDialogProps) {
  const { setData: setStoreData } = useReferenceCatalogStore();
  const [activeTab, setActiveTab] = useState<CatalogKey>("attachment_types");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogState>({ ...EMPTY_CATALOG });
  const abortRef = useRef<AbortController | null>(null);

  function buildStateFromResponse(
    raw: Record<CatalogKey, ReferenceCatalogRecord[]>,
  ): CatalogState {
    const state: CatalogState = { ...EMPTY_CATALOG };
    (Object.keys(state) as CatalogKey[]).forEach((key) => {
      state[key] = (raw[key] ?? []).map(toItemState);
    });
    return state;
  }

  /* Fetch catalog data whenever the dialog opens */
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setFetchError(null);
    setError(null);
    setActiveTab("attachment_types");
    setCatalog({ ...EMPTY_CATALOG });

    referenceCatalogService
      .getAll(controller.signal)
      .then((res) => {
        setCatalog(buildStateFromResponse(res.data as Record<CatalogKey, ReferenceCatalogRecord[]>));
      })
      .catch((err) => {
        if (err?.name === "CanceledError" || err?.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Failed to load catalog.";
        setFetchError(msg);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [open]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      onOpenChange(next);
    },
    [onOpenChange],
  );

  /* ---- item mutations ---- */

  function updateItems(
    key: CatalogKey,
    updater: (items: ItemState[]) => ItemState[],
  ) {
    setCatalog((prev) => ({ ...prev, [key]: updater(prev[key]) }));
  }

  function handleAdd(key: CatalogKey) {
    updateItems(key, (items) => [...items, emptyItemState()]);
  }

  function handleConfirmEdit(key: CatalogKey, itemKey: string) {
    updateItems(key, (items) =>
      items.map((item) => {
        if (item._key !== itemKey) return item;
        const newLabel = item.draftLabel.trim();
        const newDescription = item.draftDescription.trim();
        const newTagIds = [...item.draftTagIds];
        const wasModified =
          !!item.id &&
          (newLabel !== item.label ||
            newDescription !== item.description ||
            JSON.stringify([...newTagIds].sort((a, b) => a - b)) !==
              JSON.stringify([...item.tagIds].sort((a, b) => a - b)));
        return {
          ...item,
          label: newLabel,
          description: newDescription,
          tagIds: newTagIds,
          editing: false,
          modified: item.modified || wasModified,
        };
      }),
    );
  }

  function handleCancelEdit(key: CatalogKey, itemKey: string) {
    updateItems(key, (items) =>
      items
        .map((item) => {
          if (item._key !== itemKey) return item;
          /* New (never-saved) items discarded on cancel */
          if (!item.id) return null;
          return {
            ...item,
            draftLabel: item.label,
            draftDescription: item.description,
            editing: false,
          };
        })
        .filter(Boolean) as ItemState[],
    );
  }

  function handleStartEdit(key: CatalogKey, itemKey: string) {
    updateItems(key, (items) =>
      items.map((item) =>
        item._key === itemKey
          ? {
              ...item,
              editing: true,
              draftLabel: item.label,
              draftDescription: item.description,
              draftTagIds: [...item.tagIds],
            }
          : item,
      ),
    );
  }

  function handleDraftTagsChange(key: CatalogKey, itemKey: string, tagIds: number[]) {
    updateItems(key, (items) =>
      items.map((item) =>
        item._key === itemKey ? { ...item, draftTagIds: tagIds } : item,
      ),
    );
  }

  function handleDelete(key: CatalogKey, itemKey: string) {
    updateItems(key, (items) =>
      items
        .map((item) => {
          if (item._key !== itemKey) return item;
          /* New unsaved items are simply removed */
          if (!item.id) return null;
          return { ...item, pendingDelete: true, editing: false };
        })
        .filter(Boolean) as ItemState[],
    );
  }

  function handleDraftChange(
    key: CatalogKey,
    itemKey: string,
    field: "label" | "description",
    value: string,
  ) {
    updateItems(key, (items) =>
      items.map((item) => {
        if (item._key !== itemKey) return item;
        return field === "label"
          ? { ...item, draftLabel: value }
          : { ...item, draftDescription: value };
      }),
    );
  }

  /* ---- save ---- */

  function buildPayload() {
    const payload: Record<string, unknown> = {};

    TABS.forEach(({ key, deleteKey }) => {
      const items = catalog[key];

      const deleteIds = items
        .filter((i) => i.pendingDelete && i.id)
        .map((i) => i.id as number);

      const upsertItems: ReferenceCatalogItem[] = items
        .filter((i) => !i.pendingDelete && !i.editing && i.label.trim())
        .map((i) => ({
          ...(i.id ? { id: i.id } : {}),
          label: i.label.trim(),
          ...(i.description.trim() ? { description: i.description.trim() } : {}),
          // Include tag_ids only for attachment_types
          ...(key === "attachment_types" && i.tagIds.length > 0
            ? { tag_ids: i.tagIds }
            : {}),
        }));

      if (deleteIds.length > 0) payload[deleteKey] = deleteIds;
      if (upsertItems.length > 0) payload[key] = upsertItems;
    });

    return payload;
  }

  async function handleSave() {
    /* Warn if any tab has open edit forms */
    const hasOpenEdits = (Object.keys(catalog) as CatalogKey[]).some((k) =>
      catalog[k].some((i) => i.editing),
    );
    if (hasOpenEdits) {
      toast.warning("Finish editing all open items before saving.");
      return;
    }

    const payload = buildPayload();
    if (Object.keys(payload).length === 0) {
      toast.info("Nothing to sync — make some changes first.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await referenceCatalogService.sync(payload);

      // Refresh catalog and push updated data into the Zustand store
      const refreshed = await referenceCatalogService.getAll();
      setStoreData(refreshed.data);

      toast.success("Reference catalog synced successfully.");
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to sync catalog.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  }

  /* ---- counts for tab badges ---- */

  function tabBadge(key: CatalogKey) {
    const items = catalog[key];
    const newCount = items.filter((i) => !i.id && !i.pendingDelete).length;
    const deleteCount = items.filter((i) => i.pendingDelete).length;
    const editCount = items.filter((i) => i.modified && !!i.id && !i.pendingDelete).length;
    if (newCount === 0 && deleteCount === 0 && editCount === 0) return null;
    return (
      <span className="ms-1.5 inline-flex items-center gap-0.5">
        {newCount > 0 && (
          <Badge variant="secondary" className="h-4 px-1 text-[10px] leading-none">
            +{newCount}
          </Badge>
        )}
        {editCount > 0 && (
          <Badge
            variant="outline"
            className="h-4 px-1 text-[10px] leading-none text-amber-600 border-amber-300"
          >
            ~{editCount}
          </Badge>
        )}
        {deleteCount > 0 && (
          <Badge variant="destructive" className="h-4 px-1 text-[10px] leading-none">
            -{deleteCount}
          </Badge>
        )}
      </span>
    );
  }

  const dirty = hasChanges(catalog);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex flex-col max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
            Sync Global Reference Catalog
          </DialogTitle>
          <DialogDescription>
            Create, update, or delete catalog rows. Changes take effect when
            you click <strong>Save &amp; Sync</strong>.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as CatalogKey)}
          >
            {/* Tab list — sticks to the top of the scroll container */}
            <div className="sticky top-0 z-10 bg-background px-6 pt-4 pb-3 border-b">
              <TabsList className="inline-flex w-auto gap-1 h-auto p-1 flex-wrap">
                {TABS.map(({ key, label, icon }) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="flex items-center gap-1.5 text-xs whitespace-nowrap"
                  >
                    {icon}
                    {label}
                    {tabBadge(key)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Tab content — natural flow, no height tricks needed */}
            {TABS.map(({ key }) => (
              <TabsContent
                key={key}
                value={key}
                className="mt-0 px-6 pt-4 pb-6"
              >
                {isLoading ? (
                  <TabLoadingSkeleton />
                ) : fetchError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
                      <span>{fetchError}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                      >
                        Close
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <CatalogTab
                    items={catalog[key]}
                    availableTags={
                      key === "attachment_types"
                        ? catalog.tags
                            .filter((t) => !t.pendingDelete && !!t.id)
                            .map((t) => ({ id: t.id!, label: t.label }))
                        : undefined
                    }
                    onAdd={() => handleAdd(key)}
                    onConfirmEdit={(itemKey) => handleConfirmEdit(key, itemKey)}
                    onCancelEdit={(itemKey) => handleCancelEdit(key, itemKey)}
                    onStartEdit={(itemKey) => handleStartEdit(key, itemKey)}
                    onDelete={(itemKey) => handleDelete(key, itemKey)}
                    onDraftChange={(itemKey, field, value) =>
                      handleDraftChange(key, itemKey, field, value)
                    }
                    onDraftTagsChange={(itemKey, tagIds) =>
                      handleDraftTagsChange(key, itemKey, tagIds)
                    }
                  />
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <Separator />

        {/* Footer */}
        <DialogFooter className="px-6 py-4 shrink-0 flex-col sm:flex-row gap-2">
          {error && (
            <Alert variant="destructive" className="flex-1 py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex items-center gap-2 ms-auto">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !dirty || isLoading || !!fetchError}>
              {isSaving ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  Syncing…
                </>
              ) : (
                <>
                  <RefreshCw className="me-2 h-4 w-4" />
                  Save &amp; Sync
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
