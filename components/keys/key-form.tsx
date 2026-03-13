"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/lib/auth/auth.store";
import { useRoles } from "@/lib/hooks/use-roles";
import { useTagsList } from "@/lib/hooks/use-tags";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ChevronsUpDown, Loader2, Plus, Trash2, X } from "lucide-react";
import type {
  KeyDataType,
  FillMode,
  FrequencyType,
  WeekOfMonth,
  StoreRulePayload,
  CreateKeyPayload,
} from "@/types/key.types";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Constants                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

// Defined outside the component so the reference is stable across renders
// and does not trigger the infinite-loop in useRoles' useEffect.
const ROLES_FETCH_PARAMS = { perPage: 100 };

const DATA_TYPES: { value: KeyDataType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "decimal", label: "Decimal" },
  { value: "boolean", label: "Boolean" },
  { value: "json", label: "JSON" },
];

const FILL_MODES: { value: FillMode; label: string; description: string }[] = [
  { value: "store_once", label: "Store Once", description: "Filled once per store" },
  { value: "role_each", label: "Role Each", description: "Filled separately by each role" },
];

const FREQUENCY_TYPES: { value: FrequencyType; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const WEEK_DAYS_OPTIONS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

const WEEK_OF_MONTH_OPTIONS = [
  { value: 1, label: "1st week" },
  { value: 2, label: "2nd week" },
  { value: 3, label: "3rd week" },
  { value: 4, label: "4th week" },
  { value: -1, label: "Last week" },
];

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

interface StoreRuleFormData {
  store_ids: string[];
  frequency_type: FrequencyType;
  interval: number;
  week_days: number[];
  month_day: number | null;
  week_of_month: number | null;
  week_day: number | null;
  year_month: number | null;
  starts_at: string;
  ends_at: string;
  fill_mode: FillMode;
  role_names: string[];
}

function emptyStoreRule(): StoreRuleFormData {
  return {
    store_ids: [],
    frequency_type: "daily",
    interval: 1,
    week_days: [],
    month_day: null,
    week_of_month: null,
    week_day: null,
    year_month: null,
    starts_at: "",
    ends_at: "",
    fill_mode: "store_once",
    role_names: [],
  };
}

export interface KeyFormValues {
  label: string;
  data_type: KeyDataType;
  is_active: boolean;
  store_rules: StoreRuleFormData[];
  tags?: number[];
}

export interface KeyFormProps {
  initialValues?: Partial<KeyFormValues>;
  onSubmit: (payload: CreateKeyPayload) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
  submitLabel?: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Store Rule sub-form                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

interface StoreOption {
  id: string;
  storeId?: string;
  name: string;
}

function StoreRuleForm({
  index,
  rule,
  onChange,
  onRemove,
  canRemove,
  stores,
  roles,
  isLoadingRoles,
}: {
  index: number;
  rule: StoreRuleFormData;
  onChange: (index: number, updated: StoreRuleFormData) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  stores: StoreOption[];
  roles: { id: string; name: string }[];
  isLoadingRoles: boolean;
}) {
  const [storeSearch, setStoreSearch] = useState("");

  const update = (partial: Partial<StoreRuleFormData>) => {
    onChange(index, { ...rule, ...partial });
  };

  const toggleWeekDay = (day: number) => {
    const newDays = rule.week_days.includes(day)
      ? rule.week_days.filter((d) => d !== day)
      : [...rule.week_days, day].sort((a, b) => a - b);
    update({ week_days: newDays });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Store Rule #{index + 1}</CardTitle>
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onRemove(index)}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Remove store rule</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Stores multi-select */}
          <div className="space-y-2 sm:col-span-2">
            <Label>
              Stores <span className="text-destructive">*</span>
            </Label>
            {stores.length > 0 ? (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      {rule.store_ids.length === 0
                        ? "Select stores…"
                        : `${rule.store_ids.length} store${rule.store_ids.length > 1 ? "s" : ""} selected`}
                      <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-2" align="start">
                    <Input
                      placeholder="Search stores…"
                      value={storeSearch}
                      onChange={(e) => setStoreSearch(e.target.value)}
                      className="mb-2 h-8 text-sm"
                    />
                    <div className="max-h-52 overflow-y-auto">
                      <div className="space-y-1">
                        {stores
                          .filter((s) => {
                            const q = storeSearch.toLowerCase();
                            return (
                              s.name.toLowerCase().includes(q) ||
                              (s.storeId ?? s.id).toLowerCase().includes(q)
                            );
                          })
                          .map((s) => {
                            const displayId = s.storeId ?? s.id;
                            const selected = rule.store_ids.includes(displayId);
                            return (
                              <label
                                key={s.id}
                                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
                              >
                                <Checkbox
                                  checked={selected}
                                  onCheckedChange={(checked) =>
                                    update({
                                      store_ids: checked
                                        ? [...rule.store_ids, displayId]
                                        : rule.store_ids.filter((id) => id !== displayId),
                                    })
                                  }
                                />
                                <span className="flex-1 text-sm">{s.name}</span>
                                <span className="text-xs text-muted-foreground">({displayId})</span>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                    {rule.store_ids.length > 0 && (
                      <div className="mt-2 border-t pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-full text-xs text-muted-foreground"
                          onClick={() => update({ store_ids: [] })}
                        >
                          Clear selection
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
                {rule.store_ids.length > 0 && (
                  <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                    {rule.store_ids.map((id) => {
                      const store = stores.find((s) => (s.storeId ?? s.id) === id);
                      return (
                        <Badge key={id} variant="secondary" className="gap-1 pe-1">
                          {store?.name ?? id}
                          <button
                            type="button"
                            className="rounded-sm opacity-70 hover:opacity-100"
                            onClick={() =>
                              update({
                                store_ids: rule.store_ids.filter((sid) => sid !== id),
                              })
                            }
                          >
                            <X className="h-3 w-3" />
                            <span className="sr-only">Remove {store?.name ?? id}</span>
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={storeSearch}
                    onChange={(e) => setStoreSearch(e.target.value)}
                    placeholder="Enter store ID and press Add"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = storeSearch.trim();
                        if (v && !rule.store_ids.includes(v)) {
                          update({ store_ids: [...rule.store_ids, v] });
                          setStoreSearch("");
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const v = storeSearch.trim();
                      if (v && !rule.store_ids.includes(v)) {
                        update({ store_ids: [...rule.store_ids, v] });
                        setStoreSearch("");
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                {rule.store_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {rule.store_ids.map((id) => (
                      <Badge key={id} variant="secondary" className="gap-1 pe-1">
                        {id}
                        <button
                          type="button"
                          className="rounded-sm opacity-70 hover:opacity-100"
                          onClick={() =>
                            update({ store_ids: rule.store_ids.filter((sid) => sid !== id) })
                          }
                        >
                          <X className="h-3 w-3" />
                          <span className="sr-only">Remove {id}</span>
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
            {rule.store_ids.length === 0 && (
              <p className="text-xs text-destructive">Select at least one store.</p>
            )}
          </div>

          {/* Frequency Type */}
          <div className="space-y-2">
            <Label htmlFor={`frequency-${index}`}>
              Frequency Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={rule.frequency_type}
              onValueChange={(v) =>
                update({ frequency_type: v as FrequencyType })
              }
            >
              <SelectTrigger id={`frequency-${index}`}>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_TYPES.map((ft) => (
                  <SelectItem key={ft.value} value={ft.value}>
                    {ft.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Interval */}
          <div className="space-y-2">
            <Label htmlFor={`interval-${index}`}>
              Interval <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`interval-${index}`}
              type="number"
              min={1}
              value={rule.interval}
              onChange={(e) =>
                update({ interval: Math.max(1, Number(e.target.value)) })
              }
              required
            />
          </div>

          {/* Starts At */}
          <div className="space-y-2">
            <Label htmlFor={`starts-at-${index}`}>
              Starts At <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`starts-at-${index}`}
              type="date"
              value={rule.starts_at}
              onChange={(e) => update({ starts_at: e.target.value })}
              required
            />
          </div>

          {/* Ends At */}
          <div className="space-y-2">
            <Label htmlFor={`ends-at-${index}`}>Ends At</Label>
            <Input
              id={`ends-at-${index}`}
              type="date"
              value={rule.ends_at}
              onChange={(e) => update({ ends_at: e.target.value })}
            />
          </div>

          {/* Month Day */}
          {(rule.frequency_type === "monthly" ||
            rule.frequency_type === "yearly") && (
            <div className="space-y-2">
              <Label htmlFor={`month-day-${index}`}>Month Day (1–31)</Label>
              <Input
                id={`month-day-${index}`}
                type="number"
                min={1}
                max={31}
                value={rule.month_day ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  update({
                    month_day:
                      v === "" ? null : Math.min(31, Math.max(1, Number(v))),
                  });
                }}
                placeholder="null"
              />
            </div>
          )}

          {/* Week Day */}
          {rule.frequency_type !== "daily" && (
            <div className="space-y-2">
              <Label htmlFor={`week-day-${index}`}>Week Day (1–7)</Label>
              <Select
                value={rule.week_day != null ? String(rule.week_day) : "none"}
                onValueChange={(v) =>
                  update({ week_day: v === "none" ? null : Number(v) })
                }
              >
                <SelectTrigger id={`week-day-${index}`}>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {WEEK_DAYS_OPTIONS.map((wd) => (
                    <SelectItem key={wd.value} value={String(wd.value)}>
                      {wd.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Week of Month */}
          {(rule.frequency_type === "monthly" ||
            rule.frequency_type === "yearly") && (
            <div className="space-y-2">
              <Label htmlFor={`week-of-month-${index}`}>Week of Month</Label>
              <Select
                value={
                  rule.week_of_month != null
                    ? String(rule.week_of_month)
                    : "none"
                }
                onValueChange={(v) =>
                  update({ week_of_month: v === "none" ? null : Number(v) })
                }
              >
                <SelectTrigger id={`week-of-month-${index}`}>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {WEEK_OF_MONTH_OPTIONS.map((wm) => (
                    <SelectItem key={wm.value} value={String(wm.value)}>
                      {wm.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Year Month */}
          {rule.frequency_type === "yearly" && (
            <div className="space-y-2">
              <Label htmlFor={`year-month-${index}`}>Year Month (1–12)</Label>
              <Input
                id={`year-month-${index}`}
                type="number"
                min={1}
                max={12}
                value={rule.year_month ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  update({
                    year_month:
                      v === "" ? null : Math.min(12, Math.max(1, Number(v))),
                  });
                }}
                placeholder="null"
              />
            </div>
          )}
        </div>

        {/* Week Days multi-select (toggle buttons) */}
        {rule.frequency_type !== "daily" && (
          <div className="space-y-2">
            <Label>Week Days</Label>
            <div className="flex flex-wrap gap-2">
              {WEEK_DAYS_OPTIONS.map((wd) => {
                const selected = rule.week_days.includes(wd.value);
                return (
                  <Button
                    key={wd.value}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleWeekDay(wd.value)}
                  >
                    {wd.label.slice(0, 3)}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Fill Mode */}
        <div className="space-y-2">
          <Label htmlFor={`fill-mode-${index}`}>
            Fill Mode <span className="text-destructive">*</span>
          </Label>
          <Select
            value={rule.fill_mode}
            onValueChange={(v) => {
              update({
                fill_mode: v as FillMode,
                role_names: v === "store_once" ? [] : rule.role_names,
              });
            }}
          >
            <SelectTrigger id={`fill-mode-${index}`}>
              <SelectValue placeholder="Select fill mode" />
            </SelectTrigger>
            <SelectContent>
              {FILL_MODES.map((fm) => (
                <SelectItem key={fm.value} value={fm.value}>
                  {fm.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {FILL_MODES.find((fm) => fm.value === rule.fill_mode)?.description}
          </p>
        </div>

        {/* Role Names — shown only when fill_mode is role_each */}
        {rule.fill_mode === "role_each" && (
          <div className="space-y-2">
            <Label>
              Role Names <span className="text-destructive">*</span>
            </Label>
            {isLoadingRoles ? (
              <p className="text-xs text-muted-foreground">Loading roles…</p>
            ) : roles.length === 0 ? (
              <p className="text-xs text-muted-foreground">No roles available.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => {
                  const selected = rule.role_names.includes(role.name);
                  return (
                    <Button
                      key={role.id}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        update({
                          role_names: selected
                            ? rule.role_names.filter((n) => n !== role.name)
                            : [...rule.role_names, role.name],
                        })
                      }
                    >
                      {role.name}
                    </Button>
                  );
                })}
              </div>
            )}
            {rule.role_names.length === 0 && (
              <p className="text-xs text-destructive">
                Select at least one role.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Key Form                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

export function KeyForm({
  initialValues,
  onSubmit,
  isSubmitting,
  error,
  submitLabel = "Submit",
}: KeyFormProps) {
  const { overviewStores } = useAuthStore();
  const stores: StoreOption[] = (overviewStores ?? []).map((s) => ({
    id: s.id,
    storeId: s.storeId,
    name: s.name,
  }));

  const { roles, isLoading: isLoadingRoles } = useRoles(ROLES_FETCH_PARAMS);
  const { data: tagsData } = useTagsList();

  const [label, setLabel] = useState(initialValues?.label ?? "");
  const [dataType, setDataType] = useState<KeyDataType>(
    initialValues?.data_type ?? "text"
  );
  const [isActive, setIsActive] = useState(initialValues?.is_active ?? true);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(
    initialValues?.tags ?? []
  );
  const [storeRules, setStoreRules] = useState<StoreRuleFormData[]>(
    initialValues?.store_rules ?? [emptyStoreRule()]
  );

  const addStoreRule = useCallback(() => {
    setStoreRules((prev) => [...prev, emptyStoreRule()]);
  }, []);

  const removeStoreRule = useCallback((index: number) => {
    setStoreRules((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateStoreRule = useCallback(
    (index: number, updated: StoreRuleFormData) => {
      setStoreRules((prev) =>
        prev.map((r, i) => (i === index ? updated : r))
      );
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: CreateKeyPayload = {
      label: label.trim(),
      data_type: dataType,
      is_active: isActive,
      store_rules: storeRules.flatMap<StoreRulePayload>((rule) =>
        rule.store_ids.map((store_id) => ({
          store_id: store_id.trim(),
          frequency_type: rule.frequency_type,
          interval: rule.interval,
          week_days: rule.week_days.length > 0 ? rule.week_days : null,
          month_day: rule.month_day,
          week_of_month: rule.week_of_month as WeekOfMonth | null,
          week_day: rule.week_day,
          year_month: rule.year_month,
          starts_at: rule.starts_at,
          ends_at: rule.ends_at || null,
          fill_mode: rule.fill_mode,
          role_names: rule.fill_mode === "role_each" && rule.role_names.length > 0 ? rule.role_names : null,
        }))
      ),
      ...(selectedTagIds.length > 0 ? { tags: selectedTagIds } : {}),
    };

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Key info */}
      <Card>
        <CardHeader>
          <CardTitle>Key Information</CardTitle>
          <CardDescription>Configure the core key properties.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="key-label">
                Label <span className="text-destructive">*</span>
              </Label>
              <Input
                id="key-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Enter key label"
                maxLength={255}
                required
              />
              <p className="text-xs text-muted-foreground">
                {label.length}/255 characters
              </p>
            </div>

            {/* Data Type */}
            <div className="space-y-2">
              <Label htmlFor="data-type">
                Data Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={dataType}
                onValueChange={(v) => setDataType(v as KeyDataType)}
              >
                <SelectTrigger id="data-type">
                  <SelectValue placeholder="Select data type" />
                </SelectTrigger>
                <SelectContent>
                  {DATA_TYPES.map((dt) => (
                    <SelectItem key={dt.value} value={dt.value}>
                      {dt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <Switch
              id="is-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="is-active">Active</Label>
          </div>

          {/* Tags */}
          {tagsData && tagsData.data.length > 0 && (
            <div className="space-y-2">
              <Label>Tags <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {selectedTagIds.length === 0
                      ? "Select tags…"
                      : `${selectedTagIds.length} tag${selectedTagIds.length > 1 ? "s" : ""} selected`}
                    <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" align="start">
                  <div className="max-h-52 overflow-y-auto space-y-1">
                    {tagsData.data.map((tag) => {
                      const selected = selectedTagIds.includes(tag.id);
                      return (
                        <label
                          key={tag.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(checked) =>
                              setSelectedTagIds(
                                checked
                                  ? [...selectedTagIds, tag.id]
                                  : selectedTagIds.filter((id) => id !== tag.id)
                              )
                            }
                          />
                          <span className="flex-1 text-sm">{tag.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  {selectedTagIds.length > 0 && (
                    <div className="mt-2 border-t pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-full text-xs text-muted-foreground"
                        onClick={() => setSelectedTagIds([])}
                      >
                        Clear selection
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              {selectedTagIds.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedTagIds.map((id) => {
                    const tag = tagsData.data.find((t) => t.id === id);
                    return (
                      <Badge key={id} variant="secondary" className="gap-1 pe-1">
                        {tag?.name ?? `Tag #${id}`}
                        <button
                          type="button"
                          className="rounded-sm opacity-70 hover:opacity-100"
                          onClick={() =>
                            setSelectedTagIds(selectedTagIds.filter((t) => t !== id))
                          }
                        >
                          <X className="h-3 w-3" />
                          <span className="sr-only">Remove {tag?.name ?? id}</span>
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Store Rules */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Store Rules</h3>
            <p className="text-sm text-muted-foreground">
              Define scheduling rules per store.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addStoreRule}>
            <Plus className="me-2 h-4 w-4" />
            Add Rule
          </Button>
        </div>

        <Separator />

        <div className="space-y-4">
          {storeRules.map((rule, index) => (
            <StoreRuleForm
              key={index}
              index={index}
              rule={rule}
              onChange={updateStoreRule}
              onRemove={removeStoreRule}
              canRemove={storeRules.length > 1}
              stores={stores}
              roles={roles}
              isLoadingRoles={isLoadingRoles}
            />
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}
