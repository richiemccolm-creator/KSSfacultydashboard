/**
 * Faculty Hub data bridge for HGIOS 4 toolkit — curriculum, trackers, monitoring, suggestions.
 */
(function() {
  'use strict';

  function hubTruncate(str, max) {
    str = String(str || '').trim();
    if (!str) return '';
    max = max || 500;
    return str.length <= max ? str : str.slice(0, max - 1) + '…';
  }

  function countCurriculumUnits(cu, subject, years) {
    var subj = cu && cu[subject];
    if (!subj) return 0;
    var n = 0;
    (years || []).forEach(function(yg) {
      if (subj[yg] && subj[yg].length) n += subj[yg].length;
    });
    return n;
  }

  function analyzeTrackerPayload(data, subjectLabel) {
    if (!data || !data.pupils) return { pupils: 0, withNotes: 0, yearGroups: [] };
    var pupilIds = {};
    var withNotes = 0;
    var ygs = [];
    ['s1', 's2', 's3', 's4', 's5', 's6'].forEach(function(yg) {
      var classes = data.pupils[yg];
      if (!classes) return;
      ygs.push(yg);
      Object.keys(classes).forEach(function(cls) {
        (classes[cls] || []).forEach(function(p) {
          if (!p || !p.id) return;
          pupilIds[p.id] = true;
          var prof = data.profiles && data.profiles[yg] && data.profiles[yg][p.id] ? data.profiles[yg][p.id] : {};
          if (String(prof.teacherNotes || prof.pupilReflection || '').trim()) withNotes++;
        });
      });
    });
    return { pupils: Object.keys(pupilIds).length, withNotes: withNotes, yearGroups: ygs, subject: subjectLabel };
  }

  function analyzeMonitoringRows(rows) {
    var byKey = {};
    var dramaTeachers = 0;
    var artTeachers = 0;
    (rows || []).forEach(function(row) {
      var subject = row.data_type === 'drama-v3' ? 'drama' : row.data_type === 'art-v2' ? 'art' : null;
      if (!subject || !row.data) return;
      if (subject === 'drama') dramaTeachers++;
      else artTeachers++;
      ['s1', 's2', 's3'].forEach(function(yg) {
        var classes = row.data.pupils && row.data.pupils[yg] ? row.data.pupils[yg] : {};
        Object.keys(classes).forEach(function(cls) {
          (classes[cls] || []).forEach(function(p) {
            var key = String(p.name || '').trim().toLowerCase() + '|' + yg + '|' + cls;
            if (!byKey[key]) {
              byKey[key] = { lowDims: 0, scored: 0 };
            }
            var scores = row.data.scores && row.data.scores[yg] && row.data.scores[yg][p.id] ? row.data.scores[yg][p.id] : {};
            var dims = subject === 'drama'
              ? ['creating', 'presenting', 'evaluating', 'effort', 'behaviour', 'homelearning']
              : ['creating', 'presenting', 'evaluating', 'effort', 'behaviour', 'homelearning'];
            dims.forEach(function(d) {
              var v = parseFloat(scores[d]);
              if (!isNaN(v) && v > 0) {
                byKey[key].scored++;
                if (v < 2.5) byKey[key].lowDims++;
              }
            });
          });
        });
      });
    });
    var pupils = Object.keys(byKey).length;
    var atRisk = Object.keys(byKey).filter(function(k) {
      var e = byKey[k];
      return e.scored >= 2 && e.lowDims >= 2;
    }).length;
    return { pupils: pupils, atRisk: atRisk, dramaTeachers: dramaTeachers, artTeachers: artTeachers };
  }

  function countReportPupils(reportData) {
    if (!reportData) return 0;
    if (Array.isArray(reportData.pupils)) return reportData.pupils.length;
    if (reportData.pupils && typeof reportData.pupils === 'object') return Object.keys(reportData.pupils).length;
    return 0;
  }

  function moderationSummary(mod) {
    mod = mod && typeof mod === 'object' ? mod : {};
    var subjects = Object.keys(mod).filter(function(k) { return mod[k] && typeof mod[k] === 'object'; });
    var units = 0;
    var withEvidence = 0;
    subjects.forEach(function(sk) {
      var sub = mod[sk];
      Object.keys(sub).forEach(function(uk) {
        var u = sub[uk];
        if (!u || typeof u !== 'object') return;
        units++;
        if (u.status && u.status !== 'none') withEvidence++;
      });
    });
    return { subjects: subjects.length, units: units, withEvidence: withEvidence };
  }

  var CHECKLIST_RULES = [
    { key: 'faculty-self-evaluation', match: /faculty\/department self-evaluation/i, qi: '1.1' },
    { key: 'improvement-plan', match: /improvement plan/i, qi: '1.1' },
    { key: 'meeting-minutes', match: /meeting minutes/i, qi: '1.3' },
    { key: 'cpd', match: /professional learning|CPD/i, qi: '1.4' },
    { key: 'learning-walks', match: /learning walks|observation/i, qi: '2.3' },
    { key: 'curriculum-maps', match: /curriculum maps|schemes of work/i, qi: '2.2' },
    { key: 'progression', match: /progression frameworks/i, qi: '2.2' },
    { key: 'lesson-observation', match: /lesson observation|moderation records/i, qi: '2.3' },
    { key: 'assessment-data', match: /assessment data/i, qi: '2.3' },
    { key: 'work-samples', match: /work samples/i, qi: '2.3' },
    { key: 'asn', match: /Additional Support|support plans/i, qi: '2.4' },
    { key: 'intervention', match: /Intervention records/i, qi: '2.4' },
    { key: 'attainment', match: /Attainment data/i, qi: '3.2' },
    { key: 'gap', match: /Gap analysis/i, qi: '3.2' },
    { key: 'sqa', match: /SQA|qualification results/i, qi: '3.2' },
    { key: 'broader', match: /Broader achievement/i, qi: '3.3' },
    { key: 'faculty-minutes', match: /Faculty meeting minutes/i, qi: '1.3' },
    { key: 'timetable', match: /Timetable|staffing allocation/i, qi: '1.4' },
    { key: 'strengths-summary', match: /key strengths and areas/i, qi: '1.1' }
  ];

  function loadSnapshot() {
    if (!window.DataService || !DataService.get) return Promise.resolve(null);
    var ds = DataService;
    var tasks = [
      ['dip', ds.get('dipSelfEvaluation')],
      ['dipTracker', (window.DipTrackerService && DipTrackerService.loadTracker)
        ? DipTrackerService.loadTracker().catch(function() { return null; })
        : Promise.resolve(null)],
      ['drama', ds.get('drama-v3')],
      ['art', ds.get('art-v2')],
      ['dramaReports', ds.get('bge_drama_reports_v1')],
      ['artReports', ds.get('bge_art_reports_v1')],
      ['moderation', ds.get('moderation-data')],
      ['schemes', ds.get('plannerSchemesOfWork')],
      ['clpl', ds.get('clplProgress')]
    ];
    if (ds.getAllForMonitoring) {
      tasks.push(['monitoring', ds.getAllForMonitoring()]);
    }
    return Promise.all(tasks.map(function(t) {
      return t[1].catch(function() { return null; }).then(function(v) { return [t[0], v]; });
    })).then(function(pairs) {
      var snap = {};
      pairs.forEach(function(p) { snap[p[0]] = p[1]; });
      return snap;
    });
  }

  window.HgiosHubBridge = {
    loadSnapshot: loadSnapshot,

    curriculumFetch: function() {
      var cu = window.CURRICULUM_TPS || window.CURRICULUM_UNITS;
      if (!cu) {
        return Promise.resolve({
          status: 'hint',
          detail: 'Open Faculty Hub for S1–S6 curriculum pages',
          summary: 'Drama, Art & Design and Photography curriculum live in the hub sidebar',
          panel: 'drama-map'
        });
      }
      var dramaU = countCurriculumUnits(cu, 'drama', ['s1', 's2', 's3']);
      var artU = countCurriculumUnits(cu, 'art', ['s1', 's2', 's3']);
      var photoParts = [];
      if (cu.photography) {
        if (cu.photography.npas3 && cu.photography.npas3.length) photoParts.push('NPA S3');
        if (cu.photography.npas4 && cu.photography.npas4.length) photoParts.push('NPA S4');
        if (cu.photography.higher && cu.photography.higher.length) photoParts.push('Higher');
      }
      return Promise.resolve({
        status: 'ok',
        detail: 'BGE: Drama ' + dramaU + ' units · Art ' + artU + ' units' + (photoParts.length ? ' · Photo: ' + photoParts.join(', ') : ''),
        summary: 'Senior phase: S4/S5/6 curriculum panels in hub + Senior Phase Tracker (Planning & assessment)',
        panel: 'ad-map'
      });
    },

    bgeTrackersFetch: function(snap) {
      snap = snap || {};
      var mon = snap.monitoring;
      if (mon && mon.length) {
        var a = analyzeMonitoringRows(mon);
        if (a.pupils) {
          return Promise.resolve({
            status: 'ok',
            detail: a.pupils + ' BGE pupil profiles · ' + a.atRisk + ' at medium/high risk (tracking rules)',
            summary: a.dramaTeachers + ' drama + ' + a.artTeachers + ' art tracker uploads in cloud',
            panel: 'embed-tracking-monitoring-hub'
          });
        }
      }
      var drama = analyzeTrackerPayload(snap.drama, 'drama');
      var art = analyzeTrackerPayload(snap.art, 'art');
      var total = drama.pupils + art.pupils;
      if (!total) {
        return Promise.resolve({ status: 'empty', detail: 'No BGE tracker data in cloud yet', panel: 'drama-tracker' });
      }
      return Promise.resolve({
        status: 'ok',
        detail: 'Drama: ' + drama.pupils + ' pupils (' + drama.withNotes + ' with learner conversation notes) · Art: ' + art.pupils + ' pupils',
        summary: 'Use Tracking & Monitoring hub for faculty-wide attainment view',
        panel: 'embed-tracking-monitoring-hub'
      });
    },

    trackingHubFetch: function(snap) {
      snap = snap || {};
      if (!snap.monitoring || !snap.monitoring.length) {
        return Promise.resolve({
          status: 'hint',
          detail: 'Faculty-wide tracking needs Faculty Head access to cloud data',
          panel: 'embed-tracking-monitoring-hub'
        });
      }
      var a = analyzeMonitoringRows(snap.monitoring);
      if (!a.pupils) {
        return Promise.resolve({ status: 'empty', detail: 'No pupil rows in monitoring hub', panel: 'embed-tracking-monitoring-hub' });
      }
      return Promise.resolve({
        status: 'ok',
        detail: a.pupils + ' pupils tracked · ' + a.atRisk + ' at-risk (2+ low dimensions)',
        summary: 'Art & Drama attainment, effort and learner profiles aggregated school-wide',
        panel: 'embed-tracking-monitoring-hub'
      });
    },

    reportBuildersFetch: function(snap) {
      snap = snap || {};
      var d = countReportPupils(snap.dramaReports);
      var a = countReportPupils(snap.artReports);
      if (!d && !a) {
        return Promise.resolve({ status: 'empty', detail: 'No BGE report builder pupils saved yet', panel: 'drama-report-builder' });
      }
      return Promise.resolve({
        status: 'ok',
        detail: 'BGE reports: Drama ' + d + ' · Art ' + a + ' pupil record' + ((d + a) !== 1 ? 's' : ''),
        summary: 'Narrative reports and CFE levels for inspection sampling',
        panel: 'drama-report-builder'
      });
    },

    plannerFetch: function(snap) {
      snap = snap || {};
      var schemes = snap.schemes;
      var count = 0;
      if (schemes && typeof schemes === 'object') {
        count = Array.isArray(schemes) ? schemes.length : Object.keys(schemes).length;
      }
      if (!count) {
        return Promise.resolve({ status: 'empty', detail: 'No schemes of work in Teacher Planner yet', panel: 'embed-teacher-planner' });
      }
      return Promise.resolve({
        status: 'ok',
        detail: count + ' scheme' + (count !== 1 ? 's' : '') + ' of work in planner',
        summary: 'Supports QI 2.2 curriculum rationale and 2.3 learning sequences',
        panel: 'embed-teacher-planner'
      });
    },

    seniorPhaseFetch: function() {
      return Promise.resolve({
        status: 'hint',
        detail: 'Senior Phase Tracker linked in Faculty Hub (Planning & assessment)',
        summary: 'Use for S4–S6 qualification evidence; connect tracker data to cloud in a future update',
        panel: 'embed-senior-phase-tracker'
      });
    },

    getChecklistSuggestions: function(snap, itemLabel, hubCache) {
      snap = snap || {};
      hubCache = hubCache || [];
      var label = String(itemLabel || '');
      var rule = CHECKLIST_RULES.find(function(r) { return r.match.test(label); });
      if (!rule) return { suggested: false, reason: '' };

      function hubOk(id) {
        var e = hubCache.find(function(x) { return x.source && x.source.id === id; });
        return e && e.result && e.result.status === 'ok';
      }

      var dip = snap.dip || {};
      var dipFilled = ['dip-eval-overall', 'dip-eval-achievements', 'dip-eval-next'].filter(function(k) {
        return dip[k] && String(dip[k]).trim();
      }).length;

      if (rule.key === 'faculty-self-evaluation' || rule.key === 'strengths-summary') {
        if (dipFilled >= 2) return { suggested: true, reason: 'DIP self-evaluation sections completed' };
      }
      if (rule.key === 'improvement-plan') {
        if (dipFilled) return { suggested: true, reason: 'DIP improvement plan in Faculty Hub' };
        var dt = snap.dipTracker || {};
        if (window.DipTrackerService && DipTrackerService.computeCompletion) {
          var dc = DipTrackerService.computeCompletion(dt);
          if (dc.percent >= 25) return { suggested: true, reason: 'DIP mission tracker ' + dc.percent + '% complete' };
        }
      }
      if (rule.key === 'cpd') {
        var clpl = snap.clpl || {};
        if (Object.keys(clpl).length) return { suggested: true, reason: 'CLPL progress recorded' };
      }
      if (rule.key === 'curriculum-maps' || rule.key === 'progression') {
        var cu = window.CURRICULUM_TPS || window.CURRICULUM_UNITS;
        if (cu && (cu.drama || cu.art)) return { suggested: true, reason: 'Curriculum units defined in hub' };
        if (snap.schemes && Object.keys(snap.schemes).length) return { suggested: true, reason: 'Planner schemes exist' };
      }
      if (rule.key === 'assessment-data' || rule.key === 'attainment' || rule.key === 'gap') {
        var mon = analyzeMonitoringRows(snap.monitoring || []);
        if (mon.pupils) return { suggested: true, reason: mon.pupils + ' pupils in tracking hub' };
        if (analyzeTrackerPayload(snap.drama).pupils || analyzeTrackerPayload(snap.art).pupils) {
          return { suggested: true, reason: 'BGE tracker data present' };
        }
      }
      if (rule.key === 'lesson-observation' || rule.key === 'learning-walks') {
        if (moderationSummary(snap.moderation).withEvidence) {
          return { suggested: true, reason: 'Moderation evidence recorded' };
        }
      }
      if (rule.key === 'work-samples') {
        var m = moderationSummary(snap.moderation);
        if (m.withEvidence) return { suggested: true, reason: m.withEvidence + ' moderation unit(s) with evidence' };
      }
      if (rule.key === 'asn' || rule.key === 'intervention') {
        var notes = analyzeTrackerPayload(snap.drama).withNotes + analyzeTrackerPayload(snap.art).withNotes;
        if (notes) return { suggested: true, reason: notes + ' learner profile(s) with conversation notes' };
      }
      if (rule.key === 'broader') {
        if (countReportPupils(snap.dramaReports) || countReportPupils(snap.artReports)) {
          return { suggested: true, reason: 'BGE report builder has pupil narratives' };
        }
      }
      if (rule.key === 'meeting-minutes' || rule.key === 'faculty-minutes') {
        if (hubOk('meetings')) return { suggested: true, reason: 'Department meetings published in hub' };
      }
      if (rule.key === 'learning-walks') {
        if (hubOk('class-visits') || hubOk('triangulation')) {
          return { suggested: true, reason: 'Class visits / triangulation observations' };
        }
      }
      if (rule.key === 'stakeholder' || label.indexOf('questionnaire') !== -1) {
        if (hubOk('triangulation')) return { suggested: true, reason: 'Triangulation survey data' };
      }

      return { suggested: false, reason: '' };
    },

    buildQiSuggestion: function(qiId, snap, hubEntries) {
      snap = snap || {};
      hubEntries = hubEntries || [];
      var lines = [];
      var fileRefs = [];
      var strengths = [];
      var evidence = [];

      function addHubLines() {
        hubEntries.filter(function(e) {
          return e.source.qis.indexOf(qiId) !== -1 && (e.result.status === 'ok' || e.result.status === 'hint');
        }).forEach(function(e) {
          lines.push(e.source.label + ': ' + (e.result.detail || ''));
          if (e.result.summary) lines.push('  ' + e.result.summary);
          fileRefs.push('Faculty Hub → ' + e.source.label);
        });
      }

      addHubLines();

      var dip = snap.dip || {};
      if (['1.1', '1.3', '2.2', '3.2'].indexOf(qiId) !== -1 && dip['dip-eval-achievements']) {
        strengths.push(hubTruncate(dip['dip-eval-achievements'], 400));
      }
      if (qiId === '1.1' && dip['dip-eval-overall']) {
        evidence.push('DIP self-evaluation: ' + hubTruncate(dip['dip-eval-overall'], 350));
      }

      if (qiId === '2.2') {
        var cu = window.CURRICULUM_TPS || window.CURRICULUM_UNITS;
        if (cu) {
          evidence.push('BGE curriculum documented via curriculum-units: Drama S1–S3 (' + countCurriculumUnits(cu, 'drama', ['s1', 's2', 's3']) + ' units), Art S1–S3 (' + countCurriculumUnits(cu, 'art', ['s1', 's2', 's3']) + ' units). Senior phase curriculum in hub S4/S5/6 panels and Senior Phase Tracker.');
        }
        if (snap.schemes && Object.keys(snap.schemes).length) {
          evidence.push('Teacher Planner: ' + Object.keys(snap.schemes).length + ' scheme(s) of work.');
        }
        fileRefs.push('Faculty Hub → Drama/Art curriculum maps', 'Faculty Hub → Teacher Planner');
      }

      if (qiId === '2.3' || qiId === '3.2') {
        var mon = analyzeMonitoringRows(snap.monitoring || []);
        if (mon.pupils) {
          evidence.push('Tracking hub: ' + mon.pupils + ' pupils; ' + mon.atRisk + ' at medium/high risk across tracked dimensions.');
        }
        var dr = analyzeTrackerPayload(snap.drama);
        var ar = analyzeTrackerPayload(snap.art);
        if (dr.pupils || ar.pupils) {
          evidence.push('BGE trackers: Drama ' + dr.pupils + ' pupils (' + dr.withNotes + ' with learner conversation notes); Art ' + ar.pupils + ' pupils.');
        }
        var repD = countReportPupils(snap.dramaReports);
        var repA = countReportPupils(snap.artReports);
        if (repD || repA) {
          evidence.push('BGE report builders: ' + repD + ' drama + ' + repA + ' art pupil reports.');
        }
        var mod = moderationSummary(snap.moderation);
        if (mod.withEvidence) {
          evidence.push('Moderation: ' + mod.withEvidence + ' unit(s) with evidence across ' + mod.subjects + ' subject area(s).');
        }
      }

      if (qiId === '2.4') {
        var notes = analyzeTrackerPayload(snap.drama).withNotes + analyzeTrackerPayload(snap.art).withNotes;
        if (notes) {
          evidence.push(notes + ' learner profile(s) include teacher notes for conversations / support.');
        }
        if (monRef.atRisk) {
          evidence.push(monRef.atRisk + ' pupils flagged at-risk in tracking hub for follow-up.');
        }
      }

      if (qiId === '3.1' && dip['dip-eval-next']) {
        evidence.push('Areas for development (DIP): ' + hubTruncate(dip['dip-eval-next'], 300));
      }

      var dipTracker = snap.dipTracker || {};
      if (['2.2', '2.3', '3.1', '3.2'].indexOf(qiId) !== -1 && dipTracker.sheets && window.DipTrackerService) {
        var dc = DipTrackerService.computeCompletion(dipTracker);
        if (dc.percent) {
          evidence.push('DIP mission tracker (25–26): ' + dc.percent + '% of collaborative mission fields complete across six sheets.');
        }
        ['gc2m1', 'gc2m2', 'gc3m1', 'gc3m2'].forEach(function(sid) {
          var sh = dipTracker.sheets[sid];
          if (!sh || !sh.commitments || !sh.commitments.length) return;
          var row = sh.commitments[0];
          var t4 = row.terms && row.terms.t4 ? row.terms.t4.progress : '';
          if (t4 && ['2.2', '2.3'].indexOf(qiId) !== -1 && (sid === 'gc2m1' || sid === 'gc2m2')) {
            evidence.push(sh.mission + ' — ' + hubTruncate(t4, 220));
          }
          if (t4 && ['3.1', '3.2'].indexOf(qiId) !== -1 && (sid === 'gc3m1' || sid === 'gc3m2')) {
            evidence.push(sh.mission + ' — ' + hubTruncate(t4, 220));
          }
        });
        fileRefs.push('Faculty Hub → DIP Mission Tracker');
      }

      var monRef = analyzeMonitoringRows(snap.monitoring || []);
      return {
        evidenceSummary: evidence.concat(lines).filter(Boolean).join('\n\n'),
        strengths: strengths.join('\n\n'),
        fileReferences: fileRefs.filter(function(v, i, a) { return a.indexOf(v) === i; }).join('; '),
        hubLines: lines
      };
    }
  };
})();
