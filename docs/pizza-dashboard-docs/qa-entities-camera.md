# Quality Assurance, Entities & Categories, and Camera Report Documentation

---

## Quality Assurance

The Quality Assurance (QA) pages allow administrators and managers to review, create, and manage QA reports and camera forms for stores. These tools help ensure operational standards and compliance are maintained across locations.

### Features
- QA report listing and detail views
- Create new QA reports and camera forms
- Loading states for smooth UX
- Modular routing for QA actions

### API Endpoints & Data Sources
- **QA API Base:** `/api/qa/`
- **QA Report List:** `/api/qa/reports/list`
- **QA Report Detail:** `/api/qa/reports/{id}`
- **Create QA Report:** `/api/qa/reports/create`
- **Create Camera Form:** `/api/qa/camera-forms/create`

> Endpoints may be abstracted by hooks or utilities. Check `lib/api/qa/` for details.

### Useful Information for Developers
- Routing by QA report ID and camera form actions
- Modular React components for forms and lists
- Error handling for invalid actions or missing data

### Where to Find More
- QA Pages: `app/[locale]/(dashboard)/dashboard/quality-assurance/`
- API Utilities: `lib/api/qa/`

---

## Entities & Categories

Entities and Categories pages allow creation and management of QA entities and categories, which are used to organize and classify QA reports and forms.

### Features
- Create QA categories and entities
- List and manage categories/entities
- Loading states for smooth UX
- Modular routing for entity/category actions

### API Endpoints & Data Sources
- **Entities & Categories API Base:** `/api/qa/entities-and-categories/`
- **Create QA Category:** `/api/qa/entities-and-categories/create-category`
- **Create QA Entity:** `/api/qa/entities-and-categories/create-entity`

> Endpoints may be abstracted by hooks or utilities. Check `lib/api/qa/entities-and-categories/` for details.

### Useful Information for Developers
- Routing for creation actions
- Modular React components for forms
- Error handling for invalid actions or missing data

### Where to Find More
- Entities & Categories Pages: `app/[locale]/(dashboard)/dashboard/entities-and-categories/`
- API Utilities: `lib/api/qa/entities-and-categories/`

---

## Camera Report

The Camera Report page provides an interface for viewing and managing camera-based QA reports, supporting compliance and operational monitoring.

### Features
- View camera reports
- Loading states for smooth UX
- Modular routing for camera report actions

### API Endpoints & Data Sources
- **Camera Report API Base:** `/api/qa/camera-report/`
- **Camera Report List:** `/api/qa/camera-report/list`

> Endpoints may be abstracted by hooks or utilities. Check `lib/api/qa/camera-report/` for details.

### Useful Information for Developers
- Modular React components for report viewing
- Error handling for invalid actions or missing data

### Where to Find More
- Camera Report Page: `app/[locale]/(dashboard)/dashboard/camera-report/`
- API Utilities: `lib/api/qa/camera-report/`

---

## Support
For issues or questions, use the support link provided in the UI: [Support Ticket](https://tasks.rdexperts.tech/support-ticket)

_Last updated: March 13, 2026_
