/* iPad shell for the BGE trackers. Desktop is left to the existing sidebar. */
(function () {
  var tabletSize = window.matchMedia('(min-width: 744px) and (max-width: 1480px)');
  var portrait = window.matchMedia('(orientation: portrait)');

  function isTouchTablet() {
    if (!tabletSize.matches) return false;
    if (navigator.maxTouchPoints > 1) return true;
    return window.matchMedia('(pointer: coarse), (any-pointer: coarse)').matches;
  }

  function mode() {
    if (!isTouchTablet()) return '';
    return portrait.matches ? 'portrait' : 'landscape';
  }

  function markYearRails() {
    document.querySelectorAll('.sb-item[data-panel]').forEach(function (btn) {
      var panel = btn.getAttribute('data-panel') || '';
      var match = panel.match(/^(?:setup|tracker)-s([123])$/);
      if (match) btn.dataset.railYear = match[1];
      else delete btn.dataset.railYear;
    });
  }

  var current = '';

  function apply() {
    markYearRails();
    var next = mode();
    document.documentElement.dataset.ipad = next;
    if (next === current) return;
    current = next;
    document.body.classList.remove('ipad-nav-open');
    if (next) document.body.classList.add('body-sidebar-collapsed');
  }

  window.trackerIpadToggle = function () {
    if (!mode()) return false;
    document.body.classList.toggle('ipad-nav-open');
    return true;
  };

  window.trackerIpadClose = function () {
    if (mode()) document.body.classList.remove('ipad-nav-open');
  };

  apply();
  if (tabletSize.addEventListener) {
    tabletSize.addEventListener('change', apply);
    portrait.addEventListener('change', apply);
  }
  window.addEventListener('resize', apply);
})();
