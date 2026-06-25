"use client";

import { useState } from "react";
import { Eye, Volume2, VolumeX, X } from "lucide-react";
import { VideoQuality } from "livekit-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ScreenTile } from "./screen-tile";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Props                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

interface ObserverDialogProps {
  /** Human-readable station name shown in the header */
  stationName: string;
  /** LiveKit room name */
  roomName: string;
  /** Observer JWT — subscribe-only, no publish permissions. */
  token: string;
  /** LiveKit server URL (e.g. "https://screens.lcportal.cloud") */
  serverUrl: string;
  /** Called when the dialog should close */
  onClose: () => void;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  ObserverDialog                                                            */
/* ─────────────────────────────────────────────────────────────────────────── */

export function ObserverDialog({
  stationName,
  roomName,
  token,
  serverUrl,
  onClose,
}: ObserverDialogProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="!max-w-[72vw] w-full h-[90vh] flex flex-col gap-0 p-0 bg-neutral-950 border-neutral-800 [&>button]:hidden">
        {/* ── Header ── */}
        <DialogHeader className="flex-row items-center gap-3 px-4 py-3 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Eye className="h-4 w-4 shrink-0 text-amber-400" />
            <DialogTitle className="text-white text-sm font-semibold truncate">
              {stationName}
            </DialogTitle>
            <span className="inline-flex shrink-0 items-center rounded-full bg-amber-400/10 px-2 py-0.5 text-[0.65rem] font-medium text-amber-400 ring-1 ring-inset ring-amber-400/30">
              Observer
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 shrink-0 text-neutral-400 hover:text-white hover:bg-white/10"
            aria-label="Close observer"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {/* ── Video area ── */}
        <div className="flex-1 min-h-0 p-3">
          <ScreenTile
            name={stationName}
            roomName={roomName}
            token={token}
            serverUrl={serverUrl}
            isMain
            isVideoEnabled
            isAudioEnabled={!isMuted}
            myMicEnabled={false}
            myCamEnabled={false}
            onToggleVideo={() => {}}
            onToggleAudio={() => setIsMuted((v) => !v)}
            volume={isMuted ? 0 : volume}
            videoQuality={VideoQuality.HIGH}
            viewerOnly
            observerMode
            className="h-full w-full"
          />
        </div>

        {/* ── Bottom controls ── */}
        <div className="flex items-center justify-center gap-4 px-4 py-3 border-t border-neutral-800 shrink-0">
          <Button
            variant={isMuted ? "destructive" : "secondary"}
            size="sm"
            onClick={() => setIsMuted((v) => !v)}
            className="gap-1.5"
            aria-label={isMuted ? "Unmute station audio" : "Mute station audio"}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
            {isMuted ? "Unmute" : "Mute"}
          </Button>

          {/* Volume slider — only useful when not muted */}
          {!isMuted && (
            <div className="flex items-center gap-2">
              <Volume2 className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
              <Slider
                value={[Math.round(volume * 100)]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => setVolume(v / 100)}
                className="w-28"
                aria-label="Volume"
              />
              <span className="w-7 text-right text-xs text-neutral-400 tabular-nums">
                {Math.round(volume * 100)}
              </span>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
