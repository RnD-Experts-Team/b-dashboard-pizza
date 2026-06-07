"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, RotateCcw, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
  entityPaths,
} from "@/lib/api/services/maintenance-tickets.service";
import type {
  CatalogIssue,
  CatalogTechnician,
  CatalogCategory,
  CatalogPart,
  TicketNote,
  TicketAttachment,
} from "@/types/maintenance-tickets.types";
import { EntityNotesAttachments } from "./entity-extras";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Reusable item row                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

interface ItemRowProps {
  name: string;
  secondary?: string;
  isDeleted: boolean;
  onDelete: () => void;
  onRestore?: () => void;
  isActing: boolean;
  /** Optional content rendered below the row (e.g. notes & attachments). */
  extra?: ReactNode;
}

function ItemRow({ name, secondary, isDeleted, onDelete, onRestore, isActing, extra }: ItemRowProps) {
  return (
    <div className={cn(
      "rounded-md transition-colors",
      isDeleted ? "bg-muted/40 opacity-60" : "bg-muted/20 hover:bg-muted/40"
    )}>
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium truncate", isDeleted && "line-through text-muted-foreground")}>
            {name}
          </p>
          {secondary && <p className="text-xs text-muted-foreground truncate">{secondary}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isDeleted && (
            <Badge variant="secondary" className="text-xs h-5">deleted</Badge>
          )}
          {isDeleted && onRestore ? (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRestore} disabled={isActing}>
              {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            </Button>
          ) : !isDeleted ? (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} disabled={isActing}>
              {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          ) : null}
        </div>
      </div>
      {extra && <div className="px-3 pb-2">{extra}</div>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Issues tab                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

function IssuesTab({ onReloadCatalog }: { onReloadCatalog: () => void }) {
  const t = useTranslations("maintenanceTickets");
  const [items, setItems] = useState<CatalogIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const res = await maintenanceTicketsService.getCatalogIssues();
      setItems(res);
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to load");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!title.trim()) return;
    setIsCreating(true);
    try {
      await maintenanceTicketsService.createCatalogIssue({ title: title.trim(), description: description.trim() || undefined });
      setTitle(""); setDescription("");
      await load();
      onReloadCatalog();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to create");
    } finally { setIsCreating(false); }
  }

  async function handleDelete(id: number) {
    setActingId(id);
    try {
      await maintenanceTicketsService.deleteCatalogIssue(id);
      await load(); onReloadCatalog();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to delete");
    } finally { setActingId(null); }
  }

  async function handleRestore(id: number) {
    setActingId(id);
    try {
      await maintenanceTicketsService.restoreCatalogIssue(id);
      await load(); onReloadCatalog();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to restore");
    } finally { setActingId(null); }
  }

  const visible = showDeleted ? items : items.filter(i => !i.deletedAt);

  return (
    <div className="space-y-4">
      {/* Create form */}
      <div className="rounded-lg border p-3 space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("catalog.addIssue")}</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t("catalog.issueTitlePlaceholder")} className="text-sm" />
        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t("catalog.descriptionPlaceholder")} className="text-sm min-h-16" />
        <Button size="sm" onClick={handleCreate} disabled={isCreating || !title.trim()}>
          {isCreating ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="me-1.5 h-3.5 w-3.5" />}
          {t("catalog.add")}
        </Button>
      </div>

      {/* Filter toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{visible.length} {t("catalog.items")}</span>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowDeleted(v => !v)}>
          {showDeleted ? t("catalog.hideDeleted") : t("catalog.showDeleted")}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-4 w-4" />{error}</p>}
      {isLoading && <div className="space-y-1">{Array.from({length:3}).map((_,i)=><div key={i} className="h-9 rounded-md bg-muted animate-pulse"/>)}</div>}

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {visible.map(item => (
          <ItemRow
            key={item.id}
            name={item.title}
            secondary={item.description ?? undefined}
            isDeleted={!!item.deletedAt}
            onDelete={() => handleDelete(item.id)}
            onRestore={() => handleRestore(item.id)}
            isActing={actingId === item.id}
            extra={!item.deletedAt && (
              <EntityNotesAttachments
                entityPath={entityPaths.catalogIssue(item.id)}
                notes={item.notes}
                attachments={item.attachments}
                onSuccess={() => {}}
                onNoteAdded={(note: TicketNote) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, notes: [...(i.notes ?? []), note] } : i))}
                onAttachmentsAdded={(atts: TicketAttachment[]) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, attachments: [...(i.attachments ?? []), ...atts] } : i))}
                allowNoteType
              />
            )}
          />
        ))}
        {!isLoading && visible.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">{t("catalog.noItems")}</p>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Technicians tab                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

function TechniciansTab({ onReloadCatalog }: { onReloadCatalog: () => void }) {
  const t = useTranslations("maintenanceTickets");
  const [items, setItems] = useState<CatalogTechnician[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const [techs, cats] = await Promise.all([
        maintenanceTicketsService.getCatalogTechnicians(),
        maintenanceTicketsService.getCatalogCategories(),
      ]);
      setItems(techs); setCategories(cats);
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to load");
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      await maintenanceTicketsService.createCatalogTechnician({
        name: name.trim(),
        phone: phone.trim() || undefined,
        category_id: categoryId ? Number(categoryId) : undefined,
      });
      setName(""); setPhone(""); setCategoryId("");
      await load(); onReloadCatalog();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to create");
    } finally { setIsCreating(false); }
  }

  async function handleDelete(id: number) {
    setActingId(id);
    try { await maintenanceTicketsService.deleteCatalogTechnician(id); await load(); onReloadCatalog(); }
    catch (err) { setError(err instanceof MaintenanceTicketsError ? err.message : "Failed"); }
    finally { setActingId(null); }
  }

  async function handleRestore(id: number) {
    setActingId(id);
    try { await maintenanceTicketsService.restoreCatalogTechnician(id); await load(); onReloadCatalog(); }
    catch (err) { setError(err instanceof MaintenanceTicketsError ? err.message : "Failed"); }
    finally { setActingId(null); }
  }

  const visible = showDeleted ? items : items.filter(i => !i.deletedAt);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("catalog.addTechnician")}</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("catalog.namePlaceholder")} className="text-sm" />
        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t("catalog.phonePlaceholder")} className="text-sm" />
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="text-sm"><SelectValue placeholder={t("catalog.categoryPlaceholder")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("catalog.noCategory")}</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={handleCreate} disabled={isCreating || !name.trim()}>
          {isCreating ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="me-1.5 h-3.5 w-3.5" />}
          {t("catalog.add")}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{visible.length} {t("catalog.items")}</span>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowDeleted(v => !v)}>
          {showDeleted ? t("catalog.hideDeleted") : t("catalog.showDeleted")}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-4 w-4" />{error}</p>}
      {isLoading && <div className="space-y-1">{Array.from({length:3}).map((_,i)=><div key={i} className="h-9 rounded-md bg-muted animate-pulse"/>)}</div>}

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {visible.map(item => (
          <ItemRow
            key={item.id}
            name={item.name}
            secondary={item.categoryName ?? item.phone ?? undefined}
            isDeleted={!!item.deletedAt}
            onDelete={() => handleDelete(item.id)}
            onRestore={() => handleRestore(item.id)}
            isActing={actingId === item.id}
            extra={!item.deletedAt && (
              <EntityNotesAttachments
                entityPath={entityPaths.technician(item.id)}
                notes={item.notes}
                attachments={item.attachments}
                onSuccess={() => {}}
                onNoteAdded={(note: TicketNote) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, notes: [...(i.notes ?? []), note] } : i))}
                onAttachmentsAdded={(atts: TicketAttachment[]) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, attachments: [...(i.attachments ?? []), ...atts] } : i))}
                allowNoteType
              />
            )}
          />
        ))}
        {!isLoading && visible.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">{t("catalog.noItems")}</p>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Categories tab                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

function CategoriesTab({ onReloadCatalog }: { onReloadCatalog: () => void }) {
  const t = useTranslations("maintenanceTickets");
  const [items, setItems] = useState<CatalogCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true); setError(null);
    try { setItems(await maintenanceTicketsService.getCatalogCategories()); }
    catch (err) { setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to load"); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      await maintenanceTicketsService.createCatalogCategory({ name: name.trim(), description: description.trim() || undefined });
      setName(""); setDescription(""); await load(); onReloadCatalog();
    } catch (err) { setError(err instanceof MaintenanceTicketsError ? err.message : "Failed"); }
    finally { setIsCreating(false); }
  }

  async function handleDelete(id: number) {
    setActingId(id);
    try { await maintenanceTicketsService.deleteCatalogCategory(id); await load(); onReloadCatalog(); }
    catch (err) { setError(err instanceof MaintenanceTicketsError ? err.message : "Failed"); }
    finally { setActingId(null); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("catalog.addCategory")}</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("catalog.categoryNamePlaceholder")} className="text-sm" />
        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t("catalog.descriptionPlaceholder")} className="text-sm min-h-16" />
        <Button size="sm" onClick={handleCreate} disabled={isCreating || !name.trim()}>
          {isCreating ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="me-1.5 h-3.5 w-3.5" />}
          {t("catalog.add")}
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{items.length} {t("catalog.items")}</span>
      </div>
      {error && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-4 w-4" />{error}</p>}
      {isLoading && <div className="space-y-1">{Array.from({length:3}).map((_,i)=><div key={i} className="h-9 rounded-md bg-muted animate-pulse"/>)}</div>}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {items.map(item => (
          <ItemRow
            key={item.id}
            name={item.name}
            secondary={item.description ?? undefined}
            isDeleted={false}
            onDelete={() => handleDelete(item.id)}
            isActing={actingId === item.id}
            extra={
              <EntityNotesAttachments
                entityPath={entityPaths.category(item.id)}
                notes={item.notes}
                attachments={item.attachments}
                onSuccess={() => {}}
                onNoteAdded={(note: TicketNote) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, notes: [...(i.notes ?? []), note] } : i))}
                onAttachmentsAdded={(atts: TicketAttachment[]) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, attachments: [...(i.attachments ?? []), ...atts] } : i))}
                allowNoteType
              />
            }
          />
        ))}
        {!isLoading && items.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">{t("catalog.noItems")}</p>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Parts tab                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

function PartsTab({ onReloadCatalog }: { onReloadCatalog: () => void }) {
  const t = useTranslations("maintenanceTickets");
  const [items, setItems] = useState<CatalogPart[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true); setError(null);
    try { setItems(await maintenanceTicketsService.getCatalogParts()); }
    catch (err) { setError(err instanceof MaintenanceTicketsError ? err.message : "Failed to load"); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      await maintenanceTicketsService.createCatalogPart({ name: name.trim(), description: description.trim() || undefined });
      setName(""); setDescription(""); await load(); onReloadCatalog();
    } catch (err) { setError(err instanceof MaintenanceTicketsError ? err.message : "Failed"); }
    finally { setIsCreating(false); }
  }

  async function handleDelete(id: number) {
    setActingId(id);
    try { await maintenanceTicketsService.deleteCatalogPart(id); await load(); onReloadCatalog(); }
    catch (err) { setError(err instanceof MaintenanceTicketsError ? err.message : "Failed"); }
    finally { setActingId(null); }
  }

  async function handleRestore(id: number) {
    setActingId(id);
    try { await maintenanceTicketsService.restoreCatalogPart(id); await load(); onReloadCatalog(); }
    catch (err) { setError(err instanceof MaintenanceTicketsError ? err.message : "Failed"); }
    finally { setActingId(null); }
  }

  const visible = showDeleted ? items : items.filter(i => !i.deletedAt);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("catalog.addPart")}</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("catalog.partNamePlaceholder")} className="text-sm" />
        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t("catalog.descriptionPlaceholder")} className="text-sm min-h-16" />
        <Button size="sm" onClick={handleCreate} disabled={isCreating || !name.trim()}>
          {isCreating ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="me-1.5 h-3.5 w-3.5" />}
          {t("catalog.add")}
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{visible.length} {t("catalog.items")}</span>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowDeleted(v => !v)}>
          {showDeleted ? t("catalog.hideDeleted") : t("catalog.showDeleted")}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-4 w-4" />{error}</p>}
      {isLoading && <div className="space-y-1">{Array.from({length:3}).map((_,i)=><div key={i} className="h-9 rounded-md bg-muted animate-pulse"/>)}</div>}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {visible.map(item => (
          <ItemRow
            key={item.id}
            name={item.name}
            secondary={item.description ?? undefined}
            isDeleted={!!item.deletedAt}
            onDelete={() => handleDelete(item.id)}
            onRestore={() => handleRestore(item.id)}
            isActing={actingId === item.id}
            extra={!item.deletedAt && (
              <EntityNotesAttachments
                entityPath={entityPaths.part(item.id)}
                notes={item.notes}
                attachments={item.attachments}
                onSuccess={() => {}}
                onNoteAdded={(note: TicketNote) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, notes: [...(i.notes ?? []), note] } : i))}
                onAttachmentsAdded={(atts: TicketAttachment[]) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, attachments: [...(i.attachments ?? []), ...atts] } : i))}
                allowNoteType
              />
            )}
          />
        ))}
        {!isLoading && visible.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">{t("catalog.noItems")}</p>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main dialog                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export interface CatalogManagementDialogProps {
  open: boolean;
  onClose: () => void;
  onReloadCatalog: () => void;
}

export function CatalogManagementDialog({ open, onClose, onReloadCatalog }: CatalogManagementDialogProps) {
  const t = useTranslations("maintenanceTickets");

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="w-[95vw] max-w-xl flex flex-col max-h-[90vh] overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("catalog.title")}</DialogTitle>
          <DialogDescription>{t("catalog.description")}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="issues" className="flex flex-col flex-1 min-h-0">
          <TabsList className="grid w-full grid-cols-4 shrink-0">
            <TabsTrigger value="issues" className="text-xs">{t("catalog.tabs.issues")}</TabsTrigger>
            <TabsTrigger value="technicians" className="text-xs">{t("catalog.tabs.technicians")}</TabsTrigger>
            <TabsTrigger value="categories" className="text-xs">{t("catalog.tabs.categories")}</TabsTrigger>
            <TabsTrigger value="parts" className="text-xs">{t("catalog.tabs.parts")}</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto min-h-0 mt-4">
            <TabsContent value="issues" className="mt-0">
              <IssuesTab onReloadCatalog={onReloadCatalog} />
            </TabsContent>
            <TabsContent value="technicians" className="mt-0">
              <TechniciansTab onReloadCatalog={onReloadCatalog} />
            </TabsContent>
            <TabsContent value="categories" className="mt-0">
              <CategoriesTab onReloadCatalog={onReloadCatalog} />
            </TabsContent>
            <TabsContent value="parts" className="mt-0">
              <PartsTab onReloadCatalog={onReloadCatalog} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
