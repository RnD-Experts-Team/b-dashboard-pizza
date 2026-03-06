# Authorization System Developer Guide

## Purpose

This guide explains how authorization works in the frontend and how to apply it correctly in UI code.

- `Backend` remains the source of truth.
- `Frontend` mirrors backend rules only to control visibility and UX.
- `API endpoints` still enforce authorization server-side.

## Core Concepts

### Role

A role is a named group of permissions, such as `admin` or `super-admin`.

### Permission

A permission is an atomic capability string, such as `manage users`.

### Auth Rule

An auth rule maps a route shape to required permissions. Rules are matched by:

- `service`
- `method`
- `path` (regex from backend)

Rules can also be store-scoped and priority-based.

## Data Flow After Login

1. User logs in via `/auth/login`.
2. Frontend fetches `/auth/general-overview`.
3. Frontend normalizes and stores auth data in Zustand.

## Frontend Authorization State

Main state lives in `lib/auth/auth.store.ts`.

- `globalPermissions: Set<string>`
- `storePermissions: Record<string, Set<string>>`
- `authRules: AuthRule[]`
- `overviewStores: OverviewStore[]`

Legacy state is still present for compatibility:

- `permissions: string[]`
- `roles: string[]`

## Helpers You Should Use

### 1) `hasPermission(permission: string)`

Use this for simple, direct checks (mostly management pages):

```ts
const canManageUsers = hasPermission("manage users");
```

### 2) `canAccessRoute(params: CanAccessParams)`

Use this for API-backed features and store-scoped logic:

```ts
const canCreate = canAccessRoute({
  service: "QA",
  method: "POST",
  path: "/camera-forms",
  storeId: effectiveStoreId,
});
```

## How `canAccessRoute` Works

Implementation is in `lib/auth/can-access.ts`.

1. Find matching active rules by `service`, `method`, and regex path match.
2. Sort by `priority` and pick the highest-priority candidate.
3. Determine scope from `store_scope_mode`.
4. Evaluate `permissions_any` and `permissions_all`.
5. Allow super-admin immediately.

### Scope Modes

#### `scoped`

- Requires `storeId`.
- Checks only `storePermissions[storeId]`.
- Missing `storeId` means deny.

#### `none` (or non-scoped)

- If `storeId` exists, check store permissions first.
- If store check fails, fall back to global permissions.
- If no `storeId`, check global permissions only.

## Effective Store ID Pattern

Use the same fallback used by sidebar and QA pages:

```ts
const effectiveStoreId = selectedStore?.id ?? overviewStores?.[0]?.id;
```

Important:

- Use the numeric store id key used by `storePermissions`.
- Do not use human-readable store code when a rule expects store-scoped checks.

## UI Rendering Rules

For a component or nav item:

1. If it has `requiredPermission`, check with `hasPermission`.
2. If it has `requirements`, check with `canAccessRoute`.
3. If both exist, enforce both checks.
4. If neither exists, it is visible by default (fail-open behavior in current UI patterns).

## Examples

### Example A: Show Create Camera Form button only when allowed

```tsx
const createFormRequirements = [
  {
    service: "QA",
    method: "POST",
    path: "/camera-forms",
    storeId: effectiveStoreId,
  },
];

const canCreateCameraForm = createFormRequirements.some((requirement) =>
  canAccessRoute(requirement)
);

{canCreateCameraForm && (
  <Button asChild size="sm">
    <Link href={`/${locale}/dashboard/quality-assurance/create-camera-forms`}>
      Create Form
    </Link>
  </Button>
)}
```

### Example B: Gate Edit and Delete menu actions independently

```tsx
const editRequirements = [
  {
    service: "QA",
    method: "PUT",
    path: "/camera-forms/",
    storeId: effectiveStoreId,
  },
];

const deleteRequirements = [
  {
    service: "QA",
    method: "DELETE",
    path: "/camera-forms/",
    storeId: effectiveStoreId,
  },
];

const canEditCameraForm = editRequirements.some((r) => canAccessRoute(r));
const canDeleteCameraForm = deleteRequirements.some((r) => canAccessRoute(r));

{canEditCameraForm && <DropdownMenuItem>Edit</DropdownMenuItem>}
{canEditCameraForm && canDeleteCameraForm && <DropdownMenuSeparator />}
{canDeleteCameraForm && (
  <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
)}
```

### Example C: Sidebar item using direct permission

```ts
const usersItem = {
  title: "Users",
  href: `/${locale}/dashboard/users`,
  requiredPermission: "manage users",
};
```

## Best Practices

- Prefer `canAccessRoute` for features backed by API routes.
- Prefer `hasPermission` for admin/management pages with simple permissions.
- Keep requirement objects aligned with backend rule definitions.
- Use consistent path strings (including trailing slash when required by rules).
- Hide unauthorized UI, but still expect backend to enforce access.

## Troubleshooting Checklist

- Confirm `authRules` are loaded after login.
- Confirm `effectiveStoreId` is defined when evaluating scoped rules.
- Confirm `service`, `method`, and `path` match backend rule patterns.
- Confirm permission names in rules match stored permission names exactly.
- Confirm user is not missing the selected store assignment.

## Source Files

- `lib/auth/auth.store.ts`
- `lib/auth/can-access.ts`
- `lib/auth/use-auth.ts`
- `components/layout/sidebar.tsx`
- `app/[locale]/(dashboard)/dashboard/quality-assurance/page.tsx`
- `components/qa/camera-forms-list-table.tsx`