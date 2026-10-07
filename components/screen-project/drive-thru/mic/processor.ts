import type { AudioProcessorOptions, LocalTrack, Track, TrackProcessor } from "livekit-client";
import type { DriveThruMicSettings, MicLevels } from "./settings";
import type { MicLogLevel } from "./log-store";

export const DRIVE_THRU_MIC_PROCESSOR_NAME = "drive-thru-rnnoise";

/** RNNoise only works at 48 kHz. */
const SAMPLE_RATE = 48_000;
const WORKLET_URL = "/rnnoise-v2/rnnoise-worklet.js";
const WORKLET_PROCESSOR = "drive-thru-rnnoise";
/** The worklet downloads a 4.8 MB module and compiles it — give slow kiosks time. */
const READY_TIMEOUT_MS = 20_000;
/** How long a stopped/suspended context gets to recover before the raw mic is handed back. */
const CONTEXT_RECOVERY_MS = 3_000;
/** "Wind cut: Off" — a high-pass this low changes nothing audible. */
const WIND_CUT_OFF_HZ = 10;
/** Smoothing for live parameter changes, so moving a slider never clicks. */
const RAMP_SECONDS = 0.02;

export type ProcessorEvent =
  | { type: "log"; level: MicLogLevel; text: string }
  | { type: "stats"; levels: MicLevels; framesProcessed: number; rnnoiseOn: boolean }
  /** The station switched mics; processing now follows the new one. */
  | { type: "source-changed"; label: string }
  /** It was running, then had to give the raw mic back. */
  | { type: "fallback"; reason: string };

export interface DriveThruMicProcessor extends TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  update(settings: DriveThruMicSettings): void;
}

function isRunning(ctx: AudioContext): boolean {
  return ctx.state === "running";
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Chain: raw mic → 2× high-pass (wind cut) → RNNoise worklet (with strength mix)
 * → gain (boost) → limiter → processed track, in its own 48 kHz AudioContext.
 *
 * The mic must never end up worse than without this:
 *  - `init` throws on any failure — LiveKit then keeps sending the raw mic.
 *  - `restart` (LiveKit calls it on a mic switch, and fails the switch if it
 *    throws) never throws; it falls back to a clone of the raw track.
 *  - If the audio context dies later, the raw mic is handed back.
 */
export function createDriveThruMicProcessor(
  initial: DriveThruMicSettings,
  onEvent: (event: ProcessorEvent) => void,
): DriveThruMicProcessor {
  let settings = initial;
  let ctx: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let highpassA: BiquadFilterNode | null = null;
  let highpassB: BiquadFilterNode | null = null;
  let worklet: AudioWorkletNode | null = null;
  let gain: GainNode | null = null;
  let limiter: DynamicsCompressorNode | null = null;
  let destination: MediaStreamAudioDestinationNode | null = null;
  let localTrack: LocalTrack | undefined;
  let passthroughClone: MediaStreamTrack | null = null;
  let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  let handedBack = false;

  const log = (level: MicLogLevel, text: string) => onEvent({ type: "log", level, text });

  const disconnect = (node: AudioNode | null) => {
    try {
      node?.disconnect();
    } catch {
      // already disconnected
    }
  };

  const clearPassthrough = () => {
    passthroughClone?.stop();
    passthroughClone = null;
  };

  const applySettings = (ramp: boolean) => {
    if (!ctx || !highpassA || !highpassB || !gain || !worklet) return;
    const now = ctx.currentTime;
    const cut = settings.windCutHz > 0 ? settings.windCutHz : WIND_CUT_OFF_HZ;
    for (const filter of [highpassA, highpassB]) {
      if (ramp) filter.frequency.setTargetAtTime(cut, now, RAMP_SECONDS);
      else filter.frequency.value = cut;
    }
    if (ramp) gain.gain.setTargetAtTime(settings.boost, now, RAMP_SECONDS);
    else gain.gain.value = settings.boost;
    worklet.port.postMessage({ type: "config", enabled: settings.enabled, strength: settings.strength });
  };

  // Hands the raw mic back once; LiveKit's stopProcessor calls our destroy().
  const handBack = (reason: string) => {
    if (handedBack) return;
    handedBack = true;
    onEvent({ type: "fallback", reason });
    localTrack?.stopProcessor().catch((err) => log("error", `Could not hand the raw mic back: ${errorText(err)}`));
  };

  const handleStateChange = () => {
    if (!ctx || isRunning(ctx)) return;
    log("warn", `Audio context is "${ctx.state}" — trying to resume`);
    ctx.resume().catch(() => {});
    if (recoveryTimer) clearTimeout(recoveryTimer);
    recoveryTimer = setTimeout(() => {
      if (ctx && !isRunning(ctx)) handBack(`audio context stayed "${ctx.state}"`);
      else log("ok", "Audio context recovered");
    }, CONTEXT_RECOVERY_MS);
  };

  const handleWorkletMessage = (event: MessageEvent) => {
    const msg = event.data as Record<string, unknown> | null;
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "stats") {
      onEvent({
        type: "stats",
        levels: {
          inRms: Number(msg.inRms) || 0,
          outRms: Number(msg.outRms) || 0,
          inPeak: Number(msg.inPeak) || 0,
          vad: typeof msg.vadAvg === "number" ? msg.vadAvg : null,
        },
        framesProcessed: Number(msg.framesProcessed) || 0,
        rnnoiseOn: msg.enabled === true && msg.ready === true,
      });
    } else if (msg.type === "error") {
      handBack(`RNNoise error: ${String(msg.message)}`);
    }
  };

  const teardown = async () => {
    if (recoveryTimer) clearTimeout(recoveryTimer);
    recoveryTimer = null;
    ctx?.removeEventListener("statechange", handleStateChange);
    if (worklet) {
      worklet.port.onmessage = null;
      worklet.port.postMessage({ type: "destroy" });
    }
    [source, highpassA, highpassB, worklet, gain, limiter, destination].forEach(disconnect);
    destination?.stream.getTracks().forEach((t) => t.stop());
    clearPassthrough();
    const closing = ctx;
    source = highpassA = highpassB = worklet = gain = limiter = destination = ctx = null;
    processor.processedTrack = undefined;
    await closing?.close().catch(() => {});
  };

  const attachSource = (track: MediaStreamTrack) => {
    if (!ctx || !highpassA || !destination) throw new Error("processor is not initialised");
    disconnect(source);
    source = ctx.createMediaStreamSource(new MediaStream([track]));
    source.connect(highpassA);
    clearPassthrough();
    processor.processedTrack = destination.stream.getAudioTracks()[0];
  };

  const waitForReady = (node: AudioWorkletNode) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`RNNoise did not load within ${READY_TIMEOUT_MS / 1000}s`)),
        READY_TIMEOUT_MS,
      );
      node.port.onmessage = (event: MessageEvent) => {
        const msg = event.data as Record<string, unknown> | null;
        if (msg?.type === "ready") {
          clearTimeout(timer);
          resolve();
        } else if (msg?.type === "error") {
          clearTimeout(timer);
          reject(new Error(`RNNoise failed to load: ${String(msg.message)}`));
        }
      };
    });

  const processor: DriveThruMicProcessor = {
    name: DRIVE_THRU_MIC_PROCESSOR_NAME,
    processedTrack: undefined,

    async init(opts) {
      try {
        log("info", `Starting noise processing on "${opts.track.label || "mic"}"`);
        const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: "interactive" });
        ctx = audioContext;
        if (!isRunning(audioContext)) await audioContext.resume();
        if (!isRunning(audioContext)) throw new Error(`audio context is "${audioContext.state}"`);
        log("info", `Audio context running at ${audioContext.sampleRate} Hz`);

        await audioContext.audioWorklet.addModule(WORKLET_URL);
        log("info", "Noise worklet loaded — loading RNNoise model (4.8 MB)…");

        worklet = new AudioWorkletNode(audioContext, WORKLET_PROCESSOR, {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          channelCount: 1,
          channelCountMode: "explicit",
          outputChannelCount: [1],
        });
        await waitForReady(worklet);
        worklet.port.onmessage = handleWorkletMessage;

        highpassA = audioContext.createBiquadFilter();
        highpassB = audioContext.createBiquadFilter();
        for (const filter of [highpassA, highpassB]) {
          filter.type = "highpass";
          filter.Q.value = Math.SQRT1_2;
        }
        // Force the mic down to mono before RNNoise.
        highpassA.channelCount = 1;
        highpassA.channelCountMode = "explicit";

        gain = audioContext.createGain();
        // Limiter: only touches peaks, so a boosted loud voice can't distort.
        limiter = audioContext.createDynamicsCompressor();
        limiter.threshold.value = -3;
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.001;
        limiter.release.value = 0.1;
        destination = audioContext.createMediaStreamDestination();
        destination.channelCount = 1;

        highpassA.connect(highpassB);
        highpassB.connect(worklet);
        worklet.connect(gain);
        gain.connect(limiter);
        limiter.connect(destination);
        applySettings(false);

        localTrack = opts.localTrack;
        audioContext.addEventListener("statechange", handleStateChange);
        attachSource(opts.track);
        log("ok", "RNNoise v0.2 running (480-sample frames at 48 kHz, ~30 ms added delay)");
      } catch (err) {
        await teardown();
        throw err;
      }
    },

    async restart(opts) {
      try {
        if (!ctx) throw new Error("processor is not initialised");
        if (!isRunning(ctx)) await ctx.resume();
        if (!isRunning(ctx)) throw new Error(`audio context is "${ctx.state}"`);
        attachSource(opts.track);
        onEvent({ type: "source-changed", label: opts.track.label });
      } catch (err) {
        log("error", `Could not move processing to the new mic, sending it raw: ${errorText(err)}`);
        // A clone, because LiveKit stops processedTrack when the processor stops —
        // stopping the raw track itself would kill the mic.
        clearPassthrough();
        passthroughClone = opts.track.clone();
        processor.processedTrack = passthroughClone;
      }
    },

    async destroy() {
      await teardown();
    },

    update(next) {
      settings = next;
      applySettings(true);
    },
  };

  return processor;
}
