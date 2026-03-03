Here is a clean, simplified, documentation-style version you can give to any developer..

---

# Authorization System – Developer Guide

## What Happens After Login

After successful login, the app calls:

```
/auth/general-overview 
```

From this response, the app prepares three main things:

---

## 1️⃣ Normalized Authorization State

### `globalPermissions`

A `Set<string>` containing all permission names the user has globally.

Source:

* `full_permissions`
* permissions inside global `roles`

---

### `storePermissions`

A record of store-based permissions:

```ts
Record<storeId, Set<string>>
```

Source:

* `store_assignments[*].all_permissions_from_store_roles`

Each store gets its own permission set.

---

### `authRules`

A list of API authorization rules.

Each rule contains:

* `service`
* `method`
* `path` (regex provided by backend)
* `permissions_any`
* `permissions_all`
* `store_scope_mode`
* `priority`
* `is_active`

These rules define how API access should be evaluated.

---

# Two Types of Checks in the UI

The system exposes two main helpers:

---

## 1️⃣ `hasPermission(permission: string)`

A simple permission check. like for (manage roles , manage users , manage permissions .....)

Checks directly against `globalPermissions`.

Used for:

* Management pages
* Legacy visibility logic
* Items using `requiredPermission`

Example:

```ts
hasPermission("manage users")
```

---

## 2️⃣ `canAccessRoute(params: CanAccessParams)`

Rule-driven engine.

Used for pages backed by API routes.

Matches a route against `authRules` and evaluates required permissions.

Supports:

* Store scoping
* `permissions_any`
* `permissions_all`
* Super-admin bypass

---

# How `canAccessRoute` Works

## Step 1 — Find Matching Rule

Match active rules by:

* `service`
* `method`
* `path` (regex match)

Choose the top candidate based on:

* `priority`
* `is_active`

---

## Step 2 — Determine Scope

Read:

```
rule.store_scope_mode
```

Possible values:

### `"scoped"`

* Requires `storeId`
* If no store selected → deny
* Only check permissions inside `storePermissions[storeId]`

---

### `"none"`

If `storeId` exists:

1. Check `storePermissions[storeId]`
2. If not satisfied → fallback to `globalPermissions`

If no `storeId`:

* Check `globalPermissions` only

---

## Step 3 — Permission Matching

### `permissions_any`

Passes if **at least one** permission exists in the checked set.

---

### `permissions_all`

Passes only if **all** permissions exist in the checked set.

---

## Step 4 — Super Admin Bypass

If user has the `super-admin` role:

→ Automatically return `true`.

---

# UI Rendering Rules

When rendering sidebar items or components:

---

### If item has `requiredPermission`

Use:

```ts
hasPermission(permission)
```

---

### If item has `requirements`

Use:

```ts
canAccessRoute(params)
```

At least one requirement must pass.

---

### If neither exists

Fail-open:

→ Item is visible by default.

---

# Practical Guidelines

### Prefer Rule-Based Checks For:

* API-backed pages
* Pages that depend on store scoping
* Anything covered by backend auth rules

---

### Use `requiredPermission` For:

* Management pages
* Pages without backend auth rules
* Simple visibility checks

---

### Important

* Scoped rules require a selected `storeId`.
* Always ensure store selection exists before evaluating scoped routes.
* Backend remains the source of truth.
* Frontend only mirrors logic for UI behavior.

---

# Summary

After login:

1. Normalize permissions
2. Store global and store-based permission sets
3. Store auth rules
4. Use:

   * `hasPermission()` for direct checks
   * `canAccessRoute()` for rule-driven checks

This keeps the UI fully dynamic, backend-driven, and scalable.


---

## Examples — Sidebar items

Here are three examples that mirror how items are defined in the sidebar:

1) Page with `requirements` (rule-driven):

```ts
const cameraReportItem = {
  title: 'Camera Report',
  href: '/en/dashboard/camera-report',
  icon: Camera,
  requirements: [
    { service: 'QA', method: 'GET', path: '/audits/ratings-summary/overview', storeId: zustandSelectedStore?.id },
  ],
};
```

2) Page with `requiredPermission` (direct permission check):

```ts
const usersItem = {
  title: 'Users',
  href: '/en/dashboard/users',
  icon: Users,
  requiredPermission: 'manage users',
};
```

3) Page with no requirements (visible by default):

```ts
const dashboardItem = {
  title: 'Dashboard',
  href: '/en/dashboard',
  icon: LayoutDashboard,
  // no requirements or requiredPermission -> always shown
};
```
