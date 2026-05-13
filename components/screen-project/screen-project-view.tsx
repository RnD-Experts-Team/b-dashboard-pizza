"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, UserCircle2, AlertCircle, RefreshCw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Radio, Camera, CameraOff } from "lucide-react";
import { VideoQuality } from "livekit-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScreenTile } from "./screen-tile";
import { StationsDialog } from "./stations-dialog";
import { useScreenProject } from "@/lib/hooks/use-screen-project";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";
import { useSelectedStoreStore } from "@/lib/store";
import { NetworkBadge } from "./network-badge";
import { useScreenProjectPiPStore } from "@/lib/store/screen-project-pip.store";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Per-screen A/V state                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

interface ScreenState {
  audioEnabled: boolean;
  videoEnabled: boolean;
  volume: number;
  /** Whether the supervisor's own camera is published into this room */
  myCamEnabled: boolean;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Layout constants & position helpers                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

/** Desktop side-panel tile dimensions (px) */
const DESK_SIDE_W = 176; // w-44
const DESK_SIDE_H = 112; // h-28
/** Mobile side-strip tile dimensions (px) */
const MOB_SIDE_H = 144; // h-36
const MOB_SIDE_W = 144; // w-36
/** Gap between main area and the side strip (px) */
const PANEL_GAP = 12;
/** Container width at which the desktop (side-column) layout activates */
const LG_BREAKPOINT = 1024;

interface TileRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Compute the absolute pixel rect for a tile inside the single tile-area
 * container. Tiles are always mounted; only their CSS position changes.
 *
 * @param isMain      true for the featured tile
 * @param sideIndex   0-based index among non-main tiles  (-1 when isMain)
 */
function computeTileRect(
  isMain: boolean,
  sideIndex: number,
  containerW: number,
  containerH: number,
  hasSidePanel: boolean,
  sideScroll: number,
): TileRect {
  const isLg = containerW >= LG_BREAKPOINT;
  if (isMain) {
    if (isLg) {
      const reservedW = hasSidePanel ? DESK_SIDE_W + PANEL_GAP : 0;
      return { top: 0, left: 0, width: containerW - reservedW, height: containerH };
    } else {
      const reservedH = hasSidePanel ? MOB_SIDE_H + PANEL_GAP : 0;
      return { top: 0, left: 0, width: containerW, height: containerH - reservedH };
    }
  } else {
    if (isLg) {
      return {
        top: sideIndex * (DESK_SIDE_H + PANEL_GAP) - sideScroll,
        left: containerW - DESK_SIDE_W,
        width: DESK_SIDE_W,
        height: DESK_SIDE_H,
      };
    } else {
      return {
        top: containerH - MOB_SIDE_H,
        left: sideIndex * (MOB_SIDE_W + PANEL_GAP) - sideScroll,
        width: MOB_SIDE_W,
        height: MOB_SIDE_H,
      };
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  ScreenProjectView                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

export function ScreenProjectView() {
  /**
   * tileAreaRef is the single container that holds ALL ScreenTile instances.
   * Tiles are never unmounted; only their absolute position/size changes when
   * the user clicks a side tile, so LiveKit connections stay alive.
   */
  /**
   * Callback ref for the tile container — sets up ResizeObserver the moment
   * the div mounts (even after an early loading/error return). Also stored in
   * `tileAreaDomRef` so framer-motion dragConstraints can read `.current`.
   */
  const tileAreaDomRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const tileAreaRef = useCallback((el: HTMLDivElement | null) => {
    // Tear down previous observer when element unmounts or changes
    roRef.current?.disconnect();
    tileAreaDomRef.current = el;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setContainerSize({ width: r.width, height: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    roRef.current = ro;
  }, []);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  /** Measured dimensions of the tile container — drives responsive layout math. */
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const selectedStore = useSelectedStoreStore((s) => s.selectedStore);
  const storeId = selectedStore?.storeId ?? "";

  const networkStatus = useNetworkStatus();

  const activatePiP = useScreenProjectPiPStore((s) => s.activatePiP);
  const closePiP = useScreenProjectPiPStore((s) => s.closePiP);

  const { stations, serverUrl, tokenMap, isLoading, error, refetch } =
    useScreenProject();

  const [mainId, setMainId] = useState<string>("");
  const [screenStates, setScreenStates] = useState<Record<string, ScreenState>>({});

  const [myMicMuted, setMyMicMuted] = useState(true);
  const [myVideoOff, setMyVideoOff] = useState(true);
  const [myCamVisible, setMyCamVisible] = useState(false);
  const [broadcastToAll, setBroadcastToAll] = useState(false);
  const [sideScroll, setSideScroll] = useState(0);

  // Start/stop local camera preview for the PiP self-view
  useEffect(() => {
    const shouldCapture = myCamVisible && !myVideoOff;
    if (!shouldCapture) {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      })
      .catch(() => {});
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, [myCamVisible, myVideoOff]);

  // Initialise per-screen state when stations load (or store changes)
  useEffect(() => {
    if (stations.length === 0) {
      setMainId("");
      setScreenStates({});
      return;
    }
    setMainId((prev) => {
      const stillExists = stations.some((s) => s.room_name === prev);
      return stillExists ? prev : stations[0].room_name;
    });
    setScreenStates((prev) => {
      const next: Record<string, ScreenState> = {};
      stations.forEach((s, i) => {
        next[s.room_name] = prev[s.room_name] ?? {
          audioEnabled: i === 0,
          videoEnabled: true,
          volume: 1,
          myCamEnabled: false,
        };
      });
      return next;
    });
  }, [stations]);

  // Reset side-panel scroll when the stations list changes
  useEffect(() => { setSideScroll(0); }, [stations]);

  /**
   * PiP activation on route leave.
   * When this component unmounts (user navigates away), if there is an active
   * main station with a valid token and server URL, we hand it off to the
   * global PiP store so it survives across routes.
   * We use a ref to capture the latest values without re-running the effect.
   */
  const pipHandoffRef = useRef<{
    mainId: string;
    stations: typeof stations;
    tokenMap: Record<string, string>;
    serverUrl: string;
    storeId: string;
  } | null>(null);

  /** Tracks which room_names are currently live (connected + video track). */
  const liveRoomsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    pipHandoffRef.current = { mainId, stations, tokenMap, serverUrl, storeId };
  });

  useEffect(() => {
    // On mount, hide any existing PiP — we are on the Screen Project page now
    closePiP();
    return () => {
      // On unmount (route leave), activate PiP only for a live station
      const snap = pipHandoffRef.current;
      if (!snap) return;
      const { mainId: id, stations: stns, tokenMap: tMap, serverUrl: sUrl, storeId: sId } = snap;
      if (!id || !sUrl) return;

      const liveSet = liveRoomsRef.current;
      // Priority: main station if live, otherwise first live station
      const pipRoomName = liveSet.has(id)
        ? id
        : stns.find((s) => liveSet.has(s.room_name))?.room_name ?? null;
      if (!pipRoomName) return; // nothing live — skip PiP

      const station = stns.find((s) => s.room_name === pipRoomName);
      const token = tMap[pipRoomName];
      if (!station || !token) return;
      activatePiP({
        roomName: station.room_name,
        name: station.name,
        token,
        serverUrl: sUrl,
        storeId: sId,
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasSidePanel = stations.length > 1;
  const anyAudioEnabled = stations.some((s) => screenStates[s.room_name]?.audioEnabled);
  const anyMyCamEnabled = stations.some((s) => screenStates[s.room_name]?.myCamEnabled);

  // Side-panel virtual scroll limits
  const isLg = containerSize.width >= LG_BREAKPOINT;
  // Reset scroll when layout mode flips (desktop ↔ mobile)
  useEffect(() => { setSideScroll(0); }, [isLg]);
  const sideTileCount = Math.max(0, stations.length - 1);
  const sideContentLen =
    sideTileCount > 0
      ? sideTileCount * (isLg ? DESK_SIDE_H : MOB_SIDE_W) +
        (sideTileCount - 1) * PANEL_GAP
      : 0;
  const maxSideScroll = Math.max(
    0,
    sideContentLen - (isLg ? containerSize.height : containerSize.width) + PANEL_GAP,
  );
  const clampedSideScroll = Math.min(sideScroll, maxSideScroll);
  const canScrollBack = clampedSideScroll > 0;
  const canScrollFwd = clampedSideScroll < maxSideScroll;

  /**
   * Cross-fade swap:
   * 1. Fade out only the two tiles changing roles (opacity → 0, 150 ms)
   * 2. At peak-invisible: snap both tiles to their new positions
   * 3. Fade back in (opacity → 1, 150 ms)
   * No position animation needed — position changes while tiles are invisible.
   */
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());

  const handleSwap = useCallback(
    (id: string) => {
      if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
      setFadingIds(new Set([id, mainId]));
      swapTimerRef.current = setTimeout(() => {
        setMainId(id);
        setFadingIds(new Set());
        swapTimerRef.current = null;
      }, 150);
    },
    [mainId],
  );

  const handleToggleVideo = useCallback((id: string) => {
    setScreenStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], videoEnabled: !prev[id].videoEnabled },
    }));
  }, []);

  const handleToggleAudio = useCallback((id: string) => {
    setScreenStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], audioEnabled: !prev[id].audioEnabled },
    }));
  }, []);

  const handleVolumeChange = useCallback((id: string, v: number) => {
    setScreenStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], volume: v },
    }));
  }, []);

  const handleMuteAllToggle = useCallback(() => {
    const target = !anyAudioEnabled;
    setScreenStates((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        next[id] = { ...next[id], audioEnabled: target };
      });
      return next;
    });
  }, [anyAudioEnabled]);

  const handleToggleMyCam = useCallback((id: string) => {
    setScreenStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], myCamEnabled: !prev[id].myCamEnabled },
    }));
  }, []);

  const handleCamToAllToggle = useCallback(() => {
    const target = !anyMyCamEnabled;
    setScreenStates((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        next[id] = { ...next[id], myCamEnabled: target };
      });
      return next;
    });
  }, [anyMyCamEnabled]);

  const handleSidePanelWheel = useCallback(
    (e: WheelEvent) => {
      if (!hasSidePanel || maxSideScroll <= 0) return;
      const target = tileAreaDomRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const inSidePanel =
        containerSize.width >= LG_BREAKPOINT
          ? e.clientX - rect.left >= containerSize.width - DESK_SIDE_W
          : e.clientY - rect.top >= containerSize.height - MOB_SIDE_H;
      if (!inSidePanel) return;
      e.preventDefault();
      setSideScroll((prev) =>
        Math.max(0, Math.min(maxSideScroll, prev + e.deltaY)),
      );
    },
    [hasSidePanel, maxSideScroll, containerSize],
  );

  // Attach a non-passive wheel listener so preventDefault() actually works.
  // (React's onWheel prop registers a passive listener in modern browsers.)
  const wheelHandlerRef = useRef(handleSidePanelWheel);
  useEffect(() => { wheelHandlerRef.current = handleSidePanelWheel; }, [handleSidePanelWheel]);
  useEffect(() => {
    const el = tileAreaDomRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => wheelHandlerRef.current(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  // Re-attach when the DOM element itself changes (callback ref fires again)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileAreaDomRef.current]);

  /* ── Loading ────────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/70" />
          <p className="text-sm">Loading stations...</p>
        </div>
      </div>
    );
  }

  /* ── Error ──────────────────────────────────────────────────────── */
  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={refetch} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  /* ── No store selected / no stations ───────────────────────────── */
  if (stations.length === 0 || !mainId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            No stations found. Create one to get started.
          </p>
          <StationsDialog
            storeId={storeId}
            stations={stations}
            onRefetch={refetch}
          />
        </div>
      </div>
    );
  }

  /* ── Derive per-tile metadata ────────────────────────────────────── */
  // Build a flat annotated list so we can render all tiles in one .map()
  // from a single container — key never changes = no remount = no reconnect.
  let sideCounter = 0;
  const stationsMeta = stations.map((s) => {
    const isMain = s.room_name === mainId;
    return { ...s, isMain, sideIdx: isMain ? -1 : sideCounter++ };
  });

  /* ── Main view ──────────────────────────────────────────────────── */
  return (
    <div className="flex h-full flex-col gap-3">
      {/*
       * Single tile area — ALL ScreenTile instances live here permanently.
       * Clicking a side tile only changes `mainId` state. Each tile's
       * absolute position/size is animated by framer-motion `layout` (FLIP),
       * so no tile ever unmounts and LiveKit connections stay alive.
       */}
      <div className="relative flex-1 min-h-0 overflow-hidden" ref={tileAreaRef}>
        {containerSize.width > 0 &&
          stationsMeta.map((s) => {
            const rect = computeTileRect(
              s.isMain,
              s.sideIdx,
              containerSize.width,
              containerSize.height,
              hasSidePanel,
              clampedSideScroll,
            );
            return (
              <motion.div
                key={s.room_name}
                style={{ position: "absolute", ...rect }}
                animate={{ opacity: fadingIds.has(s.room_name) ? 0 : 1 }}
                transition={{ duration: 0.15, ease: "easeInOut" }}
              >
                <ScreenTile
                  name={s.name}
                  roomName={s.room_name}
                  token={tokenMap[s.room_name] ?? ""}
                  serverUrl={serverUrl}
                  isMain={s.isMain}
                  myMicEnabled={!myMicMuted && (broadcastToAll || s.isMain)}
                  myCamEnabled={!myVideoOff && (s.isMain || (screenStates[s.room_name]?.myCamEnabled ?? false))}
                  onToggleMyCam={!s.isMain ? () => handleToggleMyCam(s.room_name) : undefined}
                  onClick={!s.isMain ? () => handleSwap(s.room_name) : undefined}
                  isVideoEnabled={screenStates[s.room_name]?.videoEnabled ?? true}
                  isAudioEnabled={screenStates[s.room_name]?.audioEnabled ?? false}
                  onToggleVideo={() => handleToggleVideo(s.room_name)}
                  onToggleAudio={() => handleToggleAudio(s.room_name)}
                  volume={screenStates[s.room_name]?.volume ?? 1}
                  onVolumeChange={(v) => handleVolumeChange(s.room_name, v)}
                  videoQuality={s.isMain ? VideoQuality.HIGH : VideoQuality.LOW}
                  onLiveChange={(live) => {
                    if (live) liveRoomsRef.current.add(s.room_name);
                    else liveRoomsRef.current.delete(s.room_name);
                  }}
                  className="h-full w-full"
                />
              </motion.div>
            );
          })}

        {/* Side-panel scroll arrows */}
        {hasSidePanel && containerSize.width > 0 && maxSideScroll > 0 && (
          isLg ? (
            <>
              {canScrollBack && (
                <button
                  onClick={() => setSideScroll((p) => Math.max(0, p - (DESK_SIDE_H + PANEL_GAP)))}
                  className="absolute top-2 right-2 z-30 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/80 hover:bg-black/80 hover:text-white transition-colors"
                  aria-label="Scroll side panel up"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
              )}
              {canScrollFwd && (
                <button
                  onClick={() => setSideScroll((p) => Math.min(maxSideScroll, p + (DESK_SIDE_H + PANEL_GAP)))}
                  className="absolute bottom-2 right-2 z-30 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/80 hover:bg-black/80 hover:text-white transition-colors"
                  aria-label="Scroll side panel down"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              )}
            </>
          ) : (
            <>
              {canScrollBack && (
                <button
                  onClick={() => setSideScroll((p) => Math.max(0, p - (MOB_SIDE_W + PANEL_GAP)))}
                  className="absolute bottom-4 left-2 z-30 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/80 hover:bg-black/80 hover:text-white transition-colors"
                  aria-label="Scroll side panel left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              {canScrollFwd && (
                <button
                  onClick={() => setSideScroll((p) => Math.min(maxSideScroll, p + (MOB_SIDE_W + PANEL_GAP)))}
                  className="absolute bottom-4 right-2 z-30 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/80 hover:bg-black/80 hover:text-white transition-colors"
                  aria-label="Scroll side panel right"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </>
          )
        )}

        {/* PiP self-view — draggable overlay constrained to the tile area */}
        <motion.div
          drag
          dragConstraints={tileAreaDomRef}
          dragElastic={0.08}
          dragMomentum={false}
          animate={myCamVisible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "absolute bottom-14 left-3 z-20 cursor-grab active:cursor-grabbing",
            !myCamVisible && "pointer-events-none",
          )}
        >
          <div className="relative w-36 h-24 rounded-lg overflow-hidden ring-2 ring-white/30 shadow-xl bg-neutral-800">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={cn(
                "absolute inset-0 h-full w-full object-cover scale-x-[-1]",
                myVideoOff && "hidden",
              )}
            />
            {myVideoOff && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-neutral-800">
                <UserCircle2 className="h-8 w-8 text-white/40" />
                <span className="text-[0.6rem] text-white/40">Camera off</span>
              </div>
            )}
            {myMicMuted && (
              <div className="absolute top-1 right-1 rounded bg-black/60 p-0.5">
                <MicOff className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Bottom control bar */}
      <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <NetworkBadge status={networkStatus} />
          <StationsDialog
            storeId={storeId}
            stations={stations}
            onRefetch={refetch}
          />
        </div>

        <div className="flex items-center gap-2 mx-auto sm:mx-0">
          <Button
            variant={myMicMuted ? "destructive" : "secondary"}
            size="sm"
            onClick={() => {
              setMyMicMuted((v) => {
                if (!v) setBroadcastToAll(false); // muting mic clears broadcast
                return !v;
              });
            }}
            className="gap-1.5"
            aria-label={myMicMuted ? "Unmute my microphone" : "Mute my microphone"}
          >
            {myMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            <span className="hidden sm:inline">
              {myMicMuted ? "Mic Off" : "Mic On"}
            </span>
          </Button>

          <button
            disabled={myMicMuted}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setBroadcastToAll(true);
            }}
            onPointerUp={() => setBroadcastToAll(false)}
            onPointerCancel={() => setBroadcastToAll(false)}
            onContextMenu={(e) => e.preventDefault()}
            title={myMicMuted ? "Unmute mic first" : "Hold to talk to all screens"}
            aria-label="Hold to talk to all screens"
            aria-pressed={broadcastToAll}
            className={cn(
              "inline-flex select-none items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-50",
              broadcastToAll
                ? "bg-red-600 text-white ring-2 ring-red-400/70 ring-offset-1 ring-offset-background"
                : "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Radio className={cn("h-4 w-4", broadcastToAll && "animate-pulse")} />
            <span className="hidden sm:inline">
              {broadcastToAll ? "Broadcasting..." : "Talk to All"}
            </span>
          </button>

          <Button
            variant={myVideoOff ? "destructive" : "secondary"}
            size="sm"
            onClick={() => setMyVideoOff((v) => !v)}
            className="gap-1.5"
            aria-label={myVideoOff ? "Turn on my camera" : "Turn off my camera"}
          >
            {myVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            <span className="hidden sm:inline">
              {myVideoOff ? "Cam Off" : "Cam On"}
            </span>
          </Button>

          <Button
            variant={myCamVisible ? "secondary" : "outline"}
            size="sm"
            onClick={() => setMyCamVisible((v) => !v)}
            className="gap-1.5"
            aria-label={myCamVisible ? "Hide self view" : "Show self view"}
          >
            <UserCircle2 className="h-4 w-4" />
            <span className="hidden sm:inline">
              {myCamVisible ? "Hide Me" : "Show Me"}
            </span>
          </Button>
        </div>

        {/* Mute all */}
        <div className="flex items-center gap-2">
          <Button
            variant={anyAudioEnabled ? "secondary" : "outline"}
            size="sm"
            onClick={handleMuteAllToggle}
            className="gap-1.5"
            aria-label={anyAudioEnabled ? "Mute all screens" : "Unmute all screens"}
          >
            {anyAudioEnabled ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            <span className="hidden sm:inline">
              {anyAudioEnabled ? "Mute All" : "Unmute All"}
            </span>
          </Button>

          <Button
            variant={anyMyCamEnabled ? "secondary" : "outline"}
            size="sm"
            onClick={handleCamToAllToggle}
            disabled={myVideoOff}
            className="gap-1.5"
            aria-label={anyMyCamEnabled ? "Disable my camera on all screens" : "Enable my camera on all screens"}
            title={myVideoOff ? "Turn on your camera first" : undefined}
          >
            {anyMyCamEnabled ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
            <span className="hidden sm:inline">
              {anyMyCamEnabled ? "Cam to All" : "Cam to None"}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}