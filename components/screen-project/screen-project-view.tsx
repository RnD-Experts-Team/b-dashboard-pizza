"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, UserCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { VideoQuality } from "livekit-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScreenTile } from "./screen-tile";
import { StationsDialog } from "./stations-dialog";
import { useScreenProject } from "@/lib/hooks/use-screen-project";
import { useSelectedStoreStore } from "@/lib/store";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Per-screen A/V state                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

interface ScreenState {
  audioEnabled: boolean;
  videoEnabled: boolean;
  volume: number;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  ScreenProjectView                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

export function ScreenProjectView() {
  const mainRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const selectedStore = useSelectedStoreStore((s) => s.selectedStore);
  const storeId = selectedStore?.storeId ?? "";

  const { stations, serverUrl, tokenMap, isLoading, error, refetch } =
    useScreenProject();

  const [mainId, setMainId] = useState<string>("");
  const [screenStates, setScreenStates] = useState<Record<string, ScreenState>>({});

  // My own controls
  const [myMicMuted, setMyMicMuted] = useState(true);
  const [myVideoOff, setMyVideoOff] = useState(true);
  const [myCamVisible, setMyCamVisible] = useState(false);

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
        };
      });
      return next;
    });
  }, [stations]);

  const mainStation = stations.find((s) => s.room_name === mainId);
  const sideStations = stations.filter((s) => s.room_name !== mainId);

  const anyAudioEnabled = stations.some(
    (s) => screenStates[s.room_name]?.audioEnabled,
  );

  const handleSwap = useCallback((id: string) => setMainId(id), []);

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
  if (stations.length === 0 || !mainStation) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          No stations found. Select a store to view screens.
        </p>
      </div>
    );
  }

  /* ── Main view ──────────────────────────────────────────────────── */
  return (
    <div className="flex h-full flex-col gap-3">
      {/* Screen area */}
      <div className="flex flex-1 min-h-0 flex-col gap-3 lg:flex-row">
        {/* Main screen */}
        <div className="relative min-h-0 flex-1" ref={mainRef}>
          <AnimatePresence mode="wait">
            <motion.div
              key={mainStation.room_name}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="h-full w-full"
            >
              <ScreenTile
                name={mainStation.name}
                roomName={mainStation.room_name}
                token={tokenMap[mainStation.room_name] ?? ""}
                serverUrl={serverUrl}
                isMain
                myMicEnabled={!myMicMuted}
                myCamEnabled={!myVideoOff}
                isVideoEnabled={screenStates[mainStation.room_name]?.videoEnabled ?? true}
                isAudioEnabled={screenStates[mainStation.room_name]?.audioEnabled ?? true}
                onToggleVideo={() => handleToggleVideo(mainStation.room_name)}
                onToggleAudio={() => handleToggleAudio(mainStation.room_name)}
                volume={screenStates[mainStation.room_name]?.volume ?? 1}
                onVolumeChange={(v) => handleVolumeChange(mainStation.room_name, v)}
                videoQuality={VideoQuality.HIGH}
                className="h-full w-full"
              />
            </motion.div>
          </AnimatePresence>

          {/* PiP self-view (draggable) */}
          <motion.div
            drag
            dragConstraints={mainRef}
            dragElastic={0.08}
            dragMomentum={false}
            animate={myCamVisible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "absolute bottom-14 left-3 z-10 cursor-grab active:cursor-grabbing",
              !myCamVisible && "pointer-events-none",
            )}
          >
            <div className="relative w-36 h-24 rounded-lg overflow-hidden ring-2 ring-white/30 shadow-xl bg-neutral-800">
              {/* Real local camera preview — mirrored like a selfie */}
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

        {/* Side panel */}
        <div
          className={cn(
            "flex gap-2 shrink-0",
            "h-36 overflow-x-auto overflow-y-hidden",
            "lg:h-full lg:w-44 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden",
          )}
        >
          {sideStations.map((s) => (
            <ScreenTile
              key={s.room_name}
              name={s.name}
              roomName={s.room_name}
              token={tokenMap[s.room_name] ?? ""}
              serverUrl={serverUrl}
              isMain={false}
              myMicEnabled={!myMicMuted}
              myCamEnabled={!myVideoOff}
              onClick={() => handleSwap(s.room_name)}
              isVideoEnabled={screenStates[s.room_name]?.videoEnabled ?? true}
              isAudioEnabled={screenStates[s.room_name]?.audioEnabled ?? false}
              onToggleVideo={() => handleToggleVideo(s.room_name)}
              onToggleAudio={() => handleToggleAudio(s.room_name)}
              videoQuality={VideoQuality.LOW}
              className="h-full w-36 shrink-0 lg:h-28 lg:w-full"
            />
          ))}
        </div>
      </div>

      {/* Bottom control bar */}
      <div className="flex items-center justify-between rounded-xl border bg-card px-25 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          {/* <p className="hidden sm:block text-xs text-muted-foreground font-medium select-none">
            My Controls
          </p> */}
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
            onClick={() => setMyMicMuted((v) => !v)}
            className="gap-1.5"
            aria-label={myMicMuted ? "Unmute my microphone" : "Mute my microphone"}
          >
            {myMicMuted ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {myMicMuted ? "Mic Off" : "Mic On"}
            </span>
          </Button>

          <Button
            variant={myVideoOff ? "destructive" : "secondary"}
            size="sm"
            onClick={() => setMyVideoOff((v) => !v)}
            className="gap-1.5"
            aria-label={myVideoOff ? "Turn on my camera" : "Turn off my camera"}
          >
            {myVideoOff ? (
              <VideoOff className="h-4 w-4" />
            ) : (
              <Video className="h-4 w-4" />
            )}
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
        <Button
          variant={anyAudioEnabled ? "secondary" : "outline"}
          size="sm"
          onClick={handleMuteAllToggle}
          className="gap-1.5"
          aria-label={anyAudioEnabled ? "Mute all screens" : "Unmute all screens"}
        >
          {anyAudioEnabled ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {anyAudioEnabled ? "Mute All" : "Unmute All"}
          </span>
        </Button>
      </div>
    </div>
  );
}