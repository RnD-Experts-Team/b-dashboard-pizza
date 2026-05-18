"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { useThemeStore, generateThemeCSS } from "@/lib/theme";
import type { Theme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Check, Download, Upload, Trash2, Palette, Copy, AlertCircle, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useFeature } from "@/lib/config";
import { ThemeEditor } from "@/components/layout/theme-editor";

export default function ThemesPage() {
  const t = useTranslations("settings");
  const themeSystemEnabled = useFeature("themeSystem");
  const {
    themes,
    activeThemeId,
    setActiveTheme,
    importTheme,
    exportTheme,
    deleteTheme,
  } = useThemeStore();

  const [editorOpen, setEditorOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportedJson, setExportedJson] = useState("");
  const [exportedCss, setExportedCss] = useState("");
  const [selectedExportTheme, setSelectedExportTheme] = useState<Theme | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Show disabled message if theme system feature is off
  if (!themeSystemEnabled) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">{t("themes.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("themes.description")}</p>
        </div>
        <Separator />
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Feature Disabled</AlertTitle>
          <AlertDescription>
            The theme system feature is currently disabled. Contact your administrator to enable it.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleImport = () => {
    setImportError(null);
    const result = importTheme(importJson);
    
    if (result.success) {
      setImportDialogOpen(false);
      setImportJson("");
    } else {
      setImportError(result.error || "Failed to import theme");
    }
  };

  const handleExport = (theme: Theme) => {
    const json = exportTheme(theme.id);
    const css = generateThemeCSS(theme);
    
    if (json) {
      setExportedJson(json);
      setExportedCss(css);
      setSelectedExportTheme(theme);
      setExportDialogOpen(true);
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setImportJson(content);
      setImportDialogOpen(true);
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const downloadJson = () => {
    if (!selectedExportTheme) return;
    
    const blob = new Blob([exportedJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedExportTheme.name.toLowerCase().replace(/\s+/g, "-")}-theme.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCss = () => {
    if (!selectedExportTheme) return;
    
    const blob = new Blob([exportedCss], { type: "text/css" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedExportTheme.name.toLowerCase().replace(/\s+/g, "-")}-theme.css`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Generate preview colors for a theme
  const getPreviewColors = (theme: Theme) => {
    return {
      primary: theme.colors.light.primary,
      secondary: theme.colors.light.secondary,
      accent: theme.colors.light.accent,
      background: theme.colors.light.background,
    };
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("themes.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("themes.description")}
        </p>
      </div>

      {/* Live editor CTA */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Live Theme Editor</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Edit colors, radius and more with a live preview — or pick from presets.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditorOpen(true)}>
          <Pencil className="me-2 h-4 w-4" />
          Open Editor
        </Button>
      </div>

      {/* Actions */} 
      <div className="flex flex-wrap gap-2">
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Upload className="me-2 h-4 w-4" />
              {t("themes.import")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("themes.importTitle")}</DialogTitle>
              <DialogDescription>
                {t("themes.importDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="import-json">{t("themes.jsonInput")}</Label>
                <Textarea
                  id="import-json"
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder='{"name": "My Theme", "version": "1.0.0", ...}'
                  className="h-64 font-mono text-sm"
                />
              </div>
              {importError && (
                <p className="text-sm text-destructive">{importError}</p>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t("themes.orUpload")}</span>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="max-w-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                {t("themes.cancel")}
              </Button>
              <Button onClick={handleImport} disabled={!importJson.trim()}>
                {t("themes.import")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileImport}
          className="hidden"
        />
      </div>

      {/* Theme Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((theme) => {
          const isActive = theme.id === activeThemeId;
          const colors = getPreviewColors(theme);

          return (
            <Card
              key={theme.id}
              className={cn(
                "relative cursor-pointer transition-all hover:shadow-md",
                isActive && "ring-2 ring-primary"
              )}
              onClick={() => setActiveTheme(theme.id)}
            >
              <div className="flex h-12 overflow-hidden rounded-t-lg">
                <div className="flex-1" style={{ backgroundColor: colors.primary }} />
                <div className="flex-1" style={{ backgroundColor: colors.secondary }} />
                <div className="flex-1" style={{ backgroundColor: colors.accent }} />
                <div className="flex-1" style={{ backgroundColor: colors.background }} />
              </div>

              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {theme.name}
                      {isActive && (
                        <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                          <Check className="me-1 h-3 w-3" />
                          {t("themes.active")}
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      v{theme.version}
                      {theme.metadata?.author && ` • ${theme.metadata.author}`}
                    </CardDescription>
                  </div>
                  {theme.isDefault && (
                    <Palette className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {theme.metadata?.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {theme.metadata.description}
                  </p>
                )}

                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setEditorOpen(true)}
                    >
                      <Pencil className="h-3 w-3 me-1" />
                      Edit
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExport(theme)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>

                  {!theme.isDefault && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("themes.deleteTitle")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("themes.deleteDescription", { name: theme.name })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("themes.cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteTheme(theme.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {t("themes.delete")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}      </div>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {t("themes.exportTitle")} - {selectedExportTheme?.name}
            </DialogTitle>
            <DialogDescription>
              {t("themes.exportDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>JSON</Label>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(exportedJson)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={downloadJson}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={exportedJson}
                readOnly
                className="h-64 font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>CSS</Label>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(exportedCss)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={downloadCss}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={exportedCss}
                readOnly
                className="h-64 font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setExportDialogOpen(false)}>
              {t("themes.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Live editor */}
      <ThemeEditor open={editorOpen} onOpenChange={setEditorOpen} />
    </div>
  );
}
