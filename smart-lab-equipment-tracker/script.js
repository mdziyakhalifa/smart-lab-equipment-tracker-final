/* =========================================================================
   script.js — Smart Lab Equipment Tracker
   Sections:
     1. State & utilities
     2. Feedback components (toast, modal, confirm)
     3. Notifications
     4. Navigation
     5. Dashboard
     6. Inventory
     7. Availability
     8. Borrowing
     9. Returns
    10. Reservations
    11. Damage reports
    12. Global search
    13. Event delegation & startup
   ========================================================================= */

(function () {
  'use strict';

  /* =======================================================================
     1. STATE & UTILITIES
     ======================================================================= */

  var Store = window.SmartLabStore;
  var state = Store.load();
  var currentPage = 'dashboard';
  var pendingConfirm = null;

  var filters = {
    inventorySearch: '',
    inventoryCategory: 'All',
    availabilitySearch: '',
    borrowSearch: '',
    borrowStatus: 'All',
    returnSearch: '',
    reservationSearch: '',
    damageSearch: '',
    damageStatus: 'All'
  };

  var PAGE_META = {
    dashboard:    { title: 'Dashboard',         crumb: 'Dashboard' },
    inventory:    { title: 'Inventory',         crumb: 'Equipment / Inventory' },
    availability: { title: 'Availability',      crumb: 'Equipment / Availability' },
    borrowing:    { title: 'Borrowing Records', crumb: 'Transactions / Borrowing Records' },
    returns:      { title: 'Returns',           crumb: 'Transactions / Returns' },
    reservations: { title: 'Reservations',      crumb: 'Transactions / Reservations' },
    damage:       { title: 'Damage Reports',    crumb: 'Operations / Damage Reports' }
  };

  var BORROW_STATUS = {
    pending:  { label: 'Pending',  tone: 'amber' },
    approved: { label: 'Approved', tone: 'blue' },
    rejected: { label: 'Rejected', tone: 'red' },
    returned: { label: 'Returned', tone: 'green' }
  };

  var DAMAGE_STATUS = {
    open:         { label: 'Open',         tone: 'red' },
    under_repair: { label: 'Under Repair', tone: 'amber' },
    resolved:     { label: 'Resolved',     tone: 'green' }
  };

  var PRIORITY = {
    High:   { tone: 'red' },
    Medium: { tone: 'amber' },
    Low:    { tone: 'neutral' }
  };

  function $(id) { return document.getElementById(id); }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 900 + 100);
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function fmtDate(iso, withYear) {
    if (!iso) return '—';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: withYear === false ? undefined : 'numeric' });
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function sum(arr, key) {
    return arr.reduce(function (a, x) { return a + (Number(x[key]) || 0); }, 0);
  }

  function findEquipment(id) {
    return state.equipment.find(function (e) { return e.id === id; });
  }

  function findBorrow(id) {
    return state.borrowings.find(function (b) { return b.id === id; });
  }

  function findReport(id) {
    return state.damageReports.find(function (r) { return r.id === id; });
  }

  function badge(label, tone) {
    return '<span class="badge ' + tone + '"><span class="dot"></span>' + esc(label) + '</span>';
  }

  function conditionTag(condition) {
    var key = String(condition || 'Good').toLowerCase();
    return '<span class="condition-tag ' + key + '"><span class="cdot"></span>' + esc(condition) + '</span>';
  }

  function availabilityStatus(e) {
    if (e.condition === 'Damaged') return { label: 'Damaged', tone: 'red' };
    if (e.available <= 0) return { label: 'Fully Borrowed', tone: 'amber' };
    if (e.borrowed > 0 || e.damaged > 0) return { label: 'Partially Available', tone: 'blue' };
    return { label: 'Available', tone: 'green' };
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  function addActivity(type, text) {
    state.activities.unshift({ id: uid('AC'), type: type, text: text, date: todayISO() });
    if (state.activities.length > 40) state.activities.length = 40;
  }

  function addNotification(text, type, id) {
    state.notifications.unshift({
      id: id || uid('NT'),
      text: text,
      type: type || 'info',
      read: false,
      date: todayISO()
    });
    if (state.notifications.length > 40) state.notifications.length = 40;
  }

  function commit() {
    Store.save(state);
    updateNavCount();
    updateBell();
    renderCurrent();
    renderNotifications();
  }

  function updateNavCount() {
    var el = $('nav-damage-count');
    if (!el) return;
    var open = state.damageReports.filter(function (r) { return r.status !== 'resolved'; }).length;
    el.textContent = open;
    el.style.display = open ? '' : 'none';
  }

  /* =======================================================================
     2. FEEDBACK COMPONENTS
     ======================================================================= */

  function toast(message, type) {
    var root = $('toastRoot');
    if (!root) return;
    var icon = type === 'error' ? 'circle-x' : (type === 'info' ? 'info' : 'circle-check');
    var iconClass = type === 'error' ? 'error' : (type === 'info' ? 'info' : '');
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<div class="toast-icon ' + iconClass + '"><i data-lucide="' + icon + '"></i></div><div>' + esc(message) + '</div>';
    root.appendChild(el);
    refreshIcons();
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 260);
    }, 3200);
  }

  /**
   * cfg: { title, subtitle, body, submitLabel, formType, size,
   *        confirmText, danger, onConfirm, showCancel }
   */
  function openModal(cfg) {
    var root = $('modalRoot');

    var bodyHtml = cfg.formType
      ? '<form id="modalForm" data-form="' + esc(cfg.formType) + '">' + cfg.body + '</form>'
      : cfg.body;

    var footer = '';
    if (cfg.showCancel !== false) {
      footer += '<button type="button" class="btn btn-quiet" data-action="close-modal">Cancel</button>';
    }
    if (cfg.formType) {
      footer += '<button type="submit" form="modalForm" class="btn btn-primary">' +
        '<i data-lucide="check"></i>' + esc(cfg.submitLabel || 'Save changes') + '</button>';
    } else if (cfg.onConfirm) {
      footer += '<button type="button" class="btn ' + (cfg.danger ? 'btn-danger' : 'btn-primary') +
        '" data-action="confirm-yes">' + esc(cfg.confirmText || 'Confirm') + '</button>';
    }

    root.innerHTML =
      '<div class="modal-overlay" data-action="close-modal">' +
        '<div class="modal ' + (cfg.size || '') + '" role="dialog" aria-modal="true">' +
          '<div class="modal-head">' +
            '<div><h3>' + esc(cfg.title) + '</h3>' + (cfg.subtitle ? '<p>' + esc(cfg.subtitle) + '</p>' : '') + '</div>' +
            '<button class="icon-btn" data-action="close-modal" aria-label="Close"><i data-lucide="x"></i></button>' +
          '</div>' +
          '<div class="modal-body">' + bodyHtml + '</div>' +
          '<div class="modal-foot">' + footer + '</div>' +
        '</div>' +
      '</div>';
    refreshIcons();
  }

  function closeModal() {
    $('modalRoot').innerHTML = '';
    pendingConfirm = null;
  }

  function confirmAction(cfg) {
    pendingConfirm = cfg.onConfirm;
    openModal({
      title: cfg.title,
      subtitle: '',
      size: 'small',
      danger: cfg.danger !== false,
      confirmText: cfg.confirmText || 'Confirm',
      onConfirm: cfg.onConfirm,
      body: '<div class="confirm-icon"><i data-lucide="triangle-alert"></i></div>' +
            '<div class="confirm-text"><h4>' + esc(cfg.heading || 'Are you sure?') + '</h4><p>' + esc(cfg.message) + '</p></div>'
    });
  }

  /* =======================================================================
     3. NOTIFICATIONS
     ======================================================================= */

  function checkOverdue() {
    var today = todayISO();
    state.borrowings.forEach(function (b) {
      if (b.status === 'approved' && b.expectedReturnDate && b.expectedReturnDate < today) {
        var id = 'OD-' + b.id;
        if (!state.notifications.some(function (n) { return n.id === id; })) {
          state.notifications.unshift({
            id: id,
            text: 'Overdue: ' + b.borrowerName + ' · ' + b.equipmentName,
            type: 'overdue',
            read: false,
            date: today
          });
        }
      }
    });
  }

  function updateBell() {
    var unread = state.notifications.filter(function (n) { return !n.read; }).length;
    var dot = $('bellDot');
    if (dot) dot.classList.toggle('hidden', unread === 0);
  }

  function notifIcon(type) {
    if (type === 'damage') return 'triangle-alert';
    if (type === 'return') return 'package-check';
    if (type === 'overdue') return 'clock-alert';
    if (type === 'reservation') return 'calendar-days';
    if (type === 'approve') return 'circle-check';
    return 'bell';
  }

  function renderNotifications() {
    var list = $('notifList');
    if (!list) return;
    var unread = state.notifications.filter(function (n) { return !n.read; }).length;
    var subtitle = $('notif-subtitle');
    if (subtitle) subtitle.textContent = unread ? unread + ' unread notification' + (unread > 1 ? 's' : '') : "You're all caught up.";
    updateBell();

    if (!state.notifications.length) {
      list.innerHTML = '<div class="empty"><div class="empty-icon"><i data-lucide="bell-off"></i></div><strong>No notifications</strong><p>System updates will appear here as you use the workspace.</p></div>';
      refreshIcons();
      return;
    }

    var sorted = state.notifications.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return String(a.id) < String(b.id) ? 1 : -1;
    });

    list.innerHTML = sorted.map(function (n) {
      return '<div class="notif-item ' + (n.read ? '' : 'unread') + '">' +
        '<div class="n-icon ' + esc(n.type) + '"><i data-lucide="' + notifIcon(n.type) + '"></i></div>' +
        '<div class="notif-body">' +
          '<p>' + esc(n.text) + '</p>' +
          '<span>' + esc(fmtDate(n.date)) + '</span>' +
          (n.read ? '' : '<div class="notif-actions"><button data-action="mark-read" data-id="' + esc(n.id) + '">Mark as read</button></div>') +
        '</div>' +
        (n.read ? '' : '<span class="unread-dot"></span>') +
      '</div>';
    }).join('');
    refreshIcons();
  }

  function toggleNotifications(force) {
    var panel = $('notificationPanel');
    var scrim = $('panelScrim');
    var open = typeof force === 'boolean' ? force : !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    scrim.classList.toggle('open', open);
    if (open) renderNotifications();
  }

  /* =======================================================================
     4. NAVIGATION
     ======================================================================= */

  function navigate(page) {
    if (!PAGE_META[page]) return;
    currentPage = page;

    document.querySelectorAll('.page').forEach(function (p) {
      p.classList.toggle('active', p.id === 'page-' + page);
    });
    document.querySelectorAll('.nav-item').forEach(function (n) {
      n.classList.toggle('active', n.dataset.page === page);
    });

    $('topbar-title').textContent = PAGE_META[page].title;
    $('breadcrumb-current').textContent = PAGE_META[page].crumb;
    document.title = PAGE_META[page].title + ' · Smart Lab';

    closeMobileSidebar();
    toggleNotifications(false);
    closeSearchDropdown();
    renderCurrent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderCurrent() {
    switch (currentPage) {
      case 'dashboard': renderDashboard(); break;
      case 'inventory': renderInventory(); break;
      case 'availability': renderAvailability(); break;
      case 'borrowing': renderBorrowing(); break;
      case 'returns': renderReturns(); break;
      case 'reservations': renderReservations(); break;
      case 'damage': renderDamage(); break;
    }
  }

  function toggleSidebar() {
    var sidebar = $('sidebar');
    if (window.innerWidth <= 960) {
      sidebar.classList.toggle('mobile-open');
      $('sidebarOverlay').classList.toggle('open', sidebar.classList.contains('mobile-open'));
    } else {
      sidebar.classList.toggle('collapsed');
    }
  }

  function closeMobileSidebar() {
    $('sidebar').classList.remove('mobile-open');
    $('sidebarOverlay').classList.remove('open');
  }

  /* =======================================================================
     5. DASHBOARD
     ======================================================================= */

  function renderDashboard() {
    var eq = state.equipment;
    var total = sum(eq, 'quantity');
    var available = sum(eq, 'available');
    var borrowed = sum(eq, 'borrowed');
    var damaged = sum(eq, 'damaged');

    var pending = state.borrowings.filter(function (b) { return b.status === 'pending'; });
    var today = todayISO();
    var overdue = state.borrowings.filter(function (b) {
      return b.status === 'approved' && b.expectedReturnDate && b.expectedReturnDate < today;
    });
    var upcoming = state.reservations
      .filter(function (r) { return r.status === 'upcoming' && r.date >= today; })
      .sort(function (a, b) { return (a.date + a.startTime).localeCompare(b.date + b.startTime); })
      .slice(0, 4);
    var activities = state.activities.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 5);
    var recentlyAdded = eq.slice().sort(function (a, b) { return a.addedDate < b.addedDate ? 1 : -1; }).slice(0, 4);

    var aPct = total ? (available / total) * 100 : 0;
    var bPct = total ? (borrowed / total) * 100 : 0;
    var donutBg = 'conic-gradient(var(--success) 0% ' + aPct + '%, var(--primary) ' + aPct + '% ' + (aPct + bPct) + '%, var(--danger) ' + (aPct + bPct) + '% 100%)';

    var catMap = {};
    eq.forEach(function (e) { catMap[e.category] = (catMap[e.category] || 0) + e.quantity; });
    var cats = Object.keys(catMap).map(function (k) { return { name: k, value: catMap[k] }; })
      .sort(function (x, y) { return y.value - x.value; }).slice(0, 5);
    var maxCat = cats.length ? cats[0].value : 1;

    var activityIcon = { borrow: 'arrow-left-right', damage: 'triangle-alert', reservation: 'calendar-days', return: 'package-check', equipment: 'boxes' };

    var html =
      '<div class="greeting">' +
        '<div><p class="eyebrow">Operations Overview</p>' +
          '<h2>Good morning, Avery</h2>' +
          '<p>Welcome to your laboratory workspace. Here is what needs your attention today.</p>' +
        '</div>' +
        '<div class="greeting-date"><i data-lucide="calendar-days"></i>' +
          new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) +
        '</div>' +
      '</div>' +

      '<div class="grid grid-4 mb-18">' +
        statCard('boxes', 'blue', 'Total Equipment', total, eq.length + ' registered items') +
        statCard('circle-check-big', 'green', 'Available', available, total ? Math.round(available / total * 100) + '% of total inventory' : 'No inventory') +
        statCard('arrow-left-right', 'amber', 'Borrowed', borrowed, pending.length + ' pending request' + (pending.length === 1 ? '' : 's')) +
        statCard('triangle-alert', 'red', 'Damaged', damaged, overdue.length + ' overdue item' + (overdue.length === 1 ? '' : 's')) +
      '</div>' +

      '<div class="grid grid-7-5 mb-18">' +
        '<div class="card">' +
          '<div class="card-head"><div><h3>Recent Activity</h3><p>Latest updates across the workspace</p></div>' +
            '<button class="card-link" data-action="nav" data-page="borrowing">View records <i data-lucide="arrow-up-right"></i></button></div>' +
          '<div class="card-body tight">' + (activities.length
            ? '<ul class="timeline">' + activities.map(function (a) {
                return '<li><div class="tl-icon ' + esc(a.type) + '"><i data-lucide="' + (activityIcon[a.type] || 'activity') + '"></i></div>' +
                  '<div class="tl-body"><p>' + esc(a.text) + '</p><span>' + esc(fmtDate(a.date)) + '</span></div></li>';
              }).join('') + '</ul>'
            : emptyState('activity', 'No activity yet', 'Actions performed in the workspace will be recorded here.')) +
          '</div>' +
        '</div>' +

        '<div class="card">' +
          '<div class="card-head"><div><h3>Equipment Availability</h3><p>Current inventory distribution</p></div></div>' +
          '<div class="card-body">' +
            '<div class="availability-wrap">' +
              '<div class="donut" style="background:' + donutBg + '"><div class="donut-center"><strong>' + total + '</strong><span>TOTAL UNITS</span></div></div>' +
              '<div class="legend">' +
                legendRow('var(--success)', 'Available', available) +
                legendRow('var(--primary)', 'Borrowed', borrowed) +
                legendRow('var(--danger)', 'Damaged', damaged) +
              '</div>' +
            '</div>' +
            '<div style="margin-top:22px;border-top:1px solid var(--border);padding-top:18px">' +
              '<h4 style="margin:0 0 14px;font-size:12px;font-weight:650">By category</h4>' +
              '<div class="bars">' + (cats.length ? cats.map(function (c) {
                return '<div class="bar-row"><span class="bar-label">' + esc(c.name) + '</span>' +
                  '<div class="bar-track"><div class="bar-fill" style="width:' + (c.value / maxCat * 100) + '%"></div></div>' +
                  '<span class="bar-val">' + c.value + '</span></div>';
              }).join('') : '<span style="font-size:12px;color:var(--muted)">No categories yet.</span>') + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="grid grid-2 mb-18">' +
        '<div class="card">' +
          '<div class="card-head"><div><h3>Pending Borrowing Requests</h3><p>Awaiting your approval</p></div>' +
            '<button class="card-link" data-action="nav" data-page="borrowing">All requests <i data-lucide="arrow-up-right"></i></button></div>' +
          '<div class="card-body tight">' + (pending.length
            ? '<table class="mini-table"><thead><tr><th>Borrower</th><th>Equipment</th><th>Qty</th><th></th></tr></thead><tbody>' +
              pending.slice(0, 4).map(function (b) {
                return '<tr><td class="cell-strong">' + esc(b.borrowerName) + '</td><td>' + esc(b.equipmentName) + '</td>' +
                  '<td class="num">' + b.quantity + '</td><td>' +
                  '<button class="btn btn-sm btn-primary" data-action="approve-borrow" data-id="' + esc(b.id) + '">Approve</button> ' +
                  '<button class="btn btn-sm btn-quiet" data-action="reject-borrow" data-id="' + esc(b.id) + '">Reject</button></td></tr>';
              }).join('') + '</tbody></table>'
            : emptyState('check-check', 'No pending requests', 'New borrowing requests will show up here for approval.')) +
          '</div>' +
        '</div>' +

        '<div class="card">' +
          '<div class="card-head"><div><h3>Upcoming Reservations</h3><p>Scheduled equipment bookings</p></div>' +
            '<button class="card-link" data-action="nav" data-page="reservations">View all <i data-lucide="arrow-up-right"></i></button></div>' +
          '<div class="card-body tight">' + (upcoming.length
            ? '<ul class="compact-list">' + upcoming.map(function (r) {
                return '<li><div class="cl-icon"><i data-lucide="calendar-days"></i></div>' +
                  '<div class="cl-body"><strong>' + esc(r.equipmentName) + '</strong>' +
                  '<span>' + esc(r.borrowerName) + ' · ' + esc(fmtDate(r.date, false)) + ', ' + esc(r.startTime) + '–' + esc(r.endTime) + '</span></div></li>';
              }).join('') + '</ul>'
            : emptyState('calendar', 'No upcoming reservations', 'Reservations scheduled ahead will appear here.')) +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-head"><div><h3>Recently Added Equipment</h3><p>Newest items in the inventory</p></div>' +
          '<button class="card-link" data-action="nav" data-page="inventory">Open inventory <i data-lucide="arrow-up-right"></i></button></div>' +
        '<div class="card-body">' +
          '<div class="recent-strip">' + recentlyAdded.map(function (e) {
            return '<button class="recent-item" data-action="view-equipment" data-id="' + esc(e.id) + '" style="text-align:left">' +
              '<div class="ri-icon"><i data-lucide="boxes"></i></div>' +
              '<strong>' + esc(e.name) + '</strong><span>' + esc(e.id) + ' · ' + esc(fmtDate(e.addedDate, false)) + '</span></button>';
          }).join('') + '</div>' +
        '</div>' +
      '</div>';

    $('render-dashboard').innerHTML = html;
    refreshIcons();
  }

  function statCard(icon, tone, label, value, foot) {
    return '<div class="stat"><div class="stat-top"><div class="stat-icon ' + tone + '"><i data-lucide="' + icon + '"></i></div></div>' +
      '<div class="stat-label">' + esc(label) + '</div><div class="stat-value">' + value + '</div>' +
      '<div class="stat-foot"><i data-lucide="trending-up"></i>' + esc(foot) + '</div></div>';
  }

  function legendRow(color, label, value) {
    return '<div class="legend-row"><span class="legend-swatch" style="background:' + color + '"></span>' +
      '<span class="lbl">' + esc(label) + '</span><span class="val">' + value + '</span></div>';
  }

  function emptyState(icon, title, text) {
    return '<div class="empty"><div class="empty-icon"><i data-lucide="' + icon + '"></i></div>' +
      '<strong>' + esc(title) + '</strong><p>' + esc(text) + '</p></div>';
  }

  /* =======================================================================
     6. INVENTORY
     ======================================================================= */

  function renderInventory() {
    var categories = Array.from(new Set(state.equipment.map(function (e) { return e.category; }))).sort();

    $('render-inventory').innerHTML =
      pageHead('Equipment', 'Inventory', 'Manage every asset in your laboratory, from registration to retirement.',
        '<button class="btn btn-primary" data-action="open-add-equipment"><i data-lucide="plus"></i> Add Equipment</button>') +
      '<div class="card">' +
        '<div class="table-toolbar">' +
          '<div class="table-tools">' +
            tableSearch('inv-search', filters.inventorySearch, 'Search name, ID, location…') +
            '<select class="select-sm" id="inv-category" aria-label="Filter by category"><option value="All">All categories</option>' +
              categories.map(function (c) {
                return '<option value="' + esc(c) + '"' + (filters.inventoryCategory === c ? ' selected' : '') + '>' + esc(c) + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<span class="result-count" id="inv-count"></span>' +
        '</div>' +
        '<div class="table-scroll"><table class="data-table">' +
          '<thead><tr><th>Asset ID</th><th>Equipment Name</th><th>Category</th><th>Total Qty</th>' +
          '<th>Available</th><th>Condition</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>' +
          '<tbody id="inv-body"></tbody>' +
        '</table></div>' +
      '</div>';
    renderInventoryTable();
    refreshIcons();
  }

  function renderInventoryTable() {
    var q = filters.inventorySearch.trim().toLowerCase();
    var cat = filters.inventoryCategory;
    var list = state.equipment.filter(function (e) {
      var matches = !q || e.name.toLowerCase().indexOf(q) !== -1 || e.id.toLowerCase().indexOf(q) !== -1 ||
        e.location.toLowerCase().indexOf(q) !== -1 || e.category.toLowerCase().indexOf(q) !== -1;
      return matches && (cat === 'All' || e.category === cat);
    });

    var body = $('inv-body');
    var count = $('inv-count');
    if (!body) return;
    if (count) count.textContent = list.length + ' of ' + state.equipment.length + ' items';

    if (!list.length) {
      body.innerHTML = '<tr><td colspan="8"><div class="table-empty">' +
        emptyState('search-x', 'No equipment found', 'Try adjusting your search or category filter.') + '</div></td></tr>';
      refreshIcons();
      return;
    }

    body.innerHTML = list.map(function (e) {
      var st = availabilityStatus(e);
      return '<tr>' +
        '<td class="mono">' + esc(e.id) + '</td>' +
        '<td><span class="cell-strong">' + esc(e.name) + '</span><span class="cell-sub">' + esc(e.location) + '</span></td>' +
        '<td>' + esc(e.category) + '</td>' +
        '<td class="num">' + e.quantity + '</td>' +
        '<td class="num">' + e.available + '</td>' +
        '<td>' + conditionTag(e.condition) + '</td>' +
        '<td>' + badge(st.label, st.tone) + '</td>' +
        '<td><div class="row-actions" style="justify-content:flex-end">' +
          iconBtn('eye', 'view-equipment', e.id, 'View details') +
          iconBtn('pencil', 'edit-equipment', e.id, 'Edit equipment') +
          iconBtn('trash-2', 'delete-equipment', e.id, 'Delete equipment', true) +
        '</div></td>' +
      '</tr>';
    }).join('');
    refreshIcons();
  }

  function iconBtn(icon, action, id, label, danger) {
    return '<button class="btn btn-sm btn-icon ' + (danger ? 'btn-quiet' : '') + '" data-action="' + action +
      '" data-id="' + esc(id) + '" title="' + esc(label) + '" aria-label="' + esc(label) + '"' +
      (danger ? ' style="color:var(--danger)"' : '') + '><i data-lucide="' + icon + '"></i></button>';
  }

  function equipmentSelect(selected, onlyAvailable) {
    var list = state.equipment.filter(function (e) { return !onlyAvailable || e.available > 0; });
    if (!list.length) return '<option value="">No equipment available</option>';
    return list.map(function (e) {
      return '<option value="' + esc(e.id) + '"' + (e.id === selected ? ' selected' : '') + '>' +
        esc(e.name) + ' · ' + esc(e.id) + ' (' + e.available + ' available)</option>';
    }).join('');
  }

  function borrowerDatalist() {
    return '<datalist id="borrowerList">' + state.users.map(function (u) {
      return '<option value="' + esc(u.name) + '">';
    }).join('') + '</datalist>';
  }

  function openEquipmentForm(id) {
    var e = id ? findEquipment(id) : null;
    var categories = Array.from(new Set(state.equipment.map(function (x) { return x.category; }))).sort();
    if (!categories.length) categories = ['Electronics', 'Lab Equipment', 'Chemistry', 'Optics', 'Imaging'];

    var body =
      '<div class="form-grid">' +
        '<div class="field full"><label>Equipment Name<span class="req">*</span></label>' +
          '<input name="name" required maxlength="80" placeholder="e.g. Digital Oscilloscope" value="' + esc(e ? e.name : '') + '"></div>' +
        '<div class="field"><label>Category<span class="req">*</span></label>' +
          '<input name="category" required list="categoryList" maxlength="40" placeholder="e.g. Electronics" value="' + esc(e ? e.category : '') + '">' +
          '<datalist id="categoryList">' + categories.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></div>' +
        '<div class="field"><label>Quantity<span class="req">*</span></label>' +
          '<input name="quantity" type="number" required min="1" max="999" value="' + (e ? e.quantity : 1) + '"></div>' +
        '<div class="field full"><label>Location<span class="req">*</span></label>' +
          '<input name="location" required maxlength="80" placeholder="e.g. Lab A · Room 201" value="' + esc(e ? e.location : '') + '"></div>' +
        '<div class="field full"><label>Condition<span class="req">*</span></label>' +
          '<select name="condition"><option value="Good"' + (e && e.condition === 'Good' ? ' selected' : '') + '>Good</option>' +
          '<option value="Fair"' + (e && e.condition === 'Fair' ? ' selected' : '') + '>Fair</option>' +
          '<option value="Damaged"' + (e && e.condition === 'Damaged' ? ' selected' : '') + '>Damaged</option></select></div>' +
        '<div class="form-note"><i data-lucide="info"></i><span>' +
          (e ? 'Editing a record will keep its current borrowing and damage counters. Adjust quantity carefully.' :
               'A unique asset ID is generated automatically. New items start fully available.') +
        '</span></div>' +
      '</div>';

    openModal({
      title: e ? 'Edit Equipment' : 'Add Equipment',
      subtitle: e ? 'Update the details of ' + e.name : 'Register a new asset in the laboratory inventory.',
      body: body,
      formType: e ? 'edit-equipment' : 'add-equipment',
      submitLabel: e ? 'Save changes' : 'Add equipment',
      size: ''
    });
    if (e) $('modalRoot').dataset.editId = e.id;
    else delete $('modalRoot').dataset.editId;
  }

  function saveEquipment(formType, form) {
    var f = form.elements;
    var name = f.name.value.trim();
    var category = f.category.value.trim();
    var quantity = parseInt(f.quantity.value, 10);
    var location = f.location.value.trim();
    var condition = f.condition.value;

    if (!name || !category || !location || !quantity || quantity < 1) {
      toast('Please complete all required fields.', 'error');
      return;
    }

    if (formType === 'add-equipment') {
      var id = nextEquipmentId();
      var isDamaged = condition === 'Damaged';
      state.equipment.unshift({
        id: id, name: name, category: category, quantity: quantity,
        available: isDamaged ? 0 : quantity,
        borrowed: 0,
        damaged: isDamaged ? quantity : 0,
        location: location, condition: condition, addedDate: todayISO()
      });
      addActivity('equipment', 'Equipment "' + name + '" added to inventory');
      addNotification('New equipment added: ' + name, 'approve');
      toast('Equipment added successfully · ' + id);
    } else {
      var editId = $('modalRoot').dataset.editId;
      var e = findEquipment(editId);
      if (!e) { toast('Equipment record not found.', 'error'); return; }
      var oldQty = e.quantity;
      var oldCondition = e.condition;
      e.name = name; e.category = category; e.location = location;
      e.quantity = quantity;
      e.available = Math.max(0, e.available + (quantity - oldQty));
      if (condition === 'Damaged' && oldCondition !== 'Damaged' && e.damaged === 0) {
        e.damaged += e.available; e.available = 0;
      } else if (oldCondition === 'Damaged' && condition !== 'Damaged' && e.damaged > 0) {
        e.available += e.damaged; e.damaged = 0;
      }
      e.condition = condition;
      addActivity('equipment', 'Equipment "' + name + '" updated');
      toast('Equipment details saved.');
    }
    closeModal();
    commit();
  }

  function nextEquipmentId() {
    var max = 1049;
    state.equipment.forEach(function (e) {
      var n = parseInt(String(e.id).replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return 'EQ-' + (max + 1);
  }

  function viewEquipment(id) {
    var e = findEquipment(id);
    if (!e) return;
    var st = availabilityStatus(e);
    var related = state.borrowings.filter(function (b) { return b.equipmentId === id && b.status === 'approved'; });
    var reports = state.damageReports.filter(function (r) { return r.equipmentId === id && r.status !== 'resolved'; });

    openModal({
      title: e.name,
      subtitle: 'Asset ' + e.id + ' · ' + e.category,
      size: 'wide',
      body: '<div class="detail-grid">' +
          detailItem('Asset ID', e.id) + detailItem('Location', e.location) +
          detailItem('Category', e.category) + detailItem('Condition', e.condition) +
          detailItem('Total quantity', e.quantity) + detailItem('Available', e.available) +
          detailItem('Currently borrowed', e.borrowed) + detailItem('Damaged units', e.damaged) +
          detailItem('Availability', st.label) + detailItem('Date added', fmtDate(e.addedDate)) +
        '</div>' +
        '<div style="margin-top:18px"><h4 style="margin:0 0 10px;font-size:12px;font-weight:650">Active borrowings</h4>' +
          (related.length ? related.map(function (b) {
            return '<div class="cl-body" style="padding:7px 0;border-top:1px solid var(--border)"><strong>' + esc(b.borrowerName) + '</strong>' +
              '<span>' + b.quantity + ' units · due ' + esc(fmtDate(b.expectedReturnDate)) + '</span></div>';
          }).join('') : '<p style="font-size:12px;color:var(--muted);margin:0">No active borrowings for this asset.</p>') +
        '</div>' +
        '<div style="margin-top:18px"><h4 style="margin:0 0 10px;font-size:12px;font-weight:650">Open damage reports</h4>' +
          (reports.length ? reports.map(function (r) {
            return '<div class="cl-body" style="padding:7px 0;border-top:1px solid var(--border)"><strong>' + esc(r.priority) + ' priority · ' + esc(DAMAGE_STATUS[r.status].label) + '</strong>' +
              '<span>' + esc(r.description) + '</span></div>';
          }).join('') : '<p style="font-size:12px;color:var(--muted);margin:0">No open damage reports.</p>') +
        '</div>',
      submitLabel: '',
      showCancel: false
    });
  }

  function detailItem(label, value) {
    return '<div class="detail-item"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>';
  }

  function pageHead(eyebrow, title, description, actions) {
    return '<div class="page-head"><div><p class="eyebrow">' + esc(eyebrow) + '</p>' +
      '<h2>' + esc(title) + '</h2><p>' + esc(description) + '</p></div>' +
      '<div class="page-actions">' + actions + '</div></div>';
  }

  function tableSearch(id, value, placeholder) {
    return '<div class="table-search"><i data-lucide="search"></i>' +
      '<input type="text" id="' + id + '" value="' + esc(value) + '" placeholder="' + esc(placeholder) + '" aria-label="Search"></div>';
  }

  /* =======================================================================
     7. AVAILABILITY
     ======================================================================= */

  function renderAvailability() {
    var eq = state.equipment;
    var counts = { Available: 0, 'Partially Available': 0, 'Fully Borrowed': 0, Damaged: 0 };
    eq.forEach(function (e) { counts[availabilityStatus(e).label]++; });

    $('render-availability').innerHTML =
      pageHead('Equipment', 'Availability', 'Live status of every asset, updated automatically by borrowing and damage activity.', '') +
      '<div class="grid grid-4 mb-18">' +
        miniStat('Available', counts.Available, 'green') +
        miniStat('Partially Available', counts['Partially Available'], 'blue') +
        miniStat('Fully Borrowed', counts['Fully Borrowed'], 'amber') +
        miniStat('Damaged', counts.Damaged, 'red') +
      '</div>' +
      '<div class="card">' +
        '<div class="table-toolbar">' +
          '<div class="table-tools">' + tableSearch('avail-search', filters.availabilitySearch, 'Search equipment…') + '</div>' +
          '<span class="result-count" id="avail-count"></span>' +
        '</div>' +
        '<div class="table-scroll"><table class="data-table">' +
          '<thead><tr><th>Equipment</th><th>Asset ID</th><th>Total</th><th>Available</th><th>Borrowed</th>' +
          '<th style="width:150px">Utilisation</th><th>Condition</th><th>Status</th></tr></thead>' +
          '<tbody id="avail-body"></tbody>' +
        '</table></div>' +
      '</div>';
    renderAvailabilityTable();
    refreshIcons();
  }

  function miniStat(label, value, tone) {
    return '<div class="stat"><div class="stat-top"><div class="stat-icon ' + tone + '"><i data-lucide="box"></i></div></div>' +
      '<div class="stat-label">' + esc(label) + '</div><div class="stat-value">' + value + '</div></div>';
  }

  function renderAvailabilityTable() {
    var q = filters.availabilitySearch.trim().toLowerCase();
    var list = state.equipment.filter(function (e) {
      return !q || e.name.toLowerCase().indexOf(q) !== -1 || e.id.toLowerCase().indexOf(q) !== -1;
    });
    var body = $('avail-body');
    if (!body) return;
    var count = $('avail-count');
    if (count) count.textContent = list.length + ' items';

    if (!list.length) {
      body.innerHTML = '<tr><td colspan="8"><div class="table-empty">' +
        emptyState('search-x', 'No equipment found', 'Try a different search term.') + '</div></td></tr>';
      refreshIcons();
      return;
    }

    body.innerHTML = list.map(function (e) {
      var st = availabilityStatus(e);
      var usedPct = e.quantity ? Math.round(((e.borrowed + e.damaged) / e.quantity) * 100) : 0;
      return '<tr>' +
        '<td><span class="cell-strong">' + esc(e.name) + '</span><span class="cell-sub">' + esc(e.location) + '</span></td>' +
        '<td class="mono">' + esc(e.id) + '</td>' +
        '<td class="num">' + e.quantity + '</td>' +
        '<td class="num">' + e.available + '</td>' +
        '<td class="num">' + e.borrowed + '</td>' +
        '<td><div class="bar-track" style="height:6px"><div class="bar-fill" style="width:' + usedPct + '%;background:' +
          (st.tone === 'red' ? 'var(--danger)' : 'var(--primary)') + '"></div></div></td>' +
        '<td>' + conditionTag(e.condition) + '</td>' +
        '<td>' + badge(st.label, st.tone) + '</td>' +
      '</tr>';
    }).join('');
    refreshIcons();
  }

  /* =======================================================================
     8. BORROWING
     ======================================================================= */

  function renderBorrowing() {
    $('render-borrowing').innerHTML =
      pageHead('Transactions', 'Borrowing Records', 'Submit, review and manage equipment borrowing requests.',
        '<button class="btn btn-primary" data-action="open-add-borrow"><i data-lucide="plus"></i> New Borrowing Request</button>') +
      '<div class="card">' +
        '<div class="table-toolbar">' +
          '<div class="table-tools">' +
            tableSearch('borrow-search', filters.borrowSearch, 'Search borrower, ID, equipment…') +
            '<select class="select-sm" id="borrow-status" aria-label="Filter by status"><option value="All">All statuses</option>' +
              Object.keys(BORROW_STATUS).map(function (k) {
                return '<option value="' + k + '"' + (filters.borrowStatus === k ? ' selected' : '') + '>' + BORROW_STATUS[k].label + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<span class="result-count" id="borrow-count"></span>' +
        '</div>' +
        '<div class="table-scroll"><table class="data-table">' +
          '<thead><tr><th>Request ID</th><th>Borrower</th><th>Equipment</th><th>Qty</th><th>Borrow Date</th>' +
          '<th>Expected Return</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>' +
          '<tbody id="borrow-body"></tbody>' +
        '</table></div>' +
      '</div>' +
      borrowerDatalist();
    renderBorrowingTable();
    refreshIcons();
  }

  function renderBorrowingTable() {
    var q = filters.borrowSearch.trim().toLowerCase();
    var st = filters.borrowStatus;
    var list = state.borrowings.filter(function (b) {
      var matches = !q || b.id.toLowerCase().indexOf(q) !== -1 || b.borrowerName.toLowerCase().indexOf(q) !== -1 ||
        b.equipmentName.toLowerCase().indexOf(q) !== -1;
      return matches && (st === 'All' || b.status === st);
    }).sort(function (a, b) { return a.id < b.id ? 1 : -1; });

    var body = $('borrow-body');
    if (!body) return;
    var count = $('borrow-count');
    if (count) count.textContent = list.length + ' of ' + state.borrowings.length + ' records';

    if (!list.length) {
      body.innerHTML = '<tr><td colspan="8"><div class="table-empty">' +
        emptyState('clipboard-list', 'No borrowing records', 'Create a new request or adjust your filters.') + '</div></td></tr>';
      refreshIcons();
      return;
    }

    body.innerHTML = list.map(function (b) {
      var s = BORROW_STATUS[b.status] || BORROW_STATUS.pending;
      var actions = iconBtn('eye', 'view-borrow', b.id, 'View request');
      if (b.status === 'pending') {
        actions += iconBtn('check', 'approve-borrow', b.id, 'Approve request');
        actions += iconBtn('x', 'reject-borrow', b.id, 'Reject request', true);
      }
      return '<tr>' +
        '<td class="mono">' + esc(b.id) + '</td>' +
        '<td class="cell-strong">' + esc(b.borrowerName) + '</td>' +
        '<td>' + esc(b.equipmentName) + '</td>' +
        '<td class="num">' + b.quantity + '</td>' +
        '<td>' + esc(fmtDate(b.borrowDate)) + '</td>' +
        '<td>' + esc(fmtDate(b.expectedReturnDate)) + '</td>' +
        '<td>' + badge(s.label, s.tone) + '</td>' +
        '<td><div class="row-actions" style="justify-content:flex-end">' + actions + '</div></td>' +
      '</tr>';
    }).join('');
    refreshIcons();
  }

  function openBorrowForm() {
    var body =
      '<div class="form-grid">' +
        '<div class="field full"><label>Borrower Name<span class="req">*</span></label>' +
          '<input name="borrowerName" required list="borrowerList" maxlength="60" placeholder="Select or type a name"></div>' +
        '<div class="field full"><label>Equipment<span class="req">*</span></label>' +
          '<select name="equipmentId" required>' + equipmentSelect('', true) + '</select></div>' +
        '<div class="field"><label>Quantity<span class="req">*</span></label>' +
          '<input name="quantity" type="number" required min="1" max="999" value="1"></div>' +
        '<div class="field"><label>Borrow Date<span class="req">*</span></label>' +
          '<input name="borrowDate" type="date" required value="' + todayISO() + '"></div>' +
        '<div class="field"><label>Expected Return Date<span class="req">*</span></label>' +
          '<input name="expectedReturnDate" type="date" required value="' + todayISO() + '"></div>' +
        '<div class="field"><label>Availability</label>' +
          '<input id="borrow-available" value="Select equipment" disabled></div>' +
        '<div class="field full"><label>Purpose / Notes</label>' +
          '<textarea name="note" maxlength="200" placeholder="Optional context for this request"></textarea></div>' +
        '<div class="form-note"><i data-lucide="info"></i><span>Requests start as <strong>pending</strong>. Inventory quantities are only updated once you approve the request.</span></div>' +
      '</div>' + borrowerDatalist();

    openModal({
      title: 'New Borrowing Request',
      subtitle: 'Reserve equipment from the available inventory.',
      body: body,
      formType: 'add-borrow',
      submitLabel: 'Submit request'
    });
    updateBorrowAvailability();
  }

  function updateBorrowAvailability() {
    var form = $('modalForm');
    if (!form || !form.elements.equipmentId) return;
    var e = findEquipment(form.elements.equipmentId.value);
    var el = $('borrow-available');
    if (el) el.value = e ? e.available + ' units currently available' : 'No equipment selected';
    var q = form.elements.quantity;
    if (e) q.max = e.available;
  }

  function saveBorrow(form) {
    var f = form.elements;
    var borrowerName = f.borrowerName.value.trim();
    var equipmentId = f.equipmentId.value;
    var quantity = parseInt(f.quantity.value, 10);
    var borrowDate = f.borrowDate.value;
    var expectedReturnDate = f.expectedReturnDate.value;
    var note = f.note.value.trim();
    var e = findEquipment(equipmentId);

    if (!borrowerName || !e || !borrowDate || !expectedReturnDate || !quantity || quantity < 1) {
      toast('Please complete all required fields.', 'error'); return;
    }
    if (expectedReturnDate < borrowDate) {
      toast('Expected return date cannot be before the borrow date.', 'error'); return;
    }
    if (quantity > e.available) {
      toast('Only ' + e.available + ' unit(s) of ' + e.name + ' are available.', 'error'); return;
    }

    state.borrowings.unshift({
      id: uid('BR'), borrowerName: borrowerName, equipmentId: equipmentId,
      equipmentName: e.name, quantity: quantity, borrowDate: borrowDate,
      expectedReturnDate: expectedReturnDate, returnDate: '', returnCondition: '',
      status: 'pending', note: note
    });
    addActivity('borrow', 'New borrowing request from ' + borrowerName);
    addNotification('New borrowing request from ' + borrowerName + ' · ' + e.name, 'borrow');
    closeModal();
    commit();
    toast('Borrowing request submitted for approval.');
  }

  function approveBorrow(id) {
    var b = findBorrow(id);
    if (!b) return;
    if (b.status !== 'pending') { toast('This request has already been processed.', 'error'); return; }
    var e = findEquipment(b.equipmentId);
    if (!e) { toast('Equipment record not found.', 'error'); return; }
    if (e.available < b.quantity) {
      toast('Insufficient stock: only ' + e.available + ' unit(s) available.', 'error'); return;
    }
    e.available -= b.quantity;
    e.borrowed += b.quantity;
    b.status = 'approved';
    addActivity('borrow', 'Borrowing request approved for ' + b.borrowerName);
    addNotification('Borrowing request approved for ' + b.borrowerName, 'approve');
    commit();
    toast('Request approved · inventory updated.');
  }

  function rejectBorrow(id) {
    var b = findBorrow(id);
    if (!b || b.status !== 'pending') { toast('This request has already been processed.', 'error'); return; }
    confirmAction({
      title: 'Reject request',
      heading: 'Reject this borrowing request?',
      message: 'The request from ' + b.borrowerName + ' for ' + b.equipmentName + ' will be marked as rejected. No inventory quantities will change.',
      confirmText: 'Reject request',
      onConfirm: function () {
        b.status = 'rejected';
        addActivity('borrow', 'Borrowing request rejected for ' + b.borrowerName);
        closeModal();
        commit();
        toast('Borrowing request rejected.');
      }
    });
  }

  function viewBorrow(id) {
    var b = findBorrow(id);
    if (!b) return;
    var s = BORROW_STATUS[b.status] || BORROW_STATUS.pending;
    openModal({
      title: 'Borrowing Request',
      subtitle: b.id,
      body: '<div class="detail-grid">' +
          detailItem('Request ID', b.id) + detailItem('Status', s.label) +
          detailItem('Borrower', b.borrowerName) + detailItem('Equipment', b.equipmentName) +
          detailItem('Quantity', b.quantity) + detailItem('Borrow date', fmtDate(b.borrowDate)) +
          detailItem('Expected return', fmtDate(b.expectedReturnDate)) +
          detailItem('Return date', b.returnDate ? fmtDate(b.returnDate) : 'Not yet returned') +
          detailItem('Return condition', b.returnCondition || '—') + detailItem('Notes', b.note || '—') +
        '</div>' +
        (b.note ? '<div style="margin-top:16px"><h4 style="margin:0 0 6px;font-size:12px;font-weight:650">Purpose</h4><p style="margin:0;font-size:12.5px;color:var(--muted)">' + esc(b.note) + '</p></div>' : ''),
      showCancel: false,
      submitLabel: ''
    });
  }

  /* =======================================================================
     9. RETURNS
     ======================================================================= */

  function renderReturns() {
    var active = state.borrowings.filter(function (b) { return b.status === 'approved'; });
    var returned = state.borrowings.filter(function (b) { return b.status === 'returned'; });
    var today = todayISO();
    var overdue = active.filter(function (b) { return b.expectedReturnDate < today; }).length;

    $('render-returns').innerHTML =
      pageHead('Transactions', 'Returns', 'Process equipment check-ins and record the condition of returned items.',
        '<div class="greeting-date" style="margin:0"><i data-lucide="clock-alert"></i>' + overdue + ' overdue</div>') +
      '<div class="card mb-18">' +
        '<div class="table-toolbar">' +
          '<div class="table-tools">' + tableSearch('return-search', filters.returnSearch, 'Search active borrowings…') + '</div>' +
          '<span class="result-count" id="return-count"></span>' +
        '</div>' +
        '<div class="table-scroll"><table class="data-table">' +
          '<thead><tr><th>Request ID</th><th>Borrower</th><th>Equipment</th><th>Qty</th><th>Borrow Date</th>' +
          '<th>Due Date</th><th>Due Status</th><th style="text-align:right">Action</th></tr></thead>' +
          '<tbody id="return-body"></tbody>' +
        '</table></div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-head"><div><h3>Return History</h3><p>Completed check-ins</p></div></div>' +
        '<div class="table-scroll"><table class="data-table">' +
          '<thead><tr><th>Request ID</th><th>Borrower</th><th>Equipment</th><th>Return Date</th><th>Condition</th><th>Status</th></tr></thead>' +
          '<tbody id="return-history"></tbody>' +
        '</table></div>' +
      '</div>';

    renderReturnsTable();

    var hist = $('return-history');
    if (hist) {
      hist.innerHTML = returned.length ? returned.sort(function (a, b) { return a.returnDate < b.returnDate ? 1 : -1; }).map(function (b) {
        return '<tr><td class="mono">' + esc(b.id) + '</td><td class="cell-strong">' + esc(b.borrowerName) + '</td>' +
          '<td>' + esc(b.equipmentName) + '</td><td>' + esc(fmtDate(b.returnDate)) + '</td>' +
          '<td>' + conditionTag(b.returnCondition || 'Good') + '</td><td>' + badge('Returned', 'green') + '</td></tr>';
      }).join('') : '<tr><td colspan="6"><div class="table-empty">' +
        emptyState('package-check', 'No returns yet', 'Processed returns will be listed here.') + '</div></td></tr>';
    }
    refreshIcons();
  }

  function renderReturnsTable() {
    var q = filters.returnSearch.trim().toLowerCase();
    var today = todayISO();
    var list = state.borrowings.filter(function (b) {
      return b.status === 'approved' && (!q || b.id.toLowerCase().indexOf(q) !== -1 ||
        b.borrowerName.toLowerCase().indexOf(q) !== -1 || b.equipmentName.toLowerCase().indexOf(q) !== -1);
    });
    var body = $('return-body');
    if (!body) return;
    var count = $('return-count');
    if (count) count.textContent = list.length + ' active borrowing' + (list.length === 1 ? '' : 's');

    if (!list.length) {
      body.innerHTML = '<tr><td colspan="8"><div class="table-empty">' +
        emptyState('package-check', 'Nothing to return', 'All active borrowings have been checked in.') + '</div></td></tr>';
      refreshIcons();
      return;
    }

    body.innerHTML = list.map(function (b) {
      var isOverdue = b.expectedReturnDate < today;
      return '<tr>' +
        '<td class="mono">' + esc(b.id) + '</td>' +
        '<td class="cell-strong">' + esc(b.borrowerName) + '</td>' +
        '<td>' + esc(b.equipmentName) + '</td>' +
        '<td class="num">' + b.quantity + '</td>' +
        '<td>' + esc(fmtDate(b.borrowDate)) + '</td>' +
        '<td>' + esc(fmtDate(b.expectedReturnDate)) + '</td>' +
        '<td>' + badge(isOverdue ? 'Overdue' : 'On time', isOverdue ? 'red' : 'green') + '</td>' +
        '<td><div class="row-actions" style="justify-content:flex-end">' +
          '<button class="btn btn-sm btn-primary" data-action="open-return" data-id="' + esc(b.id) + '">' +
          '<i data-lucide="package-check"></i> Process Return</button></div></td>' +
      '</tr>';
    }).join('');
    refreshIcons();
  }

  function openReturnForm(id) {
    var b = findBorrow(id);
    if (!b) return;
    if (b.status !== 'approved') { toast('This borrowing record is not active.', 'error'); return; }

    var body =
      '<div class="detail-grid" style="margin-bottom:18px">' +
        detailItem('Request ID', b.id) + detailItem('Borrower', b.borrowerName) +
        detailItem('Equipment', b.equipmentName) + detailItem('Quantity', b.quantity) +
      '</div>' +
      '<div class="form-grid">' +
        '<div class="field full"><label>Return Date<span class="req">*</span></label>' +
          '<input name="returnDate" type="date" required value="' + todayISO() + '"></div>' +
        '<div class="field full"><label>Equipment Condition on Return<span class="req">*</span></label>' +
          '<select name="returnCondition"><option value="Good">Good — ready for use</option>' +
          '<option value="Fair">Fair — usable with minor wear</option>' +
          '<option value="Damaged">Damaged — remove from availability</option></select></div>' +
        '<div class="field full"><label>Return Notes</label>' +
          '<textarea name="note" maxlength="200" placeholder="Optional inspection notes"></textarea></div>' +
        '<div class="form-note"><i data-lucide="info"></i><span>Choosing <strong>Damaged</strong> moves the returned units out of availability and flags the equipment for repair.</span></div>' +
      '</div>';

    openModal({
      title: 'Process Return',
      subtitle: 'Check in ' + b.quantity + ' unit(s) of ' + b.equipmentName,
      body: body,
      formType: 'process-return',
      submitLabel: 'Confirm return'
    });
    $('modalRoot').dataset.returnId = b.id;
  }

  function saveReturn(form) {
    var id = $('modalRoot').dataset.returnId;
    var b = findBorrow(id);
    if (!b) { toast('Borrowing record not found.', 'error'); return; }
    if (b.status !== 'approved') { toast('This record has already been returned.', 'error'); closeModal(); return; }

    var f = form.elements;
    var returnDate = f.returnDate.value;
    var condition = f.returnCondition.value;
    var note = f.note.value.trim();
    if (!returnDate) { toast('Please select a return date.', 'error'); return; }

    var e = findEquipment(b.equipmentId);
    if (!e) { toast('Equipment record not found.', 'error'); return; }

    b.status = 'returned';
    b.returnDate = returnDate;
    b.returnCondition = condition;
    b.note = note ? b.note + ' | Return: ' + note : b.note;

    if (condition === 'Damaged') {
      e.borrowed = Math.max(0, e.borrowed - b.quantity);
      e.damaged += b.quantity;
      e.condition = 'Damaged';
    } else {
      e.borrowed = Math.max(0, e.borrowed - b.quantity);
      e.available += b.quantity;
      e.condition = e.damaged > 0 ? 'Fair' : condition;
    }

    addActivity('return', 'Equipment returned by ' + b.borrowerName + (condition === 'Damaged' ? ' · marked damaged' : ''));
    addNotification('Equipment returned by ' + b.borrowerName + (condition === 'Damaged' ? ' · damage reported' : ''), 'return');
    closeModal();
    commit();
    toast('Return processed · inventory updated.');
  }

  /* =======================================================================
     10. RESERVATIONS
     ======================================================================= */

  function renderReservations() {
    $('render-reservations').innerHTML =
      pageHead('Transactions', 'Reservations', 'Schedule equipment time slots and prevent double bookings.',
        '<button class="btn btn-primary" data-action="open-add-reservation"><i data-lucide="plus"></i> New Reservation</button>') +
      '<div class="card">' +
        '<div class="table-toolbar">' +
          '<div class="table-tools">' + tableSearch('res-search', filters.reservationSearch, 'Search borrower, equipment, ID…') + '</div>' +
          '<span class="result-count" id="res-count"></span>' +
        '</div>' +
        '<div class="table-scroll"><table class="data-table">' +
          '<thead><tr><th>Reservation ID</th><th>Borrower</th><th>Equipment</th><th>Date</th><th>Time</th><th>Status</th>' +
          '<th style="text-align:right">Action</th></tr></thead>' +
          '<tbody id="res-body"></tbody>' +
        '</table></div>' +
      '</div>' + borrowerDatalist();
    renderReservationsTable();
    refreshIcons();
  }

  function renderReservationsTable() {
    var q = filters.reservationSearch.trim().toLowerCase();
    var list = state.reservations.filter(function (r) {
      return !q || r.id.toLowerCase().indexOf(q) !== -1 || r.borrowerName.toLowerCase().indexOf(q) !== -1 ||
        r.equipmentName.toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return (a.date + a.startTime).localeCompare(b.date + b.startTime); });

    var body = $('res-body');
    if (!body) return;
    var count = $('res-count');
    if (count) count.textContent = list.length + ' reservation' + (list.length === 1 ? '' : 's');

    if (!list.length) {
      body.innerHTML = '<tr><td colspan="7"><div class="table-empty">' +
        emptyState('calendar-days', 'No reservations found', 'Create a reservation or adjust your search.') + '</div></td></tr>';
      refreshIcons();
      return;
    }

    body.innerHTML = list.map(function (r) {
      var isPast = r.status === 'upcoming' && r.date < todayISO();
      return '<tr>' +
        '<td class="mono">' + esc(r.id) + '</td>' +
        '<td class="cell-strong">' + esc(r.borrowerName) + '</td>' +
        '<td>' + esc(r.equipmentName) + '</td>' +
        '<td>' + esc(fmtDate(r.date)) + '</td>' +
        '<td>' + esc(r.startTime) + ' – ' + esc(r.endTime) + '</td>' +
        '<td>' + (isPast ? badge('Completed', 'neutral') : badge(r.status === 'upcoming' ? 'Upcoming' : 'Cancelled', r.status === 'upcoming' ? 'green' : 'neutral')) + '</td>' +
        '<td><div class="row-actions" style="justify-content:flex-end">' +
          (r.status === 'upcoming'
            ? '<button class="btn btn-sm btn-quiet" data-action="cancel-reservation" data-id="' + esc(r.id) + '" style="color:var(--danger)">Cancel</button>'
            : '<span style="font-size:11.5px;color:var(--muted)">—</span>') +
        '</div></td>' +
      '</tr>';
    }).join('');
    refreshIcons();
  }

  function openReservationForm() {
    var body =
      '<div class="form-grid">' +
        '<div class="field full"><label>Borrower Name<span class="req">*</span></label>' +
          '<input name="borrowerName" required list="borrowerList" maxlength="60" placeholder="Select or type a name"></div>' +
        '<div class="field full"><label>Equipment<span class="req">*</span></label>' +
          '<select name="equipmentId" required>' + equipmentSelect('', false) + '</select></div>' +
        '<div class="field full"><label>Reservation Date<span class="req">*</span></label>' +
          '<input name="date" type="date" required min="' + todayISO() + '" value="' + todayISO() + '"></div>' +
        '<div class="field"><label>Start Time<span class="req">*</span></label>' +
          '<input name="startTime" type="time" required value="09:00"></div>' +
        '<div class="field"><label>End Time<span class="req">*</span></label>' +
          '<input name="endTime" type="time" required value="11:00"></div>' +
        '<div class="form-note"><i data-lucide="info"></i><span>Overlapping reservations for the same equipment on the same date are automatically blocked.</span></div>' +
      '</div>' + borrowerDatalist();

    openModal({
      title: 'New Reservation',
      subtitle: 'Book a time slot for laboratory equipment.',
      body: body,
      formType: 'add-reservation',
      submitLabel: 'Create reservation'
    });
  }

  function saveReservation(form) {
    var f = form.elements;
    var borrowerName = f.borrowerName.value.trim();
    var equipmentId = f.equipmentId.value;
    var date = f.date.value;
    var startTime = f.startTime.value;
    var endTime = f.endTime.value;
    var e = findEquipment(equipmentId);

    if (!borrowerName || !e || !date || !startTime || !endTime) {
      toast('Please complete all required fields.', 'error'); return;
    }
    if (date < todayISO()) { toast('Reservation date cannot be in the past.', 'error'); return; }
    if (endTime <= startTime) { toast('End time must be later than the start time.', 'error'); return; }

    var conflict = state.reservations.some(function (r) {
      return r.status === 'upcoming' && r.equipmentId === equipmentId && r.date === date &&
        startTime < r.endTime && endTime > r.startTime;
    });
    if (conflict) {
      toast('This equipment is already reserved for that time slot.', 'error'); return;
    }

    state.reservations.unshift({
      id: uid('RS'), borrowerName: borrowerName, equipmentId: equipmentId,
      equipmentName: e.name, date: date, startTime: startTime, endTime: endTime, status: 'upcoming'
    });
    addActivity('reservation', 'Reservation created for ' + e.name);
    addNotification('Reservation scheduled for ' + e.name + ' · ' + fmtDate(date, false), 'reservation');
    closeModal();
    commit();
    toast('Reservation created successfully.');
  }

  function cancelReservation(id) {
    var r = state.reservations.find(function (x) { return x.id === id; });
    if (!r || r.status !== 'upcoming') { toast('This reservation is not active.', 'error'); return; }
    confirmAction({
      title: 'Cancel reservation',
      heading: 'Cancel this reservation?',
      message: 'The ' + r.equipmentName + ' slot for ' + r.borrowerName + ' on ' + fmtDate(r.date) + ' will be released.',
      confirmText: 'Cancel reservation',
      onConfirm: function () {
        r.status = 'cancelled';
        addActivity('reservation', 'Reservation cancelled for ' + r.equipmentName);
        addNotification('Reservation cancelled for ' + r.equipmentName, 'reservation');
        closeModal();
        commit();
        toast('Reservation cancelled.');
      }
    });
  }

  /* =======================================================================
     11. DAMAGE REPORTS
     ======================================================================= */

  function renderDamage() {
    $('render-damage').innerHTML =
      pageHead('Operations', 'Damage Reports', 'Log equipment issues, track repairs and restore assets to service.',
        '<button class="btn btn-primary" data-action="open-add-damage"><i data-lucide="plus"></i> Report Damage</button>') +
      '<div class="card">' +
        '<div class="table-toolbar">' +
          '<div class="table-tools">' +
            tableSearch('damage-search', filters.damageSearch, 'Search reports, equipment, reporter…') +
            '<select class="select-sm" id="damage-status" aria-label="Filter by status"><option value="All">All statuses</option>' +
              Object.keys(DAMAGE_STATUS).map(function (k) {
                return '<option value="' + k + '"' + (filters.damageStatus === k ? ' selected' : '') + '>' + DAMAGE_STATUS[k].label + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<span class="result-count" id="damage-count"></span>' +
        '</div>' +
        '<div class="table-scroll"><table class="data-table">' +
          '<thead><tr><th>Report ID</th><th>Equipment</th><th>Reported By</th><th>Priority</th>' +
          '<th>Date</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>' +
          '<tbody id="damage-body"></tbody>' +
        '</table></div>' +
      '</div>' + borrowerDatalist();
    renderDamageTable();
    refreshIcons();
  }

  function renderDamageTable() {
    var q = filters.damageSearch.trim().toLowerCase();
    var st = filters.damageStatus;
    var list = state.damageReports.filter(function (r) {
      var matches = !q || r.id.toLowerCase().indexOf(q) !== -1 || r.equipmentName.toLowerCase().indexOf(q) !== -1 ||
        r.reportedBy.toLowerCase().indexOf(q) !== -1 || r.description.toLowerCase().indexOf(q) !== -1;
      return matches && (st === 'All' || r.status === st);
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    var body = $('damage-body');
    if (!body) return;
    var count = $('damage-count');
    if (count) count.textContent = list.length + ' of ' + state.damageReports.length + ' reports';

    if (!list.length) {
      body.innerHTML = '<tr><td colspan="7"><div class="table-empty">' +
        emptyState('shield-check', 'No damage reports', 'Create a report or adjust your filters.') + '</div></td></tr>';
      refreshIcons();
      return;
    }

    body.innerHTML = list.map(function (r) {
      var s = DAMAGE_STATUS[r.status] || DAMAGE_STATUS.open;
      var actions = iconBtn('eye', 'view-damage', r.id, 'View report');
      if (r.status === 'open') {
        actions += '<button class="btn btn-sm btn-quiet" data-action="update-damage" data-id="' + esc(r.id) +
          '" data-status="under_repair" title="Mark as Under Repair">Start repair</button>';
      }
      if (r.status === 'open' || r.status === 'under_repair') {
        actions += '<button class="btn btn-sm btn-quiet" data-action="update-damage" data-id="' + esc(r.id) +
          '" data-status="resolved" style="color:var(--success)" title="Mark as Resolved">Resolve</button>';
      }
      return '<tr>' +
        '<td class="mono">' + esc(r.id) + '</td>' +
        '<td class="cell-strong">' + esc(r.equipmentName) + '</td>' +
        '<td>' + esc(r.reportedBy) + '</td>' +
        '<td>' + badge(r.priority, PRIORITY[r.priority] ? PRIORITY[r.priority].tone : 'neutral') + '</td>' +
        '<td>' + esc(fmtDate(r.date)) + '</td>' +
        '<td>' + badge(s.label, s.tone) + '</td>' +
        '<td><div class="row-actions" style="justify-content:flex-end">' + actions + '</div></td>' +
      '</tr>';
    }).join('');
    refreshIcons();
  }

  function openDamageForm() {
    var body =
      '<div class="form-grid">' +
        '<div class="field full"><label>Equipment<span class="req">*</span></label>' +
          '<select name="equipmentId" required>' + equipmentSelect('', false) + '</select></div>' +
        '<div class="field full"><label>Reported By<span class="req">*</span></label>' +
          '<input name="reportedBy" required list="borrowerList" maxlength="60" placeholder="Select or type a name"></div>' +
        '<div class="field full"><label>Issue Description<span class="req">*</span></label>' +
          '<textarea name="description" required maxlength="300" placeholder="Describe the observed issue…"></textarea></div>' +
        '<div class="field full"><label>Priority<span class="req">*</span></label>' +
          '<select name="priority"><option value="Low">Low</option><option value="Medium" selected>Medium</option><option value="High">High</option></select></div>' +
        '<div class="form-note"><i data-lucide="info"></i><span>Submitting a report flags the equipment as damaged and removes it from availability until the issue is resolved.</span></div>' +
      '</div>' + borrowerDatalist();

    openModal({
      title: 'Report Equipment Damage',
      subtitle: 'Create a new maintenance incident.',
      body: body,
      formType: 'add-damage',
      submitLabel: 'Submit report'
    });
  }

  function saveDamage(form) {
    var f = form.elements;
    var equipmentId = f.equipmentId.value;
    var reportedBy = f.reportedBy.value.trim();
    var description = f.description.value.trim();
    var priority = f.priority.value;
    var e = findEquipment(equipmentId);

    if (!e || !reportedBy || !description) { toast('Please complete all required fields.', 'error'); return; }

    state.damageReports.unshift({
      id: uid('DR'), equipmentId: equipmentId, equipmentName: e.name,
      reportedBy: reportedBy, description: description, priority: priority,
      status: 'open', date: todayISO()
    });

    if (e.available > 0) { e.available -= 1; e.damaged += 1; }
    e.condition = 'Damaged';

    addActivity('damage', 'Damage report submitted for ' + e.name);
    addNotification('New damage report: ' + e.name + ' · ' + priority + ' priority', 'damage');
    closeModal();
    commit();
    toast('Damage report submitted and equipment flagged.');
  }

  function updateDamageStatus(id, status) {
    var r = findReport(id);
    if (!r) return;
    if (!DAMAGE_STATUS[status]) return;
    if (status === 'under_repair' && r.status !== 'open') { toast('This report is not open.', 'error'); return; }
    if (status === 'resolved' && r.status === 'resolved') { toast('This report is already resolved.', 'error'); return; }

    r.status = status;
    var e = findEquipment(r.equipmentId);

    if (status === 'resolved' && e) {
      if (e.damaged > 0) { e.damaged -= 1; e.available += 1; }
      e.condition = e.damaged > 0 ? 'Fair' : 'Good';
    }

    addActivity('damage', 'Damage report for ' + r.equipmentName + ' marked ' + DAMAGE_STATUS[status].label.toLowerCase());
    addNotification('Damage report ' + DAMAGE_STATUS[status].label.toLowerCase() + ': ' + r.equipmentName, 'damage');
    commit();
    toast('Report marked as ' + DAMAGE_STATUS[status].label + '.');
  }

  function viewDamage(id) {
    var r = findReport(id);
    if (!r) return;
    var s = DAMAGE_STATUS[r.status] || DAMAGE_STATUS.open;
    openModal({
      title: 'Damage Report',
      subtitle: r.id,
      body: '<div class="detail-grid">' +
          detailItem('Report ID', r.id) + detailItem('Status', s.label) +
          detailItem('Equipment', r.equipmentName) + detailItem('Reported By', r.reportedBy) +
          detailItem('Priority', r.priority) + detailItem('Date', fmtDate(r.date)) +
        '</div>' +
        '<div style="margin-top:16px"><h4 style="margin:0 0 6px;font-size:12px;font-weight:650">Issue Description</h4>' +
          '<p style="margin:0;font-size:12.5px;color:var(--muted);line-height:1.6">' + esc(r.description) + '</p></div>',
      showCancel: false,
      submitLabel: ''
    });
  }

  /* =======================================================================
     12. GLOBAL SEARCH
     ======================================================================= */

  function closeSearchDropdown() {
    var d = $('searchDropdown');
    if (d) d.classList.remove('open');
  }

  function runGlobalSearch(query) {
    var dropdown = $('searchDropdown');
    var q = query.trim().toLowerCase();
    if (!q) { closeSearchDropdown(); return; }

    var results = [];
    state.equipment.forEach(function (e) {
      if (e.name.toLowerCase().indexOf(q) !== -1 || e.id.toLowerCase().indexOf(q) !== -1) {
        results.push({ icon: 'boxes', title: e.name, sub: e.id + ' · ' + e.category, page: 'inventory', id: e.id, kind: 'equipment' });
      }
    });
    state.borrowings.forEach(function (b) {
      if (b.borrowerName.toLowerCase().indexOf(q) !== -1 || b.id.toLowerCase().indexOf(q) !== -1) {
        results.push({ icon: 'arrow-left-right', title: b.borrowerName, sub: b.id + ' · ' + b.equipmentName, page: 'borrowing', id: b.id, kind: 'borrow' });
      }
    });
    state.reservations.forEach(function (r) {
      if (r.borrowerName.toLowerCase().indexOf(q) !== -1 || r.id.toLowerCase().indexOf(q) !== -1) {
        results.push({ icon: 'calendar-days', title: r.borrowerName, sub: r.id + ' · ' + r.equipmentName, page: 'reservations', id: r.id, kind: 'reservation' });
      }
    });

    results = results.slice(0, 7);
    dropdown.innerHTML = results.length
      ? results.map(function (r, i) {
          return '<button class="search-result" data-action="search-result" data-index="' + i + '">' +
            '<i data-lucide="' + r.icon + '"></i><span>' + esc(r.title) + '</span><small>' + esc(r.sub) + '</small></button>';
        }).join('')
      : '<div class="search-empty">No matches for “' + esc(query) + '”</div>';

    dropdown._results = results;
    dropdown.classList.add('open');
    refreshIcons();
  }

  function openSearchResult(index) {
    var results = $('searchDropdown')._results || [];
    var r = results[index];
    if (!r) return;
    closeSearchDropdown();
    $('globalSearchInput').value = '';

    if (r.kind === 'equipment') {
      navigate('inventory');
      filters.inventorySearch = r.title;
      renderInventory();
      viewEquipment(r.id);
    } else if (r.kind === 'borrow') {
      navigate('borrowing');
      filters.borrowSearch = r.id;
      renderBorrowing();
      viewBorrow(r.id);
    } else {
      navigate('reservations');
      filters.reservationSearch = r.id;
      renderReservations();
    }
  }

  /* =======================================================================
     13. EVENT DELEGATION & STARTUP
     ======================================================================= */

  document.addEventListener('click', function (e) {
    var target = e.target.closest('[data-action]');
    if (!target) {
      if (!e.target.closest('#globalSearch')) closeSearchDropdown();
      return;
    }
    var action = target.dataset.action;
    var id = target.dataset.id;

    switch (action) {
      case 'nav': navigate(target.dataset.page); break;
      case 'toggle-sidebar': toggleSidebar(); break;
      case 'collapse-sidebar': toggleSidebar(); break;
      case 'toggle-notifications': toggleNotifications(); break;
      case 'close-notifications': toggleNotifications(false); break;
      case 'mark-read':
        state.notifications.forEach(function (n) { if (n.id === id) n.read = true; });
        Store.save(state); renderNotifications(); break;
      case 'mark-all-read':
        state.notifications.forEach(function (n) { n.read = true; });
        Store.save(state); renderNotifications(); toast('All notifications marked as read.', 'info'); break;
      case 'clear-notifications':
        confirmAction({
          title: 'Clear notifications', heading: 'Clear all notifications?',
          message: 'This removes the entire notification history from your workspace.', confirmText: 'Clear all',
          onConfirm: function () { state.notifications = []; closeModal(); commit(); toast('Notifications cleared.', 'info'); }
        });
        break;

      case 'close-modal': closeModal(); break;
      case 'confirm-yes':
        if (typeof pendingConfirm === 'function') { var fn = pendingConfirm; pendingConfirm = null; fn(); }
        break;

      case 'open-add-equipment': openEquipmentForm(); break;
      case 'edit-equipment': openEquipmentForm(id); break;
      case 'view-equipment': viewEquipment(id); break;
      case 'delete-equipment':
        var del = findEquipment(id);
        if (!del) return;
        confirmAction({
          title: 'Delete equipment', heading: 'Delete "' + del.name + '"?',
          message: 'This removes the asset from the inventory. Related borrowing, reservation and damage records remain for reference.',
          confirmText: 'Delete equipment',
          onConfirm: function () {
            state.equipment = state.equipment.filter(function (x) { return x.id !== id; });
            addActivity('equipment', 'Equipment "' + del.name + '" removed from inventory');
            closeModal(); commit(); toast('Equipment deleted.');
          }
        });
        break;

      case 'open-add-borrow': openBorrowForm(); break;
      case 'view-borrow': viewBorrow(id); break;
      case 'approve-borrow': approveBorrow(id); break;
      case 'reject-borrow': rejectBorrow(id); break;
      case 'open-return': openReturnForm(id); break;

      case 'open-add-reservation': openReservationForm(); break;
      case 'cancel-reservation': cancelReservation(id); break;

      case 'open-add-damage': openDamageForm(); break;
      case 'view-damage': viewDamage(id); break;
      case 'update-damage': updateDamageStatus(id, target.dataset.status); break;

      case 'search-result': openSearchResult(parseInt(target.dataset.index, 10)); break;

      case 'reset-demo':
        confirmAction({
          title: 'Reset demonstration data', heading: 'Reset all data?',
          message: 'All changes will be replaced with the original sample data.',
          confirmText: 'Reset data',
          onConfirm: function () { state = Store.reset(); closeModal(); commit(); toast('Sample data restored.', 'info'); }
        });
        break;
    }
  });

  document.addEventListener('submit', function (e) {
    var form = e.target.closest('#modalForm');
    if (!form) return;
    e.preventDefault();
    if (!form.reportValidity()) return;

    switch (form.dataset.form) {
      case 'add-equipment':
      case 'edit-equipment': saveEquipment(form.dataset.form, form); break;
      case 'add-borrow': saveBorrow(form); break;
      case 'process-return': saveReturn(form); break;
      case 'add-reservation': saveReservation(form); break;
      case 'add-damage': saveDamage(form); break;
    }
  });

  document.addEventListener('input', function (e) {
    var t = e.target;
    switch (t.id) {
      case 'inv-search': filters.inventorySearch = t.value; renderInventoryTable(); break;
      case 'avail-search': filters.availabilitySearch = t.value; renderAvailabilityTable(); break;
      case 'borrow-search': filters.borrowSearch = t.value; renderBorrowingTable(); break;
      case 'return-search': filters.returnSearch = t.value; renderReturnsTable(); break;
      case 'res-search': filters.reservationSearch = t.value; renderReservationsTable(); break;
      case 'damage-search': filters.damageSearch = t.value; renderDamageTable(); break;
      case 'globalSearchInput': runGlobalSearch(t.value); break;
    }
    if (t.name === 'equipmentId' && formContains(t, 'modalForm')) updateBorrowAvailability();
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    switch (t.id) {
      case 'inv-category': filters.inventoryCategory = t.value; renderInventoryTable(); break;
      case 'borrow-status': filters.borrowStatus = t.value; renderBorrowingTable(); break;
      case 'damage-status': filters.damageStatus = t.value; renderDamageTable(); break;
    }
    if (t.name === 'equipmentId' && formContains(t, 'modalForm')) updateBorrowAvailability();
  });

  function formContains(el, formId) {
    return !!(el.closest && el.closest('#' + formId));
  }

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      $('globalSearchInput').focus();
    }
    if (e.key === 'Escape') {
      if ($('modalRoot').innerHTML) closeModal();
      else if ($('notificationPanel').classList.contains('open')) toggleNotifications(false);
      else closeSearchDropdown();
    }
  });

  /* ---------- Boot ---------- */
  // Icons load from a CDN asynchronously; redraw if they arrive after first render.
  window.addEventListener('load', refreshIcons);

  checkOverdue();
  Store.save(state);
  updateNavCount();
  renderNotifications();
  navigate('dashboard');
})();
