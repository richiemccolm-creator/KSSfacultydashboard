/**
 * Single source of truth for Faculty Head Hub navigation.
 * Used by sidebar, mobile top nav, and overview action links.
 */
window.FH_NAV = {
  home: {
    id: 'faculty-hub',
    label: 'Faculty Hub',
    shortLabel: 'Staff Hub',
    href: 'faculty-hub.html'
  },
  fhHub: {
    id: 'overview',
    label: 'Faculty Head Hub',
    shortLabel: 'Hub',
    href: 'faculty_head_hub.html',
    paths: ['faculty_head_hub.html']
  },
  primary: [
    { id: 'overview', label: 'Overview', href: 'faculty_head_hub.html', paths: ['faculty_head_hub.html'] },
    { id: 'calendar', label: 'Calendar', href: 'fh_calendar.html', paths: ['fh_calendar.html'] },
    { id: 'announcements', label: 'Announce', href: 'fh_announcements.html', paths: ['fh_announcements.html'] },
    {
      id: 'tracking',
      label: 'Tracking',
      href: 'fh_tracking.html',
      paths: ['fh_tracking.html', 'tracking_monitoring_landing.html']
    },
    {
      id: 'classes',
      label: 'Classes',
      href: 'fh_class_management.html',
      paths: ['fh_class_management.html', 'class_management.html']
    },
    { id: 'reports', label: 'Reports', href: 'fh_staff.html', paths: ['fh_staff.html'] }
  ],
  more: [
    {
      group: 'Faculty Head Hub',
      items: [{ id: 'resources', label: 'Resources', href: 'fh_class_management.html' }]
    },
    {
      group: 'Faculty Leadership',
      items: [
        { id: 'dip', label: 'Improvement Plan', href: 'faculty-hub.html?panel=dip-main' },
        {
          id: 'meetings',
          label: 'Meetings',
          href: 'fh_department_meetings.html',
          paths: ['fh_department_meetings.html', 'department_meetings.html']
        },
        { id: 'class-visits', label: 'Class Visits', href: 'faculty-hub.html?panel=embed-class-visit' },
        { id: 'quality-cal', label: 'Quality Cal', href: 'faculty-hub.html?panel=embed-quality-calendar' },
        { id: 'dept-targets', label: 'Dept Targets', href: 'faculty-hub.html?panel=dip-main' }
      ]
    },
    {
      group: 'System',
      items: [
        { id: 'users', label: 'Users', href: 'fh_staff.html' },
        { id: 'backup', label: 'Backup', href: 'faculty-hub.html?panel=data-backup' },
        { id: 'procurement', label: 'Procurement', href: 'fh_procurement.html', paths: ['fh_procurement.html', 'purchase_orders.html'] }
      ]
    }
  ],
  sidebar: [
    {
      group: 'Faculty Head Hub',
      items: [
        {
          id: 'overview',
          label: 'Overview',
          sidebarLabel: 'Overview',
          href: 'faculty_head_hub.html',
          icon: 'home',
          paths: ['faculty_head_hub.html']
        },
        {
          id: 'calendar',
          label: 'Calendar',
          sidebarLabel: 'Calendar Manager',
          href: 'fh_calendar.html',
          icon: 'calendar',
          paths: ['fh_calendar.html']
        },
        {
          id: 'announcements',
          label: 'Announce',
          sidebarLabel: 'Announcements',
          href: 'fh_announcements.html',
          icon: 'announce',
          paths: ['fh_announcements.html']
        },
        {
          id: 'tracking',
          label: 'Tracking',
          sidebarLabel: 'Tracking Manager',
          href: 'fh_tracking.html',
          icon: 'tracking',
          paths: ['fh_tracking.html', 'tracking_monitoring_landing.html']
        },
        {
          id: 'classes',
          label: 'Classes',
          sidebarLabel: 'Class & Staff',
          href: 'fh_class_management.html',
          icon: 'classes',
          paths: ['fh_class_management.html', 'class_management.html']
        },
        {
          id: 'reports',
          label: 'Reports',
          sidebarLabel: 'Reports & Data',
          href: 'fh_staff.html',
          icon: 'reports',
          paths: ['fh_staff.html']
        },
        {
          id: 'resources',
          label: 'Resources',
          sidebarLabel: 'Resources Manager',
          href: 'fh_class_management.html',
          icon: 'resources',
          paths: ['fh_class_management.html', 'class_management.html']
        }
      ]
    },
    {
      group: 'Faculty Leadership',
      items: [
        {
          id: 'dip',
          label: 'Improvement Plan',
          sidebarLabel: 'Improvement Plan',
          href: 'faculty-hub.html?panel=dip-main',
          icon: 'dip'
        },
        {
          id: 'meetings',
          label: 'Meetings',
          sidebarLabel: 'Meetings & Minutes',
          href: 'fh_department_meetings.html',
          icon: 'meetings',
          paths: ['fh_department_meetings.html', 'department_meetings.html']
        },
        {
          id: 'class-visits',
          label: 'Class Visits',
          sidebarLabel: 'Class Visits',
          href: 'faculty-hub.html?panel=embed-class-visit',
          icon: 'visits'
        },
        {
          id: 'quality-cal',
          label: 'Quality Cal',
          sidebarLabel: 'Quality Calendar',
          href: 'faculty-hub.html?panel=embed-quality-calendar',
          icon: 'quality'
        },
        {
          id: 'dept-targets',
          label: 'Dept Targets',
          sidebarLabel: 'Department Targets',
          href: 'faculty-hub.html?panel=dip-main',
          icon: 'targets'
        }
      ]
    },
    {
      group: 'System',
      items: [
        {
          id: 'users',
          label: 'Users',
          sidebarLabel: 'Users & Permissions',
          href: 'fh_staff.html',
          icon: 'users',
          paths: ['fh_staff.html']
        },
        {
          id: 'backup',
          label: 'Backup',
          sidebarLabel: 'Backup & Restore',
          href: 'faculty-hub.html?panel=data-backup',
          icon: 'backup'
        },
        {
          id: 'procurement',
          label: 'Procurement',
          sidebarLabel: 'Procurement',
          href: 'fh_procurement.html',
          icon: 'procurement',
          paths: ['fh_procurement.html', 'purchase_orders.html']
        }
      ]
    }
  ]
};

window.fhNavCurrentPath = function () {
  var path = '';
  try {
    path = (window.location.pathname || '').split('/').pop() || '';
  } catch (e) {
    path = '';
  }
  return path.toLowerCase();
};

window.fhNavIsEmbed = function () {
  if (document.documentElement.getAttribute('data-fh-embed') === '1') return true;
  try {
    var q = new URLSearchParams(window.location.search);
    if (q.get('embed') === '1' || q.get('embed') === 'true') return true;
  } catch (e) {}
  try {
    return sessionStorage.getItem('fh-embed') === '1';
  } catch (e2) {
    return false;
  }
};

window.fhNavHref = function (href, opts) {
  var h = String(href || '');
  if (!h || h.indexOf('#') === 0) return h;
  opts = opts || {};
  var isHubLink = h === 'faculty-hub.html' || h.indexOf('faculty-hub.html') === 0;
  if (isHubLink) return h;
  if (!window.fhNavIsEmbed() && !opts.forceEmbed) return h;
  if (/\bembed=1\b/.test(h)) return h;
  var join = h.indexOf('?') === -1 ? '?' : '&';
  return h + join + 'embed=1';
};

window.fhNavGo = function (href) {
  window.location.href = window.fhNavHref(href);
};

window.fhNavIsActive = function (item) {
  if (!item) return false;
  var path = window.fhNavCurrentPath();
  var paths = item.paths || [item.href.split('?')[0].split('/').pop()];
  if (paths.some(function (p) { return p.toLowerCase() === path; })) return true;
  if (item.href && item.href.indexOf('?') !== -1) {
    try {
      var want = new URL(item.href, window.location.href);
      if (want.pathname.split('/').pop().toLowerCase() === path) {
        var q = new URLSearchParams(window.location.search);
        var wantPanel = want.searchParams.get('panel');
        if (wantPanel && q.get('panel') === wantPanel) return true;
      }
    } catch (e2) {}
  }
  return false;
};

window.fhNavPatchPageLinks = function (root) {
  var scope = root || document;
  scope.querySelectorAll('a[href]').forEach(function (a) {
    var href = a.getAttribute('href');
    if (!href || href.indexOf('#') === 0) return;
    if (href.indexOf('faculty-hub.html') === 0) return;
    if (/^fh_|^faculty_head_hub\.html|^tracking_monitoring/.test(href)) {
      a.setAttribute('href', window.fhNavHref(href));
    }
  });
};
