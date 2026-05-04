"use client";

import { Video, VideoOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export interface MockParticipant {
  id: string;
  name: string;
  gradient: string;
}

interface ScreenTileProps {
  participant: MockParticipant;
  isMain: boolean;
  /** Only used on side tiles — clicking swaps it to main */
  onClick?: () => void;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  /** 0–1 simulated audio level — drives the hover meter on the main tile */
  audioLevel: number;
  /** 0–1 local volume gain — main tile only */
  volume?: number;
  onVolumeChange?: (v: number) => void;
  className?: string;
}

export function ScreenTile({
  participant,
  isMain,
  onClick,
  isVideoEnabled,
  isAudioEnabled,
  onToggleVideo,
  onToggleAudio,
  audioLevel: _audioLevel,
  volume = 1,
  onVolumeChange,
  className,
}: ScreenTileProps) {

  return (
    <div
      onClick={!isMain ? onClick : undefined}
      className={cn(
        "relative overflow-hidden rounded-xl",
        isVideoEnabled
          ? cn("bg-linear-to-br", participant.gradient)
          : "bg-neutral-800 dark:bg-neutral-900",
        !isMain &&
          "cursor-pointer ring-2 ring-transparent hover:ring-white/40 transition-shadow duration-200",
        className
      )}
    >
      {/* Video placeholder — centered icon + name */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 select-none pointer-events-none">
        <div
          className={cn(
            "rounded-full bg-black/20 flex items-center justify-center",
            isMain ? "h-20 w-20" : "h-10 w-10"
          )}
        >
          {isVideoEnabled ? (
            <Video className={cn("text-white/80", isMain ? "h-9 w-9" : "h-5 w-5")} />
          ) : (
            <VideoOff className={cn("text-white/40", isMain ? "h-9 w-9" : "h-5 w-5")} />
          )}
        </div>
        <span
          className={cn(
            "font-medium truncate max-w-[88%] text-center",
            isVideoEnabled ? "text-white/90" : "text-white/50",
            isMain ? "text-base" : "text-[0.65rem] leading-tight"
          )}
        >
          {participant.name}
        </span>
      </div>

      {/* Bottom gradient + controls */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-linear-to-t from-black/65 to-transparent",
          isMain ? "px-2 pb-2 pt-12" : "px-1.5 pb-1.5 pt-10"
        )}
      >
        <div className="flex items-center gap-1">
          {/* ── Sound button — main tile has hover panel with meter + volume ── */}
          {isMain ? (
            <div className="group/sound relative flex items-center">
              <Button
                variant="ghost"
                size="sm"
                aria-label={isAudioEnabled ? "Mute audio" : "Unmute audio"}
                onClick={(e) => { e.stopPropagation(); onToggleAudio(); }}
                className={cn(
                  "relative z-10 h-8 gap-1.5 px-2.5 text-xs text-white hover:bg-white/20 hover:text-white focus-visible:ring-white/40",
                  !isAudioEnabled && "text-red-400 hover:text-red-300"
                )}
              >
                {isAudioEnabled
                  ? <Volume2 className="h-3.5 w-3.5" />
                  : <VolumeX className="h-3.5 w-3.5" />
                }
                <span>{isAudioEnabled ? "Sound" : "Sound Off"}</span>
              </Button>

              {/* Vertical volume pop-up above the Sound button */}
              <div
                className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 opacity-0 transition-opacity duration-200 ease-out group-hover/sound:opacity-100 pointer-events-none group-hover/sound:pointer-events-auto z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-center rounded-lg bg-black/60 backdrop-blur-sm" style={{ width: 32, height: 80, padding: "10px 0" }}>
                  <Slider
                    orientation="vertical"
                    value={[Math.round(volume * 100)]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([v]) => onVolumeChange?.(v / 100)}
                    style={{ height: 60, minHeight: 0 }}
                    className="**:data-[slot=slider-track]:w-0.75 **:data-[slot=slider-track]:bg-white/30 **:data-[slot=slider-range]:bg-white **:data-[slot=slider-thumb]:h-3 **:data-[slot=slider-thumb]:w-3 **:data-[slot=slider-thumb]:border-white data-[orientation=vertical]:min-h-0"
                    aria-label="Volume"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Side tile: simple audio toggle, no meter */
            <Button
              variant="ghost"
              size="icon"
              aria-label={isAudioEnabled ? "Mute audio" : "Unmute audio"}
              onClick={(e) => { e.stopPropagation(); onToggleAudio(); }}
              className={cn(
                "h-6 w-6 text-white hover:bg-white/20 hover:text-white focus-visible:ring-white/40",
                !isAudioEnabled && "text-red-400 hover:text-red-300"
              )}
            >
              {isAudioEnabled
                ? <Volume2 className="h-3 w-3" />
                : <VolumeX className="h-3 w-3" />
              }
            </Button>
          )}

          {/* Video toggle */}
          <Button
            variant="ghost"
            size={isMain ? "sm" : "icon"}
            aria-label={isVideoEnabled ? "Stop video" : "Start video"}
            onClick={(e) => { e.stopPropagation(); onToggleVideo(); }}
            className={cn(
              "text-white hover:bg-white/20 hover:text-white focus-visible:ring-white/40",
              isMain ? "h-8 gap-1.5 px-2.5 text-xs" : "h-6 w-6",
              !isVideoEnabled && "text-red-400 hover:text-red-300"
            )}
          >
            {isVideoEnabled
              ? <Video className={cn(isMain ? "h-3.5 w-3.5" : "h-3 w-3")} />
              : <VideoOff className={cn(isMain ? "h-3.5 w-3.5" : "h-3 w-3")} />
            }
            {isMain && <span>{isVideoEnabled ? "Video" : "Video Off"}</span>}
          </Button>
        </div>
      </div>
    </div>
  );
}

