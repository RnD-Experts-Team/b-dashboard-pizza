# DSPR Dashboard Page Documentation

## Purpose

The DSPR Dashboard page provides a comprehensive daily performance report for pizza stores. It visualizes sales, top items, ingredients usage, maintenance, QA ratings, and other operational metrics. The dashboard is designed for store managers and staff to monitor key performance indicators, identify trends, and quickly access actionable insights.

## Features
- Structured error handling for authentication, authorization, network, and server issues
- Date picker for selecting report date (default: yesterday)
- Store selection and validation
- Smart refresh with stale indicator and last-updated timestamp
- Ultra HD screenshot export
- Toggle for section backgrounds (for clean screenshots)
- Multiple charts and summary cards for sales, labor, HNR, maintenance, QA, and ingredients

## API Endpoints & Data Sources

The dashboard relies on the custom `useDspr` hook, which fetches data from DSPR-related endpoints. Key API bases and endpoints include:

- **DSPR API Base:** `/api/dspr/`
- **Daily Store Performance Report:** `/api/dspr/report?storeId={storeId}&date={YYYY-MM-DD}`
- **QA Ratings Summary:** `/api/qa/audits/ratings-summary/overview?storeId={storeId}`
- **Maintenance Data:** `/api/maintenance/requests?storeId={storeId}`
- **Top Items & Ingredients:** `/api/dspr/top-items?storeId={storeId}&date={YYYY-MM-DD}`

> Note: The actual endpoints may be abstracted by the `useDspr` hook and related data-fetching utilities. Check the implementation in `lib/hooks/use-dspr.ts` and related files for details.

## Useful Information for Developers

- **Error Handling:** The page displays detailed error messages and offers retry, login, or support options based on error codes.
- **Date Handling:** Dates are formatted as `YYYY-MM-DD` for API compatibility. The dashboard defaults to yesterday's date.
- **Store Selection:** The dashboard requires a store to be selected. Store IDs are passed as human-readable strings (e.g., `03795-00021`).
- **Screenshot Export:** Uses `html2canvas-pro` for high-resolution screenshots. UI elements are temporarily hidden during capture.
- **Section Background Toggle:** State is persisted in `localStorage` under `dspr.hideSectionBackgrounds`.
- **Refresh Logic:** Data can be refreshed manually or automatically when the store or date changes. Stale data is indicated visually.
- **Component Structure:** The dashboard is composed of modular components for charts, stats, and tables. See `components/dspr/` for details.

## Where to Find More
- **API Hook:** `lib/hooks/use-dspr.ts`
- **Dashboard Components:** `components/dspr/`
- **UI Elements:** `components/ui/`
- **Error Codes:** Review the `ErrorDisplay` component for supported error types.

## Support
For issues or questions, use the support link provided in the UI: [Support Ticket](https://tasks.rdexperts.tech/support-ticket)

---
_Last updated: March 13, 2026_
