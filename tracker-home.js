/**
 * "What needs doing" list for the Drama / Art BGE tracker home screen.
 * Works out each class's current unit from the scores themselves (unit timings are not dates),
 * then lists the next job for every class, most urgent first.
 */
(function(root) {
  'use strict';

  var YGS = ['s1', 's2', 's3'];

  function filled(v) { return v !== undefined && v !== null; }

  function cellInfo(sc, dim) {
    var isDefault = Array.isArray(sc.defaultDims) && sc.defaultDims.indexOf(dim) !== -1;
    return { filled: filled(sc[dim]), entered: filled(sc[dim]) && !isDefault };
  }

  /** How far a class has got with one unit. */
  function unitProgress(S, yg, pupils, tpId, dims) {
    var out = { total: pupils.length, complete: 0, entered: false, onDefaultsOnly: 0, firstGapDim: null };
    pupils.forEach(function(p) {
      var sc = (S.scores[yg] && S.scores[yg][p.id] && S.scores[yg][p.id][tpId]) || {};
      var all = true, anyEntered = false, anyFilled = false;
      dims.forEach(function(d) {
        var c = cellInfo(sc, d);
        if (c.entered) anyEntered = true;
        if (c.filled) anyFilled = true;
        else {
          all = false;
          if (!out.firstGapDim || dims.indexOf(d) < dims.indexOf(out.firstGapDim)) out.firstGapDim = d;
        }
      });
      if (anyEntered || (sc.notes && String(sc.notes).trim())) out.entered = true;
      if (all) out.complete++;
      if (anyFilled && !anyEntered) out.onDefaultsOnly++;
    });
    out.started = out.entered || !!(S.defaultsOn && S.defaultsOn[yg] && S.defaultsOn[yg][tpId] === true);
    return out;
  }

  /**
   * o: { S, TPS, dims, rosterMissing(yg, cls) -> [] }
   * Returns { todo:[item], done:[item] }. Item: { kind, yg, cls, tp, unit, text, action, priority, ... }
   *   kind: 'scoring' | 'defaults' | 'no-pupils' | 'roster' | 'next-unit' | 'not-started' | 'complete'
   */
  function build(o) {
    var S = o.S, todo = [], done = [];
    YGS.forEach(function(yg) {
      var tps = (o.TPS && o.TPS[yg]) || [];
      Object.keys((S.pupils && S.pupils[yg]) || {}).sort().forEach(function(cls) {
        var pupils = S.pupils[yg][cls] || [];
        var base = { yg: yg, cls: cls };
        var waiting = o.rosterMissing ? o.rosterMissing(yg, cls).length : 0;
        if (waiting) todo.push(Object.assign({ kind: 'roster', priority: 3, count: waiting }, base));
        if (!pupils.length) {
          if (!waiting) todo.push(Object.assign({ kind: 'no-pupils', priority: 2 }, base));
          return;
        }
        if (!tps.length) return;
        // Current unit: the latest one this class has started.
        var current = -1, prog = null;
        for (var i = tps.length - 1; i >= 0; i--) {
          var pr = unitProgress(S, yg, pupils, tps[i].id, o.dims);
          if (pr.started) { current = i; prog = pr; break; }
        }
        if (current === -1) {
          todo.push(Object.assign({ kind: 'not-started', priority: 6, tp: tps[0] }, base));
          return;
        }
        var tp = tps[current];
        if (prog.complete < prog.total) {
          todo.push(Object.assign({ kind: 'scoring', priority: 1, tp: tp, left: prog.total - prog.complete, total: prog.total, dim: prog.firstGapDim }, base));
        } else if (prog.onDefaultsOnly) {
          todo.push(Object.assign({ kind: 'defaults', priority: 4, tp: tp, count: prog.onDefaultsOnly, total: prog.total }, base));
        } else if (tps[current + 1]) {
          todo.push(Object.assign({ kind: 'next-unit', priority: 5, tp: tp, next: tps[current + 1] }, base));
        } else {
          done.push(Object.assign({ kind: 'complete', tp: tp, total: prog.total }, base));
        }
        if (prog.complete === prog.total && !prog.onDefaultsOnly && tps[current + 1]) {
          done.push(Object.assign({ kind: 'complete', tp: tp, total: prog.total }, base));
        }
      });
    });
    todo.sort(function(a, b) {
      return a.priority - b.priority || (b.left || 0) - (a.left || 0) || a.yg.localeCompare(b.yg) || a.cls.localeCompare(b.cls);
    });
    return { todo: todo, done: done };
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function jsq(s) { return esc(String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function itemHTML(it) {
    var where = '<span class="todo-where">' + it.yg.toUpperCase() + ' · ' + esc(it.cls) + '</span>';
    var unit = it.tp ? ' <span class="todo-unit">' + esc(it.tp.label) + ' ' + esc(it.tp.unit) + '</span>' : '';
    var open = function(tpId, dim, label, primary) {
      return '<button type="button" class="btn ' + (primary ? 'btn-primary' : 'btn-ghost') + '" onclick="openTodo(\'' + it.yg + '\',\'' + jsq(it.cls) + '\',\'' + (tpId || '') + '\',\'' + (dim || '') + '\')">' + label + '</button>';
    };
    var setup = function(label) {
      return '<button type="button" class="btn btn-ghost" onclick="nav(\'setup-' + it.yg + '\')">' + label + '</button>';
    };
    var text, action;
    switch (it.kind) {
      case 'scoring':
        text = it.left + ' of ' + plural(it.total, 'pupil', 'pupils') + ' still ' + (it.left === 1 ? 'needs' : 'need') + ' scores';
        action = open(it.tp.id, it.dim, 'Continue', true);
        break;
      case 'defaults':
        text = plural(it.count, 'pupil only has', 'pupils only have') + ' the starting scores';
        action = open(it.tp.id, '', 'Check', false);
        break;
      case 'no-pupils':
        text = 'No pupils in this class yet';
        action = setup('Add pupils');
        break;
      case 'roster':
        text = plural(it.count, 'pupil', 'pupils') + ' in Class Management ' + (it.count === 1 ? "isn't" : "aren't") + ' in this class yet';
        action = setup('Review');
        break;
      case 'next-unit':
        text = 'Finished ' + esc(it.tp.label) + '. Next: ' + esc(it.next.label) + ' ' + esc(it.next.unit);
        unit = '';
        action = open(it.next.id, '', 'Start ' + esc(it.next.label), false);
        break;
      case 'not-started':
        text = 'Not started yet. First unit: ' + esc(it.tp.label) + ' ' + esc(it.tp.unit);
        unit = '';
        action = open(it.tp.id, '', 'Start', false);
        break;
      default:
        text = 'All ' + it.total + ' pupils scored';
        action = open(it.tp.id, '', 'Open', false);
    }
    return '<li class="todo-item todo-' + it.kind + '"><div class="todo-main">' + where + unit + '<div class="todo-text">' + text + '</div></div><div class="todo-action">' + action + '</div></li>';
  }

  function render(result) {
    var todo = result.todo, done = result.done;
    var html = '<section class="todo" aria-labelledby="todo-title"><div class="todo-head"><h2 id="todo-title" class="todo-title">To do</h2>' +
      (todo.length ? '<span class="todo-count">' + todo.length + '</span>' : '') + '</div>';
    if (!todo.length && !done.length) {
      html += '<p class="todo-empty">Add your first class to start tracking. <button type="button" class="btn btn-primary" onclick="nav(\'setup-s1\')">Set up classes</button></p>';
    } else if (!todo.length) {
      html += '<p class="todo-empty">All caught up. Every class has scores for its current unit.</p>';
    } else {
      html += '<ul class="todo-list">' + todo.map(itemHTML).join('') + '</ul>';
    }
    if (done.length) {
      html += '<details class="todo-done"><summary>Done (' + done.length + ')</summary><ul class="todo-list">' + done.map(itemHTML).join('') + '</ul></details>';
    }
    return html + '</section>';
  }

  root.TrackerHome = { build: build, render: render, unitProgress: unitProgress };
})(typeof window !== 'undefined' ? window : globalThis);
