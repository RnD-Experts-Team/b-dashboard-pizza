"use client";

import { useRef, useEffect } from "react";
import { motion, useMotionValue } from "framer-motion";
import { X, Volume2, VolumeX, ExternalLink, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { VideoQuality } from "livekit-client";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useScreenProjectPiPStore } from "@/lib/store/screen-project-pip.store";
import { useSelectedStoreStore } from "@/lib/store";
import { ScreenTile } from "@/components/screen-project/screen-tile";
import { cn } from "@/lib/utils";

/**
 * Global draggable PiP mini-player for Screen Project.
 *
 * Mounted once in AppShell and persists across route changes. Automatically
 * shows when `activeStation` is set in the PiP store and hides when closed.
 *
 * Default position: top-right corner (right:16px, top:16px) via CSS.
 * Drag is implemented with framer-motion; position offset from that anchor
 * is saved back to the store on drag end.
 */
export function ScreenProjectPiPOverlay() {
  const {
    activeStation,
    isVisible,
    isMuted,
    isMicEnabled,
    isCamEnabled,
    position,
    closePiP,
    toggleMute,
    toggleMic,
    toggleCam,
    setPosition,
  } = useScreenProjectPiPStore();
  const selectedStore = useSelectedStoreStore((s) => s.selectedStore);
  const router = useRouter();
  const locale = useLocale();

  // Framer-motion drag offset (relative to default top-right anchor)
  const x = useMotionValue(position.x);
  const y = useMotionValue(position.y);

  // Sync persisted position into motion values on mount / when position changes
  useEffect(() => {
    x.set(position.x);
    y.set(position.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.x, position.y]);

  // Close PiP if the selected store changes (stale token)
  useEffect(() => {
    if (!activeStation) return;
    if (selectedStore?.storeId && selectedStore.storeId !== activeStation.storeId) {
      closePiP();
    }
  }, [selectedStore?.storeId, activeStation, closePiP]);

  if (!activeStation || !isVisible) return null;

  const handleDragEnd = () => {
    setPosition({ x: x.get(), y: y.get() });
  };

  const handleGoToScreenProject = () => {
    router.push(`/${locale}/dashboard/screen-project`);
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.05}
      style={{ x, y }}
      onDragEnd={handleDragEnd}
      // Constrain to viewport with some padding via CSS on the wrapper
      className={cn(
        // Fixed position anchored to top-right; drag offset is applied via motion style
        "fixed top-4 right-4 z-9999 cursor-grab active:cursor-grabbing",
        "select-none"
      )}
    >
      {/* PiP card */}
      <div className="relative w-72 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/20 bg-neutral-900">
        {/* Video area */}
        <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
          <ScreenTile
            name={activeStation.name}
            roomName={activeStation.roomName}
            token={activeStation.token}
            serverUrl={activeStation.serverUrl}
            isMain={false}
            isVideoEnabled={true}
            isAudioEnabled={!isMuted}
            myMicEnabled={isMicEnabled}
            myCamEnabled={isCamEnabled}
            onToggleVideo={() => {}}
            onToggleAudio={toggleMute}
            volume={isMuted ? 0 : 1}
            videoQuality={VideoQuality.LOW}
            viewerOnly={true}
            className="absolute inset-0 h-full w-full"
          />
        </div>

        {/* Controls bar */}
        <div className="flex items-center justify-between bg-black/80 backdrop-blur-sm px-2 py-1.5">
          {/* Station name */}
          <span className="text-xs text-white/80 font-medium truncate max-w-25">
            {activeStation.name}
          </span>

          <div className="flex items-center gap-1">
            {/* Mute toggle */}
            <button
              onClick={toggleMute}
              className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              aria-label={isMuted ? "Unmute PiP" : "Mute PiP"}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </button>

            {/* Mic toggle */}
            <button
              onClick={toggleMic}
              className={cn(
                "rounded p-1 transition-colors",
                isMicEnabled
                  ? "bg-red-500/80 text-white hover:bg-red-600/80"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
              aria-label={isMicEnabled ? "Mute mic" : "Unmute mic"}
              title={isMicEnabled ? "Mute mic" : "Unmute mic"}
            >
              {isMicEnabled ? (
                <Mic className="h-3.5 w-3.5" />
              ) : (
                <MicOff className="h-3.5 w-3.5" />
              )}
            </button>

            {/* Camera toggle */}
            <button
              onClick={toggleCam}
              className={cn(
                "rounded p-1 transition-colors",
                isCamEnabled
                  ? "bg-red-500/80 text-white hover:bg-red-600/80"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
              aria-label={isCamEnabled ? "Turn off camera" : "Turn on camera"}
              title={isCamEnabled ? "Camera off" : "Camera on"}
            >
              {isCamEnabled ? (
                <Video className="h-3.5 w-3.5" />
              ) : (
                <VideoOff className="h-3.5 w-3.5" />
              )}
            </button>

            {/* Go to Screen Project */}
            <button
              onClick={handleGoToScreenProject}
              className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Open Screen Project"
              title="Go to Screen Project"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>

            {/* Close */}
            <button
              onClick={closePiP}
              className="rounded p-1 text-white/70 hover:bg-red-500/80 hover:text-white transition-colors"
              aria-label="Close PiP"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
