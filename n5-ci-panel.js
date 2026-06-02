/**
 * Renders N5 Creative Industries unit accordion rows in faculty-hub (#n5-ci-units-host).
 * Requires n5-ci-curriculum-manifest.js (window.N5_CI_UNITS).
 */
(function () {
  var UNIT_META = {
    ci01: {
      timing: 'Aug–Oct · Wks 1–9',
      nab: 'O1: Creative Industries & sector · O2: Employment investigation · O3: Self-eval #1 & #2',
      assessment: ['Folio evidence', 'Open-book NAB wks 8–9', 'Self-evaluation reviews'],
      focus: 'Research and writing-based — sectors, legal/H&S, employment pathways, job roles.'
    },
    ci02: {
      timing: 'Sep–Oct · Wks 5–9',
      nab: 'O1: Skills audit · O2: Practical development · O3: Evaluation with peer + teacher feedback',
      assessment: ['Assessor observation checklists', 'Practical work evidence', 'Development plan & evaluation'],
      focus: 'Primarily practical — learners develop three skills for a chosen job role.'
    },
    ci03: {
      timing: 'Oct–Dec · Wks 10–17',
      nab: 'O1: Brand concept & team presentations · O2: Content creation · O3: Summative evaluation',
      assessment: ['Go Viral Challenge folio', 'Observation checklists', 'Weekly review logs', 'NAB wk 17'],
      focus: 'Delivered through the Go Viral Challenge — build a social media brand in your sector.'
    },
    ci04: {
      timing: 'Jan–Feb · Wks 19–24',
      nab: 'O1: Team planning · O2: Implementation · O3: Project evaluation · Self-eval #3',
      assessment: ['Group plan', 'Observation checklists (O1 & O2)', 'Written progress review', 'NAB wk 24'],
      focus: 'Capstone team project — planning, implementation, presentation, and evaluation.'
    }
  };

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderSessionTable(lessons) {
    if (!lessons || !lessons.length) return '';
    var rows = lessons.map(function (l) {
      return '<tr><td style="white-space:nowrap;font-weight:600;color:var(--text-muted);width:4rem">S' + esc(l.session || l.id) + '</td><td>' + esc(l.title) + '</td></tr>';
    }).join('');
    return '<table style="width:100%;font-size:.78rem;border-collapse:collapse;margin-top:.5rem">' +
      '<thead><tr><th style="text-align:left;padding:.35rem 0;color:var(--text-muted);font-size:.65rem;text-transform:uppercase;letter-spacing:.06em">Session</th><th style="text-align:left;padding:.35rem 0;color:var(--text-muted);font-size:.65rem;text-transform:uppercase;letter-spacing:.06em">Focus</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>';
  }

  function renderUnit(key, unit) {
    var meta = UNIT_META[key] || {};
    var nabWindow = unit.nabWindow ? '<div class="unit-field-label">NAB window</div><div class="unit-field-content">' + esc(unit.nabWindow) + '</div>' : '';
    var pills = (meta.assessment || []).map(function (a) {
      return '<span class="pill">' + esc(a) + '</span>';
    }).join('');
    return '<div class="unit-row" onclick="toggleUnit(this)">' +
      '<div class="unit-row-header">' +
      '<div class="unit-number" style="border-color:' + esc(unit.colour) + '">' + esc(unit.unitLabel || key) + '</div>' +
      '<div class="unit-title">' + esc(unit.title) + '</div>' +
      '<div class="unit-timing">' + esc(meta.timing || unit.weeks) + '</div>' +
      '<div class="unit-toggle">▸</div></div>' +
      '<div class="unit-body"><div class="unit-body-grid">' +
      '<div><div class="unit-field-label">SQA unit</div><div class="unit-field-content">' + esc(unit.sqaCode || '') + '</div>' +
      nabWindow +
      '<div class="unit-field-label" style="margin-top:.75rem">NAB outcomes</div><div class="unit-field-content">' + esc(meta.nab || '') + '</div>' +
      '<div class="unit-field-label" style="margin-top:.75rem">Delivery focus</div><div class="unit-field-content">' + esc(meta.focus || unit.desc) + '</div></div>' +
      '<div><div class="unit-field-label">Assessment</div><div class="pill-row">' + pills + '</div>' +
      '<div class="pill-row" style="margin-top:.6rem"><span class="n-badge n5">N5 SfW</span></div></div>' +
      '<div style="grid-column:1/-1"><div class="unit-field-label">Sessions (' + (unit.lessons || []).length + ')</div>' +
      renderSessionTable(unit.lessons) + '</div>' +
      '</div></div></div>';
  }

  function renderN5CiUnits() {
    var host = document.getElementById('n5-ci-units-host');
    if (!host || !window.N5_CI_UNITS) return;
    var order = ['ci01', 'ci02', 'ci03', 'ci04'];
    var header = host.querySelector('.units-header');
    var html = order.map(function (key) {
      return window.N5_CI_UNITS[key] ? renderUnit(key, window.N5_CI_UNITS[key]) : '';
    }).join('');
    if (header) {
      header.insertAdjacentHTML('afterend', html);
    } else {
      host.innerHTML = html;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderN5CiUnits);
  } else {
    renderN5CiUnits();
  }
})();
