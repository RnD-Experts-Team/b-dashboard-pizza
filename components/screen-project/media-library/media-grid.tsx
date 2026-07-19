"use client";

import { useState } from "react";
import { Star, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { stationMediaSrc } from "@/lib/hooks/use-station-media-asset";
import type { StationMedia } from "@/types/screen-project-media.types";

interface MediaGridProps {
  items: StationMedia[];
  isLoading: boolean;
  isDeleting: boolean;
  onSetPrimary: (id: number) => void;
  onDelete: (ids: number[]) => void;
}

function MediaThumbnail({ item }: { item: StationMedia }) {
  if (item.type === "image") {
    return (
      <img
        src={stationMediaSrc(item.url)}
        alt={item.file_name}
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <video
      src={stationMediaSrc(item.url)}
      className="absolute inset-0 h-full w-full object-cover"
      preload="metadata"
      muted
    />
  );
}

export function MediaGrid({
  items,
  isLoading,
  isDeleting,
  onSetPrimary,
  onDelete,
}: MediaGridProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clearSelection = () => setSelected(new Set());

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-video rounded-lg" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
        <Star className="h-8 w-8 opacity-30" />
        <p className="text-sm">No media uploaded yet</p>
        <p className="text-xs opacity-70">
          Upload an image or video above to get started.
        </p>
      </div>
    );
  }

  const selectedArr = Array.from(selected);
  const allSelected = selected.size === items.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Hint (hidden while selecting to reduce clutter) */}
      {selected.size === 0 && (
        <p className="text-[0.7rem] leading-snug text-muted-foreground">
          Click a tile to make it the station&apos;s primary media. Use the
          circle in the corner to select items for deletion.
        </p>
      )}

      {/* Selection toolbar — appears once something is selected */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg border bg-background/95 px-3 py-2 backdrop-blur">
          <span className="text-xs font-medium text-foreground">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() =>
                allSelected
                  ? clearSelection()
                  : setSelected(new Set(items.map((i) => i.id)))
              }
            >
              {allSelected ? "Clear" : "Select all"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete {selected.size}{" "}
                    {selected.size === 1 ? "item" : "items"}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes the selected media. This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      onDelete(selectedArr);
                      clearSelection();
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => {
          const isSelected = selected.has(item.id);
          return (
            <div key={item.id} className="flex flex-col gap-1.5">
              <div
                className={cn(
                  "relative aspect-video w-full overflow-hidden rounded-lg bg-muted ring-2 transition",
                  item.is_primary ? "ring-amber-400" : "ring-transparent",
                )}
              >
                <MediaThumbnail item={item} />

                {/* Full-tile click target → set as primary */}
                <button
                  type="button"
                  onClick={() => onSetPrimary(item.id)}
                  aria-label={
                    item.is_primary
                      ? `${item.file_name} is the primary media`
                      : `Set ${item.file_name} as primary`
                  }
                  className="absolute inset-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-inset"
                />

                {/* Selected tint */}
                {isSelected && (
                  <span className="pointer-events-none absolute inset-0 bg-black/30" />
                )}

                {/* Selection toggle circle — dark grey when selected,
                    theme-independent (it sits over media, so it uses fixed
                    high-contrast colors). */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(item.id);
                  }}
                  aria-pressed={isSelected}
                  aria-label={`${isSelected ? "Deselect" : "Select"} ${item.file_name} for deletion`}
                  className={cn(
                    "absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow-md transition",
                    isSelected
                      ? "bg-neutral-800 text-white"
                      : "bg-black/45 text-transparent hover:bg-black/65",
                  )}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </button>

                {/* Primary badge */}
                {item.is_primary && (
                  <span className="pointer-events-none absolute bottom-1.5 left-1.5 flex items-center gap-0.5 rounded bg-amber-400 px-1.5 py-0.5 shadow">
                    <Star className="h-2.5 w-2.5 fill-amber-950 text-amber-950" />
                    <span className="text-[0.55rem] font-bold uppercase text-amber-950">
                      Primary
                    </span>
                  </span>
                )}
              </div>

              {/* Filename */}
              <p
                className="truncate px-0.5 text-[0.65rem] text-muted-foreground"
                title={item.file_name}
              >
                {item.file_name}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
