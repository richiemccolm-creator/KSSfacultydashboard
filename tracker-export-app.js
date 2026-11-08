/**
 * Faculty tracking export page: admin only. Reads every tracker, shows what was found, then builds
 * one Excel file in this browser. Nothing is sent anywhere or kept on this device; the file exists
 * only where the admin saves it. Row level security still decides what the account can read.
 */
/* global TrackerExportCore, TrackerExportXlsx, CI_ASSESS_UNITS, CiAssessCore, SptExport */
(function() {
  'use strict';

  var PAGE_SIZE = 1000;
  var TRACKER_TYPES = ['drama-v3', 'art-v2', 'npa-v1', 'bge_drama_reports_v1', 'bge_art_reports_v1'];
  // [table, friendly name, columns to sort by so pages never overlap]
  var TABLES = [
    ['profiles', 'Staff names', ['id']],
    ['pupil_data', 'Drama, Art, NPA and Report Builder', ['id']],
    ['ci_assess_settings', 'Creative Industries settings', ['school_year']],
    ['ci_assess_pupils', 'Creative Industries pupils', ['id']],
    ['ci_assess_marks', 'Creative Industries decisions', ['pupil_id', 'code']],
    ['ci_assess_followups', 'Creative Industries follow-ups', ['id']],
    ['senior_phase_workbook', 'Senior Phase', ['id']],
    ['spt_attainment_review_cycles', 'Attainment reviews', ['id']],
    ['spt_attainment_class_reviews', 'Attainment class reviews', ['id']],
    ['spt_attainment_pupil_reviews', 'Attainment pupil reviews', ['id']],
    ['spt_attainment_actions', 'Attainment actions', ['id']],
    ['qs_attainment_snapshots', 'QS Attainment', ['id']],
    ['academic_years', 'Class lists (sessions)', ['id']],
    ['classes', 'Class lists (classes)', ['id']],
    ['pupils', 'Class lists (pupils)', ['id']],
    ['class_enrollments', 'Class lists (pupils in classes)', ['id']],
    ['class_teacher_assignments', 'Class lists (teachers)', ['id']],
    ['tracking_hub_annotations', 'Tracking hub notes', ['id']]
  ];

  var root = document.getElementById('trackerExportRoot');
  var built = null;

  function el(tag, props, children) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function(k) {
      if (k === 'class') node.className = props[k];
      else if (k === 'text') node.textContent = props[k];
      else if (k === 'onclick') node.addEventListener('click', props[k]);
      else if (props[k] !== false && props[k] != null) node.setAttribute(k, props[k]);
    });
    (children || []).forEach(function(child) { if (child) node.appendChild(child); });
    return node;
  }

  function show(nodes) {
    root.textContent = '';
    nodes.forEach(function(n) { if (n) root.appendChild(n); });
  }

  function fetchAll(table, order) {
    var rows = [];
    function page(from) {
      var query = window.supabase.from(table).select(
        table === 'pupil_data' ? 'id, user_id, data_type, data' : '*'
      );
      if (table === 'pupil_data') query = query.in('data_type', TRACKER_TYPES);
      order.forEach(function(c) { query = query.order(c, { ascending: true }); });
      return query.range(from, from + PAGE_SIZE - 1).then(function(res) {
        if (res.error) throw res.error;
        var got = res.data || [];
        rows = rows.concat(got);
        // Keep going until a page is empty, as the server may cap pages below PAGE_SIZE.
        return got.length ? page(from + got.length) : rows;
      });
    }
    return page(0);
  }

  function loadEverything(onProgress) {
    var tables = {};
    var errors = {};
    var done = 0;
    return Promise.all(TABLES.map(function(spec) {
      return fetchAll(spec[0], spec[2]).then(function(rows) {
        tables[spec[0]] = rows;
      }).catch(function(err) {
        tables[spec[0]] = [];
        errors[spec[1]] = (err && err.message) || 'unknown error';
      }).then(function() {
        done++;
        onProgress(done, TABLES.length);
      });
    })).then(function() {
      return { tables: tables, errors: errors };
    });
  }

  function fileName() {
    return 'Faculty_Tracking_Export_' + new Date().toISOString().slice(0, 10) + '.xlsx';
  }

  function download() {
    var bytes = TrackerExportXlsx.build(built.sheets);
    var blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: fileName() });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function() { URL.revokeObjectURL(url); }, 10000);
    var note = document.getElementById('teDownloaded');
    if (note) {
      note.hidden = false;
      note.textContent = 'Downloaded ' + fileName() + '. Move it to approved school storage now, then remove it from Downloads.';
    }
  }

  function renderIntro() {
    show([
      el('p', { class: 'te-lede', text: 'Reads every tracker for every teacher and builds one Excel file: Drama, Art, NPA Photography and Art, Creative Industries, Senior Phase, QS Attainment, Report Builder, class lists and tracking notes.' }),
      el('div', { class: 'te-card te-warn' }, [
        el('strong', { text: 'This file will contain named pupil data for the whole faculty.' }),
        el('p', { text: 'Save it to approved school storage only, not a personal device, USB stick or personal email. Nothing is changed or deleted in the Hub.' })
      ]),
      el('button', { type: 'button', class: 'te-btn', id: 'tePrepare', text: 'Read all trackers', onclick: prepare })
    ]);
  }

  function prepare() {
    var progress = el('p', { class: 'te-lede', role: 'status', text: 'Reading trackers…' });
    show([progress]);
    window.supabase.auth.getSession().then(function(r) {
      var email = (r.data && r.data.session && r.data.session.user && r.data.session.user.email) || '';
      return loadEverything(function(done, total) {
        progress.textContent = 'Reading trackers… ' + done + ' of ' + total;
      }).then(function(result) {
        var source = TrackerExportCore.assembleSource(result.tables, result.errors, email, new Date());
        built = TrackerExportCore.buildWorkbook(source, {
          tps: window.CURRICULUM_TPS,
          units: CI_ASSESS_UNITS,
          ciCore: CiAssessCore,
          senior: SptExport
        });
        renderResult(result);
      });
    }).catch(function(err) {
      show([
        el('div', { class: 'te-card te-bad' }, [
          el('strong', { text: 'The export could not be prepared.' }),
          el('p', { text: (err && err.message) || 'Please try again.' })
        ]),
        el('button', { type: 'button', class: 'te-btn', text: 'Try again', onclick: prepare })
      ]);
    });
  }

  function renderResult(result) {
    var lines = built.summary.lines;
    var teacherCount = built.summary.teachers.length;
    var profiles = result.tables.profiles.length;
    var warnings = built.problems.slice();
    if (teacherCount <= 1 && profiles !== 1) {
      warnings.unshift('Only ' + (teacherCount === 1 ? "one teacher's" : 'no') + ' tracker data came back. This account may not be able to read all staff data, so check is_admin is true for it in allowed_emails before relying on this file.');
    }
    var table = el('table', { class: 'te-table' }, [
      el('thead', {}, [el('tr', {}, [
        el('th', { scope: 'col', text: 'Tracker' }),
        el('th', { scope: 'col', class: 'te-num', text: 'Teachers' }),
        el('th', { scope: 'col', class: 'te-num', text: 'Pupils or records' })
      ])]),
      el('tbody', {}, lines.map(function(line) {
        return el('tr', {}, [
          el('td', { text: line.source }),
          el('td', { class: 'te-num', text: line.teachers ? String(line.teachers) : '' }),
          el('td', { class: 'te-num', text: String(line.records) })
        ]);
      }))
    ]);
    show([
      warnings.length
        ? el('div', { class: 'te-card te-bad', role: 'alert' }, [
          el('strong', { text: 'Check these before relying on this file' }),
          el('ul', {}, warnings.map(function(w) { return el('li', { text: w }); }))
        ])
        : el('div', { class: 'te-card te-good', role: 'status' }, [
          el('strong', { text: 'All trackers read, and every pupil counted reached the file.' })
        ]),
      lines.length ? table : el('p', { class: 'te-lede', text: 'No tracking data was found.' }),
      el('p', { class: 'te-lede', text: teacherCount + (teacherCount === 1 ? ' teacher' : ' teachers') + ' and ' + built.summary.tabs + ' data tabs, plus Read me and Check tabs. Ask staff to open their trackers and see "Saved" first, as unsaved work on a device is not included.' }),
      el('button', { type: 'button', class: 'te-btn', id: 'teDownload', text: 'Download Excel file', onclick: download, disabled: built.summary.tabs ? false : 'disabled' }),
      el('p', { class: 'te-done', id: 'teDownloaded', role: 'status', hidden: 'hidden' })
    ]);
  }

  function start() {
    if (!window.__authGuardIsAdmin) {
      show([el('div', { class: 'te-card te-bad' }, [
        el('strong', { text: 'Admin only' }),
        el('p', { text: 'Only a Faculty Hub admin can export all tracking data.' })
      ])]);
      return;
    }
    renderIntro();
  }

  if (window.__authReady) start();
  else window.addEventListener('auth-guard-ready', start);
})();
