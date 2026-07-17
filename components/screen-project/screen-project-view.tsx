"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, UserCircle2, AlertCircle, RefreshCw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Radio, Camera, CameraOff, Eye, Monitor, HelpCircle, LogOut, Check } from "lucide-react";
import { VideoQuality } from "livekit-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScreenTile } from "./screen-tile";
import type { StationStateMsg } from "./screen-tile";
import { StationsDialog } from "./stations-dialog";
import { ObserverDialog } from "./observer-dialog";
import { useScreenProject } from "@/lib/hooks/use-screen-project";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";
import { useSelectedStoreStore } from "@/lib/store";
import { NetworkBadge } from "./network-badge";
import { useScreenProjectPiPStore } from "@/lib/store/screen-project-pip.store";
import { useCanAccessRoute } from "@/lib/auth/use-auth";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageGuide } from "@/components/shared/page-guide";
import { createScreenProjectGuideSteps } from "./screen-project-guide-config";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Per-screen A/V state                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

interface ScreenState {
  audioEnabled: boolean;
  videoEnabled: boolean;
  volume: number;
  /** Whether the supervisor's own camera is published into this room */
  myCamEnabled: boolean;
  /** Station remote control */
  stationMicEnabled:  boolean;
  stationCamEnabled:  boolean;
  stationAudioInput:  string;
  stationVideoInput:  string;
  stationAudioOutput: string;
  stationFullscreen:  boolean;
  stationDevices:     StationStateMsg | null;
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
  const guideSteps = useMemo(() => createScreenProjectGuideSteps(storeId), [storeId]);

  const canSupervisor = useCanAccessRoute({ service: "Screens", method: "POST", path: `/${storeId || "store"}/tokens/supervisor` });
  const canObserver = useCanAccessRoute({ service: "Screens", method: "POST", path: `/${storeId || "store"}/tokens/observer` });

  const networkStatus = useNetworkStatus();

  const activatePiP = useScreenProjectPiPStore((s) => s.activatePiP);
  const closePiP = useScreenProjectPiPStore((s) => s.closePiP);

  /**
   * Which token type to fetch — set once the user commits to a view.
   * null = user is on the select screen (no tokens needed yet).
   */
  const [activeTokenType, setActiveTokenType] = useState<"supervisor" | "observer" | null>(() => {
    if (!canSupervisor && canObserver) return "observer"; // observer-only: fetch tokens immediately
    return null; // supervisor or both: wait until station selection is committed
  });

  const [selectedStationIds, setSelectedStationIds] = useState<number[]>([]);

  const { stations, serverUrl, tokenMap, isLoading, error, refetch } =
    useScreenProject(activeTokenType, selectedStationIds.length ? selectedStationIds : undefined);

  const [mainId, setMainId] = useState<string>("");
  const [screenStates, setScreenStates] = useState<Record<string, ScreenState>>({});

  const [myMicMuted, setMyMicMuted] = useState(true);
  const [myVideoOff, setMyVideoOff] = useState(true);
  const [myScreenShareEnabled, setMyScreenShareEnabled] = useState(false);
  const [myCamVisible, setMyCamVisible] = useState(false);
  const [broadcastToAll, setBroadcastToAll] = useState(false);
  const [sideScroll, setSideScroll] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  const [sessionExited, setSessionExited] = useState(false);

  /** "supervisor" = normal tile view, "observer" = station picker grid, "select" = view selector, "station-select" = station checklist before connecting */
  const [viewMode, setViewMode] = useState<"supervisor" | "observer" | "select" | "station-select">(() => {
    if (canSupervisor && canObserver) return "select";
    if (!canSupervisor && canObserver) return "observer";
    return "station-select"; // supervisor-only: go to station selection before connecting
  });
  /** room_name of the station currently open in the ObserverDialog */
  const [observingRoom, setObservingRoom] = useState<string | null>(null);

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
          stationMicEnabled:  true,
          stationCamEnabled:  true,
          stationAudioInput:  "",
          stationVideoInput:  "",
          stationAudioOutput: "",
          stationFullscreen:  false,
          stationDevices:     null,
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

  // Filter to only the stations the user selected before connecting (supervisor view only)
  const visibleStations =
    viewMode === "supervisor" && selectedStationIds.length > 0
      ? stations.filter((s) => selectedStationIds.includes(s.id))
      : stations;

  const hasSidePanel = visibleStations.length > 1;
  const anyAudioEnabled = visibleStations.some((s) => screenStates[s.room_name]?.audioEnabled);
  const anyMyCamEnabled = visibleStations.some((s) => screenStates[s.room_name]?.myCamEnabled);

  // Side-panel virtual scroll limits
  const isLg = containerSize.width >= LG_BREAKPOINT;
  // Reset scroll when layout mode flips (desktop ↔ mobile)
  useEffect(() => { setSideScroll(0); }, [isLg]);
  const sideTileCount = Math.max(0, visibleStations.length - 1);
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

  const handleToggleScreenShare = useCallback(() => {
    setMyScreenShareEnabled((prev) => {
      const next = !prev;
      if (next) setMyVideoOff(true); // turn camera off when screen share starts
      return next;
    });
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

  // ── Station remote control handlers ──────────────────────────────────────
  const handleToggleStationMic = useCallback((roomName: string) => {
    setScreenStates((prev) => ({
      ...prev,
      [roomName]: { ...prev[roomName], stationMicEnabled: !prev[roomName].stationMicEnabled },
    }));
  }, []);

  const handleToggleStationCam = useCallback((roomName: string) => {
    setScreenStates((prev) => ({
      ...prev,
      [roomName]: { ...prev[roomName], stationCamEnabled: !prev[roomName].stationCamEnabled },
    }));
  }, []);

  const handleToggleStationFullscreen = useCallback((roomName: string) => {
    setScreenStates((prev) => ({
      ...prev,
      [roomName]: { ...prev[roomName], stationFullscreen: !prev[roomName].stationFullscreen },
    }));
  }, []);

  const handleStationDeviceChange = useCallback((roomName: string, kind: "audioinput" | "videoinput" | "audiooutput", deviceId: string) => {
    setScreenStates((prev) => ({
      ...prev,
      [roomName]: {
        ...prev[roomName],
        stationAudioInput:  kind === "audioinput"  ? deviceId : prev[roomName].stationAudioInput,
        stationVideoInput:  kind === "videoinput"  ? deviceId : prev[roomName].stationVideoInput,
        stationAudioOutput: kind === "audiooutput" ? deviceId : prev[roomName].stationAudioOutput,
      },
    }));
  }, []);

  const handleStationStateReceived = useCallback((roomName: string, state: StationStateMsg) => {
    setScreenStates((prev) => ({
      ...prev,
      [roomName]: { ...prev[roomName], stationDevices: state },
    }));
  }, []);

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

  /* ── No store selected / no stations (supervisor mode only) ────────────── */
  if ((visibleStations.length === 0 || !mainId) && viewMode === "supervisor") {
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
  const stationsMeta = visibleStations.map((s) => {
    const isMain = s.room_name === mainId;
    return { ...s, isMain, sideIdx: isMain ? -1 : sideCounter++ };
  });

  /* ── View selection (both auth rules available) ──────────────────── */
  if (viewMode === "select") {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <h2 className="text-xl font-semibold tracking-tight">How do you want to connect?</h2>
            <p className="text-sm text-muted-foreground">
              Choose a view based on what you need to do in this session.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            {/* Observer card */}
            <button
              onClick={() => { setViewMode("observer"); setActiveTokenType("observer"); }}
              className={cn(
                "group relative flex flex-col items-start gap-4 rounded-2xl border p-6 text-left",
                "transition-all duration-200",
                "hover:border-amber-400/50 hover:bg-amber-400/5 hover:shadow-lg",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60",
              )}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/10 ring-1 ring-amber-400/20 transition-colors group-hover:bg-amber-400/15">
                  <Eye className="h-5 w-5 text-amber-400" />
                </div>
                <span className="rounded-full bg-amber-400/10 px-2.5 py-0.5 text-[0.65rem] font-medium text-amber-400 ring-1 ring-inset ring-amber-400/25">
                  Passive
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-foreground">Observer View</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Watch any station silently. Nothing is broadcast from your device — audio and camera stay off.
                </p>
              </div>
              <ul className="flex flex-col gap-1.5 w-full">
                {["View all station live feeds", "Open any station in fullscreen", "Listen with volume control"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-1 w-1 rounded-full bg-amber-400/60 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </button>

            {/* Store Manager card */}
            <button
              onClick={() => { setViewMode("station-select"); }}
              className={cn(
                "group relative flex flex-col items-start gap-4 rounded-2xl border p-6 text-left",
                "transition-all duration-200",
                "hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              )}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 transition-colors group-hover:bg-primary/15">
                  <Monitor className="h-5 w-5 text-primary" />
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[0.65rem] font-medium text-primary ring-1 ring-inset ring-primary/25">
                  Active
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-foreground">Store Manager View</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Full control over all stations. Broadcast audio, push your camera, and manage station rooms.
                </p>
              </div>
              <ul className="flex flex-col gap-1.5 w-full">
                {["Broadcast voice to all stations", "Push your camera to any screen", "Manage station rooms & passwords"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-1 w-1 rounded-full bg-primary/60 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex items-start gap-2 rounded-lg bg-amber-400/8 border border-amber-400/15 px-3 py-2 w-full mt-auto">
                <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-400 leading-snug">
                  Active interaction with stations. Use with caution.
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Station selection (before connecting as supervisor) ─────────── */
  if (viewMode === "station-select") {
    const allSelected =
      stations.length > 0 && stations.every((s) => selectedStationIds.includes(s.id));

    function toggleStation(id: number) {
      setSelectedStationIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
    }

    function handleSelectAll() {
      setSelectedStationIds(allSelected ? [] : stations.map((s) => s.id));
    }

    function handleConnect() {
      if (selectedStationIds.length === 0) return;
      const firstSelected = stations.find((s) => selectedStationIds.includes(s.id));
      if (firstSelected) setMainId(firstSelected.room_name);
      setActiveTokenType("supervisor");
      setViewMode("supervisor");
    }

    return (
      <div className="flex h-full flex-col gap-3">
        {/* Header bar */}
        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-2.5 shrink-0">
          {canSupervisor && canObserver && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSelectedStationIds([]); setViewMode("select"); }}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Select Stations</p>
            <p className="text-xs text-muted-foreground">Choose which stations to connect to</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-xs"
            onClick={handleSelectAll}
            disabled={stations.length === 0}
          >
            {allSelected ? "Deselect All" : "Select All"}
          </Button>
        </div>

        {/* Station grid */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {stations.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">No stations found for this store.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {stations.map((s) => {
                const checked = selectedStationIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleStation(s.id)}
                    className={cn(
                      "flex items-center gap-4 rounded-xl border p-4 text-left transition-all duration-150",
                      checked
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "hover:border-muted-foreground/30 hover:bg-muted/30",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                        checked ? "border-primary bg-primary" : "border-muted-foreground/30",
                      )}
                    >
                      {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.room_name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 shrink-0 rounded-xl border bg-card px-4 py-2.5">
          <p className="text-sm text-muted-foreground">
            {selectedStationIds.length} of {stations.length} selected
          </p>
          <Button
            onClick={handleConnect}
            disabled={selectedStationIds.length === 0}
            className="gap-2"
          >
            <Monitor className="h-4 w-4" />
            {selectedStationIds.length > 0
              ? `Connect (${selectedStationIds.length})`
              : "Connect"}
          </Button>
        </div>
      </div>
    );
  }

  /* ── Observer mode — station picker grid ────────────────────────── */
  if (viewMode === "observer") {
    const observingStation = observingRoom
      ? stations.find((s) => s.room_name === observingRoom) ?? null
      : null;

    return (
      <div className="flex h-full flex-col gap-3">
        {/* Observer header bar */}
        <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <Eye className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold">Observer View</span>
            <span className="inline-flex items-center rounded-full bg-amber-400/10 px-2 py-0.5 text-[0.65rem] font-medium text-amber-400 ring-1 ring-inset ring-amber-400/30">
              Passive · listen only
            </span>
          </div>
          {canSupervisor && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (canSupervisor && canObserver) {
                  setViewMode("select");
                } else {
                  setViewMode("station-select");
                }
              }}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Supervisor View
            </Button>
          )}
        </div>

        {/* Station cards grid */}
        {stations.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">No stations to observe.</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {stations.map((s) => (
                <button
                  key={s.room_name}
                  onClick={() => setObservingRoom(s.room_name)}
                  className="group relative aspect-video overflow-hidden rounded-xl bg-neutral-900 ring-2 ring-transparent transition-all duration-200 hover:ring-amber-400/50 focus-visible:outline-none focus-visible:ring-amber-400/70"
                  aria-label={`Observe ${s.name}`}
                >
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
                    <div className="rounded-full bg-neutral-800 p-3 transition-colors group-hover:bg-amber-400/10">
                      <Eye className="h-6 w-6 text-neutral-500 transition-colors group-hover:text-amber-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold leading-tight text-white">
                        {s.name}
                      </p>
                      <p className="mt-0.5 max-w-full truncate text-[0.6rem] text-white/35">
                        {s.room_name}
                      </p>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-amber-400/0 transition-colors group-hover:bg-amber-400/5" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Observer dialog — opens when a station card is clicked */}
        {observingStation && tokenMap[observingStation.room_name] && (
          <ObserverDialog
            stationName={observingStation.name}
            roomName={observingStation.room_name}
            token={tokenMap[observingStation.room_name] ?? ""}
            serverUrl={serverUrl}
            onClose={() => setObservingRoom(null)}
            onRetry={refetch}
          />
        )}
      </div>
    );
  }

  /* ── Main view ──────────────────────────────────────────────────── */
  return (
    <div className="relative flex h-full flex-col gap-3">
      {/*
       * Single tile area — ALL ScreenTile instances live here permanently.
       * Clicking a side tile only changes `mainId` state. Each tile's
       * absolute position/size is animated by framer-motion `layout` (FLIP),
       * so no tile ever unmounts and LiveKit connections stay alive.
       */}
      <div className="relative flex-1 min-h-0 overflow-hidden" ref={tileAreaRef} data-guide-id="sp-tile-area">
        {!sessionExited && containerSize.width > 0 &&
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
                  myScreenShareEnabled={s.isMain ? myScreenShareEnabled : undefined}
                  onToggleMyScreenShare={s.isMain ? handleToggleScreenShare : undefined}
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
                  stationNumber={s.id}
                  storeId={storeId}
                  onRetry={refetch}
                  className="h-full w-full"
                  stationMicEnabled={screenStates[s.room_name]?.stationMicEnabled ?? true}
                  stationCamEnabled={screenStates[s.room_name]?.stationCamEnabled ?? true}
                  stationAudioInput={screenStates[s.room_name]?.stationAudioInput ?? ""}
                  stationVideoInput={screenStates[s.room_name]?.stationVideoInput ?? ""}
                  stationAudioOutput={screenStates[s.room_name]?.stationAudioOutput ?? ""}
                  stationFullscreen={screenStates[s.room_name]?.stationFullscreen ?? false}
                  onToggleStationMic={() => handleToggleStationMic(s.room_name)}
                  onToggleStationCam={() => handleToggleStationCam(s.room_name)}
                  onToggleStationFullscreen={() => handleToggleStationFullscreen(s.room_name)}
                  onStationDeviceChange={(kind, deviceId) => handleStationDeviceChange(s.room_name, kind, deviceId)}
                  onStationStateReceived={(state) => handleStationStateReceived(s.room_name, state)}
                />
              </motion.div>
            );
          })}

        {/* Side-panel scroll arrows */}
        {!sessionExited && hasSidePanel && containerSize.width > 0 && maxSideScroll > 0 && (
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
        {!sessionExited && <motion.div
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
        </motion.div>}
      </div>

      {/* Bottom control bar — modern floating dark toolbar */}
      <div data-guide-id="sp-bottom-bar" className="flex items-center rounded-2xl border border-white/6 bg-neutral-900/95 backdrop-blur-md px-3 py-2 shrink-0 shadow-xl shadow-black/30 max-[425px]:overflow-x-auto">
      <div className="flex w-full min-w-full items-center justify-between gap-3 max-[425px]:w-max">

        {/* ── Left: status + station management ── */}
        <div data-guide-id="sp-left-controls" className="flex items-center gap-2 shrink-0">
          <NetworkBadge status={networkStatus} />
          <div className="w-px h-5 bg-white/10" />
          <StationsDialog
            storeId={storeId}
            stations={stations}
            onRefetch={refetch}
          />
        </div>

        {/* ── Center: personal A/V controls ── */}
        <div data-guide-id="sp-av-controls" className="flex items-center gap-1 shrink-0">

          {/* Mic toggle */}
          <button
            onClick={() => {
              setMyMicMuted((v) => {
                if (!v) setBroadcastToAll(false);
                return !v;
              });
            }}
            title={myMicMuted ? "Unmute microphone" : "Mute microphone"}
            aria-label={myMicMuted ? "Unmute microphone" : "Mute microphone"}
            className={cn(
              "relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150",
              myMicMuted
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            {myMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {myMicMuted && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-neutral-900" />
            )}
          </button>

          {/* Camera toggle */}
          <button
            onClick={() => setMyVideoOff((v) => !v)}
            title={myVideoOff ? "Turn on camera" : "Turn off camera"}
            aria-label={myVideoOff ? "Turn on camera" : "Turn off camera"}
            className={cn(
              "relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150",
              myVideoOff
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            {myVideoOff ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            {myVideoOff && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-neutral-900" />
            )}
          </button>

          {/* Self-view toggle */}
          <button
            onClick={() => setMyCamVisible((v) => !v)}
            title={myCamVisible ? "Hide self view" : "Show self view"}
            aria-label={myCamVisible ? "Hide self view" : "Show self view"}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150",
              myCamVisible
                ? "bg-white/15 text-white ring-1 ring-white/20"
                : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white",
            )}
          >
            <UserCircle2 className="h-4 w-4" />
          </button>

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Talk to All — hold to broadcast */}
          <button
            data-guide-id="sp-talk-all"
            disabled={myMicMuted}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setBroadcastToAll(true);
            }}
            onPointerUp={() => setBroadcastToAll(false)}
            onPointerCancel={() => setBroadcastToAll(false)}
            onContextMenu={(e) => e.preventDefault()}
            title={myMicMuted ? "Unmute mic first" : "Hold to broadcast to all screens"}
            aria-label="Hold to talk to all screens"
            aria-pressed={broadcastToAll}
            className={cn(
              "inline-flex select-none items-center gap-1.5 rounded-xl px-3 h-9 text-xs font-medium transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-40",
              broadcastToAll
                ? "bg-red-600 text-white shadow-lg shadow-red-900/40 ring-2 ring-red-500/40"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
            )}
          >
            <Radio className={cn("h-4 w-4 shrink-0", broadcastToAll && "animate-pulse")} />
            <span className="hidden sm:inline">
              {broadcastToAll ? "Broadcasting…" : "Talk to All"}
            </span>
          </button>
        </div>

        {/* ── Right: broadcast to screens ── */}
        <div data-guide-id="sp-broadcast-controls" className="flex items-center gap-1 shrink-0">
          <div className="w-px h-5 bg-white/10 mr-1" />

          {/* Mute / unmute all screens */}
          <button
            onClick={handleMuteAllToggle}
            title={anyAudioEnabled ? "Mute all screens" : "Unmute all screens"}
            aria-label={anyAudioEnabled ? "Mute all screens" : "Unmute all screens"}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150",
              anyAudioEnabled
                ? "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                : "bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/70",
            )}
          >
            {anyAudioEnabled ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          {/* Cam to all screens */}
          <button
            onClick={handleCamToAllToggle}
            disabled={myVideoOff}
            title={
              myVideoOff
                ? "Turn on your camera first"
                : anyMyCamEnabled
                ? "Remove your camera from all screens"
                : "Show your camera on all screens"
            }
            aria-label={anyMyCamEnabled ? "Disable camera on all screens" : "Enable camera on all screens"}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150",
              "disabled:pointer-events-none disabled:opacity-40",
              anyMyCamEnabled
                ? "bg-white/15 text-white ring-1 ring-white/20 hover:bg-white/20"
                : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white",
            )}
          >
            {anyMyCamEnabled ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
          </button>

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Guide button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-white/50 hover:text-white hover:bg-white/10 rounded-xl"
                onClick={() => setGuideOpen(true)}
                aria-label="Open page guide"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Page guide</TooltipContent>
          </Tooltip>

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Exit session button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-guide-id="sp-exit-session"
                className="h-9 w-9 text-white/50 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
                onClick={() => setSessionExited(true)}
                aria-label="Exit session"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Exit session</TooltipContent>
          </Tooltip>
        </div>

      </div>
      </div>

      <PageGuide
        steps={guideSteps}
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
      />

      {/* Exit overlay — covers tile area + bottom bar; actual disconnect via tile suppression above */}
      {sessionExited && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm rounded-2xl">
          <div className="flex flex-col items-center gap-5 text-center px-8 max-w-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
              <LogOut className="h-7 w-7 text-white/60" />
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-lg font-semibold text-white">You have exited the session</p>
              <p className="text-sm text-white/50 leading-relaxed">
                All station connections have been disconnected.
              </p>
            </div>
            <Button
              onClick={() => {
                setSessionExited(false);
                setBroadcastToAll(false);
                setSelectedStationIds([]);
                setActiveTokenType(null);
                setViewMode("station-select");
              }}
              className="gap-2 bg-white text-black hover:bg-white/90 rounded-xl px-6"
            >
              <Radio className="h-4 w-4" />
              Reconnect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}