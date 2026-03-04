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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  FileJson,
  UploadCloud,
  Shield,
  Zap,
  Database,
  FolderOpen,
  Loader2,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import axios from "axios";
import { dataExportService } from "@/lib/api/services/data-export.service";
import { dsprService } from "@/lib/api/services/dspr.service";
import { manualImportService } from "@/lib/api/services/manual-import.service";
import type { DsprResponse } from "@/types/dspr.types";

const EXPORT_MODELS = [
  "detail_orders",
  "order_line",
  "summary_sales",
  "summary_items",
  "summary_transactions",
  "waste",
  "cash_management",
  "financial_views",
  "alta_inventory_waste",
  "alta_inventory_ingredient_usage",
  "alta_inventory_ingredient_orders",
  "alta_inventory_cogs",
  "yearly_store_summary",
  "yearly_item_summary",
  "weekly_store_summary",
  "weekly_item_summary",
  "quarterly_store_summary",
  "quarterly_item_summary",
  "monthly_store_summary",
  "monthly_item_summary",
  "daily_store_summary",
  "daily_item_summary",
  "hourly_store_summary",
  "hourly_item_summary",
  "all",
];

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

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function formatProcessorLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getDefaultProcessorKey(fileName: string, availableProcessorKeys: string[]) {
  if (availableProcessorKeys.length === 0) return toProcessorKey(fileName);
  const inferred = toProcessorKey(fileName);
  if (availableProcessorKeys.includes(inferred)) return inferred;
  return availableProcessorKeys[0];
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => !!entry);
}

function toSortedEntries(value: unknown): Array<[string, unknown]> {
  const record = asRecord(value);
  if (!record) return [];
  return Object.entries(record).sort(([a], [b]) => a.localeCompare(b));
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatMetric(
  value: unknown,
  variant: "currency" | "number" | "percent" = "number"
) {
  const numericValue = toNumber(value);
  if (numericValue === null) return "—";

  if (variant === "currency") return currencyFormatter.format(numericValue);
  if (variant === "percent") return `${numberFormatter.format(numericValue)}%`;
  return numberFormatter.format(numericValue);
}

function formatText(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const numericValue = toNumber(value);
  if (numericValue !== null) return numberFormatter.format(numericValue);
  return String(value);
}

function isValidDateOnly(value: string) {
  if (!DATE_ONLY_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().startsWith(value);
}

export default function ExportImportPage() {
  const [queue, setQueue] = useState<ImportQueueItem[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isInspectingZip, setIsInspectingZip] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [zipTempId, setZipTempId] = useState<string | null>(null);
  const [processorOptions, setProcessorOptions] = useState<string[]>([]);
  const [isLoadingProcessorOptions, setIsLoadingProcessorOptions] = useState(false);
  const [processorOptionsError, setProcessorOptionsError] = useState<string | null>(null);

  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploadProgressData, setUploadProgressData] = useState<Record<string, unknown> | null>(null);

  const [aggregationId, setAggregationId] = useState<string | null>(null);
  const [aggregationProgressData, setAggregationProgressData] = useState<Record<string, unknown> | null>(null);

  const [startDate, setStartDate] = useState(normalizeDate(new Date()));
  const [endDate, setEndDate] = useState(normalizeDate(new Date()));
  const [aggregationType, setAggregationType] = useState<AggregationType>("hourly");
  const [isTriggeringAggregation, setIsTriggeringAggregation] = useState(false);

  // Export specific state
  const [exportModel, setExportModel] = useState<string>("detail_orders");
  const [exportStore, setExportStore] = useState<string>("");
  const [exportStartDate, setExportStartDate] = useState(normalizeDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
  const [exportEndDate, setExportEndDate] = useState(normalizeDate(new Date()));
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);

  const [dsprStore, setDsprStore] = useState<string>("");
  const [dsprDate, setDsprDate] = useState(normalizeDate(new Date()));
  const [isLoadingDspr, setIsLoadingDspr] = useState(false);
  const [dsprError, setDsprError] = useState<string | null>(null);
  const [dsprData, setDsprData] = useState<DsprResponse | null>(null);

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

  const dsprDay = useMemo(() => asRecord(dsprData?.day), [dsprData]);
  const dsprSales = useMemo(() => asRecord(dsprData?.sales), [dsprData]);
  const dsprTop = useMemo(() => asRecord(dsprData?.top), [dsprData]);

  const dsprTopItems = useMemo(
    () => asRecordArray(dsprTop?.top_5_items_sales_for_day),
    [dsprTop]
  );

  const dsprTopIngredients = useMemo(() => {
    const direct = asRecordArray(dsprTop?.top_3_ingredients_used);
    if (direct.length > 0) return direct;

    const ingredientsSection = asRecord(dsprTop?.ingredients);
    return asRecordArray(ingredientsSection?.top_3_ingredients_used);
  }, [dsprTop]);

  const dsprHourlyRows = useMemo(
    () => asRecordArray(dsprDay?.hourly_sales_and_channels),
    [dsprDay]
  );

  const dsprSalesSeries = useMemo(
    () => [
      {
        title: "This Week by Day",
        entries: toSortedEntries(dsprSales?.this_week_by_day),
      },
      {
        title: "Previous Week by Day",
        entries: toSortedEntries(dsprSales?.previous_week_by_day),
      },
      {
        title: "Same Week Last Year",
        entries: toSortedEntries(dsprSales?.same_week_last_year_by_day),
      },
    ],
    [dsprSales]
  );

  const dsprKpis = useMemo(
    () => [
      {
        label: "Total Gross Sales",
        value: formatMetric(dsprDay?.total_gross_sales, "currency"),
      },
      {
        label: "Total Net Sales",
        value: formatMetric(dsprDay?.total_net_sales, "currency"),
      },
      {
        label: "Total Royalty Obligation",
        value: formatMetric(dsprDay?.total_royalty_obligation, "currency"),
      },
      {
        label: "Total Digital Sales",
        value: formatMetric(dsprDay?.total_digital_sales, "currency"),
      },
      {
        label: "Total Cash Sales",
        value: formatMetric(dsprDay?.total_cash_sales, "currency"),
      },
      {
        label: "Customer Count",
        value: formatMetric(dsprDay?.customer_count, "number"),
      },
      {
        label: "Total Tips",
        value: formatMetric(dsprDay?.total_tips, "currency"),
      },
      {
        label: "Labor",
        value: formatMetric(dsprDay?.labor, "currency"),
      },
      {
        label: "Total Deposit",
        value: formatMetric(dsprDay?.total_deposit, "currency"),
      },
      {
        label: "Over / Short",
        value: formatMetric(dsprDay?.over_short, "currency"),
      },
      {
        label: "HNR Promise Met %",
        value: formatMetric(asRecord(dsprDay?.hnr)?.hnr_promise_met_percent, "percent"),
      },
      {
        label: "Portal On-time %",
        value: formatMetric(asRecord(dsprDay?.portal)?.in_portal_on_time_percent, "percent"),
      },
    ],
    [dsprDay]
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

  useEffect(() => {
    let active = true;

    const loadProcessorOptions = async () => {
      try {
        setIsLoadingProcessorOptions(true);
        setProcessorOptionsError(null);

        const response = await manualImportService.getProcessors();
        if (!active) return;

        setProcessorOptions(response);
        if (response.length === 0) {
          setProcessorOptionsError(
            "No processor keys were returned by the manual import endpoint."
          );
        }
      } catch (error) {
        if (!active) return;

        const message =
          error instanceof Error ? error.message : "Failed to load processor keys.";
        setProcessorOptions([]);
        setProcessorOptionsError(message);
        toast.error(message);
      } finally {
        if (active) setIsLoadingProcessorOptions(false);
      }
    };

    loadProcessorOptions();

    return () => {
      active = false;
    };
  }, []);

  const processorOptionsSet = useMemo(() => new Set(processorOptions), [processorOptions]);

  useEffect(() => {
    if (processorOptions.length === 0) return;

    setQueue((prev) =>
      prev.map((item) => {
        if (processorOptionsSet.has(item.processorKey)) return item;
        return {
          ...item,
          processorKey: getDefaultProcessorKey(item.name, processorOptions),
        };
      })
    );
  }, [processorOptions, processorOptionsSet]);

  const selectedItems = useMemo(() => queue.filter((item) => item.selected), [queue]);

  const setQueueFromFiles = async (files: File[]) => {
    const zipFile = files.find(isZipFile) ?? null;
    const csvFiles = files.filter(isCsvFile);

    const csvQueueItems: ImportQueueItem[] = csvFiles.map((file) => ({
      id: `csv:${file.name}`,
      name: file.name,
      source: "csv",
      selected: true,
      processorKey: getDefaultProcessorKey(file.name, processorOptions),
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
          processorKey: getDefaultProcessorKey(name, processorOptions),
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

    if (processorOptions.length === 0) {
      toast.error("Processor keys are unavailable. Please refresh and try again.");
      return;
    }

    const mappings: Record<string, string> = {};
    for (const item of selectedItems) {
      const key = item.processorKey.trim();
      if (!key || !processorOptionsSet.has(key)) {
        toast.error(`Select a valid processor key for ${item.name}.`);
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

  const handleExport = async (format: "csv" | "json") => {
    if (!exportModel) {
      toast.error("Please select a model to export.");
      return;
    }

    try {
      if (format === "csv") setIsExportingCsv(true);
      else setIsExportingJson(true);
      
      toast.info(`Preparing ${format.toUpperCase()} export. This might take a moment...`);
      
      const payload = {
        model: exportModel,
        start: exportStartDate || undefined,
        end: exportEndDate || undefined,
        store: exportStore || undefined,
      };

      const { data, filename } = format === "csv" 
        ? await dataExportService.exportCsv(payload)
        : await dataExportService.exportJson(payload);

      const url = window.URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`${format.toUpperCase()} Export remote successful.`);
    } catch (error) {
      if (axios.isCancel(error)) {
        return;
      }
      const message =
        error instanceof Error ? error.message : "Failed to export data.";
      toast.error(message);
    } finally {
      if (format === "csv") setIsExportingCsv(false);
      else setIsExportingJson(false);
    }
  };

  const handleLoadDsprLite = async () => {
    const normalizedStore = dsprStore.trim();

    if (!normalizedStore) {
      const message = "Store is required for the DSPR Lite report.";
      setDsprError(message);
      toast.error(message);
      return;
    }

    if (!isValidDateOnly(dsprDate)) {
      const message = "Date must be a valid YYYY-MM-DD value.";
      setDsprError(message);
      toast.error(message);
      return;
    }

    try {
      setIsLoadingDspr(true);
      setDsprError(null);

      const response = await dsprService.getReport(normalizedStore, dsprDate);
      setDsprData(response);
      toast.success("DSPR Lite report loaded.");
    } catch (error) {
      if (axios.isCancel(error)) return;

      const message =
        error instanceof Error
          ? error.message
          : "Failed to load DSPR Lite report.";
      setDsprError(message);
      toast.error(message);
    } finally {
      setIsLoadingDspr(false);
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

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileArchive className="h-5 w-5" />
                Data Export
              </CardTitle>
              <CardDescription>
                Download a specific data model as a CSV or JSON file.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="export-start-date">Start Date</Label>
                  <Input
                    id="export-start-date"
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="export-end-date">End Date</Label>
                  <Input
                    id="export-end-date"
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="export-store">Store (Optional)</Label>
                  <Input
                    id="export-store"
                    type="text"
                    placeholder="e.g. store_123"
                    value={exportStore}
                    onChange={(e) => setExportStore(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="export-model">Model *</Label>
                  <Select
                    value={exportModel}
                    onValueChange={(value) => setExportModel(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent className="max-h-75">
                      {EXPORT_MODELS.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button
                  onClick={() => handleExport("csv")}
                  disabled={isExportingCsv || isExportingJson || !exportModel}
                  className="w-full sm:w-auto"
                >
                  {isExportingCsv ? (
                    <>
                      <Loader2 className="me-2 h-4 w-4 animate-spin" /> Gathering...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="me-2 h-4 w-4" /> Export CSV
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleExport("json")}
                  disabled={isExportingCsv || isExportingJson || !exportModel}
                  className="w-full sm:w-auto"
                >
                  {isExportingJson ? (
                    <>
                      <Loader2 className="me-2 h-4 w-4 animate-spin" /> Gathering...
                    </>
                  ) : (
                    <>
                      <FileJson className="me-2 h-4 w-4" /> Export JSON
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                DSPR Lite report
              </CardTitle>
              <CardDescription>
                Fetch daily store performance data by store and date from
                the DSPR report endpoint.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="dspr-store">Store *</Label>
                  <Input
                    id="dspr-store"
                    placeholder="Enter store id"
                    value={dsprStore}
                    onChange={(event) => setDsprStore(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dspr-date">Date *</Label>
                  <Input
                    id="dspr-date"
                    type="date"
                    value={dsprDate}
                    onChange={(event) => setDsprDate(event.target.value)}
                  />
                </div>

                <Button
                  onClick={handleLoadDsprLite}
                  disabled={isLoadingDspr}
                  className="w-full md:w-auto"
                >
                  {isLoadingDspr ? (
                    <>
                      <Loader2 className="me-2 h-4 w-4 animate-spin" /> Loading...
                    </>
                  ) : (
                    "Load Report"
                  )}
                </Button>
              </div>

              {dsprError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {dsprError}
                </div>
              )}

              {dsprData && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Store</p>
                      <p className="text-sm font-medium">{formatText(dsprData.filtering?.store)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="text-sm font-medium">{formatText(dsprData.filtering?.date)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">ISO Week</p>
                      <p className="text-sm font-medium">{formatText(dsprData.filtering?.iso_week)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Week Start</p>
                      <p className="text-sm font-medium">{formatText(dsprData.filtering?.week_start)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Week End</p>
                      <p className="text-sm font-medium">{formatText(dsprData.filtering?.week_end)}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {dsprKpis.map((metric) => (
                      <div key={metric.label} className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">{metric.label}</p>
                        <p className="text-base font-semibold">{metric.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-3">
                    {dsprSalesSeries.map((series) => (
                      <div key={series.title} className="rounded-lg border p-3">
                        <p className="mb-2 text-sm font-medium">{series.title}</p>

                        {series.entries.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No sales data available.</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Day</TableHead>
                                <TableHead className="text-right">Sales</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {series.entries.map(([day, value]) => (
                                <TableRow key={`${series.title}-${day}`}>
                                  <TableCell>{day}</TableCell>
                                  <TableCell className="text-right">
                                    {formatMetric(value, "currency")}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <p className="mb-2 text-sm font-medium">Top 5 Items Sales for Day</p>

                      {dsprTopItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No top items data available.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item</TableHead>
                              <TableHead className="text-right">Gross Sales</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead className="text-right">Avg Price</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dsprTopItems.map((item, index) => (
                              <TableRow key={`top-item-${index}`}>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span>{formatText(item.menu_item_name)}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatText(item.menu_item_account)}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatMetric(item.gross_sales, "currency")}
                                </TableCell>
                                <TableCell className="text-right">{formatText(item.quantity_sold)}</TableCell>
                                <TableCell className="text-right">
                                  {formatMetric(item.avg_item_price, "currency")}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>

                    <div className="rounded-lg border p-3">
                      <p className="mb-2 text-sm font-medium">Top 3 Ingredients Used</p>

                      {dsprTopIngredients.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No ingredients data available.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Ingredient</TableHead>
                              <TableHead className="text-right">Actual Usage</TableHead>
                              <TableHead className="text-right">Variance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dsprTopIngredients.map((ingredient, index) => (
                              <TableRow key={`top-ingredient-${index}`}>
                                <TableCell>{formatText(ingredient.ingredient_description)}</TableCell>
                                <TableCell className="text-right">
                                  {formatMetric(ingredient.actual_usage, "number")}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatMetric(ingredient.variance_value, "number")}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border p-3">
                    <p className="mb-2 text-sm font-medium">Hourly Sales and Channels</p>

                    {dsprHourlyRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hourly channel data available.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Hour</TableHead>
                            <TableHead className="text-right">Royalty</TableHead>
                            <TableHead className="text-right">Phone</TableHead>
                            <TableHead className="text-right">Call Center</TableHead>
                            <TableHead className="text-right">Drive Thru</TableHead>
                            <TableHead className="text-right">Website</TableHead>
                            <TableHead className="text-right">Mobile</TableHead>
                            <TableHead className="text-right">DoorDash</TableHead>
                            <TableHead className="text-right">UberEats</TableHead>
                            <TableHead className="text-right">GrubHub</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dsprHourlyRows.map((row, index) => (
                            <TableRow key={`hourly-${index}`}>
                              <TableCell>{formatText(row.hour)}</TableCell>
                              <TableCell className="text-right">{formatMetric(row.royalty_obligation, "currency")}</TableCell>
                              <TableCell className="text-right">{formatMetric(row.phone_sales, "currency")}</TableCell>
                              <TableCell className="text-right">{formatMetric(row.call_center_sales, "currency")}</TableCell>
                              <TableCell className="text-right">{formatMetric(row.drive_thru_sales, "currency")}</TableCell>
                              <TableCell className="text-right">{formatMetric(row.website_sales, "currency")}</TableCell>
                              <TableCell className="text-right">{formatMetric(row.mobile_sales, "currency")}</TableCell>
                              <TableCell className="text-right">{formatMetric(row.doordash_sales, "currency")}</TableCell>
                              <TableCell className="text-right">{formatMetric(row.ubereats_sales, "currency")}</TableCell>
                              <TableCell className="text-right">{formatMetric(row.grubhub_sales, "currency")}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card> */}
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
                    Uncheck any file you do not want to import and select processor keys.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 px-4">
                  {processorOptionsError && (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                      {processorOptionsError}
                    </div>
                  )}
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
                          <Select
                            value={
                              processorOptionsSet.has(item.processorKey)
                                ? item.processorKey
                                : ""
                            }
                            onValueChange={(value) =>
                              updateQueueItem(item.id, {
                                processorKey: value,
                              })
                            }
                            disabled={
                              isLoadingProcessorOptions || processorOptions.length === 0
                            }
                          >
                            <SelectTrigger id={`processor-${item.id}`}>
                              <SelectValue
                                placeholder={
                                  isLoadingProcessorOptions
                                    ? "Loading processor keys..."
                                    : "Select processor key"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent className="max-h-75">
                              {processorOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {formatProcessorLabel(option)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={handleUpload}
                      disabled={
                        selectedItems.length === 0 ||
                        isUploading ||
                        isInspectingZip ||
                        isLoadingProcessorOptions ||
                        processorOptions.length === 0
                      }
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
