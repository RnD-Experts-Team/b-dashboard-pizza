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
              "font-src 'self' data:",
              `connect-src 'self'${apiDomain ? ` ${apiDomain}` : ""}${dsprDomain ? ` ${dsprDomain}` : ""}${maintenanceDomain ? ` ${maintenanceDomain}` : ""}${qaDomain ? ` ${qaDomain}` : ""}${sensorsDomain ? ` ${sensorsDomain}` : ""} ${screenProjectDomain} ${livekitDomain} ${livekitWss}${reverbWss ? ` ${reverbWss}` : ""}${reverbAuthDomain ? ` ${reverbAuthDomain}` : ""}${isDev ? " ws://localhost:3000 wss://localhost:3000" : ""}`,
              "frame-src 'self'",
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
};

export default withNextIntl(nextConfig);
