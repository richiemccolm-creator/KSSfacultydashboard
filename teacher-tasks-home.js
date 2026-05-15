/**
 * Home dashboard widget for My tasks — same data as teacher_tasks.html.
 */
(function() {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function priorityPillHtml(priority) {
    var p = priority === 'high' || priority === 'low' ? priority : 'normal';
    var label = p === 'high' ? 'High' : p === 'low' ? 'Low' : 'Normal';
    return '<span class="home-task-priority ' + p + '">' + esc(label) + '</span>';
  }
  function addDays(iso, days) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return '';
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function formatDue(iso) {
    var s = String(iso || '');
    if (s.length < 10) return 'No due date';
    return s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4);
  }
  function statusMeta(task, today) {
    if (task && task.completed) {
      return { cls: 'completed', label: 'Completed' };
    }
    var due = task && task.dueDate ? String(task.dueDate).slice(0, 10) : '';
    if (due && due < today) return { cls: 'overdue', label: 'Overdue' };
    var soonThreshold = addDays(today, 3);
    if (due && soonThreshold && due <= soonThreshold) return { cls: 'due-soon', label: 'Due Soon' };
    return { cls: 'normal', label: 'Normal' };
  }

  window.TeacherTasksHome = {
    render: function() {
      var el = document.getElementById('homeTeacherTasks');
      if (!el || !window.TeacherTasksService) return;
      TeacherTasksService.load().then(function() {
        var st = TeacherTasksService.getState();
        var openTasks = TeacherTasksService.getHomePreviewTasks({ limit: 6 });
        var today = TeacherTasksService.todayISO();
        var completedTasks = (st.tasks || []).filter(function(t) { return !!t.completed; })
          .sort(function(a, b) {
            var ad = String(a.dueDate || '');
            var bd = String(b.dueDate || '');
            if (ad !== bd) return bd.localeCompare(ad);
            return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
          })
          .slice(0, 2);
        var tasks = openTasks.concat(completedTasks);
        el.innerHTML = '';

        if (tasks.length === 0) {
          var empty = document.createElement('div');
          empty.className = 'home-dash-empty';
          empty.appendChild(document.createTextNode('No open tasks. '));
          var link = document.createElement('a');
          link.href = '#';
          link.className = 'home-dash-link';
          link.style.textDecoration = 'none';
          link.textContent = 'Open task board →';
          link.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof window.openEmbeddedTeacherTasks === 'function') {
              window.openEmbeddedTeacherTasks('');
            } else {
              window.location.href = 'teacher_tasks.html';
            }
          });
          empty.appendChild(link);
          el.appendChild(empty);
        } else {
          tasks.forEach(function(t) {
            var row = document.createElement('div');
            row.className = 'home-task-item' + (t.completed ? ' completed' : '');
            var due = t.dueDate || '';
            var status = statusMeta(t, today);
            var dueText = formatDue(due);
            row.innerHTML =
              '<button type="button" class="home-task-done' + (t.completed ? ' is-done' : '') + '" aria-label="' + (t.completed ? 'Mark as open task' : 'Mark done') + '" data-task-id="' + esc(t.id) + '">' + (t.completed ? '↺' : '✓') + '</button>' +
              '<span class="home-task-title">' + esc(t.title) + '</span>' +
              '<span class="home-task-status ' + status.cls + '">' + esc(status.label) + '</span>' +
              '<span class="home-task-due">' + esc(dueText) + '</span>' +
              priorityPillHtml(t.priority);
            var doneBtn = row.querySelector('.home-task-done');
            doneBtn.addEventListener('click', function(e) {
              e.stopPropagation();
              TeacherTasksService.toggleTaskComplete(t.id).then(function() {
                window.TeacherTasksHome.render();
              }).catch(function() {});
            });
            row.addEventListener('click', function(e) {
              if (e.target.closest('.home-task-done')) return;
              var th = '#task-' + encodeURIComponent(t.id);
              if (typeof window.openEmbeddedTeacherTasks === 'function') {
                window.openEmbeddedTeacherTasks(th);
              } else {
                window.location.href = 'teacher_tasks.html' + th;
              }
            });
            el.appendChild(row);
          });
        }

        var quick = document.createElement('div');
        quick.className = 'home-task-quick';
        var firstBucket = st.buckets && st.buckets[0] ? st.buckets[0].id : null;
        quick.innerHTML =
          '<input type="text" class="home-task-quick-input" placeholder="Quick add task…" aria-label="Quick add task">' +
          '<button type="button" class="home-task-quick-btn">Add</button>';
        var input = quick.querySelector('.home-task-quick-input');
        var btn = quick.querySelector('.home-task-quick-btn');
        function doQuickAdd() {
          var title = (input.value || '').trim();
          if (!title || !firstBucket) return;
          TeacherTasksService.addTask(firstBucket, { title: title }).then(function() {
            input.value = '';
            window.TeacherTasksHome.render();
          }).catch(function() {});
        }
        btn.addEventListener('click', doQuickAdd);
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            doQuickAdd();
          }
        });
        el.appendChild(quick);
      }).catch(function() {
        el.innerHTML = '<div class="home-dash-empty">Could not load tasks.</div>';
      });
    }
  };
})();
