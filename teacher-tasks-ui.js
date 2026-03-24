/**
 * Full-page UI for teacher_tasks.html — uses TeacherTasksService.
 */
(function() {
  var defaultBucketIdForNew = null;

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

  function openModal() {
    $('taskModalOverlay').classList.add('visible');
  }

  function closeModal() {
    $('taskModalOverlay').classList.remove('visible');
    if (location.hash.indexOf('task-') === 0) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function fillBucketSelect(selectedId) {
    var sel = $('modalBucket');
    if (!sel) return;
    var st = TeacherTasksService.getState();
    sel.innerHTML = '';
    st.buckets.forEach(function(b) {
      var o = document.createElement('option');
      o.value = b.id;
      o.textContent = b.title;
      if (b.id === selectedId) o.selected = true;
      sel.appendChild(o);
    });
  }

  function renderChecklistEditor(items) {
    var wrap = $('modalChecklist');
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
  }

  function readChecklistFromDom() {
    var rows = $('modalChecklist').querySelectorAll('.checklist-row');
    var out = [];
    rows.forEach(function(row) {
      var id = row.dataset.id || ('c' + Math.random().toString(36).substr(2, 9));
      var done = row.querySelector('.chk-done').checked;
      var text = row.querySelector('.chk-text').value.trim();
      if (text || done) out.push({ id: id, text: text, done: done });
    });
    return out;
  }

  function openTaskModal(task, bucketIdDefault) {
    var isNew = !task;
    $('taskModalTitle').textContent = isNew ? 'New task' : 'Edit task';
    $('modalTaskId').value = task ? task.id : '';
    $('modalTitle').value = task ? task.title : '';
    $('modalNotes').value = task ? (task.notes || '') : '';
    $('modalDue').value = task && task.dueDate ? task.dueDate : '';
    $('modalPriority').value = task && task.priority ? task.priority : 'normal';
    $('modalCompleted').checked = task ? !!task.completed : false;
    $('modalDelete').style.display = isNew ? 'none' : 'inline-block';
    fillBucketSelect(task ? task.bucketId : (bucketIdDefault || TeacherTasksService.getState().buckets[0].id));
    renderChecklistEditor(task && task.checklist ? task.checklist : []);
    openModal();
    setTimeout(function() { $('modalTitle').focus(); }, 50);
  }

  function saveModal() {
    var id = $('modalTaskId').value;
    var title = $('modalTitle').value.trim();
    if (!title) {
      toast('Please enter a title.');
      return;
    }
    var payload = {
      title: title,
      notes: $('modalNotes').value,
      dueDate: $('modalDue').value || null,
      priority: $('modalPriority').value,
      completed: $('modalCompleted').checked,
      bucketId: $('modalBucket').value,
      checklist: readChecklistFromDom()
    };
    var p;
    if (id) {
      p = TeacherTasksService.updateTask(id, payload);
    } else {
      p = TeacherTasksService.addTask(payload.bucketId, payload);
    }
    p.then(function() {
      closeModal();
      return refreshBoard();
    }).catch(function() {
      toast('Could not save. Check you are signed in.');
    });
  }

  function deleteModalTask() {
    var id = $('modalTaskId').value;
    if (!id || !confirm('Delete this task?')) return;
    TeacherTasksService.deleteTask(id).then(function() {
      closeModal();
      return refreshBoard();
    }).catch(function() {
      toast('Could not delete.');
    });
  }

  function renderTaskCard(t) {
    var today = TeacherTasksService.todayISO();
    var dueClass = '';
    var dueLabel = '';
    if (t.dueDate) {
      if (t.dueDate < today) dueClass = ' overdue';
      else if (t.dueDate === today) dueClass = ' today';
      dueLabel = t.dueDate.slice(8) + '/' + t.dueDate.slice(5, 7);
    }
    var prog = TeacherTasksService.checklistProgress(t);
    var progHtml = prog ? '<span class="task-card-check">Checklist ' + prog.done + '/' + prog.total + '</span>' : '';
    var priClass = t.priority === 'high' ? ' priority-high' : (t.priority === 'low' ? ' priority-low' : '');
    var card = document.createElement('div');
    card.className = 'task-card' + (t.completed ? ' completed' : '') + priClass;
    card.dataset.taskId = t.id;
    card.innerHTML =
      '<div class="task-card-title">' + esc(t.title) + '</div>' +
      '<div class="task-card-meta">' +
      (dueLabel ? '<span class="task-card-due' + dueClass + '">' + esc(dueLabel) + '</span>' : '') +
      progHtml +
      '</div>';
    card.addEventListener('click', function() {
      var task = TeacherTasksService.getState().tasks.find(function(x) { return x.id === t.id; });
      if (task) openTaskModal(task);
    });
    return card;
  }

  function renderBoard() {
    var board = $('taskBoard');
    if (!board) return;
    board.innerHTML = '';
    var st = TeacherTasksService.getState();
    st.buckets.forEach(function(bucket) {
      var col = document.createElement('div');
      col.className = 'bucket';
      col.dataset.bucketId = bucket.id;

      var header = document.createElement('div');
      header.className = 'bucket-header';
      var titleEl = document.createElement('div');
      titleEl.className = 'bucket-title';
      titleEl.textContent = bucket.title;
      titleEl.title = 'Double-click to rename';
      titleEl.addEventListener('dblclick', function() {
        var name = prompt('List name', bucket.title);
        if (name == null) return;
        name = name.trim();
        if (!name) return;
        TeacherTasksService.renameBucket(bucket.id, name).then(refreshBoard).catch(function() { toast('Could not rename.'); });
      });

      var actions = document.createElement('div');
      actions.className = 'bucket-actions';
      if (st.buckets.length > 1) {
        var delB = document.createElement('button');
        delB.type = 'button';
        delB.className = 'bucket-btn danger';
        delB.setAttribute('aria-label', 'Delete list');
        delB.textContent = '×';
        delB.addEventListener('click', function(e) {
          e.stopPropagation();
          if (!confirm('Delete this list? Tasks move to the first list.')) return;
          TeacherTasksService.removeBucket(bucket.id).then(refreshBoard).catch(function() { toast('Could not delete list.'); });
        });
        actions.appendChild(delB);
      }

      header.appendChild(titleEl);
      header.appendChild(actions);

      var body = document.createElement('div');
      body.className = 'bucket-body';
      var tasks = st.tasks.filter(function(t) { return t.bucketId === bucket.id; });
      tasks.sort(function(a, b) { return (a.sort || 0) - (b.sort || 0); });
      if (tasks.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'empty-bucket';
        empty.textContent = 'No tasks yet';
        body.appendChild(empty);
      } else {
        tasks.forEach(function(t) {
          body.appendChild(renderTaskCard(t));
        });
      }

      var addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn-add-task';
      addBtn.textContent = '+ Add task';
      addBtn.addEventListener('click', function() {
        openTaskModal(null, bucket.id);
      });

      body.appendChild(addBtn);
      col.appendChild(header);
      col.appendChild(body);
      board.appendChild(col);
    });
  }

  function refreshBoard() {
    return TeacherTasksService.load().then(function() {
      renderBoard();
    });
  }

  function maybeOpenHash() {
    var h = location.hash.replace(/^#/, '');
    if (h.indexOf('task-') !== 0) return;
    var id = decodeURIComponent(h.slice(5));
    TeacherTasksService.load().then(function() {
      var task = TeacherTasksService.getState().tasks.find(function(t) { return t.id === id; });
      if (task) openTaskModal(task);
    });
  }

  function bindModal() {
    $('taskModalClose').addEventListener('click', closeModal);
    $('modalCancel').addEventListener('click', closeModal);
    $('modalSave').addEventListener('click', saveModal);
    $('modalDelete').addEventListener('click', deleteModalTask);
    $('taskModalOverlay').addEventListener('click', function(e) {
      if (e.target === $('taskModalOverlay')) closeModal();
    });
    $('modalAddCheckItem').addEventListener('click', function() {
      var items = readChecklistFromDom();
      items.push({ id: 'c' + Math.random().toString(36).substr(2, 9), text: '', done: false });
      renderChecklistEditor(items);
      var inputs = $('modalChecklist').querySelectorAll('.chk-text');
      if (inputs.length) inputs[inputs.length - 1].focus();
    });
    $('modalChecklist').addEventListener('click', function(e) {
      if (e.target.classList.contains('chk-remove')) {
        e.target.closest('.checklist-row').remove();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    if (!window.TeacherTasksService) return;
    bindModal();
    $('btnAddBucket').addEventListener('click', function() {
      var name = prompt('New list name', 'New list');
      if (name == null) return;
      name = name.trim() || 'New list';
      TeacherTasksService.addBucket(name).then(refreshBoard).catch(function() { toast('Could not add list.'); });
    });
    refreshBoard().then(maybeOpenHash);
    window.addEventListener('hashchange', maybeOpenHash);
  });
})();
