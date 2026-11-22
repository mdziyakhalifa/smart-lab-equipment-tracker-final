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
  var currentUser = null;
  var qrStream = null;
  var qrTimer = null;

  var filters = {
    inventorySearch: '',
    inventoryCategory: 'All',
    availabilitySearch: '',
    borrowSearch: '',
    borrowStatus: 'All',
    returnSearch: '',
    reservationSearch: '',
    damageSearch: '',
    damageStatus: 'All',
    consumableSearch: '',
    maintenanceSearch: '',
    calibrationSearch: ''
  };

  var PAGE_META = {
    dashboard:    { title: 'Dashboard',         crumb: 'Dashboard' },
    inventory:    { title: 'Inventory',         crumb: 'Equipment / Inventory' },
    qr:           { title: 'QR Scanner',        crumb: 'Equipment / QR Scanner' },
    availability: { title: 'Availability',      crumb: 'Equipment / Availability' },
    borrowing:    { title: 'Borrowing Records', crumb: 'Transactions / Borrowing Records' },
    returns:      { title: 'Returns',           crumb: 'Transactions / Returns' },
    reservations: { title: 'Reservations',      crumb: 'Transactions / Reservations' },
    damage:       { title: 'Damage Reports',    crumb: 'Operations / Damage Reports' },
    consumables:  { title: 'Consumables',       crumb: 'Equipment / Consumables' },
    maintenance:  { title: 'Maintenance Log',   crumb: 'Maintenance / Maintenance Log' },
    calibration:  { title: 'Calibration',       crumb: 'Maintenance / Calibration' }
  };

  /* =======================================================================
     ROLE-BASED ACCESS (prototype enforcement in the browser)
     Permissions documented in README.md
     ======================================================================= */
  var ALL_PAGES = Object.keys(PAGE_META);

  var ROLE_RULES = {
    'Administrator': { pages: '*', actions: '*' },
    'Lab Assistant': {
      pages: '*',
      actions: ['create-borrow', 'approve', 'process-return', 'create-reservation', 'cancel-reservation',
                'report-damage', 'add-equipment', 'edit-equipment', 'manage-maintenance',
                'manage-calibration', 'manage-consumables', 'update-profile']
    },
    'Faculty': {
      pages: ['dashboard', 'inventory', 'availability', 'borrowing', 'returns', 'reservations',
              'damage', 'consumables', 'maintenance', 'calibration'],
      actions: ['create-borrow', 'approve', 'process-return', 'create-reservation', 'cancel-reservation',
                'report-damage', 'update-profile']
    },
    'Student': {
      pages: ['dashboard', 'inventory', 'availability', 'borrowing', 'returns', 'reservations',
              'damage', 'consumables', 'maintenance', 'calibration'],
      actions: ['create-borrow', 'process-return', 'create-reservation', 'cancel-reservation', 'update-profile']
    }
  };

  var ACTION_PERMISSION = {
    'open-add-equipment': 'add-equipment', 'edit-equipment': 'edit-equipment', 'delete-equipment': 'delete-equipment',
    'open-add-borrow': 'create-borrow', 'approve-borrow': 'approve', 'reject-borrow': 'approve',
    'open-return': 'process-return', 'open-add-reservation': 'create-reservation',
    'cancel-reservation': 'cancel-reservation', 'open-add-damage': 'report-damage',
    'update-damage': 'report-damage', 'open-add-consumable': 'manage-consumables',
    'edit-consumable': 'manage-consumables', 'delete-consumable': 'manage-consumables',
    'use-consumable': 'manage-consumables', 'open-add-maintenance': 'manage-maintenance',
    'complete-maintenance': 'manage-maintenance', 'delete-maintenance': 'manage-maintenance',
    'open-add-calibration': 'manage-calibration', 'mark-calibrated': 'manage-calibration',
    'edit-calibration': 'manage-calibration', 'delete-calibration': 'manage-calibration',
    'show-qr': 'view-equipment', 'qr-scan': 'view-equipment'
  };

  function canPage(page) {
    if (!currentUser) return false;
    var rule = ROLE_RULES[currentUser.role] || ROLE_RULES.Student;
    return rule.pages === '*' ? ALL_PAGES.indexOf(page) !== -1 : rule.pages.indexOf(page) !== -1;
  }

  function can(action) {
    if (!currentUser) return false;
    var rule = ROLE_RULES[currentUser.role] || ROLE_RULES.Student;
    if (rule.actions === '*') return true;
    return rule.actions.indexOf(action) !== -1;
  }

  function applyRolePermissions() {
    document.querySelectorAll('.nav-item[data-page]').forEach(function (el) {
      el.style.display = canPage(el.dataset.page) ? '' : 'none';
    });
    var selectors = {
      '[data-action="open-add-equipment"]': 'add-equipment',
      '[data-action^="edit-equipment"]': 'edit-equipment',
      '[data-action="delete-equipment"]': 'delete-equipment',
      '[data-action="open-add-borrow"]': 'create-borrow',
      '[data-action="approve-borrow"]': 'approve',
      '[data-action="reject-borrow"]': 'approve',
      '[data-action="open-return"]': 'process-return',
      '[data-action="open-add-reservation"]': 'create-reservation',
      '[data-action="open-add-damage"]': 'report-damage',
      '[data-action="update-damage"]': 'report-damage',
      '[data-action="open-add-consumable"]': 'manage-consumables',
      '[data-action="edit-consumable"]': 'manage-consumables',
      '[data-action="delete-consumable"]': 'manage-consumables',
      '[data-action="use-consumable"]': 'manage-consumables',
      '[data-action="open-add-maintenance"]': 'manage-maintenance',
      '[data-action="complete-maintenance"]': 'manage-maintenance',
      '[data-action="delete-maintenance"]': 'manage-maintenance',
      '[data-action="open-add-calibration"]': 'manage-calibration',
      '[data-action="mark-calibrated"]': 'manage-calibration',
      '[data-action="edit-calibration"]': 'manage-calibration',
      '[data-action="delete-calibration"]': 'manage-calibration'
    };
    Object.keys(selectors).forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        el.style.display = can(selectors[sel]) ? '' : 'none';
      });
    });
  }

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

  function maintenanceFor(id) {
    return state.maintenance.filter(function (m) { return m.equipmentId === id; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
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
    applyRolePermissions();
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

  function addDaysISO(iso, days) {
    var d = new Date((iso || todayISO()) + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function daysUntil(iso) {
    if (!iso) return 9999;
    return Math.ceil((new Date(iso + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000);
  }

  function lowStockCount() {
    return state.consumables.filter(function (c) { return c.quantity <= c.reorderLevel; }).length;
  }

  function dueCalibrationCount() {
    return state.calibrations.filter(function (c) { return daysUntil(c.dueDate) <= 14; }).length;
  }

  function dueMaintenanceCount() {
    return state.maintenance.filter(function (m) {
      return m.status !== 'completed' && m.nextDue && daysUntil(m.nextDue) <= 14;
    }).length;
  }

  function addAlert(id, text, type) {
    if (!state.dismissedAlerts) state.dismissedAlerts = [];
    if (state.dismissedAlerts.indexOf(id) !== -1) return;
    if (state.notifications.some(function (n) { return n.id === id; })) return;
    state.notifications.unshift({ id: id, text: text, type: type, read: false, date: todayISO() });
  }

  function removeAlert(id) {
    state.notifications = state.notifications.filter(function (n) { return n.id !== id; });
    if (state.dismissedAlerts) {
      state.dismissedAlerts = state.dismissedAlerts.filter(function (x) { return x !== id; });
    }
  }

  function dismissAllAlerts() {
    if (!state.dismissedAlerts) state.dismissedAlerts = [];
    state.notifications.forEach(function (n) {
      if (state.dismissedAlerts.indexOf(n.id) === -1) state.dismissedAlerts.push(n.id);
    });
  }

  function generateProactiveAlerts() {
    state.consumables.forEach(function (c) {
      if (c.quantity <= c.reorderLevel) addAlert('LOW-' + c.id, 'Low stock: ' + c.name + ' (' + c.quantity + ' ' + c.unit + ' left)', 'consumable');
    });
    state.calibrations.forEach(function (c) {
      if (daysUntil(c.dueDate) <= 14) {
        addAlert('CAL-' + c.id, 'Calibration ' + (daysUntil(c.dueDate) < 0 ? 'overdue' : 'due soon') + ': ' + c.equipmentName, 'calibration');
      }
    });
    state.maintenance.forEach(function (m) {
      if (m.status !== 'completed' && m.nextDue && daysUntil(m.nextDue) <= 14) {
        addAlert('MNT-' + m.id, 'Maintenance due: ' + m.equipmentName, 'maintenance');
      }
    });
  }

  function commit() {
    generateProactiveAlerts();
    Store.save(state);
    updateProfileChip();
    updateNavCount();
    updateBell();
    renderCurrent();
    renderNotifications();
  }

  function updateNavCount() {
    var set = function (id, value) {
      var el = $(id);
      if (!el) return;
      el.textContent = value;
      el.style.display = value ? '' : 'none';
    };
    set('nav-damage-count', state.damageReports.filter(function (r) { return r.status !== 'resolved'; }).length);
    set('nav-consumable-count', lowStockCount());
    set('nav-maintenance-count', dueMaintenanceCount());
    set('nav-calibration-count', dueCalibrationCount());
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
      '<div class="modal-overlay">' +
        '<div class="modal ' + (cfg.size || '') + '" role="dialog" aria-modal="true">' +
          '<div class="modal-head">' +
            '<div><h3>' + esc(cfg.title) + '</h3>' + (cfg.subtitle ? '<p>' + esc(cfg.subtitle) + '</p>' : '') + '</div>' +
            '<button class="icon-btn" data-action="close-modal" aria-label="Close"><i data-lucide="x"></i></button>' +
          '</div>' +
          '<div class="modal-body">' + bodyHtml + '</div>' +
          '<div class="modal-foot">' + footer + '</div>' +
        '</div>' +
      '</div>';
    document.body.classList.add('modal-open');
    refreshIcons();
  }

  function closeModal() {
    stopQRScan();
    $('modalRoot').innerHTML = '';
    document.body.classList.remove('modal-open');
    pendingConfirm = null;
  }

  function stopQRScan() {
    if (qrTimer) { clearInterval(qrTimer); qrTimer = null; }
    if (qrStream) { qrStream.getTracks().forEach(function (t) { t.stop(); }); qrStream = null; }
    ['qrVideo', 'qrPageVideo'].forEach(function (id) {
      var video = $(id);
      if (video) { video.srcObject = null; video.style.display = 'none'; }
    });
    var placeholder = $('scannerPlaceholder');
    if (placeholder) placeholder.style.display = 'flex';
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
    if (type === 'consumable') return 'flask-conical';
    if (type === 'calibration') return 'gauge';
    if (type === 'maintenance') return 'wrench';
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
      return '<div class="notif-item ' + (n.read ? '' : 'unread') + '" data-action="open-notification" data-id="' + esc(n.id) + '" title="Open related module">' +
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
     3b. USER PROFILE
     ======================================================================= */

  function currentAdmin() {
    return state.users.find(function (u) { return u.id === 'U-01'; }) || state.users[0];
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(function (p) { return p.charAt(0); }).join('').toUpperCase();
  }

  function updateProfileChip() {
    var admin = currentUser || currentAdmin();
    if (!admin) return;
    var nameEl = $('profileName');
    var roleEl = $('profileRole');
    var avatarEl = $('profileAvatar');
    if (nameEl) nameEl.textContent = admin.name;
    if (roleEl) roleEl.textContent = admin.role;
    if (avatarEl) avatarEl.textContent = initials(admin.name);
  }

  function openProfile() {
    var admin = currentUser || currentAdmin();
    if (!admin) { toast('Profile record not found.', 'error'); return; }
    openModal({
      title: 'User Profile',
      subtitle: 'Update the details shown in your workspace.',
      formType: 'update-profile',
      submitLabel: 'Save profile',
      body: '<div class="form-grid">' +
          detailItem('Account ID', admin.id) +
          detailItem('Access role', (currentUser && currentUser.role) || admin.role) +
          '<div class="field full"><label>Full Name<span class="req">*</span></label>' +
            '<input name="name" required maxlength="60" value="' + esc(admin.name) + '"></div>' +
          '<div class="field"><label>Role<span class="req">*</span></label>' +
            '<input name="role" required maxlength="40" value="' + esc(admin.role) + '" readonly title="Role is assigned by the administrator"></div>' +
          '<div class="field"><label>Email Address<span class="req">*</span></label>' +
            '<input name="email" type="email" required maxlength="80" value="' + esc(admin.email) + '"></div>' +
          '<div class="form-note"><i data-lucide="info"></i><span>Profile changes are saved in this browser and applied across the workspace immediately.</span></div>' +
          '<div class="field full" style="margin-top:4px;flex-direction:row;gap:8px;flex-wrap:wrap">' +
            '<button type="button" class="btn btn-quiet btn-sm" data-action="reset-demo"><i data-lucide="rotate-ccw"></i> Reset data</button>' +
            '<button type="button" class="btn btn-quiet btn-sm" data-action="logout" style="color:var(--danger);margin-left:auto"><i data-lucide="log-out"></i> Sign out</button>' +
          '</div>' +
        '</div>'
    });
  }

  function saveProfile(form) {
    var admin = currentUser || currentAdmin();
    if (!admin) { toast('Profile record not found.', 'error'); return; }
    var f = form.elements;
    var name = f.name.value.trim();
    var role = f.role.value.trim();
    var email = f.email.value.trim();
    if (!name || !role || !email) { toast('Please complete all profile fields.', 'error'); return; }

    admin.name = name;
    admin.role = role;
    admin.email = email;
    addActivity('equipment', 'Profile updated for ' + name);
    closeModal();
    Store.save(state);
    updateProfileChip();
    commit();
    toast('Profile updated successfully.');
  }

  /* =======================================================================
     4. NAVIGATION
     ======================================================================= */

  function navigate(page) {
    if (!PAGE_META[page]) return;
    if (!canPage(page)) { toast('Your role does not have access to that page.', 'error'); return; }
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
    if (page !== 'qr') stopQRScan();
    renderCurrent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderCurrent() {
    switch (currentPage) {
      case 'dashboard': renderDashboard(); break;
      case 'inventory': renderInventory(); break;
      case 'qr': renderQRPage(); break;
      case 'availability': renderAvailability(); break;
      case 'borrowing': renderBorrowing(); break;
      case 'returns': renderReturns(); break;
      case 'reservations': renderReservations(); break;
      case 'damage': renderDamage(); break;
      case 'consumables': renderConsumables(); break;
      case 'maintenance': renderMaintenance(); break;
      case 'calibration': renderCalibration(); break;
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

    var activityIcon = { borrow: 'arrow-left-right', damage: 'triangle-alert', reservation: 'calendar-days', return: 'package-check', equipment: 'boxes', maintenance: 'wrench', calibration: 'gauge', consumable: 'flask-conical', login: 'log-in' };

    var attentionParts = [];
    if (lowStockCount()) attentionParts.push(lowStockCount() + ' low-stock item' + (lowStockCount() === 1 ? '' : 's'));
    if (dueCalibrationCount()) attentionParts.push(dueCalibrationCount() + ' calibration' + (dueCalibrationCount() === 1 ? '' : 's') + ' due');
    if (dueMaintenanceCount()) attentionParts.push(dueMaintenanceCount() + ' maintenance task' + (dueMaintenanceCount() === 1 ? '' : 's') + ' due');
    if (overdue.length) attentionParts.push(overdue.length + ' overdue return' + (overdue.length === 1 ? '' : 's'));

    var html =
      '<div class="greeting">' +
        '<div><p class="eyebrow">Operations Overview</p>' +
          '<h2 id="greeting-title">Good morning, ' + esc(((currentUser && currentUser.name) || 'Avery').trim().split(/\s+/)[0]) + '</h2>' +
          '<p>Welcome to your laboratory workspace. Here is what needs your attention today.</p>' +
        '</div>' +
        '<div class="greeting-date"><i data-lucide="calendar-days"></i>' +
          new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) +
        '</div>' +
      '</div>' +

      (attentionParts.length ? '<div class="attention-bar" data-action="toggle-notifications">' +
        '<div class="attention-icon"><i data-lucide="bell-ring"></i></div>' +
        '<div><strong>Needs attention</strong><span>' + esc(attentionParts.join(' · ')) + '</span></div>' +
        '<button class="card-link">View alerts <i data-lucide="arrow-up-right"></i></button>' +
      '</div>' : '') +

      '<div class="grid grid-4 mb-18">' +
        statCard('boxes', 'blue', 'Total Equipment', total, eq.length + ' registered items', 'inventory') +
        statCard('circle-check-big', 'green', 'Available', available, total ? Math.round(available / total * 100) + '% of total inventory' : 'No inventory', 'availability') +
        statCard('arrow-left-right', 'amber', 'Borrowed', borrowed, pending.length + ' pending request' + (pending.length === 1 ? '' : 's'), 'borrowing') +
        statCard('triangle-alert', 'red', 'Damaged', damaged, overdue.length + ' overdue item' + (overdue.length === 1 ? '' : 's'), 'damage') +
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

  function statCard(icon, tone, label, value, foot, page) {
    return '<div class="stat" data-action="nav" data-page="' + page + '" title="Open ' + esc(PAGE_META[page].title) + '">' +
      '<div class="stat-top"><div class="stat-icon ' + tone + '"><i data-lucide="' + icon + '"></i></div></div>' +
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
        '<button class="btn" data-action="open-qr"><i data-lucide="scan-line"></i> Identify / QR</button>' +
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
      return '<tr data-action="view-equipment" data-id="' + esc(e.id) + '">' +
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
        '<div class="field"><label>Purchase Date<span class="req">*</span></label>' +
          '<input name="purchaseDate" type="date" required value="' + esc(e ? (e.purchaseDate || e.addedDate || '') : todayISO()) + '"></div>' +
        '<div class="field"><label>Location<span class="req">*</span></label>' +
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
    var purchaseDate = f.purchaseDate.value;

    if (!name || !category || !location || !purchaseDate || !quantity || quantity < 1) {
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
        location: location, condition: condition, purchaseDate: purchaseDate, addedDate: todayISO()
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
      e.name = name; e.category = category; e.location = location; e.purchaseDate = purchaseDate;
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
          detailItem('Purchase date', fmtDate(e.purchaseDate || e.addedDate)) + detailItem('Asset QR', 'Encoded with ' + e.id) +
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
        '</div>' +
        '<div style="margin-top:18px"><h4 style="margin:0 0 10px;font-size:12px;font-weight:650">Maintenance history</h4>' +
          (maintenanceFor(e.id).length ? maintenanceFor(e.id).map(function (m) {
            return '<div class="cl-body" style="padding:7px 0;border-top:1px solid var(--border)"><strong>' + esc(m.type) + ' · ' + fmtDate(m.date) + '</strong>' +
              '<span>' + esc(m.performedBy) + ' · ' + esc(m.notes || 'No notes') + '</span></div>';
          }).join('') : '<p style="font-size:12px;color:var(--muted);margin:0">No maintenance recorded yet.</p>') +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:22px;flex-wrap:wrap">' +
          '<button class="btn btn-primary" data-action="edit-equipment" data-id="' + esc(e.id) + '"><i data-lucide="pencil"></i> Edit equipment</button>' +
          '<button class="btn" data-action="show-qr" data-id="' + esc(e.id) + '"><i data-lucide="qr-code"></i> Show QR</button>' +
          '<button class="btn btn-quiet" data-action="close-modal">Close</button>' +
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
      return '<tr data-action="view-equipment" data-id="' + esc(e.id) + '">' +
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
      return '<tr data-action="view-borrow" data-id="' + esc(b.id) + '">' +
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
    if (e && q) q.max = e.available;
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
        (b.note ? '<div style="margin-top:16px"><h4 style="margin:0 0 6px;font-size:12px;font-weight:650">Purpose</h4><p style="margin:0;font-size:12.5px;color:var(--muted)">' + esc(b.note) + '</p></div>' : '') +
        '<div style="display:flex;gap:8px;margin-top:22px">' +
          (b.status === 'pending'
            ? '<button class="btn btn-primary" data-action="approve-borrow" data-id="' + esc(b.id) + '"><i data-lucide="check"></i> Approve</button>' +
              '<button class="btn btn-quiet" data-action="reject-borrow" data-id="' + esc(b.id) + '" style="color:var(--danger)">Reject</button>'
            : '') +
          (b.status === 'approved'
            ? '<button class="btn btn-primary" data-action="open-return" data-id="' + esc(b.id) + '"><i data-lucide="package-check"></i> Process return</button>'
            : '') +
          '<button class="btn btn-quiet" data-action="close-modal">Close</button>' +
        '</div>',
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
        return '<tr data-action="view-borrow" data-id="' + esc(b.id) + '"><td class="mono">' + esc(b.id) + '</td><td class="cell-strong">' + esc(b.borrowerName) + '</td>' +
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
      return '<tr data-action="open-return" data-id="' + esc(b.id) + '">' +
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
      return '<tr data-action="view-reservation" data-id="' + esc(r.id) + '">' +
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

  function viewReservation(id) {
    var r = state.reservations.find(function (x) { return x.id === id; });
    if (!r) return;
    openModal({
      title: 'Reservation Details',
      subtitle: r.id,
      body: '<div class="detail-grid">' +
          detailItem('Reservation ID', r.id) + detailItem('Status', r.status === 'upcoming' ? 'Upcoming' : 'Cancelled') +
          detailItem('Borrower', r.borrowerName) + detailItem('Equipment', r.equipmentName) +
          detailItem('Date', fmtDate(r.date)) + detailItem('Time', r.startTime + ' – ' + r.endTime) +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:22px">' +
          (r.status === 'upcoming'
            ? '<button class="btn btn-danger" data-action="cancel-reservation" data-id="' + esc(r.id) + '"><i data-lucide="x"></i> Cancel reservation</button>'
            : '') +
          '<button class="btn btn-quiet" data-action="close-modal">Close</button>' +
        '</div>',
      showCancel: false,
      submitLabel: ''
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
      return '<tr data-action="view-damage" data-id="' + esc(r.id) + '">' +
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
          '<p style="margin:0;font-size:12.5px;color:var(--muted);line-height:1.6">' + esc(r.description) + '</p></div>' +
        '<div style="display:flex;gap:8px;margin-top:22px">' +
          (r.status === 'open'
            ? '<button class="btn btn-primary" data-action="update-damage" data-id="' + esc(r.id) + '" data-status="under_repair"><i data-lucide="wrench"></i> Start repair</button>'
            : '') +
          (r.status === 'open' || r.status === 'under_repair'
            ? '<button class="btn btn-quiet" data-action="update-damage" data-id="' + esc(r.id) + '" data-status="resolved" style="color:var(--success)"><i data-lucide="check"></i> Resolve</button>'
            : '') +
          '<button class="btn btn-quiet" data-action="close-modal">Close</button>' +
        '</div>',
      showCancel: false,
      submitLabel: ''
    });
  }

  /* =======================================================================
     11b. QR / BARCODE IDENTIFICATION
     ======================================================================= */

  function renderQRPage() {
    $('render-qr').innerHTML =
      pageHead('Equipment', 'QR Scanner', 'Identify any laboratory asset instantly from its QR code, barcode or asset ID.', '') +
      '<div class="scanner-grid mb-18">' +
        '<div class="card">' +
          '<div class="card-head"><div><h3>Camera scanner</h3><p>Point your camera at an equipment QR code or barcode</p></div></div>' +
          '<div class="card-body">' +
            '<div class="scanner-stage" id="scannerStage">' +
              '<div class="scan-frame"><i></i><i></i></div>' +
              '<video id="qrPageVideo" playsinline muted style="display:none"></video>' +
              '<div class="scanner-placeholder" id="scannerPlaceholder"><i data-lucide="scan-line"></i>' +
                '<strong>Camera is off</strong><span>Start the scanner to read a QR code. Manual ID entry is always available below.</span></div>' +
            '</div>' +
            '<div class="scanner-actions">' +
              '<button class="btn btn-primary" data-action="qr-scan-page"><i data-lucide="camera"></i> Start camera</button>' +
              '<button class="btn" data-action="qr-stop"><i data-lucide="square"></i> Stop scanner</button>' +
            '</div>' +
            '<p class="scanner-status" id="qrPageStatus">Camera scanning works where BarcodeDetector is supported. Manual ID entry works everywhere.</p>' +
          '</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="card-head"><div><h3>Find by asset ID</h3><p>Manual fallback — always available</p></div></div>' +
          '<div class="card-body">' +
            '<p style="font-size:12.5px;color:var(--muted);margin:0">Enter the asset ID printed on the equipment label, for example <strong>EQ-1042</strong>.</p>' +
            '<div class="manual-lookup"><input id="qrPageInput" placeholder="e.g. EQ-1042" aria-label="Asset ID">' +
              '<button class="btn btn-primary" data-action="qr-lookup-page">Find equipment</button></div>' +
            '<div class="scanner-hint"><strong>How identification works</strong>' +
              'Every asset carries a unique QR code that encodes its asset ID. Scanning or entering that ID retrieves the live equipment record, including availability and maintenance history.</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-head"><div><h3>Identified equipment</h3><p>Scanned or entered assets appear here</p></div>' +
          '<button class="btn btn-sm btn-quiet" data-action="qr-clear">Clear</button></div>' +
        '<div class="card-body" id="qr-result">' +
          emptyState('scan-line', 'No asset identified yet', 'Scan a QR code or enter an asset ID to see its details here.') +
        '</div>' +
      '</div>';
    refreshIcons();
  }

  function paintQR(id, holderId) {
    var holder = $(holderId);
    if (!holder) return;
    holder.innerHTML = '<span class="qr-id">' + esc(id) + '</span>';
    if (window.QRCode && typeof window.QRCode.toDataURL === 'function') {
      window.QRCode.toDataURL(id, { width: 300, margin: 1, color: { dark: '#172D46', light: '#FBF7EF' } })
        .then(function (url) {
          var el = $(holderId);
          if (el) el.innerHTML = '<img src="' + url + '" alt="QR code for ' + esc(id) + '">';
        })
        .catch(function () { /* ID fallback stays visible */ });
    }
  }

  function renderQRResult(e) {
    var holder = $('qr-result');
    if (!holder) return;
    var st = availabilityStatus(e);
    holder.innerHTML =
      '<div class="qr-result-head">' +
        '<div class="qr-result-qr" id="qrPageQr"><span class="qr-id">' + esc(e.id) + '</span></div>' +
        '<div><h3>' + esc(e.name) + '</h3><p>' + esc(e.id) + ' · ' + esc(e.category) + ' · ' + esc(e.location) + '</p>' +
        badge(st.label, st.tone) + '</div>' +
      '</div>' +
      '<div class="detail-grid">' +
        detailItem('Total quantity', e.quantity) + detailItem('Available', e.available) +
        detailItem('Borrowed', e.borrowed) + detailItem('Damaged', e.damaged) +
        detailItem('Condition', e.condition) + detailItem('Purchase date', fmtDate(e.purchaseDate || e.addedDate)) +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:18px;flex-wrap:wrap">' +
        '<button class="btn btn-primary" data-action="view-equipment" data-id="' + esc(e.id) + '"><i data-lucide="eye"></i> Full details</button>' +
        '<button class="btn" data-action="show-qr" data-id="' + esc(e.id) + '"><i data-lucide="qr-code"></i> Show QR code</button>' +
      '</div>';
    paintQR(e.id, 'qrPageQr');
    var status = $('qrPageStatus');
    if (status) status.textContent = 'Identified: ' + e.name + ' (' + e.id + ')';
    refreshIcons();
  }

  function openQRModal() {
    openModal({
      title: 'Identify Equipment',
      subtitle: 'QR / barcode with a manual ID fallback',
      body: '<div class="qr-layout">' +
          '<div class="qr-box"><h4>Find by asset ID</h4>' +
            '<p>Enter the ID printed on the equipment label, or scan its QR code with the camera.</p>' +
            '<div class="qr-manual"><input id="qrIdInput" placeholder="e.g. EQ-1042">' +
            '<button class="btn btn-sm btn-primary" data-action="qr-lookup">Find</button></div>' +
          '</div>' +
          '<div class="qr-box"><h4>Camera scanner</h4>' +
            '<video id="qrVideo" class="qr-video" playsinline muted></video>' +
            '<p id="qrStatus">Uses BarcodeDetector where supported. Manual entry always works.</p>' +
            '<button class="btn btn-sm" data-action="qr-scan">Start scanning</button>' +
          '</div>' +
        '</div>',
      showCancel: false,
      submitLabel: ''
    });
  }

  function qrLookup(value) {
    var q = String(value || '').trim().toLowerCase();
    if (!q) { toast('Enter an asset ID first.', 'error'); return false; }
    var e = state.equipment.find(function (x) {
      return x.id.toLowerCase() === q || x.name.toLowerCase() === q;
    });
    if (!e) {
      toast('No equipment found for "' + value + '". Try an ID like EQ-1042.', 'error');
      var pageStatus = $('qrPageStatus');
      if (pageStatus) pageStatus.textContent = 'No match for "' + value + '". Check the ID and try again.';
      return false;
    }
    if (currentPage === 'qr' && $('qr-result')) { renderQRResult(e); return true; }
    closeModal();
    navigate('inventory');
    filters.inventorySearch = e.id;
    renderInventory();
    viewEquipment(e.id);
    return true;
  }

  function showQR(id) {
    var e = findEquipment(id);
    if (!e) return;
    openModal({
      title: 'QR · ' + e.name,
      subtitle: 'Asset identification for ' + e.id,
      body: '<div class="qr-layout">' +
          '<div class="qr-box"><h4>Asset QR code</h4>' +
            '<div class="qr-image" id="qrImage"><span class="qr-id">' + esc(e.id) + '</span></div>' +
            '<p>Scan this code with the Identify tool to open the asset instantly.</p>' +
          '</div>' +
          '<div class="qr-box"><h4>Manual fallback</h4>' +
            '<p class="qr-id">' + esc(e.id) + '</p>' +
            '<p>The QR library is optional. If unavailable, use the asset ID below.</p>' +
            '<div class="qr-manual"><input id="qrIdInput" value="' + esc(e.id) + '" readonly>' +
            '<button class="btn btn-sm btn-primary" data-action="qr-lookup">Find</button></div>' +
          '</div>' +
        '</div>',
      showCancel: false,
      submitLabel: ''
    });
    paintQR(e.id, 'qrImage');
  }

  function startQRScan(videoId, statusId) {
    videoId = videoId || 'qrVideo';
    statusId = statusId || 'qrStatus';
    var status = $(statusId);
    if (!window.BarcodeDetector || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (status) status.textContent = 'Camera scanning is not supported in this browser. Use manual ID entry.';
      toast('Camera scanning unavailable — use the manual asset ID.', 'info');
      return;
    }
    var formats = ['qr_code', 'code_128', 'ean_13'];
    if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
      try { formats = window.BarcodeDetector.getSupportedFormats(); } catch (e) { /* keep defaults */ }
    }
    var detector;
    try { detector = new window.BarcodeDetector({ formats: formats }); }
    catch (e) { toast('Scanner could not start — use manual ID entry.', 'error'); return; }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(function (stream) {
        qrStream = stream;
        var video = $(videoId);
        if (!video) { stopQRScan(); return; }
        video.style.display = 'block';
        var placeholder = $('scannerPlaceholder');
        if (placeholder) placeholder.style.display = 'none';
        video.srcObject = stream;
        video.play();
        if (status) status.textContent = 'Scanning… point the camera at a QR or barcode.';
        qrTimer = setInterval(function () {
          detector.detect(video).then(function (codes) {
            if (codes && codes.length) {
              var value = codes[0].rawValue;
              stopQRScan();
              if (!qrLookup(value) && status) status.textContent = 'Code read: ' + value + ' — no matching asset.';
            }
          }).catch(function () { /* ignore frames without a code */ });
        }, 500);
      })
      .catch(function () {
        if (status) status.textContent = 'Camera permission denied or unavailable. Use manual ID entry.';
        toast('Camera access unavailable — use manual ID entry.', 'error');
      });
  }

  /* =======================================================================
     11c. CONSUMABLES (FR-12)
     ======================================================================= */

  function consumableStatus(c) {
    if (c.quantity <= 0) return { label: 'Out of stock', tone: 'red' };
    if (c.quantity <= c.reorderLevel) return { label: 'Low stock', tone: 'amber' };
    return { label: 'In stock', tone: 'green' };
  }

  function renderConsumables() {
    $('render-consumables').innerHTML =
      pageHead('Equipment', 'Consumables', 'Track consumable stock and surface low-stock alerts automatically.',
        '<button class="btn btn-primary" data-action="open-add-consumable"><i data-lucide="plus"></i> Add Consumable</button>') +
      '<div class="card">' +
        '<div class="table-toolbar">' +
          '<div class="table-tools">' + tableSearch('consumable-search', filters.consumableSearch, 'Search consumables…') + '</div>' +
          '<span class="result-count" id="consumable-count"></span>' +
        '</div>' +
        '<div class="table-scroll"><table class="data-table">' +
          '<thead><tr><th>ID</th><th>Item</th><th>Category</th><th>In Stock</th><th>Reorder At</th>' +
          '<th>Location</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>' +
          '<tbody id="consumable-body"></tbody>' +
        '</table></div>' +
      '</div>';
    renderConsumablesTable();
    refreshIcons();
  }

  function renderConsumablesTable() {
    var q = filters.consumableSearch.trim().toLowerCase();
    var list = state.consumables.filter(function (c) {
      return !q || c.name.toLowerCase().indexOf(q) !== -1 || c.id.toLowerCase().indexOf(q) !== -1 ||
        c.category.toLowerCase().indexOf(q) !== -1;
    });
    var body = $('consumable-body');
    if (!body) return;
    var count = $('consumable-count');
    if (count) count.textContent = list.length + ' of ' + state.consumables.length + ' items · ' + lowStockCount() + ' low stock';
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="8"><div class="table-empty">' +
        emptyState('flask-conical', 'No consumables found', 'Add a consumable or adjust your search.') + '</div></td></tr>';
      refreshIcons();
      return;
    }
    body.innerHTML = list.map(function (c) {
      var st = consumableStatus(c);
      return '<tr>' +
        '<td class="mono">' + esc(c.id) + '</td>' +
        '<td><span class="cell-strong">' + esc(c.name) + '</span><span class="cell-sub">' + esc(c.unit) + '</span></td>' +
        '<td>' + esc(c.category) + '</td>' +
        '<td class="num">' + c.quantity + '</td>' +
        '<td class="num">' + c.reorderLevel + '</td>' +
        '<td>' + esc(c.location) + '</td>' +
        '<td>' + badge(st.label, st.tone) + '</td>' +
        '<td><div class="row-actions" style="justify-content:flex-end">' +
          iconBtn('minus', 'use-consumable', c.id, 'Record usage') +
          iconBtn('pencil', 'edit-consumable', c.id, 'Edit consumable') +
          iconBtn('trash-2', 'delete-consumable', c.id, 'Delete consumable', true) +
        '</div></td>' +
      '</tr>';
    }).join('');
    refreshIcons();
  }

  function openConsumableForm(id) {
    var c = id ? state.consumables.find(function (x) { return x.id === id; }) : null;
    openModal({
      title: c ? 'Edit Consumable' : 'Add Consumable',
      subtitle: c ? 'Update stock information for ' + c.name : 'Register a consumable item and its reorder level.',
      formType: c ? 'edit-consumable' : 'add-consumable',
      submitLabel: c ? 'Save changes' : 'Add consumable',
      body: '<div class="form-grid">' +
          '<div class="field full"><label>Item Name<span class="req">*</span></label>' +
            '<input name="name" required maxlength="80" value="' + esc(c ? c.name : '') + '" placeholder="e.g. Centrifuge Tubes"></div>' +
          '<div class="field"><label>Category<span class="req">*</span></label>' +
            '<input name="category" required maxlength="40" value="' + esc(c ? c.category : 'Lab Supplies') + '"></div>' +
          '<div class="field"><label>Unit<span class="req">*</span></label>' +
            '<input name="unit" required maxlength="20" value="' + esc(c ? c.unit : 'pcs') + '"></div>' +
          '<div class="field"><label>Quantity in Stock<span class="req">*</span></label>' +
            '<input name="quantity" type="number" required min="0" value="' + (c ? c.quantity : 0) + '"></div>' +
          '<div class="field"><label>Reorder Level<span class="req">*</span></label>' +
            '<input name="reorderLevel" type="number" required min="0" value="' + (c ? c.reorderLevel : 10) + '"></div>' +
          '<div class="field full"><label>Location<span class="req">*</span></label>' +
            '<input name="location" required maxlength="80" value="' + esc(c ? c.location : '') + '"></div>' +
          '<div class="form-note"><i data-lucide="info"></i><span>A low-stock alert is raised automatically when quantity falls to or below the reorder level.</span></div>' +
        '</div>'
    });
    $('modalRoot').dataset.consumableId = id || '';
  }

  function saveConsumable(form) {
    var f = form.elements;
    var name = f.name.value.trim(), category = f.category.value.trim(), unit = f.unit.value.trim();
    var quantity = parseInt(f.quantity.value, 10), reorderLevel = parseInt(f.reorderLevel.value, 10);
    var location = f.location.value.trim();
    if (!name || !category || !unit || !location || isNaN(quantity) || isNaN(reorderLevel)) {
      toast('Please complete all required fields.', 'error'); return;
    }
    var id = $('modalRoot').dataset.consumableId;
    if (id) {
      var c = state.consumables.find(function (x) { return x.id === id; });
      if (!c) { toast('Consumable not found.', 'error'); return; }
      c.name = name; c.category = category; c.unit = unit; c.quantity = quantity;
      c.reorderLevel = reorderLevel; c.location = location;
      if (quantity > reorderLevel) removeAlert('LOW-' + id);
      addActivity('equipment', 'Consumable "' + name + '" updated');
      toast('Consumable updated.');
    } else {
      var nid = uid('CS');
      state.consumables.unshift({ id: nid, name: name, category: category, quantity: quantity, unit: unit, reorderLevel: reorderLevel, location: location });
      addActivity('equipment', 'Consumable "' + name + '" added');
      toast('Consumable added · ' + nid);
    }
    closeModal(); commit();
  }

  function deleteConsumable(id) {
    var c = state.consumables.find(function (x) { return x.id === id; });
    if (!c) return;
    confirmAction({
      title: 'Delete consumable', heading: 'Delete "' + c.name + '"?',
      message: 'The item and its stock record will be removed from the workspace.', confirmText: 'Delete',
      onConfirm: function () {
        state.consumables = state.consumables.filter(function (x) { return x.id !== id; });
        removeAlert('LOW-' + id);
        addActivity('equipment', 'Consumable "' + c.name + '" removed');
        closeModal(); commit(); toast('Consumable deleted.');
      }
    });
  }

  function openUseConsumable(id) {
    var c = state.consumables.find(function (x) { return x.id === id; });
    if (!c) return;
    openModal({
      title: 'Record Usage', subtitle: c.name + ' · ' + c.quantity + ' ' + c.unit + ' in stock',
      formType: 'use-consumable',
      submitLabel: 'Record usage',
      body: '<div class="form-grid"><div class="field full">' +
          '<label>Quantity used<span class="req">*</span></label>' +
          '<input name="amount" type="number" required min="1" max="' + c.quantity + '" value="1">' +
          '<span class="field-hint">Current stock: ' + c.quantity + ' ' + esc(c.unit) + '</span>' +
        '</div></div>'
    });
    $('modalRoot').dataset.useId = id;
  }

  function saveUseConsumable(form) {
    var id = $('modalRoot').dataset.useId;
    var c = state.consumables.find(function (x) { return x.id === id; });
    var amount = parseInt(form.elements.amount.value, 10);
    if (!c) { toast('Consumable not found.', 'error'); return; }
    if (!amount || amount < 1 || amount > c.quantity) { toast('Enter a valid quantity within current stock.', 'error'); return; }
    c.quantity -= amount;
    addActivity('equipment', amount + ' ' + c.unit + ' of ' + c.name + ' used');
    closeModal(); commit();
    toast(consumableStatus(c).tone === 'green' ? 'Usage recorded.' : 'Usage recorded — stock is now low.');
  }

  /* =======================================================================
     11d. MAINTENANCE HISTORY (FR-10)
     ======================================================================= */

  function renderMaintenance() {
    $('render-maintenance').innerHTML =
      pageHead('Maintenance', 'Maintenance Log', 'Keep a preventive maintenance and repair history for laboratory equipment.',
        '<button class="btn btn-primary" data-action="open-add-maintenance"><i data-lucide="plus"></i> Add Record</button>') +
      '<div class="card">' +
        '<div class="table-toolbar">' +
          '<div class="table-tools">' + tableSearch('maintenance-search', filters.maintenanceSearch, 'Search maintenance records…') + '</div>' +
          '<span class="result-count" id="maintenance-count"></span>' +
        '</div>' +
        '<div class="table-scroll"><table class="data-table">' +
          '<thead><tr><th>ID</th><th>Equipment</th><th>Type</th><th>Date</th><th>Performed By</th>' +
          '<th>Next Due</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>' +
          '<tbody id="maintenance-body"></tbody>' +
        '</table></div>' +
      '</div>';
    renderMaintenanceTable();
    refreshIcons();
  }

  function renderMaintenanceTable() {
    var q = filters.maintenanceSearch.trim().toLowerCase();
    var list = state.maintenance.filter(function (m) {
      return !q || m.id.toLowerCase().indexOf(q) !== -1 || m.equipmentName.toLowerCase().indexOf(q) !== -1 ||
        m.type.toLowerCase().indexOf(q) !== -1 || m.performedBy.toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var body = $('maintenance-body');
    if (!body) return;
    var count = $('maintenance-count');
    if (count) count.textContent = list.length + ' records';
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="8"><div class="table-empty">' +
        emptyState('wrench', 'No maintenance records', 'Add a record to start a maintenance history.') + '</div></td></tr>';
      refreshIcons(); return;
    }
    body.innerHTML = list.map(function (m) {
      var due = m.status !== 'completed' && m.nextDue && daysUntil(m.nextDue) <= 14;
      var tone = m.status === 'completed' ? 'green' : (m.status === 'in_progress' ? 'blue' : (due ? 'amber' : 'neutral'));
      var label = m.status === 'completed' ? 'Completed' : (m.status === 'in_progress' ? 'In progress' : (due ? 'Due soon' : 'Scheduled'));
      return '<tr>' +
        '<td class="mono">' + esc(m.id) + '</td>' +
        '<td class="cell-strong">' + esc(m.equipmentName) + '</td>' +
        '<td>' + esc(m.type) + '</td>' +
        '<td>' + esc(fmtDate(m.date)) + '</td>' +
        '<td>' + esc(m.performedBy) + '</td>' +
        '<td>' + (m.nextDue ? esc(fmtDate(m.nextDue)) : '—') + '</td>' +
        '<td>' + badge(label, tone) + '</td>' +
        '<td><div class="row-actions" style="justify-content:flex-end">' +
          (m.status !== 'completed' ? '<button class="btn btn-sm btn-quiet" data-action="complete-maintenance" data-id="' + esc(m.id) + '" style="color:var(--success)">Complete</button>' : '') +
          iconBtn('trash-2', 'delete-maintenance', m.id, 'Delete record', true) +
        '</div></td>' +
      '</tr>';
    }).join('');
    refreshIcons();
  }

  function openMaintenanceForm() {
    openModal({
      title: 'Add Maintenance Record', subtitle: 'Log a service, repair or calibration task.',
      formType: 'add-maintenance', submitLabel: 'Save record',
      body: '<div class="form-grid">' +
          '<div class="field full"><label>Equipment<span class="req">*</span></label><select name="equipmentId" required>' + equipmentSelect('', false) + '</select></div>' +
          '<div class="field"><label>Type<span class="req">*</span></label><select name="type"><option>Preventive</option><option>Repair</option><option>Calibration</option></select></div>' +
          '<div class="field"><label>Date<span class="req">*</span></label><input name="date" type="date" required value="' + todayISO() + '"></div>' +
          '<div class="field"><label>Performed By<span class="req">*</span></label><input name="performedBy" required maxlength="60" list="borrowerList" value="' + esc((currentUser && currentUser.name) || '') + '"></div>' +
          '<div class="field"><label>Next Due Date</label><input name="nextDue" type="date"></div>' +
          '<div class="field full"><label>Notes</label><textarea name="notes" maxlength="250" placeholder="What was checked or repaired?"></textarea></div>' +
          '<div class="form-note"><i data-lucide="info"></i><span>A reminder alert is generated when the next due date is within 14 days.</span></div>' +
        '</div>' + borrowerDatalist()
    });
  }

  function saveMaintenance(form) {
    var f = form.elements;
    var e = findEquipment(f.equipmentId.value);
    if (!e || !f.performedBy.value.trim() || !f.date.value) { toast('Please complete all required fields.', 'error'); return; }
    var id = uid('MT');
    state.maintenance.unshift({
      id: id, equipmentId: e.id, equipmentName: e.name, type: f.type.value, date: f.date.value,
      performedBy: f.performedBy.value.trim(), notes: f.notes.value.trim(), nextDue: f.nextDue.value, status: f.nextDue.value ? 'due' : 'completed'
    });
    addActivity('maintenance', f.type.value + ' maintenance logged for ' + e.name);
    addNotification('Maintenance logged for ' + e.name, 'maintenance');
    closeModal(); commit(); toast('Maintenance record added.');
  }

  function completeMaintenance(id) {
    var m = state.maintenance.find(function (x) { return x.id === id; });
    if (!m || m.status === 'completed') { toast('This task is already completed.', 'error'); return; }
    m.status = 'completed';
    removeAlert('MNT-' + id);
    addActivity('maintenance', 'Maintenance completed for ' + m.equipmentName);
    addNotification('Maintenance completed: ' + m.equipmentName, 'maintenance');
    commit(); toast('Maintenance marked complete.');
  }

  function deleteMaintenance(id) {
    var m = state.maintenance.find(function (x) { return x.id === id; });
    if (!m) return;
    confirmAction({
      title: 'Delete record', heading: 'Delete this maintenance record?',
      message: 'The record for ' + m.equipmentName + ' will be removed from the history.', confirmText: 'Delete',
      onConfirm: function () {
        state.maintenance = state.maintenance.filter(function (x) { return x.id !== id; });
        removeAlert('MNT-' + id);
        closeModal(); commit(); toast('Maintenance record deleted.');
      }
    });
  }

  /* =======================================================================
     11e. CALIBRATION SCHEDULES (FR-10 / FR-11)
     ======================================================================= */

  function renderCalibration() {
    $('render-calibration').innerHTML =
      pageHead('Maintenance', 'Calibration', 'Monitor calibration schedules and receive due-date alerts.',
        '<button class="btn btn-primary" data-action="open-add-calibration"><i data-lucide="plus"></i> Add Schedule</button>') +
      '<div class="card">' +
        '<div class="table-toolbar">' +
          '<div class="table-tools">' + tableSearch('calibration-search', filters.calibrationSearch, 'Search calibration schedules…') + '</div>' +
          '<span class="result-count" id="calibration-count"></span>' +
        '</div>' +
        '<div class="table-scroll"><table class="data-table">' +
          '<thead><tr><th>ID</th><th>Equipment</th><th>Last Calibrated</th><th>Due Date</th><th>Interval</th>' +
          '<th>Status</th><th style="text-align:right">Actions</th></tr></thead>' +
          '<tbody id="calibration-body"></tbody>' +
        '</table></div>' +
      '</div>';
    renderCalibrationTable();
    refreshIcons();
  }

  function renderCalibrationTable() {
    var q = filters.calibrationSearch.trim().toLowerCase();
    var list = state.calibrations.filter(function (c) {
      return !q || c.id.toLowerCase().indexOf(q) !== -1 || c.equipmentName.toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; });
    var body = $('calibration-body');
    if (!body) return;
    var count = $('calibration-count');
    if (count) count.textContent = list.length + ' schedules · ' + dueCalibrationCount() + ' due soon';
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="7"><div class="table-empty">' +
        emptyState('gauge', 'No calibration schedules', 'Add a schedule to start monitoring due dates.') + '</div></td></tr>';
      refreshIcons(); return;
    }
    body.innerHTML = list.map(function (c) {
      var left = daysUntil(c.dueDate);
      var tone = left < 0 ? 'red' : (left <= 14 ? 'amber' : 'green');
      var label = left < 0 ? 'Overdue' : (left <= 14 ? 'Due soon' : 'OK');
      return '<tr>' +
        '<td class="mono">' + esc(c.id) + '</td>' +
        '<td class="cell-strong">' + esc(c.equipmentName) + '</td>' +
        '<td>' + esc(fmtDate(c.lastDate)) + '</td>' +
        '<td>' + esc(fmtDate(c.dueDate)) + '</td>' +
        '<td>' + c.intervalDays + ' days</td>' +
        '<td>' + badge(label, tone) + '</td>' +
        '<td><div class="row-actions" style="justify-content:flex-end">' +
          '<button class="btn btn-sm btn-quiet" data-action="mark-calibrated" data-id="' + esc(c.id) + '" style="color:var(--success)">Mark calibrated</button>' +
          iconBtn('pencil', 'edit-calibration', c.id, 'Edit schedule') +
          iconBtn('trash-2', 'delete-calibration', c.id, 'Delete schedule', true) +
        '</div></td>' +
      '</tr>';
    }).join('');
    refreshIcons();
  }

  function openCalibrationForm(id) {
    var c = id ? state.calibrations.find(function (x) { return x.id === id; }) : null;
    openModal({
      title: c ? 'Edit Calibration Schedule' : 'Add Calibration Schedule',
      subtitle: c ? 'Update the schedule for ' + c.equipmentName : 'Define a recurring calibration interval.',
      formType: c ? 'edit-calibration' : 'add-calibration', submitLabel: c ? 'Save changes' : 'Add schedule',
      body: '<div class="form-grid">' +
          '<div class="field full"><label>Equipment<span class="req">*</span></label><select name="equipmentId" required>' + equipmentSelect(c ? c.equipmentId : '', false) + '</select></div>' +
          '<div class="field"><label>Last Calibrated<span class="req">*</span></label><input name="lastDate" type="date" required value="' + esc(c ? c.lastDate : todayISO()) + '"></div>' +
          '<div class="field"><label>Due Date<span class="req">*</span></label><input name="dueDate" type="date" required value="' + esc(c ? c.dueDate : addDaysISO(todayISO(), 90)) + '"></div>' +
          '<div class="field full"><label>Interval (days)<span class="req">*</span></label><input name="intervalDays" type="number" required min="1" value="' + (c ? c.intervalDays : 90) + '"></div>' +
          '<div class="field full"><label>Notes</label><textarea name="notes" maxlength="250">' + esc(c ? c.notes : '') + '</textarea></div>' +
          '<div class="form-note"><i data-lucide="info"></i><span>Calibration alerts appear 14 days before the due date and stay until the item is marked calibrated.</span></div>' +
        '</div>'
    });
    $('modalRoot').dataset.calibrationId = id || '';
  }

  function saveCalibration(form) {
    var f = form.elements;
    var e = findEquipment(f.equipmentId.value);
    var interval = parseInt(f.intervalDays.value, 10);
    if (!e || !f.lastDate.value || !f.dueDate.value || !interval || interval < 1) {
      toast('Please complete all required fields.', 'error'); return;
    }
    if (f.dueDate.value < f.lastDate.value) { toast('Due date must be after the last calibration date.', 'error'); return; }
    var id = $('modalRoot').dataset.calibrationId;
    if (id) {
      var c = state.calibrations.find(function (x) { return x.id === id; });
      if (!c) { toast('Schedule not found.', 'error'); return; }
      c.equipmentId = e.id; c.equipmentName = e.name; c.lastDate = f.lastDate.value;
      c.dueDate = f.dueDate.value; c.intervalDays = interval; c.notes = f.notes.value.trim();
      if (daysUntil(c.dueDate) > 14) removeAlert('CAL-' + id);
      toast('Calibration schedule updated.');
    } else {
      var nid = uid('CB');
      state.calibrations.unshift({
        id: nid, equipmentId: e.id, equipmentName: e.name, lastDate: f.lastDate.value,
        dueDate: f.dueDate.value, intervalDays: interval, notes: f.notes.value.trim(), status: 'ok'
      });
      toast('Calibration schedule added · ' + nid);
    }
    addActivity('calibration', 'Calibration schedule saved for ' + e.name);
    closeModal(); commit();
  }

  function markCalibrated(id) {
    var c = state.calibrations.find(function (x) { return x.id === id; });
    if (!c) return;
    c.lastDate = todayISO();
    c.dueDate = addDaysISO(todayISO(), c.intervalDays);
    c.status = 'ok';
    removeAlert('CAL-' + id);
    addActivity('calibration', 'Calibration completed for ' + c.equipmentName);
    addNotification('Calibration completed: ' + c.equipmentName, 'calibration');
    commit(); toast('Calibration recorded · next due ' + fmtDate(c.dueDate));
  }

  function deleteCalibration(id) {
    var c = state.calibrations.find(function (x) { return x.id === id; });
    if (!c) return;
    confirmAction({
      title: 'Delete schedule', heading: 'Delete this calibration schedule?',
      message: 'The schedule for ' + c.equipmentName + ' will be removed.', confirmText: 'Delete',
      onConfirm: function () {
        state.calibrations = state.calibrations.filter(function (x) { return x.id !== id; });
        removeAlert('CAL-' + id);
        closeModal(); commit(); toast('Calibration schedule deleted.');
      }
    });
  }

  /* =======================================================================
     11f. AUTHENTICATION (FR-01)
     ======================================================================= */

  function showLogin() { $('loginScreen').classList.remove('hidden'); }
  function hideLogin() { $('loginScreen').classList.add('hidden'); }

  function authenticate(identifier, password) {
    var q = String(identifier || '').trim().toLowerCase();
    return state.users.find(function (u) {
      return (u.email.toLowerCase() === q || u.name.toLowerCase() === q || u.id.toLowerCase() === q) && u.password === password;
    }) || null;
  }

  function signIn(user) {
    currentUser = user;
    Store.setSession(user.id);
    hideLogin();
    $('loginError').textContent = '';
    addActivity('login', user.name + ' signed in as ' + user.role);
    generateProactiveAlerts();
    Store.save(state);
    updateProfileChip();
    updateNavCount();
    renderNotifications();
    navigate('dashboard');
    refreshIcons();
    toast('Welcome back, ' + user.name.split(' ')[0] + ' · ' + user.role);
  }

  function doLogout() {
    Store.setSession(null);
    currentUser = null;
    closeModal();
    toggleNotifications(false);
    showLogin();
    $('loginUser').value = '';
    $('loginPass').value = '';
  }

  function startApp() {
    generateProactiveAlerts();
    Store.save(state);
    updateProfileChip();
    updateNavCount();
    renderNotifications();
    navigate('dashboard');
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
    // Clicking the dark area outside a modal closes it. Only the overlay itself
    // triggers this — never a child such as the form's Submit button.
    if (e.target.classList && e.target.classList.contains('modal-overlay')) {
      closeModal();
      return;
    }
    var target = e.target.closest('[data-action]');
    if (!target) {
      if (!e.target.closest('#globalSearch')) closeSearchDropdown();
      return;
    }
    var action = target.dataset.action;
    var id = target.dataset.id;

    // Server-side enforcement is impossible in a browser-only prototype;
    // block unauthorised actions in the UI and in this central dispatcher.
    var required = ACTION_PERMISSION[action];
    if (required && !can(required)) { toast('Your role does not permit this action.', 'error'); return; }

    switch (action) {
      case 'nav': navigate(target.dataset.page); break;
      case 'toggle-sidebar': toggleSidebar(); break;
      case 'collapse-sidebar': toggleSidebar(); break;
      case 'toggle-notifications': toggleNotifications(); break;
      case 'open-profile': openProfile(); break;
      case 'close-notifications': toggleNotifications(false); break;
      case 'open-notification':
        var note = state.notifications.find(function (n) { return n.id === id; });
        if (!note) return;
        note.read = true;
        Store.save(state);
        toggleNotifications(false);
        renderNotifications();
        var notePage = { borrow: 'borrowing', approve: 'borrowing', damage: 'damage',
                         reservation: 'reservations', return: 'returns', overdue: 'returns',
                         consumable: 'consumables', calibration: 'calibration', maintenance: 'maintenance' }[note.type] || 'dashboard';
        navigate(notePage);
        break;
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
          onConfirm: function () { dismissAllAlerts(); state.notifications = []; closeModal(); commit(); toast('Notifications cleared.', 'info'); }
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
      case 'view-reservation': viewReservation(id); break;
      case 'cancel-reservation': cancelReservation(id); break;

      case 'open-add-damage': openDamageForm(); break;
      case 'view-damage': viewDamage(id); break;
      case 'update-damage': updateDamageStatus(id, target.dataset.status); break;

      case 'open-qr': openQRModal(); break;
      case 'qr-lookup': qrLookup(($('qrIdInput') || {}).value); break;
      case 'qr-scan': startQRScan(); break;
      case 'qr-scan-page': stopQRScan(); startQRScan('qrPageVideo', 'qrPageStatus'); break;
      case 'qr-stop':
        stopQRScan();
        if ($('qrPageStatus')) $('qrPageStatus').textContent = 'Scanner stopped. You can still find equipment by ID.';
        break;
      case 'qr-lookup-page': qrLookup(($('qrPageInput') || {}).value); break;
      case 'qr-clear':
        if ($('qrPageInput')) $('qrPageInput').value = '';
        if ($('qr-result')) $('qr-result').innerHTML = emptyState('scan-line', 'No asset identified yet', 'Scan a QR code or enter an asset ID to see its details here.');
        if ($('qrPageStatus')) $('qrPageStatus').textContent = 'Camera scanning works where BarcodeDetector is supported. Manual ID entry works everywhere.';
        refreshIcons();
        break;
      case 'show-qr': showQR(id); break;

      case 'open-add-consumable': openConsumableForm(); break;
      case 'edit-consumable': openConsumableForm(id); break;
      case 'delete-consumable': deleteConsumable(id); break;
      case 'use-consumable': openUseConsumable(id); break;

      case 'open-add-maintenance': openMaintenanceForm(); break;
      case 'complete-maintenance': completeMaintenance(id); break;
      case 'delete-maintenance': deleteMaintenance(id); break;

      case 'open-add-calibration': openCalibrationForm(); break;
      case 'edit-calibration': openCalibrationForm(id); break;
      case 'mark-calibrated': markCalibrated(id); break;
      case 'delete-calibration': deleteCalibration(id); break;

      case 'demo-login':
        // Resolve live account data so the shortcuts still work after a
        // profile edit or a data upgrade from an older version.
        var demoUser = state.users.find(function (u) { return u.role === target.dataset.role; }) ||
          state.users.find(function (u) { return u.email === target.dataset.user; });
        $('loginUser').value = demoUser ? demoUser.email : target.dataset.user;
        $('loginPass').value = demoUser ? (demoUser.password || target.dataset.pass) : target.dataset.pass;
        $('loginError').textContent = '';
        break;
      case 'logout': doLogout(); break;

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
      case 'update-profile': saveProfile(form); break;
      case 'add-consumable':
      case 'edit-consumable': saveConsumable(form); break;
      case 'use-consumable': saveUseConsumable(form); break;
      case 'add-maintenance': saveMaintenance(form); break;
      case 'add-calibration':
      case 'edit-calibration': saveCalibration(form); break;
    }
  });

  document.addEventListener('submit', function (e) {
    if (!e.target.closest('#loginForm')) return;
    e.preventDefault();
    var user = authenticate($('loginUser').value, $('loginPass').value);
    if (!user) {
      $('loginError').textContent = 'Invalid email or password. Use a demo account below.';
      toast('Sign-in failed. Check your credentials.', 'error');
      return;
    }
    signIn(user);
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
      case 'consumable-search': filters.consumableSearch = t.value; renderConsumablesTable(); break;
      case 'maintenance-search': filters.maintenanceSearch = t.value; renderMaintenanceTable(); break;
      case 'calibration-search': filters.calibrationSearch = t.value; renderCalibrationTable(); break;
      case 'globalSearchInput': runGlobalSearch(t.value); break;
    }
    if (t.name === 'equipmentId' && isBorrowForm(t)) updateBorrowAvailability();
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    switch (t.id) {
      case 'inv-category': filters.inventoryCategory = t.value; renderInventoryTable(); break;
      case 'borrow-status': filters.borrowStatus = t.value; renderBorrowingTable(); break;
      case 'damage-status': filters.damageStatus = t.value; renderDamageTable(); break;
    }
    if (t.name === 'equipmentId' && isBorrowForm(t)) updateBorrowAvailability();
  });

  function isBorrowForm(el) {
    var form = el.closest && el.closest('#modalForm');
    return !!(form && form.dataset.form === 'add-borrow');
  }

  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute && e.target.getAttribute('role') === 'button') {
      e.preventDefault();
      e.target.click();
      return;
    }
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
  console.log('Smart Lab Equipment Tracker v2.1 loaded');
  // Icons/QR libraries load from CDNs asynchronously; redraw if they arrive later.
  window.addEventListener('load', refreshIcons);

  checkOverdue();
  generateProactiveAlerts();
  Store.save(state);
  updateNavCount();
  updateProfileChip();
  renderNotifications();

  var session = Store.getSession();
  currentUser = session ? state.users.find(function (u) { return u.id === session.userId; }) : null;
  if (currentUser) {
    hideLogin();
    startApp();
  } else {
    showLogin();
    applyRolePermissions();
  }
})();
