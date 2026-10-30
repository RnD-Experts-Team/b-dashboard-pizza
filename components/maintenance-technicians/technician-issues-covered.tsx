"use client";

import { useMemo, useState } from "react";
import { Loader2, Pin, Plus, Trash2, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MaintenanceTicketsError } from "@/lib/api/maintenance-error";
import { maintenanceCatalogService } from "@/lib/hooks/use-maintenance-catalog";
import type { TechnicianAbilityInput, TechnicianCoveredIssue } from "@/types/maintenance-v2";
import { StarRatingInput } from "./star-rating";
import { useCatalogIssues } from "./use-catalog-issues";

const errorText = (err: unknown, fallback: string) => (err instanceof MaintenanceTicketsError ? err.message : fallback);

/**
 * Issues covered (docs/MAINTENANCE-V2-UI.md §7): each catalog issue the
 * technician can fix, with his ★ rating for it, the "call first" pin and
 * notes. Every change saves at once (PUT abilities/{issue}); "Add issue"
 * adds one unrated; the bin removes it. The average rating on the profile
 * is the server's average of these stars.
 */
export function TechnicianIssuesCovered({
  technicianId,
  issues,
  canEdit,
  onChanged,
}: {
  technicianId: number;
  issues: TechnicianCoveredIssue[];
  canEdit: boolean;
  /** After a save: the page reloads the technician (average rating, counts). */
  onChanged: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  const catalog = useCatalogIssues(canEdit);
  const [rows, setRows] = useState(issues);
  const [pending, setPending] = useState<number | null>(null);
  const [adding, setAdding] = useState("");
  // A reload of the technician brings the server's list back.
  const [source, setSource] = useState(issues);
  if (issues !== source) {
    setSource(issues);
    setRows(issues);
  }

  const covered = useMemo(() => new Set(rows.map((r) => r.issueId)), [rows]);
  const addable = catalog.issues.filter((i) => !covered.has(i.id));

  async function save(row: TechnicianCoveredIssue, patch: TechnicianAbilityInput) {
    const before = rows;
    setRows((prev) =>
      prev.map((r) =>
        r.issueId === row.issueId
          ? { ...r, ...("rating" in patch ? { rating: patch.rating ?? null } : {}), ...("callFirst" in patch ? { callFirst: Boolean(patch.callFirst) } : {}), ...("notes" in patch ? { notes: patch.notes ?? null } : {}) }
          : r,
      ),
    );
    setPending(row.issueId);
    try {
      await maintenanceCatalogService.saveAbility(technicianId, row.issueId, patch);
      toast.success(t("technicians.issueSaved", { issue: row.title }));
      onChanged();
    } catch (err) {
      setRows(before);
      toast.error(errorText(err, t("common.saveError")));
    } finally {
      setPending(null);
    }
  }

  async function add(issueId: string) {
    const issue = catalog.issues.find((i) => String(i.id) === issueId);
    if (!issue) return;
    setAdding(issueId);
    try {
      await maintenanceCatalogService.saveAbility(technicianId, issue.id, { rating: null, notes: null, callFirst: false });
      setRows((prev) => [...prev, { issueId: issue.id, title: issue.title, rating: null, notes: null, callFirst: false }].sort((a, b) => a.title.localeCompare(b.title)));
      toast.success(t("technicians.issueAdded", { issue: issue.title }));
      onChanged();
    } catch (err) {
      toast.error(errorText(err, t("common.saveError")));
    } finally {
      setAdding("");
    }
  }

  async function remove(row: TechnicianCoveredIssue) {
    setPending(row.issueId);
    try {
      await maintenanceCatalogService.removeAbility(technicianId, row.issueId);
      setRows((prev) => prev.filter((r) => r.issueId !== row.issueId));
      toast.success(t("technicians.issueRemoved", { issue: row.title }));
      onChanged();
    } catch (err) {
      toast.error(errorText(err, t("common.saveError")));
    } finally {
      setPending(null);
    }
  }

  return (
    <section aria-labelledby="issues-covered" className="rounded-xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/70">
            <Wrench className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div>
            <h2 id="issues-covered" className="font-heading text-base font-semibold">
              {t("technicians.issuesCovered")} <span className="text-sm font-normal text-muted-foreground tabular-nums">({rows.length})</span>
            </h2>
            <p className="text-sm text-muted-foreground">{t("technicians.issuesCoveredHelp")}</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Select value={adding} onValueChange={(v) => void add(v)} disabled={Boolean(adding) || addable.length === 0}>
              <SelectTrigger className="w-52" aria-label={t("technicians.addIssue")}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                <SelectValue placeholder={t("technicians.addIssue")} />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-72">
                {addable.map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
          <Wrench className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-sm text-sm text-muted-foreground">{canEdit ? t("technicians.noIssuesEditable") : t("technicians.noIssues")}</p>
        </div>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => (
            <IssueRow
              key={row.issueId}
              row={row}
              canEdit={canEdit}
              busy={pending === row.issueId}
              onSave={(patch) => void save(row, patch)}
              onRemove={() => void remove(row)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function IssueRow({
  row,
  canEdit,
  busy,
  onSave,
  onRemove,
}: {
  row: TechnicianCoveredIssue;
  canEdit: boolean;
  busy: boolean;
  onSave: (patch: TechnicianAbilityInput) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("maintenanceV2");
  const [notes, setNotes] = useState(row.notes ?? "");
  const [savedNotes, setSavedNotes] = useState(row.notes);
  if (row.notes !== savedNotes) {
    setSavedNotes(row.notes);
    setNotes(row.notes ?? "");
  }
  const notesId = `issue-notes-${row.issueId}`;
  const callFirstId = `issue-call-first-${row.issueId}`;
  const notesChanged = notes.trim() !== (row.notes ?? "").trim();

  return (
    <li className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-start">
      <div className="min-w-0 space-y-2">
        <p className="flex items-center gap-2 font-medium">
          {row.title}
          {row.callFirst && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              <Pin className="h-3 w-3" aria-hidden="true" />
              {t("technicians.standing.callFirst")}
            </span>
          )}
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label={t("common.saving")} />}
        </p>
        {canEdit ? (
          <div className="space-y-1">
            <label htmlFor={notesId} className="text-xs text-muted-foreground">{t("common.notes")}</label>
            <Textarea
              id={notesId}
              rows={1}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("technicians.issueNotesPlaceholder")}
              className="min-h-9 text-sm"
            />
            {notesChanged && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => onSave({ notes: notes.trim() || null })} disabled={busy}>{t("common.save")}</Button>
                <Button size="sm" variant="ghost" onClick={() => setNotes(row.notes ?? "")} disabled={busy}>{t("common.cancel")}</Button>
              </div>
            )}
          </div>
        ) : (
          row.notes && <p className="whitespace-pre-line text-sm text-muted-foreground">{row.notes}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <StarRatingInput
          value={row.rating}
          onChange={(rating) => onSave({ rating })}
          disabled={!canEdit || busy}
          label={t("technicians.ratingFor", { issue: row.title })}
        />
      </div>

      <div className="flex items-center gap-3 md:justify-end">
        <div className="flex items-center gap-2">
          <Switch
            id={callFirstId}
            checked={row.callFirst}
            onCheckedChange={(callFirst) => onSave({ callFirst })}
            disabled={!canEdit || busy}
          />
          <label htmlFor={callFirstId} className="text-sm">{t("technicians.standing.callFirst")}</label>
        </div>
        {canEdit && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            disabled={busy}
            aria-label={t("technicians.removeIssue", { issue: row.title })}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </li>
  );
}
