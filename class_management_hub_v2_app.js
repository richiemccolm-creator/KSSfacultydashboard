(function() {
  if (window.ClassManagementHubV2Loaded) return;
  window.ClassManagementHubV2Loaded = true;

  var state = {
    staff: [],
    filtered: [],
    selectedTeacher: null,
    selectedSubject: '',
    selectedYear: '',
    academicYears: [],
    classes: [],
    originalClasses: [],
    removedClasses: [],
    conflictCount: null,
    notesStore: {},
    activity: [],
    unsaved: false,
    bulkRows: [],
    bulkTeacherMatches: [],
    bulkSelectedTeacherEmails: {}
  };

  function el(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>\"']/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }
  function actorEmail() { return window.__authGuardEmail || 'admin'; }
  function normalizeSubject(v) {
    return window.DataService && window.DataService.normalizeTrackerSubject
      ? (window.DataService.normalizeTrackerSubject(v) || '')
      : '';
  }
  function subjectLabel(subject) {
    if (subject === 'art') return 'Art & Design';
    if (subject === 'drama') return 'Drama';
    if (subject === 'photography') return 'Photography';
    return subject || 'Unknown';
  }
  function parseYearLevel(value) {
    var m = /^s?([1-6])$/i.exec(String(value || '').trim());
    return m ? 'S' + m[1] : '';
  }
  function initials(name, email) {
    var raw = String(name || email || '??').trim();
    if (!raw) return '??';
    var parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
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
  function todayAcademicYearLabel() {
    var d = new Date();
    var y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
    return y + '-' + (y + 1);
  }

  function renderLayout() {
    document.body.innerHTML = '' +
      '<style>' +
      '*{box-sizing:border-box}' +
      'body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#eef2f7;color:#15263e}' +
      '.wrap{max-width:1240px;margin:0 auto;padding:1rem}' +
      '.hero{background:linear-gradient(120deg,#1e2d4a,#223f62);color:#fff;border-radius:14px;padding:1.15rem 1.2rem;margin-bottom:.8rem}' +
      '.hero h1{margin:0 0 .2rem;font-size:1.32rem;font-weight:700}' +
      '.hero p{margin:0;color:rgba(255,255,255,.9);font-size:.94rem}' +
      '.card{background:#fff;border:1px solid #d8e2ef;border-radius:12px;box-shadow:0 2px 10px rgba(2,6,23,.05);margin-bottom:1rem;overflow:hidden}' +
      '.card h2{margin:0;padding:.84rem 1rem;background:#f8fafd;border-bottom:1px solid #e4ebf5;font-size:.96rem}' +
      '.body{padding:1rem}' +
      '.row{display:grid;grid-template-columns:1fr 1fr;gap:.68rem;margin-bottom:.66rem}' +
      'label{display:block;font-size:.79rem;color:#41556e;font-weight:600;margin-bottom:.3rem}' +
      'input,select,textarea{width:100%;border:1px solid #cfd9e7;border-radius:10px;padding:.56rem .64rem;font:inherit;font-size:.9rem;background:#fff}' +
      'textarea{min-height:108px;resize:vertical}' +
      '.btns{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.55rem}' +
      'button{border:none;background:#1e2d4a;color:#fff;border-radius:10px;padding:.52rem .84rem;font-size:.84rem;font-weight:600;cursor:pointer}' +
      'button.secondary{background:#0f766e}' +
      'button.ghost{background:#eef3f9;color:#1f3552;border:1px solid #d2dbe8}' +
      'button.warn{background:#92400e}' +
      'button:disabled{opacity:.55;cursor:not-allowed}' +
      '.hidden{display:none!important}' +
      '.state{border:1px dashed #cfd9e7;border-radius:10px;background:#fbfdff;color:#50657c;padding:1rem;text-align:center;font-size:.87rem}' +
      '.message{margin-top:.55rem;border-radius:10px;padding:.46rem .6rem;font-size:.8rem}' +
      '.message.info{border:1px solid #dbe6f2;background:#f8fafc;color:#334155}' +
      '.message.success{border:1px solid #a7f3d0;background:#ecfdf5;color:#065f46}' +
      '.message.warn{border:1px solid #fde68a;background:#fffbeb;color:#92400e}' +
      '.message.error{border:1px solid #fecaca;background:#fef2f2;color:#991b1b}' +
      '.roster{display:grid;grid-template-columns:1fr;gap:.55rem;margin-top:.5rem}' +
      '.teacher-row{display:grid;grid-template-columns:1fr auto;align-items:center;gap:.75rem;border:1px solid #dbe5f1;border-radius:11px;background:#fff;padding:.72rem .8rem;text-align:left;cursor:pointer}' +
      '.teacher-row:hover{border-color:#90a8c7;box-shadow:0 1px 8px rgba(15,23,42,.07)}' +
      '.teacher-main{display:flex;gap:.58rem;align-items:flex-start;min-width:0}' +
      '.avatar{width:36px;height:36px;border-radius:999px;background:#e8eef7;color:#1f3552;display:inline-flex;align-items:center;justify-content:center;font-size:.76rem;font-weight:700;flex-shrink:0}' +
      '.teacher-name{margin:0;font-size:.92rem;color:#17314e;line-height:1.3}' +
      '.teacher-email{margin:0;color:#5d728a;font-size:.76rem;line-height:1.3;word-break:break-word}' +
      '.teacher-meta{font-size:.77rem;color:#455a72}' +
      '.status{display:inline-flex;align-items:center;border-radius:999px;padding:.14rem .5rem;font-size:.73rem;font-weight:700;border:1px solid transparent}' +
      '.status.assigned{border-color:#a7f3d0;background:#ecfdf5;color:#065f46}.status.empty{border-color:#fde68a;background:#fffbeb;color:#92400e}.status.review{border-color:#fecaca;background:#fef2f2;color:#991b1b}' +
      '.workspace{display:grid;grid-template-columns:2fr 1fr;gap:.8rem}' +
      '.banner{border:1px solid #dbe6f2;border-radius:10px;background:#f8fafc;padding:.62rem .7rem;margin-bottom:.65rem}' +
      '.banner-grid{display:grid;grid-template-columns:auto 1fr;gap:.56rem;align-items:center}' +
      '.banner-name{font-weight:700;color:#1f3552;font-size:.93rem}' +
      '.banner-sub{color:#5b6f86;font-size:.79rem}' +
      '.chips{display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.3rem}' +
      '.chip{border:1px solid #d2dbe8;border-radius:999px;background:#f8fafc;color:#324861;padding:.16rem .5rem;font-size:.72rem;font-weight:700}' +
      '.tabs{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.6rem}' +
      '.tab{border:1px solid #d3deeb;background:#fff;color:#233a56;border-radius:10px;padding:.44rem .64rem;font-size:.78rem}' +
      '.tab.active{background:#ecfdf5;border-color:#9ae6b4;color:#065f46}' +
      '.subjects{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem;margin-bottom:.6rem}' +
      '.subject{border:1px solid #d3ddea;border-radius:10px;background:#fff;color:#213a57;padding:.56rem .62rem;text-align:left;font-size:.81rem}' +
      '.subject strong{display:block;margin-bottom:.16rem}' +
      '.subject.active{border-color:#86efac;background:#ecfdf5;color:#065f46}' +
      '.subject.disabled{opacity:.5;cursor:not-allowed}' +
      '.table-wrap{border:1px solid #dbe6f2;border-radius:10px;background:#fff;overflow:auto}' +
      'table{width:100%;border-collapse:collapse;min-width:760px}' +
      'th,td{border-bottom:1px solid #e8eef6;padding:.42rem .45rem;text-align:left;font-size:.79rem;vertical-align:middle}' +
      'th{background:#f8fafc;color:#3a4e68;font-weight:700}' +
      '.panel{border:1px solid #dbe6f2;border-radius:10px;background:#fff;padding:.65rem;margin-top:.65rem}' +
      '.line{font-size:.8rem;color:#31465f;margin-bottom:.25rem}' +
      '.muted{font-size:.79rem;color:#5b6f86}' +
      '.year-row{display:grid;grid-template-columns:1fr auto;gap:.55rem;align-items:end}' +
      '.checklist{border:1px solid #dbe6f2;border-radius:10px;background:#fff;padding:.6rem;margin-top:.55rem;max-height:180px;overflow:auto}' +
      '.check-item{display:flex;gap:.5rem;align-items:flex-start;margin-bottom:.4rem;font-size:.8rem;color:#334155}' +
      '@media (max-width:980px){.workspace{grid-template-columns:1fr}.subjects{grid-template-columns:1fr}}' +
      '@media (max-width:760px){.row,.year-row{grid-template-columns:1fr}}' +
      '</style>' +
      '<div class="wrap">' +
      '<div class="hero"><h1>Class Management</h1><p>Manage class allocations for teachers with safe controls and clear review steps.</p></div>' +

      '<section class="card" id="staff-view"><h2>Select Teacher</h2><div class="body">' +
      '<div class="row"><div><label for="staff-search">Search staff by name or email</label><input id="staff-search" placeholder="Search staff by name or email"></div></div>' +
      '<div class="btns"><button class="ghost" id="reload-staff-btn">Retry loading staff</button></div>' +
      '<div id="staff-fallback-note" class="message warn hidden"></div>' +
      '<div id="staff-source-line" class="line hidden"></div>' +
      '<div id="staff-state" class="state">Loading staff…</div>' +
      '<div id="staff-grid" class="roster hidden"></div>' +
      '</div></section>' +

      '<section class="card hidden" id="workspace-view"><h2>Teacher Workspace</h2><div class="body">' +
      '<div class="btns" style="margin-top:0"><button class="ghost" id="back-btn">Back to staff list</button></div>' +
      '<div class="banner"><div class="banner-grid"><div id="teacher-avatar" class="avatar">--</div><div><div id="teacher-name" class="banner-name">—</div><div id="teacher-email" class="banner-sub">—</div><div id="teacher-meta" class="chips"></div></div></div></div>' +
      '<div class="tabs"><button class="tab active" data-tab="classes">Classes</button><button class="tab" data-tab="activity">Activity</button><button class="tab" data-tab="notes">Notes</button></div>' +
      '<div class="workspace"><div>' +
      '<section id="tab-classes">' +
      '<div class="year-row"><div><label for="academic-year">Academic year</label><select id="academic-year"></select></div><div><button class="ghost" id="year-refresh-btn">Refresh years</button></div></div>' +
      '<label style="margin-top:.55rem;">Step 1: Select subject</label>' +
      '<div class="subjects"><button class="subject" data-subject="art"><strong>Art &amp; Design</strong><span>Routes to Art tracker</span></button><button class="subject" data-subject="drama"><strong>Drama</strong><span>Routes to Drama tracker</span></button><button class="subject disabled" data-subject="photography" title="Photography editing is temporarily disabled until full backend support is enabled."><strong>Photography</strong><span>Temporarily unavailable</span></button></div>' +
      '<div id="subject-note" class="message warn hidden"></div>' +
      '<div id="classes-state" class="state">Select a year and subject to load current classes.</div>' +
      '<div id="class-editor" class="hidden">' +
      '<div class="table-wrap"><table><thead><tr><th>Class name</th><th>Class code</th><th>Year group</th><th>Status</th><th>Actions</th></tr></thead><tbody id="class-body"></tbody></table></div>' +
      '<div class="btns"><button class="ghost" id="add-row-btn">Add class row</button><button class="secondary" id="reload-classes-btn">Reload current classes</button></div>' +
      '<label for="paste-classes" style="margin-top:.62rem;">Paste class names line by line</label><textarea id="paste-classes" placeholder="S1 Drama&#10;S2 Drama&#10;S3 Drama"></textarea><div class="muted">Paste class names (one per line). Class codes are auto-generated and editable.</div><div class="btns"><button class="ghost" id="add-paste-btn">Add pasted classes</button></div>' +
      '<div class="panel"><div class="line" id="review-add">Classes to add: 0</div><div class="line" id="review-update">Classes to update: 0</div><div class="line" id="review-remove">Classes to remove: 0</div><div class="line" id="review-conflicts">Potential conflicts: not checked</div></div>' +
      '<div class="btns"><button class="secondary" id="check-conflicts-btn">Check conflicts</button><button class="ghost" id="replace-mode-btn" title="Optional: replace existing classes for this teacher/subject/year after confirmation.">Replace mode: off</button><button id="save-btn">Save classes</button></div>' +
      '<div id="save-message" class="message hidden"></div>' +
      '</div></section>' +
      '<section id="tab-activity" class="hidden"><div class="panel"><div class="muted">Recent activity</div><div id="activity-main" class="state">No recent activity yet.</div></div></section>' +
      '<section id="tab-notes" class="hidden"><div class="panel"><label for="notes-input">Notes</label><textarea id="notes-input" placeholder="Add admin notes about this teacher\'s class allocations."></textarea><div class="btns"><button class="ghost" id="save-notes-btn">Save notes</button></div><div id="notes-message" class="message hidden"></div></div></section>' +
      '</div><div><div class="panel"><div class="muted">Class summary</div><div id="sum-total" class="line">Total classes: 0</div><div id="sum-subjects" class="line">Subjects: 0</div><div id="sum-years" class="line">Year groups: 0</div><div id="sum-review" class="line">Classes needing review: 0</div></div><div class="panel"><div class="muted">Recent activity</div><div id="activity-side" class="state">No activity yet.</div></div></div></div>' +
      '</div></section>' +

      '<section class="card"><h2>Start-of-Year Excel Import</h2><div class="body">' +
      '<div class="row"><div><label for="bulk-year">Academic year</label><select id="bulk-year"></select></div><div><label>Template</label><div class="btns" style="margin-top:0"><button class="ghost" id="download-template-btn">Download Excel template (.xlsx)</button></div></div></div>' +
      '<label for="bulk-file">Upload completed Excel file (.xlsx)</label><input type="file" id="bulk-file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">' +
      '<div id="bulk-parse-message" class="message hidden"></div>' +
      '<div id="bulk-preview" class="panel hidden"><div class="muted">Preview before import</div><div id="bulk-preview-summary" class="line"></div><div id="bulk-unmatched" class="message warn hidden"></div><div class="muted" style="margin-top:.4rem;">Matched teachers (auto-detected). Select who to import for:</div><div id="bulk-teacher-checklist" class="checklist"></div><div class="btns"><button class="secondary" id="bulk-check-btn">Check conflicts</button><button class="ghost" id="bulk-reset-btn">Reset preview</button><button id="bulk-run-btn">Confirm import (append only)</button></div></div>' +
      '<div id="bulk-message" class="message hidden"></div>' +
      '</div></section>' +
      '</div>';
  }

  function loadAcademicYears() {
    var fallback = [{ label: todayAcademicYearLabel() }];
    var loader = window.DataService && typeof window.DataService.listAcademicYears === 'function'
      ? window.DataService.listAcademicYears()
      : Promise.resolve(fallback);
    return loader.then(function(rows) {
      state.academicYears = (rows || []).map(function(r) { return String(r.label || '').trim(); }).filter(Boolean);
      if (!state.academicYears.length) state.academicYears = [todayAcademicYearLabel()];
      var current = todayAcademicYearLabel();
      if (state.academicYears.indexOf(current) === -1) state.academicYears.unshift(current);
      [el('academic-year'), el('bulk-year')].forEach(function(select) {
        if (!select) return;
        var existingValue = String(select.value || '');
        select.innerHTML = state.academicYears.map(function(label) { return '<option value="' + esc(label) + '">' + esc(label) + '</option>'; }).join('');
        select.value = existingValue && state.academicYears.indexOf(existingValue) !== -1 ? existingValue : current;
      });
      state.selectedYear = el('academic-year').value || current;
    });
  }

  function isValidYearLabel(label) {
    return state.academicYears.indexOf(String(label || '').trim()) !== -1;
  }

  function normalizeStaffRows(rows) {
    var byId = {};
    (rows || []).forEach(function(row) {
      var id = String(row && (row.teacher_id || row.user_id) || '').trim();
      if (!id) return;
      if (!byId[id]) byId[id] = { teacher_id: id, display_name: '', email: '', role: 'teacher', department: '', stats: { art: 0, drama: 0, photography: 0 } };
      if (row.display_name || row.teacherName) byId[id].display_name = row.display_name || row.teacherName;
      if (row.email) byId[id].email = row.email;
      if (row.role) byId[id].role = row.role;
      if (row.department) byId[id].department = row.department;
    });
    return Object.keys(byId).map(function(key) { return byId[key]; }).sort(function(a, b) {
      return String(a.display_name || a.email || '').localeCompare(String(b.display_name || b.email || ''));
    });
  }

  function hydrateStaffStats(rows) {
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
      rows.forEach(function(row) { row.stats = byUser[row.teacher_id] || { art: 0, drama: 0, photography: 0 }; });
      return rows;
    }).catch(function() { return rows; });
  }

  function teacherStatus(teacher) {
    var total = Number(teacher.stats.art || 0) + Number(teacher.stats.drama || 0) + Number(teacher.stats.photography || 0);
    if (!teacher.email) return { cls: 'review', text: 'Needs review' };
    if (!total) return { cls: 'empty', text: 'No classes yet' };
    return { cls: 'assigned', text: 'Classes assigned' };
  }

  function setStaffState(message) {
    el('staff-state').className = 'state';
    el('staff-state').textContent = message || '';
    el('staff-grid').className = 'roster hidden';
  }
  function showStaffGrid() {
    el('staff-state').className = 'state hidden';
    el('staff-grid').className = 'roster';
  }
  function renderStaffGrid() {
    var grid = el('staff-grid');
    if (!state.filtered.length) {
      setStaffState(String(el('staff-search').value || '').trim() ? 'No matching staff found.' : 'No staff found.');
      return;
    }
    showStaffGrid();
    grid.innerHTML = state.filtered.map(function(t) {
      var status = teacherStatus(t);
      return '<button class="teacher-row" data-id="' + esc(t.teacher_id) + '">' +
        '<div class="teacher-main"><div class="avatar">' + esc(initials(t.display_name, t.email)) + '</div><div><h3 class="teacher-name">' + esc(t.display_name || t.email || 'Unknown') + '</h3><p class="teacher-email">' + esc(t.email || 'No email available') + '</p><div class="teacher-meta">Total classes: ' + (Number(t.stats.art || 0) + Number(t.stats.drama || 0) + Number(t.stats.photography || 0)) + '</div></div></div>' +
        '<div style="text-align:right"><span class="status ' + status.cls + '">' + status.text + '</span><div class="muted" style="margin-top:.32rem;font-weight:700;color:#1f3552;">Manage classes</div></div>' +
      '</button>';
    }).join('');
    Array.prototype.forEach.call(grid.querySelectorAll('.teacher-row'), function(row) {
      row.addEventListener('click', function() {
        var id = String(row.getAttribute('data-id') || '');
        var teacher = state.staff.find(function(item) { return item.teacher_id === id; });
        if (!teacher) return;
        openWorkspace(teacher);
      });
    });
  }

  function applyStaffFilter() {
    var query = String(el('staff-search').value || '').trim().toLowerCase();
    state.filtered = state.staff.filter(function(t) {
      var hay = (String(t.display_name || '') + ' ' + String(t.email || '')).toLowerCase();
      return !query || hay.indexOf(query) !== -1;
    });
    renderStaffGrid();
  }

  function loadStaff() {
    setStaffState('Loading staff…');
    setMessage('staff-fallback-note', null, '');
    el('staff-source-line').className = 'line hidden';
    var loader = window.DataService && window.DataService.listTeachingStaffForClassLoaderDetailed
      ? window.DataService.listTeachingStaffForClassLoaderDetailed()
      : window.DataService.listTeachingStaffForClassLoader().then(function(rows) { return { rows: rows, diagnostics: { source: 'legacy_method', fallback_used: false } }; });
    loader.then(function(payload) {
      var diagnostics = payload && payload.diagnostics ? payload.diagnostics : null;
      return hydrateStaffStats(normalizeStaffRows((payload && payload.rows) || [])).then(function(rows) {
        state.staff = rows;
        state.filtered = rows.slice();
        applyStaffFilter();
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

  function renderBanner() {
    var t = state.selectedTeacher;
    if (!t) return;
    el('teacher-avatar').textContent = initials(t.display_name, t.email);
    el('teacher-name').textContent = t.display_name || t.email || 'Unknown';
    el('teacher-email').textContent = t.email || 'No email available';
    el('teacher-meta').innerHTML = '' +
      '<span class="chip">Role: ' + esc(t.role || 'teacher') + '</span>' +
      '<span class="chip">Department: ' + esc(t.department || 'Unassigned') + '</span>' +
      '<span class="chip">Total classes: ' + (Number(t.stats.art || 0) + Number(t.stats.drama || 0) + Number(t.stats.photography || 0)) + '</span>';
  }

  function switchTab(tab) {
    ['classes', 'activity', 'notes'].forEach(function(id) {
      el('tab-' + id).className = id === tab ? '' : 'hidden';
      var btn = document.querySelector('.tab[data-tab="' + id + '"]');
      if (btn) btn.className = id === tab ? 'tab active' : 'tab';
    });
  }

  function setClassState(message, showEditor) {
    el('classes-state').className = showEditor ? 'state hidden' : 'state';
    el('classes-state').textContent = message || '';
    el('class-editor').className = showEditor ? '' : 'hidden';
  }

  function cloneClassRow(row) {
    return {
      class_id: row.class_id || '',
      class_name: row.class_name || '',
      class_code: row.class_code || '',
      year_level: row.year_level || 'S1',
      status: row.status || 'active'
    };
  }

  function renderClassRows() {
    var body = el('class-body');
    if (!state.classes.length) {
      body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#5b6f86;">No classes added yet.</td></tr>';
      return;
    }
    body.innerHTML = state.classes.map(function(r, idx) {
      return '<tr>' +
        '<td><input data-idx="' + idx + '" data-field="class_name" value="' + esc(r.class_name) + '" placeholder="Class name"></td>' +
        '<td><input data-idx="' + idx + '" data-field="class_code" value="' + esc(r.class_code) + '" placeholder="Class code"></td>' +
        '<td><select data-idx="' + idx + '" data-field="year_level">' + ['S1','S2','S3','S4','S5','S6'].map(function(level) { return '<option value="' + level + '"' + (r.year_level === level ? ' selected' : '') + '>' + level + '</option>'; }).join('') + '</select></td>' +
        '<td><select data-idx="' + idx + '" data-field="status">' + ['active','needs_review','inactive'].map(function(status) { return '<option value="' + status + '"' + (r.status === status ? ' selected' : '') + '>' + status + '</option>'; }).join('') + '</select></td>' +
        '<td><button class="ghost" data-remove="' + idx + '">Remove</button></td>' +
      '</tr>';
    }).join('');
    Array.prototype.forEach.call(body.querySelectorAll('input,select'), function(node) {
      function apply() {
        var idx = Number(node.getAttribute('data-idx'));
        var field = String(node.getAttribute('data-field') || '');
        if (!state.classes[idx] || !field) return;
        state.classes[idx][field] = node.value;
        state.unsaved = true;
        refreshReview();
        refreshSummary();
      }
      node.addEventListener('input', apply);
      node.addEventListener('change', apply);
    });
    Array.prototype.forEach.call(body.querySelectorAll('button[data-remove]'), function(btn) {
      btn.addEventListener('click', function() {
        var idx = Number(btn.getAttribute('data-remove'));
        var row = state.classes[idx];
        if (!row) return;
        if (row.class_id) state.removedClasses.push(cloneClassRow(row));
        state.classes.splice(idx, 1);
        state.unsaved = true;
        renderClassRows();
        refreshReview();
        refreshSummary();
      });
    });
  }

  function refreshReview() {
    var originalMap = {};
    state.originalClasses.forEach(function(r) { originalMap[r.class_id || ('code:' + r.class_code)] = r; });
    var add = 0;
    var update = 0;
    state.classes.forEach(function(r) {
      var key = r.class_id || ('code:' + r.class_code);
      var old = originalMap[key];
      if (!old) add += 1;
      else {
        var oldSig = [old.class_name, old.class_code, old.year_level, old.status].join('|').toLowerCase();
        var sig = [r.class_name, r.class_code, r.year_level, r.status].join('|').toLowerCase();
        if (sig !== oldSig) update += 1;
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
      if (r.status === 'needs_review') reviewCount += 1;
    });
    el('sum-total').textContent = 'Total classes: ' + state.classes.length;
    el('sum-subjects').textContent = 'Subjects: ' + (state.selectedSubject ? 1 : 0);
    el('sum-years').textContent = 'Year groups: ' + Object.keys(years).filter(Boolean).length;
    el('sum-review').textContent = 'Classes needing review: ' + reviewCount;
  }

  function addActivity(action, detail) {
    var teacherName = state.selectedTeacher ? (state.selectedTeacher.display_name || state.selectedTeacher.email || 'Unknown teacher') : 'No teacher';
    state.activity.unshift({
      action: action,
      detail: detail || '',
      at: new Date().toLocaleString(),
      actor: 'Admin ' + actorEmail(),
      teacher: teacherName
    });
    state.activity = state.activity.slice(0, 60);
    var html = state.activity.length
      ? state.activity.slice(0, 10).map(function(item) {
          return '<div class="line"><strong>' + esc(item.action) + '</strong> — ' + esc(item.detail) + ' · ' + esc(item.actor) + ' (for ' + esc(item.teacher) + ') · ' + esc(item.at) + '</div>';
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
    renderBanner();
    switchTab('classes');
    setClassState('Select a year and subject to load current classes.', false);
    renderClassRows();
    refreshReview();
    refreshSummary();
    loadNotesForTeacher();
    addActivity('Opened teacher workspace', teacher.display_name || teacher.email || 'Unknown');
    Array.prototype.forEach.call(document.querySelectorAll('.subject'), function(node) {
      var subject = String(node.getAttribute('data-subject') || '');
      node.className = subject === 'photography' ? 'subject disabled' : 'subject';
    });
  }

  function selectedYearOrError(targetMessageId) {
    var year = String(el('academic-year').value || '').trim();
    if (!year) {
      setMessage(targetMessageId || 'save-message', 'error', 'Academic year is required.');
      return '';
    }
    if (!isValidYearLabel(year)) {
      setMessage(targetMessageId || 'save-message', 'error', 'Selected academic year is not available. Please refresh years.');
      return '';
    }
    return year;
  }

  function loadClasses() {
    if (!state.selectedTeacher || !state.selectedSubject) return;
    var year = selectedYearOrError('save-message');
    if (!year) return;
    setClassState('Loading classes for selected teacher, subject and year…', false);
    window.DataService.listTeacherSubjectClassesForLoader({
      teacherId: state.selectedTeacher.teacher_id,
      subject: state.selectedSubject,
      academicYearLabel: year
    }).then(function(rows) {
      state.originalClasses = (rows || []).map(function(r) {
        return {
          class_id: r.class_id || '',
          class_name: r.class_name || '',
          class_code: r.class_code || '',
          year_level: String(r.year_level_label || r.year_level || 'S1').toUpperCase(),
          status: 'active'
        };
      });
      state.classes = state.originalClasses.map(cloneClassRow);
      state.removedClasses = [];
      state.conflictCount = null;
      state.unsaved = false;
      renderClassRows();
      refreshReview();
      refreshSummary();
      setClassState(state.classes.length ? '' : 'No classes found for this teacher, subject and year.', true);
      setMessage('save-message', null, '');
    }).catch(function(err) {
      setClassState('Unable to load classes for this selection. Try again.', false);
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

  function addClassRow() {
    state.classes.push({ class_id: '', class_name: '', class_code: '', year_level: 'S1', status: 'active' });
    state.unsaved = true;
    setClassState('', true);
    renderClassRows();
    refreshReview();
    refreshSummary();
  }

  function addPastedClasses() {
    if (!state.selectedSubject) throw new Error('Select subject first.');
    var rows = [];
    String(el('paste-classes').value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').forEach(function(raw, idx) {
      var line = String(raw || '').trim();
      if (!line) return;
      var year = 'S1';
      var className = line;
      var match = /^(S[1-6])\s+(.+)$/i.exec(line);
      if (match) {
        year = parseYearLevel(match[1]) || 'S1';
        className = match[2];
      }
      var code = className.replace(/[^a-z0-9]+/gi, '').slice(0, 8).toUpperCase() || ('CLS' + (idx + 1));
      rows.push({ class_id: '', class_name: className, class_code: code, year_level: year, status: 'active' });
    });
    if (!rows.length) throw new Error('No class names found in paste field.');
    rows.forEach(function(r) { state.classes.push(r); });
    state.unsaved = true;
    setClassState('', true);
    renderClassRows();
    refreshReview();
    refreshSummary();
    addActivity('Added pasted classes', rows.length + ' classes added');
  }

  function checkConflicts() {
    if (!state.selectedTeacher || !state.selectedSubject) throw new Error('Select teacher and subject first.');
    var year = selectedYearOrError('save-message');
    if (!year) return Promise.resolve();
    if (!window.DataService || typeof window.DataService.detectExistingClassConflicts !== 'function') {
      state.conflictCount = 0;
      refreshReview();
      setMessage('save-message', 'warn', 'Conflict check is unavailable in this environment.');
      return Promise.resolve();
    }
    var rows = state.classes.map(function(r) {
      return { subject: state.selectedSubject, year_level: r.year_level, class_code: r.class_code, class_name: r.class_name, teacher_email: state.selectedTeacher.email || '' };
    });
    return window.DataService.detectExistingClassConflicts(rows, year).then(function(conflicts) {
      state.conflictCount = (conflicts || []).length;
      refreshReview();
      setMessage('save-message', state.conflictCount ? 'warn' : 'success', state.conflictCount ? (state.conflictCount + ' potential conflict(s) found. Review before saving.') : 'No conflicts found.');
    });
  }

  function isReplaceModeEnabled() {
    return String(el('replace-mode-btn').getAttribute('data-on') || '0') === '1';
  }

  function saveClasses() {
    if (!state.selectedTeacher || !state.selectedSubject) throw new Error('Select teacher and subject first.');
    var year = selectedYearOrError('save-message');
    if (!year) return Promise.resolve();
    if (!state.classes.length) throw new Error('Add at least one class row before saving.');
    var replaceExisting = isReplaceModeEnabled();
    if (replaceExisting) {
      var ok = window.confirm('Replace mode will overwrite this teacher\'s classes for selected subject/year. Continue?');
      if (!ok) return Promise.resolve();
    }
    var rows = state.classes.map(function(r, idx) {
      var code = String(r.class_code || '').trim() || ('CLS' + (idx + 1));
      return { year_level: parseYearLevel(r.year_level || 'S1') || 'S1', class_code: code, class_name: String(r.class_name || code).trim() };
    });
    return window.DataService.upsertTeacherSubjectClassesForLoader({
      teacherId: state.selectedTeacher.teacher_id,
      subject: state.selectedSubject,
      academicYearLabel: year,
      classes: rows,
      replaceExisting: replaceExisting
    }).then(function() {
      state.unsaved = false;
      setMessage('save-message', 'success', 'Classes saved successfully.');
      addActivity('Saved classes', subjectLabel(state.selectedSubject) + ' · ' + rows.length + ' classes');
      return loadClasses();
    }).catch(function(err) {
      setMessage('save-message', 'error', 'Some classes could not be saved. Review rows and try again.');
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
      addActivity('Updated notes', 'Admin notes saved for teacher');
    }).catch(function() {
      setMessage('notes-message', 'error', 'Could not save notes right now.');
    });
  }

  function parseXlsxRows(workbook) {
    var sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    var sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    var rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
    return rows.map(function(row) {
      function get(keys) {
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          if (row[key] != null && String(row[key]).trim()) return String(row[key]).trim();
        }
        return '';
      }
      return {
        subject: normalizeSubject(get(['subject', 'Subject'])) || normalizeSubject(get(['tracker_subject', 'Tracker Subject'])),
        year_level: parseYearLevel(get(['year_level', 'Year Level', 'year', 'Year'])) || 'S1',
        class_name: get(['class_name', 'Class Name', 'class', 'Class']),
        class_code: get(['class_code', 'Class Code', 'code', 'Code']),
        pupil_name: get(['pupil_name', 'Pupil Name', 'student_name', 'Student Name']),
        teacher_name: get(['teacher_name', 'Teacher Name']),
        teacher_email: get(['teacher_email', 'Teacher Email', 'email', 'Email']).toLowerCase()
      };
    }).filter(function(row) {
      return row.subject && row.class_name && row.teacher_email;
    });
  }

  function resetBulkPreview() {
    state.bulkRows = [];
    state.bulkTeacherMatches = [];
    state.bulkSelectedTeacherEmails = {};
    el('bulk-preview').className = 'panel hidden';
    setMessage('bulk-parse-message', null, '');
    setMessage('bulk-unmatched', null, '');
    setMessage('bulk-message', null, '');
    if (el('bulk-file')) el('bulk-file').value = '';
  }

  function buildTeacherMatchPreview(rows) {
    var staffByEmail = {};
    state.staff.forEach(function(t) { if (t.email) staffByEmail[String(t.email).toLowerCase()] = t; });
    var seen = {};
    var matches = [];
    var unmatched = [];
    rows.forEach(function(r) {
      var email = String(r.teacher_email || '').toLowerCase();
      if (!email || seen[email]) return;
      seen[email] = true;
      if (staffByEmail[email]) matches.push({ email: email, teacher: staffByEmail[email] });
      else unmatched.push(email);
    });
    state.bulkTeacherMatches = matches;
    state.bulkSelectedTeacherEmails = {};
    matches.forEach(function(m) { state.bulkSelectedTeacherEmails[m.email] = true; });
    var checklist = el('bulk-teacher-checklist');
    checklist.innerHTML = matches.map(function(m) {
      return '<label class="check-item"><input type="checkbox" data-email="' + esc(m.email) + '" checked> <span><strong>' + esc(m.teacher.display_name || m.teacher.email || m.email) + '</strong><br><span class="muted">' + esc(m.email) + '</span></span></label>';
    }).join('') || '<div class="muted">No teacher matches found in platform staff list.</div>';
    Array.prototype.forEach.call(checklist.querySelectorAll('input[type="checkbox"][data-email]'), function(cb) {
      cb.addEventListener('change', function() {
        var email = String(cb.getAttribute('data-email') || '');
        state.bulkSelectedTeacherEmails[email] = !!cb.checked;
      });
    });
    if (unmatched.length) {
      setMessage('bulk-unmatched', 'warn', 'Unmatched teacher emails in file: ' + unmatched.join(', ') + '. These rows will be skipped.');
    } else {
      setMessage('bulk-unmatched', null, '');
    }
    el('bulk-preview-summary').textContent = 'Rows parsed: ' + rows.length + ' · Matched teachers: ' + matches.length;
    el('bulk-preview').className = 'panel';
  }

  function onBulkFileSelected(e) {
    var file = e && e.target && e.target.files ? e.target.files[0] : null;
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name || '')) {
      setMessage('bulk-parse-message', 'error', 'Please upload an Excel .xlsx file.');
      return;
    }
    if (!window.XLSX) {
      setMessage('bulk-parse-message', 'error', 'Excel parser is unavailable.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function() {
      try {
        var data = new Uint8Array(reader.result);
        var workbook = window.XLSX.read(data, { type: 'array' });
        var rows = parseXlsxRows(workbook);
        if (!rows.length) throw new Error('No valid rows found. Required columns: subject, class_name, teacher_email (plus optional class_code, year_level, pupil_name).');
        state.bulkRows = rows;
        buildTeacherMatchPreview(rows);
        setMessage('bulk-parse-message', 'success', 'Excel parsed successfully. Review and confirm teacher selection before import.');
      } catch (err) {
        resetBulkPreview();
        setMessage('bulk-parse-message', 'error', String(err && err.message || err));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function selectedBulkRows() {
    var selectedEmails = Object.keys(state.bulkSelectedTeacherEmails).filter(function(email) { return !!state.bulkSelectedTeacherEmails[email]; });
    if (!selectedEmails.length) throw new Error('Select at least one matched teacher before import.');
    return state.bulkRows.filter(function(row) { return selectedEmails.indexOf(String(row.teacher_email || '').toLowerCase()) !== -1; });
  }

  function runBulkConflicts() {
    var year = String(el('bulk-year').value || '').trim();
    if (!year) throw new Error('Academic year is required for import preview.');
    if (!isValidYearLabel(year)) throw new Error('Selected academic year is not available.');
    var rows = selectedBulkRows().map(function(row) {
      return {
        subject: row.subject,
        year_level: row.year_level,
        class_code: row.class_code || row.class_name.replace(/[^a-z0-9]+/gi, '').slice(0, 8).toUpperCase(),
        class_name: row.class_name,
        teacher_email: row.teacher_email,
        first_name: row.pupil_name ? row.pupil_name.split(/\s+/)[0] : '',
        last_name: row.pupil_name ? row.pupil_name.split(/\s+/).slice(1).join(' ') : ''
      };
    });
    return window.DataService.detectExistingClassConflicts(rows, year).then(function(conflicts) {
      setMessage('bulk-message', (conflicts || []).length ? 'warn' : 'success', (conflicts || []).length ? ((conflicts || []).length + ' potential conflict(s) found.') : 'No conflicts found for selected teachers.');
    });
  }

  function runBulkImport() {
    var year = String(el('bulk-year').value || '').trim();
    if (!year) throw new Error('Academic year is required for import.');
    if (!isValidYearLabel(year)) throw new Error('Selected academic year is not available.');
    var selected = selectedBulkRows();
    if (!selected.length) throw new Error('No selected rows to import.');
    var rows = selected.map(function(row, idx) {
      var parts = String(row.pupil_name || '').trim().split(/\s+/).filter(Boolean);
      return {
        subject: row.subject,
        year_level: row.year_level || 'S1',
        class_code: row.class_code || row.class_name.replace(/[^a-z0-9]+/gi, '').slice(0, 8).toUpperCase() || ('CLS' + (idx + 1)),
        class_name: row.class_name,
        teacher_email: row.teacher_email,
        first_name: parts[0] || 'Pupil',
        last_name: parts.slice(1).join(' '),
        preferred_name: '',
        external_id: ''
      };
    });
    var confirm = window.confirm('Import ' + rows.length + ' row(s) for selected teachers in append-only mode? Existing teacher data will not be deleted.');
    if (!confirm) return Promise.resolve();
    return window.DataService.bulkUpsertPupilsAndEnrollments({
      rows: rows,
      academicYearLabel: year,
      mode: 'add_only',
      overrideConflicts: false
    }).then(function(result) {
      setMessage('bulk-message', 'success', 'Import completed in append-only mode.');
      addActivity('Bulk import completed', rows.length + ' row(s) imported for selected teachers');
      return result;
    }).catch(function(err) {
      setMessage('bulk-message', 'error', String(err && err.message || err));
      throw err;
    });
  }

  function downloadExcelTemplate() {
    if (!window.XLSX) throw new Error('Excel generator is unavailable.');
    var templateRows = [
      { subject: 'drama', year_level: 'S1', class_name: 'S1 Drama A', class_code: 'DRAA', pupil_name: 'Alex Brown', teacher_name: 'Teacher Example', teacher_email: 'teacher@school.org' },
      { subject: 'art', year_level: 'S2', class_name: 'S2 Art B', class_code: 'ARTB', pupil_name: 'Casey Murray', teacher_name: 'Teacher Example', teacher_email: 'teacher@school.org' }
    ];
    var instructions = [
      ['Required columns', 'subject, year_level, class_name, teacher_email'],
      ['Optional columns', 'class_code, pupil_name, teacher_name'],
      ['Subject values', 'drama, art, photography'],
      ['Year level values', 'S1 to S6'],
      ['Notes', 'Upload is append-only. Existing staff data is not deleted by import.']
    ];
    var wb = window.XLSX.utils.book_new();
    var wsData = window.XLSX.utils.json_to_sheet(templateRows);
    var wsHelp = window.XLSX.utils.aoa_to_sheet(instructions);
    window.XLSX.utils.book_append_sheet(wb, wsData, 'class_import_template');
    window.XLSX.utils.book_append_sheet(wb, wsHelp, 'instructions');
    window.XLSX.writeFile(wb, 'class_import_template.xlsx');
  }

  function bind(id, fn, targetMessageId) {
    var node = el(id);
    if (!node) return;
    node.addEventListener('click', function() {
      Promise.resolve().then(fn).catch(function(err) {
        setMessage(targetMessageId, 'error', String(err && err.message || err));
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    renderLayout();
    showView('staff');
    addActivity('Opened Class Management', 'Admin workspace ready');

    loadAcademicYears().then(function() {
      return Promise.all([loadNotesStore(), loadStaff()]);
    });

    el('staff-search').addEventListener('input', applyStaffFilter);
    el('academic-year').addEventListener('change', function() {
      state.selectedYear = String(el('academic-year').value || '');
      if (state.selectedTeacher && state.selectedSubject) loadClasses();
    });
    el('bulk-year').addEventListener('change', function() {
      setMessage('bulk-message', null, '');
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function(btn) {
      btn.addEventListener('click', function() { switchTab(String(btn.getAttribute('data-tab') || 'classes')); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.subject'), function(btn) {
      btn.addEventListener('click', function() { setSubject(String(btn.getAttribute('data-subject') || '')); });
    });

    bind('reload-staff-btn', loadStaff, 'staff-fallback-note');
    bind('year-refresh-btn', loadAcademicYears, 'save-message');
    bind('back-btn', function() {
      if (state.unsaved && !window.confirm('You have unsaved changes. Return to staff list anyway?')) return;
      showView('staff');
    }, 'save-message');
    bind('add-row-btn', addClassRow, 'save-message');
    bind('reload-classes-btn', loadClasses, 'save-message');
    bind('add-paste-btn', addPastedClasses, 'save-message');
    bind('check-conflicts-btn', checkConflicts, 'save-message');
    bind('save-btn', saveClasses, 'save-message');
    bind('save-notes-btn', saveNotes, 'notes-message');
    bind('download-template-btn', downloadExcelTemplate, 'bulk-parse-message');
    bind('bulk-check-btn', runBulkConflicts, 'bulk-message');
    bind('bulk-run-btn', runBulkImport, 'bulk-message');
    bind('bulk-reset-btn', resetBulkPreview, 'bulk-message');
    bind('replace-mode-btn', function() {
      var on = isReplaceModeEnabled();
      el('replace-mode-btn').setAttribute('data-on', on ? '0' : '1');
      el('replace-mode-btn').textContent = 'Replace mode: ' + (on ? 'off' : 'on');
      if (!on) setMessage('save-message', 'warn', 'Replace mode is ON. Saving will overwrite classes for this teacher/subject/year after confirmation.');
      else setMessage('save-message', null, '');
    }, 'save-message');

    el('replace-mode-btn').setAttribute('data-on', '0');
    el('replace-mode-btn').textContent = 'Replace mode: off';
    el('bulk-file').addEventListener('change', onBulkFileSelected);

    window.addEventListener('beforeunload', function(e) {
      if (!state.unsaved) return;
      e.preventDefault();
      e.returnValue = '';
    });
  });
})();
