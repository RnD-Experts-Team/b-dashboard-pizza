"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { CloudOff, Plus, RotateCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { dayKey, fromKey, isDayKey, rangeContains, sameRange, step, suggestedStart, viewRange } from "@/lib/calendar/dates";
import { byDay, countByCategory, uniquePeople } from "@/lib/calendar/layout";
import { CALENDAR_VIEWS, type CalendarEvent, type CalendarView } from "@/lib/calendar/types";
import { useCalendarStore } from "@/lib/store/calendar.store";
import { useCalendarEvents, useCalendarMutations, useCalendarNow, useTodayEvents } from "@/lib/hooks/use-calendar-events";
import { CalendarClockProvider } from "./calendar-clock";
import { CategoryTabs, FilterPopover } from "./calendar-filters";
import { CalendarToolbar } from "./calendar-toolbar";
import { DeleteEventDialog } from "./delete-event-dialog";
import { EventDialog, type EditorTarget } from "./event-dialog";
import { AvatarStack } from "./event-parts";
import { CalendarPeekProvider, usePeek, type PeekTarget } from "./event-peek";
import { DayPeekCard, EventPeekCard } from "./peek-cards";
import { useCalendarFormat } from "./use-calendar-format";
import { useIsCompact } from "./use-compact";
import { useFitHeight } from "./use-fit-height";
import { DayView } from "./views/day-view";
import { CompactMonthView, MonthView } from "./views/month-view";
import { WeekView } from "./views/week-view";
import { YearView } from "./views/year-view";
import type { GridScroll } from "./views/time-grid";

const DEFAULT_VIEW: CalendarView = "month";
type Anim = "fade" | "next" | "prev" | "none";

/** Search: title, store, people and category name, case-insensitive. */
function useMatcher() {
  const f = useCalendarFormat();
  const tc = useTranslations("calendar.categories");
  return useCallback(
    (ev: CalendarEvent, q: string) => {
      if (!q) return true;
      const hay = [f.title(ev), ev.store.name, ev.store.code, tc(ev.category), ev.typeLabel ?? "", ...ev.people].join(" ").toLowerCase();
      return hay.includes(q);
    },
    [f, tc],
  );
}

/** Closes the peek card whenever the visible range or view changes. */
function PeekAutoClose({ signal }: { signal: string }) {
  const { close } = usePeek();
  useEffect(() => close(), [signal, close]);
  return null;
}

function CalendarSkeleton() {
  const t = useTranslations("calendar");
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-label={t("loading")}>
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

function CalendarError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("calendar");
  return (
    <div role="alert" className="flex h-full min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
      <CloudOff className="size-6 text-muted-foreground/70" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("errorTitle")}</p>
        <p className="max-w-72 text-xs text-muted-foreground">{t("errorHint")}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCw className="size-3.5" />
        {t("retry")}
      </Button>
    </div>
  );
}

/**
 * The Calendar page: birthdays, cleaning tasks, shifts, anniversaries,
 * maintenance and meetings in Day / Week / Month / Year views.
 *
 * `?view=` and `?date=` live in the URL (defaults dropped), so the topbar's
 * Today panel deep-links straight to a day and Back returns from a drill-down.
 * Category filters + store scope persist in `useCalendarStore`; search is
 * page-local. Data comes through `useCalendarEvents` → `calendarService`.
 */
export function CalendarPage() {
  const now = useCalendarNow();
  if (now == null) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-14 w-72" />
        <Skeleton className="h-[32rem] w-full rounded-xl" />
      </div>
    );
  }
  return (
    <CalendarClockProvider now={now}>
      <CalendarPageInner now={now} />
    </CalendarClockProvider>
  );
}

function CalendarPageInner({ now }: { now: number }) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const compact = useIsCompact();
  const reduceMotion = useReducedMotion();
  const matches = useMatcher();

  /* ── URL state ── */
  const rawView = searchParams.get("view");
  const view: CalendarView = (CALENDAR_VIEWS as readonly string[]).includes(rawView ?? "") ? (rawView as CalendarView) : DEFAULT_VIEW;
  const todayKey = dayKey(new Date(now));
  const rawDate = searchParams.get("date");
  const cursorKey = isDayKey(rawDate) ? rawDate : todayKey;
  const cursor = useMemo(() => fromKey(cursorKey), [cursorKey]);

  // How the next body enters, and whether hour grids keep their scroll.
  const [motionIntent, setMotionIntent] = useState<{ anim: Anim; scroll: GridScroll }>({ anim: "fade", scroll: "auto" });
  const scrollMemory = useRef<number | null>(null);

  const navigate = useCallback(
    (next: { view?: CalendarView; date?: string }, meta: { anim: Anim; scroll: GridScroll; push?: boolean }) => {
      setMotionIntent({ anim: meta.anim, scroll: meta.scroll });
      const qs = new URLSearchParams(searchParams.toString());
      const v = next.view ?? view;
      const d = next.date ?? cursorKey;
      if (v === DEFAULT_VIEW) qs.delete("view");
      else qs.set("view", v);
      if (d === todayKey) qs.delete("date");
      else qs.set("date", d);
      const s = qs.toString();
      const url = s ? `${pathname}?${s}` : pathname;
      if (meta.push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [router, pathname, searchParams, view, cursorKey, todayKey],
  );

  const goStep = useCallback(
    (dir: 1 | -1) => navigate({ date: dayKey(step(view, cursor, dir)) }, { anim: dir === 1 ? "next" : "prev", scroll: "keep" }),
    [navigate, view, cursor],
  );
  /** Move the cursor; slide only when the visible range actually changes. */
  const moveTo = useCallback(
    (key: string, scroll: GridScroll) => {
      const d = fromKey(key);
      const same = sameRange(view, d, cursor);
      navigate({ date: key }, { anim: same ? "none" : d > cursor ? "next" : "prev", scroll: same ? scroll : "auto" });
    },
    [navigate, view, cursor],
  );
  const goToday = useCallback(() => moveTo(todayKey, "auto"), [moveTo, todayKey]);
  const setView = useCallback(
    (v: CalendarView) => {
      if (v !== view) navigate({ view: v }, { anim: "fade", scroll: "auto" });
    },
    [navigate, view],
  );
  const openDay = useCallback(
    (key: string) => navigate({ view: "day", date: key }, { anim: "fade", scroll: "auto", push: true }),
    [navigate],
  );
  const openMonth = useCallback(
    (key: string) => navigate({ view: "month", date: key }, { anim: "fade", scroll: "auto", push: true }),
    [navigate],
  );
  const selectDay = useCallback((key: string) => moveTo(key, "keep"), [moveTo]);

  /* ── Data ── */
  const range = useMemo(() => viewRange(view, cursor), [view, cursor]);
  const { events, loading, showSkeleton, error, retry } = useCalendarEvents(range);
  const { events: todayEvents } = useTodayEvents();
  const filters = useCalendarStore((s) => s.filters);

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim().toLowerCase()), 140);
    return () => clearTimeout(id);
  }, [search]);

  // viewAll: search applied, categories NOT (feeds the counts).
  // viewEvents: both applied (what the view draws).
  const viewAll = useMemo(() => events.filter((e) => matches(e, query)), [events, matches, query]);
  const viewEvents = useMemo(() => viewAll.filter((e) => filters.includes(e.category)), [viewAll, filters]);
  const counts = useMemo(() => countByCategory(viewAll), [viewAll]);
  const categoryFilter = useCallback((list: CalendarEvent[]) => list.filter((e) => filters.includes(e.category)), [filters]);

  /* ── Create / edit / delete (events created here only) ── */
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const { remove, restore } = useCalendarMutations();
  const tEditor = useTranslations("calendar.editor");

  /** New event on the open day: the next half hour if it's today, else 09:00. */
  const openCreate = useCallback(
    () => setEditor({ kind: "create", start: suggestedStart(fromKey(cursorKey), now) }),
    [cursorKey, now],
  );

  // Every delete goes through a confirmation first (card bin icon or the
  // editor's Delete). The Undo toast stays as a second safety net.
  const [pendingDelete, setPendingDelete] = useState<CalendarEvent | null>(null);

  /** Runs once confirmed. Rejects on failure so the confirm dialog can say so. */
  const confirmDelete = useCallback(
    async (ev: CalendarEvent) => {
      const snapshot = await remove(ev.id);
      setEditor(null);
      toast(tEditor("deleted"), {
        description: ev.title,
        action: {
          label: tEditor("undo"),
          onClick: () => {
            restore(snapshot)
              .then(() => toast.success(tEditor("restored")))
              .catch(() => toast.error(tEditor("saveFailed")));
          },
        },
      });
    },
    [remove, restore, tEditor],
  );

  /** After saving, make sure the event is on screen. */
  const revealSaved = useCallback(
    (ev: CalendarEvent) => {
      if (!rangeContains(range, ev.start)) moveTo(dayKey(ev.start), "auto");
    },
    [range, moveTo],
  );

  const index = useMemo(() => new Map(viewEvents.map((e) => [e.id, e])), [viewEvents]);
  const grouped = useMemo(() => byDay(viewEvents), [viewEvents]);
  const renderPeek = useCallback(
    (target: PeekTarget, close: () => void) => {
      const go = (key: string) => {
        close();
        openDay(key);
      };
      if (target.type === "event") {
        const ev = index.get(target.id);
        return ev ? (
          <EventPeekCard
            ev={ev}
            onOpenDay={go}
            onEdit={(e) => {
              close();
              setEditor({ kind: "edit", event: e });
            }}
            onDelete={(e) => {
              close();
              setPendingDelete(e);
            }}
          />
        ) : null;
      }
      const list = grouped.get(target.id) ?? [];
      return list.length ? <DayPeekCard date={fromKey(target.id)} events={list} onOpenDay={go} /> : null;
    },
    [index, grouped, openDay],
  );

  /* ── Keyboard: D W M Y · T · ← → · / ── */
  const searchRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  useFitHeight(pageRef, !compact);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      // Keys can target `document`/`window` (not an Element) — treat that as the page body.
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el) {
        const tag = el.tagName.toLowerCase();
        if ((tag === "input" && (el as HTMLInputElement).type !== "checkbox") || tag === "textarea" || tag === "select" || el.isContentEditable) return;
        if (el.closest("[role=dialog], [role=alertdialog]")) return;
      }
      const views: Record<string, CalendarView> = { d: "day", w: "week", m: "month", y: "year" };
      const key = e.key.toLowerCase();
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (views[key]) {
        setView(views[key]);
      } else if (key === "t") {
        goToday();
      } else if (key === "n") {
        e.preventDefault();
        openCreate();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const forward = (e.key === "ArrowRight") !== (locale === "ar");
        goStep(forward ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setView, goToday, goStep, locale, openCreate]);

  /* ── View body ── */
  const rangeSignal = `${view}|${dayKey(range.from)}`;
  // Compact layouts select a day inside the range, so they remount per day.
  const bodyKey = compact && (view === "month" || view === "week") ? `${rangeSignal}|${cursorKey}` : rangeSignal;
  const a = reduceMotion ? "none" : motionIntent.anim;
  const initial =
    a === "fade" ? { opacity: 0, y: -4 } : a === "next" ? { opacity: 0, x: locale === "ar" ? -10 : 10 } : a === "prev" ? { opacity: 0, x: locale === "ar" ? 10 : -10 } : false;

  let body: React.ReactNode;
  if (error) body = <CalendarError onRetry={retry} />;
  else if (showSkeleton) body = <CalendarSkeleton />;
  else if (view === "month")
    body = compact ? (
      <CompactMonthView cursor={cursor} events={viewEvents} onSelectDay={selectDay} />
    ) : (
      <MonthView cursor={cursor} events={viewEvents} onOpenDay={openDay} />
    );
  else if (view === "week")
    body = (
      <WeekView
        cursor={cursor}
        events={viewEvents}
        compact={compact}
        onOpenDay={openDay}
        onSelectDay={selectDay}
        scroll={motionIntent.scroll}
        scrollMemory={scrollMemory}
      />
    );
  else if (view === "day")
    body = (
      <DayView
        cursor={cursor}
        events={viewEvents}
        compact={compact}
        onOpenDay={openDay}
        scroll={motionIntent.scroll}
        scrollMemory={scrollMemory}
      />
    );
  else body = <YearView cursor={cursor} events={viewEvents} onOpenDay={openDay} onOpenMonth={openMonth} />;

  const emptyNote = !loading && !error && !viewEvents.length ? (query ? t("search.noMatches", { q: search.trim() }) : t("emptyRange")) : null;
  const people = useMemo(() => uniquePeople(todayEvents), [todayEvents]);

  return (
    <CalendarPeekProvider render={renderPeek}>
      <PeekAutoClose signal={`${rangeSignal}|${cursorKey}`} />
      {/* sm+: exactly the height the shell leaves (see useFitHeight) — the page
          never scrolls, only the calendar body does. Phones flow naturally. */}
      <div ref={pageRef} className="flex flex-col gap-5 pb-4 sm:pb-0">
        <PageHeader title={t("title")} description={t("description")}>
          {people.length > 0 && (
            <div className="hidden items-center gap-2 sm:flex" title={t("peopleToday")}>
              <span className="hidden whitespace-nowrap text-xs text-muted-foreground lg:inline">{t("peopleToday")}</span>
              <AvatarStack people={people} max={4} ring="ring-background" />
            </div>
          )}
          <Button size="sm" onClick={() => openCreate()} title={`${t("newEvent")} (N)`}>
            <Plus className="size-4" />
            {t("newEvent")}
          </Button>
        </PageHeader>

        {/* Controls: category tabs · search · filter. One row on xl+; below that
            search + filter sit ABOVE the tabs so the tabs get the full width and
            their underline stays on the divider. */}
        <div className="flex flex-col gap-3 border-b xl:flex-row xl:items-end xl:justify-between xl:gap-6">
          <div className="min-w-0">
            <CategoryTabs counts={counts} total={viewAll.length} />
          </div>
          <div className="order-first flex items-center justify-between gap-2 xl:order-none xl:shrink-0 xl:pb-2.5">
            {/* The label carries the width, so the clear button and "/" hint stay inside the field. */}
            <label className="relative min-w-0 flex-1 sm:max-w-64 xl:flex-none">
              <span className="sr-only">{t("search.label")}</span>
              <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                type="search"
                autoComplete="off"
                value={search}
                placeholder={t("search.placeholder")}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearch("");
                    e.currentTarget.blur();
                  }
                }}
                className="h-8 w-full rounded-md border bg-background pe-8 ps-8 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 xl:w-40 xl:transition-[width,color,box-shadow,border-color] xl:focus:w-48 [&::-webkit-search-cancel-button]:hidden"
              />
              {search ? (
                <button
                  type="button"
                  aria-label={t("search.clear")}
                  onClick={() => {
                    setSearch("");
                    searchRef.current?.focus();
                  }}
                  className="absolute end-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute end-2 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground md:block">
                  /
                </kbd>
              )}
            </label>
            <FilterPopover counts={counts} />
          </div>
        </div>

        {/* The calendar card takes the full width and the remaining height. */}
        <section
          data-slot="card"
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm"
        >
          <CalendarToolbar
            view={view}
            cursor={cursor}
            filter={categoryFilter}
            onStep={goStep}
            onToday={goToday}
            onView={setView}
            onPick={(k) => moveTo(k, "keep")}
          />
          <div className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <motion.div
              key={bodyKey}
              initial={initial}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              className={cn(!compact && "h-full")}
            >
              {body}
            </motion.div>
            {emptyNote && (
              <div className="pointer-events-none absolute inset-x-0 top-16 z-30 flex justify-center px-4">
                <p className="rounded-full border bg-popover px-3 py-1.5 text-xs text-muted-foreground shadow-sm">{emptyNote}</p>
              </div>
            )}
          </div>
        </section>
        <span className="sr-only">{t("shortcuts")}</span>
      </div>
      <EventDialog
        target={editor}
        onOpenChange={(open) => !open && setEditor(null)}
        onSaved={revealSaved}
        onDelete={setPendingDelete}
      />
      <DeleteEventDialog
        event={pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </CalendarPeekProvider>
  );
}
