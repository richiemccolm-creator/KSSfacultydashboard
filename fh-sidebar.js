/**
 * Renders Faculty Head Hub desktop sidebar from FH_NAV.sidebar.
 */
(function () {
  'use strict';

  var ICONS = {
    home: '<path d="M3 12l9-9 9 9"/><path d="M9 21V9h6v12"/>',
    calendar:
      '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    announce:
      '<path d="M3 11v2a2 2 0 0 0 2 2h3l5 4V5L8 9H5a2 2 0 0 0-2 2z"/><path d="M16 9a5 5 0 0 1 0 6"/>',
    tracking:
      '<line x1="4" y1="20" x2="4" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="20" y1="20" x2="20" y2="13"/>',
    classes:
      '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>',
    reports:
      '<path d="M4 20h16"/><path d="M7 20V8h10v12"/><path d="M10 12h4"/>',
    resources: '<path d="M12 2v20"/><path d="M2 12h20"/>',
    dip: '<path d="M12 20l9-5-9-5-9 5 9 5z"/><path d="M12 12l9-5-9-5-9 5 9 5z"/>',
    meetings:
      '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>',
    visits:
      '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    quality:
      '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    targets: '<path d="M4 12h16"/><path d="M12 4v16"/>',
    users:
      '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
    backup:
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/>',
    audit: '<path d="M3 3v18h18"/><path d="M7 14l3-3 3 2 4-5"/>',
    settings:
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06"/>',
    procurement:
      '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function iconSvg(name) {
    var paths = ICONS[name] || ICONS.home;
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      paths +
      '</svg>'
    );
  }

  function renderLink(item) {
    var href = window.fhNavHref ? window.fhNavHref(item.href) : item.href;
    var active = window.fhNavIsActive(item) ? ' active' : '';
    var label = item.sidebarLabel || item.label;
    return (
      '<a class="nav-link' +
      active +
      '" href="' +
      esc(href) +
      '">' +
      iconSvg(item.icon || 'home') +
      esc(label) +
      '</a>'
    );
  }

  function render() {
    var mount = document.getElementById('fhSidebarNav');
    var cfg = window.FH_NAV;
    if (!mount || !cfg || !cfg.sidebar) return;

    mount.innerHTML = cfg.sidebar
      .map(function (section) {
        var links = (section.items || []).map(renderLink).join('');
        return (
          '<div class="group-title">' +
          esc(section.group) +
          '</div>' +
          links
        );
      })
      .join('');

    if (window.fhEmbedPatchLinks) window.fhEmbedPatchLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }

  window.fhSidebarRefresh = render;
})();
