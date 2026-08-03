/**
 * Import N5 Creative Industries sessions into Teacher Planner period slots.
 */
(function () {
  var CI_DAYS = ['tuesday', 'wednesday', 'friday'];
  var CI_CLASS_RE = /\bci\b|creative\s*ind|creative\s*industries|n5\s*ci|skills\s*for\s*work|sfw/i;
  var CI_YEAR_RE = /^(5|s5|s6|senior)/i;

  function slotKey(day, period) {
    return String(day || '').toLowerCase() + '-' + period;
  }

  function isCiSlot(slot) {
    if (!slot) return false;
    var cls = String(slot.className || '');
    if (CI_CLASS_RE.test(cls)) return true;
    if (String(slot.subject || '') === 'drama' && CI_YEAR_RE.test(cls.trim())) return true;
    return false;
  }

  function pickSlotForDay(daySlots) {
    if (!daySlots || !daySlots.length) return null;
    var ci = daySlots.filter(isCiSlot);
    if (ci.length === 1) return ci[0];
    if (ci.length > 1) return ci[0];
    if (daySlots.length === 1) return daySlots[0];
    var drama = daySlots.filter(function (s) { return String(s.subject || '') === 'drama'; });
    if (drama.length === 1) return drama[0];
    return null;
  }

  function slotLabel(slot) {
    if (!slot) return '';
    var day = String(slot.day || '');
    var cap = day.charAt(0).toUpperCase() + day.slice(1);
    var cls = slot.className ? (' — ' + slot.className) : '';
    var room = slot.room ? (' · ' + slot.room) : '';
    return cap + ' P' + slot.period + cls + room;
  }

  function slidesUrl(slidesFile) {
    if (!slidesFile) return '';
    var url = String(slidesFile);
    if (window.withAppVersion) url = window.withAppVersion(url);
    return url;
  }

  function buildLessonBody(meta) {
    if (!meta) return '';
    var parts = [];
    if (meta.unitLabel && meta.unitTitle) {
      parts.push('<p><strong>' + meta.unitLabel + ' — ' + meta.unitTitle + '</strong></p>');
    }
    parts.push('<p>Session ' + meta.session + '</p>');
    if (meta.slides) {
      var href = slidesUrl(meta.slides);
      parts.push('<p><a href="' + href + '" target="_blank" rel="noopener noreferrer">Open lesson slides</a></p>');
    }
    return parts.join('');
  }

  function buildLessonPayload(entry, meta, slotKeyVal) {
    var resources = [];
    var slidesFile = meta && meta.slides ? String(meta.slides) : '';
    if (slidesFile) {
      resources.push({ label: 'Lesson slides (S' + entry.session + ')', url: slidesUrl(slidesFile) });
    }
    return {
      date: entry.date,
      slotKey: slotKeyVal,
      subject: 'drama',
      unitKey: '',
      title: meta ? meta.title : ('Session ' + entry.session),
      lessonNumber: 'S' + entry.session,
      body: buildLessonBody(meta),
      notes: '',
      resources: resources,
      todos: [],
      status: 'planned',
      slidesSubject: slidesFile ? 'drama' : '',
      slidesUnitId: meta ? (meta.unitId || '') : '',
      slidesLessonId: meta && meta.session != null ? String(meta.session) : '',
      slidesFile: slidesFile,
      slidesTitle: meta ? meta.title : ('Session ' + entry.session),
      slidesIsHub: false,
      n5CiSession: entry.session,
      n5CiUnit: meta ? meta.unitId : '',
      n5CiImportedAt: new Date().toISOString()
    };
  }

  function shouldReplace(existing, mode) {
    if (!existing) return true;
    if (mode === 'replaceAll') return true;
    if (mode === 'replaceCi') return !!(existing.n5CiSession || existing.n5CiImportedAt);
    return false;
  }

  window.N5CiPlannerImport = {
    CI_DAYS: CI_DAYS,
    isCiSlot: isCiSlot,
    slotLabel: slotLabel,

    /** Slots on Tue/Wed/Fri from the user's timetable. */
    getSlotsForDay: function (slots, day) {
      return (slots || []).filter(function (s) {
        return String(s.day || '').toLowerCase() === day;
      }).sort(function (a, b) { return (a.period || 0) - (b.period || 0); });
    },

    /** Best-guess CI slot per teaching day. */
    detectSlotKeysByDay: function (slots) {
      var out = {};
      var self = this;
      CI_DAYS.forEach(function (day) {
        var pick = pickSlotForDay(self.getSlotsForDay(slots, day));
        if (pick) out[day] = slotKey(pick.day, pick.period);
      });
      return out;
    },

    buildPlan: function (options) {
      var PS = window.PlannerService;
      var helpers = window.N5_CI_SCHEDULE_HELPERS;
      if (!PS || !helpers || !window.N5_CI_SCHEDULE) {
        return { error: 'Planner or N5 CI schedule not loaded', items: [] };
      }
      options = options || {};
      var slotKeysByDay = options.slotKeysByDay || {};
      var mode = options.mode || 'skipExisting';
      var fromSession = parseInt(options.fromSession, 10) || 1;
      var toSession = parseInt(options.toSession, 10) || 61;
      var entries = helpers.getRange(fromSession, toSession, options.yearOffset);
      var yearOffset = helpers.resolveYearOffset(options.yearOffset);
      var items = [];
      var counts = { add: 0, skip: 0, noSlot: 0 };

      entries.forEach(function (entry) {
        var day = entry.day;
        var sk = slotKeysByDay[day];
        if (!sk) {
          counts.noSlot++;
          items.push({ entry: entry, action: 'noSlot' });
          return;
        }
        var meta = helpers.getSessionMeta(entry.session);
        var existing = PS.getLessonFor(entry.date, sk);
        if (existing && !shouldReplace(existing, mode)) {
          counts.skip++;
          items.push({ entry: entry, slotKey: sk, meta: meta, action: 'skip', existing: existing });
          return;
        }
        counts.add++;
        items.push({
          entry: entry,
          slotKey: sk,
          meta: meta,
          action: existing ? 'replace' : 'add',
          payload: buildLessonPayload(entry, meta, sk),
          existingId: existing ? existing.id : null
        });
      });

      return {
        items: items,
        counts: counts,
        fromSession: fromSession,
        toSession: toSession,
        yearOffset: yearOffset,
        dateRange: helpers.formatDateRange(entries.filter(function (e) {
          return slotKeysByDay[e.day];
        }))
      };
    },

    run: function (plan) {
      var PS = window.PlannerService;
      if (!PS || !plan || !plan.items) return Promise.reject(new Error('Invalid import plan'));
      var applied = 0;
      plan.items.forEach(function (item) {
        if (item.action !== 'add' && item.action !== 'replace') return;
        PS.upsertLesson(item.payload, item.existingId || null);
        applied++;
      });
      return PS.saveLessons().then(function () {
        var firstDate = null;
        plan.items.forEach(function (item) {
          if ((item.action === 'add' || item.action === 'replace') && item.payload && item.payload.date) {
            if (!firstDate || item.payload.date < firstDate) firstDate = item.payload.date;
          }
        });
        return {
          applied: applied,
          counts: plan.counts,
          firstDate: firstDate,
          dateRange: plan.dateRange || '',
          totalLessons: (PS.getState().lessons && PS.getState().lessons.lessons) ? PS.getState().lessons.lessons.length : 0
        };
      });
    },

    countImportedLessons: function () {
      var PS = window.PlannerService;
      if (!PS || !PS.getState) return 0;
      var lessons = (PS.getState().lessons && PS.getState().lessons.lessons) || [];
      return lessons.filter(function (l) { return l && (l.n5CiSession || l.n5CiImportedAt); }).length;
    }
  };
})();
