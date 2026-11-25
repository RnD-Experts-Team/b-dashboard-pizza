> **Frontend copy, with where each rule lives in this repo.** The text under the line is the backend's reference, unchanged
> (received 2026-11-25). Auth rules were checked live on `testing` the same day: all eight feed rules, the task rules
> (`POST /v1/calendar/tasks` and `GET /v1/calendar/people` need the permission `create calendar tasks`, which the
> Calendar Tasks role carries) and the event/reminder rules exist as described.
>
> | Doc section | Where in the code |
> |---|---|
> | §3 every store sent is checked, send only the stores the user may see | `lib/calendar/feed-access.ts` (`FEED_RULES`, `storesForFeed`) decides per layer from the user's auth rules; `askAll` in `lib/api/services/calendar-feed.service.ts` asks each layer only those stores, and not at all when none passes. No rule for a route (not loaded / not seeded) → every store is sent and the server decides |
> | §3 a 403 on a feed: hide the layer silently, no retry | `calendar-feed.service.ts` (`forbidden` outcome: kept, never in `failed`, never retried); `feed-notice.tsx` says nothing for it |
> | §3 feeds reload when the rules arrive | `useAccessKey` in `lib/hooks/use-calendar-events.ts` (the rules load after the page does) |
> | §4.1 / §4.3 Task tab, "Chosen people" picker | `useCanCreateTasks` (`components/calendar/use-calendar-permissions.ts`) → `canAccessRoute(TASK_CREATE_RULE)`; the picker is only mounted from the Task tab |
> | §4.3 Event and Reminder always | `components/calendar/new-item-form.tsx` (`kinds`) |
> | §4.3 Cancel / Approve / Return: the creator | `mayBeCreator` in `lib/calendar/toolbox-write.ts` — `created_by` when the feed sends it (today it does not), else the creator named in `people` |
> | §4.3 Start / Submit: a store task by anyone who sees the store, a people task by that person only | `taskActionsFor` / `isAssignee` in `toolbox-write.ts` |
> | §5 403 / 404 / 422 on actions | `event-actions.tsx` (`run`): Toolbox's own `message` first, our sentence as the fallback |
> | §5 403 on creating a task | `saveFailed.forbiddenTask` in `new-item-form.tsx` |
>
> The feed rules carry these exact services and paths (without `/api`): Inventory `/inventory/calendar/feed`, QA (AuditApp)
> `/cleaning/calendar/feed`, Maintenance and Data `/calendar/feed`, Operations, Hiring and Toolbox `/v1/calendar/feed`,
> Notifications `/announcements/calendar/feed` (no permission or role: everyone).

---

# Calendar: roles and permissions (for the frontend)

> Reference for every calendar route: who may call it, what decides, and what the UI should show or hide.
> Valid once the Toolbox change is merged and the pizzasys seeders have run on `testing`.

---

## 1. How it works

**pizzasys decides who may call a route. The projects do not check roles.**

- Every request goes to the project with the user's token. The project asks pizzasys: may this user call `METHOD /path` with these stores?
- pizzasys answers from its **auth rules**: one rule per route (method + path, without `/api`).
- If pizzasys says no, the project answers **403**, and nothing runs.

A rule is one of two kinds:

| Rule | What it checks |
|---|---|
| **`none`** (global) | The permissions the user holds **globally**, from a role given to the user directly |
| **`scoped`** (per store) | For **each store sent** (`stores=` in the query), the permissions the user holds **at that store**, from a role given for that store. **Every** store must pass |

A scoped rule can also let named roles through for **every store**, when the user holds that role **globally**. That is how a specialist sees their layer everywhere.

**super-admin passes every rule.**

### Global role or store role

The same role can be given in two ways in pizzasys:

| Given | Works |
|---|---|
| **To the user directly** (global) | Everywhere, but only for routes whose rule accepts it globally |
| **For a store** | At that store only |

- Store managers hold **Store Manager** for their stores.
- Specialists hold their role **globally**.

---

## 2. Roles in the calendar

| Role | Given | In the calendar |
|---|---|---|
| **super-admin** | global | Everything |
| **Store Manager** | per store | Sees **every layer for their own stores**. Creates events and reminders. **Never creates tasks.** Works on tasks given to their store or to them |
| **Calendar Tasks** (new) | **global**, to chosen specialists | **Creates tasks** (every scope). Sees the **Toolbox** layer for every store |
| Inventory Handler | global | Inventory layer, every store |
| Dough and Sauce | global | Inventory + cleaning/dough layers, every store |
| Cleaning Specialist | global | Cleaning/dough layer, every store |
| QA Manager, QA Auditor | global | Cleaning/dough layer, every store |
| MOS | global | Maintenance layer, every store |
| Hiring Manager, Hiring Specialist, Employee Obsession | global | Hiring layer, every store |
| Scheduling Handler | global | Operations layer, every store |
| Upper MGMT | global | Data (sales) layer, every store |

- A user with **several roles** gets all of them. For example, Inventory Handler + Calendar Tasks sees Inventory and Toolbox, and creates tasks.
- A **specialist role given for a store** (not globally) only works at that store.

---

## 3. The feeds: who sees which layer

| Layer | Project route (`GET`) | Store staff, their own stores | Every store (role held globally) |
|---|---|---|---|
| Inventory | `/api/inventory/calendar/feed` | `reports view`, `inventory handling`, `dough and sauce` | Inventory Handler, Dough and Sauce |
| Cleaning and dough | `/api/cleaning/calendar/feed` (AuditApp) | `reports view`, `cleaning specialist`, `dough and sauce`, `qa audit` | Cleaning Specialist, Dough and Sauce, QA Manager, QA Auditor |
| Maintenance | `/api/calendar/feed` | `reports view`, `mos` | MOS |
| Data (sales) | `/api/calendar/feed` | `reports view`, `data entry`, `keys handling` | Upper MGMT |
| Operations | `/api/v1/calendar/feed` | `reports view`, `view schedule`, `manage schedule` | Scheduling Handler |
| Hiring | `/api/v1/calendar/feed` | `reports view`, `hiring specialist`, `hiring admin`, `employee obsession` | Hiring Manager, Hiring Specialist, Employee Obsession |
| Toolbox | `/api/v1/calendar/feed` | `reports view` | Calendar Tasks |
| Notifications | `/api/announcements/calendar/feed` | **Everyone** | Everyone |

- **Store Manager** holds `reports view` at their stores, so they see every layer for those stores.
- **Every store in `stores=` is checked.** One store the user may not see makes the **whole request 403**. So send only the stores the user may see.
- **A 403 from a feed is expected.** It means "not this layer for these stores".
  - Hide that layer **silently**, and keep showing the others.
  - Do not show an error, and do not retry.
- **Example:** an inventory specialist opens a month for 40 stores.
  - Inventory and Notifications answer **200**.
  - The other projects answer **403**.
  - This is correct.

---

## 4. Toolbox: events, tasks, reminders

### 4.1 What pizzasys checks (by route)

| Route | Who may call it |
|---|---|
| `POST /api/v1/calendar/tasks` (create a task) | **Calendar Tasks** (global) and super-admin only. Everyone else gets **403** |
| `GET /api/v1/calendar/people` (store-manager picker) | **Calendar Tasks** and super-admin only. Everyone else gets **403** |
| `POST /api/v1/calendar/events` (create an event or reminder) | Everyone |
| `GET /api/v1/calendar/events/{id}` | Everyone (Toolbox then decides, 4.2) |
| `POST /api/v1/calendar/events/{id}/cancel` | Everyone (Toolbox then decides) |
| `POST /api/v1/calendar/tasks/{id}/{action}` | Everyone (Toolbox then decides) |
| `GET /api/v1/calendar/reminders`, `POST /api/v1/calendar/reminders/{id}/{snooze\|done\|cancel}` | Everyone (your own reminders only) |

### 4.2 What Toolbox checks itself (by the item)

These depend on the item, so pizzasys cannot check them. Toolbox does:

| Action | Allowed for | Others get |
|---|---|---|
| Open a **private** event or task | its creator | **404** (as if it did not exist) |
| Open a **people** event or task | its creator and its people | **404** |
| Open, snooze, mark done or cancel a **reminder** | its owner | **404** |
| **Cancel** (all, `?stores=` or `?users=`) | the creator | **403** |
| Task **start / submit**, store task (`?stores=X`) | anyone who may see store X | 422 if the state does not allow it |
| Task **start / submit**, people task | that person only (their own part) | **403** |
| Task **approve / return** | the creator | **403** |
| Private task **done / reopen** | the creator | **404** |

### 4.3 What to show in the UI

| UI element | Show when |
|---|---|
| **Task** tab in "Add to the calendar" | `canAccessRoute('POST', '/v1/calendar/tasks')` allows it |
| **Chosen people** option + picker | The Task tab is shown (same people). Call `GET /calendar/people` only then |
| **Event** and **Reminder** tabs | Always |
| **Cancel** / **Cancel here** / **Cancel for him** | `item.created_by === me.id` |
| **Approve** / **Return** | `item.created_by === me.id` and that part is `submitted` |
| **Start** / **Submit**, store task | The user sees that store (it came in their feed) |
| **Start** / **Submit**, people task | The part is the user's own (`people[].user_id === me.id`) |
| **Done** / **Reopen** | A private task (`scope === "private"`), the creator |

Hiding a button is for comfort only: the server refuses anyway.

---

## 5. Errors

| HTTP | From | Meaning | UI |
|---|---|---|---|
| **403** on a feed | pizzasys | This layer is not for these stores | Hide the layer, no message |
| **403** on `POST /calendar/tasks` or `GET /calendar/people` | pizzasys | The user may not create tasks | Hide the Task tab (should not happen if 4.3 is followed) |
| **403** on cancel / approve / return / start | Toolbox | Not the creator, or not this person's task | Show `message` |
| **404** on an item | Toolbox | Private, someone else's, or not involved | "Not found" |
| **422** | Toolbox | Wrong request (`errors` says which field) | Show `message` |

---

## 6. Quick test matrix (on `testing`)

| Log in as | Expect |
|---|---|
| **Store manager** | All layers for their store. Another store: those layers hidden. **No Task tab.** Event and Reminder work |
| **Inventory Handler** (global) | Inventory (and announcements) for every store. Other layers hidden. No Task tab |
| **Calendar Tasks** (global) | Task tab shown. Can create every scope. Toolbox layer for every store. Other layers hidden unless another role allows them |
| **super-admin** | Everything |
| Any user, item made by someone else | No Cancel / Approve / Return buttons. Calling them anyway gives 403 |
