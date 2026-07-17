import type { GuideStep } from "@/components/shared/page-guide";

export function createScreenProjectGuideSteps(storeId: string): GuideStep[] {
  return [
    // ── Step 0: Intro (no spotlight, centered card) ───────────────────────────
    {
      id: "sp-intro",
      title: "📡 Screen Project — Store Manager View",
      description:
        "This is where store managers watch and control all physical station screens in real time using live video feeds. Each station runs a dedicated page that can be opened on a TV, tablet, or any browser. Share the link below with your team so they can connect their screens.",
      bullets: [
        "The large tile is the main focused station — your voice reaches only this one by default",
        "Smaller tiles appear in the side strip; click any to swap it to main (your voice follows)",
        "Hold Talk to All to broadcast your voice to every station simultaneously",
        "Navigating away keeps the main station alive in a floating PiP overlay",
      ],
      copyableUrl: storeId ? `/en/store/${storeId}/stations` : undefined,
      placement: "bottom",
      noHighlight: true,
    },

    // ── Step 1: Tile area ─────────────────────────────────────────────────────
    {
      id: "sp-tile-area",
      title: "Live Station Tiles",
      description:
        "All station video feeds appear here. The main tile (large) is your primary focus — your voice reaches only this tile by default. Side tiles are listen-only until you hold Talk to All or swap one to main.",
      bullets: [
        "Green pulsing dot = station is live and streaming",
        "Your voice only reaches the main tile — hold Talk to All to reach all screens",
        "Sound bars animate when someone is speaking",
        "Network quality badge shows the station's connection strength",
      ],
      placement: "bottom",
    },

    // ── Step 2: Bottom control bar ────────────────────────────────────────────
    {
      id: "sp-bottom-bar",
      title: "Bottom Control Bar",
      description:
        "The dark toolbar at the bottom gives you full control over every station. All station interactions start here.",
      placement: "top",
    },

    // ── Step 3: Left — network + stations ────────────────────────────────────
    {
      id: "sp-left-controls",
      title: "Network Status & Stations",
      description:
        "Your network connection quality is shown on the left. The Stations button opens a dialog to create or delete station rooms and set the shared password that station screens use to join.",
      bullets: [
        "The shared password is what station browsers enter at the /store/<storeNumber>/stations URL",
        "Room names (e.g. 03795-00001-drive-through) are the room identifiers",
      ],
      placement: "top",
    },

    // ── Step 4: Center — personal A/V ────────────────────────────────────────
    {
      id: "sp-av-controls",
      title: "Your Microphone & Camera",
      description:
        "Control your own microphone and camera. The self-view toggle shows a draggable picture-in-picture of your face inside the tile area.",
      bullets: [
        "Red indicator dot = your mic or camera is currently off",
        "Drag the self-view PiP anywhere within the tile area",
      ],
      placement: "top",
    },

    // ── Step 5: Talk to All ───────────────────────────────────────────────────
    {
      id: "sp-talk-all",
      title: "Talk to All",
      description:
        "By default your voice only reaches the main (large) tile. Hold this button to broadcast your voice to every station room at once — including side tiles. Release to stop broadcasting. Your microphone must be unmuted first.",
      placement: "top",
    },

    // ── Step 6: Right — broadcast controls ───────────────────────────────────
    {
      id: "sp-broadcast-controls",
      title: "Broadcast to All Screens",
      description:
        "These two buttons affect all station screens at once.",
      bullets: [
        "Left button: mute or unmute audio from all station feeds simultaneously",
        "Right button: push your camera feed into all station rooms at once (your camera must be on)",
      ],
      placement: "top",
    },

    // ── Step 7: Exit session ──────────────────────────────────────────────────
    {
      id: "sp-exit-session",
      title: "Exit Session",
      description:
        "Click this button when you are done monitoring. All station connections will fully disconnect. An overlay appears — click Reconnect to rejoin all stations with fresh connections whenever you are ready.",
      placement: "top",
    },
  ];
}
