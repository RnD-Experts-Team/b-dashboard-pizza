"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseTripTab, tripLinkUrl, tripShareText, tripStoreNumbers, type TripTab } from "@/lib/maintenance-trips";
import type { TripWithLink } from "@/types/maintenance-system";
import { NewTripDialog } from "./new-trip-dialog";
import { TripDrawer } from "./trip-drawer";
import { TripLinkDialog } from "./trip-link-dialog";
import { HistoryList, OnClockList, UpcomingList, type HistoryFilters } from "./trip-lists";

const TAB_KEYS: Record<TripTab, string> = {
  "on-clock": "trips.tabs.onClock",
  upcoming: "trips.tabs.upcoming",
  history: "trips.tabs.history",
};

interface ShownLink {
  url: string;
  shareText: string;
  technicianName: string | null;
}

/**
 * Trips (docs/MAINTENANCE-UI.md §3): On the clock now · Today & upcoming ·
 * History, the New trip dialog and the trip drawer. Tab, open trip and the
 * history filters live in the URL (?tab= ?trip= ?tech= ?from= ?to= ?q=).
 */
export function TripsPage() {
  const t = useTranslations("maintenanceSystem");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const tab = parseTripTab(params.get("tab"));
  const tripParam = Number(params.get("trip"));
  const openTripId = Number.isInteger(tripParam) && tripParam > 0 ? tripParam : null;
  const history: HistoryFilters = {
    technicianId: Number(params.get("tech")) || null,
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    search: params.get("q") ?? "",
  };

  const [newOpen, setNewOpen] = useState(false);
  const [shownLink, setShownLink] = useState<ShownLink | null>(null);
  const [issuedTokens, setIssuedTokens] = useState<Record<number, string>>({});
  const [reload, setReload] = useState(0);

  const setQuery = useCallback(
    (patch: Record<string, string | null>, mode: "push" | "replace" = "replace") => {
      const next = new URLSearchParams(params.toString());
      Object.entries(patch).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (mode === "push") router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [params, pathname, router],
  );

  const openTrip = (id: number) => setQuery({ trip: String(id) }, "push");
  const bump = () => setReload((n) => n + 1);

  function onCreated(result: TripWithLink): void {
    const { trip, tripLink } = result;
    toast.success(t("trips.newTripDialog.created"));
    bump();
    if (!trip?.id) return;
    if (tripLink?.urlToken) {
      const token = tripLink.urlToken;
      setIssuedTokens((cur) => ({ ...cur, [trip.id]: token }));
      const url = tripLinkUrl(token, locale);
      setShownLink({
        url,
        technicianName: trip.technician?.name ?? null,
        shareText: tripShareText({
          link: url,
          plannedDate: trip.plannedDate,
          storeNumbers: tripStoreNumbers(trip),
          locale,
          template: t.raw("trips.shareText") as string,
        }),
      });
    }
    openTrip(trip.id);
  }

  const newTripButton = (
    <Button onClick={() => setNewOpen(true)}>
      <Plus aria-hidden="true" />
      {t("trips.newTrip")}
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("pages.trips")} description={t("trips.description")}>
        {newTripButton}
      </PageHeader>

      <Tabs value={tab} onValueChange={(v) => setQuery({ tab: v === "on-clock" ? null : v })}>
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList className="h-auto w-max flex-nowrap gap-1 p-1">
            {(Object.keys(TAB_KEYS) as TripTab[]).map((key) => (
              <TabsTrigger key={key} value={key}>
                {t(TAB_KEYS[key])}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="on-clock" className="mt-4">
          <OnClockList reload={reload} onOpen={openTrip} />
        </TabsContent>
        <TabsContent value="upcoming" className="mt-4">
          <UpcomingList reload={reload} onOpen={openTrip} emptyAction={newTripButton} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryList
            reload={reload}
            filters={history}
            onOpen={openTrip}
            onFilters={(f) =>
              setQuery({
                tech: f.technicianId ? String(f.technicianId) : null,
                from: f.from || null,
                to: f.to || null,
                q: f.search || null,
              })
            }
          />
        </TabsContent>
      </Tabs>

      <NewTripDialog open={newOpen} onOpenChange={setNewOpen} onCreated={onCreated} />

      <TripDrawer
        tripId={openTripId}
        onOpenChange={(open) => !open && setQuery({ trip: null })}
        issuedToken={openTripId ? issuedTokens[openTripId] ?? null : null}
        onLinkIssued={(id, token) => setIssuedTokens((cur) => ({ ...cur, [id]: token }))}
        onChanged={bump}
      />

      {shownLink && (
        <TripLinkDialog
          open
          onOpenChange={(open) => !open && setShownLink(null)}
          url={shownLink.url}
          shareText={shownLink.shareText}
          technicianName={shownLink.technicianName}
        />
      )}
    </div>
  );
}
