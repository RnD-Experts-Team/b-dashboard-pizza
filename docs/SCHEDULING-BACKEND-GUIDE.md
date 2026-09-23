> **SUPERSEDED — do not build against this.**
>
> This was the spec the frontend team wrote *before* the backend existed, and it
> predates the whole planned-vs-actual system (`ActualShift`, comparison mode),
> the `note` field, and `sync_status`. It also describes `avatar` as a URL when
> the code stores initials.
>
> The scheduling feature is now wired to the OperationsPizza API. The authority
> is that service's own handoff documentation plus `lib/scheduling/adapters.ts`,
> which is the single place the real payload shapes are written down.
>
> Kept for history only.

# Scheduling Page: Backend Developer Guide

## Overview
The Scheduling Page is a weekly employee scheduling system inspired by Connecteam. It provides a row-per-employee grid for managing shifts, templates, and schedule exports. It also includes a single-day time-axis view, a monthly heat-map overview, shift conflict detection, overtime alerts, availability rules, time-off management, and recurring shift support. This document explains the frontend features, data structures, and backend requirements so you can design the necessary APIs and data models.

---

## Key Features

### 1. Weekly Employee Grid
- **Rows:** Each row represents an employee.
- **Columns:** Days of the week (Tuesday → Monday).
- **Cells:** Each cell can contain zero or more shifts for that employee on that day.
- **Today Highlight:** Current day is visually highlighted.
- **Overtime Row Highlighting:** Rows turn amber when an employee exceeds the overtime threshold.
- **Availability Blocks:** Cells show a gray "Unavailable" overlay when an employee has an all-day or partial availability rule.
- **Time-Off Blocks:** Cells show a purple overlay with the time-off type (PTO / Vacation / Sick) when an employee has time off.
- **Blocked Cells:** The "Add Shift" button is hidden on cells that are fully blocked by availability or time-off.

### 2. Shift Management
- **Add/Edit/Delete Shifts:**
  - Shifts have: employee, day, start/end time, label (e.g., Morning), type (morning/evening/night/split/custom), and optional recurring flag.
  - CRUD is done via dialogs.
- **Shift Presets:** Quick-select for common shift types.
- **Recurring Shifts:** Shifts can be marked as "recurring weekly" with a `recurringGroupId` linking all instances across weeks. Recurring shifts display a dashed border and repeat icon.
- **Conflict Warning:** The add/edit dialog shows an inline red warning if the proposed shift overlaps an existing shift for the same employee on the same day.
- **Availability Warning:** The dialog warns (amber) if the employee is marked unavailable during the proposed time.
- **Time-Off Warning:** The dialog warns (purple) if the employee has time off on that day.

### 3. Shift Conflict Detection
- **Automatic Detection:** All pairwise shift conflicts are computed for the current week. Two shifts conflict when they belong to the same employee on the same day and their times overlap.
- **Visual Indicators:** Conflicting shifts display a red border, ring, and warning triangle icon.
- **Warning Banner:** A page-level red banner shows the total count of conflicts for the week.

### 4. Overtime Alerts
- **Configurable Threshold:** Default is 40 hours per week (configurable in future).
- **Per-Employee Detection:** Weekly hours are summed and compared against the threshold.
- **Visual Indicators:** Overtime employees get an amber "OT" badge next to their name, amber-highlighted hours column, and amber row tint.
- **Warning Banner:** A page-level amber banner shows how many employees exceed the threshold.

### 5. Availability Rules
- **Per-Employee, Per-Day:** Each rule specifies an employee, a day index, whether it's all-day or partial (with start/end times), and a reason.
- **Grid Rendering:** All-day rules show a full "Unavailable" block in the cell. Partial rules show a "Partial block" indicator.
- **Shift Validation:** When adding/editing a shift, the system checks if the time falls within an availability block.

### 6. Time-Off Entries
- **Types:** PTO, Vacation, Sick.
- **Per-Employee, Per-Day:** Each entry blocks the entire day for that employee.
- **Grid Rendering:** Shows a purple block with the time-off type label and icon.
- **Shift Validation:** Prevents scheduling shifts on time-off days (warning in dialog).

### 7. View Modes
- **Week View (default):** The row-per-employee grid described above.
- **Day View:** A single-day time-axis layout showing employee columns with shift blocks positioned vertically by time. Includes availability overlays, time-off overlays, conflict/overtime indicators, and click-to-add/edit interactions. Time axis spans configurable start/end hours at 60px per hour.
- **Month Overview:** A calendar heat-map showing shift density per day (4-level: none/low/medium/high). Click a day to navigate to the day view. Shows shift count badges, today highlight, and out-of-month dimming.

### 8. Week Navigation
- **Week Offset:** User can navigate to previous/next weeks. All shift data is scoped per week.
- **Go to Today:** Button to jump to the current week.
- **Day Selector:** In day view, a dropdown selects which day to display (matches the department filter dropdown style).

### 9. Filters & Search
- **Department Filter:** Filter employees by department (DropdownMenu).
- **Search:** Filter employees by name or role.

### 10. Summary Stats
- **Total Hours:** Sum of all scheduled hours for the week.
- **Total Shifts:** Number of shifts scheduled.
- **Active Staff:** Number of employees with at least one shift.
- **Estimated Labor Cost:** Calculated as total hours × $15/hr (hardcoded for now).

### 11. Actions Dropdown
- **Copy Previous Week:** Copies all shifts from the previous week (overwrites current week).
- **Export as Excel:** Exports the schedule as a CSV file (UTF-8 BOM for Excel compatibility).
- **Screenshot:** Captures the schedule grid as a PNG.
- **Templates:**
  - **Save as Template:** Save the current week's shifts as a reusable template (with name/description).
  - **Load Week Template:** Load a saved template into the current week (overwrites all shifts).
  - **Delete Template:** Remove a saved template.
- **Static UI (future):** Clear Week, Unpublish Week, Unassign Week (not implemented yet).

### 12. Templates System
- **Templates:**
  - Store a name, description, creation date, and a list of shifts (without IDs).
  - Used to quickly apply common schedules to any week.

---

## Data Structures

### Employee
```
{
  id: string,
  name: string,
  role: string,
  department: string,
  avatar: string (URL),
  color: string (for UI)
}
```

### Shift
```
{
  id: string,
  employeeId: string,
  dayIndex: number,        // 0=Tue, 1=Wed, ..., 6=Mon
  startTime: string,       // "HH:mm" 24h
  endTime: string,         // "HH:mm" 24h
  label: string,           // e.g. "Morning"
  type: "morning" | "evening" | "night" | "split" | "custom",
  isRecurring?: boolean,   // whether this shift repeats weekly
  recurringGroupId?: string // links all recurring instances across weeks
}
```

### Availability Rule
```
{
  id: string,
  employeeId: string,
  dayIndex: number,        // 0=Tue, 1=Wed, ..., 6=Mon
  allDay: boolean,         // true = blocked entire day
  startTime?: string,      // "HH:mm" — only if allDay is false
  endTime?: string,        // "HH:mm" — only if allDay is false
  reason: string           // e.g. "Day off preference", "Morning class"
}
```

### Time-Off Entry
```
{
  id: string,
  employeeId: string,
  dayIndex: number,        // 0=Tue, 1=Wed, ..., 6=Mon
  type: "pto" | "vacation" | "sick",
  label: string            // display label e.g. "PTO", "Vacation", "Sick Leave"
}
```

### Shift Conflict (computed, not stored)
```
{
  shiftA: Shift,
  shiftB: Shift,
  employeeId: string,
  dayIndex: number
}
```

### Schedule Template
```
{
  id: string,
  name: string,
  description: string,
  createdAt: string (ISO),
  shifts: Array<Omit<Shift, 'id'>>,
  shiftCount: number,
  totalHours: number
}
```

---

## Backend Requirements

### 1. API Endpoints

#### Employees
- `GET /employees` — List all employees, filterable by department.
- `GET /employees/:id` — Get single employee.
- Standard CRUD as needed.

#### Shifts
- `GET /shifts?weekStart=YYYY-MM-DD` — Get all shifts for a week.
- `POST /shifts` — Create a shift. Body includes `isRecurring` and `recurringGroupId`.
- `PUT /shifts/:id` — Update a shift.
- `DELETE /shifts/:id` — Delete a single shift.
- `DELETE /shifts?recurringGroupId=xxx` — Delete all shifts in a recurring series (for "delete series" functionality).
- `POST /shifts/copy-week` — Copy all shifts from one week to another (body: `{ sourceWeekStart, targetWeekStart }`).

#### Availability Rules
- `GET /availability?employeeId=xxx` — List availability rules for an employee.
- `GET /availability?weekStart=YYYY-MM-DD` — List all availability rules relevant to a week.
- `POST /availability` — Create a rule.
- `PUT /availability/:id` — Update a rule.
- `DELETE /availability/:id` — Delete a rule.

#### Time-Off Entries
- `GET /time-off?employeeId=xxx` — List time-off for an employee.
- `GET /time-off?weekStart=YYYY-MM-DD` — List all time-off entries relevant to a week.
- `POST /time-off` — Create a time-off entry.
- `PUT /time-off/:id` — Update.
- `DELETE /time-off/:id` — Delete.

#### Templates
- `GET /templates` — List saved templates.
- `POST /templates` — Save a new template.
- `POST /templates/:id/apply?weekStart=YYYY-MM-DD` — Apply template to a week (generates new shift IDs).
- `DELETE /templates/:id` — Delete a template.

#### Overtime Configuration
- `GET /settings/overtime-threshold` — Get current threshold (default 40).
- `PUT /settings/overtime-threshold` — Update threshold.

#### Departments/Roles
- `GET /departments` — List departments.
- `GET /roles` — List roles.

### 2. Data Model Suggestions

#### Employee Table
| Column     | Type    | Notes                     |
|------------|---------|---------------------------|
| id         | string  | Primary key               |
| name       | string  |                           |
| role       | string  |                           |
| department | string  | FK to departments         |
| avatar     | string  | URL or initials           |
| color      | string  | UI color key              |

#### Shift Table
| Column             | Type    | Notes                              |
|--------------------|---------|------------------------------------|
| id                 | string  | Primary key                        |
| employee_id        | string  | FK to employees                    |
| week_start_date    | date    | Tuesday of the week                |
| day_index          | int     | 0=Tue … 6=Mon                     |
| start_time         | string  | "HH:mm"                           |
| end_time           | string  | "HH:mm"                           |
| label              | string  |                                    |
| type               | enum    | morning/evening/night/split/custom |
| is_recurring       | boolean | Default false                      |
| recurring_group_id | string  | Nullable, links recurring copies   |

#### Availability Rule Table
| Column      | Type    | Notes                         |
|-------------|---------|-------------------------------|
| id          | string  | Primary key                   |
| employee_id | string  | FK to employees               |
| day_index   | int     | 0=Tue … 6=Mon                |
| all_day     | boolean |                               |
| start_time  | string  | Nullable ("HH:mm")           |
| end_time    | string  | Nullable ("HH:mm")           |
| reason      | string  |                               |

#### Time-Off Entry Table
| Column      | Type   | Notes                     |
|-------------|--------|---------------------------|
| id          | string | Primary key               |
| employee_id | string | FK to employees           |
| day_index   | int    | 0=Tue … 6=Mon            |
| type        | enum   | pto / vacation / sick      |
| label       | string |                           |
| week_start_date | date | To scope per-week       |

#### Template Table
| Column      | Type   | Notes         |
|-------------|--------|---------------|
| id          | string | Primary key   |
| name        | string |               |
| description | string |               |
| created_at  | string | ISO timestamp |

#### Template Shift Table
| Column             | Type    | Notes                              |
|--------------------|---------|------------------------------------|
| template_id        | string  | FK to templates                    |
| employee_id        | string  | FK to employees                    |
| day_index          | int     | 0=Tue … 6=Mon                     |
| start_time         | string  | "HH:mm"                           |
| end_time           | string  | "HH:mm"                           |
| label              | string  |                                    |
| type               | enum    | morning/evening/night/split/custom |
| is_recurring       | boolean |                                    |
| recurring_group_id | string  | Nullable                           |

#### Settings Table
| Column | Type   | Notes                       |
|--------|--------|-----------------------------|
| key    | string | e.g. "overtime_threshold"   |
| value  | string | e.g. "40"                   |

### 3. Business Logic

- **Week Calculation:** Weeks start on Tuesday and end on Monday.
- **Copy/Load:** When copying or loading, all current week shifts are replaced.
- **Conflict Detection:** Backend should validate on create/update that a shift does not overlap with another shift for the same employee on the same day. Return a warning or error if it does.
- **Availability Enforcement:** When creating/updating a shift, check if the employee has an availability rule blocking that time. Return a warning if blocked.
- **Time-Off Enforcement:** When creating a shift, check if the employee has time-off on that day. Return a warning if so.
- **Overtime Calculation:** Sum weekly hours per employee. Include overtime status in the weekly shift response (or as a separate summary endpoint).
- **Recurring Shifts:** When a shift is marked recurring, auto-generate copies for future weeks sharing the same `recurringGroupId`. Editing or deleting should support "this shift only" vs "this and all future" via the `recurringGroupId`.
- **Export:** Provide an endpoint to export schedule data as CSV if needed.

### 4. Authentication/Authorization
- **Role-based access:** Only authorized users can edit schedules, manage templates, manage availability/time-off, or export data.

---

## Frontend Utility Functions (reference)

These are implemented client-side in `lib/scheduling/utils.ts`. The backend should replicate equivalent logic for server-side validation:

| Function                  | Purpose                                                        |
|---------------------------|----------------------------------------------------------------|
| `timesOverlap()`          | Check if two HH:mm time ranges overlap (handles midnight wrap) |
| `detectConflicts()`       | Find all pairwise shift conflicts in a set of shifts           |
| `conflictedShiftIds()`    | Extract the set of shift IDs that are in conflict              |
| `wouldConflict()`         | Check if a proposed shift would conflict with existing shifts  |
| `weeklyHoursMap()`        | Calculate total hours per employee for a set of shifts         |
| `overtimeEmployees()`     | Get the set of employee IDs exceeding the overtime threshold   |
| `isBlockedByAvailability()` | Check if an employee is unavailable at a given day/time      |
| `hasTimeOff()`            | Check if an employee has time-off on a given day               |
| `generateRecurringShifts()` | Generate recurring shift copies for future weeks             |

---

## Integration Notes
- **Frontend expects per-week shift data:** API should accept a week identifier (start date) to fetch/set shifts.
- **Availability and time-off are also week-scoped** (or persistent rules with a day-of-week pattern).
- **Template application:** When loading a template, backend should generate new shift IDs.
- **Recurring shifts:** Frontend links instances via `recurringGroupId`. Backend should support creating/deleting by group.
- **Conflict detection:** Frontend computes conflicts locally for instant UI feedback. Backend should also validate to prevent invalid data.
- **All times are in 24h format ("HH:mm").**
- **View modes (week/day/month)** are purely frontend — no backend changes needed for view switching.

---

## Next Steps
- Design the database schema based on the above models (now includes availability, time-off, and settings tables).
- Implement REST or GraphQL endpoints for all CRUD operations including availability, time-off, and overtime settings.
- Add server-side conflict detection, availability checks, and time-off enforcement on shift create/update.
- Implement recurring shift generation logic (create future copies, support edit-one vs edit-series).
- Coordinate with frontend to finalize API contracts (request/response shapes).
- Add authentication and role-based permissions as needed.

---

For any questions, see the frontend code in `components/scheduling/` and `types/scheduling.types.ts` for reference.
