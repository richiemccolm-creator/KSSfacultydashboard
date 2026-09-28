/**
 * Keyboard scoring for the Drama / Art BGE trackers, in both the table and one-column views.
 *   1–4        score, then move to the next pupil
 *   0 or N     N/A, then move to the next pupil
 *   Delete     clear the score
 *   ↑ ↓        previous / next pupil        ← →   previous / next column
 * Score cells are marked data-score-cell with data-pid and data-dim, inside #panel-tracker-<yg>.
 * Only one cell per list is in the Tab order, so Tab moves past the list in one step.
 */
(function(root) {
  'use strict';

  var cfg = null;
  var last = {}; // yg -> { pid, dim } the cell to return to after a redraw

  function cellsIn(panel) { return Array.prototype.slice.call(panel.querySelectorAll('[data-score-cell][data-pid]')); }
  function ygOf(panel) { var m = /^panel-tracker-(s\d)$/.exec(panel.id || ''); return m ? m[1] : null; }
  function sel(v) { return root.CSS && CSS.escape ? CSS.escape(v) : String(v).replace(/"/g, '\\"'); }
  function findCell(panel, pid, dim) {
    return panel.querySelector('[data-score-cell][data-pid="' + sel(pid) + '"][data-dim="' + sel(dim) + '"]');
  }

  function makeCurrent(panel, cell) {
    cellsIn(panel).forEach(function(c) { c.tabIndex = c === cell ? 0 : -1; });
    var yg = ygOf(panel);
    if (yg) last[yg] = { pid: cell.dataset.pid, dim: cell.dataset.dim };
  }
  function focusCell(panel, cell) {
    if (!cell) return false;
    makeCurrent(panel, cell);
    cell.focus();
    return true;
  }

  /** Call after the score list is drawn: one cell in the Tab order, the last-used one if still there. */
  function prepare(panel) {
    if (!panel) return;
    var cells = cellsIn(panel);
    if (!cells.length) return;
    cells.forEach(function(c) {
      c.tabIndex = -1;
      Array.prototype.forEach.call(c.querySelectorAll('button'), function(b) { b.tabIndex = -1; });
    });
    var yg = ygOf(panel);
    var prev = yg && last[yg] ? findCell(panel, last[yg].pid, last[yg].dim) : null;
    (prev || cells[0]).tabIndex = 0;
  }

  // Rows in screen order; each row holds one cell per column shown.
  function rowOf(cell) { return cell.closest('tr[data-pid], .col-row[data-pid]'); }
  function rows(panel) { return Array.prototype.slice.call(panel.querySelectorAll('tr[data-pid], .col-row[data-pid]')); }

  function moveVertical(panel, cell, step) {
    var all = rows(panel);
    var i = all.indexOf(rowOf(cell)) + step;
    while (i >= 0 && i < all.length) {
      var next = all[i].querySelector('[data-score-cell][data-dim="' + sel(cell.dataset.dim) + '"]');
      if (next) return focusCell(panel, next);
      i += step;
    }
    return false;
  }

  function moveHorizontal(panel, cell, step) {
    var yg = ygOf(panel);
    var dims = cfg.dims;
    var j = dims.indexOf(cell.dataset.dim) + step;
    if (j < 0 || j >= dims.length) return false;
    var dim = dims[j];
    var here = findCell(panel, cell.dataset.pid, dim);
    if (here) return focusCell(panel, here);
    // One-column view: switch the column tab, then come back to the same pupil.
    last[yg] = { pid: cell.dataset.pid, dim: dim };
    cfg.switchDim(yg, dim);
    return focusCell(panel, findCell(panel, cell.dataset.pid, dim));
  }

  function buttonFor(cell, val) {
    return val === 0 ? cell.querySelector('.na-btn') : cell.querySelector('.sc-btn.s' + val);
  }

  function score(panel, cell, val) {
    var yg = ygOf(panel);
    var pid = cell.dataset.pid, dim = cell.dataset.dim;
    var cur = cfg.current(yg, pid, dim);
    if (val === null) {
      // setScore clears when given the value already set
      if (cur !== undefined && cur !== null) cfg.setScore(yg, pid, dim, cur, buttonFor(cell, cur));
      return;
    }
    if (cur !== val) cfg.setScore(yg, pid, dim, val, buttonFor(cell, val));
    moveVertical(panel, cell, 1);
  }

  function onKeyDown(e) {
    if (!cfg || e.altKey || e.ctrlKey || e.metaKey) return;
    var cell = e.target.closest && e.target.closest('[data-score-cell][data-pid]');
    if (!cell) return;
    var panel = cell.closest('[id^="panel-tracker-"]');
    if (!panel) return;
    var k = e.key;
    var handled = true;
    if (k >= '1' && k <= '4') score(panel, cell, Number(k));
    else if (k === '0' || k === 'n' || k === 'N') score(panel, cell, 0);
    else if (k === 'Delete' || k === 'Backspace') score(panel, cell, null);
    else if (k === 'ArrowDown' || k === 'Enter') moveVertical(panel, cell, 1);
    else if (k === 'ArrowUp') moveVertical(panel, cell, -1);
    else if (k === 'ArrowRight') moveHorizontal(panel, cell, 1);
    else if (k === 'ArrowLeft') moveHorizontal(panel, cell, -1);
    else if (k === 'Escape') cell.blur();
    else handled = false;
    if (handled) e.preventDefault();
  }

  // A click on a score button makes that cell current, so typing can carry on from there.
  // (Safari does not focus buttons on click, so focus the cell explicitly.)
  function onClick(e) {
    var cell = e.target.closest && e.target.closest('[data-score-cell][data-pid]');
    if (!cell) return;
    var panel = cell.closest('[id^="panel-tracker-"]');
    if (!panel || !cell.isConnected) return;
    makeCurrent(panel, cell);
    if (document.activeElement !== cell) cell.focus({ preventScroll: true });
  }

  function onFocusIn(e) {
    var cell = e.target.closest && e.target.closest('[data-score-cell][data-pid]');
    if (!cell) return;
    var panel = cell.closest('[id^="panel-tracker-"]');
    if (panel) makeCurrent(panel, cell);
  }

  /** options: { dims:[...], current(yg,pid,dim), setScore(yg,pid,dim,val,btn), switchDim(yg,dim) } */
  function init(options) {
    cfg = options;
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', onClick);
    document.addEventListener('focusin', onFocusIn);
  }

  root.TrackerKeyboard = { init: init, prepare: prepare };
})(window);
