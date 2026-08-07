"use client";

import { useTranslations } from "next-intl";
import { PACKS } from "uisfx";
import { AlertCircle, Volume2 } from "lucide-react";
import { useFeature } from "@/lib/config";
import { useSoundFxStore } from "@/lib/uisfx/sound.store";
import { getUisfxClient } from "@/lib/uisfx/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

export default function SoundSettingsPage() {
  const t = useTranslations("settings");
  const soundFxEnabled = useFeature("soundFx");
  const { pack, volume, enabled, setPack, setVolume, setEnabled, setUnlocked } =
    useSoundFxStore();

  if (!soundFxEnabled) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">{t("sound.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("sound.description")}</p>
        </div>
        <Separator />
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Feature Disabled</AlertTitle>
          <AlertDescription>{t("sound.featureDisabled")}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleTestSound = async () => {
    const client = getUisfxClient();
    if (!client) return;
    await client.unlock();
    setUnlocked(true);
    client.play("success");
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("sound.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("sound.description")}</p>
      </div>
      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("sound.enable")}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{t("sound.enableDescription")}</p>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("sound.volume")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Slider
            value={[volume]}
            onValueChange={([v]) => setVolume(v)}
            min={0}
            max={1}
            step={0.05}
            disabled={!enabled}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("sound.pack")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("sound.packDescription")}</p>
          <div className="flex items-center gap-3">
            <Label htmlFor="sound-pack-select" className="sr-only">
              {t("sound.pack")}
            </Label>
            <Select value={pack} onValueChange={setPack} disabled={!enabled}>
              <SelectTrigger id="sound-pack-select" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PACKS.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={handleTestSound}
              disabled={!enabled}
            >
              <Volume2 className="h-4 w-4" />
              {t("sound.testSound")}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {PACKS.find((p) => p.name === pack)?.description}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
