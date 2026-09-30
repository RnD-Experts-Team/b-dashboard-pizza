"use client";

import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Layers, Pencil, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { toolboxTicketsService } from "@/lib/api/services/toolbox-tickets.service";
import { parseTicketError } from "@/lib/toolbox-tickets/errors";
import { useAdminSections } from "@/lib/hooks/use-toolbox-tickets-admin";
import { TicketsEmptyState, TicketsErrorState, TicketsListSkeleton } from "../tickets-states";
import { CatalogFormDialog, type CatalogFormValues } from "./catalog-form-dialog";
import { ConfirmDialog } from "./confirm-dialog";
import type { TicketSection } from "@/types/toolbox-tickets.types";

type StatusFilter = "all" | "active" | "retired";

/**
 * Only what the admin actually changed. A cleared description is sent as
 * null (that's how it's cleared); a cleared order is left alone.
 */
export function changedFields(
  v: CatalogFormValues,
  was: { name: string; description: string | null; displayOrder: number },
) {
  const out: { name?: string; description?: string | null; displayOrder?: number } = {};
  if (v.name !== was.name) out.name = v.name;
  if (v.description !== (was.description ?? "")) out.description = v.description || null;
  if (v.displayOrder && Number(v.displayOrder) !== was.displayOrder) out.displayOrder = Number(v.displayOrder);
  return out;
}

/**
 * Sections are the contract with the dashboard: every page that raises a
 * ticket hardcodes a section KEY. Keys are immutable; retiring a section makes
 * every page still posting its key fail with TICKET_SECTION_INACTIVE.
 */
export function SectionsPanel({ onChanged }: { onChanged: () => void }) {
  const t = useTranslations("toolboxTickets.admin.sections");
  const { data, loading, error, reload } = useAdminSections();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<TicketSection | null>(null);
  const [creating, setCreating] = useState(false);
  const [retiring, setRetiring] = useState<TicketSection | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? [])
      .filter((s) => (status === "all" ? true : status === "active" ? s.active : !s.active))
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.key.includes(q))
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  }, [data, query, status]);

  const after = async (msg: string) => {
    toast.success(msg);
    await reload();
    onChanged();
  };
  const fail = (err: unknown) => {
    toast.error(parseTicketError(err, "admin").message);
    throw err;
  };

  const save = async (v: CatalogFormValues) => {
    if (editing) {
      await toolboxTicketsService.updateSection(editing.id, changedFields(v, editing));
    } else {
      await toolboxTicketsService.createSection({
        key: v.key,
        name: v.name,
        description: v.description || undefined,
        displayOrder: v.displayOrder ? Number(v.displayOrder) : undefined,
      });
    }
    await after(editing ? t("saved") : t("created"));
  };

  const restore = async (s: TicketSection) => {
    try {
      await toolboxTicketsService.updateSection(s.id, { active: true });
      await after(t("restored"));
    } catch (err) {
      toast.error(parseTicketError(err, "admin").message);
    }
  };

  if (error) return <TicketsErrorState error={error} onRetry={() => void reload()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} className="h-9 ps-8" />
        </div>
        <div className="flex gap-2">
          <div className="w-36">
            <SearchableSelect<StatusFilter>
              options={[
                { value: "all", label: t("filterAll") },
                { value: "active", label: t("filterActive") },
                { value: "retired", label: t("filterRetired") },
              ]}
              value={status}
              onChange={setStatus}
            />
          </div>
          <Button size="sm" className="h-9" onClick={() => setCreating(true)}>
            <Plus className="me-1 h-4 w-4" />
            {t("new")}
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <TicketsListSkeleton />
      ) : rows.length === 0 ? (
        <TicketsEmptyState
          icon={Layers}
          title={data?.length ? t("noMatches") : t("empty")}
          body={data?.length ? undefined : t("emptyBody")}
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {rows.map((s) => (
            <li key={s.id} className={cn("flex flex-col gap-2 p-3 sm:flex-row sm:items-center", !s.active && "bg-muted/30")}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("font-medium", !s.active && "text-muted-foreground line-through")}>{s.name}</span>
                  {!s.active && (
                    <Badge variant="outline" className="text-[10px]">
                      {t("retired")}
                    </Badge>
                  )}
                </div>
                <code className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground" dir="ltr">
                  {s.key}
                </code>
                {s.levels.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.levels.map((l) => (
                      <Badge key={l.id} variant="secondary" className="text-[10px]">
                        {l.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(s)}>
                  <Pencil className="me-1 h-3.5 w-3.5" />
                  {t("edit")}
                </Button>
                {s.active ? (
                  <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={() => setRetiring(s)}>
                    <Archive className="me-1 h-3.5 w-3.5" />
                    {t("retire")}
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => void restore(s)}>
                    <ArchiveRestore className="me-1 h-3.5 w-3.5" />
                    {t("restore")}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <CatalogFormDialog
        open={creating || editing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
          }
        }}
        kind="section"
        initial={
          editing
            ? {
                id: editing.id,
                key: editing.key,
                name: editing.name,
                description: editing.description ?? "",
                displayOrder: String(editing.displayOrder ?? ""),
                parentId: "",
              }
            : null
        }
        onSubmit={save}
        onError={() => undefined}
      />

      <ConfirmDialog
        open={retiring !== null}
        onOpenChange={(o) => !o && setRetiring(null)}
        title={t("retireTitle", { name: retiring?.name ?? "" })}
        description={t("retireDescription")}
        confirmLabel={t("retire")}
        destructive
        onConfirm={async () => {
          if (!retiring) return;
          try {
            await toolboxTicketsService.retireSection(retiring.id);
          } catch (err) {
            fail(err);
          }
          await after(t("retiredToast"));
        }}
      >
        <p className="text-xs text-muted-foreground">
          {t("retireWarning", { key: retiring?.key ?? "" })}
        </p>
      </ConfirmDialog>
    </div>
  );
}
