# Keys, Due Keys, and Export/Import Documentation

---

## Keys

The Keys pages allow administrators and managers to manage store keys, including creation, updating, and listing of keys. Keys are essential for tracking access and security within stores.

### Features
- List all keys
- Create new keys
- Update existing keys
- Loading states for smooth UX
- Modular routing for key actions

### API Endpoints & Data Sources
- **Keys API Base:** `/api/keys/`
- **Key List:** `/api/keys/list`
- **Create Key:** `/api/keys/create`
- **Update Key:** `/api/keys/{id}/update`

> Endpoints may be abstracted by hooks or utilities. Check `lib/api/keys/` for details.

### Useful Information for Developers
- Routing for creation and update actions
- Modular React components for forms and lists
- Error handling for invalid actions or missing data

### Where to Find More
- Keys Pages: `app/[locale]/(dashboard)/dashboard/keys/`
- API Utilities: `lib/api/keys/`

---

## Due Keys

The Due Keys page provides an interface for viewing keys that are due for return or renewal, supporting operational tracking and compliance.

### Features
- View due keys
- Loading states for smooth UX

### API Endpoints & Data Sources
- **Due Keys API Base:** `/api/due-keys/`
- **Due Keys List:** `/api/due-keys/list`

> Endpoints may be abstracted by hooks or utilities. Check `lib/api/due-keys/` for details.

### Useful Information for Developers
- Modular React components for due key viewing
- Error handling for invalid actions or missing data

### Where to Find More
- Due Keys Page: `app/[locale]/(dashboard)/dashboard/due-keys/`
- API Utilities: `lib/api/due-keys/`

---

## Export/Import

The Export/Import page allows administrators to export and import key data, supporting backup, migration, and bulk operations.

### Features
- Export key data
- Import key data
- Loading states for smooth UX

### API Endpoints & Data Sources
- **Export/Import API Base:** `/api/export-import/`
- **Export Keys:** `/api/export-import/export`
- **Import Keys:** `/api/export-import/import`

> Endpoints may be abstracted by hooks or utilities. Check `lib/api/export-import/` for details.

### Useful Information for Developers
- Modular React components for export/import actions
- Error handling for invalid actions or missing data

### Where to Find More
- Export/Import Page: `app/[locale]/(dashboard)/dashboard/export-import/`
- API Utilities: `lib/api/export-import/`

---

## Support
For issues or questions, use the support link provided in the UI: [Support Ticket](https://tasks.rdexperts.tech/support-ticket)

_Last updated: March 13, 2026_
