"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { TimePicker } from "@/components/ui/time-picker";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import { employeeService } from "@/lib/api/services/employee.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import { useReferenceCatalogStore } from "@/lib/store/reference-catalog.store";
import { useAuthStore } from "@/lib/auth/auth.store";
import type {
  CreateEmployeeV1Address,
  CreateEmployeeV1Availability,
  CreateEmployeeV1AvailabilityTime,
  CreateEmployeeV1Contact,
  CreateEmployeeV1EmployeeId,
  CreateEmployeeV1FinancialInfo,
  CreateEmployeeV1MaritalHistory,
  CreateEmployeeV1Obsession,
  CreateEmployeeV1PayHistory,
  CreateEmployeeV1Position,
  CreateEmployeeV1StatusHistory,
  CreateEmployeeV1StoreAssignment,
} from "@/types/employee.types";

interface AttachmentDraft {
  type_id: number;
  file: File | null;
}

interface EditEmployeeDialogProps {
  employeeId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const DAYS_OF_WEEK = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const DAY_LABELS: Record<string, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};

const SHIFT_TYPES = ["AM", "PM", "OP"] as const;
const STATUS_OPTIONS = ["hired", "resigned", "terminated", "rehired", "OJE"] as const;

function formatSSN(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`;
}

const RACE_OPTIONS = [
  "Caucasian",
  "African American",
  "Hispanic",
  "Asian",
  "Native American",
  "Other",
] as const;

const RELIGION_OPTIONS = [
  "Christianity",
  "Islam",
  "Judaism",
  "Buddhism",
  "Hinduism",
  "Other",
] as const;

const TSHIRT_OPTIONS = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
  "4XL",
  "5XL",
  "6XL",
] as const;

const SHIFT_TIME_PRESETS: Record<string, { label: string; from: string; to: string }[]> = {
  AM: [
    { label: "Early AM", from: "06:00", to: "14:00" },
    { label: "Standard AM", from: "07:00", to: "15:00" },
    { label: "Late AM", from: "08:00", to: "16:00" },
  ],
  PM: [
    { label: "Early PM", from: "14:00", to: "22:00" },
    { label: "Standard PM", from: "15:00", to: "23:00" },
    { label: "Late PM", from: "16:00", to: "23:59" },
  ],
  OP: [
    { label: "Open Early", from: "05:00", to: "13:00" },
    { label: "Open Std", from: "06:00", to: "14:00" },
    { label: "Open Late", from: "10:00", to: "18:00" },
  ],
};

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */
const emptyAddress = (): CreateEmployeeV1Address => ({
  address_name: "",
  address_1: "",
  address_2: "",
  city: "",
  state: "",
  zip_code: "",
  country: "",
  is_primary: false,
});

const emptyAvailabilityTime = (): CreateEmployeeV1AvailabilityTime => ({
  available_from: "",
  available_to: "",
});

interface AvailabilityGroup {
  days: string[];
  shift_type: string;
  times: CreateEmployeeV1AvailabilityTime[];
}

const emptyAvailability = (): AvailabilityGroup => ({
  days: [],
  shift_type: "",
  times: [emptyAvailabilityTime()],
});

const emptyContact = (): CreateEmployeeV1Contact => ({
  contact_name: "",
  contact_type: "phone",
  contact_value: "",
  is_primary: false,
});

const emptyEmployeeId = (): CreateEmployeeV1EmployeeId => ({
  id_type_id: 0,
  id_value: "",
});

const emptyFinancialInfo = (): CreateEmployeeV1FinancialInfo => ({
  account_number: "",
  account_type: "checking",
  effective_date: "",
  routing_number: "",
});

const emptyMaritalHistory = (): CreateEmployeeV1MaritalHistory => ({
  effective_date: "",
  marital_id: 0,
});

const emptyPayHistory = (): CreateEmployeeV1PayHistory => ({
  base_pay: 0,
  effective_date: "",
  performance_pay: 0,
});

const emptyPosition = (): CreateEmployeeV1Position => ({
  effective_date: "",
  position_id: 0,
});

const emptyStatusHistory = (): CreateEmployeeV1StatusHistory => ({
  effective_date: "",
  status: "",
  notes: "",
  store_id: 0,
});

const emptyStoreAssignment = (): CreateEmployeeV1StoreAssignment => ({
  effective_date: "",
  store_id: 0,
});

const emptyAttachment = (): AttachmentDraft => ({
  type_id: 0,
  file: null,
});

/** Strip time portion from ISO datetime string for <input type="date"> */
function isoToDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.split("T")[0] ?? "";
}

/** Convert HH:mm (HTML time input) to H:i (Laravel format, no leading zero on hour) */
function toHi(time: string): string {
  if (!time) return time;
  const [h, m] = time.split(":");
  return `${parseInt(h ?? "0", 10)}:${m ?? "00"}`;
}

/** Convert H:i (API format, e.g. "6:00") → HH:mm (HTML time input format, e.g. "06:00") */
function hiToHhmm(time: string): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  return `${String(parseInt(h ?? "0", 10)).padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  API error extraction helper                                        */
/* ------------------------------------------------------------------ */
function extractApiError(err: unknown): string {
  if (!(err instanceof Error)) return "An unexpected error occurred.";
  const axiosErr = err as unknown as { response?: { data?: unknown } };
  if (axiosErr.response?.data) {
    const raw = axiosErr.response.data;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (typeof raw === "object" && raw !== null) {
      const obj = raw as Record<string, unknown>;
      if (obj.errors && typeof obj.errors === "object") {
        const messages = Object.values(obj.errors as Record<string, unknown>)
          .flatMap((v) => (Array.isArray(v) ? v : [v]))
          .filter((v): v is string => typeof v === "string");
        if (messages.length > 0) return messages.join("\n");
      }
      if (typeof obj.message === "string" && obj.message) return obj.message;
    }
  }
  return err.message || "An unexpected error occurred.";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export function EditEmployeeDialog({
  employeeId,
  open,
  onOpenChange,
  onSuccess,
}: EditEmployeeDialogProps) {
  const { selectedStore } = useSelectedStoreStore();
  const { overviewStores } = useAuthStore();
  const {
    positions: positionOptions,
    maritalStatuses,
    idTypes: employeeIdTypes,
    attachmentTypes: employeeFileTypes,
    isLoading: isLoadingMeta,
  } = useReferenceCatalogStore();

  /* -- Basic fields -- */
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [ssn, setSsn] = useState("");
  const [employmentType, setEmploymentType] = useState("");

  /* -- Obsession -- */
  const [obsession, setObsession] = useState<CreateEmployeeV1Obsession>({
    birth_date: "",
    image: null,
    notes: "",
    race: "",
    religion: "",
    t_shirt: "",
  });

  /* -- Array fields -- */
  const [addresses, setAddresses] = useState<CreateEmployeeV1Address[]>([]);
  const [availability, setAvailability] = useState<AvailabilityGroup[]>([]);
  const [contacts, setContacts] = useState<CreateEmployeeV1Contact[]>([]);
  const [employeeIds, setEmployeeIds] = useState<CreateEmployeeV1EmployeeId[]>([]);
  const [financialInfo, setFinancialInfo] = useState<CreateEmployeeV1FinancialInfo[]>([]);
  const [maritalHistory, setMaritalHistory] = useState<CreateEmployeeV1MaritalHistory[]>([]);
  const [payHistory, setPayHistory] = useState<CreateEmployeeV1PayHistory[]>([]);
  const [positions, setPositions] = useState<CreateEmployeeV1Position[]>([]);
  const [statusHistory, setStatusHistory] = useState<CreateEmployeeV1StatusHistory[]>([]);
  const [storeAssignments, setStoreAssignments] = useState<CreateEmployeeV1StoreAssignment[]>([]);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<import("@/types/employee.types").EmployeeV1AttachmentDetail[]>([]);

  /* -- UI state -- */
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("personal");

  const storeIdNum = selectedStore?.id ? parseInt(selectedStore.id, 10) : 0;

  /* -- Populate form from V1 detail record -- */
  function populateForm(emp: import("@/types/employee.types").EmployeeV1DetailRecord) {
    setFirstName(emp.first_name ?? "");
    setMiddleName(emp.middle_name ?? "");
    setLastName(emp.last_name ?? "");
    setGender(emp.gender ?? "");
    setSsn((emp.ssn ?? "").replace(/\D/g, "").slice(0, 9));
    setEmploymentType(emp.employment_type ?? "");

    setObsession({
      birth_date: isoToDate(emp.obsession?.birth_date),
      image: null,
      notes: emp.obsession?.notes ?? "",
      race: emp.obsession?.race ?? "",
      religion: emp.obsession?.religion ?? "",
      t_shirt: emp.obsession?.t_shirt ?? "",
    });

    setAddresses(
      (emp.addresses ?? []).map((a) => ({
        address_name: a.address_name ?? "",
        address_1: a.address_1 ?? "",
        address_2: a.address_2 ?? "",
        city: a.city ?? "",
        state: a.state ?? "",
        zip_code: a.zip_code ?? "",
        country: a.country ?? "",
        is_primary: a.is_primary ?? false,
      })),
    );

    setAvailability(
      (emp.availability_days ?? []).map((av) => ({
        days: av.day_of_week ? [av.day_of_week] : [],
        shift_type: av.shift_type ?? "",
        times:
          av.times && av.times.length > 0
            ? av.times.map((t) => ({
                available_from: hiToHhmm(t.available_from ?? ""),
                available_to: hiToHhmm(t.available_to ?? ""),
              }))
            : [emptyAvailabilityTime()],
      })),
    );

    setContacts(
      (emp.contacts ?? []).map((c) => ({
        contact_name: c.contact_name ?? "",
        contact_type: c.contact_type ?? "phone",
        contact_value: c.contact_value ?? "",
        is_primary: c.is_primary ?? false,
      })),
    );

    setEmployeeIds(
      (emp.ids ?? []).map((id) => ({
        id_type_id: id.id_type_id ?? 0,
        id_value: id.id_value ?? "",
      })),
    );

    setFinancialInfo(
      (emp.financial_infos ?? []).map((fi) => ({
        account_number: fi.account_number ?? "",
        routing_number: fi.routing_number ?? "",
        account_type: fi.account_type ?? "checking",
        effective_date: isoToDate(fi.effective_date),
      })),
    );

    setMaritalHistory(
      (emp.maritals ?? []).map((mh) => ({
        effective_date: isoToDate(mh.effective_date),
        marital_id: mh.marital_id ?? 0,
      })),
    );

    setPayHistory(
      (emp.pay_histories ?? []).map((ph) => ({
        base_pay: parseFloat(ph.base_pay) || 0,
        effective_date: isoToDate(ph.effective_date),
        performance_pay: parseFloat(ph.performance_pay) || 0,
      })),
    );

    setPositions(
      (emp.positions ?? []).map((p) => ({
        effective_date: isoToDate(p.effective_date),
        position_id: p.position_id ?? 0,
      })),
    );

    setStatusHistory(
      (emp.status_histories ?? []).map((sh) => ({
        effective_date: isoToDate(sh.effective_date),
        status: sh.status ?? "",
        notes: sh.notes ?? "",
        store_id: sh.store_id ?? storeIdNum,
      })),
    );

    setStoreAssignments(
      (emp.stores ?? []).map((sa) => ({
        effective_date: isoToDate(sa.effective_date),
        store_id: sa.store_id ?? 0,
      })),
    );

    setExistingAttachments(emp.attachments ?? []);
    setAttachments([]);
  }

  /* -- Load employee data when dialog opens -- */
  useEffect(() => {
    if (!open || !employeeId || !selectedStore?.storeId) return;
    let cancelled = false;

    setIsLoadingEmployee(true);
    setLoadError(null);
    setSubmitError(null);
    setActiveTab("personal");

    employeeService
      .getEmployeeDetailsV1(selectedStore.storeId, employeeId)
      .then((res) => {
        if (!cancelled) populateForm(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof Error && err.name === "CanceledError") return;
        setLoadError(
          err instanceof Error ? err.message : "Failed to load employee data.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoadingEmployee(false);
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employeeId, selectedStore?.storeId]);

  function handleClose() {
    onOpenChange(false);
  }

  /* -- Validation -- */
  const isFormValid =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    gender !== "" &&
    employmentType !== "" &&
    addresses.every(
      (a) =>
        a.address_name.trim() !== "" &&
        a.address_1.trim() !== "" &&
        a.city.trim() !== "" &&
        a.state.trim() !== "" &&
        a.zip_code.trim() !== "",
    ) &&
    maritalHistory.every(
      (mh) => mh.marital_id > 0 && mh.effective_date.trim() !== "",
    ) &&
    contacts.every(
      (c) =>
        c.contact_name.trim() !== "" &&
        c.contact_type.trim() !== "" &&
        c.contact_value.trim() !== "",
    ) &&
    availability.every(
      (av) =>
        av.days.length > 0 &&
        av.shift_type.trim() !== "" &&
        (av.times ?? []).every(
          (t) => t.available_from.trim() !== "" && t.available_to.trim() !== "",
        ),
    ) &&
    positions.every((p) => p.position_id > 0 && p.effective_date.trim() !== "") &&
    payHistory.every((ph) => ph.effective_date.trim() !== "") &&
    financialInfo.every(
      (fi) =>
        fi.account_number.trim() !== "" &&
        fi.routing_number.trim() !== "" &&
        fi.account_type.trim() !== "" &&
        fi.effective_date.trim() !== "",
    ) &&
    statusHistory.every((sh) => sh.status.trim() !== "" && sh.effective_date.trim() !== "") &&
    storeAssignments.every((sa) => sa.store_id > 0 && sa.effective_date.trim() !== "");

  /* -- Submit -- */
  async function handleSubmit() {
    if (!isFormValid) return;
    if (!selectedStore?.storeId || !employeeId) {
      setSubmitError("No store or employee selected.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const hasObsession = !!obsession.birth_date;

    try {
      await employeeService.updateEmployeeV1(selectedStore.storeId, employeeId, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        ...(middleName.trim() ? { middle_name: middleName.trim() } : {}),
        gender,
        ...(ssn.trim() ? { ssn: ssn.trim() } : {}),
        employment_type: employmentType,
        ...(hasObsession
          ? {
              obsession: {
                birth_date: obsession.birth_date,
                ...(obsession.image ? { image: obsession.image } : {}),
                ...(obsession.notes ? { notes: obsession.notes } : {}),
                ...(obsession.race ? { race: obsession.race } : {}),
                ...(obsession.religion ? { religion: obsession.religion } : {}),
                ...(obsession.t_shirt ? { t_shirt: obsession.t_shirt } : {}),
              },
            }
          : {}),
        ...(addresses.length > 0 ? { addresses } : {}),
        ...(availability.length > 0
          ? (() => {
              const validAvailability = availability
                .filter((group) => group.days.length > 0)
                .flatMap((group) =>
                  group.days
                    .map((day) => ({
                      day_of_week: day,
                      shift_type: group.shift_type,
                      times: (group.times ?? [])
                        .filter((t) => t.available_from.trim() && t.available_to.trim()),
                    }))
                    .filter((entry) => entry.times.length > 0),
                );
              return validAvailability.length > 0
                ? { availability: validAvailability }
                : {};
            })()
          : {}),
        ...(contacts.length > 0 ? { contacts } : {}),
        ...(employeeIds.filter((e) => e.id_type_id > 0 && e.id_value.trim()).length > 0
          ? { employee_ids: employeeIds.filter((e) => e.id_type_id > 0 && e.id_value.trim()) }
          : {}),
        ...(financialInfo.filter((f) => f.account_number.trim() && f.routing_number.trim()).length > 0
          ? { financial_info: financialInfo.filter((f) => f.account_number.trim() && f.routing_number.trim()) }
          : {}),
        ...(maritalHistory.length > 0 ? { marital_history: maritalHistory } : {}),
        ...(payHistory.length > 0 ? { pay_history: payHistory } : {}),
        ...(positions.filter((p) => p.position_id > 0).length > 0
          ? { positions: positions.filter((p) => p.position_id > 0) }
          : {}),
        ...(statusHistory.length > 0
          ? {
              status_history: statusHistory.map((sh) => ({
                ...sh,
                store_id: sh.store_id || storeIdNum,
              })),
            }
          : {}),
        ...(storeAssignments.filter((s) => s.store_id > 0).length > 0
          ? { store_assignments: storeAssignments.filter((s) => s.store_id > 0) }
          : {}),
        ...(attachments.filter((a) => a.type_id > 0 && a.file !== null).length > 0
          ? {
              attachments: attachments.filter(
                (a) => a.type_id > 0 && a.file !== null,
              ) as import("@/types/employee.types").CreateEmployeeV1Attachment[],
            }
          : {}),
      });

      toast.success("Employee updated successfully.");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      if (err instanceof Error && err.name === "CanceledError") return;
      setSubmitError(extractApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  /* -- Generic array helpers -- */
  function addItem<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, factory: () => T) {
    setter((prev) => [...prev, factory()]);
  }

  function removeItem<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number) {
    setter((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem<T>(
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    index: number,
    field: keyof T,
    value: T[keyof T],
  ) {
    setter((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  /* -- Sub-component helpers -- */
  function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={onClick}>
        <Plus className="me-1 h-4 w-4" />
        {label}
      </Button>
    );
  }

  function RemoveButton({ onClick }: { onClick: () => void }) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive hover:text-destructive"
        onClick={onClick}
        aria-label="Remove"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    );
  }

  function SectionDivider({ label }: { label: string }) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
          {label}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Loading skeleton                                                */
  /* ---------------------------------------------------------------- */
  function renderLoadingSkeleton() {
    return (
      <div className="space-y-4 p-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  TAB CONTENT RENDERERS                                           */
  /* ---------------------------------------------------------------- */

  /* 1) Basic Info */
  function renderBasicSection() {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label>
              First Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={100}
              placeholder="First name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Middle Name</Label>
            <Input
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              maxLength={100}
              placeholder="Middle name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Last Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={100}
              placeholder="Last name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Gender <span className="text-destructive">*</span>
            </Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>SSN</Label>
            <Input
              value={formatSSN(ssn)}
              onChange={(e) => setSsn(e.target.value.replace(/\D/g, "").slice(0, 9))}
              placeholder="123-45-6789"
              maxLength={11}
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Employment Type <span className="text-destructive">*</span>
            </Label>
            <Select value={employmentType} onValueChange={setEmploymentType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="W2">W2</SelectItem>
                <SelectItem value="1099">1099</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }

  /* 2) Obsession */
  function renderObsessionSection() {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Birth Date</Label>
            <DatePicker
              value={obsession.birth_date ?? ""}
              onChange={(v) => setObsession((prev) => ({ ...prev, birth_date: v }))}
              toYear={2023}
            />
          </div>
          {/* <div className="space-y-1.5">
            <Label>Race</Label>
            <Select
              value={obsession.race ?? ""}
              onValueChange={(v) => setObsession((prev) => ({ ...prev, race: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select race" />
              </SelectTrigger>
              <SelectContent>
                {RACE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div> */}
          {/* <div className="space-y-1.5">
            <Label>Religion</Label>
            <Select
              value={obsession.religion ?? ""}
              onValueChange={(v) => setObsession((prev) => ({ ...prev, religion: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select religion" />
              </SelectTrigger>
              <SelectContent>
                {RELIGION_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div> */}
          <div className="space-y-1.5">
            <Label>T-Shirt Size</Label>
            <Select
              value={obsession.t_shirt ?? ""}
              onValueChange={(v) => setObsession((prev) => ({ ...prev, t_shirt: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                {TSHIRT_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Profile Image</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setObsession((prev) => ({ ...prev, image: e.target.files?.[0] ?? null }))
              }
            />
            {obsession.image && (
              <p className="text-xs text-muted-foreground truncate">{obsession.image.name}</p>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label>Notes</Label>
            <Textarea
              value={obsession.notes ?? ""}
              onChange={(e) => setObsession((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional notes"
              rows={2}
            />
          </div>
        </div>
      </div>
    );
  }

  /* 3) Marital History */
  function renderMaritalHistorySection() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Marital history records.</p>
          <AddButton
            label="Add Marital Record"
            onClick={() => addItem(setMaritalHistory, emptyMaritalHistory)}
          />
        </div>
        {maritalHistory.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No marital history added.</p>
        )}
        {maritalHistory.map((mh, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Marital Record {idx + 1}</Badge>
              <RemoveButton onClick={() => removeItem(setMaritalHistory, idx)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  Marital Status <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={mh.marital_id && mh.marital_id > 0 ? String(mh.marital_id) : ""}
                  onValueChange={(v) =>
                    updateItem(setMaritalHistory, idx, "marital_id", parseInt(v, 10))
                  }
                  disabled={isLoadingMeta}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingMeta ? "Loading..." : "Select status"} />
                  </SelectTrigger>
                  <SelectContent>
                    {maritalStatuses.map((ms) => (
                      <SelectItem key={ms.id} value={String(ms.id)}>
                        {ms.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Effective Date <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  value={mh.effective_date ?? ""}
                  onChange={(v) => updateItem(setMaritalHistory, idx, "effective_date", v)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* 4) Contacts */
  function renderContactsSection() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Add email, phone, or emergency contacts.</p>
          <AddButton label="Add Contact" onClick={() => addItem(setContacts, emptyContact)} />
        </div>
        {contacts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No contacts added.</p>
        )}
        {contacts.map((c, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Contact {idx + 1}</Badge>
              <RemoveButton onClick={() => removeItem(setContacts, idx)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>
                  Contact Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={c.contact_name ?? ""}
                  onChange={(e) => updateItem(setContacts, idx, "contact_name", e.target.value)}
                  maxLength={100}
                  placeholder="Contact name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={c.contact_type}
                  onValueChange={(v) => updateItem(setContacts, idx, "contact_type", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="emergency_contact">Emergency Contact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Value <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={c.contact_value}
                  onChange={(e) => updateItem(setContacts, idx, "contact_value", e.target.value)}
                  maxLength={255}
                  placeholder={
                    c.contact_type === "email" ? "email@example.com" : "+1 555 000 0000"
                  }
                />
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <Checkbox
                  checked={c.is_primary ?? false}
                  onCheckedChange={(v) => updateItem(setContacts, idx, "is_primary", !!v)}
                />
                <Label className="text-sm">Primary</Label>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* 5) Addresses */
  function renderAddressesSection() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Employee addresses.</p>
          <AddButton label="Add Address" onClick={() => addItem(setAddresses, emptyAddress)} />
        </div>
        {addresses.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No addresses added.</p>
        )}
        {addresses.map((a, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Address {idx + 1}</Badge>
              <RemoveButton onClick={() => removeItem(setAddresses, idx)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>
                  Address Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={a.address_name ?? ""}
                  onChange={(e) => updateItem(setAddresses, idx, "address_name", e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Home, Work"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>
                  Address 1 <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={a.address_1 ?? ""}
                  onChange={(e) => updateItem(setAddresses, idx, "address_1", e.target.value)}
                  maxLength={255}
                  placeholder="123 Main St"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address 2</Label>
                <Input
                  value={a.address_2 ?? ""}
                  onChange={(e) => updateItem(setAddresses, idx, "address_2", e.target.value)}
                  maxLength={255}
                  placeholder="Apt, suite, unit, etc."
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  City <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={a.city ?? ""}
                  onChange={(e) => updateItem(setAddresses, idx, "city", e.target.value)}
                  maxLength={100}
                  placeholder="City"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  State <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={a.state ?? ""}
                  onChange={(e) => updateItem(setAddresses, idx, "state", e.target.value)}
                  maxLength={100}
                  placeholder="State"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Zip Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={a.zip_code ?? ""}
                  onChange={(e) => updateItem(setAddresses, idx, "zip_code", e.target.value)}
                  maxLength={20}
                  placeholder="12345"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input
                  value={a.country ?? ""}
                  onChange={(e) => updateItem(setAddresses, idx, "country", e.target.value)}
                  maxLength={100}
                  placeholder="Country"
                />
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <Checkbox
                  checked={a.is_primary ?? false}
                  onCheckedChange={(v) => updateItem(setAddresses, idx, "is_primary", !!v)}
                />
                <Label className="text-sm">Primary</Label>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* 6) Availability */
  function renderAvailabilitySection() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Select one or more days per shift group, then configure time windows.
          </p>
          <AddButton
            label="Add Availability"
            onClick={() => addItem(setAvailability, emptyAvailability)}
          />
        </div>
        {availability.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No availability added.</p>
        )}
        {availability.map((av, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Availability {idx + 1}</Badge>
              <RemoveButton onClick={() => removeItem(setAvailability, idx)} />
            </div>

            {/* Day toggle chips */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>
                  Days of Week <span className="text-destructive">*</span>
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    const allSelected = DAYS_OF_WEEK.every((d) => av.days.includes(d));
                    const newDays = allSelected ? [] : [...DAYS_OF_WEEK];
                    setAvailability((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, days: newDays } : item)),
                    );
                  }}
                  className="text-xs text-primary cursor-pointer hover:underline underline-offset-2"
                >
                  {DAYS_OF_WEEK.every((d) => av.days.includes(d)) ? "Clear All" : "Select All"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DAYS_OF_WEEK.map((day) => {
                  const selected = av.days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const newDays = selected
                          ? av.days.filter((d) => d !== day)
                          : [...av.days, day];
                        setAvailability((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, days: newDays } : item)),
                        );
                      }}
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer select-none ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted text-muted-foreground hover:border-primary hover:text-foreground"
                      }`}
                    >
                      {DAY_LABELS[day]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Shift Type */}
            <div className="space-y-1.5">
              <Label>
                Shift Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={av.shift_type}
                onValueChange={(v) =>
                  setAvailability((prev) =>
                    prev.map((item, i) => (i === idx ? { ...item, shift_type: v } : item)),
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  {SHIFT_TYPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time Windows */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Time Windows
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setAvailability((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, times: [...(item.times ?? []), emptyAvailabilityTime()] } : item,
                      ),
                    )
                  }
                >
                  <Plus className="me-1 h-3 w-3" />
                  Add Time
                </Button>
              </div>
              {(av.times ?? []).map((t, tIdx) => (
                <div key={tIdx} className="space-y-1.5 rounded-md border border-dashed p-2.5">
                  {av.shift_type && SHIFT_TIME_PRESETS[av.shift_type] && (
                    <div className="flex flex-wrap gap-1.5">
                      {SHIFT_TIME_PRESETS[av.shift_type].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            const newTimes = (av.times ?? []).map((tm, ti) =>
                              ti === tIdx
                                ? { ...tm, available_from: preset.from, available_to: preset.to }
                                : tm,
                            );
                            setAvailability((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, times: newTimes } : item)),
                            );
                          }}
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                            t.available_from === preset.from && t.available_to === preset.to
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-muted text-muted-foreground hover:border-primary hover:text-foreground"
                          }`}
                        >
                          {preset.label} ({preset.from}–{preset.to})
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs">
                        From <span className="text-destructive">*</span>
                      </Label>
                      <TimePicker
                        value={t.available_from}
                        onChange={(v) => {
                          const newTimes = (av.times ?? []).map((tm, ti) =>
                            ti === tIdx ? { ...tm, available_from: v } : tm,
                          );
                          setAvailability((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, times: newTimes } : item)),
                          );
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs">
                        To <span className="text-destructive">*</span>
                      </Label>
                      <TimePicker
                        value={t.available_to}
                        onChange={(v) => {
                          const newTimes = (av.times ?? []).map((tm, ti) =>
                            ti === tIdx ? { ...tm, available_to: v } : tm,
                          );
                          setAvailability((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, times: newTimes } : item)),
                          );
                        }}
                      />
                    </div>
                    {(av.times ?? []).length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive shrink-0"
                        onClick={() => {
                          const newTimes = (av.times ?? []).filter((_, ti) => ti !== tIdx);
                          setAvailability((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, times: newTimes } : item)),
                          );
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* 7) Positions */
  function renderPositionsSection() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Employee position assignments.</p>
          <AddButton label="Add Position" onClick={() => addItem(setPositions, emptyPosition)} />
        </div>
        {positions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No positions added.</p>
        )}
        {positions.map((p, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Position {idx + 1}</Badge>
              <RemoveButton onClick={() => removeItem(setPositions, idx)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  Position <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={p.position_id > 0 ? String(p.position_id) : ""}
                  onValueChange={(v) =>
                    updateItem(setPositions, idx, "position_id", parseInt(v, 10))
                  }
                  disabled={isLoadingMeta}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingMeta ? "Loading..." : "Select position"} />
                  </SelectTrigger>
                  <SelectContent>
                    {positionOptions.map((po) => (
                      <SelectItem key={po.id} value={String(po.id)}>
                        {po.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Effective Date <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  value={p.effective_date ?? ""}
                  onChange={(v) => updateItem(setPositions, idx, "effective_date", v)}
                  fromYear={2023}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* 8) Pay History */
  function renderPayHistorySection() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Pay history records.</p>
          <AddButton
            label="Add Pay Record"
            onClick={() => addItem(setPayHistory, emptyPayHistory)}
          />
        </div>
        {payHistory.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No pay history added.</p>
        )}
        {payHistory.map((ph, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Pay Record {idx + 1}</Badge>
              <RemoveButton onClick={() => removeItem(setPayHistory, idx)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>
                  Base Pay <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={ph.base_pay || ""}
                  onChange={(e) =>
                    updateItem(setPayHistory, idx, "base_pay", parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Performance Pay <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={ph.performance_pay || ""}
                  onChange={(e) =>
                    updateItem(
                      setPayHistory,
                      idx,
                      "performance_pay",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Effective Date <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  value={ph.effective_date ?? ""}
                  onChange={(v) => updateItem(setPayHistory, idx, "effective_date", v)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* 9) Financial Info */
  function renderFinancialInfoSection() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Bank account / financial details.</p>
          <AddButton
            label="Add Financial Info"
            onClick={() => addItem(setFinancialInfo, emptyFinancialInfo)}
          />
        </div>
        {financialInfo.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No financial info added.</p>
        )}
        {financialInfo.map((fi, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Account {idx + 1}</Badge>
              <RemoveButton onClick={() => removeItem(setFinancialInfo, idx)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  Account Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={fi.account_number}
                  onChange={(e) =>
                    updateItem(setFinancialInfo, idx, "account_number", e.target.value)
                  }
                  maxLength={255}
                  placeholder="Account number"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Routing Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={fi.routing_number}
                  onChange={(e) =>
                    updateItem(setFinancialInfo, idx, "routing_number", e.target.value)
                  }
                  maxLength={255}
                  placeholder="Routing number"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Account Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={fi.account_type}
                  onValueChange={(v) => updateItem(setFinancialInfo, idx, "account_type", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Checking</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Effective Date <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  value={fi.effective_date ?? ""}
                  onChange={(v) => updateItem(setFinancialInfo, idx, "effective_date", v)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* 10) Employee IDs */
  function renderEmployeeIdsSection() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Employee ID references (e.g., Paychecks ID, Altemitrix ID).
          </p>
          <AddButton label="Add ID" onClick={() => addItem(setEmployeeIds, emptyEmployeeId)} />
        </div>
        {employeeIds.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No IDs added.</p>
        )}
        {employeeIds.map((eid, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">ID {idx + 1}</Badge>
              <RemoveButton onClick={() => removeItem(setEmployeeIds, idx)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  ID Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={eid.id_type_id > 0 ? String(eid.id_type_id) : ""}
                  onValueChange={(v) =>
                    updateItem(setEmployeeIds, idx, "id_type_id", parseInt(v, 10))
                  }
                  disabled={isLoadingMeta}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingMeta ? "Loading..." : "Select ID type"} />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeIdTypes.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  ID Value <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={eid.id_value}
                  onChange={(e) => updateItem(setEmployeeIds, idx, "id_value", e.target.value)}
                  maxLength={255}
                  placeholder="e.g. 123456"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* 11) Status History */
  function renderStatusHistorySection() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Status history records.</p>
          <AddButton
            label="Add Status"
            onClick={() =>
              setStatusHistory((prev) => [
                ...prev,
                { ...emptyStatusHistory(), store_id: storeIdNum },
              ])
            }
          />
        </div>
        {statusHistory.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No status history added.</p>
        )}
        {statusHistory.map((sh, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Status {idx + 1}</Badge>
              <RemoveButton onClick={() => removeItem(setStatusHistory, idx)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  Status <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={sh.status}
                  onValueChange={(v) => updateItem(setStatusHistory, idx, "status", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Effective Date <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  value={sh.effective_date ?? ""}
                  onChange={(v) => updateItem(setStatusHistory, idx, "effective_date", v)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Store</Label>
                <Select
                  value={sh.store_id ? String(sh.store_id) : ""}
                  onValueChange={(v) =>
                    updateItem(
                      setStatusHistory,
                      idx,
                      "store_id",
                      parseInt(v, 10) || 0,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    style={{ maxHeight: "160px", overflowY: "auto" }}
                  >
                    {overviewStores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.storeId ?? store.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  value={sh.notes ?? ""}
                  onChange={(e) => updateItem(setStatusHistory, idx, "notes", e.target.value)}
                  placeholder="Optional notes"
                  rows={2}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* 12) Store Assignments */
  function renderStoreAssignmentsSection() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Store assignment records.</p>
          <AddButton
            label="Add Assignment"
            onClick={() => addItem(setStoreAssignments, emptyStoreAssignment)}
          />
        </div>
        {storeAssignments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No store assignments added.
          </p>
        )}
        {storeAssignments.map((sa, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Assignment {idx + 1}</Badge>
              <RemoveButton onClick={() => removeItem(setStoreAssignments, idx)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  Store <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={sa.store_id ? String(sa.store_id) : ""}
                  onValueChange={(v) =>
                    updateItem(
                      setStoreAssignments,
                      idx,
                      "store_id",
                      parseInt(v, 10) || 0,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    style={{ maxHeight: "160px", overflowY: "auto" }}
                  >
                    {overviewStores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.storeId ?? store.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Effective Date <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  value={sa.effective_date ?? ""}
                  onChange={(v) => updateItem(setStoreAssignments, idx, "effective_date", v)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* 13) Attachments */
  function renderAttachmentsSection() {
    return (
      <div className="space-y-4">
        {existingAttachments.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Existing Attachments</p>
            {existingAttachments.map((att, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <span className="shrink-0 rounded bg-secondary px-2 py-0.5 text-xs font-medium">
                  {att.attachment_type?.label ?? `Type ${att.type_id ?? "?"}`}
                </span>
                <span className="flex-1 truncate text-muted-foreground">
                  {att.original_name ?? att.attachment_url ?? "file"}
                </span>
                {att.file_size != null && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {(att.file_size / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Upload new file attachments.</p>
          <AddButton
            label="Add Attachment"
            onClick={() => addItem(setAttachments, emptyAttachment)}
          />
        </div>
        {attachments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No new attachments added.</p>
        )}
        {attachments.map((att, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Attachment {idx + 1}</Badge>
              <RemoveButton onClick={() => removeItem(setAttachments, idx)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={att.type_id > 0 ? String(att.type_id) : ""}
                  onValueChange={(v) =>
                    updateItem(setAttachments, idx, "type_id", parseInt(v, 10))
                  }
                  disabled={isLoadingMeta}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingMeta ? "Loading..." : "Select type"} />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeFileTypes.map((ft) => (
                      <SelectItem key={ft.id} value={String(ft.id)}>
                        {ft.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  File <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="file"
                  onChange={(e) =>
                    updateItem(setAttachments, idx, "file", e.target.files?.[0] ?? null)
                  }
                />
                {att.file && (
                  <p className="text-xs text-muted-foreground truncate">{att.file.name}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Per-tab validation error counts                                 */
  /* ---------------------------------------------------------------- */
  const personalTabErrors = [
    firstName.trim() === "" ? 1 : 0,
    lastName.trim() === "" ? 1 : 0,
    gender === "" ? 1 : 0,
    employmentType === "" ? 1 : 0,
    ...addresses.flatMap((a) => [
      a.address_name.trim() === "" ? 1 : 0,
      a.address_1.trim() === "" ? 1 : 0,
      a.city.trim() === "" ? 1 : 0,
      a.state.trim() === "" ? 1 : 0,
      a.zip_code.trim() === "" ? 1 : 0,
    ]),
    ...maritalHistory.flatMap((mh) => [
      mh.marital_id <= 0 ? 1 : 0,
      mh.effective_date.trim() === "" ? 1 : 0,
    ]),
    ...contacts.flatMap((c) => [
      c.contact_name.trim() === "" ? 1 : 0,
      c.contact_value.trim() === "" ? 1 : 0,
    ]),
  ].reduce((sum, n) => sum + n, 0);

  const availabilityTabErrors = availability
    .flatMap((av) => [
      av.days.length === 0 ? 1 : 0,
      av.shift_type.trim() === "" ? 1 : 0,
      ...(av.times ?? []).flatMap((t) => [
        t.available_from.trim() === "" ? 1 : 0,
        t.available_to.trim() === "" ? 1 : 0,
      ]),
    ])
    .reduce((sum, n) => sum + n, 0);

  const compensationTabErrors = [
    ...positions.flatMap((p) => [
      p.position_id <= 0 ? 1 : 0,
      p.effective_date.trim() === "" ? 1 : 0,
    ]),
    ...payHistory.flatMap((ph) => [ph.effective_date.trim() === "" ? 1 : 0]),
    ...financialInfo.flatMap((fi) => [
      fi.account_number.trim() === "" ? 1 : 0,
      fi.routing_number.trim() === "" ? 1 : 0,
      fi.account_type.trim() === "" ? 1 : 0,
      fi.effective_date.trim() === "" ? 1 : 0,
    ]),
  ].reduce((sum, n) => sum + n, 0);

  const adminTabErrors = [
    ...statusHistory.flatMap((sh) => [
      sh.status.trim() === "" ? 1 : 0,
      sh.effective_date.trim() === "" ? 1 : 0,
    ]),
    ...storeAssignments.flatMap((sa) => [
      sa.store_id <= 0 ? 1 : 0,
      sa.effective_date.trim() === "" ? 1 : 0,
    ]),
  ].reduce((sum, n) => sum + n, 0);

  /* ---------------------------------------------------------------- */
  /*  RENDER                                                          */
  /* ---------------------------------------------------------------- */
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex h-[92vh] w-[95vw] max-w-[calc(100%-1rem)] flex-col text-[13px] sm:w-[92vw] sm:max-w-280 **:data-[slot=label]:text-xs **:data-[slot=input]:text-sm **:data-[slot=textarea]:text-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Edit Employee
            {employeeId && (
              <span className="text-sm font-normal text-muted-foreground">#{employeeId}</span>
            )}
          </DialogTitle>
          <DialogDescription>
            Update employee details for {selectedStore?.name ?? "your store"}.
          </DialogDescription>
        </DialogHeader>

        {loadError && (
          <Alert variant="destructive" className="max-h-32 overflow-y-auto">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <AlertDescription className="whitespace-pre-wrap wrap-break-word">{loadError}</AlertDescription>
          </Alert>
        )}

        {submitError && !loadError && (
          <Alert variant="destructive" className="max-h-32 overflow-y-auto">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <AlertDescription className="whitespace-pre-wrap wrap-break-word">{submitError}</AlertDescription>
          </Alert>
        )}

        {isLoadingEmployee ? (
          <div className="flex-1 flex flex-col gap-4 p-1 overflow-hidden">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading employee data...
            </div>
            {renderLoadingSkeleton()}
          </div>
        ) : !loadError ? (
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="grid h-9 w-full grid-cols-4 p-1">
              <TabsTrigger className="text-xs" value="personal">
                <span className="flex items-center gap-1">
                  Personal
                  {personalTabErrors > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold text-white leading-none">
                      {personalTabErrors > 9 ? "9+" : personalTabErrors}
                    </span>
                  )}
                </span>
              </TabsTrigger>
              <TabsTrigger className="text-xs" value="availability">
                <span className="flex items-center gap-1">
                  Availability
                  {availabilityTabErrors > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold text-white leading-none">
                      {availabilityTabErrors > 9 ? "9+" : availabilityTabErrors}
                    </span>
                  )}
                </span>
              </TabsTrigger>
              <TabsTrigger className="text-xs" value="compensation">
                <span className="flex items-center gap-1">
                  Compensation
                  {compensationTabErrors > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold text-white leading-none">
                      {compensationTabErrors > 9 ? "9+" : compensationTabErrors}
                    </span>
                  )}
                </span>
              </TabsTrigger>
              <TabsTrigger className="text-xs" value="admin">
                <span className="flex items-center gap-1">
                  Admin
                  {adminTabErrors > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold text-white leading-none">
                      {adminTabErrors > 9 ? "9+" : adminTabErrors}
                    </span>
                  )}
                </span>
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 min-h-0 mt-4">
              <div className="pe-3 pb-4">

                {/* Tab 1: Personal */}
                <TabsContent value="personal" className="mt-0 space-y-8">
                  <div className="space-y-4">
                    <SectionDivider label="Basic Information" />
                    {renderBasicSection()}
                  </div>
                  <div className="space-y-4">
                    <SectionDivider label="Personal Details" />
                    {renderObsessionSection()}
                  </div>
                  <div className="space-y-4">
                    <SectionDivider label="Marital History" />
                    {renderMaritalHistorySection()}
                  </div>
                  <div className="space-y-4">
                    <SectionDivider label="Contacts" />
                    {renderContactsSection()}
                  </div>
                  <div className="space-y-4">
                    <SectionDivider label="Addresses" />
                    {renderAddressesSection()}
                  </div>
                </TabsContent>

                {/* Tab 2: Availability */}
                <TabsContent value="availability" className="mt-0">
                  {renderAvailabilitySection()}
                </TabsContent>

                {/* Tab 3: Compensation */}
                <TabsContent value="compensation" className="mt-0 space-y-8">
                  <div className="space-y-4">
                    <SectionDivider label="Positions" />
                    {renderPositionsSection()}
                  </div>
                  <div className="space-y-4">
                    <SectionDivider label="Pay History" />
                    {renderPayHistorySection()}
                  </div>
                  <div className="space-y-4">
                    <SectionDivider label="Financial Info" />
                    {renderFinancialInfoSection()}
                  </div>
                </TabsContent>

                {/* Tab 4: Admin */}
                <TabsContent value="admin" className="mt-0 space-y-8">
                  <div className="space-y-4">
                    <SectionDivider label="Employee IDs" />
                    {renderEmployeeIdsSection()}
                  </div>
                  <div className="space-y-4">
                    <SectionDivider label="Status History" />
                    {renderStatusHistorySection()}
                  </div>
                  <div className="space-y-4">
                    <SectionDivider label="Store Assignments" />
                    {renderStoreAssignmentsSection()}
                  </div>
                  <div className="space-y-4">
                    <SectionDivider label="Attachments" />
                    {renderAttachmentsSection()}
                  </div>
                </TabsContent>

              </div>
            </ScrollArea>
          </Tabs>
        ) : null}

        <DialogFooter className="border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting || isLoadingEmployee || !!loadError}
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}