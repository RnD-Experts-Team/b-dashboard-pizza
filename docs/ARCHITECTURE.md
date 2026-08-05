# Architecture Documentation

_Last updated: 2026-08-04_

## Overview

This document describes the architectural boundaries, conventions, and patterns used in the B-Dashboard project.

---

## 1. Architectural Boundaries

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Pages (app/)                        │
│  Route handlers, layouts, server/client components          │
├─────────────────────────────────────────────────────────────┤
│                    Components (components/)                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │   Layout    │ │     UI      │ │        Shared           ││
│  │  Components │ │  (shadcn)   │ │      Components         ││
│  └─────────────┘ └─────────────┘ └─────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                     State (lib/store/)                       │
│  Zustand stores for client-side state management            │
├─────────────────────────────────────────────────────────────┤
│                    Services (lib/api/)                       │
│  API client, service modules, type definitions              │
├─────────────────────────────────────────────────────────────┤
│                      Types (types/)                          │
│  Shared TypeScript interfaces and types                     │
└─────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

#### Pages Layer (`app/`)
- **Responsibility:** Route definitions, layouts, page components
- **Can import from:** Components, State, Services, Types
- **Cannot import:** Nothing restricted
- **Guidelines:**
  - Keep page components thin
  - Delegate complex logic to hooks or services
  - Use server components where possible
  - Client components for interactivity

#### Components Layer (`components/`)
- **Responsibility:** Reusable UI building blocks
- **Can import from:** Other components, Types, Utils
- **Cannot import:** Services (use hooks instead)
- **Sub-layers:**
  - `ui/` - shadcn/ui primitives (buttons, inputs, etc.)
  - `layout/` - Structural components (sidebar, topbar, etc.)
  - `shared/` - Business-specific reusable components
  - `forms/` - Form components
  - `providers/` - Context providers

#### State Layer (`lib/store/`, `lib/auth/`)
- **Responsibility:** Client-side state management
- **Can import from:** Types, Services
- **Guidelines:**
  - One store per domain (auth, ui, etc.)
  - Export typed selectors
  - Keep actions simple
  - Use persist middleware for necessary data

#### Services Layer (`lib/api/`)
- **Responsibility:** API communication
- **Can import from:** Types
- **Cannot import:** Components, State
- **Guidelines:**
  - Pure functions, no side effects besides HTTP
  - All methods typed
  - Error handling at interceptor level

#### Types Layer (`types/`)
- **Responsibility:** Shared type definitions
- **Can import from:** Nothing
- **Guidelines:**
  - Domain-specific files (user.types.ts, auth.types.ts)
  - Avoid circular dependencies
  - Export all from barrel files

---

## 2. Naming Conventions

### Files and Folders

| Type | Convention | Example |
|------|------------|---------|
| React Component | kebab-case | `user-menu.tsx` |
| Hook | camelCase with use prefix | `use-auth.ts` |
| Store | kebab-case with .store suffix | `auth.store.ts` |
| Service | kebab-case with .service suffix | `auth.service.ts` |
| Types | kebab-case with .types suffix | `user.types.ts` |
| Utilities | kebab-case | `cn.ts` |
| Constants | kebab-case | `constants.ts` |

### Code

| Type | Convention | Example |
|------|------------|---------|
| Component | PascalCase | `UserMenu` |
| Hook | camelCase with use prefix | `useAuth` |
| Store | camelCase with Store suffix | `useAuthStore` |
| Interface | PascalCase | `User`, `AuthState` |
| Type | PascalCase | `Theme` |
| Constant | UPPER_SNAKE_CASE | `API_BASE_URL` |
| Function | camelCase | `formatDate` |
| CSS Variable | kebab-case with -- prefix | `--primary` |

### Imports

```typescript
// 1. External libraries
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 2. Internal aliases (@/)
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth/auth.store';

// 3. Relative imports (rare, only within same feature)
import { helperFunction } from './helper';

// 4. Types (using type keyword)
import type { User } from '@/types/user.types';
```

---

## 3. Patterns

### Composition Pattern

Components are composed from smaller primitives:

```tsx
// AppShell composes Sidebar, Topbar, and content area
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
```

### Hooks Pattern

Business logic extracted into custom hooks:

```tsx
// useAuth hook encapsulates auth logic
export function useAuth() {
  const { user, isAuthenticated, login, logout } = useAuthStore();
  const router = useRouter();

  const handleLogin = async (credentials: LoginCredentials) => {
    await login(credentials);
    router.push('/dashboard');
  };

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  return { user, isAuthenticated, handleLogin, handleLogout };
}
```

### Service Pattern

API calls encapsulated in service modules:

```typescript
// Services are plain objects with typed methods
export const authService = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const { data } = await axiosClient.post('/auth/login', credentials);
    return data;
  },
  // ...
};
```

### Store Pattern (Zustand Slices)

```typescript
// Typed store with actions
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: async (credentials) => {
        const response = await authService.login(credentials);
        set({ user: response.user, token: response.token, isAuthenticated: true });
      },
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    { name: 'auth-storage' }
  )
);
```

### Layout Pattern

Nested layouts for route groups:

```
app/
├── layout.tsx              # Root: providers, fonts
├── (auth)/
│   └── auth/
│       └── layout.tsx      # Auth: centered card
└── (dashboard)/
    └── dashboard/
        ├── layout.tsx      # Dashboard: AppShell
        └── settings/
            └── layout.tsx  # Settings: tabs
```

---

## 4. Component Guidelines

### Server vs Client Components

```tsx
// Server Component (default) - no 'use client'
// - Fetch data
// - Access backend resources
// - Keep sensitive info on server

// Client Component - add 'use client'
// - Interactive (onClick, onChange)
// - Use hooks (useState, useEffect)
// - Access browser APIs
```

### Props Interface Pattern

```tsx
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
}

export function Button({ children, variant = 'default', ...props }: ButtonProps) {
  // ...
}
```

### Forwarding Refs

```tsx
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(baseStyles, className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
```

---

## 5. State Management Guidelines

### When to Use Each

| State Type | When to Use | Example |
|------------|-------------|---------|
| React State | Component-local, UI only | Form inputs, toggles |
| Zustand | Cross-component, persisted | Auth, theme, sidebar |
| URL State | Shareable, bookmarkable | Filters, pagination |
| Server State | Remote data | User list (future: React Query) |

### Store Organization

```
lib/
├── auth/
│   ├── auth.store.ts      # Auth-specific store
│   ├── auth.utils.ts      # Token helpers
│   └── use-auth.ts        # Consumer hook
└── store/
    ├── index.ts           # Re-exports
    └── ui.store.ts        # UI state store
```

---

## 6. API Layer Guidelines

### Request Flow

```
Component → Hook → Store Action → Service → Axios Client → API
    ↑                                                      |
    └──────────────────── Response ────────────────────────┘
```

### Error Handling

```typescript
// Interceptor handles common errors
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);
```

### Type Safety

```typescript
// Generic API response wrapper
interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

// Typed service method
async function getUsers(): Promise<ApiResponse<User[]>> {
  const { data } = await axiosClient.get<ApiResponse<User[]>>('/users');
  return data;
}
```

---

## 7. Styling Guidelines

### Tailwind CSS v4 Usage

```tsx
// Use Tailwind utilities
<div className="flex items-center gap-4 p-4">

// Use theme tokens via CSS variables
<div className="bg-background text-foreground">

// Use cn() for conditional classes
<button className={cn(
  "px-4 py-2 rounded",
  variant === "primary" && "bg-primary text-primary-foreground",
  disabled && "opacity-50 cursor-not-allowed"
)}>
```

### Component Variants with CVA

```typescript
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border border-input bg-background hover:bg-accent',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);
```

---

## 8. Testing Strategy (Future)

### Recommended Approach

| Layer | Tool | Focus |
|-------|------|-------|
| Components | Vitest + Testing Library | Render, interaction |
| Hooks | Vitest | Logic, state changes |
| Services | Vitest + MSW | API mocking |
| E2E | Playwright | User flows |

---

## 9. Performance Considerations

- Use Server Components for static content
- Lazy load heavy components with `dynamic()`
- Optimize images with `next/image`
- Implement proper loading states
- Use skeleton placeholders

---

## 10. Security Considerations

- Validate all inputs (client + server)
- Use httpOnly cookies for tokens in production
- Sanitize user-generated content
- Implement CSRF protection
- Rate limit API endpoints

---

## 11. Recent Feature Areas (Added Since Last Review)

These are fully pattern-conformant with the layers and conventions in sections 1–4 above — no new architectural exceptions were introduced. Listed here so they aren't missed when scanning this document for feature coverage.

- **Dashboard V1** (`components/dashboard-v1/**`, `app/[locale]/(dashboard)/dashboard/v1/page.tsx`) — a presentation-layer re-skin of the existing DSPR dashboard. Reuses the same hooks (`useWbrCard`/`useDspr`, `useManagerDashboard`, `useHooksWbr`) and services (`dsprService`, `employeeService`, `hooksService`, `qaService`) — no new data layer. See `docs/ADR/0007-dashboard-v1-category-taxonomy.md` for the category-color taxonomy and dual-mount toggle pattern it introduces.
- **Screen Project** (`components/screen-project/**`) — in-store live-video monitoring over LiveKit, following the standard hook → service → route → external-API layering (`lib/hooks/use-screen-project.ts` → `lib/api/services/screen-project.service.ts` → `app/api/screen-project/[storeId]/**`). Full write-up: `docs/SCREEN-PROJECT.md`.
- **Drive Thru** (`components/screen-project/drive-thru/**`) — a global hotline overlay built entirely on Screen Project's existing service layer; its only new artifact is `lib/store/drive-thru.store.ts` (Zustand + `persist`, partialized to `{ isMuted }`). See the addendum in `docs/SCREEN-PROJECT.md`.

---

## Appendix: Quick Reference

### File Locations

| What | Where |
|------|-------|
| Page component | `app/(group)/path/page.tsx` |
| Layout | `app/(group)/path/layout.tsx` |
| UI component | `components/ui/component.tsx` |
| Layout component | `components/layout/component.tsx` |
| Hook | `lib/auth/use-hook.ts` or `lib/hooks/use-hook.ts` |
| Store | `lib/store/domain.store.ts` |
| Service | `lib/api/services/domain.service.ts` |
| Types | `types/domain.types.ts` |
| API route | `app/api/path/route.ts` |
