"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { VideoQuality } from "livekit-client";
import { X, Volume2, VolumeX, Radio, PhoneOff, AlertTriangle } from "lucide-react";
import { useDriveThruStore } from "@/lib/store/drive-thru.store";
import { useSelectedStoreStore } from "@/lib/store";
import { screenProjectService } from "@/lib/api/services/screen-project.service";
import { playSfx } from "@/lib/uisfx/play";
import { ScreenTile } from "../screen-tile";
import { MediaLibraryTrigger } from "../media-library/media-library-trigger";
import { MediaLibrarySheet } from "../media-library/media-library-sheet";
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
import type { StationMedia } from "@/types/screen-project-media.types";

/** Re-fetch the scoped supervisor token well before any realistic JWT TTL. */
const TOKEN_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

/** How long the mic can stay open before we warn the operator it'll auto-close. */
const TALK_WARNING_AFTER_MS = 90_000; // 1:30
/** Grace period shown as a countdown after the warning appears, before auto-close. */
const TALK_GRACE_PERIOD_MS = 20_000;

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

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  // ── Toggle-to-talk with an auto-timeout safety net ─────────────────────────
  // Click starts talking (no need to hold the mouse down — the operator needs
  // their hands free for a separate POS app). To guard against the mic being
  // left open unattended, it auto-warns after TALK_WARNING_AFTER_MS with a
  // countdown + sound, and auto-closes after TALK_GRACE_PERIOD_MS if not
  // extended. These timers run regardless of whether the sheet is open — the
  // warning sound is what reaches the operator while they're in another app;
  // the visual countdown is just a bonus if the sheet happens to be open.
  const [talkActive, setTalkActive] = useState(false);
  const [warningSecondsLeft, setWarningSecondsLeft] = useState<number | null>(null);
  const [justClosed, setJustClosed] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const talkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const justClosedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTalkTimers = useCallback(() => {
    if (talkTimeoutRef.current) {
      clearTimeout(talkTimeoutRef.current);
      talkTimeoutRef.current = null;
    }
    if (warningIntervalRef.current) {
      clearInterval(warningIntervalRef.current);
      warningIntervalRef.current = null;
    }
    setWarningSecondsLeft(null);
  }, []);

  const handleAutoClose = useCallback(() => {
    clearTalkTimers();
    setTalkActive(false);
    setJustClosed(true);
    if (justClosedTimeoutRef.current) clearTimeout(justClosedTimeoutRef.current);
    justClosedTimeoutRef.current = setTimeout(() => setJustClosed(false), 3000);
  }, [clearTalkTimers]);

  const startWarningCountdown = useCallback(() => {
    playSfx("warning");
    setWarningSecondsLeft(TALK_GRACE_PERIOD_MS / 1000);
    warningIntervalRef.current = setInterval(() => {
      setWarningSecondsLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          handleAutoClose();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [handleAutoClose]);

  const startTalkTimer = useCallback(() => {
    talkTimeoutRef.current = setTimeout(startWarningCountdown, TALK_WARNING_AFTER_MS);
  }, [startWarningCountdown]);

  const handleToggleTalk = useCallback(() => {
    setJustClosed(false);
    if (talkActive) {
      clearTalkTimers();
      setTalkActive(false);
      return;
    }
    setTalkActive(true);
    startTalkTimer();
  }, [talkActive, clearTalkTimers, startTalkTimer]);

  const handleExtend = useCallback(() => {
    clearTalkTimers();
    startTalkTimer();
  }, [clearTalkTimers, startTalkTimer]);

  // Closing the sheet while the mic is active is gated behind a confirmation —
  // otherwise it's very easy to walk away thinking the mic closed with it.
  const handleRequestCloseSheet = useCallback(() => {
    if (talkActive) {
      setCloseConfirmOpen(true);
      return;
    }
    closeSheet();
  }, [talkActive, closeSheet]);

  const handleConfirmCloseAndStopMic = useCallback(() => {
    clearTalkTimers();
    setTalkActive(false);
    setCloseConfirmOpen(false);
    closeSheet();
  }, [clearTalkTimers, closeSheet]);

  // Reset all talk state whenever there's no active connection (disconnect,
  // store switch, or initial mount) so nothing leaks into a future reconnect.
  useEffect(() => {
    if (connection) return;
    clearTalkTimers();
    setTalkActive(false);
    setJustClosed(false);
    setCloseConfirmOpen(false);
  }, [connection, clearTalkTimers]);

  // Handed to us by <ScreenTile> — broadcasts a media list to the station over
  // the same "station-media" data-channel topic its built-in MediaLibrarySheet
  // trigger uses, so our own separate MediaLibrarySheet below can push live
  // updates too instead of requiring the station to reload.
  const publishMediaRef = useRef<((media: StationMedia[]) => void) | null>(null);
  const handleMediaPublisherReady = useCallback((publish: (media: StationMedia[]) => void) => {
    publishMediaRef.current = publish;
  }, []);

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
          myMicEnabled={talkActive}
          myCamEnabled={false}
          onToggleVideo={() => {}}
          onToggleAudio={toggleMute}
          volume={isMuted ? 0 : 1}
          videoQuality={VideoQuality.LOW}
          viewerOnly={true}
          onConnectionStateChange={setLive}
          onMediaPublisherReady={handleMediaPublisherReady}
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
              onClick={handleRequestCloseSheet}
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
                    onClick={handleRequestCloseSheet}
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

                {/* Talk toggle — click to start/stop, no holding required */}
                <button
                  onClick={handleToggleTalk}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-pressed={talkActive}
                  aria-label={talkActive ? "Stop talking to the drive-thru" : "Start talking to the drive-thru"}
                  className={cn(
                    "flex h-20 w-20 select-none items-center justify-center rounded-full transition-all duration-150",
                    talkActive
                      ? "bg-red-600 text-white shadow-lg shadow-red-900/40 ring-4 ring-red-500/40"
                      : "bg-white/10 text-white/80 hover:bg-white/15",
                  )}
                  title={talkActive ? "Tap to stop talking" : "Tap to talk"}
                >
                  <Radio className={cn("h-7 w-7", talkActive && "animate-pulse")} />
                </button>

                {warningSecondsLeft !== null ? (
                  <div className="w-full rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-center">
                    <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-amber-400">
                      <AlertTriangle className="h-4 w-4" />
                      Mic will close in {warningSecondsLeft}s
                    </p>
                    <p className="mt-1 text-xs text-amber-400/80">Still on the call? Do you want to extend?</p>
                    <button
                      onClick={handleExtend}
                      className="mt-2 rounded-lg bg-amber-400/20 px-4 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/30 transition-colors"
                    >
                      Extend
                    </button>
                  </div>
                ) : justClosed ? (
                  <p className="text-xs text-white/50">Mic closed</p>
                ) : (
                  <p className="text-xs text-white/50">
                    {talkActive ? "Talking — tap to stop" : "Tap to talk"}
                  </p>
                )}

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
        onMediaChange={(media) => publishMediaRef.current?.(media)}
        overlayClassName="z-[10010]"
        contentClassName="z-[10011]"
        alertOverlayClassName="z-[10020]"
        alertContentClassName="z-[10021]"
      />

      {/* Close-while-talking confirmation — nested inside our own very-high-z
          panel, so it needs the same z-index override as the media library's
          delete confirmation, bumped clearly above that range too. */}
      <AlertDialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <AlertDialogContent overlayClassName="z-[10030]" className="z-[10031]">
          <AlertDialogHeader>
            <AlertDialogTitle>Mic is still on</AlertDialogTitle>
            <AlertDialogDescription>
              Closing this will turn off your microphone. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCloseAndStopMic}>
              Close &amp; turn off mic
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
