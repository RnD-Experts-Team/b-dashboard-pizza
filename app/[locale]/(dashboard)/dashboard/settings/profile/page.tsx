"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth/auth.store";
import { authService } from "@/lib/api/services/auth.service";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ProfilePage() {
  const t = useTranslations("settings.profile");
  const { user, patchUser } = useAuthStore();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  // Image state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  const [isPending, startTransition] = useTransition();

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    setRemoveImage(false);
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } else {
      setImagePreview(null);
    }
  }

  function handleRemoveImage() {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password && password !== passwordConfirmation) {
      toast.error("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await authService.updateMe({
          name,
          email,
          image: imageFile,
          password: password || undefined,
          password_confirmation: passwordConfirmation || undefined,
          remove_image: removeImage,
        });

        if (result.success) {
          patchUser({
            name: result.data.name,
            email: result.data.email,
            avatar: result.data.avatar ?? null,
          });
          setPassword("");
          setPasswordConfirmation("");
          setImageFile(null);
          setImagePreview(null);
          setRemoveImage(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          toast.success(result.message ?? "Profile updated successfully.");
        } else {
          toast.error(result.message ?? "Failed to update profile.");
        }
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ?? "An error occurred. Please try again.";
        toast.error(message);
      }
    });
  }

  const avatarSrc = imagePreview ?? (removeImage ? undefined : (user?.avatar ?? undefined));
  const initials =
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("title")}</h3>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <Separator />

      {/* Avatar */}
      <Card>
        <CardHeader>
          <CardTitle>{t("avatar")}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={avatarSrc} />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              {t("avatar")}
            </Button>
            {(avatarSrc || imageFile) && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={handleRemoveImage}
              >
                Remove image
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Profile info */}
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("name")}</Label>
            <Input
              id="name"
              placeholder={t("namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Password change */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Leave blank to keep your current password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password_confirmation">Confirm New Password</Label>
            <Input
              id="password_confirmation"
              type="password"
              placeholder="Confirm new password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : t("saveChanges")}
      </Button>
    </form>
  );
}
