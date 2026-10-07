"use client";

import { useEffect, useRef } from "react";
import { ConnectionState, RoomEvent, type RemoteParticipant, type Room } from "livekit-client";
import {
  decodeMicMessage,
  encodeMicMessage,
  MIC_TOPIC,
  type DriveThruMicSettings,
  type MicMessage,
} from "./settings";

const PREFIX = "[drive-thru-mic:manager]";

export type StationMicReport = Extract<MicMessage, { kind: "state" }> & {
  /** Manager clock when the report arrived. */
  receivedAt: number;
};

export type ManagerMicApi = {
  /** Sends the full settings; returns the sequence number to match the confirmation. */
  send: (settings: DriveThruMicSettings) => number | null;
  /** Asks the station to report its current settings. */
  requestState: () => void;
};

/**
 * Manager side of the drive-thru mic controls. Talks to the station over the
 * `drive-thru-mic` data topic; the panel UI owns pending/confirmed bookkeeping.
 * Inert unless `enabled`.
 */
export function useManagerMic({
  enabled,
  room,
  connectionState,
  onApi,
  onReport,
}: {
  enabled: boolean;
  room: Room;
  connectionState: ConnectionState;
  onApi?: (api: ManagerMicApi | null) => void;
  onReport?: (report: StationMicReport) => void;
}) {
  const seqRef = useRef(0);
  const onReportRef = useRef(onReport);
  onReportRef.current = onReport;
  const onApiRef = useRef(onApi);
  onApiRef.current = onApi;

  useEffect(() => {
    if (!enabled || connectionState !== ConnectionState.Connected) {
      onApiRef.current?.(null);
      return;
    }

    const publish = (msg: MicMessage, what: string) => {
      room.localParticipant
        .publishData(encodeMicMessage(msg), { reliable: true, topic: MIC_TOPIC })
        .then(() => console.log(PREFIX, what))
        .catch((err) => console.warn(PREFIX, `failed to send (${what}):`, err));
    };

    const api: ManagerMicApi = {
      send: (settings) => {
        const seq = ++seqRef.current;
        publish({ v: 1, kind: "set", seq, settings }, `sent settings #${seq}: ${JSON.stringify(settings)}`);
        return seq;
      },
      requestState: () => publish({ v: 1, kind: "hello" }, "asked the station for its current settings"),
    };

    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== MIC_TOPIC) return;
      const msg = decodeMicMessage(payload);
      if (!msg) {
        console.warn(PREFIX, `ignored an invalid message from ${participant?.identity ?? "unknown"}`);
        return;
      }
      if (msg.kind !== "state") return;
      if (msg.seq !== null) {
        console.log(PREFIX, `station confirmed #${msg.seq}:`, msg.status.engine, msg.settings);
      }
      onReportRef.current?.({ ...msg, receivedAt: Date.now() });
    };

    // The station (re)joined after us — ask it for its state.
    const onParticipantConnected = () => api.requestState();

    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    onApiRef.current?.(api);
    api.requestState();

    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      onApiRef.current?.(null);
    };
  }, [enabled, connectionState, room]);
}
