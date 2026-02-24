"use client";

import { useMemo, useState, useEffect, DragEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileArchive,
  FileSpreadsheet,
  UploadCloud,
  Shield,
  Zap,
  Database,
  FolderOpen,
  Loader2,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { manualImportService } from "@/lib/api/services/manual-import.service";

type AggregationType =
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "all";

type ImportSource = "zip" | "csv";

interface ImportQueueItem {
  id: string;
  name: string;
  source: ImportSource;
  selected: boolean;
  processorKey: string;
  file?: File;
}

const AGGREGATION_TYPES: AggregationType[] = [
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "all",
];

function isZipFile(file: File) {
  return file.name.toLowerCase().endsWith(".zip");
}

function isCsvFile(file: File) {
  return file.name.toLowerCase().endsWith(".csv");
}

function toProcessorKey(fileName: string) {
  return fileName
    .replace(/\.csv$/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function extractStringValue(payload: unknown, keys: string[]): string | null {
  if (!payload || typeof payload !== "object") return null;
  const source = payload as Record<string, unknown>;

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  const nested = source.data;
  if (nested && typeof nested === "object") {
    const nestedRecord = nested as Record<string, unknown>;
    for (const key of keys) {
      const value = nestedRecord[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }

  return null;
}

function extractProgressPercent(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const source = payload as Record<string, unknown>;
  const possibleKeys = ["progress", "percentage", "percent", "processed_percent"];

  for (const key of possibleKeys) {
    const value = source[key];
    if (typeof value === "number") return Math.max(0, Math.min(100, value));
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, parsed));
    }
  }

  const nested = source.data;
  if (nested && typeof nested === "object") {
    return extractProgressPercent(nested);
  }

  return 0;
}

function extractCsvNames(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const source = payload as Record<string, unknown>;

  const candidates =
    (source.files as unknown) ?? (source.csv_files as unknown) ?? (source.csvFiles as unknown);

  if (!Array.isArray(candidates)) return [];

  return candidates
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        const filename = record.filename ?? record.name ?? record.file ?? null;
        if (typeof filename === "string") return filename;
      }
      return null;
    })
    .filter((value): value is string => !!value);
}

function isFinishedStatus(status: string | null) {
  return !!status && ["completed", "success", "done", "finished"].includes(status);
}

function isFailedStatus(status: string | null) {
  return !!status && ["failed", "error"].includes(status);
}

export default function ExportImportPage() {
  const [queue, setQueue] = useState<ImportQueueItem[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isInspectingZip, setIsInspectingZip] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [zipTempId, setZipTempId] = useState<string | null>(null);

  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploadProgressData, setUploadProgressData] = useState<Record<string, unknown> | null>(null);

  const [aggregationId, setAggregationId] = useState<string | null>(null);
  const [aggregationProgressData, setAggregationProgressData] = useState<Record<string, unknown> | null>(null);

  const [startDate, setStartDate] = useState(normalizeDate(new Date()));
  const [endDate, setEndDate] = useState(normalizeDate(new Date()));
  const [aggregationType, setAggregationType] = useState<AggregationType>("hourly");
  const [isTriggeringAggregation, setIsTriggeringAggregation] = useState(false);

  const uploadProgress = useMemo(
    () => extractProgressPercent(uploadProgressData),
    [uploadProgressData]
  );
  const uploadStatus = useMemo(
    () =>
      extractStringValue(uploadProgressData, ["status", "state", "phase"])?.toLowerCase() ||
      null,
    [uploadProgressData]
  );

  const aggregationProgress = useMemo(
    () => extractProgressPercent(aggregationProgressData),
    [aggregationProgressData]
  );
  const aggregationStatus = useMemo(
    () =>
      extractStringValue(aggregationProgressData, ["status", "state", "phase"])?.toLowerCase() ||
      null,
    [aggregationProgressData]
  );

  useEffect(() => {
    if (!uploadId) return;

    let active = true;

    const poll = async () => {
      try {
        const response = await manualImportService.getImportProgress(uploadId);
        if (!active) return;

        setUploadProgressData(response);
        const status =
          extractStringValue(response, ["status", "state", "phase"])?.toLowerCase() ||
          null;

        if (isFinishedStatus(status)) {
          setUploadId(null);
          toast.success("Import completed successfully.");
        } else if (isFailedStatus(status)) {
          setUploadId(null);
          toast.error("Import failed. Please review the progress details.");
        }
      } catch (error) {
        if (!active) return;
        const message =
          error instanceof Error ? error.message : "Unable to fetch import progress.";
        toast.error(message);
      }
    };

    poll();
    const timer = window.setInterval(poll, 3_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [uploadId]);

  useEffect(() => {
    if (!aggregationId) return;

    let active = true;

    const poll = async () => {
      try {
        const response = await manualImportService.getAggregationProgress(aggregationId);
        if (!active) return;

        setAggregationProgressData(response);
        const status =
          extractStringValue(response, ["status", "state", "phase"])?.toLowerCase() ||
          null;

        if (isFinishedStatus(status)) {
          setAggregationId(null);
          toast.success("Re-aggregation completed successfully.");
        } else if (isFailedStatus(status)) {
          setAggregationId(null);
          toast.error("Re-aggregation failed. Please review the progress details.");
        }
      } catch (error) {
        if (!active) return;
        const message =
          error instanceof Error
            ? error.message
            : "Unable to fetch aggregation progress.";
        toast.error(message);
      }
    };

    poll();
    const timer = window.setInterval(poll, 3_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [aggregationId]);

  const selectedItems = useMemo(() => queue.filter((item) => item.selected), [queue]);

  const setQueueFromFiles = async (files: File[]) => {
    const zipFile = files.find(isZipFile) ?? null;
    const csvFiles = files.filter(isCsvFile);

    const csvQueueItems: ImportQueueItem[] = csvFiles.map((file) => ({
      id: `csv:${file.name}`,
      name: file.name,
      source: "csv",
      selected: true,
      processorKey: toProcessorKey(file.name),
      file,
    }));

    let zipQueueItems: ImportQueueItem[] = [];
    setZipTempId(null);

    if (zipFile) {
      try {
        setIsInspectingZip(true);
        const inspectResponse = await manualImportService.inspectZip(zipFile);
        const tempId = extractStringValue(inspectResponse, ["temp_id", "tempId"]);
        const csvNames = extractCsvNames(inspectResponse);

        setZipTempId(tempId);
        zipQueueItems = csvNames.map((name) => ({
          id: `zip:${name}`,
          name,
          source: "zip",
          selected: true,
          processorKey: toProcessorKey(name),
        }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to inspect ZIP file.";
        toast.error(message);
      } finally {
        setIsInspectingZip(false);
      }
    }

    setQueue([...zipQueueItems, ...csvQueueItems]);
  };

  const onFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    await setQueueFromFiles(files);
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0) return;
    await setQueueFromFiles(files);
  };

  const updateQueueItem = (id: string, patch: Partial<ImportQueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleUpload = async () => {
    if (selectedItems.length === 0) {
      toast.error("Select at least one CSV item to import.");
      return;
    }

    const mappings: Record<string, string> = {};
    for (const item of selectedItems) {
      const key = item.processorKey.trim();
      if (!key) {
        toast.error(`Processor key is required for ${item.name}.`);
        return;
      }
      mappings[item.name] = key;
    }

    const csvFiles = selectedItems
      .filter((item) => item.source === "csv" && item.file)
      .map((item) => item.file as File);

    const hasZipSelection = selectedItems.some((item) => item.source === "zip");
    const tempIdForUpload = hasZipSelection ? zipTempId ?? undefined : undefined;

    try {
      setIsUploading(true);
      const uploadResponse = await manualImportService.upload(
        csvFiles,
        mappings,
        tempIdForUpload
      );

      const nextUploadId = extractStringValue(uploadResponse, ["upload_id", "uploadId", "id"]);
      if (nextUploadId) {
        setUploadId(nextUploadId);
      }
      setUploadProgressData(uploadResponse as Record<string, unknown>);
      toast.success("Import request submitted successfully.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload import files.";
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const triggerReaggregation = async () => {
    if (!startDate || !endDate) {
      toast.error("Start date and end date are required.");
      return;
    }

    try {
      setIsTriggeringAggregation(true);
      const response = await manualImportService.triggerReaggregation({
        start_date: startDate,
        end_date: endDate,
        type: aggregationType,
      });

      const nextAggregationId = extractStringValue(response, [
        "aggregationId",
        "aggregation_id",
        "id",
      ]);

      if (nextAggregationId) {
        setAggregationId(nextAggregationId);
      }
      setAggregationProgressData(response);
      toast.success("Re-aggregation started.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to trigger re-aggregation.";
      toast.error(message);
    } finally {
      setIsTriggeringAggregation(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Export / Import"
        description="Upload manual import files and monitor processing progress."
      />

      <Tabs defaultValue="import" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid">
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>

        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle>Export</CardTitle>
              <CardDescription>Export tools will be implemented in a later step.</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Manual CSV Import
              </CardTitle>
              <CardDescription>
                Upload multiple CSV files or a ZIP archive, then map each file to a data processor.
              </CardDescription>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <FileArchive className="h-3.5 w-3.5" /> ZIP (auto-inspect)
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Shield className="h-3.5 w-3.5" /> CSRF-protected
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Zap className="h-3.5 w-3.5" /> Live progress
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Database className="h-3.5 w-3.5" /> Up to 1GB
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div
                className={cn(
                  "rounded-lg border border-dashed p-6 transition-colors",
                  isDragActive && "border-primary bg-muted/50"
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragActive(true);
                }}
                onDragLeave={() => setIsDragActive(false)}
                onDrop={onDrop}
              >
                <div className="flex flex-col items-center justify-center gap-3 text-center">
                  <UploadCloud className="h-9 w-9 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Drag & Drop CSV or ZIP files here</p>
                    <p className="text-sm text-muted-foreground">
                      or click below to browse. Multiple CSV files are supported.
                    </p>
                  </div>
                  <div className="w-full max-w-xs">
                    <Input
                      type="file"
                      multiple
                      accept=".csv,.zip"
                      onChange={onFileInputChange}
                    />
                  </div>
                  {isInspectingZip && (
                    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Inspecting ZIP contents...
                    </p>
                  )}
                </div>
              </div>

              <Card className="py-4">
                <CardHeader className="px-4">
                  <CardTitle className="text-base">Selected Files</CardTitle>
                  <CardDescription>
                    Uncheck any file you do not want to import and edit processor keys as needed.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 px-4">
                  {queue.length === 0 ? (
                    <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">No files selected</p>
                      <p>Drop CSV/ZIP files above, or click the upload input to browse.</p>
                    </div>
                  ) : (
                    queue.map((item) => (
                      <div
                        key={item.id}
                        className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[auto_1fr_1fr] sm:items-center"
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={(checked) =>
                              updateQueueItem(item.id, { selected: checked === true })
                            }
                          />
                          <Badge variant="outline">{item.source.toUpperCase()}</Badge>
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.name}</p>
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor={`processor-${item.id}`} className="text-xs">
                            Processor key
                          </Label>
                          <Input
                            id={`processor-${item.id}`}
                            value={item.processorKey}
                            onChange={(event) =>
                              updateQueueItem(item.id, {
                                processorKey: event.target.value,
                              })
                            }
                            placeholder="detail_orders"
                          />
                        </div>
                      </div>
                    ))
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={handleUpload}
                      disabled={selectedItems.length === 0 || isUploading || isInspectingZip}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="me-2 h-4 w-4 animate-spin" /> Uploading...
                        </>
                      ) : (
                        <>
                          <FolderOpen className="me-2 h-4 w-4" /> Upload Selected
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => {
                        setQueue([]);
                        setZipTempId(null);
                      }}
                      disabled={queue.length === 0 || isUploading}
                    >
                      Clear
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {(uploadProgressData || uploadId) && (
                <Card className="py-4">
                  <CardHeader className="px-4">
                    <CardTitle className="text-base">Import Progress</CardTitle>
                    <CardDescription>
                      {uploadId ? `Tracking upload ID: ${uploadId}` : "Latest import request"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4">
                    <Progress value={uploadProgress} />
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline">{uploadProgress.toFixed(0)}%</Badge>
                      {uploadStatus && <Badge variant="secondary">{uploadStatus}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="py-4">
                <CardHeader className="px-4">
                  <CardTitle className="text-base">Trigger Re-aggregation</CardTitle>
                  <CardDescription>
                    Rebuild aggregated datasets for a date range after imports complete.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="start-date">Start date</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="end-date">End date</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Type</Label>
                      <Select
                        value={aggregationType}
                        onValueChange={(value) =>
                          setAggregationType(value as AggregationType)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {AGGREGATION_TYPES.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    onClick={triggerReaggregation}
                    disabled={isTriggeringAggregation}
                    className="w-full sm:w-auto"
                  >
                    {isTriggeringAggregation ? (
                      <>
                        <Loader2 className="me-2 h-4 w-4 animate-spin" /> Starting...
                      </>
                    ) : (
                      <>
                        <Play className="me-2 h-4 w-4" /> Trigger Re-aggregation
                      </>
                    )}
                  </Button>

                  {(aggregationProgressData || aggregationId) && (
                    <div className="space-y-3 rounded-lg border p-3">
                      <Progress value={aggregationProgress} />
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="outline">{aggregationProgress.toFixed(0)}%</Badge>
                        {aggregationStatus && (
                          <Badge variant="secondary">{aggregationStatus}</Badge>
                        )}
                        {aggregationId && (
                          <Badge variant="outline">ID: {aggregationId}</Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
