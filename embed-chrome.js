/**
 * When loaded with ?embed=1, hides duplicate navigation so the page fits inside Faculty Hub iframes.
 * Exception: tools whose own .dash-sidebar is the main UI (Triangulation) keep that sidebar visible
 * when embedded.
 * "Back to Faculty Hub" links use target="_top" to exit the iframe.
 */
(function () {
  var fromQuery = false;
  var fromSession = false;
  var pageName = '';
  try {
    var q = new URLSearchParams(window.location.search);
    fromQuery = q.get('embed') === '1' || q.get('embed') === 'true';
    pageName = (window.location.pathname || '').split('/').pop() || '';
  } catch (e) {
    return;
  }
  try {
    if (fromQuery) {
      sessionStorage.setItem('fh-embed', '1');
    } else {
      fromSession = sessionStorage.getItem('fh-embed') === '1';
    }
  } catch (e2) {}
  if (!fromQuery && (pageName === 'faculty_head_hub.html' || pageName === 'faculty-hub.html')) {
    try {
      sessionStorage.removeItem('fh-embed');
    } catch (e3) {}
    return;
  }
  if (!fromQuery && !fromSession) return;
  /** Pages that use .dash-sidebar as primary in-app nav (not duplicate Faculty Hub chrome). */
  var path = '';
  try {
    path = window.location.pathname || '';
  } catch (e2) {}
  var p = (path + '').toLowerCase();
  var keepDashChrome =
    p.indexOf('triangulation_evidence.html') !== -1;

  document.documentElement.setAttribute('data-fh-embed', '1');
  var css =
    'html[data-fh-embed="1"] .sidebar{display:none!important}' +
    'html[data-fh-embed="1"] .main{margin-left:0!important}' +
    'html[data-fh-embed="1"] .app{display:block!important;min-height:100vh}' +
    (keepDashChrome
      ? ''
      : 'html[data-fh-embed="1"] .dash-sidebar{display:none!important}' +
        'html[data-fh-embed="1"] .dash-main{margin-left:0!important;max-width:none}' +
        'html[data-fh-embed="1"] body[style*="display:flex"]{display:block!important}') +
    'html[data-fh-embed="1"] .site-header{display:none!important}' +
    'html[data-fh-embed="1"] .view-tabs{top:0!important}' +
    'html[data-fh-embed="1"] .controls-bar.gantt-mode,' +
    'html[data-fh-embed="1"] .controls-bar{top:48px!important}' +
    'html[data-fh-embed="1"] .planner-logo-link{display:none!important}' +
    'html[data-fh-embed="1"] .planner-nav a[href="faculty-hub.html"]{display:none!important}' +
    'html[data-fh-embed="1"] .tasks-logo-link{display:none!important}' +
    'html[data-fh-embed="1"] .tasks-nav a[href="faculty-hub.html"]{display:none!important}' +
    'html[data-fh-embed="1"] .dm-hero.no-print{display:none!important}' +
    'html[data-fh-embed="1"] #dm-admin-strip{margin-top:0}';
  var s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);

  function hubTop(a) {
    var h = a.getAttribute('href');
    if (!h) return;
    if (h === 'faculty-hub.html' || h.indexOf('faculty-hub.html') === 0) a.setAttribute('target', '_top');
  }
  function patchLinks() {
    document.querySelectorAll('a[href]').forEach(hubTop);
    document.querySelectorAll('a[href="teacher_planner.html"]').forEach(function (a) {
      a.setAttribute('href', 'teacher_planner.html?embed=1');
    });
    document.querySelectorAll('a[href="teacher_tasks.html"]').forEach(function (a) {
      a.setAttribute('href', 'teacher_tasks.html?embed=1');
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchLinks);
  } else {
    patchLinks();
  }
  window.fhEmbedPatchLinks = patchLinks;
})();
