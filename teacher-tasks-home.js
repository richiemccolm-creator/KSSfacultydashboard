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

  window.TeacherTasksHome = {
    render: function() {
      var el = document.getElementById('homeTeacherTasks');
      if (!el || !window.TeacherTasksService) return;
      TeacherTasksService.load().then(function() {
        var st = TeacherTasksService.getState();
        var tasks = TeacherTasksService.getHomePreviewTasks({ limit: 8 });
        var today = TeacherTasksService.todayISO();
        el.innerHTML = '';

        if (tasks.length === 0) {
          var empty = document.createElement('div');
          empty.className = 'home-dash-empty';
          empty.appendChild(document.createTextNode('No open tasks. '));
          var link = document.createElement('a');
          link.href = 'teacher_tasks.html';
          link.className = 'home-dash-link';
          link.style.textDecoration = 'none';
          link.textContent = 'Open task board →';
          empty.appendChild(link);
          el.appendChild(empty);
        } else {
          tasks.forEach(function(t) {
            var row = document.createElement('div');
            row.className = 'home-task-item';
            var due = t.dueDate || '';
            var badgeHtml = '';
            if (due) {
              if (due < today) {
                badgeHtml = '<span class="home-task-badge overdue">Overdue</span>';
              } else if (due === today) {
                badgeHtml = '<span class="home-task-badge today">Today</span>';
              } else {
                badgeHtml = '<span class="home-task-date">' + esc(due.slice(8) + '/' + due.slice(5, 7)) + '</span>';
              }
            }
            row.innerHTML =
              '<button type="button" class="home-task-done" aria-label="Mark done" data-task-id="' + esc(t.id) + '">✓</button>' +
              '<span class="home-task-title">' + esc(t.title) + '</span>' +
              priorityPillHtml(t.priority) +
              badgeHtml;
            var doneBtn = row.querySelector('.home-task-done');
            doneBtn.addEventListener('click', function(e) {
              e.stopPropagation();
              TeacherTasksService.toggleTaskComplete(t.id).then(function() {
                window.TeacherTasksHome.render();
              }).catch(function() {});
            });
            row.addEventListener('click', function(e) {
              if (e.target.closest('.home-task-done')) return;
              window.location.href = 'teacher_tasks.html#task-' + encodeURIComponent(t.id);
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
