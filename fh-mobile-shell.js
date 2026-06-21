/**
 * Mobile sidebar drawer for Faculty Head Hub pages.
 * Skips drawer behaviour when html[data-fh-embed="1"] (inside Faculty Hub iframe).
 */
(function () {
  'use strict';

  var MOBILE_MQ = '(max-width: 880px)';

  function initFhMobileShell(opts) {
    opts = opts || {};
    var sidebar =
      document.getElementById(opts.sidebarId || 'fhSidebar') ||
      document.getElementById(opts.sidebarId || 'dashSidebar') ||
      document.querySelector(opts.sidebarSelector || '.fh-mobile-sidebar');

    if (!sidebar) return;

    sidebar.classList.add('fh-mobile-sidebar');
    sidebar.setAttribute('id', sidebar.id || 'fhSidebar');

    var toggleBtn = document.getElementById(opts.toggleId || 'fhNavToggle');
    var backdrop = document.getElementById('fhNavBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'fhNavBackdrop';
      backdrop.className = 'fh-nav-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.addEventListener('click', closeNav);
      document.body.appendChild(backdrop);
    }

    function isEmbed() {
      return document.documentElement.getAttribute('data-fh-embed') === '1';
    }

    function isHubPage() {
      return document.body.classList.contains('fh-hub-page');
    }

    function isMobileNav() {
      return !isEmbed() && !isHubPage() && window.matchMedia && window.matchMedia(MOBILE_MQ).matches;
    }

    function setOpen(open) {
      document.body.classList.toggle('fh-nav-open', !!open);
      sidebar.classList.toggle('open', !!open);
      if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggleBtn.setAttribute(
          'aria-label',
          open ? 'Close navigation menu' : 'Open navigation menu'
        );
      }
      backdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    function closeNav() {
      setOpen(false);
    }

    function toggleNav() {
      if (!isMobileNav()) return;
      setOpen(!sidebar.classList.contains('open'));
    }

    window.fhToggleSidebar = toggleNav;
    window.toggleSidebar = toggleNav;

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function (e) {
        e.preventDefault();
        toggleNav();
      });
    }

    sidebar.querySelectorAll('a[href], button.dash-nav-btn, button.nav-link').forEach(function (el) {
      el.addEventListener('click', function () {
        if (isMobileNav()) closeNav();
      });
    });

    window.addEventListener('resize', function () {
      if (!isMobileNav()) closeNav();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });

    if (isMobileNav()) closeNav();
    else if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
  }

  function boot() {
    initFhMobileShell(window.__fhMobileShellOpts);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.initFhMobileShell = initFhMobileShell;
})();
