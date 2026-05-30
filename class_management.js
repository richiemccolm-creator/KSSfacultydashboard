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
    loading: false,
    tab: 'roster',
    trackerRows: [],
    trackerLoaded: false,
    wizardRow: null
  };

  function $(id) { return document.getElementById(id); }

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
      wrap.style.display = '';
      link.href = trackerViewUrl(t);
      link.textContent = 'View ' + subjectLabel() + ' tracker (read-only)';
    } else {
      wrap.style.display = 'none';
    }
  }

  function renderTable() {
    var body = $('cm-table-body');
    var countEl = $('cm-class-count');
    if (!body) return;
    var rows = state.classes.slice().sort(function(a, b) {
      return (a.year_level - b.year_level) || String(a.class_code).localeCompare(String(b.class_code));
    });
    if (countEl) {
      countEl.textContent = rows.length + ' class' + (rows.length === 1 ? '' : 'es');
    }
    if (!state.selectedTeacherId) {
      body.innerHTML = '<tr><td colspan="4" class="cm-empty">Select a teacher to view or add classes.</td></tr>';
      return;
    }
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="4" class="cm-empty">No classes yet — add one above or paste a list, then Save.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function(c) {
      return '<tr class="row-' + state.subject + '">' +
        '<td>S' + c.year_level + '</td>' +
        '<td><code>' + escHtml(c.class_code) + '</code></td>' +
        '<td>' + escHtml(c.class_name) + '</td>' +
        '<td><button type="button" class="btn btn-ghost cm-row-del" data-year="' + c.year_level + '" data-code="' + escAttr(c.class_code) + '" aria-label="Remove class">Remove</button></td>' +
        '</tr>';
    }).join('');

    body.querySelectorAll('.cm-row-del').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var yl = parseInt(btn.getAttribute('data-year'), 10);
        var code = btn.getAttribute('data-code') || '';
        state.classes = state.classes.filter(function(c) {
          return !(c.year_level === yl && c.class_code === code);
        });
        renderTable();
      });
    });
  }

  function loadClasses() {
    if (!state.selectedTeacherId || !state.academicYear || !window.DataService) {
      state.classes = [];
      renderTable();
      return Promise.resolve();
    }
    state.loading = true;
    return DataService.listTeacherSubjectClassesForLoader({
      teacherId: state.selectedTeacherId,
      subject: state.subject,
      academicYearLabel: state.academicYear
    }).then(function(rows) {
      state.classes = (rows || []).map(function(r) {
        return {
          class_id: r.class_id,
          year_level: Number(r.year_level) || parseYearLevel(r.year_level_label),
          class_code: String(r.class_code || '').trim(),
          class_name: String(r.class_name || r.class_code || '').trim()
        };
      }).filter(function(c) { return c.class_code && c.year_level; });
      renderTable();
    }).catch(function(err) {
      toast('Could not load classes: ' + (err.message || err), 'error');
      state.classes = [];
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
      if (!sel) return;
      if (!state.teachers.length) {
        sel.innerHTML = '<option value="">No teachers found — staff must sign in once</option>';
        return;
      }
      sel.innerHTML = '<option value="">Select a teacher…</option>' +
        state.teachers.map(function(t) {
          var label = (t.display_name || t.email || 'Staff').trim();
          if (t.email && label.toLowerCase() !== String(t.email).toLowerCase()) {
            label += ' (' + t.email + ')';
          }
          return '<option value="' + escHtml(t.teacher_id) + '">' + escHtml(label) + '</option>';
        }).join('');
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

  function addClassLocal(yearLevel, code, name) {
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
      toast('Class already in the list', 'error');
      return false;
    }
    state.classes.push({ year_level: yl, class_code: code, class_name: name });
    renderTable();
    return true;
  }

  function saveForTeacher() {
    if (!state.selectedTeacherId) {
      toast('Select a teacher first', 'error');
      return Promise.resolve();
    }
    if (!window.DataService || typeof DataService.upsertTeacherSubjectClassesForLoader !== 'function') {
      toast('Sign in with cloud access to save', 'error');
      return Promise.resolve();
    }
    var payload = state.classes.map(function(c) {
      return {
        year_level: 'S' + c.year_level,
        class_code: c.class_code,
        class_name: c.class_name || c.class_code
      };
    });
    var btn = $('cm-save-btn');
    if (btn) btn.disabled = true;
    return DataService.upsertTeacherSubjectClassesForLoader({
      teacherId: state.selectedTeacherId,
      subject: state.subject,
      academicYearLabel: state.academicYear,
      classes: payload,
      replaceExisting: true
    }).then(function(result) {
      var inserted = result && result.inserted_classes ? result.inserted_classes : 0;
      var assigned = result && result.assigned_classes ? result.assigned_classes : 0;
      var skipped = result && result.skipped_rows ? result.skipped_rows : 0;
      var msg = 'Saved ' + payload.length + ' class' + (payload.length === 1 ? '' : 'es') + ' for ' + (selectedTeacher().display_name || 'teacher');
      if (inserted || assigned) msg += ' (' + (inserted + assigned) + ' updated in roster)';
      if (skipped) msg += ' — ' + skipped + ' skipped';
      toast(msg, 'success');
      return loadClasses();
    }).catch(function(err) {
      toast('Save failed: ' + (err.message || err), 'error');
    }).finally(function() {
      if (btn) btn.disabled = false;
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

  function normalizeImportRow(row, teacherEmail) {
    var subj = normalizeSubject(row.subject) || state.subject;
    if (subj !== state.subject) return null;
    var yl = parseYearLevel(row.year_level || row.year || row.year_group);
    var code = String(row.class_code || row.class || '').trim();
    var cname = String(row.class_name || row.classname || code).trim();
    if (!yl || !code) return null;
    var out = {
      subject: subj,
      year_level: 'S' + yl,
      class_code: code,
      class_name: cname,
      teacher_email: String(row.teacher_email || teacherEmail || '').trim().toLowerCase()
    };
    var pupil = String(row.pupil_name || row.pupil || '').trim();
    if (pupil) {
      var names = splitPupilName(pupil);
      out.first_name = names.first_name;
      out.last_name = names.last_name;
    }
    return out;
  }

  function handleImportFile(file) {
    if (!file) return;
    if (!state.selectedTeacherId) {
      toast('Select a teacher before importing', 'error');
      return;
    }
    var teacher = selectedTeacher();
    var email = (teacher && teacher.email) ? String(teacher.email).toLowerCase() : '';

    parseFileRows(file).then(function(rawRows) {
      var classRows = [];
      var pupilRows = [];
      rawRows.forEach(function(row) {
        var norm = normalizeImportRow(row, email);
        if (!norm) return;
        classRows.push(norm);
        if (norm.first_name && norm.last_name) pupilRows.push(norm);
      });
      if (!classRows.length) {
        toast('No valid rows for ' + subjectLabel(), 'error');
        return;
      }
      classRows.forEach(function(r) {
        addClassLocal(r.year_level, r.class_code, r.class_name);
      });
      if (pupilRows.length && window.DataService && typeof DataService.bulkUpsertPupilsAndEnrollments === 'function') {
        return DataService.bulkUpsertPupilsAndEnrollments({
          rows: pupilRows,
          academicYearLabel: state.academicYear,
          mode: 'add_only',
          overrideConflicts: false
        }).then(function(res) {
          var enrolled = res && res.inserted_enrollments ? res.inserted_enrollments : 0;
          toast('Imported ' + classRows.length + ' classes' + (enrolled ? ', ' + enrolled + ' pupil enrollments' : '') + ' — click Save to confirm class list', 'success');
          return saveForTeacher();
        });
      }
      toast('Imported ' + classRows.length + ' classes into the list — review and Save', 'success');
    }).catch(function(err) {
      toast('Import failed: ' + (err.message || err), 'error');
    });
  }

  function downloadTemplate(format) {
    var headers = ['subject', 'year_level', 'class_code', 'class_name', 'teacher_email', 'pupil_name'];
    var sample = [
      [state.subject, 'S1', '1A1', '1A1', 'teacher@school.gla.ac.uk', ''],
      [state.subject, 'S1', '1A2', '1A2', 'teacher@school.gla.ac.uk', 'Jamie Smith']
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

  function openTransferModal(row) {
    state.wizardRow = row;
    var modal = $('cm-transfer-modal');
    var desc = $('cm-transfer-desc');
    if (desc) {
      desc.textContent = 'Move “' + row.className + '” (' + row.yearGroup.toUpperCase() + ' ' +
        (row.subject === 'drama' ? 'Drama' : 'Art') + ', ' + row.pupilCount + ' pupils) from ' +
        row.teacherName + ' to another teacher. Tracking data is copied like a handover export.';
    }
    fillTeacherSelect('cm-transfer-to', row.userId);
    var clsInp = $('cm-transfer-cls');
    if (clsInp) clsInp.value = row.className;
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
        ' to ' + (nextYg || '').toUpperCase() + ' for a teacher. Prior-year scores can be stored as a snapshot on each pupil profile.';
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
      academicYearLabel: year
    }).then(function(res) {
      toast('Transferred ' + res.pupilCount + ' pupils to new teacher', 'success');
      closeModal('cm-transfer-modal');
      loadTrackerClasses();
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
    var year = ($('cm-promote-year-roster') && $('cm-promote-year-roster').value) || state.academicYear;
    if (!toYg) { toast('Invalid promote target year', 'error'); return; }
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
      academicYearLabel: year
    }).then(function(res) {
      toast('Promoted ' + res.pupilCount + ' pupils to ' + res.toClassName + ' (' + res.toYearGroup.toUpperCase() + ')', 'success');
      closeModal('cm-promote-modal');
      loadTrackerClasses();
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

    var teacherSel = $('cm-teacher');
    if (teacherSel) {
      teacherSel.addEventListener('change', function() {
        state.selectedTeacherId = teacherSel.value || '';
        updateTrackerLink();
        loadClasses();
      });
    }

    ['cm-subj-art', 'cm-subj-drama'].forEach(function(id) {
      var btn = $(id);
      if (!btn) return;
      btn.addEventListener('click', function() {
        state.subject = btn.getAttribute('data-subject') || 'art';
        updateSubjectUi();
        updateTrackerLink();
        loadClasses();
      });
    });

    var yearSel = $('cm-year-label');
    if (yearSel) {
      yearSel.addEventListener('change', function() {
        state.academicYear = yearSel.value;
        loadClasses();
      });
    }

    var addBtn = $('cm-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        var yl = $('cm-add-year') && $('cm-add-year').value;
        var code = $('cm-add-code') && $('cm-add-code').value;
        var name = $('cm-add-name') && $('cm-add-name').value;
        if (addClassLocal(yl, code, name)) {
          if ($('cm-add-code')) $('cm-add-code').value = '';
          if ($('cm-add-name')) $('cm-add-name').value = '';
          if ($('cm-add-code')) $('cm-add-code').focus();
        }
      });
    }

    var saveBtn = $('cm-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', function() { saveForTeacher(); });

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
      drop.addEventListener('click', function() { fileInput.click(); });
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
  }

  function boot() {
    if (isEmbed) {
      var page = $('cm-app');
      if (page) page.classList.add('is-embed');
      var back = $('cm-back-link');
      if (back) back.style.display = 'none';
      var header = $('cm-top-header');
      if (header) header.querySelector('h1').textContent = 'Class Management';
    }

    function showApp() {
      if (!canManage()) {
        $('cm-denied').style.display = 'block';
        return;
      }
      $('cm-app').style.display = 'block';
      updateSubjectUi();
      wireEvents();
      Promise.all([loadAcademicYears(), loadTeachers()])
        .then(function() {
          fillModalYearSelects();
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
