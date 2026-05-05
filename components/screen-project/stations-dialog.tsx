"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Monitor, Plus, Trash2 } from "lucide-react";
import axios from "axios";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

import { screenProjectService } from "@/lib/api/services/screen-project.service";
import type { Station } from "@/types/screen-project.types";

/* ─────────────────────────────────────────────────────────────────────────── */

interface StationsDialogProps {
  storeId: string;
  stations: Station[];
  onRefetch: () => void;
}

function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg =
      err.response?.data?.error?.message ??
      err.response?.data?.message ??
      err.message;
    return typeof msg === "string" ? msg : "An unexpected error occurred.";
  }
  if (err instanceof Error) return err.message;
  return "An unexpected error occurred.";
}

/* ─────────────────────────────────────────────────────────────────────────── */

export function StationsDialog({ storeId, stations, onRefetch }: StationsDialogProps) {
  const [open, setOpen] = useState(false);

  /* ── Delete state ──────────────────────────────────────────────── */
  const [confirmStation, setConfirmStation] = useState<Station | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /* ── Create state ──────────────────────────────────────────────── */
  const [name, setName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  /* ── Handlers ──────────────────────────────────────────────────── */

  async function handleDelete(station: Station) {
    setDeletingId(station.id);
    setDeleteError(null);
    try {
      await screenProjectService.deleteStation(storeId, station.id);
      onRefetch();
    } catch (err) {
      if (axios.isCancel(err)) return;
      setDeleteError(extractErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await screenProjectService.createStation(storeId, {
        name: name.trim(),
        room_name: roomName.trim(),
      });
      setName("");
      setRoomName("");
      onRefetch();
    } catch (err) {
      if (axios.isCancel(err)) return;
      setCreateError(extractErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Monitor className="h-4 w-4" />
            <span className="hidden sm:inline">Stations</span>
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Stations</DialogTitle>
          </DialogHeader>

          {/* ── Station list ─────────────────────────────────────────── */}
          <ScrollArea className="max-h-60 pr-1">
            {stations.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No stations yet.
              </p>
            ) : (
              <ul className="divide-y">
                {stations.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.room_name}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={deletingId === s.id}
                      onClick={() => setConfirmStation(s)}
                      aria-label={`Delete station ${s.name}`}
                    >
                      {deletingId === s.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>

          {deleteError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* ── Create form ──────────────────────────────────────────── */}
          <form onSubmit={handleCreate} className="space-y-3">
            <p className="text-sm font-semibold">Create Station</p>

            <div className="space-y-1.5">
              <Label htmlFor="sp-station-name">Name</Label>
              <Input
                id="sp-station-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Drive-Through"
                required
                disabled={creating}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sp-station-room">Room Name</Label>
              <Input
                id="sp-station-room"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g. 03795-00001-drive-through"
                required
                disabled={creating}
              />
            </div>

            {createError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              size="sm"
              disabled={creating}
              className="w-full gap-1.5"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {creating ? "Creating…" : "Create Station"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation — rendered outside Dialog to avoid stacking issues */}
      <AlertDialog
        open={confirmStation !== null}
        onOpenChange={(o) => { if (!o) setConfirmStation(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete station?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{confirmStation?.name}</span>
              {" "}will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmStation) handleDelete(confirmStation);
                setConfirmStation(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
