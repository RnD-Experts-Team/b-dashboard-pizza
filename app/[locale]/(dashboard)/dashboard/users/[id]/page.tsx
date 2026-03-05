"use client";

import axios from "axios";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
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

export default function UserDetailsPage() {
  const t = useTranslations("users");
  const params = useParams();
  const router = useRouter();
  const userId = params?.id as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setError("User ID is required");
      setIsLoading(false);
      return;
    }

    const fetchUser = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await userService.getUser(userId);
        setUser(response.data);
      } catch (err) {
        if (isCanceledError(err)) {
          return;
        }
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch user details";
        console.error("Error fetching user details:", errorMessage);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchUser();
  }, [userId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72 md:col-span-2" />
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-6">
        <PageHeader title="User Details" description="Error loading user details" />
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error || "User not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title={t("details.title")}
        description={`${t("details.description")} ${user.name}`}
      >
        <Button onClick={() => router.push(`/${params?.locale}/dashboard/users/${userId}/edit`)}>
          <Pencil className="me-2 h-4 w-4" />
          {t("actions.edit")}
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Personal Information Section */}
        <Card className="md:col-span-2 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={user.avatar || undefined} />
                <AvatarFallback>
                  {(user.name || "User")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div>{user.name || "Unknown User"}</div>
                <div className="text-sm font-normal text-muted-foreground">
                  <Badge 
                    variant={
                      user.status === "active" 
                        ? "default" 
                        : user.status === "inactive" 
                        ? "secondary" 
                        : "outline"
                    }
                    className="capitalize mt-2"
                  >
                    {user.status}
                  </Badge>
                </div>
              </div>
            </CardTitle>
            <CardDescription>{t("details.personalInfo")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t("details.emailAddress")}</label>
              <p className="text-base mt-1">{user.email}</p>
            </div>
            {user.emailVerifiedAt && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t("details.emailVerified")}</label>
                <p className="text-base mt-1">{new Date(user.emailVerifiedAt).toLocaleDateString()}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Information Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("details.accountInfo")}</CardTitle>
            <CardDescription>{t("details.accountInfoDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t("details.userId")}</label>
              <p className="text-sm mt-1 break-all font-mono">{user.id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t("details.created")}</label>
              <p className="text-sm mt-1">{new Date(user.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">{t("details.lastUpdated")}</label>
              <p className="text-sm mt-1">{new Date(user.updatedAt).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Roles and Permissions Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Global Roles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("details.globalRoles")}</CardTitle>
            <CardDescription>{t("details.rolesAssigned")}</CardDescription>
          </CardHeader>
          <CardContent>
            {user.roles && user.roles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {user.roles.map((role) => (
                  <Badge key={role.id} variant="outline" className="capitalize">
                    {role.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("details.noRoles")}</p>
            )}
          </CardContent>
        </Card>

        {/* Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("details.permissions")}</CardTitle>
            <CardDescription>{t("details.permissionsAssigned")}</CardDescription>
          </CardHeader>
          <CardContent>
            {user.permissions && user.permissions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {user.permissions.map((permission) => (
                  <Badge key={permission.id} variant="secondary" className="capitalize">
                    {permission.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("details.noPermissions")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Store Access Section */}
      {user.stores && user.stores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("details.storeAccess")}</CardTitle>
            <CardDescription>{t("details.storeAccessDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {user.stores.map((userStore) => (
                <div key={userStore.store.id} className="rounded-lg border p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold leading-tight">{userStore.store.name}</h4>
                    <Badge variant="outline">{userStore.store.id}</Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">{t("details.rolesInThisStore")}</p>
                    <div className="flex flex-wrap gap-2">
                      {userStore.roles && userStore.roles.length > 0 ? (
                        userStore.roles.map((role) => (
                          <Badge key={role.id} variant="secondary" className="capitalize">
                            {role.name}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">{t("details.noRolesInStore")}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(!user.stores || user.stores.length === 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("details.storeAccess")}</CardTitle>
            <CardDescription>{t("details.storeAccessDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("details.noStoreAccess")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
