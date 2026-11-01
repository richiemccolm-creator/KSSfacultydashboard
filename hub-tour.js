/**
 * hub-tour.js — on-screen walkthrough of the Faculty Hub.
 *
 * Opens each page in turn and spotlights the real sidebar items, tabs and buttons,
 * with a step box beside them. Targets inside embedded tools (iframes) are found in
 * the tool's own page. When a target is not on screen (for example a card that is
 * hidden for this user), the step falls back to the next candidate, then the whole
 * page, so the tour never stalls.
 *
 * Start it with window.startHubTour() or faculty-hub.html?tour=1.
 */
(function () {
  'use strict';

  var STORE_KEY = 'fh-hub-tour-v1';
  var WAIT_MS = 8000;

  function f(panel, sel, text) {
    return { frame: '#' + panel + ' iframe', sel: sel, text: text };
  }
  function side(panel) {
    return '.sidebar .sidebar-item[data-panel="' + panel + '"]';
  }

  // target: one selector/frame target, or a list tried in order. Body copy is trusted HTML.
  var STEPS = [
    // Getting around
    { chapter: 'Getting around', panel: 'home', centre: true,
      title: 'Welcome to the Faculty Hub',
      body: 'This tour opens each part of the hub and points to the tabs and buttons you will use. It takes about ten minutes. You can leave at any time and pick up where you stopped.' },
    { chapter: 'Getting around', panel: 'home', target: '.sidebar',
      title: 'The sidebar is your map',
      body: 'Every page in the hub opens from here. It is grouped into <strong>Faculty hub</strong>, <strong>Planning and assessment</strong>, <strong>School leadership</strong>, <strong>Improvement plan</strong> and <strong>Curriculum</strong>.' },
    { chapter: 'Getting around', panel: 'home', target: '.sidebar-logo-link',
      title: 'Back to Home',
      body: 'Click the Faculty Hub logo from anywhere to come back to Home.' },
    { chapter: 'Getting around', panel: 'home', target: '#topbar-heading',
      title: 'Where you are',
      body: 'The bar across the top always names the page you are on.' },
    { chapter: 'Getting around', panel: 'home', target: '.topbar-actions',
      title: 'Refresh app and Print',
      body: '<strong>Refresh app</strong> loads the latest version of the hub and your data. Try it first if anything looks out of date. <strong>Print</strong> prints the page you are on.' },

    // Home
    { chapter: 'Home', panel: 'home', target: '.home-register-plate',
      title: 'Your Home page',
      body: 'Home greets you with today\'s date and anything urgent from your faculty head.' },
    { chapter: 'Home', panel: 'home', target: '#homeNotifBellBtn',
      title: 'Notifications',
      body: 'The bell shows a red count when something needs you, such as a calendar request being approved. Click it to read them.' },
    { chapter: 'Home', panel: 'home', target: ['#homeStaffPostits:not([hidden])', '.home-masthead-row'],
      title: 'Post-its from colleagues',
      body: 'Notes colleagues send you stick here until you click <strong>Got it</strong>. React with a thumbs up or a heart. Use <strong>Send a post-it</strong> to leave one for someone else, and <strong>All post-its</strong> to see everything sent and received this year.' },
    { chapter: 'Home', panel: 'home', target: '#homeAnnouncementsCard',
      title: 'Announcements',
      body: 'Faculty notices, with priority ones at the top. <strong>View all</strong> opens every current notice.' },
    { chapter: 'Home', panel: 'home', target: '.home-dates-card',
      title: 'Key dates and deadlines',
      body: 'What is coming up in the next few weeks. <strong>Calendar</strong> opens the full Academic Calendar.' },
    { chapter: 'Home', panel: 'home', target: '.home-day-timetable',
      title: 'Today\'s timetable',
      body: 'Your lessons for today, taken from the faculty timetable.' },
    { chapter: 'Home', panel: 'home', target: '#homeTasksCard',
      title: 'My tasks',
      body: 'Tick off jobs here, or type a new one in the box at the bottom. They are the same tasks as the My tasks page.',
      doThis: 'Add one task you need to do this week.' },
    { chapter: 'Home', panel: 'home', target: ['#homeStickyNotes', '#homeTasksCard'],
      title: 'Sticky notes',
      body: 'Private reminders that only you can see. Use them for anything you want in front of you tomorrow morning.' },
    { chapter: 'Home', panel: 'home', target: ['#homeTrackingCard', '#homeQualityFocus'],
      title: 'Tracking progress and quality focus',
      body: 'How your classes are getting on with tracking, and the quality assurance focus for this month. Use <strong>Hide</strong> on any card you do not need.' },
    { chapter: 'Home', panel: 'home', target: '.home-jump',
      title: 'Jump to',
      body: 'Shortcuts to the places teachers use most: lesson slides, tracking, reports and the Classroom Toolkit.' },

    // Faculty hub pages
    { chapter: 'Faculty hub pages', panel: 'home', target: side('embed-operations'),
      title: 'School work',
      body: 'Your weekly control centre. We will open it now.' },
    { chapter: 'Faculty hub pages', panel: 'embed-operations', target: [f('embed-operations', '.hub-nav button', 'Today'), '#embed-operations'],
      title: 'School work tabs',
      body: '<strong>Today</strong> and <strong>My Week</strong> show what is on. <strong>Classes</strong> lists your groups and <strong>Class Support</strong> gathers support needs for each class.' },
    { chapter: 'Faculty hub pages', panel: 'embed-operations', target: [f('embed-operations', '.hub-nav button', 'Class Support'), '#embed-operations'],
      title: 'Class Support',
      body: 'Check this before you teach a class for the first time, and whenever a support plan changes.' },
    { chapter: 'Faculty hub pages', panel: 'academic-calendar', target: side('academic-calendar'),
      title: 'Academic Calendar',
      body: 'Glasgow term dates, holidays and faculty events for the year, plus your own dates.' },
    { chapter: 'Faculty hub pages', panel: 'academic-calendar', target: ['.cal-jump-add', '#academic-calendar'],
      title: 'Add an event',
      body: 'Use <strong>+ Add event</strong> for a personal date. If the whole faculty should see it, such as an absence or a trip, choose <strong>Request shared calendar approval</strong> and your faculty head will review it.' },
    { chapter: 'Faculty hub pages', panel: 'embed-faculty-timetable', target: [f('embed-faculty-timetable', '.filter-btn', 'All Staff'), '#embed-faculty-timetable'],
      title: 'Faculty Timetable',
      body: 'Everyone\'s timetable in one grid. Switch between <strong>All Staff</strong>, <strong>Drama</strong> and <strong>Art &amp; Photography</strong>, or pick one teacher, to find a colleague or a free room.' },
    { chapter: 'Faculty hub pages', panel: 'embed-learning-teaching', target: [f('embed-learning-teaching', '#ltSidebarAllCourses'), '#embed-learning-teaching'],
      title: 'Learning & Teaching: courses',
      body: 'Short professional learning courses. Finish one, pass its exit quiz and download a certificate for your CLPL record.' },
    { chapter: 'Faculty hub pages', panel: 'embed-learning-teaching', target: [f('embed-learning-teaching', '#ltSidebarTools'), '#embed-learning-teaching'],
      title: 'Learning & Teaching: tools',
      body: 'Builders for learning intentions, success criteria and retrieval activities. Copy what they make straight into a lesson.' },
    { chapter: 'Faculty hub pages', panel: 'embed-policies', target: [f('embed-policies', '#policyFilterRow'), '#embed-policies'],
      title: 'School Policies',
      body: 'The official school policies. Filter the list, open one and use its table of contents to jump to the part you need.' },
    { chapter: 'Faculty hub pages', panel: 'embed-tracking-monitoring-hub', target: ['#embed-tracking-monitoring-hub'],
      title: 'Tracking & Monitoring',
      body: 'The faculty view of progress. Choose <strong>BGE Phase</strong> for S1 to S3 or <strong>Senior Phase</strong> for qualification courses. It is built from the scores in your tracker.' },

    // Planning and assessment
    { chapter: 'Planning and assessment', panel: 'home', target: 'nav.sidebar-nav-group[aria-label="Planning and assessment"]',
      title: 'Planning and assessment',
      body: 'Your trackers, planner, tasks and classroom tools. We will look at each one.' },
    { chapter: 'Planning and assessment', panel: 'drama-tracker', target: side('drama-tracker'),
      title: 'Subject trackers',
      body: 'Drama, Art and NPA each have a tracker. They all work the same way, so we will use the Drama Tracker.' },
    { chapter: 'Planning and assessment', panel: 'drama-tracker', target: [f('drama-tracker', '.sb-item[data-panel="setup-s1"]'), '#drama-tracker'],
      title: 'Set Up Classes',
      body: 'Each year has a <strong>Set Up Classes</strong> page. Check your classes and pupils are here. Your faculty head usually sends BGE class lists to your tracker. Tell them if a pupil is missing.' },
    { chapter: 'Planning and assessment', panel: 'drama-tracker', target: [f('drama-tracker', '.sb-item[data-panel="tracker-s1"]'), '#drama-tracker'],
      title: 'Enter Scores',
      body: 'Pick the year, then the class and the tracking point, and tap 1 to 4 (or N/A) for each pupil.' },
    { chapter: 'Planning and assessment', panel: 'drama-tracker', target: [f('drama-tracker', '.sb-item[data-panel="profiles"]'), '#drama-tracker'],
      title: 'Pupil Profiles',
      body: 'One pupil\'s whole record in one place, for learner conversations and parents\' evenings.' },
    { chapter: 'Planning and assessment', panel: 'drama-tracker', target: [f('drama-tracker', '.sb-item[data-panel="export"]'), '#drama-tracker'],
      title: 'Export & Send',
      body: 'Use this when your faculty head asks for a snapshot of your tracking.' },
    { chapter: 'Planning and assessment', panel: 'embed-teacher-planner', target: side('embed-teacher-planner'),
      title: 'Teacher Planner',
      body: 'Your timetable, lesson plans and lesson bank. It also works on an iPad with an Apple Pencil.' },
    { chapter: 'Planning and assessment', panel: 'embed-teacher-planner', target: [f('embed-teacher-planner', '.planner-tab[data-tab="timetable"]'), '#embed-teacher-planner'],
      title: 'Start with Timetable',
      body: 'Set this up once. Choose <strong>Import faculty timetable</strong>, pick your name, adjust any period and save. Your classes then appear across the planner.' },
    { chapter: 'Planning and assessment', panel: 'embed-teacher-planner', target: [f('embed-teacher-planner', '.planner-tab[data-tab="today"]'), '#embed-teacher-planner'],
      title: 'Today, Week and Month',
      body: 'Use <strong>Today</strong> on teaching days, and <strong>Week</strong> or <strong>Month</strong> to plan ahead. Click any lesson to plan it.' },
    { chapter: 'Planning and assessment', panel: 'embed-teacher-planner', target: [f('embed-teacher-planner', '.planner-tab[data-tab="bank"]'), '#embed-teacher-planner'],
      title: 'Lesson Bank',
      body: 'Save lessons you reuse, then schedule them onto a class from here.' },
    { chapter: 'Planning and assessment', panel: 'embed-teacher-planner', target: [f('embed-teacher-planner', '.planner-tab[data-tab="schemes"]'), '#embed-teacher-planner'],
      title: 'Schemes',
      body: 'Ready-made units to plan from, so you are not starting with a blank page.' },
    { chapter: 'Planning and assessment', panel: 'embed-teacher-tasks', target: [f('embed-teacher-tasks', 'button', 'Add Task'), '#embed-teacher-tasks'],
      title: 'My tasks',
      body: '<strong>Add Task</strong> for a single job, or make a project to group several. Give each a due date so it shows on Home.' },
    { chapter: 'Planning and assessment', panel: 'embed-teacher-tasks', target: [f('embed-teacher-tasks', '#tabBoard'), '#embed-teacher-tasks'],
      title: 'Board and Overview',
      body: '<strong>Board</strong> shows tasks in columns you can move them between. <strong>Overview</strong> shows what is due and what is overdue.' },
    { chapter: 'Planning and assessment', panel: 'embed-classroom-toolkit', target: [f('embed-classroom-toolkit', '#heroPrimary'), '#embed-classroom-toolkit'],
      title: 'Classroom Toolkit',
      body: 'Tools for the board. <strong>Big Timer</strong> paces a task: pick a time, add a label, go fullscreen.' },
    { chapter: 'Planning and assessment', panel: 'embed-classroom-toolkit', target: [f('embed-classroom-toolkit', 'button', 'Favourites'), '#embed-classroom-toolkit'],
      title: 'Favourites',
      body: 'Star the tools you use most, such as Quiz Builder, Exit Tickets and Traffic Lights, so they are here when you need them.' },
    { chapter: 'Planning and assessment', panel: 'embed-classroom-toolkit', target: [f('embed-classroom-toolkit', '#qlEdit'), '#embed-classroom-toolkit'],
      title: 'Quick Launch',
      body: 'One click opens a tool mid-lesson. Use <strong>Edit Quick Launch</strong> to choose which tools sit here.' },

    // Colleagues
    { chapter: 'Talking to colleagues', panel: 'home', target: '.staff-chat-launcher',
      title: 'Staff chat',
      body: 'The <strong>Chat</strong> button in the bottom corner of every page opens live messages with colleagues. The red badge counts unread messages. Choose <strong>New chat</strong> for one colleague, or pick several for a group.' },

    // Curriculum
    { chapter: 'Curriculum', panel: 'drama-teaching-hub', target: '#sidebar-accordion-drama',
      title: 'Curriculum by subject',
      body: 'Drama, Art &amp; Design and Photography each have their own section. Open your subject and the others fold away.' },
    { chapter: 'Curriculum', panel: 'drama-teaching-hub', target: side('drama-teaching-hub'),
      title: 'Lesson Slides',
      body: 'Ready-to-teach slide decks. Open one and present it from the board.' },
    { chapter: 'Curriculum', panel: 'drama-s1', target: side('drama-s1'),
      title: 'Curriculum by year',
      body: 'Each year has its units, outcomes and retrieval prompts. <strong>Curriculum Map</strong> shows how they build from S1 upwards.' },
    { chapter: 'Curriculum', panel: 'drama-ci-assessment', target: side('drama-ci-assessment'),
      title: 'N5 CI Assessment',
      body: 'Records evidence for every N5 Creative Industries performance criterion and shows who is ready for a unit sign-off.' },
    { chapter: 'Curriculum', panel: 'drama-ci-assessment', target: [f('drama-ci-assessment', '[data-act="go-grid"]'), '#drama-ci-assessment'],
      title: 'Overview and marking',
      body: 'The overview shows who is ready to sign off and what is waiting to be assessed. <strong>Mark</strong> opens the marking grid, where arrow keys move and 1 to 4 records a decision.' },
    { chapter: 'Curriculum', panel: 'drama-report-builder', target: side('drama-report-builder'),
      title: 'BGE Report Builder',
      body: 'Drafts BGE report comments from your tracker scores. Keep scores up to date and reports take far less time.' },
    { chapter: 'Curriculum', panel: 'drama-moderation', target: side('drama-moderation'),
      title: 'Moderation',
      body: 'Work through a unit against the eight stages of the Learning, Teaching &amp; Assessment Cycle, then export it as a document.' },

    // Running the faculty
    { chapter: 'Running the faculty', panel: 'embed-procurement', target: side('embed-procurement'),
      title: 'Procurement',
      body: 'Ask for materials and equipment. Requests go to your faculty head, then to the office.' },
    { chapter: 'Running the faculty', panel: 'embed-procurement', target: [f('embed-procurement', '#newRequestBtn'), '#embed-procurement'],
      title: 'New request',
      body: 'Add a line per item, save a draft or <strong>Submit for approval</strong>. Follow it in <strong>My requests</strong>.' },
    { chapter: 'Running the faculty', panel: 'embed-department-meetings', target: side('embed-department-meetings'),
      title: 'Department meetings',
      body: 'Agendas and minutes for faculty meetings. Check the agenda the day before for anything you are down for.' },
    { chapter: 'Running the faculty', panel: 'dip-main-2627', target: 'nav.sidebar-nav-group[aria-label="Improvement plan"]',
      title: 'Improvement plan',
      body: 'The faculty\'s priorities for the year, the one-page poster, the action plan and the attainment data behind it.' },
    { chapter: 'Running the faculty', panel: 'data-backup', target: side('data-backup'),
      title: 'Backup and restore',
      body: 'The hub saves to the cloud when you are signed in. Take a backup file here at the end of each term for peace of mind.' },

    // Finish
    { chapter: 'Finish', panel: 'home', target: '.sidebar [data-hub-tour-start]',
      title: 'That\'s the tour',
      body: 'Come back here any time to take it again, or jump straight to one section from the list at the top of this box.' }
  ];

  var state = { active: false, i: 0, el: null, timer: null, token: 0 };
  var spot, pop;

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function save(patch) {
    var s = load();
    for (var k in patch) s[k] = patch[k];
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* storage or scroll unavailable */ }
  }

  function chapters() {
    var out = [];
    STEPS.forEach(function (s, i) {
      if (!out.length || out[out.length - 1].name !== s.chapter) out.push({ name: s.chapter, first: i });
    });
    return out;
  }

  // Find a target. Returns { el, frameEl } or null.
  function resolveOne(t) {
    if (typeof t === 'string') {
      var el = visibleMatch(document, t);
      return el ? { el: el, frameEl: null } : null;
    }
    var frameEl = document.querySelector(t.frame);
    if (!frameEl || !isVisible(frameEl)) return null;
    var doc;
    try { doc = frameEl.contentDocument; } catch (e) { return null; }
    if (!doc || doc.readyState === 'loading') return null;
    var inner = visibleMatch(doc, t.sel, t.text);
    return inner ? { el: inner, frameEl: frameEl } : null;
  }
  function visibleMatch(doc, sel, text) {
    var list;
    try { list = doc.querySelectorAll(sel); } catch (e) { return null; }
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (text && (el.textContent || '').replace(/\s+/g, ' ').trim().indexOf(text) === -1) continue;
      if (isVisible(el) || el.closest('details:not([open])') || inClosedSidebar(el)) return el;
    }
    return null;
  }
  function isVisible(el) {
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function inClosedSidebar(el) {
    return el.ownerDocument === document && !!el.closest('.sidebar');
  }

  function rectOf(found) {
    var r = found.el.getBoundingClientRect();
    if (!found.frameEl) return r;
    var fr = found.frameEl.getBoundingClientRect();
    var top = Math.max(r.top + fr.top, fr.top);
    var left = Math.max(r.left + fr.left, fr.left);
    var bottom = Math.min(r.bottom + fr.top, fr.bottom);
    var right = Math.min(r.right + fr.left, fr.right);
    return { top: top, left: left, width: Math.max(0, right - left), height: Math.max(0, bottom - top), right: right, bottom: bottom };
  }

  // Open whatever hides the target: closed accordions, and the sidebar on narrow screens.
  function reveal(found) {
    var el = found.el;
    if (!found.frameEl) {
      var d = el.closest('details');
      while (d) {
        d.setAttribute('open', '');
        d = d.parentElement && d.parentElement.closest('details');
      }
      if (el.tagName === 'DETAILS') el.setAttribute('open', '');
      var sb = document.querySelector('.sidebar');
      var inSidebar = sb && sb.contains(el);
      if (typeof window.setSidebarOpen === 'function' && sb) {
        var sr = sb.getBoundingClientRect();
        if (inSidebar && sr.right <= 4) window.setSidebarOpen(true);
        else if (!inSidebar && window.innerWidth < 1024 && sb.classList.contains('open')) window.setSidebarOpen(false);
      }
    } else {
      try { found.frameEl.scrollIntoView({ block: 'nearest' }); } catch (e) { /* storage or scroll unavailable */ }
    }
    try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) { /* storage or scroll unavailable */ }
  }

  function panelIsActive(id) {
    var p = document.getElementById(id);
    return !!(p && p.classList.contains('active'));
  }

  function go(i) {
    if (i < 0 || i >= STEPS.length) return;
    state.i = i;
    var token = ++state.token;
    var step = STEPS[i];
    save({ i: i });
    if (step.panel && !panelIsActive(step.panel) && typeof window.showPanel === 'function') {
      window.showPanel(step.panel);
    }
    renderPop(step, i);
    if (step.centre) { place(null); return; }

    var candidates = Array.isArray(step.target) ? step.target : [step.target];
    var started = Date.now();
    (function poll() {
      if (token !== state.token || !state.active) return;
      // Give the first candidate time to appear (embedded pages load lazily), then settle for a fallback.
      var waited = Date.now() - started;
      var first = candidates[0];
      var patience = typeof first === 'string' ? 700 : WAIT_MS;
      var found = resolveOne(first);
      if (!found && waited < patience) { setTimeout(poll, 150); return; }
      for (var c = 1; !found && c < candidates.length; c++) found = resolveOne(candidates[c]);
      if (found) {
        reveal(found);
        state.el = found;
        setTimeout(function () { if (token === state.token) place(found); }, 320);
      } else {
        state.el = null;
        place(null);
      }
    })();
  }

  function renderPop(step, i) {
    var chs = chapters();
    var opts = chs.map(function (c) {
      return '<option value="' + c.first + '"' + (c.name === step.chapter ? ' selected' : '') + '>' + c.name + '</option>';
    }).join('');
    pop.innerHTML =
      '<div class="hub-tour-head"><span class="hub-tour-chapter">' + step.chapter + '</span>' +
      '<span class="hub-tour-count">' + (i + 1) + ' of ' + STEPS.length + '</span></div>' +
      '<h2 class="hub-tour-title" id="hubTourTitle">' + step.title + '</h2>' +
      '<p class="hub-tour-body">' + step.body + '</p>' +
      (step.doThis ? '<p class="hub-tour-do"><b>Try it:</b> ' + step.doThis + '</p>' : '') +
      '<div class="hub-tour-bar" aria-hidden="true"><span style="width:' + Math.round(((i + 1) / STEPS.length) * 100) + '%"></span></div>' +
      '<div class="hub-tour-foot">' +
      '<label class="visually-hidden" for="hubTourJump">Jump to a section</label>' +
      '<select class="hub-tour-select" id="hubTourJump">' + opts + '</select>' +
      '<span class="hub-tour-grow"></span>' +
      '<button type="button" class="hub-tour-btn" data-tour="back"' + (i === 0 ? ' disabled' : '') + '>Back</button>' +
      '<button type="button" class="hub-tour-btn hub-tour-btn-primary" data-tour="next">' + (i === STEPS.length - 1 ? 'Finish' : 'Next') + '</button>' +
      '</div>' +
      '<div class="hub-tour-foot" style="margin-top:6px"><button type="button" class="hub-tour-x" data-tour="exit">Exit tour</button>' +
      '<span class="hub-tour-grow"></span><span class="hub-tour-count">Arrow keys move, Esc exits</span></div>';
    pop.hidden = false;
    try { pop.focus({ preventScroll: true }); } catch (e) { /* storage or scroll unavailable */ }
  }

  function place(found) {
    if (!state.active) return;
    var vw = window.innerWidth, vh = window.innerHeight, pad = 8, gap = 14;
    var pw = pop.offsetWidth, ph = pop.offsetHeight;
    if (!found) {
      spot.classList.add('is-centre');
      spot.style.top = vh / 2 + 'px'; spot.style.left = vw / 2 + 'px';
      spot.style.width = '0px'; spot.style.height = '0px';
      pop.style.left = Math.max(16, (vw - pw) / 2) + 'px';
      pop.style.top = Math.max(16, (vh - ph) / 2) + 'px';
      return;
    }
    spot.classList.remove('is-centre');
    var r = rectOf(found);
    // Very large targets (a whole embedded page) get a tighter inset so the edge stays visible.
    var p = (r.width > vw * 0.6 || r.height > vh * 0.6) ? 2 : pad;
    var top = Math.max(4, r.top - p), left = Math.max(4, r.left - p);
    var w = Math.min(vw - 8, r.width + p * 2), h = Math.min(vh - 8, r.height + p * 2);
    spot.style.top = top + 'px'; spot.style.left = left + 'px';
    spot.style.width = w + 'px'; spot.style.height = h + 'px';

    if (vw <= 640) return; // the box docks to the bottom on phones (CSS)
    var spaces = [
      { side: 'right', ok: vw - (left + w) >= pw + gap + 8, x: left + w + gap, y: top },
      { side: 'bottom', ok: vh - (top + h) >= ph + gap + 8, x: left, y: top + h + gap },
      { side: 'left', ok: left >= pw + gap + 8, x: left - pw - gap, y: top },
      { side: 'top', ok: top >= ph + gap + 8, x: left, y: top - ph - gap }
    ];
    var pick = spaces.filter(function (s) { return s.ok; })[0];
    var x, y;
    if (pick) { x = pick.x; y = pick.y; }
    else { x = vw - pw - 24; y = vh - ph - 24; } // target fills the screen: sit in the corner
    x = Math.min(Math.max(16, x), vw - pw - 16);
    y = Math.min(Math.max(16, y), vh - ph - 16);
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
  }

  function onKey(e) {
    if (!state.active) return;
    if (e.target && e.target.id === 'hubTourJump') return;
    if (e.key === 'Escape') { e.preventDefault(); stop(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(state.i - 1); }
  }
  function next() {
    if (state.i >= STEPS.length - 1) { save({ finished: true, i: 0 }); stop(); return; }
    go(state.i + 1);
  }
  function relayout() { if (state.active) place(state.el); }

  function build() {
    if (spot) return;
    spot = document.createElement('div');
    spot.className = 'hub-tour-spot';
    spot.setAttribute('aria-hidden', 'true');
    pop = document.createElement('div');
    pop.className = 'hub-tour-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-labelledby', 'hubTourTitle');
    pop.tabIndex = -1;
    pop.hidden = true;
    document.body.appendChild(spot);
    document.body.appendChild(pop);
    pop.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tour]');
      if (!b) return;
      var act = b.getAttribute('data-tour');
      if (act === 'next') next();
      else if (act === 'back') go(state.i - 1);
      else if (act === 'exit') stop();
    });
    pop.addEventListener('change', function (e) {
      if (e.target.id === 'hubTourJump') go(+e.target.value);
    });
  }

  function start(fromStep) {
    build();
    dismissInvite();
    save({ seen: true });
    state.active = true;
    spot.hidden = false;
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', relayout);
    window.addEventListener('scroll', relayout, true);
    state.timer = setInterval(relayout, 400);
    var saved = load();
    var i = typeof fromStep === 'number' ? fromStep
      : (!saved.finished && saved.i > 0 && saved.i < STEPS.length ? saved.i : 0);
    go(i);
  }

  function stop() {
    state.active = false;
    state.token++;
    clearInterval(state.timer);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', relayout);
    window.removeEventListener('scroll', relayout, true);
    if (spot) spot.hidden = true;
    if (pop) pop.hidden = true;
  }

  var invite;
  function dismissInvite() {
    if (invite) { invite.remove(); invite = null; }
  }
  function maybeInvite() {
    var s = load();
    if (s.seen || (window.fhNavIsEmbed && window.fhNavIsEmbed())) return;
    if (!panelIsActive('home')) return;
    invite = document.createElement('div');
    invite.className = 'hub-tour-invite';
    invite.setAttribute('role', 'region');
    invite.setAttribute('aria-label', 'Hub tour');
    invite.innerHTML = '<strong>New to the hub?</strong><p>Take a ten-minute tour of the pages, tabs and buttons you will use.</p>' +
      '<div class="hub-tour-foot"><button type="button" class="hub-tour-btn hub-tour-btn-primary" data-invite="go">Take the tour</button>' +
      '<button type="button" class="hub-tour-x" data-invite="later">Not now</button></div>';
    invite.addEventListener('click', function (e) {
      var b = e.target.closest('[data-invite]');
      if (!b) return;
      if (b.getAttribute('data-invite') === 'go') start(0);
      else { save({ seen: true }); dismissInvite(); }
    });
    document.body.appendChild(invite);
  }

  window.startHubTour = function (fromStep) { start(fromStep); };
  window.startHubTour.steps = STEPS;
  window.startHubTour.resolve = resolveOne;

  function init() {
    var q;
    try { q = new URLSearchParams(window.location.search); } catch (e) { q = null; }
    if (q && q.get('tour') === '1') { setTimeout(function () { start(0); }, 1200); return; }
    setTimeout(maybeInvite, 2500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
