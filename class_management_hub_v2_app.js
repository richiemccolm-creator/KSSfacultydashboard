(function() {
  if (window.ClassManagementHubV2Loaded) return;
  window.ClassManagementHubV2Loaded = true;

  var state = {
    staff: [],
    filtered: [],
    selectedTeacher: null,
    selectedSubject: '',
    classes: [],
    originalClasses: [],
    removedClasses: [],
    conflictCount: null,
    notesStore: {},
    activity: [],
    unsaved: false
  };
  var csvRowsCache = null;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>\"']/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }
  function el(id) { return document.getElementById(id); }
  function normalizeSubject(v) {
    return window.DataService && window.DataService.normalizeTrackerSubject
      ? (window.DataService.normalizeTrackerSubject(v) || '')
      : '';
  }
  function parseYear(v) {
    var m = /^s?([1-6])$/i.exec(String(v || '').trim());
    return m ? 'S' + m[1] : '';
  }
  function todayAcademicYear() {
    var d = new Date();
    var y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
    return y + '-' + (y + 1);
  }
  function setMessage(id, type, text) {
    var node = el(id);
    if (!node) return;
    if (!text) {
      node.className = 'message hidden';
      node.textContent = '';
      return;
    }
    node.className = 'message ' + (type || 'info');
    node.textContent = text;
  }

  function renderLayout() {
    document.body.innerHTML = '' +
      '<style>' +
      '*{box-sizing:border-box}' +
      'body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f3f6fa;color:#13263f}' +
      '.wrap{max-width:1180px;margin:0 auto;padding:1rem}' +
      '.hero{background:#1f3552;color:#fff;border-radius:12px;padding:1rem 1.1rem;margin-bottom:1rem}' +
      '.hero h1{margin:0 0 .28rem;font-size:1.2rem}' +
      '.hero p{margin:0;color:rgba(255,255,255,.92);font-size:.92rem;line-height:1.4}' +
      '.card{background:#fff;border:1px solid #dce4ef;border-radius:12px;box-shadow:0 2px 8px rgba(15,23,42,.04);margin-bottom:1rem}' +
      '.card h2{margin:0;padding:.86rem 1rem;background:#f8fafc;border-bottom:1px solid #e7edf5;font-size:.95rem}' +
      '.body{padding:1rem}' +
      '.row{display:grid;grid-template-columns:1fr 1fr;gap:.65rem;margin-bottom:.65rem}' +
      '.row.search{grid-template-columns:1fr}' +
      'label{display:block;font-size:.78rem;color:#41556e;font-weight:600;margin-bottom:.3rem}' +
      'input,select,textarea{width:100%;border:1px solid #cfd9e7;border-radius:9px;padding:.56rem .62rem;font:inherit;font-size:.9rem;background:#fff}' +
      'textarea{min-height:112px;resize:vertical}' +
      '.btns{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.55rem}' +
      'button{border:none;background:#0f766e;color:#fff;border-radius:9px;padding:.52rem .8rem;font-size:.84rem;font-weight:600;cursor:pointer}' +
      'button.ghost{background:#eef3f9;color:#1f3552;border:1px solid #d2dbe8}' +
      'button.secondary{background:#334155}' +
      'button:disabled{opacity:.6;cursor:not-allowed}' +
      '.hidden{display:none!important}' +
      '.state{border:1px dashed #cfd9e7;border-radius:10px;background:#fbfdff;color:#51667f;padding:.9rem;text-align:center;font-size:.87rem}' +
      '.message{margin-top:.55rem;border-radius:9px;padding:.45rem .55rem;font-size:.79rem}' +
      '.message.info{border:1px solid #dbe6f2;background:#f8fafc;color:#334155}' +
      '.message.success{border:1px solid #a7f3d0;background:#ecfdf5;color:#065f46}' +
      '.message.warn{border:1px solid #fde68a;background:#fffbeb;color:#92400e}' +
      '.message.error{border:1px solid #fecaca;background:#fef2f2;color:#991b1b}' +
      '.staff-grid{display:grid;grid-template-columns:1fr;gap:.55rem;margin-top:.6rem}' +
      '.staff-card{border:1px solid #dbe5f1;border-radius:11px;background:#fff;padding:.72rem;text-align:left;display:grid;grid-template-columns:1fr auto;gap:.55rem;align-items:center;cursor:pointer}' +
      '.staff-card:hover{border-color:#9fb5d0;background:#fbfdff}' +
      '.staff-head{display:flex;gap:.55rem;align-items:flex-start;min-width:0}' +
      '.avatar{width:34px;height:34px;border-radius:999px;background:#e8eef7;color:#1f3552;display:inline-flex;align-items:center;justify-content:center;font-size:.76rem;font-weight:700;flex-shrink:0}' +
      '.name{margin:0;font-size:.9rem;color:#17314e}' +
      '.email{margin:0;font-size:.75rem;color:#5d728a;line-height:1.35}' +
      '.meta{font-size:.77rem;color:#42576f}' +
      '.status{display:inline-flex;align-items:center;border-radius:999px;padding:.14rem .5rem;font-size:.72rem;font-weight:700;border:1px solid transparent}' +
      '.status.assigned{border-color:#a7f3d0;background:#ecfdf5;color:#065f46}' +
      '.status.empty{border-color:#fde68a;background:#fffbeb;color:#92400e}' +
      '.status.review{border-color:#fecaca;background:#fef2f2;color:#991b1b}' +
      '.workspace{display:grid;grid-template-columns:2fr 1fr;gap:.8rem}' +
      '.banner{border:1px solid #dbe6f2;border-radius:10px;background:#f8fafc;padding:.6rem .7rem;margin-bottom:.65rem}' +
      '.banner-grid{display:grid;grid-template-columns:auto 1fr;gap:.58rem;align-items:center}' +
      '.banner-name{font-weight:700;color:#1f3552}' +
      '.banner-sub{font-size:.78rem;color:#5b6f86}' +
      '.chips{display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.32rem}' +
      '.chip{border:1px solid #d2dbe8;border-radius:999px;background:#f8fafc;color:#324861;padding:.16rem .5rem;font-size:.72rem;font-weight:700}' +
      '.tabs{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.6rem}' +
      '.tab{border:1px solid #d3deeb;background:#fff;color:#233a56;border-radius:9px;padding:.44rem .62rem;font-size:.78rem}' +
      '.tab.active{background:#ecfdf5;border-color:#9ae6b4;color:#065f46}' +
      '.subjects{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem;margin-bottom:.6rem}' +
      '.subject{border:1px solid #d3ddea;border-radius:10px;background:#fff;color:#213a57;padding:.54rem .58rem;text-align:left;font-size:.81rem}' +
      '.subject strong{display:block;margin-bottom:.16rem}' +
      '.subject.active{border-color:#86efac;background:#ecfdf5;color:#065f46}' +
      '.subject.disabled{opacity:.5;cursor:not-allowed}' +
      '.table-wrap{border:1px solid #dbe6f2;border-radius:10px;background:#fff;overflow:auto}' +
      'table{width:100%;border-collapse:collapse;min-width:720px}' +
      'th,td{border-bottom:1px solid #e8eef6;padding:.4rem .42rem;text-align:left;font-size:.79rem;vertical-align:middle}' +
      'th{background:#f8fafc;color:#3a4e68;font-weight:700}' +
      '.panel{border:1px solid #dbe6f2;border-radius:10px;background:#fff;padding:.64rem;margin-top:.65rem}' +
      '.line{font-size:.8rem;color:#31465f;margin-bottom:.25rem}' +
      '.muted{font-size:.79rem;color:#5b6f86}' +
      '@media (max-width:980px){.workspace{grid-template-columns:1fr}.subjects{grid-template-columns:1fr}}' +
      '@media (max-width:700px){.row,.row.search{grid-template-columns:1fr}}' +
      '</style>' +
      '<div class="wrap">' +
      '<div class="hero"><h1>Class Management</h1><p>Manage staff class allocations and connect classes to the correct subject trackers.</p></div>' +
      '<section class="card" id="staff-view"><h2>Teacher Profiles</h2><div class="body">' +
      '<div class="row search">' +
      '<div><label for="staff-search">Search staff by name or email</label><input id="staff-search" placeholder="Search staff by name or email"></div>' +
      '</div>' +
      '<div class="btns"><button class="ghost" id="reload-staff-btn">Retry loading staff</button></div>' +
      '<div id="staff-fallback-note" class="message warn hidden">Some staff data was loaded from a backup source.</div>' +
      '<div id="staff-source-line" class="line hidden"></div>' +
      '<div id="staff-state" class="state">Loading staff…</div>' +
      '<div id="staff-grid" class="staff-grid hidden"></div>' +
      '</div></section>' +

      '<section class="card hidden" id="workspace-view"><h2>Teacher Workspace</h2><div class="body">' +
      '<div class="btns" style="margin-top:0;"><button class="ghost" id="back-btn">Back to staff list</button></div>' +
      '<div class="banner"><div class="banner-grid"><div id="teacher-avatar" class="avatar">--</div><div><div id="teacher-name" class="banner-name">—</div><div id="teacher-email" class="banner-sub">—</div><div id="teacher-meta" class="chips"></div></div></div></div>' +
      '<div class="tabs"><button class="tab active" data-tab="classes">Classes</button><button class="tab" data-tab="activity">Activity</button><button class="tab" data-tab="notes">Notes</button></div>' +
      '<div class="workspace"><div>' +
      '<section id="tab-classes"><div class="row"><div><label for="academic-year">Academic year label</label><input id="academic-year"></div><div></div></div>' +
      '<label>Step 1: Select subject</label><div class="subjects"><button class="subject" data-subject="art"><strong>Art &amp; Design</strong><span>Routes to Art tracker</span></button><button class="subject" data-subject="drama"><strong>Drama</strong><span>Routes to Drama tracker</span></button><button class="subject disabled" data-subject="photography" title="Photography editing is temporarily disabled until full backend support is enabled."><strong>Photography</strong><span>Temporarily unavailable</span></button></div>' +
      '<div id="subject-note" class="message warn hidden"></div>' +
      '<div id="classes-state" class="state">Select a subject to load classes for this teacher.</div>' +
      '<div id="class-editor" class="hidden">' +
      '<div class="table-wrap"><table><thead><tr><th>Class code/name</th><th>Year group</th><th>Course/level</th><th>Room</th><th>Status</th><th>Actions</th></tr></thead><tbody id="class-body"></tbody></table></div>' +
      '<div class="btns"><button class="ghost" id="add-row-btn">Add one class row</button><button class="secondary" id="reload-classes-btn">Reload current classes</button></div>' +
      '<label for="paste-classes" style="margin-top:.65rem;">Paste classes line by line</label><textarea id="paste-classes" placeholder="S1 Drama&#10;S2 Drama&#10;S3 Drama"></textarea><div class="btns"><button class="ghost" id="add-paste-btn">Add pasted classes</button></div>' +
      '<div class="panel"><div class="line" id="review-add">Classes to add: 0</div><div class="line" id="review-update">Classes to update: 0</div><div class="line" id="review-remove">Classes to remove: 0</div><div class="line" id="review-conflicts">Potential conflicts: not checked</div></div>' +
      '<div class="btns"><button class="secondary" id="check-conflicts-btn">Review conflicts</button><button id="save-btn">Save classes for this teacher</button></div>' +
      '<div id="save-message" class="message hidden"></div>' +
      '</div></section>' +
      '<section id="tab-activity" class="hidden"><div class="panel"><div class="muted">Recent activity</div><div id="activity-main" class="state">No recent activity yet.</div></div></section>' +
      '<section id="tab-notes" class="hidden"><div class="panel"><label for="notes-input">Notes</label><textarea id="notes-input" placeholder="Add notes about this teacher\'s class allocations."></textarea><div class="btns"><button class="ghost" id="save-notes-btn">Save notes</button></div><div id="notes-message" class="message hidden"></div></div></section>' +
      '</div><div><div class="panel"><div class="muted">Class summary</div><div id="sum-total" class="line">Total classes: 0</div><div id="sum-subjects" class="line">Subjects: 0</div><div id="sum-years" class="line">Year groups: 0</div><div id="sum-review" class="line">Classes needing review: 0</div></div><div class="panel"><div class="muted">Recent activity</div><div id="activity-side" class="state">No activity yet.</div></div></div></div>' +
      '</div></section>' +

      '<section class="card"><h2>Secondary tools</h2><div class="body"><details id="bulk-tools"><summary>Bulk Add Classes / Import / Promotion</summary><div style="margin-top:.75rem">' +
      '<div class="row"><div><label for="bulk-year">Academic year label</label><input id="bulk-year"></div><div><label for="bulk-mode">Import mode</label><select id="bulk-mode"><option value="add_only">Add new classes only</option><option value="replace">Replace existing classes (advanced)</option></select></div></div>' +
      '<label for="bulk-file">Import CSV file</label><input type="file" id="bulk-file" accept=".csv,text/csv"><label for="bulk-json" style="margin-top:.6rem;">Or paste JSON rows</label><textarea id="bulk-json"></textarea><label class="muted"><input type="checkbox" id="bulk-override"> Override conflicts</label>' +
      '<div class="btns"><button class="ghost" id="bulk-sample-btn">Load sample payload</button><button class="secondary" id="bulk-check-btn">Check conflicts</button><button id="bulk-run-btn">Run bulk import</button></div><div id="bulk-message" class="message hidden"></div>' +
      '</div></details></div></section>' +
      '</div>';
  }

  function teacherStats(t) {
    return {
      art: Number((t && t.stats && t.stats.art) || 0),
      drama: Number((t && t.stats && t.stats.drama) || 0),
      photography: Number((t && t.stats && t.stats.photography) || 0)
    };
  }
  function teacherTotal(t) {
    var s = teacherStats(t);
    return s.art + s.drama + s.photography;
  }
  function teacherStatus(t) {
    if (!t || !t.email) return { cls: 'review', text: 'Needs review' };
    if (!teacherTotal(t)) return { cls: 'empty', text: 'No classes yet' };
    return { cls: 'assigned', text: 'Classes assigned' };
  }

  function addActivity(action, detail) {
    state.activity.unshift({
      action: action,
      detail: detail || '',
      at: new Date().toLocaleString(),
      actor: window.__authGuardEmail || 'admin'
    });
    state.activity = state.activity.slice(0, 40);
    var html = state.activity.length
      ? state.activity.slice(0, 8).map(function(item) {
          return '<div class="line"><strong>' + esc(item.action) + '</strong> — ' + esc(item.detail) + ' · ' + esc(item.at) + ' · ' + esc(item.actor) + '</div>';
        }).join('')
      : '';
    ['activity-main', 'activity-side'].forEach(function(id) {
      var node = el(id);
      if (!node) return;
      if (!state.activity.length) {
        node.className = 'state';
        node.textContent = 'No recent activity yet.';
      } else {
        node.className = '';
        node.innerHTML = html;
      }
    });
  }

  function normalizeStaffRows(rows) {
    var byId = {};
    (rows || []).forEach(function(row) {
      var id = String(row && (row.teacher_id || row.user_id) || '').trim();
      if (!id) return;
      if (!byId[id]) byId[id] = {
        teacher_id: id, display_name: '', email: '', role: 'teacher', department: '',
        stats: { art: 0, drama: 0, photography: 0 }
      };
      if (row.display_name || row.teacherName) byId[id].display_name = row.display_name || row.teacherName;
      if (row.email) byId[id].email = row.email;
      if (row.role) byId[id].role = row.role;
      if (row.department) byId[id].department = row.department;
    });
    return Object.keys(byId).map(function(key) { return byId[key]; }).sort(function(a, b) {
      return String(a.display_name || a.email || '').localeCompare(String(b.display_name || b.email || ''));
    });
  }

  function hydrateStats(rows) {
    if (!window.DataService || typeof window.DataService.getAllForMonitoring !== 'function') return Promise.resolve(rows);
    return window.DataService.getAllForMonitoring().then(function(monitoringRows) {
      var byUser = {};
      (monitoringRows || []).forEach(function(row) {
        var id = String(row && row.user_id || '').trim();
        if (!id) return;
        if (!byUser[id]) byUser[id] = { art: 0, drama: 0, photography: 0 };
        if (row.data_type === 'art-v2') byUser[id].art += 1;
        if (row.data_type === 'drama-v3') byUser[id].drama += 1;
      });
      rows.forEach(function(row) {
        row.stats = byUser[row.teacher_id] || { art: 0, drama: 0, photography: 0 };
      });
      return rows;
    }).catch(function() { return rows; });
  }

  function populateFilters() {
    if (!el('filter-department') || !el('filter-role')) return;
    var departments = {};
    var roles = {};
    state.staff.forEach(function(row) {
      departments[row.department || 'Unassigned'] = true;
      roles[row.role || 'teacher'] = true;
    });
    el('filter-department').innerHTML = '<option value="">All departments</option>' + Object.keys(departments).sort().map(function(v) {
      return '<option value="' + esc(v) + '">' + esc(v) + '</option>';
    }).join('');
    el('filter-role').innerHTML = '<option value="">All roles</option>' + Object.keys(roles).sort().map(function(v) {
      return '<option value="' + esc(v) + '">' + esc(v) + '</option>';
    }).join('');
  }

  function setStaffState(text) {
    var node = el('staff-state');
    node.className = 'state';
    node.textContent = text || '';
    el('staff-grid').className = 'staff-grid hidden';
  }
  function showStaffGrid() {
    el('staff-state').className = 'state hidden';
    el('staff-grid').className = 'staff-grid';
  }
  function renderStaffGrid() {
    var grid = el('staff-grid');
    if (!state.filtered.length) {
      setStaffState(String(el('staff-search').value || '').trim() ? 'No matching staff found.' : 'No staff found.');
      return;
    }
    showStaffGrid();
    grid.innerHTML = state.filtered.map(function(t) {
      var st = teacherStatus(t);
      return '<button class="staff-card" data-id="' + esc(t.teacher_id) + '">' +
        '<div class="staff-head"><div class="avatar">' + esc((t.display_name || t.email || '??').slice(0,2).toUpperCase()) + '</div><div><h3 class="name">' + esc(t.display_name || t.email || 'Unknown') + '</h3><p class="email">' + esc(t.email || 'No email available') + '</p></div></div>' +
        '<div style="text-align:right"><div class="meta">Total classes: ' + teacherTotal(t) + '</div><div class="status ' + st.cls + '" style="margin-top:.25rem;">' + st.text + '</div><div class="muted" style="margin-top:.3rem;font-weight:700;color:#1f3552;">Manage classes</div></div>' +
      '</button>';
    }).join('');
    Array.prototype.forEach.call(grid.querySelectorAll('.staff-card'), function(card) {
      card.addEventListener('click', function() {
        var id = String(card.getAttribute('data-id') || '');
        var teacher = state.staff.find(function(row) { return row.teacher_id === id; });
        if (!teacher) return;
        openWorkspace(teacher);
      });
    });
  }

  function applyStaffFilters() {
    var q = String(el('staff-search').value || '').trim().toLowerCase();
    var dept = el('filter-department') ? String(el('filter-department').value || '').trim().toLowerCase() : '';
    var role = el('filter-role') ? String(el('filter-role').value || '').trim().toLowerCase() : '';
    var subject = el('filter-subject') ? normalizeSubject(el('filter-subject').value || '') : '';
    state.filtered = state.staff.filter(function(t) {
      var hay = (String(t.display_name || '') + ' ' + String(t.email || '')).toLowerCase();
      var s = teacherStats(t);
      var subjectMatch = !subject || (subject === 'art' && s.art > 0) || (subject === 'drama' && s.drama > 0) || (subject === 'photography' && s.photography > 0);
      return (!q || hay.indexOf(q) !== -1) &&
        (!dept || String(t.department || 'Unassigned').toLowerCase() === dept) &&
        (!role || String(t.role || 'teacher').toLowerCase() === role) &&
        subjectMatch;
    });
    renderStaffGrid();
  }

  function loadStaff() {
    setStaffState('Loading staff…');
    setMessage('staff-fallback-note', null, '');
    el('staff-source-line').className = 'line hidden';
    var loader = window.DataService && window.DataService.listTeachingStaffForClassLoaderDetailed
      ? window.DataService.listTeachingStaffForClassLoaderDetailed()
      : window.DataService.listTeachingStaffForClassLoader().then(function(rows) {
          return { rows: rows, diagnostics: { source: 'legacy_method', fallback_used: false } };
        });
    loader.then(function(payload) {
      var diagnostics = payload && payload.diagnostics ? payload.diagnostics : null;
      return hydrateStats(normalizeStaffRows((payload && payload.rows) || [])).then(function(rows) {
        state.staff = rows;
        state.filtered = rows.slice();
        populateFilters();
        applyStaffFilters();
        if (diagnostics) {
          el('staff-source-line').className = 'line';
          el('staff-source-line').textContent = 'Staff loaded: ' + rows.length;
          if (diagnostics.fallback_used) setMessage('staff-fallback-note', 'warn', 'Some staff data was loaded from a backup source.');
        }
      });
    }).catch(function(err) {
      setStaffState('Unable to load staff. Use Retry loading staff.');
      setMessage('staff-fallback-note', 'error', String(err && err.message || err));
    });
  }

  function showView(view) {
    el('staff-view').className = view === 'staff' ? 'card' : 'card hidden';
    el('workspace-view').className = view === 'workspace' ? 'card' : 'card hidden';
  }

  function switchTab(tab) {
    ['classes', 'activity', 'notes'].forEach(function(id) {
      el('tab-' + id).className = id === tab ? '' : 'hidden';
      var btn = document.querySelector('.tab[data-tab="' + id + '"]');
      if (btn) btn.className = id === tab ? 'tab active' : 'tab';
    });
  }

  function setClassState(message, showEditor) {
    var stateNode = el('classes-state');
    stateNode.className = showEditor ? 'state hidden' : 'state';
    stateNode.textContent = message || '';
    el('class-editor').className = showEditor ? '' : 'hidden';
  }

  function renderTeacherBanner() {
    var t = state.selectedTeacher;
    if (!t) return;
    el('teacher-avatar').textContent = (t.display_name || t.email || '??').slice(0, 2).toUpperCase();
    el('teacher-name').textContent = t.display_name || t.email || 'Unknown';
    el('teacher-email').textContent = t.email || 'No email available';
    el('teacher-meta').innerHTML = '' +
      '<span class="chip">Role: ' + esc(t.role || 'teacher') + '</span>' +
      '<span class="chip">Department: ' + esc(t.department || 'Unassigned') + '</span>' +
      '<span class="chip">Total classes: ' + teacherTotal(t) + '</span>';
  }

  function cloneRow(row) {
    return {
      class_id: row.class_id || '',
      class_code: row.class_code || '',
      class_name: row.class_name || '',
      year_level: row.year_level || 'S1',
      course_level: row.course_level || '',
      room: row.room || '',
      status: row.status || 'active'
    };
  }

  function renderClassRows() {
    var body = el('class-body');
    if (!state.classes.length) {
      body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#5b6f86;">No classes added yet.</td></tr>';
      return;
    }
    body.innerHTML = state.classes.map(function(r, idx) {
      return '<tr>' +
        '<td><input data-idx="' + idx + '" data-field="class_name" value="' + esc(r.class_name) + '" placeholder="Class name"><div class="muted" style="margin-top:.2rem;">Code <input style="width:120px;display:inline-block;margin-left:.2rem" data-idx="' + idx + '" data-field="class_code" value="' + esc(r.class_code) + '"></div></td>' +
        '<td><select data-idx="' + idx + '" data-field="year_level">' + ['S1','S2','S3','S4','S5','S6'].map(function(level) { return '<option value="' + level + '"' + (r.year_level === level ? ' selected' : '') + '>' + level + '</option>'; }).join('') + '</select></td>' +
        '<td><input data-idx="' + idx + '" data-field="course_level" value="' + esc(r.course_level) + '" placeholder="Course/level"></td>' +
        '<td><input data-idx="' + idx + '" data-field="room" value="' + esc(r.room) + '" placeholder="Room"></td>' +
        '<td><select data-idx="' + idx + '" data-field="status">' + ['active','needs_review','inactive'].map(function(st) { return '<option value="' + st + '"' + (r.status === st ? ' selected' : '') + '>' + st + '</option>'; }).join('') + '</select></td>' +
        '<td><button class="ghost" data-remove="' + idx + '">Remove</button></td>' +
      '</tr>';
    }).join('');
    Array.prototype.forEach.call(body.querySelectorAll('input,select'), function(node) {
      function update() {
        var idx = Number(node.getAttribute('data-idx'));
        var field = String(node.getAttribute('data-field') || '');
        if (!state.classes[idx] || !field) return;
        state.classes[idx][field] = node.value;
        state.unsaved = true;
        refreshReview();
        refreshSummary();
      }
      node.addEventListener('input', update);
      node.addEventListener('change', update);
    });
    Array.prototype.forEach.call(body.querySelectorAll('button[data-remove]'), function(btn) {
      btn.addEventListener('click', function() {
        var idx = Number(btn.getAttribute('data-remove'));
        var row = state.classes[idx];
        if (!row) return;
        if (row.class_id) state.removedClasses.push(cloneRow(row));
        state.classes.splice(idx, 1);
        state.unsaved = true;
        renderClassRows();
        refreshReview();
        refreshSummary();
      });
    });
  }

  function refreshReview() {
    var original = {};
    state.originalClasses.forEach(function(r) { original[r.class_id || ('code:' + r.class_code)] = r; });
    var add = 0;
    var update = 0;
    state.classes.forEach(function(r) {
      var key = r.class_id || ('code:' + r.class_code);
      var old = original[key];
      if (!old) add += 1;
      else {
        var a = [old.class_code, old.class_name, old.year_level, old.course_level, old.room, old.status].join('|').toLowerCase();
        var b = [r.class_code, r.class_name, r.year_level, r.course_level, r.room, r.status].join('|').toLowerCase();
        if (a !== b) update += 1;
      }
    });
    el('review-add').textContent = 'Classes to add: ' + add;
    el('review-update').textContent = 'Classes to update: ' + update;
    el('review-remove').textContent = 'Classes to remove: ' + state.removedClasses.length;
    el('review-conflicts').textContent = 'Potential conflicts: ' + (state.conflictCount == null ? 'not checked' : state.conflictCount);
  }

  function refreshSummary() {
    var years = {};
    var reviewCount = 0;
    state.classes.forEach(function(r) {
      years[String(r.year_level || '')] = true;
      if (String(r.status || '') === 'needs_review') reviewCount += 1;
    });
    el('sum-total').textContent = 'Total classes: ' + state.classes.length;
    el('sum-subjects').textContent = 'Subjects: ' + (state.selectedSubject ? 1 : 0);
    el('sum-years').textContent = 'Year groups: ' + Object.keys(years).filter(Boolean).length;
    el('sum-review').textContent = 'Classes needing review: ' + reviewCount;
  }

  function openWorkspace(teacher) {
    if (state.unsaved && !window.confirm('You have unsaved changes. Continue?')) return;
    state.selectedTeacher = teacher;
    state.selectedSubject = '';
    state.classes = [];
    state.originalClasses = [];
    state.removedClasses = [];
    state.conflictCount = null;
    state.unsaved = false;
    showView('workspace');
    renderTeacherBanner();
    switchTab('classes');
    setClassState('Select a subject to load classes for this teacher.', false);
    renderClassRows();
    refreshReview();
    refreshSummary();
    loadNotesForTeacher();
    addActivity('Opened teacher workspace', teacher.display_name || teacher.email || 'Unknown');
    Array.prototype.forEach.call(document.querySelectorAll('.subject'), function(node) {
      node.className = String(node.getAttribute('data-subject') || '') === 'photography' ? 'subject disabled' : 'subject';
    });
  }

  function loadClasses() {
    if (!state.selectedTeacher || !state.selectedSubject) return;
    var year = String(el('academic-year').value || '').trim();
    if (!year) {
      setMessage('save-message', 'error', 'Academic year label is required.');
      return;
    }
    setClassState('Loading classes for selected subject…', false);
    window.DataService.listTeacherSubjectClassesForLoader({
      teacherId: state.selectedTeacher.teacher_id,
      subject: state.selectedSubject,
      academicYearLabel: year
    }).then(function(rows) {
      var mapped = (rows || []).map(function(r) {
        return {
          class_id: r.class_id || '',
          class_code: r.class_code || '',
          class_name: r.class_name || '',
          year_level: String(r.year_level_label || r.year_level || 'S1').toUpperCase(),
          course_level: '',
          room: '',
          status: 'active'
        };
      });
      state.originalClasses = mapped.map(cloneRow);
      state.classes = mapped.map(cloneRow);
      state.removedClasses = [];
      state.conflictCount = null;
      state.unsaved = false;
      renderClassRows();
      refreshReview();
      refreshSummary();
      setClassState(mapped.length ? '' : 'No classes for this subject yet.', true);
      setMessage('save-message', null, '');
    }).catch(function(err) {
      setClassState('Unable to load classes for this subject. Retry.', false);
      setMessage('save-message', 'error', String(err && err.message || err));
    });
  }

  function setSubject(subject) {
    if (subject === 'photography') {
      state.selectedSubject = '';
      setMessage('subject-note', 'warn', 'Photography editing is temporarily unavailable until full backend support is enabled.');
      setClassState('Select Art & Design or Drama to continue.', false);
      return;
    }
    state.selectedSubject = subject;
    setMessage('subject-note', null, '');
    Array.prototype.forEach.call(document.querySelectorAll('.subject'), function(node) {
      var s = String(node.getAttribute('data-subject') || '');
      node.className = s === 'photography' ? 'subject disabled' : (s === subject ? 'subject active' : 'subject');
    });
    loadClasses();
  }

  function addRow() {
    state.classes.push({ class_id: '', class_code: '', class_name: '', year_level: 'S1', course_level: '', room: '', status: 'active' });
    state.unsaved = true;
    setClassState('', true);
    renderClassRows();
    refreshReview();
    refreshSummary();
  }

  function addPastedRows() {
    if (!state.selectedSubject) throw new Error('Select subject first.');
    var rows = [];
    String(el('paste-classes').value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').forEach(function(raw, idx) {
      var line = String(raw || '').trim();
      if (!line) return;
      var year = 'S1';
      var name = line;
      var m = /^(S[1-6])\s+(.+)$/i.exec(line);
      if (m) {
        year = parseYear(m[1]) || 'S1';
        name = m[2];
      }
      var code = name.replace(/[^a-z0-9]+/gi, '').slice(0, 8).toUpperCase() || ('CLS' + (idx + 1));
      rows.push({ class_id: '', class_code: code, class_name: name, year_level: year, course_level: '', room: '', status: 'active' });
    });
    if (!rows.length) throw new Error('No class lines found.');
    rows.forEach(function(r) { state.classes.push(r); });
    state.unsaved = true;
    setClassState('', true);
    renderClassRows();
    refreshReview();
    refreshSummary();
    addActivity('Added pasted classes', rows.length + ' rows');
  }

  function checkConflicts() {
    if (!state.selectedTeacher || !state.selectedSubject) throw new Error('Select teacher and subject first.');
    if (!window.DataService || typeof window.DataService.detectExistingClassConflicts !== 'function') {
      state.conflictCount = 0;
      refreshReview();
      setMessage('save-message', 'warn', 'Conflict check is unavailable in this environment.');
      return Promise.resolve();
    }
    var year = String(el('academic-year').value || '').trim();
    var rows = state.classes.map(function(r) {
      return {
        subject: state.selectedSubject,
        year_level: r.year_level,
        class_code: r.class_code,
        class_name: r.class_name,
        teacher_email: state.selectedTeacher.email || ''
      };
    });
    return window.DataService.detectExistingClassConflicts(rows, year).then(function(conflicts) {
      state.conflictCount = (conflicts || []).length;
      refreshReview();
      setMessage('save-message', state.conflictCount ? 'warn' : 'success', state.conflictCount ? (state.conflictCount + ' potential conflict(s) found. Review before saving.') : 'No conflicts found.');
    });
  }

  function saveClasses() {
    if (!state.selectedTeacher || !state.selectedSubject) throw new Error('Select teacher and subject first.');
    var year = String(el('academic-year').value || '').trim();
    if (!year) throw new Error('Academic year label is required');
    if (!state.classes.length) throw new Error('Add at least one class row before saving');
    var rows = state.classes.map(function(r, idx) {
      var code = String(r.class_code || '').trim() || ('CLS' + (idx + 1));
      return {
        year_level: parseYear(r.year_level || 'S1') || 'S1',
        class_code: code,
        class_name: String(r.class_name || code).trim()
      };
    });
    return window.DataService.upsertTeacherSubjectClassesForLoader({
      teacherId: state.selectedTeacher.teacher_id,
      subject: state.selectedSubject,
      academicYearLabel: year,
      classes: rows,
      replaceExisting: true
    }).then(function() {
      state.unsaved = false;
      setMessage('save-message', 'success', 'Classes saved successfully.');
      addActivity('Classes saved', (state.selectedSubject === 'art' ? 'Art & Design' : 'Drama') + ' · ' + rows.length + ' classes');
      return loadClasses();
    }).catch(function(err) {
      setMessage('save-message', 'error', 'Some classes could not be saved. Review the rows and try again.');
      throw err;
    });
  }

  function loadNotesStore() {
    if (!window.DataService || typeof window.DataService.get !== 'function') return Promise.resolve();
    return window.DataService.get('classManagementNotesV1').then(function(data) {
      if (data && typeof data === 'object') state.notesStore = data;
    }).catch(function() {});
  }
  function loadNotesForTeacher() {
    if (!state.selectedTeacher) return;
    el('notes-input').value = state.notesStore[state.selectedTeacher.teacher_id] || '';
  }
  function saveNotes() {
    if (!state.selectedTeacher) return Promise.resolve();
    state.notesStore[state.selectedTeacher.teacher_id] = String(el('notes-input').value || '');
    if (!window.DataService || typeof window.DataService.set !== 'function') {
      setMessage('notes-message', 'success', 'Notes saved.');
      return Promise.resolve();
    }
    return window.DataService.set('classManagementNotesV1', state.notesStore).then(function() {
      setMessage('notes-message', 'success', 'Notes saved.');
      addActivity('Notes updated', 'Saved notes for teacher');
    }).catch(function() {
      setMessage('notes-message', 'error', 'Could not save notes right now.');
    });
  }

  function parseCsv(text) {
    var input = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var rows = [];
    var row = [];
    var cell = '';
    var inQuotes = false;
    for (var i = 0; i < input.length; i++) {
      var ch = input[i];
      var next = input[i + 1];
      if (ch === '"') {
        if (inQuotes && next === '"') { cell += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        row.push(cell); cell = '';
      } else if (ch === '\n' && !inQuotes) {
        row.push(cell); rows.push(row); row = []; cell = '';
      } else {
        cell += ch;
      }
    }
    if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
    if (!rows.length) return [];
    var headers = rows[0].map(function(v) { return String(v || '').trim().toLowerCase().replace(/\s+/g, '_'); });
    var out = [];
    for (var r = 1; r < rows.length; r++) {
      var cur = rows[r];
      if (!cur || !cur.length) continue;
      var obj = {};
      var has = false;
      for (var c = 0; c < headers.length; c++) {
        if (!headers[c]) continue;
        obj[headers[c]] = String(cur[c] == null ? '' : cur[c]).trim();
        if (obj[headers[c]]) has = true;
      }
      if (has) out.push(obj);
    }
    return out;
  }
  function parseBulkRows() {
    var rows = csvRowsCache;
    if (!rows) {
      var raw = String(el('bulk-json').value || '').trim();
      rows = raw ? JSON.parse(raw) : [];
    }
    if (!Array.isArray(rows) || !rows.length) throw new Error('No bulk rows found.');
    return rows;
  }
  function runBulkConflicts() {
    var rows = parseBulkRows();
    var year = String(el('bulk-year').value || '').trim();
    if (!year) throw new Error('Academic year label is required');
    return window.DataService.detectExistingClassConflicts(rows, year).then(function(conflicts) {
      setMessage('bulk-message', (conflicts || []).length ? 'warn' : 'success', (conflicts || []).length ? ((conflicts || []).length + ' potential conflict(s) found.') : 'No conflicts found.');
    });
  }
  function runBulkImport() {
    var rows = parseBulkRows();
    var year = String(el('bulk-year').value || '').trim();
    if (!year) throw new Error('Academic year label is required');
    var mode = String(el('bulk-mode').value || 'add_only');
    var override = !!el('bulk-override').checked;
    return window.DataService.bulkUpsertPupilsAndEnrollments({
      rows: rows,
      academicYearLabel: year,
      mode: mode,
      overrideConflicts: override
    }).then(function() {
      setMessage('bulk-message', 'success', 'Bulk import completed.');
    });
  }

  function exportCurrent() {
    var rows = state.selectedTeacher
      ? state.classes.map(function(r) {
          return { teacher: state.selectedTeacher.display_name || state.selectedTeacher.email || 'Unknown', subject: state.selectedSubject, class_code: r.class_code, class_name: r.class_name, year_level: r.year_level };
        })
      : state.filtered.map(function(t) {
          var s = teacherStats(t);
          return { teacher: t.display_name || t.email || 'Unknown', email: t.email || '', role: t.role || '', department: t.department || '', art: s.art, drama: s.drama, photography: s.photography };
        });
    var headers = Object.keys(rows[0] || { message: 'no_data' });
    var csv = [headers.join(',')].concat(rows.map(function(row) {
      return headers.map(function(h) { return '"' + String(row[h] == null ? '' : row[h]).replace(/"/g, '""') + '"'; }).join(',');
    })).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = state.selectedTeacher ? 'teacher_classes_export.csv' : 'staff_profiles_export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function bind(id, fn, errorTarget) {
    var node = el(id);
    if (!node) return;
    node.addEventListener('click', function() {
      Promise.resolve().then(fn).catch(function(err) {
        setMessage(errorTarget, 'error', String(err && err.message || err));
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    renderLayout();
    var year = todayAcademicYear();
    el('academic-year').value = year;
    el('bulk-year').value = year;
    showView('staff');
    loadNotesStore();

    ['staff-search', 'filter-department', 'filter-role', 'filter-subject'].forEach(function(id) {
      var node = el(id);
      if (!node) return;
      node.addEventListener('input', applyStaffFilters);
      node.addEventListener('change', applyStaffFilters);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function(btn) {
      btn.addEventListener('click', function() { switchTab(String(btn.getAttribute('data-tab') || 'classes')); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.subject'), function(btn) {
      btn.addEventListener('click', function() { setSubject(String(btn.getAttribute('data-subject') || '')); });
    });

    bind('reload-staff-btn', loadStaff, 'staff-fallback-note');
    bind('back-btn', function() {
      if (state.unsaved && !window.confirm('You have unsaved changes. Return to staff list anyway?')) return;
      showView('staff');
    }, 'save-message');
    bind('add-row-btn', addRow, 'save-message');
    bind('reload-classes-btn', loadClasses, 'save-message');
    bind('add-paste-btn', addPastedRows, 'save-message');
    bind('check-conflicts-btn', checkConflicts, 'save-message');
    bind('save-btn', saveClasses, 'save-message');
    bind('save-notes-btn', saveNotes, 'notes-message');
    bind('export-btn', exportCurrent, 'staff-fallback-note');
    bind('bulk-check-btn', runBulkConflicts, 'bulk-message');
    bind('bulk-run-btn', runBulkImport, 'bulk-message');
    bind('bulk-sample-btn', function() {
      el('bulk-json').value = JSON.stringify([{ subject: 'drama', year_level: 'S1', class_code: 'D1', class_name: 'S1 Drama D1', teacher_email: 'teacher1@school.org', first_name: 'Alex', last_name: 'Brown' }], null, 2);
      csvRowsCache = null;
      setMessage('bulk-message', 'success', 'Sample payload loaded.');
    }, 'bulk-message');

    if (el('bulk-open-btn')) {
      el('bulk-open-btn').addEventListener('click', function() {
        el('bulk-tools').open = true;
        el('bulk-tools').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    if (el('import-open-btn')) {
      el('import-open-btn').addEventListener('click', function() {
        el('bulk-tools').open = true;
        el('bulk-file').click();
      });
    }
    el('bulk-file').addEventListener('change', function(e) {
      var file = e && e.target && e.target.files ? e.target.files[0] : null;
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function() {
        try {
          csvRowsCache = parseCsv(reader.result);
          if (!csvRowsCache.length) throw new Error('CSV file is empty or missing rows.');
          el('bulk-json').value = JSON.stringify(csvRowsCache, null, 2);
          setMessage('bulk-message', 'success', 'CSV loaded with ' + csvRowsCache.length + ' rows.');
        } catch (err) {
          csvRowsCache = null;
          setMessage('bulk-message', 'error', String(err && err.message || err));
        }
      };
      reader.readAsText(file);
    });
    el('bulk-json').addEventListener('input', function() { csvRowsCache = null; });
    window.addEventListener('beforeunload', function(e) {
      if (!state.unsaved) return;
      e.preventDefault();
      e.returnValue = '';
    });

    loadStaff();
  });
})();
