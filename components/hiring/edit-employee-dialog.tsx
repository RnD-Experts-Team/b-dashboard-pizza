"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  AlertCircle,
  Loader2,
  FileText,
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
import { toast } from "sonner";
import { employeeService } from "@/lib/api/services/employee.service";
import { hiringService } from "@/lib/api/services/hiring.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type {
  Gender,
  DayOfWeek,
  ContactType,
  AccountType,
  EmploymentType,
  TShirtSize,
  EmployeeAddress,
  EmployeeAvailability,
  EmployeeCertification,
  EmployeeContact,
  EmployeeIdInfo,
  EmployeeNote,
  EmployeePaymentInfo,
  EmployeeSalaryInfo,
  EmployeeStatusHistory,
  EmployeeRecord,
} from "@/types/employee.types";
import type {
  ShiftRecord,
  EmployeeStatusRecord,
  PositionRecord,
  EmployeeFileTypeRecord,
  MaritalStatusRecord,
  EmployeeIdTypeRecord,
} from "@/types/hiring.types";

interface EditEmployeeDialogProps {
  employeeId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */
const emptyAddress = (): EmployeeAddress => ({
  address_line_1: "",
  city: "",
  state: "",
  country: "",
  is_primary: false,
});

const emptyAvailability = (): EmployeeAvailability => ({
  days: [],
  shift_id: 0,
});

const emptyContact = (): EmployeeContact => ({
  contact_type: "phone",
  contact_value: "",
  is_primary: false,
});

const emptyNote = (): EmployeeNote => ({ notes: "" });

const emptyPayment = (): EmployeePaymentInfo => ({
  account_number: "",
  account_type: "checking",
  is_primary: false,
  routing_number: "",
});

const emptySalary = (): EmployeeSalaryInfo => ({
  base_pay: 0,
  performance_pay: 0,
  salary_date: "",
});

const emptyStatusHistory = (): EmployeeStatusHistory => ({
  notes: "",
  status_date: "",
  status_type_id: 0,
});

const emptyCertification = (): EmployeeCertification => ({
  certification_name: "",
});

const emptyIdInfo = (): EmployeeIdInfo => ({
  employee_id_type_id: 0,
  id_number: "",
  is_primary: false,
});

/* ---- Existing-file entry (loaded from API) ---- */
interface ExistingFileEntry {
  id: number;
  file_path: string;
  type_id: number;
  notes: string;
  originalTypeId: number;
  originalNotes: string;
  deleted: boolean;
}

/* ---- New-file entry (being uploaded) ---- */
interface NewFileEntry {
  file?: File;
  type_id: number;
  notes: string;
}

const emptyNewFile = (): NewFileEntry => ({
  type_id: 0,
  notes: "",
});

const ALL_DAYS: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const T_SHIRT_SIZES: TShirtSize[] = ["XS", "S", "M", "L", "XL", "XXL"];

function formatFileTypeLabel(fileType: string) {
  return fileType
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|bmp|svg)$/i;

function ExistingFileThumb({ url }: { url: string }) {
  const isImg = IMAGE_EXTS.test(url.split("?")[0]);
  if (isImg) {
    return (
      <img
        src={url}
        alt="file"
        className="h-8 w-8 rounded object-cover shrink-0 mt-1"
      />
    );
  }
  return (
    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0 mt-1">
      <FileText className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function NewFileThumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImg = IMAGE_EXTS.test(file.name);

  useEffect(() => {
    if (!isImg) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file, isImg]);

  if (isImg && url) {
    return (
      <img
        src={url}
        alt={file.name}
        className="h-8 w-8 rounded object-cover shrink-0 mt-1"
      />
    );
  }
  return (
    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0 mt-1">
      <FileText className="h-4 w-4 text-muted-foreground" />
    </div>
  );
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

  /* -- Required fields -- */
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [ssnNumber, setSsnNumber] = useState("");
  const [empStatusId, setEmpStatusId] = useState<number>(0);
  const [positionId, setPositionId] = useState<number>(0);
  const [employmentType, setEmploymentType] = useState<EmploymentType | "">("");
  const [maritalStatusId, setMaritalStatusId] = useState<number>(0);
  const [tShirtSize, setTShirtSize] = useState<TShirtSize | "">("");

  /* -- Optional arrays -- */
  const [addresses, setAddresses] = useState<EmployeeAddress[]>([]);
  const [availability, setAvailability] = useState<EmployeeAvailability[]>([]);
  const [certificationsInfo, setCertificationsInfo] = useState<EmployeeCertification[]>([]);
  const [contacts, setContacts] = useState<EmployeeContact[]>([]);
  const [existingFiles, setExistingFiles] = useState<ExistingFileEntry[]>([]);
  const [newFiles, setNewFiles] = useState<NewFileEntry[]>([]);
  const [idsInfo, setIdsInfo] = useState<EmployeeIdInfo[]>([]);
  const [notes, setNotes] = useState<EmployeeNote[]>([]);
  const [paymentInfo, setPaymentInfo] = useState<EmployeePaymentInfo[]>([]);
  const [salaryInfo, setSalaryInfo] = useState<EmployeeSalaryInfo[]>([]);
  const [statusHistory, setStatusHistory] = useState<EmployeeStatusHistory[]>([]);

  /* -- UI state -- */
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("personal");

  /* -- Metadata from API -- */
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [employeeStatuses, setEmployeeStatuses] = useState<EmployeeStatusRecord[]>([]);
  const [positions, setPositions] = useState<PositionRecord[]>([]);
  const [employeeFileTypes, setEmployeeFileTypes] = useState<EmployeeFileTypeRecord[]>([]);
  const [maritalStatuses, setMaritalStatuses] = useState<MaritalStatusRecord[]>([]);
  const [employeeIdTypes, setEmployeeIdTypes] = useState<EmployeeIdTypeRecord[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);

  /* -- Populate form from record -- */
  function populateForm(emp: EmployeeRecord) {
    const profile = emp.employee_profile;
    setFirstName(profile?.first_name ?? "");
    setMiddleName(profile?.middle_name ?? "");
    setLastName(profile?.last_name ?? "");
    setBirthDate(profile?.birth_date ?? "");
    setGender((profile?.gender as Gender) || "");
    setSsnNumber(emp.SSN_number ?? "");
    setEmpStatusId(emp.emp_status_id);
    setPositionId(emp.position_id);
    setEmploymentType((emp.employement_type as EmploymentType) || "");
    setMaritalStatusId(emp.marital_status_id ?? 0);
    setTShirtSize((emp.T_shirt_size as TShirtSize) || "");
    setAddresses((emp.employee_addresses ?? []).map((a) => ({ ...a, is_primary: !!a.is_primary })));
    setAvailability(
      (emp.employee_availability ?? []).map((av) => ({
        ...av,
        notes: av.notes ?? null,
        days: Array.isArray(av.days)
          ? (av.days as Array<{ day_of_week?: string } | string>)
              .map((d) => (typeof d === "string" ? d : (d.day_of_week ?? "")).toLowerCase())
              .filter(Boolean) as DayOfWeek[]
          : [],
      })),
    );
    setContacts((emp.employee_contacts ?? []).map((c) => ({ ...c, is_primary: !!c.is_primary })));
    setExistingFiles(
      (emp.employee_files ?? []).map((f) => ({
        id: f.id!,
        file_path: f.file_path ?? "",
        type_id: f.type_id ?? 0,
        notes: f.notes ?? "",
        originalTypeId: f.type_id ?? 0,
        originalNotes: f.notes ?? "",
        deleted: false,
      })),
    );
    setNewFiles([]);
    setCertificationsInfo(
      (emp.created_certifications_info ?? []).map((c) => ({
        certification_name: c.certification_name,
      })),
    );
    setIdsInfo(
      (emp.employee_ids ?? []).map((id) => ({
        employee_id_type_id: id.employee_id_type_id,
        id_number: String(id.id_number),
        is_primary: !!id.is_primary,
      })),
    );
    setNotes(emp.employee_notes ?? []);
    setPaymentInfo(
      (emp.employee_payment_info ?? []).map((p) => ({
        ...p,
        routing_number: String(p.routing_number ?? ""),
        account_number: String(p.account_number ?? ""),
        account_type: (p.account_type === "savings" ? "saving" : p.account_type) as AccountType,
        is_primary: !!p.is_primary,
      })),
    );
    setSalaryInfo(emp.employee_salary_info ?? []);
    setStatusHistory(emp.employee_status_history ?? []);
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
      .getEmployeeDetails(selectedStore.storeId, employeeId)
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

  /* -- Load metadata -- */
  useEffect(() => {
    if (!open || !selectedStore?.storeId) return;
    let cancelled = false;
    setIsLoadingMeta(true);
    hiringService
      .getCreateEmployeePage(selectedStore.storeId)
      .then((data) => {
        if (!cancelled) {
          setShifts(data.shifts);
          setEmployeeStatuses(data.employeeStatuses);
          setPositions(data.positions);
          setEmployeeFileTypes(data.employeeFileTypes);
          setMaritalStatuses(data.employeeMaritalStatuses);
          setEmployeeIdTypes(data.employeeIdTypes);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingMeta(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selectedStore?.storeId]);

  function handleClose() {
    onOpenChange(false);
  }

  /* -- Validation -- */
  const isFormValid =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    ssnNumber.trim().length === 9 &&
    empStatusId > 0 &&
    positionId > 0 &&
    employmentType !== "" &&
    maritalStatusId > 0;

  /* -- Submit -- */
  async function handleSubmit() {
    if (!isFormValid) return;
    if (!selectedStore?.storeId || !employeeId) {
      setSubmitError("No store or employee selected.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const deletedImage = existingFiles.filter((f) => f.deleted).map((f) => f.id);
      const keptImage = existingFiles
        .filter(
          (f) =>
            !f.deleted && f.type_id === f.originalTypeId && f.notes === f.originalNotes,
        )
        .map((f) => f.id);
      const updatedImageItems = existingFiles
        .filter(
          (f) =>
            !f.deleted && (f.type_id !== f.originalTypeId || f.notes !== f.originalNotes),
        )
        .map((f) => ({ file: f.file_path, type_id: f.type_id, notes: f.notes || null }));
      const uploadedFiles = newFiles
        .filter((f) => f.file instanceof File)
        .map((f) => ({ file: f.file as File, type_id: f.type_id, notes: f.notes }));

      await employeeService.updateEmployee(selectedStore.storeId, employeeId, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        ...(middleName.trim() ? { middle_name: middleName.trim() } : {}),
        ...(birthDate ? { birth_date: birthDate } : { birth_date: "" }),
        gender: (gender as Gender) || "other",
        ssn_number: ssnNumber.trim(),
        emp_status_id: empStatusId,
        position_id: positionId,
        employement_type: employmentType as EmploymentType,
        marital_status_id: maritalStatusId,
        ...(tShirtSize ? { T_shirt_size: tShirtSize as TShirtSize } : {}),
        ...(addresses.length > 0 ? { addresses } : {}),
        ...(availability.length > 0 ? { availability } : {}),
        ...(certificationsInfo.length > 0
          ? {
              certifications_info: certificationsInfo.filter((c) =>
                c.certification_name.trim(),
              ),
            }
          : {}),
        ...(contacts.length > 0 ? { contacts } : {}),
        ...(uploadedFiles.length > 0 ? { files: uploadedFiles } : {}),
        ...(deletedImage.length > 0 ? { deletedImage } : {}),
        ...(keptImage.length > 0 ? { keptImage } : {}),
        ...(updatedImageItems.length > 0 ? { updatedImage: updatedImageItems } : {}),
        ...(idsInfo.length > 0
          ? {
              ids_info: idsInfo.filter(
                (id) => id.employee_id_type_id > 0 && id.id_number.trim(),
              ),
            }
          : {}),
        ...(notes.length > 0 ? { notes } : {}),
        ...(paymentInfo.length > 0 ? { payment_info: paymentInfo } : {}),
        ...(salaryInfo.length > 0 ? { salary_info: salaryInfo } : {}),
        ...(statusHistory.length > 0 ? { status_history: statusHistory } : {}),
      });

      toast.success("Employee updated successfully.");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      if (err instanceof Error && err.name === "CanceledError") return;
      setSubmitError(
        err instanceof Error ? err.message : "Failed to update employee.",
      );
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
  function renderBasicTab() {
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
              maxLength={30}
              placeholder="First name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Middle Name</Label>
            <Input
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              maxLength={30}
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
              maxLength={30}
              placeholder="Last name"
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              SSN Number <span className="text-destructive">*</span>
            </Label>
            <Input
              value={ssnNumber}
              onChange={(e) => setSsnNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
              placeholder="9-digit SSN"
              maxLength={9}
            />
            {ssnNumber.length > 0 && ssnNumber.length < 9 && (
              <p className="text-xs text-destructive">{9 - ssnNumber.length} more digits required</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Birth Date</Label>
            <Input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Gender</Label>
            <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>
              Employee Status <span className="text-destructive">*</span>
            </Label>
            <Select
              value={empStatusId ? String(empStatusId) : ""}
              onValueChange={(v) => setEmpStatusId(parseInt(v, 10))}
              disabled={isLoadingMeta}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingMeta ? "Loading..." : "Select status"} />
              </SelectTrigger>
              <SelectContent>
                {employeeStatuses.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.emp_status.charAt(0).toUpperCase() + s.emp_status.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>
              Position <span className="text-destructive">*</span>
            </Label>
            <Select
              value={positionId ? String(positionId) : ""}
              onValueChange={(v) => setPositionId(parseInt(v, 10))}
              disabled={isLoadingMeta}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingMeta ? "Loading..." : "Select position"} />
              </SelectTrigger>
              <SelectContent>
                {positions.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.position_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>
              Employment Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={employmentType}
              onValueChange={(v) => setEmploymentType(v as EmploymentType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="W2">W-2</SelectItem>
                <SelectItem value="1099">1099</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>
              Marital Status <span className="text-destructive">*</span>
            </Label>
            <Select
              value={maritalStatusId ? String(maritalStatusId) : ""}
              onValueChange={(v) => setMaritalStatusId(parseInt(v, 10))}
              disabled={isLoadingMeta}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingMeta ? "Loading..." : "Select marital status"} />
              </SelectTrigger>
              <SelectContent>
                {maritalStatuses.map((ms) => (
                  <SelectItem key={ms.id} value={String(ms.id)}>
                    {ms.marital_status_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>T-Shirt Size</Label>
            <Select
              value={tShirtSize}
              onValueChange={(v) => setTShirtSize(v as TShirtSize)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                {T_SHIRT_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }

  /* 2) Contacts */
  function renderContactsTab() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Add email or phone contacts.</p>
          <AddButton label="Add Contact" onClick={() => addItem(setContacts, emptyContact)} />
        </div>
        {contacts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No contacts added.</p>
        )}
        {contacts.map((c, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Contact {idx + 1}</Badge>
              <RemoveButton onClick={() => removeItem(setContacts, idx)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Type <span className="text-destructive">*</span></Label>
                <Select
                  value={c.contact_type ?? "phone"}
                  onValueChange={(v) =>
                    updateItem(setContacts, idx, "contact_type", v as ContactType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Value <span className="text-destructive">*</span></Label>
                <Input
                  value={c.contact_value ?? ""}
                  onChange={(e) =>
                    updateItem(setContacts, idx, "contact_value", e.target.value)
                  }
                  placeholder={c.contact_type === "email" ? "email@example.com" : "+1 555 000 0000"}
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

  /* 3) Addresses */
  function renderAddressesTab() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Employee addresses.</p>
          <AddButton label="Add Address" onClick={() => addItem(setAddresses, emptyAddress)} />
        </div>
        {addresses.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No addresses added.</p>
        )}
        {addresses.map((a, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Address {idx + 1}</Badge>
              <RemoveButton onClick={() => removeItem(setAddresses, idx)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address Line 1 <span className="text-destructive">*</span></Label>
                <Input
                  value={a.address_line_1 ?? ""}
                  onChange={(e) => updateItem(setAddresses, idx, "address_line_1", e.target.value)}
                  maxLength={255}
                  placeholder="123 Main St"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address Line 2</Label>
                <Input
                  value={a.address_line_2 ?? ""}
                  onChange={(e) =>
                    updateItem(setAddresses, idx, "address_line_2", e.target.value || null)
                  }
                  maxLength={255}
                  placeholder="Apt, suite, unit, etc."
                />
              </div>
              <div className="space-y-1.5">
                <Label>City <span className="text-destructive">*</span></Label>
                <Input
                  value={a.city ?? ""}
                  onChange={(e) => updateItem(setAddresses, idx, "city", e.target.value)}
                  maxLength={100}
                  placeholder="City"
                />
              </div>
              <div className="space-y-1.5">
                <Label>State <span className="text-destructive">*</span></Label>
                <Input
                  value={a.state ?? ""}
                  onChange={(e) => updateItem(setAddresses, idx, "state", e.target.value)}
                  maxLength={100}
                  placeholder="State"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Country <span className="text-destructive">*</span></Label>
                <Input
                  value={a.country ?? ""}
                  onChange={(e) => updateItem(setAddresses, idx, "country", e.target.value)}
                  maxLength={100}
                  placeholder="Country"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Zip Code</Label>
                <Input
                  value={a.zip_code ?? ""}
                  onChange={(e) =>
                    updateItem(setAddresses, idx, "zip_code", e.target.value || null)
                  }
                  maxLength={20}
                  placeholder="12345"
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

  /* 4) Availability */
  function renderAvailabilityTab() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Shifts and day availability.</p>
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
            <div className="space-y-2">
              <Label>Shift <span className="text-destructive">*</span></Label>
              <Select
                value={av.shift_id && av.shift_id > 0 ? av.shift_id.toString() : ""}
                onValueChange={(v) =>
                  updateItem(setAvailability, idx, "shift_id", parseInt(v, 10))
                }
                disabled={isLoadingMeta}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingMeta ? "Loading shifts..." : "Select a shift"} />
                </SelectTrigger>
                <SelectContent>
                  {shifts.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.shift}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Days <span className="text-destructive">*</span></Label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_DAYS.map((day) => {
                  const selected = av.days?.includes(day) ?? false;
                  return (
                    <Button
                      key={day}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      className="h-8 px-3 text-xs capitalize"
                      onClick={() => {
                        const current = av.days ?? [];
                        const next = selected
                          ? current.filter((d) => d !== day)
                          : [...current, day];
                        updateItem(setAvailability, idx, "days", next as DayOfWeek[]);
                      }}
                    >
                      {day.slice(0, 3)}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={av.notes ?? ""}
                onChange={(e) =>
                  updateItem(setAvailability, idx, "notes", e.target.value || null)
                }
                placeholder="Optional notes"
                rows={2}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* 5) Payment Info */
  function renderPaymentTab() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Bank account details.</p>
          <AddButton label="Add Account" onClick={() => addItem(setPaymentInfo, emptyPayment)} />
        </div>
        {paymentInfo.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No payment info added.</p>
        )}
        {paymentInfo.map((p, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Account {idx + 1}</Badge>
              <RemoveButton onClick={() => removeItem(setPaymentInfo, idx)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Account Number <span className="text-destructive">*</span></Label>
                <Input
                  value={p.account_number ?? ""}
                  onChange={(e) =>
                    updateItem(setPaymentInfo, idx, "account_number", e.target.value)
                  }
                  maxLength={50}
                  placeholder="Account number"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Routing Number <span className="text-destructive">*</span></Label>
                <Input
                  value={p.routing_number ?? ""}
                  onChange={(e) =>
                    updateItem(setPaymentInfo, idx, "routing_number", e.target.value)
                  }
                  maxLength={50}
                  placeholder="Routing number"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Account Type <span className="text-destructive">*</span></Label>
                <Select
                  value={p.account_type ?? "checking"}
                  onValueChange={(v) =>
                    updateItem(setPaymentInfo, idx, "account_type", v as AccountType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Checking</SelectItem>
                    <SelectItem value="saving">Saving</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <Checkbox
                  checked={p.is_primary ?? false}
                  onCheckedChange={(v) => updateItem(setPaymentInfo, idx, "is_primary", !!v)}
                />
                <Label className="text-sm">Primary</Label>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* 6) Salary */
  function renderSalaryTab() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Salary information.</p>
          <AddButton label="Add Salary" onClick={() => addItem(setSalaryInfo, emptySalary)} />
        </div>
        {salaryInfo.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No salary info added.</p>
        )}
        {salaryInfo.map((s, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Salary {idx + 1}</Badge>
              <RemoveButton onClick={() => removeItem(setSalaryInfo, idx)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Base Pay</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={s.base_pay || ""}
                  onChange={(e) =>
                    updateItem(setSalaryInfo, idx, "base_pay", parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Performance Pay</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={s.performance_pay || ""}
                  onChange={(e) =>
                    updateItem(
                      setSalaryInfo,
                      idx,
                      "performance_pay",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Salary Date</Label>
                <Input
                  type="date"
                  value={s.salary_date ?? ""}
                  onChange={(e) => updateItem(setSalaryInfo, idx, "salary_date", e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* 7) Employee IDs */
  function renderIdsTab() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Employee ID references (e.g., Paychecks ID, Altemitrix ID).
          </p>
          <AddButton label="Add ID" onClick={() => addItem(setIdsInfo, emptyIdInfo)} />
        </div>
        {idsInfo.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No IDs added.</p>
        )}
        {idsInfo.map((id, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">ID {idx + 1}</Badge>
              <RemoveButton onClick={() => removeItem(setIdsInfo, idx)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>ID Type <span className="text-destructive">*</span></Label>
                <Select
                  value={id.employee_id_type_id > 0 ? String(id.employee_id_type_id) : ""}
                  onValueChange={(v) =>
                    updateItem(setIdsInfo, idx, "employee_id_type_id", parseInt(v, 10))
                  }
                  disabled={isLoadingMeta}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingMeta ? "Loading..." : "Select ID type"} />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeIdTypes.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.type_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>ID Number <span className="text-destructive">*</span></Label>
                <Input
                  value={id.id_number}
                  onChange={(e) => updateItem(setIdsInfo, idx, "id_number", e.target.value)}
                  maxLength={255}
                  placeholder="e.g. 123456"
                />
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <Checkbox
                  checked={id.is_primary ?? false}
                  onCheckedChange={(v) => updateItem(setIdsInfo, idx, "is_primary", !!v)}
                />
                <Label className="text-sm">Primary</Label>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* 8) Notes, Files, Certifications & Status History */
  function renderNotesTab() {
    return (
      <div className="space-y-6">
        {/* Files */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Files</p>
            <AddButton
              label="Add File"
              onClick={() => setNewFiles((prev) => [...prev, emptyNewFile()])}
            />
          </div>
          {existingFiles.length === 0 && newFiles.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No files added.</p>
          )}
          {existingFiles.map((f, idx) => (
            <div
              key={f.id}
              className={`rounded-lg border p-4 space-y-3 transition-opacity ${f.deleted ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={f.deleted ? "destructive" : "secondary"}>
                    {f.deleted ? "Deleted" : `File #${f.id}`}
                  </Badge>
                  {!f.deleted &&
                    (f.type_id !== f.originalTypeId || f.notes !== f.originalNotes) && (
                      <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">
                        Modified
                      </Badge>
                    )}
                </div>
                {f.deleted ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setExistingFiles((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, deleted: false } : item,
                        ),
                      )
                    }
                  >
                    Restore
                  </Button>
                ) : (
                  <RemoveButton
                    onClick={() =>
                      setExistingFiles((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, deleted: true } : item,
                        ),
                      )
                    }
                  />
                )}
              </div>
              <div className="flex items-start gap-2">
                <ExistingFileThumb url={f.file_path} />
                <p className="text-xs text-muted-foreground truncate pt-2">
                  {decodeURIComponent(f.file_path.split("/").pop() ?? "file")}
                </p>
              </div>
              {!f.deleted && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>File Type</Label>
                    <Select
                      value={f.type_id > 0 ? String(f.type_id) : ""}
                      onValueChange={(v) =>
                        setExistingFiles((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, type_id: parseInt(v, 10) || 0 } : item,
                          ),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select file type" />
                      </SelectTrigger>
                      <SelectContent>
                        {employeeFileTypes.map((ft) => (
                          <SelectItem key={ft.id} value={String(ft.id)}>
                            {formatFileTypeLabel(ft.file_type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Input
                      value={f.notes}
                      onChange={(e) =>
                        setExistingFiles((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, notes: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder="Optional notes"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
          {newFiles.map((f, idx) => (
            <div key={idx} className="rounded-lg border border-dashed p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline">New File {idx + 1}</Badge>
                <RemoveButton
                  onClick={() => setNewFiles((prev) => prev.filter((_, i) => i !== idx))}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-3">
                  <Label>File <span className="text-destructive">*</span></Label>
                  <div className="flex items-start gap-2">
                    {f.file instanceof File && <NewFileThumb file={f.file} />}
                    <Input
                      type="file"
                      className="flex-1"
                      onChange={(e) => {
                        const picked = e.target.files?.[0];
                        setNewFiles((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, file: picked } : item,
                          ),
                        );
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>File Type <span className="text-destructive">*</span></Label>
                  <Select
                    value={f.type_id > 0 ? String(f.type_id) : ""}
                    onValueChange={(v) =>
                      setNewFiles((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, type_id: parseInt(v, 10) || 0 } : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select file type" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeeFileTypes.map((ft) => (
                        <SelectItem key={ft.id} value={String(ft.id)}>
                          {formatFileTypeLabel(ft.file_type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Notes</Label>
                  <Input
                    value={f.notes}
                    onChange={(e) =>
                      setNewFiles((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, notes: e.target.value } : item,
                        ),
                      )
                    }
                    placeholder="Optional notes"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Certifications */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Certifications</p>
            <AddButton
              label="Add Certification"
              onClick={() => addItem(setCertificationsInfo, emptyCertification)}
            />
          </div>
          {certificationsInfo.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No certifications added.</p>
          )}
          {certificationsInfo.map((cert, idx) => (
            <div key={idx} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">Certification {idx + 1}</Badge>
                <RemoveButton onClick={() => removeItem(setCertificationsInfo, idx)} />
              </div>
              <div className="space-y-1.5">
                <Label>Certification Name <span className="text-destructive">*</span></Label>
                <Input
                  value={cert.certification_name}
                  onChange={(e) =>
                    updateItem(setCertificationsInfo, idx, "certification_name", e.target.value)
                  }
                  maxLength={255}
                  placeholder="e.g. Food Handler Certificate"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Notes</p>
            <AddButton label="Add Note" onClick={() => addItem(setNotes, emptyNote)} />
          </div>
          {notes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No notes added.</p>
          )}
          {notes.map((n, idx) => (
            <div key={idx} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">Note {idx + 1}</Badge>
                <RemoveButton onClick={() => removeItem(setNotes, idx)} />
              </div>
              <Textarea
                value={n.notes ?? ""}
                onChange={(e) => updateItem(setNotes, idx, "notes", e.target.value)}
                placeholder="Write a note..."
                rows={3}
              />
            </div>
          ))}
        </div>

        {/* Status History */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Status History</p>
            <AddButton
              label="Add Status"
              onClick={() => addItem(setStatusHistory, emptyStatusHistory)}
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Status Type</Label>
                  <Select
                    value={sh.status_type_id && sh.status_type_id > 0 ? String(sh.status_type_id) : ""}
                    onValueChange={(v) =>
                      updateItem(setStatusHistory, idx, "status_type_id", parseInt(v) || 0)
                    }
                    disabled={isLoadingMeta}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status type" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeeStatuses.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.emp_status.charAt(0).toUpperCase() + s.emp_status.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status Date</Label>
                  <Input
                    type="date"
                    value={sh.status_date ?? ""}
                    onChange={(e) =>
                      updateItem(setStatusHistory, idx, "status_date", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-3">
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
      </div>
    );
  }

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
              <span className="text-sm font-normal text-muted-foreground">
                #{employeeId}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Update employee details for {selectedStore?.name ?? "your store"}.
          </DialogDescription>
        </DialogHeader>

        {/* Load error */}
        {loadError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {/* Submit error */}
        {submitError && !loadError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        {/* Loading overlay */}
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
              <TabsTrigger className="text-xs" value="personal">Personal Info</TabsTrigger>
              <TabsTrigger className="text-xs" value="availability">Availability</TabsTrigger>
              <TabsTrigger className="text-xs" value="compensation">Compensation</TabsTrigger>
              <TabsTrigger className="text-xs" value="notes">Notes &amp; Files</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 min-h-0 mt-4">
              <div className="pe-3 pb-4">

                <TabsContent value="personal" className="mt-0 space-y-8">
                  <div className="space-y-4">
                    <SectionDivider label="Basic Information" />
                    {renderBasicTab()}
                  </div>
                  <div className="space-y-4">
                    <SectionDivider label="Contacts" />
                    {renderContactsTab()}
                  </div>
                  <div className="space-y-4">
                    <SectionDivider label="Addresses" />
                    {renderAddressesTab()}
                  </div>
                </TabsContent>

                <TabsContent value="availability" className="mt-0">
                  {renderAvailabilityTab()}
                </TabsContent>

                <TabsContent value="compensation" className="mt-0 space-y-8">
                  <div className="space-y-4">
                    <SectionDivider label="Bank Accounts" />
                    {renderPaymentTab()}
                  </div>
                  <div className="space-y-4">
                    <SectionDivider label="Salary" />
                    {renderSalaryTab()}
                  </div>
                  <div className="space-y-4">
                    <SectionDivider label="Employee IDs" />
                    {renderIdsTab()}
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="mt-0">
                  {renderNotesTab()}
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