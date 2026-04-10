"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  UserPlus,
  AlertCircle,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { toast } from "sonner";
import { employeeService } from "@/lib/api/services/employee.service";
import { hiringService } from "@/lib/api/services/hiring.service";
import { useSelectedStoreStore } from "@/lib/store/selected-store.store";
import type {
  Gender,
  DayOfWeek,
  ContactType,
  AccountType,
  LegalStatus,
  EmployeeAddress,
  EmployeeAvailability,
  EmployeeContact,
  EmployeeFile,
  EmployeeNote,
  EmployeePaycheckInfo,
  EmployeePaymentInfo,
  EmployeeSalaryInfo,
  EmployeeStatusHistory,
} from "@/types/employee.types";
import type {
  ShiftRecord,
  EmployeeStatusRecord,
  PositionRecord,
  EmployeeFileTypeRecord,
} from "@/types/hiring.types";

interface CreateEmployeeDialogProps {
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

const emptyFile = (): EmployeeFile => ({
  file: undefined,
  type_id: 0,
  notes: "",
});

const emptyNote = (): EmployeeNote => ({ notes: "" });

const emptyPaycheck = (): EmployeePaycheckInfo => ({
  is_primary: false,
  legal_status: "w2",
  paychecks_id: 0,
});

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

const ALL_DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function formatFileTypeLabel(fileType: string) {
  return fileType
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export function CreateEmployeeDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateEmployeeDialogProps) {
  const { selectedStore } = useSelectedStoreStore();

  /* ── Required fields ── */
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [ssnNumber, setSsnNumber] = useState("");
  const [empStatusId, setEmpStatusId] = useState<number>(0);
  const [positionId, setPositionId] = useState<number>(0);

  /* ── Optional arrays ── */
  const [addresses, setAddresses] = useState<EmployeeAddress[]>([]);
  const [availability, setAvailability] = useState<EmployeeAvailability[]>([]);
  const [contacts, setContacts] = useState<EmployeeContact[]>([]);
  const [files, setFiles] = useState<EmployeeFile[]>([]);
  const [notes, setNotes] = useState<EmployeeNote[]>([]);
  const [paychecksInfo, setPaychecksInfo] = useState<EmployeePaycheckInfo[]>([]);
  const [paymentInfo, setPaymentInfo] = useState<EmployeePaymentInfo[]>([]);
  const [salaryInfo, setSalaryInfo] = useState<EmployeeSalaryInfo[]>([]);
  const [statusHistory, setStatusHistory] = useState<EmployeeStatusHistory[]>([]);

  /* ── UI state ── */
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");

  /* ── Shifts from API ── */
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [employeeStatuses, setEmployeeStatuses] = useState<EmployeeStatusRecord[]>([]);
  const [positions, setPositions] = useState<PositionRecord[]>([]);
  const [employeeFileTypes, setEmployeeFileTypes] = useState<EmployeeFileTypeRecord[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(false);

  useEffect(() => {
    if (!open || !selectedStore?.storeId) return;
    let cancelled = false;
    setIsLoadingShifts(true);
    hiringService
      .getCreateEmployeePage(selectedStore.storeId)
      .then((data) => {
        if (!cancelled) {
          setShifts(data.shifts);
          setEmployeeStatuses(data.employeeStatuses);
          setPositions(data.positions);
          setEmployeeFileTypes(data.employeeFileTypes);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingShifts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selectedStore?.storeId]);

  /* ── Dirty check ── */
  const isDirty =
    firstName !== "" ||
    lastName !== "" ||
    middleName !== "" ||
    birthDate !== "" ||
    gender !== "" ||
    ssnNumber !== "" ||
    empStatusId !== 0 ||
    positionId !== 0 ||
    addresses.length > 0 ||
    availability.length > 0 ||
    contacts.length > 0 ||
    files.length > 0 ||
    notes.length > 0 ||
    paychecksInfo.length > 0 ||
    paymentInfo.length > 0 ||
    salaryInfo.length > 0 ||
    statusHistory.length > 0;

  function resetForm() {
    setFirstName("");
    setLastName("");
    setMiddleName("");
    setBirthDate("");
    setGender("");
    setSsnNumber("");
    setEmpStatusId(0);
    setPositionId(0);
    setAddresses([]);
    setAvailability([]);
    setContacts([]);
    setFiles([]);
    setNotes([]);
    setPaychecksInfo([]);
    setPaymentInfo([]);
    setSalaryInfo([]);
    setStatusHistory([]);
    setError(null);
    setActiveTab("personal");
  }

  function handleClose() {
    if (isDirty && !isSubmitting) {
      setShowConfirmExit(true);
      return;
    }
    resetForm();
    onOpenChange(false);
  }

  function confirmExit() {
    setShowConfirmExit(false);
    resetForm();
    onOpenChange(false);
  }

  /* ── Validation ── */
  const isFormValid =
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    birthDate.trim() !== "" &&
    gender !== "" &&
    ssnNumber.trim() !== "" &&
    empStatusId > 0 &&
    positionId > 0;

  /* ── Submit ── */
  async function handleSubmit() {
    if (!isFormValid) return;
    if (!selectedStore?.storeId) {
      setError("No store selected.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await employeeService.createEmployee(selectedStore.storeId, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        ...(middleName.trim() ? { middle_name: middleName.trim() } : {}),
        birth_date: birthDate,
        gender: gender as Gender,
        ssn_number: ssnNumber.trim(),
        emp_status_id: empStatusId,
        position_id: positionId,
        ...(addresses.length > 0 ? { addresses } : {}),
        ...(availability.length > 0 ? { availability } : {}),
        ...(contacts.length > 0 ? { contacts } : {}),
        ...(files.length > 0 ? { files } : {}),
        ...(notes.length > 0 ? { notes } : {}),
        ...(paychecksInfo.length > 0 ? { paychecks_info: paychecksInfo } : {}),
        ...(paymentInfo.length > 0 ? { payment_info: paymentInfo } : {}),
        ...(salaryInfo.length > 0 ? { salary_info: salaryInfo } : {}),
        ...(statusHistory.length > 0 ? { status_history: statusHistory } : {}),
      });

      toast.success("Employee created successfully.");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      if (err instanceof Error && err.name === "CanceledError") return;
      setError(
        err instanceof Error ? err.message : "Failed to create employee.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  /* ── Generic array helpers ── */
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

  /* helper to render an "Add" button */
  function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={onClick}>
        <Plus className="me-1 h-4 w-4" />
        {label}
      </Button>
    );
  }

  /* helper to render a "Remove" button */
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

  /* helper to render a section divider with label */
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
              placeholder="First name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Middle Name</Label>
            <Input
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
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
              placeholder="Last name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Birth Date <span className="text-destructive">*</span>
            </Label>
            <Input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="max-w-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Gender <span className="text-destructive">*</span>
            </Label>
            <Select
              value={gender}
              onValueChange={(v) => setGender(v as Gender)}
            >
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
              SSN Number <span className="text-destructive">*</span>
            </Label>
            <Input
              value={ssnNumber}
              onChange={(e) => setSsnNumber(e.target.value)}
              placeholder="SSN"
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Employee Status <span className="text-destructive">*</span>
            </Label>
            <Select
              value={empStatusId ? String(empStatusId) : ""}
              onValueChange={(v) => setEmpStatusId(parseInt(v, 10))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select employee status" />
              </SelectTrigger>
              <SelectContent>
                {employeeStatuses.map((status) => (
                  <SelectItem key={status.id} value={String(status.id)}>
                    {status.emp_status}
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
            >
              <SelectTrigger>
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                {positions.map((position) => (
                  <SelectItem key={position.id} value={String(position.id)}>
                    {position.position_name}
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
          <p className="text-sm text-muted-foreground">
            Add email or phone contacts.
          </p>
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
                <Label>Type</Label>
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
                <Label>Value</Label>
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
                  onCheckedChange={(v) =>
                    updateItem(setContacts, idx, "is_primary", !!v)
                  }
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
                <Label>Address Line 1</Label>
                <Input
                  value={a.address_line_1 ?? ""}
                  onChange={(e) =>
                    updateItem(setAddresses, idx, "address_line_1", e.target.value)
                  }
                  placeholder="123 Main St"
                />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input
                  value={a.city ?? ""}
                  onChange={(e) => updateItem(setAddresses, idx, "city", e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input
                  value={a.state ?? ""}
                  onChange={(e) => updateItem(setAddresses, idx, "state", e.target.value)}
                  placeholder="State"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input
                  value={a.country ?? ""}
                  onChange={(e) => updateItem(setAddresses, idx, "country", e.target.value)}
                  placeholder="Country"
                />
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <Checkbox
                  checked={a.is_primary ?? false}
                  onCheckedChange={(v) =>
                    updateItem(setAddresses, idx, "is_primary", !!v)
                  }
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
          <p className="text-sm text-muted-foreground">
            Shifts and day availability.
          </p>
          <AddButton
            label="Add Availability"
            onClick={() => addItem(setAvailability, emptyAvailability)}
          />
        </div>
        {availability.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No availability added.
          </p>
        )}
        {availability.map((av, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Availability {idx + 1}</Badge>
              <RemoveButton onClick={() => removeItem(setAvailability, idx)} />
            </div>
            <div className="space-y-2">
              <Label>Shift</Label>
              <Select
                value={av.shift_id && av.shift_id > 0 ? av.shift_id.toString() : ""}
                onValueChange={(v) =>
                  updateItem(setAvailability, idx, "shift_id", parseInt(v, 10))
                }
                disabled={isLoadingShifts}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={isLoadingShifts ? "Loading shifts…" : "Select a shift"}
                  />
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
              <Label>Days</Label>
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
                <Label>Account Number</Label>
                <Input
                  value={p.account_number ?? ""}
                  onChange={(e) =>
                    updateItem(setPaymentInfo, idx, "account_number", e.target.value)
                  }
                  placeholder="Account number"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Routing Number</Label>
                <Input
                  value={p.routing_number ?? ""}
                  onChange={(e) =>
                    updateItem(setPaymentInfo, idx, "routing_number", e.target.value)
                  }
                  placeholder="Routing number"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Account Type</Label>
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
                    <SelectItem value="savings">Savings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <Checkbox
                  checked={p.is_primary ?? false}
                  onCheckedChange={(v) =>
                    updateItem(setPaymentInfo, idx, "is_primary", !!v)
                  }
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
                  onChange={(e) =>
                    updateItem(setSalaryInfo, idx, "salary_date", e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* 7) Paychecks */
  function renderPaychecksTab() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Paycheck configuration.</p>
          <AddButton label="Add Paycheck" onClick={() => addItem(setPaychecksInfo, emptyPaycheck)} />
        </div>
        {paychecksInfo.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No paycheck info added.</p>
        )}
        {paychecksInfo.map((pc, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Paycheck {idx + 1}</Badge>
              <RemoveButton onClick={() => removeItem(setPaychecksInfo, idx)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Paychecks ID</Label>
                <Input
                  type="number"
                  min={1}
                  value={pc.paychecks_id || ""}
                  onChange={(e) =>
                    updateItem(
                      setPaychecksInfo,
                      idx,
                      "paychecks_id",
                      parseInt(e.target.value) || 0,
                    )
                  }
                  placeholder="e.g. 1"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Legal Status</Label>
                <Select
                  value={pc.legal_status ?? "w2"}
                  onValueChange={(v) =>
                    updateItem(setPaychecksInfo, idx, "legal_status", v as LegalStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="w2">W-2</SelectItem>
                    <SelectItem value="1099">1099</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <Checkbox
                  checked={pc.is_primary ?? false}
                  onCheckedChange={(v) =>
                    updateItem(setPaychecksInfo, idx, "is_primary", !!v)
                  }
                />
                <Label className="text-sm">Primary</Label>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* 8) Notes & Status History */
  function renderNotesTab() {
    return (
      <div className="space-y-6">
        {/* Files */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Files</p>
            <AddButton label="Add File" onClick={() => addItem(setFiles, emptyFile)} />
          </div>
          {files.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No files added.</p>
          )}
          {files.map((f, idx) => (
            <div key={idx} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">File {idx + 1}</Badge>
                <RemoveButton onClick={() => removeItem(setFiles, idx)} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-3">
                  <Label>File <span className="text-destructive">*</span></Label>
                  <Input
                    type="file"
                    onChange={(e) => {
                      const picked = e.target.files?.[0];
                      if (!picked) return;
                      updateItem(setFiles, idx, "file", picked);
                    }}
                  />
                  {typeof f.file === "string" && f.file && (
                    <p className="text-xs text-muted-foreground">Existing file attached</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>File Type <span className="text-destructive">*</span></Label>
                  <Select
                    value={f.type_id && f.type_id > 0 ? String(f.type_id) : ""}
                    onValueChange={(v) => updateItem(setFiles, idx, "type_id", parseInt(v, 10) || 0)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select file type" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeeFileTypes.map((fileType) => (
                        <SelectItem key={fileType.id} value={String(fileType.id)}>
                          {formatFileTypeLabel(fileType.file_type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Notes</Label>
                  <Input
                    value={f.notes ?? ""}
                    onChange={(e) => updateItem(setFiles, idx, "notes", e.target.value)}
                    placeholder="Optional notes"
                  />
                </div>
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
                placeholder="Write a note…"
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
            <p className="text-sm text-muted-foreground text-center py-4">
              No status history added.
            </p>
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
                      updateItem(
                        setStatusHistory,
                        idx,
                        "status_type_id",
                        parseInt(v) || 0,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status type" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeeStatuses.map((status) => (
                        <SelectItem key={status.id} value={String(status.id)}>
                          {status.emp_status}
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
                    onChange={(e) =>
                      updateItem(setStatusHistory, idx, "notes", e.target.value)
                    }
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
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="flex h-[92vh] w-[95vw] max-w-[calc(100%-1rem)] flex-col text-[13px] sm:w-[92vw] sm:max-w-280 **:data-[slot=label]:text-xs **:data-[slot=input]:text-sm **:data-[slot=textarea]:text-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Add Employee
            </DialogTitle>
            <DialogDescription>
              Create a new employee for{" "}
              {selectedStore?.name ?? "your store"}.
            </DialogDescription>
          </DialogHeader>

          {/* Error banner */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="grid h-9 w-full grid-cols-4 p-1">
              <TabsTrigger className="text-xs" value="personal">Personal Info</TabsTrigger>
              <TabsTrigger className="text-xs" value="availability">Availability</TabsTrigger>
              <TabsTrigger className="text-xs" value="compensation">Compensation</TabsTrigger>
              <TabsTrigger className="text-xs" value="notes">Notes &amp; Status</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 min-h-0 mt-4">
              <div className="pe-3 pb-4">

                {/* ── Tab 1: Personal Info (Basic + Contacts + Addresses) ── */}
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

                {/* ── Tab 2: Availability ── */}
                <TabsContent value="availability" className="mt-0">
                  {renderAvailabilityTab()}
                </TabsContent>

                {/* ── Tab 3: Compensation (Payment + Salary + Paychecks) ── */}
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
                    <SectionDivider label="Paychecks" />
                    {renderPaychecksTab()}
                  </div>
                </TabsContent>

                {/* ── Tab 4: Notes & Status ── */}
                <TabsContent value="notes" className="mt-0">
                  {renderNotesTab()}
                </TabsContent>

              </div>
            </ScrollArea>
          </Tabs>

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
              disabled={!isFormValid || isSubmitting}
            >
              {isSubmitting ? "Submitting…" : "Create Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exit confirmation */}
      <AlertDialog open={showConfirmExit} onOpenChange={setShowConfirmExit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. If you close now, all entered data will
              be lost. Are you sure you want to exit?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmExit}
            >
              Discard &amp; Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
