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
  BROWSER_FX_LABELS,
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
  type MicCapture,
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
  `boost ${formatBoost(s.boost)}, auto volume ${formatOnOff(s.autoGain)}, ` +
  `browser noise suppression ${formatOnOff(s.noiseSuppression)}, browser echo cancel ${formatOnOff(s.echoCancellation)}`;

/** The three switches that change how the browser captures the mic (each needs a capture restart). */
const CAPTURE_KEYS = ["autoGain", "noiseSuppression", "echoCancellation"] as const;
type CaptureFlags = Pick<DriveThruMicSettings, (typeof CAPTURE_KEYS)[number]>;

/** What the browser itself says the live capture is doing (null = it does not report that flag). */
function readCapture(track: LocalAudioTrack): MicCapture {
  const s = track.getSourceTrackSettings();
  return {
    autoGain: s.autoGainControl ?? null,
    noiseSuppression: s.noiseSuppression ?? null,
    echoCancellation: s.echoCancellation ?? null,
  };
}

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
  // Track whose capture flags were already checked against the saved settings (once per track).
  const healedSidRef = useRef<string | null>(null);

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
        setStatus({ engine: "no-mic", micLabel: undefined, micDeviceId: undefined, onSelectedMic: null, capture: undefined });
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
        capture: readCapture(track),
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
      await healCapture(track);
      if (cancelled) return;
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

    // Make the live capture match `want` (auto volume / noise suppression / echo cancel).
    // One restart covers all three, and only happens if the browser's own report differs.
    // restartTrack replaces constraints instead of merging them, so the current ones are
    // spread back in and the exact current device is pinned (it stays on the selected mic).
    // Returns the flags the browser REALLY ended up with: the caller stores those, so a
    // flag the browser refused is never shown as applied.
    const applyCapture = async (
      want: CaptureFlags,
    ): Promise<{ actual: CaptureFlags; matched: boolean; deferred: boolean }> => {
      const remember = (flags: CaptureFlags) => {
        // LiveKit reads these when it next starts the mic (the participant shares this object).
        room.options.audioCaptureDefaults = {
          ...room.options.audioCaptureDefaults,
          autoGainControl: flags.autoGain,
          noiseSuppression: flags.noiseSuppression,
          echoCancellation: flags.echoCancellation,
          voiceIsolation: flags.noiseSuppression,
        };
      };
      const track = getMicTrack(room);
      if (!track) {
        remember(want);
        micLog("info", "Mic isn't on right now — saved; it applies when the mic starts");
        return { actual: want, matched: true, deferred: true };
      }
      const before = readCapture(track);
      const resolve = (c: MicCapture): CaptureFlags => ({
        autoGain: c.autoGain ?? want.autoGain,
        noiseSuppression: c.noiseSuppression ?? want.noiseSuppression,
        echoCancellation: c.echoCancellation ?? want.echoCancellation,
      });
      if (CAPTURE_KEYS.every((k) => before[k] === want[k])) {
        remember(want);
        return { actual: want, matched: true, deferred: false };
      }
      const deviceId = track.getSourceTrackSettings().deviceId;
      try {
        await track.restartTrack({
          ...(track.constraints as AudioCaptureOptions),
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          autoGainControl: want.autoGain,
          noiseSuppression: want.noiseSuppression,
          echoCancellation: want.echoCancellation,
          voiceIsolation: want.noiseSuppression,
        });
      } catch (err) {
        micLog("error", `Could not restart the mic to change browser processing: ${errorText(err)}`);
        const actual = resolve(readCapture(track));
        remember(actual);
        return { actual, matched: false, deferred: false };
      }
      const after = readCapture(track);
      const actual = resolve(after);
      let matched = true;
      for (const k of CAPTURE_KEYS) {
        if (before[k] === want[k]) continue; // this one wasn't asked to change
        if (after[k] === null || after[k] === want[k]) {
          const said = after[k] === null ? "not reported" : formatOnOff(after[k]!).toLowerCase();
          micLog("ok", `${BROWSER_FX_LABELS[k]} ${formatOnOff(want[k])} — browser confirms: ${said} ✓`);
        } else {
          matched = false;
          micLog("warn", `${BROWSER_FX_LABELS[k]}: asked ${formatOnOff(want[k])}, but the browser reports ${formatOnOff(after[k]!)} ⚠`);
        }
      }
      remember(actual);
      return { actual, matched, deferred: false };
    };

    // The mic just started: if the browser is capturing with different processing than the
    // saved settings (an older run, a changed default), fix it once for this track.
    // Done before the processor attaches so the restart doesn't go through it.
    const healCapture = async (track: LocalAudioTrack) => {
      const sid = track.sid ?? "";
      if (healedSidRef.current === sid) return;
      healedSidRef.current = sid;
      const saved = settingsRef.current;
      if (!saved) return;
      const now = readCapture(track);
      if (!CAPTURE_KEYS.some((k) => now[k] !== null && now[k] !== saved[k])) return;
      micLog("info", "Mic started with different browser processing than saved — correcting it");
      const result = await applyCapture(saved);
      if (!result.matched) {
        // The browser won't do what's saved: store what it really has, so every screen tells the truth.
        const reconciled = { ...saved, ...result.actual };
        settingsRef.current = reconciled;
        saveMicSettings(reconciled);
        useMicLogStore.getState().setSettings(reconciled);
      }
    };

    const applyFromManager = async (requested: DriveThruMicSettings, seq: number, from: string) => {
      const prev = settingsRef.current ?? requested;
      const changes = describeMicChanges(prev, requested);
      const changedKeys = CAPTURE_KEYS.filter((k) => prev[k] !== requested[k]);
      processorRef.current?.update(requested);
      if (statusRef.current.engine === "active" || statusRef.current.engine === "off") {
        setStatus({ engine: requested.enabled ? "active" : "off" });
      }

      let next = requested;
      let ok = true;
      let verdict = "applied";
      if (changedKeys.length > 0) {
        const result = await applyCapture(requested);
        next = { ...requested, ...result.actual };
        ok = result.matched;
        const named = (keys: typeof changedKeys) =>
          keys.map((k) => `${BROWSER_FX_LABELS[k].toLowerCase().replace(/^browser /, "")} ${formatOnOff(result.actual[k]).toLowerCase()}`).join(", ");
        if (result.deferred) {
          verdict = "saved — applies when the mic starts";
        } else if (result.matched) {
          verdict = `applied, browser confirms: ${named(changedKeys)}`;
        } else {
          verdict = `NOT fully applied — the browser still reports ${named(changedKeys.filter((k) => result.actual[k] !== requested[k]))}`;
        }
      }

      settingsRef.current = next;
      saveMicSettings(next);
      useMicLogStore.getState().setSettings(next);
      if (changedKeys.length > 0) await refreshMicInfo();

      const text = `${changes.length ? changes.join(", ") : "same settings re-sent"} — ${verdict}`;
      useMicLogStore.getState().setLastManagerChange(text, ok);
      micLog(ok ? "ok" : "warn", `Manager (${from}) changed: ${text}`);
      if (!processorRef.current && statusRef.current.engine === "failed") {
        micLog("warn", "Saved, but noise processing isn't running — only the browser mic switches take effect");
      }
      publishState(seq);
    };

    // Changes are applied one at a time: two quick switch clicks must not run two mic restarts at once.
    let applyQueue: Promise<void> = Promise.resolve();
    const queueApply = (requested: DriveThruMicSettings, seq: number, from: string) => {
      applyQueue = applyQueue
        .then(() => applyFromManager(requested, seq, from))
        .catch((err) => micLog("error", `Could not apply the manager's change: ${errorText(err)}`));
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
        queueApply(msg.settings, msg.seq, from);
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
