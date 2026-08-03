"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { VideoQuality } from "livekit-client";
import { X, Volume2, VolumeX, Radio, PhoneOff } from "lucide-react";
import { useDriveThruStore } from "@/lib/store/drive-thru.store";
import { useSelectedStoreStore } from "@/lib/store";
import { screenProjectService } from "@/lib/api/services/screen-project.service";
import { ScreenTile } from "../screen-tile";
import { MediaLibraryTrigger } from "../media-library/media-library-trigger";
import { MediaLibrarySheet } from "../media-library/media-library-sheet";
import { cn } from "@/lib/utils";

/** Re-fetch the scoped supervisor token well before any realistic JWT TTL. */
const TOKEN_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Global drive-thru connection + sheet, mounted once in AppShell so it
 * survives route navigation. The LiveKit connection (via <ScreenTile>) is
 * ALWAYS mounted once `connection` is set in the store, regardless of
 * `isSheetOpen` — only its visual position/animation state changes. This is
 * deliberate: the shared <Sheet> primitive unmounts its content on close
 * (traced via Radix's Presence/Portal), which would kill the connection and
 * stop audio. Custom framer-motion chrome is used here instead for exactly
 * that reason.
 *
 * z-index is deliberately kept above the Screen Project PiP overlay's z-9999
 * (backdrop/panel/video here all sit at 10000+) so the drive-thru sheet's
 * dimmed backdrop correctly covers the PiP mini-player instead of it poking
 * through, if both happen to be active at once.
 */
export function DriveThruOverlay() {
  const connection = useDriveThruStore((s) => s.connection);
  const isSheetOpen = useDriveThruStore((s) => s.isSheetOpen);
  const isMuted = useDriveThruStore((s) => s.isMuted);
  const connectionAttempt = useDriveThruStore((s) => s.connectionAttempt);
  const closeSheet = useDriveThruStore((s) => s.closeSheet);
  const toggleMute = useDriveThruStore((s) => s.toggleMute);
  const disconnect = useDriveThruStore((s) => s.disconnect);
  const refreshToken = useDriveThruStore((s) => s.refreshToken);
  const setLive = useDriveThruStore((s) => s.setLive);

  const selectedStore = useSelectedStoreStore((s) => s.selectedStore);

  const [pushToTalkActive, setPushToTalkActive] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  // Disconnect if the globally-selected store changes — the token is store-scoped.
  useEffect(() => {
    if (!connection) return;
    if (selectedStore?.storeId && selectedStore.storeId !== connection.storeId) {
      disconnect();
    }
  }, [selectedStore?.storeId, connection, disconnect]);

  // Proactively refresh the token before it can expire. ScreenTile's own
  // retry-on-error card is click-to-retry, which is invisible while this
  // tile is hidden off-screen — headless recovery can't rely on it.
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (!connection) return;
    const { storeId, stationId, roomName } = connection;
    refreshTimerRef.current = setInterval(() => {
      screenProjectService
        .getSupervisorTokens(storeId, undefined, [stationId])
        .then((tokenData) => {
          const entry = tokenData.tokens.find((t) => t.room === roomName);
          if (entry) refreshToken(entry.token);
        })
        .catch(() => {
          // Silently retried on the next interval tick.
        });
    }, TOKEN_REFRESH_INTERVAL_MS);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [connection, refreshToken]);

  if (!connection) return null;

  return (
    <>
      {/* The actual LiveKit connection — always mounted while `connection` is
          set. Never conditionally rendered/unmounted — only animated between
          a "docked" (off-screen, translated fully past the right edge) and
          "open" (slid into view, matching the panel's own slide) state, in
          lockstep with the panel below, so it visually slides in/out with the
          sheet instead of popping in. Audio keeps playing in both states. */}
      <motion.div
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: isSheetOpen ? 0 : "100%", opacity: isSheetOpen ? 1 : 0 }}
        transition={{ type: "tween", duration: 0.2 }}
        style={{ pointerEvents: isSheetOpen ? "auto" : "none" }}
        className="fixed top-14 right-0 z-[10002] aspect-video w-full max-w-md overflow-hidden bg-neutral-900 shadow-2xl"
      >
        <ScreenTile
          key={connectionAttempt}
          name={connection.name}
          roomName={connection.roomName}
          token={connection.token}
          serverUrl={connection.serverUrl}
          isMain={false}
          isVideoEnabled={true}
          isAudioEnabled={!isMuted}
          myMicEnabled={pushToTalkActive}
          myCamEnabled={false}
          onToggleVideo={() => {}}
          onToggleAudio={toggleMute}
          volume={isMuted ? 0 : 1}
          videoQuality={VideoQuality.LOW}
          viewerOnly={true}
          onConnectionStateChange={setLive}
          className="absolute inset-0 h-full w-full"
        />
      </motion.div>

      {/* Sheet chrome — plain backdrop + slide-in panel (not the shared Sheet
          primitive) so closing it never unmounts the ScreenTile above. */}
      <AnimatePresence>
        {isSheetOpen && (
          <>
            <motion.div
              key="drive-thru-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[10000] bg-black/50"
              onClick={closeSheet}
            />
            <motion.div
              key="drive-thru-panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.2 }}
              className="fixed inset-y-0 right-0 z-[10001] flex w-full max-w-md flex-col bg-neutral-950 shadow-2xl"
            >
              {/* Header — fixed h-14 so it lines up with the floating video's top-14 offset */}
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{connection.name}</p>
                  <p className="text-xs text-white/50">Drive Thru</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <MediaLibraryTrigger onClick={() => setIsLibraryOpen(true)} />
                  <button
                    onClick={closeSheet}
                    className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Reserved video space — the floating tile above renders on top of this rect */}
              <div className="aspect-video w-full shrink-0" />

              {/* Controls */}
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
                <button
                  onClick={toggleMute}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full transition-colors",
                    isMuted ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white/80 hover:bg-white/15",
                  )}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>

                {/* Push to talk — hold to broadcast, same interaction as "Talk to All" */}
                <button
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setPushToTalkActive(true);
                  }}
                  onPointerUp={() => setPushToTalkActive(false)}
                  onPointerCancel={() => setPushToTalkActive(false)}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-pressed={pushToTalkActive}
                  aria-label="Hold to talk to the drive-thru"
                  className={cn(
                    "flex h-20 w-20 select-none items-center justify-center rounded-full transition-all duration-150",
                    pushToTalkActive
                      ? "bg-red-600 text-white shadow-lg shadow-red-900/40 ring-4 ring-red-500/40"
                      : "bg-white/10 text-white/80 hover:bg-white/15",
                  )}
                  title="Hold to talk"
                >
                  <Radio className={cn("h-7 w-7", pushToTalkActive && "animate-pulse")} />
                </button>
                <p className="text-xs text-white/50">
                  {pushToTalkActive ? "Talking…" : "Hold to talk"}
                </p>

                <button
                  onClick={disconnect}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <PhoneOff className="h-3.5 w-3.5" />
                  Disconnect
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Media library — separate shadcn Sheet, unrelated to the LiveKit
          connection above, safe to mount/unmount normally on open/close. */}
      <MediaLibrarySheet
        open={isLibraryOpen}
        onOpenChange={setIsLibraryOpen}
        storeId={connection.storeId}
        stationNumber={connection.stationId}
        stationName={connection.name}
        overlayClassName="z-[10010]"
        contentClassName="z-[10011]"
      />
    </>
  );
}
