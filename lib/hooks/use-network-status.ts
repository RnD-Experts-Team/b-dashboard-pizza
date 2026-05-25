import { useState, useEffect } from "react";

export interface NetworkStatus {
  online: boolean;
  /** Effective connection type reported by the browser */
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  /** Estimated download bandwidth in Mbps (Network Information API) */
  downlink?: number;
  /** Estimated round-trip time in ms (Network Information API) */
  rtt?: number;
  /**
   * Connection quality reported by LiveKit WebRTC stats — most accurate for video.
   * Only present when received from a LiveKit data-channel message.
   */
  connectionQuality?: "excellent" | "good" | "poor" | "lost";
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => ({
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    ...getNetworkInfo(),
  }));

  useEffect(() => {
    function handleOnline() {
      setStatus({ online: true, ...getNetworkInfo() });
    }
    function handleOffline() {
      setStatus({ online: false });
    }
    function handleConnectionChange() {
      setStatus((prev) => ({ ...prev, ...getNetworkInfo() }));
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Network Information API (Chrome / Android)
    const connection = getConn() as EventTarget | undefined;

    connection?.addEventListener("change", handleConnectionChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      connection?.removeEventListener("change", handleConnectionChange);
    };
  }, []);

  return status;
}

type NetConn = { effectiveType?: string; downlink?: number; rtt?: number };

function getConn(): NetConn | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (
    (navigator as Navigator & { connection?: NetConn }).connection ??
    (navigator as Navigator & { mozConnection?: NetConn }).mozConnection ??
    (navigator as Navigator & { webkitConnection?: NetConn }).webkitConnection
  );
}

function getNetworkInfo(): Pick<NetworkStatus, "effectiveType" | "downlink" | "rtt"> {
  const conn = getConn();
  if (!conn) return {};
  const et = conn.effectiveType;
  return {
    effectiveType: (et === "slow-2g" || et === "2g" || et === "3g" || et === "4g") ? et : undefined,
    downlink: typeof conn.downlink === "number" && conn.downlink > 0 ? conn.downlink : undefined,
    rtt: typeof conn.rtt === "number" && conn.rtt >= 0 ? conn.rtt : undefined,
  };
}
