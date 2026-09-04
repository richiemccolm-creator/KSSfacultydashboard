/**
 * Mixed typed text + Apple Pencil ink for the Teacher Planner.
 * Shared surface factory: the 680px notebook (LessonInk) and the next-lesson
 * reminder (LessonNoteInk) use the same pointer lifecycle.
 *
 * Notebook strokes live on lesson.ink and must not be mixed with reminder ink.
 * Do not treat lostpointercapture as pointerup. Touch never inks.
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
  var PEN_WIDTH = 1.6;
  var HIGHLIGHT_COLOR = 'rgba(47,111,214,0.22)';
  var MOUSE_SUPPRESS_MS = 800;

  function createInkSurface(userConfig) {
    var config = userConfig || {};
    var pageId = config.pageId || 'lessonInkPage';
    var canvasId = config.canvasId || 'lessonInkCanvas';
    var editorId = config.editorId === undefined ? 'lessonBodyEditor' : config.editorId;
    var paperSelectId = config.paperSelectId === undefined ? 'lessonInkPaper' : config.paperSelectId;
    var toolbarSel = config.toolbarSel === undefined ? '#lessonBodyToolbar [data-ink-mode]' : config.toolbarSel;
    var undoId = config.undoId === undefined ? 'lessonInkUndo' : config.undoId;
    var redoId = config.redoId === undefined ? 'lessonInkRedo' : config.redoId;
    var clearId = config.clearId === undefined ? 'lessonInkClear' : config.clearId;
    var normalizeY = !!config.normalizeY;
    var penAlways = !!config.penAlways;
    var mouseInk = config.mouseInk !== false;
    var penOnPage = !!config.penOnPage;
    var docMove = !!config.docMove;
    var followEditor = config.followEditor !== false;
    var logLabel = config.logLabel || '[LessonInk stroke]';
    var diagKey = config.diagKey || '__inkLastStroke';
    var hideClearWhenEmpty = !!config.hideClearWhenEmpty;
    var allowedPapers = config.papers || PAPERS;
    var defaultPaper = allowedPapers[config.defaultPaper] ? config.defaultPaper : (allowedPapers.lined ? 'lined' : Object.keys(allowedPapers)[0]);
    var defaultMode = penAlways ? 'pen' : 'text';

    var page;
    var canvas;
    var ctx;
    var editor;
    var paperSelect;
    var mode = defaultMode;
    var drawing = false;
    var current = null;
    var pointerId = null;
    var strokes = [];
    var paper = defaultPaper || DEFAULT_PAPER;
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
    var fingerScroll = null;

    function emptyInk() {
      var out = { version: VERSION, strokes: [] };
      if (!penAlways) out.paper = defaultPaper || DEFAULT_PAPER;
      return out;
    }

    function cloneStrokes(list) {
      return JSON.parse(JSON.stringify(list || []));
    }

    function clonePoints(points) {
      return JSON.parse(JSON.stringify(points || []));
    }

    function sanitizePaper(value) {
      return allowedPapers[value] ? value : (defaultPaper || DEFAULT_PAPER);
    }

    function pageWidth() {
      return (page && page.clientWidth) ? page.clientWidth : 1;
    }

    function pageHeight() {
      return (page && page.clientHeight) ? page.clientHeight : 1;
    }

    function pressureOf(evt) {
      if (typeof evt.pressure === 'number' && isFinite(evt.pressure)) return evt.pressure;
      return 0.5;
    }

    function cssPoint(evt) {
      var rect = page.getBoundingClientRect();
      var w = pageWidth();
      var h = pageHeight();
      var pt = {
        x: (evt.clientX - rect.left) / w,
        y: normalizeY ? ((evt.clientY - rect.top) / h) : (evt.clientY - rect.top),
        p: pressureOf(evt)
      };
      return pt;
    }

    function toCss(pt, width) {
      return {
        x: pt.x * width,
        y: normalizeY ? (pt.y * pageHeight()) : pt.y,
        p: pt.p
      };
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

    function drawStrokeOn(ctx2, stroke, width, heightForY) {
      var pts = stroke.points || [];
      if (!pts.length || !ctx2) return;
      ctx2.save();
      ctx2.lineCap = 'round';
      ctx2.lineJoin = 'round';
      if (stroke.tool === 'highlighter') {
        ctx2.strokeStyle = HIGHLIGHT_COLOR;
        ctx2.lineWidth = 16;
        ctx2.globalCompositeOperation = 'multiply';
      } else {
        ctx2.strokeStyle = PEN_COLOR;
        ctx2.lineWidth = PEN_WIDTH;
        ctx2.globalCompositeOperation = 'source-over';
      }
      ctx2.beginPath();
      var first = { x: pts[0].x * width, y: normalizeY ? (pts[0].y * heightForY) : pts[0].y };
      ctx2.moveTo(first.x, first.y);
      var i;
      var css;
      for (i = 1; i < pts.length; i++) {
        css = { x: pts[i].x * width, y: normalizeY ? (pts[i].y * heightForY) : pts[i].y };
        ctx2.lineTo(css.x, css.y);
      }
      ctx2.stroke();
      ctx2.restore();
    }

    function drawStroke(stroke, width) {
      drawStrokeOn(ctx, stroke, width, pageHeight());
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

    function notifyChange() {
      if (typeof config.onChange === 'function') {
        try { config.onChange(); } catch (err) {}
      }
    }

    function syncSize() {
      if (!page || !canvas || !ctx) return;
      var dpr = window.devicePixelRatio || 1;
      var w = Math.max(1, Math.round(page.clientWidth));
      var editorH = (followEditor && editor) ? Math.round(editor.offsetHeight) : 0;
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
      var undoBtn = undoId ? document.getElementById(undoId) : null;
      var redoBtn = redoId ? document.getElementById(redoId) : null;
      var clearBtn = clearId ? document.getElementById(clearId) : null;
      if (undoBtn) undoBtn.disabled = !undoStack.length;
      if (redoBtn) redoBtn.disabled = !redoStack.length;
      if (clearBtn) clearBtn.disabled = !strokes.length;
      if (clearBtn && (hideClearWhenEmpty || clearBtn.hasAttribute('hidden'))) {
        clearBtn.hidden = !strokes.length;
      }
    }

    function applyPaper(next) {
      paper = sanitizePaper(next);
      if (!page) return;
      page.classList.remove('is-plain', 'is-lined', 'is-grid', 'is-dots');
      page.classList.add('is-' + paper);
      if (paperSelect && paperSelect.value !== paper) paperSelect.value = paper;
    }

    function setMode(next) {
      if (penAlways) {
        mode = 'pen';
        if (page) page.classList.add('is-ink-mode');
        if (canvas && !penOnPage) {
          canvas.style.pointerEvents = 'auto';
          canvas.style.touchAction = 'none';
          canvas.style.cursor = 'crosshair';
        }
        return;
      }
      mode = next === 'pen' || next === 'highlighter' || next === 'eraser' ? next : 'text';
      if (page) page.classList.toggle('is-ink-mode', mode !== 'text');
      if (canvas) {
        canvas.style.pointerEvents = mode === 'text' ? 'none' : 'auto';
        canvas.style.touchAction = mode === 'text' ? 'pan-x pan-y' : 'none';
        canvas.style.cursor = mode === 'eraser' ? 'cell' : (mode === 'text' ? 'default' : 'crosshair');
      }
      if (toolbarSel) {
        document.querySelectorAll(toolbarSel).forEach(function (btn) {
          btn.classList.toggle('is-active', btn.getAttribute('data-ink-mode') === mode);
        });
      }
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
      var type = pointerKind(evt);
      if (type === 'touch') {
        suppressMouseUntil = Date.now() + MOUSE_SUPPRESS_MS;
        return false;
      }
      if (type === 'mouse' && Date.now() < suppressMouseUntil) return false;
      if (penAlways) {
        if (!mouseInk && type !== 'pen') return false;
        return type === 'pen' || type === 'mouse' || type === '';
      }
      if (mode === 'text') return false;
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
      console.log(logLabel, {
        end: reason,
        moves: diag.moves,
        points: pointCount,
        coalesced: diag.coalesced,
        hasPointerRawUpdate: diag.hasRawUpdate,
        seq: diag.seq.map(function (r) { return r.type + (r.note ? ':' + r.note : ''); })
      });
      root[diagKey] = diag;
      diag = null;
    }

    function listenDoc(on) {
      if (on === docListening) return;
      docListening = on;
      var fn = on ? 'addEventListener' : 'removeEventListener';
      document[fn]('pointerup', onDocPointerUp, true);
      document[fn]('pointercancel', onDocPointerCancel, true);
      if (docMove) document[fn]('pointermove', onPointerMove, true);
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
      if (count) notifyChange();
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
      current = { tool: (mode === 'highlighter' ? 'highlighter' : 'pen'), points: [cssPoint(evt)] };
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
      notifyChange();
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
      notifyChange();
    }

    function redo() {
      if (!redoStack.length) return;
      undoStack.push({ paper: paper, strokes: cloneStrokes(strokes) });
      var next = redoStack.pop();
      paper = sanitizePaper(next.paper);
      strokes = cloneStrokes(next.strokes);
      applyPaper(next.paper);
      requestRedraw();
      updateButtons();
      notifyChange();
    }

    function clearInk() {
      if (!strokes.length) return;
      pushHistory();
      strokes = [];
      current = null;
      requestRedraw();
      updateButtons();
      notifyChange();
    }

    function normalizeInk(raw) {
      var out = emptyInk();
      if (!raw || typeof raw !== 'object') return out;
      if (!penAlways) out.paper = sanitizePaper(raw.paper);
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
      applyPaper(data.paper || paper);
      setMode(defaultMode);
      scheduleSyncSize();
      updateButtons();
      notifyChange();
    }

    function serialize() {
      if (drawing || current) commitStroke('serialize');
      var out = {
        version: VERSION,
        strokes: cloneStrokes(strokes)
      };
      if (!penAlways) out.paper = paper;
      return out;
    }

    function paintTo(targetCanvas, raw) {
      if (!targetCanvas) return;
      var data = normalizeInk(raw);
      var ctx2 = targetCanvas.getContext('2d');
      if (!ctx2) return;
      var dpr = window.devicePixelRatio || 1;
      var cssW = Math.max(1, targetCanvas.clientWidth || targetCanvas.width || 1);
      var cssH = Math.max(1, targetCanvas.clientHeight || targetCanvas.height || 1);
      targetCanvas.width = Math.round(cssW * dpr);
      targetCanvas.height = Math.round(cssH * dpr);
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2.clearRect(0, 0, cssW, cssH);
      var i;
      for (i = 0; i < data.strokes.length; i++) {
        if (data.strokes[i].tool === 'highlighter') drawStrokeOn(ctx2, data.strokes[i], cssW, cssH);
      }
      for (i = 0; i < data.strokes.length; i++) {
        if (data.strokes[i].tool !== 'highlighter') drawStrokeOn(ctx2, data.strokes[i], cssW, cssH);
      }
    }

    function onPointerDown(evt) { beginStroke(evt); }
    function onPointerMove(evt) { moveStroke(evt); }
    function onGotCapture(evt) { diagRecord(evt); }
    function onLostCapture(evt) { diagRecord(evt, 'ignored-not-commit'); }

    function nearestScrollEl() {
      var el = page;
      while (el && el !== document.documentElement) {
        var cs = window.getComputedStyle(el);
        var oy = cs.overflowY;
        var ox = cs.overflowX;
        if (oy === 'auto' || oy === 'scroll' || ox === 'auto' || ox === 'scroll') return el;
        el = el.parentElement;
      }
      return null;
    }

    function onFingerScrollEnd() {
      fingerScroll = null;
    }

    function onTouchGuard(evt) {
      var i;
      var list = evt.changedTouches || evt.touches || [];
      for (i = 0; i < list.length; i++) {
        if (isStylusTouch(list[i])) {
          if (evt.cancelable) evt.preventDefault();
          fingerScroll = null;
          return;
        }
      }
      if (penAlways) return;
      if (mode === 'text') return;
      // Ink-mode canvas keeps touch-action:none so Safari does not steal Pencil
      // as a pan. Finger therefore cannot native-scroll; drive the workspace
      // scroller instead. Do not preventDefault on stylus-free touchstart.
      if (evt.type === 'touchstart') {
        if (evt.touches.length !== 1) {
          fingerScroll = null;
          return;
        }
        var scroller = nearestScrollEl();
        if (!scroller) return;
        fingerScroll = {
          el: scroller,
          y: evt.touches[0].clientY,
          x: evt.touches[0].clientX,
          top: scroller.scrollTop,
          left: scroller.scrollLeft
        };
        return;
      }
      if (evt.type === 'touchmove' && fingerScroll && evt.touches.length === 1) {
        var t = evt.touches[0];
        fingerScroll.el.scrollTop = fingerScroll.top + (fingerScroll.y - t.clientY);
        fingerScroll.el.scrollLeft = fingerScroll.left + (fingerScroll.x - t.clientX);
        if (evt.cancelable) evt.preventDefault();
      }
    }

    function bind() {
      var hit = penOnPage ? page : canvas;
      if (!hit || hit.dataset.inkBound) return;
      hit.dataset.inkBound = '1';
      var opts = { passive: false };
      if (penOnPage) {
        hit.addEventListener('pointerdown', onPointerDown, { capture: true, passive: false });
        hit.addEventListener('pointermove', onPointerMove, { capture: true, passive: false });
      } else {
        canvas.addEventListener('pointerdown', onPointerDown, opts);
        canvas.addEventListener('pointermove', onPointerMove, opts);
        canvas.addEventListener('gotpointercapture', onGotCapture);
        canvas.addEventListener('lostpointercapture', onLostCapture);
      }
      hit.addEventListener('touchstart', onTouchGuard, opts);
      hit.addEventListener('touchmove', onTouchGuard, opts);
      hit.addEventListener('touchend', onFingerScrollEnd, opts);
      hit.addEventListener('touchcancel', onFingerScrollEnd, opts);
      hit.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }

    function init() {
      page = document.getElementById(pageId);
      canvas = document.getElementById(canvasId);
      editor = editorId ? document.getElementById(editorId) : null;
      paperSelect = paperSelectId ? document.getElementById(paperSelectId) : null;
      if (!page || !canvas) return;
      ctx = canvas.getContext('2d', { desynchronized: true, alpha: true });
      bind();
      if (!bound) {
        bound = true;
        if (toolbarSel) {
          document.querySelectorAll(toolbarSel).forEach(function (btn) {
            btn.addEventListener('click', function () {
              setMode(btn.getAttribute('data-ink-mode'));
            });
          });
        }
        var undoBtn = undoId ? document.getElementById(undoId) : null;
        var redoBtn = redoId ? document.getElementById(redoId) : null;
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
        if (editor) editor.addEventListener('input', scheduleSyncSize);
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
      setMode(defaultMode);
      scheduleSyncSize();
    }

    function reset() {
      drawing = false;
      current = null;
      pointerId = null;
      listenDoc(false);
      setMode(defaultMode);
    }

    function hasStrokes() {
      return !!strokes.length;
    }

    return {
      init: init,
      load: load,
      serialize: serialize,
      syncSize: syncSize,
      setMode: setMode,
      clearInk: clearInk,
      reset: reset,
      emptyInk: emptyInk,
      paintTo: paintTo,
      hasStrokes: hasStrokes
    };
  }

  root.createLessonInkSurface = createInkSurface;
  root.LessonInk = createInkSurface();
  root.LessonNoteInk = createInkSurface({
    pageId: 'lessonNextNotePage',
    canvasId: 'lessonNextNoteCanvas',
    editorId: null,
    paperSelectId: null,
    toolbarSel: null,
    undoId: null,
    redoId: null,
    clearId: 'lessonNextNoteClear',
    normalizeY: true,
    penAlways: true,
    mouseInk: true,
    penOnPage: true,
    docMove: true,
    followEditor: false,
    defaultPaper: 'lined',
    papers: { lined: 1 },
    logLabel: '[LessonNoteInk stroke]',
    diagKey: '__noteInkLastStroke',
    hideClearWhenEmpty: true
  });
})(window);
