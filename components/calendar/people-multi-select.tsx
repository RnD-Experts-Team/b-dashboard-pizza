"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Loader2, RotateCw, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarWriteError, calendarToolboxService } from "@/lib/api/services/calendar-toolbox.service";
import type { CalendarPerson } from "@/lib/calendar/toolbox-write";

/** Toolbox takes 1 to 50 people per item. */
export const PEOPLE_MAX = 50;

type LoadState =
  | { status: "loading" }
  | { status: "ready"; people: CalendarPerson[]; complete: boolean }
  | { status: "error"; kind: "notFound" | "forbidden" | "other" };

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** Does this manager run at least one of these stores? */
export const runsAnyOf = (p: CalendarPerson, stores: ReadonlySet<string>): boolean =>
  p.stores === "all" || p.stores.some((c) => stores.has(c));

/**
 * Pick the store managers a "Chosen people" event or task goes to
 * (`GET /calendar/people`, FRONTEND_CALENDAR_CHANGES.md 2026-11-18) — AFTER the stores
 * are picked in the separate store field above it (user-requested 2026-11-22): it lists
 * only the managers of those stores, and stays disabled until a store is picked. The
 * managers who run only picked stores come first; accounts that are also on other stores
 * (area managers, test accounts) follow under their own heading. Search by name, and
 * "Select all" for what the list shows.
 *
 * Toolbox answers at most 100 people per call and can't filter by store, so the whole
 * list is gathered once (`listAllPeople`, cached, started as soon as this field shows)
 * and filtered here. The people picked are kept as objects: they stay named in the chips
 * under the field. The popover is `modal`: inside the event dialog a non-modal popover's
 * list would not scroll with the wheel (the dialog's scroll lock only lets its own
 * content scroll, and the popover is portaled outside it).
 */
export function PeopleMultiSelect({
  value,
  onChange,
  stores,
  storeNames,
  invalid,
  id,
}: {
  value: readonly CalendarPerson[];
  onChange: (people: CalendarPerson[]) => void;
  /** The stores picked in the store field: only their managers are offered. */
  stores: readonly string[];
  /** store number → name, to say which stores a manager runs. */
  storeNames: ReadonlyMap<string, string>;
  invalid?: boolean;
  id?: string;
}) {
  const t = useTranslations("calendar.people");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [attempt, setAttempt] = useState(0);
  const fresh = useRef(false);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const noStores = stores.length === 0;

  // Start gathering the list as soon as the field shows: the first time it takes a few
  // seconds (one search per letter); it is cached after.
  useEffect(() => {
    calendarToolboxService.listAllPeople().catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const again = fresh.current;
    fresh.current = false;
    setState((s) => (s.status === "ready" && !again ? s : { status: "loading" }));
    calendarToolboxService
      .listAllPeople({ fresh: again })
      .then((d) => live && setState({ status: "ready", people: d.people, complete: d.complete }))
      .catch((err) => {
        if (!live) return;
        const kind = err instanceof CalendarWriteError && (err.kind === "notFound" || err.kind === "forbidden") ? err.kind : "other";
        setState({ status: "error", kind });
      });
    return () => {
      live = false;
    };
  }, [open, attempt]);

  const retry = () => {
    fresh.current = true;
    setAttempt((n) => n + 1);
  };

  const storeSet = useMemo(() => new Set(stores), [stores]);
  // The managers of the picked stores: those who run only picked stores first, then the
  // ones who are on other stores too; by name inside each.
  const { own, shared } = useMemo(() => {
    const all = state.status === "ready" ? state.people.filter((p) => runsAnyOf(p, storeSet)) : [];
    const isShared = (p: CalendarPerson) => p.stores === "all" || p.stores.some((c) => !storeSet.has(c));
    return { own: all.filter((p) => !isShared(p)), shared: all.filter(isShared) };
  }, [state, storeSet]);

  const q = norm(search);
  const hit = (p: CalendarPerson) => !q || norm(p.name).includes(q);
  const shownOwn = own.filter(hit);
  const shownShared = shared.filter(hit);
  const shown = [...shownOwn, ...shownShared];
  const total = own.length + shared.length;

  const picked = useMemo(() => new Set(value.map((p) => p.id)), [value]);
  const full = value.length >= PEOPLE_MAX;
  const allOn = shown.length > 0 && shown.every((p) => picked.has(p.id));

  const toggle = (p: CalendarPerson) =>
    onChange(picked.has(p.id) ? value.filter((v) => v.id !== p.id) : full ? [...value] : [...value, p]);
  const toggleAll = () => {
    if (allOn) {
      const ids = new Set(shown.map((p) => p.id));
      onChange(value.filter((v) => !ids.has(v.id)));
    } else {
      onChange([...value, ...shown.filter((p) => !picked.has(p.id)).slice(0, PEOPLE_MAX - value.length)]);
    }
  };

  /** Which of the picked stores they run ("Chatterton", "Chatterton, Hudson +1"), and how many others. */
  const storesLine = (p: CalendarPerson) => {
    if (p.stores === "all") return t("allStores");
    const here = p.stores.filter((c) => storeSet.has(c)).map((c) => storeNames.get(c) ?? c);
    const names = here.length > 2 ? `${here.slice(0, 2).join(", ")} ${t("moreStores", { n: here.length - 2 })}` : here.join(", ");
    const others = p.stores.length - here.length;
    return others > 0 ? `${names} · ${t("alsoStores", { n: others })}` : names;
  };

  const label = value.length === 1 ? value[0].name : t("count", { n: value.length });

  const row = (p: CalendarPerson) => {
    const on = picked.has(p.id);
    const blocked = full && !on;
    return (
      <label
        key={p.id}
        className={cn(
          "flex select-none items-center gap-3 rounded-md px-2 py-1.5 transition-colors duration-150",
          blocked ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-accent/50",
        )}
      >
        <Checkbox checked={on} disabled={blocked} onCheckedChange={() => toggle(p)} className="rounded-sm" />
        <span className="min-w-0 flex-1">
          <span dir="auto" className="block truncate text-start text-sm font-medium leading-tight">
            {p.name}
          </span>
          <span dir="auto" className="block truncate text-start text-xs text-muted-foreground">
            {storesLine(p)}
          </span>
        </span>
      </label>
    );
  };

  return (
    <div className="space-y-2">
      <Popover
        modal
        open={open && !noStores}
        onOpenChange={(next) => {
          if (next) setSearch("");
          setOpen(next);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={noStores}
            aria-invalid={invalid}
            className={cn("w-full justify-between gap-1.5 font-normal", invalid && "border-destructive")}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <Users className="size-4 shrink-0 text-muted-foreground" />
              <span className={cn("truncate", noStores && "text-muted-foreground")}>
                {noStores ? t("pickStoreFirst") : value.length ? label : t("pickSome")}
              </span>
            </span>
            <ChevronDown className={cn("size-3.5 shrink-0 opacity-50 transition-transform duration-200", open && "rotate-180")} />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          collisionPadding={16}
          className="flex max-h-(--radix-popover-content-available-height) w-[min(24rem,calc(100vw-2rem))] flex-col p-0"
        >
          <div className="shrink-0 space-y-2 border-b p-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-heading text-sm font-semibold">{t("title")}</h3>
              <span className={cn("text-xs tabular-nums", full ? "font-medium text-foreground" : "text-muted-foreground")}>
                {t("selectedOf", { n: value.length, max: PEOPLE_MAX })}
              </span>
            </div>
            <label className="relative block">
              <span className="sr-only">{t("searchLabel")}</span>
              <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                autoFocus
                autoComplete="off"
                value={search}
                placeholder={t("search")}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-full rounded-md border bg-background pe-2.5 ps-8 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 [&::-webkit-search-cancel-button]:hidden"
              />
            </label>
          </div>

          {state.status === "loading" ? (
            <p className="flex items-center justify-center gap-2 px-2 py-8 text-sm text-muted-foreground" aria-busy>
              <Loader2 className="size-4 animate-spin" />
              {t("loading")}
            </p>
          ) : state.status === "error" ? (
            <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
              <p className="text-sm text-muted-foreground">{t(`errors.${state.kind}`)}</p>
              {state.kind === "other" && (
                <Button type="button" variant="outline" size="sm" onClick={retry}>
                  <RotateCw className="size-3.5" />
                  {t("retry")}
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
                <span className="min-w-0 flex-1 truncate text-xs tabular-nums text-muted-foreground">
                  {t("inStores", { n: total, stores: stores.length })}
                </span>
                {shown.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleAll}
                    disabled={!allOn && full}
                    className="-me-1.5 h-7 shrink-0 px-2 text-xs"
                  >
                    {allOn ? t("clearAll") : t("selectAll")}
                  </Button>
                )}
              </div>
              {/* The list scrolls on its own (wheel included — see `modal` above). */}
              <div className="max-h-72 min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
                {shown.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">{q ? t("none") : t("noManagers")}</p>
                ) : (
                  <>
                    {shownOwn.map(row)}
                    {shownShared.length > 0 && (
                      <p
                        className={cn(
                          "px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                          shownOwn.length ? "mt-1.5 border-t pt-2.5" : "pt-1",
                        )}
                      >
                        {t("sharedHeading")}
                      </p>
                    )}
                    {shownShared.map(row)}
                  </>
                )}
              </div>
            </>
          )}

          {(full || (state.status === "ready" && !state.complete)) && (
            <div className="shrink-0 space-y-1 border-t px-3 py-2 text-xs text-muted-foreground">
              {full && <p>{t("max", { n: PEOPLE_MAX })}</p>}
              {state.status === "ready" && !state.complete && (
                <p className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">{t("partial")}</span>
                  <Button type="button" variant="ghost" size="sm" className="h-6 shrink-0 px-2 text-xs" onClick={retry}>
                    <RotateCw className="size-3" />
                    {t("retry")}
                  </Button>
                </p>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Who it goes to, named. */}
      {value.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <ul aria-label={t("pickedLabel")} className="contents">
            {value.map((p) => (
              <li key={p.id}>
                <span className="inline-flex h-6 max-w-56 items-center gap-1 rounded-full bg-muted ps-2.5 pe-1 text-xs">
                  <span dir="auto" className="truncate">
                    {p.name}
                  </span>
                  <button
                    type="button"
                    aria-label={t("remove", { name: p.name })}
                    onClick={() => onChange(value.filter((v) => v.id !== p.id))}
                    className="grid size-4 shrink-0 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {value.length > 1 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="h-6 rounded-full px-2 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {t("removeAll")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
