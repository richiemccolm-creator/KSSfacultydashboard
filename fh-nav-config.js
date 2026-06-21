/**
 * Single source of truth for Faculty Head Hub navigation.
 * Used by sidebar (faculty_head_hub.html) and mobile top nav (fh-top-nav.js).
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
    { id: 'tracking', label: 'Tracking', href: 'fh_tracking.html', paths: ['fh_tracking.html', 'tracking_monitoring_landing.html'] },
    { id: 'classes', label: 'Classes', href: 'fh_class_management.html', paths: ['fh_class_management.html', 'class_management.html'] },
    { id: 'reports', label: 'Reports', href: 'fh_staff.html', paths: ['fh_staff.html'] }
  ],
  more: [
    {
      group: 'Faculty Head Hub',
      items: [
        { id: 'resources', label: 'Resources', href: 'fh_class_management.html' }
      ]
    },
    {
      group: 'Faculty Leadership',
      items: [
        { id: 'dip', label: 'Improvement Plan', href: 'faculty-hub.html?panel=dip-main' },
        { id: 'meetings', label: 'Meetings', href: 'fh_department_meetings.html', paths: ['fh_department_meetings.html', 'department_meetings.html'] },
        { id: 'class-visits', label: 'Class Visits', href: 'faculty-hub.html?panel=embed-class-visit' },
        { id: 'quality-cal', label: 'Quality Cal', href: 'faculty-hub.html?panel=embed-quality-calendar' },
        { id: 'dept-targets', label: 'Dept Targets', href: 'faculty-hub.html' }
      ]
    },
    {
      group: 'System',
      items: [
        { id: 'users', label: 'Users', href: 'fh_staff.html' },
        { id: 'backup', label: 'Backup', href: 'faculty-hub.html?panel=data-backup' },
        { id: 'audit', label: 'Audit Log', href: 'fh_staff.html' },
        { id: 'settings', label: 'Settings', href: 'fh_staff.html' },
        { id: 'procurement', label: 'Procurement', href: 'fh_procurement.html', paths: ['fh_procurement.html', 'purchase_orders.html'] }
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
