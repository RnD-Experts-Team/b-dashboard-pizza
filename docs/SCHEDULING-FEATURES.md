# Scheduling page — complete feature reference

_Last updated: 2026-11-13_

Route: `/{locale}/dashboard/scheduling` · Entry component: `components/scheduling/scheduling-manager-new.tsx` (`SchedulingManager`)
Backend: OperationsPizza API through the internal proxy `app/api/scheduling/**` (see §10).

This file lists **every feature the scheduling page has**, in detail. It was built by reading the code (component by component, and the hooks/libs/routes behind them), then re-checked against the code. It was **not** exercised end-to-end in a browser, so anything about how the server behaves is stated as "per the code", not as tested fact.

---

## 0. How to read this document

### "Admin side" vs "user side" — read this first

**The page itself has no admin/user split.** There is no role check in the scheduling UI (details in §2). Anyone who can open the page sees every button; the server decides what a given account may actually do, and answers `403` otherwise. So the two sides below are grouped **by what a feature does**, not by who the UI hides it from:

| Side | Meaning | Where |
|---|---|---|
| **User side (VIEW)** | Reading and looking: the week, the three views, the summary numbers, the "usual week" history, filters, tooltips, the on-the-clock board, published history, exports and screenshots, the page guide. Nothing here changes saved data. | §4 |
| **Admin / manager side (MANAGE)** | Changing data: planning shifts, saving/discarding drafts, copy / clear / templates, publishing, availability and time off, reviewing / correcting / deleting recorded time, clocking people in and out. These write to the server and need the matching server permission. | §5 |
| **Admin-only set-up** | Things only whoever administers the integration can fix (store not mapped, position not mapped, store not enabled for recording). The page shows a dead-end explanation. | §5.9 |

Two further tags are used throughout:

- **Mode**: the grid has three views — **Planned**, **Actual**, **Compare**. Many features exist in only one of them. Compare is read-only.
- **Output for staff**: the *Publish* image and the *Employee Screenshot* are what employees see. They are called out separately because they are generated with a reduced "employee view".

`file:line` references point at the source; line numbers drift as files change.

---

## 1. Feature index (checklist)

Every feature in the document, with its side and where it is described. `P` = Planned, `A` = Actual, `C` = Compare, `All` = all three views.

| # | Feature | Side | Modes | Section |
|---|---|---|---|---|
| 1 | Page header + "Page guide" button | View | All | 4.1, 4.15 |
| 2 | "No Store Selected" state | View | — | 4.1 |
| 3 | Loading skeleton / full-page load error / setup-error panel | View | — | 4.1, 6, 5.9 |
| 4 | Week navigation: previous / next / Today, week label | View | All | 4.2 |
| 5 | View switch: Planned / Actual + Compare toggle | View | All | 4.3 |
| 6 | Unsaved-shifts guard on navigation | Manage | P→other | 5.1.6 |
| 7 | Employee search (server-side, debounced) | View | All | 4.4 |
| 8 | Department filter (server-side) | View | All | 4.4 |
| 9 | "Needs attention" filter | View | A only | 4.4 |
| 10 | "Showing:" active-filter badges | View | All | 4.4 |
| 11 | Summary tiles (Expected Sales, Total Hours, Shifts, Active Staff, Est. Labor) | View | All | 4.5 |
| 12 | "Usual numbers" / "Odd days" card (history) | View | P | 4.6 |
| 13 | Odd-days calendar, day chart, list, legend lens, Left out / Included | View | P | 4.6 |
| 14 | Conflict banner, overtime banner | View | P | 4.7 |
| 15 | Schedule grid (rows, columns, sticky parts, totals) | View | All | 4.8 |
| 16 | Employee cell: avatar, name, role, Setting-up badge, skills chip, OT pill | View | All (OT pill: P only) | 4.8.3 |
| 17 | Hours column + Daily Totals footer | View | All | 4.8.4 |
| 18 | Day-block pills (time off / unavailable / partial) | View | All | 4.8.6 |
| 19 | Planned shift card, tooltip, markers | View | P | 4.9.1 |
| 20 | Draft (unsaved) shift card | View/Manage | P | 4.9.2 |
| 21 | Actual cards: ghost, no-show, worked, open | View | A | 4.9.3 |
| 22 | Timeclock review card (plan + unlinked punches) | View | A | 4.9.4 |
| 23 | Comparison card | View | C | 4.9.5 |
| 24 | Punch breakdown (segments) | View | A, C | 4.9.6 |
| 25 | Colour legend (info button) | View | All | 4.10 |
| 26 | "Plan vs usual" row (chart, table, fold, status text) | View | P | 4.11 |
| 27 | Employee profile dialog | View | All | 4.12 |
| 28 | Skills chip / skills list (read-only) | View | All | 4.12.2 |
| 29 | On-the-clock board (view) | View | All (current week) | 4.13 |
| 30 | Published schedules history + image viewer | View | All | 4.14 |
| 31 | Export as Excel (CSV) | View | P | 4.16 |
| 32 | Screenshot (PNG) | View | All | 4.16 |
| 33 | Data freshness label + Refresh button | View | All | 4.17 |
| 34 | Page guide tour | View | lg+ | 4.15 |
| 35 | Footer line: shift count / "Updating this week…" | View | All | 4.18 |
| 36 | Add shift (grid "+" → dialog → draft) | Manage | P | 5.1 |
| 37 | Edit a saved shift / edit a draft | Manage | P | 5.1 |
| 38 | Delete a saved shift (with Undo) / delete a draft | Manage | P | 5.1 |
| 39 | Save drafts (bulk create) / Cancel (discard) drafts | Manage | P | 5.1 |
| 40 | Override warnings (conflict / unavailable / on leave / published) | Manage | P | 5.8.1 |
| 41 | Employee set-up wait (not yet schedulable) | Manage | P | 5.8.2 |
| 42 | Bulk-operation progress + retry failed | Manage | P | 5.8.3 |
| 43 | Copy Previous Week | Manage | P | 5.2.1 |
| 44 | Clear Week / "Clear All Shifts" | Manage | P* | 5.2.2 |
| 45 | Save as Template / Load Week Template / delete template | Manage | P | 5.2.3 |
| 46 | Publish Week | Manage | P | 5.3.1 |
| 47 | Delete a published record | Manage | All except C | 5.3.2 |
| 48 | Employee Screenshot (staff-facing image) | Manage/Output | All | 5.3.3 |
| 49 | Availability: add / remove blocked times | Manage | P, A | 5.4.1 |
| 50 | Time off: add / remove | Manage | P, A | 5.4.2 |
| 51 | Worked as planned (✓ on a ghost card) | Manage | A | 5.5.1 |
| 52 | Mark as reviewed | Manage | A | 5.5.2 |
| 53 | Edit recorded time / Add coverage | Manage | A | 5.5.3, 5.5.4 |
| 54 | Mark No Attendance (no-show) | Manage | A | 5.5.5 |
| 55 | Agree a clock-in | Manage | A | 5.5.6 |
| 56 | Delete recorded time | Manage | A | 5.5.7 |
| 57 | Split / merge recorded shifts | Manage | A | 5.5.8 |
| 58 | Clock in / Clock out from the board | Manage | All (current week) | 5.6 |
| 59 | Error alerts, toasts, error announcer | Both | — | 6 |
| 60 | Setup-error panel | Admin set-up | — | 5.9 |
| 61 | Actions menu (every item and when it is enabled) | Both | All | 5.7 |
| 62 | Move a shift by dragging it onto another cell, or copy it with Ctrl (both are staged until Save) | Manage | P | 5.1.7 |

`P*` = the Actions-menu item is Planned-only; the footer "Clear All Shifts" button is not mode-gated (see §12).

---

## 2. Access and permissions

### 2.1 Who can open the page

- **Sidebar item** "Scheduling" (group "Store Management", `CalendarDays` icon) — `components/layout/sidebar.tsx:464-472`. A **bottom-nav mirror** exists with the same rule — `lib/nav/bottom-nav-items.ts:185-194` (default bottom nav is the first four eligible items; the user can customise it).
- Both are shown only if the logged-in user passes one auth-rule check: **Service `Operations`, method `GET`, path `/v1/stores/*/schedule/week`, for the selected store.**
  - A user holding a role named `super-admin` (global or store-level) bypasses all rules.
  - Otherwise the rules come from the server at login (`GET /auth/general-overview` → `authRules`), are matched by service + method + path, sorted by priority, and the first match decides. **No match = denied.** Which role/permission satisfies this rule is **not in this repo** — it is configured in the Auth Rules admin pages upstream.
- **No feature flag** gates scheduling (nothing in `lib/config/features.config.ts`).
- **No route guard**: `app/[locale]/(dashboard)/dashboard/scheduling/page.tsx` just renders `<SchedulingManager />`. The dashboard layout only checks "is logged in". Anyone logged in who types the URL gets the page; the server then refuses their calls if they lack permission.
- The nav check uses the **numeric store id**; API calls use the **store number** (e.g. `03795-00001`, `selectedStore.storeId ?? selectedStore.id`). With no store selected the nav item can still show while the page itself shows "No Store Selected".

### 2.2 What the UI restricts by permission

Exactly **one** client-side permission check exists in the whole scheduling area:

- `canSeeSkills` = `canAccessRoute({ service: "Operations", method: "GET", path: "/v1/skills/overview" })` (`scheduling-manager-new.tsx:570-574`). It decides only whether the **skill chips** (beside names) and the **skills list in the profile dialog** load. No access → silently no skills, no message. A failing skills request is also never shown.

Everything else is shown to every user who can open the page. Enforcement is **server-side only**: add/edit/delete shifts, save drafts, copy/clear week, templates, publish, availability, time off, all recorded-time actions, clock in/out. Labor cost, hourly-rate-derived figures and overtime are visible to anyone with page access (only the Employee Screenshot / Publish image strips pay-adjacent detail).

### 2.3 What restricts editing instead: the view mode

- **Planned** is the only view in which the schedule can be edited.
- **Actual** allows recorded-time review actions.
- **Compare** is read-only (no actions on cards; Availability button disabled; Published-history Delete hidden).
- **One exception**: the footer **Clear All Shifts** button is not mode-gated, so it can delete the planned week from Actual and Compare too (§12).
- The Actions menu greys out everything that edits the plan outside Planned and says why (see §4.3).

### 2.4 What the UI does on authentication / permission failures

| Situation | Behaviour |
|---|---|
| `401` response from the server | Clears the stored login and redirects to `/{locale}/auth/login` (`handleUnauthorized`; every hook except the employee set-up poll, which only shows the message in the waiting panel). |
| No local login token | The call fails on the client with the error "Not logged in." — shown as an alert, **no redirect**. |
| `403` on the week load, nothing cached | Full-page alert "Couldn't load this week's schedule" with the server message and **Try again**. |
| `403` on a write | The server's own message in the dialog / page alert; badge **"No permission"** if the code is `FORBIDDEN`. Write-failure alerts have **no Try again button** (Dismiss only, or inline in the dialog) — redo the action. |
| `403` on staffing / sales history | The proxy turns a failed half into "no data" and the 403 text is never shown. One half failing → the plan row says "Staffing history unavailable" / "Sales history unavailable". Both failing → the Usual numbers card shows an error with **Try again**. |
| `403` on skills | Swallowed silently — the chips just don't appear. |
| `STORE_NOT_MAPPED` / `POSITION_NOT_MAPPED` / `STORE_NOT_ALLOWLISTED` on the week load or a single-shift write | Whole page replaced by the **set-up panel** (§5.9). |
| `504 TIMEOUT` / `502 UPSTREAM_ERROR` (proxy) | Alert with a "wifi off" icon; message says nothing was changed. |

---

## 3. Page layout (top to bottom)

1. **Page header** — title "Employee Schedule", description "Manage weekly shifts for your team", Page-guide button (lg+).
2. **Alert stack** (only when something failed) — see §6.
3. **Toolbar, row 1** — week controls · view controls.
4. **Toolbar, row 2** — search · Availability · On the clock · Department · Needs attention (Actual) · [freshness · legend · Refresh · Actions].
5. **Summary row** — five stat tiles, with the "Usual numbers / Odd days" card beside them while planning.
6. **Banners** — shift conflicts (red), overtime (amber).
7. **"Showing:" filter badges** (when a filter is active).
8. **Draft action bar** (Planned, when unsaved shifts exist).
9. **The schedule grid** (with the pinned "Plan vs usual" row in Planned).
10. **Footer line** — shift count and "Clear All Shifts".
11. **Dialogs** — mounted at the bottom of the page (§4–§5).

Layout responds to the **width the page actually gets** (container queries), not the screen width, because the sidebar changes the content width by 192px.

---

## 4. USER SIDE — viewing features

### 4.1 Page shell

- **Header**: "Employee Schedule" / "Manage weekly shifts for your team". Beside it, a ghost **Page guide** icon button (`aria-label="Open page guide"`, tooltip "Page guide"), **visible from `lg` up only** (the tour can't land its highlights on a phone).
- **No store selected**: dashed card — icon, **"No Store Selected"**, "Select a store from the sidebar to view and edit its schedule."
- **First load (no data yet)**: skeleton — week controls, two toolbar blocks, four tile skeletons, and a tall grid skeleton.
- **Load failed, nothing cached**: full-page alert **"Couldn't load this week's schedule"** with the server's message and **Try again**.
- **Load failed, week already on screen**: compact alert **"Couldn't refresh this week"** (with Try again) above the toolbar; the stale week stays visible.
- **Setup problem**: the set-up panel replaces everything below the header (§5.9).
- Tooltips throughout the page open after **600 ms** of hover (`delayed-tooltip.tsx`), except the (i) "What are odd days?" button, which opens after **100 ms**.

### 4.2 Week navigation (`data-guide-id="sched-week"`)

- **Previous / next arrows** — move exactly 7 days. They are wrapped by the unsaved-shifts guard (§5.1.6).
- **Week label** — in a bordered pill with a calendar icon; the icon becomes a **spinner** while the week is refetching.
- **Today** button — appears only when you are *not* on the current week; jumps back to it (guarded).
- The displayed week is stored as the **ISO date of its first day**, not an offset, so a tab left open overnight can't silently re-point at another week. The server snaps whatever date is sent to the store's true week start and reports it back.
- **The week's first day is a per-store setting** (`week_start_dow`); fallback Tuesday. The dates and the start weekday come from the server payload; the day names are derived on the client from `week_start_dow`.
- You can browse any past or future week.

### 4.3 View controls (`data-guide-id="sched-views"`)

- **Planned | Actual** segmented switch — Planned shows the plan; Actual shows what was recorded (attendance).
- **Compare** toggle (tooltip: *"Comparison always shows both planned and actual times side by side"*). While Compare is on, the Planned | Actual switch is dimmed to 50% and disabled.
- **One request serves all three views** (`mode=both`), so switching costs nothing. Switching view also re-checks freshness (re-fetches if the cached week is older than 5 minutes).
- Moving **away from Planned** while unsaved shifts exist raises the unsaved-shifts dialog; moving *back to* Planned does not.
- **What each view shows**
  - **Planned** — saved shifts + unsaved drafts; plan row; Usual numbers card; conflicts/OT; Add buttons; Draft bar.
  - **Actual** — recorded attendance per shift (ghost / worked / no-show / open / coverage), the "Needs attention" filter, "Add coverage" buttons.
  - **Compare** — plan and actual in the same cell, read-only.
- **Actions menu in non-Planned views**: a note at the top explains why items are greyed — *"Compare is a read-only view. Switch to Planned to change the schedule."* or *"You're viewing recorded attendance. Switch to Planned to change the schedule."*

### 4.4 Finding people and narrowing the grid (`data-guide-id="sched-search"`)

- **Search employees...** — text input with a magnifier. Sent to the server (debounced **300 ms**); the server filters the roster **and** the shifts together so a filtered grid never shows a card without a row.
- **Department** dropdown (filter icon, shows the current choice, chevron). Options: **All** plus the store's mapped Humanity positions from the payload; the current one has a dot and heavier text. Also server-side.
- **Needs attention** button — **Actual view only** (hidden in Planned and Compare). Toggles a client-side filter to employees/shifts the server flagged. Shows an amber **count badge** when anything is flagged. Off by default on purpose (an empty-looking week reads as missing data). Tooltip: with flags — *"N shift(s) worth a look — a missed punch, a forgotten clock-out, hours that don't match the plan, or hours that changed after you signed them off."*; with none — *"Nothing needs a look this week. This filter shows missed punches, forgotten clock-outs, hours that don't match the plan, and hours that changed after you signed them off."* (`data-guide-id="sched-attention"`; has no tour step.)
- **"Showing:" badges** — when a department, search text or Needs attention is active: a badge per active filter, then **"(N employee(s))"** — the number of rows actually on screen (the attention filter narrows it again client-side).
- **These choices are plain page state**: search text, Department, Needs attention, the Left out / Included basis and the Planned / Actual / Compare view survive week changes and store switches, and reset only on reload.
- **Filters narrow everything built from the on-screen data** (footer count, Clear Week / Publish / Save-as-Template counts and enabling, the CSV, the screenshot and publish images) — see §5.2.4.

### 4.5 Summary tiles

Five tiles, in a grid that follows the container width. They **dim to 50%** while the week is settling (refetching, or a bulk save running) because the numbers are momentarily stale.

| Tile | Shows | Extra line |
|---|---|---|
| **Expected Sales** *(Planned only, when history exists)* | `compactMoney(expectedSales)` (e.g. $2.4k) | "busiest Tue · Sat" (top two days by expected sales) |
| **Total Hours** | `{n}h` (1 decimal) | "of {n}h usually worked" (Planned, when history exists) |
| **Shifts** | count | — |
| **Active Staff** | distinct employees with ≥1 shift | — |
| **Est. Labor** | `$` amount | "{x}% of sales · usually {y}%" when expected sales and hours exist; otherwise "at current rates" |

**Where the numbers come from**

- **Planned, no drafts**: the server's own `stats` (computed from the same `duration_minutes`, labor cost per employee).
- **Planned with unsaved drafts**: computed locally from saved shifts + drafts (drafts use clock-time arithmetic because they have no server duration).
- **Actual / Compare**: computed locally from the merged "what really happened" list (every linked record that isn't a no-show, plus ad-hoc coverage; plans with nothing recorded are excluded; see §8.5).
- **Labor rate chain**: employee's own hourly rate → store default labor rate → **$15** last resort.
- Beside the Usual numbers card (planned, wide) the tiles go 2 columns (3 from the widest tier) and the last tile spans the leftover columns; narrower, the card stacks under the tiles.

### 4.6 "Usual numbers" / "Odd days" card (Planned only; `data-guide-id="sched-staffing-guide"`)

The last four weeks of history, set against the plan being built. The numbers themselves live in the tiles and the grid's Plan-vs-usual row; this card is about **which days were unusual**.

**States**: skeleton while loading; a card with the error text and **Try again** if the history failed; nothing if no history and no error; the card once history arrives. The card holds its place while loading so tiles don't reflow. The history is requested **only while Planned is showing** — opening the page in Actual fetches nothing until you switch to Planned.

**Title row**
- With odd days: **"Odd days"** + count pill + the history window text (e.g. "Sep 1 – Sep 28 · the last 4 weeks").
- With none: **"Usual numbers"** + "{window} · no odd days" and only the basis switch.
- **Basis switch** — label "In the averages" (shown from `@md`), segmented **Left out | Included**, and an **(i)** button ("What are odd days?") whose tooltip explains: odd days are dates far from a usual week; *Left out* keeps them out of the averages so one wild day doesn't skew the plan; *Included* counts every day; plus "Now: left out of / counted in the averages." Default **Left out**. Page state only (not persisted).
- **View switch** — **Charts | List** (persisted in the browser, key `scheduling-odd-view`, default Charts).

**Charts view — calendar**
- 28-day window as week rows (a group labelled "Odd days in the last four weeks" for screen readers); weekday header (first 3 letters, in the store's week order); a month label on the first cell and on the 1st.
- A normal day is a dim number. An **odd day** is a button (tooltip and `aria-label` = the day's full sentence) with a kind **arrow**, the number, and a thin **bar** for how far off it was (relative to the furthest-off day, minimum 20%). Click opens that date's chart; the selected one has a ring.
- **Legend ("Light up days by kind")**: **Above usual** (green ↑), **Below usual** (red ↓), **Both** (blue ↕), **Normal** (grey ○), with day counts when wide. **Hover or focus** lights up that kind and dims the rest; **click pins** it (`aria-pressed`), click again unpins. Beside the calendar when wide, under it when narrow.
- **Help line** (live region): default *"Click a day with an arrow to see its hours."*; for a kind, its one-line meaning + "Left out of the averages." / "Counted in the averages."; for Normal: *"Normal: nothing unusual, so these days are always in the averages."*
- Colours are the app's DSPR palette only: green above, red below, blue both; arrows mean colour is never the only cue.

**Charts view — one date's chart** (click a day)
- Header: back arrow (`aria-label` "Back to the calendar"; **Escape** also goes back), the date, a kind pill, and an inline legend (Usual always; Above/Below usual only if an hour has that kind).
- Two columns when wide (stacked when narrow), separated by a thin vertical line, each a chart plus a whole-day figure:
  - **Sales per hour** + **Day sales** ($ vs usual, with signed % change).
  - **People on the clock** + **Labor hours** (h vs usual, with signed % change).
- Bars: grey = usual; colour = that date, **only at flagged hours**; a thin line marks the usual level; they grow upward on open (respects reduced motion). Tooltip per hour: the hour on one line ("5 PM"), then "{value} vs usually {usual}" / "usually {usual}" / "no history". Hours read "8 AM" style in this card.
- Footnotes: "No single hour stood out. The whole day was off." / "There is nothing to draw for this day." / "nothing odd here" on a chart with no flagged hours.
- Focus moves to the back arrow on open and returns to the day's cell on close. The day chart's own legend is also a lens (hover/focus dims the other kinds, click pins; "Usual" dims the coloured bars) and starts fresh for each date. The open day resets to the calendar when you switch to List or change week, store or basis, or when that date stops being odd. The List pane is keyboard-focusable so it can be scrolled.

**List view**: one line per odd date — kind icon (`aria-label` Above usual / Below usual / Both) + bold "Sat Sep 12:" + the sentence. Scrolls inside a fixed-height window.

**How the sentences are built**: up to two clauses per date then "(+N more)": "busy/slow day, $X in sales vs usually $Y", "10 AM–1 PM sales up to 2.7× usual" / "sales down to 40% of usual" (with ", N more/fewer people on"), "N more/fewer people on the clock than usual", "N labor hours vs usually M". Dates are ranked furthest-off first.

**History window**: the 4 complete business weeks before the earlier of the viewed week and the current week (planning a future week uses the same four weeks). Loaded once per window and cached for 30 minutes (max 12 windows). Retry bypasses the cache. One request is made; the proxy fetches sales history and staffing history in parallel and joins them, and if one fails the card still renders from the other.

### 4.7 Banners

- **Red** — "**N** shift conflict(s) detected this week — overlapping shifts for the same employee." (Planned only; from the server, computed on UTC instants so overnight overlaps are caught.)
- **Amber** — "**N** employee(s) exceed(s) the **{threshold}**h overtime threshold." (Planned only; threshold = the store's `overtime_threshold_hours`, default 40.)

### 4.8 The schedule grid (`data-guide-id="sched-grid"`)

#### 4.8.1 Structure
- A scrolling table inside a bordered card. Height is capped to the viewport (`max-h-[calc(100dvh-6rem)]`) so it scrolls inside itself.
- **Sticky header** (days + plan row pinned while scrolling vertically). **Sticky Employee column** from `md` up (on small screens it scrolls away).
- One **column per day**, in the store's week order. Each header: short day name, date number; **today's** column gets a tint, a primary-colour number and a small underline. ("Today" uses the viewer's browser-local date.)
- Day column widths grow with the plan row (wider when it is showing) and shrink in Compare.
- Flat list of employees — **no department grouping rows**. An empty roster is an empty table body.
- Employee column header "Employee"; Hours column header "Hours" (hidden in the staff-facing image).

#### 4.8.2 Rows
- Hover tint on rows; in **Planned only**, **overtime rows** carry an amber tint.
- Cells show cards (§4.9) and, in Planned, a ghost "+" (add) button; in Actual, a violet "+" (add coverage).

#### 4.8.3 Employee cell
- **Avatar** (image only when the avatar looks like a URL; otherwise a neutral person icon), **name** (a button — opens the profile dialog, §4.12), **role** line.
- **"Setting up" badge** (sky, spinner) when the employee isn't schedulable yet. Tooltip: "Not schedulable yet — This employee is still being set up in the scheduling system. It usually takes under a minute. Shifts cannot be created for them until it finishes."
- **Skills chip** — star + count of rated skills; amber with a triangle if any alert (§4.12.2). Hidden in the staff-facing image.
- **OT pill** (**Planned only** — the overtime list is emptied in Actual and Compare) — amber "OT" with a triangle. Tooltip: "{hours}h this week — exceeds {threshold}h threshold". Both the flag and the hours come from the plan (saved shifts + drafts).

#### 4.8.4 Hours column and totals (hidden in the staff-facing image)
- **Per employee**: `{n}h` or "—", with "{n} shift(s)" beneath; in Planned, overtime rows show amber text and "/{threshold}h".
- **Daily Totals footer**: per day `{h}h` + "{n} shift(s)"; last cell is the week total. Not sticky.
- Planned: saved shifts + drafts. Actual/Compare: the merged recorded-time list (§8.5), no drafts.

#### 4.8.5 The filter's effect on the grid
Rows narrow to employees with flagged recorded shifts (Actual + Needs attention), and cell contents narrow to flagged ones. (Totals still sum everything — see §12.)

#### 4.8.6 Day-block pills (all modes except the staff-facing image)
Small muted pills at the top of a cell, hover for details:
- **Time off** — pill shows the leave label (e.g. "Vacation", "PTO"); tooltip "{name} is off this day".
- **Unavailable** — whole-day block; tooltip "Unavailable all day" + the reason (or "{name} is marked unavailable this day").
- **Partial block** — tooltip "Partially unavailable" + each window "9:00 AM – 1:00 PM — reason".
- Whole-day-blocked cells also get a slate tint. Only the first time-off entry per employee-day is used.

#### 4.8.7 Cell contents by mode
- **Planned**: saved shift cards (server order), then draft cards, then the "+" add button.
- **Actual**: timeclock review groups first, then plan-based cards (ghost or worked), then ad-hoc coverage cards, then "+" add-coverage.
- **Compare**: one comparison card per paired plan/actual, then unmatched plans, then unmatched actuals. No buttons.

### 4.9 Shift cards

All cards share one look: a thin **rail** down the leading edge whose colour is the status, and the same surface. **Colour = status**; the legend (§4.10) explains it.

#### 4.9.1 Planned shift card (saved)
- **Face**: clock icon + "h:mm AM - h:mm PM"; label (with " ↻" if it repeats weekly).
- **Rail**: red = overlaps another shift; amber = scheduled over a block; none otherwise. (Conflict wins if both.)
- **Top-right markers**: red triangle (conflict), amber ban (block), indigo repeat (recurring). **Bottom-right**: sync spinner (pending) / red cloud-off (parked), grey building (origin Humanity/reconciler), amber note icon.
- Dashed border = recurring; faded = sync pending; dimmed with a spinner = an action is in flight on it (and it can't be clicked until the write finishes).
- **Hover** reveals a dark overlay with **pencil** (edit) and **trash** (delete). Clicking anywhere on the card also edits.
- **Tooltip**: times + hours (from the server's duration); status line — "Overlaps another shift" / "Scheduled over a block" / "Scheduled"; rows **Date** ("Saturday, Nov 14"), **Label** (+ "· repeats weekly"), **Sync** ("Saved — waiting to reach Humanity" / "Saved here, but not in Humanity"), **Origin** ("Last changed in Humanity"), **Note**; the block reason as a hint; and "Drag it to another cell to move it, or hold Ctrl and drag to copy it."
- Sync/origin icon tooltips: pending — "Saved here, not yet in Humanity… Staff cannot see it until then."; parked — "Needs attention — will not resolve on its own… The employee will never see it. Contact whoever runs the scheduling integration."; origin — "Changed in Humanity… Humanity is the source of truth for shifts, so its version wins."

#### 4.9.2 Draft (unsaved) shift card (Planned)
- Dashed border; "Unsaved" chip beside the label; amber rail/ban only if it sits on a block. No conflict/overtime marker (those are checked at save).
- Hover: pencil (edit the draft) / trash (remove it — immediate, toast "Unsaved shift removed").
- Tooltip: "{label} Shift — not saved", times and hours, "This shift only exists on your screen. Press Save to schedule it.", "Overlaps and overtime are checked when it is saved.", "Drag it to another cell to move it, or hold Ctrl and drag to copy it.", the block warning, the note.

#### 4.9.3 Actual cards (Actual view)
| State | Look | Caption | Meaning |
|---|---|---|---|
| **Ghost** (plan, nothing recorded) | dashed, faded, no rail | "{label} · Pending review" | Hover: ✓ (worked as planned) and pencil. Tooltip "Planned — not yet reviewed… Click ✓ to confirm, or the pencil to edit". |
| **No-show** | red rail, "No Show" with a user-x icon, plan struck through | — | Hover: pencil, trash. Tooltip "No attendance recorded" + "Planned: …". |
| **Open, never clocked out** | amber rail, amber dot | "Never clocked out" | Server flags it; hours stopped at the cap. |
| **Open** | neutral, **pulsing green dot** | "On the clock now" | Time shows "in progress". |
| **Added coverage** | violet rail, user-plus icon | "Added coverage" | Worked without being planned. |
| **Time changed** | amber rail, pencil icon | "Time changed" | Hours differ from the plan. |
| **Hours changed since review** | amber rail, pencil icon | "Hours changed since review" | Signed off, then the hours moved. |
| **Worked as planned / Recorded** | green rail, ✓ | "Worked as planned" / "Recorded" | |

- Recorded cards show an amber **note icon** bottom-right when a note exists.
- **"C" micro-badge** (`aria-label` "Recorded by the time clock") when the time clock recorded it; nothing for hand-entered.
- **Delta line** (e.g. "+20m", "−1h 05m") against the plan.
- **Hover buttons** (left→right): **✓ Mark as reviewed** (only when unreviewed and not still on the clock), **pencil Edit recorded time**, **scissors Split or merge this shift** (only when there are several punches or other same-day recorded shifts), **trash Delete recorded time**.
- **Tooltip**: times + hours; status; **Source** ("Time clock" / "Entered by hand"), **Plan**, **Against** ("+20m the plan"), **Label**, **Note**; hints for never-clocked-out ("The hours stopped counting at the cap. Only a real punch, or a correction on the time clock itself, can close this."), changed-since-review ("Your verdict was kept, but it no longer covers these hours. Worth a second look."), unreviewed ("Tick to accept it, or edit to correct the times.").

#### 4.9.4 Timeclock review card (Actual)
When exactly one plan in a cell has no linked recorded time and the time clock recorded punches that day, they're grouped under the plan:
- **Plan row** (read-only), a divider, then **one row per punch** ("In" on the first) with times (amber if it needs review), a note icon, and the punch breakdown.
- Per-punch **pencil** and **trash** (revealed on row hover or keyboard focus).
- Bottom row: "Needs review" / "Not linked to the plan" + the total delta, and an always-visible **✓ "Agree — record this clock-in as the actual"** (only when there is a single punch).
- Tooltip hints: one punch — "Tick to accept these times, or edit them first if the clock got it wrong."; several — "They came in more than once that day, so there is no single pair of times to accept — handle each one on its own."

#### 4.9.5 Comparison card (Compare; read-only)
Two rows: **Plan** over **Act**, with a delta line. Outcomes:

| Outcome | Rail / icon | Act row |
|---|---|---|
| Match | green ✓ | times |
| Differs | amber triangle | times in amber |
| Absent | red user-x | "No show" (plan struck through) |
| Unplanned | violet triangle | times; plan reads "Not planned" |
| Not recorded | none, dashed | "Not recorded" |
| In progress | clock | "{start}– in progress" |

Tooltip: status ("Worked as planned", "Worked different hours", "Did not attend", "Worked without a planned shift", "Not reviewed yet", "On the clock now"), **Plan**, **Actual**, **Against**, **Clocked** ("in +7m · out −4m"), **Note**, and hints ("Switch to the Actual view to record what happened."; for an open shift "Still being worked, so there is nothing to compare yet. The hours shown are what has been worked so far."). With nothing planned or recorded the Plan row reads "Nothing scheduled" and the Actual row "Nothing recorded" / "Did not work".
A cell with several punches falls apart into "Not recorded" plan + one "Not planned" card per punch.

#### 4.9.6 Punch breakdown (Actual and Compare)
When a recorded shift has 2+ punches, a numbered list under the card: "{in}–{out}" (null out = "still on the clock"), per-row origin tooltip ("Clocked in through this app" / "Entered by hand" / "Found on the time clock"), an amber triangle (`aria-label` "The time clock flagged a missed punch") when the clock flagged a **missed punch** ("The time clock flagged this one — the time shown is its own default, not something the employee punched."), and a footer "{time} off the clock, not counted".

### 4.10 Colour legend (toolbar info button; `data-guide-id="sched-legend"`)

Popover "What the colours mean" — "The bar down the leading edge of a shift." Five rows:
**Green** Worked as planned (Actual · Compare) · **Amber** Needs a look — hours don't match the plan, changed after sign-off, or the shift sits on a block (All) · **Red** A problem — no-show, or overlapping shifts (All) · **Violet** Worked without being planned (Actual · Compare) · **None** Nothing to flag — including a shift still being worked (All).
Plus a "Needs attention" section ("The time clock flags a shift when: it recorded a missed punch / somebody never clocked out / the hours don't match the plan / the hours changed after you signed them off. Use the Needs attention button in the toolbar to see only these.") and a "C" section ("Recorded by the time clock — Anything without it was entered by hand").

### 4.11 "Plan vs usual" row (Planned; pinned under the day headers)

Shown only in Planned, when history exists or is loading; hidden in the staff-facing image. If the history failed to load the row just isn't there (no message).

**Left cell**
- Title button **"Plan vs usual"** with a chevron (`aria-expanded`) — **folds the whole row** to its title bar (animated).
- Colour key: **Short** (amber), **OK** (green), **Extra** (sky), **Usual** (grey).
- Hint (from `sm`, chart visible): "Hover a bar for that hour in full, in every day."
- **Chart** and **Table** switches — hide/show each body on its own while the totals and status words stay (`aria-label` e.g. "Hide the chart: the hour-by-hour bars", native tooltip, `aria-expanded`).
- Amber notices: "Staffing history unavailable" / "Sales history unavailable".
- **Fold / Chart / Table states are remembered** in the browser (key `scheduling-plan-row`) — one preference for all stores and users on that browser.

**Each day's cell**
- **Top line**: expected sales (e.g. "$2.4k") and "planned/usual h" (e.g. "32/38h").
- **Hour chart**: one column per hour shared by all days; grey = people usually on the clock, colour = your plan, coloured by status; a thin line marks usual. **Hover** an hour: it highlights in all seven days and the tables, and a tooltip shows — **On the clock** (usual, with range), **Scheduled** (usually scheduled), **Your plan** (with +/−), **Sales** (with range), **Orders**, **Sales / person**, and any odd-day notes for that hour.
- **Hour table**: per hour — usual, plan, sales; up to six rows visible then scrolls (all seven days scroll together); "avg" and "total" summary rows.
- **Status lines**: "No history for this day" / "Not started · peak {n} at {hour}" / ✓ "Matches usual" / gap lines such as "Short 2 · 5–7p" (amber) or "Extra 1–2 · 8–10p" (sky), up to three then "+{n} more".
- **Footnote**: "From {x} of {y} weeks" when fewer weeks than the window counted.
- **Last column**: "usual {n}h" for the week.
- **Rules**: an hour is *Short* when the plan is ≥0.75 people under usual, *Extra* when ≥1.5 over, *closed* when usual is under 0.25 and nothing is planned. The strip shows only hours that matter (usual ≥0.25, sales >0, or planned >0). The plan includes unsaved drafts, so the row moves the moment a shift is placed. Hours are labelled like "5p".
- The bars and table rows are mouse-hover only (not keyboard-focusable).
- The Chart/Table switches and the hint exist only when the plan has hours; each day shows a skeleton while history loads; the table's avg/total rows appear only with more than one hour.

### 4.12 Employee profile dialog

Opened by clicking an employee's name. **Read-only.**
- Header: avatar, name, **Role** badge, **Department** badge.
- **Week stats**: **Hours** (amber "OT /{threshold}h" when over — Planned only), **Shifts**, **Recurring** — computed from the planned saved shifts.
- **Skills** section (see below) when available.
- **"This Week"** list: time-off cards (purple dashed), availability cards ("Unavailable all day" / "Unavailable {start} – {end}"), shift cards (label, repeat icon, times · hours, note in amber italic). Empty text: "No shifts scheduled this week".
- No pay rate, contact details, clock status or actions.

#### 4.12.2 Skills (read-only; needs the skills permission)
- **Chip** beside the name: star + rated count, or amber triangle + count if an alert exists. Tooltip lists each skill with its rating (★ n, "—" unrated, or "Not for under {age}"); alert lines amber; hint "Under 18 and rated on a restricted skill: don't place them on or near it."
- Ratings are **edited on the Skills page**, not here. An alert is advisory only. The chip is not drawn at all when the employee has no ratings and no alerts.

### 4.13 On the clock (board; `data-guide-id="sched-on-the-clock"`)

Toolbar button **On the clock** (radio icon). **Enabled only on the current week** (tooltip: "Who is punched in right now, and clock people in or out"; otherwise "Only while you're on this week — the board shows who is on the clock right now, which has nothing to do with the week you're browsing."). The dialog closes by itself if you navigate off the current week. Works in all views.
- Title **"On the clock"**; description "Everyone punched in at this store right now, however they punched — here, a clock in the store, or the time-clock system itself."
- Freshness label and **Refresh** button. (The label is the same component as the toolbar's, so its tooltip still says "Refreshes automatically once it is more than 5 minutes old" even though this board refreshes every 30 s.)
- **Live updating**: fetches on open and every **30 s** while the tab is visible; refetches when you return to the tab; stops on close. The first load shows two skeleton rows; refreshes don't. The endpoint reads our own database (no time-clock quota).
- **List**: pulsing green dot (amber static if stale), name, "since {time} · {Xh YYm} so far". Over **16 h** it reads **"never clocked out"** (amber) with no running total. Empty: "Nobody is on the clock."
- **"Not on the clock"** section: roster employees who are off the board (the roster respects the grid's search/department), role line or "Not set up for clocking".
- Errors: "Couldn't check the clock" (Try again), "Couldn't record that punch" (Dismiss). The list stays visible beside an error.
- Clock in / out buttons are covered in §5.6.

### 4.14 Published schedules history (Actions → "Published History"; all views)

- Dialog **"Published schedules"** — "Weeks that have been published for staff. Re-publishing a week supersedes its previous record."
- **Cards**: week label, publish date badge, **thumbnail** of the posted image (click → viewer; "No screenshot" if none), "{n} shift(s) · {h}h · week of {date}", **"Superseded"** badge on replaced records.
- **Viewer** dialog: the full image, "Posted {date at time}", link **"Open the original image"** (new tab), Close.
- Empty: "No published schedules yet. Publish a week to post it for staff."
- Error alert "Publishing problem" with Dismiss. Lists the latest 24.
- No Unpublish or Restore exists (backend has no route).
- The list loads when the page opens (and on store change / after a publish), **not** when the dialog opens, and has no loading state (it briefly reads "No published schedules yet…"). Records published by someone else appear after a reload. If the list fails to load, the page-level alert is titled "Couldn't publish this week" even though nothing was being published.
- Delete is a manage action — §5.3.2.

### 4.15 Page guide (tour)

- Button in the header (lg+). 13 steps; target elements are matched by `data-guide-id`, and a step whose target isn't on the page is dropped (e.g. the staffing-history step while it is loading or in a non-Planned view).
- **The tour drives the view** (Planned → Actual → Compare …) and **restores the one you were on** when it ends. Drafts are untouched.
- Steps: (1) How scheduling works here *(intro, no spotlight)*; (2) The week on screen; (3) Switching between the views; (4) Planned — building the week; (5) Plan against a usual week; (6) Actual — what really happened; (7) Compare — plan against reality; (8) What the colours mean; (9) Finding one person; (10) Who is working right now; (11) When people cannot work; (12) Keeping it up to date; (13) Everything in the Actions menu.
- Controls: intro has **Skip** / **Start Tour**; others **Prev**, progress dots (click to jump), **Next**, **Done**; a progress bar and numbered step badge; an **X** (`aria-label` "Close guide") at the card's top right; **clicking the dimmed backdrop closes it**; keyboard **← →** (also ↑ ↓) to move, **Esc** to close; a hint pill at the bottom ("← → navigate · Esc to close"). A spotlight highlights the target and the page scrolls to it.
- The "Needs attention" button has a guide anchor but no step.

### 4.16 Exports and captures (Actions menu)

- **Export as Excel** (Planned only) — downloads a **CSV with a UTF-8 BOM** so Excel opens it directly. File `schedule-{week-label}.csv`. Columns: Employee, Role, Department, one per day ("Tue 4"…), Total Hours, Total Shifts; each cell "9:00 AM-5:00 PM (Morning)" (several shifts joined with " / ", "—" for none); a blank row then **Daily Totals**. Uses **saved** shifts only (no drafts) and follows the active Department/Search filter. Toasts: "Schedule exported as Excel CSV" / "Export failed".
- **Screenshot** (all views) — PNG of the **whole grid** (not just the visible part), `schedule-{week-label}.png`. Toasts "Screenshot downloaded" / "Screenshot failed" / "Could not find grid". Elements marked `data-screenshot-ignore` (the guide button) are left out. It captures the grid **exactly as on screen** (drafts, the Plan-vs-usual row, filters, current view; only the draft bar sits outside), temporarily unclipping and widening the page at 2× scale, reduced so the longest side stays ≤ 12,000 px (a huge grid gives a softer image, not a failure).
- **Employee Screenshot** — see §5.3.3.

### 4.17 Freshness and refresh

- **Data freshness** (toolbar, hidden when the toolbar is narrow): "Refreshing…" / "Updated just now" / "Updated {n} min ago" / "Updated {n} hr ago" (relabelled every 30 s). Tooltip: "Last fetched at {time}" and "Refreshes automatically once it is more than 5 minutes old."
- **What "automatically" really means**: weeks are cached in memory for **5 minutes** (max 24 entries; the key includes the Department and Search filters, so each filter combination is its own entry and its own request). A cached week older than that is re-checked **when you return to the tab or switch view** — there is **no timer** polling the week.
- **Refresh button** (tooltip "Fetch this week again now") drops every cached week for the store and refetches; spinner while loading.
- Writes to shifts, recorded time, availability / time off, bulk operations and clock punches are followed by a refetch of the week; template and publish writes refresh only their own lists.

### 4.18 Footer line

"**N** shift(s) scheduled this week" — or "Updating this week…" with a spinner while the week is settling. At the right, **Clear All Shifts** (red text) when any shift exists (see §5.2.2).

### 4.19 Accessibility, direction and theming

- The **Left out | Included** and **Charts | List** switches are real toggle groups: one tab stop, arrow keys move, pressing the selected option again does nothing.
- **Right-to-left (Arabic)** is supported through logical spacing and mirrored chevrons/slide directions; every card and dialog has a dark-mode variant.
- **Reduced motion** is honoured for the fold animations, the plan-row transitions and the odd-day bar growth.
- Known keyboard/screen-reader gaps are listed in §12.

---

## 5. ADMIN / MANAGER SIDE — features that change data

### 5.1 Planning shifts (Planned view)

#### 5.1.1 Add a shift
- Click an empty cell's **"+"** (ghost button, dashed border on hover). Tooltip: "Add shift for {name}"; on a blocked day, amber text "{name} is on {label} this day" / "{name} is marked unavailable this day" + "You can still schedule over it."; for an unsynced employee the button is **disabled** with "{name} is still being set up and can't be scheduled yet".
- Opens the **Add Shift** dialog (§5.1.3). Confirming makes a **local draft — no request is sent**, no toast.

#### 5.1.2 Edit
- Click a saved card (or its pencil): **Edit Shift** dialog → sends the change **straight to the API** (toast "Shift updated").
- Click a draft card: edits the draft **locally**.

#### 5.1.3 The Add / Edit Shift dialog
- Title "Add Shift" / "Edit Shift"; description "Schedule/Update a shift for **{name}** on **{day}**"; employee card with name and role.
- **Quick Presets** (toggle buttons): **Morning** 08:00–16:00, **Evening** 16:00–22:00, **Night** 22:00–06:00, **Split AM** 10:00–14:00, **Split PM** 17:00–21:00. A preset sets times, label and type. Defaults for a new shift: Morning (08:00–16:00).
- **Start Time / End Time** — native time inputs. Editing either clears the preset, sets type to "custom", and renames Morning/Evening/Night/Split AM/Split PM to "Custom". An end at or before the start is treated as **overnight** (+24 h). No validation blocks saving.
- When editing a saved shift or a draft whose start and end exactly match a preset, that preset shows as selected.
- **Shift Label** — Morning, Evening, Night, Split AM, Split PM, Custom (changes the label only).
- **Note (optional)** — 200 characters max, placeholder "e.g. Cover for Marco, Station 2 only...".
- **Advisory warnings** (never block): red "This shift overlaps with an existing shift for {name}" (saved shifts only, not drafts); amber "{name} is marked unavailable during this time"; purple "{name} has time off on this day".
- **Duration preview**: "{start} → {end}" and "{hours} hours".
- Footer: **Cancel**; **Add Shift** / **Save Changes** (shows "Saving…"); hidden while a set-up wait is showing. The dialog doesn't close until the write actually succeeds, so your input survives a refusal.
- **No "recurring" control exists.** The flag is read from the server for display (dashed border, repeat icon, profile counts) but is never sent when saving.

#### 5.1.4 Delete
- **Saved shift**: hover trash, **no confirmation**. Toast **"Shift removed"** with an **Undo** action that re-creates the shift with `force` (it restores the hours, not the original row/id); a successful Undo shows the toast **"Shift added"**. A refused delete shows an alert; the week is refetched either way.
- **Draft**: immediate removal, toast "Unsaved shift removed".
- If the shift belongs to an already-published week the server asks for confirmation (§5.8.1).

#### 5.1.5 Drafts, Save and Cancel (the draft action bar)
- New shifts are **drafts, stored in the browser** (key `scheduling-drafts`), one set **per store and week**, kept for **7 days**; changing week or store **parks** them rather than losing them.
- **Draft bar** (Planned only, when ≥1 draft; not part of screenshots): "**+N** shift(s) not scheduled yet". Sub-text: "Overlaps and overtime are checked when you save." — or, in replace mode (after Copy Previous Week), amber "Saving replaces everything currently in this week."
- While saving, both buttons are disabled and Save reads "Saving…" with a spinner.
- **Save N shift(s)** → bulk create (up to **500 per request**; more are split, and only the first request may carry *replace*). Drafts clear **only after the server accepts**; the progress dialog (§5.8.3) takes over. If the **whole** batch fails, the drafts are put back (always in **merge** mode — a Copy-Previous-Week set loses its replace mode) with "Nothing was saved — your shifts have been put back."; per-item failures are retried from the dialog, not re-drafted.
- **Cancel** → confirm "Discard N unsaved shift(s)?" ("This removes the shifts you have laid out but not saved, and reloads the week as it is actually scheduled. This cannot be undone.") — **Keep editing** / **Discard**; toast "Unsaved shifts discarded".
- Stats, the plan row and the grid hours include drafts immediately.

#### 5.1.6 Unsaved-shifts guard
While drafts exist for the current week, a dialog **"{n} shift(s) not scheduled yet"** ("…so staff cannot see it/them yet. Your work is kept as a draft…") appears with **Stay and save** / **Leave anyway** (or **Continue anyway**) before: week prev/next/Today, leaving Planned, clicking any in-app link (sidebar, bottom nav), and closing/reloading the tab (the browser's own prompt). Link interception ignores Ctrl/Cmd/Shift/Alt-clicks, non-left clicks, new-tab, download and `#` links, other origins and links to the current page. **Browser Back/Forward is not intercepted.**

#### 5.1.7 Move or copy a shift by dragging it (Planned only)
Drag a **saved shift card or a draft card** onto any other employee × day cell — the same person on another day, or a different person. A plain drag **moves** the shift; hold **Ctrl** (**⌘** on a Mac) when you drop to **copy** it instead. The key is read at the moment of the drop, so pressing or releasing it mid-drag changes the outcome, and the floating preview says "· move" or "· copy" (with a copy icon) as you go. A touch screen has no Ctrl, so a touch drag always moves.
- **Moving a draft**: it simply changes cell and keeps its note. Dropping a *moved* draft back on the cell its original came from, with the time and label unchanged, **undoes** the move (toast "Move undone — the shift is back where it was.").
- **Moving a saved shift**: the original disappears from its cell at once (it is a *pending removal*, still on the server) and a draft with the **same time and label** (plus the shift type, **not** the note) appears in the new cell. The draft bar counts the pair as **one** change and adds "N moved — the originals are removed when you save." Trashing that draft later deletes the shift outright (the original stays hidden and is deleted on Save).
- **Copying** (Ctrl/⌘ + drag): the original stays and an ordinary draft is added — time and label only, no note, not recurring.
- **Staged, like everything in Planned**: nothing is sent until **Save**. The hours, totals (including the week total), the Plan-vs-usual row and the draft bar follow at once. **Cancel** restores every original. Pending removals are kept with the drafts per store and week (same 7-day expiry). Export, Publish and the "Save as Template" check see the saved state, not staged moves.
- **What Save does with a move**: it creates the new shifts first (the usual batch and progress dialog), and only when that finishes cleanly does it delete the originals, one request each, then shows "Moved N shift(s)". If the whole batch fails, the drafts and the hidden originals both come back ("Nothing was saved — your shifts have been put back."). If it finishes with errors, or we lose track of it, **no original is deleted**, they reappear, and a warning says moved shifts may now appear twice. If a delete fails, that original stays hidden and Save retries it. A week that is already published asks once ("This week is already published… Delete anyway") before the originals are deleted. After Copy Previous Week (replace mode) the server already replaces the whole week, so no separate deletes are made. If only originals are left (a moved draft was trashed) Save deletes them directly, with no progress dialog ("Removed N shift(s)").
- **While dragging**, the original fades and the cell under the pointer is tinted: **blue/primary** = fine, **amber** = that person is on leave or unavailable at that time, **red** = that person is still being set up. The tint only follows what is really visible under the pointer, so a cell hidden under the sticky Employee column or the pinned header is never the target.
- **Warning, not a block**: dropping on an amber cell still moves or copies, with the toast "Shift moved/copied — {name} is on {leave} this day" / "…is unavailable: {reason}" / "…is marked unavailable at this time"; the new card carries the usual amber marker. A person **still being set up** cannot take one: the toast reads "{name} is still being set up and can't be scheduled yet" and nothing changes.
- **Does nothing** when dropped on its own cell, outside the grid, or after pressing **Esc**. Overlaps with the person's existing shifts are **not** checked (drafts never are; the server reports overlaps after Save). Overtime pills and the conflict banner come from the server, so they do not reflect a staged move until Save.
- **Starting a drag**: mouse — move the pointer about 6 px after pressing; touch — press and hold for about a quarter of a second (so ordinary scrolling still works). A plain click still opens the card for editing, and the hover pencil/trash still work. The grid scrolls by itself when you drag toward its edge.
- **Not draggable**: any card in Actual or Compare, anything in the staff-facing image, and a shift with an action in flight. The shift tooltips say "Drag it to another cell to move it, or hold Ctrl and drag to copy it."; the page guide mentions it in the "Planned — building the week" step.
- There is no keyboard way to move or copy a shift (the cards are not keyboard-operable today either).

### 5.2 Whole-week actions (Actions menu — Planned only)

#### 5.2.1 Copy Previous Week
- Confirm dialog "Copy previous week’s schedule?" — says it will **replace** the current week and how many existing shifts will be overwritten. **Yes, copy schedule**.
- It loads last week and creates **drafts** (not a direct server copy), so you can review. Employees no longer on this week's roster are skipped, with toasts naming them. Toasts: "Copied N shift(s) — review, then press Save.", "The previous week has no shifts to copy.", "None of last week's staff are on this week's roster, so there is nothing to copy.", "Skipped shifts for {names} — not on this week's roster."
- Saving those drafts uses **replace** mode.
- **Any drafts already laid out for that week are overwritten without warning** — the confirm dialog's "N existing shift(s) will be overwritten" counts saved shifts only.
- "On this week's roster" is decided from the **server-filtered** roster, so with a Department or Search filter active everyone outside the filter is skipped (and named in the "Skipped shifts for…" warning), and the result is saved in replace mode — so clear Search/Department before copying. (The previous week itself is fetched with `mode=planned` and no filters.)
- If last week can't be loaded: toast with the server's message, or "Could not load the previous week."

#### 5.2.2 Clear Week
- Actions item (needs shifts and Planned) and a footer **Clear All Shifts** button. Confirm "Clear this week?" — "This deletes all **N** shifts in **{week}**. Employees may already be working from this schedule, and this cannot be undone." **Cancel** / **Clear week**.
- Runs as a background batch with progress (§5.8.3). No undo.

#### 5.2.3 Templates
- **Save as Template** — dialog "Save as Template" ("Save the current week's N shift(s) as a reusable template.") with **Template Name** (required; placeholder "e.g. Standard Week, Holiday Coverage..."; Enter saves) and **Description (optional)** (placeholder "Add any notes about this schedule template..."); **Cancel** / **Save Template** (disabled until a name is typed). The server snapshots the week itself. Blocked with a toast if unsaved drafts exist ("Save your unsaved shifts first — a template can't include them."), the name is empty ("Please enter a template name") or the week has no shifts ("No shifts to save as a template"). Toast `Template "{name}" saved`. A failure shows inside the dialog as "Couldn't save this template".
- **Load Week Template** — dialog "Load Week Template" ("Choose a saved template to load into **{week}**. This will replace all current shifts.") lists templates (name, description, shift count, hours, created date) with a hover **trash** (delete → toast "Template deleted"; a failure shows "Couldn't delete that template" inside the dialog) and a **Load** button. Loading **replaces all current shifts** and runs as a batch. Empty state: "No templates saved yet. Use "Save as Template" to create one from any week." (Item disabled when there are no templates.)
- Up to 50 templates are listed. There is no template preview or rename.
- One shared error slot serves both template dialogs: a failure to **load the template list** ("Could not load templates.") appears only inside the Save dialog under the title "Couldn't save this template" and stays until dismissed. The list loads when the page opens, on store change and after a save.

#### 5.2.4 Active filters and the whole-week actions
The Department and Search filters are applied by the server, so the shifts and roster the page holds are the **filtered** ones, and most whole-week actions read that list:
- The footer "N shifts scheduled this week", the Clear Week confirm text ("This deletes all N shifts…"), and the enabled/blocked state of Clear Week, Publish Week and Save as Template (and its "No shifts to save as a template" toast) all use the **filtered** count.
- **The Clear Week request itself carries no filter — it clears the whole week**, so with a filter active the confirm text can understate how many shifts will be deleted.
- Export CSV, Screenshot, Employee Screenshot and **Publish Week** capture only what is on screen, so a filter narrows the image posted for staff.
- Clear Week and Load Week Template **neither warn about nor touch unsaved drafts**; the drafts stay on screen and still save later in whatever mode they were in.

### 5.3 Publishing and staff-facing output

#### 5.3.1 Publish Week (Planned; needs shifts)
- Actions → **Publish Week** runs **immediately, with no confirmation**; the on-screen grid briefly flips to the employee view (about 100 ms) while it is captured. The grid is captured in the **employee view** (no hours/totals/time-off blocks etc.) as a PNG and uploaded with the week; toast **"Week published"**.
- If the capture fails it still publishes, with warning "Publishing without a preview image — the grid couldn't be captured." Images over 8 MB are refused ("The schedule image is too large to upload. Try again with fewer employees on screen.").
- Re-publishing supersedes the earlier record. Unsaved drafts do **not** block publishing (they aren't in the published week).
- Failure alert: "Couldn't publish this week" (or inside the history dialog if it is open).

#### 5.3.2 Delete a published record
Inside the history dialog: **Delete** under each card — **immediate, no confirmation**; toast "Published schedule deleted". Hidden in Compare.

#### 5.3.3 Employee Screenshot (all views)
Downloads `schedule-employees-{week-label}.png` — the grid re-rendered in **employee view**: no Hours column, no Daily Totals, no sticky chrome, no plan row, no time-off/availability pills, no block reasons, no draft cards, no Add button, no skills chip. Toast "Employee schedule screenshot downloaded".
*(Some indicators still appear in that image — see §12.)*

### 5.4 Availability and time off (`data-guide-id="sched-availability"`)

Toolbar **Availability** button (calendar-off icon): works in **Planned and Actual**, **disabled in Compare** (tooltips "Manage blocked times and time off for this week" / "Not available while comparing — switch to Planned or Actual"). Dialog **"Availability & time off"** — "Blocked times and leave for {week}." Tabs **Availability** and **Time off**; footer **Done**. Errors surface in the page alert "Couldn't save that entry" (Dismiss). The Employee picker lists the **server-filtered roster**, so a Department/Search filter narrows it.

#### 5.4.1 Availability tab
- **Employee** (placeholder "Select employee"), **Day** ("{day} {date}"), **Repeats** (*Every week* / *This date only*), **Blocked** (*All day* / *Part of the day* → **From** (default 18:00) and **To** (default 23:00)), **Reason** (placeholder "Evening class", 190 chars).
- **Add blocked time** → toast "Blocked time added".
- **List**: "No blocked times this week. Employees with nothing on file are treated as fully available." Each row: name, "{Day} · All day" or "{start} – {end}", reason, trash (no confirm; toast "Blocked time removed"). Rows with the **"From profile"** badge (lock; "This comes from the employee's own availability record. Change it in the hiring system, not here.") can't be deleted.

#### 5.4.2 Time-off tab
- Info: "Leave added here is a scheduling hint, not an approval. It stays in this dashboard and is not sent to the HR system, so it does not replace a real time-off request."
- **Employee**, **Type** (PTO, Vacation, Sick, Unpaid, Other), **First day**, **Last day**, **Label** (optional, "Family holiday"). **Add time off** → "Time off added" (one entry per day is created). Last day can't precede First day (input minimum, and clamped on submit); a blank Label defaults to the type's name. After adding, only the Label is cleared (after Add blocked time, only the Reason). List rows show name, label badge and "{Day} · {date}" — the type isn't shown separately.
- **List**: "No time off recorded for this week." Rows with the **"Approved in HR"** badge ("…has to be withdrawn there — deleting it here would only bring it back on the next sync.") can't be deleted; others have a trash → "Time off removed" (removes the whole range).
- Create and delete only — there's no edit.
- Effects: blocks appear as pills (§4.8.6), as warnings in the Add Shift dialog, and the server can refuse (and let you override) scheduling over them.

### 5.5 Recorded time (Actual view)

#### 5.5.1 Worked as planned
Hover ✓ on a ghost card — one click, no dialog. Toast "Marked as worked as planned".

#### 5.5.2 Mark as reviewed
Hover ✓ on a recorded card that is unreviewed and not still on the clock — toast "Marked as reviewed".

#### 5.5.3 Edit recorded time (dialog)
- Title **"Edit Actual Time"** (against a plan), **"Add Coverage"** (new, nothing planned) or **"Edit Coverage"**.
- Shows "Planned: {start} – {end} ({label})". Fields: **Start/End time**, **Shift Label**, **Note (optional)** (200 chars; placeholder "e.g. Clocked in late, covered for another employee..."), duration preview.
- **Disabled while the person is still on the clock** ("…so these times cannot be edited yet. They will finish when the clock-out comes through.").
- Editing a timeclock punch that sits on a plan **links it to the plan in the same save**.
- **Shift Label** select (placeholder "Choose a label"): the five preset names plus "Custom". There are no Quick Presets here, and editing times does **not** rename the label to "Custom" (unlike Add Shift). Opening it on a no-show seeds the form from the **plan's** times. **Mark No Attendance stays enabled while the person is on the clock** (only the time inputs and Save are disabled).
- Footer: **Mark No Attendance** (only with a plan), **Cancel**, **Save**. The dialog closes immediately; failures appear later as "Couldn't record that". Toasts: "Actual time saved", "Coverage added", "Coverage updated".

#### 5.5.4 Add coverage
Violet **"+"** in an Actual-view cell (tooltip "Add coverage for {name}") opens the same dialog blank — for hours someone worked that weren't planned.

#### 5.5.5 Mark No Attendance (no-show)
From the edit dialog. If nothing was recorded yet, a single call to the server's "absent-actual" endpoint marks the plan as a no-show. Toasts "Marked as a no-show" / "Marked as no attendance".

#### 5.5.6 Agree a clock-in
✓ on a timeclock review card: links the punch to the plan **leaving the clock's times as recorded**. Toast "Clock-in accepted".

#### 5.5.7 Delete recorded time
Trash → confirm **"Delete this recorded time?"** — "This removes the {start} – {end} record. Worked time feeds payroll, so this deletes it there too and cannot be undone." For a time-clock punch it adds "**Somebody physically punched this on the time clock.** Deleting it throws away the evidence of when they were here, and nothing on this page can put it back — only a real punch, or a correction made on the clock itself." **Cancel** / **Delete**. Toasts "Reverted to planned schedule" (a linked record) / "Coverage removed".

#### 5.5.8 Split / merge (scissors) — "Adjust recorded shift"
The backend groups punches under an hour apart; a manager can undo that either way. **Neither action changes hours or touches the time clock.**
- Description: "{name} · {range} · {h}h {m}m worked". If already hand-adjusted: "Somebody has already adjusted this one by hand, so the automatic grouping will leave it alone from now on."
- **Split** — "Was this two shifts?" ("Tick the punches that belong to the second shift. The rest stay on this one.") Each row: number, "{in}–{out}", duration, and an amber triangle for a missed punch. Shown only with 2+ punches. Tick the punches for the second shift → **Split off {n}m**. Can't tick all ("Leave at least one punch behind — a shift cannot end up empty."). Toast "Split into two shifts".
- **Merge** — "Was this all one shift?" ("Tick anything recorded separately that was really part of this shift. The hours do not change.") Rows show range and duration. Shown only when the person has other recorded shifts that day. Tick them → **Merge into this shift**. Both actions close the dialog at once (footer button **Close**); failures appear later as "Couldn't record that". Toast "Merged into one shift" / "Merged {n} shifts into one".
- Empty: "One shift, one punch, nothing else recorded that day — there is nothing to regroup."

### 5.6 Clocking people in and out (On-the-clock dialog)
- **Clock out** on each person on the board; **Clock in** on each off-board employee. Buttons show a spinner while their own punch is pending. Toasts "{name} clocked in" / "{name} clocked out"; afterwards the board and the week refresh.
- Disabled when: the store isn't enabled for time-clock writes (all buttons), or that employee isn't linked to the time system (Clock in, with the text "Not set up for clocking" — this is only learned after a Clock-in attempt is refused with "Not in the time system", and is then remembered until reload).
- Sends no custom time and no position — it punches "now".
- Special outcomes: "Already on the clock" / "Not on the clock" / "Time system rejected it" (the board and week refresh after each; the rejection reason is shown under the message), "Too many requests", "Daily limit reached" (the time system's daily write budget).

### 5.7 Actions menu — every item and when it is enabled (`data-guide-id="sched-actions"`)

The **Actions** dropdown sits at the right end of toolbar row 2, after the legend and **Refresh**. In Actual and Compare a note at the top explains why most items are greyed (see §4.3). Group headings are Schedule, Publish, Templates, Export, Capture.

| Group | Item | Does | Enabled when |
|---|---|---|---|
| Schedule | **Copy Previous Week** | Drafts last week's shifts into this week (§5.2.1) | Planned, and not already copying |
| Schedule | **Clear Week** | Deletes every shift in the week (§5.2.2) | Planned, and the week has shifts |
| Publish | **Publish Week** | Posts the week for staff with a preview image (§5.3.1) | Planned, the week has shifts, and not already publishing |
| Publish | **Published History** | Opens the published-schedules dialog (§4.14) | Always (all three views) |
| Templates | **Save as Template** | Saves this week's pattern (§5.2.3) | Planned, and the week has shifts |
| Templates | **Load Week Template** | Applies a saved pattern, replacing the week (§5.2.3) | Planned, and at least one template exists |
| Export | **Export as Excel** | Downloads the CSV (§4.16) | Planned, and not already exporting |
| Capture | **Screenshot** | PNG of the whole grid (§4.16) | Always, unless one is in progress |
| Capture | **Employee Screenshot** | Staff-facing PNG (§5.3.3) | Always, unless one is in progress |

Publish Week, Export as Excel, Screenshot and Employee Screenshot show a spinner in place of their icon while running; Copy Previous Week is simply disabled while copying. Other toolbar controls for reference: **Refresh** (disabled while loading/refetching), **Availability** (disabled in Compare), **On the clock** (disabled off the current week), **Department** and **Search** (always), **Needs attention** (Actual only).

### 5.8 Safety nets for writes

#### 5.8.1 Override warnings
Four refusals the manager may override (saved-shift edit and delete only — Undo always sends `force`, and drafts and bulk saves never raise them): **"This overlaps an existing shift"**, **"This employee is unavailable then"**, **"This employee is on approved time off"** → **Schedule anyway**; **"This week is already published"** → **Delete anyway**. Each shows who/when and the server's message; **Cancel** drops the write. Confirming resends the identical request with `force` (or `confirm=true` for delete).

#### 5.8.2 Employee set-up wait
If a saved-shift write hits an employee who isn't schedulable yet, the dialog shows **"Setting up {name}…"** (or "Waiting for the payroll system to publish {name}" / "Still setting up {name}" when slow). Your details are kept and **the save replays automatically** when ready (polling every few seconds, up to 2 minutes). After the timeout: **Try saving now**, **Request setup again** (60 s cooldown), **Cancel**. While waiting it shows "Waiting {n}s" and, in rose italics, the last error (a failed status check also lands there). In the payroll-wait state the body reads "They are already in payroll and are waiting to be published to scheduling. This usually takes a few minutes." and "Request setup again" is not offered. The poll interval is the server's retry-after (5 s if none); a manual re-request restarts the full 2-minute window.

#### 5.8.3 Bulk-operation progress
For Save drafts, Clear Week and Load Template. Dialog titles: Creating shifts / Clearing the week / Applying template (also defined: Copying, Publishing, Unpublishing, Restoring, Expanding recurring, Retrying — not currently triggered). States: running (spinner, "each shift is sent to the scheduling system in turn"), **completed** ("All N shift(s) went through" — auto-closes after 2.5 s), **completed with errors** ("{x} of {y} shift(s) went through — {n} need(s) attention" with a list of each failure: employee, error code, date/time, message; **Retry N failed**), **failed**. Progress bar and counts. Can't be dismissed until finished. Polls every 2 s, gives up after 5 minutes. There is no rollback — partial success is normal.

### 5.9 Set-up panel (admin-only fixes)

Replaces the grid when the server reports a configuration problem; deliberately has **no retry**:
- **"This store isn't set up for scheduling yet"** (`STORE_NOT_MAPPED`) — no linked scheduling-system location; one-time admin setup.
- **"This store has no default scheduling position"** (`POSITION_NOT_MAPPED`).
- **"This store isn't switched on for scheduling yet"** (`STORE_NOT_ALLOWLISTED`) — recording worked time is rolled out store by store.
Shows "Store: {name}" and the server's message. (A "Report this to support" button exists in the component but the page never wires it, so it never appears.)
Time-clock punches hitting `STORE_NOT_ALLOWLISTED` only disable the punch buttons; recorded-time actions show it inline as "Not enabled for this store".

---

## 6. Errors, alerts and messages

### 6.1 Page alert stack (top of page, each with Dismiss / Try again as noted)
"Couldn't start that operation" (bulk; Dismiss) · "Couldn't refresh this week" (Try again) · "Couldn't record that" (recorded-time actions; Dismiss) · "Couldn't save that entry" (availability/time off; Dismiss) · "Couldn't change that shift" (only when the add dialog is closed; Dismiss) · "Couldn't publish this week" (only when the history dialog is closed; Dismiss). Full-page: "Couldn't load this week's schedule". Inside dialogs: "Couldn't save changes" / "Couldn't add this shift" (Add/Edit Shift), "Publishing problem" (history), "Couldn't save this template" / "Couldn't delete that template" (template dialogs), "Couldn't check the clock" / "Couldn't record that punch" (on the clock).
A **new** page-level error also raises a toast with the server message and scrolls to the top so it can't be missed (screen readers are told too).

### 6.2 Alert anatomy
Server message as headline; per-field validation bullets; a detail line from the upstream system; "Try again in about {n s / min / hours}." when the server says to wait; "Reference {id}"; a code badge (below); **Try again** / **Dismiss** when applicable. Generic fallback: "Something went wrong talking to the scheduling service. Please try again." The wifi-off icon shows for timeouts, unreachable-service errors and any error with no HTTP status (including client-side ones such as the 8 MB image limit or the bulk "taking longer than expected" message).

### 6.3 Error code badges
Setting up employee · Overlapping shift · Unavailable · On time off · Already published · Managed in HR · Invalid time · Store not set up · Position not set up · Not at this store · Unassigned shift · Scheduling system rejected it · Too many requests · Not in the time system · Time system rejected it · Daily limit reached · Not enabled for this store · Already on the clock · Not on the clock · Nothing would be left · Timed out · Service unreachable · Signed out · No permission · Check the details.

### 6.4 Automatic recovery
Only three automatic retries exist: a stale roster (`EMPLOYEE_NOT_IN_STORE` — silent refetch + one retry), the employee set-up poll, and the bulk-operation poll. Everything else is a manual re-do: only the week load, the on-the-clock board and the staffing-history card offer **Try again**; write-failure alerts offer **Dismiss** only.

---

## 7. Stored in the browser

| Key | What | Scope |
|---|---|---|
| `scheduling-drafts` | Unsaved shifts + save mode (merge/replace) | per store + week, 7-day expiry |
| `scheduling-plan-row` | Plan-vs-usual fold, Chart hidden, Table hidden | whole browser |
| `scheduling-odd-view` | Odd days Charts / List | whole browser |
| `auth-token` | read to authorise every call | — |

The in-memory week cache (5 min, 24 weeks) and history cache (30 min, 12 windows) are lost on reload.

---

## 8. Business rules

### 8.1 Weeks and dates
Weeks are keyed by ISO start date; the start weekday is per-store (fallback Tuesday); dates and the start weekday come from the server (day names are derived on the client from it); date-only strings are never parsed with `new Date()` (avoids time-zone shifts); recorded punch times are store-local text and are sliced, not parsed.

### 8.2 Durations
The server's `duration_minutes` is authoritative for every saved shift and recorded shift, everywhere (hours, totals, labor). Clock-time arithmetic is used only for live previews in the dialogs and for drafts, because it is wrong on the two daylight-saving change days.

### 8.3 Conflicts, overtime, availability, time off
Conflicts and the overtime list come from the server (UTC instants) and describe the **plan**, so they are empty in Actual/Compare. The client does an *advisory* check while typing in the dialog (same employee + same day only; saved shifts only). Availability and time off **warn but never block** — the manager can override. Time off entries count regardless of approval status. Availability from the hiring system and leave from the HR system are read-only here.

### 8.4 Drafts and saving
See §5.1.5. Add = draft; edit/delete of saved shifts = immediate. Copy Previous Week and Load Template differ: copy → drafts (replace mode); template → server batch (replace).

### 8.5 Recorded time (Actual) rules
- A recorded shift has: **time variance** (matches / differs / unplanned), **review state** (unreviewed / worked / absent), a **needs-attention** flag from the server, **source** (manual / timeclock), and **punches**. Hours = sum of punches; gaps between punches are unpaid.
- The server compares label as well as times with **no tolerance**.
- **Merged "what really happened" list** (drives Actual/Compare totals): recorded time replaces the plan's times; no-shows drop the plan; plans with nothing recorded are excluded; unlinked recorded shifts count as coverage. Records count whether or not they have been reviewed, and a shift still being worked counts with its hours so far.
- Punches are grouped under a plan only when they are time-clock punches, the cell has exactly one plan, and that plan has no linked record.
- "Never clocked out" = open and flagged (the server caps at 16 h).

### 8.6 History (usual week) rules
4 complete business weeks; business day cutoff default 05:00 (small hours belong to the previous day); Short ≥0.75 under, Extra ≥1.5 over; basis Left out (default) vs Included; odd days from the server's findings; history includes unsaved drafts in the "plan".

### 8.7 Employee set-up
An employee not yet synced to the scheduling system can't be scheduled: the "+" is disabled, a badge shows, and a write that hits this waits instead of failing.

---

## 9. Parked, dead or unfinished (not on screen)

- **`day-view.tsx`, `month-overview.tsx`** — parked and unmounted (single-day timeline and month heat-map). Not exported from the scheduling index.
- **Dead code**: `ShiftSyncBadge` (defined, never imported), `toastDescriptionFor`, `isSafeToRetry`, several helpers in the draft/cache stores, service functions `health`, `getDepartments`, `getClockStatus`, `copyWeek`, `getTemplate`, and the hook method `loadTemplateDetail`; bulk types `unpublish_week`, `restore_published`, `recurring_expand`.
- **No Unpublish / Restore**, **no recurring-shift creation**, **no template preview/rename**, **no edit of availability/time-off rows**, **no push of local leave to HR**.
- **`SchedulingBackendGuide` docs are superseded** — don't build against them.
- **Not localised**: all scheduling text is hard-coded English (the only translated strings are the skills labels).
- **Published flags** (the week payload's top-level `published` list and `shift.isPublished`) are loaded but not shown anywhere.

---

## 10. API reference (internal route → upstream)

Routes are `/api/scheduling/stores/{store}/…` (exceptions: `/api/scheduling/health`, `/skills`, `/skills/overview`) and forward to `${OPERATIONS_API_URL}/v1/…` with the user's own token. The proxy mirrors the upstream status/body, adds `no-store`, and synthesises only `401 NOT_AUTHENTICATED` (no Authorization header), `504 TIMEOUT` and `502 UPSTREAM_ERROR`. The insights route is a composite that also validates its inputs (`400 INVALID_REQUEST`) and returns `502` only when **both** upstream halves fail.

| Method | Path (after `/stores/{store}`) | Used by |
|---|---|---|
| GET | `/schedule/week` (`week_start`, `mode=both`, `department`, `search`) | Grid load, every refetch; Copy Previous Week reads the prior week (`mode=planned`, no filters) |
| GET | `/insights` (`week_start`, `today`) → Data API scheduling-insights + Operations insights | Usual numbers, Plan vs usual, odd days |
| POST | `/shifts` | Undo after delete |
| POST | `/shifts/{shiftId}` | Edit a saved shift |
| DELETE | `/shifts/{shiftId}` (`?confirm=true` after the published warning) | Delete a shift |
| POST | `/schedule/bulk/create-shifts` (≤500 shifts, `mode`) | Save drafts |
| POST | `/schedule/bulk/apply-template` | Load Week Template |
| POST | `/schedule/bulk/clear-week` (`confirm:true`) | Clear Week |
| GET | `/schedule/bulk/{batchId}` | Progress polling (2 s) |
| POST | `/schedule/bulk/{batchId}/retry-failed` | Retry failed |
| GET / POST | `/schedule-templates` | List / save templates |
| DELETE | `/schedule-templates/{id}` | Delete a template |
| GET / POST | `/published-schedules` (POST is multipart with the PNG) | History / Publish |
| DELETE | `/published-schedules/{id}` | Delete a published record |
| POST | `/availability-overrides` · DELETE `/availability-overrides/{id}` | Blocked times |
| POST | `/time-off` · DELETE `/time-off/{id}` | Leave |
| POST | `/shift-assignments/{id}/confirm-actual` | Worked as planned |
| POST | `/shift-assignments/{id}/absent-actual` | No-show with nothing recorded yet |
| POST | `/actual-shifts` | Record / amend / add coverage |
| POST / DELETE | `/actual-shifts/{id}` | Edit, mark reviewed, agree clock-in / delete |
| POST | `/actual-shifts/{id}/absent`, `/merge`, `/split` | No-show, merge, split |
| GET | `/on-the-clock` | On-the-clock board (30 s) |
| POST | `/employees/{id}/clock-in`, `/clock-out` | Clock buttons |
| GET | `/employees/{id}/sync-status` · POST `/employees/{id}/humanity-sync` | Set-up wait |
| GET | `/api/scheduling/skills/overview` (`storeIds[]`) | Skill chips |

Routes that exist but the page never calls: `/health`, `/schedule/departments`, `/schedule/employees`, `/availability`, `GET /time-off`, `GET /shifts/{id}`, `GET /published-schedules/{id}`, `GET`/`POST /schedule-templates/{id}`, `/schedule/bulk/copy-week`, `/employees/{id}/clock-status`, and the Skills management routes (used by the Skills page).

---

## 11. Source map

| Area | Files |
|---|---|
| Page | `app/[locale]/(dashboard)/dashboard/scheduling/page.tsx`, `components/scheduling/scheduling-manager-new.tsx` |
| Grid & cards | `schedule-grid-new.tsx`, `shift-card.tsx`, `draft-shift-card.tsx`, `actual-shift-card.tsx`, `timeclock-review-card.tsx`, `comparison-shift-card.tsx`, `shift-segments.tsx`, `shift-legend.tsx`, `shift-tooltip.tsx`, `shift-sync-badge.tsx`, `shift-pending.tsx`, `day-plan-cell.tsx` |
| Dialogs & panels | `add-shift-dialog-new.tsx`, `edit-actual-shift-dialog.tsx`, `adjust-shift-dialog.tsx`, `availability-time-off-dialog.tsx`, `employee-profile-dialog.tsx`, `on-the-clock-dialog.tsx`, `published-schedules.tsx`, `bulk-operation-progress.tsx`, `schedule-warning-dialog.tsx`, `employee-sync-notice.tsx`, `schedule-error-alert.tsx`, `schedule-setup-error.tsx`, `unsaved-shifts-guard.tsx`, `draft-action-bar.tsx`, `data-freshness.tsx`, `employee-skills-summary.tsx` |
| Usual numbers | `week-outlook.tsx`, `odd-days-window.tsx`, `odd-calendar.tsx`, `odd-day-chart.tsx`, `odd-days-kinds.tsx`, `segmented.tsx`, `collapse.tsx` |
| Tour | `scheduling-guide-config.ts`, `components/shared/page-guide/` |
| Logic | `lib/scheduling/` (`week`, `week-cache`, `adapters`, `errors`, `utils`, `draft.store`, `constants`, `accents`, `day-plan`, `hourly-coverage`, `insights`, `odd-days`, `plan-row.store`, `week-outlook.store`) |
| Hooks | `lib/hooks/use-schedule-week`, `use-shift-mutations`, `use-actual-shift-mutations`, `use-availability-mutations`, `use-bulk-operation`, `use-clock-punch`, `use-employee-sync`, `use-on-the-clock`, `use-published-schedules`, `use-schedule-templates`, `use-scheduling-insights`, `use-skills-overview`, `use-error-announcer` |
| API | `lib/api/services/scheduling.service.ts`, `app/api/scheduling/**`, `types/scheduling.types.ts` |

---

## 12. Observations from reading the code (not tested — verify before relying)

These are **not features**; they are rough edges found while inventorying. Items marked ✔ were re-checked directly in the source for this document.

1. ✔ **Setup errors raised by a write never clear.** `writeSetupError` is set but never reset, so after one the page stays on the set-up panel until reload, even after changing store or week.
2. ✔ **Bulk dialog can get stuck.** If polling times out or is lost, the operation stays "running", the dialog's Close is disabled until the operation is finished, and the page-level alert is hidden while an operation exists.
3. ✔ **Staff-facing image still shows some internal markers**: the OT pill and amber row tint, "Setting up" badge, conflict / sync / origin / note / recurring icons on cards, the slate tint on whole-day-blocked cells, and (in Actual) the add-coverage "+".
4. ✔ **Footer "Clear All Shifts" is not limited to Planned**, unlike the Actions-menu Clear Week.
5. ✔ **Employee profile dialog labels days from a fixed Tuesday-first list**, so a store whose week doesn't start on Tuesday gets wrong day names there (the grid itself is right).
6. ✔ **Recurring shifts can't be created**, and the "recurring" flag is dropped when editing.
7. **Attention filter** can pull a punch out from under its plan (shows as "Added coverage"), and footer totals ignore the filter; the grand-total cell used to exclude drafts while the per-day cells included them; it is now the sum of the day totals, drafts included.
8. **Single-punch missed-punch** isn't marked on the card face (only surfaces through the Needs attention filter).
9. **Keyboard / screen reader gaps**: cards are click-only `div`s; the hover buttons on the planned card, the draft card and the ghost / no-show recorded cards, and both "+" buttons, have no `aria-label` and appear only on mouse hover (the worked-card and timeclock-review buttons do have labels, and the timeclock-review ones also appear on keyboard focus); plan-row bars/rows are hover-only; moving or copying a shift by dragging has no keyboard alternative.
10. **Comparison tooltip** shows "—" as the end time of a shift still being worked.
11. **Week cache**: a cache hit can leave an "in flight" flag set, which can make the automatic re-check on view toggle / tab focus a silent no-op until the next real fetch (manual Refresh still works).
12. **Insights** loads on the provisional week start before the week payload arrives, so for a non-Tuesday store the first window can be misaligned until the payload lands.
13. The DataFreshness tooltip ("refreshes automatically once more than 5 minutes old") means "when you return to the tab or switch view"; nothing polls.
14. The draft bar says overlaps are checked at save; a code comment says the bulk path applies no availability/conflict guards (the server's conflicts list reports overlaps after the refetch).
15. `MATCH_TOLERANCE_MINUTES` is mentioned in two type comments but defined nowhere.
16. A shift's duration is trusted as sent by the server. A shift that crosses the UTC date line (for example a 4 PM shift ending after 6 PM local in a UTC-6 store) has been reported (from live data; not reproducible from this repo) coming back **24 hours too long** (e.g. 4–8 PM shown as 28 h) when it was rewritten by the Humanity reconciler. The frontend shows the server's number as-is and has no check that the displayed times and the duration agree. This is a backend issue plus a missing frontend guard; it also inflates the employee's weekly hours and labor cost.
17. The Availability dialog captures its default employee and dates when it first mounts, so they don't follow later week or roster changes.
18. The on-the-clock punch state ("store not enabled", "not linked") lives in an always-mounted component and isn't reset when you switch store.
