import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/public/screen-project/media?src=<encoded external media url>
 *
 * Same-origin streaming proxy for station media (images/videos). It exists for
 * two reasons:
 *   1. Caching — the media host serves assets cross-origin without cache-friendly
 *      headers, so the browser re-downloads on every refresh. Media file names are
 *      content-addressed UUIDs that never change, so we can safely re-serve them
 *      with a long, immutable Cache-Control and let the browser cache them hard.
 *   2. Reliable delivery — routing bytes through our origin normalizes the
 *      Content-Type and avoids cross-origin quirks that can stop a <video> from
 *      playing even when a small <img> from the same host loads fine.
 *
 * Only hosts under screens.lcportal.cloud are allowed, so this can't be abused as
 * an open proxy.
 */

const ALLOWED_HOST_SUFFIX = "screens.lcportal.cloud";
// Guards the initial connection only — cleared once response headers arrive, so
// streaming a large video is never cut off mid-download.
const CONNECT_TIMEOUT_MS = 30_000;

function contentTypeFromUrl(url: string): string {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".mp4")) return "video/mp4";
  if (path.endsWith(".webm")) return "video/webm";
  if (path.endsWith(".mov")) return "video/quicktime";
  if (path.endsWith(".m4v")) return "video/x-m4v";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".avif")) return "image/avif";
  return "application/octet-stream";
}

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("src");
  if (!src) {
    return NextResponse.json({ error: "Missing src" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(src);
  } catch {
    return NextResponse.json({ error: "Invalid src" }, { status: 400 });
  }

  const host = target.hostname.toLowerCase();
  const hostAllowed =
    host === ALLOWED_HOST_SUFFIX || host.endsWith(`.${ALLOWED_HOST_SUFFIX}`);
  if (target.protocol !== "https:" || !hostAllowed) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

    // No Range header is forwarded on purpose: we fetch the full asset so the
    // browser receives a plain, cacheable 200 it reuses across refreshes. The
    // station media is a short looping clip / image, so seeking isn't needed.
    const upstream = await fetch(target.toString(), {
      method: "GET",
      headers: { Accept: "*/*" },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "Failed to fetch media" },
        { status: 502 },
      );
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      upstream.headers.get("Content-Type") || contentTypeFromUrl(src),
    );
    const contentLength = upstream.headers.get("Content-Length");
    if (contentLength) headers.set("Content-Length", contentLength);
    headers.set("Accept-Ranges", "none");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return NextResponse.json({ error: "Upstream timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 502 });
  }
}
