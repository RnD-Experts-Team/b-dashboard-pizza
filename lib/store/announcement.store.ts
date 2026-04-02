import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Announcement,
  AnnouncementState,
  AnnouncementActions,
  CreateAnnouncementInput,
} from "@/types/announcement.types";

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "ann-1",
    title: "Welcome to the New Dashboard!",
    content:
      "We're excited to announce the launch of our redesigned dashboard. Enjoy the new layout, improved reporting tools, and faster performance. Your feedback is welcome — use the feedback button in settings.",
    media: {
      type: "image",
      url: "https://picsum.photos/seed/pizza-dash-1/800/400",
      alt: "New dashboard launch",
    },
    author: { name: "Tyler Johnson", role: "CEO", avatar: undefined },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    priority: "important",
    seen: false,
  },
  {
    id: "ann-2",
    title: "Q1 Performance Update",
    content:
      "Q1 results are in! Overall store performance is up 12% compared to last quarter. Top performers: Store #3, Store #7, and Store #12. Full report available in the Reports section. Great work to all regional managers.",
    media: {
      type: "image",
      url: "https://picsum.photos/seed/pizza-dash-2/800/400",
      alt: "Q1 performance chart",
    },
    author: { name: "Sarah Mitchell", role: "Regional Director", avatar: undefined },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    priority: "normal",
    seen: true,
  },
  {
    id: "ann-3",
    title: "Urgent: System Maintenance Window",
    content:
      "A scheduled maintenance window is planned for Sunday, April 5th from 2:00 AM to 4:00 AM (EST). During this time the dashboard will be unavailable. Please plan accordingly and ensure all critical reports are exported before the window.",
    media: undefined,
    author: { name: "Tech Team", role: "Infrastructure", avatar: undefined },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    priority: "urgent",
    seen: true,
  },
  {
    id: "ann-4",
    title: "New Training Videos Available",
    content:
      "We've added new training videos for store managers covering inventory management, employee scheduling, and QA procedures. Access them in the Help section. All managers must complete the new modules by April 30th.",
    media: {
      type: "video",
      url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      thumbnail: "https://picsum.photos/seed/pizza-dash-4/800/400",
      alt: "Training video thumbnail",
    },
    author: { name: "HR Department", role: "Human Resources", avatar: undefined },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    priority: "normal",
    seen: true,
  },
  {
    id: "ann-5",
    title: "Holiday Hours Policy Update",
    content:
      "Please review the updated holiday hours policy effective May 1st. Key changes include extended weekend shifts for high-traffic locations and revised overtime guidelines. Store managers should communicate these changes to their teams by April 15th.",
    media: {
      type: "image",
      url: "https://picsum.photos/seed/pizza-dash-5/800/400",
      alt: "Calendar with holiday dates",
    },
    author: { name: "Tyler Johnson", role: "CEO", avatar: undefined },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    priority: "important",
    seen: true,
  },
];

let annCounter = 100;

type AnnouncementStore = AnnouncementState & AnnouncementActions;

export const useAnnouncementStore = create<AnnouncementStore>()(
  persist(
    (set) => ({
      announcements: MOCK_ANNOUNCEMENTS,
      activePopupAnnouncement: null,

      addAnnouncement: (input: CreateAnnouncementInput) => {
        const announcement: Announcement = {
          ...input,
          id: `ann-${crypto.randomUUID()}`,
          createdAt: new Date().toISOString(),
          seen: false,
          author: {
            name: "You",
            role: "Manager",
          },
        };
        set((state) => ({
          announcements: [announcement, ...state.announcements],
        }));
        return announcement;
      },

      markAsSeen: (id: string) =>
        set((state) => ({
          announcements: state.announcements.map((a) =>
            a.id === id ? { ...a, seen: true } : a
          ),
        })),

      markAllAsSeen: () =>
        set((state) => ({
          announcements: state.announcements.map((a) => ({ ...a, seen: true })),
        })),

      setActivePopup: (announcement) =>
        set({ activePopupAnnouncement: announcement }),
    }),
    {
      name: "announcement-storage",
      version: 2,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
    }
  )
);
