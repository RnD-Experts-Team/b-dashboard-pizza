# Auth Rules, Hierarchy, and Service Clients Documentation

---

## Auth Rules

The Auth Rules pages allow administrators to manage authentication and authorization rules for users and roles. These rules define access policies and security controls for dashboard features.

### Features
- List, create, edit, and view auth rules
- Loading states for smooth UX
- Modular routing for auth rule actions

### API Endpoints & Data Sources
- **Auth Rules API Base:** `/api/auth-rules/`
- **Auth Rule List:** `/api/auth-rules/list`
- **Auth Rule Detail:** `/api/auth-rules/{id}`
- **Create Auth Rule:** `/api/auth-rules/create`
- **Edit Auth Rule:** `/api/auth-rules/{id}/edit`

> Endpoints may be abstracted by hooks or utilities. Check `lib/api/auth-rules/` for details.

### Useful Information for Developers
- Routing for creation and edit actions
- Modular React components for forms and lists
- Error handling for invalid actions or missing data

### Where to Find More
- Auth Rules Pages: `app/[locale]/(dashboard)/dashboard/auth-rules/`
- API Utilities: `lib/api/auth-rules/`

---

## Hierarchy

The Hierarchy pages allow administrators to manage organizational structure, including store groups, regions, and reporting relationships.

### Features
- List, create, edit, and view hierarchy items
- Loading states for smooth UX
- Modular routing for hierarchy actions

### API Endpoints & Data Sources
- **Hierarchy API Base:** `/api/hierarchy/`
- **Hierarchy List:** `/api/hierarchy/list`
- **Hierarchy Detail:** `/api/hierarchy/{id}`
- **Create Hierarchy Item:** `/api/hierarchy/create`
- **Edit Hierarchy Item:** `/api/hierarchy/{id}/edit`

> Endpoints may be abstracted by hooks or utilities. Check `lib/api/hierarchy/` for details.

### Useful Information for Developers
- Routing for creation and edit actions
- Modular React components for forms and lists
- Error handling for invalid actions or missing data

### Where to Find More
- Hierarchy Pages: `app/[locale]/(dashboard)/dashboard/hierarchy/`
- API Utilities: `lib/api/hierarchy/`

---

## Service Clients

The Service Clients page allows administrators to manage integrations and external service clients used by the dashboard.

### Features
- View and manage service clients
- Loading states for smooth UX

### API Endpoints & Data Sources
- **Service Clients API Base:** `/api/service-clients/`
- **Service Clients List:** `/api/service-clients/list`

> Endpoints may be abstracted by hooks or utilities. Check `lib/api/service-clients/` for details.

### Useful Information for Developers
- Modular React components for client management
- Error handling for invalid actions or missing data

### Where to Find More
- Service Clients Page: `app/[locale]/(dashboard)/dashboard/service-clients/`
- API Utilities: `lib/api/service-clients/`

---
# Authorization System Developer Guide (Roles and Permissions)

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
## Support
For issues or questions, use the support link provided in the UI: [Support Ticket](https://tasks.rdexperts.tech/support-ticket)

_Last updated: March 13, 2026_
