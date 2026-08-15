/**
 * Teacher-first class management for faculty heads.
 */
(function() {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var isEmbed = params.get('embed') === '1';

  var state = {
    teachers: [],
    subject: 'art',
    academicYear: '',
    selectedTeacherId: '',
    classes: [],
    pupilsByClass: {},
    selectedClassKey: '',
    loading: false,
    tab: 'roster',
    view: 'overview',
    trackerRows: [],
    trackerLoaded: false,
    wizardRow: null,
    teacherStats: {},
    staffFilter: '',
    pendingImport: null,
    statusFilter: 'all',
    dirty: false,
    trackerClassMeta: {},
    sendDraftJobs: [],
    ttMatchOverrides: {}
  };

  function $(id) { return document.getElementById(id); }

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '--';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function subjectStatus(rec) {
    rec = rec || {};
    if (rec.hasScores) return { key: 'scores', label: 'Scores' };
    if (rec.pupils) return { key: 'ready', label: 'On tracker' };
    if (rec.classes) return { key: 'setup', label: 'No pupils' };
    if (rec.rosterClasses) return { key: 'draft', label: 'Draft' };
    return { key: 'empty', label: 'Needs classes' };
  }

  function teacherStatus(stats) {
    var art = subjectStatus(stats && stats.art);
    var drama = subjectStatus(stats && stats.drama);
    var rank = { empty: 0, draft: 1, setup: 2, ready: 3, scores: 4 };
    var key = (rank[art.key] <= rank[drama.key]) ? art.key : drama.key;
    var labels = {
      empty: 'Needs classes',
      draft: 'Draft, not sent',
      setup: 'No pupils',
      ready: 'On tracker',
      scores: 'Scores live'
    };
    return { key: key, label: labels[key], art: art, drama: drama };
  }

  function statusMatchesFilter(stats, filter) {
    if (!filter || filter === 'all') return true;
    var art = subjectStatus(stats && stats.art);
    var drama = subjectStatus(stats && stats.drama);
    if (filter === 'ready') {
      return ['ready', 'setup', 'scores'].indexOf(art.key) !== -1 ||
        ['ready', 'setup', 'scores'].indexOf(drama.key) !== -1;
    }
    return art.key === filter || drama.key === filter;
  }

  function markDirty() {
    state.dirty = true;
    var el = $('cm-unsaved');
    if (el) el.hidden = false;
    var result = $('cm-send-result');
    if (result) result.hidden = true;
  }

  function clearDirty() {
    state.dirty = false;
    var el = $('cm-unsaved');
    if (el) el.hidden = true;
  }

  function confirmLeaveWorkspace() {
    if (!state.dirty) return true;
    return window.confirm('You have unsaved class or pupil changes. Leave without sending to the tracker?');
  }

  function showSendResult(msg) {
    var el = $('cm-send-result');
    if (!el) return;
    el.hidden = false;
    el.textContent = msg;
  }

  function buildOverviewStats(staffList) {
    var byUser = {};
    if (!window.ClassManagementTracker) return byUser;
    var rows = ClassManagementTracker.buildClassRowsFromStaff(staffList, {});
    rows.forEach(function(r) {
      var rec = byUser[r.userId] || {
        art: { classes: 0, pupils: 0, hasScores: false },
        drama: { classes: 0, pupils: 0, hasScores: false }
      };
      if (!rec[r.subject]) rec[r.subject] = { classes: 0, pupils: 0, hasScores: false };
      rec[r.subject].classes += 1;
      rec[r.subject].pupils += r.pupilCount || 0;
      if (r.hasScores) rec[r.subject].hasScores = true;
      byUser[r.userId] = rec;
    });
    return byUser;
  }

  function showOverview() {
    state.view = 'overview';
    var overview = $('cm-overview');
    var workspace = $('cm-workspace');
    var back = $('cm-back-overview');
    var page = $('cm-app');
    if (overview) overview.hidden = false;
    if (workspace) workspace.hidden = true;
    if (back) back.hidden = true;
    if (page) page.classList.remove('is-workspace');
    renderTeacherGrid();
  }

  function showWorkspace() {
    state.view = 'workspace';
    var overview = $('cm-overview');
    var workspace = $('cm-workspace');
    var back = $('cm-back-overview');
    var page = $('cm-app');
    if (overview) overview.hidden = true;
    if (workspace) workspace.hidden = false;
    if (back) back.hidden = false;
    if (page) page.classList.add('is-workspace');
    updateSendHint();
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  function updateSendHint() {
    var hint = $('cm-send-hint');
    var btn = $('cm-push-btn');
    var t = selectedTeacher();
    var name = t && (t.display_name || t.email) ? String(t.display_name || t.email).split(' ')[0] : 'this teacher';
    if (hint) {
      hint.textContent = 'Send to tracker puts these names on ' + name + '\'s ' +
        subjectLabel() + ' tracker. Save draft keeps a cloud copy without changing what they see yet.';
    }
    if (btn) btn.textContent = 'Send to tracker';
  }

  function renderTeacherGrid() {
    var grid = $('cm-teacher-grid');
    var countEl = $('cm-teacher-count');
    var statusEl = $('cm-overview-status');
    if (!grid) return;
    var q = String(state.staffFilter || '').trim().toLowerCase();
    var rows = state.teachers.filter(function(t) {
      if (q) {
        var hay = ((t.display_name || '') + ' ' + (t.email || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return statusMatchesFilter(state.teacherStats[t.teacher_id] || {}, state.statusFilter);
    });
    if (countEl) {
      countEl.textContent = rows.length + ' teacher' + (rows.length === 1 ? '' : 's');
    }
    if (statusEl) {
      statusEl.textContent = state.academicYear ? 'Year ' + state.academicYear : '';
    }
    if (!state.teachers.length) {
      grid.innerHTML = '<p class="cm-empty">No teachers found. Staff must sign in once before they appear here.</p>';
      return;
    }
    if (!rows.length) {
      grid.innerHTML = '<p class="cm-empty">No teachers match that search or filter.</p>';
      return;
    }
    grid.innerHTML = rows.map(function(t) {
      var stats = state.teacherStats[t.teacher_id] || {};
      var art = stats.art || {};
      var drama = stats.drama || {};
      var status = teacherStatus(stats);
      var name = t.display_name || t.email || 'Staff';
      return '<button type="button" class="cm-teacher-card is-' + status.key + '" data-teacher-id="' + escAttr(t.teacher_id) + '">' +
        '<span class="cm-avatar" aria-hidden="true">' + escHtml(initials(name)) + '</span>' +
        '<span>' +
        '<h3>' + escHtml(name) + '</h3>' +
        (t.email && t.email !== name ? '<p class="cm-teacher-mail">' + escHtml(t.email) + '</p>' : '') +
        '<div class="cm-teacher-stats">' +
        '<span class="cm-stat cm-stat-art">Art ' + (art.classes || 0) + '</span>' +
        '<span class="cm-stat cm-stat-drama">Drama ' + (drama.classes || 0) + '</span>' +
        '</div>' +
        '<span class="cm-status-row">' +
        '<span class="cm-status cm-chip-art cm-status-' + status.art.key + '">Art · ' + escHtml(status.art.label) + '</span>' +
        '<span class="cm-status cm-chip-drama cm-status-' + status.drama.key + '">Drama · ' + escHtml(status.drama.label) + '</span>' +
        '</span>' +
        '</span></button>';
    }).join('');
    grid.querySelectorAll('.cm-teacher-card').forEach(function(btn) {
      btn.addEventListener('click', function() {
        openTeacher(btn.getAttribute('data-teacher-id') || '');
      });
    });
  }

  function openTeacher(teacherId) {
    if (!teacherId) return;
    state.selectedTeacherId = teacherId;
    var sel = $('cm-teacher');
    if (sel) sel.value = teacherId;
    var stats = state.teacherStats[teacherId] || {};
    var artN = (stats.art && stats.art.classes) || 0;
    var dramaN = (stats.drama && stats.drama.classes) || 0;
    if (dramaN && !artN) state.subject = 'drama';
    else if (artN && !dramaN) state.subject = 'art';
    updateSubjectUi();
    showWorkspace();
    updateTrackerLink();
    loadClasses();
  }

  function loadRosterCounts() {
    if (!window.DataService || typeof DataService.listTeacherSubjectClassesForLoader !== 'function') {
      return Promise.resolve();
    }
    if (!state.academicYear || !state.teachers.length) return Promise.resolve();
    var year = state.academicYear;
    var jobs = [];
    state.teachers.forEach(function(t) {
      ['art', 'drama'].forEach(function(subj) {
        jobs.push({ teacherId: t.teacher_id, subject: subj });
      });
    });
    var i = 0;
    var chunkSize = 8;
    function nextChunk() {
      if (i >= jobs.length) return Promise.resolve();
      var chunk = jobs.slice(i, i + chunkSize);
      i += chunkSize;
      return Promise.all(chunk.map(function(job) {
        return DataService.listTeacherSubjectClassesForLoader({
          teacherId: job.teacherId,
          subject: job.subject,
          academicYearLabel: year
        }).then(function(rows) {
          return { teacherId: job.teacherId, subject: job.subject, count: (rows || []).length };
        }).catch(function() {
          return { teacherId: job.teacherId, subject: job.subject, count: 0 };
        });
      })).then(function(results) {
        results.forEach(function(r) {
          state.teacherStats[r.teacherId] = state.teacherStats[r.teacherId] || {
            art: { classes: 0, pupils: 0, hasScores: false, rosterClasses: 0 },
            drama: { classes: 0, pupils: 0, hasScores: false, rosterClasses: 0 }
          };
          var rec = state.teacherStats[r.teacherId][r.subject] || {
            classes: 0, pupils: 0, hasScores: false, rosterClasses: 0
          };
          rec.rosterClasses = r.count;
          state.teacherStats[r.teacherId][r.subject] = rec;
        });
        if (state.view === 'overview') renderTeacherGrid();
        return nextChunk();
      });
    }
    return nextChunk();
  }

  function loadOverviewStats() {
    if (!window.ClassManagementTracker) return loadRosterCounts();
    return ClassManagementTracker.loadStaff().then(function(staff) {
      state.teacherStats = buildOverviewStats(staff || []);
      if (state.view === 'overview') renderTeacherGrid();
      return loadRosterCounts();
    }).catch(function() {
      if (state.view === 'overview') renderTeacherGrid();
      return loadRosterCounts();
    });
  }

  function currentAcademicYearLabel() {
    var now = new Date();
    var start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return start + '-' + (start + 1);
  }

  function parseYearLevel(value) {
    var raw = String(value == null ? '' : value).trim();
    var m = /^s?([1-6])$/i.exec(raw);
    return m ? Number(m[1]) : null;
  }

  function normalizeSubject(value) {
    var v = String(value || '').trim().toLowerCase();
    if (v === 'art' || v === 'art & design' || v === 'art and design') return 'art';
    if (v === 'drama') return 'drama';
    return null;
  }

  function canManage() {
    return !!(
      window.__authGuardCanManageSchool ||
      window.__authGuardIsAdmin ||
      window.__authGuardIsFacultyHead
    );
  }

  function toast(msg, type) {
    var el = $('cm-toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'cm-toast show' + (type ? ' ' + type : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function() {
      el.classList.remove('show');
    }, 3200);
  }

  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escAttr(s) {
    return escHtml(s);
  }

  function selectedTeacher() {
    return state.teachers.find(function(t) {
      return t.teacher_id === state.selectedTeacherId;
    }) || null;
  }

  function subjectLabel() {
    return state.subject === 'drama' ? 'Drama' : 'Art';
  }

  function updateSubjectUi() {
    var artBtn = $('cm-subj-art');
    var dramaBtn = $('cm-subj-drama');
    if (artBtn) artBtn.classList.toggle('is-active', state.subject === 'art');
    if (dramaBtn) dramaBtn.classList.toggle('is-active', state.subject === 'drama');
    var lbl = $('cm-subject-label');
    if (lbl) lbl.textContent = subjectLabel();
    var page = $('cm-app');
    if (page) {
      page.classList.toggle('cm-subject-art', state.subject === 'art');
      page.classList.toggle('cm-subject-drama', state.subject === 'drama');
    }
  }

  function trackerViewUrl(teacher) {
    if (!teacher || !teacher.teacher_id) return '#';
    var page = state.subject === 'drama' ? 'drama-tracker.html' : 'art-tracker.html';
    var name = encodeURIComponent(teacher.display_name || teacher.email || '');
    var ret = encodeURIComponent(isEmbed ? 'faculty-hub.html?panel=embed-class-management' : 'class_management.html');
    return page + '?viewAs=' + encodeURIComponent(teacher.teacher_id) +
      '&name=' + name + '&return=' + ret;
  }

  function updateTrackerLink() {
    var wrap = $('cm-tracker-link-wrap');
    var link = $('cm-tracker-link');
    var t = selectedTeacher();
    if (!wrap || !link) return;
    if (t && state.selectedTeacherId) {
      wrap.hidden = false;
      wrap.style.display = '';
      link.href = trackerViewUrl(t);
      link.textContent = 'Open ' + subjectLabel() + ' tracker';
    } else {
      wrap.hidden = true;
    }
    updateSendHint();
  }

  function classKeyFor(cls) {
    return window.ClassManagementRoster
      ? ClassManagementRoster.classKey(cls)
      : ('S' + cls.year_level + '|' + String(cls.class_code || '').trim().toLowerCase());
  }

  function selectedClass() {
    if (!state.selectedClassKey) return null;
    return state.classes.find(function(c) {
      return classKeyFor(c) === state.selectedClassKey;
    }) || null;
  }

  function pupilsForSelectedClass() {
    if (!state.selectedClassKey) return [];
    return state.pupilsByClass[state.selectedClassKey] || [];
  }

  function setPupilsForClass(key, pupils) {
    state.pupilsByClass[key] = (pupils || []).map(function(p) {
      return {
        local_id: p.local_id || (window.ClassManagementRoster ? ClassManagementRoster.uid() : String(Date.now())),
        name: String(p.name || '').trim(),
        tracker_pupil_id: p.tracker_pupil_id || null,
        pupil_id: p.pupil_id || null
      };
    }).filter(function(p) { return p.name; });
  }

  function renderPupilsPanel() {
    var panel = $('cm-pupils-panel');
    var body = $('cm-pupils-body');
    var countEl = $('cm-pupil-count');
    var sub = $('cm-pupils-sub');
    var cls = selectedClass();
    if (!panel || !body) return;

    panel.hidden = false;
    var pupils = pupilsForSelectedClass();
    if (sub) {
      if (!cls) {
        sub.textContent = 'Add a class on the left, then paste names here.';
      } else {
        sub.textContent = 'S' + cls.year_level + ' · ' + (cls.class_name || cls.class_code);
      }
    }
    if (countEl) {
      countEl.textContent = pupils.length + ' pupil' + (pupils.length === 1 ? '' : 's');
    }

    if (!cls || !state.selectedTeacherId) {
      body.innerHTML = '<tr><td colspan="3"><div class="cm-empty-action"><p>Choose a class on the left, then paste pupil names here.</p></div></td></tr>';
      bindEmptyActions();
      return;
    }

    if (!pupils.length) {
      body.innerHTML = '<tr><td colspan="3"><div class="cm-empty-action"><p>No pupils in this class yet.</p><button type="button" class="btn btn-primary" id="cm-empty-paste-pupils">Paste names</button></div></td></tr>';
      bindEmptyActions();
      return;
    }

    body.innerHTML = pupils.map(function(p, idx) {
      return '<tr data-pupil-id="' + escAttr(p.local_id) + '">' +
        '<td>' + (idx + 1) + '</td>' +
        '<td><input class="cm-pupil-edit" type="text" value="' + escAttr(p.name) + '" aria-label="Pupil name" /></td>' +
        '<td><div class="cm-pupil-actions">' +
        '<button type="button" class="btn btn-ghost cm-pupil-del" data-id="' + escAttr(p.local_id) + '">Remove</button>' +
        '</div></td></tr>';
    }).join('');

    body.querySelectorAll('.cm-pupil-edit').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var row = inp.closest('tr');
        var id = row && row.getAttribute('data-pupil-id');
        if (!id) return;
        var list = pupilsForSelectedClass();
        var p = list.find(function(x) { return x.local_id === id; });
        if (p) p.name = String(inp.value || '').trim();
        setPupilsForClass(state.selectedClassKey, list);
        markDirty();
        renderTable();
      });
    });

    body.querySelectorAll('.cm-pupil-del').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-id');
        var list = pupilsForSelectedClass().filter(function(p) { return p.local_id !== id; });
        setPupilsForClass(state.selectedClassKey, list);
        markDirty();
        renderPupilsPanel();
        renderTable();
      });
    });
    bindEmptyActions();
  }

  function renderTable() {
    var host = $('cm-class-slices');
    var countEl = $('cm-class-count');
    if (!host) return;
    var rows = state.classes.slice().sort(function(a, b) {
      return (a.year_level - b.year_level) || String(a.class_code).localeCompare(String(b.class_code));
    });
    if (countEl) {
      countEl.textContent = rows.length + ' class' + (rows.length === 1 ? '' : 'es');
    }
    if (!state.selectedTeacherId) {
      host.innerHTML = '<p class="cm-empty">Choose a teacher to add classes.</p>';
      state.selectedClassKey = '';
      renderPupilsPanel();
      bindEmptyActions();
      return;
    }
    if (state.loading && !rows.length) {
      host.innerHTML = '<p class="cm-empty">Loading classes and pupils…</p>';
      renderPupilsPanel();
      return;
    }
    if (!rows.length) {
      host.innerHTML = '<div class="cm-empty-action"><p>No classes yet. Load this teacher’s timetable, paste a list, or add a class code above.</p>' +
        '<div class="cm-empty-actions">' +
        '<button type="button" class="btn btn-primary" id="cm-empty-tt-teacher">Load timetable</button>' +
        '<button type="button" class="btn" id="cm-empty-paste-classes">Paste class list</button>' +
        '</div></div>';
      state.selectedClassKey = '';
      renderPupilsPanel();
      bindEmptyActions();
      return;
    }
    var years = [1, 2, 3];
    host.innerHTML = years.map(function(yl) {
      var group = rows.filter(function(c) { return c.year_level === yl; });
      if (!group.length) return '';
      var cards = group.map(function(c) {
        var key = classKeyFor(c);
        var pupilCount = (state.pupilsByClass[key] || []).length;
        var selected = state.selectedClassKey === key ? ' is-selected' : '';
        var yg = 's' + c.year_level;
        var metaMap = state.trackerClassMeta[yg] || {};
        var meta = metaMap[String(c.class_name || '').toLowerCase()] ||
          metaMap[String(c.class_code || '').toLowerCase()];
        var trackKey = !meta ? 'draft' : (meta.hasScores ? 'scores' : 'ready');
        var trackLabel = !meta ? 'Draft' : (meta.hasScores ? 'Scores live' : 'On tracker');
        return '<div class="cm-class-card' + selected + '" data-class-key="' + escAttr(key) + '" tabindex="0" role="button" aria-pressed="' + (selected ? 'true' : 'false') + '">' +
          '<strong>' + escHtml(c.class_code) + '</strong>' +
          '<span class="cm-class-count">' + pupilCount + ' pupil' + (pupilCount === 1 ? '' : 's') + '</span>' +
          '<span class="cm-class-track is-' + trackKey + '">' + escHtml(trackLabel) + '</span>' +
          '<button type="button" class="btn btn-ghost cm-row-del" data-year="' + c.year_level + '" data-code="' + escAttr(c.class_code) + '" aria-label="Remove class">Remove</button>' +
          '</div>';
      }).join('');
      return '<div class="cm-year-slice"><h3>S' + yl + '</h3><div class="cm-class-list">' + cards + '</div></div>';
    }).join('');

    host.querySelectorAll('.cm-class-card').forEach(function(row) {
      function selectRow() {
        state.selectedClassKey = row.getAttribute('data-class-key') || '';
        renderTable();
        renderPupilsPanel();
        var nameInput = $('cm-pupil-name');
        if (nameInput) nameInput.focus();
      }
      row.addEventListener('click', function(e) {
        if (e.target.closest('.cm-row-del')) return;
        selectRow();
      });
      row.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectRow();
        }
      });
    });

    host.querySelectorAll('.cm-row-del').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var yl = parseInt(btn.getAttribute('data-year'), 10);
        var code = btn.getAttribute('data-code') || '';
        var removedKey = 'S' + yl + '|' + String(code).trim().toLowerCase();
        state.classes = state.classes.filter(function(c) {
          return !(c.year_level === yl && c.class_code === code);
        });
        delete state.pupilsByClass[removedKey];
        if (state.selectedClassKey === removedKey) state.selectedClassKey = '';
        markDirty();
        renderTable();
        renderPupilsPanel();
      });
    });

    renderPupilsPanel();
    bindEmptyActions();
  }

  function bindEmptyActions() {
    var pasteClasses = $('cm-empty-paste-classes');
    var pasteBtn = $('cm-paste-btn');
    if (pasteClasses && pasteBtn) {
      pasteClasses.onclick = function() { pasteBtn.click(); };
    }
    var emptyTt = $('cm-empty-tt-teacher');
    var ttTeacher = $('cm-tt-teacher');
    if (emptyTt && ttTeacher) {
      emptyTt.onclick = function() { ttTeacher.click(); };
    }
    var pastePupils = $('cm-empty-paste-pupils');
    var pupilPaste = $('cm-pupil-paste-btn');
    if (pastePupils && pupilPaste) {
      pastePupils.onclick = function() { pupilPaste.click(); };
    }
  }

  function loadPupilsForClasses() {
    if (!state.selectedTeacherId || !window.ClassManagementRoster) {
      state.pupilsByClass = {};
      renderTable();
      return Promise.resolve();
    }
    return ClassManagementRoster.loadPupilsForTeacher({
      teacherId: state.selectedTeacherId,
      subject: state.subject,
      academicYearLabel: state.academicYear,
      classes: state.classes
    }).then(function(byClass) {
      state.pupilsByClass = byClass || {};
      if (state.selectedClassKey && !state.pupilsByClass[state.selectedClassKey]) {
        state.selectedClassKey = '';
      }
      if (!state.selectedClassKey && state.classes.length) {
        state.selectedClassKey = classKeyFor(state.classes[0]);
      }
      renderTable();
    }).catch(function() {
      renderTable();
    });
  }

  function loadTrackerClassMeta() {
    state.trackerClassMeta = {};
    if (!state.selectedTeacherId || !window.ClassManagementTracker) {
      return Promise.resolve();
    }
    return ClassManagementTracker.loadTrackerState(state.selectedTeacherId, state.subject).then(function(S) {
      applyTrackerMeta(S);
    }).catch(function() {
      state.trackerClassMeta = {};
    });
  }

  function applyTrackerMeta(S) {
    var meta = { s1: {}, s2: {}, s3: {} };
    ['s1', 's2', 's3'].forEach(function(yg) {
      Object.keys((S && S.pupils && S.pupils[yg]) || {}).forEach(function(cls) {
        var pupils = S.pupils[yg][cls] || [];
        var hasScores = pupils.some(function(p) {
          var sc = S.scores && S.scores[yg] && S.scores[yg][p.id];
          return sc && Object.keys(sc).length;
        });
        meta[yg][String(cls).toLowerCase()] = {
          pupilCount: pupils.length,
          hasScores: hasScores
        };
      });
    });
    state.trackerClassMeta = meta;
  }

  function classesFromTrackerState(S) {
    var out = [];
    ['s1', 's2', 's3'].forEach(function(yg) {
      Object.keys((S && S.pupils && S.pupils[yg]) || {}).forEach(function(clsName) {
        var code = String(clsName || '').trim();
        if (!code) return;
        out.push({
          year_level: Number(yg.replace('s', '')),
          class_code: code,
          class_name: code
        });
      });
    });
    return out;
  }

  function mergeClassLists(primary, extra) {
    var classes = (primary || []).slice();
    var seen = {};
    classes.forEach(function(c) { seen[classKeyFor(c)] = true; });
    (extra || []).forEach(function(c) {
      if (!c || !c.class_code || !c.year_level) return;
      var key = classKeyFor(c);
      if (seen[key]) return;
      seen[key] = true;
      classes.push({
        year_level: c.year_level,
        class_code: c.class_code,
        class_name: c.class_name || c.class_code
      });
    });
    return classes;
  }

  function trackerPupilsForClass(S, cls) {
    if (!S || !cls) return [];
    var yg = 's' + cls.year_level;
    var want = String(cls.class_name || cls.class_code || '').trim().toLowerCase();
    if (!want) return [];
    var bag = (S.pupils && S.pupils[yg]) || {};
    var hit = Object.keys(bag).find(function(k) {
      return String(k).trim().toLowerCase() === want;
    });
    if (!hit) return [];
    return (bag[hit] || []).map(function(p) {
      return {
        local_id: window.ClassManagementRoster ? ClassManagementRoster.uid() : String(Date.now()),
        name: String(p.name || '').trim(),
        tracker_pupil_id: p.id
      };
    }).filter(function(p) { return p.name; });
  }

  function fillEmptyPupilsFromTracker(S) {
    if (!S) return;
    state.classes.forEach(function(cls) {
      var key = classKeyFor(cls);
      if ((state.pupilsByClass[key] || []).length) return;
      var fromTracker = trackerPupilsForClass(S, cls);
      if (fromTracker.length) state.pupilsByClass[key] = fromTracker;
    });
  }

  function classesFromLoaderRows(rows) {
    return (rows || []).map(function(r) {
      return {
        class_id: r.class_id,
        year_level: Number(r.year_level) || parseYearLevel(r.year_level_label),
        class_code: String(r.class_code || '').trim(),
        class_name: String(r.class_name || r.class_code || '').trim()
      };
    }).filter(function(c) { return c.class_code && c.year_level; });
  }

  function loadRosterBundle(teacherId, subject) {
    return DataService.listTeacherSubjectClassesForLoader({
      teacherId: teacherId,
      subject: subject,
      academicYearLabel: state.academicYear
    }).then(function(rows) {
      var classes = classesFromLoaderRows(rows);
      if (!window.ClassManagementRoster) {
        return { classes: classes, pupilsByClass: {} };
      }
      return ClassManagementRoster.loadPupilsForTeacher({
        teacherId: teacherId,
        subject: subject,
        academicYearLabel: state.academicYear,
        classes: classes
      }).then(function(byClass) {
        return { classes: classes, pupilsByClass: byClass || {} };
      });
    });
  }

  function saveRosterFor(teacherId, subject, classes, pupilsByClass) {
    if (!window.DataService || typeof DataService.upsertTeacherSubjectClassesForLoader !== 'function') {
      return Promise.reject(new Error('Cloud save unavailable'));
    }
    var teacher = state.teachers.find(function(t) { return t.teacher_id === teacherId; });
    var payload = (classes || []).map(function(c) {
      return {
        year_level: 'S' + c.year_level,
        class_code: c.class_code,
        class_name: c.class_name || c.class_code
      };
    });
    return DataService.upsertTeacherSubjectClassesForLoader({
      teacherId: teacherId,
      subject: subject,
      academicYearLabel: state.academicYear,
      classes: payload,
      replaceExisting: true
    }).then(function() {
      if (!window.ClassManagementRoster) return { saved_pupils: 0 };
      return ClassManagementRoster.saveRosterPupils({
        teacherId: teacherId,
        teacherEmail: teacher && teacher.email ? teacher.email : '',
        subject: subject,
        academicYearLabel: state.academicYear,
        classes: classes,
        pupilsByClass: pupilsByClass
      });
    });
  }

  function loadClasses() {
    if (!state.selectedTeacherId || !state.academicYear || !window.DataService) {
      state.classes = [];
      state.pupilsByClass = {};
      state.selectedClassKey = '';
      renderTable();
      clearDirty();
      return Promise.resolve();
    }
    state.loading = true;
    state.classes = [];
    state.pupilsByClass = {};
    state.selectedClassKey = '';
    renderTable();
    var trackerS = null;
    return DataService.listTeacherSubjectClassesForLoader({
      teacherId: state.selectedTeacherId,
      subject: state.subject,
      academicYearLabel: state.academicYear
    }).then(function(rows) {
      state.classes = classesFromLoaderRows(rows);
      if (!window.ClassManagementTracker) return null;
      return ClassManagementTracker.loadTrackerState(state.selectedTeacherId, state.subject).catch(function() {
        return null;
      });
    }).then(function(S) {
      trackerS = S || null;
      if (trackerS) {
        applyTrackerMeta(trackerS);
        state.classes = mergeClassLists(state.classes, classesFromTrackerState(trackerS));
      } else {
        state.trackerClassMeta = {};
      }
      return loadPupilsForClasses();
    }).then(function() {
      fillEmptyPupilsFromTracker(trackerS);
      if (!state.selectedClassKey && state.classes.length) {
        state.selectedClassKey = classKeyFor(state.classes[0]);
      }
      state.loading = false;
      renderTable();
      clearDirty();
    }).catch(function(err) {
      toast('Could not load classes: ' + (err.message || err), 'error');
      state.loading = false;
      state.classes = [];
      state.pupilsByClass = {};
      state.selectedClassKey = '';
      renderTable();
    }).finally(function() {
      state.loading = false;
    });
  }

  function loadTeachers() {
    if (!window.DataService || typeof DataService.listTeachingStaffForClassLoader !== 'function') {
      return Promise.reject(new Error('Cloud staff list unavailable'));
    }
    return DataService.listTeachingStaffForClassLoader().then(function(rows) {
      state.teachers = (rows || []).filter(function(r) { return r && r.teacher_id; })
        .sort(function(a, b) {
          var an = (a.display_name || a.email || '').toLowerCase();
          var bn = (b.display_name || b.email || '').toLowerCase();
          return an.localeCompare(bn);
        });
      var sel = $('cm-teacher');
      if (sel) {
        if (!state.teachers.length) {
          sel.innerHTML = '<option value="">No teachers found. Staff must sign in once</option>';
        } else {
          sel.innerHTML = '<option value="">Select a teacher</option>' +
            state.teachers.map(function(t) {
              var label = (t.display_name || t.email || 'Staff').trim();
              if (t.email && label.toLowerCase() !== String(t.email).toLowerCase()) {
                label += ' (' + t.email + ')';
              }
              return '<option value="' + escHtml(t.teacher_id) + '">' + escHtml(label) + '</option>';
            }).join('');
        }
      }
      renderTeacherGrid();
      fillImportTeacherSelect();
    });
  }

  function loadAcademicYears() {
    var sel = $('cm-year-label');
    if (!sel) return Promise.resolve();
    var defaultYear = currentAcademicYearLabel();
    state.academicYear = defaultYear;

    function fillYears(years) {
      var labels = (years || []).map(function(y) { return y.label; }).filter(Boolean);
      if (labels.indexOf(defaultYear) === -1) labels.unshift(defaultYear);
      var uniq = [];
      labels.forEach(function(l) {
        if (uniq.indexOf(l) === -1) uniq.push(l);
      });
      sel.innerHTML = uniq.map(function(l) {
        return '<option value="' + escHtml(l) + '">' + escHtml(l) + '</option>';
      }).join('');
      sel.value = defaultYear;
      state.academicYear = sel.value;
    }

    if (window.DataService && typeof DataService.listAcademicYears === 'function') {
      return DataService.listAcademicYears().then(fillYears).catch(function() {
        fillYears([]);
      });
    }
    fillYears([]);
    return Promise.resolve();
  }

  function addClassLocal(yearLevel, code, name, opts) {
    opts = opts || {};
    if (!state.selectedTeacherId) {
      toast('Choose a teacher first', 'error');
      return false;
    }
    code = String(code || '').trim();
    name = String(name || code).trim();
    var yl = parseYearLevel(yearLevel);
    if (!code) {
      toast('Enter a class code', 'error');
      return false;
    }
    if (!yl || yl < 1 || yl > 3) {
      toast('Year must be S1, S2, or S3 for BGE trackers', 'error');
      return false;
    }
    var exists = state.classes.some(function(c) {
      return c.year_level === yl && c.class_code.toLowerCase() === code.toLowerCase();
    });
    if (exists) {
      if (!opts.quiet) toast('Class already in the list', 'error');
      return false;
    }
    state.classes.push({ year_level: yl, class_code: code, class_name: name });
    state.selectedClassKey = classKeyFor({ year_level: yl, class_code: code });
    if (!state.pupilsByClass[state.selectedClassKey]) {
      state.pupilsByClass[state.selectedClassKey] = [];
    }
    markDirty();
    renderTable();
    return true;
  }

  function saveForTeacher(options) {
    var opts = options || {};
    if (!state.selectedTeacherId) {
      if (!opts.silent) toast('Select a teacher first', 'error');
      return Promise.resolve();
    }
    if (!window.DataService || typeof DataService.upsertTeacherSubjectClassesForLoader !== 'function') {
      if (!opts.silent) toast('Sign in with cloud access to save', 'error');
      return Promise.resolve();
    }
    var btn = $('cm-save-btn');
    if (btn) btn.disabled = true;
    return saveRosterFor(state.selectedTeacherId, state.subject, state.classes, state.pupilsByClass)
      .then(function(pupilResult) {
        var payloadLen = state.classes.length;
        var totalPupils = Object.keys(state.pupilsByClass).reduce(function(n, key) {
          return n + (state.pupilsByClass[key] || []).length;
        }, 0);
        var msg = 'Draft saved: ' + payloadLen + ' class' + (payloadLen === 1 ? '' : 'es');
        if (totalPupils) msg += ', ' + totalPupils + ' pupil' + (totalPupils === 1 ? '' : 's');
        if (pupilResult && pupilResult.fallback_add_only) {
          msg += '. Pupil list saved (add-only mode)';
        }
        if (!opts.silent) toast(msg, 'success');
        clearDirty();
        return loadClasses();
      }).catch(function(err) {
      if (!opts.silent) toast('Save failed: ' + (err.message || err), 'error');
      throw err;
    }).finally(function() {
      if (btn) btn.disabled = false;
    });
  }

  function renderPushDiff(stats) {
    var el = $('cm-push-diff');
    if (!el) return;
    if (!stats) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    var parts = [];
    var summary = [];
    if (stats.added) summary.push(stats.added + ' added');
    if (stats.updated) summary.push(stats.updated + ' renamed');
    if (stats.removed) summary.push(stats.removed + ' removed');
    if (stats.scored_removals && stats.scored_removals.length) {
      summary.push(stats.scored_removals.length + ' with scores kept');
    }
    parts.push('<p>' + (summary.length ? escHtml(summary.join(', ')) : 'No name changes. Classes will still be written to the tracker.') + '</p>');
    (stats.details || []).forEach(function(d) {
      if (!d.added.length && !d.renamed.length && !d.removed.length && !d.scoredKept.length) return;
      parts.push('<h4>' + escHtml(String(d.yearGroup || '').toUpperCase() + ' ' + d.className) + '</h4><ul>');
      d.added.forEach(function(n) { parts.push('<li class="cm-push-added">Add ' + escHtml(n) + '</li>'); });
      d.renamed.forEach(function(n) { parts.push('<li>Rename to ' + escHtml(n) + '</li>'); });
      d.removed.forEach(function(n) { parts.push('<li class="cm-push-removed">Remove ' + escHtml(n) + '</li>'); });
      d.scoredKept.forEach(function(n) { parts.push('<li class="cm-push-kept">Keep (has scores) ' + escHtml(n) + '</li>'); });
      parts.push('</ul>');
    });
    el.innerHTML = parts.join('');
    el.hidden = false;
  }

  function refreshPushDiff() {
    var el = $('cm-push-diff');
    if (!el || !window.ClassManagementRoster || typeof ClassManagementRoster.previewPushToTracker !== 'function') {
      return;
    }
    el.hidden = false;
    el.innerHTML = '<p>Checking tracker...</p>';
    var removeMissing = $('cm-push-remove-missing') && $('cm-push-remove-missing').checked;
    ClassManagementRoster.previewPushToTracker({
      teacherId: state.selectedTeacherId,
      subject: state.subject,
      classes: state.classes,
      pupilsByClass: state.pupilsByClass,
      removeMissing: removeMissing
    }).then(renderPushDiff).catch(function() {
      el.innerHTML = '<p>Could not compare with the tracker. You can still send.</p>';
    });
  }

  function openPushModal() {
    if (!state.selectedTeacherId) {
      toast('Select a teacher first', 'error');
      return;
    }
    if (!state.classes.length) {
      toast('Add classes before sending to the tracker', 'error');
      return;
    }
    var teacher = selectedTeacher();
    var modal = $('cm-push-modal');
    var desc = $('cm-push-desc');
    if (desc) {
      desc.textContent = 'Send ' + state.classes.length + ' class' + (state.classes.length === 1 ? '' : 'es') +
        ' and their pupil lists to ' + (teacher && (teacher.display_name || teacher.email) || 'this teacher') +
        '\'s ' + subjectLabel() + ' tracker.';
    }
    if (modal) modal.classList.add('open');
    refreshPushDiff();
  }

  function confirmPushToTracker() {
    if (!window.ClassManagementRoster) {
      toast('Roster module not loaded', 'error');
      return;
    }
    if (!state.selectedTeacherId || !state.classes.length) {
      toast('Add classes before sending', 'error');
      return;
    }
    var removeMissing = $('cm-push-remove-missing') && $('cm-push-remove-missing').checked;
    var btn = $('cm-push-confirm');
    if (btn) btn.disabled = true;

    saveForTeacher({ silent: true }).then(function() {
      return ClassManagementRoster.pushToTracker({
        teacherId: state.selectedTeacherId,
        subject: state.subject,
        academicYearLabel: state.academicYear,
        classes: state.classes,
        pupilsByClass: state.pupilsByClass,
        removeMissing: removeMissing
      });
    }).then(function(stats) {
      closeModal('cm-push-modal');
      var teacher = selectedTeacher();
      var teacherName = teacher && (teacher.display_name || teacher.email) || 'this teacher';
      var n = Object.keys(state.pupilsByClass).reduce(function(sum, key) {
        return sum + (state.pupilsByClass[key] || []).length;
      }, 0);
      var banner = n
        ? n + ' pupil' + (n === 1 ? '' : 's') + ' now on ' + teacherName + '\'s ' + subjectLabel() + ' tracker'
        : 'Classes sent to ' + teacherName + '\'s ' + subjectLabel() + ' tracker';
      showSendResult(banner);
      var msg = banner;
      if (stats && (stats.added || stats.updated || stats.removed)) {
        msg = 'Sent to tracker: ' + stats.added + ' added';
        if (stats.updated) msg += ', ' + stats.updated + ' renamed';
        if (stats.removed) msg += ', ' + stats.removed + ' removed';
        if (stats.scored_removals && stats.scored_removals.length) {
          msg += ' (' + stats.scored_removals.length + ' with scores kept)';
        }
      }
      toast(msg, 'success');
      clearDirty();
      loadOverviewStats();
      loadTrackerClassMeta().then(function() { renderTable(); });
    }).catch(function(err) {
      toast('Push failed: ' + (err.message || err), 'error');
    }).finally(function() {
      if (btn) btn.disabled = false;
    });
  }

  function addPupilLocal(name) {
    if (!state.selectedClassKey) {
      toast('Select a class first', 'error');
      return false;
    }
    name = String(name || '').trim();
    if (!name) {
      toast('Enter a pupil name', 'error');
      return false;
    }
    var list = pupilsForSelectedClass().slice();
    var exists = list.some(function(p) {
      return p.name.toLowerCase() === name.toLowerCase();
    });
    if (exists) {
      toast('Pupil already in this class', 'error');
      return false;
    }
    list.push({
      local_id: window.ClassManagementRoster ? ClassManagementRoster.uid() : String(Date.now()),
      name: name
    });
    setPupilsForClass(state.selectedClassKey, list);
    markDirty();
    renderPupilsPanel();
    renderTable();
    return true;
  }

  function pastePupilNames(text) {
    if (!state.selectedClassKey) {
      toast('Select a class first', 'error');
      return 0;
    }
    var lines = String(text || '').split(/\r?\n/);
    var added = 0;
    var list = pupilsForSelectedClass().slice();
    lines.forEach(function(line) {
      line = String(line || '').trim();
      if (!line) return;
      if (list.some(function(p) { return p.name.toLowerCase() === line.toLowerCase(); })) return;
      list.push({
        local_id: window.ClassManagementRoster ? ClassManagementRoster.uid() : String(Date.now()),
        name: line
      });
      added++;
    });
    setPupilsForClass(state.selectedClassKey, list);
    if (added) markDirty();
    renderPupilsPanel();
    renderTable();
    return added;
  }

  function loadPupilsFromTracker() {
    if (!state.selectedClassKey || !window.ClassManagementRoster) {
      toast('Select a class first', 'error');
      return;
    }
    ClassManagementRoster.loadFromTracker({
      teacherId: state.selectedTeacherId,
      subject: state.subject,
      classes: state.classes,
      selectedClassKey: state.selectedClassKey
    }).then(function(byClass) {
      var loaded = byClass[state.selectedClassKey] || [];
      if (!loaded.length) {
        toast('No pupils found in the tracker for this class', 'error');
        return;
      }
      setPupilsForClass(state.selectedClassKey, loaded);
      markDirty();
      renderPupilsPanel();
      renderTable();
      toast('Loaded ' + loaded.length + ' pupil' + (loaded.length === 1 ? '' : 's') + ' from tracker', 'success');
    }).catch(function(err) {
      toast('Could not load from tracker: ' + (err.message || err), 'error');
    });
  }

  function parsePasteLines(text) {
    var lines = String(text || '').split(/\r?\n/);
    var added = 0;
    lines.forEach(function(line) {
      line = line.trim();
      if (!line) return;
      var yl = 1;
      var code = line;
      var m = /^(s?[1-3])\s+(.+)$/i.exec(line);
      if (m) {
        yl = parseYearLevel(m[1]) || 1;
        code = m[2].trim();
      }
      if (addClassLocal(yl, code, code)) added++;
    });
    return added;
  }

  function splitPupilName(full) {
    var s = String(full || '').trim();
    if (!s) return { first_name: '', last_name: '' };
    var parts = s.split(/\s+/);
    if (parts.length === 1) return { first_name: parts[0], last_name: parts[0] };
    return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
  }

  function parseCsvText(text) {
    var lines = String(text || '').split(/\r?\n/).filter(function(l) { return l.trim(); });
    if (!lines.length) return [];
    var headers = lines[0].split(',').map(function(h) {
      return h.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, '_');
    });
    return lines.slice(1).map(function(line) {
      var cols = line.split(',').map(function(c) { return c.replace(/^"|"$/g, '').trim(); });
      var row = {};
      headers.forEach(function(h, i) {
        row[h] = cols[i] != null ? cols[i] : '';
      });
      return row;
    });
  }

  function parseFileRows(file) {
    return new Promise(function(resolve, reject) {
      var name = (file.name || '').toLowerCase();
      var reader = new FileReader();
      if (name.endsWith('.csv')) {
        reader.onload = function() {
          try { resolve(parseCsvText(reader.result)); }
          catch (e) { reject(e); }
        };
        reader.onerror = function() { reject(new Error('Could not read file')); };
        reader.readAsText(file);
        return;
      }
      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        reader.onload = function() {
          try {
            var wb = XLSX.read(reader.result, { type: 'array' });
            var sheet = wb.Sheets[wb.SheetNames[0]];
            var json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            resolve(json.map(function(r) {
              var out = {};
              Object.keys(r).forEach(function(k) {
                out[String(k).trim().toLowerCase().replace(/\s+/g, '_')] = r[k];
              });
              return out;
            }));
          } catch (e) { reject(e); }
        };
        reader.onerror = function() { reject(new Error('Could not read file')); };
        reader.readAsArrayBuffer(file);
        return;
      }
      reject(new Error('Use CSV or XLSX'));
    });
  }

  function normalizeImportRow(row) {
    var subj = normalizeSubject(row.subject) || state.subject || 'art';
    var yl = parseYearLevel(row.year_level || row.year || row.year_group);
    var code = String(row.class_code || row.class || '').trim();
    var cname = String(row.class_name || row.classname || code).trim();
    if (!yl || !code) return null;
    var out = {
      subject: subj,
      year_level: 'S' + yl,
      class_code: code,
      class_name: cname,
      teacher_email: String(row.teacher_email || '').trim().toLowerCase()
    };
    var pupil = String(row.pupil_name || row.pupil || '').trim();
    if (pupil) {
      var names = splitPupilName(pupil);
      out.first_name = names.first_name;
      out.last_name = names.last_name;
    }
    return out;
  }

  function findTeacherByEmail(email) {
    var needle = String(email || '').trim().toLowerCase();
    if (!needle) return null;
    return state.teachers.find(function(t) {
      return String(t.email || '').trim().toLowerCase() === needle;
    }) || null;
  }

  function uniqueClassRows(rows) {
    var seen = {};
    var out = [];
    (rows || []).forEach(function(r) {
      var key = String(r.subject || '') + '|' + String(r.year_level || '') + '|' + String(r.class_code || '').toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push(r);
    });
    return out;
  }

  function buildImportGroups(classRows, pupilRows, fallbackTeacherId) {
    var groups = {};
    function groupKey(email, subject) {
      if (email) return email + '|' + subject;
      if (fallbackTeacherId) return 'fallback:' + fallbackTeacherId + '|' + subject;
      return 'unassigned|' + subject;
    }
    function ensure(key, email, subject) {
      if (!groups[key]) {
        var teacher = email ? findTeacherByEmail(email) : null;
        if (!teacher && !email && fallbackTeacherId) {
          teacher = state.teachers.find(function(t) { return t.teacher_id === fallbackTeacherId; }) || null;
        }
        groups[key] = {
          key: key,
          email: email,
          subject: subject,
          teacher: teacher,
          usedFallback: !email && !!teacher,
          classRows: [],
          pupilRows: []
        };
      }
      return groups[key];
    }
    (classRows || []).forEach(function(r) {
      var email = String(r.teacher_email || '').trim().toLowerCase();
      var subj = normalizeSubject(r.subject) || 'art';
      ensure(groupKey(email, subj), email, subj).classRows.push(r);
    });
    (pupilRows || []).forEach(function(r) {
      var email = String(r.teacher_email || '').trim().toLowerCase();
      var subj = normalizeSubject(r.subject) || 'art';
      var g = groups[groupKey(email, subj)];
      if (g) g.pupilRows.push(r);
    });
    return Object.keys(groups).map(function(k) { return groups[k]; }).sort(function(a, b) {
      var an = a.teacher ? (a.teacher.display_name || a.teacher.email || '') : (a.email || 'zzz');
      var bn = b.teacher ? (b.teacher.display_name || b.teacher.email || '') : (b.email || 'zzz');
      return an.localeCompare(bn) || String(a.subject).localeCompare(String(b.subject));
    });
  }

  function fillImportTeacherSelect() {
    var sel = $('cm-import-teacher');
    if (!sel) return;
    var current = sel.value;
    sel.innerHTML = '<option value="">Leave unmatched</option>' +
      state.teachers.map(function(t) {
        var label = (t.display_name || t.email || 'Staff').trim();
        return '<option value="' + escAttr(t.teacher_id) + '">' + escHtml(label) + '</option>';
      }).join('');
    if (current) sel.value = current;
    else if (state.selectedTeacherId) sel.value = state.selectedTeacherId;
  }

  function setImportButtons(enabled) {
    var apply = $('cm-import-apply');
    var send = $('cm-import-send');
    if (apply) apply.disabled = !enabled;
    if (send) send.disabled = !enabled;
  }

  function openImportModal() {
    fillImportTeacherSelect();
    state.pendingImport = null;
    var wrap = $('cm-import-preview-wrap');
    var summary = $('cm-import-summary');
    var preview = $('cm-import-preview');
    if (wrap) wrap.hidden = true;
    if (summary) summary.textContent = '';
    if (preview) preview.innerHTML = '';
    setImportButtons(false);
    var modal = $('cm-import-modal');
    if (modal) modal.classList.add('open');
  }

  function renderImportPreview() {
    var wrap = $('cm-import-preview-wrap');
    var summary = $('cm-import-summary');
    var preview = $('cm-import-preview');
    var pending = state.pendingImport;
    if (!wrap || !preview) return;
    if (!pending || !pending.classRows.length) {
      wrap.hidden = true;
      setImportButtons(false);
      return;
    }
    var fallbackId = $('cm-import-teacher') && $('cm-import-teacher').value;
    var groups = buildImportGroups(pending.classRows, pending.pupilRows, fallbackId);
    pending.groups = groups;
    wrap.hidden = false;
    var matched = groups.filter(function(g) { return g.teacher; });
    var unmatched = groups.filter(function(g) { return !g.teacher; });
    var classCount = uniqueClassRows(pending.classRows).length;
    var pupilCount = pending.pupilRows.length;
    if (summary) {
      summary.textContent = classCount + ' class' + (classCount === 1 ? '' : 'es') +
        (pupilCount ? ', ' + pupilCount + ' pupil' + (pupilCount === 1 ? '' : 's') : '') +
        ' across ' + groups.length + ' teacher' + (groups.length === 1 ? '' : 's') +
        ' from ' + (pending.fileName || 'file') +
        (unmatched.length ? '. ' + unmatched.length + ' unmatched.' : '');
    }
    preview.innerHTML = '<table><thead><tr><th>Teacher</th><th>Subject</th><th>Classes</th><th>Pupils</th><th>Status</th></tr></thead><tbody>' +
      groups.map(function(g) {
        var name = g.teacher
          ? (g.teacher.display_name || g.teacher.email)
          : (g.email || 'No email');
        var classes = uniqueClassRows(g.classRows);
        var status = g.teacher
          ? (g.usedFallback ? 'Fallback teacher' : 'Matched')
          : (g.email ? 'Unknown email' : 'No email');
        var statusClass = g.teacher ? 'cm-import-match' : 'cm-import-unmatched';
        var codes = classes.map(function(c) { return c.year_level + ' ' + c.class_code; }).join(', ');
        return '<tr class="' + (g.teacher ? '' : 'is-unmatched') + '">' +
          '<td>' + escHtml(name) + (g.email && g.teacher ? '<br><span class="cm-teacher-mail">' + escHtml(g.email) + '</span>' : '') + '</td>' +
          '<td>' + escHtml(g.subject === 'drama' ? 'Drama' : 'Art') + '</td>' +
          '<td>' + classes.length + (codes ? '<br>' + escHtml(codes) : '') + '</td>' +
          '<td>' + g.pupilRows.length + '</td>' +
          '<td class="' + statusClass + '">' + escHtml(status) + '</td></tr>';
      }).join('') + '</tbody></table>';
    setImportButtons(matched.length > 0);
  }

  function mergeImportIntoRoster(existingClasses, existingPupils, classRows, pupilRows) {
    var classes = (existingClasses || []).slice();
    var pupilsByClass = {};
    Object.keys(existingPupils || {}).forEach(function(k) {
      pupilsByClass[k] = (existingPupils[k] || []).slice();
    });
    uniqueClassRows(classRows).forEach(function(r) {
      var yl = parseYearLevel(r.year_level);
      var code = String(r.class_code || '').trim();
      if (!yl || !code) return;
      var exists = classes.some(function(c) {
        return c.year_level === yl && c.class_code.toLowerCase() === code.toLowerCase();
      });
      if (!exists) {
        classes.push({ year_level: yl, class_code: code, class_name: r.class_name || code });
      }
      var key = 'S' + yl + '|' + code.toLowerCase();
      if (!pupilsByClass[key]) pupilsByClass[key] = [];
    });
    (pupilRows || []).forEach(function(r) {
      var yl = parseYearLevel(r.year_level);
      var key = 'S' + yl + '|' + String(r.class_code || '').trim().toLowerCase();
      if (!pupilsByClass[key]) pupilsByClass[key] = [];
      var name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim();
      if (!name) return;
      if (pupilsByClass[key].some(function(p) { return p.name.toLowerCase() === name.toLowerCase(); })) return;
      pupilsByClass[key].push({
        local_id: window.ClassManagementRoster ? ClassManagementRoster.uid() : String(Date.now()),
        name: name
      });
    });
    return { classes: classes, pupilsByClass: pupilsByClass };
  }

  function applyPendingImport(send) {
    var pending = state.pendingImport;
    if (!pending || !pending.classRows.length) {
      toast('No rows to add', 'error');
      return;
    }
    if (!confirmLeaveWorkspace()) return;
    var fallbackId = $('cm-import-teacher') && $('cm-import-teacher').value;
    var groups = buildImportGroups(pending.classRows, pending.pupilRows, fallbackId);
    var matched = groups.filter(function(g) { return g.teacher; });
    var unmatched = groups.filter(function(g) { return !g.teacher; });
    if (!matched.length) {
      toast('No rows match a signed-in teacher', 'error');
      return;
    }
    setImportButtons(false);
    var saved = 0;
    var sent = 0;
    var errors = [];
    var i = 0;

    function finish() {
      closeModal('cm-import-modal');
      state.pendingImport = null;
      clearDirty();
      showOverview();
      loadOverviewStats();
      var msg = 'Saved drafts for ' + saved + ' teacher list' + (saved === 1 ? '' : 's');
      if (send) msg = 'Sent ' + sent + ' of ' + matched.length + ' to trackers';
      if (unmatched.length) msg += '. ' + unmatched.length + ' unmatched left in the file';
      if (errors.length) {
        toast(msg + '. ' + errors.length + ' failed: ' + errors[0], 'error');
      } else {
        toast(msg, 'success');
      }
    }

    function next() {
      if (i >= matched.length) {
        finish();
        return;
      }
      var g = matched[i++];
      var summary = $('cm-import-summary');
      if (summary) {
        summary.textContent = (send ? 'Sending ' : 'Saving ') + i + ' of ' + matched.length + '...';
      }
      loadRosterBundle(g.teacher.teacher_id, g.subject).then(function(bundle) {
        var merged = mergeImportIntoRoster(bundle.classes, bundle.pupilsByClass, g.classRows, g.pupilRows);
        return saveRosterFor(g.teacher.teacher_id, g.subject, merged.classes, merged.pupilsByClass).then(function() {
          saved += 1;
          if (!send) return;
          return ClassManagementRoster.pushToTracker({
            teacherId: g.teacher.teacher_id,
            subject: g.subject,
            academicYearLabel: state.academicYear,
            classes: merged.classes,
            pupilsByClass: merged.pupilsByClass,
            removeMissing: false
          }).then(function() { sent += 1; });
        });
      }).then(next).catch(function(err) {
        errors.push((g.teacher.display_name || g.email || 'Teacher') + ': ' + (err.message || err));
        next();
      });
    }

    next();
  }

  function handleImportFile(file) {
    if (!file) return;
    parseFileRows(file).then(function(rawRows) {
      var classRows = [];
      var pupilRows = [];
      rawRows.forEach(function(row) {
        var norm = normalizeImportRow(row);
        if (!norm) return;
        classRows.push(norm);
        if (norm.first_name && norm.last_name) pupilRows.push(norm);
      });
      if (!classRows.length) {
        toast('No valid rows. Check year_level and class_code.', 'error');
        return;
      }
      state.pendingImport = { classRows: classRows, pupilRows: pupilRows, fileName: file.name };
      renderImportPreview();
      var modal = $('cm-import-modal');
      if (modal && !modal.classList.contains('open')) modal.classList.add('open');
    }).catch(function(err) {
      toast('Import failed: ' + (err.message || err), 'error');
    });
  }

  function downloadTemplate(format) {
    var headers = ['subject', 'year_level', 'class_code', 'class_name', 'teacher_email', 'pupil_name'];
    var sample = [
      ['art', 'S1', '1A1', '1A1', 'teacher.a@school.gla.ac.uk', 'Jamie Smith'],
      ['art', 'S1', '1A1', '1A1', 'teacher.a@school.gla.ac.uk', 'Alex Brown'],
      ['drama', 'S1', '1A1', '1A1', 'teacher.b@school.gla.ac.uk', 'Casey Murray']
    ];
    if (format === 'csv') {
      var csv = [headers.join(',')].concat(sample.map(function(r) { return r.join(','); })).join('\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'class-import-template.csv';
      a.click();
      setTimeout(function() { URL.revokeObjectURL(a.href); }, 500);
      return;
    }
    if (typeof XLSX !== 'undefined') {
      var ws = XLSX.utils.aoa_to_sheet([headers].concat(sample));
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Classes');
      XLSX.writeFile(wb, 'class-import-template.xlsx');
    }
  }

  function collectDraftJobs() {
    var jobs = [];
    state.teachers.forEach(function(t) {
      var stats = state.teacherStats[t.teacher_id] || {};
      ['art', 'drama'].forEach(function(subj) {
        var rec = stats[subj] || {};
        if ((rec.rosterClasses || 0) > 0 && (rec.pupils || 0) === 0) {
          jobs.push({
            teacher: t,
            subject: subj,
            rosterClasses: rec.rosterClasses || 0
          });
        }
      });
    });
    return jobs;
  }

  function openSendDraftsModal() {
    if (!confirmLeaveWorkspace()) return;
    var jobs = collectDraftJobs();
    state.sendDraftJobs = jobs;
    var list = $('cm-send-drafts-list');
    var desc = $('cm-send-drafts-desc');
    var confirmBtn = $('cm-send-drafts-confirm');
    if (desc) {
      desc.textContent = jobs.length
        ? 'Cloud lists with no pupils on the tracker yet. Send writes those names onto each teacher\'s Art or Drama tracker.'
        : 'No drafts waiting. Teachers already on a tracker, or with no cloud list, are skipped.';
    }
    if (list) {
      if (!jobs.length) {
        list.innerHTML = '<p>Nothing to send.</p>';
      } else {
        list.innerHTML = '<table><thead><tr><th>Teacher</th><th>Subject</th><th>Classes in list</th></tr></thead><tbody>' +
          jobs.map(function(j) {
            return '<tr><td>' + escHtml(j.teacher.display_name || j.teacher.email) + '</td>' +
              '<td>' + (j.subject === 'drama' ? 'Drama' : 'Art') + '</td>' +
              '<td>' + j.rosterClasses + '</td></tr>';
          }).join('') + '</tbody></table>';
      }
    }
    if (confirmBtn) confirmBtn.disabled = !jobs.length;
    var modal = $('cm-send-drafts-modal');
    if (modal) modal.classList.add('open');
  }

  function confirmSendDrafts() {
    var jobs = state.sendDraftJobs || [];
    if (!jobs.length) return;
    var removeMissing = $('cm-send-drafts-remove') && $('cm-send-drafts-remove').checked;
    var btn = $('cm-send-drafts-confirm');
    if (btn) btn.disabled = true;
    var sent = 0;
    var errors = [];
    var i = 0;
    var desc = $('cm-send-drafts-desc');

    function finish() {
      closeModal('cm-send-drafts-modal');
      if (btn) btn.disabled = false;
      loadOverviewStats();
      var msg = 'Sent ' + sent + ' of ' + jobs.length + ' draft list' + (jobs.length === 1 ? '' : 's');
      if (errors.length) toast(msg + '. ' + errors.length + ' failed: ' + errors[0], 'error');
      else toast(msg, 'success');
    }

    function next() {
      if (i >= jobs.length) {
        finish();
        return;
      }
      var job = jobs[i++];
      if (desc) desc.textContent = 'Sending ' + i + ' of ' + jobs.length + '...';
      loadRosterBundle(job.teacher.teacher_id, job.subject).then(function(bundle) {
        if (!bundle.classes.length) return;
        return saveRosterFor(job.teacher.teacher_id, job.subject, bundle.classes, bundle.pupilsByClass).then(function() {
          return ClassManagementRoster.pushToTracker({
            teacherId: job.teacher.teacher_id,
            subject: job.subject,
            academicYearLabel: state.academicYear,
            classes: bundle.classes,
            pupilsByClass: bundle.pupilsByClass,
            removeMissing: removeMissing
          });
        }).then(function() { sent += 1; });
      }).then(next).catch(function(err) {
        errors.push((job.teacher.display_name || job.teacher.email) + ': ' + (err.message || err));
        next();
      });
    }

    next();
  }

  function normalizePersonName(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/\./g, ' ')
      .replace(/[^a-z0-9@\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function matchTimetableStaff(staff) {
    if (!staff) return null;
    var overrideId = state.ttMatchOverrides[staff.name];
    if (overrideId) {
      return state.teachers.find(function(t) { return t.teacher_id === overrideId; }) || null;
    }
    var short = normalizePersonName(staff.short);
    var ttName = normalizePersonName(staff.name);
    var list = state.teachers || [];
    if (!short && !ttName) return null;

    var compact = function(s) { return String(s || '').replace(/\s+/g, ''); };
    var emailHits = list.filter(function(t) {
      var local = normalizePersonName(String(t.email || '').split('@')[0]);
      return (short && compact(local).indexOf(compact(short)) !== -1) ||
        (short && compact(short).indexOf(compact(local)) !== -1 && compact(local).length > 3);
    });
    if (emailHits.length === 1) return emailHits[0];

    var surnameHits = list.filter(function(t) {
      var n = normalizePersonName(t.display_name || '');
      if (!n || !short) return false;
      var last = n.split(' ').pop();
      return last === short || n === ttName;
    });
    if (surnameHits.length === 1) return surnameHits[0];

    var initHits = list.filter(function(t) {
      var n = normalizePersonName(t.display_name || '');
      var parts = n.split(' ');
      var ttParts = ttName.split(' ');
      if (parts.length < 2 || ttParts.length < 2 || !short) return false;
      return parts[0].charAt(0) === ttParts[0].charAt(0) && parts[parts.length - 1] === short;
    });
    if (initHits.length === 1) return initHits[0];
    return null;
  }

  function teacherMatchOptions(selectedId) {
    return '<option value="">Choose teacher</option>' +
      state.teachers.map(function(t) {
        var label = (t.display_name || t.email || 'Staff').trim();
        var sel = t.teacher_id === selectedId ? ' selected' : '';
        return '<option value="' + escAttr(t.teacher_id) + '"' + sel + '>' + escHtml(label) + '</option>';
      }).join('');
  }

  function buildTimetableGroups() {
    var FT = window.FacultyTimetableData;
    if (!FT || typeof FT.bgeClassesForStaff !== 'function') return [];
    var groups = [];
    FT.allStaff().forEach(function(staff) {
      var classes = FT.bgeClassesForStaff(staff) || [];
      var bySubj = {};
      classes.forEach(function(c) {
        if (!bySubj[c.subject]) bySubj[c.subject] = [];
        bySubj[c.subject].push(c);
      });
      Object.keys(bySubj).forEach(function(subj) {
        groups.push({
          staff: staff,
          subject: subj,
          classRows: bySubj[subj],
          teacher: matchTimetableStaff(staff)
        });
      });
    });
    return groups;
  }

  function renderTimetablePreview() {
    var preview = $('cm-tt-preview');
    var summary = $('cm-tt-summary');
    var sendBtn = $('cm-tt-send');
    var draftBtn = $('cm-tt-drafts');
    var groups = buildTimetableGroups();
    if (!preview) return;
    var matched = groups.filter(function(g) { return g.teacher; });
    var classCount = groups.reduce(function(n, g) { return n + g.classRows.length; }, 0);
    if (summary) {
      summary.textContent = classCount + ' BGE class' + (classCount === 1 ? '' : 'es') +
        ' across ' + groups.length + ' teacher list' + (groups.length === 1 ? '' : 's') +
        '. ' + matched.length + ' matched.' +
        (groups.length - matched.length ? ' ' + (groups.length - matched.length) + ' need a teacher.' : '');
    }
    preview.innerHTML = '<table><thead><tr><th>Timetable</th><th>Subject</th><th>Classes</th><th>Signed-in teacher</th></tr></thead><tbody>' +
      groups.map(function(g) {
        var codes = g.classRows.map(function(c) { return c.class_code; }).join(', ');
        var matchedName = g.teacher ? (g.teacher.display_name || g.teacher.email) : '';
        return '<tr class="' + (g.teacher ? '' : 'is-unmatched') + '">' +
          '<td>' + escHtml(g.staff.name) + '</td>' +
          '<td>' + (g.subject === 'drama' ? 'Drama' : 'Art') + '</td>' +
          '<td>' + g.classRows.length + '<br>' + escHtml(codes) + '</td>' +
          '<td>' +
          (g.teacher && !state.ttMatchOverrides[g.staff.name]
            ? '<span class="cm-import-match">' + escHtml(matchedName) + '</span>'
            : '<select class="cm-tt-match" data-tt-staff="' + escAttr(g.staff.name) + '">' +
              teacherMatchOptions(g.teacher && g.teacher.teacher_id) + '</select>') +
          '</td></tr>';
      }).join('') + '</tbody></table>';
    preview.querySelectorAll('.cm-tt-match').forEach(function(sel) {
      sel.addEventListener('change', function() {
        var name = sel.getAttribute('data-tt-staff') || '';
        if (sel.value) state.ttMatchOverrides[name] = sel.value;
        else delete state.ttMatchOverrides[name];
        renderTimetablePreview();
      });
    });
    if (sendBtn) sendBtn.disabled = !matched.length;
    if (draftBtn) draftBtn.disabled = !matched.length;
  }

  function openTimetableModal() {
    if (!window.FacultyTimetableData) {
      toast('Faculty timetable data not loaded', 'error');
      return;
    }
    if (!confirmLeaveWorkspace()) return;
    renderTimetablePreview();
    var modal = $('cm-tt-modal');
    if (modal) modal.classList.add('open');
  }

  function timetableStaffForTeacher(teacher) {
    var FT = window.FacultyTimetableData;
    if (!teacher || !FT || typeof FT.allStaff !== 'function') return null;
    var hits = FT.allStaff().filter(function(staff) {
      var matched = matchTimetableStaff(staff);
      return matched && matched.teacher_id === teacher.teacher_id;
    });
    if (hits.length === 1) return hits[0];
    var tn = normalizePersonName(teacher.display_name || '');
    var nameHits = FT.allStaff().filter(function(staff) {
      return tn && normalizePersonName(staff.name) === tn;
    });
    if (nameHits.length === 1) return nameHits[0];
    return hits[0] || nameHits[0] || null;
  }

  function loadTimetableForSelectedTeacher() {
    var teacher = selectedTeacher();
    if (!teacher) {
      toast('Choose a teacher first', 'error');
      return;
    }
    var FT = window.FacultyTimetableData;
    if (!FT || typeof FT.bgeClassesForStaff !== 'function') {
      toast('Faculty timetable data not loaded', 'error');
      return;
    }
    var staff = timetableStaffForTeacher(teacher);
    if (!staff) {
      toast('Could not match this teacher on the faculty timetable. Use Load faculty timetable on the teacher list to match names.', 'error');
      return;
    }
    var rows = (FT.bgeClassesForStaff(staff) || []).filter(function(c) {
      return c.subject === state.subject;
    });
    var teacherName = teacher.display_name || teacher.email || 'this teacher';
    if (!rows.length) {
      toast('No S1 to S3 ' + subjectLabel() + ' classes on the timetable for ' + teacherName, 'error');
      return;
    }
    var merged = mergeImportIntoRoster(state.classes, state.pupilsByClass, rows, []);
    var existingKeys = {};
    state.classes.forEach(function(c) { existingKeys[classKeyFor(c)] = true; });
    var addedClasses = merged.classes.filter(function(c) { return !existingKeys[classKeyFor(c)]; });
    if (!addedClasses.length) {
      toast(subjectLabel() + ' timetable classes are already on this list. Existing pupils were left as they are.', 'success');
      return;
    }
    var codes = addedClasses.map(function(c) { return c.class_code; }).join(', ');
    var msg = 'Add ' + addedClasses.length + ' class' + (addedClasses.length === 1 ? '' : 'es') +
      ' from the timetable for ' + teacherName + '?\n\n' + codes +
      '\n\nClasses and pupils already here stay.';
    if (!window.confirm(msg)) return;
    state.classes = merged.classes;
    state.pupilsByClass = merged.pupilsByClass;
    if (!state.selectedClassKey && state.classes.length) {
      state.selectedClassKey = classKeyFor(state.classes[0]);
    } else if (addedClasses.length && !state.selectedClassKey) {
      state.selectedClassKey = classKeyFor(addedClasses[0]);
    }
    markDirty();
    renderTable();
    toast('Added ' + addedClasses.length + ' class' + (addedClasses.length === 1 ? '' : 'es') +
      ' from the timetable. Send to tracker when the lists look right.', 'success');
  }

  function applyTimetableClasses(send) {
    var groups = buildTimetableGroups().filter(function(g) { return g.teacher; });
    if (!groups.length) {
      toast('Match at least one teacher first', 'error');
      return;
    }
    var sendBtn = $('cm-tt-send');
    var draftBtn = $('cm-tt-drafts');
    if (sendBtn) sendBtn.disabled = true;
    if (draftBtn) draftBtn.disabled = true;
    var saved = 0;
    var sent = 0;
    var errors = [];
    var i = 0;
    var summary = $('cm-tt-summary');

    function finish() {
      closeModal('cm-tt-modal');
      if (sendBtn) sendBtn.disabled = false;
      if (draftBtn) draftBtn.disabled = false;
      clearDirty();
      showOverview();
      loadOverviewStats();
      var msg = send
        ? 'Put ' + sent + ' of ' + groups.length + ' class lists on trackers. Add pupil names next.'
        : 'Saved drafts for ' + saved + ' teacher list' + (saved === 1 ? '' : 's') + '. Add pupil names, then send.';
      if (errors.length) toast(msg + ' ' + errors.length + ' failed: ' + errors[0], 'error');
      else toast(msg, 'success');
    }

    function next() {
      if (i >= groups.length) {
        finish();
        return;
      }
      var g = groups[i++];
      if (summary) {
        summary.textContent = (send ? 'Sending ' : 'Saving ') + i + ' of ' + groups.length + '...';
      }
      loadRosterBundle(g.teacher.teacher_id, g.subject).then(function(bundle) {
        var merged = mergeImportIntoRoster(bundle.classes, bundle.pupilsByClass, g.classRows, []);
        return saveRosterFor(g.teacher.teacher_id, g.subject, merged.classes, merged.pupilsByClass).then(function() {
          saved += 1;
          if (!send) return;
          return ClassManagementRoster.pushToTracker({
            teacherId: g.teacher.teacher_id,
            subject: g.subject,
            academicYearLabel: state.academicYear,
            classes: merged.classes,
            pupilsByClass: merged.pupilsByClass,
            removeMissing: false
          }).then(function() { sent += 1; });
        });
      }).then(next).catch(function(err) {
        errors.push((g.teacher.display_name || g.staff.name) + ': ' + (err.message || err));
        next();
      });
    }

    next();
  }

  function setTab(tab) {
    state.tab = tab;
    var rosterPanel = $('cm-panel-roster');
    var trackerPanel = $('cm-panel-tracker');
    var tabRoster = $('cm-tab-roster');
    var tabTracker = $('cm-tab-tracker');
    if (tabRoster) tabRoster.classList.toggle('is-active', tab === 'roster');
    if (tabTracker) tabTracker.classList.toggle('is-active', tab === 'tracker');
    if (rosterPanel) rosterPanel.classList.toggle('is-active', tab === 'roster');
    if (trackerPanel) trackerPanel.classList.toggle('is-active', tab === 'tracker');
    if (tab === 'tracker') loadTrackerClasses();
    if (tab === 'roster' && state.view === 'overview') renderTeacherGrid();
  }

  function fillModalYearSelects() {
    var yearSel = $('cm-year-label');
    var labels = yearSel ? Array.from(yearSel.options).map(function(o) { return o.value; }) : [currentAcademicYearLabel()];
    ['cm-transfer-year-roster', 'cm-promote-year-roster'].forEach(function(id) {
      var sel = $(id);
      if (!sel) return;
      sel.innerHTML = labels.map(function(l) {
        return '<option value="' + escAttr(l) + '">' + escHtml(l) + '</option>';
      }).join('');
      if (state.academicYear) sel.value = state.academicYear;
    });
  }

  function fillTeacherSelect(selectId, excludeUserId) {
    var sel = $(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Select teacher…</option>' +
      state.teachers.map(function(t) {
        if (excludeUserId && t.teacher_id === excludeUserId) return '';
        var label = (t.display_name || t.email || 'Staff').trim();
        return '<option value="' + escAttr(t.teacher_id) + '">' + escHtml(label) + '</option>';
      }).join('');
  }

  function loadTrackerClasses() {
    var body = $('cm-trk-body');
    if (!body) return;
    if (!window.ClassManagementTracker) {
      body.innerHTML = '<tr><td colspan="7" class="cm-empty">Tracker module not loaded</td></tr>';
      return;
    }
    body.innerHTML = '<tr><td colspan="7" class="cm-empty">Loading…</td></tr>';
    ClassManagementTracker.loadStaff().then(function(staff) {
      state.trackerLoaded = true;
      var q = ($('cm-trk-search') && $('cm-trk-search').value) || '';
      var subj = ($('cm-trk-subject') && $('cm-trk-subject').value) || '';
      var yg = ($('cm-trk-yg') && $('cm-trk-yg').value) || '';
      state.trackerRows = ClassManagementTracker.buildClassRowsFromStaff(staff, {
        q: q, subject: subj, yearGroup: yg
      });
      renderTrackerTable();
    }).catch(function(err) {
      body.innerHTML = '<tr><td colspan="7" class="cm-empty">Could not load: ' + escHtml(err.message || err) + '</td></tr>';
    });
  }

  function renderTrackerTable() {
    var body = $('cm-trk-body');
    if (!body) return;
    var rows = state.trackerRows;
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="7" class="cm-empty">No tracker classes match filters.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function(r, idx) {
      var dataBadge = r.hasScores
        ? '<span class="badge badge-success">Scores</span>'
        : '<span class="badge">Setup only</span>';
      var subjBadge = r.subject === 'drama' ? 'badge-drama' : 'badge-art';
      return '<tr class="row-' + r.subject + '">' +
        '<td><strong>' + escHtml(r.teacherName) + '</strong></td>' +
        '<td><span class="badge ' + subjBadge + '">' + escHtml(r.subject === 'drama' ? 'Drama' : 'Art') + '</span></td>' +
        '<td>' + escHtml(r.yearGroup.toUpperCase()) + '</td>' +
        '<td>' + escHtml(r.className) + '</td>' +
        '<td>' + r.pupilCount + '</td>' +
        '<td>' + dataBadge + '</td>' +
        '<td><div class="cm-tracker-actions">' +
        '<button type="button" class="btn btn-ghost" data-trk-action="view" data-idx="' + idx + '">View</button>' +
        '<button type="button" class="btn btn-ghost" data-trk-action="transfer" data-idx="' + idx + '">Transfer</button>' +
        '<button type="button" class="btn btn-primary" data-trk-action="promote" data-idx="' + idx + '"' +
        (r.yearGroup === 's3' ? ' disabled title="S3 cannot promote higher"' : '') + '>Promote</button>' +
        '</div></td></tr>';
    }).join('');

    body.querySelectorAll('[data-trk-action]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        var row = state.trackerRows[idx];
        if (!row) return;
        var action = btn.getAttribute('data-trk-action');
        if (action === 'view') {
          var page = row.subject === 'drama' ? 'drama-tracker.html' : 'art-tracker.html';
          var ret = encodeURIComponent(isEmbed ? 'faculty-hub.html?panel=embed-class-management' : 'class_management.html');
          window.open(page + '?viewAs=' + encodeURIComponent(row.userId) +
            '&name=' + encodeURIComponent(row.teacherName) + '&return=' + ret, '_blank');
        } else if (action === 'transfer') {
          openTransferModal(row);
        } else if (action === 'promote') {
          openPromoteModal(row);
        }
      });
    });
  }

  function yearGroupFromLevel(yl) {
    if (yl === 1) return 's1';
    if (yl === 2) return 's2';
    if (yl === 3) return 's3';
    return null;
  }

  function teacherDisplayName(userId) {
    var t = state.teachers.find(function(x) { return x.teacher_id === userId; });
    return (t && (t.display_name || t.email)) || 'Teacher';
  }

  function resolveTrackerClassForRoster(cls, trackerS) {
    var yg = yearGroupFromLevel(cls.year_level);
    if (!yg || !trackerS || !trackerS.pupils || !trackerS.pupils[yg]) return null;
    var name = cls.class_name || cls.class_code;
    if (trackerS.pupils[yg][name]) return { yearGroup: yg, className: name };
    var code = String(cls.class_code || '').trim();
    var keys = Object.keys(trackerS.pupils[yg]);
    var match = keys.find(function(k) {
      return k === name || (code && (k.indexOf(code) !== -1 || k.indexOf(code) === 0));
    });
    return match ? { yearGroup: yg, className: match } : null;
  }

  function buildWizardRowFromRoster(cls, trackerMatch, trackerS) {
    var pupils = (trackerS.pupils[trackerMatch.yearGroup][trackerMatch.className]) || [];
    var hasScores = pupils.some(function(p) {
      var sc = trackerS.scores[trackerMatch.yearGroup] && trackerS.scores[trackerMatch.yearGroup][p.id];
      return sc && Object.keys(sc).length > 0;
    });
    return {
      userId: state.selectedTeacherId,
      subject: state.subject,
      yearGroup: trackerMatch.yearGroup,
      className: trackerMatch.className,
      teacherName: teacherDisplayName(state.selectedTeacherId),
      pupilCount: pupils.length,
      hasScores: hasScores
    };
  }

  function updateRosterTrackerActions(cls) {
    var promoteBtn = $('cm-roster-promote-btn');
    var transferBtn = $('cm-roster-transfer-btn');
    if (!promoteBtn || !transferBtn) return;
    if (!cls || !state.selectedTeacherId || !window.ClassManagementTracker) {
      promoteBtn.disabled = true;
      transferBtn.disabled = true;
      promoteBtn.title = 'Select a class with tracker data';
      transferBtn.title = 'Select a class with tracker data';
      return;
    }
    promoteBtn.disabled = true;
    transferBtn.disabled = true;
    ClassManagementTracker.loadTrackerState(state.selectedTeacherId, state.subject).then(function(trackerS) {
      var match = resolveTrackerClassForRoster(cls, trackerS);
      if (!match) {
        promoteBtn.title = 'Class not in tracker yet. Push to tracker first';
        transferBtn.title = 'Class not in tracker yet. Push to tracker first';
        return;
      }
      transferBtn.disabled = false;
      transferBtn.title = 'Transfer this class to another teacher';
      if (match.yearGroup === 's3') {
        promoteBtn.title = 'S3 cannot promote higher';
      } else {
        promoteBtn.disabled = false;
        promoteBtn.title = 'Promote this class to the next year';
      }
    }).catch(function() {
      promoteBtn.title = 'Could not load tracker data';
      transferBtn.title = 'Could not load tracker data';
    });
  }

  function openRosterTrackerAction(action) {
    var cls = selectedClass();
    if (!cls || !state.selectedTeacherId || !window.ClassManagementTracker) return;
    ClassManagementTracker.loadTrackerState(state.selectedTeacherId, state.subject).then(function(trackerS) {
      var match = resolveTrackerClassForRoster(cls, trackerS);
      if (!match) {
        toast('Class not found in tracker. Push to tracker first', 'error');
        return;
      }
      var row = buildWizardRowFromRoster(cls, match, trackerS);
      if (action === 'promote') openPromoteModal(row);
      else openTransferModal(row);
    }).catch(function(err) {
      toast('Could not load tracker: ' + (err.message || err), 'error');
    });
  }

  function renderModalPupilList(config) {
    var wrap = $(config.wrapId);
    var list = $(config.listId);
    if (!wrap || !list) return;
    var pupils = config.pupils || [];
    if (!pupils.length) {
      wrap.style.display = 'none';
      list.innerHTML = '';
      return;
    }
    wrap.style.display = '';
    list.innerHTML = pupils.map(function(p) {
      return '<label class="cm-check cm-promote-pupil-item">' +
        '<input type="checkbox" class="' + config.checkboxClass + '" data-pid="' + escAttr(p.id) + '" checked />' +
        '<span>' + escHtml(p.name) + '</span></label>';
    }).join('');
  }

  function continuingPupilIdsFromModal(checkboxClass) {
    return Array.from(document.querySelectorAll('.' + checkboxClass + ':checked'))
      .map(function(cb) { return cb.getAttribute('data-pid'); })
      .filter(Boolean);
  }

  function loadModalPupilsForRow(row, config) {
    renderModalPupilList({ wrapId: config.wrapId, listId: config.listId, checkboxClass: config.checkboxClass, pupils: [] });
    ClassManagementTracker.loadTrackerState(row.userId, row.subject).then(function(trackerS) {
      var pupils = (trackerS.pupils[row.yearGroup] && trackerS.pupils[row.yearGroup][row.className]) || [];
      renderModalPupilList({
        wrapId: config.wrapId,
        listId: config.listId,
        checkboxClass: config.checkboxClass,
        pupils: pupils
      });
    }).catch(function() {
      renderModalPupilList({ wrapId: config.wrapId, listId: config.listId, checkboxClass: config.checkboxClass, pupils: [] });
    });
  }

  function renderPromotePupilList(pupils) {
    renderModalPupilList({
      wrapId: 'cm-promote-pupils-wrap',
      listId: 'cm-promote-pupils',
      checkboxClass: 'cm-promote-pupil-cb',
      pupils: pupils
    });
  }

  function renderTransferPupilList(pupils) {
    renderModalPupilList({
      wrapId: 'cm-transfer-pupils-wrap',
      listId: 'cm-transfer-pupils',
      checkboxClass: 'cm-transfer-pupil-cb',
      pupils: pupils
    });
  }

  function continuingPupilIdsFromPromoteModal() {
    return continuingPupilIdsFromModal('cm-promote-pupil-cb');
  }

  function continuingPupilIdsFromTransferModal() {
    return continuingPupilIdsFromModal('cm-transfer-pupil-cb');
  }

  function openTransferModal(row) {
    state.wizardRow = row;
    var modal = $('cm-transfer-modal');
    var desc = $('cm-transfer-desc');
    if (desc) {
      desc.textContent = 'Move “' + row.className + '” (' + row.yearGroup.toUpperCase() + ' ' +
        (row.subject === 'drama' ? 'Drama' : 'Art') + ', ' + row.pupilCount + ' pupils) from ' +
        row.teacherName + ' to another teacher. Checked pupils are copied to the receiving teacher\'s tracker.';
    }
    fillTeacherSelect('cm-transfer-to', row.userId);
    var clsInp = $('cm-transfer-cls');
    if (clsInp) clsInp.value = row.className;
    loadModalPupilsForRow(row, {
      wrapId: 'cm-transfer-pupils-wrap',
      listId: 'cm-transfer-pupils',
      checkboxClass: 'cm-transfer-pupil-cb'
    });
    fillModalYearSelects();
    if (modal) modal.classList.add('open');
  }

  function openPromoteModal(row) {
    state.wizardRow = row;
    var modal = $('cm-promote-modal');
    var desc = $('cm-promote-desc');
    var nextYg = ClassManagementTracker.nextYearGroup(row.yearGroup);
    if (desc) {
      desc.textContent = 'Promote “' + row.className + '” from ' + row.yearGroup.toUpperCase() +
        ' to ' + (nextYg || '').toUpperCase() + ' for a teacher. The source class will be archived and prior-year scores attached as a read-only snapshot on each promoted pupil in the new year.';
    }
    fillTeacherSelect('cm-promote-to', null);
    var toSel = $('cm-promote-to');
    if (toSel) toSel.value = row.userId;
    var ygSel = $('cm-promote-to-yg');
    if (ygSel) {
      ygSel.innerHTML = nextYg
        ? '<option value="' + nextYg + '">' + nextYg.toUpperCase() + '</option>'
        : '';
    }
    var clsInp = $('cm-promote-cls');
    if (clsInp && nextYg) {
      clsInp.value = ClassManagementTracker.suggestPromotedClassName(row.className, row.yearGroup, nextYg, null);
    }
    renderPromotePupilList([]);
    loadModalPupilsForRow(row, {
      wrapId: 'cm-promote-pupils-wrap',
      listId: 'cm-promote-pupils',
      checkboxClass: 'cm-promote-pupil-cb'
    });
    fillModalYearSelects();
    if (modal) modal.classList.add('open');
  }

  function closeModal(id) {
    var m = $(id);
    if (m) m.classList.remove('open');
    state.wizardRow = null;
  }

  function confirmTransfer() {
    var row = state.wizardRow;
    if (!row || !window.ClassManagementTracker) return;
    var toId = ($('cm-transfer-to') && $('cm-transfer-to').value) || '';
    var targetCls = ($('cm-transfer-cls') && $('cm-transfer-cls').value.trim()) || row.className;
    var remove = $('cm-transfer-remove') && $('cm-transfer-remove').checked;
    var syncRoster = $('cm-transfer-roster') && $('cm-transfer-roster').checked;
    var year = ($('cm-transfer-year-roster') && $('cm-transfer-year-roster').value) || state.academicYear;
    if (!toId) { toast('Select receiving teacher', 'error'); return; }
    var continuingPupilIds = continuingPupilIdsFromTransferModal();
    if (!continuingPupilIds.length) { toast('Select at least one pupil to transfer', 'error'); return; }
    var btn = $('cm-transfer-confirm');
    if (btn) btn.disabled = true;
    ClassManagementTracker.transferClass({
      fromUserId: row.userId,
      toUserId: toId,
      subject: row.subject,
      yearGroup: row.yearGroup,
      className: row.className,
      targetClassName: targetCls,
      removeFromSource: remove,
      syncRoster: syncRoster,
      academicYearLabel: year,
      continuingPupilIds: continuingPupilIds
    }).then(function(res) {
      var excluded = (res.excludedCount || 0) > 0
        ? ' (' + res.excludedCount + ' stayed with current teacher)'
        : '';
      toast('Transferred ' + res.pupilCount + ' pupils to new teacher' + excluded, 'success');
      closeModal('cm-transfer-modal');
      loadTrackerClasses();
      if (state.tab === 'roster') renderPupilsPanel();
    }).catch(function(err) {
      toast('Transfer failed: ' + (err.message || err), 'error');
    }).finally(function() {
      if (btn) btn.disabled = false;
    });
  }

  function confirmPromote() {
    var row = state.wizardRow;
    if (!row || !window.ClassManagementTracker) return;
    var toId = ($('cm-promote-to') && $('cm-promote-to').value) || row.userId;
    var toYg = ($('cm-promote-to-yg') && $('cm-promote-to-yg').value) || ClassManagementTracker.nextYearGroup(row.yearGroup);
    var toCls = ($('cm-promote-cls') && $('cm-promote-cls').value.trim()) || '';
    var snapshot = $('cm-promote-snapshot') && $('cm-promote-snapshot').checked;
    var archiveSource = $('cm-promote-archive') && $('cm-promote-archive').checked;
    var year = ($('cm-promote-year-roster') && $('cm-promote-year-roster').value) || state.academicYear;
    if (!toYg) { toast('Invalid promote target year', 'error'); return; }
    var continuingPupilIds = continuingPupilIdsFromPromoteModal();
    if (!continuingPupilIds.length) { toast('Select at least one pupil to promote', 'error'); return; }
    var btn = $('cm-promote-confirm');
    if (btn) btn.disabled = true;
    ClassManagementTracker.promoteAndAssign({
      fromUserId: row.userId,
      toUserId: toId,
      subject: row.subject,
      fromYearGroup: row.yearGroup,
      className: row.className,
      toYearGroup: toYg,
      toClassName: toCls,
      includeSnapshot: snapshot,
      archiveSource: archiveSource,
      academicYearLabel: year,
      continuingPupilIds: continuingPupilIds
    }).then(function(res) {
      var excluded = (res.excludedCount || 0) > 0
        ? ' (' + res.excludedCount + ' not continuing, kept in archive only)'
        : '';
      toast('Promoted ' + res.pupilCount + ' pupils to ' + res.toClassName + ' (' + res.toYearGroup.toUpperCase() + ')' +
        excluded + (archiveSource ? '. Source class archived' : ''), 'success');
      closeModal('cm-promote-modal');
      loadTrackerClasses();
      if (state.tab === 'roster') renderPupilsPanel();
    }).catch(function(err) {
      toast('Promote failed: ' + (err.message || err), 'error');
    }).finally(function() {
      if (btn) btn.disabled = false;
    });
  }

  function wireEvents() {
    var tabRoster = $('cm-tab-roster');
    var tabTracker = $('cm-tab-tracker');
    if (tabRoster) tabRoster.addEventListener('click', function() { setTab('roster'); });
    if (tabTracker) tabTracker.addEventListener('click', function() { setTab('tracker'); });

    var trkRefresh = $('cm-trk-refresh');
    if (trkRefresh) trkRefresh.addEventListener('click', loadTrackerClasses);
    ['cm-trk-search', 'cm-trk-subject', 'cm-trk-yg'].forEach(function(id) {
      var el = $(id);
      if (el) el.addEventListener('change', function() {
        if (state.tab === 'tracker') loadTrackerClasses();
      });
      if (el && id === 'cm-trk-search') {
        el.addEventListener('input', function() {
          if (state.trackerLoaded && state.tab === 'tracker') {
            clearTimeout(wireEvents._searchT);
            wireEvents._searchT = setTimeout(loadTrackerClasses, 280);
          }
        });
      }
    });

    var trCancel = $('cm-transfer-cancel');
    var prCancel = $('cm-promote-cancel');
    if (trCancel) trCancel.addEventListener('click', function() { closeModal('cm-transfer-modal'); });
    if (prCancel) prCancel.addEventListener('click', function() { closeModal('cm-promote-modal'); });
    var trConfirm = $('cm-transfer-confirm');
    var prConfirm = $('cm-promote-confirm');
    if (trConfirm) trConfirm.addEventListener('click', confirmTransfer);
    if (prConfirm) prConfirm.addEventListener('click', confirmPromote);

    var rosterTransfer = $('cm-roster-transfer-btn');
    var rosterPromote = $('cm-roster-promote-btn');
    if (rosterTransfer) rosterTransfer.addEventListener('click', function() { openRosterTrackerAction('transfer'); });
    if (rosterPromote) rosterPromote.addEventListener('click', function() { openRosterTrackerAction('promote'); });

    var backOverview = $('cm-back-overview');
    if (backOverview) {
      backOverview.addEventListener('click', function() {
        if (!confirmLeaveWorkspace()) return;
        clearDirty();
        state.selectedTeacherId = '';
        state.classes = [];
        state.pupilsByClass = {};
        state.selectedClassKey = '';
        var sel = $('cm-teacher');
        if (sel) sel.value = '';
        updateTrackerLink();
        showOverview();
        loadOverviewStats();
      });
    }

    document.querySelectorAll('.cm-status-filters [data-status-filter]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.statusFilter = btn.getAttribute('data-status-filter') || 'all';
        document.querySelectorAll('.cm-status-filters [data-status-filter]').forEach(function(b) {
          b.classList.toggle('is-active', b === btn);
        });
        renderTeacherGrid();
      });
    });

    var staffSearch = $('cm-staff-search');
    if (staffSearch) {
      staffSearch.addEventListener('input', function() {
        state.staffFilter = staffSearch.value || '';
        renderTeacherGrid();
      });
    }

    ['cm-import-open', 'cm-import-open-ws'].forEach(function(id) {
      var btn = $(id);
      if (btn) btn.addEventListener('click', openImportModal);
    });
    var importCancel = $('cm-import-cancel');
    if (importCancel) importCancel.addEventListener('click', function() { closeModal('cm-import-modal'); });
    var importApply = $('cm-import-apply');
    if (importApply) importApply.addEventListener('click', function() { applyPendingImport(false); });
    var importSend = $('cm-import-send');
    if (importSend) importSend.addEventListener('click', function() { applyPendingImport(true); });
    var importTeacher = $('cm-import-teacher');
    if (importTeacher) {
      importTeacher.addEventListener('change', function() {
        if (state.pendingImport) renderImportPreview();
      });
    }

    var ttOpen = $('cm-tt-open');
    if (ttOpen) ttOpen.addEventListener('click', openTimetableModal);
    var ttTeacher = $('cm-tt-teacher');
    if (ttTeacher) ttTeacher.addEventListener('click', loadTimetableForSelectedTeacher);
    var ttCancel = $('cm-tt-cancel');
    if (ttCancel) ttCancel.addEventListener('click', function() { closeModal('cm-tt-modal'); });
    var ttDrafts = $('cm-tt-drafts');
    if (ttDrafts) ttDrafts.addEventListener('click', function() { applyTimetableClasses(false); });
    var ttSend = $('cm-tt-send');
    if (ttSend) ttSend.addEventListener('click', function() { applyTimetableClasses(true); });

    var sendDraftsBtn = $('cm-send-drafts');
    if (sendDraftsBtn) sendDraftsBtn.addEventListener('click', openSendDraftsModal);
    var sendDraftsCancel = $('cm-send-drafts-cancel');
    if (sendDraftsCancel) sendDraftsCancel.addEventListener('click', function() { closeModal('cm-send-drafts-modal'); });
    var sendDraftsConfirm = $('cm-send-drafts-confirm');
    if (sendDraftsConfirm) sendDraftsConfirm.addEventListener('click', confirmSendDrafts);

    var teacherSel = $('cm-teacher');
    if (teacherSel) {
      teacherSel.addEventListener('change', function() {
        var next = teacherSel.value || '';
        if (next === state.selectedTeacherId) return;
        if (!confirmLeaveWorkspace()) {
          teacherSel.value = state.selectedTeacherId;
          return;
        }
        clearDirty();
        state.selectedTeacherId = next;
        if (!state.selectedTeacherId) {
          showOverview();
          updateTrackerLink();
          return;
        }
        showWorkspace();
        updateTrackerLink();
        loadClasses();
      });
    }

    ['cm-subj-art', 'cm-subj-drama'].forEach(function(id) {
      var btn = $(id);
      if (!btn) return;
      btn.addEventListener('click', function() {
        var next = btn.getAttribute('data-subject') || 'art';
        if (next === state.subject) return;
        if (!confirmLeaveWorkspace()) return;
        clearDirty();
        state.subject = next;
        updateSubjectUi();
        updateTrackerLink();
        loadClasses();
      });
    });

    var yearSel = $('cm-year-label');
    if (yearSel) {
      yearSel.addEventListener('change', function() {
        var next = yearSel.value;
        if (next === state.academicYear) return;
        if (state.view === 'workspace' && state.selectedTeacherId) {
          if (!confirmLeaveWorkspace()) {
            yearSel.value = state.academicYear;
            return;
          }
          clearDirty();
          state.academicYear = next;
          loadClasses();
          return;
        }
        state.academicYear = next;
        loadRosterCounts();
      });
    }

    var addBtn = $('cm-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        var yl = $('cm-add-year') && $('cm-add-year').value;
        var code = $('cm-add-code') && $('cm-add-code').value;
        if (addClassLocal(yl, code, code)) {
          if ($('cm-add-code')) $('cm-add-code').value = '';
          if ($('cm-add-code')) $('cm-add-code').focus();
        }
      });
    }
    var addCode = $('cm-add-code');
    if (addCode) {
      addCode.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (addBtn) addBtn.click();
        }
      });
    }

    var saveBtn = $('cm-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', function() { saveForTeacher(); });

    var pushBtn = $('cm-push-btn');
    if (pushBtn) pushBtn.addEventListener('click', openPushModal);
    var pushCancel = $('cm-push-cancel');
    var pushConfirm = $('cm-push-confirm');
    if (pushCancel) pushCancel.addEventListener('click', function() { closeModal('cm-push-modal'); });
    if (pushConfirm) pushConfirm.addEventListener('click', confirmPushToTracker);
    var pushRemove = $('cm-push-remove-missing');
    if (pushRemove) pushRemove.addEventListener('change', refreshPushDiff);

    var pupilAddBtn = $('cm-pupil-add-btn');
    var pupilNameInput = $('cm-pupil-name');
    if (pupilAddBtn) {
      pupilAddBtn.addEventListener('click', function() {
        if (addPupilLocal(pupilNameInput ? pupilNameInput.value : '')) {
          if (pupilNameInput) pupilNameInput.value = '';
        }
      });
    }
    if (pupilNameInput) {
      pupilNameInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (addPupilLocal(pupilNameInput.value)) pupilNameInput.value = '';
        }
      });
      pupilNameInput.addEventListener('paste', function(e) {
        var clip = e.clipboardData || window.clipboardData;
        var text = clip && clip.getData ? clip.getData('text') : '';
        if (!text || !/[\r\n\t]/.test(text)) return;
        e.preventDefault();
        var n = pastePupilNames(text);
        toast(n ? 'Added ' + n + ' pupil' + (n === 1 ? '' : 's') : 'No new names added', n ? 'success' : 'error');
      });
    }

    var pupilPasteBtn = $('cm-pupil-paste-btn');
    var pupilPasteModal = $('cm-pupil-paste-modal');
    if (pupilPasteBtn && pupilPasteModal) {
      pupilPasteBtn.addEventListener('click', function() {
        if (!state.selectedClassKey) {
          toast('Select a class first', 'error');
          return;
        }
        pupilPasteModal.classList.add('open');
        var ta = $('cm-pupil-paste-text');
        if (ta) { ta.value = ''; ta.focus(); }
      });
    }
    var pupilPasteCancel = $('cm-pupil-paste-cancel');
    if (pupilPasteCancel && pupilPasteModal) {
      pupilPasteCancel.addEventListener('click', function() { pupilPasteModal.classList.remove('open'); });
    }
    var pupilPasteApply = $('cm-pupil-paste-apply');
    if (pupilPasteApply && pupilPasteModal) {
      pupilPasteApply.addEventListener('click', function() {
        var ta = $('cm-pupil-paste-text');
        var n = pastePupilNames(ta ? ta.value : '');
        pupilPasteModal.classList.remove('open');
        toast(n ? 'Added ' + n + ' pupil' + (n === 1 ? '' : 's') : 'No new names added', n ? 'success' : 'error');
      });
    }

    var loadTrackerBtn = $('cm-pupil-load-tracker-btn');
    if (loadTrackerBtn) loadTrackerBtn.addEventListener('click', loadPupilsFromTracker);

    var pasteBtn = $('cm-paste-btn');
    var pasteModal = $('cm-paste-modal');
    if (pasteBtn && pasteModal) {
      pasteBtn.addEventListener('click', function() {
        pasteModal.classList.add('open');
        var ta = $('cm-paste-text');
        if (ta) { ta.value = ''; ta.focus(); }
      });
    }
    var pasteCancel = $('cm-paste-cancel');
    if (pasteCancel && pasteModal) {
      pasteCancel.addEventListener('click', function() { pasteModal.classList.remove('open'); });
    }
    var pasteApply = $('cm-paste-apply');
    if (pasteApply && pasteModal) {
      pasteApply.addEventListener('click', function() {
        var ta = $('cm-paste-text');
        var n = parsePasteLines(ta ? ta.value : '');
        pasteModal.classList.remove('open');
        toast(n ? 'Added ' + n + ' class' + (n === 1 ? '' : 'es') : 'No lines added', n ? 'success' : 'error');
      });
    }

    var drop = $('cm-drop');
    var fileInput = $('cm-file');
    if (drop && fileInput) {
      fileInput.addEventListener('change', function() {
        if (fileInput.files && fileInput.files[0]) handleImportFile(fileInput.files[0]);
        fileInput.value = '';
      });
      ['dragenter', 'dragover'].forEach(function(ev) {
        drop.addEventListener(ev, function(e) {
          e.preventDefault();
          drop.classList.add('is-dragover');
        });
      });
      ['dragleave', 'drop'].forEach(function(ev) {
        drop.addEventListener(ev, function(e) {
          e.preventDefault();
          drop.classList.remove('is-dragover');
          if (ev === 'drop' && e.dataTransfer && e.dataTransfer.files[0]) {
            handleImportFile(e.dataTransfer.files[0]);
          }
        });
      });
    }

    var tplCsv = $('cm-template-csv');
    var tplXlsx = $('cm-template-xlsx');
    if (tplCsv) tplCsv.addEventListener('click', function() { downloadTemplate('csv'); });
    if (tplXlsx) tplXlsx.addEventListener('click', function() { downloadTemplate('xlsx'); });

    window.addEventListener('beforeunload', function(e) {
      if (!state.dirty) return;
      e.preventDefault();
      e.returnValue = '';
    });
  }

  function boot() {
    if (isEmbed) {
      var page = $('cm-app');
      if (page) page.classList.add('is-embed');
      var back = $('cm-back-link');
      if (back) back.style.display = 'none';
    }

    function showApp() {
      if (!canManage()) {
        $('cm-denied').style.display = 'block';
        return;
      }
      $('cm-app').style.display = 'block';
      updateSubjectUi();
      wireEvents();
      showOverview();
      Promise.all([loadAcademicYears(), loadTeachers()])
        .then(function() {
          fillModalYearSelects();
          fillImportTeacherSelect();
          return loadOverviewStats();
        })
        .catch(function(err) {
          toast(err.message || 'Could not load', 'error');
        });
    }

    if (window.__authReady) {
      showApp();
      return;
    }
    window.addEventListener('auth-guard-ready', showApp, { once: true });
    setTimeout(function() {
      if (!$('cm-app') || $('cm-app').style.display === 'none') showApp();
    }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
