"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmployeeDebriefDetailSheet } from "@/components/employee-debriefs/employee-debrief-detail-sheet";
import { DueKeysFeed } from "@/components/due-keys/due-keys-feed";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
  useEmployeeDebriefs,
  useDeleteEmployeeDebrief,
} from "@/lib/hooks/use-employee-debriefs";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { cn } from "@/lib/utils";
import { RefreshCw, Trash2, Store, CalendarDays, Tag } from "lucide-react";
import type { EmployeeDebriefItem } from "@/types/employee-debrief.types";

interface AuthUserStoreOption {
  id: string;
  name: string;
}

function parseAuthUserStores(): AuthUserStoreOption[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem("auth-user");
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as {
      stores?: Array<{
        store?: {
          id?: string | number;
          store_id?: string | number;
          name?: string;
        };
      }>;
    };

    return (parsed.stores ?? [])
      .map((entry) => {
        const store = entry.store;
        const resolvedId = String(store?.store_id ?? store?.id ?? "").trim();
        const resolvedName = store?.name?.trim() || resolvedId;
        return { id: resolvedId, name: resolvedName };
      })
      .filter((store) => store.id.length > 0);
  } catch {
    return [];
  }
}

function formatDebriefDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function DebriefTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">ID</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead className="hidden sm:table-cell">Date Written</TableHead>
            <TableHead className="hidden lg:table-cell">Notes</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-8" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-48" /></TableCell>
              <TableCell><Skeleton className="h-7 w-7" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function DueKeysPage() {
  const { selectedStore } = useSelectedStoreStore();
  const [stores, setStores] = useState<AuthUserStoreOption[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });

  // ── Employee Debrief state ─────────────────────────────────────────
  const [selectedDebrief, setSelectedDebrief] = useState<EmployeeDebriefItem | null>(null);
  const [debriefSheetOpen, setDebriefSheetOpen] = useState(false);
  const [deletingDebrief, setDeletingDebrief] = useState<EmployeeDebriefItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    const parsedStores = parseAuthUserStores();
    setStores(parsedStores);
    if (parsedStores.length > 0) {
      setSelectedStoreId(parsedStores[0].id);
    }
  }, []);

  // Sync with global selected store if available
  useEffect(() => {
    if (selectedStore?.id) {
      setSelectedStoreId(String(selectedStore.id));
    }
  }, [selectedStore]);

  const {
    items: debriefItems,
    isLoading: isDebriefLoading,
    isRefreshing: isDebriefRefreshing,
    error: debriefError,
    refetch: refetchDebriefs,
    clearError: clearDebriefError,
  } = useEmployeeDebriefs(selectedStoreId);

  const {
    deleteDebrief,
    isDeleting,
    error: deleteError,
    clearError: clearDeleteError,
  } = useDeleteEmployeeDebrief();

  const handleDebriefRowClick = (item: EmployeeDebriefItem) => {
    setSelectedDebrief(item);
    setDebriefSheetOpen(true);
  };

  const handleDebriefDeleteClick = (e: React.MouseEvent, item: EmployeeDebriefItem) => {
    e.stopPropagation();
    setDeletingDebrief(item);
    clearDeleteError();
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteDebrief = async () => {
    if (!deletingDebrief || !selectedStoreId) return;
    setDeleteConfirmOpen(false);
    const success = await deleteDebrief(selectedStoreId, deletingDebrief.id);
    if (success) {
      toast.success(`Debrief #${deletingDebrief.id} deleted successfully.`);
      if (selectedDebrief?.id === deletingDebrief.id) setDebriefSheetOpen(false);
      refetchDebriefs();
    } else {
      toast.error(deleteError ?? "Failed to delete the debrief.");
    }
    setDeletingDebrief(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Due Keys"
        description="Browse filled keys by store — scroll up to view history."
      />

      {/* ── Main two-column layout ─────────────────────────────────── */}
      <div className="flex items-start justify-center gap-5">

        {/* ── Feed (left, grows) ──────────────────────────────────── */}
        <div className="min-w-0 flex-1 max-w-2xl">
          <DueKeysFeed storeId={selectedStoreId} selectedDate={selectedDate} />
        </div>

        {/* ── Sidebar (right, sticky) ─────────────────────────────── */}
        <div className="w-56 shrink-0 space-y-3 lg:w-64" style={{ position: "sticky", top: "1.5rem" }}>

          {/* Store filter */}
          <div className="rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm">
            <div className="mb-3 flex items-center gap-2">
              <Store className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Store</p>
            </div>
            <Select
              value={selectedStoreId ?? ""}
              onValueChange={(value) => setSelectedStoreId(value || null)}
              disabled={stores.length === 0}
            >
              <SelectTrigger className="h-8 border-border/50 bg-background/60 text-sm">
                <SelectValue
                  placeholder={stores.length === 0 ? "No stores" : "Select store"}
                />
              </SelectTrigger>
              <SelectContent position="popper" style={{ maxHeight: "160px", overflowY: "auto" }}>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date filter */}
          <div className="rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</p>
            </div>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 border-border/50 bg-background/60 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setSelectedDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
              }}
              className="mt-2 text-[11px] text-muted-foreground/70 underline-offset-2 hover:text-muted-foreground hover:underline"
            >
              Reset to today
            </button>
          </div>

          {/* Tag legend */}
          <div className="rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm">
            <div className="mb-3 flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tags</p>
            </div>
            <div className="space-y-1.5">
              {[
                { tag: "temp-log",        label: "Temp Log",        color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
                { tag: "safety-audit",    label: "Safety Audit",    color: "bg-red-500/15 text-red-400 border-red-500/20" },
                { tag: "morning-check",   label: "Morning Check",   color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
                { tag: "closing-check",   label: "Closing Check",   color: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
                { tag: "evening-close",   label: "Evening Close",   color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20" },
                { tag: "inventory-count", label: "Inventory",       color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
                { tag: "dough-check",     label: "Dough Check",     color: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
              ].map(({ tag, label, color }) => (
                <div key={tag} className="flex items-center gap-2">
                  <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide", color)}>
                    #{tag}
                  </span>
                  <span className="hidden text-[11px] text-muted-foreground lg:inline">{label}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Employee Debrief Notes ─────────────────────────────────── */}
      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Employee Debrief Notes</h2>
            <p className="text-sm text-muted-foreground">
              Debrief notes for the selected store.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refetchDebriefs}
            disabled={!selectedStoreId || isDebriefLoading || isDebriefRefreshing}
          >
            <RefreshCw
              className={cn("me-2 h-4 w-4", isDebriefRefreshing && "animate-spin")}
            />
            {isDebriefRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {debriefError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{debriefError}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" onClick={refetchDebriefs}>
                Retry
              </Button>
              <Button variant="ghost" size="sm" onClick={clearDebriefError}>
                Dismiss
              </Button>
            </div>
          </div>
        )}

        <div>
          {isDebriefLoading && !debriefItems.length ? (
            <DebriefTableSkeleton />
          ) : !selectedStoreId ? (
            <div className="rounded-md border p-6 text-sm text-muted-foreground">
              Select a store to load employee debrief notes.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead className="hidden sm:table-cell">Date Written</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debriefItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No employee debrief notes found for this store.
                      </TableCell>
                    </TableRow>
                  ) : (
                    debriefItems.map((item) => {
                      const writtenDate = item.date ?? item.createdAt;

                      return (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer"
                          onClick={() => handleDebriefRowClick(item)}
                        >
                          <TableCell className="font-mono text-sm">{item.id}</TableCell>
                          <TableCell className="font-medium">
                            {item.employeeName ? (
                              item.employeeName
                            ) : item.employeeId != null ? (
                              <Badge variant="secondary">ID {item.employeeId}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {writtenDate ? (
                              <span className="text-sm">{formatDebriefDate(writtenDate)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={(e) => handleDebriefDeleteClick(e, item)}
                              disabled={isDeleting}
                              aria-label={`Delete debrief #${item.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* ── Debrief detail sheet ───────────────────────────────────── */}
      <EmployeeDebriefDetailSheet
        open={debriefSheetOpen}
        onOpenChange={setDebriefSheetOpen}
        storeId={selectedStoreId ?? ""}
        debriefId={selectedDebrief?.id ?? null}
      />

      {/* ── Delete confirmation ────────────────────────────────────── */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Debrief</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete debrief{" "}
              <strong>#{deletingDebrief?.id}</strong>
              {deletingDebrief?.employeeName ? ` for ${deletingDebrief.employeeName}` : ""}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDeleteDebrief}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
