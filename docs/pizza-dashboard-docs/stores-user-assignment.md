# Stores & User Store Assignment Documentation

## Purpose

These pages manage pizza store records and user assignments to stores within the dashboard. They allow administrators and managers to view, create, edit, and assign users to stores, ensuring proper access and operational control.

## Features
- Store listing, creation, editing, and detail views
- User assignment to stores (add/remove)
- Loading states for smooth UX
- Validation and error handling for assignments
- Modular routing for store and assignment actions

## API Endpoints & Data Sources

The pages interact with store and user assignment APIs. Key endpoints include:

- **Stores API Base:** `/api/stores/`
- **Store List:** `/api/stores/list`
- **Store Detail:** `/api/stores/{id}`
- **Create Store:** `/api/stores/create`
- **Edit Store:** `/api/stores/{id}/edit`
- **User Store Assignment Base:** `/api/users/store-assignment/`
- **Assign User to Store:** `/api/users/store-assignment/assign`
- **Remove User from Store:** `/api/users/store-assignment/remove`

> Note: Endpoints may be abstracted by hooks or utilities. Check the implementation in `lib/api/store/` and `lib/api/user-store-assignment/` for details.

## Useful Information for Developers

- **Routing:** Pages are organized by store ID and assignment actions (see folder structure).
- **Loading States:** Dedicated loading components for async operations.
- **Assignment Logic:** Assign/remove actions validate user permissions and store existence.
- **Component Structure:** Modular React components for forms, lists, and assignment actions.
- **Error Handling:** Displays errors for invalid actions or missing data.

## Where to Find More
- **Store Pages:** `app/[locale]/(dashboard)/dashboard/stores/`
- **User Store Assignment Pages:** `app/[locale]/(dashboard)/dashboard/user-store-assignment/`
- **API Utilities:** `lib/api/store/`, `lib/api/user-store-assignment/`
- **Assignment Forms:** `components/assignments/`

## Support
For issues or questions, use the support link provided in the UI: [Support Ticket](https://tasks.rdexperts.tech/support-ticket)

---
_Last updated: March 13, 2026_
