/**
 * One-column scoring for the Drama / Art BGE trackers.
 * Shows a single score column (e.g. Creating) as a list of pupils with large 1–4 / N/A buttons,
 * so a class can be scored on an iPad without scrolling sideways. Pages supply the data;
 * this file only builds markup and remembers the chosen view on this device.
 */
(function(root) {
  'use strict';

  var DIMS = [
    { d: 'creating', lbl: 'Creating', col: '#7c3aed', group: 'process' },
    { d: 'presenting', lbl: 'Presenting', col: '#0369a1', group: 'process' },
    { d: 'evaluating', lbl: 'Evaluating', col: '#0f766e', group: 'process' },
    { d: 'effort', lbl: 'Effort', col: '#92400e', group: 'attitude' },
    { d: 'behaviour', lbl: 'Behaviour', col: '#be185d', group: 'attitude' },
    { d: 'homelearning', lbl: 'Home Learning', col: '#b45309', group: 'attitude' }
  ];
  var MODE_KEY = 'tracker-score-view';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function jsq(s) { return esc(String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")); }
  function dimInfo(d) { return DIMS.filter(function(x) { return x.d === d; })[0] || DIMS[0]; }
  function isScored(v) { return v !== undefined && v !== null; }

  /** 'column' or 'table'. Defaults to one column on iPad and narrow screens. */
  function getMode() {
    try {
      var saved = localStorage.getItem(MODE_KEY);
      if (saved === 'column' || saved === 'table') return saved;
    } catch (e) { /* storage blocked: use the default */ }
    var ipad = document.documentElement.dataset.ipad;
    return ipad || root.innerWidth < 1100 ? 'column' : 'table';
  }
  function setMode(mode) {
    try { localStorage.setItem(MODE_KEY, mode); } catch (e) { /* storage blocked: applies to this visit only */ }
  }

  function switchHTML(yg, mode) {
    function btn(m, label) {
      return '<button type="button" class="sv-btn' + (mode === m ? ' active' : '') + '" aria-pressed="' + (mode === m) +
        '" onclick="setScoreView(\'' + yg + '\',\'' + m + '\')">' + label + '</button>';
    }
    return '<div class="sv-switch" role="group" aria-label="Score view">' + btn('column', 'One column') + btn('table', 'All columns') + '</div>';
  }

  function counts(pupils, dim, getCell) {
    var done = 0;
    pupils.forEach(function(p) { if (isScored(getCell(p.id, dim).value)) done++; });
    return { done: done, total: pupils.length };
  }

  function chipsHTML(o) {
    var html = '';
    DIMS.forEach(function(x, i) {
      if (i === 3) html += '<span class="col-dims-gap" aria-hidden="true"></span>';
      var c = counts(o.pupils, x.d, o.getCell);
      var complete = c.total && c.done === c.total;
      html += '<button type="button" class="col-dim' + (x.d === o.dim ? ' active' : '') + (complete ? ' complete' : '') +
        '" style="--dim:' + x.col + '" data-dim="' + x.d + '" aria-pressed="' + (x.d === o.dim) +
        '" onclick="setColDim(\'' + o.yg + '\',\'' + x.d + '\')"><span class="col-dim-lbl">' + x.lbl +
        '</span><span class="col-dim-count">' + c.done + '/' + c.total + '</span></button>';
    });
    return '<div class="col-dims">' + html + '</div>';
  }

  function rowHTML(o, p) {
    var cell = o.getCell(p.id, o.dim);
    var v = cell.value;
    var note = o.getNote(p.id) || '';
    var call = 'setScore(\'' + o.yg + '\',\'' + jsq(p.id) + '\',\'' + o.tpId + '\',\'' + o.dim + '\',';
    var btns = [1, 2, 3, 4].map(function(n) {
      return '<button type="button" class="sc-btn s' + n + (v === n ? ' active' : '') + '" aria-label="' + n + '" onclick="' + call + n + ',this)">' + n + '</button>';
    }).join('') + '<button type="button" class="na-btn' + (v === 0 ? ' active' : '') + '" onclick="' + call + '0,this)" title="Not assessed this unit">N/A</button>';
    return '<div class="col-row' + (isScored(v) ? '' : ' is-empty') + '" data-pid="' + esc(p.id) + '">' +
      '<div class="col-name"><span class="col-pupil">' + esc(p.name) + '</span>' +
      (o.showClass ? '<span class="col-cls">' + esc(p.cls) + '</span>' : '') +
      (cell.isDefault ? '<span class="col-default" title="Starting score, not yet changed">Default</span>' : '') + '</div>' +
      '<div class="col-score sc-group" data-score-cell>' + btns + '</div>' +
      '<button type="button" class="col-note-btn' + (note ? ' has-note' : '') + '" aria-expanded="false" onclick="toggleColNote(this)">Note</button>' +
      '<div class="col-note" hidden><textarea class="notes-inp" rows="2" placeholder="Note for this unit…" oninput="setNote(\'' + o.yg + '\',\'' + jsq(p.id) + '\',\'' + o.tpId + '\',this.value);this.closest(\'.col-row\').querySelector(\'.col-note-btn\').classList.toggle(\'has-note\',!!this.value)">' + esc(note) + '</textarea></div>' +
      '</div>';
  }

  function footerHTML(o) {
    var idx = DIMS.map(function(x) { return x.d; }).indexOf(o.dim);
    var c = counts(o.pupils, o.dim, o.getCell);
    var left = c.total - c.done;
    var next = DIMS[idx + 1];
    var msg = left ? left + ' still to score in ' + dimInfo(o.dim).lbl + '.' : 'Everyone has a ' + dimInfo(o.dim).lbl + ' score.';
    return '<div class="col-foot"><span class="col-foot-msg">' + msg + '</span>' +
      (next ? '<button type="button" class="btn btn-primary" onclick="setColDim(\'' + o.yg + '\',\'' + next.d + '\',true)">Next: ' + next.lbl + '</button>' : '') + '</div>';
  }

  /**
   * o: { yg, tpId, dim, pupils:[{id,name,cls}], showClass, getCell(pid,dim)->{value,isDefault}, getNote(pid) }
   */
  function render(o) {
    var info = dimInfo(o.dim);
    return '<div class="col-view" style="--dim:' + info.col + '">' + chipsHTML(o) +
      '<div class="col-list" aria-label="' + esc(info.lbl) + ' scores">' + o.pupils.map(function(p) { return rowHTML(o, p); }).join('') + '</div>' +
      footerHTML(o) + '</div>';
  }

  /** After one score changes: update that row and the column counts without redrawing the list. */
  function refresh(container, o) {
    if (!container) return;
    var chips = container.querySelector('.col-dims');
    if (chips) chips.outerHTML = chipsHTML(o);
    var foot = container.querySelector('.col-foot');
    if (foot) foot.outerHTML = footerHTML(o);
    o.pupils.forEach(function(p) {
      var row = container.querySelector('.col-row[data-pid="' + (root.CSS && CSS.escape ? CSS.escape(p.id) : p.id) + '"]');
      if (!row) return;
      var cell = o.getCell(p.id, o.dim);
      row.classList.toggle('is-empty', !isScored(cell.value));
      var tag = row.querySelector('.col-default');
      if (tag && !cell.isDefault) tag.remove();
    });
  }

  root.TrackerColumnView = {
    DIMS: DIMS,
    getMode: getMode,
    setMode: setMode,
    switchHTML: switchHTML,
    render: render,
    refresh: refresh
  };
})(window);
