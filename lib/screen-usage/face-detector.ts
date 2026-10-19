/**
 * "Is there a face in front of the manager's camera?" — Google MediaPipe
 * BlazeFace (short range), running entirely in the browser. Only a yes/no
 * ever leaves this file; no image is sent anywhere.
 *
 * Loaded lazily, once per page, the first time a manager's camera is on: the
 * engine (`vision_wasm_internal.*`) and the model are served from
 * `public/mediapipe/` (same origin, so the CSP needs nothing new beyond the
 * existing 'wasm-unsafe-eval'). If anything fails — no WebAssembly SIMD, a
 * blocked file, an old browser — it resolves to null and the caller falls back
 * to the brightness check alone. It never throws.
 *
 * The engine files must match the pinned `@mediapipe/tasks-vision` version in
 * package.json — see public/mediapipe/README.md to update them.
 */

import type { FaceDetector } from "@mediapipe/tasks-vision";

const BASE = "/mediapipe";
/** A face counts when the detector is at least this sure (0–1). */
export const FACE_MIN_CONFIDENCE = 0.5;
/** Several tiles can sample the same camera; reuse a recent answer for the same track. */
const RESULT_TTL_MS = 2_500;

let detectorPromise: Promise<FaceDetector | null> | null = null;
let lastTimestamp = 0;
const recent = new Map<string, { at: number; score: number }>();

export function loadFaceDetector(): Promise<FaceDetector | null> {
  detectorPromise ??= (async () => {
    try {
      const { FaceDetector } = await import("@mediapipe/tasks-vision");
      return await FaceDetector.createFromOptions(
        {
          wasmLoaderPath: `${BASE}/vision_wasm_internal.js`,
          wasmBinaryPath: `${BASE}/vision_wasm_internal.wasm`,
        },
        {
          baseOptions: { modelAssetPath: `${BASE}/blaze_face_short_range.tflite`, delegate: "CPU" },
          runningMode: "VIDEO",
          // Report every candidate: the caller compares the best score to FACE_MIN_CONFIDENCE.
          minDetectionConfidence: 0.2,
        },
      );
    } catch {
      return null;
    }
  })();
  return detectorPromise;
}

/**
 * The best face score in the current frame (0 = no face at all); null when it
 * can't tell (frame not ready, detector error) — the caller keeps its state.
 * A face counts at FACE_MIN_CONFIDENCE or above.
 */
export function detectFace(detector: FaceDetector, video: HTMLVideoElement, trackId: string): number | null {
  try {
    const now = performance.now();
    const cached = recent.get(trackId);
    if (cached && now - cached.at < RESULT_TTL_MS) return cached.score;
    if (video.readyState < 2 || video.videoWidth === 0) return null;

    // VIDEO mode requires strictly increasing timestamps across every call on this detector.
    lastTimestamp = Math.max(now, lastTimestamp + 1);
    const result = detector.detectForVideo(video, lastTimestamp);
    const score = Math.max(0, ...result.detections.map((d) => d.categories[0]?.score ?? 0));
    recent.set(trackId, { at: now, score });
    return score;
  } catch {
    return null;
  }
}
