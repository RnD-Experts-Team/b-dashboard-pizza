"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Building2,
  Calendar,
  Clock,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  Store as StoreIcon,
  Users,
  Wrench,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  V1Metric,
  V1MetricGrid,
  V1_TBL,
  V1_TD,
  V1_TH,
} from "@/components/dashboard-v1/v1-ui";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { getStorePassport, type SecretEntry } from "@/lib/mock/store-passport.mock";
import { cn } from "@/lib/utils";
import { PassportRow, PassportSection, SecretRow } from "./passport-ui";

/** "10:30" to minutes since midnight. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Whether the store is trading right now, against its own static hours.
 *
 * A close time at or before the open time means the day runs past midnight,
 * so the window wraps instead of being empty — and the small hours of the
 * morning belong to the previous day's row, which is why yesterday is checked
 * as well.
 */
function isOpenNow(
  hours: { day: number; open: string; close: string }[],
  now: Date,
): boolean {
  const mins = now.getHours() * 60 + now.getMinutes();
  const today = hours.find((h) => h.day === now.getDay());
  if (today) {
    const open = toMinutes(today.open);
    const close = toMinutes(today.close);
    if (close > open ? mins >= open && mins < close : mins >= open) return true;
  }
  const yesterday = hours.find((h) => h.day === (now.getDay() + 6) % 7);
  if (yesterday) {
    const open = toMinutes(yesterday.open);
    const close = toMinutes(yesterday.close);
    if (close <= open && mins < close) return true;
  }
  return false;
}

/** Sunday-first, matching the index returned by Date.getDay(). */
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * The entry animation every tab panel shares. Radix unmounts the inactive
 * panel, so only the arriving one animates — a fade with a few pixels of rise,
 * short enough not to sit between the click and the content.
 */
const TAB_PANEL =
  "animate-in fade-in-0 slide-in-from-bottom-1 animation-duration-200 ease-out motion-reduce:animate-none";

/**
 * The store passport — everything about the selected store in one place.
 *
 * Content is split across tabs rather than one long scroll mainly because of
 * the access tab: shared logins and door codes belong behind a deliberate
 * click, not scrolling past anyone who opened the dialog to check a phone
 * number.
 *
 * Data is static placeholder for now — see lib/mock/store-passport.mock.ts,
 * which also documents what the backend has to do before the access block
 * carries anything real.
 */
export function StorePassportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("storePassport");
  const selectedStore = useSelectedStoreStore((s) => s.selectedStore);
  const passport = useMemo(() => getStorePassport(selectedStore), [selectedStore]);

  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState("overview");
  /** The scrolling body, so switching tabs lands at the top of the new one. */
  const bodyRef = useRef<HTMLDivElement>(null);
  /**
   * Resolved on open, client-side only: isOpenNow reads the local clock, and
   * rendering it during SSR would mismatch on hydration.
   */
  const [now, setNow] = useState<Date | null>(null);

  // Re-mask everything whenever the dialog closes. Leaving a code revealed for
  // whoever opens the dialog next would defeat the masking entirely.
  useEffect(() => {
    if (!open) {
      setRevealed(new Set());
      // Reopen on Overview rather than wherever it was left — which also
      // means it never reopens sitting on the access tab.
      setTab("overview");
    } else {
      setNow(new Date());
    }
  }, [open]);

  const toggleSecret = (key: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const renderEntries = (entries: SecretEntry[]) =>
    entries.map((entry) =>
      entry.secret ? (
        <SecretRow
          key={entry.key}
          label={t(`access.fields.${entry.key}`)}
          value={entry.value}
          revealed={revealed.has(entry.key)}
          onToggle={() => toggleSecret(entry.key)}
        />
      ) : (
        <PassportRow
          key={entry.key}
          label={t(`access.fields.${entry.key}`)}
          value={entry.value}
          href={entry.href}
          copyable={entry.value}
        />
      ),
    );

  const { identity, contact, hours, team, facilities, access } = passport;
  const openNow = now ? isOpenNow(hours, now) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Fixed height, not content height: the five tabs differ enough in
          length that an auto-height dialog resized and re-centred itself on
          every switch. 85vh keeps it inside a short window, max-h caps it so
          it doesn't tower on a tall one. Two classes rather than one
          `min(85vh,620px)` — Tailwind mangles the comma in that arbitrary
          value and emits a 1.6px height. */}
      <DialogContent className="flex h-[85vh] max-h-[620px] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b px-5 py-3 pe-10">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <StoreIcon className="h-4 w-4 text-primary" />
            {identity.name}
            <Badge
              variant="outline"
              className="ms-1 h-5 py-0 text-[10px] font-normal tabular-nums"
            >
              {identity.code}
            </Badge>
            <Badge
              variant={identity.isActive ? "default" : "secondary"}
              className="h-5 py-0 text-[10px] font-normal"
            >
              {identity.isActive ? t("status.active") : t("status.inactive")}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">{t("subtitle")}</DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            // A tab switch should land at the top of the new panel, not at
            // whatever offset the previous (longer) one was scrolled to.
            bodyRef.current?.scrollTo({ top: 0 });
          }}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          {/* The tab strip stays put; only the panel below it scrolls. */}
          <div className="shrink-0 overflow-x-auto px-5 pt-2.5 pb-1">
            <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
              <TabsTrigger value="overview" className="text-xs">
                {t("tabs.overview")}
              </TabsTrigger>
              <TabsTrigger value="hours" className="text-xs">
                {t("tabs.hours")}
              </TabsTrigger>
              <TabsTrigger value="team" className="text-xs">
                {t("tabs.team")}
              </TabsTrigger>
              <TabsTrigger value="facilities" className="text-xs">
                {t("tabs.facilities")}
              </TabsTrigger>
              <TabsTrigger value="access" className="text-xs">
                {t("tabs.access")}
              </TabsTrigger>
            </TabsList>
          </div>

          <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-3">
            {/* ── Overview ──────────────────────────────────────────────── */}
            <TabsContent value="overview" className={cn(TAB_PANEL, "space-y-5")}>
              <PassportSection
                title={t("sections.identity")}
                icon={<Building2 className="h-3 w-3" />}
              >
                <PassportRow label={t("fields.name")} value={identity.name} />
                <PassportRow
                  label={t("fields.code")}
                  value={identity.code}
                  copyable={identity.code}
                />
                <PassportRow label={t("fields.internalId")} value={identity.internalId} />
                <PassportRow label={t("fields.franchisee")} value={identity.franchisee} />
                <PassportRow label={t("fields.legalEntity")} value={identity.legalEntity} />
                <PassportRow
                  label={t("fields.openedOn")}
                  value={identity.openedOn}
                  icon={<Calendar className="h-3 w-3" />}
                />
              </PassportSection>

              <PassportSection
                title={t("sections.contact")}
                icon={<Phone className="h-3 w-3" />}
              >
                <PassportRow
                  label={t("fields.address")}
                  value={contact.address}
                  icon={<MapPin className="h-3 w-3" />}
                  copyable={contact.address}
                />
                <PassportRow
                  label={t("fields.phone")}
                  value={contact.phone}
                  icon={<Phone className="h-3 w-3" />}
                  copyable={contact.phone}
                />
                <PassportRow
                  label={t("fields.email")}
                  value={contact.email}
                  icon={<Mail className="h-3 w-3" />}
                  copyable={contact.email}
                />
                <PassportRow
                  label={t("fields.timezone")}
                  value={contact.timezone}
                  icon={<Clock className="h-3 w-3" />}
                />
              </PassportSection>
            </TabsContent>

            {/* ── Hours ─────────────────────────────────────────────────── */}
            <TabsContent value="hours" className={cn(TAB_PANEL, "space-y-3")}>
              {openNow !== null && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                    openNow
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      openNow ? "bg-emerald-500" : "bg-muted-foreground/50",
                    )}
                  />
                  {openNow ? t("hours.openNow") : t("hours.closedNow")}
                </span>
              )}

              <table className={V1_TBL}>
                <thead>
                  <tr>
                    <th className={V1_TH}>{t("hours.day")}</th>
                    <th className={V1_TH}>{t("hours.open")}</th>
                    <th className={V1_TH}>{t("hours.close")}</th>
                  </tr>
                </thead>
                <tbody>
                  {hours.map((h) => (
                    <tr
                      key={h.day}
                      className={cn(now?.getDay() === h.day && "bg-accent/40 font-semibold")}
                    >
                      <td className={V1_TD}>{t(`hours.days.${DAY_KEYS[h.day]}`)}</td>
                      <td className={cn(V1_TD, "tabular-nums")}>{h.open}</td>
                      <td className={cn(V1_TD, "tabular-nums")}>{h.close}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-muted-foreground">{t("hours.holidayNote")}</p>
            </TabsContent>

            {/* ── Team ──────────────────────────────────────────────────── */}
            <TabsContent value="team" className={cn(TAB_PANEL, "space-y-5")}>
              <PassportSection
                title={t("sections.management")}
                icon={<Users className="h-3 w-3" />}
              >
                <PassportRow
                  label={t("fields.generalManager")}
                  value={team.generalManager}
                />
                <PassportRow label={t("fields.areaManager")} value={team.areaManager} />
                <PassportRow
                  label={t("fields.assistantManagers")}
                  value={team.assistantManagers.join(", ")}
                />
              </PassportSection>

              <PassportSection title={t("sections.headcount")}>
                <V1MetricGrid cols={2} className="sm:grid-cols-4">
                  {team.headcount.map((h) => (
                    <V1Metric key={h.role} label={t(`roles.${h.role}`)} value={h.count} />
                  ))}
                </V1MetricGrid>
              </PassportSection>
            </TabsContent>

            {/* ── Facilities ────────────────────────────────────────────── */}
            <TabsContent value="facilities" className={cn(TAB_PANEL, "space-y-5")}>
              <PassportSection
                title={t("sections.capacity")}
                icon={<Wrench className="h-3 w-3" />}
              >
                <V1MetricGrid cols={2} className="sm:grid-cols-3">
                  <V1Metric label={t("fields.seating")} value={facilities.seating} />
                  <V1Metric
                    label={t("fields.posTerminals")}
                    value={facilities.posTerminals}
                  />
                  <V1Metric label={t("fields.ovens")} value={facilities.ovens} />
                  <V1Metric label={t("fields.makeLines")} value={facilities.makeLines} />
                  <V1Metric
                    label={t("fields.parkingSpaces")}
                    value={facilities.parkingSpaces}
                  />
                  <V1Metric
                    label={t("fields.deliveryRadius")}
                    value={t("units.miles", { count: facilities.deliveryRadiusMi })}
                  />
                </V1MetricGrid>
              </PassportSection>

              <PassportSection title={t("sections.services")}>
                <PassportRow
                  label={t("fields.driveThru")}
                  value={facilities.driveThru ? t("yes") : t("no")}
                />
                <PassportRow
                  label={t("fields.dineIn")}
                  value={facilities.dineIn ? t("yes") : t("no")}
                />
              </PassportSection>
            </TabsContent>

            {/* ── Access ────────────────────────────────────────────────── */}
            <TabsContent value="access" className={cn(TAB_PANEL, "space-y-5")}>
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-400">
                <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>{t("access.warning")}</span>
              </div>

              {revealed.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setRevealed(new Set())}
                >
                  {t("hideAll")}
                </Button>
              )}

              <PassportSection title={t("access.sections.websites")}>
                {renderEntries(access.websites)}
              </PassportSection>
              <PassportSection title={t("access.sections.alarm")}>
                {renderEntries(access.alarm)}
              </PassportSection>
              <PassportSection title={t("access.sections.registers")}>
                {renderEntries(access.registers)}
              </PassportSection>
            </TabsContent>
          </div>
        </Tabs>

        {/* Pinned to the foot of the fixed-height shell rather than trailing
            the content, so it reads the same on every tab. */}
        <p className="shrink-0 border-t px-5 py-2 text-[10px] text-muted-foreground">
          {t("placeholderNote")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
