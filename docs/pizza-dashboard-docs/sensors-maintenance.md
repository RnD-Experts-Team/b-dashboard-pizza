# Sensors, Maintenance, Keys, Due Keys, and Export/Import Documentation

---

## Sensors

The Sensors page allows administrators and managers to monitor and manage sensor data for stores. Sensors provide real-time and historical data for operational insights and compliance.

### Features
- View sensor data
- Loading states for smooth UX

### API Endpoints & Data Sources
- **Sensors API Base:** `/api/sensors/`
- **Sensor Data List:** `/api/sensors/list`

> Endpoints may be abstracted by hooks or utilities. Check `lib/api/sensors/` for details.

### Useful Information for Developers
- Modular React components for sensor data viewing
- Error handling for invalid actions or missing data

### Where to Find More
- Sensors Page: `app/[locale]/(dashboard)/dashboard/sensors/`
- API Utilities: `lib/api/sensors/`

---

## Maintenance

The Maintenance page provides an interface for tracking and managing maintenance requests and records for stores.

### Features
- View maintenance requests
- Loading states for smooth UX

### API Endpoints & Data Sources
- **Maintenance API Base:** `/api/maintenance/`
- **Maintenance Requests List:** `/api/maintenance/requests/list`

> Endpoints may be abstracted by hooks or utilities. Check `lib/api/maintenance/` for details.

### Useful Information for Developers
- Modular React components for maintenance viewing
- Error handling for invalid actions or missing data

### Where to Find More
- Maintenance Page: `app/[locale]/(dashboard)/dashboard/maintenance/`
- API Utilities: `lib/api/maintenance/`

---


## Support
For issues or questions, use the support link provided in the UI: [Support Ticket](https://tasks.rdexperts.tech/support-ticket)

_Last updated: March 13, 2026_
