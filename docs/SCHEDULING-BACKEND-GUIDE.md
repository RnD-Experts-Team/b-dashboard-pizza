# Scheduling Page: Backend Developer Guide

## Overview
The Scheduling Page is a weekly employee scheduling system inspired by Connecteam. It provides a row-per-employee grid for managing shifts, templates, and schedule exports. This document explains the frontend features, data structures, and backend requirements so you can design the necessary APIs and data models.

---

## Key Features

### 1. Weekly Employee Grid
- **Rows:** Each row represents an employee.
- **Columns:** Days of the week (Tuesday → Monday).
- **Cells:** Each cell can contain zero or more shifts for that employee on that day.
- **Today Highlight:** Current day is visually highlighted.

### 2. Shift Management
- **Add/Edit/Delete Shifts:**
  - Shifts have: employee, day, start/end time, label (e.g., Morning), and type (morning/evening/night/split/custom).
  - CRUD is done via dialogs.
- **Shift Presets:** Quick-select for common shift types.

### 3. Week Navigation
- **Week Offset:** User can navigate to previous/next weeks. All shift data is scoped per week.
- **Go to Today:** Button to jump to the current week.

### 4. Filters & Search
- **Department Filter:** Filter employees by department.
- **Search:** Filter employees by name or role.

### 5. Summary Stats
- **Total Hours:** Sum of all scheduled hours for the week.
- **Total Shifts:** Number of shifts scheduled.
- **Active Staff:** Number of employees with at least one shift.
- **Estimated Labor Cost:** Calculated as total hours × $15/hr (hardcoded for now).

### 6. Actions Dropdown
- **Copy Previous Week:** Copies all shifts from the previous week (overwrites current week).
- **Export as Excel:** Exports the schedule as a CSV file (UTF-8 BOM for Excel compatibility).
- **Screenshot:** Captures the schedule grid as a PNG.
- **Templates:**
  - **Save as Template:** Save the current week's shifts as a reusable template (with name/description).
  - **Load Week Template:** Load a saved template into the current week (overwrites all shifts).
  - **Delete Template:** Remove a saved template.
- **Static UI (future):** Clear Week, Unpublish Week, Unassign Week (not implemented yet).

### 7. Templates System
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
  dayIndex: number, // 0=Tue, 1=Wed, ..., 6=Mon
  startTime: string, // "HH:mm"
  endTime: string,   // "HH:mm"
  label: string,     // e.g. "Morning"
  type: "morning" | "evening" | "night" | "split" | "custom"
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
- **Employees:** CRUD endpoints for employee data.
- **Shifts:** CRUD endpoints for shifts, scoped by week (week start date or label as identifier).
- **Templates:** CRUD endpoints for schedule templates (save, list, load, delete).
- **Departments/Roles:** Endpoints to fetch department and role lists.

### 2. Data Model Suggestions
- **Employee Table:** id, name, role, department, avatar, color
- **Shift Table:** id, employee_id, week_start_date, day_index, start_time, end_time, label, type
- **Template Table:** id, name, description, created_at
- **TemplateShift Table:** template_id, employee_id, day_index, start_time, end_time, label, type

### 3. Business Logic
- **Week Calculation:** Weeks start on Tuesday and end on Monday.
- **Copy/Load:** When copying or loading, all current week shifts are replaced.
- **Export:** Provide an endpoint to export schedule data as CSV if needed.

### 4. Authentication/Authorization
- **Role-based access:** Only authorized users can edit schedules, manage templates, or export data.

---

## Integration Notes
- **Frontend expects per-week shift data:** API should accept a week identifier (start date or label) to fetch/set shifts.
- **Template application:** When loading a template, backend should generate new shift IDs.
- **All times are in 24h format ("HH:mm").**

---

## Next Steps
- Design the database schema based on the above models.
- Implement REST or GraphQL endpoints for all CRUD operations.
- Coordinate with frontend to finalize API contracts (request/response shapes).
- Add authentication and role-based permissions as needed.

---

For any questions, see the frontend code in `components/scheduling/` and `types/scheduling.types.ts` for reference.
