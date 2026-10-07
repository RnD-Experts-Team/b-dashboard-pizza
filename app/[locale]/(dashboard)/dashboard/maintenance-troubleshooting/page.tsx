"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LifeBuoy, Pencil, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth/use-auth";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import { TroubleshootingSteps } from "@/components/maintenance-tickets/troubleshooting/troubleshooting-steps";
import { GuideEditor } from "@/components/maintenance-tickets/troubleshooting/guide-editor";
import { LocalTimestamp } from "@/components/maintenance-tickets/local-timestamp";
import type { CatalogIssue, TroubleshootingLibraryItem } from "@/types/maintenance-tickets.types";

/**
 * The troubleshooting library: every guide, readable by anyone with
 * maintenance access -- what to try before calling for an Oven, a Walk-in
 * Cooler, the POS. The same steps appear in the new-ticket form when that
 * issue is picked.
 *
 * Catalog managers also write and change guides here. Every guide is shown
 * open; nothing is folded away.
 */
export default function MaintenanceTroubleshootingPage() {
  const { canAccessRoute } = useAuth();
  const canEdit = canAccessRoute({ service: "Maintenance", method: "PUT", path: "/issues/placeholder/troubleshooting" });
  const storeCode = useSelectedStoreStore((s) => s.selectedStore?.storeId);

  const [items, setItems] = useState<TroubleshootingLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<number | null>(null);

  // Editors can start a guide for an issue that has none.
  const [catalog, setCatalog] = useState<CatalogIssue[]>([]);
  const [newIssueId, setNewIssueId] = useState<string>("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setItems(await maintenanceTicketsService.getTroubleshootingLibrary(storeCode));
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Could not load the troubleshooting guides.");
    } finally {
      setIsLoading(false);
    }
  }, [storeCode]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canEdit) return;
    maintenanceTicketsService.getCatalogIssues(undefined, storeCode)
      .then((issues) => setCatalog(issues.filter((i) => !i.deletedAt)))
      .catch(() => setCatalog([]));
  }, [canEdit, storeCode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.title, item.description ?? "", ...item.troubleshooting.steps].some((text) => text.toLowerCase().includes(q)),
    );
  }, [items, query]);

  const withoutGuide = useMemo(() => {
    const has = new Set(items.map((i) => i.issueId));
    return catalog.filter((issue) => !has.has(issue.id)).sort((a, b) => a.title.localeCompare(b.title));
  }, [catalog, items]);

  const newIssue = withoutGuide.find((i) => String(i.id) === newIssueId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Troubleshooting"
        description="What to try before opening a ticket. The same steps appear when you pick the issue on a new ticket."
      >
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues and steps…"
            className="w-64 ps-8"
          />
        </div>
      </PageHeader>

      {canEdit && withoutGuide.length > 0 && (
        <div className="space-y-3 rounded-lg border border-dashed p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Plus className="h-4 w-4" aria-hidden="true" /> Write a guide for an issue that has none
          </p>
          <Select value={newIssueId} onValueChange={setNewIssueId}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Choose an issue…" /></SelectTrigger>
            <SelectContent position="popper" style={{ maxHeight: 280, overflowY: "auto" }}>
              {withoutGuide.map((issue) => (
                <SelectItem key={issue.id} value={String(issue.id)}>{issue.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {newIssue && (
            <GuideEditor
              key={newIssue.id}
              issueId={newIssue.id}
              issueTitle={newIssue.title}
              guide={null}
              onSaved={() => {
                setNewIssueId("");
                void load();
              }}
              onCancel={() => setNewIssueId("")}
            />
          )}
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      )}

      {!isLoading && error && <p className="text-sm text-destructive">{error}</p>}

      {!isLoading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-24 text-center">
          <LifeBuoy className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No troubleshooting guides yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {canEdit ? "Write the first one above." : "Once guides are written, they will appear here."}
          </p>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No guide mentions “{query}”.</p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((item) => (
          <section key={item.issueId} className="space-y-3 rounded-xl border bg-card p-4">
            <header className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-heading text-base font-semibold">{item.title}</h2>
                {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
              </div>
              {canEdit && editing !== item.issueId && (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditing(item.issueId)}>
                  <Pencil className="me-1 h-3 w-3" /> Edit
                </Button>
              )}
            </header>

            {editing === item.issueId ? (
              <GuideEditor
                issueId={item.issueId}
                issueTitle={item.title}
                guide={item.troubleshooting}
                onSaved={(guide) => setItems((prev) => prev.map((i) => (i.issueId === item.issueId ? { ...i, troubleshooting: guide } : i)))}
                onRemoved={() => {
                  setEditing(null);
                  setItems((prev) => prev.filter((i) => i.issueId !== item.issueId));
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <TroubleshootingSteps
                steps={item.troubleshooting.steps}
                linkUrl={item.troubleshooting.linkUrl}
                attachments={item.troubleshooting.attachments}
              />
            )}

            <p className="text-[11px] text-muted-foreground">
              Version {item.troubleshooting.version}
              {item.troubleshooting.editor ? ` · ${item.troubleshooting.editor.name}` : ""} ·{" "}
              <LocalTimestamp iso={item.troubleshooting.updatedAt} pattern="MMM d, yyyy" showZone={false} />
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
