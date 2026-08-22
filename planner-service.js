/**
 * Teacher planner service — data and business logic.
 * Used by teacher_planner.html. Keeps state and exposes load/save/query methods.
 */
(function() {
  var DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  var PERIODS = 8;
  var state = {
    timetable: { slots: [] },
    lessons: { lessons: [] },
    weekNotes: {},
    daySlotNotes: {},
    dayNotes: {},
    lessonPlanTemplates: { templates: [] },
    schemesOfWork: { units: [] },
    currentWeekStart: null,
    currentMonthStart: null,
    currentDayViewDate: null,
    editingLessonId: null,
    editingTemplateId: null
  };

  function id() { return 'x' + Math.random().toString(36).substr(2, 9); }

  function stripHtmlBasic(html) {
    if (!html) return '';
    return String(html)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function formatAcademicYearLabel(startYear) {
    var y = parseInt(startYear, 10);
    if (isNaN(y)) return '';
    return y + '–' + String((y + 1) % 100).padStart(2, '0');
  }

  function currentAcademicYearStartYear(forDate) {
    var d = forDate ? new Date(forDate) : new Date();
    var y = d.getFullYear();
    return d.getMonth() >= 7 ? y : y - 1;
  }

  function nextAcademicYearStartYear(forDate) {
    return currentAcademicYearStartYear(forDate) + 1;
  }

  function resourcesArrayToString(arr) {
    if (!Array.isArray(arr) || !arr.length) return '';
    return arr.map(function(r) {
      if (!r) return '';
      var u = r.url ? String(r.url) : '';
      var l = r.label ? String(r.label) : '';
      if (l && u) return l + ' — ' + u;
      return u || l;
    }).filter(Boolean).join('\n');
  }

  function normalizeLesson(les) {
    if (!les || typeof les !== 'object') return;
    if (les.learningIntention === undefined) les.learningIntention = '';
    if (les.successCriteria === undefined) les.successCriteria = '';
    if (les.activities === undefined) les.activities = '';
    if (les.resources === undefined) les.resources = '';
    if (les.notes != null && String(les.notes).trim() && (!les.activities || !String(les.activities).trim())) {
      les.activities = String(les.notes);
    }
    var st = les.status;
    var valid = st === 'planned' || st === 'draft' || st === 'complete';
    if (!valid) {
      if (les.bankPlan) les.status = 'complete';
      else if (!(les.title && String(les.title).trim())) les.status = 'draft';
      else les.status = 'planned';
    }
    if (les.bankPlan && typeof les.bankPlan === 'object') {
      var bp = les.bankPlan;
      if (!String(les.learningIntention || '').trim()) {
        les.learningIntention = String(bp.learningIntentions || bp.objectives || '').trim();
      }
      if (!String(les.successCriteria || '').trim()) {
        les.successCriteria = String(bp.successCriteria || '').trim();
      }
      if (!String(les.activities || '').trim()) {
        var actParts = [bp.activity, bp.differentiation, bp.effectiveQuestions, bp.digitalTechnologies, bp.notes]
          .filter(function(x) { return x && String(x).trim(); })
          .map(function(x) { return String(x).trim(); });
        if (actParts.length) les.activities = actParts.join('\n\n');
      }
      if (!String(les.resources || '').trim() && bp.resources) {
        les.resources = resourcesArrayToString(bp.resources);
      }
    }
    if (les.notes == null || !String(les.notes).trim()) {
      les.notes = les.activities || '';
    }
    les.homework = normalizeHomework(les.homework);
  }

  function ymdValid(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  }

  function normalizeHomework(hw) {
    if (!hw || typeof hw !== 'object') return null;
    var task = String(hw.task || '').trim();
    var dueDate = String(hw.dueDate || '').slice(0, 10);
    if (!ymdValid(dueDate)) dueDate = '';
    var notes = String(hw.notes || '').trim();
    var collected = !!hw.collected;
    if (!task && !dueDate && !notes && !collected) return null;
    return { task: task, dueDate: dueDate, collected: collected, notes: notes };
  }

  function weekdayNameFromDateStr(dateStr) {
    if (!ymdValid(dateStr)) return '';
    var parts = String(dateStr).split('-');
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    var js = d.getDay();
    if (js < 1 || js > 5) return '';
    return DAYS[js - 1];
  }

  var SCHEME_UNIT_ACCENT_OK = {
    subject: 1, violet: 1, sky: 1, emerald: 1, amber: 1, rose: 1, orange: 1, cyan: 1,
    indigo: 1, slate: 1, red: 1, pink: 1, lime: 1, teal: 1
  };

  function normalizeUnit(u) {
    if (!u || typeof u !== 'object') return;
    if (u.startDate === undefined) u.startDate = '';
    if (u.endDate === undefined) u.endDate = '';
    if (u.overview === undefined) u.overview = '';
    if (u.accentKey === undefined || u.accentKey === '' || !SCHEME_UNIT_ACCENT_OK[u.accentKey]) {
      u.accentKey = 'subject';
    }
    if (!Array.isArray(u.lessons)) u.lessons = [];
    u.lessons.forEach(normalizeLesson);
  }

  function normalizeSchemesOfWorkBlob(blob) {
    if (!blob || typeof blob !== 'object') return;
    if (!Array.isArray(blob.units)) blob.units = [];
    blob.units.forEach(normalizeUnit);
  }

  var CLASS_SUPPORT_IDS = {
    literacy: 1, eal: 1, processing: 1, attention: 1, communication: 1,
    confidence: 1, sensory: 1, physical: 1, groupDynamics: 1, other: 1
  };
  var CLASS_SUPPORT_ID_ORDER = [
    'literacy', 'eal', 'processing', 'attention', 'communication',
    'confidence', 'sensory', 'physical', 'groupDynamics', 'other'
  ];

  function classSupportKey(className) {
    return String(className || '').trim().toLowerCase();
  }

  function parseClassSupportCount(value) {
    if (value == null || value === '') return null;
    var n = parseInt(value, 10);
    if (isNaN(n) || n < 0) return null;
    return n;
  }

  function orderedClassSupportConsiderations(ids) {
    var set = {};
    (Array.isArray(ids) ? ids : []).forEach(function(id) {
      var key = String(id || '').trim();
      if (CLASS_SUPPORT_IDS[key]) set[key] = 1;
    });
    return CLASS_SUPPORT_ID_ORDER.filter(function(id) { return set[id]; });
  }

  function normalizeClassSupportProfile(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var considerations = orderedClassSupportConsiderations(raw.considerations);
    var whatWorks = String(raw.whatWorks || '').trim();
    var asnCount = parseClassSupportCount(raw.asnCount);
    var ealCount = parseClassSupportCount(raw.ealCount);
    if (!considerations.length && !whatWorks && asnCount == null && ealCount == null) return null;
    return {
      considerations: considerations,
      asnCount: asnCount,
      ealCount: ealCount,
      whatWorks: whatWorks,
      updatedAt: raw.updatedAt ? String(raw.updatedAt) : ''
    };
  }

  function normalizeClassSupportMap(map) {
    var out = {};
    if (!map || typeof map !== 'object' || Array.isArray(map)) return out;
    Object.keys(map).forEach(function(k) {
      var key = classSupportKey(k);
      if (!key) return;
      var profile = normalizeClassSupportProfile(map[k]);
      if (profile) out[key] = profile;
    });
    return out;
  }

  function ensureClassSupportMap() {
    if (!state.timetable) state.timetable = { slots: [] };
    if (!state.timetable.classSupport || typeof state.timetable.classSupport !== 'object' || Array.isArray(state.timetable.classSupport)) {
      state.timetable.classSupport = {};
    }
    return state.timetable.classSupport;
  }

  function copyClassSupportProfile(profile) {
    if (!profile) return null;
    return {
      considerations: (profile.considerations || []).slice(),
      asnCount: profile.asnCount == null ? null : profile.asnCount,
      ealCount: profile.ealCount == null ? null : profile.ealCount,
      whatWorks: profile.whatWorks || '',
      updatedAt: profile.updatedAt || ''
    };
  }

  window.PlannerService = {
    DAYS: DAYS,
    PERIODS: PERIODS,

    load: function() {
      var self = this;
      return Promise.all([
        (window.DataService && DataService.get ? DataService.get('plannerTimetable') : Promise.resolve(null)),
        (window.DataService && DataService.get ? DataService.get('plannerLessons') : Promise.resolve(null)),
        (window.DataService && DataService.get ? DataService.get('plannerWeekNotes') : Promise.resolve(null)),
        (window.DataService && DataService.get ? DataService.get('plannerDaySlotNotes') : Promise.resolve(null)),
        (window.DataService && DataService.get ? DataService.get('plannerDayNotes') : Promise.resolve(null)),
        (window.DataService && DataService.get ? DataService.get('lessonPlanTemplates') : Promise.resolve(null)),
        (window.DataService && DataService.get ? DataService.get('plannerSchemesOfWork') : Promise.resolve(null))
      ]).then(function(res) {
        state.timetable = res[0] && (res[0].slots || res[0].academicYearLabel || res[0].classColors || res[0].classSupport) ? res[0] : { slots: [] };
        if (!state.timetable.slots) state.timetable.slots = [];
        if (!state.timetable.classColors || typeof state.timetable.classColors !== 'object') {
          state.timetable.classColors = {};
        }
        state.timetable.classSupport = normalizeClassSupportMap(state.timetable.classSupport);
        state.lessons = res[1] && res[1].lessons ? res[1] : { lessons: [] };
        if (!Array.isArray(state.lessons.lessons)) state.lessons.lessons = [];
        state.lessons.lessons.forEach(normalizeLesson);
        state.weekNotes = res[2] && typeof res[2] === 'object' ? res[2] : {};
        state.daySlotNotes = res[3] && typeof res[3] === 'object' ? res[3] : {};
        state.dayNotes = res[4] && typeof res[4] === 'object' ? res[4] : {};
        state.lessonPlanTemplates = res[5] && res[5].templates ? res[5] : { templates: [] };
        state.schemesOfWork = res[6] && res[6].units ? res[6] : { units: [] };
        normalizeSchemesOfWorkBlob(state.schemesOfWork);
        return self.getState();
      });
    },

    saveTimetable: function() {
      return window.DataService ? DataService.set('plannerTimetable', state.timetable) : Promise.resolve();
    },

    resetTimetableForNewYear: function() {
      if (!state.timetable) state.timetable = {};
      state.timetable.academicYearLabel = formatAcademicYearLabel(nextAcademicYearStartYear());
      state.timetable.slots = [];
      state.timetable.classSupport = {};
      return this.saveTimetable();
    },

    getAcademicYearLabel: function(forDate) {
      var stored = state.timetable && state.timetable.academicYearLabel;
      if (stored && String(stored).trim()) return String(stored).trim();
      return formatAcademicYearLabel(currentAcademicYearStartYear(forDate));
    },

    setAcademicYearLabel: function(label) {
      if (!state.timetable) state.timetable = { slots: [] };
      state.timetable.academicYearLabel = String(label || '').trim();
      return this.saveTimetable();
    },

    /** Per-class colour map saved with the timetable blob: { "1F": "#2563eb", ... }. */
    getClassColors: function() {
      var raw = state.timetable && state.timetable.classColors;
      if (!raw || typeof raw !== 'object') return {};
      var out = {};
      Object.keys(raw).forEach(function(k) {
        var key = String(k || '').trim();
        var hex = String(raw[k] || '').trim();
        if (key && /^#[0-9A-Fa-f]{6}$/.test(hex)) out[key] = hex.toLowerCase();
      });
      return out;
    },

    setClassColor: function(className, hex) {
      if (!state.timetable) state.timetable = { slots: [] };
      var key = String(className || '').trim();
      if (!key) return Promise.resolve();
      var colour = String(hex || '').trim();
      if (!state.timetable.classColors || typeof state.timetable.classColors !== 'object') {
        state.timetable.classColors = {};
      }
      if (!colour) {
        delete state.timetable.classColors[key];
      } else if (/^#[0-9A-Fa-f]{6}$/.test(colour)) {
        state.timetable.classColors[key] = colour.toLowerCase();
      } else {
        return Promise.resolve();
      }
      return this.saveTimetable();
    },

    setClassColors: function(map) {
      if (!state.timetable) state.timetable = { slots: [] };
      var out = {};
      if (map && typeof map === 'object') {
        Object.keys(map).forEach(function(k) {
          var key = String(k || '').trim();
          var hex = String(map[k] || '').trim();
          if (key && /^#[0-9A-Fa-f]{6}$/.test(hex)) out[key] = hex.toLowerCase();
        });
      }
      state.timetable.classColors = out;
      return this.saveTimetable();
    },

    classSupportKey: classSupportKey,

    getClassSupportProfile: function(className) {
      var key = classSupportKey(className);
      if (!key) return null;
      var map = state.timetable && state.timetable.classSupport;
      return copyClassSupportProfile(normalizeClassSupportProfile(map && map[key]));
    },

    hasClassSupportProfile: function(className) {
      return !!this.getClassSupportProfile(className);
    },

    classSupportConsiderationCount: function(className) {
      var profile = this.getClassSupportProfile(className);
      return profile && profile.considerations ? profile.considerations.length : 0;
    },

    setClassSupportProfile: function(className, fields) {
      var key = classSupportKey(className);
      if (!key) return Promise.resolve(null);
      ensureClassSupportMap();
      var profile = normalizeClassSupportProfile(Object.assign({}, fields || {}, {
        updatedAt: new Date().toISOString()
      }));
      if (!profile) {
        delete state.timetable.classSupport[key];
        return this.saveTimetable().then(function() { return null; });
      }
      state.timetable.classSupport[key] = profile;
      return this.saveTimetable().then(function() { return copyClassSupportProfile(profile); });
    },

    deleteClassSupportProfile: function(className) {
      var key = classSupportKey(className);
      if (!key) return Promise.resolve();
      ensureClassSupportMap();
      delete state.timetable.classSupport[key];
      return this.saveTimetable();
    },

    saveLessons: function() {
      return window.DataService ? DataService.set('plannerLessons', state.lessons) : Promise.resolve();
    },

    getWeekNote: function(weekStartStr) {
      return (state.weekNotes || {})[weekStartStr] || '';
    },
    setWeekNote: function(weekStartStr, text) {
      if (!state.weekNotes) state.weekNotes = {};
      state.weekNotes[weekStartStr] = text || '';
    },
    saveWeekNotes: function() {
      return window.DataService ? DataService.set('plannerWeekNotes', state.weekNotes) : Promise.resolve();
    },

    daySlotNoteKey: function(dateStr, slotKey) {
      return (dateStr || '') + '|' + (slotKey || '');
    },
    getDaySlotNote: function(dateStr, slotKey) {
      return (state.daySlotNotes || {})[this.daySlotNoteKey(dateStr, slotKey)] || '';
    },
    setDaySlotNote: function(dateStr, slotKey, text) {
      if (!state.daySlotNotes) state.daySlotNotes = {};
      state.daySlotNotes[this.daySlotNoteKey(dateStr, slotKey)] = text || '';
    },
    saveDaySlotNotes: function() {
      return window.DataService ? DataService.set('plannerDaySlotNotes', state.daySlotNotes) : Promise.resolve();
    },

    getDayNote: function(dateStr) {
      return (state.dayNotes || {})[dateStr || ''] || '';
    },
    setDayNote: function(dateStr, text) {
      if (!state.dayNotes) state.dayNotes = {};
      state.dayNotes[dateStr || ''] = text || '';
    },
    saveDayNotes: function() {
      return window.DataService ? DataService.set('plannerDayNotes', state.dayNotes) : Promise.resolve();
    },

    getState: function() { return state; },

    slotKey: function(day, period) { return day + '-' + period; },

    getSlot: function(day, period) {
      return (state.timetable.slots || []).find(function(s) { return s.day === day && s.period === period; });
    },

    getLessonFor: function(dateStr, slotKey) {
      return (state.lessons.lessons || []).find(function(l) {
        return l.date === dateStr && l.slotKey === slotKey;
      });
    },

    getLessonsForDate: function(dateStr) {
      return (state.lessons.lessons || []).filter(function(l) { return l.date === dateStr; });
    },

    normalizeHomework: normalizeHomework,

    getHomeworkFor: function(dateStr, slotKey) {
      var les = this.getLessonFor(dateStr, slotKey);
      return les ? normalizeHomework(les.homework) : null;
    },

    getTimetableClassNames: function() {
      var seen = {};
      var out = [];
      (state.timetable.slots || []).forEach(function(s) {
        var n = String(s.className || '').trim();
        if (!n || seen[n.toLowerCase()]) return;
        seen[n.toLowerCase()] = 1;
        out.push(n);
      });
      out.sort(function(a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); });
      return out;
    },

    getSlotsForClassOnDate: function(className, dateStr) {
      var dayName = weekdayNameFromDateStr(dateStr);
      var want = String(className || '').trim().toLowerCase();
      if (!dayName || !want) return [];
      return (state.timetable.slots || []).filter(function(s) {
        return String(s.day || '').toLowerCase() === dayName &&
          String(s.className || '').trim().toLowerCase() === want;
      }).slice().sort(function(a, b) {
        return (parseInt(a.period, 10) || 0) - (parseInt(b.period, 10) || 0);
      });
    },

    nextLessonDateForClass: function(className, afterDate) {
      var want = String(className || '').trim().toLowerCase();
      if (!want) return '';
      var after = ymdValid(afterDate) ? String(afterDate).slice(0, 10) : this.getDateStr(new Date());
      var slots = (state.timetable.slots || []).filter(function(s) {
        return String(s.className || '').trim().toLowerCase() === want;
      });
      if (!slots.length) return '';
      var daySet = {};
      slots.forEach(function(s) { daySet[String(s.day || '').toLowerCase()] = 1; });
      var parts = after.split('-');
      var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      for (var i = 0; i < 42; i++) {
        d.setDate(d.getDate() + 1);
        var js = d.getDay();
        if (js < 1 || js > 5) continue;
        var name = DAYS[js - 1];
        if (daySet[name]) return this.getDateStr(d);
      }
      return '';
    },

    listHomework: function(filters) {
      var self = this;
      filters = filters || {};
      var todayStr = ymdValid(filters.todayStr) ? filters.todayStr : this.getDateStr(new Date());
      var classWant = String(filters.className || '').trim().toLowerCase();
      var rows = [];
      (state.lessons.lessons || []).forEach(function(l) {
        var hw = normalizeHomework(l.homework);
        if (!hw) return;
        if (!hw.task && !hw.dueDate) return;
        var sk = self.parseSlotKeyParts(l.slotKey);
        var slot = sk ? self.getSlot(sk.day, sk.period) : null;
        var className = (slot && slot.className) ? String(slot.className).trim() : '';
        var subject = (l.subject && String(l.subject).trim()) || (slot && slot.subject) || '';
        var setDate = (l.date || '').slice(0, 10);
        var due = hw.dueDate || '';
        var overdue = !hw.collected && !!due && due < todayStr;
        var dueToday = !hw.collected && due === todayStr;
        if (classWant && className.toLowerCase() !== classWant) return;
        if (filters.dueFrom && (!due || due < filters.dueFrom)) return;
        if (filters.dueTo && (!due || due > filters.dueTo)) return;
        if (filters.setFrom && (!setDate || setDate < filters.setFrom)) return;
        if (filters.setTo && (!setDate || setDate > filters.setTo)) return;
        if (filters.overdueOnly && !overdue) return;
        if (filters.dueTodayOnly && !dueToday) return;
        if (filters.uncollectedOnly && hw.collected) return;
        rows.push({
          lessonId: l.id || null,
          date: setDate,
          slotKey: l.slotKey || '',
          period: sk ? sk.period : null,
          className: className,
          subject: subject,
          title: (l.title && String(l.title).trim()) || '',
          homework: hw,
          overdue: overdue,
          dueToday: dueToday
        });
      });
      rows.sort(function(a, b) {
        var da = a.homework.dueDate || '9999-99-99';
        var db = b.homework.dueDate || '9999-99-99';
        if (da !== db) return da.localeCompare(db);
        var cmp = (a.date || '').localeCompare(b.date || '');
        if (cmp) return cmp;
        return (a.period || 99) - (b.period || 99);
      });
      return rows;
    },

    setHomeworkFor: function(dateStr, slotKey, homework) {
      var hw = normalizeHomework(homework);
      var existing = this.getLessonFor(dateStr, slotKey);
      if (existing) {
        existing.homework = hw;
        existing.updatedAt = new Date().toISOString();
        normalizeLesson(existing);
        return existing;
      }
      var sk = this.parseSlotKeyParts(slotKey);
      var slot = sk ? this.getSlot(sk.day, sk.period) : null;
      this.upsertLesson({
        date: dateStr,
        slotKey: slotKey,
        subject: (slot && slot.subject) || '',
        yearGroup: '',
        unitKey: '',
        title: '',
        homework: hw,
        updatedAt: new Date().toISOString()
      }, null);
      var created = this.getLessonFor(dateStr, slotKey);
      if (created) normalizeLesson(created);
      return created;
    },

    /** Match teacher_planner.html parseSlotKeyParts — day lowercased, period integer. */
    parseSlotKeyParts: function(slotKey) {
      var m = /^([a-z]+)-(\d+)$/i.exec(slotKey || '');
      return m ? { day: m[1].toLowerCase(), period: parseInt(m[2], 10) } : null;
    },

    /**
     * Planned lessons on/after today within maxDays horizon, sorted by date then period.
     * Caller should run load() first so state is fresh.
     */
    getUpcomingLessonsPreview: function(options) {
      var self = this;
      options = options || {};
      var limit = options.limit != null ? options.limit : 6;
      var maxDays = options.maxDays != null ? options.maxDays : 21;
      var todayStr = options.todayStr || this.getDateStr(new Date());
      var endStr = null;
      if (maxDays > 0) {
        var parts = todayStr.split('-');
        var endD = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        endD.setDate(endD.getDate() + maxDays);
        endStr = this.getDateStr(endD);
      }
      var rows = (state.lessons.lessons || []).filter(function(l) {
        var d = (l.date || '').slice(0, 10);
        if (d.length !== 10 || d < todayStr) return false;
        if (endStr && d > endStr) return false;
        return true;
      });
      function dayIndex(day) {
        var i = DAYS.indexOf(day);
        return i >= 0 ? i : 99;
      }
      rows.sort(function(a, b) {
        var cmp = (a.date || '').slice(0, 10).localeCompare((b.date || '').slice(0, 10));
        if (cmp !== 0) return cmp;
        var pa = self.parseSlotKeyParts(a.slotKey);
        var pb = self.parseSlotKeyParts(b.slotKey);
        var perA = pa ? pa.period : 99;
        var perB = pb ? pb.period : 99;
        if (perA !== perB) return perA - perB;
        return dayIndex(pa ? pa.day : '') - dayIndex(pb ? pb.day : '');
      });
      rows = rows.slice(0, limit);
      return rows.map(function(l) {
        var sk = self.parseSlotKeyParts(l.slotKey);
        var slot = sk ? self.getSlot(sk.day, sk.period) : null;
        var slotSub = slot && slot.subject ? String(slot.subject).trim() : '';
        var lesSub = l.subject && String(l.subject).trim();
        var titleRaw = l.title && String(l.title).trim();
        var title = titleRaw || lesSub || slotSub || 'Untitled';
        return {
          date: (l.date || '').slice(0, 10),
          slotKey: l.slotKey || '',
          period: sk ? sk.period : null,
          className: slot && slot.className ? String(slot.className) : '',
          subject: lesSub || slotSub,
          title: title,
          lessonId: l.id || null
        };
      });
    },

    getWeekStart: function(d) {
      var d2 = new Date(d);
      var day = d2.getDay();
      var diff = (day === 0 ? -6 : 1) - day;
      d2.setDate(d2.getDate() + diff);
      d2.setHours(0, 0, 0, 0);
      return d2;
    },

    getDateStr: function(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },

    formatWeekLabel: function(start) {
      var end = new Date(start);
      end.setDate(end.getDate() + 6);
      return start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' – ' +
        end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    },

    getMonthStart: function(d) {
      var d2 = new Date(d.getFullYear(), d.getMonth(), 1);
      d2.setHours(0, 0, 0, 0);
      return d2;
    },

    formatMonthLabel: function(monthStart) {
      return monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    },

    id: id,

    collectTimetable: function(slots, periodTimes) {
      if (!state.timetable) state.timetable = {};
      state.timetable.slots = slots || [];
      state.timetable.periodTimes = (periodTimes && Object.keys(periodTimes).length) ? periodTimes : undefined;
    },

    upsertSlot: function(day, period, fields) {
      if (!state.timetable) state.timetable = { slots: [] };
      if (!state.timetable.slots) state.timetable.slots = [];
      var dayKey = String(day || '').toLowerCase();
      var p = parseInt(period, 10);
      if (!dayKey || isNaN(p) || p < 1) return null;
      var idx = state.timetable.slots.findIndex(function(s) {
        return String(s.day || '').toLowerCase() === dayKey && parseInt(s.period, 10) === p;
      });
      var next = Object.assign({
        id: id(),
        day: dayKey,
        period: p,
        subject: 'other',
        className: '',
        room: ''
      }, fields || {}, { day: dayKey, period: p });
      if (idx >= 0) {
        next.id = state.timetable.slots[idx].id || next.id;
        state.timetable.slots[idx] = Object.assign({}, state.timetable.slots[idx], next);
        return state.timetable.slots[idx];
      }
      state.timetable.slots.push(next);
      return next;
    },

    clearSlot: function(day, period) {
      if (!state.timetable || !state.timetable.slots) return;
      var dayKey = String(day || '').toLowerCase();
      var p = parseInt(period, 10);
      state.timetable.slots = state.timetable.slots.filter(function(s) {
        return !(String(s.day || '').toLowerCase() === dayKey && parseInt(s.period, 10) === p);
      });
    },

    upsertLesson: function(payload, editingId) {
      var lessons = state.lessons.lessons || [];
      var existingIdx = lessons.findIndex(function(l) { return l.date === payload.date && l.slotKey === payload.slotKey; });
      var existing = existingIdx >= 0 ? lessons[existingIdx] : null;
      var todos = Array.isArray(payload.todos) ? payload.todos : (existing && existing.todos) ? existing.todos : [];
      var homework = payload.homework !== undefined
        ? normalizeHomework(payload.homework)
        : (existing ? existing.homework : null);
      var normalized = Object.assign({}, payload, { todos: todos, homework: homework });
      if (normalized.ink && typeof normalized.ink === 'object') {
        try { normalized.ink = JSON.parse(JSON.stringify(normalized.ink)); }
        catch (err) { normalized.ink = { version: 1, paper: 'lined', strokes: [] }; }
      }
      if (editingId) {
        var idx = lessons.findIndex(function(l) { return l.id === editingId; });
        if (idx >= 0) {
          lessons[idx] = Object.assign({ id: lessons[idx].id, createdAt: lessons[idx].createdAt }, normalized);
          state.lessons.lessons = lessons;
          return;
        }
      }
      if (existingIdx >= 0) {
        lessons[existingIdx] = Object.assign({ id: lessons[existingIdx].id, createdAt: lessons[existingIdx].createdAt }, normalized);
      } else {
        lessons.push(Object.assign({ id: id(), createdAt: new Date().toISOString() }, normalized));
      }
      state.lessons.lessons = lessons;
    },

    toggleTodo: function(lessonId, todoId) {
      var lessons = state.lessons.lessons || [];
      var lesson = lessons.find(function(l) { return l.id === lessonId; });
      if (!lesson || !Array.isArray(lesson.todos)) return;
      var todo = lesson.todos.find(function(t) { return t.id === todoId; });
      if (todo) todo.done = !todo.done;
    },

    addTodo: function(lessonId, text) {
      var lessons = state.lessons.lessons || [];
      var lesson = lessons.find(function(l) { return l.id === lessonId; });
      if (!lesson) return;
      if (!Array.isArray(lesson.todos)) lesson.todos = [];
      lesson.todos.push({ id: id(), text: text || '', done: false });
    },

    removeTodo: function(lessonId, todoId) {
      var lessons = state.lessons.lessons || [];
      var lesson = lessons.find(function(l) { return l.id === lessonId; });
      if (!lesson || !Array.isArray(lesson.todos)) return;
      lesson.todos = lesson.todos.filter(function(t) { return t.id !== todoId; });
    },

    removeLesson: function(lessonId) {
      state.lessons.lessons = (state.lessons.lessons || []).filter(function(l) { return l.id !== lessonId; });
    },

    copyLessonsFromPreviousWeek: function(weekStart, options) {
      options = options || {};
      var skipExisting = options.skipExisting !== false;
      var fromStart = new Date(weekStart);
      fromStart.setDate(fromStart.getDate() - 7);
      var copied = [];
      var skipped = 0;
      var sourceCount = 0;
      var self = this;
      DAYS.forEach(function(day, j) {
        var fromD = new Date(fromStart);
        fromD.setDate(fromD.getDate() + j);
        var toD = new Date(weekStart);
        toD.setDate(toD.getDate() + j);
        var fromStr = self.getDateStr(fromD);
        var toStr = self.getDateStr(toD);
        for (var p = 1; p <= 7; p++) {
          var sk = self.slotKey(day, p);
          var src = self.getLessonFor(fromStr, sk);
          if (!src) continue;
          sourceCount++;
          var dest = self.getLessonFor(toStr, sk);
          if (dest && skipExisting) {
            skipped++;
            continue;
          }
          if (options.dryRun) {
            copied.push({ date: toStr, slotKey: sk });
            continue;
          }
          var clone = JSON.parse(JSON.stringify(src));
          delete clone.id;
          delete clone.createdAt;
          clone.date = toStr;
          clone.slotKey = sk;
          clone.updatedAt = new Date().toISOString();
          if (clone.status === 'complete') clone.status = 'planned';
          if (Array.isArray(clone.todos)) {
            clone.todos = clone.todos.map(function(t) {
              return { id: id(), text: (t && t.text) || '', done: false };
            });
          }
          if (clone.homework && typeof clone.homework === 'object') {
            clone.homework = Object.assign({}, clone.homework, { collected: false });
          }
          self.upsertLesson(clone, dest ? dest.id : null);
          var saved = self.getLessonFor(toStr, sk);
          copied.push({
            date: toStr,
            slotKey: sk,
            newId: saved && saved.id,
            previous: dest ? dest : null
          });
        }
      });
      var fromKey = this.getDateStr(fromStart);
      var toKey = this.getDateStr(new Date(weekStart));
      var noteCopied = false;
      var prevNote = '';
      if (!String(this.getWeekNote(toKey) || '').trim()) {
        var srcNote = this.getWeekNote(fromKey);
        if (srcNote && String(srcNote).trim()) {
          if (!options.dryRun) {
            prevNote = this.getWeekNote(toKey) || '';
            this.setWeekNote(toKey, srcNote);
          }
          noteCopied = true;
        }
      }
      return {
        copied: copied.length,
        skipped: skipped,
        sourceCount: sourceCount,
        noteCopied: noteCopied,
        copiedSlots: copied,
        noteKey: toKey,
        previousNote: prevNote
      };
    },

    getTemplates: function() {
      return (state.lessonPlanTemplates.templates || []).slice();
    },

    saveTemplate: function(template) {
      if (!state.lessonPlanTemplates) state.lessonPlanTemplates = { templates: [] };
      var templates = state.lessonPlanTemplates.templates || [];
      var existing = template.id ? templates.find(function(t) { return t.id === template.id; }) : null;
      var toSave = Object.assign({ id: template.id || id(), createdAt: (existing && existing.createdAt) || new Date().toISOString() }, template);
      if (existing) {
        var idx = templates.indexOf(existing);
        templates[idx] = toSave;
      } else {
        templates.push(toSave);
      }
      state.lessonPlanTemplates.templates = templates;
      return window.DataService ? DataService.set('lessonPlanTemplates', state.lessonPlanTemplates) : Promise.resolve();
    },

    deleteTemplate: function(templateId) {
      state.lessonPlanTemplates.templates = (state.lessonPlanTemplates.templates || []).filter(function(t) { return t.id !== templateId; });
      return window.DataService ? DataService.set('lessonPlanTemplates', state.lessonPlanTemplates) : Promise.resolve();
    },

    setEditingLessonId: function(id) { state.editingLessonId = id; },
    getEditingLessonId: function() { return state.editingLessonId; },
    setCurrentWeekStart: function(d) { state.currentWeekStart = d; },
    getCurrentWeekStart: function() { return state.currentWeekStart; },
    setCurrentMonthStart: function(d) { state.currentMonthStart = d; },
    getCurrentMonthStart: function() { return state.currentMonthStart; },
    setCurrentDayViewDate: function(d) { state.currentDayViewDate = d; },
    getCurrentDayViewDate: function() { return state.currentDayViewDate; },
    setEditingTemplateId: function(id) { state.editingTemplateId = id; },
    getEditingTemplateId: function() { return state.editingTemplateId; },
    getTemplateById: function(id) {
      return (state.lessonPlanTemplates.templates || []).find(function(t) { return t.id === id; });
    },

    saveSchemesOfWork: function() {
      return window.DataService ? DataService.set('plannerSchemesOfWork', state.schemesOfWork) : Promise.resolve();
    },

    getSchemeUnits: function() {
      return (state.schemesOfWork.units || []).slice();
    },

    getSchemeUnitById: function(unitId) {
      return (state.schemesOfWork.units || []).find(function(u) { return u.id === unitId; }) || null;
    },

    addSchemeUnit: function(payload) {
      if (!state.schemesOfWork) state.schemesOfWork = { units: [] };
      var now = new Date().toISOString();
      var u = Object.assign({
        id: id(),
        title: '',
        subject: '',
        yearGroup: '',
        curriculumUnitKey: '',
        startDate: '',
        endDate: '',
        overview: '',
        accentKey: 'subject',
        lessons: [],
        createdAt: now,
        updatedAt: now
      }, payload);
      state.schemesOfWork.units = state.schemesOfWork.units || [];
      state.schemesOfWork.units.push(u);
      return u;
    },

    updateSchemeUnit: function(unitId, patch) {
      var units = state.schemesOfWork.units || [];
      var idx = units.findIndex(function(x) { return x.id === unitId; });
      if (idx < 0) return null;
      units[idx] = Object.assign({}, units[idx], patch, { updatedAt: new Date().toISOString() });
      return units[idx];
    },

    deleteSchemeUnit: function(unitId) {
      state.schemesOfWork.units = (state.schemesOfWork.units || []).filter(function(x) { return x.id !== unitId; });
    },

    /**
     * Snapshot fields from a lesson-bank template for embedding in a scheme lesson row.
     */
    copyTemplateFieldsToSchemeLesson: function(template) {
      if (!template) return null;
      var resources = Array.isArray(template.resources) ? template.resources.map(function(r) {
        return { label: (r && r.label) ? String(r.label) : '', url: (r && r.url) ? String(r.url) : '' };
      }) : [];
      var todos = Array.isArray(template.todos) ? template.todos.map(function(t) {
        return { text: (t && t.text) ? String(t.text) : '', done: false };
      }) : [];
      var resStr = resourcesArrayToString(resources);
      var bodyHtml = String(template.body || '').trim();
      var bodyPlain = bodyHtml ? stripHtmlBasic(bodyHtml) : '';
      var li = String(template.learningIntentions || template.objectives || '').trim();
      var sc = String(template.successCriteria || '').trim();
      var actParts = [template.activity, template.differentiation, template.effectiveQuestions, template.digitalTechnologies, template.notes]
        .filter(function(x) { return x && String(x).trim(); })
        .map(function(x) { return String(x).trim(); });
      var activitiesStr = bodyPlain || actParts.join('\n\n');
      if (!li && bodyPlain) {
        var liMatch = bodyPlain.match(/Learning intentions?\s*\n+([^\n]+(?:\n(?!Success criteria|Activity|Differentiation|Notes)[^\n]+)*)/i);
        if (liMatch) li = liMatch[1].trim();
      }
      if (!sc && bodyPlain) {
        var scMatch = bodyPlain.match(/Success criteria\s*\n+([^\n]+(?:\n(?!Activity|Differentiation|Notes)[^\n]+)*)/i);
        if (scMatch) sc = scMatch[1].trim();
      }
      return {
        title: String((template.title || template.name || '').trim() || 'Untitled'),
        status: 'complete',
        learningIntention: li,
        successCriteria: sc,
        activities: activitiesStr,
        resources: resStr,
        notes: activitiesStr,
        copiedFromTemplateId: template.id || null,
        copiedAt: new Date().toISOString(),
        bankPlan: {
          name: template.name || '',
          title: template.title || '',
          subject: template.subject || '',
          unitKey: template.unitKey || '',
          body: bodyHtml,
          objectives: template.objectives || '',
          learningIntentions: template.learningIntentions || '',
          successCriteria: template.successCriteria || '',
          activity: template.activity || '',
          differentiation: template.differentiation || '',
          effectiveQuestions: template.effectiveQuestions || '',
          digitalTechnologies: template.digitalTechnologies || '',
          notes: template.notes || bodyPlain,
          resources: resources,
          todos: todos
        }
      };
    },

    addSchemeLesson: function(unitId, lessonPartial) {
      var unit = (state.schemesOfWork.units || []).find(function(x) { return x.id === unitId; });
      if (!unit) return null;
      var lessons = unit.lessons || [];
      var maxOrder = lessons.reduce(function(m, l) { return Math.max(m, typeof l.order === 'number' ? l.order : -1); }, -1);
      var partial = lessonPartial || {};
      var desiredOrder = partial.order;
      var copy = Object.assign({}, partial);
      delete copy.order;
      var row = Object.assign({
        id: id(),
        title: '',
        notes: '',
        order: maxOrder + 1,
        status: 'planned',
        learningIntention: '',
        successCriteria: '',
        activities: '',
        resources: ''
      }, copy);
      if (desiredOrder !== undefined && desiredOrder !== null && desiredOrder !== '') {
        var o = parseInt(desiredOrder, 10);
        if (!isNaN(o)) row.order = o;
      }
      if (row.activities && !row.notes) row.notes = row.activities;
      lessons.push(row);
      lessons.sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
      lessons.forEach(function(l, i) { l.order = i; });
      unit.lessons = lessons;
      unit.updatedAt = new Date().toISOString();
      return row;
    },

    updateSchemeLesson: function(unitId, lessonId, patch) {
      var unit = (state.schemesOfWork.units || []).find(function(x) { return x.id === unitId; });
      if (!unit || !unit.lessons) return null;
      var L = unit.lessons.find(function(l) { return l.id === lessonId; });
      if (!L) return null;
      var p = Object.assign({}, patch);
      if (p.activities !== undefined && p.notes === undefined) p.notes = p.activities;
      if (p.notes !== undefined && p.activities === undefined) p.activities = p.notes;
      Object.assign(L, p);
      if (p.order !== undefined && p.order !== null && p.order !== '') {
        var o = parseInt(p.order, 10);
        if (!isNaN(o)) L.order = o;
        unit.lessons.sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
        unit.lessons.forEach(function(l, i) { l.order = i; });
      }
      unit.updatedAt = new Date().toISOString();
      return L;
    },

    deleteSchemeLesson: function(unitId, lessonId) {
      var unit = (state.schemesOfWork.units || []).find(function(x) { return x.id === unitId; });
      if (!unit || !unit.lessons) return;
      unit.lessons = unit.lessons.filter(function(l) { return l.id !== lessonId; });
      unit.lessons.forEach(function(l, i) { l.order = i; });
      unit.updatedAt = new Date().toISOString();
    },

    /** delta -1 = move earlier, +1 = move later */
    reorderSchemeLesson: function(unitId, lessonId, delta) {
      var unit = (state.schemesOfWork.units || []).find(function(x) { return x.id === unitId; });
      if (!unit || !unit.lessons) return;
      var lessons = unit.lessons.slice().sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
      var i = lessons.findIndex(function(l) { return l.id === lessonId; });
      if (i < 0) return;
      var j = i + delta;
      if (j < 0 || j >= lessons.length) return;
      var tmp = lessons[i];
      lessons[i] = lessons[j];
      lessons[j] = tmp;
      lessons.forEach(function(l, idx) { l.order = idx; });
      unit.lessons = lessons;
      unit.updatedAt = new Date().toISOString();
    }
  };
})();
