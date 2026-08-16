/**
 * Shared Expressive Arts faculty timetable data.
 * Used by Faculty_Timetable.html (display) and teacher planner import.
 * Source: Art & Drama Timetable Update 11th Aug 26.xlsx
 */
(function (global) {
  'use strict';

  var SPECIAL_CLASS_CODES = ['PT meeting', 'WA', 'AfN', '5A1', '5I1 PSE'];

  var DRAMA_STAFF = [
    {
      name: 'R. McColm', short: 'McColm', room: 'Drama Studio',
      ac: '#e8420a', bg: '#fdeade', dk: '#7a1a00',
      department: 'drama',
      tt: {
        Monday:    { 3: '4draG' },
        Tuesday:   { 1: '1F', 2: '4draG', 3: '5ciC', 4: '5ciC', 5: 'PT meeting', 6: '5AHdraB', 7: '5AHdraB' },
        Wednesday: { 1: '5ciC', 2: '5ciC', 4: '4draG', 5: '2L', 7: '1A' },
        Thursday:  { 1: '1K', 3: '1L', 4: '1P', 5: '5AHdraB', 6: '5AHdraB' },
        Friday:    { 1: '2F', 2: '2M', 4: '1F', 5: '5ciC', 6: '5ciC' }
      }
    },
    {
      name: 'C. MacDonald', short: 'MacDonald', room: 'F02',
      ac: '#1565c0', bg: '#ddeaf8', dk: '#0a2d6b',
      department: 'drama',
      tt: {
        Monday:    { 2: '1D', 3: '1N', 6: '3draG', 7: '1K' },
        Tuesday:   { 1: '1N', 2: '2N', 4: '3draG', 5: '1B', 6: '1G' },
        Wednesday: { 2: '3draG', 4: '2C', 6: '1C', 7: '1D' },
        Thursday:  { 1: '4draF', 2: '3draG', 3: '1C', 5: '2B' },
        Friday:    { 1: '1G', 2: '1B', 3: '1M', 5: '4draG' }
      }
    },
    {
      name: 'S. Maclean', short: 'Maclean', room: 'F01',
      ac: '#2e7d32', bg: '#dceede', dk: '#0a3b0c',
      department: 'drama',
      tt: {
        Monday:    { 1: '3draF', 3: '5fsB', 4: '5fsB', 5: '4draF', 6: '1Q', 7: '1E' },
        Tuesday:   { 1: '5draE', 2: '5draE', 3: '3draF', 4: '2E', 5: '4draF', 6: '5fsB', 7: '5fsB' },
        Wednesday: { 2: '1E', 4: '1Q', 5: '4draF', 6: '2H', 7: '3draF' },
        Thursday:  { 1: '4draF', 3: '5draE', 4: '5draE', 5: '5fsB', 6: '5fsB' },
        Friday:    { 1: '5draE', 2: '5draE', 6: '3draF' }
      }
    },
    {
      name: 'S. Airdrie', short: 'Airdrie', room: 'F23',
      ac: '#6a1b9a', bg: '#ebd9f8', dk: '#3b0070',
      department: 'drama',
      tt: {
        Monday:    { 1: '5draA', 2: '5draA', 3: '5AHdraB', 4: '5AHdraB', 5: '5I1 PSE', 6: '1P', 7: '3draE' },
        Tuesday:   { 1: '1H', 4: '2G', 5: '1L', 6: '3draE', 7: '2K' },
        Wednesday: { 1: '3draE', 2: '2D', 4: '1M', 6: '5draA', 7: '5draA' },
        Thursday:  { 3: '1H', 5: '2A' },
        Friday:    { 2: '1A', 3: '5draA', 4: '5draA', 5: '3draE' }
      }
    }
  ];

  var ART_STAFF = [
    {
      name: 'M. Gallacher', short: 'Gallacher', room: 'S11',
      ac: '#0077a8', bg: '#ddf0f8', dk: '#003850',
      department: 'art',
      tt: {
        Monday:    { 1: '5artA', 2: '5artA', 3: '4artG', 5: 'WA', 6: '3photoG', 7: '3artE' },
        Tuesday:   { 1: '1Q', 2: '4artG', 3: '2D', 4: '3photoG', 6: '3artE' },
        Wednesday: { 1: '3artE', 2: '3photoG', 4: '4artG', 5: 'WA', 6: '5artA', 7: '5artA' },
        Thursday:  { 1: 'AfN', 2: '3photoG', 3: '1G', 4: '1A', 5: '1P', 6: '2C' },
        Friday:    { 2: '2C', 3: '5artA', 4: '5artA', 5: '4artG' }
      }
    },
    {
      name: 'P. Donald', short: 'Donald', room: 'S12',
      ac: '#00796b', bg: '#d9f0ea', dk: '#00382a',
      department: 'art',
      tt: {
        Monday:    { 3: '5artB', 4: '5artB', 6: '2G', 7: '2L' },
        Tuesday:   { 1: '3artC', 4: '2B', 5: '1M', 6: '5artB', 7: '4artC' },
        Wednesday: { 3: '2G', 4: '3artC', 5: '1K', 6: '4artC', 7: '1E' },
        Thursday:  { 2: '2L', 3: '3artC', 4: '1B', 5: '5artB', 6: '5artB' },
        Friday:    { 1: '3artC', 2: '2B', 3: '4artC', 5: '1F', 6: '2D' }
      }
    },
    {
      name: 'J. McKenzie', short: 'McKenzie', room: 'S10',
      ac: '#3949ab', bg: '#e8e8f8', dk: '#1a1a6b',
      department: 'art',
      tt: {
        Monday:    { 1: '4artD', 3: '2F', 6: '3artG', 7: '2N' },
        Tuesday:   { 1: '5photoE', 2: '5photoE', 4: '3artG', 5: '2E' },
        Wednesday: { 2: '3artG', 3: '2M', 4: '2A', 5: '4photoF', 7: '4artD' },
        Thursday:  { 1: '4photoF', 2: '3artG', 3: '5photoE', 4: '5photoE', 5: '4artD', 6: '2A' },
        Friday:    { 1: '5photoE', 2: '5photoE', 4: '4artD', 5: '2H', 6: '2E' }
      }
    },
    {
      name: 'V. Deighan', short: 'Deighan', room: 'S13',
      ac: '#c2185b', bg: '#fde8f0', dk: '#6b0030',
      department: 'art',
      tt: {
        Monday:    { 1: '3artF', 3: '2M', 5: '4photoF', 6: '2K', 7: '2H' },
        Tuesday:   { 1: '1D', 3: '3artF', 5: '4photoF', 6: '2N', 7: '5artB' },
        Wednesday: { 2: '2F', 5: 'WA', 7: '3artF' },
        Thursday:  { 3: '2K', 4: '1L', 6: '4artC' },
        Friday:    { 1: '1H', 2: '1C', 3: '1N', 5: '3artE', 6: '3artF' }
      }
    }
  ];

  function allStaff() {
    return DRAMA_STAFF.concat(ART_STAFF);
  }

  function getStaffByName(name) {
    var target = String(name || '').trim().toLowerCase();
    if (!target) return null;
    var list = allStaff();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].name || '').toLowerCase() === target) return list[i];
    }
    return null;
  }

  function isSpecialClass(code) {
    return SPECIAL_CLASS_CODES.indexOf(String(code || '')) >= 0;
  }

  /**
   * Infer planner subject from class code + department fallback.
   */
  function inferSubject(classCode, department) {
    var cls = String(classCode || '').toLowerCase();
    if (isSpecialClass(classCode)) return 'other';
    if (/photo/.test(cls)) return 'photography';
    if (/art/.test(cls)) return 'art';
    if (/dra|ci|fs|ah/.test(cls) || department === 'drama') return 'drama';
    if (department === 'art') return 'art';
    return 'other';
  }

  function yearLevelFromClassCode(code) {
    var m = /^(\d)/.exec(String(code || '').trim());
    if (!m) return null;
    var n = Number(m[1]);
    if (n >= 1 && n <= 3) return n;
    return null;
  }

  /**
   * Unique S1-S3 Art/Drama classes for one staff member.
   * Skips senior phase (S4+), photography, and non-teaching slots.
   */
  function bgeClassesForStaff(staff) {
    var seen = {};
    var out = [];
    if (!staff || !staff.tt) return out;
    Object.keys(staff.tt).forEach(function(day) {
      var periods = staff.tt[day] || {};
      Object.keys(periods).forEach(function(period) {
        var code = periods[period];
        if (isSpecialClass(code)) return;
        var subj = inferSubject(code, staff.department);
        if (subj !== 'art' && subj !== 'drama') return;
        var yl = yearLevelFromClassCode(code);
        if (!yl) return;
        var key = subj + '|' + yl + '|' + String(code).toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        out.push({
          subject: subj,
          year_level: 'S' + yl,
          class_code: String(code).trim(),
          class_name: String(code).trim()
        });
      });
    });
    return out.sort(function(a, b) {
      return String(a.subject).localeCompare(String(b.subject)) ||
        String(a.year_level).localeCompare(String(b.year_level)) ||
        String(a.class_code).localeCompare(String(b.class_code));
    });
  }

  global.FacultyTimetableData = {
    SPECIAL_CLASS_CODES: SPECIAL_CLASS_CODES,
    DRAMA_STAFF: DRAMA_STAFF,
    ART_STAFF: ART_STAFF,
    allStaff: allStaff,
    getStaffByName: getStaffByName,
    isSpecialClass: isSpecialClass,
    inferSubject: inferSubject,
    yearLevelFromClassCode: yearLevelFromClassCode,
    bgeClassesForStaff: bgeClassesForStaff
  };
})(typeof window !== 'undefined' ? window : this);
