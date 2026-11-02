# Maintenance — screens and UX rules

_Last updated: 2026-10-31_

The API these screens call is `MaintenancePizza/docs/MAINTENANCE.md`
(`C:\Projects\New folder (2)\MaintenancePizza\docs\MAINTENANCE.md`). This file
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
    Ticket status and priority colours have ONE source,
    `components/maintenance-tickets/status-accent.ts`, drawn only through
    `StatusBadge` / `PriorityBadge` (`ticket-chips.tsx`) on every surface —
    list, ticket page, peek sheet, Dashboard V1 card, DSPR table, analytics.
    Statuses are tinted pills with a dot; priorities are outlined with an arrow.
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
Status (multi), Store, Priority, Technician, Category (technician category);
on a phone the filters and the attention chips are each one sideways-scrolling
row, so the list starts on the first screen. **New ticket** dialog: header and
buttons fixed, only the form scrolls; priorities use the same words and
colours as the badges; closing with something typed asks first.
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
- **Now panel** (`ticket/next-step.tsx`, above the tabs, so it shows on every
  tab): answers "where is this and what do I do now?" in one place —
  - the step strip: the 11 flowchart steps compressed to 8 labelled dots
    (Submitted · Review · Store · Inspection · Approval · Scheduled · Work done ·
    Closed); current filled, skipped struck through;
  - "Step 5 of 8 · Inspection" with a **Your move** chip when this viewer has a
    step to run, otherwise "Waiting on: Technician / Store / Approver";
  - the step title and ONE sentence that names the button to press;
  - the facts of this step only: the open question (and, for a store manager,
    the answer box), the answer just given, the inspection booked / its findings
    and quote, the amount waiting for approval and the level, the work booking,
    work performed, the store's "it works" answer, the close checklist;
  - every step that can run now as a visible button — the main one solid, the
    others outlined (no hidden chevron) — plus "See all in Work / Costs" for the
    steps whose details live in a tab.
- **Tabs**: Overview · Work · Costs · Activity · History (URL `?tab=`). Each tab
  shows how many things it holds; the tab that has the current step's details
  carries a dot until it is opened.
  - **Overview**: "Ticket details" card with three cells — Assigned to · Target
    completion · Next action (inline-editable by the MOS). Then description,
    troubleshooting snapshot, photos, the ticket's own notes and files.
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
  - **History**: earlier tickets for the same issue at this store (who worked
    on it, how it ended), then the store's other open tickets.
- **Sticky footer** (bottom of the content, safe-area aware): **Add update**
  (outline: note + photos + who can see it) and the **primary next step** from
  `workflow.next[0]` (e.g. "Start review", "Ask the store", "Book inspection",
  "Ask for approval", "Record approval", "Schedule work", "Mark work done",
  "Close ticket"). Other valid `next` actions sit in a small chevron menu next to
  the primary. While the Now panel's buttons are on screen the bar shows only
  the context and Add update (`hideSteps`), so a step never appears twice. The bar is flush with the bottom of the content area in all four
  AppShell layouts (`ticket/use-dock-insets.ts` measures the shell's padding
  instead of guessing it) and rides above the mobile bottom nav while that
  shows; it leaves room at its end for the draggable Debrief button when that
  button rests on the bar (`useFabClearance`); on sm+ its start side says the
  status and whose turn it is. Each
  action opens ONE small dialog with only its fields (header and buttons fixed,
  only the fields scroll):
  - Ask the store: question + photos.
  - Answer the question / Is it working now?: plus an optional "Who answered"
    text ("Sara, by phone") — no store/office choice.
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
Payments · Total. Table: date, paid to, stores, types (small badges), files
(paperclip when it has attachments; an older payment's invoice # beside it),
total; mistaken rows struck through and hidden unless
"Show mistakes". Side panel **Unpaid work**: per technician, clocked time not
paid + purchases not paid back, each with "Pay this" (opens the dialog
pre-filled).

**Payment dialog** (one scrolling form, no wizard, in the order it is filled):
1. Paid to — one combobox searching technicians and suppliers (grouped), "Add
   supplier" inline — and the Date beside it.
2. **Lines** — each line is a compact card: Type (Select, NOT big squares) →
   under it the type's one-sentence explanation in muted text and only its
   fields: Store (or storage for parts) · amount fields per type · Tickets
   (multi-select of that store's issues). Hourly: pick clocked sessions
   (checklist with dates and paid time) → hours fill in, rate defaults to the
   technician's; typing hours flags "typed over". Parts: part (search/create),
   qty, unit cost, bought from (supplier), goes to: Storage spot / Straight to a
   ticket, serial numbers when the part tracks them, "pays back" technician
   purchases. Changing the Type keeps the line and what still applies (store,
   tickets, description, a typed amount, its notes and files). Under each
   card, **Notes & attachments** is folded away, with a small count badge when
   the line has any; open, it is the same editor as step 3, for that line
   only. "Add line".
3. **Attachments and notes** of the payment — optional, as many as wanted:
   files are chips (pick or paste; × takes one off before saving), notes are
   added one box at a time. When editing, the saved ones show first; × strikes
   one through with Undo, and it goes only on Save.
4. Running total at the bottom (sticky, with the line count), Cancel and the
   primary **Save payment** / **Save changes**.
How we paid, reference / check # and invoice # are NOT asked for (the owner:
showing them made them look required). The API still takes them, an edit
sends back what an older payment had, and the detail sheet shows them only
when present.
Detail sheet: lines (each with its own files and notes), links, attachments,
notes, revisions, Edit, Mark as mistake.

## 6. Storage `/dashboard/storage`

Tabs: **Stock** (search, location filter; per part: on hand per location with
its spot "Zone A › Shelf S", value; part sheet with details brand/model/part
number/unit, serial units list, price history) · **Stock history** (the ledger, plain
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
and duplicate check. Both tabs have a "Show deleted" switch so a deleted one
can be opened and restored. "Add issue" on a technician adds the issue as
covered, not rated yet (stars, notes and call first are set after).

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
