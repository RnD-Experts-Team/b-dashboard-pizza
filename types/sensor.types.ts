/* ────────────────────────────────────────────────────────────────────────── */
/*  Sensor API Types                                                        */
/*  Mirror and normalize the JSON shapes returned by sensors.pnefoods.com.  */
/* ────────────────────────────────────────────────────────────────────────── */

/* ── Shared ────────────────────────────────────────────────────────────── */

export interface SensorStoreInfo {
  store_number: string;
  store_name: string;
}

export type TemperatureUnit = "C" | "F";

/* ── GET /stores/:id/sensors ───────────────────────────────────────────── */

/** Alarm flags reported by the sensor hardware */
export interface SensorAlarm {
  lowBattery: boolean;
  lowTemp: boolean;
  highTemp: boolean;
  lowHumidity: boolean;
  highHumidity: boolean;
  period: boolean;
  code: number;
}

/** Temperature / humidity limits configured on the sensor */
export interface SensorLimit {
  max: number;
  min: number;
}

/** Real-time state snapshot for a single sensor device */
export interface SensorState {
  alarm: SensorAlarm;
  battery: number;
  batteryType: string;
  humidity: number;
  humidityCorrection: number;
  humidityLimit: SensorLimit;
  interval: number;
  mode: string;
  recordInterval: number;
  screenDuration: number;
  /** "normal" | "alert" */
  state: string;
  tempCorrection: number;
  tempLimit: SensorLimit;
  /** Current temperature reading normalized for the selected display unit */
  temperature: number;
  version: string;
}

export interface SensorDevice {
  device_id: string;
  device_name: string;
  device_type: string;
  model_name: string;
  is_hub: boolean;
  online: boolean;
  temperature?: number | null;
  temperature_unit?: TemperatureUnit | null;
  state: SensorState | null;
  reported_at: string | null;
  success: boolean;
  error: string | null;
}

export interface SensorsResponse {
  success: boolean;
  store: SensorStoreInfo;
  temperature_unit?: TemperatureUnit | null;
  hub: SensorDevice | null;
  sensors: SensorDevice[];
  count: number;
  fetched_at: string;
}

/* ── GET /stores/:id/reports ───────────────────────────────────────────── */

export interface ReportOverall {
  avg_temp: string;
  min_temp: string;
  max_temp: string;
  avg_humidity: string;
  total_readings: number;
  total_alarms: string;
  total_offline: string;
}

export interface ReportTimeBucket {
  time_bucket: string;
  avg_temp: string;
  min_temp: string;
  max_temp: string;
  avg_humidity: string;
  min_humidity: string;
  max_humidity: string;
  reading_count: number;
}

export interface ReportDeviceSummary {
  device_id: string;
  device_name: string;
  avg_temp: string;
  min_temp: string;
  max_temp: string;
  avg_humidity: string;
  min_humidity: string;
  max_humidity: string;
  reading_count: number;
  alarm_count: string;
  offline_count: string;
}

export interface ReportsResponse {
  success: boolean;
  store: SensorStoreInfo;
  period: "daily" | "weekly" | "monthly";
  temperature_unit: string;
  range: { from: string; to: string };
  overall: ReportOverall;
  time_series: ReportTimeBucket[];
  device_summary: ReportDeviceSummary[];
  generated_at: string;
}

/* ── GET /stores/:id/reports/history ───────────────────────────────────── */

export interface HistoryRecord {
  id: number;
  store_id: number;
  store_device_id: number;
  device_id: string;
  device_type: string;
  device_name: string;
  online: boolean;
  temperature: string;
  temperature_unit: string;
  humidity: string;
  battery_level: number;
  alarm: boolean;
  state: string;
  reported_at: string;
  recorded_at: string;
  created_at: string;
  updated_at: string;
}

export interface HistoryPagination {
  current_page: number;
  data: HistoryRecord[];
  first_page_url: string | null;
  from: number | null;
  last_page: number;
  last_page_url: string | null;
  next_page_url: string | null;
  per_page: number;
  prev_page_url: string | null;
  to: number | null;
  total: number;
}

export interface HistoryResponse {
  success: boolean;
  store: SensorStoreInfo;
  temperature_unit: string;
  reports: HistoryPagination;
}

/* ── GET /stores/:id/reports/alerts ────────────────────────────────────── */

export interface AlertRecord {
  device_id: string;
  device_name: string;
  device_type: string;
  temperature: string;
  temperature_unit: string;
  humidity: string;
  state: string;
  recorded_at: string;
}

export interface AlertsResponse {
  success: boolean;
  store: SensorStoreInfo;
  temperature_unit: string;
  range: { from: string; to: string };
  alarms: AlertRecord[];
}

/* ── Query param helpers ───────────────────────────────────────────────── */

export type ReportPeriod = "daily" | "weekly" | "monthly";

export interface ReportsQueryParams {
  period?: ReportPeriod;
  date?: string;
  device_id?: string;
  fields?: string;
}

export interface HistoryQueryParams {
  from?: string;
  to?: string;
  per_page?: number;
  device_type?: string;
  page?: number;
}

export interface AlertsQueryParams {
  from?: string;
  to?: string;
}

/* ── GET /stores/sensors (bulk multi-store) ────────────────────────────── */

export interface MosSensorEntry {
  device_id: string;
  device_name: string;
  device_type: string;
  model_name: string | null;
  is_hub: boolean;
  online: boolean | null;
  temperature: number | null;
  temperature_unit: TemperatureUnit;
  state: Record<string, unknown> | null;
  reported_at: string | null;
  success: boolean;
  error: string | null;
}

export interface MosStoreSensors {
  store: { store_number: string; store_name: string };
  hub: MosSensorEntry | null;
  sensors: MosSensorEntry[];
  count: number;
}

export interface BulkSensorsResponse {
  success: true;
  temperature_unit: TemperatureUnit;
  count: number;
  stores: MosStoreSensors[];
  requested: string[];
  missing: string[];
  fetched_at: string;
}

/* ── Error ─────────────────────────────────────────────────────────────── */

export type SensorErrorCode =
  | "NO_STORE"
  | "NOT_AUTHENTICATED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "UNKNOWN";
