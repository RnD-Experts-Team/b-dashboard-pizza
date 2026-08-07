"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useSoundFxStore } from "@/lib/uisfx/sound.store";

export function SoundToggle() {
  const t = useTranslations("common");
  const enabled = useSoundFxStore((s) => s.enabled);
  const toggleEnabled = useSoundFxStore((s) => s.toggleEnabled);

  const label = enabled ? t("soundFx.mute") : t("soundFx.unmute");

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleEnabled}
      aria-label={label}
      title={label}
    >
      {enabled ? (
        <Volume2 className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <VolumeX className="h-[1.2rem] w-[1.2rem]" />
      )}
      <span className="sr-only">{label}</span>
    </Button>
  );
}
