/**
 * Tracking Hub — Phase 5: at-risk digest (export + print preview)
 */
(function(global) {
  'use strict';

  var TH = null;

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildDigestGroups() {
    var rollups = [];
    if (global.TrackingHubTabs && global.TrackingHubTabs.buildPupilSubjectRollups) {
      rollups = global.TrackingHubTabs.buildPupilSubjectRollups(TH.HUB.filteredRows)
        .filter(function(p) { return p.risk && p.risk.isAtRisk; });
    }
    var byTeacher = {};
    rollups.forEach(function(p) {
      var t = p.teacher || 'Unknown';
      if (!byTeacher[t]) byTeacher[t] = [];
      byTeacher[t].push(p);
    });
    return Object.keys(byTeacher).sort().map(function(teacher) {
      var list = byTeacher[teacher].sort(function(a, b) {
        return (b.risk.lowCount - a.risk.lowCount) || a.name.localeCompare(b.name);
      });
      return { teacher: teacher, pupils: list };
    });
  }

  function digestHtml() {
    var groups = buildDigestGroups();
    var session = global.TrackingHubSnapshot
      ? global.TrackingHubSnapshot.currentSessionLabel() : '';
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>At-risk digest</title>' +
      '<style>body{font-family:Inter,sans-serif;padding:24px;color:#0b1220;font-size:12px}' +
      'h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;margin:20px 0 8px;color:#1e2d4a}' +
      'table{width:100%;border-collapse:collapse;margin-bottom:12px}th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}' +
      'th{background:#f4f6fb;font-size:10px;text-transform:uppercase} .meta{color:#64748b;font-size:11px}</style></head><body>' +
      '<h1>At-risk pupil digest</h1>' +
      '<p class="meta">Session ' + esc(session) + ' · Generated ' + esc(new Date().toLocaleString()) +
      ' · ' + groups.reduce(function(n, g) { return n + g.pupils.length; }, 0) + ' pupil entries</p>';
    if (!groups.length) {
      html += '<p>No at-risk pupils for current filters.</p>';
    } else {
      groups.forEach(function(g) {
        html += '<h2>' + esc(g.teacher) + ' (' + g.pupils.length + ')</h2><table><thead><tr>' +
          '<th>Pupil</th><th>Class</th><th>Subject</th><th>Severity</th><th>Low dims</th><th>Band</th></tr></thead><tbody>';
        g.pupils.forEach(function(p) {
          var avg = TH.avg(Object.keys(p.tpScores || {}).map(function(tp) { return p.tpScores[tp]; }));
          var band = global.TrackingHubGrades ? global.TrackingHubGrades.bgeShort(avg) : '—';
          html += '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.yg.toUpperCase() + ' ' + p.cls) +
            '</td><td>' + esc(p.subject) + '</td><td>' + esc(p.risk.severity || 'low') +
            '</td><td>' + (p.risk.lowCount || 0) + '</td><td>' + esc(band) + '</td></tr>';
        });
        html += '</tbody></table>';
      });
    }
    html += '</body></html>';
    return html;
  }

  function exportCsv() {
    var groups = buildDigestGroups();
    var headers = ['teacher', 'pupil', 'year', 'class', 'subject', 'severity', 'low_dimensions', 'band'];
    var rows = [headers.join(',')];
    groups.forEach(function(g) {
      g.pupils.forEach(function(p) {
        var avg = TH.avg(Object.keys(p.tpScores || {}).map(function(tp) { return p.tpScores[tp]; }));
        var band = global.TrackingHubGrades ? global.TrackingHubGrades.bgeShort(avg) : '';
        rows.push([
          g.teacher, p.name, p.yg, p.cls, p.subject, p.risk.severity || 'low', p.risk.lowCount || 0, band
        ].map(function(v) {
          var txt = String(v == null ? '' : v).replace(/"/g, '""');
          return '"' + txt + '"';
        }).join(','));
      });
    });
    var blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tracking-at-risk-digest.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    TH.toast('Digest CSV exported');
  }

  function printDigest() {
    var w = global.open('', '_blank', 'noopener');
    if (!w) {
      TH.toast('Allow pop-ups to print digest');
      return;
    }
    w.document.write(digestHtml());
    w.document.close();
    w.focus();
    setTimeout(function() { w.print(); }, 300);
  }

  function bindEvents() {
    var csvBtn = document.getElementById('th-digest-export');
    var printBtn = document.getElementById('th-digest-print');
    if (csvBtn) csvBtn.addEventListener('click', exportCsv);
    if (printBtn) printBtn.addEventListener('click', printDigest);
  }

  function init(hubApi) {
    TH = hubApi;
    bindEvents();
  }

  global.TrackingHubDigest = {
    init: init,
    exportCsv: exportCsv,
    printDigest: printDigest,
    buildDigestGroups: buildDigestGroups
  };
})(window);
