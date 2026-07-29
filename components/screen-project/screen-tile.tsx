"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
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
import { Video, VideoOff, Volume2, VolumeX, Camera, CameraOff, Monitor, AlertTriangle, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";
import type { NetworkStatus } from "@/lib/hooks/use-network-status";
import { NetworkBadge } from "./network-badge";
import { useScreenProjectMedia } from "@/lib/hooks/use-screen-project-media";
import { useStationMediaAsset } from "@/lib/hooks/use-station-media-asset";
import { MediaLibraryTrigger } from "./media-library/media-library-trigger";
import { MediaLibrarySheet } from "./media-library/media-library-sheet";
import type { StationMedia } from "@/types/screen-project-media.types";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Station control message types                                            */
/* ─────────────────────────────────────────────────────────────────────────── */

export interface StationStateMsg {
  type: "station-state";
  cameras:  { deviceId: string; label: string }[];
  mics:     { deviceId: string; label: string }[];
  speakers: { deviceId: string; label: string }[];
  activeCameraId:  string;
  activeMicId:     string;
  activeSpeakerId: string;
  micEnabled: boolean;
  camEnabled: boolean;
}

type StationControlMsg =
  | { type: "mic-control";   enabled: boolean }
  | { type: "cam-control";   enabled: boolean }
  | { type: "device-switch"; kind: "audioinput" | "videoinput" | "audiooutput"; deviceId: string }
  | { type: "fullscreen";    enabled: boolean };

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

  /* ── Remote station control (supervisor → station via data channel) ── */
  stationMicEnabled?:       boolean;
  stationCamEnabled?:       boolean;
  stationAudioInput?:       string;
  stationVideoInput?:       string;
  stationAudioOutput?:      string;
  stationFullscreen?:       boolean;
  onToggleStationMic?:      () => void;
  onToggleStationCam?:      () => void;
  onToggleStationFullscreen?: () => void;
  onStationDeviceChange?:   (kind: "audioinput" | "videoinput" | "audiooutput", deviceId: string) => void;
  onStationStateReceived?:  (state: StationStateMsg) => void;
  /**
   * Station side only: fired after a remote device-switch command is applied AND
   * verified against the real track's device settings (not just a resolved promise).
   * Lets the station's own local device-picker UI (e.g. the Settings gear in
   * public-screen-view.tsx) stay in sync with whatever the supervisor switched to.
   */
  onActiveDeviceChange?:    (kind: "audioinput" | "videoinput" | "audiooutput", deviceId: string, label?: string) => void;
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
  stationMicEnabled?:       boolean;
  stationCamEnabled?:       boolean;
  stationAudioInput?:       string;
  stationVideoInput?:       string;
  stationAudioOutput?:      string;
  stationFullscreen?:       boolean;
  onToggleStationMic?:      () => void;
  onToggleStationCam?:      () => void;
  onToggleStationFullscreen?: () => void;
  onStationDeviceChange?:   (kind: "audioinput" | "videoinput" | "audiooutput", deviceId: string) => void;
  onStationStateReceived?:  (state: StationStateMsg) => void;
  onActiveDeviceChange?:    (kind: "audioinput" | "videoinput" | "audiooutput", deviceId: string, label?: string) => void;
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

  useEffect(() => {
    if (connectionState !== ConnectionState.Connected) return;

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
        .catch(() => {});
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
  stationMicEnabled,
  stationCamEnabled,
  stationAudioInput,
  stationVideoInput,
  stationAudioOutput,
  stationFullscreen,
  onToggleStationMic,
  onToggleStationCam,
  onToggleStationFullscreen,
  onStationDeviceChange,
  onStationStateReceived,
  onActiveDeviceChange,
}: InnerProps) {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  // Media library — seeded from the token response (initialMedia) on the station
  // screen so no extra fetch is needed; falls back to lazy fetch for supervisors.
  const { primaryMedia } = useScreenProjectMedia(
    storeId ?? null,
    stationNumber ?? null,
    { isPublic: viewerOnly, initialMedia },
  );

  const room = useRoomContext();
  const connectionState = useConnectionState();

  // Live media pushed from the supervisor over the data channel (see below). Once
  // an update arrives it is authoritative, so the station reflects primary
  // changes / uploads / deletes without a reload. `null` until the first push.
  const [liveMedia, setLiveMedia] = useState<StationMedia[] | null>(null);

  // The primary the station should display: live push wins over the token seed.
  const effectivePrimary = liveMedia
    ? (liveMedia.find((m) => m.is_primary) ?? null)
    : primaryMedia;

  // Downloads + caches the asset and reports progress; keeps the current asset
  // on screen until a *different* primary is fully ready, then swaps.
  const {
    media: displayedMedia,
    src: displayedSrc,
    progress: mediaProgress,
    isDownloading: mediaDownloading,
  } = useStationMediaAsset(effectivePrimary, {
    // Don't start the (potentially large) media download until the room is
    // connected, so it doesn't compete with the LiveKit connection handshake.
    enabled: connectionState === ConnectionState.Connected,
  });

  // Falls back to the always-present logo if the media asset fails to load.
  // Reset whenever the displayed media changes so a new asset gets a fresh try.
  const [mediaError, setMediaError] = useState(false);
  useEffect(() => {
    setMediaError(false);
  }, [displayedMedia?.id]);

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

  const isConnecting =
    connectionState === ConnectionState.Connecting ||
    connectionState === ConnectionState.Reconnecting;

  // Live = connected AND the station is actively streaming video
  const isLive = connectionState === ConnectionState.Connected && !!videoTrack;

  // Notify parent whenever live status changes
  useEffect(() => {
    onLiveChange?.(isLive);
  }, [isLive, onLiveChange]);

  // Media comes entirely from the station token response (initialMedia), which
  // already embeds the media list with the correct `is_primary`. We deliberately
  // do NOT fetch /media from the station screen — the token seed is the single
  // source, so there's no extra request here and no risk of overwriting the
  // seed. The newest primary is picked up when a fresh token is issued (i.e. on
  // (re)auth / reload). Supervisor tiles never render the fallback and never
  // fetch media either; the media library sheet fetches on its own when opened.

  // Detect if any remote participant is speaking (audio activity)
  const speakingParticipants = useSpeakingParticipants();
  const isRemoteSpeaking = speakingParticipants.some((p) => !p.isLocal);

  // Supervisor side: device list received from the station via "station-state" data channel
  const [stationInfo, setStationInfo] = useState<StationStateMsg | null>(null);

  // Station side: on-screen confirmation that a remote command arrived and was applied —
  // this is a kiosk device with no DevTools access, so console logs alone aren't enough.
  const [controlToast, setControlToast] = useState<{ text: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!controlToast) return;
    const t = setTimeout(() => setControlToast(null), 3500);
    return () => clearTimeout(t);
  }, [controlToast]);

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
    const handler = (payload: Uint8Array) => {
      const raw = new TextDecoder().decode(payload);
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
          setRemoteNetworkStatus({
            online: msg.online,
            effectiveType: msg.effectiveType ?? undefined,
            downlink: msg.downlink ?? undefined,
            rtt: msg.rtt ?? undefined,
            connectionQuality: msg.connectionQuality ?? undefined,
          });
        }
      } catch { /* ignore malformed */ }
    };
    room.on(RoomEvent.DataReceived, handler);
    return () => { room.off(RoomEvent.DataReceived, handler); };
  }, [room, publishNetworkStatus]);

  // ── Station-side: publish available devices + current state to supervisor ──
  const publishStationState = useCallback(async () => {
    if (!room.localParticipant.permissions?.canPublishData) return;
    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
    const cameras  = devices.filter(d => d.kind === "videoinput"  && d.deviceId).map(d => ({ deviceId: d.deviceId, label: d.label || d.deviceId }));
    const mics     = devices.filter(d => d.kind === "audioinput"  && d.deviceId).map(d => ({ deviceId: d.deviceId, label: d.label || d.deviceId }));
    const speakers = devices.filter(d => d.kind === "audiooutput" && d.deviceId).map(d => ({ deviceId: d.deviceId, label: d.label || d.deviceId }));
    // Report the device that is ACTUALLY active on each track, not just the first enumerated one
    const camTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
    const micTrack = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
    const activeCameraId  = camTrack?.mediaStreamTrack.getSettings().deviceId  || cameras[0]?.deviceId  || "";
    const activeMicId     = micTrack?.mediaStreamTrack.getSettings().deviceId || mics[0]?.deviceId     || "";
    // Report the real hardware label too, so the station's own UI can show a
    // ground-truth "Active mic: X" readout instead of relying on browser/OS chrome
    // that doesn't reflect a page's internal WebRTC device selection.
    if (camTrack) onActiveDeviceChange?.("videoinput", activeCameraId, camTrack.mediaStreamTrack.label);
    if (micTrack) onActiveDeviceChange?.("audioinput", activeMicId, micTrack.mediaStreamTrack.label);
    const msg: StationStateMsg = {
      type: "station-state",
      cameras, mics, speakers,
      activeCameraId,
      activeMicId,
      activeSpeakerId: speakers[0]?.deviceId || "",
      micEnabled: true,
      camEnabled: true,
    };
    room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify(msg)),
      { reliable: true, topic: "station-state" },
    ).catch(() => {});
  }, [room, onActiveDeviceChange]);

  useEffect(() => {
    if (!publishNetworkStatus || connectionState !== ConnectionState.Connected) return;
    publishStationState();
  }, [connectionState, publishNetworkStatus, publishStationState]);

  useEffect(() => {
    if (!publishNetworkStatus) return;
    navigator.mediaDevices.addEventListener("devicechange", publishStationState);
    return () => navigator.mediaDevices.removeEventListener("devicechange", publishStationState);
  }, [publishNetworkStatus, publishStationState]);

  // ── Station-side: local Settings-gear device change (not a remote command) —
  // verify against the real track, then sync the confirmed device back to the
  // supervisor's view exactly like a remote-triggered switch does.
  useEffect(() => {
    if (!publishNetworkStatus || connectionState !== ConnectionState.Connected || !selectedAudioDeviceId) return;
    room.switchActiveDevice("audioinput", selectedAudioDeviceId)
      .then(() => {
        const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
        if (track && track.mediaStreamTrack.getSettings().deviceId === selectedAudioDeviceId) {
          onActiveDeviceChange?.("audioinput", selectedAudioDeviceId, track.mediaStreamTrack.label);
          publishStationState();
        }
      })
      .catch(() => {});
  }, [selectedAudioDeviceId, connectionState, room, publishNetworkStatus, onActiveDeviceChange, publishStationState]);

  useEffect(() => {
    if (!publishNetworkStatus || connectionState !== ConnectionState.Connected || !selectedVideoDeviceId) return;
    room.switchActiveDevice("videoinput", selectedVideoDeviceId)
      .then(() => {
        const track = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
        if (track && track.mediaStreamTrack.getSettings().deviceId === selectedVideoDeviceId) {
          onActiveDeviceChange?.("videoinput", selectedVideoDeviceId, track.mediaStreamTrack.label);
          publishStationState();
        }
      })
      .catch(() => {});
  }, [selectedVideoDeviceId, connectionState, room, publishNetworkStatus, onActiveDeviceChange, publishStationState]);

  // ── Station-side: receive supervisor commands and execute them directly ────
  // Checks msg.type instead of topic — topic can be undefined with some LiveKit server versions.
  useEffect(() => {
    if (!publishNetworkStatus) return;
    const handler = (payload: Uint8Array) => {
      const raw = new TextDecoder().decode(payload);
      let msg: StationControlMsg;
      try {
        msg = JSON.parse(raw) as StationControlMsg;
      } catch {
        return; // not JSON — ignore
      }
      // Only react to our control message shapes
      if (!msg || !("type" in msg)) return;
      if (msg.type !== "mic-control" && msg.type !== "cam-control" && msg.type !== "device-switch" && msg.type !== "fullscreen") return;

      switch (msg.type) {
        case "mic-control":
          room.localParticipant.setMicrophoneEnabled(msg.enabled)
            .then(() => setControlToast({ text: msg.enabled ? "Mic turned on" : "Mic turned off", ok: true }))
            .catch(() => setControlToast({ text: "Mic switch failed", ok: false }));
          break;
        case "cam-control":
          room.localParticipant.setCameraEnabled(msg.enabled)
            .then(() => setControlToast({ text: msg.enabled ? "Camera turned on" : "Camera turned off", ok: true }))
            .catch(() => setControlToast({ text: "Camera switch failed", ok: false }));
          break;
        case "device-switch": {
          const label = msg.kind === "videoinput" ? "Camera" : msg.kind === "audioinput" ? "Microphone" : "Speaker";
          room.switchActiveDevice(msg.kind, msg.deviceId)
            .then((switched) => {
              // switchActiveDevice resolves `false` (does NOT throw) when the browser
              // silently declines the switch — checking only .catch() would report a
              // false "success". Verify against the real track's device settings instead
              // of trusting the resolved boolean for anything we can directly inspect.
              const track =
                msg.kind === "videoinput"
                  ? room.localParticipant.getTrackPublication(Track.Source.Camera)?.track
                  : msg.kind === "audioinput"
                    ? room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track
                    : undefined;
              const actualDeviceId = track?.mediaStreamTrack.getSettings().deviceId;
              const actualDeviceLabel = track?.mediaStreamTrack.label;
              const confirmed = track ? actualDeviceId === msg.deviceId : switched;

              setControlToast({
                text: confirmed ? `${label} switched` : `${label} switch did not apply`,
                ok: confirmed,
              });
              if (confirmed) {
                onActiveDeviceChange?.(msg.kind, msg.deviceId, actualDeviceLabel);
                publishStationState(); // re-sync confirmed active device back to supervisor
              }
            })
            .catch(() => setControlToast({ text: `${label} switch failed`, ok: false }));
          break;
        }
        case "fullscreen":
          if (msg.enabled) document.documentElement.requestFullscreen().catch(() => {});
          else document.exitFullscreen().catch(() => {});
          break;
      }
    };
    room.on(RoomEvent.DataReceived, handler);
    return () => { room.off(RoomEvent.DataReceived, handler); };
  }, [room, publishNetworkStatus, publishStationState, onActiveDeviceChange]);

  // ── Station-side: receive media-library updates pushed by the supervisor ───
  // Lets a primary change / upload / delete reach the station screen live, with
  // no reload. The pushed list becomes authoritative (see effectivePrimary).
  useEffect(() => {
    if (!publishNetworkStatus) return;
    const handler = (payload: Uint8Array) => {
      let msg: { type?: string; media?: StationMedia[] };
      try {
        msg = JSON.parse(new TextDecoder().decode(payload));
      } catch {
        return; // not JSON — ignore
      }
      if (msg?.type === "media-update" && Array.isArray(msg.media)) {
        setLiveMedia(msg.media);
      }
    };
    room.on(RoomEvent.DataReceived, handler);
    return () => { room.off(RoomEvent.DataReceived, handler); };
  }, [room, publishNetworkStatus]);

  // ── Supervisor-side: push the current media list to the station ────────────
  // Wired to the media library sheet, which calls this whenever its media
  // changes (primary set, upload, delete).
  const publishMediaUpdate = useCallback(
    (media: StationMedia[]) => {
      if (connectionState !== ConnectionState.Connected) return;
      room.localParticipant
        .publishData(
          new TextEncoder().encode(JSON.stringify({ type: "media-update", media })),
          { reliable: true, topic: "station-media" },
        )
        .catch(() => {});
    },
    [room, connectionState],
  );

  // ── Supervisor-side: send commands to station when props change ───────────
  // Refs keep latest prop values so the ParticipantConnected handler (below)
  // can re-send all commands after a station reconnect without stale closures.
  const stationMicEnabledRef  = useRef(stationMicEnabled);  stationMicEnabledRef.current  = stationMicEnabled;
  const stationCamEnabledRef  = useRef(stationCamEnabled);  stationCamEnabledRef.current  = stationCamEnabled;
  const stationAudioInputRef  = useRef(stationAudioInput);  stationAudioInputRef.current  = stationAudioInput;
  const stationVideoInputRef  = useRef(stationVideoInput);  stationVideoInputRef.current  = stationVideoInput;
  const stationAudioOutputRef = useRef(stationAudioOutput); stationAudioOutputRef.current = stationAudioOutput;
  const stationFullscreenRef  = useRef(stationFullscreen);  stationFullscreenRef.current  = stationFullscreen;

  const publishControl = useCallback((msg: StationControlMsg) => {
    room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify(msg)),
      { reliable: true, topic: "station-control" },
    ).catch(() => {});
  }, [room]);

  useEffect(() => {
    if (publishNetworkStatus || connectionState !== ConnectionState.Connected || stationMicEnabled === undefined) return;
    publishControl({ type: "mic-control", enabled: stationMicEnabled });
  }, [stationMicEnabled, connectionState, publishNetworkStatus, publishControl]);

  useEffect(() => {
    if (publishNetworkStatus || connectionState !== ConnectionState.Connected || stationCamEnabled === undefined) return;
    publishControl({ type: "cam-control", enabled: stationCamEnabled });
  }, [stationCamEnabled, connectionState, publishNetworkStatus, publishControl]);

  useEffect(() => {
    if (publishNetworkStatus || connectionState !== ConnectionState.Connected || !stationAudioInput) return;
    publishControl({ type: "device-switch", kind: "audioinput", deviceId: stationAudioInput });
  }, [stationAudioInput, connectionState, publishNetworkStatus, publishControl]);

  useEffect(() => {
    if (publishNetworkStatus || connectionState !== ConnectionState.Connected || !stationVideoInput) return;
    publishControl({ type: "device-switch", kind: "videoinput", deviceId: stationVideoInput });
  }, [stationVideoInput, connectionState, publishNetworkStatus, publishControl]);

  useEffect(() => {
    if (publishNetworkStatus || connectionState !== ConnectionState.Connected || !stationAudioOutput) return;
    publishControl({ type: "device-switch", kind: "audiooutput", deviceId: stationAudioOutput });
  }, [stationAudioOutput, connectionState, publishNetworkStatus, publishControl]);

  useEffect(() => {
    if (publishNetworkStatus || connectionState !== ConnectionState.Connected || stationFullscreen === undefined) return;
    publishControl({ type: "fullscreen", enabled: stationFullscreen });
  }, [stationFullscreen, connectionState, publishNetworkStatus, publishControl]);

  // Re-send all commands when the station participant reconnects (e.g. page refresh)
  useEffect(() => {
    if (publishNetworkStatus) return;
    const handler = () => {
      if (stationMicEnabledRef.current !== undefined)  publishControl({ type: "mic-control",   enabled: stationMicEnabledRef.current! });
      if (stationCamEnabledRef.current !== undefined)  publishControl({ type: "cam-control",   enabled: stationCamEnabledRef.current! });
      if (stationAudioInputRef.current)  publishControl({ type: "device-switch", kind: "audioinput",  deviceId: stationAudioInputRef.current });
      if (stationVideoInputRef.current)  publishControl({ type: "device-switch", kind: "videoinput",  deviceId: stationVideoInputRef.current });
      if (stationAudioOutputRef.current) publishControl({ type: "device-switch", kind: "audiooutput", deviceId: stationAudioOutputRef.current });
      if (stationFullscreenRef.current !== undefined)  publishControl({ type: "fullscreen",    enabled: stationFullscreenRef.current! });
    };
    room.on(RoomEvent.ParticipantConnected, handler);
    return () => { room.off(RoomEvent.ParticipantConnected, handler); };
  }, [room, publishNetworkStatus, publishControl]);

  // Receive station-state messages — checks msg.type (not topic) for LiveKit compatibility
  useEffect(() => {
    if (publishNetworkStatus) return;
    const handler = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type !== "station-state") return;
        const state = msg as StationStateMsg;
        setStationInfo(state);
        onStationStateReceived?.(state);
      } catch { /* ignore malformed */ }
    };
    room.on(RoomEvent.DataReceived, handler);
    return () => { room.off(RoomEvent.DataReceived, handler); };
  }, [room, publishNetworkStatus, onStationStateReceived]);

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
      {/* ── Remote-control confirmation toast (station side only) — visible proof a
           supervisor command arrived and was applied, since this device has no DevTools ── */}
      {publishNetworkStatus && controlToast && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none select-none">
          <div
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium backdrop-blur-sm shadow-lg",
              controlToast.ok
                ? "bg-green-500/90 text-white"
                : "bg-red-500/90 text-white",
            )}
          >
            {controlToast.text}
          </div>
        </div>
      )}

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
      ) : viewerOnly ? (
        /* Station screen. When media is ready it is shown on its own (no logo).
           The white + logo base only appears while loading or when there is no
           media to show / it failed to load. */
        <div className="absolute inset-0">
          {displayedSrc && displayedMedia && !mediaError ? (
            /* Media ready — shown alone. Images use object-contain so the whole
               image is visible (no zoom/crop); the letterbox is black. */
            <div className="absolute inset-0 bg-black">
              {displayedMedia.type === "image" ? (
                <img
                  src={displayedSrc}
                  alt={displayedMedia.file_name}
                  onError={() => setMediaError(true)}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              ) : (
                <video
                  src={displayedSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  onError={() => setMediaError(true)}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
            </div>
          ) : (
            /* Loading / no media / failed — white + logo base. */
            <div className="absolute inset-0 bg-white">
              <img
                src="/report-logo.png"
                alt=""
                aria-hidden
                className="absolute inset-0 m-auto max-h-[55%] max-w-[70%] object-contain p-6"
              />
            </div>
          )}

          {/* Soft download indicator — only while a new asset is being fetched.
              Small, low-contrast pill so it never dominates the screen. */}
          {mediaDownloading && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center">
              <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 shadow-sm backdrop-blur">
                <div className="h-1 w-28 overflow-hidden rounded-full bg-black/10">
                  {mediaProgress === null ? (
                    <div className="h-full w-full animate-pulse rounded-full bg-black/25" />
                  ) : (
                    <div
                      className="h-full rounded-full bg-black/50 transition-[width] duration-200"
                      style={{ width: `${Math.round(mediaProgress * 100)}%` }}
                    />
                  )}
                </div>
                <span className="text-[0.65rem] font-medium tabular-nums text-black/50">
                  {mediaProgress === null
                    ? "Loading…"
                    : `${Math.round(mediaProgress * 100)}%`}
                </span>
              </div>
            </div>
          )}
        </div>
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

          {/* ── Station device picker (supervisor side only) — sliders button opens camera/mic/speaker selects ── */}
          {!publishNetworkStatus && stationInfo && (
            <>
              {(isMain || !onToggleMyCam) && <div className="ml-auto" />}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Station devices"
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "shrink-0 text-white hover:bg-white/20 hover:text-white focus-visible:ring-white/40",
                      isMain ? "h-8 w-8" : "h-6 w-6",
                    )}
                  >
                    <SlidersHorizontal className={cn(isMain ? "h-3.5 w-3.5" : "h-3 w-3")} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="end"
                  className="w-64 p-3 space-y-3 bg-neutral-900 border-white/10 text-white"
                  onClick={(e) => e.stopPropagation()}
                >
                  {stationInfo.cameras.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[0.65rem] font-medium text-white/50 uppercase tracking-wide">Camera</p>
                      <Select value={stationVideoInput || stationInfo.activeCameraId} onValueChange={(v) => onStationDeviceChange?.("videoinput", v)}>
                        <SelectTrigger className="h-7 w-full max-w-full text-xs bg-white/5 border-white/15 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-900 border-white/10 max-w-[240px]">
                          {stationInfo.cameras.map(c => (
                            <SelectItem key={c.deviceId} value={c.deviceId} title={c.label} className="text-xs text-white focus:bg-white/10 focus:text-white">
                              <span className="block truncate">{c.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {stationInfo.mics.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[0.65rem] font-medium text-white/50 uppercase tracking-wide">Microphone</p>
                      <Select value={stationAudioInput || stationInfo.activeMicId} onValueChange={(v) => onStationDeviceChange?.("audioinput", v)}>
                        <SelectTrigger className="h-7 w-full max-w-full text-xs bg-white/5 border-white/15 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-900 border-white/10 max-w-[240px]">
                          {stationInfo.mics.map(m => (
                            <SelectItem key={m.deviceId} value={m.deviceId} title={m.label} className="text-xs text-white focus:bg-white/10 focus:text-white">
                              <span className="block truncate">{m.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {stationInfo.speakers.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[0.65rem] font-medium text-white/50 uppercase tracking-wide">Speaker</p>
                      <Select value={stationAudioOutput || stationInfo.activeSpeakerId} onValueChange={(v) => onStationDeviceChange?.("audiooutput", v)}>
                        <SelectTrigger className="h-7 w-full max-w-full text-xs bg-white/5 border-white/15 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-900 border-white/10 max-w-[240px]">
                          {stationInfo.speakers.map(s => (
                            <SelectItem key={s.deviceId} value={s.deviceId} title={s.label} className="text-xs text-white focus:bg-white/10 focus:text-white">
                              <span className="block truncate">{s.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
      </div>
      )}
      {/* Network status publisher — renders null, sends data-channel heartbeats */}
      {publishNetworkStatus && <NetworkStatusPublisher />}

      {/* Media library trigger — bottom-right, sitting just above the station
          device-picker (sliders) button, supervisor-only. */}
      {!viewerOnly && storeId && stationNumber !== undefined && (
        <div
          // Guide only targets the main tile's button — side tiles render the
          // same trigger, but only one instance should ever match the selector.
          data-guide-id={isMain ? "sp-media-library" : undefined}
          className={cn(
            "absolute right-2 z-30",
            isMain ? "bottom-12" : "bottom-10",
          )}
        >
          <MediaLibraryTrigger onClick={() => setIsLibraryOpen(true)} />
        </div>
      )}

      {/* Media library sheet */}
      {storeId && stationNumber !== undefined && (
        <MediaLibrarySheet
          open={isLibraryOpen}
          onOpenChange={setIsLibraryOpen}
          storeId={storeId}
          stationNumber={stationNumber}
          stationName={name}
          onMediaChange={!viewerOnly ? publishMediaUpdate : undefined}
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
  stationMicEnabled,
  stationCamEnabled,
  stationAudioInput,
  stationVideoInput,
  stationAudioOutput,
  stationFullscreen,
  onToggleStationMic,
  onToggleStationCam,
  onToggleStationFullscreen,
  onStationDeviceChange,
  onStationStateReceived,
  onActiveDeviceChange,
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
        stationMicEnabled={stationMicEnabled}
        stationCamEnabled={stationCamEnabled}
        stationAudioInput={stationAudioInput}
        stationVideoInput={stationVideoInput}
        stationAudioOutput={stationAudioOutput}
        stationFullscreen={stationFullscreen}
        onToggleStationMic={onToggleStationMic}
        onToggleStationCam={onToggleStationCam}
        onToggleStationFullscreen={onToggleStationFullscreen}
        onStationDeviceChange={onStationDeviceChange}
        onStationStateReceived={onStationStateReceived}
        onActiveDeviceChange={onActiveDeviceChange}
      />
    </LiveKitRoom>
  );
}