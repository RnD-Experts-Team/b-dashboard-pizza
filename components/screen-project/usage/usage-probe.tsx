"use client";

/**
 * Records how the manager uses one station tile (see lib/screen-usage).
 *
 * Rendered inside the tile's <LiveKitRoom>. It only READS the room and the
 * manager's own tracks — it never enables, mutes or publishes anything — and
 * every failure is swallowed, so it cannot affect the call.
 *
 * Segments per tile:
 *  - session   connected to the station room (ends with the disconnect reason)
 *  - main      the station is in the big main tile (PiP: always)
 *  - camera    the manager's camera is on: visible (a face is there) | no_face | covered
 *              (brightness check + on-device MediaPipe face detection, see lib/screen-usage/face-detector.ts)
 *  - mic       the manager's mic is on: open | dead (no signal at all); talking is counted
 *  - talk_all  same as mic, but while "Talk to All" is held — recorded by the main tile only
 */

import { useEffect, useRef, useState } from "react";
import { useConnectionState, useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { ConnectionState, DisconnectReason, RoomEvent, type LocalParticipant } from "livekit-client";
import type { FaceDetector } from "@mediapipe/tasks-vision";
import { usageRecorder } from "@/lib/screen-usage/recorder";
import { detectFace, loadFaceDetector } from "@/lib/screen-usage/face-detector";
import type { UsageKind, UsageState, UsageSurface } from "@/lib/screen-usage/types";

export interface UsageProbeProps {
  storeId: string;
  room: string;
  surface: UsageSurface;
  isMain: boolean;
  /** "Talk to All" is being held (mic is published into every room). */
  talkAll?: boolean;
}

/** Covered camera = very dark, or a flat image (a finger, tape, a shutter). */
const CAMERA_SAMPLE_MS = 3_000;
const COVERED_MEAN_LUMA = 20;
const COVERED_LUMA_STDDEV = 3;
/** Consecutive identical readings needed before the camera state changes. */
const CAMERA_FLIP_SAMPLES = 2;

type CameraState = "visible" | "no_face" | "covered";

/** Dead mic = no signal at all (≈ -70 dBFS) for this long — muted at the device or covered. */
const MIC_SAMPLE_MS = 1_000;
const DEAD_MIC_RMS = 0.0003;
const DEAD_MIC_AFTER_MS = 20_000;

function endReasonOf(reason?: DisconnectReason): string {
  if (reason === DisconnectReason.DUPLICATE_IDENTITY) return "duplicate_identity";
  if (reason === DisconnectReason.CLIENT_INITIATED) return "left";
  const name = reason !== undefined ? DisconnectReason[reason] : undefined;
  return name ? name.toLowerCase().slice(0, 32) : "network";
}

/** Keeps one segment open while `active`; any change of its identity closes it and opens a new one. */
function useSegment(
  idRef: React.RefObject<string | null>,
  active: boolean,
  storeId: string,
  room: string | null,
  kind: UsageKind,
  state: UsageState,
  surface: UsageSurface,
) {
  useEffect(() => {
    if (!active) return;
    const id = usageRecorder.open({ storeId, room, kind, state, surface });
    idRef.current = id;
    return () => {
      usageRecorder.close(id);
      if (idRef.current === id) idRef.current = null;
    };
  }, [idRef, active, storeId, room, kind, state, surface]);
}

/**
 * Samples the local camera every few seconds: covered (dark/flat frame), else
 * face / no face from the on-device detector. Until the detector has loaded —
 * or if it can't load at all — an uncovered camera counts as visible.
 */
function useCameraState(track: MediaStreamTrack | undefined, enabled: boolean): CameraState {
  const [state, setState] = useState<CameraState>("visible");

  useEffect(() => {
    if (!enabled || !track) return;
    let disposed = false;
    let current: CameraState = "visible";
    let pending: CameraState = "visible";
    let streak = 0;
    let detector: FaceDetector | null = null;
    loadFaceDetector().then((d) => {
      detector = d;
    });
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 18;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    try {
      video.muted = true;
      video.playsInline = true;
      video.srcObject = new MediaStream([track]);
      video.play().catch(() => {});
    } catch {
      return;
    }

    const timer = setInterval(() => {
      try {
        if (disposed || !ctx || video.readyState < 2) return;
        ctx.drawImage(video, 0, 0, 32, 18);
        const px = ctx.getImageData(0, 0, 32, 18).data;
        let sum = 0;
        let sumSq = 0;
        const n = px.length / 4;
        for (let i = 0; i < px.length; i += 4) {
          const y = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          sum += y;
          sumSq += y * y;
        }
        const mean = sum / n;
        const stddev = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
        let reading: CameraState;
        if (mean < COVERED_MEAN_LUMA || stddev < COVERED_LUMA_STDDEV) {
          reading = "covered";
        } else {
          const face = detector ? detectFace(detector, video, track.id) : true;
          if (face === null) return; // can't tell this time — keep the current state
          reading = face ? "visible" : "no_face";
        }

        if (reading === current) {
          streak = 0;
          return;
        }
        streak = reading === pending ? streak + 1 : 1;
        pending = reading;
        if (streak >= CAMERA_FLIP_SAMPLES) {
          current = reading;
          streak = 0;
          setState(current);
        }
      } catch {
        /* never break the call */
      }
    }, CAMERA_SAMPLE_MS);

    return () => {
      disposed = true;
      clearInterval(timer);
      setState("visible");
      try {
        video.pause();
        video.srcObject = null;
      } catch {
        /* ignore */
      }
    };
  }, [track, enabled]);

  return state;
}

/**
 * Watches the local mic: reports "dead" after a long stretch of no signal at
 * all, and counts talking time (LiveKit's server-side speaker detection).
 */
function useMicWatch(
  track: MediaStreamTrack | undefined,
  enabled: boolean,
  participant: LocalParticipant,
  segmentId: React.RefObject<string | null>,
): boolean {
  const [dead, setDead] = useState(false);

  useEffect(() => {
    if (!enabled || !track) return;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let silentSince: number | null = null;
    let isDead = false;
    const buf = new Float32Array(2048);

    try {
      audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(new MediaStream([track]));
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      audioCtx.resume().catch(() => {});
    } catch {
      analyser = null;
    }

    const timer = setInterval(() => {
      try {
        if (participant.isSpeaking) usageRecorder.addTalking(segmentId.current, MIC_SAMPLE_MS);

        // A suspended context reads silence — no verdict rather than a false "dead".
        if (!analyser || audioCtx?.state !== "running") return;
        analyser.getFloatTimeDomainData(buf);
        let sumSq = 0;
        for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
        const rms = Math.sqrt(sumSq / buf.length);

        const now = Date.now();
        if (rms < DEAD_MIC_RMS) {
          silentSince ??= now;
          if (!isDead && now - silentSince >= DEAD_MIC_AFTER_MS) {
            isDead = true;
            setDead(true);
          }
        } else {
          silentSince = null;
          if (isDead) {
            isDead = false;
            setDead(false);
          }
        }
      } catch {
        /* never break the call */
      }
    }, MIC_SAMPLE_MS);

    return () => {
      clearInterval(timer);
      audioCtx?.close().catch(() => {});
      setDead(false);
    };
  }, [track, enabled, participant, segmentId]);

  return dead;
}

export function UsageProbe({ storeId, room, surface, isMain, talkAll = false }: UsageProbeProps) {
  const lkRoom = useRoomContext();
  const connectionState = useConnectionState(lkRoom);
  const { isMicrophoneEnabled, isCameraEnabled, microphoneTrack, cameraTrack, localParticipant } =
    useLocalParticipant();

  // Reconnecting keeps the session open; only a real disconnect ends it.
  const connected =
    connectionState === ConnectionState.Connected ||
    connectionState === ConnectionState.Reconnecting ||
    connectionState === ConnectionState.SignalReconnecting;

  const sessionId = useRef<string | null>(null);
  const mainId = useRef<string | null>(null);
  const cameraId = useRef<string | null>(null);
  const micId = useRef<string | null>(null);

  useSegment(sessionId, connected, storeId, room, "session", null, surface);
  useSegment(mainId, connected && (isMain || surface === "pip"), storeId, room, "main", null, surface);

  // Close the session with the real reason before the effect cleanup closes it as a plain end.
  useEffect(() => {
    const onDisconnected = (reason?: DisconnectReason) => {
      usageRecorder.close(sessionId.current, endReasonOf(reason));
    };
    lkRoom.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      lkRoom.off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [lkRoom]);

  const camOn = connected && isCameraEnabled;
  const cameraState = useCameraState(cameraTrack?.track?.mediaStreamTrack, camOn);
  useSegment(cameraId, camOn, storeId, room, "camera", cameraState, surface);

  // Talk to All publishes the mic into every room: only the main tile records it, once, as talk_all.
  const micKind: UsageKind = talkAll ? "talk_all" : "mic";
  const micOn = connected && isMicrophoneEnabled && (!talkAll || isMain);
  const dead = useMicWatch(microphoneTrack?.track?.mediaStreamTrack, micOn, localParticipant, micId);
  useSegment(micId, micOn, storeId, talkAll ? null : room, micKind, dead ? "dead" : "open", surface);

  return null;
}
