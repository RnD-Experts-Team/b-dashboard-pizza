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
 *  - mic       the manager's mic is on: open | dead (no signal at all); exact talking time
 *  - talk_all  same as mic, but while "Talk to All" is held — recorded by the main tile only
 *
 * Every state change is recorded at the moment it actually began: a camera or
 * mic state confirmed after a few samples is back-dated to the first sample
 * that showed it. Talking time comes from LiveKit's speaking start/stop events,
 * not from sampling (background tabs throttle timers to once a minute).
 */

import { useEffect, useRef, useState } from "react";
import { useConnectionState, useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { ConnectionState, DisconnectReason, ParticipantEvent, RoomEvent } from "livekit-client";
import type { FaceDetector } from "@mediapipe/tasks-vision";
import { usageDebug, usageRecorder } from "@/lib/screen-usage/recorder";
import { FACE_MIN_CONFIDENCE, detectFace, loadFaceDetector } from "@/lib/screen-usage/face-detector";
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

/** A state and the moment it actually started. */
interface Timed<T> {
  value: T;
  since: number;
}

function endReasonOf(reason?: DisconnectReason): string {
  if (reason === DisconnectReason.DUPLICATE_IDENTITY) return "duplicate_identity";
  if (reason === DisconnectReason.CLIENT_INITIATED) return "left";
  const name = reason !== undefined ? DisconnectReason[reason] : undefined;
  return name ? name.toLowerCase().slice(0, 32) : "network";
}

/**
 * Keeps one segment open while `active`. A change of `state` doesn't reopen
 * it from "now": the segment is cut at `state.since`, when the new state
 * really began, and continues from there.
 */
function useSegment(
  idRef: React.RefObject<string | null>,
  active: boolean,
  storeId: string,
  room: string | null,
  kind: UsageKind,
  surface: UsageSurface,
  state: Timed<UsageState> | null = null,
  speaking: () => boolean = () => false,
) {
  // The state at the moment the segment opens; later changes go through transition().
  const stateRef = useRef(state);
  const speakingRef = useRef(speaking);
  useEffect(() => {
    stateRef.current = state;
    speakingRef.current = speaking;
  });

  useEffect(() => {
    if (!active) return;
    const id = usageRecorder.open({
      storeId,
      room,
      kind,
      surface,
      state: stateRef.current?.value ?? null,
      speaking: speakingRef.current(),
    });
    idRef.current = id;
    return () => {
      usageRecorder.close(idRef.current);
      idRef.current = null;
    };
  }, [idRef, active, storeId, room, kind, surface]);

  const value = state?.value ?? null;
  const since = state?.since ?? 0;
  useEffect(() => {
    if (!idRef.current || value === null) return;
    idRef.current = usageRecorder.transition(idRef.current, value, since);
  }, [idRef, value, since]);
}

/**
 * Samples the local camera every few seconds: covered (dark/flat frame), else
 * face / no face from the on-device detector. Until the detector has loaded —
 * or if it can't load at all — an uncovered camera counts as visible.
 */
function useCameraState(track: MediaStreamTrack | undefined, enabled: boolean, debugKey: string): Timed<CameraState> {
  const [state, setState] = useState<Timed<CameraState>>(() => ({ value: "visible", since: 0 }));

  useEffect(() => {
    if (!enabled || !track) return;
    let disposed = false;
    let current: CameraState = "visible";
    let pending: CameraState = "visible";
    let pendingSince = 0;
    let streak = 0;
    let detector: FaceDetector | null = null;
    let detectorStatus: "loading" | "ready" | "unavailable" = "loading";
    loadFaceDetector().then((d) => {
      detector = d;
      detectorStatus = d ? "ready" : "unavailable";
    });
    usageDebug.setProbe(debugKey, { camera: { on: true, state: "visible", mean: null, stddev: null, faceScore: null, detector: detectorStatus, pending: null, streak: 0, sampledAt: null } });
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
        const sampledAt = Date.now();
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
        let faceScore: number | null = null;
        if (mean < COVERED_MEAN_LUMA || stddev < COVERED_LUMA_STDDEV) {
          reading = "covered";
        } else if (detector) {
          faceScore = detectFace(detector, video, track.id);
          if (faceScore === null) return; // can't tell this time — keep the current state
          reading = faceScore >= FACE_MIN_CONFIDENCE ? "visible" : "no_face";
        } else {
          reading = "visible"; // no face detector (yet): an uncovered camera counts as visible
        }
        const publish = () =>
          usageDebug.setProbe(debugKey, {
            camera: { on: true, state: current, mean, stddev, faceScore, detector: detectorStatus, pending: reading === current ? null : pending, streak, sampledAt },
          });

        if (reading === current) {
          streak = 0;
          publish();
          return;
        }
        if (reading === pending && streak > 0) {
          streak += 1;
        } else {
          pending = reading;
          pendingSince = sampledAt; // the first sample that showed the new state
          streak = 1;
        }
        if (streak >= CAMERA_FLIP_SAMPLES) {
          current = reading;
          streak = 0;
          setState({ value: current, since: pendingSince });
        }
        publish();
      } catch {
        /* never break the call */
      }
    }, CAMERA_SAMPLE_MS);

    return () => {
      disposed = true;
      clearInterval(timer);
      setState({ value: "visible", since: 0 });
      usageDebug.setProbe(debugKey, { camera: { on: false } });
      try {
        video.pause();
        video.srcObject = null;
      } catch {
        /* ignore */
      }
    };
  }, [track, enabled, debugKey]);

  return state;
}

/**
 * Watches the local mic for a "dead" signal: no sound at all for a long
 * stretch. The dead state is back-dated to when the silence began.
 */
function useMicState(track: MediaStreamTrack | undefined, enabled: boolean, debugKey: string): Timed<"open" | "dead"> {
  const [state, setState] = useState<Timed<"open" | "dead">>(() => ({ value: "open", since: 0 }));

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

    usageDebug.setProbe(debugKey, { mic: { on: true, state: "open", rms: null, silentSince: null, audio: audioCtx?.state ?? "unavailable", sampledAt: null } });

    const timer = setInterval(() => {
      try {
        // A suspended context reads silence — no verdict rather than a false "dead".
        if (!analyser || audioCtx?.state !== "running") {
          usageDebug.setProbe(debugKey, { mic: { audio: audioCtx?.state ?? "unavailable" } });
          return;
        }
        analyser.getFloatTimeDomainData(buf);
        let sumSq = 0;
        for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
        const rms = Math.sqrt(sumSq / buf.length);

        const now = Date.now();
        if (rms < DEAD_MIC_RMS) {
          silentSince ??= now;
          if (!isDead && now - silentSince >= DEAD_MIC_AFTER_MS) {
            isDead = true;
            setState({ value: "dead", since: silentSince });
          }
        } else {
          silentSince = null;
          if (isDead) {
            isDead = false;
            setState({ value: "open", since: now });
          }
        }
        usageDebug.setProbe(debugKey, { mic: { state: isDead ? "dead" : "open", rms, silentSince, audio: "running", sampledAt: now } });
      } catch {
        /* never break the call */
      }
    }, MIC_SAMPLE_MS);

    return () => {
      clearInterval(timer);
      audioCtx?.close().catch(() => {});
      setState({ value: "open", since: 0 });
      usageDebug.setProbe(debugKey, { mic: { on: false } });
    };
  }, [track, enabled, debugKey]);

  return state;
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

  useSegment(sessionId, connected, storeId, room, "session", surface);
  useSegment(mainId, connected && (isMain || surface === "pip"), storeId, room, "main", surface);

  // Close the session with the real reason (this also pushes the journal right away).
  useEffect(() => {
    const onDisconnected = (reason?: DisconnectReason) => {
      const at = Date.now();
      usageRecorder.close(micId.current, { at });
      usageRecorder.close(cameraId.current, { at });
      usageRecorder.close(mainId.current, { at });
      usageRecorder.close(sessionId.current, { endReason: endReasonOf(reason), at });
    };
    lkRoom.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      lkRoom.off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [lkRoom]);

  // What this tile measures, for the live debug panel.
  const debugKey = `${surface}:${room}`;
  useEffect(() => {
    usageDebug.setProbe(debugKey, { room, surface, isMain, connected, talkAll });
  }, [debugKey, room, surface, isMain, connected, talkAll]);
  useEffect(() => () => usageDebug.removeProbe(debugKey), [debugKey]);

  const camOn = connected && isCameraEnabled;
  const camera = useCameraState(cameraTrack?.track?.mediaStreamTrack, camOn, debugKey);
  useSegment(cameraId, camOn, storeId, room, "camera", surface, camOn ? camera : null);

  // Talk to All publishes the mic into every room: only the main tile records it, once, as talk_all.
  const micKind: UsageKind = talkAll ? "talk_all" : "mic";
  const micOn = connected && isMicrophoneEnabled && (!talkAll || isMain);
  const mic = useMicState(microphoneTrack?.track?.mediaStreamTrack, micOn, debugKey);
  useSegment(micId, micOn, storeId, talkAll ? null : room, micKind, surface, micOn ? mic : null, () => localParticipant.isSpeaking);

  // Exact talking time: every speaking start/stop, at the moment it happens.
  useEffect(() => {
    const onSpeaking = (speaking: boolean) => {
      usageRecorder.setSpeaking(micId.current, speaking);
      usageDebug.setProbe(debugKey, { speaking });
    };
    localParticipant.on(ParticipantEvent.IsSpeakingChanged, onSpeaking);
    return () => {
      localParticipant.off(ParticipantEvent.IsSpeakingChanged, onSpeaking);
    };
  }, [localParticipant, debugKey]);

  return null;
}
