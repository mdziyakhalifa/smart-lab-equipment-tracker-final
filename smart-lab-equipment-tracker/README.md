# Smart Lab Equipment Tracker

A complete, functional front-end prototype for an academic project:
**Design and Development of a Smart Lab Equipment Tracker Web Application**.

Built with **HTML5, CSS3 and Vanilla JavaScript only**. No frameworks, no backend,
no database and no paid services. All application data is saved in the browser's
`localStorage` and survives a page refresh.

> This is an academic demonstration project, not a commercial production system.

---

## Files

```
smart-lab-equipment-tracker/
├── index.html   Application shell: sidebar, top bar and page containers
├── style.css    Complete design system and responsive layouts
├── script.js    Application logic, rendering, validation and interactions
├── data.js      localStorage layer and first-visit sample data
└── README.md    This file
```

---

## How to run

### Option A — VS Code Live Server (recommended)

1. Open the `smart-lab-equipment-tracker` folder in VS Code.
2. Install the **Live Server** extension if you do not have it yet.
3. Right-click `index.html` → **Open with Live Server**.
4. Open <http://127.0.0.1:5500> in Google Chrome.

### Option B — Open the file directly

Double-click `index.html`. The application works from `file://` as well; the only
requirement is an internet connection for the optional Inter font and Lucide
icon CDN. All features still work if those resources are unavailable.

### Option C — Launch Chrome manually

Start any static file server in the project folder, then run:

```
start chrome http://127.0.0.1:5500
```

---

## What is included

| Module | Features |
|---|---|
| **Dashboard** | Dynamic statistics, recent activity, availability donut chart, category bars, pending requests, upcoming reservations and recently added equipment. Every number is calculated from stored data. |
| **Inventory** | Add / edit / delete equipment, automatic asset IDs, search, category filter and detail view. |
| **Availability** | Live available / borrowed / damaged counters, utilisation bars and four professional status states. |
| **Borrowing** | New requests, approve / reject, availability validation, search and status filter. Approving a request reduces available stock. |
| **Returns** | Process active borrowings, record return date and condition, mark returns as damaged, return history and duplicate-return protection. |
| **Reservations** | Create, search and cancel reservations with overlap detection for the same equipment and time slot. |
| **Damage Reports** | Submit reports, search, filter, view details, mark as Under Repair or Resolved. Damaged units leave availability and return after resolution. |
| **Notifications** | Slide-in panel with unread indicators, mark as read, mark all read, clear all, plus overdue alerts generated automatically. |

Navigation is instant (no page reloads), the sidebar collapses on desktop and
turns into a slide-out menu on smaller screens. `Ctrl/⌘ + K` focuses global search.

---

## Sample data

On the first visit the application automatically seeds:

- 8 equipment records
- 4 users
- 3 borrowing records
- 2 reservations
- 2 damage reports
- supporting activity and notification records

To start over, clear this site's local storage in Chrome DevTools
(*Application → Storage → Local Storage → smartlab_tracker_v1*) and refresh.
The original sample data is inserted again automatically.

---

## Notes

- Data is stored under the localStorage key `smartlab_tracker_v1`.
- Icons are loaded from the free Lucide CDN and typography from Google Fonts.
  Both are optional enhancements; the application itself has no external
  runtime dependencies.
- Designed primarily for desktop, with responsive layouts for tablet and mobile.
