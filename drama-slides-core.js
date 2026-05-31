/**
 * Shared behaviour for drama lesson slide decks.
 * Include drama-slides-core.css + this script on every drama-slides-*.html file.
 */
(function (w, d) {
  'use strict';

  var ICON_EXPAND =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/>' +
    '<path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>' +
    '</svg>';

  var ICON_COMPRESS =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/>' +
    '<path d="M14 10l7-7"/><path d="M3 21l7-7"/>' +
    '</svg>';

  var btn = null;

  function isSupported() {
    return !!(
      d.documentElement.requestFullscreen ||
      d.documentElement.webkitRequestFullscreen ||
      d.documentElement.msRequestFullscreen
    );
  }

  function isFullscreen() {
    return !!(
      d.fullscreenElement ||
      d.webkitFullscreenElement ||
      d.msFullscreenElement
    );
  }

  function enterFullscreen() {
    var el = d.documentElement;
    var req =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.msRequestFullscreen;
    if (!req) return Promise.reject(new Error('Fullscreen not supported'));
    var result = req.call(el);
    return result && result.catch ? result : Promise.resolve();
  }

  function exitFullscreen() {
    var exit =
      d.exitFullscreen ||
      d.webkitExitFullscreen ||
      d.msExitFullscreen;
    if (!exit || !isFullscreen()) return Promise.resolve();
    var result = exit.call(d);
    return result && result.catch ? result : Promise.resolve();
  }

  function toggleFullscreen() {
    if (isFullscreen()) return exitFullscreen();
    return enterFullscreen();
  }

  function updateButton() {
    if (!btn) return;
    var on = isFullscreen();
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.title = on ? 'Exit fullscreen (F or Esc)' : 'Enter fullscreen (F)';
    btn.innerHTML = on ? ICON_COMPRESS : ICON_EXPAND;
    btn.classList.toggle('is-fullscreen', on);
  }

  function createButton() {
    var nav = d.getElementById('nav-controls');
    if (!nav || d.getElementById('btn-fullscreen') || !isSupported()) return;

    btn = d.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-btn nav-btn-fullscreen';
    btn.id = 'btn-fullscreen';
    btn.setAttribute('aria-label', 'Toggle fullscreen');
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      toggleFullscreen().catch(function () {});
    });

    var nextBtn = d.getElementById('btn-next');
    if (nextBtn) nav.insertBefore(btn, nextBtn);
    else nav.appendChild(btn);

    updateButton();
  }

  function onKeydown(e) {
    if (e.key !== 'f' && e.key !== 'F') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = (e.target && e.target.tagName) || '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
    e.preventDefault();
    toggleFullscreen().catch(function () {});
  }

  function onDeckDblClick(e) {
    if (e.target.closest('#nav-controls')) return;
    toggleFullscreen().catch(function () {});
  }

  function init() {
    createButton();
    d.addEventListener('keydown', onKeydown);
    ['fullscreenchange', 'webkitfullscreenchange', 'MSFullscreenChange'].forEach(function (ev) {
      d.addEventListener(ev, updateButton);
    });

    var deck = d.getElementById('deck');
    if (deck) deck.addEventListener('dblclick', onDeckDblClick);
  }

  w.DramaSlidesCore = {
    init: init,
    isSupported: isSupported,
    isFullscreen: isFullscreen,
    enterFullscreen: enterFullscreen,
    exitFullscreen: exitFullscreen,
    toggleFullscreen: toggleFullscreen
  };

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init);
  else init();
})(window, document);
