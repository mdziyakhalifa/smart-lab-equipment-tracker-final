/* =========================================================================
   data.js — storage layer + first-visit demonstration data
   All persistence is handled through browser localStorage.
   ========================================================================= */

(function (global) {
  'use strict';

  var STORAGE_KEY = 'smartlab_tracker_v1';

  /* ---------- Reusable sample data factory ---------- */
  function buildSeed() {
    return {
      equipment: [
        { id: 'EQ-1042', name: 'Digital Oscilloscope', category: 'Electronics', quantity: 6, available: 4, borrowed: 2, damaged: 0, location: 'Lab A · Room 201', condition: 'Good', addedDate: '2026-09-14' },
        { id: 'EQ-1043', name: 'Digital Multimeter', category: 'Electronics', quantity: 10, available: 7, borrowed: 3, damaged: 0, location: 'Lab A · Room 201', condition: 'Good', addedDate: '2026-09-14' },
        { id: 'EQ-1044', name: 'Laboratory Centrifuge', category: 'Lab Equipment', quantity: 4, available: 3, borrowed: 1, damaged: 0, location: 'Lab B · Room 105', condition: 'Good', addedDate: '2026-09-20' },
        { id: 'EQ-1045', name: 'Thermal Imaging Camera', category: 'Imaging', quantity: 3, available: 2, borrowed: 1, damaged: 0, location: 'Lab C · Room 302', condition: 'Good', addedDate: '2026-10-02' },
        { id: 'EQ-1046', name: 'Benchtop pH Meter', category: 'Chemistry', quantity: 5, available: 5, borrowed: 0, damaged: 0, location: 'Lab B · Room 110', condition: 'Good', addedDate: '2026-10-08' },
        { id: 'EQ-1047', name: 'Microscope', category: 'Optics', quantity: 8, available: 6, borrowed: 1, damaged: 1, location: 'Lab C · Room 301', condition: 'Fair', addedDate: '2026-10-11' },
        { id: 'EQ-1048', name: 'Function Generator', category: 'Electronics', quantity: 5, available: 5, borrowed: 0, damaged: 0, location: 'Lab A · Room 202', condition: 'Good', addedDate: '2026-11-03' },
        { id: 'EQ-1049', name: 'Electronic Weighing Balance', category: 'Chemistry', quantity: 6, available: 4, borrowed: 2, damaged: 0, location: 'Lab B · Room 108', condition: 'Fair', addedDate: '2026-11-05' }
      ],

      users: [
        { id: 'U-01', name: 'Avery Morgan', role: 'Administrator', email: 'avery.morgan@smartlab.edu' },
        { id: 'U-02', name: 'Sarah Mitchell', role: 'Faculty', email: 'sarah.mitchell@smartlab.edu' },
        { id: 'U-03', name: 'Daniel Carter', role: 'Faculty', email: 'daniel.carter@smartlab.edu' },
        { id: 'U-04', name: 'Emily Wong', role: 'Student', email: 'emily.wong@smartlab.edu' }
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

      activities: [
        { id: 'AC-01', type: 'borrow', text: 'Borrowing request approved for Sarah Mitchell', date: '2026-11-10' },
        { id: 'AC-02', type: 'damage', text: 'Damage report submitted for Microscope', date: '2026-11-14' },
        { id: 'AC-03', type: 'reservation', text: 'Reservation scheduled for Laboratory Centrifuge', date: '2026-11-20' },
        { id: 'AC-04', type: 'borrow', text: 'New borrowing request from Emily Wong', date: '2026-11-21' }
      ],

      notifications: [
        { id: 'NT-01', text: 'New borrowing request from Emily Wong', type: 'borrow', read: false, date: '2026-11-21' },
        { id: 'NT-02', text: 'Damage report submitted for Microscope', type: 'damage', read: false, date: '2026-11-18' },
        { id: 'NT-03', text: 'Borrowing request approved for Sarah Mitchell', type: 'approve', read: true, date: '2026-11-10' },
        { id: 'NT-04', text: 'Reservation scheduled for Laboratory Centrifuge', type: 'reservation', read: true, date: '2026-11-20' }
      ]
    };
  }

  /* ---------- Storage API ---------- */
  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        var seed = buildSeed();
        save(seed);
        return seed;
      }
      var parsed = JSON.parse(raw);
      // Defensive check: ensure the expected collections exist.
      ['equipment', 'users', 'borrowings', 'reservations', 'damageReports', 'activities', 'notifications'].forEach(function (key) {
        if (!Array.isArray(parsed[key])) parsed[key] = [];
      });
      return parsed;
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

  global.SmartLabStore = {
    key: STORAGE_KEY,
    load: load,
    save: save,
    reset: reset,
    buildSeed: buildSeed
  };
})(window);
