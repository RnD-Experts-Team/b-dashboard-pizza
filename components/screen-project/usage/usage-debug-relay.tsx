"use client";

import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import { ConnectionState, RoomEvent, type RemoteParticipant } from "livekit-client";
import { usageDebug } from "@/lib/screen-usage/recorder";
import { toDebugView, type DebugView } from "@/lib/screen-usage/debug-view";
import { useRemoteUsageDebugStore } from "@/lib/store/screen-usage-remote-debug.store";

/**
 * Relays the manager's live usage numbers to an observer in the same station
 * room, so the observer's debug panel shows the manager connected to the
 * screen. Sent only to observer participants, and only while one is in the room.
 */

const TOPIC = "usage-debug";
const SEND_EVERY_MS = 2_000;
/** Keeps one message well under LiveKit's reliable-data size limit. */
const SEGMENT_LIMIT = 20;
const OBSERVER_PREFIX = "observer:";
const SUPERVISOR_PREFIX = "supervisor:";

/** Manager side: mounted next to the usage probe on recorded tiles. */
export function UsageDebugSender() {
  const room = useRoomContext();

  useEffect(() => {
    const send = async () => {
      if (room.state !== ConnectionState.Connected) return;
      const observers = [...room.remoteParticipants.values()]
        .map((p) => p.identity)
        .filter((id) => id.startsWith(OBSERVER_PREFIX));
      if (observers.length === 0) return;
      const payload = JSON.stringify({ type: TOPIC, view: toDebugView(usageDebug.snapshot(), SEGMENT_LIMIT) });
      try {
        await room.localParticipant.publishData(new TextEncoder().encode(payload), {
          reliable: true,
          topic: TOPIC,
          destinationIdentities: observers,
        });
      } catch {
        /* a failed relay never affects the call */
      }
    };
    const id = setInterval(() => void send(), SEND_EVERY_MS);
    return () => clearInterval(id);
  }, [room]);

  return null;
}

/** Observer side: mounted on observer tiles; feeds the debug panel. */
export function UsageDebugReceiver({ roomName }: { roomName: string }) {
  const room = useRoomContext();
  const setView = useRemoteUsageDebugStore((s) => s.set);
  const clear = useRemoteUsageDebugStore((s) => s.clear);

  useEffect(() => {
    const onData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload)) as { type?: string; view?: DebugView };
        // Checks msg.type, not topic — topic can be undefined with some LiveKit server versions.
        if (msg.type === TOPIC && msg.view) setView(roomName, msg.view);
      } catch {
        /* ignore malformed */
      }
    };
    const onLeft = (p: RemoteParticipant) => {
      if (p.identity.startsWith(SUPERVISOR_PREFIX)) clear(roomName);
    };
    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.ParticipantDisconnected, onLeft);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ParticipantDisconnected, onLeft);
      clear(roomName);
    };
  }, [room, roomName, setView, clear]);

  return null;
}
