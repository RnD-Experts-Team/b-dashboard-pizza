"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import {
  LiveKitRoom,
  useTracks,
  VideoTrack,
  AudioTrack,
  useRoomContext,
  useConnectionState,
  useSpeakingParticipants,
} from "@livekit/components-react";
import { Track, ConnectionState, VideoQuality, RemoteTrackPublication, RoomEvent, ParticipantEvent } from "livekit-client";
import { Video, VideoOff, Volume2, VolumeX, Camera, CameraOff, Monitor, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";
import type { NetworkStatus } from "@/lib/hooks/use-network-status";
import { NetworkBadge } from "./network-badge";
import { useScreenProjectMedia } from "@/lib/hooks/use-screen-project-media";
import { MediaLibraryTrigger } from "./media-library/media-library-trigger";
import { MediaLibrarySheet } from "./media-library/media-library-sheet";
import type { StationMedia } from "@/types/screen-project-media.types";

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
  /** Toggle the supervisor's camera for this specific room */
  onToggleMyCam?: () => void;
  /** Whether the supervisor's screen share should be published into this room */
  myScreenShareEnabled?: boolean;
  /** Toggle the supervisor's screen share for this room (main tile only) */
  onToggleMyScreenShare?: () => void;
  /** 0-1 local volume gain */
  volume?: number;
  onVolumeChange?: (v: number) => void;
  /** LiveKit subscription quality for this tile */
  videoQuality?: VideoQuality;
  /** When true, hides all A/V control buttons (view-only mode) */
  viewerOnly?: boolean;
  /**
   * When true, renders ALL non-local video tracks in a multi-participant grid.
   * Used for the observer mode so the observer sees every camera in the room.
   */
  observerMode?: boolean;
  /**
   * When true, this tile publishes the local browser's network status to remote
   * participants via the LiveKit data channel. Intended for the public viewer so
   * the supervisor can see the viewer's signal quality on their side.
   */
  publishNetworkStatus?: boolean;
  /**
   * Called whenever the tile's "live" status changes (connected + video track
   * present). Used by the parent to know which stations are safe to put in PiP.
   */
  onLiveChange?: (isLive: boolean) => void;
  /** MediaDeviceInfo.deviceId for the microphone to use (audioinput) */
  selectedAudioDeviceId?: string;
  /** MediaDeviceInfo.deviceId for the camera to use (videoinput) */
  selectedVideoDeviceId?: string;
  className?: string;
  /** Numeric station ID used to fetch/manage the media library */
  stationNumber?: number;
  /** Store ID used to scope media library requests */
  storeId?: string;
  /** Pre-loaded media items (e.g. from the station token response). When
   * provided, skips the initial API fetch and shows the primary item immediately. */
  initialMedia?: StationMedia[];
  /**
   * Called when the user retries after a stuck "waiting for token" state or a
   * failed LiveKit connection. Typically wired to the parent's `refetch()` so a
   * fresh token is requested. If omitted, retry falls back to reloading the page.
   */
  onRetry?: () => void;
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
  onToggleMyCam?: () => void;
  myScreenShareEnabled?: boolean;
  onToggleMyScreenShare?: () => void;
  volume: number;
  onVolumeChange?: (v: number) => void;
  videoQuality: VideoQuality;
  viewerOnly?: boolean;
  observerMode?: boolean;
  publishNetworkStatus?: boolean;
  onLiveChange?: (isLive: boolean) => void;
  selectedAudioDeviceId?: string;
  selectedVideoDeviceId?: string;
  className?: string;
  stationNumber?: number;
  storeId?: string;
  initialMedia?: StationMedia[];
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  NetworkStatusPublisher — runs inside a LiveKitRoom context               */
/*  Periodically broadcasts the local browser network quality to remote      */
/*  participants via the LiveKit data channel (reliable, topic "net-status"). */
/* ─────────────────────────────────────────────────────────────────────────── */

function NetworkStatusPublisher() {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const networkStatus = useNetworkStatus();

  // Log on mount/unmount so we can confirm the component is actually rendered
  useEffect(() => {
    console.debug("[NetworkStatusPublisher] 🟡 mounted");
    return () => console.debug("[NetworkStatusPublisher] 🔴 unmounted");
  }, []);

  // Log every connection state change so we know when/if Connected is reached
  useEffect(() => {
    console.debug("[NetworkStatusPublisher] connectionState:", connectionState);
  }, [connectionState]);

  useEffect(() => {
    if (connectionState !== ConnectionState.Connected) return;

    // Debug: confirm token permissions before attempting to publish
    const perms = room.localParticipant.permissions;
    console.debug(
      "[NetworkStatusPublisher] localParticipant permissions:",
      perms,
    );
    if (!perms?.canPublishData) {
      console.warn(
        "[NetworkStatusPublisher] ⚠️  can_publish_data is NOT granted on this token. " +
          "The backend POST /api/public/screen-project/:store/tokens/station/:id must " +
          "return a JWT with can_publish_data: true. " +
          "Network status will NOT reach the supervisor until this is fixed.",
      );
    }

    const send = () => {
      const q = room.localParticipant.connectionQuality as string;
      const payload = JSON.stringify({
        type: "net-status",
        online: networkStatus.online,
        effectiveType: networkStatus.effectiveType ?? null,
        downlink: networkStatus.downlink ?? null,
        rtt: networkStatus.rtt ?? null,
        connectionQuality: (q === "excellent" || q === "good" || q === "poor" || q === "lost") ? q : null,
      });
      // publishData is async in livekit-client v2 — must use .catch() not try/catch
      room.localParticipant
        .publishData(new TextEncoder().encode(payload), {
          reliable: true,
          topic: "net-status",
        })
        .then(() => {
          console.debug("[NetworkStatusPublisher] ✅ published:", payload);
        })
        .catch((err: unknown) => {
          console.error(
            "[NetworkStatusPublisher] ❌ publishData() rejected — " +
              "check that can_publish_data: true is set in the station token:",
            err,
          );
        });
    };

    send();
    const id = setInterval(send, 5000);
    // Also send immediately whenever LiveKit detects a quality change
    room.localParticipant.on(ParticipantEvent.ConnectionQualityChanged, send);
    return () => {
      clearInterval(id);
      room.localParticipant.off(ParticipantEvent.ConnectionQualityChanged, send);
    };
  }, [networkStatus, connectionState, room]);

  return null;
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
  onToggleMyCam,
  myScreenShareEnabled,
  onToggleMyScreenShare,
  volume,
  onVolumeChange,
  videoQuality,
  viewerOnly = false,
  observerMode = false,
  publishNetworkStatus = false,
  onLiveChange,
  selectedAudioDeviceId,
  selectedVideoDeviceId,
  className,
  stationNumber,
  storeId,
  initialMedia,
}: InnerProps) {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  // Media library — seeded from the token response (initialMedia) on the station
  // screen so no extra fetch is needed; falls back to lazy fetch for supervisors.
  const { primaryMedia, hasFetched, fetchMedia } = useScreenProjectMedia(
    storeId ?? null,
    stationNumber ?? null,
    { isPublic: viewerOnly, initialMedia },
  );

  const allTracks = useTracks([
    Track.Source.ScreenShare,
    Track.Source.Camera,
    Track.Source.Microphone,
    Track.Source.ScreenShareAudio,
  ]);

  // Prefer ScreenShare over Camera — when a supervisor shares their screen it
  // takes priority over their camera feed.
  const screenShareTrack = allTracks.find(
    (t) =>
      !t.participant.isLocal &&
      !t.publication.isMuted &&
      t.publication.source === Track.Source.ScreenShare,
  );
  const cameraTrack = allTracks.find(
    (t) =>
      !t.participant.isLocal &&
      !t.publication.isMuted &&
      t.publication.source === Track.Source.Camera,
  );
  const videoTrack = screenShareTrack ?? cameraTrack;

  // Observer mode: all non-local, non-muted video tracks in a multi-camera grid
  const allVideoTracks = observerMode
    ? allTracks.filter(
        (t) =>
          !t.participant.isLocal &&
          !t.publication.isMuted &&
          (t.publication.source === Track.Source.Camera ||
            t.publication.source === Track.Source.ScreenShare),
      )
    : [];

  const room = useRoomContext();
  const connectionState = useConnectionState();
  const isConnecting =
    connectionState === ConnectionState.Connecting ||
    connectionState === ConnectionState.Reconnecting;

  // Live = connected AND the station is actively streaming video
  const isLive = connectionState === ConnectionState.Connected && !!videoTrack;

  // Notify parent whenever live status changes
  useEffect(() => {
    onLiveChange?.(isLive);
  }, [isLive, onLiveChange]);

  // When the station is not live, lazily fetch media so the primary fallback is
  // ready. On the station screen the hook is pre-seeded from the token response
  // (hasFetched = true), so this effect is effectively a no-op there.
  useEffect(() => {
    if (!isLive && !hasFetched) {
      fetchMedia();
    }
  }, [isLive, hasFetched, fetchMedia]);

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

  // Publish / unpublish supervisor's screen share (main tile only)
  useEffect(() => {
    if (connectionState !== ConnectionState.Connected) return;
    room.localParticipant
      .setScreenShareEnabled(!!myScreenShareEnabled, { audio: true })
      .catch(() => {});
  }, [myScreenShareEnabled, connectionState, room]);

  // Switch active microphone device when the selected audio device changes
  useEffect(() => {
    if (connectionState !== ConnectionState.Connected) return;
    if (!selectedAudioDeviceId) return;
    room.switchActiveDevice("audioinput", selectedAudioDeviceId).catch(() => {});
  }, [selectedAudioDeviceId, connectionState, room]);

  // Switch active camera device when the selected video device changes
  useEffect(() => {
    if (connectionState !== ConnectionState.Connected) return;
    if (!selectedVideoDeviceId) return;
    room.switchActiveDevice("videoinput", selectedVideoDeviceId).catch(() => {});
  }, [selectedVideoDeviceId, connectionState, room]);

  // Request the appropriate simulcast layer from the server
  useEffect(() => {
    if (!videoTrack) return;
    const pub = videoTrack.publication;
    if (pub instanceof RemoteTrackPublication) {
      pub.setVideoQuality(videoQuality);
    }
  }, [videoTrack, videoQuality]);

  // Remote viewer's network quality — received via LiveKit data channel
  const [remoteNetworkStatus, setRemoteNetworkStatus] = useState<NetworkStatus | null>(null);

  useEffect(() => {
    if (publishNetworkStatus) return; // publisher side — no need to listen
    console.debug("[ScreenTileInner] 👂 attaching DataReceived listener, room:", room.name);
    const handler = (payload: Uint8Array, _participant: unknown, _kind: unknown, topic?: string) => {
      const raw = new TextDecoder().decode(payload);
      console.debug("[ScreenTileInner] 📨 DataReceived topic:", topic, "raw:", raw);
      try {
        const msg = JSON.parse(raw) as {
          type: string;
          online: boolean;
          effectiveType?: NetworkStatus["effectiveType"];
          downlink?: number | null;
          rtt?: number | null;
          connectionQuality?: NetworkStatus["connectionQuality"] | null;
        };
        if (msg.type === "net-status") {
          console.debug("[ScreenTileInner] ✅ updating remoteNetworkStatus:", msg);
          setRemoteNetworkStatus({
            online: msg.online,
            effectiveType: msg.effectiveType ?? undefined,
            downlink: msg.downlink ?? undefined,
            rtt: msg.rtt ?? undefined,
            connectionQuality: msg.connectionQuality ?? undefined,
          });
        }
      } catch {
        console.warn("[ScreenTileInner] ⚠️ could not parse DataReceived payload:", raw);
      }
    };
    room.on(RoomEvent.DataReceived, handler);
    return () => { room.off(RoomEvent.DataReceived, handler); };
  }, [room, publishNetworkStatus]);

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
      {/* ── Status badges — top-right stack (Live/Offline + remote viewer signal) ── */}
      <div className="absolute top-2 right-2 z-10 pointer-events-none select-none flex flex-col items-end gap-1">
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
        {/* Remote viewer's network quality — supervisor side only */}
        {remoteNetworkStatus && !publishNetworkStatus && (
          <NetworkBadge status={remoteNetworkStatus} iconOnly={!isMain} />
        )}
      </div>

      {observerMode ? (
        /* Observer mode — fixed 2-panel layout: station (left) + supervisor (right) */
        <div className="absolute inset-0 grid grid-cols-2 gap-1 p-1">
          {([allVideoTracks[0], allVideoTracks[1]] as const).map((t, i) => (
            <div
              key={t?.publication.trackSid ?? `placeholder-${i}`}
              className="relative overflow-hidden rounded-lg bg-neutral-900"
            >
              {t ? (
                <>
                  <VideoTrack
                    trackRef={t}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[0.6rem] font-medium text-white/80 backdrop-blur-sm">
                    {t.participant.identity}
                  </span>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 select-none pointer-events-none">
                  <VideoOff className="h-7 w-7 text-white/25" />
                  <span className="text-[0.65rem] text-white/40">Not streaming</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : videoTrack && isVideoEnabled ? (
        <VideoTrack
          trackRef={videoTrack}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : viewerOnly && primaryMedia && !isConnecting ? (
        /* Primary media fallback — shown on the station screen when supervisor's camera is off */
        primaryMedia.type === "image" ? (
          <img
            src={primaryMedia.url}
            alt={primaryMedia.file_name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <video
            src={primaryMedia.url}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        )
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
        <div className="flex items-center gap-1 overflow-x-auto flex-nowrap">
          {/* Sound button + volume popup */}
          {isMain ? (
            <div
              className="relative flex items-center shrink-0"
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
                "h-6 w-6 shrink-0 text-white hover:bg-white/20 hover:text-white focus-visible:ring-white/40",
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
              "shrink-0 text-white hover:bg-white/20 hover:text-white focus-visible:ring-white/40",
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

          {/* Screen share toggle — main tile only */}
          {isMain && onToggleMyScreenShare && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={myScreenShareEnabled ? "Stop sharing screen" : "Share screen"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleMyScreenShare();
              }}
              className={cn(
                "h-8 shrink-0 gap-1.5 px-2.5 text-xs text-white hover:bg-white/20 hover:text-white focus-visible:ring-white/40",
                myScreenShareEnabled && "text-red-400 hover:text-red-300",
              )}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>{myScreenShareEnabled ? "Stop Share" : "Share Screen"}</span>
            </Button>
          )}

          {/* My camera toggle — bottom-right: controls whether supervisor's cam is sent to THIS room (side tiles only) */}
          {!isMain && onToggleMyCam && (
            <Button
              variant="ghost"
              size={isMain ? "sm" : "icon"}
              aria-label={myCamEnabled ? "Stop sending my camera here" : "Send my camera here"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleMyCam();
              }}
              className={cn(
                "ml-auto shrink-0 text-white hover:bg-white/20 hover:text-white focus-visible:ring-white/40",
                isMain ? "h-8 gap-1.5 px-2.5 text-xs" : "h-6 w-6",
                !myCamEnabled && "text-red-400 hover:text-red-300",
              )}
            >
              {myCamEnabled ? (
                <Camera className={cn(isMain ? "h-3.5 w-3.5" : "h-3 w-3")} />
              ) : (
                <CameraOff className={cn(isMain ? "h-3.5 w-3.5" : "h-3 w-3")} />
              )}
              {isMain && (
                <span>{myCamEnabled ? "My Cam" : "My Cam Off"}</span>
              )}
            </Button>
          )}
        </div>
      </div>
      )}
      {/* Network status publisher — renders null, sends data-channel heartbeats */}
      {publishNetworkStatus && <NetworkStatusPublisher />}

      {/* Media library trigger — top-left overlay, always visible for supervisors */}
      {/* {!viewerOnly && storeId && stationNumber !== undefined && (
        <div className="absolute top-2 left-2 z-20">
          <MediaLibraryTrigger onClick={() => setIsLibraryOpen(true)} />
        </div>
      )} */}

      {/* Media library sheet */}
      {storeId && stationNumber !== undefined && (
        <MediaLibrarySheet
          open={isLibraryOpen}
          onOpenChange={setIsLibraryOpen}
          storeId={storeId}
          stationNumber={stationNumber}
          stationName={name}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  StatusCard — shared "waiting" / "error" placeholder shown in place of    */
/*  the tile's video (no token yet, connection timed out, or LiveKit error). */
/* ─────────────────────────────────────────────────────────────────────────── */

interface StatusCardProps {
  isMain: boolean;
  variant: "loading" | "error";
  title: string;
  subtitle?: string;
  onRetry?: () => void;
  onClick?: () => void;
  className?: string;
}

function StatusCard({ isMain, variant, title, subtitle, onRetry, onClick, className }: StatusCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-neutral-900 flex flex-col items-center justify-center gap-2 p-3 text-center",
        !isMain &&
          "cursor-pointer ring-2 ring-transparent hover:ring-white/40 transition-shadow duration-200",
        className,
      )}
      onClick={!isMain ? onClick : undefined}
    >
      <div
        className={cn(
          "rounded-full flex items-center justify-center",
          variant === "error" ? "bg-red-500/10" : "bg-black/30",
          isMain ? "h-20 w-20" : "h-10 w-10",
        )}
      >
        {variant === "error" ? (
          <AlertTriangle className={cn("text-red-400", isMain ? "h-9 w-9" : "h-5 w-5")} />
        ) : (
          <div
            className={cn(
              "animate-spin rounded-full border-2 border-white/20 border-t-white/70",
              isMain ? "h-9 w-9" : "h-5 w-5",
            )}
          />
        )}
      </div>
      <span
        className={cn(
          "font-medium truncate max-w-[92%]",
          variant === "error" ? "text-red-400" : "text-white/50",
          isMain ? "text-base" : "text-[0.65rem] leading-tight",
        )}
      >
        {title}
      </span>
      {subtitle && isMain && (
        <span className="text-xs text-white/40 max-w-[85%]">{subtitle}</span>
      )}
      {onRetry && isMain && (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
          className="mt-1 gap-1.5 h-7 text-xs bg-white/5 border-white/15 text-white hover:bg-white/10 hover:text-white"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </Button>
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
  onToggleMyCam,
  myScreenShareEnabled,
  onToggleMyScreenShare,
  volume = 1,
  onVolumeChange,
  videoQuality = VideoQuality.HIGH,
  viewerOnly = false,
  observerMode = false,
  publishNetworkStatus = false,
  onLiveChange,
  selectedAudioDeviceId,
  selectedVideoDeviceId,
  className,
  stationNumber,
  storeId,
  initialMedia,
  onRetry,
}: ScreenTileProps) {
  // Hooks must run unconditionally on every render (rules of hooks) — the
  // token/serverUrl guard below only affects what gets returned, not which
  // hooks are called, so it can safely flip between renders without a
  // "rendered fewer/more hooks than expected" crash.

  // Memoize options so the object reference stays stable between renders.
  // A new object on every render would cause LiveKitRoom to tear down and
  // recreate the room (closing the RTCEngine) on each re-render.
  const roomOptions = useMemo(
    () => ({
      audioCaptureDefaults: selectedAudioDeviceId ? { deviceId: selectedAudioDeviceId } : undefined,
      videoCaptureDefaults: selectedVideoDeviceId ? { deviceId: selectedVideoDeviceId } : undefined,
    }),
    // Only re-create when the initial device IDs change (not on every render).
    // Device switching after connect is handled via room.switchActiveDevice inside ScreenTileInner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Waiting for a token/serverUrl to arrive from the parent — after a grace
  // period, swap the spinner for an explicit "taking too long" error card
  // instead of spinning forever.
  const hasConnectionInfo = !!token && !!serverUrl;
  const [waitTimedOut, setWaitTimedOut] = useState(false);
  useEffect(() => {
    if (hasConnectionInfo) {
      setWaitTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setWaitTimedOut(true), 12000);
    return () => clearTimeout(timer);
  }, [hasConnectionInfo]);

  // LiveKit connection failure (bad/expired token, unreachable server, etc.).
  // `attempt` is bumped on retry and used as the LiveKitRoom `key` to force a
  // full remount + fresh connection attempt.
  const [connectError, setConnectError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const handleRetry = () => {
    setWaitTimedOut(false);
    setConnectError(null);
    setAttempt((a) => a + 1);
    if (onRetry) {
      onRetry();
    } else if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  if (!hasConnectionInfo) {
    return (
      <StatusCard
        isMain={isMain}
        variant={waitTimedOut ? "error" : "loading"}
        title={waitTimedOut ? "Couldn't connect" : name}
        subtitle={waitTimedOut ? "This station is taking too long to respond." : undefined}
        onRetry={waitTimedOut ? handleRetry : undefined}
        onClick={onClick}
        className={className}
      />
    );
  }

  if (connectError) {
    return (
      <StatusCard
        isMain={isMain}
        variant="error"
        title="Connection failed"
        subtitle={connectError}
        onRetry={handleRetry}
        onClick={onClick}
        className={className}
      />
    );
  }

  return (
    <LiveKitRoom
      key={attempt}
      serverUrl={serverUrl}
      token={token}
      connect
      audio={false}
      video={false}
      options={roomOptions}
      style={{ display: "contents" }}
      onError={(err) => setConnectError(err.message || "Unable to connect to the station stream.")}
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
        onToggleMyCam={onToggleMyCam}
        myScreenShareEnabled={myScreenShareEnabled}
        onToggleMyScreenShare={onToggleMyScreenShare}
        volume={volume}
        onVolumeChange={onVolumeChange}
        videoQuality={videoQuality}
        viewerOnly={viewerOnly}
        observerMode={observerMode}
        publishNetworkStatus={publishNetworkStatus}
        onLiveChange={onLiveChange}
        selectedAudioDeviceId={selectedAudioDeviceId}
        selectedVideoDeviceId={selectedVideoDeviceId}
        className={className}
        stationNumber={stationNumber}
        storeId={storeId}
        initialMedia={initialMedia}
      />
    </LiveKitRoom>
  );
}