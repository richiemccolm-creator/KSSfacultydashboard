/**
 * Personal task workspace — projects with status or bucket-column layouts.
 * Stored as teacherTasksV1 in pupil_data.
 */
(function() {
  var DATA_KEY = 'teacherTasksV1';
  var DEFAULT_PROJECT_TITLE = 'My tasks';

  var STATUSES = ['todo', 'in_progress', 'waiting', 'completed'];
  var STATUS_LABELS = {
    todo: 'To Do',
    in_progress: 'In Progress',
    waiting: 'Waiting',
    completed: 'Completed'
  };
  var PRIORITIES = ['low', 'normal', 'high'];
  var PRIORITY_LABELS = { low: 'Low', normal: 'Medium', high: 'High' };
  var PRIORITY_ORDER = { high: 0, normal: 1, low: 2 };
  var DEFAULT_CATEGORIES = ['Planning', 'Admin', 'Assessment', 'Meetings', 'General'];
  var LAYOUTS = ['status', 'buckets'];

  function rid() {
    return 't' + Math.random().toString(36).substr(2, 11);
  }

  function pid() {
    return 'p' + Math.random().toString(36).substr(2, 11);
  }

  function aid() {
    return 'a' + Math.random().toString(36).substr(2, 11);
  }

  var state = { projects: [], buckets: [], tasks: [] };

  function isValidStatus(s) {
    return STATUSES.indexOf(s) >= 0;
  }

  function isValidLayout(l) {
    return LAYOUTS.indexOf(l) >= 0;
  }

  function bucketTitleForId(buckets, bucketId) {
    var b = buckets.find(function(x) { return x.id === bucketId; });
    return b ? b.title : '';
  }

  function getDefaultProject() {
    return state.projects.find(function(p) { return p.isDefault; }) || state.projects[0] || null;
  }

  function getProjectById(id) {
    return state.projects.find(function(p) { return p.id === id; }) || null;
  }

  function bucketsForProject(projectId) {
    return state.buckets
      .filter(function(b) { return b.projectId === projectId; })
      .sort(function(a, b) { return (a.sort || 0) - (b.sort || 0); });
  }

  function normalizeAttachments(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(function(a) {
      return {
        id: a.id || aid(),
        type: a.type === 'link' ? 'link' : 'link',
        label: (a.label || a.name || '').trim() || 'Link',
        url: (a.url || '').trim(),
        addedAt: a.addedAt || new Date().toISOString()
      };
    }).filter(function(a) { return a.url; });
  }

  function normalizeTask(t, ctx) {
    ctx = ctx || {};
    var buckets = ctx.buckets || state.buckets || [];
    var projects = ctx.projects || state.projects || [];
    var defaultProject = projects.find(function(p) { return p.isDefault; }) || projects[0] || null;
    var checklist = Array.isArray(t.checklist) ? t.checklist.map(function(c) {
      return { id: c.id || rid(), text: (c.text || '').trim(), done: !!c.done };
    }) : [];

    var status = t.status;
    if (!isValidStatus(status)) {
      if (t.completed) status = 'completed';
      else status = 'todo';
    }

    var category = typeof t.category === 'string' ? t.category.trim() : '';
    if (!category && t.bucketId) {
      category = bucketTitleForId(buckets, t.bucketId);
    }

    var projectId = t.projectId;
    if (!projectId || !projects.some(function(p) { return p.id === projectId; })) {
      projectId = defaultProject ? defaultProject.id : null;
    }

    var project = projects.find(function(p) { return p.id === projectId; });
    var bid = t.bucketId || null;
    if (project && project.layout === 'buckets') {
      var projBuckets = buckets.filter(function(b) { return b.projectId === projectId; });
      if (!bid || !projBuckets.some(function(b) { return b.id === bid; })) {
        bid = projBuckets[0] ? projBuckets[0].id : null;
      }
    } else {
      bid = null;
    }

    var completed = status === 'completed';
    var now = new Date().toISOString();
    return {
      id: t.id || rid(),
      projectId: projectId,
      bucketId: bid,
      title: (t.title || '').trim() || 'Untitled task',
      status: status,
      category: category,
      description: typeof t.description === 'string' ? t.description : '',
      notes: typeof t.notes === 'string' ? t.notes : '',
      dueDate: t.dueDate || null,
      priority: t.priority === 'low' || t.priority === 'high' ? t.priority : 'normal',
      completed: completed,
      checklist: checklist,
      attachments: normalizeAttachments(t.attachments),
      comments: Array.isArray(t.comments) ? t.comments : [],
      sort: typeof t.sort === 'number' ? t.sort : 0,
      createdAt: t.createdAt || now,
      updatedAt: t.updatedAt || t.createdAt || now
    };
  }

  function migrateLegacyState(raw) {
    if (!raw || typeof raw !== 'object') raw = {};
    if (Array.isArray(raw.projects) && raw.projects.length) {
      return raw;
    }

    var oldBuckets = Array.isArray(raw.buckets) ? raw.buckets.slice() : [];
    var oldTasks = Array.isArray(raw.tasks) ? raw.tasks.slice() : [];
    var defaultProject = {
      id: pid(),
      title: DEFAULT_PROJECT_TITLE,
      layout: 'status',
      isDefault: true,
      sort: 0
    };
    var projects = [defaultProject];
    var buckets = [];
    var tasks = [];

    oldTasks.forEach(function(t) {
      var copy = Object.assign({}, t, { projectId: defaultProject.id });
      if (copy.bucketId) {
        var oldB = oldBuckets.find(function(b) { return b.id === copy.bucketId; });
        if (oldB && oldB.title && !copy.category) copy.category = oldB.title;
        copy.bucketId = null;
      }
      tasks.push(copy);
    });

    return { projects: projects, buckets: buckets, tasks: tasks };
  }

  function ensureState(raw) {
    raw = migrateLegacyState(raw);
    var projects = Array.isArray(raw.projects) ? raw.projects.slice() : [];
    var buckets = Array.isArray(raw.buckets) ? raw.buckets.slice() : [];
    var tasks = Array.isArray(raw.tasks) ? raw.tasks.slice() : [];

    projects = projects.map(function(p, i) {
      return {
        id: p.id || pid(),
        title: (p.title || 'Untitled').trim() || 'Untitled',
        layout: isValidLayout(p.layout) ? p.layout : 'status',
        isDefault: !!p.isDefault,
        sort: typeof p.sort === 'number' ? p.sort : i
      };
    });

    if (!projects.some(function(p) { return p.isDefault; })) {
      if (projects.length === 0) {
        projects.push({
          id: pid(),
          title: DEFAULT_PROJECT_TITLE,
          layout: 'status',
          isDefault: true,
          sort: 0
        });
      } else {
        projects[0].isDefault = true;
        projects[0].layout = 'status';
      }
    }

    projects.sort(function(a, b) {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return (a.sort || 0) - (b.sort || 0);
    });

    buckets = buckets.map(function(b, i) {
      return {
        id: b.id || rid(),
        projectId: b.projectId || (projects[0] ? projects[0].id : null),
        title: (b.title || 'Untitled').trim() || 'Untitled',
        sort: typeof b.sort === 'number' ? b.sort : i
      };
    }).filter(function(b) {
      if (!b.projectId) return false;
      var p = projects.find(function(x) { return x.id === b.projectId; });
      return p && p.layout === 'buckets';
    });

    projects.forEach(function(p) {
      if (p.layout === 'buckets' && !buckets.some(function(b) { return b.projectId === p.id; })) {
        buckets.push({ id: rid(), projectId: p.id, title: 'Tasks', sort: 0 });
      }
    });

    buckets.sort(function(a, b) { return (a.sort || 0) - (b.sort || 0); });

    var ctx = { projects: projects, buckets: buckets };
    tasks = tasks.map(function(t) {
      return normalizeTask(t, ctx);
    });

    state.projects = projects;
    state.buckets = buckets;
    state.tasks = tasks;
    return state;
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function parseISO(iso) {
    if (!iso) return null;
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3) return null;
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }

  function weekRangeISO() {
    var today = parseISO(todayISO());
    if (!today) return { start: todayISO(), end: todayISO() };
    var day = today.getDay();
    var diffToMon = day === 0 ? -6 : 1 - day;
    var mon = new Date(today);
    mon.setDate(today.getDate() + diffToMon);
    var sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    function fmt(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    return { start: fmt(mon), end: fmt(sun) };
  }

  function isOpenTask(t) {
    return t.status !== 'completed';
  }

  function daysOverdue(dueDate) {
    var today = parseISO(todayISO());
    var due = parseISO(dueDate);
    if (!today || !due) return 0;
    return Math.floor((today - due) / 86400000);
  }

  function taskSearchText(t) {
    return [t.title, t.description, t.notes, t.category].join(' ').toLowerCase();
  }

  function sortTasks(list, sortBy) {
    var arr = list.slice();
    sortBy = sortBy || 'due';
    if (sortBy === 'priority') {
      arr.sort(function(a, b) {
        var pa = PRIORITY_ORDER[a.priority] != null ? PRIORITY_ORDER[a.priority] : 1;
        var pb = PRIORITY_ORDER[b.priority] != null ? PRIORITY_ORDER[b.priority] : 1;
        if (pa !== pb) return pa - pb;
        return (a.title || '').localeCompare(b.title || '');
      });
    } else if (sortBy === 'updated') {
      arr.sort(function(a, b) {
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      });
    } else if (sortBy === 'title') {
      arr.sort(function(a, b) {
        return (a.title || '').localeCompare(b.title || '');
      });
    } else {
      arr.sort(function(a, b) {
        if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return (a.sort || 0) - (b.sort || 0);
      });
    }
    return arr;
  }

  function applyFilters(filters) {
    filters = filters || {};
    var q = (filters.search || '').trim().toLowerCase();
    var priority = filters.priority || 'all';
    var status = filters.status || 'all';
    var category = filters.category || 'all';
    var projectId = filters.projectId || null;
    var bucketId = filters.bucketId || null;
    var dueFilter = filters.dueFilter || 'all';

    var list = state.tasks.slice();
    if (projectId) {
      list = list.filter(function(t) { return t.projectId === projectId; });
    }
    if (q) {
      list = list.filter(function(t) { return taskSearchText(t).indexOf(q) >= 0; });
    }
    if (priority !== 'all') {
      list = list.filter(function(t) { return t.priority === priority; });
    }
    if (status !== 'all') {
      list = list.filter(function(t) { return t.status === status; });
    }
    if (bucketId) {
      list = list.filter(function(t) { return t.bucketId === bucketId; });
    }
    if (category !== 'all') {
      list = list.filter(function(t) { return (t.category || '') === category; });
    }
    if (dueFilter === 'has') {
      list = list.filter(function(t) { return !!t.dueDate; });
    } else if (dueFilter === 'none') {
      list = list.filter(function(t) { return !t.dueDate; });
    }
    return sortTasks(list, filters.sort);
  }

  function countOpenInProject(projectId) {
    return state.tasks.filter(function(t) {
      return t.projectId === projectId && isOpenTask(t);
    }).length;
  }

  function countByBucket(bucketId, projectId, onlyOpen) {
    return state.tasks.filter(function(t) {
      if (t.bucketId !== bucketId) return false;
      if (projectId && t.projectId !== projectId) return false;
      if (onlyOpen) return isOpenTask(t);
      return true;
    }).length;
  }

  function isoDaysAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function monthStartISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
  }

  function projectTitleForId(projectId) {
    var p = getProjectById(projectId);
    return p ? p.title : '';
  }

  window.TeacherTasksService = {
    DATA_KEY: DATA_KEY,
    STATUSES: STATUSES.slice(),
    STATUS_LABELS: Object.assign({}, STATUS_LABELS),
    PRIORITIES: PRIORITIES.slice(),
    PRIORITY_LABELS: Object.assign({}, PRIORITY_LABELS),
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES.slice(),
    LAYOUTS: LAYOUTS.slice(),
    DEFAULT_PROJECT_TITLE: DEFAULT_PROJECT_TITLE,

    load: function() {
      var self = this;
      return (window.DataService && DataService.get ? DataService.get(DATA_KEY) : Promise.resolve(null)).then(function(raw) {
        ensureState(raw);
        return self.getState();
      });
    },

    save: function() {
      var payload = {
        projects: state.projects,
        buckets: state.buckets,
        tasks: state.tasks
      };
      return window.DataService ? DataService.set(DATA_KEY, payload) : Promise.resolve();
    },

    getState: function() {
      return {
        projects: state.projects.slice(),
        buckets: state.buckets.slice(),
        tasks: state.tasks.slice()
      };
    },

    getDefaultProject: function() {
      var p = getDefaultProject();
      return p ? Object.assign({}, p) : null;
    },

    getDefaultProjectId: function() {
      var p = getDefaultProject();
      return p ? p.id : null;
    },

    getProjectById: function(id) {
      var p = getProjectById(id);
      return p ? Object.assign({}, p) : null;
    },

    getProjects: function() {
      return state.projects.slice().sort(function(a, b) {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return (a.sort || 0) - (b.sort || 0);
      }).map(function(p) {
        return {
          id: p.id,
          title: p.title,
          layout: p.layout,
          isDefault: !!p.isDefault,
          sort: p.sort,
          open: countOpenInProject(p.id)
        };
      });
    },

    addProject: function(title, layout) {
      layout = layout === 'buckets' ? 'buckets' : 'status';
      var maxSort = state.projects.reduce(function(m, p) { return Math.max(m, p.sort || 0); }, -1);
      var p = {
        id: pid(),
        title: (title || 'New project').trim() || 'New project',
        layout: layout,
        isDefault: false,
        sort: maxSort + 1
      };
      state.projects.push(p);
      if (layout === 'buckets') {
        state.buckets.push({ id: rid(), projectId: p.id, title: 'Tasks', sort: 0 });
      }
      return this.save().then(function() { return p; });
    },

    renameProject: function(projectId, title) {
      var p = getProjectById(projectId);
      if (!p || p.isDefault) {
        if (p && p.isDefault) p.title = (title || '').trim() || p.title;
        return this.save();
      }
      p.title = (title || '').trim() || p.title;
      return this.save();
    },

    removeProject: function(projectId) {
      var p = getProjectById(projectId);
      if (!p || p.isDefault) return Promise.resolve();
      var fallback = getDefaultProject();
      if (!fallback) return Promise.resolve();
      state.tasks.forEach(function(t) {
        if (t.projectId === projectId) {
          t.projectId = fallback.id;
          t.bucketId = null;
        }
      });
      state.buckets = state.buckets.filter(function(b) { return b.projectId !== projectId; });
      state.projects = state.projects.filter(function(x) { return x.id !== projectId; });
      return this.save();
    },

    getBucketById: function(id) {
      return state.buckets.find(function(b) { return b.id === id; });
    },

    getBuckets: function(projectId) {
      if (!projectId) return [];
      return bucketsForProject(projectId).map(function(b) {
        return {
          id: b.id,
          projectId: b.projectId,
          title: b.title,
          sort: b.sort,
          total: countByBucket(b.id, projectId, false),
          open: countByBucket(b.id, projectId, true),
          completed: countByBucket(b.id, projectId, false) - countByBucket(b.id, projectId, true)
        };
      });
    },

    bucketLabel: function(bucketId) {
      var b = this.getBucketById(bucketId);
      return b ? b.title : '';
    },

    projectLabel: function(projectId) {
      return projectTitleForId(projectId);
    },

    getCategories: function(projectId) {
      var set = {};
      DEFAULT_CATEGORIES.forEach(function(c) { set[c] = true; });
      state.tasks.forEach(function(t) {
        if (projectId && t.projectId !== projectId) return;
        if (t.category) set[t.category] = true;
      });
      return Object.keys(set).sort(function(a, b) { return a.localeCompare(b); });
    },

    addBucket: function(projectId, title) {
      var p = getProjectById(projectId);
      if (!p || p.layout !== 'buckets') return Promise.resolve(null);
      var maxSort = state.buckets
        .filter(function(b) { return b.projectId === projectId; })
        .reduce(function(m, b) { return Math.max(m, b.sort || 0); }, -1);
      var b = {
        id: rid(),
        projectId: projectId,
        title: (title || 'New bucket').trim() || 'New bucket',
        sort: maxSort + 1
      };
      state.buckets.push(b);
      return this.save().then(function() { return b; });
    },

    renameBucket: function(bucketId, title) {
      var b = state.buckets.find(function(x) { return x.id === bucketId; });
      if (b) {
        b.title = (title || '').trim() || b.title;
      }
      return this.save();
    },

    removeBucket: function(projectId, bucketId) {
      var projBuckets = bucketsForProject(projectId);
      if (projBuckets.length <= 1) return Promise.resolve();
      var fallback = projBuckets.find(function(b) { return b.id !== bucketId; });
      if (!fallback) return Promise.resolve();
      state.tasks.forEach(function(t) {
        if (t.bucketId === bucketId) t.bucketId = fallback.id;
      });
      state.buckets = state.buckets.filter(function(b) { return b.id !== bucketId; });
      return this.save();
    },

    addTask: function(statusOrPartial, partial) {
      if (typeof statusOrPartial === 'object' && statusOrPartial !== null) {
        partial = statusOrPartial;
        statusOrPartial = partial.status || 'todo';
      }
      partial = partial || {};
      var status = 'todo';
      if (isValidStatus(statusOrPartial)) status = statusOrPartial;
      else if (partial.status && isValidStatus(partial.status)) status = partial.status;

      var defaultProject = getDefaultProject();
      var projectId = partial.projectId || defaultProject.id;
      var project = getProjectById(projectId);
      if (!project) {
        projectId = defaultProject.id;
        project = defaultProject;
      }

      var bucketId = null;
      if (project.layout === 'buckets') {
        bucketId = partial.bucketId;
        var projBuckets = bucketsForProject(projectId);
        if (!bucketId || !projBuckets.some(function(b) { return b.id === bucketId; })) {
          bucketId = projBuckets[0] ? projBuckets[0].id : null;
        }
        status = partial.status && isValidStatus(partial.status) ? partial.status : 'todo';
      }

      var scopeKey = project.layout === 'buckets' && bucketId
        ? function(t) { return t.bucketId === bucketId && isOpenTask(t); }
        : function(t) { return t.projectId === projectId && t.status === status; };
      var maxSort = state.tasks.filter(scopeKey).reduce(function(m, t) { return Math.max(m, t.sort || 0); }, -1);

      var task = normalizeTask(Object.assign({
        title: partial.title || 'New task',
        status: status,
        projectId: projectId,
        bucketId: bucketId,
        sort: maxSort + 1,
        updatedAt: new Date().toISOString()
      }, partial), state);

      state.tasks.push(task);
      return this.save().then(function() { return task; });
    },

    updateTask: function(taskId, updates) {
      var idx = state.tasks.findIndex(function(t) { return t.id === taskId; });
      if (idx < 0) return Promise.resolve();
      var cur = state.tasks[idx];
      var merged = Object.assign({}, cur, updates, { updatedAt: new Date().toISOString() });
      if (merged.status === 'completed') merged.completed = true;
      else if (merged.status && merged.status !== 'completed') merged.completed = false;
      state.tasks[idx] = normalizeTask(merged, state);
      return this.save();
    },

    deleteTask: function(taskId) {
      state.tasks = state.tasks.filter(function(t) { return t.id !== taskId; });
      return this.save();
    },

    toggleTaskComplete: function(taskId) {
      var t = state.tasks.find(function(x) { return x.id === taskId; });
      if (!t) return Promise.resolve();
      if (t.status === 'completed') {
        t.status = 'todo';
        t.completed = false;
      } else {
        t.status = 'completed';
        t.completed = true;
      }
      t.updatedAt = new Date().toISOString();
      return this.save();
    },

    moveTaskToBucket: function(taskId, bucketId) {
      var t = state.tasks.find(function(x) { return x.id === taskId; });
      if (!t) return Promise.resolve();
      var b = state.buckets.find(function(x) { return x.id === bucketId; });
      if (!b || t.projectId !== b.projectId) return Promise.resolve();
      t.bucketId = bucketId;
      t.updatedAt = new Date().toISOString();
      return this.save();
    },

    moveTaskStatus: function(taskId, status) {
      if (!isValidStatus(status)) return Promise.resolve();
      var t = state.tasks.find(function(x) { return x.id === taskId; });
      if (!t) return Promise.resolve();
      t.status = status;
      t.completed = status === 'completed';
      var maxSort = state.tasks.filter(function(x) {
        return x.projectId === t.projectId && x.status === status && x.id !== taskId;
      }).reduce(function(m, x) { return Math.max(m, x.sort || 0); }, -1);
      t.sort = maxSort + 1;
      t.updatedAt = new Date().toISOString();
      return this.save();
    },

    getTasksByStatus: function(status, filters) {
      return applyFilters(filters).filter(function(t) { return t.status === status; });
    },

    getTasksByBucket: function(bucketId, filters) {
      filters = Object.assign({}, filters || {}, { bucketId: bucketId });
      return applyFilters(filters).filter(function(t) { return isOpenTask(t); });
    },

    getFilteredTasks: function(filters) {
      return applyFilters(filters);
    },

    getKpiStats: function(projectId) {
      var today = todayISO();
      var week = weekRangeISO();
      var tasks = state.tasks.slice();
      if (projectId) {
        tasks = tasks.filter(function(t) { return t.projectId === projectId; });
      }
      var open = tasks.filter(isOpenTask);
      var dueToday = open.filter(function(t) { return t.dueDate === today; });
      var dueThisWeek = open.filter(function(t) {
        return t.dueDate && t.dueDate >= week.start && t.dueDate <= week.end;
      });
      var completed = tasks.filter(function(t) { return t.status === 'completed'; });
      return {
        total: open.length,
        dueToday: dueToday.length,
        thisWeek: dueThisWeek.length,
        completed: completed.length
      };
    },

    getOverdueTasks: function(projectId) {
      var today = todayISO();
      return state.tasks.filter(function(t) {
        if (projectId && t.projectId !== projectId) return false;
        return isOpenTask(t) && t.dueDate && t.dueDate < today;
      }).map(function(t) {
        return Object.assign({}, t, { daysOverdue: daysOverdue(t.dueDate) });
      }).sort(function(a, b) {
        if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
        return (a.title || '').localeCompare(b.title || '');
      });
    },

    getOverviewStats: function() {
      var week = weekRangeISO();
      var monthStart = monthStartISO();
      var all = state.tasks.slice();
      var open = all.filter(isOpenTask);
      var completed = all.filter(function(t) { return t.status === 'completed'; });
      var total = all.length;
      var completionRate = total ? Math.round((completed.length / total) * 100) : 0;

      var byStatus = {};
      STATUSES.forEach(function(s) {
        byStatus[s] = all.filter(function(t) { return t.status === s; }).length;
      });

      var byPriority = { high: 0, normal: 0, low: 0 };
      all.forEach(function(t) {
        var p = t.priority === 'high' || t.priority === 'low' ? t.priority : 'normal';
        byPriority[p]++;
      });

      var byProject = state.projects.slice().sort(function(a, b) {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return (a.sort || 0) - (b.sort || 0);
      }).map(function(p) {
        var tasks = all.filter(function(t) { return t.projectId === p.id; });
        var done = tasks.filter(function(t) { return t.status === 'completed'; }).length;
        return {
          id: p.id,
          title: p.title,
          total: tasks.length,
          open: tasks.length - done,
          completed: done
        };
      });

      var completedThisWeek = completed.filter(function(t) {
        var u = String(t.updatedAt || '').slice(0, 10);
        return u >= week.start && u <= week.end;
      }).length;

      var completedThisMonth = completed.filter(function(t) {
        return String(t.updatedAt || '').slice(0, 10) >= monthStart;
      }).length;

      var weeklyTrend = [];
      for (var i = 6; i >= 0; i--) {
        var day = isoDaysAgo(i);
        var label = day.slice(8, 10) + '/' + day.slice(5, 7);
        var count = completed.filter(function(t) {
          return String(t.updatedAt || '').slice(0, 10) === day;
        }).length;
        weeklyTrend.push({ date: day, label: label, count: count });
      }

      var recentCompleted = completed.slice().sort(function(a, b) {
        return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
      }).slice(0, 6).map(function(t) {
        return {
          id: t.id,
          title: t.title,
          project: projectTitleForId(t.projectId),
          updatedAt: t.updatedAt
        };
      });

      return {
        total: total,
        open: open.length,
        completed: completed.length,
        completionRate: completionRate,
        completedThisWeek: completedThisWeek,
        completedThisMonth: completedThisMonth,
        byStatus: byStatus,
        byPriority: byPriority,
        byProject: byProject,
        byBucket: byProject,
        weeklyTrend: weeklyTrend,
        recentCompleted: recentCompleted
      };
    },

    checklistProgress: function(task) {
      var items = task.checklist || [];
      if (items.length === 0) return null;
      var done = items.filter(function(c) { return c.done; }).length;
      return { done: done, total: items.length, pct: Math.round((done / items.length) * 100) };
    },

    getHomePreviewTasks: function(opts) {
      opts = opts || {};
      var limit = typeof opts.limit === 'number' ? opts.limit : 8;
      var defaultId = this.getDefaultProjectId();
      var today = todayISO();
      var open = state.tasks.filter(function(t) {
        if (!isOpenTask(t)) return false;
        if (defaultId && t.projectId !== defaultId) return false;
        return true;
      });
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

    todayISO: todayISO,
    daysOverdue: daysOverdue,
    priorityLabel: function(p) { return PRIORITY_LABELS[p] || 'Medium'; },
    statusLabel: function(s) { return STATUS_LABELS[s] || s; }
  };
})();
