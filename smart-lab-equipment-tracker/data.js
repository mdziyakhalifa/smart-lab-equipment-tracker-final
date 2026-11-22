/* =========================================================================
   data.js — storage layer + first-visit demonstration data
   All persistence is handled through browser localStorage.
   Prototype note: credentials are stored locally for demonstration only.
   ========================================================================= */

(function (global) {
  'use strict';

  var STORAGE_KEY = 'smartlab_tracker_v1';
  var SESSION_KEY = 'smartlab_session_v1';

  /* Demo credentials are shared by the seed data and the migration step so
     they keep working for browsers that saved data with an older version. */
  var DEMO_ACCOUNTS = {
    'U-01': { email: 'avery.morgan@smartlab.edu', password: 'admin123' },
    'U-02': { email: 'sarah.mitchell@smartlab.edu', password: 'faculty123' },
    'U-03': { email: 'daniel.carter@smartlab.edu', password: 'faculty123' },
    'U-04': { email: 'emily.wong@smartlab.edu', password: 'student123' },
    'U-05': { email: 'michael.reyes@smartlab.edu', password: 'assistant123' }
  };

  /* ---------- Reusable sample data factory ---------- */
  function buildSeed() {
    return {
      equipment: [
        { id: 'EQ-1042', name: 'Digital Oscilloscope', category: 'Electronics', quantity: 6, available: 4, borrowed: 2, damaged: 0, location: 'Lab A · Room 201', condition: 'Good', purchaseDate: '2025-08-14', addedDate: '2026-09-14' },
        { id: 'EQ-1043', name: 'Digital Multimeter', category: 'Electronics', quantity: 10, available: 7, borrowed: 3, damaged: 0, location: 'Lab A · Room 201', condition: 'Good', purchaseDate: '2025-08-14', addedDate: '2026-09-14' },
        { id: 'EQ-1044', name: 'Laboratory Centrifuge', category: 'Lab Equipment', quantity: 4, available: 3, borrowed: 1, damaged: 0, location: 'Lab B · Room 105', condition: 'Good', purchaseDate: '2025-09-02', addedDate: '2026-09-20' },
        { id: 'EQ-1045', name: 'Thermal Imaging Camera', category: 'Imaging', quantity: 3, available: 2, borrowed: 1, damaged: 0, location: 'Lab C · Room 302', condition: 'Good', purchaseDate: '2026-01-22', addedDate: '2026-10-02' },
        { id: 'EQ-1046', name: 'Benchtop pH Meter', category: 'Chemistry', quantity: 5, available: 5, borrowed: 0, damaged: 0, location: 'Lab B · Room 110', condition: 'Good', purchaseDate: '2026-02-11', addedDate: '2026-10-08' },
        { id: 'EQ-1047', name: 'Microscope', category: 'Optics', quantity: 8, available: 6, borrowed: 1, damaged: 1, location: 'Lab C · Room 301', condition: 'Fair', purchaseDate: '2025-11-30', addedDate: '2026-10-11' },
        { id: 'EQ-1048', name: 'Function Generator', category: 'Electronics', quantity: 5, available: 5, borrowed: 0, damaged: 0, location: 'Lab A · Room 202', condition: 'Good', purchaseDate: '2026-06-03', addedDate: '2026-11-03' },
        { id: 'EQ-1049', name: 'Electronic Weighing Balance', category: 'Chemistry', quantity: 6, available: 4, borrowed: 2, damaged: 0, location: 'Lab B · Room 108', condition: 'Fair', purchaseDate: '2025-07-19', addedDate: '2026-11-05' }
      ],

      users: [
        { id: 'U-01', name: 'Avery Morgan', role: 'Administrator', email: 'avery.morgan@smartlab.edu', password: 'admin123' },
        { id: 'U-02', name: 'Sarah Mitchell', role: 'Faculty', email: 'sarah.mitchell@smartlab.edu', password: 'faculty123' },
        { id: 'U-03', name: 'Daniel Carter', role: 'Faculty', email: 'daniel.carter@smartlab.edu', password: 'faculty123' },
        { id: 'U-04', name: 'Emily Wong', role: 'Student', email: 'emily.wong@smartlab.edu', password: 'student123' },
        { id: 'U-05', name: 'Michael Reyes', role: 'Lab Assistant', email: 'michael.reyes@smartlab.edu', password: 'assistant123' }
      ],

      borrowings: [
        { id: 'BR-1001', borrowerName: 'Sarah Mitchell', equipmentId: 'EQ-1042', equipmentName: 'Digital Oscilloscope', quantity: 2, borrowDate: '2026-11-10', expectedReturnDate: '2026-11-20', returnDate: '', returnCondition: '', status: 'approved', note: 'Signal analysis practical' },
        { id: 'BR-1002', borrowerName: 'Daniel Carter', equipmentId: 'EQ-1043', equipmentName: 'Digital Multimeter', quantity: 3, borrowDate: '2026-11-12', expectedReturnDate: '2026-11-25', returnDate: '', returnCondition: '', status: 'approved', note: 'Circuit diagnostics lab' },
        { id: 'BR-1003', borrowerName: 'Emily Wong', equipmentId: 'EQ-1047', equipmentName: 'Microscope', quantity: 1, borrowDate: '2026-11-21', expectedReturnDate: '2026-11-28', returnDate: '', returnCondition: '', status: 'pending', note: 'Cell structure observation' }
      ],

      reservations: [
        { id: 'RS-2001', borrowerName: 'Sarah Mitchell', equipmentId: 'EQ-1044', equipmentName: 'Laboratory Centrifuge', date: '2026-11-24', startTime: '09:00', endTime: '11:00', status: 'upcoming' },
        { id: 'RS-2002', borrowerName: 'Daniel Carter', equipmentId: 'EQ-1045', equipmentName: 'Thermal Imaging Camera', date: '2026-11-25', startTime: '13:00', endTime: '15:00', status: 'upcoming' }
      ],

      damageReports: [
        { id: 'DR-3001', equipmentId: 'EQ-1047', equipmentName: 'Microscope', reportedBy: 'Emily Wong', description: 'Objective lens has a small crack affecting image clarity.', priority: 'High', status: 'open', date: '2026-11-14' },
        { id: 'DR-3002', equipmentId: 'EQ-1049', equipmentName: 'Electronic Weighing Balance', reportedBy: 'Daniel Carter', description: 'Calibration drift noticed after the unit was relocated.', priority: 'Medium', status: 'under_repair', date: '2026-11-18' }
      ],

      maintenance: [
        { id: 'MT-4001', equipmentId: 'EQ-1042', equipmentName: 'Digital Oscilloscope', type: 'Preventive', date: '2026-10-12', performedBy: 'Michael Reyes', notes: 'Routine inspection, cleaning and firmware check.', nextDue: '2026-12-12', status: 'completed' },
        { id: 'MT-4002', equipmentId: 'EQ-1044', equipmentName: 'Laboratory Centrifuge', type: 'Calibration', date: '2026-09-18', performedBy: 'Avery Morgan', notes: 'Rotor speed calibration verified against reference.', nextDue: '2026-11-18', status: 'due' },
        { id: 'MT-4003', equipmentId: 'EQ-1047', equipmentName: 'Microscope', type: 'Repair', date: '2026-11-14', performedBy: 'Michael Reyes', notes: 'Objective lens assessment in progress.', nextDue: '2026-12-05', status: 'in_progress' }
      ],

      calibrations: [
        { id: 'CB-5001', equipmentId: 'EQ-1042', equipmentName: 'Digital Oscilloscope', lastDate: '2026-08-15', dueDate: '2026-11-15', intervalDays: 90, status: 'overdue', notes: 'Signal generator reference check.' },
        { id: 'CB-5002', equipmentId: 'EQ-1046', equipmentName: 'Benchtop pH Meter', lastDate: '2026-10-20', dueDate: '2027-01-18', intervalDays: 90, status: 'ok', notes: 'Two-point buffer calibration.' },
        { id: 'CB-5003', equipmentId: 'EQ-1049', equipmentName: 'Electronic Weighing Balance', lastDate: '2026-05-10', dueDate: '2026-11-10', intervalDays: 180, status: 'overdue', notes: 'Internal calibration weights.' }
      ],

      consumables: [
        { id: 'CS-6001', name: 'Centrifuge Tubes (50 ml)', category: 'Lab Supplies', quantity: 500, unit: 'pcs', reorderLevel: 100, location: 'Lab B · Store' },
        { id: 'CS-6002', name: 'pH Buffer Solution', category: 'Chemicals', quantity: 12, unit: 'bottles', reorderLevel: 5, location: 'Lab B · Cabinet 2' },
        { id: 'CS-6003', name: 'Microscope Slides', category: 'Lab Supplies', quantity: 6, unit: 'boxes', reorderLevel: 10, location: 'Lab C · Store' },
        { id: 'CS-6004', name: 'Printing Paper (A4)', category: 'Office', quantity: 20, unit: 'packs', reorderLevel: 5, location: 'Lab A · Office' }
      ],

      activities: [
        { id: 'AC-01', type: 'borrow', text: 'Borrowing request approved for Sarah Mitchell', date: '2026-11-10' },
        { id: 'AC-02', type: 'damage', text: 'Damage report submitted for Microscope', date: '2026-11-14' },
        { id: 'AC-03', type: 'reservation', text: 'Reservation scheduled for Laboratory Centrifuge', date: '2026-11-20' },
        { id: 'AC-04', type: 'borrow', text: 'New borrowing request from Emily Wong', date: '2026-11-21' }
      ],

      dismissedAlerts: [],

      notifications: [
        { id: 'NT-01', text: 'New borrowing request from Emily Wong', type: 'borrow', read: false, date: '2026-11-21' },
        { id: 'NT-02', text: 'Damage report submitted for Microscope', type: 'damage', read: false, date: '2026-11-18' },
        { id: 'NT-03', text: 'Borrowing request approved for Sarah Mitchell', type: 'approve', read: true, date: '2026-11-10' },
        { id: 'NT-04', text: 'Reservation scheduled for Laboratory Centrifuge', type: 'reservation', read: true, date: '2026-11-20' }
      ]
    };
  }

  /* ---------- Storage API ---------- */
  var COLLECTIONS = [
    'equipment', 'users', 'borrowings', 'reservations', 'damageReports',
    'maintenance', 'calibrations', 'consumables', 'activities', 'notifications', 'dismissedAlerts'
  ];

  /* Bring data saved by an older version up to the current shape. */
  function migrate(parsed) {
    var defaults = buildSeed();
    COLLECTIONS.forEach(function (key) {
      if (!Array.isArray(parsed[key])) parsed[key] = [];
    });

    // Merge any users missing from an older saved state (e.g. Lab Assistant).
    defaults.users.forEach(function (seedUser) {
      if (!parsed.users.some(function (u) { return u.id === seedUser.id; })) {
        parsed.users.push(seedUser);
      }
    });

    // Give every demo user its canonical password, even in older saved data
    // that may have been given a wrong value by an earlier version.
    // (There is no password-change feature, so this cannot overwrite a real edit.)
    parsed.users.forEach(function (u) {
      var demo = DEMO_ACCOUNTS[u.id];
      if (demo) u.password = demo.password;
      else if (!u.password) u.password = 'faculty123';
      if (!u.email && demo) u.email = demo.email;
    });

    ['maintenance', 'calibrations', 'consumables'].forEach(function (key) {
      if (!parsed[key].length) parsed[key] = defaults[key];
    });
    if (!Array.isArray(parsed.dismissedAlerts)) parsed.dismissedAlerts = [];
    parsed.equipment.forEach(function (e) {
      if (!e.purchaseDate) e.purchaseDate = e.addedDate || '2026-01-01';
    });
    return parsed;
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        var seed = buildSeed();
        save(seed);
        return seed;
      }
      var parsed = JSON.parse(raw);
      return migrate(parsed);
    } catch (err) {
      console.warn('Smart Lab: could not read saved data, resetting to sample data.', err);
      var fallback = buildSeed();
      save(fallback);
      return fallback;
    }
  }

  function save(state) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Smart Lab: could not save data.', err);
    }
  }

  function reset() {
    var fresh = buildSeed();
    save(fresh);
    return fresh;
  }

  function getSession() {
    try {
      var raw = global.localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function setSession(userId) {
    try {
      if (userId) global.localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: userId, at: Date.now() }));
      else global.localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* storage unavailable */ }
  }

  global.SmartLabStore = {
    key: STORAGE_KEY,
    sessionKey: SESSION_KEY,
    load: load,
    save: save,
    reset: reset,
    buildSeed: buildSeed,
    getSession: getSession,
    setSession: setSession
  };
})(window);
