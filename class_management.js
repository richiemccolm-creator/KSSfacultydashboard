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
    loading: false
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

  function wireEvents() {
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
          toast('Select a teacher to set up their classes', '');
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
