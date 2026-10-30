# Maintenance v2 — screens and UX rules

_Last updated: 2026-10-30_

The API these screens call is `MaintenancePizza/docs/MAINTENANCE-V2.md`
(`C:\Projects\New folder (2)\MaintenancePizza\docs\MAINTENANCE-V2.md`). This file
says what each screen shows and how it behaves. The goal set by the owner: **simple
pages, few options, nothing that tires the person using it.**

## UX rules (apply on every screen)

1. **One primary action per screen.** Everything else is secondary (outline/ghost)
   or in a `…` overflow menu. On the ticket page the primary is the workflow's
   next step.
2. **Progressive disclosure.** A form shows only what its step needs (≈6 fields
   max). Optional details live behind "More details". Choosing a payment line
   type reveals only that type's fields plus a one-sentence explanation.
3. **Plain vocabulary** — `lib/maintenance/vocabulary.ts` + i18n. Never "payee",
   "draw", "transfer_out", "adjustment", "attendance entry". Say technician,
   supplier, payment, trip, visit, inspection, Bought/Used/Returned/Moved/Opening
   stock/Stock count/Damaged or lost.
4. **Labels on every field**, error under the field (422 → field), required marked,
   helper text under anything not obvious. After a failed submit focus the first
   invalid field.
5. **Feedback**: buttons disable + spinner while saving; success toast (sonner)
   3–5 s; "Mark as mistake" asks for confirmation (AlertDialog) and is styled
   destructive; unsaved-changes guard on dialogs with typed data.
6. **States**: skeleton while loading (>300 ms), the CLAUDE.md empty state
   (dashed border, muted icon, one instructional sentence, one action), errors
   with a Retry.
7. **Never colour alone**: status/priority badges carry text; gaps in the
   coverage map carry an icon + "Gap".
8. **Numbers** `tabular-nums`; money `$1,234.50`; hours `3h 25m`.
9. **Deep links**: tabs, filters, the selected issue are in the URL (`?tab=`,
   `?issue=`), so a notification or a shared link opens the exact place. Back
   restores filters.
10. **Theme**: semantic tokens only (`bg-card`, `text-muted-foreground`,
    `border-border`…). Status colours as paired light/dark Tailwind classes
    (`text-emerald-600 dark:text-emerald-400`). RTL with logical properties.
11. **Touch**: on the technician trip page every control is ≥ 48 px tall, 8 px
    apart, full-width; the page works one-handed at 375 px.
12. **Accessibility**: icon-only buttons have `aria-label`; visible focus rings;
    headings in order; charts have a table alternative (a "Show as table" toggle).

## Navigation (sidebar Maintenance group + bottom-nav mirror)

Tickets · Trips · Payments · Storage · Technicians & Suppliers · Analytics ·
Troubleshooting (unchanged). `/dashboard/daily-pay` redirects to
`/dashboard/maintenance-payments`.

## 1. Tickets list `/dashboard/maintenance-tickets`

Header: "Tickets" + primary **New ticket**. One flat filter row: search,
Status (multi), Store, Priority, Technician, Category (technician category).
A row of "needs attention" chips: Waiting on store · Waiting for approval ·
Work done to check · Overdue (target date passed). Table: ticket #, title (first
issue; "+2 more"), store, status badge, priority, assigned to, target date,
updated. Click → ticket page. Mobile: cards.

## 2. Ticket page `/dashboard/maintenance-tickets/[ticketId]?issue=&tab=`

Follows the owner's mockup.

- **Header**: `Ticket #123` small, issue title large, then badges: status,
  priority (arrow icon), store (store icon), impact. Line: "Opened Apr 22, 9:15 AM
  | Submitted by Store Manager". `…` menu: Jump to a status (reason), Cancel,
  Delete ticket.
- **Issue switcher** (only when the ticket has >1 issue): segmented pills.
- **Progress strip**: the 11 flowchart steps compressed to 8 dots with labels on
  hover/desktop: Submitted · Review · Store · Inspection · Approval · Scheduled ·
  Work done · Closed. Current one filled; skipped ones hollow.
- **Tabs**: Overview · Work · Costs · Activity (URL `?tab=`).
  - **Overview**: "Ticket details" card with three cells — Assigned to · Target
    completion · Next action (inline-editable by the MOS). Then the **current
    step card**: what this step needs, in a sentence, with its checklist (e.g.
    close checklist with ticks). Waiting on store: the open question; for a store
    manager an answer box + photo upload. Work done: "Is it working now?" Yes/No
    for the store. Then description, troubleshooting snapshot, photos.
  - **Work**: Inspections (each a card: technician, when, findings, quote,
    photos; "Add second opinion"), Bookings (technician, date, expected
    completion, link to trip, "Move"), Visits from trips (arrived/left, done/not
    done, clocked time), Parts used (from storage) + "Use parts from storage".
  - **Costs**: four big numbers like the mockup — Estimated · Labor · Parts ·
    Total actual (+ Approved amount if any). Invoices list (file chips with
    download). Approval card (level from amount, who approved). Payments linked
    (rows → payment). Unpaid technician purchases. Primary-less tab; secondary
    "Record a payment" (opens the payment dialog pre-filled with this ticket's
    store + issue).
  - **Activity**: one vertical timeline (dot + card per event, newest first),
    like the mockup; notes show a lock icon when MOS-only.
- **Sticky footer** (bottom of the content, safe-area aware): **Add update**
  (outline: note + photos + who can see it) and the **primary next step** from
  `workflow.next[0]` (e.g. "Start review", "Ask the store", "Book inspection",
  "Ask for approval", "Record approval", "Schedule work", "Mark work done",
  "Close ticket"). Other valid `next` actions sit in a small chevron menu next to
  the primary. Each action opens ONE small dialog with only its fields:
  - Ask the store: question + photos.
  - Book inspection / Schedule work: technician picker (ranked, badges: covers
    store · covers issue · emergency · call first · ★rating, category filter),
    date, time (optional), expected completion (work only), instructions. On
    success: a "Trip link" dialog with the link, **Copy**, **Share** (Web Share
    API → WhatsApp/SMS with "Your trip for Store 12 on Tue: <link>") — shown only
    when a new link was issued.
  - Record inspection result: findings, recommended repair, parts needed,
    estimate, photos.
  - Ask for approval: amount (pre-filled from the latest estimate) → shows the
    level ("Needs Maintenance Manager approval").
  - Record approval: approved/rejected, approver name, note, screenshot.
  - Mark work done: work performed, before/after photos, warranty (optional, behind
    "Add warranty").
  - Close: resolution select + checklist; unticked items need a reason.
- Store managers see the same page read-only except the two store steps.

## 3. Trips `/dashboard/maintenance-trips`

Tabs: **On the clock now** (cards: technician, since when, current state badge
On break/Travelling, current stop) · **Today & upcoming** · **History**
(table with filters technician/date). Primary **New trip** (technician, date,
stops = stores + their open issues). Trip drawer (Sheet): link status (Active /
Expired, Copy, Share, New link), stops with tickets and done/not done, sessions
with durations (paid time, breaks), purchases, photos, audit list, "Add session"
/ "Correct" (reason required), Close trip.

## 4. Technician trip page `/[locale]/trip/[token]` (public, no login)

Mobile-first, own minimal layout (no sidebar), big type. Top: technician name,
date, big state pill. One giant primary button that changes with state:
**Clock in** → (on clock) **Clock out**; secondary big buttons under it: Start
break / End break, Driving, Getting parts. Using car? → odometer + photo (camera
input `capture="environment"`). Then the **stops list** (cards): store, address
line if known, tickets with title + priority; per stop **I'm here** (odometer
photo optional), per ticket **Done** (note, before/after photos; for an
inspection: findings + estimate) or **Couldn't do it** (reason); **Add a store**.
Bottom: **I bought something** (what, cost, where — supplier search or new name,
receipt photo, which ticket) and **Add a note/photo**. Expired link → friendly
full-page message "This link has expired — ask the office for a new one." Works
at 375 px, all targets ≥ 48 px, offline-friendly messages on network errors with
Retry.

## 5. Payments `/dashboard/maintenance-payments`

Header + primary **Record a payment**. Filters: date range, paid to (technician
or supplier), technician category, store, type, search (invoice #). KPI strip:
Payments · Total. Table: date, paid to, stores, types (small badges), invoice
(paperclip if file), total; mistaken rows struck through and hidden unless
"Show mistakes". Side panel **Unpaid work**: per technician, clocked time not
paid + purchases not paid back, each with "Pay this" (opens the dialog
pre-filled).

**Payment dialog** (one scrolling form, no wizard):
1. Paid to — one combobox searching technicians and suppliers (grouped), "Add
   supplier" inline.
2. Date · How we paid (select) · Reference / check # · Invoice # · Invoice file.
3. **Lines** — each line is a compact card: Type (Select, NOT big squares) →
   under it the type's one-sentence explanation in muted text and only its
   fields: Store (or storage for parts) · amount fields per type · Tickets
   (multi-select of that store's issues). Hourly: pick clocked sessions
   (checklist with dates and paid time) → hours fill in, rate defaults to the
   technician's; typing hours flags "typed over". Parts: part (search/create),
   qty, unit cost, bought from (supplier), goes to: Storage spot / Straight to a
   ticket, serial numbers when the part tracks them, "pays back" technician
   purchases. "Add line".
4. Running total at the bottom (sticky), Save.
Detail sheet: lines, links, files, revisions, Edit, Mark as mistake.

## 6. Storage `/dashboard/storage`

Tabs: **Stock** (search, location filter; per part: on hand per location with
its spot "Zone A › Shelf S", value; part sheet with details brand/model/part
number/unit, serial units list, price history) · **Movements** (ledger, plain
type labels with icons, filters) · **Stock counts** (list + **Start a count**) ·
**Locations** (locations and their place levels, a clearer spot editor).
Primary on Stock: **Record stock** → a menu: Parts bought (opens the payment
dialog with a parts line to storage) · Used on a ticket · Returned · Moved ·
Opening stock · Damaged or lost.
**Count sheet** `/dashboard/storage/counts/[id]`: header (location, started,
status), a dense table part · unit · expected · **counted** (numeric input,
large, tab-able) · difference (red "1 missing" / green "2 extra" with icon) ·
value. Sticky bar: counted 12/40 · missing $ · extra $ · Save draft · **Apply
count** (confirm dialog summarising the corrections).

## 7. Technicians & Suppliers `/dashboard/maintenance-technicians?tab=technicians|suppliers`

Technicians tab: filters search, category, store covered, issue covered,
"Emergency only" switch. Table: name (+company contact), category, phone,
emergency badge, stores covered count, issues covered count, ★ average, paid
this month. Primary **Add technician**. Form: name (live duplicate check:
"There is already a technician called X"), phone, category (select + "manage
categories"), contact person, hourly rate, location, emergency available
(switch) + emergency notes (shown when on), stores covered (multi), coverage
notes. Detail page: profile card, **Issues covered** (list: issue, ★ rating
editor, call first, notes; "Add issue"), trips, payments, work report.
Suppliers tab: name, phone, website, total paid; same add/edit dialog pattern
and duplicate check.

## 8. Analytics `/dashboard/maintenance-analytics?tab=overview|finances|coverage`

Shared filter bar: date range, stores, technician category.
- **Overview**: today's analytics (KPIs, charts) with the new statuses.
- **Finances**: KPI tiles (Spent · vs previous period · Payments · Unpaid work ·
  Stock on hand value); spend trend (stacked bar by type, month/week toggle);
  by store / by technician / by supplier / by category (horizontal bars, top 10
  + "show all" table); stock money (bought vs used, count losses, damaged);
  ticket costs (avg per ticket, top tickets, by issue, estimate vs actual,
  approvals by level, recurring costly issues). Every chart has "Show as table".
- **Coverage**: KPI tiles (techs for the stores, for the issues, for both,
  emergency-available), then a store × issue grid: cell = number of technicians,
  shaded by count, ⚠ "Gap" for 0–1, tooltip with emergency count and ★ average;
  issue filter; "Gaps only" switch.
Charts: ApexCharts via `next/dynamic` with Skeleton, hex colours from the
dashboard-v1 `finance` / `people` category ramps, `resolvedTheme` for fore colours.
