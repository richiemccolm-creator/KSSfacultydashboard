/**
 * Mixed typed text + Apple Pencil ink for the Teacher Planner lesson page.
 * Stores structured strokes on lesson.ink. Does not write into lesson.body.
 */
(function (root) {
  'use strict';

  var VERSION = 1;
  var DEFAULT_PAPER = 'lined';
  var PAPERS = { plain: 1, lined: 1, grid: 1, dots: 1 };
  var MAX_STROKES = 600;
  var MAX_POINTS = 4000;
  var HISTORY_LIMIT = 80;
  var ERASE_RADIUS = 14;
  var PEN_COLOR = '#17243a';
  var PEN_WIDTH = 2.5;
  var HIGHLIGHT_COLOR = 'rgba(47,111,214,0.22)';
  var MOUSE_SUPPRESS_MS = 800;

  var page;
  var canvas;
  var ctx;
  var editor;
  var paperSelect;
  var mode = 'text';
  var drawing = false;
  var current = null;
  var pointerId = null;
  var strokes = [];
  var paper = DEFAULT_PAPER;
  var undoStack = [];
  var redoStack = [];
  var eraseDirty = false;
  var redrawQueued = false;
  var sizeTimer = 0;
  var observer = null;
  var bound = false;
  var lastDpr = 0;
  var suppressMouseUntil = 0;
  var docListening = false;
  var diag = null;

  function emptyInk() {
    return { version: VERSION, paper: DEFAULT_PAPER, strokes: [] };
  }

  function cloneStrokes(list) {
    return JSON.parse(JSON.stringify(list || []));
  }

  function clonePoints(points) {
    return JSON.parse(JSON.stringify(points || []));
  }

  function sanitizePaper(value) {
    return PAPERS[value] ? value : DEFAULT_PAPER;
  }

  function pageWidth() {
    return (page && page.clientWidth) ? page.clientWidth : 1;
  }

  function pressureOf(evt) {
    if (typeof evt.pressure === 'number' && isFinite(evt.pressure)) return evt.pressure;
    return 0.5;
  }

  function cssPoint(evt) {
    var rect = page.getBoundingClientRect();
    var w = pageWidth();
    return {
      x: (evt.clientX - rect.left) / w,
      y: evt.clientY - rect.top,
      p: pressureOf(evt)
    };
  }

  function toCss(pt, width) {
    return { x: pt.x * width, y: pt.y, p: pt.p };
  }

  function distPointSeg(px, py, x1, y1, x2, y2) {
    var vx = x2 - x1;
    var vy = y2 - y1;
    var d = vx * vx + vy * vy;
    var t = d ? Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / d)) : 0;
    var x = x1 + t * vx;
    var y = y1 + t * vy;
    return Math.hypot(px - x, py - y);
  }

  function hitStroke(stroke, pt, radiusCss) {
    var w = pageWidth();
    var p = toCss(pt, w);
    var pts = stroke.points || [];
    if (!pts.length) return false;
    var a = toCss(pts[0], w);
    if (pts.length === 1) return Math.hypot(p.x - a.x, p.y - a.y) <= radiusCss;
    var i;
    var b;
    for (i = 1; i < pts.length; i++) {
      b = toCss(pts[i], w);
      if (distPointSeg(p.x, p.y, a.x, a.y, b.x, b.y) <= radiusCss) return true;
      a = b;
    }
    return false;
  }

  function drawStroke(stroke, width) {
    var pts = stroke.points || [];
    if (!pts.length || !ctx) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (stroke.tool === 'highlighter') {
      ctx.strokeStyle = HIGHLIGHT_COLOR;
      ctx.lineWidth = 16;
      ctx.globalCompositeOperation = 'multiply';
    } else {
      ctx.strokeStyle = PEN_COLOR;
      ctx.lineWidth = PEN_WIDTH;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.beginPath();
    var first = toCss(pts[0], width);
    ctx.moveTo(first.x, first.y);
    var i;
    var css;
    for (i = 1; i < pts.length; i++) {
      css = toCss(pts[i], width);
      ctx.lineTo(css.x, css.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function redraw() {
    if (!ctx || !canvas) return;
    var dpr = window.devicePixelRatio || 1;
    var cssW = canvas.clientWidth || 0;
    var cssH = canvas.clientHeight || 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    var w = pageWidth();
    var i;
    for (i = 0; i < strokes.length; i++) {
      if (strokes[i].tool === 'highlighter') drawStroke(strokes[i], w);
    }
    for (i = 0; i < strokes.length; i++) {
      if (strokes[i].tool !== 'highlighter') drawStroke(strokes[i], w);
    }
    if (current) drawStroke(current, w);
  }

  function requestRedraw() {
    if (redrawQueued) return;
    redrawQueued = true;
    requestAnimationFrame(function () {
      redrawQueued = false;
      redraw();
    });
  }

  function syncSize() {
    if (!page || !canvas || !ctx) return;
    var dpr = window.devicePixelRatio || 1;
    var w = Math.max(1, Math.round(page.clientWidth));
    var editorH = editor ? Math.round(editor.offsetHeight) : 0;
    var h = Math.max(1, editorH, Math.round(page.clientHeight));
    var nextW = Math.max(1, Math.round(w * dpr));
    var nextH = Math.max(1, Math.round(h * dpr));
    var sizeChanged = canvas.width !== nextW || canvas.height !== nextH || lastDpr !== dpr;
    lastDpr = dpr;
    if (sizeChanged) {
      canvas.width = nextW;
      canvas.height = nextH;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      redraw();
    }
    updateButtons();
  }

  function scheduleSyncSize() {
    if (sizeTimer) cancelAnimationFrame(sizeTimer);
    sizeTimer = requestAnimationFrame(function () {
      sizeTimer = 0;
      syncSize();
    });
  }

  function pushHistory() {
    undoStack.push({ paper: paper, strokes: cloneStrokes(strokes) });
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    updateButtons();
  }

  function updateButtons() {
    var undoBtn = document.getElementById('lessonInkUndo');
    var redoBtn = document.getElementById('lessonInkRedo');
    var clearBtn = document.getElementById('lessonInkClear');
    if (undoBtn) undoBtn.disabled = !undoStack.length;
    if (redoBtn) redoBtn.disabled = !redoStack.length;
    if (clearBtn) clearBtn.disabled = !strokes.length;
  }

  function applyPaper(next) {
    paper = sanitizePaper(next);
    if (!page) return;
    page.classList.remove('is-plain', 'is-lined', 'is-grid', 'is-dots');
    page.classList.add('is-' + paper);
    if (paperSelect && paperSelect.value !== paper) paperSelect.value = paper;
  }

  function setMode(next) {
    mode = next === 'pen' || next === 'highlighter' || next === 'eraser' ? next : 'text';
    if (page) page.classList.toggle('is-ink-mode', mode !== 'text');
    if (canvas) {
      canvas.style.pointerEvents = mode === 'text' ? 'none' : 'auto';
      canvas.style.touchAction = mode === 'text' ? 'pan-x pan-y' : 'none';
      canvas.style.cursor = mode === 'eraser' ? 'cell' : (mode === 'text' ? 'default' : 'crosshair');
    }
    document.querySelectorAll('#lessonBodyToolbar [data-ink-mode]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-ink-mode') === mode);
    });
    if (mode === 'text' && drawing) commitStroke('mode-text');
  }

  function pointerMatches(evt) {
    return pointerId == null || !evt || evt.pointerId === pointerId;
  }

  function pointerKind(evt) {
    return (evt && evt.pointerType) || 'mouse';
  }

  function isStylusTouch(touch) {
    return !!(touch && (touch.touchType === 'stylus' || touch.touchType === 'pencil'));
  }

  function canStartDraw(evt) {
    if (mode === 'text') return false;
    var type = pointerKind(evt);
    if (type === 'touch') {
      suppressMouseUntil = Date.now() + MOUSE_SUPPRESS_MS;
      return false;
    }
    if (type === 'mouse' && Date.now() < suppressMouseUntil) return false;
    return type === 'pen' || type === 'mouse' || type === '';
  }

  function diagRecord(evt, extra) {
    if (!evt) return;
    var rec = {
      type: evt.type,
      pointerId: evt.pointerId,
      pointerType: evt.pointerType,
      isPrimary: evt.isPrimary,
      buttons: evt.buttons,
      pressure: evt.pressure,
      clientX: evt.clientX,
      clientY: evt.clientY,
      timeStamp: evt.timeStamp
    };
    if (extra) rec.note = extra;
    if (!diag || evt.type === 'pointerdown') {
      diag = {
        seq: [],
        moves: 0,
        coalesced: 0,
        start: evt.timeStamp,
        hasRawUpdate: typeof window.PointerEvent !== 'undefined' && 'onpointerrawupdate' in window
      };
    }
    if (evt.type === 'pointermove' || evt.type === 'pointerrawupdate') {
      diag.moves += 1;
      if (diag.moves <= 2) diag.seq.push(rec);
    } else {
      diag.seq.push(rec);
    }
  }

  function diagFinish(reason, pointCount) {
    if (!diag) return;
    diag.end = reason;
    diag.points = pointCount;
    console.log('[LessonInk stroke]', {
      end: reason,
      moves: diag.moves,
      points: pointCount,
      coalesced: diag.coalesced,
      hasPointerRawUpdate: diag.hasRawUpdate,
      seq: diag.seq.map(function (r) { return r.type + (r.note ? ':' + r.note : ''); })
    });
    root.__inkLastStroke = diag;
    diag = null;
  }

  function listenDoc(on) {
    if (on === docListening) return;
    docListening = on;
    var fn = on ? 'addEventListener' : 'removeEventListener';
    document[fn]('pointerup', onDocPointerUp, true);
    document[fn]('pointercancel', onDocPointerCancel, true);
  }

  function commitStroke(reason) {
    var count = current && current.points ? current.points.length : 0;
    if (current && current.points && current.points.length) {
      pushHistory();
      if (current.points.length > MAX_POINTS) {
        var step = current.points.length / MAX_POINTS;
        var slim = [current.points[0]];
        var idx;
        for (idx = step; idx < current.points.length - 1; idx += step) slim.push(current.points[Math.floor(idx)]);
        slim.push(current.points[current.points.length - 1]);
        current.points = slim;
      }
      strokes.push({ tool: current.tool, points: clonePoints(current.points) });
    }
    current = null;
    drawing = false;
    pointerId = null;
    eraseDirty = false;
    listenDoc(false);
    requestRedraw();
    updateButtons();
    if (reason) diagFinish(reason, count);
  }

  function appendPoint(evt) {
    if (!current) return;
    if (current.points.length >= MAX_POINTS) return;
    current.points.push(cssPoint(evt));
  }

  function samplesFrom(evt) {
    if (typeof evt.getCoalescedEvents === 'function') {
      try {
        var list = evt.getCoalescedEvents();
        if (list && list.length) {
          if (diag) diag.coalesced += list.length;
          return list;
        }
      } catch (err) {}
    }
    return [evt];
  }

  function beginStroke(evt) {
    if (drawing) return;
    if (evt.isPrimary === false) return;
    if (!canStartDraw(evt)) return;
    diagRecord(evt);
    if (evt.cancelable) evt.preventDefault();
    drawing = true;
    pointerId = evt.pointerId;
    eraseDirty = false;
    listenDoc(true);
    if (mode === 'eraser') {
      current = null;
      eraseAt(cssPoint(evt));
      return;
    }
    if (strokes.length >= MAX_STROKES) {
      drawing = false;
      pointerId = null;
      listenDoc(false);
      return;
    }
    current = { tool: mode, points: [cssPoint(evt)] };
    requestRedraw();
  }

  function moveStroke(evt) {
    if (!drawing || !pointerMatches(evt)) return;
    if (pointerKind(evt) === 'touch') return;
    diagRecord(evt);
    if (mode === 'eraser') {
      eraseAt(cssPoint(evt));
      return;
    }
    if (!current) return;
    var samples = samplesFrom(evt);
    var i;
    for (i = 0; i < samples.length; i++) appendPoint(samples[i]);
    requestRedraw();
  }

  function endStroke(evt, reason) {
    if (!pointerMatches(evt)) return;
    if (!drawing && !current) return;
    if (evt) diagRecord(evt, reason);
    commitStroke(reason || 'pointerup');
  }

  function onDocPointerUp(evt) { endStroke(evt, 'pointerup'); }
  function onDocPointerCancel(evt) { endStroke(evt, 'pointercancel'); }

  function eraseAt(pt) {
    var radius = ERASE_RADIUS;
    var kept = [];
    var removed = false;
    var i;
    for (i = 0; i < strokes.length; i++) {
      if (hitStroke(strokes[i], pt, radius)) removed = true;
      else kept.push(strokes[i]);
    }
    if (!removed) return;
    if (!eraseDirty) {
      pushHistory();
      eraseDirty = true;
    }
    strokes = kept;
    requestRedraw();
    updateButtons();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push({ paper: paper, strokes: cloneStrokes(strokes) });
    var prev = undoStack.pop();
    paper = sanitizePaper(prev.paper);
    strokes = cloneStrokes(prev.strokes);
    applyPaper(paper);
    requestRedraw();
    updateButtons();
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push({ paper: paper, strokes: cloneStrokes(strokes) });
    var next = redoStack.pop();
    paper = sanitizePaper(next.paper);
    strokes = cloneStrokes(next.strokes);
    applyPaper(paper);
    requestRedraw();
    updateButtons();
  }

  function clearInk() {
    if (!strokes.length) return;
    pushHistory();
    strokes = [];
    current = null;
    requestRedraw();
    updateButtons();
  }

  function normalizeInk(raw) {
    var out = emptyInk();
    if (!raw || typeof raw !== 'object') return out;
    out.paper = sanitizePaper(raw.paper);
    var list = Array.isArray(raw.strokes) ? raw.strokes : [];
    var i;
    var s;
    var pts;
    var p;
    var j;
    for (i = 0; i < list.length && out.strokes.length < MAX_STROKES; i++) {
      s = list[i];
      if (!s || (s.tool !== 'pen' && s.tool !== 'highlighter')) continue;
      pts = Array.isArray(s.points) ? s.points : [];
      var clean = [];
      for (j = 0; j < pts.length && clean.length < MAX_POINTS; j++) {
        p = pts[j];
        if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') continue;
        if (!isFinite(p.x) || !isFinite(p.y)) continue;
        clean.push({
          x: p.x,
          y: p.y,
          p: (typeof p.p === 'number' && isFinite(p.p)) ? p.p : 0.5
        });
      }
      if (clean.length) out.strokes.push({ tool: s.tool, points: clean });
    }
    return out;
  }

  function load(raw) {
    var data = normalizeInk(raw);
    strokes = cloneStrokes(data.strokes);
    current = null;
    drawing = false;
    pointerId = null;
    listenDoc(false);
    undoStack = [];
    redoStack = [];
    applyPaper(data.paper);
    setMode('text');
    scheduleSyncSize();
    updateButtons();
  }

  function serialize() {
    if (drawing || current) commitStroke('serialize');
    return {
      version: VERSION,
      paper: paper,
      strokes: cloneStrokes(strokes)
    };
  }

  function onPointerDown(evt) { beginStroke(evt); }
  function onPointerMove(evt) { moveStroke(evt); }
  function onGotCapture(evt) { diagRecord(evt); }
  function onLostCapture(evt) { diagRecord(evt, 'ignored-not-commit'); }

  function onTouchGuard(evt) {
    if (mode === 'text') return;
    var i;
    var list = evt.changedTouches || evt.touches || [];
    for (i = 0; i < list.length; i++) {
      if (isStylusTouch(list[i])) {
        if (evt.cancelable) evt.preventDefault();
        return;
      }
    }
  }

  function bind() {
    if (!canvas || canvas.dataset.inkBound) return;
    canvas.dataset.inkBound = '1';
    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove, { passive: false });
    canvas.addEventListener('gotpointercapture', onGotCapture);
    canvas.addEventListener('lostpointercapture', onLostCapture);
    canvas.addEventListener('touchstart', onTouchGuard, { passive: false });
    canvas.addEventListener('touchmove', onTouchGuard, { passive: false });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function init() {
    page = document.getElementById('lessonInkPage');
    canvas = document.getElementById('lessonInkCanvas');
    editor = document.getElementById('lessonBodyEditor');
    paperSelect = document.getElementById('lessonInkPaper');
    if (!page || !canvas || !editor) return;
    ctx = canvas.getContext('2d', { desynchronized: true, alpha: true });
    bind();
    if (!bound) {
      bound = true;
      document.querySelectorAll('#lessonBodyToolbar [data-ink-mode]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          setMode(btn.getAttribute('data-ink-mode'));
        });
      });
      var undoBtn = document.getElementById('lessonInkUndo');
      var redoBtn = document.getElementById('lessonInkRedo');
      if (undoBtn) undoBtn.addEventListener('click', undo);
      if (redoBtn) redoBtn.addEventListener('click', redo);
      if (paperSelect) {
        paperSelect.addEventListener('change', function () {
          var next = sanitizePaper(paperSelect.value);
          if (next === paper) return;
          pushHistory();
          applyPaper(next);
        });
      }
      editor.addEventListener('input', scheduleSyncSize);
      window.addEventListener('resize', scheduleSyncSize);
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', scheduleSyncSize);
      }
      window.addEventListener('orientationchange', function () {
        setTimeout(syncSize, 180);
      });
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(scheduleSyncSize);
        observer.observe(page);
      }
    }
    applyPaper(paper);
    setMode('text');
    scheduleSyncSize();
  }

  function reset() {
    drawing = false;
    current = null;
    pointerId = null;
    listenDoc(false);
    setMode('text');
  }

  root.LessonInk = {
    init: init,
    load: load,
    serialize: serialize,
    syncSize: syncSize,
    setMode: setMode,
    clearInk: clearInk,
    reset: reset,
    emptyInk: emptyInk
  };
})(window);
