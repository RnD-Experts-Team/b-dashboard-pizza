"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScreenTile, type MockParticipant } from "./screen-tile";

/* ------------------------------------------------------------------ */
/*  Mock participants — replaced with real LiveKit participants later  */
/* ------------------------------------------------------------------ */
const MOCK_PARTICIPANTS: MockParticipant[] = [
  {
    id: "p1",
    name: "Store 01 – Front Entrance",
    gradient: "from-violet-600 to-indigo-700",
  },
  {
    id: "p2",
    name: "Store 02 – Register",
    gradient: "from-rose-500 to-pink-700",
  },
  {
    id: "p3",
    name: "Store 03 – Back Office",
    gradient: "from-amber-500 to-orange-600",
  },
  {
    id: "p4",
    name: "Store 04 – Drive Thru",
    gradient: "from-emerald-500 to-teal-700",
  },
  {
    id: "p5",
    name: "Store 05 – Kitchen",
    gradient: "from-sky-500 to-blue-700",
  },
  {
    id: "p6",
    name: "Store 06 – Lobby",
    gradient: "from-fuchsia-500 to-purple-700",
  },
];

/* ------------------------------------------------------------------ */
/*  Per-screen A/V state                                               */
/* ------------------------------------------------------------------ */
interface ScreenState {
  audioEnabled: boolean;
  videoEnabled: boolean;
  volume: number; // 0–1 local gain
}

function initScreenStates(): Record<string, ScreenState> {
  const states: Record<string, ScreenState> = {};
  MOCK_PARTICIPANTS.forEach((p, i) => {
    states[p.id] = {
      audioEnabled: i === 0, // main screen audio on, side screens audio off
      videoEnabled: true,    // all screens video on
      volume: 1,
    };
  });
  return states;
}

/* ------------------------------------------------------------------ */
/*  ScreenProjectView                                                  */
/* ------------------------------------------------------------------ */
export function ScreenProjectView() {
  const mainRef = useRef<HTMLDivElement>(null);
  const [mainId, setMainId] = useState<string>(MOCK_PARTICIPANTS[0].id);
  const [screenStates, setScreenStates] = useState<Record<string, ScreenState>>(initScreenStates);

  // My own controls — mic muted and camera off by default
  const [myMicMuted, setMyMicMuted] = useState(true);
  const [myVideoOff, setMyVideoOff] = useState(true);
  const [myCamVisible, setMyCamVisible] = useState(false);

  const mainParticipant = MOCK_PARTICIPANTS.find((p) => p.id === mainId)!;
  const sideParticipants = MOCK_PARTICIPANTS.filter((p) => p.id !== mainId);

  // ── Audio level simulation (replaced by LiveKit AudioLevelObserver later) ──
  const [audioLevels, setAudioLevels] = useState<Record<string, number>>(() =>
    Object.fromEntries(MOCK_PARTICIPANTS.map((p) => [p.id, 0]))
  );

  useEffect(() => {
    const ids = MOCK_PARTICIPANTS.map((p) => p.id);
    let speakerId = ids[0];

    const interval = setInterval(() => {
      // Occasionally switch the active speaker
      if (Math.random() < 0.3) {
        speakerId = ids[Math.floor(Math.random() * ids.length)];
      }
      setAudioLevels((prev) => {
        const next = { ...prev };
        ids.forEach((id) => {
          next[id] =
            id === speakerId
              ? 0.45 + Math.random() * 0.5  // speaker: 0.45 – 0.95
              : Math.random() * 0.1;         // ambient noise
        });
        return next;
      });
    }, 700);

    return () => clearInterval(interval);
  }, []);

  // True if at least one screen still has audio on (used to toggle mute-all label)
  const anyAudioEnabled = MOCK_PARTICIPANTS.some(
    (p) => screenStates[p.id]?.audioEnabled
  );

  const handleSwap = useCallback((id: string) => {
    setMainId(id);
  }, []);

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

  // Mute all → if any audio is on, mute everything; if all muted, unmute all
  const handleMuteAllToggle = useCallback(() => {
    const target = anyAudioEnabled ? false : true;
    setScreenStates((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        next[id] = { ...next[id], audioEnabled: target };
      });
      return next;
    });
  }, [anyAudioEnabled]);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* ── Screen area ─────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 flex-col gap-3 lg:flex-row">
        {/* Main screen — relative so the PiP self-view sits inside it */}
        <div className="relative min-h-0 flex-1" ref={mainRef}>
          <AnimatePresence mode="wait">
            <motion.div
              key={mainParticipant.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="h-full w-full"
            >
              <ScreenTile
                participant={mainParticipant}
                isMain
                isVideoEnabled={screenStates[mainParticipant.id]?.videoEnabled ?? true}
                isAudioEnabled={screenStates[mainParticipant.id]?.audioEnabled ?? true}
                onToggleVideo={() => handleToggleVideo(mainParticipant.id)}
                onToggleAudio={() => handleToggleAudio(mainParticipant.id)}
                audioLevel={audioLevels[mainParticipant.id] ?? 0}
                volume={screenStates[mainParticipant.id]?.volume ?? 1}
                onVolumeChange={(v) => handleVolumeChange(mainParticipant.id, v)}
                className="h-full w-full"
              />
            </motion.div>
          </AnimatePresence>

          {/* ── PiP self-view (draggable) ───────────────────────── */}
          <motion.div
            drag
            dragConstraints={mainRef}
            dragElastic={0.08}
            dragMomentum={false}
            animate={myCamVisible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "absolute bottom-14 left-3 z-10 cursor-grab active:cursor-grabbing",
              !myCamVisible && "pointer-events-none"
            )}
          >
            <div className="relative w-36 h-24 rounded-lg overflow-hidden ring-2 ring-white/30 shadow-xl bg-neutral-800">
              {myVideoOff ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-neutral-800">
                  <UserCircle2 className="h-8 w-8 text-white/40" />
                  <span className="text-[0.6rem] text-white/40">Camera off</span>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-linear-to-br from-slate-600 to-slate-800">
                  <UserCircle2 className="h-8 w-8 text-white/70" />
                  <span className="text-[0.6rem] text-white/70">You</span>
                </div>
              )}
              {/* Muted badge */}
              {myMicMuted && (
                <div className="absolute top-1 right-1 rounded bg-black/60 p-0.5">
                  <MicOff className="h-2.5 w-2.5 text-white" />
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Side panel — horizontal scroll on mobile, vertical on desktop */}
        <div
          className={cn(
            "flex gap-2 shrink-0",
            "h-36 overflow-x-auto overflow-y-hidden",
            "lg:h-full lg:w-44 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden"
          )}
        >
          {sideParticipants.map((p) => (
            <ScreenTile
              key={p.id}
              participant={p}
              isMain={false}
              onClick={() => handleSwap(p.id)}
              isVideoEnabled={screenStates[p.id]?.videoEnabled ?? true}
              isAudioEnabled={screenStates[p.id]?.audioEnabled ?? false}
              onToggleVideo={() => handleToggleVideo(p.id)}
              onToggleAudio={() => handleToggleAudio(p.id)}
              audioLevel={audioLevels[p.id] ?? 0}
              className="h-full w-36 shrink-0 lg:h-28 lg:w-full"
            />
          ))}
        </div>
      </div>

      {/* ── Bottom control bar ──────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border bg-card px-25 py-2.5 shrink-0">
        {/* Left label */}
        <p className="hidden sm:block text-xs text-muted-foreground font-medium select-none">
          My Controls
        </p>

        {/* Center — my mic + my camera + PiP toggle */}
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

          {/* Toggle PiP self-view */}
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

        {/* Right — mute / unmute all screens */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleMuteAllToggle}
          className="gap-1.5"
          aria-label={anyAudioEnabled ? "Mute all screens" : "Unmute all screens"}
        >
          {anyAudioEnabled ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {anyAudioEnabled ? "Mute All" : "Unmute All"}
          </span>
        </Button>
      </div>
    </div>
  );
}


