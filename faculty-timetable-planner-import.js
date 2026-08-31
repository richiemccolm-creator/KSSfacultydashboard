/**
 * Import a teacher's faculty timetable into Teacher Planner weekly slots.
 */
(function () {
  'use strict';

  var DAY_MAP = {
    Monday: 'monday',
    Tuesday: 'tuesday',
    Wednesday: 'wednesday',
    Thursday: 'thursday',
    Friday: 'friday'
  };

  function dayKey(dayCap) {
    return DAY_MAP[dayCap] || String(dayCap || '').toLowerCase();
  }

  function slotIdentity(day, period) {
    return String(day || '').toLowerCase() + '-' + period;
  }

  function findExistingSlot(slots, day, period) {
    return (slots || []).find(function (s) {
      return String(s.day || '').toLowerCase() === String(day || '').toLowerCase() &&
        Number(s.period) === Number(period);
    }) || null;
  }

  function normalizeName(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Match "Richard McColm" / "r.mccolm@..."-style names to "R. McColm". */
  function matchStaffName(loginName) {
    var FT = window.FacultyTimetableData;
    if (!FT) return '';
    var list = FT.allStaff();
    var norm = normalizeName(loginName);
    if (!norm) return '';

    // Exact after normalizing punctuation
    for (var i = 0; i < list.length; i++) {
      if (normalizeName(list[i].name) === norm) return list[i].name;
      var aliases = list[i].aliases || [];
      for (var a = 0; a < aliases.length; a++) {
        if (normalizeName(aliases[a]) === norm) return list[i].name;
      }
    }

    // Surname match (last token)
    var parts = norm.split(' ');
    var surname = parts[parts.length - 1];
    if (surname && surname.length > 2) {
      var matches = list.filter(function (s) {
        return normalizeName(s.short) === surname || normalizeName(s.name).indexOf(surname) >= 0;
      });
      if (matches.length === 1) return matches[0].name;
    }

    // Initial + surname: "r mccolm" vs "R. McColm"
    if (parts.length >= 2) {
      var initial = parts[0].charAt(0);
      var last = parts[parts.length - 1];
      var initMatches = list.filter(function (s) {
        var sn = normalizeName(s.name);
        return sn.charAt(0) === initial && sn.indexOf(last) >= 0;
      });
      if (initMatches.length === 1) return initMatches[0].name;
    }

    return '';
  }

  function teacherOptions() {
    var FT = window.FacultyTimetableData;
    if (!FT) return [];
    return FT.allStaff().map(function (s) {
      return {
        name: s.name,
        short: s.short,
        room: s.room,
        department: s.department || ''
      };
    }).sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Build import plan for one staff member.
   * mode: replaceAll | mergeKeepExisting | mergeOverwrite
   * includeSpecial: include PT meeting / WA etc as subject "other"
   */
  function buildPlan(options) {
    var FT = window.FacultyTimetableData;
    var PS = window.PlannerService;
    if (!FT || !PS) {
      return { error: 'Faculty timetable data or planner not loaded', slots: [], counts: {} };
    }
    options = options || {};
    var staff = FT.getStaffByName(options.teacherName);
    if (!staff) {
      return { error: 'Select a teacher from the faculty timetable', slots: [], counts: {} };
    }

    var mode = options.mode || 'replaceAll';
    var includeSpecial = options.includeSpecial !== false;
    var existingSlots = (PS.getState().timetable && PS.getState().timetable.slots) || [];
    var existingByKey = {};
    existingSlots.forEach(function (s) {
      existingByKey[slotIdentity(s.day, s.period)] = s;
    });

    var planned = [];
    var counts = { add: 0, replace: 0, keep: 0, skipSpecial: 0, teaching: 0 };

    Object.keys(DAY_MAP).forEach(function (dayCap) {
      var dayPeriods = (staff.tt && staff.tt[dayCap]) || {};
      Object.keys(dayPeriods).forEach(function (periodStr) {
        var period = parseInt(periodStr, 10);
        var classCode = dayPeriods[periodStr];
        var isSpecial = FT.isSpecialClass(classCode);
        if (isSpecial && !includeSpecial) {
          counts.skipSpecial++;
          return;
        }
        var day = dayKey(dayCap);
        var key = slotIdentity(day, period);
        var existing = existingByKey[key];
        var subject = FT.inferSubject(classCode, staff.department);
        var slot = {
          day: day,
          period: period,
          subject: subject,
          className: classCode,
          room: staff.room || '',
          color: undefined,
          facultyImportedAt: new Date().toISOString(),
          facultyTeacher: staff.name
        };

        if (mode === 'replaceAll') {
          if (existing) counts.replace++;
          else counts.add++;
          planned.push(slot);
          return;
        }

        if (!existing) {
          counts.add++;
          planned.push(slot);
          return;
        }

        if (mode === 'mergeKeepExisting') {
          counts.keep++;
          planned.push(Object.assign({}, existing));
          return;
        }

        // mergeOverwrite
        counts.replace++;
        planned.push(Object.assign({}, existing, {
          subject: slot.subject,
          className: slot.className,
          room: slot.room || existing.room,
          facultyImportedAt: slot.facultyImportedAt,
          facultyTeacher: slot.facultyTeacher
        }));
      });
    });

    // In merge modes, keep other existing slots that weren't in the faculty TT
    if (mode !== 'replaceAll') {
      existingSlots.forEach(function (s) {
        var key = slotIdentity(s.day, s.period);
        var already = planned.some(function (p) {
          return slotIdentity(p.day, p.period) === key;
        });
        if (!already) {
          planned.push(Object.assign({}, s));
          counts.keep++;
        }
      });
    }

    counts.teaching = planned.filter(function (s) {
      return !FT.isSpecialClass(s.className);
    }).length;

    return {
      teacherName: staff.name,
      room: staff.room || '',
      department: staff.department || '',
      mode: mode,
      slots: planned,
      counts: counts,
      existingCount: existingSlots.length
    };
  }

  function run(plan) {
    var PS = window.PlannerService;
    if (!PS || !plan || !plan.slots) {
      return Promise.reject(new Error('Invalid faculty timetable import plan'));
    }
    var periodTimes = (PS.getState().timetable && PS.getState().timetable.periodTimes) || undefined;
    var slots = plan.slots.map(function (s) {
      return {
        id: s.id || PS.id(),
        day: s.day,
        period: s.period,
        subject: s.subject,
        className: s.className,
        room: s.room || '',
        color: s.color,
        facultyImportedAt: s.facultyImportedAt,
        facultyTeacher: s.facultyTeacher
      };
    });
    PS.collectTimetable(slots, periodTimes);
    if (PS.setAcademicYearLabel && !PS.getAcademicYearLabel()) {
      // leave year label alone unless empty — import shouldn't invent one
    }
    return PS.saveTimetable().then(function () {
      return {
        applied: slots.length,
        counts: plan.counts,
        teacherName: plan.teacherName,
        room: plan.room
      };
    });
  }

  window.FacultyTimetablePlannerImport = {
    teacherOptions: teacherOptions,
    matchStaffName: matchStaffName,
    buildPlan: buildPlan,
    run: run
  };
})();
