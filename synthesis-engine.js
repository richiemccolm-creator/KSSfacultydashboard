/**
 * Year-end synthesis: gather evidence and build suggested priorities.
 */
(function() {
  var THEME_LABELS = {
    learningIntentions: 'Learning Intentions',
    successCriteria: 'Success Criteria',
    activeLearning: 'Active Learning',
    support: 'Support & Ethos',
    feedback: 'Feedback',
    challenge: 'Challenge',
    digitalLearning: 'Digital Learning',
    dip_mission: 'DIP Mission Delivery',
    dip_eval: 'DIP Self-Evaluation',
    observation: 'Learning Observations',
    focus_group: 'Focus Groups',
    general: 'Faculty Improvement'
  };

  var THEME_SHEET_MAP = {
    learningIntentions: 'gc2m1',
    successCriteria: 'gc2m1',
    activeLearning: 'gc2m1',
    feedback: 'gc2m1',
    digitalLearning: 'gc2m1',
    challenge: 'gc2m2',
    support: 'gc1m2',
    dip_mission: 'gc2m1',
    dip_eval: 'gc3m1',
    observation: 'gc2m1',
    focus_group: 'gc2m1',
    general: 'gc2m1'
  };

  function nextSchoolYear(sy) {
    var parts = String(sy || '').split('-');
    if (parts.length < 2) return sy;
    var start = parseInt(parts[0], 10);
    if (isNaN(start)) return sy;
    return (start + 1) + '-' + String(start + 2).slice(-2);
  }

  function truncate(s, n) {
    s = String(s || '').trim();
    if (!s) return '';
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  function uid() {
    return 'sug_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function getDipEvalEntry(dip, schoolYear) {
    if (!dip || typeof dip !== 'object') return null;
    var entries = Array.isArray(dip.entries) ? dip.entries.slice() : [];
    if (dip.current && typeof dip.current === 'object') {
      var hasCurrent = Object.keys(dip.current).some(function(k) { return dip.current[k]; });
      if (hasCurrent) entries.push(dip.current);
    }
    if (!entries.length && dip['dip-eval-overall']) return dip;
    var matched = entries.filter(function(e) {
      return String(e['dip-eval-period'] || '').indexOf(schoolYear) >= 0
        || String(e['dip-eval-date'] || '').indexOf(String(schoolYear).slice(0, 4)) >= 0;
    });
    return matched.length ? matched[matched.length - 1] : (entries.length ? entries[entries.length - 1] : null);
  }

  function mergeSurveyLikert(surveys) {
    var likert = {};
    var themeKeys = ['learningIntentions','successCriteria','activeLearning','support','feedback','challenge','digitalLearning'];
    themeKeys.forEach(function(k) { likert[k] = {}; });
    (surveys || []).forEach(function(s) {
      var d = s.data || {};
      themeKeys.forEach(function(k) {
        Object.keys((d.likert && d.likert[k]) || {}).forEach(function(v) {
          likert[k][v] = (likert[k][v] || 0) + (d.likert[k][v] || 0);
        });
      });
    });
    return likert;
  }

  function computeStrengthAndDev(likert) {
    var positiveKeys = ['Strongly agree', 'Agree', 'Yes'];
    var negativeKeys = ['Disagree', 'Strongly disagree', 'No'];
    var strengths = [], dev = [];
    Object.keys(THEME_LABELS).forEach(function(k) {
      if (k === 'dip_mission' || k === 'dip_eval' || k === 'observation' || k === 'focus_group' || k === 'general') return;
      var dist = likert[k] || {};
      var total = Object.values(dist).reduce(function(a, b) { return a + b; }, 0);
      if (total < 5) return;
      var positive = positiveKeys.reduce(function(s, key) { return s + (dist[key] || 0); }, 0);
      var negative = negativeKeys.reduce(function(s, key) { return s + (dist[key] || 0); }, 0);
      var positivePct = Math.round(positive / total * 100);
      var negativePct = Math.round(negative / total * 100);
      if (positivePct >= 80 && negativePct < 10) {
        strengths.push({ theme: k, themeLabel: THEME_LABELS[k], positivePct: positivePct, total: total });
      } else if (negativePct >= 15 || positivePct < 60) {
        dev.push({ theme: k, themeLabel: THEME_LABELS[k], positivePct: positivePct, negativePct: negativePct, total: total });
      }
    });
    return { strengths: strengths, dev: dev };
  }

  function dipTrackerGaps(tracker) {
    var gaps = [];
    if (!tracker || !tracker.sheets || !window.DipTrackerService) return gaps;
    var completion = DipTrackerService.computeCompletion(tracker);
    ['gc2m1', 'gc2m2', 'gc3m1', 'gc3m2'].forEach(function(sid) {
      var sheet = tracker.sheets[sid];
      if (!sheet || !sheet.commitments) return;
      sheet.commitments.forEach(function(row) {
        var t4 = row.terms && row.terms.t4 ? row.terms.t4.progress : '';
        var dataArea = row.dataArea || '';
        if (t4 && /not yet|lag|limited|honest reflection|carried into|priority for/i.test(t4)) {
          gaps.push({
            sheet: sid,
            mission: sheet.mission || sid,
            commitment: row.commitment || '',
            note: truncate(t4, 200)
          });
        } else if (dataArea && !t4) {
          gaps.push({
            sheet: sid,
            mission: sheet.mission || sid,
            commitment: row.commitment || '',
            note: 'Term 4 progress not yet recorded'
          });
        }
      });
    });
    if (completion.percent > 0 && completion.percent < 50) {
      gaps.unshift({
        sheet: 'all',
        mission: 'DIP Mission Tracker',
        commitment: 'Overall tracker completion',
        note: completion.percent + '% of collaborative fields complete — several missions need attention'
      });
    }
    return gaps.slice(0, 6);
  }

  function buildSuggestions(ctx) {
    var suggestions = [];
    var survey = ctx.surveyAnalysis || {};
    (survey.dev || []).forEach(function(d) {
      suggestions.push({
        id: uid(),
        theme: d.theme,
        themeLabel: d.themeLabel,
        sources: ['survey'],
        status: 'pending',
        text: d.themeLabel + ': ' + d.negativePct + '% of pupils disagreed in surveys (' + d.total + ' responses). Review teaching practice and gather staff reflection.',
        actions: ['Review ' + d.themeLabel.toLowerCase() + ' in unit planning', 'Plan focused CPD or pedagogy pod']
      });
    });
    (ctx.focusGroups || []).forEach(function(fg) {
      var d = fg.data || {};
      if (!d.improve) return;
      suggestions.push({
        id: uid(),
        theme: 'focus_group',
        themeLabel: THEME_LABELS.focus_group,
        sources: ['focus_group'],
        status: 'pending',
        text: (d.subject ? d.subject + ' ' : '') + (d.yearGroup || '') + ' focus group: ' + truncate(d.improve, 160),
        actions: [truncate(d.improve, 120)]
      });
    });
    (ctx.observations || []).forEach(function(obs) {
      var d = obs.data || {};
      if (d.nextsteps) {
        suggestions.push({
          id: uid(),
          theme: 'observation',
          themeLabel: THEME_LABELS.observation,
          sources: ['observation'],
          status: 'pending',
          text: (d.teacher || 'Teacher') + (d.class ? ' (' + d.class + ')' : '') + ' — agreed next steps: ' + truncate(d.nextsteps, 140),
          actions: [truncate(d.nextsteps, 120)]
        });
      }
    });
    (ctx.dipGaps || []).forEach(function(g) {
      suggestions.push({
        id: uid(),
        theme: 'dip_mission',
        themeLabel: THEME_LABELS.dip_mission,
        sources: ['dip_tracker'],
        status: 'pending',
        text: g.mission + ': ' + truncate(g.commitment, 100) + ' — ' + g.note,
        actions: ['Review ' + truncate(g.commitment, 80) + ' in DIP Mission Tracker']
      });
    });
    var dipEval = ctx.dipEval;
    if (dipEval) {
      if (dipEval['dip-eval-next']) {
        suggestions.push({
          id: uid(),
          theme: 'dip_eval',
          themeLabel: THEME_LABELS.dip_eval,
          sources: ['dip_eval'],
          status: 'pending',
          text: 'DIP self-evaluation next steps: ' + truncate(dipEval['dip-eval-next'], 200),
          actions: [truncate(dipEval['dip-eval-next'], 150)]
        });
      }
      if (dipEval['dip-eval-overall'] && /challenge|improve|develop|priority|remain/i.test(dipEval['dip-eval-overall'])) {
        suggestions.push({
          id: uid(),
          theme: 'dip_eval',
          themeLabel: THEME_LABELS.dip_eval,
          sources: ['dip_eval'],
          status: 'pending',
          text: 'DIP overall progress: ' + truncate(dipEval['dip-eval-overall'], 200),
          actions: ['Address challenges noted in DIP self-evaluation']
        });
      }
    }
    return suggestions.slice(0, 20);
  }

  function buildStrengthsList(ctx) {
    var list = [];
    (ctx.surveyAnalysis && ctx.surveyAnalysis.strengths || []).forEach(function(s) {
      list.push({
        id: uid(),
        theme: s.theme,
        text: s.themeLabel + ': ' + s.positivePct + '% positive in pupil surveys',
        sources: ['survey']
      });
    });
    var dipEval = ctx.dipEval;
    if (dipEval && dipEval['dip-eval-achievements']) {
      list.push({
        id: uid(),
        theme: 'dip_eval',
        text: truncate(dipEval['dip-eval-achievements'], 300),
        sources: ['dip_eval']
      });
    }
    (ctx.focusGroups || []).forEach(function(fg) {
      var d = fg.data || {};
      if (d.enjoyMost) {
        list.push({
          id: uid(),
          theme: 'focus_group',
          text: (d.subject || 'Focus group') + ': ' + truncate(d.enjoyMost, 120),
          sources: ['focus_group']
        });
      }
    });
    return list.slice(0, 12);
  }

  window.SynthesisEngine = {
    THEME_LABELS: THEME_LABELS,
    THEME_SHEET_MAP: THEME_SHEET_MAP,
    nextSchoolYear: nextSchoolYear,
    truncate: truncate,

    gatherEvidence: function(schoolYear, deps) {
      deps = deps || {};
      var TriangulationService = deps.TriangulationService || window.TriangulationService;
      var DipTrackerService = deps.DipTrackerService || window.DipTrackerService;
      var DataService = deps.DataService || window.DataService;
      var mergeSurveyData = deps.mergeSurveyData;
      var pTri = TriangulationService ? TriangulationService.getEvidence(schoolYear) : Promise.resolve([]);
      var pTracker = DipTrackerService ? DipTrackerService.loadTracker(schoolYear).catch(function() { return null; }) : Promise.resolve(null);
      var pDip = DataService ? DataService.get('dipSelfEvaluation').catch(function() { return null; }) : Promise.resolve(null);
      return Promise.all([pTri, pTracker, pDip]).then(function(results) {
        var rows = results[0] || [];
        var tracker = results[1];
        var dipRaw = results[2];
        var surveys = rows.filter(function(r) { return r.evidence_type === 'survey'; });
        var focusGroups = rows.filter(function(r) { return r.evidence_type === 'focus_group'; });
        var observations = rows.filter(function(r) { return r.evidence_type === 'observation'; });
        var likert = mergeSurveyLikert(surveys);
        var surveyAnalysis = computeStrengthAndDev(likert);
        var respCount = 0;
        surveys.forEach(function(s) {
          var d = s.data || {};
          respCount += ((d.overallRating || d.overall || []).length);
        });
        var trackerCompletion = DipTrackerService && tracker
          ? DipTrackerService.computeCompletion(tracker)
          : { percent: 0, filled: 0, total: 0 };
        var dipEval = getDipEvalEntry(dipRaw, schoolYear);
        var dipGaps = dipTrackerGaps(tracker);
        var ctx = {
          schoolYear: schoolYear,
          planForYear: nextSchoolYear(schoolYear),
          surveys: surveys,
          focusGroups: focusGroups,
          observations: observations,
          surveyAnalysis: surveyAnalysis,
          tracker: tracker,
          trackerCompletion: trackerCompletion,
          dipEval: dipEval,
          dipGaps: dipGaps
        };
        return {
          schoolYear: schoolYear,
          planForYear: nextSchoolYear(schoolYear),
          summary: {
            surveyCount: surveys.length,
            surveyResponses: respCount,
            focusGroupCount: focusGroups.length,
            observationCount: observations.length,
            dipTrackerPercent: trackerCompletion.percent,
            dipEvalComplete: !!(dipEval && (dipEval['dip-eval-overall'] || dipEval['dip-eval-next']))
          },
          surveyAnalysis: surveyAnalysis,
          dipGaps: dipGaps,
          dipEval: dipEval ? {
            period: dipEval['dip-eval-period'] || '',
            date: dipEval['dip-eval-date'] || '',
            overall: dipEval['dip-eval-overall'] || '',
            achievements: dipEval['dip-eval-achievements'] || '',
            next: dipEval['dip-eval-next'] || ''
          } : null,
          suggestedPriorities: buildSuggestions(ctx),
          strengths: buildStrengthsList(ctx),
          generatedAt: new Date().toISOString()
        };
      });
    },

    sheetForTheme: function(theme) {
      return THEME_SHEET_MAP[theme] || 'gc2m1';
    }
  };
})();
