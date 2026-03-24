/**
 * Personal task board (Planner-style buckets + tasks). Stored as teacherTasksV1 in pupil_data.
 */
(function() {
  var DATA_KEY = 'teacherTasksV1';

  function rid() {
    return 't' + Math.random().toString(36).substr(2, 11);
  }

  var state = { buckets: [], tasks: [] };

  function defaultBuckets() {
    var b = [
      { id: rid(), title: 'This week', sort: 0 },
      { id: rid(), title: 'Planning', sort: 1 },
      { id: rid(), title: 'Admin', sort: 2 },
      { id: rid(), title: 'Someday', sort: 3 }
    ];
    return b;
  }

  function ensureState(raw) {
    if (!raw || typeof raw !== 'object') raw = {};
    var buckets = Array.isArray(raw.buckets) ? raw.buckets.slice() : [];
    var tasks = Array.isArray(raw.tasks) ? raw.tasks.slice() : [];
    buckets = buckets.map(function(b, i) {
      return {
        id: b.id || rid(),
        title: (b.title || 'Untitled').trim() || 'Untitled',
        sort: typeof b.sort === 'number' ? b.sort : i
      };
    });
    if (buckets.length === 0) buckets = defaultBuckets();
    buckets.sort(function(a, b) { return (a.sort || 0) - (b.sort || 0); });
    tasks = tasks.map(function(t) {
      return normalizeTask(t, buckets);
    });
    state.buckets = buckets;
    state.tasks = tasks;
    return state;
  }

  function normalizeTask(t, buckets) {
    var bid = t.bucketId;
    var valid = buckets.some(function(b) { return b.id === bid; });
    if (!valid) bid = buckets[0] ? buckets[0].id : null;
    var checklist = Array.isArray(t.checklist) ? t.checklist.map(function(c) {
      return { id: c.id || rid(), text: (c.text || '').trim(), done: !!c.done };
    }) : [];
    return {
      id: t.id || rid(),
      bucketId: bid,
      title: (t.title || '').trim() || 'Untitled task',
      notes: typeof t.notes === 'string' ? t.notes : '',
      dueDate: t.dueDate || null,
      priority: t.priority === 'low' || t.priority === 'high' ? t.priority : 'normal',
      completed: !!t.completed,
      checklist: checklist,
      sort: typeof t.sort === 'number' ? t.sort : 0,
      createdAt: t.createdAt || new Date().toISOString()
    };
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  window.TeacherTasksService = {
    DATA_KEY: DATA_KEY,

    load: function() {
      var self = this;
      return (window.DataService && DataService.get ? DataService.get(DATA_KEY) : Promise.resolve(null)).then(function(raw) {
        ensureState(raw);
        return self.getState();
      });
    },

    save: function() {
      var payload = { buckets: state.buckets, tasks: state.tasks };
      return window.DataService ? DataService.set(DATA_KEY, payload) : Promise.resolve();
    },

    getState: function() {
      return { buckets: state.buckets.slice(), tasks: state.tasks.slice() };
    },

    getBucketById: function(id) {
      return state.buckets.find(function(b) { return b.id === id; });
    },

    addBucket: function(title) {
      var maxSort = state.buckets.reduce(function(m, b) { return Math.max(m, b.sort || 0); }, -1);
      var b = { id: rid(), title: (title || 'New list').trim() || 'New list', sort: maxSort + 1 };
      state.buckets.push(b);
      return this.save().then(function() { return b; });
    },

    renameBucket: function(bucketId, title) {
      var b = state.buckets.find(function(x) { return x.id === bucketId; });
      if (b) b.title = (title || '').trim() || b.title;
      return this.save();
    },

    removeBucket: function(bucketId) {
      if (state.buckets.length <= 1) return Promise.resolve();
      var fallback = state.buckets.find(function(b) { return b.id !== bucketId; });
      if (!fallback) return Promise.resolve();
      state.tasks.forEach(function(t) {
        if (t.bucketId === bucketId) t.bucketId = fallback.id;
      });
      state.buckets = state.buckets.filter(function(b) { return b.id !== bucketId; });
      return this.save();
    },

    addTask: function(bucketId, partial) {
      var b = state.buckets.find(function(x) { return x.id === bucketId; });
      if (!b && state.buckets[0]) bucketId = state.buckets[0].id;
      var maxSort = state.tasks.filter(function(t) { return t.bucketId === bucketId; }).reduce(function(m, t) { return Math.max(m, t.sort || 0); }, -1);
      var task = normalizeTask(Object.assign({
        title: (partial && partial.title) || 'New task',
        bucketId: bucketId,
        sort: maxSort + 1
      }, partial || {}), state.buckets);
      state.tasks.push(task);
      return this.save().then(function() { return task; });
    },

    updateTask: function(taskId, updates) {
      var idx = state.tasks.findIndex(function(t) { return t.id === taskId; });
      if (idx < 0) return Promise.resolve();
      var cur = state.tasks[idx];
      var merged = Object.assign({}, cur, updates);
      state.tasks[idx] = normalizeTask(merged, state.buckets);
      return this.save();
    },

    deleteTask: function(taskId) {
      state.tasks = state.tasks.filter(function(t) { return t.id !== taskId; });
      return this.save();
    },

    toggleTaskComplete: function(taskId) {
      var t = state.tasks.find(function(x) { return x.id === taskId; });
      if (t) t.completed = !t.completed;
      return this.save();
    },

    moveTaskToBucket: function(taskId, bucketId) {
      var t = state.tasks.find(function(x) { return x.id === taskId; });
      if (!t) return Promise.resolve();
      if (!state.buckets.some(function(b) { return b.id === bucketId; })) return Promise.resolve();
      t.bucketId = bucketId;
      var maxSort = state.tasks.filter(function(x) { return x.bucketId === bucketId && x.id !== taskId; }).reduce(function(m, x) { return Math.max(m, x.sort || 0); }, -1);
      t.sort = maxSort + 1;
      return this.save();
    },

    checklistProgress: function(task) {
      var items = task.checklist || [];
      if (items.length === 0) return null;
      var done = items.filter(function(c) { return c.done; }).length;
      return { done: done, total: items.length };
    },

    /** Incomplete tasks: overdue first, then today, then upcoming by date; then undated. */
    getHomePreviewTasks: function(opts) {
      opts = opts || {};
      var limit = typeof opts.limit === 'number' ? opts.limit : 8;
      var today = todayISO();
      var open = state.tasks.filter(function(t) { return !t.completed; });
      function dueKey(t) {
        if (!t.dueDate) return 2;
        if (t.dueDate < today) return 0;
        if (t.dueDate === today) return 1;
        return 2;
      }
      function cmp(a, b) {
        var ka = dueKey(a);
        var kb = dueKey(b);
        if (ka !== kb) return ka - kb;
        if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return (a.title || '').localeCompare(b.title || '');
      }
      open.sort(cmp);
      return open.slice(0, limit);
    },

    todayISO: todayISO
  };
})();
