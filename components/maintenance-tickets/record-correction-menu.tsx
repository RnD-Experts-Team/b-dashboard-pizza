"use client";

import { useState } from "react";
import { MoreHorizontal, PencilLine, Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MaintenanceTicketsError } from "@/lib/api/services/maintenance-tickets.service";
import {
  CORRECTABLE_LABELS,
  type CorrectableKind,
  type CorrectionSeed,
} from "@/lib/maintenance-tickets/corrections";

/**
 * The two ways to undo a record, side by side.
 *
 * "Just mark it as a mistake" is the original behaviour and is untouched: it
 * flags the record and leaves it in the history, which is how this system keeps
 * everyone accountable.
 *
 * "Correct it" does the same flag AND opens a fresh form already filled in with
 * what the old record said, so a wrong clock-out is one field and a save rather
 * than twelve fields retyped. Nothing is hidden by it -- both records stay on
 * the ticket, both attributed, and the confirm copy says so before anything
 * happens.
 */

interface RecordCorrectionMenuProps {
  kind: CorrectableKind;
  /** Flags the record upstream. Same call either path takes. */
  onMarkMistaken: () => Promise<void>;
  /** Seeds and opens the replacement form. Omit to offer flagging only. */
  onCorrect?: (seed: CorrectionSeed) => void;
  /** What to prefill with. Required when onCorrect is given. */
  seed?: CorrectionSeed;
  /** Already flagged: the menu still renders, disabled, so the row does not
   *  change shape and the control does not appear to vanish. */
  isMistaken?: boolean;
  disabled?: boolean;
}

type Pending = "correct" | "flag" | null;

export function RecordCorrectionMenu({
  kind,
  onMarkMistaken,
  onCorrect,
  seed,
  isMistaken = false,
  disabled = false,
}: RecordCorrectionMenuProps) {
  const [confirming, setConfirming] = useState<Pending>(null);
  const [pending, setPending] = useState<Pending>(null);

  const label = CORRECTABLE_LABELS[kind];
  const canCorrect = Boolean(onCorrect && seed);

  async function run(mode: Exclude<Pending, null>) {
    setPending(mode);
    try {
      await onMarkMistaken();
      if (mode === "correct" && onCorrect && seed) {
        onCorrect(seed);
        toast.success(`Flagged. Fix what was wrong and save the replacement.`);
      } else {
        toast.success(`Flagged as a mistake. It stays on the record.`);
      }
    } catch (err) {
      // An aborted request is not a failure and must never toast.
      if (err instanceof MaintenanceTicketsError && err.code === "CANCELLED") return;
      toast.error(
        err instanceof MaintenanceTicketsError ? err.message : "Something went wrong."
      );
    } finally {
      setPending(null);
      setConfirming(null);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={disabled || isMistaken || pending !== null}
            aria-label={isMistaken ? "Already flagged as a mistake" : "Fix this record"}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
            Nothing is ever deleted. Both versions stay on the ticket.
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {canCorrect && (
            <DropdownMenuItem onSelect={() => setConfirming("correct")}>
              <PencilLine className="me-2 h-4 w-4" />
              Correct it
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setConfirming("flag")}>
            <Flag className="me-2 h-4 w-4" />
            Just mark it as a mistake
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming === "correct"
                ? `Replace this ${label}?`
                : `Mark this ${label} as a mistake?`}
            </AlertDialogTitle>
            {/* Says what actually happens, not what it looks like -- the house
                style for every confirm in this app. */}
            <AlertDialogDescription>
              {confirming === "correct"
                ? `This does not delete or edit anything. The existing ${label} is flagged as a mistake and stays on the ticket, and a new form opens already filled in with what it said, so you only change what was wrong.`
                : `This does not delete anything. The ${label} is flagged as a mistake and stays on the ticket as part of the record, and it stops counting towards hours, costs and pay.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending !== null}
              onClick={(e) => {
                // Keep the dialog up while the request is in flight, so a slow
                // network cannot look like nothing happened.
                e.preventDefault();
                if (confirming) void run(confirming);
              }}
            >
              {pending !== null && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {confirming === "correct" ? "Flag it and open a copy" : "Mark as a mistake"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
