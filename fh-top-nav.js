/**
 * Faculty Head Hub navigation: one sticky bar on every hub page, at every width.
 * Row 1 links back to the staff hub (hidden when the hub is embedded in it).
 * Row 2 holds the six sections from FH_NAV.primary. When the current section
 * has children (Classes & Staff, Leadership), row 3 shows them.
 */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function navHref(href) {
    return window.fhNavHref ? window.fhNavHref(href) : href;
  }

  function isEmbed() {
    return window.fhNavIsEmbed ? window.fhNavIsEmbed() : document.documentElement.getAttribute('data-fh-embed') === '1';
  }

  function tab(item, cls) {
    var active = window.fhNavIsActive(item);
    return (
      '<a class="' + cls + (active ? ' is-active' : '') + '" href="' + esc(navHref(item.href)) + '"' +
      (active ? ' aria-current="page"' : '') + '>' +
      esc(item.label) +
      '</a>'
    );
  }

  function activeSection(cfg) {
    var list = cfg.primary || [];
    for (var i = 0; i < list.length; i++) {
      if (window.fhNavIsActive(list[i])) return list[i];
    }
    return null;
  }

  function renderTopNav() {
    var cfg = window.FH_NAV;
    if (!cfg) return null;
    var home = cfg.home;
    var section = activeSection(cfg);

    var bar = isEmbed()
      ? ''
      : '<div class="fh-top-nav-bar">' +
          '<a class="fh-top-nav-staff" href="' + esc(home.href) + '" title="Back to the staff Faculty Hub">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>' +
            '<span>' + esc(home.shortLabel || home.label) + '</span>' +
          '</a>' +
          '<div class="fh-top-nav-title">Faculty Head Hub</div>' +
        '</div>';

    var tabs = (cfg.primary || []).map(function (item) { return tab(item, 'fh-top-nav-btn'); }).join('');
    var sub = section && section.children && section.children.length
      ? '<div class="fh-top-nav-sub" role="navigation" aria-label="' + esc(section.label) + '">' +
          section.children.map(function (item) { return tab(item, 'fh-top-nav-subbtn'); }).join('') +
        '</div>'
      : '';

    var el = document.createElement('header');
    el.className = 'fh-top-nav';
    el.id = 'fhTopNav';
    el.innerHTML =
      bar +
      '<nav class="fh-top-nav-scroll" aria-label="Faculty Head Hub sections">' + tabs + '</nav>' +
      sub;
    return el;
  }

  function updateChromeHeight() {
    var nav = document.getElementById('fhTopNav');
    if (nav) {
      document.documentElement.style.setProperty('--fh-top-nav-h', nav.offsetHeight + 'px');
    }
    // Measure only the chrome around the iframe (card margins, padding, heading),
    // never the iframe itself — including it makes the calc circular and can
    // collapse the frame to its min-height.
    var chrome = 0;
    var card = document.querySelector('.fh-hub-page .card');
    var frame = card ? card.querySelector('.page-frame') : null;
    if (nav && card && frame && !document.body.classList.contains('fh-page-full')) {
      var navRect = nav.getBoundingClientRect();
      var cardRect = card.getBoundingClientRect();
      var frameRect = frame.getBoundingClientRect();
      var above = Math.max(0, frameRect.top - navRect.bottom);
      var below = Math.max(0, cardRect.bottom - frameRect.bottom);
      var marginBottom = parseFloat(getComputedStyle(card).marginBottom) || 0;
      chrome = Math.round(above + below + marginBottom);
    }
    document.documentElement.style.setProperty('--fh-card-chrome-h', chrome + 'px');
  }

  function observeChrome(nav) {
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateChromeHeight);
      return;
    }
    var ro = new ResizeObserver(updateChromeHeight);
    ro.observe(nav);
    var card = document.querySelector('.fh-hub-page .card');
    if (card) ro.observe(card);
  }

  // On a phone the tab row scrolls sideways; keep the current tab in view.
  function revealActiveTab(nav) {
    var scroller = nav.querySelector('.fh-top-nav-scroll');
    var active = scroller && scroller.querySelector('.is-active');
    if (!active) return;
    var left = active.offsetLeft - scroller.offsetLeft;
    if (left + active.offsetWidth > scroller.clientWidth) {
      scroller.scrollLeft = left - 12;
    }
  }

  function mount() {
    if (!document.body.classList.contains('fh-hub-page')) return;
    var existing = document.getElementById('fhTopNav');
    if (existing) existing.remove();
    var nav = renderTopNav();
    if (!nav) return;
    document.body.insertBefore(nav, document.body.firstChild);
    document.body.classList.add('fh-has-top-nav');
    if (window.fhEmbedPatchLinks) window.fhEmbedPatchLinks();
    requestAnimationFrame(function () {
      updateChromeHeight();
      observeChrome(nav);
      revealActiveTab(nav);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
  window.addEventListener('resize', function () {
    var nav = document.getElementById('fhTopNav');
    if (nav) revealActiveTab(nav);
  });

  window.fhTopNavRefresh = mount;
})();
