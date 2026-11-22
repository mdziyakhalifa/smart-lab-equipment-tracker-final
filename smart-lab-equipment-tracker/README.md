# Smart Lab Equipment Tracker

A complete front-end prototype for the academic project **“Design and Development of a Smart Lab Equipment Tracker Web Application.”**

Built with **HTML5, CSS3 and Vanilla JavaScript only**. No backend, no database server, no paid services. Data is persisted in browser `localStorage`. Runs directly in Google Chrome through VS Code Live Server.

> **Academic demonstration prototype.** It is intentionally browser-only. It does not provide a secure server-side authentication system, a shared central database, or real-time synchronisation between users/devices. See *Prototype limitations* below.

---

## 1. Files

```
smart-lab-equipment-tracker/
├── index.html   App shell, login screen, sidebar, top bar, 10 pages
├── style.css    Design system, components, responsive layouts, login/QR styles
├── script.js    Application logic, permissions, modules, validation, events
├── data.js      localStorage layer, sample data, session handling
└── README.md    This document
```

Optional free CDN resources: Inter font, Lucide icons, and a QR-code generator. The application still works without them (manual asset-ID fallback is always available).

---

## 2. How to run

1. Open the folder in VS Code.
2. Install the **Live Server** extension.
3. Right-click `index.html` → **Open with Live Server**.
4. Open <http://127.0.0.1:5500> in Chrome.

### Demonstration accounts

| Role | Email | Password |
|---|---|---|
| Administrator | `avery.morgan@smartlab.edu` | `admin123` |
| Lab Assistant | `michael.reyes@smartlab.edu` | `assistant123` |
| Faculty | `sarah.mitchell@smartlab.edu` | `faculty123` |
| Student | `emily.wong@smartlab.edu` | `student123` |

You can also click an account button on the login screen to fill the credentials automatically.

---

## 3. Requirement coverage checklist

Status key: **[x]** implemented and tested · **[!]** prototype-limited by design · **[ ]** missing.

### 3.1 Project overview and objectives

| # | Requirement | Status |
|---|---|---|
| 3.1.1 | Central platform for lab asset tracking | [x] |
| 3.1.2 | Availability checking | [x] |
| 3.1.3 | Borrowing / returning records | [x] |
| 3.1.4 | Conflict-free reservations | [x] |
| 3.1.5 | QR-integrated identification with manual fallback | [x] |
| 3.1.6 | Preventive maintenance / calibration monitoring | [x] |
| 3.1.7 | Automated notifications (overdue, low stock, calibration) | [x] |
| 3.1.8 | Literature survey of existing systems | [ ] Documentation task for the report — not an application feature |
| 3.1.9 | Normalized relational database + secure REST API | [!] Outside the HTML/CSS/JS-only prototype constraint; documented as a limitation |
| 3.1.10 | Server-side authentication / real-time sync | [!] Browser-only session + localStorage instead |
| 3.1.11 | Comparison with manual logbook (latency, accuracy, retrieval time) | [ ] Evaluation activity; no measured results supplied — see §8 |

### 3.2 Roles and workflow

| # | Requirement | Status |
|---|---|---|
| 3.2.1 | Four roles: Administrator, Lab Assistant, Student, Faculty | [x] |
| 3.2.2 | User Login → Authentication → Dashboard | [x] |
| 3.2.3 | Student: view equipment, check availability, borrow, return | [x] |
| 3.2.4 | Faculty: view equipment, check availability, manage borrowing records, report damage | [x] |
| 3.2.5 | Admin / Lab Assistant permissions inferred and documented | [x] See §4 |
| 3.2.6 | Updated equipment details reflected back in the application | [x] |

### 3.3 Functional requirements

| ID | Requirement | Status |
|---|---|---|
| FR-01 | Login screen, credential verification, dashboard, role-appropriate navigation | [x] |
| FR-02 | Central equipment list, unique ID, name, category, quantity, **purchase date**, location, condition, detail view | [x] |
| FR-03 | Availability checking; consistent with borrowing, returning, reservations, damage and maintenance | [x] |
| FR-04 | Borrowing requests with equipment, borrower, date, quantity, expected return; approve/reject | [x] |
| FR-05 | Returns with return date, status/quantity update, digital history | [x] |
| FR-06 | Searchable borrowing/return record management | [x] |
| FR-07 | Damage reporting; affected equipment reflected as unavailable | [x] |
| FR-08 | QR/barcode identification, camera scanning where supported, manual ID fallback | [x] |
| FR-09 | Reservations with overlap prevention | [x] |
| FR-10 | Maintenance history, preventive maintenance alerts, calibration schedules and alerts | [x] |
| FR-11 | Overdue, low-stock and calibration alerts | [x] |
| FR-12 | Consumable stock tracking, low-stock detection and alerts | [x] |
| FR-13 | Centralized records and digital usage history | [x] within this browser profile; [!] not shared across devices |

### 3.4 Non-functional requirements

| Requirement | Status |
|---|---|
| Simple, usable web interface | [x] |
| Responsive desktop / tablet / mobile | [x] (tested at 1440px, 656px and 390px with real touch input) |
| Data consistency after each transaction | [x] |
| Access control by role | [x] UI hidden + central dispatcher guard |
| Reliable forms, navigation and workflows | [x] |
| Maintainable HTML / CSS / JavaScript separation | [x] |
| Prompt search and record viewing | [x] |

### 3.5 Acceptance criteria

| Criterion | Status |
|---|---|
| Log in and reach dashboard | [x] |
| Role-specific pages/actions shown or blocked | [x] |
| Students view equipment and availability | [x] |
| Students submit borrowing requests and return equipment | [x] |
| Faculty view borrowing/return records and submit damage reports | [x] |
| Unique ID + required equipment details | [x] |
| Status and quantity update after borrowing/returning | [x] |
| QR identification with manual ID fallback | [x] |
| Reservations and conflict rejection | [x] |
| Maintenance history and preventive alerts | [x] |
| Calibration schedules and alerts | [x] |
| Overdue alerts | [x] |
| Low-stock consumable alerts | [x] |
| Persistence after refresh | [x] |
| Usable on desktop and mobile | [x] |
| Every visible control tested | [x] 70 automated browser checks |
| Nothing marked complete solely because UI is visible | [x] all features exercised programmatically |

---

## 4. Role permission matrix (design decision)

The supplied workflow names Student and Faculty; the objectives additionally name Admin and Lab Assistant. The following matrix was inferred and implemented:

| Capability | Administrator | Lab Assistant | Faculty | Student |
|---|:---:|:---:|:---:|:---:|
| View all pages | Yes | Yes | Yes | Yes |
| Add / edit equipment | Yes | Yes | No | No |
| Delete equipment | Yes | No | No | No |
| Create borrowing request | Yes | Yes | Yes | Yes |
| Approve / reject requests | Yes | Yes | Yes | No |
| Process returns | Yes | Yes | Yes | Yes |
| Create / cancel reservation | Yes | Yes | Yes | Yes |
| Report damage | Yes | Yes | Yes | No |
| Update damage status | Yes | Yes | Yes | No |
| Maintain consumables | Yes | Yes | No | No |
| Add / complete maintenance records | Yes | Yes | No | No |
| Manage calibration schedules | Yes | Yes | No | No |
| Edit own profile | Yes | Yes | Yes | Yes |
| Reset demonstration data | Yes | Yes | Yes | Yes |

Roles are enforced twice: navigation/action visibility is hidden for unauthorised roles, and the central click dispatcher independently blocks unauthorised actions.

> Browser-only access control is illustrative: a determined user could edit localStorage. A production system requires server-side authentication and authorisation.

---

## 5. Modules

| Module | Features |
|---|---|
| **Login** | Credential check, demo account shortcuts, session persistence, sign out |
| **Dashboard** | Live statistics (never hardcoded), attention bar, CSS donut chart, category bars, recent activity, pending requests, upcoming reservations, recently added equipment |
| **Inventory** | Add/edit/delete/view, unique asset IDs, purchase date, search, category filter, QR generation |
| **QR Scanner** | Full-page scanner with a large camera panel, framing guide, Start/Stop controls, manual asset-ID lookup and an inline result card; QR codes can also be generated for every asset. Modal shortcut remains on the Inventory page. |
| **Availability** | Live available/borrowed/damaged counters, utilisation bars, four status states, automatic updates |
| **Borrowing** | Requests, approve/reject, stock validation, search, status filter |
| **Returns** | Return date and condition, damaged-return handling, history, duplicate-return protection |
| **Reservations** | Create/search/cancel, overlapping time-slot prevention |
| **Damage reports** | Submit/search/filter, Under Repair → Resolved workflow, availability restored after resolution |
| **Consumables** | Stock tracking, reorder levels, usage recording, low-stock alerts |
| **Maintenance** | Maintenance history, due-date alerts, complete/delete records |
| **Calibration** | Calibration schedules, due/overdue alerts, mark calibrated with automatic next date |
| **Notifications** | Unread indicators, mark read/all, clear, alert types: overdue, low stock, calibration, maintenance, borrowing, damage, reservation |

---

## 6. Sample data (first visit)

8 equipment records, 5 users (4 roles), 3 borrowing records, 2 reservations, 2 damage reports, 3 maintenance records, 3 calibration schedules, 4 consumables, plus activity and notification records.

Reset: profile → **Reset data**, or delete the `smartlab_tracker_v1` and `smartlab_session_v1` localStorage keys and refresh.

---

## 7. Testing performed

A headless Chrome CDP harness exercised the real application: **70/70 checks passed, zero JavaScript console errors**.

Covered: login validation and session persistence; all 10 pages; role visibility and dispatcher blocking; equipment add/edit/delete/search; QR lookup and QR display; borrowing creation, approval and stock updates; return processing including damaged returns and duplicate prevention; reservation conflict detection; damage reporting and resolution; consumable add/usage/restock/delete and alert lifecycle; maintenance add/complete/delete and alert lifecycle; calibration add/mark/edit/delete and alert lifecycle; notifications; profile update; logout and re-login as different roles; refresh persistence. Earlier suites also verified desktop, tablet and 390px mobile layouts with real touch input.

---

## 8. Prototype limitations / items to confirm

- `localStorage` is per browser profile. There is no shared central database and no cross-device real-time synchronisation.
- Authentication and role enforcement are client-side demonstrations, not secure server-side access control.
- The Gantt chart mentions Python + Database backend development; the current implementation constraint is strictly HTML/CSS/JavaScript, so that architecture is **not** represented as complete.
- The comparison with manual logbook tracking requires measured check-out latency, record accuracy and administrative retrieval time. No results were supplied, so none are claimed. A suggested method: time 10 check-outs in the app versus the logbook, compare the number of correctly retrievable records after 20 transactions, and time retrieval of a specific asset's full history.
- Exact screen designs, field-level validation rules and full Admin/Lab Assistant permissions were not specified; the matrix in §4 records the decisions taken here.

---

## 9. Deployment

Deploy as a **Static Site** (e.g. Render). Repository root must contain `index.html` (Publish Directory `.`), or set Publish Directory to the folder containing it. No build command is required. Data remains local to each visitor's browser.
