"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, RotateCcw, Loader2, AlertCircle, Pencil, Phone, LifeBuoy, Star } from "lucide-react";
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
  TroubleshootingGuide,
} from "@/types/maintenance-tickets.types";
import { EntityNotesAttachments } from "./entity-extras";
import { GuideEditor } from "./troubleshooting/guide-editor";
import { TechnicianAbilitiesEditor, TechnicianRatingSummary } from "./technician-abilities-editor";
import { useAuth } from "@/lib/auth/use-auth";

/** The Select's "no category" option. Never sent upstream -- it maps to null. */
const NO_CATEGORY = "none";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof MaintenanceTicketsError ? err.message : fallback;
}

/**
 * The category Select's value, converted for the API. "none" (and "") mean
 * no category -- they used to reach the API as Number("none"), i.e. NaN.
 */
function categoryIdFromSelect(value: string): number | null {
  if (!value || value === NO_CATEGORY) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Reusable item row                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

interface ItemRowProps {
  name: string;
  secondary?: ReactNode;
  isDeleted: boolean;
  onDelete: () => void;
  onRestore?: () => void;
  /** Opens the inline editor. Omitted for deleted rows. */
  onEdit?: () => void;
  isEditing?: boolean;
  isActing: boolean;
  /** The inline edit form, rendered under the row while editing. */
  editor?: ReactNode;
  /** Optional content rendered below the row (e.g. notes & attachments). */
  extra?: ReactNode;
}

function ItemRow({ name, secondary, isDeleted, onDelete, onRestore, onEdit, isEditing, isActing, editor, extra }: ItemRowProps) {
  const t = useTranslations("maintenanceTickets");

  return (
    <div className={cn(
      "rounded-md transition-colors",
      isDeleted ? "bg-muted/40 opacity-60" : "bg-muted/20 hover:bg-muted/40",
      isEditing && "ring-1 ring-primary/40",
    )}>
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium truncate", isDeleted && "line-through text-muted-foreground")}>
            {name}
          </p>
          {secondary && <div className="text-xs text-muted-foreground truncate">{secondary}</div>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isDeleted && (
            <Badge variant="secondary" className="text-xs h-5">deleted</Badge>
          )}
          {!isDeleted && onEdit && (
            <Button
              variant={isEditing ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onEdit}
              disabled={isActing}
            >
              <Pencil className="me-1 h-3 w-3" />
              {isEditing ? t("catalog.editing") : t("catalog.edit")}
            </Button>
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
      {isEditing && editor && <div className="px-3 pb-3">{editor}</div>}
      {extra && <div className="px-3 pb-2">{extra}</div>}
    </div>
  );
}

/** Save / Cancel row shared by every inline editor. */
function EditorActions({
  onSave,
  onCancel,
  isSaving,
  canSave,
}: {
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  canSave: boolean;
}) {
  const t = useTranslations("maintenanceTickets");
  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={onSave} disabled={isSaving || !canSave}>
        {isSaving && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
        {t("catalog.save")}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel} disabled={isSaving}>
        {t("catalog.cancel")}
      </Button>
    </div>
  );
}

/** Name + description editor used by issues, categories and parts. */
function TextItemEditor({
  initialName,
  initialDescription,
  nameLabel,
  onSave,
  onCancel,
}: {
  initialName: string;
  initialDescription: string | null;
  nameLabel: string;
  onSave: (name: string, description: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations("maintenanceTickets");
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setIsSaving(true); setError(null);
    try {
      await onSave(name.trim(), description.trim() || null);
    } catch (err) {
      setError(errorMessage(err, t("catalog.saveFailed")));
    } finally { setIsSaving(false); }
  }

  return (
    <div className="space-y-2 rounded-md border bg-background p-3">
      <div className="space-y-1">
        <Label className="text-xs">{nameLabel}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t("catalog.descriptionLabel")}</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm min-h-16" />
      </div>
      {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{error}</p>}
      <EditorActions onSave={save} onCancel={onCancel} isSaving={isSaving} canSave={!!name.trim()} />
    </div>
  );
}

/** Patch one item in a list in place, keeping its position. */
function replaceItem<T extends { id: number }>(items: T[], updated: T): T[] {
  return items.map((i) => (i.id === updated.id ? updated : i));
}

/**
 * An issue's troubleshooting guide, from the catalog: a line saying whether it
 * has one, and the editor right under it when opened.
 */
function TroubleshootingToggle({
  issue,
  onChange,
}: {
  issue: CatalogIssue;
  onChange: (guide: TroubleshootingGuide | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const guide = issue.troubleshooting ?? null;

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpen((v) => !v)}>
        <LifeBuoy className="me-1 h-3.5 w-3.5" />
        {guide
          ? `Troubleshooting: ${guide.steps.length} step${guide.steps.length === 1 ? "" : "s"} (v${guide.version})`
          : "Add troubleshooting steps"}
      </Button>
      {open && (
        <GuideEditor
          issueId={issue.id}
          issueTitle={issue.title}
          guide={guide}
          onSaved={(saved) => onChange(saved)}
          onRemoved={() => { onChange(null); setOpen(false); }}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Issues tab                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

function IssuesTab({ onReloadCatalog, storeId }: { onReloadCatalog: () => void; storeId?: string }) {
  const t = useTranslations("maintenanceTickets");
  const [items, setItems] = useState<CatalogIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  /** quiet = refresh in place, no skeleton (after adding a note, say). */
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    setError(null);
    try {
      // includeDeleted: without it "Show Deleted" could never show anything.
      setItems(await maintenanceTicketsService.getCatalogIssues(undefined, storeId, { includeDeleted: true }));
    } catch (err) {
      setError(errorMessage(err, "Failed to load"));
    } finally { if (!quiet) setIsLoading(false); }
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!title.trim()) return;
    setIsCreating(true);
    try {
      await maintenanceTicketsService.createCatalogIssue({ title: title.trim(), description: description.trim() || undefined }, storeId);
      setTitle(""); setDescription("");
      await load();
      onReloadCatalog();
    } catch (err) {
      setError(errorMessage(err, "Failed to create"));
    } finally { setIsCreating(false); }
  }

  async function handleDelete(id: number) {
    setActingId(id);
    try {
      await maintenanceTicketsService.deleteCatalogIssue(id);
      await load(); onReloadCatalog();
    } catch (err) {
      setError(errorMessage(err, "Failed to delete"));
    } finally { setActingId(null); }
  }

  async function handleRestore(id: number) {
    setActingId(id);
    try {
      await maintenanceTicketsService.restoreCatalogIssue(id);
      await load(); onReloadCatalog();
    } catch (err) {
      setError(errorMessage(err, "Failed to restore"));
    } finally { setActingId(null); }
  }

  async function handleSave(id: number, name: string, desc: string | null) {
    const updated = await maintenanceTicketsService.updateCatalogIssue(id, { title: name, description: desc });
    setItems((prev) => replaceItem(prev, updated));
    setEditingId(null);
    onReloadCatalog();
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

      <div className="space-y-1 max-h-96 overflow-y-auto">
        {visible.map(item => (
          <ItemRow
            key={item.id}
            name={item.title}
            secondary={item.description ?? undefined}
            isDeleted={!!item.deletedAt}
            onDelete={() => handleDelete(item.id)}
            onRestore={() => handleRestore(item.id)}
            onEdit={() => setEditingId((cur) => (cur === item.id ? null : item.id))}
            isEditing={editingId === item.id}
            isActing={actingId === item.id}
            editor={
              <TextItemEditor
                initialName={item.title}
                initialDescription={item.description}
                nameLabel={t("catalog.titleLabel")}
                onSave={(name, desc) => handleSave(item.id, name, desc)}
                onCancel={() => setEditingId(null)}
              />
            }
            extra={!item.deletedAt && (
              <div className="space-y-2">
              <TroubleshootingToggle
                issue={item}
                onChange={(guide) => {
                  setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, troubleshooting: guide } : i)));
                  onReloadCatalog();
                }}
              />
              <EntityNotesAttachments
                entityPath={entityPaths.catalogIssue(item.id)}
                notes={item.notes}
                attachments={item.attachments}
                onSuccess={() => { void load(true); }}
                onNoteAdded={(note: TicketNote) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, notes: [...(i.notes ?? []), note] } : i))}
                onAttachmentsAdded={(atts: TicketAttachment[]) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, attachments: [...(i.attachments ?? []), ...atts] } : i))}
                allowNoteType
              />
              </div>
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

/** Name, phone and trade category: everything about a technician that can change. */
function TechnicianEditor({
  technician,
  categories,
  onSave,
  onCancel,
}: {
  technician: CatalogTechnician;
  categories: CatalogCategory[];
  onSave: (payload: { name: string; phone: string | null; category_id: number | null }) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations("maintenanceTickets");
  const [name, setName] = useState(technician.name);
  const [phone, setPhone] = useState(technician.phone ?? "");
  const [categoryId, setCategoryId] = useState<string>(technician.categoryId ? String(technician.categoryId) : NO_CATEGORY);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setIsSaving(true); setError(null);
    try {
      await onSave({ name: name.trim(), phone: phone.trim() || null, category_id: categoryIdFromSelect(categoryId) });
    } catch (err) {
      setError(errorMessage(err, t("catalog.saveFailed")));
    } finally { setIsSaving(false); }
  }

  return (
    <div className="space-y-2 rounded-md border bg-background p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">{t("catalog.nameLabel")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("catalog.phoneLabel")}</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("catalog.phonePlaceholder")}
            inputMode="tel"
            className="text-sm"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t("catalog.categoryLabel")}</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="text-sm"><SelectValue placeholder={t("catalog.categoryPlaceholder")} /></SelectTrigger>
          <SelectContent position="popper" style={{ maxHeight: 240, overflowY: "auto" }}>
            <SelectItem value={NO_CATEGORY}>{t("catalog.noCategory")}</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{error}</p>}
      <EditorActions onSave={save} onCancel={onCancel} isSaving={isSaving} canSave={!!name.trim()} />
    </div>
  );
}

/** "Refrigeration · ☎ +1 234 567 8900" -- category and phone together, phone dialable. */
function TechnicianSecondary({ technician }: { technician: CatalogTechnician }) {
  const t = useTranslations("maintenanceTickets");
  if (!technician.categoryName && !technician.phone) return null;

  return (
    <span className="flex items-center gap-1.5 truncate">
      {technician.categoryName && <span className="truncate">{technician.categoryName}</span>}
      {technician.categoryName && technician.phone && <span aria-hidden="true">·</span>}
      {technician.phone && (
        <a
          href={`tel:${technician.phone.replace(/[^0-9+]/g, "")}`}
          className="inline-flex items-center gap-1 text-foreground/80 hover:text-foreground hover:underline"
          title={`${t("catalog.callTechnician")} ${technician.phone}`}
        >
          <Phone className="h-3 w-3" aria-hidden="true" />
          <span className="tabular-nums">{technician.phone}</span>
        </a>
      )}
    </span>
  );
}

/**
 * A technician's ratings, from the catalog: everything rated about them on one
 * line, and the editor right under it when opened. Shown only to people who
 * may read ratings -- for anyone else the line would wrongly say "not rated".
 */
function TechnicianRatingsToggle({ technician, canEdit }: { technician: CatalogTechnician; canEdit: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpen((v) => !v)}>
            <Star className="me-1 h-3.5 w-3.5" />
            {open ? "Close ratings" : "Rate"}
          </Button>
        )}
        <TechnicianRatingSummary technician={technician} />
      </div>
      {open && <TechnicianAbilitiesEditor technician={technician} />}
    </div>
  );
}

function TechniciansTab({ onReloadCatalog }: { onReloadCatalog: () => void }) {
  const t = useTranslations("maintenanceTickets");
  const { canAccessRoute } = useAuth();
  const canReadRatings = canAccessRoute({ service: "Maintenance", method: "GET", path: "/technician-abilities" });
  const canRate = canAccessRoute({ service: "Maintenance", method: "PATCH", path: "/technicians/placeholder/rating" });
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
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    setError(null);
    try {
      const [techs, cats] = await Promise.all([
        maintenanceTicketsService.getCatalogTechnicians(undefined, { includeDeleted: true }),
        maintenanceTicketsService.getCatalogCategories(),
      ]);
      setItems(techs); setCategories(cats);
    } catch (err) {
      setError(errorMessage(err, "Failed to load"));
    } finally { if (!quiet) setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      const category = categoryIdFromSelect(categoryId);
      await maintenanceTicketsService.createCatalogTechnician({
        name: name.trim(),
        phone: phone.trim() || undefined,
        ...(category !== null ? { category_id: category } : {}),
      });
      setName(""); setPhone(""); setCategoryId("");
      await load(); onReloadCatalog();
    } catch (err) {
      setError(errorMessage(err, "Failed to create"));
    } finally { setIsCreating(false); }
  }

  async function handleDelete(id: number) {
    setActingId(id);
    try { await maintenanceTicketsService.deleteCatalogTechnician(id); await load(); onReloadCatalog(); }
    catch (err) { setError(errorMessage(err, "Failed")); }
    finally { setActingId(null); }
  }

  async function handleRestore(id: number) {
    setActingId(id);
    try { await maintenanceTicketsService.restoreCatalogTechnician(id); await load(); onReloadCatalog(); }
    catch (err) { setError(errorMessage(err, "Failed")); }
    finally { setActingId(null); }
  }

  async function handleSave(id: number, payload: { name: string; phone: string | null; category_id: number | null }) {
    const updated = await maintenanceTicketsService.updateCatalogTechnician(id, payload);
    setItems((prev) => replaceItem(prev, updated));
    setEditingId(null);
    onReloadCatalog();
  }

  const visible = showDeleted ? items : items.filter(i => !i.deletedAt);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("catalog.addTechnician")}</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("catalog.namePlaceholder")} className="text-sm" />
        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t("catalog.phonePlaceholder")} inputMode="tel" className="text-sm" />
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="text-sm"><SelectValue placeholder={t("catalog.categoryPlaceholder")} /></SelectTrigger>
          <SelectContent position="popper" style={{ maxHeight: 240, overflowY: "auto" }}>
            <SelectItem value={NO_CATEGORY}>{t("catalog.noCategory")}</SelectItem>
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

      <div className="space-y-1 max-h-96 overflow-y-auto">
        {visible.map(item => (
          <ItemRow
            key={item.id}
            name={item.name}
            secondary={<TechnicianSecondary technician={item} />}
            isDeleted={!!item.deletedAt}
            onDelete={() => handleDelete(item.id)}
            onRestore={() => handleRestore(item.id)}
            onEdit={() => setEditingId((cur) => (cur === item.id ? null : item.id))}
            isEditing={editingId === item.id}
            isActing={actingId === item.id}
            editor={
              <TechnicianEditor
                technician={item}
                categories={categories}
                onSave={(payload) => handleSave(item.id, payload)}
                onCancel={() => setEditingId(null)}
              />
            }
            extra={!item.deletedAt && (
              <div className="space-y-2">
                {canReadRatings && <TechnicianRatingsToggle technician={item} canEdit={canRate} />}
                <EntityNotesAttachments
                  entityPath={entityPaths.technician(item.id)}
                  notes={item.notes}
                  attachments={item.attachments}
                  onSuccess={() => { void load(true); }}
                  onNoteAdded={(note: TicketNote) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, notes: [...(i.notes ?? []), note] } : i))}
                  onAttachmentsAdded={(atts: TicketAttachment[]) => setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, attachments: [...(i.attachments ?? []), ...atts] } : i))}
                  allowNoteType
                />
              </div>
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
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    setError(null);
    try { setItems(await maintenanceTicketsService.getCatalogCategories()); }
    catch (err) { setError(errorMessage(err, "Failed to load")); }
    finally { if (!quiet) setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      await maintenanceTicketsService.createCatalogCategory({ name: name.trim(), description: description.trim() || undefined });
      setName(""); setDescription(""); await load(); onReloadCatalog();
    } catch (err) { setError(errorMessage(err, "Failed")); }
    finally { setIsCreating(false); }
  }

  async function handleDelete(id: number) {
    setActingId(id);
    try { await maintenanceTicketsService.deleteCatalogCategory(id); await load(); onReloadCatalog(); }
    catch (err) { setError(errorMessage(err, "Failed")); }
    finally { setActingId(null); }
  }

  async function handleSave(id: number, newName: string, desc: string | null) {
    const updated = await maintenanceTicketsService.updateCatalogCategory(id, { name: newName, description: desc });
    setItems((prev) => replaceItem(prev, updated));
    setEditingId(null);
    onReloadCatalog();
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
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {items.map(item => (
          <ItemRow
            key={item.id}
            name={item.name}
            secondary={item.description ?? undefined}
            isDeleted={false}
            onDelete={() => handleDelete(item.id)}
            onEdit={() => setEditingId((cur) => (cur === item.id ? null : item.id))}
            isEditing={editingId === item.id}
            isActing={actingId === item.id}
            editor={
              <TextItemEditor
                initialName={item.name}
                initialDescription={item.description}
                nameLabel={t("catalog.nameLabel")}
                onSave={(newName, desc) => handleSave(item.id, newName, desc)}
                onCancel={() => setEditingId(null)}
              />
            }
            extra={
              <EntityNotesAttachments
                entityPath={entityPaths.category(item.id)}
                notes={item.notes}
                attachments={item.attachments}
                onSuccess={() => { void load(true); }}
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
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    setError(null);
    try { setItems(await maintenanceTicketsService.getCatalogParts(undefined, { includeDeleted: true })); }
    catch (err) { setError(errorMessage(err, "Failed to load")); }
    finally { if (!quiet) setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      await maintenanceTicketsService.createCatalogPart({ name: name.trim(), description: description.trim() || undefined });
      setName(""); setDescription(""); await load(); onReloadCatalog();
    } catch (err) { setError(errorMessage(err, "Failed")); }
    finally { setIsCreating(false); }
  }

  async function handleDelete(id: number) {
    setActingId(id);
    try { await maintenanceTicketsService.deleteCatalogPart(id); await load(); onReloadCatalog(); }
    catch (err) { setError(errorMessage(err, "Failed")); }
    finally { setActingId(null); }
  }

  async function handleRestore(id: number) {
    setActingId(id);
    try { await maintenanceTicketsService.restoreCatalogPart(id); await load(); onReloadCatalog(); }
    catch (err) { setError(errorMessage(err, "Failed")); }
    finally { setActingId(null); }
  }

  async function handleSave(id: number, newName: string, desc: string | null) {
    const updated = await maintenanceTicketsService.updateCatalogPart(id, { name: newName, description: desc });
    setItems((prev) => replaceItem(prev, updated));
    setEditingId(null);
    onReloadCatalog();
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
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {visible.map(item => (
          <ItemRow
            key={item.id}
            name={item.name}
            secondary={item.description ?? undefined}
            isDeleted={!!item.deletedAt}
            onDelete={() => handleDelete(item.id)}
            onRestore={() => handleRestore(item.id)}
            onEdit={() => setEditingId((cur) => (cur === item.id ? null : item.id))}
            isEditing={editingId === item.id}
            isActing={actingId === item.id}
            editor={
              <TextItemEditor
                initialName={item.name}
                initialDescription={item.description}
                nameLabel={t("catalog.nameLabel")}
                onSave={(newName, desc) => handleSave(item.id, newName, desc)}
                onCancel={() => setEditingId(null)}
              />
            }
            extra={!item.deletedAt && (
              <EntityNotesAttachments
                entityPath={entityPaths.part(item.id)}
                notes={item.notes}
                attachments={item.attachments}
                onSuccess={() => { void load(true); }}
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
  /** Active store id forwarded as X-Store-Id on catalog/issues requests. */
  storeId?: string;
}

export function CatalogManagementDialog({ open, onClose, onReloadCatalog, storeId }: CatalogManagementDialogProps) {
  const t = useTranslations("maintenanceTickets");

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="w-[95vw] max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
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
              <IssuesTab onReloadCatalog={onReloadCatalog} storeId={storeId} />
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
