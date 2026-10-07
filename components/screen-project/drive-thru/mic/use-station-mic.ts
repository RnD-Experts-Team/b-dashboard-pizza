"use client";

import { useEffect, useRef } from "react";
import {
  ConnectionState,
  RoomEvent,
  Track,
  type AudioCaptureOptions,
  type LocalAudioTrack,
  type RemoteParticipant,
  type Room,
} from "livekit-client";
import {
  createDriveThruMicProcessor,
  DRIVE_THRU_MIC_PROCESSOR_NAME,
  type DriveThruMicProcessor,
  type ProcessorEvent,
} from "./processor";
import {
  decodeMicMessage,
  describeMicChanges,
  encodeMicMessage,
  formatBoost,
  formatOnOff,
  formatStrength,
  formatWindCut,
  MIC_SETTINGS_STORAGE_KEY,
  MIC_TOPIC,
  sanitizeStoredMicSettings,
  type DriveThruMicSettings,
  type MicLevels,
  type MicStatus,
} from "./settings";
import { micLog, useMicLogStore } from "./log-store";

/** How often the station sends its live levels to a connected manager. */
const LEVELS_BROADCAST_MS = 2_000;
/** How often a level summary is written to the log. */
const LEVELS_LOG_MS = 10_000;

/** The station's saved settings (also used at room creation for auto volume). */
export function loadStoredMicSettings(): DriveThruMicSettings {
  try {
    const raw = localStorage.getItem(MIC_SETTINGS_STORAGE_KEY);
    return sanitizeStoredMicSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitizeStoredMicSettings(null);
  }
}

function saveMicSettings(settings: DriveThruMicSettings) {
  try {
    localStorage.setItem(MIC_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    micLog("warn", "Could not save settings on this device (storage blocked) — they will reset on reload");
  }
}

const summary = (s: DriveThruMicSettings) =>
  `filter ${formatOnOff(s.enabled)}, strength ${formatStrength(s.strength)}, wind cut ${formatWindCut(s.windCutHz)}, ` +
  `boost ${formatBoost(s.boost)}, auto volume ${formatOnOff(s.autoGain)}`;

const pct = (v: number) => `${Math.round(v * 100)}%`;
const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

function getMicTrack(room: Room): LocalAudioTrack | undefined {
  return room.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack;
}

/**
 * Station side, drive-thru only: runs RNNoise on the published mic and lets a
 * connected manager tune it over the `drive-thru-mic` data topic. The station is
 * the source of truth: it saves the settings on this device and confirms every
 * change back to the manager. Inert when `enabled` is false.
 */
export function useStationMic({
  enabled,
  room,
  connectionState,
  selectedDeviceId,
}: {
  enabled: boolean;
  room: Room;
  connectionState: ConnectionState;
  /** The station's selected mic ("" / undefined = browser default). */
  selectedDeviceId?: string;
}) {
  const settingsRef = useRef<DriveThruMicSettings | null>(null);
  const processorRef = useRef<DriveThruMicProcessor | null>(null);
  // The processor outlives effect re-runs (e.g. a reconnect blip), so its events
  // are routed through a ref to whichever run is current.
  const eventHandlerRef = useRef<(event: ProcessorEvent) => void>(() => {});
  const statusRef = useRef<MicStatus>({ engine: "starting", onSelectedMic: null });
  const selectedRef = useRef(selectedDeviceId ?? "");
  selectedRef.current = selectedDeviceId ?? "";

  // Load saved settings once.
  useEffect(() => {
    if (!enabled || settingsRef.current) return;
    const saved = loadStoredMicSettings();
    settingsRef.current = saved;
    useMicLogStore.getState().setSettings(saved);
    micLog("info", `Loaded settings: ${summary(saved)}`);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || connectionState !== ConnectionState.Connected) return;
    let cancelled = false;
    let lastLevelsLog = 0;
    let lastLevelsSend = 0;

    const setStatus = (patch: Partial<MicStatus>) => {
      statusRef.current = { ...statusRef.current, ...patch };
      useMicLogStore.getState().setStatus(statusRef.current);
    };

    const publishState = (seq: number | null) => {
      const settings = settingsRef.current;
      if (!settings) return;
      const payload = encodeMicMessage({
        v: 1,
        kind: "state",
        seq,
        settings,
        status: statusRef.current,
        at: Date.now(),
      });
      room.localParticipant
        .publishData(payload, { reliable: true, topic: MIC_TOPIC })
        .catch((err) => micLog("warn", `Could not report state to the manager: ${errorText(err)}`));
    };

    // Which mic is really being captured, and is it the one selected on this station?
    const refreshMicInfo = async () => {
      const track = getMicTrack(room);
      if (!track) {
        setStatus({ engine: "no-mic", micLabel: undefined, micDeviceId: undefined, onSelectedMic: null });
        return;
      }
      const deviceId = track.getSourceTrackSettings().deviceId ?? "";
      let label = "";
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        label = devices.find((d) => d.kind === "audioinput" && d.deviceId === deviceId)?.label ?? "";
      } catch {
        // labels unavailable — fall back to the id below
      }
      const selected = selectedRef.current;
      const onSelectedMic = !selected || selected === "default" ? null : selected === deviceId;
      const prevId = statusRef.current.micDeviceId;
      setStatus({
        micLabel: label || `mic ${deviceId.slice(0, 8)}`,
        micDeviceId: deviceId,
        selectedDeviceId: selected,
        onSelectedMic,
      });
      if (prevId !== deviceId) {
        if (onSelectedMic === false) {
          micLog("warn", `Processing "${label}" but a different mic is selected on this station`);
        } else {
          micLog("ok", `Processing mic: "${label || deviceId}"${onSelectedMic ? " ✓ selected mic" : " (browser default)"}`);
        }
      }
    };

    const handleProcessorEvent = (event: ProcessorEvent) => {
      if (cancelled) return;
      switch (event.type) {
        case "log":
          micLog(event.level, event.text);
          break;
        case "source-changed":
          micLog("info", `Mic switched — processing now follows "${event.label}"`);
          void refreshMicInfo().then(() => publishState(null));
          break;
        case "fallback":
          processorRef.current = null;
          setStatus({ engine: "failed", reason: event.reason, levels: undefined });
          micLog("error", `Noise processing stopped (${event.reason}) — station is using the raw mic`);
          publishState(null);
          break;
        case "stats": {
          setStatus({ levels: event.levels });
          const now = Date.now();
          if (now - lastLevelsSend >= LEVELS_BROADCAST_MS) {
            lastLevelsSend = now;
            publishState(null);
          }
          if (now - lastLevelsLog >= LEVELS_LOG_MS) {
            lastLevelsLog = now;
            logLevels(event.levels);
          }
          break;
        }
      }
    };

    eventHandlerRef.current = handleProcessorEvent;

    const logLevels = (l: MicLevels) => {
      const voice = l.vad === null ? "filter off" : `voice ${pct(l.vad)}`;
      const line = `Levels — mic ${pct(l.inRms)} (peak ${pct(l.inPeak)}), after filter ${pct(l.outRms)}, ${voice}`;
      micLog(l.inPeak >= 0.99 ? "warn" : "info", l.inPeak >= 0.99 ? `${line} — mic is clipping (too loud / wind overload)` : line);
    };

    // Attach the processor to the published mic. Chained so a publish event
    // can't race the first attach.
    let queue: Promise<void> = Promise.resolve();
    const attachOnce = async () => {
      if (cancelled) return;
      const track = getMicTrack(room);
      const settings = settingsRef.current;
      if (!track || !settings) {
        setStatus({ engine: "no-mic" });
        return;
      }
      const existing = track.getProcessor();
      if (existing?.name === DRIVE_THRU_MIC_PROCESSOR_NAME) {
        // Already running from before a reconnect — adopt it instead of restarting.
        processorRef.current = existing as DriveThruMicProcessor;
        processorRef.current.update(settings);
        setStatus({ engine: settings.enabled ? "active" : "off" });
        await refreshMicInfo();
        publishState(null);
        return;
      }
      setStatus({ engine: "starting", reason: undefined });
      await refreshMicInfo();
      const processor = createDriveThruMicProcessor(settings, (event) => eventHandlerRef.current(event));
      try {
        await track.setProcessor(processor);
        if (cancelled) return;
        processorRef.current = processor;
        setStatus({ engine: settings.enabled ? "active" : "off" });
      } catch (err) {
        const reason = errorText(err);
        setStatus({ engine: "failed", reason });
        micLog("error", `Noise processing could not start (${reason}) — station is using the raw mic`);
      }
      publishState(null);
    };
    const attach = () => {
      queue = queue.then(attachOnce);
    };

    // Restart capture with auto volume on/off, keeping every other constraint and
    // the exact current device (restartTrack replaces constraints, it doesn't merge).
    const applyAutoGain = async (on: boolean) => {
      const track = getMicTrack(room);
      if (!track) return;
      const deviceId = track.getSourceTrackSettings().deviceId;
      try {
        await track.restartTrack({
          ...(track.constraints as AudioCaptureOptions),
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          autoGainControl: on,
        });
        const actual = track.getSourceTrackSettings().autoGainControl;
        if (actual === undefined || actual === on) {
          micLog("ok", `Auto volume ${formatOnOff(on)} — mic restarted on the same device`);
        } else {
          micLog("warn", `Auto volume asked ${formatOnOff(on)}, but the browser reports ${formatOnOff(actual)}`);
        }
      } catch (err) {
        micLog("error", `Could not change auto volume: ${errorText(err)}`);
      }
      await refreshMicInfo();
    };

    const applyFromManager = async (next: DriveThruMicSettings, seq: number, from: string) => {
      const prev = settingsRef.current ?? next;
      const changes = describeMicChanges(prev, next);
      settingsRef.current = next;
      saveMicSettings(next);
      useMicLogStore.getState().setSettings(next);
      processorRef.current?.update(next);
      if (statusRef.current.engine === "active" || statusRef.current.engine === "off") {
        setStatus({ engine: next.enabled ? "active" : "off" });
      }
      if (prev.autoGain !== next.autoGain) await applyAutoGain(next.autoGain);

      const text = changes.length ? changes.join(", ") : "same settings re-sent";
      useMicLogStore.getState().setLastManagerChange(text);
      micLog("ok", `Manager (${from}) changed: ${text} ✓ applied`);
      if (!processorRef.current && statusRef.current.engine === "failed") {
        micLog("warn", "Saved, but noise processing isn't running — only auto volume takes effect");
      }
      publishState(seq);
    };

    const onData = (
      payload: Uint8Array,
      participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic !== MIC_TOPIC) return;
      const msg = decodeMicMessage(payload);
      const from = participant?.identity ?? "unknown";
      if (!msg) {
        micLog("warn", `Ignored an invalid mic message from ${from}`);
        return;
      }
      if (msg.kind === "hello") {
        micLog("info", `Manager (${from}) connected — sent current settings`);
        publishState(null);
      } else if (msg.kind === "set") {
        void applyFromManager(msg.settings, msg.seq, from);
      }
      // "state" messages come from other stations' tiles — not for us.
    };

    const onLocalPublished = (pub: { source: Track.Source }) => {
      if (pub.source === Track.Source.Microphone) attach();
    };
    const onParticipantConnected = () => publishState(null);
    const onActiveDeviceChanged = (kind: MediaDeviceKind) => {
      if (kind === "audioinput") void refreshMicInfo().then(() => publishState(null));
    };

    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.LocalTrackPublished, onLocalPublished);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ActiveDeviceChanged, onActiveDeviceChanged);
    attach();

    return () => {
      cancelled = true;
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.LocalTrackPublished, onLocalPublished);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ActiveDeviceChanged, onActiveDeviceChanged);
      // processorRef is kept: the processor stays on the track and is adopted by
      // the next run. LiveKit destroys it when the track stops.
    };
  }, [enabled, connectionState, room]);

  // The station's own mic choice changed — re-check what's really being processed.
  useEffect(() => {
    if (!enabled || connectionState !== ConnectionState.Connected) return;
    const id = setTimeout(() => {
      const track = getMicTrack(room);
      if (!track) return;
      const deviceId = track.getSourceTrackSettings().deviceId ?? "";
      const selected = selectedDeviceId ?? "";
      const onSelectedMic = !selected || selected === "default" ? null : selected === deviceId;
      statusRef.current = { ...statusRef.current, selectedDeviceId: selected, onSelectedMic };
      useMicLogStore.getState().setStatus(statusRef.current);
    }, 800);
    return () => clearTimeout(id);
  }, [enabled, connectionState, room, selectedDeviceId]);
}
