# Dashboard Personalization - Technical Design

## A. Zustand Store Design

### Store Structure (Slices Pattern)
```typescript
// lib/dashboard/store/dashboard.store.ts

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface DashboardState {
  // Data
  currentLayout: DashboardLayout;
  views: DashboardView[];
  activeViewId: string | null;
  
  // UI State
  isEditMode: boolean;
  isDirty: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  
  // Drag State (not persisted)
  draggedWidgetId: string | null;
}

interface DashboardActions {
  // Layout Actions
  setLayout: (layout: DashboardLayout) => void;
  moveWidget: (instanceId: string, position: WidgetPosition) => void;
  addWidget: (widgetId: string, position?: Partial<WidgetPosition>) => void;
  removeWidget: (instanceId: string) => void;
  updateWidgetConfig: (instanceId: string, config: Record<string, unknown>) => void;
  toggleWidgetVisibility: (instanceId: string) => void;
  
  // View Actions
  saveCurrentAsView: (name: string, description?: string) => DashboardView;
  loadView: (viewId: string) => void;
  updateView: (viewId: string, updates: Partial<DashboardView>) => void;
  deleteView: (viewId: string) => void;
  setDefaultView: (viewId: string) => void;
  
  // Edit Mode
  enterEditMode: () => void;
  exitEditMode: (save?: boolean) => void;
  
  // Reset
  resetToRoleDefault: (role: UserRole) => void;
  resetWidget: (instanceId: string) => void;
  
  // Sync
  syncToBackend: () => Promise<void>;
  loadFromBackend: () => Promise<void>;
  
  // Drag
  setDraggedWidget: (instanceId: string | null) => void;
}

type DashboardStore = DashboardState & DashboardActions;
```

### Selectors (Memoized)
```typescript
// lib/dashboard/store/selectors.ts

import { useMemo } from "react";
import { useDashboardStore } from "./dashboard.store";

// Get visible widgets only
export const useVisibleWidgets = () => 
  useDashboardStore((s) => s.currentLayout.widgets.filter(w => w.visible));

// Get widget by instance ID
export const useWidget = (instanceId: string) =>
  useDashboardStore((s) => s.currentLayout.widgets.find(w => w.instanceId === instanceId));

// Get sorted widgets by position (for rendering)
export const useSortedWidgets = () => {
  const widgets = useDashboardStore((s) => s.currentLayout.widgets);
  return useMemo(
    () => [...widgets].filter(w => w.visible).sort((a, b) => 
      a.position.y - b.position.y || a.position.x - b.position.x
    ),
    [widgets]
  );
};

// Check if layout has changes
export const useHasUnsavedChanges = () => 
  useDashboardStore((s) => s.isDirty);

// Get available widgets (not in current layout)
export const useAvailableWidgets = (registry: WidgetRegistry, userRole: UserRole) => {
  const widgets = useDashboardStore((s) => s.currentLayout.widgets);
  return useMemo(() => {
    const usedIds = new Set(widgets.map(w => w.widgetId));
    return Object.values(registry).filter(
      def => !usedIds.has(def.id) && def.allowedRoles.includes(userRole)
    );
  }, [widgets, registry, userRole]);
};
```

### Store Implementation
```typescript
// lib/dashboard/store/dashboard.store.ts

export const useDashboardStore = create<DashboardStore>()(
  persist(
    immer((set, get) => ({
      // Initial state
      currentLayout: createDefaultLayout(),
      views: [],
      activeViewId: null,
      isEditMode: false,
      isDirty: false,
      isSyncing: false,
      lastSyncedAt: null,
      draggedWidgetId: null,

      // Actions
      moveWidget: (instanceId, newPosition) => {
        set((state) => {
          const widget = state.currentLayout.widgets.find(w => w.instanceId === instanceId);
          if (widget) {
            widget.position = { ...widget.position, ...newPosition };
            widget.lastUpdated = new Date().toISOString();
            state.isDirty = true;
          }
        });
        get().debouncedSync();
      },

      addWidget: (widgetId, position) => {
        const registry = getWidgetRegistry();
        const definition = registry[widgetId];
        if (!definition) return;

        set((state) => {
          const newWidget: UserWidgetInstance = {
            instanceId: crypto.randomUUID(),
            widgetId,
            position: {
              x: position?.x ?? 0,
              y: position?.y ?? getNextRowY(state.currentLayout.widgets),
              width: definition.sizeConfig.defaultWidth * 3, // Convert to columns
              height: 2,
            },
            visible: true,
            config: { ...definition.defaultConfig },
            lastUpdated: new Date().toISOString(),
          };
          state.currentLayout.widgets.push(newWidget);
          state.isDirty = true;
        });
      },

      saveCurrentAsView: (name, description) => {
        const view: DashboardView = {
          id: crypto.randomUUID(),
          name,
          description,
          layout: JSON.parse(JSON.stringify(get().currentLayout)),
          isDefault: false,
          isRoleDefault: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => {
          state.views.push(view);
        });
        return view;
      },

      loadView: (viewId) => {
        set((state) => {
          const view = state.views.find(v => v.id === viewId);
          if (view) {
            state.currentLayout = JSON.parse(JSON.stringify(view.layout));
            state.activeViewId = viewId;
            state.isDirty = false;
          }
        });
      },

      // ... other actions
    })),
    {
      name: "b-dashboard:dashboard-config",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentLayout: state.currentLayout,
        views: state.views,
        activeViewId: state.activeViewId,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);
```

---

## B. API Endpoints

### Service Layer
```typescript
// lib/dashboard/services/dashboard.service.ts

import { apiClient } from "@/lib/api/client";
import type { 
  UserDashboardConfig, 
  DashboardView,
  DashboardLayout 
} from "../types";

export const dashboardService = {
  // Get user's complete dashboard config
  getConfig: () => 
    apiClient.get<UserDashboardConfig>("/api/dashboard/config"),

  // Update user's dashboard config
  updateConfig: (config: Partial<UserDashboardConfig>) =>
    apiClient.put<UserDashboardConfig>("/api/dashboard/config", config),

  // Get role default layout
  getRoleDefault: (role: UserRole) =>
    apiClient.get<DashboardLayout>(`/api/dashboard/defaults/${role}`),

  // Admin: Set role default
  setRoleDefault: (role: UserRole, layout: DashboardLayout) =>
    apiClient.put(`/api/dashboard/defaults/${role}`, layout),

  // CRUD Views
  getViews: () =>
    apiClient.get<DashboardView[]>("/api/dashboard/views"),

  createView: (view: Omit<DashboardView, "id" | "createdAt" | "updatedAt">) =>
    apiClient.post<DashboardView>("/api/dashboard/views", view),

  updateView: (id: string, updates: Partial<DashboardView>) =>
    apiClient.put<DashboardView>(`/api/dashboard/views/${id}`, updates),

  deleteView: (id: string) =>
    apiClient.delete(`/api/dashboard/views/${id}`),
};
```

### API Route Handlers
```typescript
// app/api/dashboard/config/route.ts

import { NextRequest, NextResponse } from "next/server";
import { userDashboardConfigSchema } from "@/lib/dashboard/types";

export async function GET(request: NextRequest) {
  // TODO: Get user from session
  // TODO: Fetch from database
  return NextResponse.json({ /* config */ });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  
  // Validate with Zod
  const result = userDashboardConfigSchema.partial().safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid config", details: result.error.flatten() },
      { status: 400 }
    );
  }
  
  // TODO: Save to database
  return NextResponse.json({ /* updated config */ });
}
```

---

## C. Skeleton Component System

### CSS Variables (Theme Integration)
```css
/* app/globals.css - add to theme section */

:root {
  --skeleton-base: hsl(var(--muted));
  --skeleton-highlight: hsl(var(--muted-foreground) / 0.1);
  --skeleton-shimmer-duration: 1.5s;
  --skeleton-shimmer-direction: 90deg; /* LTR */
  --skeleton-border-radius: var(--radius-md);
}

[dir="rtl"] {
  --skeleton-shimmer-direction: 270deg; /* RTL */
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --skeleton-shimmer-duration: 0s;
  }
}
```

### Base Skeleton Primitive
```typescript
// components/ui/skeleton.tsx

import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
}

export function Skeleton({ 
  className, 
  shimmer = true,
  ...props 
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-(--skeleton-border-radius) bg-(--skeleton-base)",
        shimmer && "skeleton-shimmer",
        className
      )}
      {...props}
    />
  );
}

// Shimmer animation in globals.css
/*
.skeleton-shimmer {
  background: linear-gradient(
    var(--skeleton-shimmer-direction),
    var(--skeleton-base) 0%,
    var(--skeleton-highlight) 50%,
    var(--skeleton-base) 100%
  );
  background-size: 200% 100%;
  animation: shimmer var(--skeleton-shimmer-duration) infinite linear;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
*/
```

### Skeleton Primitives
```typescript
// components/ui/skeleton-primitives.tsx

import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";

// Text line skeleton
export function SkeletonText({ 
  lines = 1, 
  className,
  lastLineWidth = "75%"
}: { 
  lines?: number; 
  className?: string;
  lastLineWidth?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className="h-4" 
          style={{ 
            width: i === lines - 1 ? lastLineWidth : "100%" 
          }}
        />
      ))}
    </div>
  );
}

// Circle skeleton (avatars, icons)
export function SkeletonCircle({ 
  size = 40,
  className 
}: { 
  size?: number;
  className?: string;
}) {
  return (
    <Skeleton 
      className={cn("rounded-full", className)} 
      style={{ width: size, height: size }}
    />
  );
}

// Chart skeleton
export function SkeletonChart({ 
  type = "bar",
  className 
}: { 
  type?: "bar" | "line" | "pie";
  className?: string;
}) {
  if (type === "pie") {
    return (
      <div className={cn("flex items-center gap-4", className)}>
        <SkeletonCircle size={120} />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "line") {
    return (
      <div className={cn("space-y-2", className)}>
        <Skeleton className="h-4 w-24" /> {/* Title */}
        <div className="h-50 relative">
          <Skeleton className="absolute bottom-0 left-0 right-0 h-0.5" /> {/* X axis */}
          <Skeleton className="absolute top-0 bottom-0 left-0 w-0.5" /> {/* Y axis */}
          <svg className="w-full h-full" viewBox="0 0 100 50">
            <path
              d="M0,40 Q25,20 50,30 T100,10"
              fill="none"
              stroke="var(--skeleton-base)"
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>
    );
  }

  // Bar chart
  return (
    <div className={cn("space-y-2", className)}>
      <Skeleton className="h-4 w-24" />
      <div className="flex items-end gap-2 h-50">
        {[60, 80, 45, 90, 70].map((h, i) => (
          <Skeleton 
            key={i} 
            className="flex-1" 
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// Table skeleton
export function SkeletonTable({ 
  rows = 5, 
  columns = 4,
  className 
}: { 
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex gap-4 pb-2 border-b">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton key={colIdx} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
```

### Widget Skeleton Components
```typescript
// components/dashboard/skeletons/stats-widget-skeleton.tsx

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton, SkeletonCircle, SkeletonText } from "@/components/ui/skeleton";

export function StatsWidgetSkeleton() {
  return (
    <Card className="h-full min-h-30">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-24" />
        <SkeletonCircle size={20} />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-1" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

// components/dashboard/skeletons/chart-widget-skeleton.tsx
export function ChartWidgetSkeleton({ type = "bar" }: { type?: "bar" | "line" | "pie" }) {
  return (
    <Card className="h-full min-h-75">
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-48" />
      </CardHeader>
      <CardContent>
        <SkeletonChart type={type} />
      </CardContent>
    </Card>
  );
}

// components/dashboard/skeletons/table-widget-skeleton.tsx
export function TableWidgetSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="h-full min-h-87.5">
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <SkeletonTable rows={rows} columns={4} />
      </CardContent>
    </Card>
  );
}
```

### Widget Skeleton Registry
```typescript
// lib/dashboard/skeleton-registry.ts

import { lazy } from "react";
import type { WidgetType } from "./types";

type SkeletonComponent = React.ComponentType<{ size?: "sm" | "md" | "lg" }>;

export const widgetSkeletonRegistry: Record<WidgetType, SkeletonComponent> = {
  "stats": lazy(() => import("@/components/dashboard/skeletons/stats-widget-skeleton")
    .then(m => ({ default: m.StatsWidgetSkeleton }))),
  "chart-line": lazy(() => import("@/components/dashboard/skeletons/chart-widget-skeleton")
    .then(m => ({ default: () => m.ChartWidgetSkeleton({ type: "line" }) }))),
  "chart-bar": lazy(() => import("@/components/dashboard/skeletons/chart-widget-skeleton")
    .then(m => ({ default: () => m.ChartWidgetSkeleton({ type: "bar" }) }))),
  "chart-pie": lazy(() => import("@/components/dashboard/skeletons/chart-widget-skeleton")
    .then(m => ({ default: () => m.ChartWidgetSkeleton({ type: "pie" }) }))),
  "table": lazy(() => import("@/components/dashboard/skeletons/table-widget-skeleton")
    .then(m => ({ default: m.TableWidgetSkeleton }))),
  "list": lazy(() => import("@/components/dashboard/skeletons/list-widget-skeleton")
    .then(m => ({ default: m.ListWidgetSkeleton }))),
  "calendar": lazy(() => import("@/components/dashboard/skeletons/calendar-widget-skeleton")
    .then(m => ({ default: m.CalendarWidgetSkeleton }))),
  "activity-feed": lazy(() => import("@/components/dashboard/skeletons/activity-widget-skeleton")
    .then(m => ({ default: m.ActivityWidgetSkeleton }))),
  "quick-actions": lazy(() => import("@/components/dashboard/skeletons/actions-widget-skeleton")
    .then(m => ({ default: m.ActionsWidgetSkeleton }))),
};

export function getWidgetSkeleton(type: WidgetType): SkeletonComponent {
  return widgetSkeletonRegistry[type];
}
```

### Page Skeleton Templates
```typescript
// components/dashboard/skeletons/dashboard-page-skeleton.tsx

import { StatsWidgetSkeleton } from "./stats-widget-skeleton";
import { ChartWidgetSkeleton } from "./chart-widget-skeleton";
import { TableWidgetSkeleton } from "./table-widget-skeleton";

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatsWidgetSkeleton key={i} />
        ))}
      </div>
      
      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartWidgetSkeleton type="line" />
        <ChartWidgetSkeleton type="bar" />
      </div>
      
      {/* Table */}
      <TableWidgetSkeleton rows={5} />
    </div>
  );
}

// components/dashboard/skeletons/users-page-skeleton.tsx
export function UsersPageSkeleton() {
  return (
    <div className="space-y-4">
      {/* Search/filter bar */}
      <div className="flex gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      {/* Table */}
      <SkeletonTable rows={10} columns={5} />
      {/* Pagination */}
      <div className="flex justify-end gap-2">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
      </div>
    </div>
  );
}
```

---

## D. Caching & Optimistic Updates

### Caching Strategy
```typescript
// lib/dashboard/cache.ts

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class DashboardCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}

export const dashboardCache = new DashboardCache();
```

### Optimistic Updates
```typescript
// In store actions

moveWidget: (instanceId, newPosition) => {
  // 1. Save previous state for rollback
  const previousLayout = get().currentLayout;
  
  // 2. Optimistic update
  set((state) => {
    const widget = state.currentLayout.widgets.find(w => w.instanceId === instanceId);
    if (widget) {
      widget.position = { ...widget.position, ...newPosition };
      state.isDirty = true;
    }
  });
  
  // 3. Sync to backend (debounced)
  get().debouncedSync().catch(() => {
    // 4. Rollback on failure
    set({ currentLayout: previousLayout });
    toast.error("Failed to save layout. Changes reverted.");
  });
},
```

---

## E. Error Handling

### Error Boundaries
```typescript
// components/dashboard/widget-error-boundary.tsx

"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  widgetId: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Widget ${this.props.widgetId} error:`, error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              Widget Error
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground">
              This widget encountered an error.
            </p>
            <Button variant="outline" size="sm" onClick={this.handleRetry}>
              <RefreshCw className="h-4 w-4 me-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
```

---

## F. Security Considerations

### Config Validation
```typescript
// lib/dashboard/validation.ts

import { z } from "zod";

// Sanitize string inputs to prevent XSS
const safeString = z.string().transform((val) => {
  // Remove any HTML tags
  return val.replace(/<[^>]*>/g, "");
});

// Widget config validation by type
const widgetConfigSchemas: Record<WidgetType, z.ZodSchema> = {
  "stats": z.object({
    compareMode: z.enum(["previousPeriod", "lastYear", "none"]),
    showTrend: z.boolean(),
  }),
  "chart-line": z.object({
    dateRange: z.enum(["7d", "30d", "90d", "1y"]),
    showLegend: z.boolean(),
  }),
  // ... other widget types
};

export function validateWidgetConfig(
  type: WidgetType, 
  config: unknown
): { success: true; data: Record<string, unknown> } | { success: false; error: z.ZodError } {
  const schema = widgetConfigSchemas[type];
  if (!schema) {
    return { success: true, data: {} }; // Unknown type, use empty config
  }
  return schema.safeParse(config);
}

// Validate entire layout before save
export function validateLayout(layout: unknown): DashboardLayout {
  const result = dashboardLayoutSchema.safeParse(layout);
  if (!result.success) {
    throw new Error("Invalid layout: " + result.error.message);
  }
  
  // Additional security checks
  for (const widget of result.data.widgets) {
    // Ensure widget IDs are alphanumeric
    if (!/^[a-z0-9-]+$/i.test(widget.widgetId)) {
      throw new Error("Invalid widget ID");
    }
    
    // Validate config for each widget type
    const registry = getWidgetRegistry();
    const definition = registry[widget.widgetId];
    if (definition?.configSchema) {
      const configResult = definition.configSchema.safeParse(widget.config);
      if (!configResult.success) {
        widget.config = definition.defaultConfig; // Reset to defaults
      }
    }
  }
  
  return result.data;
}
```

### Permission Checks
```typescript
// lib/dashboard/permissions.ts

export function canAccessWidget(
  widgetDef: WidgetDefinition, 
  userRole: UserRole
): boolean {
  return widgetDef.allowedRoles.includes(userRole);
}

export function filterWidgetsByRole(
  widgets: UserWidgetInstance[],
  registry: WidgetRegistry,
  userRole: UserRole
): UserWidgetInstance[] {
  return widgets.filter(w => {
    const def = registry[w.widgetId];
    return def && canAccessWidget(def, userRole);
  });
}
```
