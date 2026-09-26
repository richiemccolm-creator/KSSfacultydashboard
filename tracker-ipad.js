/* iPad shell for the BGE trackers. Desktop is left to the existing sidebar. */
(function () {
  var land = window.matchMedia('(pointer: coarse) and (orientation: landscape) and (min-width: 744px) and (max-width: 1400px)');
  var port = window.matchMedia('(pointer: coarse) and (orientation: portrait) and (min-width: 744px) and (max-width: 1100px)');

  function mode() {
    if (port.matches) return 'portrait';
    if (land.matches) return 'landscape';
    return '';
  }

  function apply() {
    var next = mode();
    document.documentElement.dataset.ipad = next;
    if (!next) {
      document.body.classList.remove('ipad-nav-open');
      return;
    }
    document.body.classList.add('body-sidebar-collapsed');
    document.body.classList.remove('ipad-nav-open');
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
  if (land.addEventListener) {
    land.addEventListener('change', apply);
    port.addEventListener('change', apply);
  }
})();
