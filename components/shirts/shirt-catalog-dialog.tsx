"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Pencil, Plus, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { parseApiError } from "@/lib/api/utils/error";
import { shirtCatalogService } from "@/lib/api/services/shirt-catalog.service";
import { useShirtCatalog } from "@/lib/shirts/use-shirt-catalog";
import { ColorSwatch, LogoThumb } from "@/components/shirts/shirt-ui";
import { ShirtColorFormDialog } from "@/components/shirts/shirt-color-form-dialog";
import { ShirtLogoFormDialog } from "@/components/shirts/shirt-logo-form-dialog";
import { ShirtTemplateFormDialog } from "@/components/shirts/shirt-template-form-dialog";
import type {
  ShirtColor,
  ShirtLogo,
  ShirtTemplate,
} from "@/types/shirt-milestone.types";

type RetireTarget =
  | { kind: "color"; id: number; name: string }
  | { kind: "logo"; id: number; name: string }
  | { kind: "template"; id: number; name: string };

/** Retired rows stay visible, greyed — past milestones still reference them. */
function retiredClass(isActive: boolean): string {
  return cn(!isActive && "opacity-60");
}

export interface ShirtCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShirtCatalogDialog({ open, onOpenChange }: ShirtCatalogDialogProps) {
  const { catalog, isLoading, error, reload } = useShirtCatalog({
    enabled: open,
    includeInactive: true,
  });

  const [colorForm, setColorForm] = useState<{ open: boolean; color: ShirtColor | null }>(
    { open: false, color: null },
  );
  const [logoForm, setLogoForm] = useState<{ open: boolean; logo: ShirtLogo | null }>({
    open: false,
    logo: null,
  });
  const [templateForm, setTemplateForm] = useState<{
    open: boolean;
    template: ShirtTemplate | null;
  }>({ open: false, template: null });

  const [retireTarget, setRetireTarget] = useState<RetireTarget | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /* Something legible to preview a template's print area against. */
  const sampleColor = useMemo(
    () => catalog?.colors.find((c) => c.is_active) ?? null,
    [catalog],
  );
  const sampleLogo = useMemo(
    () => catalog?.logos.find((l) => l.is_active) ?? null,
    [catalog],
  );

  async function handleRetire() {
    if (!retireTarget) return;
    setActionError(null);
    try {
      if (retireTarget.kind === "color") {
        await shirtCatalogService.deactivateColor(retireTarget.id);
      } else if (retireTarget.kind === "logo") {
        await shirtCatalogService.deactivateLogo(retireTarget.id);
      } else {
        await shirtCatalogService.deactivateTemplate(retireTarget.id);
      }
      toast.success("Retired.");
      reload();
    } catch (err) {
      setActionError(parseApiError(err, "Could not retire that entry.").message);
    } finally {
      setRetireTarget(null);
    }
  }

  /* Colours patch cleanly, so reactivating one needs no re-upload. Logos and
     templates go back through their form, because an update there is a full
     replacement and the file has to be supplied again. */
  async function reactivateColor(color: ShirtColor) {
    setActionError(null);
    try {
      await shirtCatalogService.updateColor(color.id, { is_active: true });
      toast.success("Colour reactivated.");
      reload();
    } catch (err) {
      setActionError(parseApiError(err, "Could not reactivate that colour.").message);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Shirt Catalog</DialogTitle>
            <DialogDescription>
              Retiring an entry hides it from new entries. Past milestones keep
              showing it.
            </DialogDescription>
          </DialogHeader>

          {(error || actionError) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error ?? actionError}</AlertDescription>
            </Alert>
          )}

          {isLoading && <Skeleton className="h-64 w-full" />}

          {catalog && (
            <Tabs defaultValue="colors">
              <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
                <TabsTrigger value="colors">Colours</TabsTrigger>
                <TabsTrigger value="logos">Logos</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
              </TabsList>

              {/* ── Colours ── */}
              <TabsContent value="colors" className="mt-4 flex flex-col gap-3">
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => setColorForm({ open: true, color: null })}
                  >
                    <Plus className="me-2 h-4 w-4" />
                    Add colour
                  </Button>
                </div>
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Colour</TableHead>
                        <TableHead>Hex</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead className="text-end">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {catalog.colors.map((c) => (
                        <TableRow key={c.id} className={retiredClass(c.is_active)}>
                          <TableCell>
                            <span className="inline-flex items-center gap-2">
                              <ColorSwatch hex={c.hex_code} name={c.name} />
                              {c.name}
                              {!c.is_active && (
                                <Badge variant="outline">Retired</Badge>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {c.hex_code}
                          </TableCell>
                          <TableCell>{c.sort_order}</TableCell>
                          <TableCell className="text-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setColorForm({ open: true, color: c })}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {c.is_active ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() =>
                                  setRetireTarget({
                                    kind: "color",
                                    id: c.id,
                                    name: c.name,
                                  })
                                }
                              >
                                Retire
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => reactivateColor(c)}
                              >
                                <RotateCcw className="me-1 h-4 w-4" />
                                Reactivate
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* ── Logos ── */}
              <TabsContent value="logos" className="mt-4 flex flex-col gap-3">
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => setLogoForm({ open: true, logo: null })}
                  >
                    <Plus className="me-2 h-4 w-4" />
                    Add logo
                  </Button>
                </div>
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Logo</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead className="text-end">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {catalog.logos.map((l) => (
                        <TableRow key={l.id} className={retiredClass(l.is_active)}>
                          <TableCell>
                            <span className="inline-flex items-center gap-2">
                              <LogoThumb logo={l} />
                              {l.name}
                              {!l.is_active && (
                                <Badge variant="outline">Retired</Badge>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">{l.mime_type}</TableCell>
                          <TableCell>{l.sort_order}</TableCell>
                          <TableCell className="text-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLogoForm({ open: true, logo: l })}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {l.is_active ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() =>
                                  setRetireTarget({
                                    kind: "logo",
                                    id: l.id,
                                    name: l.name,
                                  })
                                }
                              >
                                Retire
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLogoForm({ open: true, logo: l })}
                              >
                                <RotateCcw className="me-1 h-4 w-4" />
                                Reactivate
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* ── Templates ── */}
              <TabsContent value="templates" className="mt-4 flex flex-col gap-3">
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => setTemplateForm({ open: true, template: null })}
                  >
                    <Plus className="me-2 h-4 w-4" />
                    Add template
                  </Button>
                </div>
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Template</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead>Print area</TableHead>
                        <TableHead className="text-end">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {catalog.templates.map((t) => (
                        <TableRow key={t.id} className={retiredClass(t.is_active)}>
                          <TableCell>
                            <span className="inline-flex items-center gap-2">
                              {t.name}
                              {t.is_default && <Badge variant="secondary">Default</Badge>}
                              {!t.is_active && (
                                <Badge variant="outline">Retired</Badge>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="capitalize">
                            {t.gender ?? "Unisex"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {t.print_area.x}, {t.print_area.y} · {t.print_area.width}×
                            {t.print_area.height}
                          </TableCell>
                          <TableCell className="text-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setTemplateForm({ open: true, template: t })
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {t.is_active ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() =>
                                  setRetireTarget({
                                    kind: "template",
                                    id: t.id,
                                    name: t.name,
                                  })
                                }
                              >
                                Retire
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setTemplateForm({ open: true, template: t })
                                }
                              >
                                <RotateCcw className="me-1 h-4 w-4" />
                                Reactivate
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <ShirtColorFormDialog
        open={colorForm.open}
        onOpenChange={(o) => setColorForm((p) => ({ ...p, open: o }))}
        color={colorForm.color}
        onSaved={reload}
      />
      <ShirtLogoFormDialog
        open={logoForm.open}
        onOpenChange={(o) => setLogoForm((p) => ({ ...p, open: o }))}
        logo={logoForm.logo}
        onSaved={reload}
      />
      <ShirtTemplateFormDialog
        open={templateForm.open}
        onOpenChange={(o) => setTemplateForm((p) => ({ ...p, open: o }))}
        template={templateForm.template}
        sampleColor={sampleColor}
        sampleLogo={sampleLogo}
        onSaved={reload}
      />

      <AlertDialog
        open={retireTarget !== null}
        onOpenChange={(o) => !o && setRetireTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire {retireTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This hides it from new entries. Past milestones keep showing it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={handleRetire}>Retire</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
