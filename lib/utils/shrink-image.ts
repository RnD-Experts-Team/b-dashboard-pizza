/**
 * Browser-side photo shrinking for uploads.
 *
 * Upstream backends cap each uploaded image (the Cleaning Chart API rejects
 * anything over 10 MB with "The photos.0 field must not be greater than 10240
 * kilobytes"), while modern phone cameras routinely produce 10–20 MB photos.
 * Re-encoding to a capped-resolution JPEG keeps them a few MB at most without
 * any visible loss for evidence photos.
 */

/** Files at or under this size are sent untouched. */
const SHRINK_ABOVE_BYTES = 2 * 1024 * 1024;
/** Longest edge of the re-encoded image, in pixels. */
const MAX_EDGE_PX = 2560;
/** Try these JPEG qualities in order until the result fits under the target. */
const QUALITIES = [0.85, 0.7, 0.55];
/** Stay safely below the 10 MB upstream cap. */
const TARGET_BYTES = 9 * 1024 * 1024;

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

function jpegName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "") || "photo";
  return `${base}.jpg`;
}

/**
 * Returns a smaller JPEG copy of `file`, or `file` itself when it is already
 * small, isn't an image, or the browser can't decode it (e.g. HEIC outside
 * Safari) — the server then decides, same as before.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (file.size <= SHRINK_ABOVE_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    // "from-image" applies the EXIF rotation so portrait phone shots stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // JPEG has no alpha — flatten transparent PNGs onto white instead of black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    let best: Blob | null = null;
    for (const quality of QUALITIES) {
      const blob = await canvasToJpeg(canvas, quality);
      if (!blob) break;
      best = blob;
      if (blob.size <= TARGET_BYTES) break;
    }

    if (!best || best.size >= file.size) return file;
    return new File([best], jpegName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}

/** `shrinkImage` over a list, preserving order. */
export function shrinkImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map(shrinkImage));
}
