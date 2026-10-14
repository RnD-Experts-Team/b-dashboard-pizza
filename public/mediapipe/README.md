# MediaPipe face detection (Screen Project usage monitoring)

Served from our own origin so the CSP needs nothing beyond the existing
`'wasm-unsafe-eval'`. Loaded lazily by `lib/screen-usage/face-detector.ts`, only
once a manager's camera is on.

| File | From | Size |
|---|---|---|
| `vision_wasm_internal.js` | `@mediapipe/tasks-vision@1.0.1` → `wasm/` | 323 KB |
| `vision_wasm_internal.wasm` | `@mediapipe/tasks-vision@1.0.1` → `wasm/` (SIMD build) | 11.8 MB (≈3.5 MB compressed) |
| `blaze_face_short_range.tflite` | `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite` | 230 KB |

Only the SIMD build is shipped (every current browser has WebAssembly SIMD). Without
it the detector fails to load and monitoring falls back to the brightness check.

## Updating

The engine files **must match** the `@mediapipe/tasks-vision` version pinned in
`package.json` (the JS API and the WASM are released together).

1. `pnpm add @mediapipe/tasks-vision@<version> --save-exact` (and add the same entry to `package-lock.json`).
2. Copy `node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.{js,wasm}` over the files here.
3. Update the version in this table.
4. On a production build (`next build && next start`), turn a camera on in Screen Project and check the
   console shows no CSP or WASM errors.
