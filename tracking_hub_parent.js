/**
 * Tracking Hub — Phase 5: read-only parent summary (new window)
 */
(function(global) {
  'use strict';

  var TH = null;

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function openSummary(pupilKey, subject) {
    var pupil = TH.HUB.pupilMap[pupilKey];
    if (!pupil) {
      TH.toast('Pupil not found');
      return;
    }
    var entry = pupil.subjects[subject];
    if (!entry) {
      TH.toast('No data for this subject');
      return;
    }
    var risk = entry.risk || TH.getRiskForPupil(entry.scores);
    var tps = Object.keys(entry.scores || {}).sort(TH.tpSort);
    var dims = TH.dimsForSubject(subject, false);
    var dimRows = TH.DIMS.map(function(d) {
      var v = risk.avgs[d];
      var label = TH.DIM_LABELS[TH.DIMS.indexOf(d)] || d;
      var display = v != null ? v.toFixed(1) : '—';
      var band = global.TrackingHubGrades && v != null
        ? global.TrackingHubGrades.bgeDescriptor(v) : display;
      return '<tr><td>' + esc(label) + '</td><td>' + esc(display) + '</td><td>' + esc(band) + '</td></tr>';
    }).join('');

    var overall = TH.avg(tps.map(function(tp) {
      var row = entry.scores[tp] || {};
      return TH.avg(dims.map(function(d) { return row[d]; }));
    }).filter(function(v) { return v != null; }));

    var pathway = global.TrackingHubGrades
      ? global.TrackingHubGrades.sqaPathwayEstimate(overall, pupil.yg) : '';

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Progress summary — ' +
      esc(pupil.name) + '</title><style>' +
      'body{font-family:Inter,sans-serif;max-width:640px;margin:0 auto;padding:28px;color:#0b1220}' +
      'h1{font-size:20px;margin:0 0 6px}p.meta{color:#64748b;font-size:12px;margin:0 0 20px}' +
      'table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #e2e8f0;padding:8px}' +
      'th{background:#f4f6fb;text-align:left}.note{font-size:11px;color:#64748b;margin-top:20px;line-height:1.5}' +
      '@media print{body{padding:16px}}</style></head><body>' +
      '<h1>' + esc(pupil.name) + '</h1>' +
      '<p class="meta">' + esc(pupil.yg.toUpperCase()) + ' · ' + esc(pupil.cls) + ' · ' +
      esc(subject === 'art' ? 'Art &amp; Design' : 'Drama') + '</p>' +
      '<p><strong>Overall average:</strong> ' + (overall != null ? overall.toFixed(2) : '—') +
      (pathway ? ' · <em>' + esc(pathway) + '</em>' : '') + '</p>' +
      '<table><thead><tr><th>Dimension</th><th>Average</th><th>Descriptor</th></tr></thead><tbody>' +
      dimRows + '</tbody></table>' +
      '<p class="note">This is a read-only summary from the faculty tracking system. ' +
      'Scores use the school 1–4 scale. Contact your child\'s teacher for detail.</p>' +
      '</body></html>';

    var w = global.open('', '_blank', 'noopener');
    if (!w) {
      TH.toast('Allow pop-ups for parent summary');
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  function init(hubApi) {
    TH = hubApi;
    var btn = document.getElementById('profile-drawer-parent');
    if (btn) {
      btn.addEventListener('click', function(ev) {
        ev.preventDefault();
        var state = global.TrackingHubDrawer && global.TrackingHubDrawer.getState
          ? global.TrackingHubDrawer.getState() : {};
        if (state.pupilKey && state.subject) openSummary(state.pupilKey, state.subject);
      });
    }
  }

  global.TrackingHubParent = {
    init: init,
    openSummary: openSummary
  };
})(window);
