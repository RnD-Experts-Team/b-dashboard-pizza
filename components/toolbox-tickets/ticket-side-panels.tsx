"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Route, Trash2, UserPlus, Users } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { toolboxTicketsService } from "@/lib/api/services/toolbox-tickets.service";
import { formErrors, parseTicketError } from "@/lib/toolbox-tickets/errors";
import { useTicketRecipients } from "@/lib/hooks/use-toolbox-ticket";
import { flattenLevels } from "@/lib/toolbox-tickets/level-tree";
import { useRoleLabel, useRoleOptions } from "./participant-role";
import { TicketUserPicker, type PickedUser } from "./user-picker";
import { TicketsInlineError } from "./tickets-states";
import type { ToolboxTicketActions } from "@/lib/hooks/use-toolbox-ticket";
import type { ParticipantRole, ToolboxTicket } from "@/types/toolbox-tickets.types";

function Panel({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof Users;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <header className="flex items-center gap-2 border-b px-4 py-2.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="flex-1 font-heading text-sm font-semibold">{title}</h3>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

/* ── Details ─────────────────────────────────────────────────────────────── */

export function TicketDetailsPanel({ ticket }: { ticket: ToolboxTicket }) {
  const t = useTranslations("toolboxTickets.details");
  const format = useFormatter();
  const when = (v: string | null) =>
    v ? format.dateTime(new Date(v), { dateStyle: "medium", timeStyle: "short" }) : null;

  const rows: [string, React.ReactNode][] = [
    [t("store"), ticket.store ? `${ticket.store.name ?? ""} (${ticket.store.storeNumber})`.trim() : "—"],
    [t("section"), ticket.section?.name ?? "—"],
    [t("reporter"), ticket.reporter?.name ?? "—"],
    [t("created"), when(ticket.createdAt) ?? "—"],
    [t("firstResponse"), when(ticket.firstRespondedAt) ?? t("none")],
    [t("lastActivity"), when(ticket.lastActivityAt) ?? "—"],
  ];
  if (ticket.fixedAt) rows.push([t("fixed"), when(ticket.fixedAt)]);
  if (ticket.closedAt) rows.push([t("closed"), when(ticket.closedAt)]);
  if (ticket.reopenedAt) rows.push([t("reopened"), when(ticket.reopenedAt)]);

  return (
    <Panel icon={Route} title={t("title")}>
      <dl className="space-y-2 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/* ── Participants ────────────────────────────────────────────────────────── */

interface ParticipantsPanelProps {
  ticket: ToolboxTicket;
  actions: ToolboxTicketActions;
  onError: (err: unknown) => void;
}

/**
 * Re-adding changes the role rather than stacking (there's no update
 * endpoint). The reporter can't be added (422 REDUNDANT) so they're filtered
 * out of the picker. Removal is silent upstream — the hook refetches.
 */
export function ParticipantsPanel({ ticket, actions, onError }: ParticipantsPanelProps) {
  const t = useTranslations("toolboxTickets.participants");
  const roleOptions = useRoleOptions();
  const roleLabel = useRoleLabel();
  const canManage = Boolean(ticket.viewer?.can.manageParticipants);

  const [adding, setAdding] = useState(false);
  const [user, setUser] = useState<PickedUser | null>(null);
  const [role, setRole] = useState<ParticipantRole>("responder");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const exclude = [
    ...(ticket.reporter ? [ticket.reporter.id] : []),
    ...ticket.participants.map((p) => p.user.id),
  ];

  const add = async () => {
    if (!user) return;
    setBusyId(-1);
    setError(null);
    try {
      await actions.addParticipant(user.id, role);
      toast.success(t("added"));
      setUser(null);
      setAdding(false);
    } catch (err) {
      const parsed = parseTicketError(err);
      const fe = formErrors(parsed);
      if (fe.user_id || fe.role) setError(fe.user_id ?? fe.role);
      else onError(parsed);
    } finally {
      setBusyId(null);
    }
  };

  const changeRole = async (userId: number, next: ParticipantRole) => {
    setBusyId(userId);
    try {
      await actions.addParticipant(userId, next);
      toast.success(t("roleChanged"));
    } catch (err) {
      onError(err);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (userId: number) => {
    setBusyId(userId);
    try {
      await actions.removeParticipant(userId);
      toast.success(t("removed"));
    } catch (err) {
      onError(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Panel
      icon={Users}
      title={t("title")}
      action={
        canManage && !adding ? (
          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => setAdding(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            {t("add")}
          </Button>
        ) : null
      }
    >
      <div className="space-y-3">
        {adding && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
            <TicketUserPicker value={user} onChange={setUser} excludeIds={exclude} disabled={busyId === -1} />
            <SearchableSelect<ParticipantRole>
              options={roleOptions}
              value={role}
              onChange={setRole}
              disabled={busyId === -1}
            />
            {error && <p className="text-[11px] text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" disabled={busyId === -1} onClick={() => setAdding(false)}>
                {t("cancel")}
              </Button>
              <Button size="sm" disabled={!user || busyId === -1} onClick={() => void add()}>
                {busyId === -1 && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
                {t("addConfirm")}
              </Button>
            </div>
          </div>
        )}

        <ul className="space-y-2">
          {ticket.reporter && (
            <li className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate font-medium">{ticket.reporter.name}</span>
              <Badge variant="outline" className="text-[10px]">
                {t("reporter")}
              </Badge>
            </li>
          )}
          {ticket.participants.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate font-medium">{p.user.name ?? t("userId", { id: p.user.id })}</span>
              {canManage ? (
                <div className="w-32 shrink-0">
                  <SearchableSelect<ParticipantRole>
                    options={roleOptions}
                    value={p.role}
                    onChange={(next) => next !== p.role && void changeRole(p.user.id, next)}
                    disabled={busyId !== null}
                    className="h-7 text-xs"
                  />
                </div>
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  {roleLabel(p.role, p.roleLabel)}
                </Badge>
              )}
              {canManage && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  disabled={busyId !== null}
                  aria-label={t("remove")}
                  onClick={() => void remove(p.user.id)}
                >
                  {busyId === p.user.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </li>
          ))}
        </ul>
        {ticket.participants.length === 0 && <p className="text-xs text-muted-foreground">{t("none")}</p>}
      </div>
    </Panel>
  );
}

/* ── Routing (debug) ─────────────────────────────────────────────────────── */

/**
 * `candidates` = everyone the section reaches BEFORE the store filter;
 * `user_ids` = who actually receives. The gap is the answer to "why didn't
 * X get it?" — assigned to the area, but doesn't hold this store.
 * Names come from the assignments list when this account may read it.
 */
export function RoutingPanel({ ticket }: { ticket: ToolboxTicket }) {
  const t = useTranslations("toolboxTickets.routing");
  const [open, setOpen] = useState(false);
  const storeCode = ticket.store?.storeNumber ?? null;
  const { data, loading, error, reload } = useTicketRecipients(storeCode, ticket.id, open);
  const [names, setNames] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    if (!data?.candidates.length) return;
    let cancelled = false;
    toolboxTicketsService
      .listAssignments({ userIds: data.candidates.map((c) => c.userId), perPage: 200 })
      .then((page) => {
        if (cancelled) return;
        const map = new Map<number, string>();
        page.items.forEach((a) => a.user?.name && map.set(a.user.id, a.user.name));
        setNames(map);
      })
      .catch(() => {
        /* No admin rights — ids only. */
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  // Level names for "via level:7" — readable only with admin rights; ids otherwise.
  const [levelNames, setLevelNames] = useState<Map<number, string>>(new Map());
  const needsLevels = Boolean(data?.candidates.some((c) => c.via.startsWith("level:")));
  useEffect(() => {
    if (!needsLevels) return;
    let cancelled = false;
    toolboxTicketsService
      .listLevels()
      .then((tree) => !cancelled && setLevelNames(new Map(flattenLevels(tree).map((f) => [f.level.id, f.path]))))
      .catch(() => {
        /* No admin rights — ids only. */
      });
    return () => {
      cancelled = true;
    };
  }, [needsLevels]);

  const receiving = new Set(data?.userIds ?? []);
  const via = (v: string) => {
    if (!v.startsWith("level:")) return t("viaSection");
    const id = Number(v.slice(6));
    const name = levelNames.get(id);
    return name ? t("viaLevelNamed", { name }) : t("viaLevel", { id });
  };

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-start"
      >
        <Route className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="flex-1 font-heading text-sm font-semibold">{t("title")}</h3>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-3 border-t p-4">
          <p className="text-[11px] text-muted-foreground">{t("explain")}</p>
          {loading && !data ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <TicketsInlineError error={error} onRetry={() => void reload()} />
          ) : data && data.candidates.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
              {t("nobody")}
            </p>
          ) : data ? (
            <>
              <p className="text-xs font-medium tabular-nums">
                {t("summary", { receiving: data.userIds.length, candidates: data.candidates.length })}
              </p>
              <ul className="max-h-60 space-y-1.5 overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
                {data.candidates.map((c) => {
                  const gets = receiving.has(c.userId);
                  return (
                    <li key={`${c.userId}-${c.via}`} className="rounded-md border px-2 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn("h-2 w-2 shrink-0 rounded-full", gets ? "bg-emerald-500" : "bg-muted-foreground/40")}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {names.get(c.userId) ?? t("userId", { id: c.userId })}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{via(c.via)}</span>
                      </div>
                      <p className={cn("mt-0.5 ps-4 text-[11px]", gets ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300")}>
                        {gets ? (c.storeScoped ? t("receivesScoped") : t("receivesAll")) : t("notHoldingStore")}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
