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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trophy, Upload, X } from "lucide-react";
import { FOOTER_MESSAGE_MAX_LENGTH, FOOTER_MESSAGE_PRESETS } from "./dspr-store-performance-report-template";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const CUSTOM_SENTENCE_VALUE = "custom";

export interface StorePerformanceReportValues {
  employeeName: string;
  employeeImageDataUrl: string | null;
  footerMessage: string;
}

interface StorePerformanceReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (values: StorePerformanceReportValues) => void;
  isGenerating?: boolean;
}

export function StorePerformanceReportDialog({
  open,
  onOpenChange,
  onGenerate,
  isGenerating,
}: StorePerformanceReportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [sentenceChoice, setSentenceChoice] = useState<string>(FOOTER_MESSAGE_PRESETS[0]);
  const [customSentence, setCustomSentence] = useState("");

  const isCustom = sentenceChoice === CUSTOM_SENTENCE_VALUE;
  const effectiveFooterMessage = (isCustom ? customSentence : sentenceChoice).trim();

  const isValid = employeeName.trim().length > 0 && effectiveFooterMessage.length > 0;

  function resetForm() {
    setEmployeeName("");
    setImageDataUrl(null);
    setImageError(null);
    setSentenceChoice(FOOTER_MESSAGE_PRESETS[0]);
    setCustomSentence("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    resetForm();
    onOpenChange(false);
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
      employeeName: employeeName.trim(),
      employeeImageDataUrl: imageDataUrl,
      footerMessage: effectiveFooterMessage,
    });
    handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Store Performance Report
          </DialogTitle>
          <DialogDescription>
            Recognize yesterday&apos;s hero and add a message before generating the report.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 overflow-x-hidden">
          {/* Employee name */}
          <div className="space-y-1.5">
            <Label htmlFor="hero-name">
              Employee name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="hero-name"
              placeholder="e.g. Jamie Rivera"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              maxLength={60}
              required
            />
          </div>

          {/* Employee photo (optional) */}
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

          {/* Footer sentence */}
          <div className="space-y-1.5">
            <Label htmlFor="hero-sentence">
              Message <span className="text-destructive">*</span>
            </Label>
            <Select value={sentenceChoice} onValueChange={setSentenceChoice}>
              <SelectTrigger id="hero-sentence" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-56">
                {FOOTER_MESSAGE_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={preset} title={preset}>
                    <span className="min-w-0 flex-1 truncate">{preset}</span>
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_SENTENCE_VALUE}>
                  <span className="min-w-0 flex-1 truncate">Write your own…</span>
                </SelectItem>
              </SelectContent>
            </Select>

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
                  <Trophy className="h-4 w-4 me-1.5" />
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
