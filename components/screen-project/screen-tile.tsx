"use client";

import { useEffect, useState, useRef } from "react";
import {
  LiveKitRoom,
  useTracks,
  VideoTrack,
  AudioTrack,
  useRoomContext,
  useConnectionState,
  useSpeakingParticipants,
} from "@livekit/components-react";
import { Track, ConnectionState, VideoQuality, RemoteTrackPublication } from "livekit-client";
import { Video, VideoOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Sound bars — animated indicator shown when remote audio is active       */
/* ─────────────────────────────────────────────────────────────────────────── */

function SoundBars({ isMain }: { isMain: boolean }) {
  const w = isMain ? 3 : 2;
  const h = isMain ? 14 : 10;
  const bar = (delay: string) => (
    <span
      style={{
        display: "block",
        width: w,
        height: h,
        borderRadius: 2,
        backgroundColor: "rgb(74 222 128)",
        transformOrigin: "bottom",
        animation: `soundbar 0.75s ease-in-out infinite ${delay}`,
      }}
    />
  );
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "flex-end",
        gap: 2,
        height: h,
      }}
    >
      {bar("0s")}
      {bar("0.2s")}
      {bar("0.4s")}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Public types                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface ScreenTileProps {
  /** Station display name */
  name: string;
  /** LiveKit room name (e.g. "03795-00001-Making") */
  roomName: string;
  /** LiveKit JWT token for this room */
  token: string;
  /** LiveKit server WebSocket URL */
  serverUrl: string;
  isMain: boolean;
  /** Only used on side tiles — clicking swaps it to main */
  onClick?: () => void;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  /** Whether the supervisor's own microphone should be published into this room */
  myMicEnabled: boolean;
  /** Whether the supervisor's own camera should be published into this room */
  myCamEnabled: boolean;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  /** 0-1 local volume gain */
  volume?: number;
  onVolumeChange?: (v: number) => void;
  /** LiveKit subscription quality for this tile */
  videoQuality?: VideoQuality;
  /** When true, hides all A/V control buttons (view-only mode) */
  viewerOnly?: boolean;
  className?: string;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Inner tile — rendered inside <LiveKitRoom> so it can use hooks           */
/* ─────────────────────────────────────────────────────────────────────────── */

interface InnerProps {
  name: string;
  isMain: boolean;
  onClick?: () => void;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  myMicEnabled: boolean;
  myCamEnabled: boolean;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  volume: number;
  onVolumeChange?: (v: number) => void;
  videoQuality: VideoQuality;
  viewerOnly?: boolean;
  className?: string;
}

function ScreenTileInner({
  name,
  isMain,
  onClick,
  isVideoEnabled,
  isAudioEnabled,
  myMicEnabled,
  myCamEnabled,
  onToggleVideo,
  onToggleAudio,
  volume,
  onVolumeChange,
  videoQuality,
  viewerOnly = false,
  className,
}: InnerProps) {
  const allTracks = useTracks([
    Track.Source.ScreenShare,
    Track.Source.Camera,
    Track.Source.Microphone,
    Track.Source.ScreenShareAudio,
  ]);

  // Stations publish Camera; ScreenShare included as fallback
  const videoTrack = allTracks.find(
    (t) =>
      !t.participant.isLocal &&
      (t.publication.source === Track.Source.Camera ||
        t.publication.source === Track.Source.ScreenShare),
  );

  const room = useRoomContext();
  const connectionState = useConnectionState();
  const isConnecting =
    connectionState === ConnectionState.Connecting ||
    connectionState === ConnectionState.Reconnecting;

  // Live = connected AND the station is actively streaming video
  const isLive = connectionState === ConnectionState.Connected && !!videoTrack;

  // Detect if any remote participant is speaking (audio activity)
  const speakingParticipants = useSpeakingParticipants();
  const isRemoteSpeaking = speakingParticipants.some((p) => !p.isLocal);

  // Publish / unpublish supervisor's mic in this room when myMicEnabled changes
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [volOpen, setVolOpen] = useState(false);

  const openVol = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setVolOpen(true);
  };

  const scheduleClose = () => {
    closeTimerRef.current = setTimeout(() => setVolOpen(false), 150);
  };

  // Publish / unpublish supervisor's mic in this room when myMicEnabled changes
  useEffect(() => {
    if (connectionState !== ConnectionState.Connected) return;
    room.localParticipant.setMicrophoneEnabled(myMicEnabled).catch(() => {});
  }, [myMicEnabled, connectionState, room]);

  // Publish / unpublish supervisor's camera in this room when myCamEnabled changes
  useEffect(() => {
    if (connectionState !== ConnectionState.Connected) return;
    room.localParticipant.setCameraEnabled(myCamEnabled).catch(() => {});
  }, [myCamEnabled, connectionState, room]);

  // Request the appropriate simulcast layer from the server
  useEffect(() => {
    if (!videoTrack) return;
    const pub = videoTrack.publication;
    if (pub instanceof RemoteTrackPublication) {
      pub.setVideoQuality(videoQuality);
    }
  }, [videoTrack, videoQuality]);

  return (
    <div
      onClick={!isMain ? onClick : undefined}
      className={cn(
        "relative overflow-hidden rounded-xl bg-neutral-900 transition-shadow duration-200",
        !isMain && "cursor-pointer",
        // Speaking ring — green glow when station audio is active
        isRemoteSpeaking
          ? "ring-2 ring-green-400/70"
          : !isMain
            ? "ring-2 ring-transparent hover:ring-white/40"
            : undefined,
        className,
      )}
    >
      {/* ── LIVE / offline badge — top-right ─────────────────────────── */}
      <div className="absolute top-2 right-2 z-10 pointer-events-none select-none">
        {isLive ? (
          <div className={cn(
            "flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm",
            isMain ? "px-2 py-1" : "px-1.5 py-0.5",
          )}>
            {/* Pulsing green dot */}
            <span className="relative flex">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
              <span className={cn("relative inline-flex rounded-full bg-green-400", isMain ? "h-2 w-2" : "h-1.5 w-1.5")} />
            </span>
            {isMain && (
              <span className="text-[0.6rem] font-bold uppercase tracking-wide text-green-400">
                Live
              </span>
            )}
          </div>
        ) : !isConnecting && connectionState === ConnectionState.Disconnected ? (
          <div className={cn(
            "flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm",
            isMain ? "px-2 py-1" : "px-1.5 py-0.5",
          )}>
            <span className={cn("inline-flex rounded-full bg-neutral-500", isMain ? "h-2 w-2" : "h-1.5 w-1.5")} />
            {isMain && (
              <span className="text-[0.6rem] font-bold uppercase tracking-wide text-neutral-400">
                Offline
              </span>
            )}
          </div>
        ) : null}
      </div>

      {videoTrack && isVideoEnabled ? (
        <VideoTrack
          trackRef={videoTrack}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 select-none pointer-events-none bg-neutral-900">
          <div
            className={cn(
              "rounded-full bg-black/30 flex items-center justify-center",
              isMain ? "h-20 w-20" : "h-10 w-10",
            )}
          >
            {isConnecting ? (
              <div
                className={cn(
                  "animate-spin rounded-full border-2 border-white/20 border-t-white/70",
                  isMain ? "h-9 w-9" : "h-5 w-5",
                )}
              />
            ) : (
              <VideoOff
                className={cn(
                  "text-white/40",
                  isMain ? "h-9 w-9" : "h-5 w-5",
                )}
              />
            )}
          </div>
          <span
            className={cn(
              "font-medium truncate max-w-[88%] text-center text-white/60",
              isMain ? "text-base" : "text-[0.65rem] leading-tight",
            )}
          >
            {isConnecting ? (isMain ? "Connecting..." : "...") : name}
          </span>
        </div>
      )}

      {/* Station name + audio activity — shown when video is on */}
      {videoTrack && isVideoEnabled && (
        <div className="absolute top-2 left-2 pointer-events-none select-none flex items-center gap-1.5">
          <span
            className={cn(
              "rounded bg-black/50 px-1.5 py-0.5 font-medium text-white/90",
              isMain ? "text-xs" : "text-[0.6rem]",
            )}
          >
            {name}
          </span>
          {/* Animated sound bars when remote audio is active */}
          {isRemoteSpeaking && <SoundBars isMain={isMain} />}
        </div>
      )}

      {/* Audio tracks — hidden, only for playback */}
      {allTracks
        .filter(
          (t) =>
            !t.participant.isLocal &&
            (t.publication.source === Track.Source.Microphone ||
              t.publication.source === Track.Source.ScreenShareAudio),
        )
        .map((t) => (
          <AudioTrack
            key={t.publication.trackSid}
            trackRef={t}
            muted={!isAudioEnabled}
            volume={volume}
          />
        ))}

      {/* Bottom gradient + controls */}
      {!viewerOnly && (
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-linear-to-t from-black/65 to-transparent",
          isMain ? "px-2 pb-2 pt-12" : "px-1.5 pb-1.5 pt-10",
        )}
      >
        <div className="flex items-center gap-1">
          {/* Sound button + volume popup */}
          {isMain ? (
            <div
              className="relative flex items-center"
              onMouseEnter={openVol}
              onMouseLeave={scheduleClose}
            >
              <Button
                variant="ghost"
                size="sm"
                aria-label={isAudioEnabled ? "Mute audio" : "Unmute audio"}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleAudio();
                }}
                className={cn(
                  "relative z-10 h-8 gap-1.5 px-2.5 text-xs text-white hover:bg-white/20 hover:text-white focus-visible:ring-white/40",
                  !isAudioEnabled && "text-red-400 hover:text-red-300",
                )}
              >
                {isAudioEnabled ? (
                  <Volume2 className="h-3.5 w-3.5" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5" />
                )}
                <span>{isAudioEnabled ? "Sound" : "Sound Off"}</span>
              </Button>

              {/* Vertical volume pop-up — pb-2 bridges the gap so mouse doesn't lose hover */}
              <div
                className={cn(
                  "absolute bottom-full left-1/2 -translate-x-1/2 pb-2 transition-opacity duration-150 ease-out z-50",
                  volOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
                )}
                onMouseEnter={openVol}
                onMouseLeave={scheduleClose}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="flex items-center justify-center rounded-lg bg-black/60 backdrop-blur-sm"
                  style={{ width: 32, height: 80, padding: "10px 0" }}
                >
                  <Slider
                    orientation="vertical"
                    value={[isAudioEnabled ? Math.round(volume * 100) : 0]}
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
            <Button
              variant="ghost"
              size="icon"
              aria-label={isAudioEnabled ? "Mute audio" : "Unmute audio"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleAudio();
              }}
              className={cn(
                "h-6 w-6 text-white hover:bg-white/20 hover:text-white focus-visible:ring-white/40",
                !isAudioEnabled && "text-red-400 hover:text-red-300",
              )}
            >
              {isAudioEnabled ? (
                <Volume2 className="h-3 w-3" />
              ) : (
                <VolumeX className="h-3 w-3" />
              )}
            </Button>
          )}

          {/* Video toggle */}
          <Button
            variant="ghost"
            size={isMain ? "sm" : "icon"}
            aria-label={isVideoEnabled ? "Stop video" : "Start video"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleVideo();
            }}
            className={cn(
              "text-white hover:bg-white/20 hover:text-white focus-visible:ring-white/40",
              isMain ? "h-8 gap-1.5 px-2.5 text-xs" : "h-6 w-6",
              !isVideoEnabled && "text-red-400 hover:text-red-300",
            )}
          >
            {isVideoEnabled ? (
              <Video className={cn(isMain ? "h-3.5 w-3.5" : "h-3 w-3")} />
            ) : (
              <VideoOff className={cn(isMain ? "h-3.5 w-3.5" : "h-3 w-3")} />
            )}
            {isMain && (
              <span>{isVideoEnabled ? "Video" : "Video Off"}</span>
            )}
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Public component — wraps inner tile in a LiveKitRoom                    */
/* ─────────────────────────────────────────────────────────────────────────── */

export function ScreenTile({
  name,
  roomName: _roomName,
  token,
  serverUrl,
  isMain,
  onClick,
  isVideoEnabled,
  isAudioEnabled,
  myMicEnabled,
  myCamEnabled,
  onToggleVideo,
  onToggleAudio,
  volume = 1,
  onVolumeChange,
  videoQuality = VideoQuality.HIGH,
  viewerOnly = false,
  className,
}: ScreenTileProps) {
  if (!token || !serverUrl) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl bg-neutral-900 flex flex-col items-center justify-center gap-2",
          !isMain &&
            "cursor-pointer ring-2 ring-transparent hover:ring-white/40 transition-shadow duration-200",
          className,
        )}
        onClick={!isMain ? onClick : undefined}
      >
        <div
          className={cn(
            "rounded-full bg-black/30 flex items-center justify-center",
            isMain ? "h-20 w-20" : "h-10 w-10",
          )}
        >
          <div
            className={cn(
              "animate-spin rounded-full border-2 border-white/20 border-t-white/70",
              isMain ? "h-9 w-9" : "h-5 w-5",
            )}
          />
        </div>
        <span
          className={cn(
            "font-medium text-white/50 truncate max-w-[88%] text-center",
            isMain ? "text-base" : "text-[0.65rem] leading-tight",
          )}
        >
          {name}
        </span>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect
      audio={false}
      video={false}
      style={{ display: "contents" }}
    >
      <ScreenTileInner
        name={name}
        isMain={isMain}
        onClick={onClick}
        isVideoEnabled={isVideoEnabled}
        isAudioEnabled={isAudioEnabled}
        myMicEnabled={myMicEnabled}
        myCamEnabled={myCamEnabled}
        onToggleVideo={onToggleVideo}
        onToggleAudio={onToggleAudio}
        volume={volume}
        onVolumeChange={onVolumeChange}
        videoQuality={videoQuality}
        viewerOnly={viewerOnly}
        className={className}
      />
    </LiveKitRoom>
  );
}