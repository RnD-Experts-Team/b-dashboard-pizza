"use client";

import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { tagsService, TagsError } from "@/lib/api/services/tags.service";
import type { TagsListResponse, Tag, CreateTagPayload } from "@/types/tag.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Cancel / abort helper                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function isCanceledError(err: unknown): boolean {
  if (axios.isCancel(err)) return true;
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "CanceledError") return true;
  return false;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useTagsList — fetch all tags                                            */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseTagsListReturn {
  data: TagsListResponse | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => void;
  clearError: () => void;
}

export function useTagsList(): UseTagsListReturn {
  const [data, setData] = useState<TagsListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchTags = useCallback(
    async (signal?: AbortSignal, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = await tagsService.getTags(signal);
        if (signal?.aborted) return;
        setData(result);
      } catch (err) {
        if (isCanceledError(err) || signal?.aborted) return;
        if (err instanceof TagsError) {
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : "Failed to load tags.");
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchTags(controller.signal);
    return () => controller.abort();
  }, [fetchTags]);

  const refetch = useCallback(() => {
    fetchTags(undefined, true);
  }, [fetchTags]);

  return { data, isLoading, isRefreshing, error, refetch, clearError };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useCreateTag                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseCreateTagReturn {
  createTag: (payload: CreateTagPayload) => Promise<Tag | null>;
  isCreating: boolean;
  error: string | null;
  clearError: () => void;
}

export function useCreateTag(): UseCreateTagReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const createTag = useCallback(
    async (payload: CreateTagPayload): Promise<Tag | null> => {
      setIsCreating(true);
      setError(null);
      try {
        const tag = await tagsService.createTag(payload);
        return tag;
      } catch (err) {
        if (err instanceof TagsError) {
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : "Failed to create tag.");
        }
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  return { createTag, isCreating, error, clearError };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useDeleteTag                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseDeleteTagReturn {
  deleteTag: (id: number) => Promise<boolean>;
  isDeleting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useDeleteTag(): UseDeleteTagReturn {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const deleteTag = useCallback(async (id: number): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);
    try {
      await tagsService.deleteTag(id);
      return true;
    } catch (err) {
      if (err instanceof TagsError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Failed to delete tag.");
      }
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return { deleteTag, isDeleting, error, clearError };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  useDeleteTagsBulk                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

interface UseDeleteTagsBulkReturn {
  deleteTagsBulk: (ids: number[]) => Promise<boolean>;
  isDeleting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useDeleteTagsBulk(): UseDeleteTagsBulkReturn {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const deleteTagsBulk = useCallback(async (ids: number[]): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);
    try {
      await tagsService.deleteTagsBulk(ids);
      return true;
    } catch (err) {
      if (err instanceof TagsError) {
        setError(err.message);
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to delete tags."
        );
      }
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return { deleteTagsBulk, isDeleting, error, clearError };
}
