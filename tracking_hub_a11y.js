/**
 * Tracking Hub — Phase 4: accessibility helpers (sr-only chart tables, keyboard)
 */
(function(global) {
  'use strict';

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function mountSrTable(containerId, caption, headers, rows) {
    var wrap = document.getElementById(containerId);
    if (!wrap) return;
    var old = wrap.querySelector('.sr-only-table');
    if (old) old.remove();
    var html = '<table class="sr-only sr-only-table"><caption>' + esc(caption) + '</caption><thead><tr>' +
      headers.map(function(h) { return '<th scope="col">' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      (rows || []).map(function(row) {
        return '<tr>' + row.map(function(cell) { return '<td>' + esc(cell) + '</td>'; }).join('') + '</tr>';
      }).join('') +
      '</tbody></table>';
    wrap.insertAdjacentHTML('beforeend', html);
  }

  function scoreTrendTable(labels, artData, dramaData) {
    mountSrTable('chart-score-trend-wrap', 'Average score by tracking point',
      ['Tracking point', 'Art average', 'Drama average'],
      labels.map(function(lbl, i) {
        return [
          lbl,
          artData[i] != null ? Number(artData[i]).toFixed(2) : '—',
          dramaData[i] != null ? Number(dramaData[i]).toFixed(2) : '—'
        ];
      }));
  }

  function radarTable(dimLabels, artAvgs, dramaAvgs) {
    mountSrTable('chart-dimension-radar-wrap', 'Dimension profile averages',
      ['Dimension', 'Art', 'Drama'],
      dimLabels.map(function(lbl, i) {
        return [
          lbl,
          artAvgs[i] != null ? Number(artAvgs[i]).toFixed(2) : '—',
          dramaAvgs[i] != null ? Number(dramaAvgs[i]).toFixed(2) : '—'
        ];
      }));
  }

  function donutTable(segments) {
    mountSrTable('chart-risk-donut-wrap', 'Risk breakdown pupil counts',
      ['Band', 'Count'],
      (segments || []).map(function(s) { return [s.label, String(s.count)]; }));
  }

  function makeKeyboardActivatable(root, selector, onActivate) {
    if (!root) return;
    root.addEventListener('keydown', function(ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var el = ev.target.closest(selector);
      if (!el || !root.contains(el)) return;
      ev.preventDefault();
      onActivate(el, ev);
    });
  }

  global.TrackingHubA11y = {
    scoreTrendTable: scoreTrendTable,
    radarTable: radarTable,
    donutTable: donutTable,
    makeKeyboardActivatable: makeKeyboardActivatable,
    mountSrTable: mountSrTable
  };
})(window);
