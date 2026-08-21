"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Search, Sparkles, Upload, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ManagerDashboardEmployee } from "@/types/employee.types";
import { FOOTER_MESSAGE_MAX_LENGTH, FOOTER_MESSAGE_PRESETS } from "./dspr-store-performance-report-template";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const CUSTOM_SENTENCE_VALUE = "custom";

function formatEmployeeName(employee: ManagerDashboardEmployee): string {
  return [employee.name.first, employee.name.middle, employee.name.last]
    .filter(Boolean)
    .join(" ");
}

export interface DsprReportValues {
  employeeName: string;
  employeeImageDataUrl: string | null;
  footerMessage: string;
}

interface DsprDailyReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (values: DsprReportValues) => void;
  isGenerating?: boolean;
  /** Store's active employee roster — already loaded for the Current Employees card, no extra fetch here. */
  employees?: ManagerDashboardEmployee[];
}

export function DsprDailyReportDialog({
  open,
  onOpenChange,
  onGenerate,
  isGenerating,
  employees = [],
}: DsprDailyReportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [messageSearch, setMessageSearch] = useState("");
  const [sentenceChoice, setSentenceChoice] = useState<string>(FOOTER_MESSAGE_PRESETS[0]);
  const [customSentence, setCustomSentence] = useState("");

  const selectedEmployee = employees.find((e) => e.employee_id === selectedEmployeeId) ?? null;
  const employeeName = selectedEmployee ? formatEmployeeName(selectedEmployee) : "";

  const filteredEmployees = employees.filter((e) =>
    formatEmployeeName(e).toLowerCase().includes(employeeSearch.trim().toLowerCase()),
  );
  const filteredPresets = FOOTER_MESSAGE_PRESETS.filter((p) =>
    p.toLowerCase().includes(messageSearch.trim().toLowerCase()),
  );

  const isCustom = sentenceChoice === CUSTOM_SENTENCE_VALUE;
  const effectiveFooterMessage = (isCustom ? customSentence : sentenceChoice).trim();

  const isValid = effectiveFooterMessage.length > 0;

  function resetForm() {
    setEmployeeSearch("");
    setSelectedEmployeeId(null);
    setImageDataUrl(null);
    setImageError(null);
    setMessageSearch("");
    setSentenceChoice(FOOTER_MESSAGE_PRESETS[0]);
    setCustomSentence("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    resetForm();
    onOpenChange(false);
  }

  function handleSelectEmployee(employee: ManagerDashboardEmployee) {
    setSelectedEmployeeId((prev) => (prev === employee.employee_id ? null : employee.employee_id));
    setImageDataUrl(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image must be smaller than 5MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setImageError(null);
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleRemoveImage() {
    setImageDataUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    onGenerate({
      employeeName,
      employeeImageDataUrl: employeeName ? imageDataUrl : null,
      footerMessage: effectiveFooterMessage,
    });
    handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            DSPR Report
          </DialogTitle>
          <DialogDescription>
            Celebrate yesterday&apos;s star and add a message before generating today&apos;s report.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 overflow-x-hidden">
          {/* Employee of the day (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="dspr-report-employee-search">
              Employee of the Day <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="dspr-report-employee-search"
                placeholder="Search employees…"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="ps-8"
              />
            </div>
            <ScrollArea className="h-40 rounded-md border">
              <div className="p-1">
                {employees.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No employees found for this store.
                  </p>
                ) : filteredEmployees.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No employees match &quot;{employeeSearch}&quot;.
                  </p>
                ) : (
                  filteredEmployees.map((employee) => {
                    const isSelected = employee.employee_id === selectedEmployeeId;
                    return (
                      <button
                        key={employee.employee_id}
                        type="button"
                        onClick={() => handleSelectEmployee(employee)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-start text-sm transition-colors",
                          isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted",
                        )}
                      >
                        <User className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        <span className="min-w-0 flex-1 truncate">{formatEmployeeName(employee)}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Employee photo — only relevant once someone is picked above */}
          {selectedEmployee && (
            <div className="space-y-1.5">
              <Label>
                Employee photo <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </Label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {imageDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageDataUrl} alt="Employee preview" className="h-full w-full object-cover" />
                  ) : (
                    (employeeName.trim().charAt(0).toUpperCase() || "?")
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 me-1.5" />
                  {imageDataUrl ? "Replace photo" : "Upload photo"}
                </Button>
                {imageDataUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleRemoveImage}>
                    <X className="h-3.5 w-3.5 me-1.5" />
                    Remove
                  </Button>
                )}
              </div>
              {imageError && <p className="text-xs text-destructive">{imageError}</p>}
              {!imageDataUrl && (
                <p className="text-xs text-muted-foreground">
                  No photo? The report will show the employee&apos;s first initial instead.
                </p>
              )}
            </div>
          )}

          {/* Footer sentence */}
          <div className="space-y-1.5">
            <Label htmlFor="dspr-report-message-search">
              Message <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="dspr-report-message-search"
                placeholder="Search messages…"
                value={messageSearch}
                onChange={(e) => setMessageSearch(e.target.value)}
                className="ps-8"
              />
            </div>
            <ScrollArea className="h-40 rounded-md border">
              <div className="p-1">
                {filteredPresets.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No messages match &quot;{messageSearch}&quot;.
                  </p>
                )}
                {filteredPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSentenceChoice(preset)}
                    title={preset}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-start text-sm transition-colors",
                      sentenceChoice === preset ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted",
                    )}
                  >
                    <span className="min-w-0 flex-1">{preset}</span>
                    {sentenceChoice === preset && <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSentenceChoice(CUSTOM_SENTENCE_VALUE)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-start text-sm transition-colors",
                    isCustom ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted",
                  )}
                >
                  <span className="min-w-0 flex-1">Write your own…</span>
                  {isCustom && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              </div>
            </ScrollArea>

            {isCustom && (
              <div className="space-y-1">
                <Textarea
                  value={customSentence}
                  onChange={(e) => setCustomSentence(e.target.value.slice(0, FOOTER_MESSAGE_MAX_LENGTH))}
                  maxLength={FOOTER_MESSAGE_MAX_LENGTH}
                  placeholder="Write a short, positive message…"
                  rows={3}
                />
                <p className="text-right text-xs text-muted-foreground">
                  {customSentence.length}/{FOOTER_MESSAGE_MAX_LENGTH}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isGenerating}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isGenerating}>
              {isGenerating ? (
                <>
                  <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin me-1.5" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 me-1.5" />
                  Generate Report
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
