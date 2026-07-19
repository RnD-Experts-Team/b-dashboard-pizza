import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const isDev = process.env.NODE_ENV === "development";
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

// Extract the base domain from API URL for CSP
const getApiDomain = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
};

const apiDomain = getApiDomain(apiUrl);
const dsprApiUrl = process.env.NEXT_PUBLIC_DSPR_API_URL || "";
const dsprDomain = getApiDomain(dsprApiUrl);
const maintenanceApiUrl = process.env.NEXT_PUBLIC_MAINTENANCE_API_URL || "https://attend.pnepizza.com/api";
const maintenanceDomain = getApiDomain(maintenanceApiUrl);
const newMaintenanceApiUrl = process.env.NEXT_PUBLIC_NEW_MAINTENANCE_API_URL || "https://maintenancetesting.lcportal.cloud";
const newMaintenanceDomain = getApiDomain(newMaintenanceApiUrl);
const qaApiUrl = process.env.NEXT_PUBLIC_QA_API_URL || "https://qa.lcportal.cloud/api";
const qaDomain = getApiDomain(qaApiUrl);
const sensorsApiUrl = process.env.NEXT_PUBLIC_SENSORS_API_URL || "https://sensors.pnefoods.com/api";
const sensorsDomain = getApiDomain(sensorsApiUrl);
const screenProjectApiUrl = process.env.NEXT_PUBLIC_SCREEN_PROJECT_BASE_URL || "https://controltesting.screens.lcportal.cloud/api";
const screenProjectDomain = getApiDomain(screenProjectApiUrl);
// LiveKit server — wss:// + https:// for the same host
const livekitDomain = "https://screens.lcportal.cloud";
const livekitWss = "wss://screens.lcportal.cloud";
// Laravel Reverb WebSocket — wss:// uses the WS host directly
const reverbWsHost = process.env.NEXT_PUBLIC_REVERB_WS_HOST || "";
const reverbWss = reverbWsHost ? `wss://${reverbWsHost}` : "";
const reverbAuthUrl = process.env.NEXT_PUBLIC_REVERB_AUTH_ENDPOINT || "";
const reverbAuthDomain = getApiDomain(reverbAuthUrl);

// Inventory backend (remote testing host). Data/API calls are proxied through
// app/api/inventory/.../route.ts (server-side, auth-validated) — only the
// item-image storage path still goes through a Next.js rewrite below.
const inventoryApiUrl =
  process.env.NEXT_PUBLIC_INVENTORY_API_URL ||
  "https://inventorytesting.lcportal.cloud/api";
// Bare origin, e.g. "https://inventorytesting.lcportal.cloud" — used for the /storage image path.
const inventoryOrigin =
  getApiDomain(inventoryApiUrl) || "https://inventorytesting.lcportal.cloud";

// PNE LC AI (Lumina) bubble origin. Unset ⇒ production. Hosts the widget
// iframe (frame-src). The dashboard's only bridge call (logout-disconnect) now
// goes through the same-origin proxy at /api/lumina/cookies, so the bridge does
// NOT need to be in connect-src.
const luminaBase =
  process.env.NEXT_PUBLIC_LUMINA_BASE || "https://ai.lcportal.cloud";

const nextConfig: NextConfig = {
  // Security headers
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(), interest-cohort=()",
          },
          // HSTS only in production
          ...(!isDev
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains; preload",
                },
              ]
            : []),
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              // Station media plays from blob: object URLs (cached bytes) served
              // via our same-origin proxy. Without this, <video> falls back to
              // default-src 'self' and blob: playback is blocked.
              "media-src 'self' blob:",
              "font-src 'self' data:",
              `connect-src 'self'${apiDomain ? ` ${apiDomain}` : ""}${dsprDomain ? ` ${dsprDomain}` : ""}${maintenanceDomain ? ` ${maintenanceDomain}` : ""}${qaDomain ? ` ${qaDomain}` : ""}${sensorsDomain ? ` ${sensorsDomain}` : ""} ${screenProjectDomain} ${livekitDomain} ${livekitWss}${reverbWss ? ` ${reverbWss}` : ""}${reverbAuthDomain ? ` ${reverbAuthDomain}` : ""}${isDev ? " ws://localhost:3000 wss://localhost:3000" : ""}`,
              `frame-src 'self' ${luminaBase}`,
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              ...(!isDev ? ["upgrade-insecure-requests"] : []),
            ].join("; "),
          },
        ],
      },
    ];
  },
  // Powered by header disabled for security
  poweredByHeader: false,

  // ── Inventory item-image proxy (CORS-free) ───────────────────────────────
  // Data/API calls go through app/api/inventory/.../route.ts instead. Images are
  // static binary passthrough, so a plain rewrite (rather than a route.ts) is enough.
  // `beforeFiles` guarantees this wins over any App Router route matching.
  async rewrites() {
    return {
      beforeFiles: [
        // Item images: /inventory-storage/inventory/items/1/x.jpg → http://127.0.0.1:8000/storage/inventory/items/1/x.jpg
        // Keeps <img> same-origin so the existing CSP (img-src 'self') already allows it.
        {
          source: "/inventory-storage/:path*",
          destination: `${inventoryOrigin}/storage/:path*`,
        },
      ],
    };
  },
};

export default withNextIntl(nextConfig);
