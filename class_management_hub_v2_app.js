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
    unsaved: false,
    notesStore: {},
    activity: []
  };
  var csvRowsCache = null;

  function renderShell() {
    document.body.innerHTML = '' +
      '<style>' +
      '*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f3f6fa;color:#13263f}.wrap{max-width:1200px;margin:0 auto;padding:1rem}' +
      '.card{background:#fff;border:1px solid #d8e1ee;border-radius:12px;box-shadow:0 2px 9px rgba(2,6,23,.04);margin-bottom:1rem}.card h2{margin:0;border-bottom:1px solid #e4ebf5;background:#f8fafc;padding:.9rem 1rem;font-size:.97rem}.body{padding:1rem}' +
      '.hero{background:linear-gradient(120deg,#1f3552,#244c68);color:#fff;border-radius:12px;padding:1rem 1.1rem;margin-bottom:1rem}.hero h1{margin:0 0 .3rem;font-size:1.23rem}.hero p{margin:0;color:rgba(255,255,255,.93);font-size:.92rem;line-height:1.42}' +
      '.row{display:grid;gap:.65rem;grid-template-columns:1fr 1fr;margin-bottom:.65rem}.row.search{grid-template-columns:2fr 1fr 1fr 1fr}label{display:block;margin-bottom:.3rem;color:#41556e;font-size:.79rem;font-weight:600}' +
      'input,select,textarea{width:100%;border:1px solid #cfd9e7;border-radius:9px;padding:.56rem .62rem;font:inherit;font-size:.9rem}textarea{min-height:110px;resize:vertical}.btns{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.6rem}' +
      'button{border:none;border-radius:9px;padding:.54rem .82rem;font-size:.84rem;font-weight:600;background:#0f766e;color:#fff;cursor:pointer}button.ghost{background:#eef3f9;color:#1f3552;border:1px solid #d2dbe8}button.secondary{background:#334155}button:disabled{opacity:.6;cursor:not-allowed}' +
      '.state{border:1px dashed #cfd9e7;border-radius:10px;background:#fbfdff;color:#50657d;padding:.95rem;text-align:center;font-size:.87rem}.warn,.ok,.err{border-radius:9px;padding:.45rem .55rem;font-size:.79rem;margin-top:.5rem}.warn{border:1px solid #fcd34d;background:#fffbeb;color:#92400e}.ok{border:1px solid #a7f3d0;background:#ecfdf5;color:#065f46}.err{border:1px solid #fecaca;background:#fef2f2;color:#991b1b}.hidden{display:none!important}' +
      '.chips{display:flex;gap:.35rem;flex-wrap:wrap}.chip{border:1px solid #d3deec;border-radius:999px;padding:.18rem .52rem;background:#f8fafc;color:#32465f;font-size:.72rem;font-weight:700}.status-assigned{border-color:#a7f3d0;background:#ecfdf5;color:#065f46}.status-empty{border-color:#fde68a;background:#fffbeb;color:#92400e}.status-review{border-color:#fecaca;background:#fef2f2;color:#991b1b}' +
      '.profile-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:.75rem;margin-top:.6rem}.profile-card{border:1px solid #dbe4ef;border-radius:11px;background:#fff;padding:.72rem;text-align:left;cursor:pointer;display:grid;gap:.48rem}.profile-card:hover{border-color:#9fb5d0;background:#fbfdff}.profile-head{display:flex;gap:.55rem;align-items:flex-start}.avatar{width:36px;height:36px;border-radius:999px;background:#e8eef7;color:#1f3552;display:inline-flex;justify-content:center;align-items:center;font-size:.77rem;font-weight:700}.profile-name{margin:0;font-size:.89rem;color:#17314e}.profile-email{margin:0;font-size:.75rem;color:#5d728a}' +
      '.workspace{display:grid;gap:.8rem;grid-template-columns:2fr 1fr}.banner{border:1px solid #dae5f2;border-radius:10px;background:#f8fafc;padding:.62rem .7rem;margin-bottom:.65rem}.banner-main{display:grid;grid-template-columns:auto 1fr;gap:.55rem;align-items:center}.tabs{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.6rem}.tab-btn{border:1px solid #d3deeb;background:#fff;color:#243b57;border-radius:9px;padding:.44rem .62rem;font-size:.78rem}.tab-btn.active{background:#ecfdf5;border-color:#9ae6b4;color:#065f46}' +
      '.subject-cards{display:grid;gap:.5rem;grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:.6rem}.subject-card{border:1px solid #d3ddea;border-radius:10px;background:#fff;color:#213a57;padding:.56rem .6rem;text-align:left;font-size:.81rem}.subject-card strong{display:block;margin-bottom:.2rem}.subject-card.active{border-color:#86efac;background:#ecfdf5;color:#065f46}.subject-card.disabled{opacity:.5;cursor:not-allowed}' +
      '.table-wrap{border:1px solid #dbe6f2;border-radius:10px;background:#fff;overflow:auto}table{width:100%;border-collapse:collapse;min-width:740px}th,td{border-bottom:1px solid #e8eef6;padding:.42rem .45rem;text-align:left;font-size:.79rem;vertical-align:middle}th{background:#f8fafc;color:#3a4e68;font-weight:700}.panel{border:1px solid #dbe6f2;border-radius:10px;background:#fff;padding:.65rem;margin-top:.65rem}.line{color:#31465f;font-size:.8rem;margin-bottom:.25rem}.muted{color:#5b6f86;font-size:.79rem}' +
      '@media (max-width:980px){.row.search{grid-template-columns:1fr 1fr}.workspace{grid-template-columns:1fr}.subject-cards{grid-template-columns:1fr}}@media(max-width:700px){.row,.row.search{grid-template-columns:1fr}}' +
      '</style>' +
      '<div class="wrap">' +
      '<div class="hero"><h1>Class Management</h1><p>Manage staff class allocations and connect classes to the correct subject trackers.</p></div>' +
      '<section class="card" id="staff-view"><h2>Teacher Profiles</h2><div class="body">' +
      '<div class="row search">' +
      '<div><label for="staff-search">Search staff by name or email</label><input id="staff-search" placeholder="Search staff by name or email"></div>' +
      '<div><label for="filter-department">Department</label><select id="filter-department"><option value="">All departments</option></select></div>' +
      '<div><label for="filter-role">Role</label><select id="filter-role"><option value="">All roles</option></select></div>' +
      '<div><label for="filter-subject">Subject</label><select id="filter-subject"><option value="">All subjects</option><option value="art">Art &amp; Design</option><option value="drama">Drama</option><option value="photography">Photography</option></select></div>' +
      '</div>' +
      '<div class="btns"><button class="ghost" id="bulk-open-btn">Bulk Add Classes</button><button class="ghost" id="import-open-btn">Import Classes</button><button class="ghost" id="export-btn">Export</button><button class="ghost" id="reload-staff-btn">Retry loading staff</button></div>' +
      '<div class="warn hidden" id="staff-fallback-note">Some staff data was loaded from a backup source.</div><div class="line hidden" id="staff-source-line"></div><div class="state" id="staff-state">Loading staff…</div><div class="profile-grid hidden" id="staff-grid"></div>' +
      '</div></section>' +
      '<section class="card hidden" id="workspace-view"><h2>Teacher Workspace</h2><div class="body">' +
      '<div class="btns" style="margin-top:0;"><button class="ghost" id="back-btn">Back to staff list</button></div>' +
      '<div class="banner"><div class="banner-main"><div class="avatar" id="teacher-avatar">--</div><div><div id="teacher-name" style="font-weight:700;color:#1f3552;">—</div><div id="teacher-email" class="muted">—</div><div class="chips" id="teacher-meta"></div></div></div></div>' +
      '<div class="tabs"><button class="tab-btn active" data-tab="classes">Classes</button><button class="tab-btn" data-tab="activity">Activity</button><button class="tab-btn" data-tab="notes">Notes</button></div>' +
      '<div class="workspace"><div>' +
      '<section id="tab-classes"><div class="row"><div><label for="academic-year">Academic year label</label><input id="academic-year"></div><div></div></div>' +
      '<label>Step 1: Select subject</label><div class="subject-cards"><button class="subject-card" data-subject="art"><strong>Art &amp; Design</strong><span>Routes to Art tracker</span></button><button class="subject-card" data-subject="drama"><strong>Drama</strong><span>Routes to Drama tracker</span></button><button class="subject-card disabled" data-subject="photography" title="Photography editing is temporarily disabled until full backend support is enabled."><strong>Photography</strong><span>Temporarily unavailable</span></button></div>' +
      '<div class="warn hidden" id="subject-note"></div><div class="state" id="classes-state">Select a subject to load classes for this teacher.</div><div id="class-editor" class="hidden">' +
      '<div class="table-wrap"><table><thead><tr><th>Class code/name</th><th>Year group</th><th>Course/level</th><th>Room</th><th>Status</th><th>Actions</th></tr></thead><tbody id="class-body"></tbody></table></div>' +
      '<div class="btns"><button class="ghost" id="add-row-btn">Add one class row</button><button class="secondary" id="reload-classes-btn">Reload current classes</button></div>' +
      '<label for="paste-classes" style="margin-top:.65rem;">Paste classes line by line</label><textarea id="paste-classes" placeholder="S1 Drama&#10;S2 Drama&#10;S3 Drama"></textarea><div class="btns"><button class="ghost" id="add-paste-btn">Add pasted classes</button></div>' +
      '<div class="panel"><div class="line" id="review-add">Classes to add: 0</div><div class="line" id="review-update">Classes to update: 0</div><div class="line" id="review-remove">Classes to remove: 0</div><div class="line" id="review-conflicts">Potential conflicts: not checked</div></div>' +
      '<div class="btns"><button class="secondary" id="check-conflicts-btn">Review conflicts</button><button id="save-btn">Save classes for this teacher</button></div><div id="save-message" class="hidden"></div>' +
      '</div></section>' +
      '<section id="tab-activity" class="hidden"><div class="panel"><div class="muted">Recent activity</div><div id="activity-main" class="state">No recent activity yet.</div></div></section>' +
      '<section id="tab-notes" class="hidden"><div class="panel"><label for="notes-input">Notes</label><textarea id="notes-input" placeholder="Add notes about this teacher\'s class allocations."></textarea><div class="btns"><button class="ghost" id="save-notes-btn">Save notes</button></div><div id="notes-message" class="hidden"></div></div></section>' +
      '</div><div><div class="panel"><div class="muted">Class summary</div><div class="line" id="sum-total">Total classes: 0</div><div class="line" id="sum-subjects">Subjects: 0</div><div class="line" id="sum-years">Year groups: 0</div><div class="line" id="sum-review">Classes needing review: 0</div></div><div class="panel"><div class="muted">Recent activity</div><div id="activity-side" class="state">No activity yet.</div></div></div></div>' +
      '</div></section>' +
      '<section class="card"><h2>Secondary tools</h2><div class="body"><details id="bulk-tools"><summary>Bulk Add Classes / Import / Promotion</summary><div style="margin-top:.75rem;">' +
      '<div class="row"><div><label for="bulk-year">Academic year label</label><input id="bulk-year"></div><div><label for="bulk-mode">Import mode</label><select id="bulk-mode"><option value="add_only">Add new classes only</option><option value="replace">Replace existing classes (advanced)</option></select></div></div>' +
      '<label for="bulk-file">Import CSV file</label><input type="file" id="bulk-file" accept=".csv,text/csv"><label for="bulk-json" style="margin-top:.6rem;">Or paste JSON rows</label><textarea id="bulk-json"></textarea><label class="muted"><input type="checkbox" id="bulk-override"> Override conflicts</label>' +
      '<div class="btns"><button class="ghost" id="bulk-sample-btn">Load sample payload</button><button class="secondary" id="bulk-check-btn">Check conflicts</button><button id="bulk-run-btn">Run bulk import</button></div><div id="bulk-message" class="hidden"></div>' +
      '</div></details></div></section>' +
      '</div>';
  }

  function el(id) { return document.getElementById(id); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>\"']/g, function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]); }); }
  function normalizeSubject(v) { return window.DataService && window.DataService.normalizeTrackerSubject ? (window.DataService.normalizeTrackerSubject(v) || '') : ''; }
  function parseYear(value) { var m = /^s?([1-6])$/i.exec(String(value || '').trim()); return m ? 'S' + m[1] : ''; }
  function todayAcademicYear() { var d = new Date(); var y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; return y + '-' + (y + 1); }

  function setMessage(id, kind, text) {
    var node = el(id); if (!node) return;
    if (!text) { node.className = 'hidden'; node.textContent = ''; return; }
    node.className = kind || 'line';
    node.textContent = text;
  }

  function addActivity(action, detail) {
    state.activity.unshift({ action: action, detail: detail || '', at: new Date().toLocaleString(), actor: window.__authGuardEmail || 'admin' });
    state.activity = state.activity.slice(0, 50);
    var html = state.activity.length ? state.activity.slice(0, 8).map(function(item) { return '<div class="line"><strong>' + esc(item.action) + '</strong> — ' + esc(item.detail) + ' · ' + esc(item.at) + ' · ' + esc(item.actor) + '</div>'; }).join('') : '';
    ['activity-main', 'activity-side'].forEach(function(id) {
      var node = el(id);
      if (!node) return;
      if (!state.activity.length) { node.className = 'state'; node.textContent = 'No recent activity yet.'; }
      else { node.className = ''; node.innerHTML = html; }
    });
  }

  function teacherStats(t) { return { art: Number((t && t.stats && t.stats.art) || 0), drama: Number((t && t.stats && t.stats.drama) || 0), photography: Number((t && t.stats && t.stats.photography) || 0) }; }
  function teacherTotal(t) { var s = teacherStats(t); return s.art + s.drama + s.photography; }
  function teacherStatus(t) { if (!t || !t.email) return { text: 'Needs review', className: 'chip status-review' }; if (!teacherTotal(t)) return { text: 'No classes yet', className: 'chip status-empty' }; return { text: 'Classes assigned', className: 'chip status-assigned' }; }

  function normalizeStaffRows(rows) {
    var byId = {};
    (rows || []).forEach(function(r) {
      var id = String(r && (r.teacher_id || r.user_id) || '').trim();
      if (!id) return;
      if (!byId[id]) byId[id] = { teacher_id: id, display_name: '', email: '', role: 'teacher', department: '', stats: { art: 0, drama: 0, photography: 0 } };
      if (r.display_name || r.teacherName) byId[id].display_name = r.display_name || r.teacherName;
      if (r.email) byId[id].email = r.email;
      if (r.role) byId[id].role = r.role;
      if (r.department) byId[id].department = r.department;
    });
    return Object.keys(byId).map(function(k){ return byId[k]; }).sort(function(a,b){ return String(a.display_name || a.email || '').localeCompare(String(b.display_name || b.email || '')); });
  }

  function hydrateStats(rows) {
    if (!window.DataService || typeof window.DataService.getAllForMonitoring !== 'function') return Promise.resolve(rows);
    return window.DataService.getAllForMonitoring().then(function(items) {
      var map = {};
      (items || []).forEach(function(item) {
        var id = String(item && item.user_id || '').trim();
        if (!id) return;
        if (!map[id]) map[id] = { art: 0, drama: 0, photography: 0 };
        if (item.data_type === 'art-v2') map[id].art += 1;
        if (item.data_type === 'drama-v3') map[id].drama += 1;
      });
      rows.forEach(function(r){ r.stats = map[r.teacher_id] || { art: 0, drama: 0, photography: 0 }; });
      return rows;
    }).catch(function(){ return rows; });
  }

  function populateFilters() {
    var depts = {}, roles = {};
    state.staff.forEach(function(row){ depts[row.department || 'Unassigned'] = true; roles[row.role || 'teacher'] = true; });
    el('filter-department').innerHTML = '<option value="">All departments</option>' + Object.keys(depts).sort().map(function(v){ return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('');
    el('filter-role').innerHTML = '<option value="">All roles</option>' + Object.keys(roles).sort().map(function(v){ return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('');
  }

  function renderStaffGrid() {
    var grid = el('staff-grid');
    if (!state.filtered.length) {
      el('staff-state').className = 'state';
      el('staff-state').textContent = String(el('staff-search').value || '').trim() ? 'No matching staff found.' : 'No staff found.';
      grid.className = 'profile-grid hidden';
      return;
    }
    el('staff-state').className = 'state hidden';
    grid.className = 'profile-grid';
    grid.innerHTML = state.filtered.map(function(t){
      var s = teacherStats(t);
      var st = teacherStatus(t);
      return '<button class="profile-card" data-id="' + esc(t.teacher_id) + '">' +
        '<div class="profile-head"><div class="avatar">' + esc((t.display_name || t.email || '??').slice(0,2).toUpperCase()) + '</div><div><h3 class="profile-name">' + esc(t.display_name || t.email || 'Unknown') + '</h3><p class="profile-email">' + esc(t.email || 'No email available') + '</p></div></div>' +
        '<div class="chips"><span class="chip">Role: ' + esc(t.role || 'teacher') + '</span><span class="chip">Department: ' + esc(t.department || 'Unassigned') + '</span></div>' +
        '<div class="chips"><span class="chip">Total classes: ' + teacherTotal(t) + '</span><span class="chip">Drama: ' + s.drama + '</span><span class="chip">Art & Design: ' + s.art + '</span><span class="chip">Photography: ' + s.photography + '</span></div>' +
        '<div class="chips"><span class="' + st.className + '">' + st.text + '</span><span class="muted">Manage classes</span></div>' +
      '</button>';
    }).join('');
    Array.prototype.forEach.call(grid.querySelectorAll('.profile-card'), function(card){
      card.addEventListener('click', function() {
        var id = String(card.getAttribute('data-id') || '');
        var teacher = state.staff.find(function(item){ return item.teacher_id === id; });
        if (teacher) openWorkspace(teacher);
      });
    });
  }

  function applyStaffFilters() {
    var q = String(el('staff-search').value || '').trim().toLowerCase();
    var dept = String(el('filter-department').value || '').trim().toLowerCase();
    var role = String(el('filter-role').value || '').trim().toLowerCase();
    var subject = normalizeSubject(el('filter-subject').value || '');
    state.filtered = state.staff.filter(function(t){
      var hay = (String(t.display_name || '') + ' ' + String(t.email || '')).toLowerCase();
      var s = teacherStats(t);
      var subjectMatch = !subject || (subject === 'art' && s.art > 0) || (subject === 'drama' && s.drama > 0) || (subject === 'photography' && s.photography > 0);
      return (!q || hay.indexOf(q) !== -1) && (!dept || String(t.department || 'Unassigned').toLowerCase() === dept) && (!role || String(t.role || 'teacher').toLowerCase() === role) && subjectMatch;
    });
    renderStaffGrid();
  }

  function loadStaff() {
    var loader = window.DataService && window.DataService.listTeachingStaffForClassLoaderDetailed
      ? window.DataService.listTeachingStaffForClassLoaderDetailed()
      : window.DataService.listTeachingStaffForClassLoader().then(function(rows){ return { rows: rows, diagnostics: { source: 'legacy_method', fallback_used: false } }; });
    el('staff-state').className = 'state';
    el('staff-state').textContent = 'Loading staff…';
    el('staff-fallback-note').className = 'warn hidden';
    el('staff-source-line').className = 'line hidden';
    loader.then(function(payload){
      var diagnostics = payload && payload.diagnostics ? payload.diagnostics : null;
      return hydrateStats(normalizeStaffRows((payload && payload.rows) || [])).then(function(rows){
        state.staff = rows;
        state.filtered = rows.slice();
        populateFilters();
        applyStaffFilters();
        if (diagnostics) {
          el('staff-source-line').className = 'line';
          el('staff-source-line').textContent = 'Staff loaded: ' + rows.length + ' (source: ' + diagnostics.source + ')';
          if (diagnostics.fallback_used) el('staff-fallback-note').className = 'warn';
        }
      });
    }).catch(function(){
      el('staff-state').className = 'state';
      el('staff-state').textContent = 'Unable to load staff. Use Retry loading staff.';
    });
  }

  function showView(name) {
    el('staff-view').className = name === 'staff' ? 'card' : 'card hidden';
    el('workspace-view').className = name === 'workspace' ? 'card' : 'card hidden';
  }

  function switchTab(tab) {
    ['classes','activity','notes'].forEach(function(id){
      el('tab-' + id).className = id === tab ? '' : 'hidden';
      var btn = document.querySelector('.tab-btn[data-tab="' + id + '"]');
      if (btn) btn.className = id === tab ? 'tab-btn active' : 'tab-btn';
    });
  }

  function setClassState(text, showEditor) {
    el('classes-state').className = showEditor ? 'state hidden' : 'state';
    el('classes-state').textContent = text || '';
    el('class-editor').className = showEditor ? '' : 'hidden';
  }

  function refreshSummary() {
    var years = {};
    var review = 0;
    state.classes.forEach(function(r){ years[String(r.year_level || '')] = true; if (r.status === 'needs_review') review += 1; });
    el('sum-total').textContent = 'Total classes: ' + state.classes.length;
    el('sum-subjects').textContent = 'Subjects: ' + (state.selectedSubject ? 1 : 0);
    el('sum-years').textContent = 'Year groups: ' + Object.keys(years).filter(Boolean).length;
    el('sum-review').textContent = 'Classes needing review: ' + review;
  }

  function refreshReview() {
    var oldMap = {};
    state.originalClasses.forEach(function(r){ oldMap[r.class_id || ('code:' + r.class_code)] = r; });
    var add = 0, update = 0;
    state.classes.forEach(function(r){
      var key = r.class_id || ('code:' + r.class_code);
      var old = oldMap[key];
      if (!old) add += 1;
      else if ([old.class_code,old.class_name,old.year_level,old.course_level,old.room,old.status].join('|').toLowerCase() !== [r.class_code,r.class_name,r.year_level,r.course_level,r.room,r.status].join('|').toLowerCase()) update += 1;
    });
    el('review-add').textContent = 'Classes to add: ' + add;
    el('review-update').textContent = 'Classes to update: ' + update;
    el('review-remove').textContent = 'Classes to remove: ' + state.removedClasses.length;
    el('review-conflicts').textContent = 'Potential conflicts: ' + (state.conflictCount == null ? 'not checked' : state.conflictCount);
  }

  function renderClassRows() {
    var body = el('class-body');
    if (!state.classes.length) {
      body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#5b6f86;">No classes added yet.</td></tr>';
      return;
    }
    body.innerHTML = state.classes.map(function(row, idx){
      return '<tr>' +
        '<td><input data-idx="' + idx + '" data-field="class_name" value="' + esc(row.class_name) + '" placeholder="Class name"><div class="muted" style="margin-top:.2rem;">Code <input style="width:120px;display:inline-block;margin-left:.2rem;" data-idx="' + idx + '" data-field="class_code" value="' + esc(row.class_code) + '"></div></td>' +
        '<td><select data-idx="' + idx + '" data-field="year_level">' + ['S1','S2','S3','S4','S5','S6'].map(function(l){ return '<option value="' + l + '"' + (row.year_level === l ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select></td>' +
        '<td><input data-idx="' + idx + '" data-field="course_level" value="' + esc(row.course_level) + '" placeholder="Course/level"></td>' +
        '<td><input data-idx="' + idx + '" data-field="room" value="' + esc(row.room) + '" placeholder="Room"></td>' +
        '<td><select data-idx="' + idx + '" data-field="status">' + ['active','needs_review','inactive'].map(function(v){ return '<option value="' + v + '"' + (row.status === v ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></td>' +
        '<td><button class="ghost" data-remove="' + idx + '">Remove</button></td>' +
      '</tr>';
    }).join('');
    Array.prototype.forEach.call(body.querySelectorAll('input,select'), function(node){
      function update() {
        var idx = Number(node.getAttribute('data-idx'));
        var field = String(node.getAttribute('data-field') || '');
        if (!state.classes[idx]) return;
        state.classes[idx][field] = node.value;
        state.unsaved = true;
        refreshReview();
        refreshSummary();
      }
      node.addEventListener('input', update);
      node.addEventListener('change', update);
    });
    Array.prototype.forEach.call(body.querySelectorAll('button[data-remove]'), function(btn){
      btn.addEventListener('click', function() {
        var idx = Number(btn.getAttribute('data-remove'));
        var row = state.classes[idx];
        if (!row) return;
        if (row.class_id) state.removedClasses.push(Object.assign({}, row));
        state.classes.splice(idx, 1);
        state.unsaved = true;
        renderClassRows();
        refreshReview();
        refreshSummary();
      });
    });
  }

  function loadClasses() {
    if (!state.selectedTeacher || !state.selectedSubject) return;
    var year = String(el('academic-year').value || '').trim();
    if (!year) { setMessage('save-message','err','Academic year label is required.'); return; }
    setClassState('Loading classes for selected subject…', false);
    window.DataService.listTeacherSubjectClassesForLoader({
      teacherId: state.selectedTeacher.teacher_id,
      subject: state.selectedSubject,
      academicYearLabel: year
    }).then(function(rows){
      var mapped = (rows || []).map(function(r){ return { class_id: r.class_id || '', class_code: r.class_code || '', class_name: r.class_name || '', year_level: String(r.year_level_label || r.year_level || 'S1').toUpperCase(), course_level: '', room: '', status: 'active' }; });
      state.originalClasses = mapped.map(function(r){ return Object.assign({}, r); });
      state.classes = mapped.map(function(r){ return Object.assign({}, r); });
      state.removedClasses = [];
      state.conflictCount = null;
      state.unsaved = false;
      renderClassRows();
      refreshReview();
      refreshSummary();
      if (mapped.length) setClassState('', true); else setClassState('No classes for this subject yet.', true);
      setMessage('save-message','', '');
    }).catch(function(err){
      setClassState('Unable to load classes for this subject. Retry.', false);
      setMessage('save-message','err', String(err && err.message || err));
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
    el('teacher-avatar').textContent = (teacher.display_name || teacher.email || '??').slice(0,2).toUpperCase();
    el('teacher-name').textContent = teacher.display_name || teacher.email || 'Unknown';
    el('teacher-email').textContent = teacher.email || 'No email available';
    el('teacher-meta').innerHTML = '<span class="chip">Role: ' + esc(teacher.role || 'teacher') + '</span><span class="chip">Department: ' + esc(teacher.department || 'Unassigned') + '</span><span class="chip">Total classes: ' + teacherTotal(teacher) + '</span>';
    setClassState('Select a subject to load classes for this teacher.', false);
    switchTab('classes');
    renderClassRows();
    refreshReview();
    refreshSummary();
    loadNotesForTeacher();
    addActivity('Opened teacher workspace', teacher.display_name || teacher.email || 'Unknown');
    Array.prototype.forEach.call(document.querySelectorAll('.subject-card'), function(node){ node.className = String(node.getAttribute('data-subject') || '') === 'photography' ? 'subject-card disabled' : 'subject-card'; });
  }

  function setSubject(subject) {
    if (subject === 'photography') {
      state.selectedSubject = '';
      el('subject-note').className = 'warn';
      el('subject-note').textContent = 'Photography editing is temporarily unavailable until full backend support is enabled.';
      setClassState('Select Art & Design or Drama to continue.', false);
      return;
    }
    state.selectedSubject = subject;
    el('subject-note').className = 'warn hidden';
    Array.prototype.forEach.call(document.querySelectorAll('.subject-card'), function(node){
      var s = String(node.getAttribute('data-subject') || '');
      node.className = s === 'photography' ? 'subject-card disabled' : (s === subject ? 'subject-card active' : 'subject-card');
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
    String(el('paste-classes').value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').forEach(function(raw, idx){
      var line = String(raw || '').trim();
      if (!line) return;
      var year = 'S1';
      var name = line;
      var m = /^(S[1-6])\s+(.+)$/i.exec(line);
      if (m) { year = parseYear(m[1]) || 'S1'; name = m[2]; }
      var code = name.replace(/[^a-z0-9]+/gi,'').slice(0,8).toUpperCase() || ('CLS' + (idx + 1));
      rows.push({ class_id: '', class_code: code, class_name: name, year_level: year, course_level: '', room: '', status: 'active' });
    });
    if (!rows.length) throw new Error('No class lines found.');
    rows.forEach(function(r){ state.classes.push(r); });
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
      setMessage('save-message','warn','Conflict check is unavailable in this environment.');
      return Promise.resolve();
    }
    var year = String(el('academic-year').value || '').trim();
    var rows = state.classes.map(function(r){
      return { subject: state.selectedSubject, year_level: r.year_level, class_code: r.class_code, class_name: r.class_name, teacher_email: state.selectedTeacher.email || '' };
    });
    return window.DataService.detectExistingClassConflicts(rows, year).then(function(conflicts){
      state.conflictCount = (conflicts || []).length;
      refreshReview();
      setMessage('save-message', state.conflictCount ? 'warn' : 'ok', state.conflictCount ? (state.conflictCount + ' potential conflict(s) found. Review before saving.') : 'No conflicts found.');
    });
  }

  function saveClasses() {
    if (!state.selectedTeacher || !state.selectedSubject) throw new Error('Select teacher and subject first.');
    var year = String(el('academic-year').value || '').trim();
    if (!year) throw new Error('Academic year label is required');
    if (!state.classes.length) throw new Error('Add at least one class row before saving');
    var rows = state.classes.map(function(r, idx){
      var code = String(r.class_code || '').trim() || ('CLS' + (idx + 1));
      return { year_level: parseYear(r.year_level || 'S1') || 'S1', class_code: code, class_name: String(r.class_name || code).trim() };
    });
    return window.DataService.upsertTeacherSubjectClassesForLoader({
      teacherId: state.selectedTeacher.teacher_id,
      subject: state.selectedSubject,
      academicYearLabel: year,
      classes: rows,
      replaceExisting: true
    }).then(function(){
      state.unsaved = false;
      setMessage('save-message','ok','Classes saved successfully.');
      addActivity('Classes saved', (state.selectedSubject === 'art' ? 'Art & Design' : 'Drama') + ' · ' + rows.length + ' classes');
      return loadClasses();
    }).catch(function(err){
      setMessage('save-message','err','Some classes could not be saved. Review the rows and try again.');
      throw err;
    });
  }

  function loadNotesStore() {
    if (!window.DataService || typeof window.DataService.get !== 'function') return Promise.resolve();
    return window.DataService.get('classManagementNotesV1').then(function(data){ if (data && typeof data === 'object') state.notesStore = data; }).catch(function(){});
  }
  function loadNotesForTeacher() { if (!state.selectedTeacher) return; el('notes-input').value = state.notesStore[state.selectedTeacher.teacher_id] || ''; }
  function saveNotes() {
    if (!state.selectedTeacher) return Promise.resolve();
    state.notesStore[state.selectedTeacher.teacher_id] = String(el('notes-input').value || '');
    if (!window.DataService || typeof window.DataService.set !== 'function') { setMessage('notes-message','ok','Notes saved.'); return Promise.resolve(); }
    return window.DataService.set('classManagementNotesV1', state.notesStore).then(function(){ setMessage('notes-message','ok','Notes saved.'); addActivity('Notes updated','Saved notes for teacher'); }).catch(function(){ setMessage('notes-message','err','Could not save notes right now.'); });
  }

  function parseCsv(text) {
    var input = String(text || '').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    var rows = [], row = [], cell = '', inQuotes = false;
    for (var i = 0; i < input.length; i++) {
      var ch = input[i], next = input[i + 1];
      if (ch === '"') { if (inQuotes && next === '"') { cell += '"'; i++; } else inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { row.push(cell); cell = ''; }
      else if (ch === '\n' && !inQuotes) { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
    if (!rows.length) return [];
    var headers = rows[0].map(function(h){ return String(h || '').trim().toLowerCase().replace(/\s+/g,'_'); });
    var out = [];
    for (var r = 1; r < rows.length; r++) {
      var cur = rows[r];
      if (!cur || !cur.length) continue;
      var obj = {}, has = false;
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
    return window.DataService.detectExistingClassConflicts(rows, year).then(function(conflicts){
      setMessage('bulk-message', (conflicts || []).length ? 'warn' : 'ok', (conflicts || []).length ? ((conflicts || []).length + ' potential conflict(s) found.') : 'No conflicts found.');
    });
  }
  function runBulkImport() {
    var rows = parseBulkRows();
    var year = String(el('bulk-year').value || '').trim();
    if (!year) throw new Error('Academic year label is required');
    var mode = String(el('bulk-mode').value || 'add_only');
    var override = !!el('bulk-override').checked;
    return window.DataService.bulkUpsertPupilsAndEnrollments({ rows: rows, academicYearLabel: year, mode: mode, overrideConflicts: override }).then(function(){ setMessage('bulk-message','ok','Bulk import completed.'); });
  }

  function exportCurrent() {
    var rows = state.selectedTeacher
      ? state.classes.map(function(r){ return { teacher: state.selectedTeacher.display_name || state.selectedTeacher.email || 'Unknown', subject: state.selectedSubject, class_code: r.class_code, class_name: r.class_name, year_level: r.year_level }; })
      : state.filtered.map(function(t){ var s = teacherStats(t); return { teacher: t.display_name || t.email || 'Unknown', email: t.email || '', role: t.role || '', department: t.department || '', art: s.art, drama: s.drama, photography: s.photography }; });
    var headers = Object.keys(rows[0] || { message: 'no_data' });
    var csv = [headers.join(',')].concat(rows.map(function(row){ return headers.map(function(h){ return '"' + String(row[h] == null ? '' : row[h]).replace(/"/g,'""') + '"'; }).join(','); })).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = state.selectedTeacher ? 'teacher_classes_export.csv' : 'staff_profiles_export.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function bind(id, fn, errTarget) {
    var node = el(id);
    if (!node) return;
    node.addEventListener('click', function() {
      Promise.resolve().then(fn).catch(function(err){
        setMessage(errTarget, 'err', String(err && err.message || err));
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    renderShell();
    var yearLabel = todayAcademicYear();
    el('academic-year').value = yearLabel;
    el('bulk-year').value = yearLabel;
    showView('staff');
    loadNotesStore();

    ['staff-search','filter-department','filter-role','filter-subject'].forEach(function(id){
      var node = el(id);
      if (!node) return;
      node.addEventListener('input', applyStaffFilters);
      node.addEventListener('change', applyStaffFilters);
    });

    Array.prototype.forEach.call(document.querySelectorAll('.tab-btn'), function(btn){
      btn.addEventListener('click', function(){ switchTab(String(btn.getAttribute('data-tab') || 'classes')); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.subject-card'), function(btn){
      btn.addEventListener('click', function(){ setSubject(String(btn.getAttribute('data-subject') || '')); });
    });

    bind('reload-staff-btn', loadStaff, 'staff-state');
    bind('back-btn', function(){ if (state.unsaved && !window.confirm('You have unsaved changes. Return to staff list anyway?')) return; showView('staff'); }, 'save-message');
    bind('add-row-btn', addRow, 'save-message');
    bind('reload-classes-btn', loadClasses, 'save-message');
    bind('add-paste-btn', addPastedRows, 'save-message');
    bind('check-conflicts-btn', checkConflicts, 'save-message');
    bind('save-btn', saveClasses, 'save-message');
    bind('save-notes-btn', saveNotes, 'notes-message');
    bind('export-btn', exportCurrent, 'staff-state');
    bind('bulk-check-btn', runBulkConflicts, 'bulk-message');
    bind('bulk-run-btn', runBulkImport, 'bulk-message');
    bind('bulk-sample-btn', function(){ el('bulk-json').value = JSON.stringify([{ subject: 'drama', year_level: 'S1', class_code: 'D1', class_name: 'S1 Drama D1', teacher_email: 'teacher1@school.org', first_name: 'Alex', last_name: 'Brown' }], null, 2); csvRowsCache = null; setMessage('bulk-message','ok','Sample payload loaded.'); }, 'bulk-message');

    el('bulk-open-btn').addEventListener('click', function(){ el('bulk-tools').open = true; el('bulk-tools').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    el('import-open-btn').addEventListener('click', function(){ el('bulk-tools').open = true; el('bulk-file').click(); });
    el('bulk-file').addEventListener('change', function(e){
      var file = e && e.target && e.target.files ? e.target.files[0] : null;
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function() {
        try {
          csvRowsCache = parseCsv(reader.result);
          if (!csvRowsCache.length) throw new Error('CSV file is empty or missing rows.');
          el('bulk-json').value = JSON.stringify(csvRowsCache, null, 2);
          setMessage('bulk-message','ok','CSV loaded with ' + csvRowsCache.length + ' rows.');
        } catch (err) {
          csvRowsCache = null;
          setMessage('bulk-message','err', String(err && err.message || err));
        }
      };
      reader.readAsText(file);
    });
    el('bulk-json').addEventListener('input', function(){ csvRowsCache = null; });

    window.addEventListener('beforeunload', function(e){ if (!state.unsaved) return; e.preventDefault(); e.returnValue = ''; });
    loadStaff();
  });
})();
