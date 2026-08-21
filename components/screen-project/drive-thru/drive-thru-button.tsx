"use client";

import { useEffect, useState } from "react";
import { Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useSelectedStoreStore } from "@/lib/store";
import { useDriveThruStore } from "@/lib/store/drive-thru.store";
import { useCanAccessRoute } from "@/lib/auth/use-auth";
import { useAuthStore } from "@/lib/auth/auth.store";
import { screenProjectService } from "@/lib/api/services/screen-project.service";
import type { Station } from "@/types/screen-project.types";

/**
 * Global topbar indicator for the drive-thru connection. Red = disconnected,
 * green = live. Clicking it while disconnected asks for confirmation first,
 * then establishes the connection; once connected, it just toggles the sheet.
 * The connection itself is owned by <DriveThruOverlay />, mounted separately
 * in AppShell.
 */
export function DriveThruButton() {
  const selectedStore = useSelectedStoreStore((s) => s.selectedStore);
  const storeId = selectedStore?.storeId ?? ""; // human-readable code, used for API calls below
  const overviewStores = useAuthStore((s) => s.overviewStores);
  // Same rule as the "Screen Project" sidebar nav item: wildcard path +
  // the numeric id that actually keys storePermissions (not the human-readable
  // storeId code used elsewhere for API calls).
  const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;
  const canAccess = useCanAccessRoute({
    service: "Screens",
    method: "POST",
    path: `/*/tokens/supervisor`,
    storeId: effectiveStoreId,
  });

  const connection = useDriveThruStore((s) => s.connection);
  const isLive = useDriveThruStore((s) => s.isLive);
  const isConnecting = useDriveThruStore((s) => s.isConnecting);
  const setConnecting = useDriveThruStore((s) => s.setConnecting);
  const connect = useDriveThruStore((s) => s.connect);
  const openSheet = useDriveThruStore((s) => s.openSheet);
  const toggleSheet = useDriveThruStore((s) => s.toggleSheet);

  const [driveThruStation, setDriveThruStation] = useState<Station | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Discover whether this store even has a drive-thru station — presence check
  // only, does not fetch a token or open a connection.
  useEffect(() => {
    if (!storeId || !canAccess) {
      setDriveThruStation(null);
      return;
    }
    let cancelled = false;
    screenProjectService
      .getStations(storeId)
      .then((stations) => {
        if (cancelled) return;
        setDriveThruStation(stations.find((s) => s.type === "drive_through") ?? null);
      })
      .catch(() => {
        if (!cancelled) setDriveThruStation(null);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, canAccess]);

  if (!canAccess) return null;
  // Nothing to connect to, and not already connected from a prior session — hide entirely.
  if (!connection && !driveThruStation) return null;

  const handleClick = () => {
    if (connection) {
      toggleSheet();
      return;
    }
    if (isConnecting || !storeId || !driveThruStation) return;
    setConfirmOpen(true);
  };

  const performConnect = async () => {
    if (!storeId || !driveThruStation) return;
    setConnecting(true);
    try {
      const tokenData = await screenProjectService.getSupervisorTokens(storeId, undefined, [driveThruStation.id]);
      const entry = tokenData.tokens.find((t) => t.room === driveThruStation.room_name) ?? tokenData.tokens[0];
      if (!entry) {
        setConnecting(false);
        return;
      }
      connect({
        roomName: entry.room,
        name: driveThruStation.name,
        token: entry.token,
        serverUrl: tokenData.server_url,
        storeId,
        stationId: driveThruStation.id,
      });
      openSheet();
    } catch {
      setConnecting(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={isLive ? "Drive Thru (connected)" : "Drive Thru (disconnected)"}
        title={isLive ? "Drive Thru — connected" : "Drive Thru — click to connect"}
        onClick={handleClick}
        disabled={isConnecting}
      >
        <Car className="h-[1.2rem] w-[1.2rem]" />
        <span
          className={cn(
            "absolute -top-0.5 -end-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background",
            isLive ? "bg-green-500" : "bg-destructive",
          )}
        />
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Connect to Drive Thru?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll be connected to{" "}
              <span className="font-medium text-foreground">{driveThruStation?.name}</span>
              {" "}and able to hear and talk to the drive-thru. The connection stays
              active in the background until you disconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                performConnect();
              }}
            >
              Connect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
