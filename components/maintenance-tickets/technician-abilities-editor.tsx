"use client";

import { useId, useMemo, useState } from "react";
import { Loader2, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import { useMaintenanceTicketsCatalogStore } from "@/lib/store/maintenance-tickets-catalog.store";
import type {
  CatalogTechnician,
  TechnicianRating,
  TechnicianRatingInput,
  TechnicianRatingSaved,
} from "@/types/maintenance-tickets.types";

const NOTES_MAX = 2000;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof MaintenanceTicketsError ? err.message : fallback;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Stars                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/** 1-5 stars, or none. Clicking the current star again clears it. */
function StarPicker({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value != null && n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            disabled={disabled}
            onClick={() => onChange(value === n ? null : n)}
            className="rounded p-0.5 transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Star className={cn("h-4 w-4", on ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50")} />
          </button>
        );
      })}
      <span className="ms-1 text-xs tabular-nums text-muted-foreground">
        {value == null ? "No stars" : `${value} of 5`}
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  One rating: stars, notes, call first                                      */
/* ────────────────────────────────────────────────────────────────────────── */

function RatingForm({
  title,
  initial,
  callFirstLabel,
  pinHolder,
  onSave,
  onRemove,
  onCancel,
}: {
  title: string;
  initial: TechnicianRating | null;
  callFirstLabel: string;
  /** Who holds this pin now, when it is someone else. */
  pinHolder: string | null;
  onSave: (input: TechnicianRatingInput) => Promise<void>;
  onRemove?: () => Promise<void>;
  onCancel?: () => void;
}) {
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [callFirst, setCallFirst] = useState(initial?.callFirst ?? false);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checkboxId = useId();

  const changed =
    rating !== (initial?.rating ?? null) ||
    notes.trim() !== (initial?.notes ?? "") ||
    callFirst !== (initial?.callFirst ?? false);

  async function save() {
    setBusy("save"); setError(null);
    try {
      await onSave({ rating, notes: notes.trim() || null, call_first: callFirst });
    } catch (err) {
      setError(errorMessage(err, "Could not save the rating."));
    } finally { setBusy(null); }
  }

  async function remove() {
    if (!onRemove) return;
    setBusy("remove"); setError(null);
    try {
      await onRemove();
    } catch (err) {
      setError(errorMessage(err, "Could not remove the rating."));
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <StarPicker value={rating} onChange={setRating} disabled={busy !== null} label={`Stars: ${title}`} />
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={NOTES_MAX}
        placeholder="Notes — what they are good or slow at, who to ask for…"
        className="min-h-14 resize-none text-sm"
        disabled={busy !== null}
      />
      <div className="flex items-start gap-2">
        <Checkbox
          id={checkboxId}
          checked={callFirst}
          onCheckedChange={(v) => setCallFirst(v === true)}
          disabled={busy !== null}
          className="mt-0.5"
        />
        <div className="space-y-0.5">
          <Label htmlFor={checkboxId} className="text-xs font-medium">{callFirstLabel}</Label>
          {pinHolder && !initial?.callFirst && (
            <p className="text-[11px] text-muted-foreground">
              Now: {pinHolder}.{callFirst ? " Saving moves it here." : ""}
            </p>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} disabled={busy !== null || !changed}>
          {busy === "save" && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
          Save
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy !== null}>Cancel</Button>
        )}
        {onRemove && initial && (
          <Button size="sm" variant="ghost" className="ms-auto text-destructive hover:text-destructive" onClick={remove} disabled={busy !== null}>
            {busy === "remove" ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="me-1.5 h-3.5 w-3.5" />}
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Summary line                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Everything rated about one technician, on one line under their name:
 * "Overall ★5 · Go-to · Oven ★4 call first · Sink ★2".
 */
export function TechnicianRatingSummary({ technician }: { technician: CatalogTechnician }) {
  const abilities = useMaintenanceTicketsCatalogStore((s) => s.abilities);
  const issues = useMaintenanceTicketsCatalogStore((s) => s.issues);

  const parts = useMemo(() => {
    const out: string[] = [];
    const overall = abilities.overall.find((r) => r.technicianId === technician.id);
    if (overall?.rating != null) out.push(`Overall ★${overall.rating}`);
    if (overall?.callFirst) out.push("Go-to");
    for (const entry of abilities.byIssue.filter((r) => r.technicianId === technician.id)) {
      const title = issues.find((i) => i.id === entry.issueId)?.title ?? `Issue #${entry.issueId}`;
      const bits = [title];
      if (entry.rating != null) bits.push(`★${entry.rating}`);
      if (entry.callFirst) bits.push("call first");
      out.push(bits.join(" "));
    }
    return out;
  }, [abilities, issues, technician.id]);

  if (parts.length === 0) return <span className="text-xs text-muted-foreground">Not rated yet</span>;
  return <span className="text-xs text-muted-foreground">{parts.join(" · ")}</span>;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Editor                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Rate one technician: overall, and on each catalog issue they handle. Every
 * rating saves on its own; ticking "call first" takes the pin from whoever
 * had it, and the toast says who that was.
 */
export function TechnicianAbilitiesEditor({ technician }: { technician: CatalogTechnician }) {
  const abilities = useMaintenanceTicketsCatalogStore((s) => s.abilities);
  const issues = useMaintenanceTicketsCatalogStore((s) => s.issues);
  const technicians = useMaintenanceTicketsCatalogStore((s) => s.technicians);
  const loadAbilities = useMaintenanceTicketsCatalogStore((s) => s.loadAbilities);
  const [addingIssueId, setAddingIssueId] = useState<string>("");

  const nameOf = (id: number) => technicians.find((t) => t.id === id)?.name ?? "another technician";

  const overall = abilities.overall.find((r) => r.technicianId === technician.id) ?? null;
  const goToHolder = abilities.overall.find((r) => r.callFirst && r.technicianId !== technician.id);

  const entries = abilities.byIssue
    .flatMap((entry) =>
      entry.technicianId === technician.id && entry.issueId != null
        ? [{ entry, issueId: entry.issueId, title: issues.find((i) => i.id === entry.issueId)?.title ?? `Issue #${entry.issueId}` }]
        : []
    )
    .sort((a, b) => a.title.localeCompare(b.title));

  const rated = new Set(entries.map((e) => e.issueId));
  const unrated = issues.filter((i) => !i.deletedAt && !rated.has(i.id)).sort((a, b) => a.title.localeCompare(b.title));
  const adding = unrated.find((i) => String(i.id) === addingIssueId) ?? null;

  function pinHolderFor(issueId: number): string | null {
    const holder = abilities.byIssue.find((r) => r.issueId === issueId && r.callFirst && r.technicianId !== technician.id);
    return holder ? nameOf(holder.technicianId) : null;
  }

  async function afterSave(saved: TechnicianRatingSaved, what: string) {
    await loadAbilities();
    if (saved.movedFrom) {
      toast.success(`Saved. ${technician.name} is now the one to call first ${what}, instead of ${saved.movedFrom.name}.`);
    } else {
      // An entry saved with nothing in it is removed by the server.
      toast.success(saved.rating ? "Rating saved." : "Rating cleared.");
    }
  }

  return (
    <div className="space-y-3">
      <RatingForm
        key={`overall:${overall?.updatedAt ?? "none"}`}
        title="Overall"
        initial={overall}
        callFirstLabel="Call first for anything (the go-to)"
        pinHolder={goToHolder ? nameOf(goToHolder.technicianId) : null}
        onSave={async (input) => afterSave(await maintenanceTicketsService.saveTechnicianRating(technician.id, input), "for anything")}
      />

      {entries.map(({ entry, issueId, title }) => (
        <RatingForm
          key={`${issueId}:${entry.updatedAt ?? ""}`}
          title={title}
          initial={entry}
          callFirstLabel={`Call first for ${title}`}
          pinHolder={pinHolderFor(issueId)}
          onSave={async (input) =>
            afterSave(await maintenanceTicketsService.saveTechnicianAbility(technician.id, issueId, input), `for ${title}`)
          }
          onRemove={async () => {
            await maintenanceTicketsService.removeTechnicianAbility(technician.id, issueId);
            await loadAbilities();
            toast.success(`Removed the ${title} rating.`);
          }}
        />
      ))}

      {unrated.length > 0 && (
        <div className="space-y-2">
          <Select value={addingIssueId} onValueChange={setAddingIssueId}>
            <SelectTrigger className="h-8 w-64 text-sm">
              <Plus className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <SelectValue placeholder="Rate on an issue…" />
            </SelectTrigger>
            <SelectContent position="popper" style={{ maxHeight: 240, overflowY: "auto" }}>
              {unrated.map((issue) => (
                <SelectItem key={issue.id} value={String(issue.id)}>{issue.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {adding && (
            <RatingForm
              key={`new:${adding.id}`}
              title={adding.title}
              initial={null}
              callFirstLabel={`Call first for ${adding.title}`}
              pinHolder={pinHolderFor(adding.id)}
              onSave={async (input) => {
                const saved = await maintenanceTicketsService.saveTechnicianAbility(technician.id, adding.id, input);
                setAddingIssueId("");
                await afterSave(saved, `for ${adding.title}`);
              }}
              onCancel={() => setAddingIssueId("")}
            />
          )}
        </div>
      )}
    </div>
  );
}
