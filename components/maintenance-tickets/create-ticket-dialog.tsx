"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Loader2, Paperclip, X, Store, ChevronDown, Check, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SearchCreateCombobox } from "./search-create-combobox";
import { useAuth } from "@/lib/auth/use-auth";
import { maintenanceTicketsService, MaintenanceTicketsError } from "@/lib/api/services/maintenance-tickets.service";
import type { OverviewStore } from "@/lib/api/services/auth.service";
import type { CatalogIssue, Priority, TicketType } from "@/types/maintenance-tickets.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

interface IssueRow {
  id: string;
  issueId: number | null;
  otherTitle: string;
  priority: Priority;
  description: string;
  note: string;
  files: File[];
}

function makeRow(): IssueRow {
  return {
    id: Math.random().toString(36).slice(2),
    issueId: null,
    otherTitle: "",
    priority: "medium",
    description: "",
    note: "",
    files: [],
  };
}

interface CreateTicketDialogProps {
  open: boolean;
  /** Pre-selected store. When empty (all-stores mode), a store selector is shown inside the dialog. */
  storeId: string;
  catalogIssues: CatalogIssue[];
  /** When provided, a store selector is shown inside the dialog (used in all-stores mode). */
  stores?: OverviewStore[];
  onClose: () => void;
  onSuccess: () => void;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Component                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export function CreateTicketDialog({
  open,
  storeId,
  catalogIssues,
  stores,
  onClose,
  onSuccess,
}: CreateTicketDialogProps) {
  const t = useTranslations("maintenanceTickets");
  const { canAccessRoute } = useAuth();
  const canChooseTicketType = canAccessRoute({
    service: "Maintenance",
    method: "POST",
    path: "/technicians",
  });
  const [rows, setRows] = useState<IssueRow[]>([makeRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // When storeId prop is empty (all-stores mode), the user picks a store inside the dialog.
  const needsStorePick = !storeId && !!stores?.length;
  const [pickedStoreId, setPickedStoreId] = useState<string>("");
  const [ticketType, setTicketType] = useState<TicketType>("normal");
  const [otherStoreText, setOtherStoreText] = useState("");
  const isOtherStore = pickedStoreId === "__other__";
  const activeStoreId = storeId || (isOtherStore ? "" : pickedStoreId);

  // Store picker popover state
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const storeSearchRef = useRef<HTMLInputElement>(null);
  const filteredStores = storeSearch.trim()
    ? (stores ?? []).filter((s) => {
        const id = s.storeId ?? s.id;
        const label = s.name ? `${s.name} (${id})` : id;
        return label.toLowerCase().includes(storeSearch.toLowerCase());
      })
    : (stores ?? []);

  // Local catalog issues — seeded from prop, grows when user creates new ones in-session
  const [localCatalogIssues, setLocalCatalogIssues] = useState<CatalogIssue[]>(() =>
    catalogIssues.filter((i) => !i.deletedAt)
  );
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Re-seed on dialog open so it always reflects the latest catalog data
  useEffect(() => {
    if (open) {
      setPickedStoreId("");
      setTicketType("normal");
      setOtherStoreText("");
      setStoreSearch("");
      setStorePickerOpen(false);
      setLocalCatalogIssues(catalogIssues.filter((i) => !i.deletedAt));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus search input when store picker opens
  useEffect(() => {
    if (storePickerOpen) {
      setStoreSearch("");
      const t = setTimeout(() => storeSearchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [storePickerOpen]);

  // When a store is picked inside the dialog, fetch that store's catalog issues.
  useEffect(() => {
    if (!pickedStoreId || pickedStoreId === "__other__") return;
    let cancelled = false;
    setCatalogLoading(true);
    maintenanceTicketsService.getCatalogIssues(undefined, pickedStoreId)
      .then((issues) => { if (!cancelled) setLocalCatalogIssues(issues.filter((i) => !i.deletedAt)); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCatalogLoading(false); });
    return () => { cancelled = true; };
  }, [pickedStoreId]);

  const comboItems = localCatalogIssues.map((i) => ({ id: i.id, label: i.title }));

  function updateRow(id: string, patch: Partial<IssueRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function addRow() {
    setRows((prev) => [...prev, makeRow()]);
  }

  function handleClose() {
    if (isSubmitting) return;
    setRows([makeRow()]);
    setSubmitError(null);
    onClose();
  }

  /** Creates a catalog issue and returns the new id. Called by SearchCreateCombobox. */
  async function createCatalogIssue(title: string): Promise<number> {
    const newIssue = await maintenanceTicketsService.createCatalogIssue({ title }, activeStoreId);
    setLocalCatalogIssues((prev) => [...prev, newIssue]);
    return newIssue.id;
  }

  async function handleSubmit() {
    setSubmitError(null);

    if (needsStorePick && !pickedStoreId) {
      setSubmitError("Please select a store first.");
      return;
    }

    if (isOtherStore && !otherStoreText.trim()) {
      setSubmitError("Please enter a location description.");
      return;
    }

    for (const row of rows) {
      if (isOtherStore ? !row.otherTitle.trim() : !row.issueId) {
        setSubmitError(t("createDialog.validationSelectIssue"));
        return;
      }
      if (!row.description.trim()) {
        setSubmitError(t("createDialog.validationDescriptionRequired"));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        issues: rows.map((row) => ({
          ...(isOtherStore
            ? { other_title: row.otherTitle.trim() }
            : { issue_id: row.issueId! }),
          priority: row.priority,
          description: row.description.trim(),
          ...(row.note.trim() ? { notes: [{ body: row.note.trim() }] } : {}),
          ...(row.files.length ? { files: row.files } : {}),
        })),
        type: ticketType,
      };

      if (isOtherStore) {
        await maintenanceTicketsService.createTicketOther(otherStoreText.trim(), payload);
      } else {
        await maintenanceTicketsService.createTicket(activeStoreId, payload);
      }

      setRows([makeRow()]);
      setSubmitError(null);
      onSuccess();
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof MaintenanceTicketsError ? err.message : t("createDialog.submitError")
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("createDialog.title")}</DialogTitle>
          <DialogDescription>{t("createDialog.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Store selector — shown only when opened in all-stores mode */}
          {needsStorePick && (
            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Store className="h-4 w-4 text-muted-foreground" />
                Store <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                {/* Searchable store dropdown */}
                <Popover open={storePickerOpen} onOpenChange={setStorePickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={isOtherStore}
                      className={cn(
                        "flex h-9 flex-1 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        "focus:outline-none focus:ring-1 focus:ring-ring",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        !isOtherStore && pickedStoreId && "border-primary/40 bg-primary/5"
                      )}
                    >
                      <span className={cn("flex-1 truncate text-start", (!pickedStoreId || isOtherStore) && "text-muted-foreground")}>
                        {!isOtherStore && pickedStoreId
                          ? (() => {
                              const s = stores!.find((s) => (s.storeId ?? s.id) === pickedStoreId);
                              return s ? (s.name ? `${s.name} (${pickedStoreId})` : pickedStoreId) : pickedStoreId;
                            })()
                          : "Select a store…"}
                      </span>
                      <ChevronDown className={cn("ms-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150", storePickerOpen && "rotate-180")} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" sideOffset={4} className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-0 shadow-md">
                    <div className="border-b px-2 py-1.5">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                          ref={storeSearchRef}
                          value={storeSearch}
                          onChange={(e) => setStoreSearch(e.target.value)}
                          placeholder="Search stores…"
                          className="w-full rounded-sm bg-transparent py-1 pl-7 pr-2 text-sm outline-none placeholder:text-muted-foreground"
                        />
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto p-1" onWheel={(e) => e.stopPropagation()}>
                      {filteredStores.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted-foreground">No results</p>
                      ) : (
                        filteredStores.map((s) => {
                          const id = s.storeId ?? s.id;
                          const label = s.name ? `${s.name} (${id})` : id;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => { setPickedStoreId(id); setStorePickerOpen(false); }}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                                id === pickedStoreId && "bg-accent/60 font-medium"
                              )}
                            >
                              <Check className={cn("h-3.5 w-3.5 shrink-0", id === pickedStoreId ? "opacity-100" : "opacity-0")} />
                              {label}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Other button */}
                <Button
                  type="button"
                  variant={isOtherStore ? "default" : "outline"}
                  size="sm"
                  className="h-9 shrink-0"
                  onClick={() => setPickedStoreId(isOtherStore ? "" : "__other__")}
                >
                  Other
                </Button>
              </div>
              {isOtherStore && (
                <Input
                  className="mt-1 text-sm"
                  placeholder="e.g. Main Warehouse — Building C"
                  value={otherStoreText}
                  onChange={(e) => setOtherStoreText(e.target.value)}
                />
              )}
            </div>
          )}

          {/* Ticket type — only users with catalog-management access may choose it */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Type</Label>
            {canChooseTicketType ? (
              <Select value={ticketType} onValueChange={(v) => setTicketType(v as TicketType)}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="preventive_maintenance">Preventive Maintenance</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                Normal
              </div>
            )}
          </div>

          <div className={needsStorePick && !pickedStoreId ? "pointer-events-none opacity-40" : undefined}>
          {rows.map((row, idx) => (
            <div key={row.id} className="rounded-lg border p-4 space-y-3">
              {/* Row header */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {t("createDialog.issueRow", { number: idx + 1 })}
                </span>
                {rows.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeRow(row.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Issue title */}
              <div className="space-y-1">
                <Label className="text-sm">
                  {t("createDialog.issueLabel")} <span className="text-destructive">*</span>
                </Label>
                {isOtherStore ? (
                  <Input
                    className="text-sm"
                    placeholder="Describe the issue…"
                    value={row.otherTitle}
                    onChange={(e) => updateRow(row.id, { otherTitle: e.target.value })}
                  />
                ) : (
                  <SearchCreateCombobox
                    items={comboItems}
                    selectedId={row.issueId}
                    onSelect={(id) => updateRow(row.id, { issueId: id })}
                    onCreate={createCatalogIssue}
                    placeholder={catalogLoading ? "Loading issues…" : "Search issues or type to create a new one…"}
                  />
                )}
              </div>

              {/* Priority */}
              <div className="space-y-1">
                <Label className="text-sm">{t("createDialog.priorityLabel")}</Label>
                <Select
                  value={row.priority}
                  onValueChange={(v) => updateRow(row.id, { priority: v as Priority })}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">{t("priority.urgent")}</SelectItem>
                    <SelectItem value="high">{t("priority.high")}</SelectItem>
                    <SelectItem value="medium">{t("priority.medium")}</SelectItem>
                    <SelectItem value="low">{t("priority.low")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <Label className="text-sm">{t("createDialog.descriptionLabel")}</Label>
                <Textarea
                  value={row.description}
                  onChange={(e) => updateRow(row.id, { description: e.target.value })}
                  placeholder={t("createDialog.descriptionPlaceholder")}
                  className="text-sm min-h-20"
                />
              </div>

              {/* Optional note */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  {t("createDialog.noteLabel")}
                  <span className="ms-1 text-xs font-normal opacity-60">{t("createDialog.optional")}</span>
                </Label>
                <Textarea
                  value={row.note}
                  onChange={(e) => updateRow(row.id, { note: e.target.value })}
                  placeholder={t("createDialog.notePlaceholder")}
                  className="text-sm min-h-14"
                />
              </div>

              {/* File attachments */}
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">
                  {t("createDialog.filesLabel")}
                  <span className="ms-1 text-xs font-normal opacity-60">{t("createDialog.optional")}</span>
                </Label>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  ref={(el) => { fileInputRefs.current[row.id] = el; }}
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    if (picked.length) updateRow(row.id, { files: [...row.files, ...picked] });
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRefs.current[row.id]?.click()}
                >
                  <Paperclip className="me-1.5 h-3.5 w-3.5" />
                  {t("createDialog.attachFiles")}
                </Button>
                {row.files.length > 0 && (
                  <ul className="mt-1 space-y-1">
                    {row.files.map((file, fi) => (
                      <li key={fi} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Paperclip className="h-3 w-3 shrink-0 opacity-50" />
                        <span className="truncate max-w-[220px]">{file.name}</span>
                        <button
                          type="button"
                          aria-label={t("createDialog.removeFile")}
                          onClick={() => updateRow(row.id, { files: row.files.filter((_, idx) => idx !== fi) })}
                          className="ms-auto text-destructive hover:opacity-80"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={addRow}
          >
            <Plus className="me-1.5 h-4 w-4" />
            {t("createDialog.addIssue")}
          </Button>
          </div>{/* end dimmed wrapper */}

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            {t("createDialog.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("createDialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
