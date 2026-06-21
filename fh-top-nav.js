/**
 * Sticky mobile top navigation for Faculty Head Hub (iPhone Safari).
 */
(function () {
  'use strict';

  var MOBILE_MQ = '(max-width: 880px)';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isMobile() {
    return window.matchMedia && window.matchMedia(MOBILE_MQ).matches;
  }

  function isEmbed() {
    return document.documentElement.getAttribute('data-fh-embed') === '1';
  }

  function isOnFhOverview() {
    var hub = window.FH_NAV && window.FH_NAV.fhHub;
    return hub && window.fhNavIsActive(hub);
  }

  function shouldShowTopNav() {
    if (document.body.classList.contains('fh-hub-page')) {
      if (isOnFhOverview()) {
        /* Embedded in Faculty Hub iframe: always show (iframe width jumps when parent sidebar toggles). */
        if (isEmbed()) return true;
        return isMobile();
      }
      return true;
    }
    if (!isMobile()) return false;
    if (isEmbed()) return false;
    return document.body.classList.contains('fh-mobile-page');
  }

  function currentPageLabel() {
    var cfg = window.FH_NAV;
    if (!cfg) return 'Faculty Head';
    var all = (cfg.primary || []).concat(
      (cfg.more || []).reduce(function (acc, g) { return acc.concat(g.items || []); }, [])
    );
    for (var i = 0; i < all.length; i++) {
      if (window.fhNavIsActive(all[i])) return all[i].label;
    }
    return 'Faculty Head';
  }

  function buildPrimaryBtn(item) {
    var active = window.fhNavIsActive(item) ? ' is-active' : '';
    return (
      '<a class="fh-top-nav-btn' + active + '" href="' + esc(item.href) + '">' +
      esc(item.label) +
      '</a>'
    );
  }

  function buildMoreLink(item) {
    var active = window.fhNavIsActive(item) ? ' is-active' : '';
    return (
      '<a class="fh-more-sheet-link' + active + '" href="' + esc(item.href) + '">' +
      esc(item.label) +
      '</a>'
    );
  }

  function renderTopNav() {
    var cfg = window.FH_NAV;
    if (!cfg) return null;

    var home = cfg.home;
    var fhHub = cfg.fhHub || { href: 'faculty_head_hub.html', shortLabel: 'Hub', label: 'Faculty Head Hub' };
    var onOverview = isOnFhOverview();
    var primary = (cfg.primary || []).map(buildPrimaryBtn).join('');
    var pageTitle = onOverview ? 'Faculty Head Hub' : currentPageLabel();

    var backLink = onOverview
      ? ''
      : '<a class="fh-top-nav-back" href="' + esc(fhHub.href) + '" aria-label="Back to Faculty Head Hub overview">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
        '<polyline points="15 18 9 12 15 6"/>' +
        '</svg>' +
        '<span>' + esc(fhHub.shortLabel || 'Hub') + '</span>' +
        '</a>';

    var moreSections = (cfg.more || [])
      .map(function (section) {
        var links = (section.items || []).map(buildMoreLink).join('');
        return (
          '<div class="fh-more-sheet-group">' +
          '<div class="fh-more-sheet-label">' + esc(section.group) + '</div>' +
          links +
          '</div>'
        );
      })
      .join('');

    var staffView =
      '<a class="fh-more-sheet-link fh-more-sheet-staff" href="' + esc(home.href) + '">' +
      esc(home.label) + ' (staff view)' +
      '</a>' +
      '<a class="fh-more-sheet-link" href="' + esc(fhHub.href) + '">' +
      esc(fhHub.label) + ' overview' +
      '</a>';

    var el = document.createElement('header');
    el.className = 'fh-top-nav';
    el.id = 'fhTopNav';
    el.setAttribute('role', 'navigation');
    el.setAttribute('aria-label', 'Faculty Head Hub');
    var overviewHome = onOverview
      ? '<a class="fh-top-nav-home" href="' + esc(fhHub.href) + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
        '<path d="M3 12l9-9 9 9"/><path d="M9 21V9h6v12"/>' +
        '</svg>' +
        '<span>Overview</span>' +
        '</a>'
      : '';

    el.innerHTML =
      '<div class="fh-top-nav-bar">' +
      backLink +
      overviewHome +
      '<a class="fh-top-nav-staff" href="' + esc(home.href) + '" title="' + esc(home.label) + '">' +
      esc(home.shortLabel || home.label) +
      '</a>' +
      '<div class="fh-top-nav-title">' + esc(pageTitle) + '</div>' +
      '<button type="button" class="fh-top-nav-more-btn" id="fhMoreToggle" aria-expanded="false" aria-controls="fhMoreSheet" aria-label="More navigation">' +
      'More' +
      '</button>' +
      '</div>' +
      '<div class="fh-top-nav-scroll" tabindex="0">' +
      primary +
      '</div>' +
      '<div class="fh-more-sheet" id="fhMoreSheet" aria-hidden="true">' +
      moreSections +
      staffView +
      '</div>' +
      '<div class="fh-more-backdrop" id="fhMoreBackdrop" aria-hidden="true"></div>';

    return el;
  }

  function closeMore() {
    var sheet = document.getElementById('fhMoreSheet');
    var btn = document.getElementById('fhMoreToggle');
    var backdrop = document.getElementById('fhMoreBackdrop');
    document.body.classList.remove('fh-more-open');
    if (sheet) sheet.setAttribute('aria-hidden', 'true');
    if (backdrop) backdrop.setAttribute('aria-hidden', 'true');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function openMore() {
    var sheet = document.getElementById('fhMoreSheet');
    var btn = document.getElementById('fhMoreToggle');
    var backdrop = document.getElementById('fhMoreBackdrop');
    document.body.classList.add('fh-more-open');
    if (sheet) sheet.setAttribute('aria-hidden', 'false');
    if (backdrop) backdrop.setAttribute('aria-hidden', 'false');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }

  function toggleMore() {
    if (document.body.classList.contains('fh-more-open')) closeMore();
    else openMore();
  }

  function mount() {
    var existing = document.getElementById('fhTopNav');
    if (existing) existing.remove();

    if (!shouldShowTopNav()) {
      document.body.classList.remove('fh-has-top-nav', 'fh-more-open', 'fh-hub-subpage');
      return;
    }

    var nav = renderTopNav();
    if (!nav) return;

    document.body.insertBefore(nav, document.body.firstChild);
    document.body.classList.add('fh-has-top-nav');
    document.body.classList.toggle(
      'fh-hub-subpage',
      document.body.classList.contains('fh-hub-page') && !isOnFhOverview()
    );

    var moreBtn = document.getElementById('fhMoreToggle');
    var backdrop = document.getElementById('fhMoreBackdrop');
    if (moreBtn) moreBtn.addEventListener('click', toggleMore);
    if (backdrop) backdrop.addEventListener('click', closeMore);

    nav.querySelectorAll('.fh-more-sheet-link').forEach(function (a) {
      a.addEventListener('click', closeMore);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMore();
    });

    if (window.fhEmbedPatchLinks) window.fhEmbedPatchLinks();
  }

  function init() {
    mount();
    window.addEventListener('resize', function () {
      closeMore();
      mount();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.fhTopNavRefresh = mount;
})();
