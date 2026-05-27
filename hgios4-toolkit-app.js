/**
 * HGIOS 4 Inspection Toolkit - Application Logic
 * Offline-first Faculty Head preparation for school inspection
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'hgios4-toolkit-data';
  const STORAGE_LIMIT = 4.5 * 1024 * 1024; // 4.5MB - leave headroom for 5MB limit
  const DEBOUNCE_MS = 500;
  const IS_EMBED = new URLSearchParams(window.location.search).get('embed') === '1' || !!window.HGIOS_EMBED;
  let hubEvidenceCache = null;
  let hubDataSnapshot = null;
  let hubEvidenceLastRefresh = null;
  let hubEvidenceRefreshInFlight = false;
  let cloudSaveEnabled = false;
  let selectedSchoolYear = null;
  let pendingLocalMerge = null;
  let cloudMeta = { updatedAt: null, schoolYear: null };

  // Quality Indicators structure (HGIOS 4 framework)
  const QUALITY_INDICATORS = [
    { id: '1.1', category: 1, title: 'Self-Evaluation for Self-Improvement' },
    { id: '1.2', category: 1, title: 'Leadership of Learning' },
    { id: '1.3', category: 1, title: 'Leadership of Change' },
    { id: '1.4', category: 1, title: 'Leadership and Management of Staff' },
    { id: '1.5', category: 1, title: 'Management of Resources to Promote Equity' },
    { id: '2.1', category: 2, title: 'Safeguarding and Child Protection' },
    { id: '2.2', category: 2, title: 'Curriculum' },
    { id: '2.3', category: 2, title: 'Learning, Teaching and Assessment', core: true },
    { id: '2.4', category: 2, title: 'Personalised Support' },
    { id: '2.5', category: 2, title: 'Family Learning' },
    { id: '3.1', category: 3, title: 'Ensuring Wellbeing, Equality and Inclusion' },
    { id: '3.2', category: 3, title: 'Raising Attainment and Achievement' },
    { id: '3.3', category: 3, title: 'Increasing Creativity and Employability' },
    { id: '3.4', category: 3, title: 'Performance' }
  ];

  const CHALLENGE_QUESTIONS = {
    '1.1': 'How well do we use self-evaluation to bring about improvement? What evidence do we have?',
    '1.2': 'How effectively do we lead improvements in learning and teaching? How do we support professional learning?',
    '1.3': 'How well do we lead and manage change? What impact does this have on learners?',
    '1.4': 'How effectively do we lead and manage staff? How do we promote professional engagement?',
    '1.5': 'How well do we manage resources to promote equity and close the attainment gap?',
    '2.1': 'How well do we safeguard and protect children and young people?',
    '2.2': 'How well does our curriculum meet the needs of all learners?',
    '2.3': 'How well do we ensure high-quality learning experiences for all? What is the impact on attainment?',
    '2.4': 'How well do we provide personalised support for learners?',
    '2.5': 'How effectively do we engage families in learning?',
    '3.1': 'How well do we ensure wellbeing, equality and inclusion for all?',
    '3.2': 'How well are we raising attainment and achievement? What is the impact on closing the gap?',
    '3.3': 'How well do we develop creativity and employability skills?',
    '3.4': 'How well do we demonstrate performance and improvement over time?'
  };

  // What inspectors look for (HM Inspectorate focus areas)
  const INSPECTOR_FOCUS = {
    '1.1': 'Inspectors evaluate how self-evaluation drives improvement. They look for: a clear improvement cycle, staff ownership of evaluation, use of data and evidence to inform decisions, and impact on learner outcomes.',
    '1.2': 'Inspectors assess leadership of learning. They look for: professional learning culture, career-long development, staff engagement in improvement, and how leaders support high-quality teaching.',
    '1.3': 'Inspectors examine leadership of change. They look for: strategic vision, effective implementation of improvement priorities, stakeholder engagement, and measurable impact on learners.',
    '1.4': 'Inspectors evaluate staff leadership and management. They look for: performance management, professional dialogue, staff wellbeing, and how staff contribute to school improvement.',
    '1.5': 'Inspectors assess resource management for equity. They look for: fair allocation of resources, closing the attainment gap, support for vulnerable learners, and value for money.',
    '2.1': 'Inspectors prioritise safeguarding. They look for: robust child protection procedures, staff training, safe environments, and effective partnership with agencies.',
    '2.2': 'Inspectors evaluate curriculum design. They look for: breadth and depth, progression, relevance to learners, and alignment with Curriculum for Excellence.',
    '2.3': 'Inspectors focus closely on learning, teaching and assessment (Core QI). They look for: high-quality learning experiences, effective pedagogy, assessment that supports learning, and impact on attainment for all.',
    '2.4': 'Inspectors assess personalised support. They look for: identification of needs, targeted interventions, support for wellbeing, and transitions.',
    '2.5': 'Inspectors evaluate family learning. They look for: parental engagement, family learning opportunities, and partnership with families.',
    '3.1': 'Inspectors assess wellbeing, equality and inclusion. They look for: positive relationships, inclusive practice, support for all learners, and reduction of barriers.',
    '3.2': 'Inspectors focus on attainment and achievement (Core area). They look for: attainment data, progress over time, closing the gap, and broader achievements.',
    '3.3': 'Inspectors evaluate creativity and employability. They look for: skills for life and work, creativity across the curriculum, and preparation for future learning.',
    '3.4': 'Inspectors assess performance. They look for: trends over time, benchmarking, improvement trajectories, and sustainability.'
  };

  // Suggested evidence and documents to gather
  const EVIDENCE_GUIDANCE = {
    '1.1': 'Self-evaluation reports, improvement plans, meeting minutes showing evaluation cycles, staff survey data, evidence of impact on outcomes.',
    '1.2': 'Professional learning plans, CPD records, learning walks documentation, staff development programmes, evidence of collaborative enquiry.',
    '1.3': 'School improvement plan, change management documentation, stakeholder feedback, implementation timelines, impact evaluations.',
    '1.4': 'Performance review documentation, staff survey results, professional dialogue records, workload considerations, recruitment and retention data.',
    '1.5': 'Resource allocation plans, budget documentation, Pupil Equity Fund usage, support for disadvantaged learners, impact evidence.',
    '2.1': 'Safeguarding policy, child protection procedures, training records, risk assessments, GIRFEC documentation.',
    '2.2': 'Curriculum maps, schemes of work, progression frameworks, learner voice on curriculum, CfE alignment evidence.',
    '2.3': 'Lesson observation summaries, assessment data, learning and teaching policy, work samples, attainment tracking.',
    '2.4': 'Support plans, intervention records, Additional Support Needs documentation, wellbeing programmes, transition plans.',
    '2.5': 'Family learning programmes, parental engagement records, partnership agreements, home-school communication evidence.',
    '3.1': 'Wellbeing surveys, equality impact assessments, inclusion policies, anti-bullying work, support for vulnerable groups.',
    '3.2': 'Attainment data, tracking over time, gap analysis, achievement records, SQA/qualification data.',
    '3.3': 'Skills development evidence, employability programmes, creative work samples, partnership with employers.',
    '3.4': 'Performance data over time, benchmarking reports, improvement trends, HMI follow-up evidence.'
  };

  // Inspection-Ready: Evidence checklist for Faculty Heads
  const INSPECTION_READY_EVIDENCE = [
    {
      category: 'Core Inspection Documents',
      description: 'Documents inspectors expect to see at the start. Usually prepared at school level.',
      items: [
        'School self-evaluation summary (current)',
        'Safeguarding proforma (completed and up to date)',
        'Child protection policy and procedures',
        'Staff safeguarding training records',
        'Stakeholder questionnaire results (parents, staff, pupils)',
        'School improvement plan (current year)'
      ]
    },
    {
      category: 'Leadership and Management (QI 1.x)',
      description: 'Evidence for leadership, self-evaluation, change management and resources.',
      items: [
        'Faculty/department self-evaluation report',
        'Faculty improvement plan with clear priorities',
        'Meeting minutes showing evaluation and improvement cycles',
        'Professional learning plans and CPD records for faculty staff',
        'Learning walks documentation and follow-up',
        'Staff development programme evidence',
        'Performance review and professional dialogue records',
        'Resource allocation plan (including Pupil Equity Fund if applicable)',
        'Evidence of impact on outcomes from improvement work'
      ]
    },
    {
      category: 'Learning Provision (QI 2.x)',
      description: 'Evidence for curriculum, learning and teaching, support and family engagement.',
      items: [
        'Curriculum maps and schemes of work',
        'Progression frameworks for your subject(s)',
        'Learning and teaching policy (faculty or school)',
        'Lesson observation summaries and moderation records',
        'Assessment policy and assessment data',
        'Work samples showing quality and progression',
        'Additional Support Needs documentation and support plans',
        'Intervention records and impact evidence',
        'Wellbeing and pastoral support evidence',
        'Family learning or parental engagement records',
        'Home-school communication evidence'
      ]
    },
    {
      category: 'Successes and Achievements (QI 3.x)',
      description: 'Evidence for attainment, wellbeing, inclusion and performance.',
      items: [
        'Attainment data and tracking over time',
        'Gap analysis (e.g. SIMD, ASN, gender)',
        'SQA/qualification results (if applicable)',
        'Broader achievement records (awards, competitions, projects)',
        'Wellbeing survey data',
        'Equality and inclusion evidence',
        'Skills for life and work / employability evidence',
        'Performance trends and benchmarking data',
        'Evidence of improvement trajectories'
      ]
    },
    {
      category: 'Faculty Head Specific',
      description: 'Documents that demonstrate your leadership and readiness for inspection.',
      items: [
        'Faculty overview document (structure, staffing, key priorities)',
        'Timetable and staffing allocation',
        'Faculty meeting minutes (last 6–12 months)',
        'Evidence of collaborative working with other faculties',
        'Summary of key strengths and areas for improvement',
        'Action plans with timescales and responsibility',
        'List of documents in your evidence folder (index)'
      ]
    }
  ];

  function applyEmbedChrome() {
    if (!IS_EMBED) return;
    document.documentElement.classList.remove('hgios-embed-pending');
    document.body.classList.add('embed-mode');
    var footer = document.getElementById('app-footer');
    if (footer) footer.hidden = true;
    var pwa = document.getElementById('pwa-banner');
    if (pwa) pwa.remove();
  }

  function updateSyncStatus(state, message) {
    var el = document.getElementById('sync-status-label');
    if (!el) return;
    el.hidden = false;
    el.className = 'sync-status-label sync-' + (state || 'local');
    var labels = {
      cloud: '● Saved to Faculty Hub cloud (' + getActiveSchoolYear() + ')',
      local: '● Saved on this device only',
      saving: '● Saving to cloud…',
      error: '● Cloud save failed — saved locally',
      offline: '● Sign in as Faculty Head for cloud sync'
    };
    el.textContent = message || labels[state] || labels.local;
    el.title = message || '';
  }

  function openHubPanel(panelId) {
    try {
      if (window.parent && window.parent !== window && typeof window.parent.showPanel === 'function') {
        window.parent.showPanel(panelId);
        return;
      }
    } catch (e) { /* ignore */ }
    window.open('faculty-hub.html', '_blank');
  }

  function openQiDetail(qiId) {
    if (!qiId) return;
    showView('qi');
    renderQIDetail(qiId);
    try {
      window.scrollTo(0, 0);
      var main = document.querySelector('.main');
      if (main) main.scrollTop = 0;
      var view = document.getElementById('view-qi');
      if (view && view.scrollIntoView) view.scrollIntoView({ block: 'start', behavior: 'instant' });
    } catch (e) { /* ignore */ }
  }

  function onQiTileClick(e) {
    var tile = e.target.closest('.qi-link, .qi-tile[data-qi]');
    if (!tile || !tile.dataset.qi) return;
    e.preventDefault();
    e.stopPropagation();
    openQiDetail(tile.dataset.qi);
  }

  function bindQiNavigation() {
    document.removeEventListener('click', onQiTileClick, true);
    document.addEventListener('click', onQiTileClick, true);
  }

  function hubSchoolYear() {
    return window.getCurrentSchoolYear ? window.getCurrentSchoolYear() : '';
  }

  function hubTruncate(str, max) {
    str = String(str || '').trim();
    if (!str) return '';
    max = max || 140;
    return str.length <= max ? str : str.slice(0, max - 1) + '…';
  }

  function hubFormatWhen(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return ''; }
  }

  function hubExtractQiCodes(text) {
    var codes = [];
    var re = /\b(\d\.\d+)\b/g;
    var m;
    while ((m = re.exec(String(text || '')))) {
      if (codes.indexOf(m[1]) === -1) codes.push(m[1]);
    }
    return codes;
  }

  function hubMeetingAgendaQis(meeting) {
    var codes = [];
    (meeting.agenda_rows || []).forEach(function(row) {
      hubExtractQiCodes(row.agenda_item).forEach(function(c) {
        if (codes.indexOf(c) === -1) codes.push(c);
      });
    });
    return codes;
  }

  function hubTriangulationPriorities(syn) {
    var hints = [];
    if (!syn || !syn.hasData) return hints;
    var survey = syn.survey || [];
    if (survey.length) {
      var allLikert = {};
      survey.forEach(function(s) {
        Object.keys((s.data && s.data.likert) || {}).forEach(function(k) {
          allLikert[k] = allLikert[k] || {};
          Object.keys(s.data.likert[k] || {}).forEach(function(v) {
            allLikert[k][v] = (allLikert[k][v] || 0) + (s.data.likert[k][v] || 0);
          });
        });
      });
      var themeNames = {
        learningIntentions: 'Learning intentions',
        successCriteria: 'Success criteria',
        activeLearning: 'Active learning',
        support: 'Support',
        feedback: 'Feedback',
        challenge: 'Challenge',
        digitalLearning: 'Digital learning'
      };
      Object.keys(allLikert).forEach(function(k) {
        var dist = allLikert[k];
        var total = Object.values(dist).reduce(function(a, b) { return a + b; }, 0);
        if (!total) return;
        var neg = (dist['Disagree'] || 0) + (dist['Strongly disagree'] || 0);
        if (neg / total > 0.15) {
          hints.push((themeNames[k] || k) + ': ' + Math.round(neg / total * 100) + '% disagreed in surveys');
        }
      });
    }
    (syn.focus_group || []).slice(0, 2).forEach(function(f) {
      var imp = f.data && f.data.improve;
      if (imp) hints.push('Focus group: ' + hubTruncate(imp, 90));
    });
    (syn.observation || []).slice(0, 2).forEach(function(o) {
      var d = o.data || {};
      if (d.nextsteps) hints.push((d.teacher ? d.teacher + ' — ' : '') + hubTruncate(d.nextsteps, 80));
    });
    return hints.slice(0, 3);
  }

  function hubLatestIso(rows, field) {
    var latest = '';
    (rows || []).forEach(function(r) {
      var t = r[field] || r.updated_at || r.created_at;
      if (t && (!latest || t > latest)) latest = t;
    });
    return latest;
  }

  function hubClassVisitDraft() {
    try {
      var raw = localStorage.getItem('kss_obs_v2');
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (d && (d.teacher || d.date || d.nextsteps)) return d;
    } catch (e) { /* ignore */ }
    return null;
  }

  function hubClplSummary(progress) {
    progress = progress || {};
    var courseIds = Object.keys(progress);
    if (!courseIds.length) return { courses: 0, stages: 0 };
    var stages = 0;
    courseIds.forEach(function(id) {
      stages += ((progress[id] || {}).completedStages || []).length;
    });
    return { courses: courseIds.length, stages: stages };
  }

  const HUB_EVIDENCE_STATUS_ORDER = { ok: 0, hint: 1, empty: 2, unavailable: 3, error: 4 };

  const HUB_EVIDENCE_SOURCES = [
    {
      id: 'triangulation',
      label: 'Triangulation of Evidence',
      panel: 'embed-triangulation',
      qis: ['2.3', '3.1'],
      fetch: function() {
        if (!window.TriangulationService) return Promise.resolve({ status: 'unavailable', detail: 'Sign in to Faculty Hub as admin' });
        var yr = hubSchoolYear();
        return TriangulationService.getSynthesis(yr).then(function(s) {
          if (!s.hasData) return { status: 'empty', detail: 'No survey, focus group or observation data for ' + yr };
          var parts = [];
          if (s.survey.length) parts.push(s.survey.length + ' survey' + (s.survey.length !== 1 ? 's' : ''));
          if (s.focus_group.length) parts.push(s.focus_group.length + ' focus group' + (s.focus_group.length !== 1 ? 's' : ''));
          if (s.observation.length) parts.push(s.observation.length + ' observation' + (s.observation.length !== 1 ? 's' : ''));
          var hints = hubTriangulationPriorities(s);
          return {
            status: 'ok',
            detail: parts.join(' · ') + ' (' + yr + ')',
            summary: hints.length ? hints[0] : '',
            updatedAt: hubLatestIso(s.survey.concat(s.focus_group, s.observation), 'created_at')
          };
        }).catch(function() { return { status: 'error', detail: 'Could not load triangulation data' }; });
      }
    },
    {
      id: 'class-visits',
      label: 'Class Visit Feedback',
      panel: 'embed-class-visit',
      qis: ['2.3', '1.2'],
      fetch: function() {
        var draft = hubClassVisitDraft();
        if (!window.TriangulationService) {
          if (draft) {
            return Promise.resolve({
              status: 'hint',
              detail: 'Draft visit on this device — export to Triangulation when ready',
              summary: (draft.teacher || 'Teacher') + (draft.date ? ' · ' + draft.date : '')
            });
          }
          return Promise.resolve({ status: 'hint', detail: 'Record visits and export to Triangulation for inspection evidence' });
        }
        var yr = hubSchoolYear();
        return TriangulationService.getEvidence(yr, 'observation').then(function(rows) {
          rows = rows || [];
          var fromVisits = rows.filter(function(r) { return r.metadata && r.metadata.source === 'class_visit_feedback'; });
          if (fromVisits.length) {
            var last = fromVisits[0];
            var ld = last.data || {};
            return {
              status: 'ok',
              detail: fromVisits.length + ' exported visit' + (fromVisits.length !== 1 ? 's' : '') + ' in triangulation',
              summary: hubTruncate((ld.teacher || '') + (ld.class ? ' · ' + ld.class : '') + (ld.nextsteps ? ' — ' + ld.nextsteps : ''), 120),
              updatedAt: last.created_at
            };
          }
          if (rows.length) {
            return { status: 'ok', detail: rows.length + ' observation record(s) in triangulation', updatedAt: hubLatestIso(rows, 'created_at') };
          }
          if (draft) {
            return { status: 'hint', detail: 'Draft visit saved locally — not yet in triangulation', summary: (draft.teacher || 'Teacher') + (draft.date ? ' · ' + draft.date : '') };
          }
          return { status: 'empty', detail: 'No class visits exported yet for ' + yr };
        }).catch(function() {
          if (draft) return { status: 'hint', detail: 'Draft visit on this device', summary: draft.teacher || '' };
          return { status: 'empty', detail: 'Open Class Visit Feedback to gather evidence' };
        });
      }
    },
    {
      id: 'dip',
      label: 'DIP Self-Evaluation',
      panel: 'dip-main',
      qis: ['1.1', '2.2', '2.3', '3.1', '3.2'],
      fetch: function() {
        if (!window.DataService || !DataService.get) return Promise.resolve({ status: 'unavailable', detail: 'Faculty Hub not connected' });
        return DataService.get('dipSelfEvaluation').then(function(dip) {
          dip = dip || {};
          var keys = ['dip-eval-overall', 'dip-eval-achievements', 'dip-eval-next', 'dip-eval-period'];
          var filled = keys.filter(function(k) { return dip[k] && String(dip[k]).trim(); }).length;
          if (filled) {
            return {
              status: 'ok',
              detail: filled + ' of 4 evaluation sections completed' + (dip['dip-eval-period'] ? ' · Period: ' + dip['dip-eval-period'] : ''),
              summary: hubTruncate(dip['dip-eval-achievements'] || dip['dip-eval-overall'] || '', 130)
            };
          }
          return { status: 'empty', detail: 'Add evaluation notes in the DIP panel' };
        }).catch(function() { return { status: 'empty', detail: 'Open the DIP in Faculty Hub' }; });
      }
    },
    {
      id: 'dip-tracker',
      label: 'DIP Mission Tracker',
      panel: 'embed-dip-tracker',
      qis: ['2.2', '2.3', '3.1', '3.2'],
      fetch: function() {
        if (!window.DipTrackerService || !DipTrackerService.loadTracker) {
          return Promise.resolve({ status: 'unavailable', detail: 'DIP tracker service not loaded' });
        }
        return DipTrackerService.loadTracker().then(function(data) {
          data = data || {};
          var c = DipTrackerService.computeCompletion(data);
          if (!c.total) return { status: 'empty', detail: 'Open DIP Mission Tracker in Faculty Hub' };
          if (c.percent >= 40) {
            return {
              status: 'ok',
              detail: c.percent + '% of mission tracker fields complete (' + c.filled + '/' + c.total + ')',
              summary: 'Six mission sheets — Art & Drama DIP 25–26 collaborative tracker'
            };
          }
          if (c.percent > 0) {
            return {
              status: 'hint',
              detail: c.percent + '% complete — add term measures and progress in the tracker',
              summary: 'Faculty Hub → DIP Mission Tracker'
            };
          }
          return { status: 'empty', detail: 'Fill collaborative fields in the DIP Mission Tracker' };
        }).catch(function() {
          return { status: 'empty', detail: 'Open DIP Mission Tracker in Faculty Hub' };
        });
      }
    },
    {
      id: 'meetings',
      label: 'Department Meetings',
      panel: 'embed-department-meetings',
      qis: ['1.1', '1.3', '1.4', '2.3'],
      fetch: function() {
        if (!window.DataService || !DataService.listDepartmentMeetings) return Promise.resolve({ status: 'unavailable', detail: 'Sign in to Faculty Hub' });
        return DataService.listDepartmentMeetings().then(function(rows) {
          rows = rows || [];
          var pub = rows.filter(function(m) { return m.status === 'published'; });
          if (!rows.length) return { status: 'empty', detail: 'No meetings yet — first agenda item should be QI 2.3' };
          var qiCounts = {};
          rows.forEach(function(m) {
            hubMeetingAgendaQis(m).forEach(function(q) { qiCounts[q] = (qiCounts[q] || 0) + 1; });
          });
          var topQis = Object.keys(qiCounts).sort(function(a, b) { return qiCounts[b] - qiCounts[a]; }).slice(0, 4);
          var latest = rows[0];
          return {
            status: pub.length ? 'ok' : 'hint',
            detail: pub.length + ' published · ' + rows.length + ' total' + (latest.meeting_date ? ' · Latest ' + hubFormatWhen(latest.meeting_date) : ''),
            summary: topQis.length ? 'Agenda QIs: ' + topQis.map(function(q) { return q + ' (' + qiCounts[q] + ')'; }).join(', ') : 'Add HGIOS agenda items to link meetings to QIs',
            updatedAt: hubLatestIso(rows, 'updated_at')
          };
        });
      }
    },
    {
      id: 'dashboard',
      label: 'Faculty Head Dashboard',
      panel: 'embed-admin-console',
      qis: ['3.2', '2.4', '3.1', '3.4'],
      fetch: function() {
        if (!window.DataService || !DataService.get) return Promise.resolve({ status: 'hint', detail: 'Attainment, at-risk pupils and class overview' });
        return DataService.get('moderation-data').then(function(mod) {
          mod = mod && typeof mod === 'object' ? mod : {};
          var subjects = Object.keys(mod).filter(function(k) { return mod[k] && typeof mod[k] === 'object'; });
          if (subjects.length) {
            return { status: 'ok', detail: 'Moderation data for ' + subjects.length + ' subject area' + (subjects.length !== 1 ? 's' : ''), summary: 'Open dashboard for attainment and tracking views' };
          }
          return { status: 'hint', detail: 'Use the dashboard for attainment, at-risk pupils and class overview', summary: 'Link tracker exports and moderation in the hub' };
        }).catch(function() { return { status: 'hint', detail: 'Attainment, at-risk pupils and class overview' }; });
      }
    },
    {
      id: 'quality-calendar',
      label: 'Quality Calendar',
      panel: 'embed-quality-calendar',
      qis: ['1.1', '1.3', '2.2'],
      fetch: function() {
        if (!window.DataService || !DataService.getCombinedCalendarEvents) {
          return Promise.resolve({ status: 'hint', detail: 'Improvement timeline and faculty deadlines' });
        }
        return DataService.getCombinedCalendarEvents().then(function(events) {
          events = events || [];
          var today = new Date();
          today.setHours(0, 0, 0, 0);
          var upcoming = events.filter(function(e) {
            if (!e.date) return false;
            var d = new Date(e.date);
            if (isNaN(d.getTime())) return false;
            d.setHours(0, 0, 0, 0);
            var diff = (d - today) / (1000 * 60 * 60 * 24);
            return diff >= 0 && diff <= 90;
          });
          if (!events.length) return { status: 'empty', detail: 'No calendar events — add faculty deadlines in Quality Calendar' };
          var next = upcoming.sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); })[0];
          return {
            status: upcoming.length ? 'ok' : 'hint',
            detail: upcoming.length + ' event' + (upcoming.length !== 1 ? 's' : '') + ' in the next 90 days · ' + events.length + ' total',
            summary: next ? 'Next: ' + hubTruncate(next.title || 'Event', 60) + ' (' + hubFormatWhen(next.date) + ')' : 'No upcoming events in the next 90 days'
          };
        }).catch(function() { return { status: 'hint', detail: 'Improvement timeline and faculty deadlines' }; });
      }
    },
    {
      id: 'learning-teaching',
      label: 'Learning & Teaching',
      panel: 'embed-learning-teaching',
      qis: ['2.3', '1.2', '1.4'],
      fetch: function() {
        if (!window.DataService || !DataService.get) return Promise.resolve({ status: 'hint', detail: 'CLPL courses and EEF evidence strands' });
        return DataService.get('clplProgress').then(function(progress) {
          var sum = hubClplSummary(progress);
          if (sum.stages > 0) {
            return {
              status: 'ok',
              detail: sum.stages + ' CLPL stage' + (sum.stages !== 1 ? 's' : '') + ' completed across ' + sum.courses + ' course' + (sum.courses !== 1 ? 's' : ''),
              summary: 'Staff professional learning tracked in Learning & Teaching'
            };
          }
          return { status: 'empty', detail: 'No CLPL progress recorded yet — assign courses in Learning & Teaching' };
        }).catch(function() { return { status: 'hint', detail: 'CLPL courses and EEF evidence strands' }; });
      }
    },
    {
      id: 'announcements',
      label: 'Faculty Announcements',
      panel: 'home',
      qis: ['1.3', '1.4', '2.4'],
      fetch: function() {
        if (!window.DataService || !DataService.getAnnouncements) return Promise.resolve({ status: 'unavailable', detail: 'Sign in to Faculty Hub' });
        return DataService.getAnnouncements().then(function(rows) {
          rows = rows || [];
          var now = Date.now();
          var active = rows.filter(function(a) {
            if (!a.expires_at) return true;
            var ex = new Date(a.expires_at).getTime();
            return isNaN(ex) || ex >= now;
          });
          if (!active.length) return { status: 'empty', detail: 'No active announcements on the hub home screen' };
          var latest = active[0];
          return {
            status: 'ok',
            detail: active.length + ' active announcement' + (active.length !== 1 ? 's' : ''),
            summary: hubTruncate(latest.title || latest.body || '', 100),
            updatedAt: latest.created_at
          };
        });
      }
    },
    {
      id: 'curriculum',
      label: 'Art & Drama Curriculum',
      panel: 'ad-map',
      qis: ['2.2', '2.3'],
      fetch: function() {
        if (!window.HgiosHubBridge) return Promise.resolve({ status: 'hint', detail: 'Curriculum maps in Faculty Hub sidebar' });
        return HgiosHubBridge.curriculumFetch();
      }
    },
    {
      id: 'bge-trackers',
      label: 'BGE Trackers (Art & Drama)',
      panel: 'embed-tracking-monitoring-hub',
      qis: ['2.3', '2.4', '3.2'],
      fetch: function() {
        if (!window.HgiosHubBridge) return Promise.resolve({ status: 'unavailable', detail: 'Sign in to Faculty Hub' });
        return HgiosHubBridge.bgeTrackersFetch(hubDataSnapshot);
      }
    },
    {
      id: 'tracking-hub',
      label: 'Tracking & Monitoring Hub',
      panel: 'embed-tracking-monitoring-hub',
      qis: ['3.2', '2.3', '2.4', '3.1'],
      fetch: function() {
        if (!window.HgiosHubBridge) return Promise.resolve({ status: 'unavailable', detail: 'Sign in to Faculty Hub' });
        return HgiosHubBridge.trackingHubFetch(hubDataSnapshot);
      }
    },
    {
      id: 'report-builders',
      label: 'BGE Report Builders',
      panel: 'drama-report-builder',
      qis: ['2.3', '3.2', '3.1', '3.3'],
      fetch: function() {
        if (!window.HgiosHubBridge) return Promise.resolve({ status: 'unavailable', detail: 'Sign in to Faculty Hub' });
        return HgiosHubBridge.reportBuildersFetch(hubDataSnapshot);
      }
    },
    {
      id: 'teacher-planner',
      label: 'Teacher Planner',
      panel: 'embed-teacher-planner',
      qis: ['2.2', '2.3', '1.4'],
      fetch: function() {
        if (!window.HgiosHubBridge) return Promise.resolve({ status: 'unavailable', detail: 'Sign in to Faculty Hub' });
        return HgiosHubBridge.plannerFetch(hubDataSnapshot);
      }
    },
    {
      id: 'senior-phase',
      label: 'Senior Phase Tracker',
      panel: 'embed-senior-phase-tracker',
      qis: ['2.2', '3.2'],
      fetch: function() {
        if (!window.HgiosHubBridge) return Promise.resolve({ status: 'hint', detail: 'Senior phase tracker in Faculty Hub' });
        return HgiosHubBridge.seniorPhaseFetch();
      }
    }
  ];

  function refreshHubEvidence() {
    if (!IS_EMBED) return Promise.resolve();
    if (hubEvidenceRefreshInFlight) return Promise.resolve();
    hubEvidenceRefreshInFlight = true;
    var refreshBtn = document.querySelector('.hub-refresh-btn');
    if (refreshBtn) refreshBtn.disabled = true;
    var snapPromise = (window.HgiosHubBridge && HgiosHubBridge.loadSnapshot)
      ? HgiosHubBridge.loadSnapshot().then(function(s) { hubDataSnapshot = s; return s; })
      : Promise.resolve(null);
    return snapPromise.then(function() {
      return Promise.all(HUB_EVIDENCE_SOURCES.map(function(src) {
      return src.fetch().then(function(result) {
        return { source: src, result: result || { status: 'empty', detail: '' } };
      }).catch(function() {
        return { source: src, result: { status: 'error', detail: 'Could not load' } };
      });
    }));
    }).then(function(entries) {
      hubEvidenceCache = entries;
      hubEvidenceLastRefresh = new Date();
      renderHubEvidenceDashboard();
      var qiView = document.getElementById('view-qi');
      if (qiView && qiView.classList.contains('active')) {
        var title = document.getElementById('qi-detail-title');
        var m = title && title.textContent && title.textContent.match(/^QI\s+([\d.]+)/);
        if (m) renderHubEvidenceForQI(m[1]);
      }
      var reportView = document.getElementById('view-report');
      if (reportView && reportView.classList.contains('active')) renderReport();
      var evView = document.getElementById('view-evidence');
      if (evView && evView.classList.contains('active')) renderEvidenceChecklist();
    }).finally(function() {
      hubEvidenceRefreshInFlight = false;
      var btn = document.querySelector('.hub-refresh-btn');
      if (btn) btn.disabled = false;
    });
  }

  function hubEvidenceEntriesForQI(qiId) {
    if (!hubEvidenceCache) return [];
    return hubEvidenceCache.filter(function(e) {
      return !qiId || e.source.qis.indexOf(qiId) !== -1;
    }).sort(function(a, b) {
      var oa = HUB_EVIDENCE_STATUS_ORDER[a.result.status] != null ? HUB_EVIDENCE_STATUS_ORDER[a.result.status] : 5;
      var ob = HUB_EVIDENCE_STATUS_ORDER[b.result.status] != null ? HUB_EVIDENCE_STATUS_ORDER[b.result.status] : 5;
      return oa - ob;
    });
  }

  function hubEvidenceStatusLabel(status) {
    var labels = { ok: 'Ready', empty: 'No data', hint: 'Tip', error: 'Error', unavailable: 'Offline' };
    return labels[status] || 'Status';
  }

  function renderHubEvidenceCards(container, qiId) {
    if (!container || !hubEvidenceCache) return;
    var entries = hubEvidenceEntriesForQI(qiId);
    if (!entries.length) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    var refreshed = hubEvidenceLastRefresh
      ? 'Updated ' + hubEvidenceLastRefresh.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      : '';
    var sub = qiId
      ? 'Sources linked to QI ' + qiId + ' in Faculty Hub. Open a tool to add or update evidence, then refresh.'
      : 'Live read-only snapshot from Faculty Hub tools. Refreshes when you open this toolkit or return to the tab.';
    var html = '<div class="hub-evidence-header"><div><h3>Faculty Hub evidence</h3><p class="hub-evidence-sub">' + escapeHtml(sub) + '</p>';
    if (refreshed) html += '<p class="hub-evidence-refreshed">' + escapeHtml(refreshed) + '</p>';
    html += '</div><button type="button" class="btn btn-secondary btn-sm hub-refresh-btn" id="hub-evidence-refresh">Refresh</button></div><div class="hub-evidence-grid">';
    entries.forEach(function(e) {
      var st = e.result.status || 'hint';
      var tags = qiId ? ('QI ' + qiId) : e.source.qis.map(function(q) { return 'QI ' + q; }).join(', ');
      html += '<article class="hub-evidence-card hub-status-' + st + '">';
      html += '<div class="hub-evidence-card-head"><strong>' + escapeHtml(e.source.label) + '</strong>';
      html += '<span class="hub-evidence-badge">' + escapeHtml(hubEvidenceStatusLabel(st)) + '</span>';
      html += '<span class="hub-qi-tags">' + escapeHtml(tags) + '</span></div>';
      html += '<p class="hub-evidence-detail">' + escapeHtml(e.result.detail || '') + '</p>';
      if (e.result.summary) html += '<p class="hub-evidence-summary">' + escapeHtml(e.result.summary) + '</p>';
      if (e.result.updatedAt) html += '<p class="hub-evidence-meta">Last activity: ' + escapeHtml(hubFormatWhen(e.result.updatedAt)) + '</p>';
      html += '<button type="button" class="btn btn-primary btn-sm hub-open-btn" data-hub-panel="' + escapeHtml(e.source.panel) + '">Open in Hub</button>';
      html += '</article>';
    });
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.hub-open-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        openHubPanel(btn.getAttribute('data-hub-panel'));
      });
    });
    var ref = container.querySelector('#hub-evidence-refresh');
    if (ref) ref.addEventListener('click', function() { refreshHubEvidence(); });
  }

  function setupHubEvidenceAutoRefresh() {
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') refreshHubEvidence();
    });
    window.addEventListener('focus', function() { refreshHubEvidence(); });
    window.addEventListener('message', function(e) {
      if (!e.data) return;
      if (e.data === 'hgios-hub-refresh' || e.data.type === 'hgios-hub-refresh') refreshHubEvidence();
    });
    setInterval(function() {
      if (document.visibilityState === 'visible') refreshHubEvidence();
    }, 120000);
  }

  function getHubEvidenceLinesForQI(qiId) {
    return hubEvidenceEntriesForQI(qiId)
      .filter(function(e) { return e.result.status === 'ok' || e.result.status === 'hint'; })
      .map(function(e) {
        var line = e.source.label + ': ' + (e.result.detail || '');
        if (e.result.summary) line += ' — ' + e.result.summary;
        return line;
      });
  }

  function applyHubSuggestionToQi(qiId, mode) {
    if (!window.HgiosHubBridge || !HgiosHubBridge.buildQiSuggestion) return;
    var suggestion = HgiosHubBridge.buildQiSuggestion(qiId, hubDataSnapshot, hubEvidenceCache || []);
    var data = appData.qis[qiId];
    if (!data) return;

    function mergeField(field, incoming) {
      incoming = String(incoming || '').trim();
      if (!incoming) return;
      var existing = String(data[field] || '').trim();
      if (mode === 'replace' || !existing) {
        data[field] = incoming;
      } else if (existing.indexOf(incoming) === -1) {
        data[field] = existing + '\n\n--- Faculty Hub (' + new Date().toLocaleDateString() + ') ---\n' + incoming;
      }
    }

    mergeField('evidenceSummary', suggestion.evidenceSummary);
    mergeField('strengths', suggestion.strengths);
    mergeField('fileReferences', suggestion.fileReferences);
    debounceSave();
    renderQIDetail(qiId);
    var status = document.getElementById('qi-suggest-status');
    if (status) status.textContent = 'Faculty Hub content applied. Review and edit before saving.';
  }

  function applyChecklistSuggestions(mode) {
    if (!window.HgiosHubBridge || !HgiosHubBridge.getChecklistSuggestions) return 0;
    var applied = 0;
    INSPECTION_READY_EVIDENCE.forEach(function(section, sIdx) {
      section.items.forEach(function(item, iIdx) {
        var key = getEvidenceItemKey(sIdx, iIdx);
        var sug = HgiosHubBridge.getChecklistSuggestions(hubDataSnapshot, item, hubEvidenceCache);
        if (!sug.suggested) return;
        if (mode === 'preview') return;
        if (!appData.evidenceChecklist[key]) {
          appData.evidenceChecklist[key] = true;
          applied++;
        }
      });
    });
    if (applied) {
      debounceSave();
      renderEvidenceChecklist();
      renderDashboard();
    }
    return applied;
  }

  function renderHubEvidenceDashboard() {
    renderHubEvidenceCards(document.getElementById('hub-evidence-dashboard'), null);
  }

  function renderHubEvidenceForQI(qiId) {
    var wrap = document.getElementById('hub-evidence-qi');
    if (!wrap) return;
    renderHubEvidenceCards(wrap, qiId);
  }

  function waitForAuthReady(maxMs) {
    maxMs = maxMs || 3000;
    return new Promise(function(resolve) {
      if (window.__authReady) { resolve(); return; }
      var done = false;
      function finish() { if (!done) { done = true; resolve(); } }
      window.addEventListener('auth-guard-ready', finish, { once: true });
      setTimeout(finish, maxMs);
    });
  }

  function getActiveSchoolYear() {
    if (selectedSchoolYear) return selectedSchoolYear;
    if (window.Hgios4ToolkitService && Hgios4ToolkitService.getSchoolYear) {
      return Hgios4ToolkitService.getSchoolYear();
    }
    return '';
  }

  function dataTimestamp(data) {
    if (!data) return 0;
    var t = data.lastUpdated || data._cloudUpdatedAt || data.exportedAt;
    var n = t ? Date.parse(t) : 0;
    return isNaN(n) ? 0 : n;
  }

  function localDataHasContent(data) {
    if (!data || !data.qis) return false;
    if (data.schoolName || data.facultyName || data.inspectionDate) return true;
    return Object.keys(data.qis).some(function(id) {
      var q = data.qis[id];
      return q && (q.level || q.strengths || q.evidenceSummary || q.fileReferences || q.areasForImprovement);
    });
  }

  async function persistAppData() {
    appData.lastUpdated = new Date().toISOString();
    await Storage.set(appData);
    updateLastUpdatedDisplay();
    if (cloudSaveEnabled && window.Hgios4ToolkitService) {
      updateSyncStatus('saving');
      try {
        var saved = await Hgios4ToolkitService.saveToolkit(appData, getActiveSchoolYear());
        if (saved && saved.id) {
          appData._cloudId = saved.id;
          appData._cloudUpdatedAt = saved.updated_at;
          appData._cloudSchoolYear = saved.school_year;
          cloudMeta.updatedAt = saved.updated_at;
          cloudMeta.schoolYear = saved.school_year;
        }
        await Storage.set(appData);
        pendingLocalMerge = null;
        renderCloudMigrateBanner();
        updateSyncStatus('cloud');
        if (document.getElementById('view-export').classList.contains('active')) renderCloudSyncPanel();
      } catch (err) {
        console.error(err);
        updateSyncStatus('error', Hgios4ToolkitService.formatError(err));
      }
    } else if (IS_EMBED) {
      updateSyncStatus(cloudSaveEnabled ? 'local' : 'offline');
    } else {
      updateSyncStatus('local');
    }
  }

  function renderCloudMigrateBanner() {
    var el = document.getElementById('cloud-migrate-banner');
    if (!el) return;
    if (!pendingLocalMerge || !cloudSaveEnabled) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    var localTs = pendingLocalMerge.local.lastUpdated
      ? new Date(pendingLocalMerge.local.lastUpdated).toLocaleString()
      : 'unknown';
    var cloudTs = pendingLocalMerge.cloud.lastUpdated || pendingLocalMerge.cloud._cloudUpdatedAt
      ? new Date(pendingLocalMerge.cloud.lastUpdated || pendingLocalMerge.cloud._cloudUpdatedAt).toLocaleString()
      : 'unknown';
    el.innerHTML = `
      <div class="cloud-migrate-inner">
        <strong>Local work is newer than the cloud copy</strong>
        <p>This device has changes (${localTs}) that are newer than Faculty Hub cloud (${cloudTs}). Choose what to keep.</p>
        <div class="cloud-migrate-actions">
          <button type="button" class="btn btn-primary btn-sm" id="cloud-use-local-btn">Keep this device &amp; upload to cloud</button>
          <button type="button" class="btn btn-secondary btn-sm" id="cloud-use-cloud-btn">Use cloud copy</button>
          <button type="button" class="btn btn-ghost btn-sm" id="cloud-merge-btn">Merge cloud into local</button>
        </div>
      </div>
    `;
    document.getElementById('cloud-use-local-btn').addEventListener('click', function() {
      pendingLocalMerge = null;
      persistAppData().then(function() { render(); renderCloudMigrateBanner(); });
    });
    document.getElementById('cloud-use-cloud-btn').addEventListener('click', function() {
      appData = mergeData(getDefaultData(), pendingLocalMerge.cloud);
      pendingLocalMerge = null;
      persistAppData().then(function() { render(); renderCloudMigrateBanner(); });
    });
    document.getElementById('cloud-merge-btn').addEventListener('click', function() {
      appData = mergeData(pendingLocalMerge.local, pendingLocalMerge.cloud);
      pendingLocalMerge = null;
      persistAppData().then(function() { render(); renderCloudMigrateBanner(); });
    });
  }

  async function pullFromCloud() {
    if (!cloudSaveEnabled || !window.Hgios4ToolkitService) return;
    var status = document.getElementById('cloud-sync-status');
    if (status) status.textContent = 'Pulling from cloud…';
    try {
      var cloud = await Hgios4ToolkitService.loadToolkit(getActiveSchoolYear());
      if (!cloud || !cloud.version) {
        if (status) { status.textContent = 'No cloud data for this school year yet.'; status.className = 'cloud-sync-status warn'; }
        return;
      }
      appData = mergeData(getDefaultData(), cloud);
      pendingLocalMerge = null;
      await persistAppData();
      render();
      renderCloudMigrateBanner();
      if (status) { status.textContent = 'Loaded from cloud.'; status.className = 'cloud-sync-status success'; }
    } catch (err) {
      if (status) { status.textContent = Hgios4ToolkitService.formatError(err); status.className = 'cloud-sync-status error'; }
    }
  }

  async function pushToCloud() {
    if (!cloudSaveEnabled) return;
    var status = document.getElementById('cloud-sync-status');
    if (status) status.textContent = 'Uploading to cloud…';
    try {
      await persistAppData();
      if (status) { status.textContent = 'Cloud copy saved.'; status.className = 'cloud-sync-status success'; }
    } catch (err) {
      if (status) {
        status.textContent = window.Hgios4ToolkitService
          ? Hgios4ToolkitService.formatError(err)
          : err.message;
        status.className = 'cloud-sync-status error';
      }
    }
  }

  async function renderCloudSyncPanel() {
    var panel = document.getElementById('cloud-sync-panel');
    if (!panel) return;
    var year = getActiveSchoolYear();
    var years = [year];
    if (cloudSaveEnabled && window.Hgios4ToolkitService) {
      try {
        var rows = await Hgios4ToolkitService.listToolkitYears();
        rows.forEach(function(r) {
          if (r.school_year && years.indexOf(r.school_year) === -1) years.push(r.school_year);
        });
      } catch (e) { /* ignore */ }
    }
    years.sort().reverse();
    var yearOptions = years.map(function(y) {
      return `<option value="${escapeHtml(y)}"${y === year ? ' selected' : ''}>${escapeHtml(y)}</option>`;
    }).join('');

    var cloudLine = cloudSaveEnabled
      ? (cloudMeta.updatedAt
        ? 'Last cloud save: ' + new Date(cloudMeta.updatedAt).toLocaleString() + ' (' + escapeHtml(cloudMeta.schoolYear || year) + ')'
        : 'No cloud record for ' + escapeHtml(year) + ' yet — saves will create one.')
      : 'Sign in to Faculty Hub as Faculty Head or admin to enable cloud sync.';

    var localSnap = await Storage.get();
    var localLine = localSnap && localSnap.lastUpdated
      ? 'This device: ' + new Date(localSnap.lastUpdated).toLocaleString()
      : 'This device: no saved data yet';

    panel.innerHTML = `
      <h2>Faculty Hub cloud sync</h2>
      <p class="cloud-sync-intro">Your toolkit auto-saves to Supabase when signed in. Use this panel to move data between devices or resolve conflicts.</p>
      <div class="cloud-sync-meta">
        <div><span class="cloud-sync-label">School year</span>
          <select id="cloud-school-year" class="cloud-school-year">${yearOptions}</select></div>
        <p class="cloud-sync-detail">${escapeHtml(cloudLine)}</p>
        <p class="cloud-sync-detail">${escapeHtml(localLine)}</p>
      </div>
      <p class="cloud-sync-status" id="cloud-sync-status"></p>
      <div class="cloud-sync-actions">
        <button type="button" class="btn btn-primary btn-sm" id="cloud-pull-btn" ${cloudSaveEnabled ? '' : 'disabled'}>Pull from cloud</button>
        <button type="button" class="btn btn-secondary btn-sm" id="cloud-push-btn" ${cloudSaveEnabled ? '' : 'disabled'}>Push to cloud now</button>
      </div>
      <p class="cloud-sync-hint">Apply migration <code>20260527100000_hgios4_toolkit.sql</code> and <code>20260527120000_hgios4_toolkit_management_rls.sql</code> in Supabase if cloud save fails.</p>
    `;

    var sel = document.getElementById('cloud-school-year');
    if (sel) {
      sel.addEventListener('change', function() {
        selectedSchoolYear = sel.value;
        loadData().then(function() {
          renderCloudSyncPanel();
        });
      });
    }
    var pullBtn = document.getElementById('cloud-pull-btn');
    var pushBtn = document.getElementById('cloud-push-btn');
    if (pullBtn) pullBtn.addEventListener('click', pullFromCloud);
    if (pushBtn) pushBtn.addEventListener('click', pushToCloud);
  }

  // Field-specific placeholders and hints
  const FIELD_HINTS = {
    strengths: 'Describe 2–4 key strengths with specific examples. Link to evidence (e.g. "As shown in our learning walks, staff consistently...").',
    areasForImprovement: 'Be honest and specific. What needs to develop? What actions are planned? Inspectors value realistic self-evaluation.',
    evidenceSummary: 'List the main evidence sources: documents, data, observations. Inspectors will want to see these.',
    challengeQuestions: 'Answer the framework challenge question with evidence. Show how you know, not just what you think.',
    actionPlan: 'Clear next steps with timescales. Who is responsible? How will you measure success?',
    fileReferences: 'List document names exactly as stored (e.g. Faculty Improvement Plan 2024.pdf). Keep files in a folder ready to share.'
  };

  // Default data structure for a single QI
  function createEmptyQI(id) {
    return {
      id,
      level: '',
      strengths: '',
      areasForImprovement: '',
      evidenceSummary: '',
      challengeQuestions: '',
      actionPlan: '',
      notes: '',
      fileReferences: ''
    };
  }

  // Generate unique keys for evidence checklist items
  function getEvidenceItemKey(sectionIdx, itemIdx) {
    return `ev-${sectionIdx}-${itemIdx}`;
  }

  // Default full data structure
  function getDefaultData() {
    const qis = {};
    QUALITY_INDICATORS.forEach(qi => {
      qis[qi.id] = createEmptyQI(qi.id);
    });
    const evidenceChecklist = {};
    INSPECTION_READY_EVIDENCE.forEach((section, sIdx) => {
      section.items.forEach((_, iIdx) => {
        evidenceChecklist[getEvidenceItemKey(sIdx, iIdx)] = false;
      });
    });
    return {
      version: 1,
      schoolName: '',
      facultyName: '',
      inspectionDate: null,
      lastUpdated: null,
      qis,
      evidenceChecklist,
      pupilVoiceSurveys: [],
      exportedAt: null
    };
  }

  // Storage layer: LocalStorage with IndexedDB fallback
  const Storage = {
    _useIndexedDB: false,
    _db: null,

    async init() {
      try {
        const test = 'test';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
      } catch (e) {
        this._useIndexedDB = true;
        return this._initIndexedDB();
      }
    },

    async _initIndexedDB() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('hgios4-toolkit', 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          this._db = req.result;
          resolve(true);
        };
        req.onupgradeneeded = (e) => {
          e.target.result.createObjectStore('data', { keyPath: 'key' });
        };
      });
    },

    async get() {
      if (this._useIndexedDB && this._db) {
        return new Promise((resolve, reject) => {
          const tx = this._db.transaction('data', 'readonly');
          const store = tx.objectStore('data');
          const req = store.get(STORAGE_KEY);
          req.onsuccess = () => resolve(req.result ? req.result.value : null);
          req.onerror = () => reject(req.error);
        });
      }
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    async set(data) {
      const str = JSON.stringify(data);
      if (str.length > STORAGE_LIMIT) {
        if (!this._useIndexedDB) {
          await this.init();
          if (this._useIndexedDB) return this.set(data);
        }
      }
      if (this._useIndexedDB && this._db) {
        return new Promise((resolve, reject) => {
          const tx = this._db.transaction('data', 'readwrite');
          const store = tx.objectStore('data');
          store.put({ key: STORAGE_KEY, value: data });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
      localStorage.setItem(STORAGE_KEY, str);
    }
  };

  // Application state
  let appData = getDefaultData();
  let saveTimeout = null;
  let celebrationDismissed = false;

  function debounceSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      persistAppData().catch(console.error);
      saveTimeout = null;
    }, DEBOUNCE_MS);
  }

  function updateLastUpdatedDisplay() {
    const el = document.getElementById('last-updated-label');
    if (el && appData.lastUpdated) {
      el.textContent = 'Last updated: ' + new Date(appData.lastUpdated).toLocaleString();
    } else if (el) {
      el.textContent = '';
    }
  }

  function updateCountdownDisplay() {
    const el = document.getElementById('hero-countdown');
    if (!el) return;
    const cd = getInspectionCountdown();
    if (!cd) {
      el.textContent = '';
      el.className = 'hero-countdown';
      return;
    }
    if (cd.today) {
      el.textContent = 'Inspection is today';
      el.className = 'hero-countdown hero-countdown-today';
    } else if (cd.past) {
      el.textContent = 'Inspection was ' + cd.days + ' day' + (cd.days !== 1 ? 's' : '') + ' ago';
      el.className = 'hero-countdown hero-countdown-past';
    } else {
      el.textContent = cd.days + ' day' + (cd.days !== 1 ? 's' : '') + ' to inspection';
      el.className = 'hero-countdown hero-countdown-upcoming';
    }
  }

  function showCelebration() {
    const overlay = document.getElementById('celebration-overlay');
    if (overlay && !overlay.classList.contains('visible')) {
      overlay.classList.add('visible');
      overlay.setAttribute('aria-hidden', 'false');
    }
  }

  function hideCelebration() {
    celebrationDismissed = true;
    const overlay = document.getElementById('celebration-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      overlay.setAttribute('aria-hidden', 'true');
    }
  }

  async function loadData() {
    applyEmbedChrome();
    pendingLocalMerge = null;
    if (!selectedSchoolYear && window.Hgios4ToolkitService) {
      selectedSchoolYear = Hgios4ToolkitService.getSchoolYear();
    }

    cloudSaveEnabled = false;
    if (window.Hgios4ToolkitService && Hgios4ToolkitService.isCloudEnabled()) {
      await waitForAuthReady(IS_EMBED ? 3500 : 0);
      if (window.__authReady && Hgios4ToolkitService.canManage && Hgios4ToolkitService.canManage()) {
        cloudSaveEnabled = true;
      } else if (window.__authReady && (window.__authGuardCanManageSchool || window.__authGuardIsAdmin)) {
        cloudSaveEnabled = true;
      }
    }

    var local = null;
    var cloud = null;
    try {
      local = await Storage.get();
    } catch (e) {
      console.error(e);
    }

    if (cloudSaveEnabled) {
      try {
        cloud = await Hgios4ToolkitService.loadToolkit(getActiveSchoolYear());
        if (cloud && cloud._cloudUpdatedAt) {
          cloudMeta.updatedAt = cloud._cloudUpdatedAt;
          cloudMeta.schoolYear = cloud._cloudSchoolYear || getActiveSchoolYear();
        } else {
          cloudMeta.updatedAt = null;
          cloudMeta.schoolYear = getActiveSchoolYear();
        }
      } catch (e) {
        console.error(e);
        updateSyncStatus('error', Hgios4ToolkitService.formatError(e));
      }
    }

    if (cloud && cloud.version) {
      if (local && local.version && localDataHasContent(local) && dataTimestamp(local) > dataTimestamp(cloud) + 2000) {
        pendingLocalMerge = { local: local, cloud: cloud };
        appData = mergeData(getDefaultData(), local);
        updateSyncStatus('local', '● Local copy shown — newer than cloud. See banner to sync.');
      } else {
        appData = mergeData(getDefaultData(), cloud);
        await Storage.set(appData);
        updateSyncStatus('cloud');
      }
    } else if (local && local.version) {
      appData = mergeData(getDefaultData(), local);
      if (cloudSaveEnabled && localDataHasContent(local)) {
        try {
          await persistAppData();
        } catch (e) {
          console.error(e);
          updateSyncStatus('error', Hgios4ToolkitService.formatError(e));
        }
      } else {
        updateSyncStatus(IS_EMBED && !cloudSaveEnabled ? 'offline' : 'local');
      }
    } else {
      appData = getDefaultData();
      updateSyncStatus(cloudSaveEnabled ? 'cloud' : (IS_EMBED ? 'offline' : 'local'));
    }

    render();
    renderCloudMigrateBanner();
    if (IS_EMBED) await refreshHubEvidence();
  }

  function mergeData(existing, incoming) {
    const merged = { ...getDefaultData(), ...incoming };
    QUALITY_INDICATORS.forEach(qi => {
      if (!merged.qis[qi.id]) merged.qis[qi.id] = createEmptyQI(qi.id);
      else {
        const def = createEmptyQI(qi.id);
        merged.qis[qi.id] = { ...def, ...merged.qis[qi.id], id: qi.id };
      }
    });
    if (!merged.evidenceChecklist) merged.evidenceChecklist = getDefaultData().evidenceChecklist;
    if (!merged.pupilVoiceSurveys) merged.pupilVoiceSurveys = [];
    INSPECTION_READY_EVIDENCE.forEach((section, sIdx) => {
      section.items.forEach((_, iIdx) => {
        const key = getEvidenceItemKey(sIdx, iIdx);
        if (merged.evidenceChecklist[key] === undefined) merged.evidenceChecklist[key] = false;
      });
    });
    return merged;
  }

  function isQIComplete(qiData) {
    return !!(qiData.level && (qiData.strengths || qiData.evidenceSummary));
  }

  function getProgress() {
    let completed = 0;
    QUALITY_INDICATORS.forEach(qi => {
      if (isQIComplete(appData.qis[qi.id])) completed++;
    });
    return { completed, total: QUALITY_INDICATORS.length };
  }

  function getEvidenceProgress() {
    let completed = 0;
    let total = 0;
    INSPECTION_READY_EVIDENCE.forEach((section, sIdx) => {
      section.items.forEach((_, iIdx) => {
        total++;
        if (appData.evidenceChecklist && appData.evidenceChecklist[getEvidenceItemKey(sIdx, iIdx)]) completed++;
      });
    });
    return { completed, total };
  }

  function getInspectionCountdown() {
    if (!appData.inspectionDate) return null;
    const d = new Date(appData.inspectionDate);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    if (diff > 0) return { days: diff, past: false };
    if (diff === 0) return { days: 0, past: false, today: true };
    return { days: Math.abs(diff), past: true };
  }

  // Dashboard rendering - infographic style
  function renderDashboard() {
    const progress = getProgress();
    const pct = Math.round((progress.completed / progress.total) * 100);
    const evProgress = getEvidenceProgress();

    // Progress ring (SVG circle stroke-dasharray)
    const circumference = 2 * Math.PI * 54;
    const offset = circumference - (pct / 100) * circumference;
    const ring = document.getElementById('progress-ring-fill');
    if (ring) {
      ring.style.strokeDasharray = circumference;
      ring.style.strokeDashoffset = offset;
    }

    const pctEl = document.getElementById('progress-percent');
    if (pctEl) pctEl.textContent = pct;

    const detailEl = document.getElementById('progress-detail');
    if (detailEl) detailEl.textContent = `${progress.completed} of ${progress.total} Quality Indicators completed`;

    const evEl = document.getElementById('progress-evidence');
    if (evEl) evEl.textContent = `${evProgress.completed} of ${evProgress.total} evidence items gathered`;

    const schoolEl = document.getElementById('school-name');
    const facultyEl = document.getElementById('faculty-name');
    const inspectionDateEl = document.getElementById('inspection-date');
    if (schoolEl) schoolEl.value = appData.schoolName || '';
    if (facultyEl) facultyEl.value = appData.facultyName || '';
    if (inspectionDateEl) inspectionDateEl.value = appData.inspectionDate ? appData.inspectionDate.slice(0, 10) : '';

    updateCountdownDisplay();
    updateLastUpdatedDisplay();

    if (pct === 100 && !celebrationDismissed) showCelebration();

    [1, 2, 3].forEach(cat => {
      const container = document.getElementById(`qi-tiles-${cat}`);
      if (!container) return;
      container.innerHTML = '';
      QUALITY_INDICATORS.filter(qi => qi.category === cat).forEach(qi => {
        const data = appData.qis[qi.id];
        const complete = isQIComplete(data);
        const hasContent = !!(data.level || data.strengths || data.evidenceSummary || data.fileReferences);
        const docCount = data.fileReferences ? data.fileReferences.split(/[,;]/).filter(s => s.trim()).length : 0;
        const hubReady = hubEvidenceCache
          ? hubEvidenceEntriesForQI(qi.id).filter(function(e) { return e.result.status === 'ok'; }).length
          : 0;

        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = `qi-tile qi-link ${complete ? 'complete' : ''} ${hasContent && !complete ? 'started' : ''}`;
        tile.dataset.qi = qi.id;
        tile.innerHTML = `
          <span class="qi-tile-id">${qi.id}</span>
          <span class="qi-tile-title">${qi.title}${qi.core ? ' <em>(Core)</em>' : ''}</span>
          <span class="qi-tile-level">${data.level ? `L${data.level}` : '—'}</span>
          <span class="qi-tile-status">
            ${complete ? '<span class="tile-check">✓</span>' : docCount > 0 ? `<span class="tile-docs">${docCount} doc${docCount !== 1 ? 's' : ''}</span>` : '<span class="tile-empty">Add evidence</span>'}
            ${hubReady ? `<span class="qi-tile-hub" title="${hubReady} Faculty Hub source${hubReady !== 1 ? 's' : ''} with data">${hubReady} hub</span>` : ''}
          </span>
        `;
        container.appendChild(tile);
      });
    });
    if (IS_EMBED) {
      if (hubEvidenceCache) renderHubEvidenceDashboard();
      else refreshHubEvidence();
    }
  }

  // QI detail form
  function renderQIDetail(qiId) {
    const qi = QUALITY_INDICATORS.find(q => q.id === qiId);
    if (!qi) return;
    const data = appData.qis[qiId];

    document.getElementById('qi-detail-title').textContent =
      `QI ${qi.id}: ${qi.title}${qi.core ? ' (Core Quality Indicator)' : ''}`;

    const challengeQ = CHALLENGE_QUESTIONS[qiId] || 'Consider the features of highly effective practice and challenge questions from the HGIOS 4 framework.';
    const inspectorFocus = INSPECTOR_FOCUS[qiId] || '';
    const evidenceGuide = EVIDENCE_GUIDANCE[qiId] || '';

    const content = document.getElementById('qi-detail-content');
    const suggestBar = IS_EMBED && window.HgiosHubBridge ? `
      <div class="qi-suggest-bar">
        <div>
          <strong>Suggest from Faculty Hub</strong>
          <p class="qi-suggest-sub">Pre-fill evidence summary, strengths and file references from trackers, curriculum, DIP and other hub tools. Always review before inspection.</p>
        </div>
        <div class="qi-suggest-actions">
          <button type="button" class="btn btn-primary btn-sm" id="qi-suggest-merge">Add hub summary</button>
          <button type="button" class="btn btn-secondary btn-sm" id="qi-suggest-replace">Replace with hub summary</button>
        </div>
        <p class="qi-suggest-status" id="qi-suggest-status"></p>
      </div>
    ` : '';
    content.innerHTML = `
      <div id="hub-evidence-qi" class="hub-evidence-panel" hidden></div>
      ${suggestBar}
      <div class="qi-form">
        <div class="form-section guidance-box">
          <h4>What Inspectors Look For</h4>
          <p class="inspector-focus">${inspectorFocus}</p>
        </div>
        <div class="form-section guidance-box">
          <h4>Suggested Evidence to Gather</h4>
          <p class="evidence-guide">${evidenceGuide}</p>
        </div>
        <div class="form-section">
          <h4>Challenge Question</h4>
          <p class="challenge-question">${challengeQ}</p>
          <p class="framework-note">Refer to HGIOS 4 (Education Scotland) for Level 5 illustrations and full challenge questions.</p>
        </div>

        <div class="form-section">
          <label>
            <span>Level (1–6)</span>
            <select id="qi-level" data-qi="${qiId}">
              <option value="">— Select level —</option>
              ${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${data.level == n ? 'selected' : ''}>Level ${n}</option>`).join('')}
            </select>
          </label>
          <p class="field-hint">Level 5 = very good; Level 6 = excellent. Be evidence-based.</p>
        </div>

        <div class="form-section">
          <label>
            <span>Key Strengths</span>
            <textarea id="qi-strengths" data-qi="${qiId}" rows="4" placeholder="${escapeHtml(FIELD_HINTS.strengths)}">${escapeHtml(data.strengths)}</textarea>
          </label>
        </div>

        <div class="form-section">
          <label>
            <span>Areas for Improvement</span>
            <textarea id="qi-areas" data-qi="${qiId}" rows="4" placeholder="${escapeHtml(FIELD_HINTS.areasForImprovement)}">${escapeHtml(data.areasForImprovement)}</textarea>
          </label>
        </div>

        <div class="form-section">
          <label>
            <span>Evidence Summary</span>
            <textarea id="qi-evidence" data-qi="${qiId}" rows="3" placeholder="${escapeHtml(FIELD_HINTS.evidenceSummary)}">${escapeHtml(data.evidenceSummary)}</textarea>
          </label>
        </div>

        <div class="form-section">
          <label>
            <span>Challenge Questions Response</span>
            <textarea id="qi-challenge" data-qi="${qiId}" rows="4" placeholder="${escapeHtml(FIELD_HINTS.challengeQuestions)}">${escapeHtml(data.challengeQuestions)}</textarea>
          </label>
        </div>

        <div class="form-section">
          <label>
            <span>Action Plan</span>
            <textarea id="qi-action" data-qi="${qiId}" rows="3" placeholder="${escapeHtml(FIELD_HINTS.actionPlan)}">${escapeHtml(data.actionPlan)}</textarea>
          </label>
        </div>

        <div class="form-section">
          <label>
            <span>File References</span>
            <input type="text" id="qi-files" data-qi="${qiId}" placeholder="${escapeHtml(FIELD_HINTS.fileReferences)}" value="${escapeHtml(data.fileReferences)}">
          </label>
        </div>

        <div class="form-section">
          <label>
            <span>Notes</span>
            <textarea id="qi-notes" data-qi="${qiId}" rows="2" placeholder="Any additional notes for inspection">${escapeHtml(data.notes)}</textarea>
          </label>
        </div>
      </div>
    `;

    // Bind inputs
    ['level', 'strengths', 'areas', 'evidence', 'challenge', 'action', 'files', 'notes'].forEach(field => {
      const map = { level: 'level', strengths: 'strengths', areas: 'areasForImprovement', evidence: 'evidenceSummary', challenge: 'challengeQuestions', action: 'actionPlan', files: 'fileReferences', notes: 'notes' };
      const el = content.querySelector(`#qi-${field}`);
      if (el) {
        el.addEventListener('input', () => {
          const val = el.tagName === 'SELECT' ? el.value : el.value;
          appData.qis[qiId][map[field]] = val;
          debounceSave();
        });
      }
    });
    if (IS_EMBED) renderHubEvidenceForQI(qiId);
    var mergeBtn = document.getElementById('qi-suggest-merge');
    var replaceBtn = document.getElementById('qi-suggest-replace');
    if (mergeBtn) mergeBtn.addEventListener('click', function() { applyHubSuggestionToQi(qiId, 'merge'); });
    if (replaceBtn) replaceBtn.addEventListener('click', function() {
      if (confirm('Replace existing text in strengths, evidence summary and file references with Faculty Hub suggestions?')) {
        applyHubSuggestionToQi(qiId, 'replace');
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Report view - enhanced with cover and table of contents
  function renderReport() {
    const meta = document.getElementById('report-meta');
    meta.textContent = `${appData.schoolName || 'School'} — ${appData.facultyName || 'Faculty'} — ${appData.lastUpdated ? new Date(appData.lastUpdated).toLocaleString() : 'Not yet updated'}`;

    const container = document.getElementById('report-content');
    const inspectionDateStr = appData.inspectionDate ? new Date(appData.inspectionDate).toLocaleDateString() : '';

    let html = `
      <div class="report-cover">
        <h2>HGIOS 4 Faculty Self-Evaluation Report</h2>
        <p class="report-school">${escapeHtml(appData.schoolName || 'School')}</p>
        <p class="report-faculty">${escapeHtml(appData.facultyName || 'Faculty')}</p>
        ${inspectionDateStr ? `<p class="report-date">Prepared for inspection: ${inspectionDateStr}</p>` : ''}
        <p class="report-generated">Generated: ${new Date().toLocaleString()}</p>
      </div>
      <div class="report-toc">
        <h3>Contents</h3>
        <ol>
          <li>Leadership and Management (QI 1.1 – 1.5)</li>
          <li>Learning Provision (QI 2.1 – 2.5)</li>
          <li>Successes and Achievements (QI 3.1 – 3.4)</li>
          ${appData.pupilVoiceSurveys && appData.pupilVoiceSurveys.length > 0 ? '<li>Pupil Voice Summary</li>' : ''}
        </ol>
      </div>
    `;

    [1, 2, 3].forEach(cat => {
      const catNames = { 1: 'Leadership and Management', 2: 'Learning Provision', 3: 'Successes and Achievements' };
      html += `<div class="report-category"><h3>${cat}. ${catNames[cat]}</h3>`;
      QUALITY_INDICATORS.filter(qi => qi.category === cat).forEach(qi => {
        const d = appData.qis[qi.id];
        html += `
          <div class="report-qi">
            <h4>QI ${qi.id}: ${qi.title}${qi.core ? ' (Core)' : ''}</h4>
            <p><strong>Level:</strong> ${d.level || '—'}</p>
            ${d.strengths ? `<p><strong>Strengths:</strong></p><p>${escapeHtml(d.strengths)}</p>` : ''}
            ${d.areasForImprovement ? `<p><strong>Areas for Improvement:</strong></p><p>${escapeHtml(d.areasForImprovement)}</p>` : ''}
            ${d.evidenceSummary ? `<p><strong>Evidence:</strong></p><p>${escapeHtml(d.evidenceSummary)}</p>` : ''}
            ${d.challengeQuestions ? `<p><strong>Challenge Questions:</strong></p><p>${escapeHtml(d.challengeQuestions)}</p>` : ''}
            ${d.actionPlan ? `<p><strong>Action Plan:</strong></p><p>${escapeHtml(d.actionPlan)}</p>` : ''}
            ${d.fileReferences ? `<p><strong>File References:</strong> ${escapeHtml(d.fileReferences)}</p>` : ''}
            ${IS_EMBED && hubEvidenceCache ? (function() {
              var lines = getHubEvidenceLinesForQI(qi.id);
              if (!lines.length) return '';
              return '<div class="report-hub-qi"><p><strong>Faculty Hub snapshot:</strong></p><ul>' +
                lines.map(function(l) { return '<li>' + escapeHtml(l) + '</li>'; }).join('') + '</ul></div>';
            })() : ''}
          </div>
        `;
      });
      html += '</div>';
    });

    if (IS_EMBED && hubEvidenceCache && hubEvidenceLastRefresh) {
      var hubOk = hubEvidenceCache.filter(function(e) { return e.result.status === 'ok'; }).length;
      html += '<div class="report-category report-hub-appendix"><h3>Faculty Hub evidence overview</h3>';
      html += '<p class="report-hub-note">Live snapshot at ' + hubEvidenceLastRefresh.toLocaleString() + ' — ' + hubOk + ' of ' + hubEvidenceCache.length + ' linked tools have data. Refresh in the toolkit before printing for the latest status.</p><ul>';
      hubEvidenceCache.forEach(function(e) {
        html += '<li><strong>' + escapeHtml(e.source.label) + ':</strong> ' + escapeHtml(e.result.detail || '') +
          (e.result.summary ? ' <span class="report-hub-summary">' + escapeHtml(e.result.summary) + '</span>' : '') + '</li>';
      });
      html += '</ul></div>';
    }

    if (appData.pupilVoiceSurveys && appData.pupilVoiceSurveys.length > 0) {
      html += `<div class="report-category report-pupilvoice"><h3>Pupil Voice Summary</h3>`;
      appData.pupilVoiceSurveys.forEach((survey, idx) => {
        html += `<div class="report-qi"><h4>${escapeHtml(survey.name || 'Survey ' + (idx + 1))}</h4><p><strong>${survey.responseCount} responses</strong></p>`;
        survey.questions.slice(0, 5).forEach(q => {
          html += `<p><strong>${escapeHtml(q.question)}</strong></p>`;
          if (q.positivePct !== null) html += `<p>${q.positivePct}% positive</p>`;
          html += '<ul>';
          q.distribution.slice(0, 5).forEach(d => {
            html += `<li>${escapeHtml(d.option)}: ${d.count} (${d.pct}%)</li>`;
          });
          html += '</ul>';
        });
        html += '</div>';
      });
      html += '</div>';
    }

    container.innerHTML = html;
  }

  // Search across QIs
  function searchQIs(query) {
    if (!query || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    const results = [];
    QUALITY_INDICATORS.forEach(qi => {
      const data = appData.qis[qi.id];
      const searchable = [
        qi.title,
        data.strengths,
        data.evidenceSummary,
        data.notes,
        data.fileReferences
      ].filter(Boolean).join(' ').toLowerCase();
      if (searchable.includes(q)) {
        let matchIn = 'title';
        if (data.strengths && data.strengths.toLowerCase().includes(q)) matchIn = 'strengths';
        else if (data.evidenceSummary && data.evidenceSummary.toLowerCase().includes(q)) matchIn = 'evidence';
        else if (data.notes && data.notes.toLowerCase().includes(q)) matchIn = 'notes';
        else if (data.fileReferences && data.fileReferences.toLowerCase().includes(q)) matchIn = 'files';
        results.push({ qi, matchIn });
      }
    });
    return results;
  }

  // View switching
  function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const view = document.getElementById(`view-${viewId}`);
    const btn = document.querySelector(`[data-view="${viewId}"]`);
    if (view) view.classList.add('active');
    if (btn) btn.classList.add('active');

    if (viewId === 'dashboard') {
      renderDashboard();
      if (IS_EMBED) refreshHubEvidence();
    }
    if (viewId === 'evidence') renderEvidenceChecklist();
    if (viewId === 'pupilvoice') renderPupilVoice();
    if (viewId === 'report') renderReport();
    if (viewId === 'export') renderCloudSyncPanel();
    if (viewId === 'qi' && IS_EMBED) refreshHubEvidence();
  }

  // Parse CSV to array of objects (handles quoted fields with commas)
  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return null;
    const parseRow = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') inQuotes = !inQuotes;
        else if (c === ',' && !inQuotes) { result.push(current.replace(/^"|"$/g, '').trim()); current = ''; }
        else current += c;
      }
      result.push(current.replace(/^"|"$/g, '').trim());
      return result;
    };
    const headers = parseRow(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseRow(lines[i]);
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });
      rows.push(obj);
    }
    return { headers, rows };
  }

  // Parse Excel using SheetJS (if available)
  function parseExcel(buffer) {
    if (typeof XLSX === 'undefined') return null;
    const wb = XLSX.read(buffer, { type: 'array' });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
    if (!data || data.length < 2) return null;
    const headers = data[0].map(h => String(h || '').trim());
    const rows = [];
    for (let i = 1; i < data.length; i++) {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = String(data[i][idx] ?? '').trim(); });
      rows.push(obj);
    }
    return { headers, rows };
  }

  // Analyse survey data for summary
  function analyseSurveyData(parsed) {
    const { headers, rows } = parsed;
    const responseCount = rows.length;
    const questions = headers.filter(h => h && !/^(id|respondent|timestamp|start|completion)\s/i.test(h.trim()));
    const analysis = questions.map(q => {
      const values = rows.map(r => (r[q] || '').toString().trim()).filter(Boolean);
      const counts = {};
      values.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
      const total = values.length;
      const distribution = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([opt, n]) => ({ option: opt, count: n, pct: total ? Math.round((n / total) * 100) : 0 }));
      const isScale = /^(strongly agree|agree|disagree|strongly disagree|yes|no|\d)/i.test(values[0] || '') ||
        distribution.length <= 5;
      let positivePct = null;
      if (isScale && distribution.length > 0) {
        const positive = ['strongly agree', 'agree', 'yes', '5', '4', 'very good', 'good'].map(s => s.toLowerCase());
        const posCount = distribution.filter(d => positive.some(p => d.option.toLowerCase().includes(p))).reduce((a, d) => a + d.count, 0);
        positivePct = total ? Math.round((posCount / total) * 100) : 0;
      }
      return { question: q, total, distribution, positivePct };
    });
    return { responseCount, questions: analysis };
  }

  // Pupil Voice view
  function renderPupilVoice() {
    const statusEl = document.getElementById('pupilvoice-status');
    const summaryEl = document.getElementById('pupilvoice-summary');
    if (statusEl) statusEl.textContent = '';
    if (summaryEl) {
      if (!appData.pupilVoiceSurveys || appData.pupilVoiceSurveys.length === 0) {
        summaryEl.innerHTML = '<p class="pupilvoice-empty">No survey data uploaded yet. Upload Excel or CSV from Microsoft Forms to see pupil voice summaries.</p>';
        return;
      }
      let html = '';
      appData.pupilVoiceSurveys.forEach((survey, idx) => {
        html += `
          <div class="pupilvoice-survey-card">
            <div class="pupilvoice-survey-header">
              <h3>${escapeHtml(survey.name || 'Survey ' + (idx + 1))}</h3>
              <span class="pupilvoice-response-count">${survey.responseCount} responses</span>
              <button type="button" class="btn btn-secondary btn-sm pupilvoice-remove" data-idx="${idx}">Remove</button>
            </div>
            <div class="pupilvoice-questions">
              ${survey.questions.map(q => {
                let qHtml = `<div class="pupilvoice-question"><h4>${escapeHtml(q.question)}</h4>`;
                if (q.positivePct !== null) {
                  qHtml += `<p class="pupilvoice-positive">${q.positivePct}% positive (agree/very good)</p>`;
                }
                qHtml += '<div class="pupilvoice-distribution">';
                q.distribution.slice(0, 8).forEach(d => {
                  qHtml += `<div class="pupilvoice-bar-wrap"><span class="pupilvoice-option">${escapeHtml(d.option)}</span><div class="pupilvoice-bar"><div class="pupilvoice-bar-fill" style="width:${d.pct}%"></div></div><span class="pupilvoice-count">${d.count} (${d.pct}%)</span></div>`;
                });
                qHtml += '</div></div>';
                return qHtml;
              }).join('')}
            </div>
          </div>
        `;
      });
      summaryEl.innerHTML = html;
      summaryEl.querySelectorAll('.pupilvoice-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          appData.pupilVoiceSurveys.splice(parseInt(btn.dataset.idx), 1);
          debounceSave();
          renderPupilVoice();
        });
      });
    }
  }

  function handlePupilVoiceUpload(file) {
    const statusEl = document.getElementById('pupilvoice-status');
    if (!file) return;
    const ext = (file.name || '').toLowerCase().split('.').pop();
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let parsed = null;
        if (ext === 'csv') {
          parsed = parseCSV(e.target.result);
        } else if (ext === 'xlsx' || ext === 'xls') {
          parsed = parseExcel(e.target.result);
          if (!parsed && typeof XLSX === 'undefined') {
            statusEl.textContent = 'Excel support requires an internet connection. Use CSV export from Microsoft Forms for offline use.';
            statusEl.className = 'pupilvoice-status error';
            return;
          }
        }
        if (!parsed || parsed.rows.length === 0) {
          statusEl.textContent = 'Could not parse file. Ensure it has headers and data rows.';
          statusEl.className = 'pupilvoice-status error';
          return;
        }
        const analysis = analyseSurveyData(parsed);
        const survey = {
          name: file.name.replace(/\.[^.]+$/, ''),
          uploadedAt: new Date().toISOString(),
          responseCount: analysis.responseCount,
          questions: analysis.questions
        };
        if (!appData.pupilVoiceSurveys) appData.pupilVoiceSurveys = [];
        appData.pupilVoiceSurveys.push(survey);
        debounceSave();
        renderPupilVoice();
        statusEl.textContent = `Loaded ${analysis.responseCount} responses from ${analysis.questions.length} questions.`;
        statusEl.className = 'pupilvoice-status success';
      } catch (err) {
        statusEl.textContent = 'Error: ' + err.message;
        statusEl.className = 'pupilvoice-status error';
      }
    };
    if (ext === 'csv') {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

  // Inspection-Ready evidence checklist
  function renderEvidenceChecklist() {
    const container = document.getElementById('evidence-checklist');
    if (!container) return;

    const evProgress = getEvidenceProgress();

    var suggestBar = IS_EMBED && window.HgiosHubBridge ? `
      <div class="evidence-suggest-bar">
        <p><strong>Hub-linked suggestions</strong> — items with a green hint can be ticked automatically when Faculty Hub already has evidence.</p>
        <button type="button" class="btn btn-primary btn-sm" id="checklist-apply-suggestions">Tick suggested items</button>
        <span class="evidence-suggest-note" id="checklist-suggest-note"></span>
      </div>
    ` : '';

    let html = `
      <div class="evidence-intro">
        <h2>Inspection-Ready Evidence Checklist</h2>
        <p>Everything a Faculty Head should have ready for inspection. Tick items as you gather them.</p>
        <p class="evidence-progress-bar"><strong>${evProgress.completed} of ${evProgress.total}</strong> evidence items gathered</p>
        ${suggestBar}
      </div>
    `;

    INSPECTION_READY_EVIDENCE.forEach((section, sIdx) => {
      const sectionCompleted = section.items.filter((_, iIdx) => appData.evidenceChecklist && appData.evidenceChecklist[getEvidenceItemKey(sIdx, iIdx)]).length;
      const sectionTotal = section.items.length;
      html += `
        <div class="evidence-section">
          <h3>${escapeHtml(section.category)} <span class="evidence-section-count">${sectionCompleted}/${sectionTotal}</span></h3>
          <p class="evidence-desc">${escapeHtml(section.description)}</p>
          <ul class="evidence-list evidence-checklist-interactive">
            ${section.items.map((item, iIdx) => {
              const key = getEvidenceItemKey(sIdx, iIdx);
              const checked = appData.evidenceChecklist && appData.evidenceChecklist[key];
              var hubSug = (IS_EMBED && window.HgiosHubBridge)
                ? HgiosHubBridge.getChecklistSuggestions(hubDataSnapshot, item, hubEvidenceCache)
                : { suggested: false, reason: '' };
              var sugHint = hubSug.suggested && !checked
                ? `<span class="evidence-hub-hint" title="${escapeHtml(hubSug.reason)}">Hub: ${escapeHtml(hubSug.reason)}</span>`
                : '';
              return `<li class="evidence-item ${checked ? 'checked' : ''} ${hubSug.suggested ? 'evidence-hub-suggested' : ''}">
                <label class="evidence-checkbox-label">
                  <input type="checkbox" class="evidence-checkbox" data-key="${escapeHtml(key)}" ${checked ? 'checked' : ''}>
                  <span>${escapeHtml(item)}</span>
                  ${sugHint}
                </label>
              </li>`;
            }).join('')}
          </ul>
        </div>
      `;
    });

    html += `
      <div class="evidence-tips">
        <h3>Tips for Inspection Day</h3>
        <ul>
          <li>Have a single evidence folder with an index of contents</li>
          <li>Ensure all documents are dated and current</li>
          <li>Be ready to talk through your self-evaluation and evidence</li>
          <li>Inspectors may observe lessons – ensure staff are briefed</li>
          <li>Know your key strengths and areas for improvement</li>
        </ul>
      </div>
    `;

    container.innerHTML = html;

    var applySugBtn = document.getElementById('checklist-apply-suggestions');
    if (applySugBtn) {
      applySugBtn.addEventListener('click', function() {
        var n = applyChecklistSuggestions('apply');
        var note = document.getElementById('checklist-suggest-note');
        if (note) {
          note.textContent = n ? ('Ticked ' + n + ' item' + (n !== 1 ? 's' : '') + ' based on hub data.') : 'No new suggestions to apply (refresh hub evidence first).';
        }
      });
    }

    container.querySelectorAll('.evidence-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const key = cb.dataset.key;
        appData.evidenceChecklist[key] = cb.checked;
        cb.closest('.evidence-item').classList.toggle('checked', cb.checked);
        debounceSave();
        const evProgress = getEvidenceProgress();
        const progEl = container.querySelector('.evidence-progress-bar');
        if (progEl) progEl.innerHTML = `<strong>${evProgress.completed} of ${evProgress.total}</strong> evidence items gathered`;
        const section = cb.closest('.evidence-section');
        if (section) {
          const sectionH3 = section.querySelector('h3 .evidence-section-count');
          if (sectionH3) {
            const checked = section.querySelectorAll('.evidence-checkbox:checked').length;
            sectionH3.textContent = `${checked}/${section.querySelectorAll('.evidence-checkbox').length}`;
          }
        }
        renderDashboard();
      });
    });
  }

  // Export
  function exportData() {
    const data = {
      ...appData,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hgios4-toolkit-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Import
  function importData(file, mode) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.qis) throw new Error('Invalid file format');
        if (mode === 'replace') {
          appData = mergeData(getDefaultData(), data);
        } else {
          Object.keys(data.qis || {}).forEach(id => {
            if (appData.qis[id]) {
              appData.qis[id] = { ...appData.qis[id], ...data.qis[id], id };
            }
          });
          if (data.schoolName) appData.schoolName = data.schoolName;
          if (data.facultyName) appData.facultyName = data.facultyName;
          if (data.inspectionDate) appData.inspectionDate = data.inspectionDate;
          if (data.evidenceChecklist) {
            Object.assign(appData.evidenceChecklist, data.evidenceChecklist);
          }
          if (data.pupilVoiceSurveys && Array.isArray(data.pupilVoiceSurveys)) {
            appData.pupilVoiceSurveys = [...(appData.pupilVoiceSurveys || []), ...data.pupilVoiceSurveys];
          }
        }
        persistAppData().then(() => {
          document.getElementById('import-status').textContent = 'Import successful' + (cloudSaveEnabled ? ' and synced to cloud.' : '.');
          document.getElementById('import-status').className = 'import-status success';
          showView('dashboard');
        }).catch(err => {
          var msg = window.Hgios4ToolkitService ? Hgios4ToolkitService.formatError(err) : err.message;
          document.getElementById('import-status').textContent = 'Import failed: ' + msg;
          document.getElementById('import-status').className = 'import-status error';
        });
      } catch (err) {
        document.getElementById('import-status').textContent = 'Invalid file: ' + err.message;
        document.getElementById('import-status').className = 'import-status error';
      }
    };
    reader.readAsText(file);
  }

  // Main render
  function render() {
    renderDashboard();
  }

  function safeOn(el, event, handler) {
    if (el) el.addEventListener(event, handler);
  }

  // Event bindings
  function bindEvents() {
    bindQiNavigation();

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => showView(btn.dataset.view));
    });

    safeOn(document.getElementById('back-to-dashboard'), 'click', () => showView('dashboard'));

    safeOn(document.getElementById('school-name'), 'input', (e) => {
      appData.schoolName = e.target.value;
      debounceSave();
    });
    safeOn(document.getElementById('faculty-name'), 'input', (e) => {
      appData.facultyName = e.target.value;
      debounceSave();
    });

    const inspectionDateEl = document.getElementById('inspection-date');
    if (inspectionDateEl) {
      inspectionDateEl.addEventListener('change', (e) => {
        appData.inspectionDate = e.target.value ? new Date(e.target.value).toISOString().slice(0, 10) : null;
        debounceSave();
        updateCountdownDisplay();
      });
    }

    safeOn(document.getElementById('export-btn'), 'click', exportData);

    safeOn(document.getElementById('pupilvoice-upload-btn'), 'click', () => {
      var f = document.getElementById('pupilvoice-file');
      if (f) f.click();
    });
    safeOn(document.getElementById('pupilvoice-file'), 'change', (e) => {
      const file = e.target.files[0];
      if (file) handlePupilVoiceUpload(file);
      e.target.value = '';
    });

    safeOn(document.getElementById('import-btn'), 'click', () => {
      var f = document.getElementById('import-file');
      if (f) f.click();
    });
    safeOn(document.getElementById('import-file'), 'change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const modeEl = document.querySelector('input[name="import-mode"]:checked');
        importData(file, modeEl ? modeEl.value : 'replace');
        e.target.value = '';
      }
    });

    safeOn(document.getElementById('print-report'), 'click', () => window.print());

    safeOn(document.getElementById('celebration-dismiss'), 'click', hideCelebration);

    safeOn(document.getElementById('shortcut-hint'), 'click', () => {
      var modal = document.getElementById('shortcuts-modal');
      if (modal) {
        modal.classList.add('visible');
        modal.setAttribute('aria-hidden', 'false');
      }
    });
    safeOn(document.getElementById('shortcuts-close'), 'click', () => {
      var modal = document.getElementById('shortcuts-modal');
      if (modal) {
        modal.classList.remove('visible');
        modal.setAttribute('aria-hidden', 'true');
      }
    });

    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    if (searchInput && searchResults) {
      let searchTimeout;
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = searchInput.value;
        if (q.length < 2) {
          searchResults.innerHTML = '';
          searchResults.classList.remove('visible');
          return;
        }
        searchTimeout = setTimeout(() => {
          const results = searchQIs(q);
          if (results.length === 0) {
            searchResults.innerHTML = '<div class="search-no-results">No matches</div>';
          } else {
            searchResults.innerHTML = results.slice(0, 8).map(r => `
              <button type="button" class="search-result-item" data-qi="${r.qi.id}">
                QI ${r.qi.id}: ${escapeHtml(r.qi.title)} — match in ${r.matchIn}
              </button>
            `).join('');
            searchResults.querySelectorAll('.search-result-item').forEach(btn => {
              btn.addEventListener('click', () => {
                openQiDetail(btn.dataset.qi);
                searchInput.value = '';
                searchResults.innerHTML = '';
                searchResults.classList.remove('visible');
              });
            });
          }
          searchResults.classList.add('visible');
        }, 200);
      });
      searchInput.addEventListener('blur', () => {
        setTimeout(() => searchResults.classList.remove('visible'), 150);
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea, select')) return;
      if (e.key === 'd' || e.key === 'D') { showView('dashboard'); e.preventDefault(); }
      if (e.key === 'e' || e.key === 'E') { showView('evidence'); e.preventDefault(); }
      if (e.key === 'p' || e.key === 'P') { showView('pupilvoice'); e.preventDefault(); }
      if (e.key === 'r' || e.key === 'R') { showView('report'); e.preventDefault(); }
      if (e.key === '/') { e.preventDefault(); searchInput && searchInput.focus(); }
      if (e.key === '?' && !e.shiftKey) return;
      if (e.key === 'Shift' && e.code === 'ShiftLeft') return;
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        document.getElementById('shortcuts-modal').classList.add('visible');
        document.getElementById('shortcuts-modal').setAttribute('aria-hidden', 'false');
        e.preventDefault();
      }
      if (e.key === 'Escape') {
        hideCelebration();
        document.getElementById('shortcuts-modal').classList.remove('visible');
      }
    });

    if (!IS_EMBED && 'serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
      navigator.serviceWorker.register('hgios4-toolkit-sw.js').catch(() => {});
    }

    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const banner = document.getElementById('pwa-banner');
      if (banner && !localStorage.getItem('pwa-banner-dismissed')) {
        banner.classList.add('visible');
        banner.setAttribute('aria-hidden', 'false');
      }
    });
    var pwaInstall = document.getElementById('pwa-install');
    var pwaDismiss = document.getElementById('pwa-dismiss');
    var pwaBanner = document.getElementById('pwa-banner');
    if (pwaInstall) {
      pwaInstall.addEventListener('click', () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(() => {
            if (pwaBanner) pwaBanner.classList.remove('visible');
          });
        }
      });
    }
    if (pwaDismiss) {
      pwaDismiss.addEventListener('click', () => {
        if (pwaBanner) pwaBanner.classList.remove('visible');
        localStorage.setItem('pwa-banner-dismissed', '1');
      });
    }

  }

  // Init — QI navigation binds immediately so embed mode works even if later setup throws
  bindQiNavigation();
  Storage.init().then(function() {
    return loadData();
  }).then(function() {
    bindEvents();
    if (IS_EMBED) {
      setupHubEvidenceAutoRefresh();
      window.addEventListener('auth-guard-ready', function() { refreshHubEvidence(); }, { once: true });
    }
  }).catch(console.error);
})();
