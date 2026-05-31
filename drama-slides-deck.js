/**
 * Shared navigation for legacy drama-u*.html slide decks (.rv reveals, #nav bar).
 * Include after inline translations; loads at end of body.
 */
(function (w, d) {
  'use strict';

  var state = {
    cur: 1,
    revealed: 0,
    total: 0,
    rvCounts: {}
  };

  function slide(n) {
    return d.getElementById('s' + n);
  }

  function countReveals(sl) {
    if (!sl) return 0;
    var attr = sl.getAttribute('data-rv');
    if (attr != null && attr !== '') {
      var n = parseInt(attr, 10);
      if (!isNaN(n)) return n;
    }
    return sl.querySelectorAll('.rv').length;
  }

  function resetReveals(sl) {
    if (!sl) return;
    sl.querySelectorAll('.rv').forEach(function (el) {
      el.classList.remove('on');
    });
  }

  function revealAllIn(sl) {
    if (!sl) return;
    sl.querySelectorAll('.rv').forEach(function (el) {
      el.classList.add('on');
    });
  }

  function goTo(n, dir) {
    dir = dir == null ? 1 : dir;
    var prevSl = slide(state.cur);
    var nextSl = slide(n);
    if (!nextSl) return;

    if (prevSl) {
      prevSl.classList.remove('active');
      prevSl.classList.add('exit');
      setTimeout(function () {
        prevSl.classList.remove('exit');
      }, 360);
    }

    state.revealed = 0;
    resetReveals(nextSl);

    if (dir < 0) {
      revealAllIn(nextSl);
      state.revealed = state.rvCounts['s' + n] || 0;
    }

    nextSl.style.transform = dir > 0 ? 'translateX(22px)' : 'translateX(-22px)';
    nextSl.classList.add('active');
    requestAnimationFrame(function () {
      nextSl.style.transform = '';
    });

    state.cur = n;

    if (dir >= 0 && !state.rvCounts['s' + n]) {
      revealAllIn(nextSl);
      state.revealed = state.rvCounts['s' + n] || 0;
    }

    updateNav();
  }

  function allDone() {
    return state.revealed >= (state.rvCounts['s' + state.cur] || 0);
  }

  function revealNext() {
    var sl = slide(state.cur);
    if (!sl) return false;
    var items = sl.querySelectorAll('.rv:not(.on)');
    if (!items.length) return false;
    items[0].classList.add('on');
    state.revealed += 1;
    return true;
  }

  function undoReveal() {
    if (state.revealed <= 0) return false;
    var sl = slide(state.cur);
    if (!sl) return false;
    state.revealed -= 1;
    var items = sl.querySelectorAll('.rv');
    if (items[state.revealed]) items[state.revealed].classList.remove('on');
    return true;
  }

  function next() {
    if (!allDone()) {
      revealNext();
      updateNav();
      return;
    }
    if (state.cur < state.total) goTo(state.cur + 1, 1);
  }

  function prev() {
    if (undoReveal()) {
      updateNav();
      return;
    }
    if (state.cur > 1) goTo(state.cur - 1, -1);
  }

  function t(key, vars) {
    if (w.DramaSlidesI18n && w.DramaSlidesI18n.t) {
      var text = w.DramaSlidesI18n.t(key, vars);
      if (text) return text;
    }
    var defaults = {
      'ui.nav.previous': '← Previous',
      'ui.nav.next': 'Next →',
      'ui.nav.end': 'End',
      'ui.nav.reveal': 'Reveal ({n})',
      'ui.nav.slide-of': 'Slide {current} of {total}',
      'ui.nav.items-to-reveal': '{n} to reveal',
      'ui.hint.reveal': 'Space or → to reveal'
    };
    var template = defaults[key] || '';
    return template.replace(/\{(\w+)\}/g, function (_, name) {
      return vars && vars[name] != null ? vars[name] : '';
    });
  }

  function updateNav() {
    var rem = (state.rvCounts['s' + state.cur] || 0) - state.revealed;
    var bn = d.getElementById('bnext');
    var bp = d.getElementById('bprev');
    var info = d.getElementById('ninfo');
    var hint = d.getElementById('rhint');
    if (!bn || !bp) return;

    var prevDisabled =
      w.DramaSlidesCore && w.DramaSlidesCore.isPrevDisabled
        ? w.DramaSlidesCore.isPrevDisabled({
            currentSlide: state.cur,
            currentReveal: state.revealed
          })
        : state.cur === 1 && state.revealed === 0;

    bp.disabled = prevDisabled;
    bn.disabled = state.cur === state.total && allDone();

    if (!allDone()) {
      bn.textContent = t('ui.nav.reveal', { n: rem });
      info.textContent =
        t('ui.nav.slide-of', { current: state.cur, total: state.total }) +
        '  ·  ' +
        t('ui.nav.items-to-reveal', { n: rem });
      if (hint) {
        hint.textContent = t('ui.hint.reveal');
        hint.style.opacity = '1';
      }
    } else {
      bn.textContent =
        state.cur === state.total ? t('ui.nav.end') : t('ui.nav.next');
      info.textContent = t('ui.nav.slide-of', {
        current: state.cur,
        total: state.total
      });
      if (hint) hint.style.opacity = '0';
    }
  }

  function onKeydown(e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName)) {
      if (e.target.classList && e.target.classList.contains('lvbtn')) return;
      if (e.target.tagName !== 'BUTTON') return;
    }

    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      e.stopImmediatePropagation();
      next();
    } else if (e.key === 'ArrowLeft' || e.key === 'Backspace' || e.key === 'PageUp') {
      e.preventDefault();
      e.stopImmediatePropagation();
      prev();
    } else if (e.key === 'Home') {
      e.preventDefault();
      goTo(1);
    } else if (e.key === 'End') {
      e.preventDefault();
      goTo(state.total);
    }
  }

  function bindNavButtons() {
    var bp = d.getElementById('bprev');
    var bn = d.getElementById('bnext');
    if (!bp || !bn) return;

    var newPrev = bp.cloneNode(true);
    var newNext = bn.cloneNode(true);
    bp.parentNode.replaceChild(newPrev, bp);
    bn.parentNode.replaceChild(newNext, bn);

    newPrev.addEventListener('click', function (e) {
      e.preventDefault();
      prev();
    });
    newNext.addEventListener('click', function (e) {
      e.preventDefault();
      next();
    });
  }

  function init() {
    var slides = d.querySelectorAll('#deck .slide');
    if (!slides.length || !d.getElementById('bprev')) return false;

    state.rvCounts = {};
    slides.forEach(function (s) {
      state.rvCounts[s.id] = countReveals(s);
    });
    state.total = slides.length;
    state.cur = 1;
    state.revealed = 0;

    bindNavButtons();
    d.addEventListener('keydown', onKeydown, true);

    w.addEventListener('drama-slides-lang-change', function () {
      updateNav();
    });

    goTo(1);
    return true;
  }

  w.DramaSlidesDeck = {
    init: init,
    goTo: goTo,
    next: next,
    prev: prev,
    getState: function () {
      return state;
    }
  };
})(window, document);
