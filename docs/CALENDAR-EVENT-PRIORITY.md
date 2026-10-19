# Calendar: which events each system should send, and why

_Last updated: 2026-10-16_

**From:** Frontend team. **For:** the backend team of each system (Operations, AuditApp, Data, Maintenance, Inventory, Hiring, Notifications, pizzasys).
**Builds on:** `calendar-feed-contract.md` (v1) and `متطلبات_كل_مشروع.md`. This file does not replace them. It says which of the contract's events matter most on screen, and lists the few changes we need so the screen stays readable.

---

## 1. The idea in one paragraph

The calendar has to answer one question for a manager: **"what needs me?"** The month grid fits only a few items per day (roughly 3–5), and a single store can produce hundreds of events a month. So the screen leads with **exceptions** (overdue, missed, live problems) and collapses routine work into **one summary per day**. The frontend decides the display priority from `type` + `status`. **No priority field is sent.** That makes one thing critical for you: **`status` must be correct, and computed in the store's timezone**, because the order on screen is derived from it.

## 2. How the frontend ranks what you send

| Tier | Meaning | Comes from | Look |
|---|---|---|---|
| **P0** Needs action | Still fixable, or just happened | `overdue`, `missed`, live problems (visit in progress, no manager on shift) | Red, always visible, never hidden behind "+N more" |
| **P1** Today's plan | Operational and time-bound | `in_progress`, `pending`, `scheduled` | Neutral, full weight |
| **P2** Context | Good to know, no action | `info` on goals, evaluations, announcements, time off, last working day, hiring need | Neutral, light |
| **P3** On demand | Detail, or nice-to-have | `done`, `cancelled`, birthdays, `ticket_opened`, per-task and per-shift rows | Muted, grouped, or one click away |

Within a tier the order of types is: **tech visit > staffing gap > cleaning > dough > data > inventory > everything else**.

## 3. At a glance, per system

| System | Send (most important first) | Summary / `expand=1` only | Don't send |
|---|---|---|---|
| **Maintenance** | `tech_visit` (the single most important event) | | warranty, pay, parts, stock |
| **Operations** | `manager_coverage` gaps, `shift_day` (new), `actual_shift` that is `in_progress` or `missed`, `time_off` | individual `shift` / `actual_shift` rows | availability, pay, overtime |
| **AuditApp: Cleaning** | `cleaning_day_summary` | `cleaning_task` rows; weekly/monthly tasks via a period summary (new) | inspection items, weights, photos |
| **AuditApp: Dough** | `dough_plan` | | quantities, ingredients, buffers |
| **Data** | `entry_day_summary` | `entry_due` rows | entered values, attachments |
| **Inventory** | `inventory_count` | | quantities, link `token` |
| **Hiring** | `last_working_day`, `hiring_need` | | age, pay, SSN, bank, contact, separation type/reason |
| **Notifications** | `announcement` (company-wide, including future ones) | | body text, seen/unseen state |
| **Context only** | `weekly_goal`, `cleaning_evaluation`, `dough_judgement`, `birthday`, `ticket_opened` | | |
| **pizzasys / Toolbox** | no events. pizzasys supplies store timezone and `calendar.*` permissions only | | |

Roughly **10 things** are visible by default; everything else is one click away. Target size at `expand=0`: about **150–200 events per store-month** (an estimate, which keeps a store-month under the contract's 100 KB goal).

## 4. What we need from each system

### Maintenance
- **`tech_visit`** is the event managers care most about. A third party arrives, and these are rare.
- Statuses must cover the full set: `scheduled`, `in_progress` (clock-in without clock-out), `done`, `missed` (visit day passed with no attendance), `cancelled` (all issues cancelled).
- Required `extra` keys: `priority`, `rescheduled_from {date, hour, reason}`, `check_in`, `check_out`, `any_time`, `ticket_id`.
- `extra.priority` for a visit = the **highest** across its issues (`assigned_priority` if set, otherwise the creation priority; `urgent > high > medium > low`).
- Never return records flagged `mistaken`. A cancelled ticket's visits must come back `cancelled`.
- `ticket_opened`: send it, but the screen hides it by default (a past log, not a plan). Warranty, pay, parts and stock stay out.

### Operations
- **Exceptions must never hide behind `expand`.** With `expand=0` always return: `time_off` (approved only), `manager_coverage` gaps, and any `shift` / `actual_shift` that is `missed` (no-show) or `in_progress` (on the clock now, used by the "Today" panel).
- **`manager_coverage`: send only the gaps.** One event per contiguous period inside store hours with **no manager on shift**, with `extra.has_manager = false` and `start` / `end` in UTC. Do not send an event per hour for covered time.
- **New `shift_day` summary** (see §5): one per store per day.
- Individual `shift` / `actual_shift` rows that are `scheduled` or `done` appear only as `items[]` under `shift_day` with `expand=1`.
- Actual shifts in UTC (today they are store-local without an offset). Planned **and** actual, as decided.

### AuditApp: Cleaning
- **`cleaning_day_summary`** is the main event: "Cleaning 15/19 · 2 overdue", with `counts` and status = worst status of the day.
- `cleaning_task` rows only inside `items[]` with `expand=1`.
- **Weekly and monthly tasks** must not return as one bar per task (see §5, request 3).
- `cleaning_evaluation`: one per store per week, as in the contract.
- `overdue` flips at end of day **store-local**, not 00:00 UTC.

### AuditApp: Dough
- **`dough_plan`**: one per store per production day. `done` if confirmed; `pending` before the cutoff; `missed` after it.
- Cutoff is **20:00 store time on the night before** (approved), exposed as `extra.cutoff`.
- Do **not** send `lines` or any quantity.
- `dough_judgement`: one per store per week. It is shown only to Dough Specialists, but send it per the contract.

### Data System
- **`entry_day_summary`**: "Data 3/4 · 1 overdue", with `counts`.
- **`overdue` does not exist upstream today**, so compute it: not filled and the day (or the key's due time) has passed in store time.
- **`entry_due`**: when a key has `due_time`, send it as a **timed** event (`all_day: false`, `start` in UTC) so it can appear as "up next" on the Today panel. Keys without a time stay all-day.
- `weekly_goal`: keep one event per metric per store-week. The frontend groups them.
- Parked for v2, but the best candidate: `non_negotiable` (real incidents with a start and end).

### Inventory
- **`inventory_count`**: `done` if submitted, `pending` if still open and dated today or later, `overdue` if still open and dated in the past. Sort by `date`, not creation time.
- Send the assignee in `people[]`. The frontend adds a ⚠ when that person is off that day (using Operations data).
- Never return the link `token`.
- Decision needed on "stale" links (see §5, request 7).

### Hiring
- Send only: `birthday`, `last_working_day`, `hiring_need`. Short name only (first name + last initial). **No age** (decision #5).
- **`last_working_day`: approved or completed separations only**, not requested or rejected. **Do not send resignation vs termination, or the reason.** Today this event returns 404 through the gateway and must be fixed.
- Build the feed from scratch with whitelisted fields. Do not reuse the employee or manager-dashboard responses (they carry SSN, bank and pay data). Add the automated forbidden-keys test from contract §12/§14.

### Notifications
- **`announcement`**: include **future** announcements (today `/visible` returns only what is live now), with `date` = `starts_at` and `date_end` = `ends_at`.
- Send `extra.is_pinned` (it exists upstream). The contract lists `extra.priority`, but there is no `priority` column, so please confirm what we should use. We recommend `is_pinned`.
- The frontend shows only pinned announcements as a banner. Do not send `body`.

### pizzasys
- Add `timezone` per store (`stores[].timezone`). All "overdue / missed" logic depends on it.
- Add the `calendar.*` permissions and the two rules per feed (contract §10).

## 5. Requested changes to the contract

| # | Request | Why | Owner |
|---|---|---|---|
| 1 | **Add a `shift_day` summary** (Operations): one per store per day with `counts` (shifts, employees, managers, missed) | The screen needs "👥 9 · 2 managers" per day. Without it the client must download every shift. A store-month is hundreds of rows and 44 stores would likely exceed the 5,000-event cap (`truncated: true`) | Operations |
| 2 | **`manager_coverage` = gap events only** | Per-hour "covered" events are pure volume | Operations |
| 3 | **Period summary for weekly/monthly cleaning tasks** (for example `cleaning_period_summary`: `date`–`date_end`, `counts`, tasks via `expand=1`), instead of one `cleaning_task` span per task | Spans take the top lanes of the month grid and push the daily overdue summary into "+N more" | AuditApp |
| 4 | **`entry_due` timed when `due_time` exists**, and confirm the timezone | Today the notification command reads `due_time` as **America/New_York**, not store-local. Which one is it? | Data |
| 5 | **`extra.is_pinned`** for announcements (no `priority` column upstream) | Banner selection | Notifications |
| 6 | **Visit priority** = highest among its issues | Orders visits and shows urgent ones first | Maintenance |
| 7 | **Stale inventory links**: after N days (we suggest 7) an active link stops being `overdue`. Either it becomes `missed` (needs adding to the allowed statuses for this type) or it leaves the feed | Links never expire upstream, so old unused links would be red forever | Inventory + product owner |
| 8 | **Fix the type count**: contract §6 says 17 types but its table lists 19. Confirm the final list | Avoids building or testing the wrong set | Contract owner |
| 9 | **Make sure `statuses[]` filters on a summary's computed status** | The all-stores view (44 stores) will request only `overdue`, `missed`, `in_progress` | All |

## 6. What each role looks at first (from contract §10.1)

| Role | First look |
|---|---|
| Store Manager | cleaning summary, data summary, tech visits, dough plan, staffing gaps |
| MOS | tech visits across stores, new tickets, coverage gaps |
| Inventory Specialist | inventory counts overdue or due |
| Dough Specialist | dough plan `missed` per store, weekly judgement |
| QA Auditor | cleaning overdue per store, evaluations pending |
| Super Admin | exceptions per store (all-stores view shows only P0) |

## 7. Basis and confidence

The ranking comes from the three documents above plus the API catalogue (`API_ENDPOINTS.md`): which events are tied to a date and a store, how often they occur, and whether a manager can still act on them. The tier order and type order are the **frontend team's judgment, not validated with managers**. The UX research behind the density and severity rules is practitioner material, not usability studies:

- Cap a month cell at about 3–4 items plus "+N more": [CoreUI month view](https://coreui.io/scheduler/docs/views/month/); hidden-item complaints: [Adobe Workfront thread](https://experienceleaguecommunities.adobe.com/adobe-workfront-23/new-calendar-ui-ux-show-more-rows-in-month-view-or-allow-prioritization-of-what-shows-138926).
- Per-store roll-ups and exception counts: [Restaurant365 task dashboard](https://docs.restaurant365.com/docs/task-dashboard-1), [MangoApps open shifts](https://www.mangoapps.com/templates/app_builder/tpl-widget-open-shifts).
- Tiered severity, and too much red gets ignored: [Mindbowser](https://www.mindbowser.com/rpm-dashboard-design/), [UX Collective](https://uxdesign.cc/three-questions-to-ask-when-designing-statuses-beyond-the-happy-path-c56de6aef0d4), [Fuselab (ISA-18.2)](https://fuselabcreative.com/manufacturing-dashboard-ux-design/).
