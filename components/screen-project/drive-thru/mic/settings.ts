/**
 * Drive-thru station mic processing: settings, ranges and the manager ⇄ station
 * message protocol. Pure logic, no React. Every value that comes from the
 * network or from localStorage goes through `sanitizeMicSettings` /
 * `parseMicMessage` before it is used.
 */

export type DriveThruMicSettings = {
  /** RNNoise noise removal on/off (wind cut, boost and the limiter still apply when off). */
  enabled: boolean;
  /** 0..1 — share of the cleaned sound vs the original. */
  strength: number;
  /** High-pass cutoff in Hz; 0 = off. */
  windCutHz: number;
  /** Output gain, 1 = unchanged. */
  boost: number;
  /** Browser automatic gain control on the capture. */
  autoGain: boolean;
  /** Show the test panel on the station screen. */
  testPanel: boolean;
};

export const DEFAULT_MIC_SETTINGS: DriveThruMicSettings = {
  enabled: true,
  strength: 1,
  windCutHz: 80,
  boost: 1,
  autoGain: true,
  testPanel: true,
};

export const MIC_RANGES = {
  strength: { min: 0, max: 1, step: 0.05 },
  /** Values below `min` mean "off". */
  windCutHz: { min: 60, max: 250, step: 10 },
  boost: { min: 0.5, max: 3, step: 0.1 },
} as const;

export const MIC_TOPIC = "drive-thru-mic";
export const MIC_PROTOCOL_VERSION = 1;
export const MIC_SETTINGS_STORAGE_KEY = "drive-thru-mic-settings";

export type MicEngineState = "starting" | "active" | "off" | "failed" | "no-mic";

export type MicLevels = {
  /** RMS of the raw mic, 0..1 */
  inRms: number;
  /** RMS after processing, 0..1 */
  outRms: number;
  /** Loudest raw sample in the window, 0..1 (1 = the mic is clipping). */
  inPeak: number;
  /** Average RNNoise voice probability 0..1, null when RNNoise isn't running. */
  vad: number | null;
};

export type MicStatus = {
  engine: MicEngineState;
  reason?: string;
  micLabel?: string;
  micDeviceId?: string;
  /** The station's selected mic; "" = browser default. */
  selectedDeviceId?: string;
  /** true = processing the selected mic, false = a different one, null = default/unknown. */
  onSelectedMic: boolean | null;
  levels?: MicLevels;
};

export type MicMessage =
  | { v: 1; kind: "hello" }
  | { v: 1; kind: "set"; seq: number; settings: DriveThruMicSettings }
  | {
      v: 1;
      kind: "state";
      /** The `seq` of the `set` this confirms, or null for a spontaneous report. */
      seq: number | null;
      settings: DriveThruMicSettings;
      status: MicStatus;
      /** Station clock (ms) when the state was produced. */
      at: number;
    };

const ENGINE_STATES: readonly MicEngineState[] = ["starting", "active", "off", "failed", "no-mic"];
const MAX_TEXT = 200;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const text = (v: unknown): string | undefined =>
  typeof v === "string" ? v.slice(0, MAX_TEXT) : undefined;

/** Strict: every field must be present and the right type. Numbers are clamped. */
export function sanitizeMicSettings(input: unknown): DriveThruMicSettings | null {
  if (!isObj(input)) return null;
  const { enabled, strength, windCutHz, boost, autoGain, testPanel } = input;
  if (
    typeof enabled !== "boolean" ||
    typeof autoGain !== "boolean" ||
    typeof testPanel !== "boolean" ||
    !finite(strength) ||
    !finite(windCutHz) ||
    !finite(boost)
  ) {
    return null;
  }
  const r = MIC_RANGES;
  return {
    enabled,
    autoGain,
    testPanel,
    strength: clamp(strength, r.strength.min, r.strength.max),
    windCutHz: windCutHz < r.windCutHz.min ? 0 : clamp(windCutHz, r.windCutHz.min, r.windCutHz.max),
    boost: clamp(boost, r.boost.min, r.boost.max),
  };
}

/** For stored settings: missing fields (e.g. saved by an older version) fall back to defaults. */
export function sanitizeStoredMicSettings(input: unknown): DriveThruMicSettings {
  if (!isObj(input)) return { ...DEFAULT_MIC_SETTINGS };
  return sanitizeMicSettings({ ...DEFAULT_MIC_SETTINGS, ...input }) ?? { ...DEFAULT_MIC_SETTINGS };
}

function sanitizeLevels(input: unknown): MicLevels | undefined {
  if (!isObj(input)) return undefined;
  const { inRms, outRms, inPeak, vad } = input;
  if (!finite(inRms) || !finite(outRms) || !finite(inPeak)) return undefined;
  return {
    inRms: clamp(inRms, 0, 1),
    outRms: clamp(outRms, 0, 1),
    inPeak: clamp(inPeak, 0, 1),
    vad: finite(vad) ? clamp(vad, 0, 1) : null,
  };
}

function sanitizeStatus(input: unknown): MicStatus | null {
  if (!isObj(input)) return null;
  const engine = input.engine;
  if (typeof engine !== "string" || !ENGINE_STATES.includes(engine as MicEngineState)) return null;
  const onSelected = input.onSelectedMic;
  return {
    engine: engine as MicEngineState,
    reason: text(input.reason),
    micLabel: text(input.micLabel),
    micDeviceId: text(input.micDeviceId),
    selectedDeviceId: text(input.selectedDeviceId),
    onSelectedMic: typeof onSelected === "boolean" ? onSelected : null,
    levels: sanitizeLevels(input.levels),
  };
}

export function parseMicMessage(raw: unknown): MicMessage | null {
  if (!isObj(raw) || raw.v !== MIC_PROTOCOL_VERSION) return null;
  switch (raw.kind) {
    case "hello":
      return { v: 1, kind: "hello" };
    case "set": {
      const settings = sanitizeMicSettings(raw.settings);
      if (!settings || !finite(raw.seq) || raw.seq < 0) return null;
      return { v: 1, kind: "set", seq: Math.floor(raw.seq), settings };
    }
    case "state": {
      const settings = sanitizeMicSettings(raw.settings);
      const status = sanitizeStatus(raw.status);
      if (!settings || !status || !finite(raw.at)) return null;
      const seq = finite(raw.seq) && raw.seq >= 0 ? Math.floor(raw.seq) : null;
      return { v: 1, kind: "state", seq, settings, status, at: raw.at };
    }
    default:
      return null;
  }
}

export function encodeMicMessage(msg: MicMessage): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(msg));
}

export function decodeMicMessage(payload: Uint8Array): MicMessage | null {
  try {
    return parseMicMessage(JSON.parse(new TextDecoder().decode(payload)));
  } catch {
    return null;
  }
}

/* ── Formatting (shared by the manager panel, the station test panel and logs) ── */

export const formatStrength = (v: number) => `${Math.round(v * 100)}%`;
export const formatWindCut = (hz: number) => (hz === 0 ? "Off" : `${Math.round(hz)} Hz`);
export const formatBoost = (v: number) => `${Math.round(v * 100)}%`;
export const formatOnOff = (v: boolean) => (v ? "On" : "Off");

/** Plain-language list of what changed, e.g. ["Wind cut 80 Hz → 120 Hz"]. */
export function describeMicChanges(prev: DriveThruMicSettings, next: DriveThruMicSettings): string[] {
  const out: string[] = [];
  if (prev.enabled !== next.enabled) out.push(`Noise filter ${formatOnOff(prev.enabled)} → ${formatOnOff(next.enabled)}`);
  if (prev.strength !== next.strength) out.push(`Filter strength ${formatStrength(prev.strength)} → ${formatStrength(next.strength)}`);
  if (prev.windCutHz !== next.windCutHz) out.push(`Wind cut ${formatWindCut(prev.windCutHz)} → ${formatWindCut(next.windCutHz)}`);
  if (prev.boost !== next.boost) out.push(`Mic boost ${formatBoost(prev.boost)} → ${formatBoost(next.boost)}`);
  if (prev.autoGain !== next.autoGain) out.push(`Auto volume ${formatOnOff(prev.autoGain)} → ${formatOnOff(next.autoGain)}`);
  if (prev.testPanel !== next.testPanel) out.push(`Test panel ${formatOnOff(prev.testPanel)} → ${formatOnOff(next.testPanel)}`);
  return out;
}
