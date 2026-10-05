import type { AudioProcessorOptions, LocalTrack, Track, TrackProcessor } from "livekit-client";
import type { RnnoiseWorkletNode } from "@sapphi-red/web-noise-suppressor";

export const DRIVE_THRU_MIC_PROCESSOR_NAME = "drive-thru-mic";

/** RNNoise only works on 48 kHz audio. */
const SAMPLE_RATE = 48_000;
/** Cut below this to remove wind rumble before RNNoise sees it (two stages = 24 dB/octave). */
const HIGHPASS_HZ = 120;
/** Level after processing. Auto gain is off on this mic, so raise this if customers sound quiet. */
const OUTPUT_GAIN = 1.0;
/** How long a stopped/suspended context gets to recover before we give the raw mic back. */
const CONTEXT_RECOVERY_MS = 3_000;

// Served from /public/rnnoise (copied from @sapphi-red/web-noise-suppressor/dist).
const WORKLET_URL = "/rnnoise/rnnoiseWorklet.js";
const WASM_URL = "/rnnoise/rnnoise.wasm";
const WASM_SIMD_URL = "/rnnoise/rnnoise_simd.wasm";

let wasmBinaryPromise: Promise<ArrayBuffer> | null = null;

function isRunning(ctx: AudioContext): boolean {
  return ctx.state === "running";
}

/**
 * Wind/noise reduction for the drive-thru station mic: high-pass filter, then
 * RNNoise (ML noise suppression), all inside the browser.
 *
 * The mic must never end up worse than without this, so every failure falls back
 * to the raw mic: `init` throws (LiveKit then keeps the raw track), `restart`
 * never throws, and a dead audio context hands the raw mic back.
 */
export function createDriveThruMicProcessor(): TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  let ctx: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let highpassA: BiquadFilterNode | null = null;
  let highpassB: BiquadFilterNode | null = null;
  let rnnoise: RnnoiseWorkletNode | null = null;
  let gain: GainNode | null = null;
  let destination: MediaStreamAudioDestinationNode | null = null;
  let localTrack: LocalTrack | undefined;
  let passthroughClone: MediaStreamTrack | null = null;
  let recoveryTimer: ReturnType<typeof setTimeout> | null = null;

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

  const handleStateChange = () => {
    if (!ctx || isRunning(ctx)) return;
    // iPads report "interrupted" (calls, lock screen); try to recover first.
    ctx.resume().catch(() => {});
    if (recoveryTimer) clearTimeout(recoveryTimer);
    recoveryTimer = setTimeout(() => {
      if (ctx && !isRunning(ctx)) {
        console.warn("[drive-thru-mic] audio context stopped, switching back to the raw mic");
        // A silent processed track would mean a dead mic — hand the raw one back.
        localTrack?.stopProcessor().catch(() => {});
      }
    }, CONTEXT_RECOVERY_MS);
  };

  const teardown = async () => {
    if (recoveryTimer) clearTimeout(recoveryTimer);
    recoveryTimer = null;
    ctx?.removeEventListener("statechange", handleStateChange);
    [source, highpassA, highpassB, rnnoise, gain, destination].forEach(disconnect);
    try {
      rnnoise?.destroy();
    } catch {
      // worklet already gone
    }
    destination?.stream.getTracks().forEach((t) => t.stop());
    clearPassthrough();
    const closing = ctx;
    source = highpassA = highpassB = rnnoise = gain = destination = ctx = null;
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

  const processor: TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> = {
    name: DRIVE_THRU_MIC_PROCESSOR_NAME,
    processedTrack: undefined,

    async init(opts) {
      try {
        const { loadRnnoise, RnnoiseWorkletNode: RnnoiseNode } = await import(
          "@sapphi-red/web-noise-suppressor"
        );
        wasmBinaryPromise ??= loadRnnoise({ url: WASM_URL, simdUrl: WASM_SIMD_URL });
        const wasmBinary = await wasmBinaryPromise.catch((err) => {
          wasmBinaryPromise = null; // allow a retry on the next attach
          throw err;
        });

        // Not LiveKit's own context: that one runs at the device rate.
        const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: "interactive" });
        ctx = audioContext;
        if (!isRunning(audioContext)) await audioContext.resume();
        if (!isRunning(audioContext)) throw new Error("audio context could not start");
        await audioContext.audioWorklet.addModule(WORKLET_URL);

        highpassA = audioContext.createBiquadFilter();
        highpassB = audioContext.createBiquadFilter();
        for (const filter of [highpassA, highpassB]) {
          filter.type = "highpass";
          filter.frequency.value = HIGHPASS_HZ;
          filter.Q.value = Math.SQRT1_2;
        }
        // RNNoise is configured for one channel; force the mic down to mono.
        highpassA.channelCount = 1;
        highpassA.channelCountMode = "explicit";

        rnnoise = new RnnoiseNode(audioContext, { maxChannels: 1, wasmBinary });
        gain = audioContext.createGain();
        gain.gain.value = OUTPUT_GAIN;
        destination = audioContext.createMediaStreamDestination();
        destination.channelCount = 1;

        highpassA.connect(highpassB);
        highpassB.connect(rnnoise);
        rnnoise.connect(gain);
        gain.connect(destination);

        localTrack = opts.localTrack;
        audioContext.addEventListener("statechange", handleStateChange);
        attachSource(opts.track);
      } catch (err) {
        await teardown();
        throw err;
      }
    },

    // LiveKit calls this on a mic switch, without an audio context, and fails the
    // switch if it throws — so it can only ever fall back, never reject.
    async restart(opts) {
      try {
        if (!ctx) throw new Error("processor is not initialised");
        if (!isRunning(ctx)) await ctx.resume();
        if (!isRunning(ctx)) throw new Error("audio context is not running");
        attachSource(opts.track);
      } catch (err) {
        console.warn("[drive-thru-mic] could not restart noise reduction, using the raw mic", err);
        // A clone, because LiveKit stops processedTrack when the processor is
        // stopped — stopping the raw track itself would kill the mic.
        clearPassthrough();
        passthroughClone = opts.track.clone();
        processor.processedTrack = passthroughClone;
      }
    },

    async destroy() {
      await teardown();
    },
  };

  return processor;
}
