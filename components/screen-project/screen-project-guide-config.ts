import type { GuideStep } from "@/components/shared/page-guide";

export const SCREEN_PROJECT_GUIDE_STEPS: GuideStep[] = [
  // ── Step 0: Intro (no spotlight, centered card) ───────────────────────────
  {
    id: "sp-intro",
    title: "📡 Screen Project — Supervisor View",
    description:
      "This is where supervisors watch and control all physical station screens in real time using live video feeds. Each station runs a dedicated page that can be opened on a TV, tablet, or any browser.",
    bullets: [
      "Station screens load at: /store/<storeNumber>/stations (e.g. /en/store/03795/stations)",
      "The large tile is the main focused station; smaller tiles appear in the side strip",
      "You can swap which station is in focus by clicking any side tile",
      "Navigating away keeps the main station alive in a floating PiP overlay",
    ],
    placement: "bottom",
    noHighlight: true,
  },

  // ── Step 1: Tile area ─────────────────────────────────────────────────────
  {
    id: "sp-tile-area",
    title: "Live Station Tiles",
    description:
      "All station video feeds appear here. The main tile (large) is your primary focus. Side tiles appear on the right (desktop) or in the bottom strip (mobile). Click any side tile to promote it to main — the connection never drops during swaps.",
    bullets: [
      "Green pulsing dot = station is live and streaming",
      "Sound bars animate when someone is speaking",
      "Network quality badge shows the station's connection strength",
      "Per-tile controls (sound, video, screen share) appear on each tile",
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
      "Hold this button to broadcast your voice to every station room at once. Release to stop. Your microphone must be unmuted first.",
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
];
