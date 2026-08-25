import { create } from "zustand";
import axios from "axios";
import type { Announcement, CreateAnnouncementPayload, UpdateAnnouncementPayload } from "@/types/announcement.types";
import { announcementService } from "@/lib/api/services/announcement.service";
import { parseApiError, type ParsedApiError } from "@/lib/api/utils/error";

interface AnnouncementStoreState {
  announcements: Announcement[];
  seenIds: number[];
  isLoading: boolean;
  error: string | null;
  isCreating: boolean;
  createError: ParsedApiError | null;
  isMarkingSeen: boolean;
  markSeenError: ParsedApiError | null;
  isUpdating: boolean;
  updateError: ParsedApiError | null;
  isDeleting: boolean;
  deleteError: ParsedApiError | null;
  activePopupAnnouncement: Announcement | null;
}

interface AnnouncementStoreActions {
  fetchVisibleAnnouncements: (signal?: AbortSignal) => Promise<void>;
  fetchAllAnnouncements: (signal?: AbortSignal) => Promise<void>;
  createAnnouncement: (payload: CreateAnnouncementPayload) => Promise<boolean>;
  markSeen: (ids: number[]) => Promise<boolean>;
  updateAnnouncement: (id: number, payload: UpdateAnnouncementPayload) => Promise<boolean>;
  deleteAnnouncement: (id: number) => Promise<boolean>;
  setActivePopup: (announcement: Announcement | null) => void;
}

type AnnouncementStore = AnnouncementStoreState & AnnouncementStoreActions;

export const useAnnouncementStore = create<AnnouncementStore>()((set) => ({
  announcements: [],
  seenIds: [],
  isLoading: false,
  error: null,
  isCreating: false,
  createError: null,
  isMarkingSeen: false,
  markSeenError: null,
  isUpdating: false,
  updateError: null,
  isDeleting: false,
  deleteError: null,
  activePopupAnnouncement: null,

  fetchVisibleAnnouncements: async (signal?: AbortSignal) => {
    set({ isLoading: true, error: null });
    try {
      const data = await announcementService.getVisibleAnnouncements(signal);
      set({ announcements: data, isLoading: false });
    } catch (err) {
      if (axios.isCancel(err)) return;
      set({
        error: err instanceof Error ? err.message : "Failed to load announcements",
        isLoading: false,
      });
    }
  },

  fetchAllAnnouncements: async (signal?: AbortSignal) => {
    set({ isLoading: true, error: null });
    try {
      const data = await announcementService.getAllAnnouncements(signal);
      set({ announcements: data, isLoading: false });
    } catch (err) {
      if (axios.isCancel(err)) return;
      set({
        error: err instanceof Error ? err.message : "Failed to load announcements",
        isLoading: false,
      });
    }
  },

  setActivePopup: (announcement) =>
    set({ activePopupAnnouncement: announcement }),

  markSeen: async (ids: number[]) => {
    set({ isMarkingSeen: true, markSeenError: null });
    try {
      await announcementService.markAnnouncementsSeen(ids);
      const idSet = new Set(ids);
      set((state) => ({
        seenIds: [...new Set([...state.seenIds, ...ids])],
        announcements: state.announcements.map((a) =>
          idSet.has(a.id) ? { ...a, seen: true } : a,
        ),
        isMarkingSeen: false,
      }));
      return true;
    } catch (err) {
      set({
        markSeenError: parseApiError(err, "Failed to mark as seen."),
        isMarkingSeen: false,
      });
      return false;
    }
  },

  deleteAnnouncement: async (id: number) => {
    set({ isDeleting: true, deleteError: null });
    try {
      await announcementService.deleteAnnouncement(id);
      set((state) => ({
        announcements: state.announcements.filter((a) => a.id !== id),
        isDeleting: false,
      }));
      return true;
    } catch (err) {
      set({
        deleteError: parseApiError(err, "Failed to delete announcement."),
        isDeleting: false,
      });
      return false;
    }
  },

  updateAnnouncement: async (id: number, payload: UpdateAnnouncementPayload) => {
    set({ isUpdating: true, updateError: null });
    try {
      const updated = await announcementService.updateAnnouncement(id, payload);
      set((state) => ({
        announcements: state.announcements.map((a) =>
          a.id === id ? updated : a,
        ),
        isUpdating: false,
      }));
      return true;
    } catch (err) {
      set({
        updateError: parseApiError(err, "Failed to update announcement."),
        isUpdating: false,
      });
      return false;
    }
  },

  createAnnouncement: async (payload: CreateAnnouncementPayload) => {
    set({ isCreating: true, createError: null });
    try {
      const created = await announcementService.createAnnouncement(payload);
      set((state) => ({
        announcements: [created, ...state.announcements],
        isCreating: false,
      }));
      return true;
    } catch (err) {
      set({
        createError: parseApiError(err, "Failed to create announcement."),
        isCreating: false,
      });
      return false;
    }
  },
}));
