"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { StoreMultiSelect, type StoreOption } from "@/components/business-reports/store-multi-select";
import { useAuthStore } from "@/lib/auth/auth.store";
import {
  maintenanceTicketsService,
  MaintenanceTicketsError,
} from "@/lib/api/services/maintenance-tickets.service";
import type { StoreSelection } from "@/types/business-reports.types";
import type { CatalogCategory, CatalogTechnician } from "@/types/maintenance-tickets.types";

const NO_TRADE = "none";

/**
 * Add or edit a technician: who they are (name, phone, trade), where they are
 * based, and which stores they can cover -- with notes about that coverage.
 * Technicians who cover a ticket's store are listed first when picking one.
 */
export function TechnicianFormDialog({
  open,
  technician,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Null to add a new technician. */
  technician: CatalogTechnician | null;
  onClose: () => void;
  onSaved: (technician: CatalogTechnician) => void;
}) {
  const overviewStores = useAuthStore((s) => s.overviewStores);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [trade, setTrade] = useState<string>(NO_TRADE);
  const [location, setLocation] = useState("");
  const [coverage, setCoverage] = useState<string[]>([]);
  const [coverageNotes, setCoverageNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(technician?.name ?? "");
    setPhone(technician?.phone ?? "");
    setTrade(technician?.categoryId ? String(technician.categoryId) : NO_TRADE);
    setLocation(technician?.location ?? "");
    setCoverage((technician?.coverageStores ?? []).map((s) => s.storeNumber));
    setCoverageNotes(technician?.coverageNotes ?? "");
    setError(null);
    maintenanceTicketsService.getCatalogCategories().then(setCategories).catch(() => setCategories([]));
  }, [open, technician]);

  // Every store the viewer sees, plus any the technician already covers (so
  // saving never quietly drops a store this person cannot see).
  const storeOptions: StoreOption[] = useMemo(() => {
    const seen = new Set<string>();
    const options: StoreOption[] = [];
    for (const s of overviewStores ?? []) {
      if (!s.storeId || seen.has(s.storeId)) continue;
      seen.add(s.storeId);
      options.push({ id: s.storeId, name: s.name ? `${s.storeId} · ${s.name}` : s.storeId });
    }
    for (const s of technician?.coverageStores ?? []) {
      if (seen.has(s.storeNumber)) continue;
      seen.add(s.storeNumber);
      options.push({ id: s.storeNumber, name: s.storeNumber });
    }
    return options.sort((a, b) => a.id.localeCompare(b.id));
  }, [overviewStores, technician]);

  const selection: StoreSelection = coverage;

  async function save() {
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      phone: phone.trim() || null,
      category_id: trade === NO_TRADE ? null : Number(trade),
      location: location.trim() || null,
      coverage_notes: coverageNotes.trim() || null,
      coverage_stores: coverage,
    };
    try {
      const saved = technician
        ? await maintenanceTicketsService.updateCatalogTechnician(technician.id, payload)
        : await maintenanceTicketsService.createCatalogTechnician(payload);
      toast.success(technician ? `Saved ${saved.name}.` : `Added ${saved.name}.`);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof MaintenanceTicketsError ? err.message : "Could not save the technician.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{technician ? `Edit ${technician.name}` : "Add a technician"}</DialogTitle>
          <DialogDescription>
            Who they are, where they are based, and the stores they can cover.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="tech-name">Name <span className="text-destructive">*</span></Label>
            <Input id="tech-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={255} placeholder="A person, or a company" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tech-phone">Phone</Label>
              <Input id="tech-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={32} placeholder="(555) 010-0100" />
            </div>
            <div className="space-y-1.5">
              <Label>Trade</Label>
              <Select value={trade} onValueChange={setTrade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent position="popper" style={{ maxHeight: 260, overflowY: "auto" }}>
                  <SelectItem value={NO_TRADE}>No trade</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tech-location" className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> Location
            </Label>
            <Input id="tech-location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={255} placeholder="Where they are based, e.g. Columbus, OH" />
          </div>

          <div className="space-y-1.5">
            <Label>Stores they can cover</Label>
            <StoreMultiSelect
              options={storeOptions}
              value={selection}
              onChange={(value) => setCoverage(value === "all" ? storeOptions.map((o) => o.id) : value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              {coverage.length === 0
                ? "None yet. Technicians who cover a ticket's store are listed first when you pick one."
                : `${coverage.length} ${coverage.length === 1 ? "store" : "stores"}: ${coverage.slice(0, 6).join(", ")}${coverage.length > 6 ? ", …" : ""}`}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tech-coverage-notes">Coverage notes</Label>
            <Textarea
              id="tech-coverage-notes"
              value={coverageNotes}
              onChange={(e) => setCoverageNotes(e.target.value)}
              maxLength={2000}
              className="min-h-16"
              placeholder="e.g. North stores only on weekends; can reach Store 12 within the hour"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving || name.trim() === ""}>
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {technician ? "Save" : "Add technician"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
