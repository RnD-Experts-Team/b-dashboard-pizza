"use client";

import { useState } from "react";
import { Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
        src={item.url}
        alt={item.file_name}
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <video
      src={item.url}
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

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2 p-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-video rounded-lg" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-neutral-500">
        <Star className="h-8 w-8 opacity-30" />
        <p className="text-sm">No media uploaded yet</p>
      </div>
    );
  }

  const selectedArr = Array.from(selected);

  return (
    <div className="flex flex-col gap-3">
      {/* Multi-select toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-neutral-800 px-3 py-2">
          <span className="text-xs text-neutral-300">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-neutral-400 hover:text-white"
              onClick={clearSelection}
            >
              Cancel
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
                  <AlertDialogTitle>Delete media?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {selected.size} media{" "}
                    {selected.size === 1 ? "item" : "items"}. This action cannot
                    be undone.
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
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => {
          const isSelected = selected.has(item.id);
          return (
            <div
              key={item.id}
              className={cn(
                "group relative flex flex-col gap-1",
                isSelected && "opacity-80",
              )}
            >
              {/* Thumbnail */}
              <div className="relative aspect-video overflow-hidden rounded-lg bg-neutral-800">
                <MediaThumbnail item={item} />

                {/* Primary badge */}
                {item.is_primary && (
                  <div className="absolute top-1 left-1 flex items-center gap-0.5 rounded bg-amber-400/90 px-1 py-0.5">
                    <Star className="h-2.5 w-2.5 fill-amber-900 text-amber-900" />
                    <span className="text-[0.55rem] font-bold uppercase text-amber-900">
                      Primary
                    </span>
                  </div>
                )}

                {/* Selection checkbox */}
                <div
                  className={cn(
                    "absolute top-1 right-1 transition-opacity",
                    isSelected
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100",
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(item.id)}
                    className="h-4 w-4 border-white/60 bg-black/40 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                  />
                </div>

                {/* Hover overlay with "Set as Primary" */}
                {!item.is_primary && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 gap-1 text-[0.7rem]"
                      onClick={() => onSetPrimary(item.id)}
                    >
                      <Star className="h-3 w-3" />
                      Set Primary
                    </Button>
                  </div>
                )}
              </div>

              {/* Filename */}
              <p className="truncate px-0.5 text-[0.65rem] text-neutral-400">
                {item.file_name}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
