"use client";

import { useMemo, useState, useEffect, useRef, useCallback, DragEvent } from "react";
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
  CheckSquare,
  Square,
  Clock,
  AlertCircle,
  CheckCircle2,
  FileText,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import axios from "axios";
import { dataExportService } from "@/lib/api/services/data-export.service";
import { dsprService } from "@/lib/api/services/dspr.service";
import { manualImportService } from "@/lib/api/services/manual-import.service";
import type { ImportFileResult, ImportProgressResponse } from "@/lib/api/services/manual-import.service";
import { hiringService } from "@/lib/api/services/hiring.service";
import type { EmployeeMetricRecord, EmployeeMetricValue, EmployeeMetricsResponse } from "@/lib/api/services/hiring.service";
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

  const pick = (record: Record<string, unknown>) => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value;
    }
    return null;
  };

  const direct = pick(source);
  if (direct) return direct;

  const progress = asRecord(source.progress);
  if (progress) {
    const progressMatch = pick(progress);
    if (progressMatch) return progressMatch;
  }

  const nested = asRecord(source.data);
  if (nested) {
    const nestedMatch = pick(nested);
    if (nestedMatch) return nestedMatch;

    const nestedProgress = asRecord(nested.progress);
    if (nestedProgress) {
      const nestedProgressMatch = pick(nestedProgress);
      if (nestedProgressMatch) return nestedProgressMatch;
    }
  }

  return null;
}

function extractProgressPercent(payload: unknown): number {
  const source = asRecord(payload);
  if (!source) return 0;

  const nested = asRecord(source.data);
  const progress =
    asRecord(source.progress) || asRecord(nested?.progress) || nested || source;

  const possibleKeys = ["progress", "percentage", "percent", "processed_percent"];
  for (const key of possibleKeys) {
    const value = progress[key] ?? source[key];
    if (typeof value === "number") return Math.max(0, Math.min(100, value));
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, parsed));
    }
  }

  // total_files / processed_files (import) OR total / processed (re-aggregation)
  const totalFiles =
    toNumber(progress.total_files ?? source.total_files) ??
    toNumber(progress.total ?? source.total);
  const processedFiles =
    toNumber(progress.processed_files ?? source.processed_files) ??
    toNumber(progress.processed ?? source.processed);
  if (totalFiles && totalFiles > 0 && processedFiles !== null) {
    return Math.max(0, Math.min(100, (processedFiles / totalFiles) * 100));
  }

  const results = Array.isArray(progress.results) ? progress.results : [];
  if (results.length > 0 && totalFiles && totalFiles > 0) {
    const completedFromResults = results.filter((entry) => {
      const status = asRecord(entry)?.status;
      return typeof status === "string" && ["success", "failed", "error"].includes(status.toLowerCase());
    }).length;

    return Math.max(0, Math.min(100, (completedFromResults / totalFiles) * 100));
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<ImportQueueItem[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isInspectingZip, setIsInspectingZip] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [zipTempId, setZipTempId] = useState<string | null>(null);
  const [processorOptions, setProcessorOptions] = useState<string[]>([]);
  const [isLoadingProcessorOptions, setIsLoadingProcessorOptions] = useState(false);
  const [processorOptionsError, setProcessorOptionsError] = useState<string | null>(null);

  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploadProgressData, setUploadProgressData] = useState<ImportProgressResponse | null>(null);

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

  // ── Employee Metrics state ──
  const metricsFileInputRef = useRef<HTMLInputElement>(null);
  const [metricsFile, setMetricsFile] = useState<File | null>(null);
  const [metricsIdTypeId, setMetricsIdTypeId] = useState<string>("");
  const [isImportingMetrics, setIsImportingMetrics] = useState(false);
  const [metricsImportResult, setMetricsImportResult] = useState<Record<string, unknown> | null>(null);
  const [metricsImportError, setMetricsImportError] = useState<string | null>(null);

  const [metricsFilterEmployeeId, setMetricsFilterEmployeeId] = useState<string>("");
  const [metricsFilterStoreNumber, setMetricsFilterStoreNumber] = useState<string>("");
  const [metricsFilterDateFrom, setMetricsFilterDateFrom] = useState<string>("");
  const [metricsFilterDateTo, setMetricsFilterDateTo] = useState<string>("");
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [metricsData, setMetricsData] = useState<EmployeeMetricsResponse | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricsPage, setMetricsPage] = useState(1);

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
  const uploadTotals = useMemo(() => {
    const source = asRecord(uploadProgressData);
    if (!source) {
      return { processed: null as number | null, total: null as number | null, successCount: 0 };
    }

    const nested = asRecord(source.data);
    const progress =
      asRecord(source.progress) || asRecord(nested?.progress) || nested || source;

    const processed = toNumber(progress.processed_files ?? source.processed_files);
    const total = toNumber(progress.total_files ?? source.total_files);
    const results = asRecordArray(progress.results);
    const successCount = results.filter((item) => {
      const status = item.status;
      return typeof status === "string" && status.toLowerCase() === "success";
    }).length;

    return { processed, total, successCount };
  }, [uploadProgressData]);

  // ── Normalized progress details from the backend response ──
  const normalizedProgress = useMemo(() => {
    if (!uploadProgressData) {
      return {
        status: null as string | null,
        totalFiles: null as number | null,
        processedFiles: null as number | null,
        totalRows: null as number | null,
        currentFile: null as string | null,
        results: [] as ImportFileResult[],
        successCount: 0,
        failedCount: 0,
        pendingCount: 0,
        avgDuration: null as number | null,
      };
    }

    const source = uploadProgressData as Record<string, unknown>;
    const nested = asRecord(source.data);
    const progress =
      asRecord(source.progress) || asRecord(nested?.progress) || nested || source;

    const status =
      extractStringValue(uploadProgressData, ["status", "state", "phase"])?.toLowerCase() ?? null;
    const totalFiles = toNumber(progress.total_files ?? source.total_files);
    const processedFiles = toNumber(progress.processed_files ?? source.processed_files);
    const totalRows = toNumber(progress.total_rows ?? source.total_rows);
    const currentFile =
      (typeof progress.current_file === "string" ? progress.current_file : null) ??
      (typeof source.current_file === "string" ? source.current_file : null);

    const rawResults = Array.isArray(progress.results)
      ? progress.results
      : Array.isArray(source.results)
        ? source.results
        : [];

    const results: ImportFileResult[] = rawResults.flatMap((entry) => {
        const rec = asRecord(entry);
        if (!rec) return [];
        return [{
          file: String(rec.file ?? rec.filename ?? rec.name ?? "unknown"),
          status: String(rec.status ?? "pending"),
          rows: toNumber(rec.rows) ?? undefined,
          dates: Array.isArray(rec.dates) ? rec.dates.filter((d): d is string => typeof d === "string") : undefined,
          duration: toNumber(rec.duration) ?? undefined,
          error: typeof rec.error === "string" ? rec.error : undefined,
        }];
      });

    const successCount = results.filter((r) => r.status === "success").length;
    const failedCount = results.filter((r) => ["failed", "error"].includes(r.status)).length;
    const pendingCount = results.length > 0 ? results.length - successCount - failedCount : 0;
    const durationsArr = results.map((r) => r.duration).filter((d): d is number => d !== undefined);
    const avgDuration = durationsArr.length > 0
      ? durationsArr.reduce((a, b) => a + b, 0) / durationsArr.length
      : null;

    return {
      status,
      totalFiles,
      processedFiles,
      totalRows,
      currentFile,
      results,
      successCount,
      failedCount,
      pendingCount,
      avgDuration,
    };
  }, [uploadProgressData]);

  // ── Select all / Deselect all helpers ──
  const allSelected = queue.length > 0 && queue.every((item) => item.selected);
  const noneSelected = queue.length === 0 || queue.every((item) => !item.selected);

  const toggleSelectAll = useCallback(() => {
    const target = !allSelected;
    setQueue((prev) => prev.map((item) => ({ ...item, selected: target })));
  }, [allSelected]);

  const clearQueueAndInput = useCallback(() => {
    setQueue([]);
    setZipTempId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

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

  const normalizedAggregationProgress = useMemo(() => {
    if (!aggregationProgressData) return null;
    const source = aggregationProgressData as Record<string, unknown>;
    const progress = asRecord(source.progress) ?? source;
    return {
      status: typeof progress.status === "string" ? progress.status : null,
      type: typeof progress.type === "string" ? progress.type : null,
      updatedAt: typeof progress.updated_at === "string" ? progress.updated_at : null,
      total: toNumber(progress.total) ?? toNumber(progress.total_files),
      processed: toNumber(progress.processed) ?? toNumber(progress.processed_files),
      successful: toNumber(progress.successful),
      failed: toNumber(progress.failed),
    };
  }, [aggregationProgressData]);

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
          clearQueueAndInput();
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
      setUploadProgressData(uploadResponse as ImportProgressResponse);
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

  const handleImportEmployeeMetrics = async () => {
    if (!metricsFile) {
      toast.error("Please select a CSV file to import.");
      return;
    }
    try {
      setIsImportingMetrics(true);
      setMetricsImportError(null);
      setMetricsImportResult(null);
      const idTypeId = metricsIdTypeId.trim() ? Number(metricsIdTypeId.trim()) : undefined;
      const result = await hiringService.importEmployeeMetrics(metricsFile, idTypeId);
      setMetricsImportResult(result);
      toast.success("Employee metrics import completed.");
    } catch (error) {
      if (axios.isCancel(error)) return;
      const message = error instanceof Error ? error.message : "Failed to import employee metrics.";
      setMetricsImportError(message);
      toast.error(message);
    } finally {
      setIsImportingMetrics(false);
    }
  };

  const handleLoadEmployeeMetrics = async (page = 1) => {
    try {
      setIsLoadingMetrics(true);
      setMetricsError(null);
      const result = await hiringService.getEmployeeMetrics({
        employee_id: metricsFilterEmployeeId.trim() ? Number(metricsFilterEmployeeId.trim()) : undefined,
        store_number: metricsFilterStoreNumber.trim() || undefined,
        date_from: metricsFilterDateFrom || undefined,
        date_to: metricsFilterDateTo || undefined,
        page,
      });
      setMetricsData(result);
      setMetricsPage(page);
    } catch (error) {
      if (axios.isCancel(error)) return;
      const message = error instanceof Error ? error.message : "Failed to load employee metrics.";
      setMetricsError(message);
      toast.error(message);
    } finally {
      setIsLoadingMetrics(false);
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
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="employee-metrics">Employee Metrics</TabsTrigger>
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
                      ref={fileInputRef}
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

                  {/* Select All / Deselect All controls */}
                  {queue.length > 0 && (
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={() => toggleSelectAll()}
                        aria-label={allSelected ? "Deselect all files" : "Select all files"}
                      />
                      <button
                        type="button"
                        className="text-sm font-medium hover:underline"
                        onClick={toggleSelectAll}
                        disabled={isUploading}
                      >
                        {allSelected ? "Deselect All" : "Select All"}
                      </button>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {selectedItems.length} of {queue.length} selected
                      </span>
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
                      onClick={clearQueueAndInput}
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
                  <CardContent className="space-y-4 px-4">
                    <Progress value={uploadProgress} />

                    {/* Summary badges */}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline">{uploadProgress.toFixed(0)}%</Badge>
                      {uploadStatus && <Badge variant="secondary">{uploadStatus}</Badge>}
                      {uploadTotals.processed !== null && uploadTotals.total !== null && (
                        <Badge variant="outline">
                          {uploadTotals.processed}/{uploadTotals.total} files
                        </Badge>
                      )}
                      {normalizedProgress.totalRows !== null && (
                        <Badge variant="outline">
                          {numberFormatter.format(normalizedProgress.totalRows)} total rows
                        </Badge>
                      )}
                      {normalizedProgress.successCount > 0 && (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle2 className="me-1 h-3 w-3" />
                          {normalizedProgress.successCount} success
                        </Badge>
                      )}
                      {normalizedProgress.failedCount > 0 && (
                        <Badge variant="destructive">
                          <AlertCircle className="me-1 h-3 w-3" />
                          {normalizedProgress.failedCount} failed
                        </Badge>
                      )}
                      {normalizedProgress.pendingCount > 0 && (
                        <Badge variant="outline">
                          <Clock className="me-1 h-3 w-3" />
                          {normalizedProgress.pendingCount} pending
                        </Badge>
                      )}
                      {normalizedProgress.avgDuration !== null && (
                        <Badge variant="outline">
                          <Timer className="me-1 h-3 w-3" />
                          avg {normalizedProgress.avgDuration.toFixed(2)}s
                        </Badge>
                      )}
                    </div>

                    {/* Current file being processed — only while polling is active */}
                    {normalizedProgress.currentFile && uploadId && (
                      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        <span className="text-muted-foreground">Processing:</span>
                        <span className="truncate font-medium">{normalizedProgress.currentFile}</span>
                      </div>
                    )}

                    {/* Per-file results table */}
                    {normalizedProgress.results.length > 0 && (
                      <div className="space-y-2">
                        <p className="flex items-center gap-1.5 text-sm font-medium">
                          <FileText className="h-4 w-4" />
                          File Details
                        </p>
                        <div className="max-h-72 overflow-auto rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>File</TableHead>
                                <TableHead className="w-24">Status</TableHead>
                                <TableHead className="w-20 text-right">Rows</TableHead>
                                <TableHead className="w-28">Date(s)</TableHead>
                                <TableHead className="w-24 text-right">Duration</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {normalizedProgress.results.map((result, idx) => (
                                <TableRow key={`${result.file}-${idx}`}>
                                  <TableCell className="max-w-50 truncate text-sm font-medium">
                                    {result.file}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        result.status === "success"
                                          ? "secondary"
                                          : result.status === "failed" || result.status === "error"
                                            ? "destructive"
                                            : "outline"
                                      }
                                      className={cn(
                                        "text-xs",
                                        result.status === "success" &&
                                          "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                      )}
                                    >
                                      {result.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {result.rows !== undefined ? numberFormatter.format(result.rows) : "—"}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {result.dates && result.dates.length > 0
                                      ? result.dates.join(", ")
                                      : "—"}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {result.duration !== undefined ? `${result.duration.toFixed(2)}s` : "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
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
                    <div className="space-y-4 rounded-lg border p-4">
                      <Progress value={aggregationProgress} />

                      {/* Summary badges */}
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="outline">{aggregationProgress.toFixed(0)}%</Badge>
                        {normalizedAggregationProgress?.status && (
                          <Badge
                            variant="secondary"
                            className={cn(
                              normalizedAggregationProgress.status === "completed" &&
                                "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                              ["failed", "error"].includes(normalizedAggregationProgress.status) &&
                                "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            )}
                          >
                            {normalizedAggregationProgress.status === "completed" && (
                              <CheckCircle2 className="me-1 h-3 w-3" />
                            )}
                            {normalizedAggregationProgress.status}
                          </Badge>
                        )}
                        {normalizedAggregationProgress?.type && (
                          <Badge variant="outline">{normalizedAggregationProgress.type}</Badge>
                        )}
                        {aggregationId && (
                          <Badge variant="outline">ID: {aggregationId}</Badge>
                        )}
                      </div>

                      {/* Detail grid */}
                      {normalizedAggregationProgress && (
                        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                          {normalizedAggregationProgress.total !== null && (
                            <div className="rounded-lg border bg-muted/30 px-3 py-2">
                              <p className="text-xs text-muted-foreground">Total</p>
                              <p className="font-semibold tabular-nums">
                                {numberFormatter.format(normalizedAggregationProgress.total!)}
                              </p>
                            </div>
                          )}
                          {normalizedAggregationProgress.processed !== null && (
                            <div className="rounded-lg border bg-muted/30 px-3 py-2">
                              <p className="text-xs text-muted-foreground">Processed</p>
                              <p className="font-semibold tabular-nums">
                                {numberFormatter.format(normalizedAggregationProgress.processed!)}
                              </p>
                            </div>
                          )}
                          {normalizedAggregationProgress.successful !== null && (
                            <div className="rounded-lg border bg-green-50 px-3 py-2 dark:bg-green-900/10">
                              <p className="text-xs text-muted-foreground">Successful</p>
                              <p className="font-semibold tabular-nums text-green-700 dark:text-green-400">
                                {numberFormatter.format(normalizedAggregationProgress.successful!)}
                              </p>
                            </div>
                          )}
                          {normalizedAggregationProgress.failed !== null && (
                            <div className={cn(
                              "rounded-lg border px-3 py-2",
                              normalizedAggregationProgress.failed! > 0
                                ? "bg-red-50 dark:bg-red-900/10"
                                : "bg-muted/30"
                            )}>
                              <p className="text-xs text-muted-foreground">Failed</p>
                              <p className={cn(
                                "font-semibold tabular-nums",
                                normalizedAggregationProgress.failed! > 0 && "text-red-600 dark:text-red-400"
                              )}>
                                {numberFormatter.format(normalizedAggregationProgress.failed!)}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Updated at timestamp */}
                      {normalizedAggregationProgress?.updatedAt && (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          Last updated: {new Date(normalizedAggregationProgress.updatedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Employee Metrics Tab ── */}
        <TabsContent value="employee-metrics" className="space-y-4">
          {/* Import Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UploadCloud className="h-5 w-5" />
                Import Employee Metrics CSV
              </CardTitle>
              <CardDescription>
                Imports CSV metrics, matches employees by ID type, upserts per employee/date, and returns unmatched IDs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="metrics-file">CSV File *</Label>
                  <Input
                    ref={metricsFileInputRef}
                    id="metrics-file"
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setMetricsFile(file);
                      setMetricsImportResult(null);
                      setMetricsImportError(null);
                    }}
                  />
                  {metricsFile && (
                    <p className="text-xs text-muted-foreground">{metricsFile.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metrics-id-type">
                    ID Type ID
                    <span className="ml-1 text-xs text-muted-foreground">(defaults to 1)</span>
                  </Label>
                  <Input
                    id="metrics-id-type"
                    type="number"
                    min={1}
                    placeholder="e.g. 1"
                    value={metricsIdTypeId}
                    onChange={(e) => setMetricsIdTypeId(e.target.value)}
                  />
                </div>
              </div>

              <Button
                onClick={handleImportEmployeeMetrics}
                disabled={!metricsFile || isImportingMetrics}
                className="w-full sm:w-auto"
              >
                {isImportingMetrics ? (
                  <><Loader2 className="me-2 h-4 w-4 animate-spin" /> Importing...</>
                ) : (
                  <><UploadCloud className="me-2 h-4 w-4" /> Import CSV</>
                )}
              </Button>

              {metricsImportError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {metricsImportError}
                </div>
              )}

              {metricsImportResult && (
                <div className="space-y-2 rounded-lg border p-4">
                  <p className="text-sm font-medium">Import Result</p>
                  <div className="flex flex-wrap gap-2">
                    {typeof metricsImportResult.imported === "number" && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle2 className="me-1 h-3 w-3" />
                        {metricsImportResult.imported as number} imported
                      </Badge>
                    )}
                    {typeof metricsImportResult.updated === "number" && (
                      <Badge variant="secondary">
                        {metricsImportResult.updated as number} updated
                      </Badge>
                    )}
                  </div>
                  {Array.isArray(metricsImportResult.unmatched_ids) &&
                    (metricsImportResult.unmatched_ids as unknown[]).length > 0 && (
                      <div className="space-y-1">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                          <AlertCircle className="h-4 w-4" />
                          Unmatched IDs
                        </p>
                        <div className="max-h-40 overflow-auto rounded-lg border bg-muted/30 p-2">
                          <div className="flex flex-wrap gap-1">
                            {(metricsImportResult.unmatched_ids as unknown[]).map((id, i) => (
                              <Badge key={i} variant="outline" className="font-mono text-xs">
                                {String(id)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  {typeof metricsImportResult.message === "string" && (
                    <p className="text-sm text-muted-foreground">{metricsImportResult.message}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* List / Filter Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                List Employee Metrics
              </CardTitle>
              <CardDescription>
                Global listing with filtering by employee, store, date, and column values.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="metrics-filter-employee">Employee ID</Label>
                  <Input
                    id="metrics-filter-employee"
                    type="number"
                    min={1}
                    placeholder="Any"
                    value={metricsFilterEmployeeId}
                    onChange={(e) => setMetricsFilterEmployeeId(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="metrics-filter-store">Store Number</Label>
                  <Input
                    id="metrics-filter-store"
                    placeholder="Any"
                    value={metricsFilterStoreNumber}
                    onChange={(e) => setMetricsFilterStoreNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="metrics-filter-from">Date From</Label>
                  <Input
                    id="metrics-filter-from"
                    type="date"
                    value={metricsFilterDateFrom}
                    onChange={(e) => setMetricsFilterDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="metrics-filter-to">Date To</Label>
                  <Input
                    id="metrics-filter-to"
                    type="date"
                    value={metricsFilterDateTo}
                    onChange={(e) => setMetricsFilterDateTo(e.target.value)}
                  />
                </div>
              </div>

              <Button
                onClick={() => handleLoadEmployeeMetrics(1)}
                disabled={isLoadingMetrics}
                className="w-full sm:w-auto"
              >
                {isLoadingMetrics ? (
                  <><Loader2 className="me-2 h-4 w-4 animate-spin" /> Loading...</>
                ) : (
                  "Load Metrics"
                )}
              </Button>

              {metricsError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {metricsError}
                </div>
              )}

              {metricsData && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline">
                      Page {metricsData.current_page} / {metricsData.last_page}
                    </Badge>
                    <Badge variant="outline">
                      {numberFormatter.format(metricsData.total)} total
                    </Badge>
                  </div>

                  {metricsData.data.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No records found.</p>
                  ) : (
                    <div className="overflow-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">ID</TableHead>
                            <TableHead className="w-24">Employee</TableHead>
                            <TableHead className="w-28">Date</TableHead>
                            <TableHead className="w-28">Store</TableHead>
                            <TableHead>Metrics</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {metricsData.data.map((row: EmployeeMetricRecord) => (
                            <TableRow key={row.id}>
                              <TableCell className="tabular-nums">{row.id}</TableCell>
                              <TableCell className="tabular-nums">{row.employee_id}</TableCell>
                              <TableCell>{row.metric_date}</TableCell>
                              <TableCell>{row.store_number ?? "—"}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(row.values).map(([key, val]: [string, EmployeeMetricValue]) => (
                                    <span
                                      key={key}
                                      className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs"
                                      title={key}
                                    >
                                      <span className="font-medium text-muted-foreground">
                                        {val.label || key}:
                                      </span>
                                      <span>
                                        {val.value_numeric !== null
                                          ? numberFormatter.format(val.value_numeric)
                                          : val.value || "—"}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Pagination */}
                  {metricsData.last_page > 1 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={metricsPage <= 1 || isLoadingMetrics}
                        onClick={() => handleLoadEmployeeMetrics(metricsPage - 1)}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {metricsPage} / {metricsData.last_page}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={metricsPage >= metricsData.last_page || isLoadingMetrics}
                        onClick={() => handleLoadEmployeeMetrics(metricsPage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
