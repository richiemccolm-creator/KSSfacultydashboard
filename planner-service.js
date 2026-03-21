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
    currentWeekStart: null,
    currentDayViewDate: null,
    editingLessonId: null
  };

  function id() { return 'x' + Math.random().toString(36).substr(2, 9); }

  window.PlannerService = {
    DAYS: DAYS,
    PERIODS: PERIODS,

    load: function() {
      var self = this;
      return Promise.all([
        (window.DataService && DataService.get ? DataService.get('plannerTimetable') : Promise.resolve(null)),
        (window.DataService && DataService.get ? DataService.get('plannerLessons') : Promise.resolve(null))
      ]).then(function(res) {
        state.timetable = res[0] && res[0].slots ? res[0] : { slots: [] };
        state.lessons = res[1] && res[1].lessons ? res[1] : { lessons: [] };
        return self.getState();
      });
    },

    saveTimetable: function() {
      return window.DataService ? DataService.set('plannerTimetable', state.timetable) : Promise.resolve();
    },

    saveLessons: function() {
      return window.DataService ? DataService.set('plannerLessons', state.lessons) : Promise.resolve();
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

    id: id,

    collectTimetable: function(slots, periodTimes) {
      if (!state.timetable) state.timetable = {};
      state.timetable.slots = slots || [];
      state.timetable.periodTimes = (periodTimes && Object.keys(periodTimes).length) ? periodTimes : undefined;
    },

    upsertLesson: function(payload, editingId) {
      var lessons = state.lessons.lessons || [];
      var existingIdx = lessons.findIndex(function(l) { return l.date === payload.date && l.slotKey === payload.slotKey; });
      if (editingId) {
        var idx = lessons.findIndex(function(l) { return l.id === editingId; });
        if (idx >= 0) {
          lessons[idx] = Object.assign({ id: lessons[idx].id, createdAt: lessons[idx].createdAt }, payload);
          state.lessons.lessons = lessons;
          return;
        }
      }
      if (existingIdx >= 0) {
        lessons[existingIdx] = Object.assign({ id: lessons[existingIdx].id, createdAt: lessons[existingIdx].createdAt }, payload);
      } else {
        lessons.push(Object.assign({ id: id(), createdAt: new Date().toISOString() }, payload));
      }
      state.lessons.lessons = lessons;
    },

    removeLesson: function(lessonId) {
      state.lessons.lessons = (state.lessons.lessons || []).filter(function(l) { return l.id !== lessonId; });
    },

    setEditingLessonId: function(id) { state.editingLessonId = id; },
    getEditingLessonId: function() { return state.editingLessonId; },
    setCurrentWeekStart: function(d) { state.currentWeekStart = d; },
    getCurrentWeekStart: function() { return state.currentWeekStart; },
    setCurrentDayViewDate: function(d) { state.currentDayViewDate = d; },
    getCurrentDayViewDate: function() { return state.currentDayViewDate; }
  };
})();
