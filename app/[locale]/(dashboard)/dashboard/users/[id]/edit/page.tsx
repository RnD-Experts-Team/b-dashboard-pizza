"use client";

import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { UserForm } from "@/components/users";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { userService } from "@/lib/api/services/user.service";
import type { User } from "@/types/user.types";

const cancelErrorPattern = /cancel(?:ed|led)|abort(?:ed|error)?/i;

function isCanceledError(error: unknown): boolean {
  if (axios.isCancel(error)) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (
    error instanceof Error &&
    (error.name === "CanceledError" || cancelErrorPattern.test(error.message))
  ) {
    return true;
  }
  return typeof error === "string" ? cancelErrorPattern.test(error) : false;
}

export default function EditUserPage() {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const params = useParams();
  const userId = params?.id as string | undefined;
  const locale = (params?.locale as string) || "en";
  
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!userId) {
      setError("User ID is required");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await userService.getUser(userId);
      setUser(response.data);
    } catch (err) {
      if (isCanceledError(err)) {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch user data";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  if (isLoading) {
    return (
      <div className="space-y-6 pb-2">
        <PageHeader title={t("edit.title")} description={t("edit.loading")} />
        <Card>
          <CardContent className="pt-6">
            <div className="animate-pulse space-y-4">
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-6 pb-2">
        <PageHeader title={t("edit.title")} description={t("edit.errorLoading")} />
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error || t("edit.notFound")}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => void fetchUser()} variant="outline">
                {tCommon("refresh")}
              </Button>
              <Button onClick={() => router.back()}>{t("edit.goBack")}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-2">
      <PageHeader 
        title={t("edit.title")}
        description={`${t("edit.description")} ${user.name}`}
      />
      <UserForm
        mode="edit"
        user={user}
        userId={user.id}
        onSuccess={(updatedUser) => {
          router.push(`/${locale}/dashboard/users/${updatedUser.id}`);
        }}
        onCancel={() => router.push(`/${locale}/dashboard/users`)}
      />
    </div>
  );
}
