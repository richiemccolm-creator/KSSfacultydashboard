/**
 * Full-page UI for teacher_tasks.html — My Tasks workspace.
 */
(function() {
  var filterState = {
    search: '',
    priority: 'all',
    status: 'all',
    sort: 'due',
    projectId: null,
    category: 'all',
    dueFilter: 'all'
  };

  var ACTIVE_PROJECT_KEY = 'teacherTasksActiveProject';
  var activeProjectId = null;
  var pendingDefaultBucketId = null;

  var searchTimer = null;
  var dragTaskId = null;
  var activeView = 'board';
  var activeTaskId = null;
  var overdueExpanded = false;
  var scrollLockY = 0;
  var OVERDUE_PREVIEW = 4;

  function isTouchUi() {
    return window.matchMedia('(hover: none), (pointer: coarse)').matches;
  }

  function isMobileDrawer() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function lockBodyScroll() {
    scrollLockY = window.scrollY || window.pageYOffset || 0;
    document.body.classList.add('tasks-drawer-open');
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + scrollLockY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }

  function unlockBodyScroll() {
    document.body.classList.remove('tasks-drawer-open');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollLockY);
  }

  var COLUMN_CONFIG = [
    { status: 'todo', label: 'To Do', cls: 'todo' },
    { status: 'in_progress', label: 'In Progress', cls: 'in_progress' },
    { status: 'waiting', label: 'Waiting / Pending', cls: 'waiting' },
    { status: 'completed', label: 'Completed', cls: 'completed' }
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg) {
    var el = $('tasksToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 2200);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function getFilters() {
    var f = Object.assign({}, filterState);
    if (activeView === 'board' && activeProjectId) {
      f.projectId = activeProjectId;
    }
    return f;
  }

  function getActiveProject() {
    return activeProjectId ? TeacherTasksService.getProjectById(activeProjectId) : null;
  }

  function loadActiveProjectId() {
    try { return sessionStorage.getItem(ACTIVE_PROJECT_KEY); } catch (e) { return null; }
  }

  function saveActiveProjectId(id) {
    try {
      if (id) sessionStorage.setItem(ACTIVE_PROJECT_KEY, id);
    } catch (e) {}
  }

  function ensureActiveProject() {
    var projects = TeacherTasksService.getProjects();
    if (!projects.length) {
      activeProjectId = TeacherTasksService.getDefaultProjectId();
      return activeProjectId;
    }
    var stored = loadActiveProjectId();
    if (stored && projects.some(function(p) { return p.id === stored; })) {
      activeProjectId = stored;
    } else {
      var def = TeacherTasksService.getDefaultProject();
      activeProjectId = def ? def.id : projects[0].id;
      saveActiveProjectId(activeProjectId);
    }
    filterState.projectId = activeProjectId;
    return activeProjectId;
  }

  function setActiveProject(id) {
    if (!id) return;
    activeProjectId = id;
    filterState.projectId = id;
    saveActiveProjectId(id);
    renderProjectsNav();
    updateActiveProjectTitle();
    updateToolbarForProject();
    renderKpi();
    renderBoard();
    renderOverdue();
    highlightSelectedCard();
    scheduleBoardLayoutUpdate();
  }

  function updateActiveProjectTitle() {
    var el = $('activeProjectTitle');
    var heading = $('tasksProjectHeading');
    if (!el) return;
    if (activeView !== 'board' || !activeProjectId) {
      if (heading) heading.hidden = true;
      return;
    }
    var p = TeacherTasksService.getProjectById(activeProjectId);
    el.textContent = p ? p.title : 'Project';
    if (heading) {
      heading.hidden = false;
      heading.classList.toggle('is-bucket-project', !!(p && p.layout === 'buckets'));
    }
  }

  function updateToolbarForProject() {
    var project = getActiveProject();
    var isBuckets = !!(project && project.layout === 'buckets');
    var statusSel = $('filterStatus');
    if (statusSel) {
      statusSel.style.display = isBuckets ? 'none' : '';
    }
    var drawerStatusGroup = $('drawerStatus') ? $('drawerStatus').closest('.form-group') : null;
    if (drawerStatusGroup) drawerStatusGroup.hidden = isBuckets;
    var drawerBucketGroup = $('drawerBucket') ? $('drawerBucket').closest('.form-group') : null;
    if (drawerBucketGroup) drawerBucketGroup.hidden = !isBuckets;
  }

  function renameProjectPrompt(projectId, currentTitle) {
    var name = prompt('Project name', currentTitle || '');
    if (name == null) return;
    name = name.trim();
    if (!name) return;
    TeacherTasksService.renameProject(projectId, name).then(refreshAll).catch(function() {
      toast('Could not rename project.');
    });
  }

  function renameBucketPrompt(bucketId, currentTitle) {
    var name = prompt('Column name', currentTitle || '');
    if (name == null) return;
    name = name.trim();
    if (!name) return;
    TeacherTasksService.renameBucket(bucketId, name).then(refreshAll).catch(function() {
      toast('Could not rename column.');
    });
  }

  function readFiltersFromDom() {
    filterState.search = ($('filterSearch') && $('filterSearch').value) || '';
    filterState.priority = ($('filterPriority') && $('filterPriority').value) || 'all';
    filterState.status = ($('filterStatus') && $('filterStatus').value) || 'all';
    filterState.sort = ($('filterSort') && $('filterSort').value) || 'due';
    filterState.category = ($('filterCategory') && $('filterCategory').value) || 'all';
    filterState.dueFilter = ($('filterDue') && $('filterDue').value) || 'all';
  }

  function formatDueLabel(iso) {
    if (!iso) return '';
    var parts = String(iso).slice(0, 10).split('-');
    if (parts.length !== 3) return iso;
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return parseInt(parts[2], 10) + ' ' + months[parseInt(parts[1], 10) - 1];
  }

  function dueClass(iso) {
    if (!iso) return '';
    var today = TeacherTasksService.todayISO();
    if (iso < today) return ' overdue';
    if (iso === today) return ' today';
    return '';
  }

  function priorityPillHtml(priority) {
    var label = TeacherTasksService.priorityLabel(priority);
    var cls = priority === 'high' ? 'high' : (priority === 'low' ? 'low' : 'normal');
    return '<span class="priority-pill priority-pill--' + cls + '">' + esc(label) + '</span>';
  }

  function calendarSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
  }

  function paperclipSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
  }

  function noteSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>';
  }

  function commentSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  }

  function highlightSelectedCard() {
    document.querySelectorAll('.task-card').forEach(function(card) {
      card.classList.toggle('is-selected', activeTaskId && card.dataset.taskId === activeTaskId);
    });
  }

  function renderKpi() {
    var projectId = activeView === 'board' ? activeProjectId : null;
    var stats = TeacherTasksService.getKpiStats(projectId);
    if ($('kpiTotal')) $('kpiTotal').textContent = stats.total;
    if ($('kpiDueToday')) $('kpiDueToday').textContent = stats.dueToday;
    if ($('kpiThisWeek')) $('kpiThisWeek').textContent = stats.thisWeek;
    if ($('kpiCompleted')) $('kpiCompleted').textContent = stats.completed;
  }

  function populateDrawerBucketSelect(selectedId) {
    var sel = $('drawerBucket');
    if (!sel) return;
    var project = getActiveProject();
    sel.innerHTML = '';
    if (!project || project.layout !== 'buckets') return;
    var buckets = TeacherTasksService.getBuckets(project.id);
    var first = buckets[0] ? buckets[0].id : '';
    buckets.forEach(function(b) {
      var o = document.createElement('option');
      o.value = b.id;
      o.textContent = b.title;
      if (b.id === selectedId || b.id === pendingDefaultBucketId || (!selectedId && !pendingDefaultBucketId && b.id === first)) {
        o.selected = true;
      }
      sel.appendChild(o);
    });
    pendingDefaultBucketId = null;
  }

  function populateCategoryFilter() {
    var sel = $('filterCategory');
    if (!sel) return;
    var val = sel.value;
    var cats = TeacherTasksService.getCategories(activeProjectId);
    sel.innerHTML = '<option value="all">All categories</option>';
    cats.forEach(function(c) {
      var o = document.createElement('option');
      o.value = c;
      o.textContent = c;
      sel.appendChild(o);
    });
    sel.value = cats.indexOf(val) >= 0 || val === 'all' ? val : 'all';
  }

  function populateCategoryDatalist() {
    var dl = $('categoryList');
    if (!dl) return;
    dl.innerHTML = '';
    TeacherTasksService.getCategories(activeProjectId).forEach(function(c) {
      var o = document.createElement('option');
      o.value = c;
      dl.appendChild(o);
    });
  }

  function renderTaskCard(t, bucketMode) {
    var priClass = t.priority === 'high' ? ' priority-high' : (t.priority === 'low' ? ' priority-low' : ' priority-normal');
    var completedCls = t.status === 'completed' ? ' is-completed' : '';
    var prog = TeacherTasksService.checklistProgress(t);
    var progHtml = '';
    if (prog) {
      progHtml =
        '<div class="task-card-progress">' +
        '<div class="task-card-progress-label">Checklist ' + prog.done + '/' + prog.total + '</div>' +
        '<div class="task-card-progress-bar"><div class="task-card-progress-fill" style="width:' + prog.pct + '%"></div></div>' +
        '</div>';
    }
    var attachCount = (t.attachments || []).length;
    var hasNotes = !!(t.notes && t.notes.trim());
    var commentCount = (t.comments || []).length;
    var headPrefix = bucketMode
      ? '<button type="button" class="task-card-complete-btn" aria-label="Mark complete">○</button>'
      : (t.status === 'completed'
        ? '<span class="task-card-check" aria-hidden="true">✓</span>'
        : '');
    var dueHtml = t.dueDate
      ? '<span class="task-card-due' + dueClass(t.dueDate) + '">' + calendarSvg() + esc(formatDueLabel(t.dueDate)) + '</span>'
      : '';

    var card = document.createElement('div');
    card.className = 'task-card' + priClass + completedCls;
    if (activeTaskId && t.id === activeTaskId) card.classList.add('is-selected');
    card.dataset.taskId = t.id;
    card.draggable = !isTouchUi();
    card.innerHTML =
      '<div class="task-card-head">' +
      headPrefix +
      '<div class="task-card-title">' + esc(t.title) + '</div>' +
      '</div>' +
      '<div class="task-card-row">' + dueHtml + priorityPillHtml(t.priority) + '</div>' +
      progHtml +
      '<div class="task-card-meta-icons">' +
      '<span class="task-meta-icon' + (attachCount ? ' has-content' : '') + '">' + paperclipSvg() + attachCount + '</span>' +
      '<span class="task-meta-icon' + (hasNotes ? ' has-content' : '') + '">' + noteSvg() + (hasNotes ? '1' : '0') + '</span>' +
      '<span class="task-meta-icon' + (commentCount ? ' has-content' : '') + '">' + commentSvg() + commentCount + '</span>' +
      '</div>';

    if (bucketMode) {
      var completeBtn = card.querySelector('.task-card-complete-btn');
      if (completeBtn) {
        completeBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          TeacherTasksService.toggleTaskComplete(t.id).then(refreshAll).catch(function() {
            toast('Could not update task.');
          });
        });
      }
    }

    card.addEventListener('click', function(e) {
      if (e.defaultPrevented) return;
      var task = TeacherTasksService.getState().tasks.find(function(x) { return x.id === t.id; });
      if (task) openTaskDrawer(task);
    });

    card.addEventListener('dragstart', function(e) {
      dragTaskId = t.id;
      card.style.opacity = '0.5';
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', t.id);
      }
    });

    card.addEventListener('dragend', function() {
      dragTaskId = null;
      card.style.opacity = '';
      document.querySelectorAll('.board-column-body.is-drag-over').forEach(function(el) {
        el.classList.remove('is-drag-over');
      });
    });

    return card;
  }

  function renderBoard() {
    var board = $('taskBoard');
    if (!board) return;
    ensureActiveProject();
    var project = getActiveProject();
    board.innerHTML = '';
    updateToolbarForProject();
    if (project && project.layout === 'buckets') {
      board.className = 'tasks-board tasks-board--buckets';
      renderBucketBoard(project, board);
    } else {
      board.className = 'tasks-board tasks-board--status';
      renderStatusBoard(board);
    }
  }

  function renderStatusBoard(board) {
    var filters = getFilters();

    COLUMN_CONFIG.forEach(function(col) {
      var column = document.createElement('div');
      column.className = 'board-column board-column--' + col.cls;
      column.dataset.status = col.status;

      var tasks = TeacherTasksService.getTasksByStatus(col.status, filters);

      var header = document.createElement('div');
      header.className = 'board-column-header';
      header.innerHTML =
        '<span class="board-column-dot"></span>' +
        '<h3 class="board-column-title">' + esc(col.label) + '</h3>' +
        '<span class="board-column-count">' + tasks.length + '</span>';

      var body = document.createElement('div');
      body.className = 'board-column-body';
      body.dataset.status = col.status;

      if (tasks.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'board-empty';
        empty.textContent = 'No tasks';
        body.appendChild(empty);
      } else {
        tasks.forEach(function(t) {
          body.appendChild(renderTaskCard(t));
        });
      }

      body.addEventListener('dragover', function(e) {
        e.preventDefault();
        body.classList.add('is-drag-over');
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      });

      body.addEventListener('dragleave', function(e) {
        if (!body.contains(e.relatedTarget)) body.classList.remove('is-drag-over');
      });

      body.addEventListener('drop', function(e) {
        e.preventDefault();
        body.classList.remove('is-drag-over');
        var id = dragTaskId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
        if (!id) return;
        TeacherTasksService.moveTaskStatus(id, col.status).then(refreshAll).catch(function() {
          toast('Could not move task.');
        });
      });

      var addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'board-column-add';
      addBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> Add Task';
      addBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        openTaskDrawer(null, col.status);
      });

      column.appendChild(header);
      column.appendChild(body);
      column.appendChild(addBtn);
      board.appendChild(column);
    });
  }

  function renderBucketBoard(project, board) {
    var filters = getFilters();
    var buckets = TeacherTasksService.getBuckets(project.id);

    buckets.forEach(function(b) {
      var column = document.createElement('div');
      column.className = 'board-column board-column--bucket';
      column.dataset.bucketId = b.id;

      var tasks = TeacherTasksService.getTasksByBucket(b.id, filters);

      var header = document.createElement('div');
      header.className = 'board-column-header board-column-header--editable';
      header.innerHTML =
        '<h3 class="board-column-title">' + esc(b.title) + '</h3>' +
        '<span class="board-column-count">' + tasks.length + '</span>';
      header.title = 'Double-click to rename column';
      header.addEventListener('dblclick', function(e) {
        e.preventDefault();
        renameBucketPrompt(b.id, b.title);
      });

      var body = document.createElement('div');
      body.className = 'board-column-body';
      body.dataset.bucketId = b.id;

      if (tasks.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'board-empty';
        empty.textContent = 'No tasks';
        body.appendChild(empty);
      } else {
        tasks.forEach(function(t) {
          body.appendChild(renderTaskCard(t, true));
        });
      }

      body.addEventListener('dragover', function(e) {
        e.preventDefault();
        body.classList.add('is-drag-over');
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      });

      body.addEventListener('dragleave', function(e) {
        if (!body.contains(e.relatedTarget)) body.classList.remove('is-drag-over');
      });

      body.addEventListener('drop', function(e) {
        e.preventDefault();
        body.classList.remove('is-drag-over');
        var id = dragTaskId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
        if (!id) return;
        TeacherTasksService.moveTaskToBucket(id, b.id).then(refreshAll).catch(function() {
          toast('Could not move task.');
        });
      });

      var addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'board-column-add';
      addBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> Add task';
      addBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        openTaskDrawer(null, 'todo', b.id);
      });

      if (buckets.length > 1) {
        var delCol = document.createElement('button');
        delCol.type = 'button';
        delCol.className = 'board-column-delete';
        delCol.setAttribute('aria-label', 'Delete column');
        delCol.textContent = '×';
        delCol.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (!confirm('Delete column "' + b.title + '"? Tasks move to another column.')) return;
          TeacherTasksService.removeBucket(project.id, b.id).then(refreshAll).catch(function() {
            toast('Could not delete column.');
          });
        });
        header.appendChild(delCol);
      }

      column.appendChild(header);
      column.appendChild(body);
      column.appendChild(addBtn);
      board.appendChild(column);
    });

    var newCol = document.createElement('div');
    newCol.className = 'board-column board-column--new-bucket';
    var newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'btn-new-bucket-column';
    newBtn.innerHTML = '<span class="btn-new-bucket-column-icon">+</span> New bucket';
    newBtn.addEventListener('click', function() {
      var name = prompt('New column name', 'New bucket');
      if (name == null) return;
      name = name.trim();
      if (!name) return;
      TeacherTasksService.addBucket(project.id, name).then(refreshAll).catch(function() {
        toast('Could not add column.');
      });
    });
    newCol.appendChild(newBtn);
    board.appendChild(newCol);
  }

  function renderOverdue() {
    var list = $('overdueList');
    var viewAll = $('overdueViewAll');
    if (!list) return;
    var overdue = TeacherTasksService.getOverdueTasks(activeProjectId);

    if (viewAll) {
      if (overdue.length > OVERDUE_PREVIEW) {
        viewAll.hidden = false;
        viewAll.textContent = overdueExpanded
          ? 'Show fewer →'
          : 'View all overdue (' + overdue.length + ') →';
      } else {
        viewAll.hidden = true;
      }
    }

    if (overdue.length === 0) {
      list.innerHTML = '<p class="tasks-overdue-empty">No overdue tasks — you\u2019re on track.</p>';
      return;
    }

    var visible = overdueExpanded ? overdue : overdue.slice(0, OVERDUE_PREVIEW);
    list.innerHTML = '';
    visible.forEach(function(t) {
      var card = document.createElement('div');
      card.className = 'overdue-card';
      var wasDue = t.dueDate ? 'Was due ' + formatDueLabel(t.dueDate) : '';
      card.innerHTML =
        '<div class="overdue-card-title">' + esc(t.title) + '</div>' +
        (wasDue ? '<div class="overdue-card-was-due">' + esc(wasDue) + '</div>' : '') +
        '<div class="overdue-card-days">' + t.daysOverdue + ' day' + (t.daysOverdue === 1 ? '' : 's') + ' overdue</div>' +
        priorityPillHtml(t.priority);
      card.addEventListener('click', function() {
        openTaskDrawer(t);
      });
      list.appendChild(card);
    });
  }

  function renderProjectsNav() {
    var list = $('projectsList');
    if (!list) return;
    ensureActiveProject();
    list.innerHTML = '';
    var projects = TeacherTasksService.getProjects();

    projects.forEach(function(p) {
      var wrap = document.createElement('div');
      wrap.className = 'tasks-board-item-wrap';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tasks-board-item' + (p.id === activeProjectId ? ' is-active' : '');
      btn.dataset.projectId = p.id;
      btn.title = isTouchUi() ? 'Tap to open · Hold to rename' : 'Open project · Double-click to rename';
      var badge = p.isDefault ? ' <span class="tasks-project-badge">Home</span>' : '';
      btn.innerHTML =
        '<span class="tasks-board-item-name">' + esc(p.title) + badge + '</span>' +
        '<span class="tasks-board-item-count">' + p.open + '</span>';
      btn.addEventListener('click', function() {
        setActiveProject(p.id);
      });
      btn.addEventListener('dblclick', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (isTouchUi()) return;
        renameProjectPrompt(p.id, p.title);
      });

      if (isTouchUi()) {
        var holdTimer = null;
        btn.addEventListener('touchstart', function() {
          holdTimer = setTimeout(function() {
            holdTimer = null;
            renameProjectPrompt(p.id, p.title);
          }, 550);
        }, { passive: true });
        btn.addEventListener('touchend', function() {
          if (holdTimer) clearTimeout(holdTimer);
        });
        btn.addEventListener('touchmove', function() {
          if (holdTimer) clearTimeout(holdTimer);
        });
      }

      wrap.appendChild(btn);

      var actions = document.createElement('div');
      actions.className = 'tasks-board-item-actions';

      var renameBtn = document.createElement('button');
      renameBtn.type = 'button';
      renameBtn.className = 'tasks-board-action';
      renameBtn.setAttribute('aria-label', 'Rename ' + p.title);
      renameBtn.textContent = '✎';
      renameBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        renameProjectPrompt(p.id, p.title);
      });
      actions.appendChild(renameBtn);

      if (!p.isDefault) {
        var delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'tasks-board-action tasks-board-action--delete';
        delBtn.setAttribute('aria-label', 'Delete ' + p.title);
        delBtn.textContent = '×';
        delBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (!confirm('Delete project "' + p.title + '"? Tasks move to My tasks.')) return;
          var wasActive = activeProjectId === p.id;
          TeacherTasksService.removeProject(p.id).then(function() {
            if (wasActive) {
              try { sessionStorage.removeItem(ACTIVE_PROJECT_KEY); } catch (err) {}
            }
            return refreshAll();
          }).catch(function() {
            toast('Could not delete project.');
          });
        });
        actions.appendChild(delBtn);
      }

      wrap.appendChild(actions);
      list.appendChild(wrap);
    });
  }

  function barChartHtml(title, rows, maxVal) {
    if (!rows.length) return '';
    maxVal = maxVal || Math.max.apply(null, rows.map(function(r) { return r.value; })) || 1;
    var html = '<div class="chart-card"><h3 class="chart-card-title">' + esc(title) + '</h3><div class="chart-bars">';
    rows.forEach(function(r) {
      var pct = maxVal ? Math.round((r.value / maxVal) * 100) : 0;
      html +=
        '<div class="chart-bar-row">' +
        '<span class="chart-bar-label">' + esc(r.label) + '</span>' +
        '<div class="chart-bar-track"><div class="chart-bar-fill" style="width:' + pct + '%;background:' + (r.color || 'var(--drama-500)') + '"></div></div>' +
        '<span class="chart-bar-value">' + r.value + '</span>' +
        '</div>';
    });
    html += '</div></div>';
    return html;
  }

  function renderOverview() {
    var statsEl = $('overviewStats');
    var chartsEl = $('overviewCharts');
    var recentEl = $('overviewRecent');
    if (!statsEl || !chartsEl || !recentEl) return;

    var s = TeacherTasksService.getOverviewStats();

    statsEl.innerHTML =
      '<div class="overview-stat-card">' +
        '<div class="overview-stat-ring" style="--pct:' + s.completionRate + '"><span class="overview-stat-ring-value">' + s.completionRate + '%</span></div>' +
        '<div class="overview-stat-label">Completion rate</div>' +
        '<div class="overview-stat-sub">' + s.completed + ' of ' + s.total + ' tasks done</div>' +
      '</div>' +
      '<div class="overview-stat-card overview-stat-card--plain">' +
        '<div class="overview-stat-value">' + s.open + '</div>' +
        '<div class="overview-stat-label">Open tasks</div>' +
      '</div>' +
      '<div class="overview-stat-card overview-stat-card--plain">' +
        '<div class="overview-stat-value">' + s.completedThisWeek + '</div>' +
        '<div class="overview-stat-label">Completed this week</div>' +
      '</div>' +
      '<div class="overview-stat-card overview-stat-card--plain">' +
        '<div class="overview-stat-value">' + s.completedThisMonth + '</div>' +
        '<div class="overview-stat-label">Completed this month</div>' +
      '</div>';

    var statusRows = [
      { label: 'To Do', value: s.byStatus.todo || 0, color: 'var(--navy-400)' },
      { label: 'In Progress', value: s.byStatus.in_progress || 0, color: 'var(--drama-500)' },
      { label: 'Waiting', value: s.byStatus.waiting || 0, color: 'var(--warning-600)' },
      { label: 'Completed', value: s.byStatus.completed || 0, color: 'var(--success-600)' }
    ];
    var priorityRows = [
      { label: 'High', value: s.byPriority.high || 0, color: 'var(--danger-600)' },
      { label: 'Medium', value: s.byPriority.normal || 0, color: 'var(--warning-600)' },
      { label: 'Low', value: s.byPriority.low || 0, color: 'var(--drama-500)' }
    ];
    var projectRows = (s.byProject || s.byBucket || []).map(function(b) {
      return { label: b.title, value: b.total, color: 'var(--navy-500)' };
    });

    var trendMax = Math.max.apply(null, s.weeklyTrend.map(function(d) { return d.count; }).concat([1]));
    var trendHtml = '<div class="chart-card"><h3 class="chart-card-title">Completions — last 7 days</h3><div class="chart-trend">';
    s.weeklyTrend.forEach(function(d) {
      var h = trendMax ? Math.round((d.count / trendMax) * 100) : 0;
      trendHtml +=
        '<div class="chart-trend-col">' +
        '<div class="chart-trend-bar-wrap"><div class="chart-trend-bar" style="height:' + Math.max(h, 4) + '%"></div></div>' +
        '<span class="chart-trend-count">' + d.count + '</span>' +
        '<span class="chart-trend-label">' + esc(d.label) + '</span>' +
        '</div>';
    });
    trendHtml += '</div></div>';

    chartsEl.innerHTML =
      barChartHtml('By status', statusRows) +
      barChartHtml('By priority', priorityRows) +
      barChartHtml('By project', projectRows) +
      trendHtml;

    if (!s.recentCompleted.length) {
      recentEl.innerHTML = '<div class="overview-recent-card"><h3 class="chart-card-title">Recently completed</h3><p class="overview-empty">No completed tasks yet.</p></div>';
    } else {
      recentEl.innerHTML =
        '<div class="overview-recent-card"><h3 class="chart-card-title">Recently completed</h3><ul class="overview-recent-list">' +
        s.recentCompleted.map(function(t) {
          var when = t.updatedAt ? String(t.updatedAt).slice(0, 10) : '';
          return '<li class="overview-recent-item"><span class="overview-recent-title">' + esc(t.title) + '</span>' +
            (t.project ? '<span class="overview-recent-bucket">' + esc(t.project) + '</span>' : '') +
            '<span class="overview-recent-date">' + esc(when) + '</span></li>';
        }).join('') +
        '</ul></div>';
    }
  }

  function setActiveView(view) {
    activeView = view;
    document.querySelectorAll('.tasks-view-tab').forEach(function(btn) {
      btn.classList.toggle('is-active', btn.dataset.view === view);
    });
    var boardPanel = $('viewBoard');
    var overviewPanel = $('viewOverview');
    var boardHeading = $('tasksProjectHeading');
    if (boardPanel) {
      boardPanel.classList.toggle('is-active', view === 'board');
      boardPanel.hidden = view !== 'board';
    }
    if (overviewPanel) {
      overviewPanel.classList.toggle('is-active', view === 'overview');
      overviewPanel.hidden = view !== 'overview';
    }
    if (boardHeading) boardHeading.hidden = view !== 'board';
    var btnOverview = $('btnViewOverview');
    if (btnOverview) btnOverview.classList.toggle('is-active', view === 'overview');
    updateActiveProjectTitle();
    updateToolbarForProject();
    renderKpi();
    if (view === 'overview') renderOverview();
    scheduleBoardLayoutUpdate();
  }

  function updateDrawerPriorityBadge(priority) {
    var badge = $('drawerPriorityBadge');
    if (!badge) return;
    badge.textContent = TeacherTasksService.priorityLabel(priority);
    badge.className = 'priority-pill priority-pill--' + (priority === 'high' ? 'high' : (priority === 'low' ? 'low' : 'normal'));
  }

  function updateDrawerTabLabels(checklist, notes) {
    checklist = checklist || [];
    var done = checklist.filter(function(c) { return c.done; }).length;
    var total = checklist.length;
    var chkTab = document.querySelector('.task-drawer-tab[data-tab="checklist"]');
    if (chkTab) chkTab.textContent = total ? 'Checklist (' + done + '/' + total + ')' : 'Checklist';
    var notesTab = document.querySelector('.task-drawer-tab[data-tab="notes"]');
    if (notesTab) notesTab.textContent = (notes && notes.trim()) ? 'Notes •' : 'Notes';
  }

  function renderDetailsChecklistPreview(items) {
    var wrap = $('drawerDetailsChecklist');
    var outer = $('drawerDetailsChecklistWrap');
    if (!wrap || !outer) return;
    items = items || [];
    if (!items.length) {
      outer.hidden = true;
      wrap.innerHTML = '';
      return;
    }
    outer.hidden = false;
    var preview = items.slice(0, 4);
    wrap.innerHTML = preview.map(function(c) {
      return '<label class="drawer-details-check-item' + (c.done ? ' is-done' : '') + '">' +
        '<input type="checkbox" disabled ' + (c.done ? 'checked' : '') + '>' +
        esc(c.text) + '</label>';
    }).join('');
    if (items.length > 4) {
      var more = document.createElement('button');
      more.type = 'button';
      more.className = 'drawer-details-check-more';
      more.textContent = '+' + (items.length - 4) + ' more — open Checklist tab';
      more.addEventListener('click', function() { setDrawerTab('checklist'); });
      wrap.appendChild(more);
    }
  }

  function renderAttachmentEditor(items) {
    var wrap = $('drawerAttachments');
    if (!wrap) return;
    wrap.innerHTML = '';
    (items || []).forEach(function(a) {
      var row = document.createElement('div');
      row.className = 'attachment-row';
      row.dataset.id = a.id;
      row.dataset.url = a.url || '';
      row.dataset.label = a.label || a.url || 'Link';
      row.dataset.addedAt = a.addedAt || new Date().toISOString();
      row.innerHTML =
        '<span class="attachment-file-icon" aria-hidden="true">📄</span>' +
        '<div class="attachment-file-info">' +
        '<a class="attachment-file-name" href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.label || a.url) + '</a>' +
        '<span class="attachment-file-url">' + esc(a.url) + '</span>' +
        '</div>' +
        '<button type="button" class="btn-small att-remove" aria-label="Remove">×</button>';
      wrap.appendChild(row);
    });
  }

  function readAttachmentsFromDom() {
    var wrap = $('drawerAttachments');
    if (!wrap) return [];
    var out = [];
    wrap.querySelectorAll('.attachment-row').forEach(function(row) {
      var url = (row.dataset.url || '').trim();
      if (!url) return;
      out.push({
        id: row.dataset.id || ('a' + Math.random().toString(36).substr(2, 9)),
        type: 'link',
        label: (row.dataset.label || 'Link').trim() || 'Link',
        url: url,
        addedAt: row.dataset.addedAt || new Date().toISOString()
      });
    });
    return out;
  }

  function renderChecklistEditor(items) {
    var wrap = $('drawerChecklist');
    if (!wrap) return;
    wrap.innerHTML = '';
    (items || []).forEach(function(c) {
      var row = document.createElement('div');
      row.className = 'checklist-row';
      row.dataset.id = c.id;
      row.innerHTML =
        '<input type="checkbox" class="chk-done" ' + (c.done ? 'checked' : '') + '>' +
        '<input type="text" class="form-input chk-text" value="' + esc(c.text) + '" placeholder="Step">' +
        '<button type="button" class="btn-small chk-remove" aria-label="Remove">×</button>';
      wrap.appendChild(row);
    });
    updateChecklistProgress(items);
  }

  function readChecklistFromDom() {
    var wrap = $('drawerChecklist');
    if (!wrap) return [];
    var out = [];
    wrap.querySelectorAll('.checklist-row').forEach(function(row) {
      var id = row.dataset.id || ('c' + Math.random().toString(36).substr(2, 9));
      var done = row.querySelector('.chk-done').checked;
      var text = row.querySelector('.chk-text').value.trim();
      if (text || done) out.push({ id: id, text: text, done: done });
    });
    return out;
  }

  function updateChecklistProgress(items) {
    items = items || readChecklistFromDom();
    var total = items.length;
    var done = items.filter(function(c) { return c.done; }).length;
    var pct = total ? Math.round((done / total) * 100) : 0;
    if ($('drawerChecklistPct')) $('drawerChecklistPct').textContent = pct + '%';
    if ($('drawerChecklistBar')) $('drawerChecklistBar').style.width = pct + '%';
  }

  function setDrawerTab(tab) {
    document.querySelectorAll('.task-drawer-tab').forEach(function(btn) {
      var active = btn.dataset.tab === tab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.task-drawer-panel').forEach(function(panel) {
      panel.classList.toggle('is-active', panel.dataset.panel === tab);
    });
  }

  function openTaskDrawer(task, defaultStatus, defaultBucketId) {
    var isNew = !task;
    activeTaskId = task ? task.id : null;
    pendingDefaultBucketId = defaultBucketId || null;
    $('drawerTaskId').value = task ? task.id : '';
    $('drawerTitleInput').value = task ? task.title : '';
    $('drawerDescription').value = task ? (task.description || '') : '';
    $('drawerNotes').value = task ? (task.notes || '') : '';
    $('drawerDue').value = task && task.dueDate ? task.dueDate : '';
    $('drawerStatus').value = task ? task.status : (defaultStatus || 'todo');
    $('drawerPriority').value = task && task.priority ? task.priority : 'normal';
    $('drawerCategory').value = task ? (task.category || '') : '';
    populateDrawerBucketSelect(task ? task.bucketId : defaultBucketId);
    updateToolbarForProject();
    $('drawerDelete').style.display = isNew ? 'none' : 'inline-block';
    updateDrawerPriorityBadge(task && task.priority ? task.priority : 'normal');
    var checklist = task && task.checklist ? task.checklist : [];
    renderChecklistEditor(checklist);
    renderDetailsChecklistPreview(checklist);
    renderAttachmentEditor(task && task.attachments ? task.attachments : []);
    updateDrawerTabLabels(checklist, task ? task.notes : '');
    setDrawerTab('details');
    highlightSelectedCard();

    $('taskDrawer').classList.add('is-open');
    $('taskDrawer').setAttribute('aria-hidden', 'false');

    if (isMobileDrawer()) {
      $('taskDrawerBackdrop').classList.add('is-visible');
      lockBodyScroll();
      document.body.classList.remove('tasks-drawer-split-open');
    } else {
      $('taskDrawerBackdrop').classList.remove('is-visible');
      document.body.classList.add('tasks-drawer-split-open');
    }
    scheduleBoardLayoutUpdate();

    if (task && task.id) {
      history.replaceState(null, '', location.pathname + location.search + '#task-' + encodeURIComponent(task.id));
    }

    setTimeout(function() { $('drawerTitleInput').focus(); }, 50);
  }

  function closeTaskDrawer() {
    activeTaskId = null;
    highlightSelectedCard();
    $('taskDrawer').classList.remove('is-open');
    $('taskDrawer').setAttribute('aria-hidden', 'true');
    $('taskDrawerBackdrop').classList.remove('is-visible');
    document.body.classList.remove('tasks-drawer-split-open');
    if (document.body.classList.contains('tasks-drawer-open')) unlockBodyScroll();
    scheduleBoardLayoutUpdate();
    if (location.hash.indexOf('task-') === 0) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function saveDrawer() {
    var title = $('drawerTitleInput').value.trim();
    if (!title) {
      toast('Please enter a title.');
      return;
    }
    var payload = {
      title: title,
      description: $('drawerDescription').value,
      notes: $('drawerNotes').value,
      dueDate: $('drawerDue').value || null,
      status: $('drawerStatus').value,
      priority: $('drawerPriority').value,
      category: $('drawerCategory').value.trim(),
      projectId: activeProjectId || TeacherTasksService.getDefaultProjectId(),
      bucketId: $('drawerBucket') && !$('drawerBucket').closest('.form-group').hidden ? $('drawerBucket').value : null,
      checklist: readChecklistFromDom(),
      attachments: readAttachmentsFromDom()
    };
    var id = $('drawerTaskId').value;
    var p;
    if (id) {
      p = TeacherTasksService.updateTask(id, payload);
    } else {
      p = TeacherTasksService.addTask(payload.status || 'todo', payload);
    }
    p.then(function() {
      closeTaskDrawer();
      return refreshAll();
    }).catch(function() {
      toast('Could not save. Check you are signed in.');
    });
  }

  function deleteDrawerTask() {
    var id = $('drawerTaskId').value;
    if (!id || !confirm('Delete this task?')) return;
    TeacherTasksService.deleteTask(id).then(function() {
      closeTaskDrawer();
      return refreshAll();
    }).catch(function() {
      toast('Could not delete.');
    });
  }

  function waitForAuth() {
    return new Promise(function(resolve) {
      if (window.__authReady) { resolve(); return; }
      var attempts = 0;
      var timer = setInterval(function() {
        attempts++;
        if (window.__authReady || attempts >= 50) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  }

  function updateBoardLayout() {
    var workspace = document.querySelector('.tasks-workspace');
    var board = $('taskBoard');
    if (!workspace || !board) return;
    var top = board.getBoundingClientRect().top;
    workspace.style.setProperty('--tasks-board-offset', Math.ceil(Math.max(top, 0) + 12) + 'px');
  }

  var boardLayoutTimer = null;
  function scheduleBoardLayoutUpdate() {
    clearTimeout(boardLayoutTimer);
    boardLayoutTimer = setTimeout(updateBoardLayout, 50);
  }

  function bindBoardLayout() {
    updateBoardLayout();
    window.addEventListener('resize', scheduleBoardLayoutUpdate);

    var watch = [$('tasksToolbar'), $('tasksKpi'), document.querySelector('.tasks-hero'), $('tasksProjectsNav')];
    watch.forEach(function(el) {
      if (el && window.ResizeObserver) {
        new ResizeObserver(scheduleBoardLayoutUpdate).observe(el);
      }
    });

    var extra = $('toolbarExtra');
    if (extra && window.ResizeObserver) {
      new ResizeObserver(scheduleBoardLayoutUpdate).observe(extra);
    }
  }

  function refreshAll() {
    return TeacherTasksService.load().then(function() {
      ensureActiveProject();
      populateCategoryFilter();
      populateCategoryDatalist();
      renderKpi();
      renderProjectsNav();
      updateActiveProjectTitle();
      updateToolbarForProject();
      renderBoard();
      highlightSelectedCard();
      renderOverdue();
      if (activeView === 'overview') renderOverview();
      scheduleBoardLayoutUpdate();
    }).catch(function() {
      renderKpi();
      renderProjectsNav();
      updateActiveProjectTitle();
      updateToolbarForProject();
      renderBoard();
      highlightSelectedCard();
      renderOverdue();
      if (activeView === 'overview') renderOverview();
      scheduleBoardLayoutUpdate();
      toast('Could not load tasks. Check you are signed in.');
    });
  }

  function maybeOpenHash() {
    var h = location.hash.replace(/^#/, '');
    if (h.indexOf('task-') !== 0) return;
    var id = decodeURIComponent(h.slice(5));
    TeacherTasksService.load().then(function() {
      var task = TeacherTasksService.getState().tasks.find(function(t) { return t.id === id; });
      if (task) {
        if (task.projectId) setActiveProject(task.projectId);
        openTaskDrawer(task);
      }
    });
  }

  function bindFilters() {
    var searchEl = $('filterSearch');
    if (searchEl) {
      searchEl.addEventListener('input', function() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function() {
          readFiltersFromDom();
          renderBoard();
        }, 200);
      });
    }

    ['filterPriority', 'filterStatus', 'filterSort', 'filterCategory', 'filterDue'].forEach(function(id) {
      var el = $(id);
      if (el) {
        el.addEventListener('change', function() {
          readFiltersFromDom();
          renderBoard();
        });
      }
    });

    var btnMore = $('btnFilterMore');
    var extra = $('toolbarExtra');
    if (btnMore && extra) {
      btnMore.addEventListener('click', function() {
        var open = extra.classList.toggle('is-visible');
        btnMore.classList.toggle('is-open', open);
        btnMore.setAttribute('aria-expanded', open ? 'true' : 'false');
        scheduleBoardLayoutUpdate();
      });
    }
  }

  function bindDrawer() {
    $('drawerClose').addEventListener('click', closeTaskDrawer);
    $('taskDrawerBackdrop').addEventListener('click', closeTaskDrawer);
    $('drawerSave').addEventListener('click', saveDrawer);
    $('drawerDelete').addEventListener('click', deleteDrawerTask);

    $('drawerPriority').addEventListener('change', function() {
      updateDrawerPriorityBadge($('drawerPriority').value);
    });

    document.querySelectorAll('.task-drawer-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setDrawerTab(btn.dataset.tab);
      });
    });

    $('btnAddCheckItem').addEventListener('click', function() {
      var items = readChecklistFromDom();
      items.push({ id: 'c' + Math.random().toString(36).substr(2, 9), text: '', done: false });
      renderChecklistEditor(items);
      renderDetailsChecklistPreview(items);
      updateDrawerTabLabels(items, $('drawerNotes').value);
      var inputs = $('drawerChecklist').querySelectorAll('.chk-text');
      if (inputs.length) inputs[inputs.length - 1].focus();
    });

    $('drawerChecklist').addEventListener('click', function(e) {
      if (e.target.classList.contains('chk-remove')) {
        e.target.closest('.checklist-row').remove();
        var items = readChecklistFromDom();
        updateChecklistProgress(items);
        renderDetailsChecklistPreview(items);
        updateDrawerTabLabels(items, $('drawerNotes').value);
      }
    });

    $('drawerChecklist').addEventListener('change', function(e) {
      if (e.target.classList.contains('chk-done')) {
        var items = readChecklistFromDom();
        updateChecklistProgress(items);
        renderDetailsChecklistPreview(items);
        updateDrawerTabLabels(items, $('drawerNotes').value);
      }
    });

    $('drawerChecklist').addEventListener('input', function(e) {
      if (e.target.classList.contains('chk-text')) {
        var items = readChecklistFromDom();
        updateChecklistProgress(items);
        updateDrawerTabLabels(items, $('drawerNotes').value);
      }
    });

    $('btnAddAttachment').addEventListener('click', function() {
      var label = prompt('Link label', 'Resource');
      if (label == null) return;
      var url = prompt('URL');
      if (url == null || !url.trim()) return;
      var items = readAttachmentsFromDom();
      items.push({
        id: 'a' + Math.random().toString(36).substr(2, 9),
        type: 'link',
        label: label.trim() || 'Link',
        url: url.trim(),
        addedAt: new Date().toISOString()
      });
      renderAttachmentEditor(items);
    });

    $('drawerAttachments').addEventListener('click', function(e) {
      if (e.target.classList.contains('att-remove')) {
        e.target.closest('.attachment-row').remove();
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && $('taskDrawer').classList.contains('is-open')) {
        closeTaskDrawer();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    if (!window.TeacherTasksService) return;

    bindFilters();
    bindDrawer();
    bindBoardLayout();

    document.querySelectorAll('.tasks-view-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setActiveView(btn.dataset.view);
      });
    });

    var btnAddProject = $('btnAddProject');
    if (btnAddProject) {
      btnAddProject.addEventListener('click', function() {
        var name = prompt('New project name', 'New project');
        if (name == null) return;
        name = name.trim();
        if (!name) return;
        TeacherTasksService.addProject(name, 'buckets').then(function(p) {
          activeProjectId = p.id;
          saveActiveProjectId(p.id);
          return refreshAll();
        }).catch(function() {
          toast('Could not add project.');
        });
      });
    }

    var btnAdd = $('btnAddTask');
    if (btnAdd) {
      btnAdd.addEventListener('click', function() {
        openTaskDrawer(null);
      });
    }

    var btnOverview = $('btnViewOverview');
    if (btnOverview) {
      btnOverview.addEventListener('click', function() {
        setActiveView(activeView === 'overview' ? 'board' : 'overview');
      });
    }

    var overdueViewAll = $('overdueViewAll');
    if (overdueViewAll) {
      overdueViewAll.addEventListener('click', function() {
        overdueExpanded = !overdueExpanded;
        renderOverdue();
      });
    }

    waitForAuth().then(function() {
      return refreshAll();
    }).then(maybeOpenHash);

    window.addEventListener('hashchange', maybeOpenHash);
  });
})();
