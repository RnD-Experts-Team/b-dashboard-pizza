// Drive-thru station mic: RNNoise v0.2 noise suppression inside an AudioWorklet.
// rnnoise.js is @shiguredo/rnnoise-wasm 2025.1.5 (Apache-2.0, see LICENSE.txt),
// vendored unchanged. This file is hand-written plain JS (not bundled).

// The bundled Emscripten glue refuses to start unless it sees a page (`window`)
// or a web worker (`WorkerGlobalScope`). An AudioWorklet is neither, but it has
// everything the module actually uses, so give it the stand-in it checks for.
// The check runs inside Rnnoise.load(), after this line, not at import time.
if (typeof globalThis.WorkerGlobalScope === "undefined") {
  globalThis.WorkerGlobalScope = class WorkerGlobalScope {};
}

import { Rnnoise } from "./rnnoise.js";

const FRAME = 480; // RNNoise frame: 10 ms at 48 kHz
const PCM_SCALE = 32768; // RNNoise expects 16-bit PCM range
const FIFO_SIZE = 4096;
const DRY_DELAY_FRAMES = 2;
const STATS_EVERY_SAMPLES = 48000; // ~1 s

let rnnoisePromise = null; // one wasm instance per worklet scope, shared by nodes

class DriveThruRnnoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.enabled = true;
    this.strength = 1;
    this.denoise = null;
    this.alive = true;

    this.inFrame = new Float32Array(FRAME);
    this.inPos = 0;
    this.work = new Float32Array(FRAME);
    // RNNoise v0.2 outputs each frame DRY_DELAY_FRAMES frames late (measured: the
    // cleaned path lags the input by 959 samples). The original signal is delayed
    // the same amount before the strength mix — otherwise the mix is misaligned by
    // a frame and sounds like an echo.
    this.dryDelay = Array.from({ length: DRY_DELAY_FRAMES }, () => new Float32Array(FRAME));

    // Output FIFO primed with one frame of silence so it can never run dry
    // (128-sample render quanta vs 480-sample frames).
    this.fifo = new Float32Array(FIFO_SIZE);
    this.fifoRead = 0;
    this.fifoWrite = FRAME;
    this.fifoCount = FRAME;

    this.statSamples = 0;
    this.statIn = 0;
    this.statOut = 0;
    this.statVad = 0;
    this.statFrames = 0;
    this.statPeak = 0;
    this.totalFrames = 0;

    this.port.onmessage = (e) => this.handleMessage(e.data);

    rnnoisePromise ??= Rnnoise.load();
    rnnoisePromise
      .then((rnnoise) => {
        if (!this.alive) return;
        if (rnnoise.frameSize !== FRAME) {
          throw new Error(`unexpected RNNoise frame size ${rnnoise.frameSize}`);
        }
        this.denoise = rnnoise.createDenoiseState();
        this.port.postMessage({ type: "ready", frameSize: rnnoise.frameSize, sampleRate });
      })
      .catch((err) => {
        rnnoisePromise = null;
        this.port.postMessage({ type: "error", message: String((err && err.message) || err) });
      });
  }

  handleMessage(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "config") {
      if (typeof msg.enabled === "boolean") this.enabled = msg.enabled;
      if (typeof msg.strength === "number" && Number.isFinite(msg.strength)) {
        this.strength = Math.min(1, Math.max(0, msg.strength));
      }
      this.port.postMessage({ type: "config-applied", enabled: this.enabled, strength: this.strength });
    } else if (msg.type === "destroy") {
      this.alive = false;
      if (this.denoise) {
        this.denoise.destroy();
        this.denoise = null;
      }
    }
  }

  processFrame() {
    const input = this.inFrame;
    const out = this.work;
    // Oldest delayed frame = the input that lines up with RNNoise's output now.
    const delayed = this.dryDelay.shift();

    if (this.enabled && this.denoise) {
      for (let i = 0; i < FRAME; i++) out[i] = input[i] * PCM_SCALE;
      const vad = this.denoise.processFrame(out); // in place
      const wet = this.strength;
      const dry = 1 - wet;
      for (let i = 0; i < FRAME; i++) out[i] = (out[i] / PCM_SCALE) * wet + delayed[i] * dry;
      this.statVad += vad;
      this.statFrames++;
      this.totalFrames++;
    } else {
      // Same delay as the processed path, so toggling never jumps.
      out.set(delayed);
    }
    delayed.set(input); // recycle the buffer as the newest delayed frame
    this.dryDelay.push(delayed);

    for (let i = 0; i < FRAME; i++) {
      this.fifo[this.fifoWrite] = out[i];
      this.fifoWrite = (this.fifoWrite + 1) % FIFO_SIZE;
    }
    this.fifoCount += FRAME;
  }

  process(inputs, outputs) {
    if (!this.alive) return false;
    const input = inputs[0] && inputs[0][0];
    const output = outputs[0] && outputs[0][0];
    if (!output) return true;
    const n = output.length;

    for (let i = 0; i < n; i++) {
      const s = input ? input[i] : 0;
      this.statIn += s * s;
      if (Math.abs(s) > this.statPeak) this.statPeak = Math.abs(s);
      this.inFrame[this.inPos++] = s;
      if (this.inPos === FRAME) {
        this.processFrame();
        this.inPos = 0;
      }
    }

    for (let i = 0; i < n; i++) {
      let v = 0;
      if (this.fifoCount > 0) {
        v = this.fifo[this.fifoRead];
        this.fifoRead = (this.fifoRead + 1) % FIFO_SIZE;
        this.fifoCount--;
      }
      output[i] = v;
      this.statOut += v * v;
    }
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(output);

    this.statSamples += n;
    if (this.statSamples >= STATS_EVERY_SAMPLES) {
      this.port.postMessage({
        type: "stats",
        inRms: Math.sqrt(this.statIn / this.statSamples),
        outRms: Math.sqrt(this.statOut / this.statSamples),
        inPeak: this.statPeak,
        vadAvg: this.statFrames ? this.statVad / this.statFrames : null,
        framesProcessed: this.totalFrames,
        enabled: this.enabled,
        ready: !!this.denoise,
      });
      this.statSamples = 0;
      this.statIn = 0;
      this.statOut = 0;
      this.statVad = 0;
      this.statFrames = 0;
      this.statPeak = 0;
    }
    return true;
  }
}

registerProcessor("drive-thru-rnnoise", DriveThruRnnoiseProcessor);
