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
    lessonPlanTemplates: { templates: [] },
    schemesOfWork: { units: [] },
    currentWeekStart: null,
    currentMonthStart: null,
    currentDayViewDate: null,
    editingLessonId: null,
    editingTemplateId: null
  };

  function id() { return 'x' + Math.random().toString(36).substr(2, 9); }

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
  }

  function normalizeUnit(u) {
    if (!u || typeof u !== 'object') return;
    if (u.startDate === undefined) u.startDate = '';
    if (u.endDate === undefined) u.endDate = '';
    if (u.overview === undefined) u.overview = '';
    if (!Array.isArray(u.lessons)) u.lessons = [];
    u.lessons.forEach(normalizeLesson);
  }

  function normalizeSchemesOfWorkBlob(blob) {
    if (!blob || typeof blob !== 'object') return;
    if (!Array.isArray(blob.units)) blob.units = [];
    blob.units.forEach(normalizeUnit);
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
        (window.DataService && DataService.get ? DataService.get('lessonPlanTemplates') : Promise.resolve(null)),
        (window.DataService && DataService.get ? DataService.get('plannerSchemesOfWork') : Promise.resolve(null))
      ]).then(function(res) {
        state.timetable = res[0] && res[0].slots ? res[0] : { slots: [] };
        state.lessons = res[1] && res[1].lessons ? res[1] : { lessons: [] };
        state.weekNotes = res[2] && typeof res[2] === 'object' ? res[2] : {};
        state.lessonPlanTemplates = res[3] && res[3].templates ? res[3] : { templates: [] };
        state.schemesOfWork = res[4] && res[4].units ? res[4] : { units: [] };
        normalizeSchemesOfWorkBlob(state.schemesOfWork);
        return self.getState();
      });
    },

    saveTimetable: function() {
      return window.DataService ? DataService.set('plannerTimetable', state.timetable) : Promise.resolve();
    },

    resetTimetableForNewYear: function() {
      if (!state.timetable) state.timetable = {};
      state.timetable.slots = [];
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

    upsertLesson: function(payload, editingId) {
      var lessons = state.lessons.lessons || [];
      var existingIdx = lessons.findIndex(function(l) { return l.date === payload.date && l.slotKey === payload.slotKey; });
      var existing = existingIdx >= 0 ? lessons[existingIdx] : null;
      var todos = Array.isArray(payload.todos) ? payload.todos : (existing && existing.todos) ? existing.todos : [];
      var normalized = Object.assign({}, payload, { todos: todos });
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
      var li = String(template.learningIntentions || template.objectives || '').trim();
      var sc = String(template.successCriteria || '').trim();
      var actParts = [template.activity, template.differentiation, template.effectiveQuestions, template.digitalTechnologies, template.notes]
        .filter(function(x) { return x && String(x).trim(); })
        .map(function(x) { return String(x).trim(); });
      var activitiesStr = actParts.join('\n\n');
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
          objectives: template.objectives || '',
          learningIntentions: template.learningIntentions || '',
          successCriteria: template.successCriteria || '',
          activity: template.activity || '',
          differentiation: template.differentiation || '',
          effectiveQuestions: template.effectiveQuestions || '',
          digitalTechnologies: template.digitalTechnologies || '',
          notes: template.notes || '',
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
