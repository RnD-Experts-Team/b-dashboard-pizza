"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { parseApiError } from "@/lib/api/utils/error";
import { employeeService } from "@/lib/api/services/employee.service";
import { shirtMilestoneService } from "@/lib/api/services/shirt-milestone.service";
import { useShirtCatalog } from "@/lib/shirts/use-shirt-catalog";
import {
  SECONDARY_COLOR_REQUIRED_MESSAGE,
  SECONDARY_COLOR_SAME_MESSAGE,
  SHIRT_SIZES,
  SIZE_REQUIRED_MESSAGE,
  isSizeRequired,
  milestoneMonthLabel,
  pickTemplate,
  profileSize,
  shirtEmployeeName,
} from "@/lib/shirts/shirt-utils";
import { ShirtPreview } from "@/components/shirts/shirt-preview";
import { ColorSelect, LogoSelect } from "@/components/shirts/shirt-selects";
import type { EmployeeV1Record } from "@/types/employee.types";
import type {
  ShirtGender,
  ShirtMilestone,
  TShirtSize,
} from "@/types/shirt-milestone.types";

export interface ShirtEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "entry" fills an existing milestone; "create" makes a manual one. */
  mode: "entry" | "create";
  /** The store NUMBER. In create mode this is the initially selected store. */
  storeNumber: string;
  /** Required for mode="entry". */
  milestone: ShirtMilestone | null;
  /** Store numbers selectable in create mode. */
  storeOptions?: { storeId: string; name: string }[];
  onSuccess: () => void;
}

/**
 * Screen 2 — the entry form, with the live preview beside it.
 *
 * The only conditional logic in the form is the shirt size: it is required
 * only when the employee has no size on file, which the milestone payload
 * already tells us via employee.obsession.t_shirt — no extra call.
 */
export function ShirtEntryDialog({
  open,
  onOpenChange,
  mode,
  storeNumber,
  milestone,
  storeOptions = [],
  onSuccess,
}: ShirtEntryDialogProps) {
  const {
    catalog,
    isLoading: catalogLoading,
    error: catalogError,
  } = useShirtCatalog({ enabled: open });

  const [colorId, setColorId] = useState<number | null>(null);
  /* The fallback when the first colour isn't available. We never check stock —
     fulfilment does when ordering — so every entry names a second choice. */
  const [secondaryColorId, setSecondaryColorId] = useState<number | null>(null);
  const [logoId, setLogoId] = useState<number | null>(null);
  const [size, setSize] = useState<TShirtSize | "">("");
  const [notes, setNotes] = useState("");

  /* create-mode only */
  const [createStore, setCreateStore] = useState(storeNumber);
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [employees, setEmployees] = useState<EmployeeV1Record[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [dueDate, setDueDate] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(
    null,
  );
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  /* Reset whenever the dialog is (re)opened for a different target. */
  useEffect(() => {
    if (!open) return;
    setColorId(null);
    setSecondaryColorId(null);
    setLogoId(null);
    setNotes("");
    setError(null);
    setDueDate("");
    setEmployeeId(null);
    setEmployeeFilter("");
    setCreateStore(storeNumber);
    // Pre-fill from the profile when there is a size on file — still editable,
    // and re-sending it is harmless (it writes the same value back).
    setSize(mode === "entry" ? (profileSize(milestone) ?? "") : "");
  }, [open, mode, milestone, storeNumber]);

  /* create mode: load the chosen store's active employees */
  useEffect(() => {
    if (!open || mode !== "create" || !createStore) return;
    let cancelled = false;
    setEmployeesLoading(true);
    setEmployees([]);
    setEmployeeId(null);

    employeeService
      .getEmployeesV1(createStore, {
        per_page: 99,
        status_in: ["hired", "rehired"],
      })
      .then((res) => {
        if (!cancelled) setEmployees(res.data);
      })
      .catch(() => {
        if (!cancelled) setEmployees([]);
      })
      .finally(() => {
        if (!cancelled) setEmployeesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, mode, createStore]);

  const colors = useMemo(
    () => (catalog?.colors ?? []).filter((c) => c.is_active),
    [catalog],
  );
  const logos = useMemo(
    () => (catalog?.logos ?? []).filter((l) => l.is_active),
    [catalog],
  );

  const selectedEmployee = employees.find((e) => e.id === employeeId) ?? null;

  /* Gender is never a form field — it is read from the profile and snapshotted
     server-side. It matters here only because it selects the template. */
  const gender: ShirtGender | null =
    mode === "entry"
      ? (milestone?.employee?.gender ?? null)
      : selectedEmployee?.gender === "male" || selectedEmployee?.gender === "female"
        ? selectedEmployee.gender
        : null;

  const selectedColor = colors.find((c) => c.id === colorId) ?? null;
  const selectedLogo = logos.find((l) => l.id === logoId) ?? null;

  /* A second choice equal to the first is no fallback, so the first colour is
     left out of the list (the API refuses it too). */
  const secondaryOptions = useMemo(
    () => colors.filter((c) => c.id !== colorId),
    [colors, colorId],
  );

  /* The preview keeps showing the first colour only. Changing the first colour
     to the one already picked as the second choice would leave both the same,
     so the second choice is cleared instead. */
  function handleColorChange(id: number) {
    setColorId(id);
    if (id === secondaryColorId) setSecondaryColorId(null);
  }

  // Preview only. The payload omits shirt_template_id so the server stays
  // authoritative about which template a shirt is actually made from.
  const previewTemplate = useMemo(
    () => pickTemplate(catalog?.templates ?? [], gender),
    [catalog, gender],
  );

  /* In create mode the employee list rows carry no obsession, so there is no
     way to know whether a size is on file — always require it. Simpler than a
     second lookup, and it never 422s. */
  const sizeRequired = mode === "create" ? true : isSizeRequired(milestone);
  const knownProfileSize = mode === "entry" ? profileSize(milestone) : null;

  const isDirty =
    colorId !== null ||
    secondaryColorId !== null ||
    logoId !== null ||
    notes !== "" ||
    (mode === "create" && (employeeId !== null || dueDate !== ""));

  function requestClose(next: boolean) {
    if (!next && isDirty && !submitting) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(next);
  }

  /* First problem wins, in the order the fields appear on the form. */
  function findValidationError(): string | null {
    if (colorId === null) return "Pick a shirt colour.";
    if (secondaryColorId === null) return SECONDARY_COLOR_REQUIRED_MESSAGE;
    if (secondaryColorId === colorId) return SECONDARY_COLOR_SAME_MESSAGE;
    if (logoId === null) return "Pick a logo.";
    if (sizeRequired && !size) return SIZE_REQUIRED_MESSAGE;
    if (mode === "create" && employeeId === null) return "Pick an employee.";
    return null;
  }
  const validationError = findValidationError();

  async function handleSubmit() {
    if (validationError) {
      setError({ message: validationError, details: [] });
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const base = {
        shirt_color_id: colorId!,
        secondary_shirt_color_id: secondaryColorId!,
        shirt_logo_id: logoId!,
        ...(size ? { t_shirt_size: size as TShirtSize } : {}),
        ...(notes.trim() ? { entry_notes: notes.trim() } : {}),
      };

      if (mode === "entry" && milestone) {
        await shirtMilestoneService.submitEntry(storeNumber, milestone.id, base);
        toast.success("Shirt entry submitted.");
      } else {
        await shirtMilestoneService.createManual(createStore, {
          ...base,
          employee_id: employeeId!,
          ...(dueDate ? { due_date: dueDate } : {}),
        });
        toast.success("Shirt milestone created.");
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(parseApiError(err, "Could not save the shirt entry."));
    } finally {
      setSubmitting(false);
    }
  }

  const employeeMatches = employees.filter((e) =>
    shirtEmployeeName(e).toLowerCase().includes(employeeFilter.toLowerCase()),
  );

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "New Shirt Milestone" : "Shirt Entry"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Give an employee a shirt without waiting for a month to come around."
                : milestone
                  ? `${shirtEmployeeName(milestone.employee)} — ${milestoneMonthLabel(milestone.milestone_month)}`
                  : ""}
            </DialogDescription>
          </DialogHeader>

          {catalogError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{catalogError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 md:grid-cols-[1fr_16rem]">
            {/* Preview first on mobile so the payoff is visible without scrolling */}
            <div className="order-first md:order-last">
              <div className="md:sticky md:top-0">
                <ShirtPreview
                  template={previewTemplate}
                  color={selectedColor}
                  logo={selectedLogo}
                />
                {gender && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Template selected for: {gender}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {mode === "create" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label>Store</Label>
                    <Popover open={storePickerOpen} onOpenChange={setStorePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-between font-normal">
                          {createStore || "Select a store"}
                          <ChevronsUpDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-1">
                        <div className="max-h-60 overflow-y-auto">
                          {storeOptions.map((s) => (
                            <button
                              key={s.storeId}
                              type="button"
                              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-sm hover:bg-muted"
                              onClick={() => {
                                setCreateStore(s.storeId);
                                setStorePickerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  createStore === s.storeId ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <span className="truncate">
                                {s.storeId} — {s.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>
                      Employee <span className="text-destructive">*</span>
                    </Label>
                    <Popover
                      open={employeePickerOpen}
                      onOpenChange={setEmployeePickerOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="justify-between font-normal"
                          disabled={employeesLoading || employees.length === 0}
                        >
                          {employeesLoading
                            ? "Loading employees…"
                            : selectedEmployee
                              ? shirtEmployeeName(selectedEmployee)
                              : employees.length === 0
                                ? "No active employees"
                                : "Select an employee"}
                          <ChevronsUpDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-1">
                        <Input
                          value={employeeFilter}
                          onChange={(e) => setEmployeeFilter(e.target.value)}
                          placeholder="Filter…"
                          className="mb-1 h-8"
                        />
                        <div className="max-h-60 overflow-y-auto">
                          {employeeMatches.map((e) => (
                            <button
                              key={e.id}
                              type="button"
                              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-sm hover:bg-muted"
                              onClick={() => {
                                setEmployeeId(e.id);
                                setEmployeePickerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  employeeId === e.id ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <span className="truncate">{shirtEmployeeName(e)}</span>
                            </button>
                          ))}
                          {employeeMatches.length === 0 && (
                            <p className="px-2 py-1.5 text-sm text-muted-foreground">
                              No matches.
                            </p>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>Due date</Label>
                    <DatePicker value={dueDate} onChange={setDueDate} />
                    <p className="text-xs text-muted-foreground">
                      Optional — for the record only.
                    </p>
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="shirt-color">
                  Shirt colour <span className="text-destructive">*</span>
                </Label>
                <ColorSelect
                  id="shirt-color"
                  colors={colors}
                  value={colorId}
                  onChange={handleColorChange}
                  loading={catalogLoading}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="shirt-secondary-color">
                  Secondary colour <span className="text-destructive">*</span>
                </Label>
                <ColorSelect
                  id="shirt-secondary-color"
                  colors={secondaryOptions}
                  value={secondaryColorId}
                  onChange={setSecondaryColorId}
                  loading={catalogLoading}
                  placeholder="Select a second choice"
                  emptyText="No other colour available"
                />
                <p className="text-xs text-muted-foreground">
                  {!catalogLoading && colors.length < 2
                    ? "The catalog needs at least two active colours before a second choice can be picked."
                    : "Used if the first colour isn't available — fulfilment checks availability when ordering."}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="shirt-logo">
                  Logo <span className="text-destructive">*</span>
                </Label>
                <LogoSelect
                  id="shirt-logo"
                  logos={logos}
                  value={logoId}
                  onChange={setLogoId}
                  loading={catalogLoading}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>
                  Shirt size {sizeRequired && <span className="text-destructive">*</span>}
                </Label>
                <Select value={size} onValueChange={(v) => setSize(v as TShirtSize)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a size" />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIRT_SIZES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {knownProfileSize
                    ? "From the employee's profile — change it only if it's wrong."
                    : SIZE_REQUIRED_MESSAGE}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
                  maxLength={2000}
                  rows={3}
                  placeholder="Anything the fulfilment team should know."
                />
                <p className="text-end text-xs text-muted-foreground">
                  {notes.length}/2000
                </p>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{error.message}</AlertTitle>
              {error.details.length > 0 && (
                <AlertDescription>
                  <ul className="list-disc ps-4">
                    {error.details.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </AlertDescription>
              )}
            </Alert>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => requestClose(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || catalogLoading}>
              {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? "Create" : "Submit Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              What you have filled in will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscard(false);
                onOpenChange(false);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
