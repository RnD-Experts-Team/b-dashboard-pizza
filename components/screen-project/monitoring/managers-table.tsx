"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Pager, ReportTable, TD, TH, usePaged } from "@/components/maintenance-tickets/analytics/analytics-sections";
import { formatDuration, percent, share } from "@/lib/screen-usage/format";
import type { UsageUserRow } from "@/lib/screen-usage/types";

type SortKey =
  | "name" | "on_screen" | "present" | "present_share" | "away" | "no_face" | "covered" | "mic_open"
  | "talking" | "talk_share" | "dead_mic" | "talk_all" | "pip" | "kicks" | "last_seen" | "target_share";

const ACCESSORS: Record<SortKey, (u: UsageUserRow) => number | string> = {
  name: (u) => u.name.toLowerCase(),
  on_screen: (u) => u.on_screen,
  present: (u) => u.present,
  present_share: (u) => share(u.present, u.on_screen),
  away: (u) => u.away,
  no_face: (u) => u.no_face,
  covered: (u) => u.covered,
  mic_open: (u) => u.mic_open,
  talking: (u) => u.talking,
  talk_share: (u) => share(u.talking, u.mic_open),
  dead_mic: (u) => u.dead_mic,
  talk_all: (u) => u.talk_all,
  pip: (u) => u.pip,
  kicks: (u) => u.kicks,
  last_seen: (u) => u.last_seen,
  // Every manager has the same target, so on-screen time orders them the same way.
  target_share: (u) => u.on_screen,
};

const PAGE = 10;

/** Every manager in scope with every number — sort, search, click a row for the full picture. */
export function ManagersTable({
  users,
  targetSeconds,
  onOpen,
}: {
  users: UsageUserRow[];
  /** Each manager's connected-time target for the range (8 h a day). */
  targetSeconds: number;
  onOpen: (u: UsageUserRow) => void;
}) {
  const t = useTranslations("screenMonitoring");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "on_screen", desc: true });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? users.filter((u) => u.name.toLowerCase().includes(q) || u.stores.some((s) => s.toLowerCase().includes(q)))
      : users;
    const get = ACCESSORS[sort.key];
    return [...filtered].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      const c = x < y ? -1 : x > y ? 1 : 0;
      return sort.desc ? -c : c;
    });
  }, [users, query, sort]);

  const paged = usePaged(rows, rows.length, PAGE);

  const head = (key: SortKey, label: string, end = true) => {
    const active = sort.key === key;
    const Icon = !active ? ArrowUpDown : sort.desc ? ArrowDown : ArrowUp;
    return (
      <th className={cn(TH, end && "text-end")} aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}>
        <button
          type="button"
          onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== "name" }))}
          className={cn("inline-flex cursor-pointer items-center gap-1 hover:text-foreground", active && "text-foreground")}
        >
          {label}
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </th>
    );
  };

  return (
    <ReportTable
      id="managers"
      title={t("sections.managers")}
      count={users.length}
      unit={t("units.managers")}
      description={
        <span className="flex flex-wrap items-center justify-between gap-3">
          <span>{t("sections.managersHint")}</span>
          <span className="relative">
            <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchManagers")}
              aria-label={t("searchManagers")}
              className="h-8 w-56 ps-8"
            />
          </span>
        </span>
      }
    >
      <table className="w-full text-sm [&_td]:whitespace-nowrap">
        <thead className="border-b bg-muted/40">
          <tr>
            {head("name", t("columns.manager"), false)}
            {head("on_screen", t("columns.onScreen"))}
            {head("target_share", t("columns.ofTarget", { target: formatDuration(targetSeconds) }))}
            {head("present", t("columns.present"))}
            {head("present_share", t("columns.presentPct"))}
            {head("away", t("columns.away"))}
            {head("no_face", t("columns.noFace"))}
            {head("covered", t("columns.covered"))}
            {head("mic_open", t("columns.micOpen"))}
            {head("talking", t("columns.talking"))}
            {head("talk_share", t("columns.talkingPct"))}
            {head("dead_mic", t("columns.deadMic"))}
            {head("talk_all", t("columns.talkAll"))}
            {head("pip", t("columns.pip"))}
            <th className={TH}>{t("columns.favorite")}</th>
            {head("kicks", t("columns.kicks"))}
            {head("last_seen", t("columns.lastSeen"))}
            <th className={TH}><span className="sr-only">{t("openDetails")}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {paged.rows.length === 0 && (
            <tr>
              <td colSpan={18} className="px-5 py-10 text-center text-muted-foreground">{t("noMatches")}</td>
            </tr>
          )}
          {paged.rows.map((u) => {
            const presentShare = share(u.present, u.on_screen);
            return (
              <tr
                key={u.user_id}
                onClick={() => onOpen(u)}
                className="cursor-pointer hover:bg-muted/30"
              >
                <td className={TD}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(u);
                    }}
                    className="text-start font-medium hover:underline"
                  >
                    {u.name}
                  </button>
                  <div className="max-w-56 whitespace-normal text-xs text-muted-foreground">{u.stores.join(", ")}</div>
                </td>
                <td className={cn(TD, "text-end tabular-nums")}>{formatDuration(u.on_screen)}</td>
                <td className={cn(TD, "text-end tabular-nums")}>{percent(u.on_screen, targetSeconds)}</td>
                <td className={cn(TD, "text-end tabular-nums")}>{formatDuration(u.present)}</td>
                <td className={cn(TD, "text-end")}>
                  <div className="ms-auto flex w-32 items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", presentShare >= 60 ? "bg-teal-600" : presentShare >= 30 ? "bg-amber-600" : "bg-red-600")}
                        style={{ width: `${presentShare}%` }}
                      />
                    </div>
                    <span className="w-9 text-end text-xs tabular-nums">{percent(u.present, u.on_screen)}</span>
                  </div>
                </td>
                <td className={cn(TD, "text-end tabular-nums")}>{formatDuration(u.away)}</td>
                <td className={cn(TD, "text-end tabular-nums", u.no_face > 0 && "text-amber-600 dark:text-amber-400")}>
                  {u.no_face > 0 ? formatDuration(u.no_face) : "—"}
                </td>
                <td className={cn(TD, "text-end tabular-nums", u.covered > 0 && "text-red-600 dark:text-red-400")}>
                  {u.covered > 0 ? formatDuration(u.covered) : "—"}
                </td>
                <td className={cn(TD, "text-end tabular-nums")}>{formatDuration(u.mic_open)}</td>
                <td className={cn(TD, "text-end tabular-nums")}>{formatDuration(u.talking)}</td>
                <td className={cn(TD, "text-end tabular-nums")}>{percent(u.talking, u.mic_open)}</td>
                <td className={cn(TD, "text-end tabular-nums", u.dead_mic > 0 && "text-red-600 dark:text-red-400")}>
                  {u.dead_mic > 0 ? formatDuration(u.dead_mic) : "—"}
                </td>
                <td className={cn(TD, "text-end tabular-nums")}>{u.talk_all > 0 ? formatDuration(u.talk_all) : "—"}</td>
                <td className={cn(TD, "text-end tabular-nums")}>{u.pip > 0 ? formatDuration(u.pip) : "—"}</td>
                <td className={TD}>
                  {u.favorite ? (
                    <>
                      <div className="whitespace-nowrap">{u.favorite.name}</div>
                      <div className="text-xs tabular-nums text-muted-foreground">
                        {u.favorite.store} · {formatDuration(u.favorite.seconds)}
                      </div>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={cn(TD, "text-end tabular-nums")}>
                  {u.kicks > 0 ? (
                    <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400" title={t("kicksHint")}>
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      {u.kicks}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={cn(TD, "whitespace-nowrap text-end text-xs text-muted-foreground")}>
                  {new Date(u.last_seen).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className={cn(TD, "text-muted-foreground")}>
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pager page={paged.page} pages={paged.pages} from={paged.from} to={paged.to} total={paged.total} onPage={paged.setPage} />
    </ReportTable>
  );
}
