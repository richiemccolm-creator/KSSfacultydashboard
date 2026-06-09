/**
 * Year-end synthesis: gather evidence and build suggested priorities.
 */
(function() {
  var CORE_THEMES = ['learningIntentions','successCriteria','activeLearning','support','feedback','challenge','digitalLearning'];

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

  var OBS_ELEMENT_THEMES = {
    2: 'support',
    3: 'learningIntentions',
    4: 'successCriteria',
    5: 'challenge',
    6: 'digitalLearning',
    7: 'feedback'
  };

  var OBS_ELEMENT_LABELS = ['Planning','Welcome & Ethos','Learning Intention','Success Criteria','Differentiation','Digital Learning','Assessment'];

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
    CORE_THEMES.forEach(function(k) { likert[k] = {}; });
    (surveys || []).forEach(function(s) {
      var d = s.data || {};
      CORE_THEMES.forEach(function(k) {
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
    CORE_THEMES.forEach(function(k) {
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

  function ensureBucket(buckets, theme) {
    if (!buckets[theme]) {
      buckets[theme] = {
        theme: theme,
        themeLabel: THEME_LABELS[theme] || theme,
        sources: [],
        snippets: [],
        actions: []
      };
    }
    return buckets[theme];
  }

  function addSource(bucket, source) {
    if (bucket.sources.indexOf(source) < 0) bucket.sources.push(source);
  }

  function buildThemeBuckets(ctx) {
    var buckets = {};

    (ctx.surveyAnalysis && ctx.surveyAnalysis.dev || []).forEach(function(d) {
      var b = ensureBucket(buckets, d.theme);
      addSource(b, 'survey');
      b.snippets.push('Pupil survey: ' + d.negativePct + '% disagreed (' + d.total + ' responses)');
      b.actions.push('Review ' + d.themeLabel.toLowerCase() + ' in unit planning');
    });

    (ctx.focusGroups || []).forEach(function(fg) {
      var d = fg.data || {};
      var label = (d.subject ? d.subject + ' ' : '') + (d.yearGroup || 'Focus group');
      Object.keys(d.themes || {}).forEach(function(key) {
        if (!d.themes[key] || CORE_THEMES.indexOf(key) < 0) return;
        var b = ensureBucket(buckets, key);
        addSource(b, 'focus_group');
        b.snippets.push(label + ': ' + truncate(d.themes[key], 140));
      });
      if (d.improve) {
        CORE_THEMES.forEach(function(key) {
          var labelWord = (THEME_LABELS[key] || '').toLowerCase();
          if (labelWord && d.improve.toLowerCase().indexOf(labelWord.split(' ')[0]) >= 0) {
            var b = ensureBucket(buckets, key);
            addSource(b, 'focus_group');
            b.snippets.push(label + ' (improve): ' + truncate(d.improve, 120));
          }
        });
      }
    });

    (ctx.observations || []).forEach(function(obs) {
      var d = obs.data || {};
      var ratings = d.ratings || {};
      var feedback = d.feedback || {};
      var visitLabel = (d.teacher || 'Teacher') + (d.class ? ' (' + d.class + ')' : '');

      Object.keys(OBS_ELEMENT_THEMES).forEach(function(n) {
        var theme = OBS_ELEMENT_THEMES[n];
        var f = feedback[n] || feedback[String(n)] || {};
        var orating = ratings['o-' + n] || ratings['o-' + String(n)];
        var ofb = (f.observer || '').trim();
        if (orating === 'Improve' || (ofb && orating === 'Developing')) {
          var b = ensureBucket(buckets, theme);
          addSource(b, 'observation');
          var elLabel = OBS_ELEMENT_LABELS[parseInt(n, 10) - 1] || 'Element ' + n;
          b.snippets.push(visitLabel + ' — ' + elLabel + (orating ? ' [' + orating + ']' : '') + ': ' + truncate(ofb, 100));
        }
      });

      if (d.nextsteps) {
        var nb = ensureBucket(buckets, 'feedback');
        addSource(nb, 'observation');
        nb.snippets.push(visitLabel + ' — next steps: ' + truncate(d.nextsteps, 120));
        nb.actions.push(truncate(d.nextsteps, 100));
      }
    });

    return buckets;
  }

  function bucketToSuggestion(bucket, triangulated) {
    var sourceLabels = {
      survey: 'Survey',
      focus_group: 'Focus group',
      observation: 'Observation',
      dip_tracker: 'DIP tracker',
      dip_eval: 'DIP evaluation'
    };
    var src = bucket.sources.map(function(s) { return sourceLabels[s] || s; });
    var intro = triangulated
      ? 'Triangulated across ' + bucket.sources.length + ' sources (' + src.join(', ') + '): '
      : '';
    return {
      id: uid(),
      theme: bucket.theme,
      themeLabel: bucket.themeLabel,
      sources: bucket.sources.slice(),
      triangulated: !!triangulated,
      status: 'pending',
      text: intro + bucket.themeLabel + ' — ' + bucket.snippets.join(' · '),
      actions: bucket.actions.length ? bucket.actions.slice(0, 3) : ['Address ' + bucket.themeLabel.toLowerCase() + ' in faculty improvement plan']
    };
  }

  function dipTrackerGaps(tracker) {
    var gaps = [];
    if (!tracker || !tracker.sheets || !window.DipTrackerService) return gaps;
    var completion = DipTrackerService.computeCompletion(tracker);
    ['gc2m1', 'gc2m2', 'gc3m1', 'gc3m2'].forEach(function(sid) {
      var sheet = tracker.sheets[sid];
      if (!sheet || !sheet.commitments) return;
      sheet.commitments.forEach(function(row) {
        if (row._synthesisSource) return;
        var t4 = row.terms && row.terms.t4 ? row.terms.t4.progress : '';
        if (t4 && /carried into|priority for 20\d\d|not yet progressed|outstanding action/i.test(t4)) {
          gaps.push({
            sheet: sid,
            mission: sheet.mission || sid,
            commitment: row.commitment || '',
            note: truncate(t4, 200)
          });
        }
      });
    });
    if (completion.percent > 0 && completion.percent < 40) {
      gaps.unshift({
        sheet: 'all',
        mission: 'DIP Mission Tracker',
        commitment: 'Overall tracker completion',
        note: completion.percent + '% of collaborative fields complete'
      });
    }
    return gaps.slice(0, 5);
  }

  function buildSuggestions(ctx) {
    var suggestions = [];
    var buckets = buildThemeBuckets(ctx);

    CORE_THEMES.forEach(function(theme) {
      var bucket = buckets[theme];
      if (!bucket || bucket.sources.length < 2) return;
      suggestions.push(bucketToSuggestion(bucket, true));
    });

    CORE_THEMES.forEach(function(theme) {
      var bucket = buckets[theme];
      if (!bucket || bucket.sources.length !== 1) return;
      suggestions.push(bucketToSuggestion(bucket, false));
    });

    (ctx.focusGroups || []).forEach(function(fg) {
      var d = fg.data || {};
      if (!d.improve) return;
      var already = suggestions.some(function(s) {
        return s.sources.indexOf('focus_group') >= 0 && s.text.indexOf(truncate(d.improve, 40)) >= 0;
      });
      if (already) return;
      suggestions.push({
        id: uid(),
        theme: 'focus_group',
        themeLabel: THEME_LABELS.focus_group,
        sources: ['focus_group'],
        triangulated: false,
        status: 'pending',
        text: (d.subject ? d.subject + ' ' : '') + (d.yearGroup || '') + ' focus group: ' + truncate(d.improve, 160),
        actions: [truncate(d.improve, 120)]
      });
    });

    (ctx.dipGaps || []).forEach(function(g) {
      suggestions.push({
        id: uid(),
        theme: 'dip_mission',
        themeLabel: THEME_LABELS.dip_mission,
        sources: ['dip_tracker'],
        triangulated: false,
        status: 'pending',
        text: g.mission + ': ' + truncate(g.commitment, 100) + ' — ' + g.note,
        actions: ['Review in DIP Mission Tracker']
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
          triangulated: false,
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
          triangulated: false,
          status: 'pending',
          text: 'DIP overall progress: ' + truncate(dipEval['dip-eval-overall'], 200),
          actions: ['Address challenges noted in DIP self-evaluation']
        });
      }
    }

    suggestions.sort(function(a, b) {
      if (a.triangulated && !b.triangulated) return -1;
      if (!a.triangulated && b.triangulated) return 1;
      return (b.sources || []).length - (a.sources || []).length;
    });

    return suggestions.slice(0, 24);
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

  function buildSourceDetails(ctx) {
    ctx = ctx || {};
    var surveys = ctx.surveys || [];
    var respCount = 0;
    surveys.forEach(function(s) {
      var d = s.data || {};
      respCount += ((d.overallRating || d.overall || []).length);
    });
    return {
      surveys: {
        uploads: surveys.length,
        responses: respCount,
        strengths: (ctx.surveyAnalysis && ctx.surveyAnalysis.strengths) || [],
        development: (ctx.surveyAnalysis && ctx.surveyAnalysis.dev) || []
      },
      focusGroups: (ctx.focusGroups || []).map(function(fg) {
        var d = fg.data || {};
        var themes = [];
        Object.keys(d.themes || {}).forEach(function(k) {
          if (d.themes[k] && THEME_LABELS[k]) themes.push({ theme: k, label: THEME_LABELS[k], note: truncate(d.themes[k], 200) });
        });
        return {
          label: (d.subject ? d.subject + ' ' : '') + (d.yearGroup || 'Focus group'),
          improve: truncate(d.improve, 220),
          enjoy: truncate(d.enjoyMost, 160),
          themes: themes
        };
      }),
      observations: (ctx.observations || []).map(function(obs) {
        var d = obs.data || {};
        var improveNotes = [];
        var ratings = d.ratings || {};
        var feedback = d.feedback || {};
        Object.keys(OBS_ELEMENT_THEMES).forEach(function(n) {
          var theme = OBS_ELEMENT_THEMES[n];
          var f = feedback[n] || feedback[String(n)] || {};
          var orating = ratings['o-' + n] || ratings['o-' + String(n)];
          var ofb = (f.observer || '').trim();
          if (orating === 'Improve' || (ofb && orating === 'Developing')) {
            improveNotes.push({
              element: OBS_ELEMENT_LABELS[parseInt(n, 10) - 1] || 'Element ' + n,
              theme: THEME_LABELS[theme] || theme,
              rating: orating || '',
              note: truncate(ofb, 160)
            });
          }
        });
        return {
          teacher: d.teacher || 'Teacher',
          class: d.class || '',
          date: d.date || d.visitDate || '',
          nextSteps: truncate(d.nextsteps, 200),
          improveNotes: improveNotes
        };
      }),
      dipTracker: {
        percent: ctx.trackerCompletion ? ctx.trackerCompletion.percent : 0,
        filled: ctx.trackerCompletion ? ctx.trackerCompletion.filled : 0,
        total: ctx.trackerCompletion ? ctx.trackerCompletion.total : 0,
        gaps: (ctx.dipGaps || []).map(function(g) {
          return {
            mission: g.mission || '',
            commitment: truncate(g.commitment, 120),
            note: truncate(g.note, 200)
          };
        })
      },
      themeSummary: Object.keys(ctx.themeBuckets || buildThemeBuckets(ctx)).map(function(k) {
        var b = (ctx.themeBuckets || buildThemeBuckets(ctx))[k];
        return {
          theme: b.theme,
          themeLabel: b.themeLabel,
          sources: b.sources.slice(),
          snippetCount: b.snippets.length
        };
      }).filter(function(t) { return t.snippetCount > 0; })
        .sort(function(a, b) { return b.sources.length - a.sources.length; })
    };
  }

  function mergeRegeneratedPlan(existingPlan, evidence) {
    existingPlan = existingPlan || {};
    var kept = (existingPlan.suggested_priorities || []).filter(function(s) {
      return s.status === 'accepted' || s.status === 'dismissed' || (s.status === 'pending' && s.edited);
    });
    var dismissedThemes = {};
    kept.forEach(function(s) {
      if (s.status === 'dismissed') dismissedThemes[s.theme] = true;
    });
    var acceptedThemes = {};
    kept.forEach(function(s) {
      if (s.status === 'accepted') acceptedThemes[s.theme] = true;
    });
    var newPending = (evidence.suggestedPriorities || []).filter(function(n) {
      if (n.status !== 'pending') return false;
      if (dismissedThemes[n.theme]) return false;
      if (acceptedThemes[n.theme] && n.triangulated) return false;
      return !kept.some(function(k) {
        return k.theme === n.theme && k.triangulated && n.triangulated;
      });
    });
    return {
      school_year: existingPlan.school_year || evidence.schoolYear,
      plan_for_year: evidence.planForYear || existingPlan.plan_for_year,
      evidence_snapshot: evidence,
      suggested_priorities: kept.concat(newPending),
      strengths: evidence.strengths || existingPlan.strengths || [],
      manual_notes: existingPlan.manual_notes || '',
      accepted_priorities: existingPlan.accepted_priorities || [],
      next_year_plan: existingPlan.next_year_plan || { narrative: '', priorities: [] },
      dip_seed_applied: !!existingPlan.dip_seed_applied
    };
  }

  window.SynthesisEngine = {
    THEME_LABELS: THEME_LABELS,
    THEME_SHEET_MAP: THEME_SHEET_MAP,
    nextSchoolYear: nextSchoolYear,
    truncate: truncate,
    mergeRegeneratedPlan: mergeRegeneratedPlan,

    gatherEvidence: function(schoolYear, deps) {
      deps = deps || {};
      var TriangulationService = deps.TriangulationService || window.TriangulationService;
      var DipTrackerService = deps.DipTrackerService || window.DipTrackerService;
      var DataService = deps.DataService || window.DataService;
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
        var themeBuckets = buildThemeBuckets(ctx);
        ctx.themeBuckets = themeBuckets;
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
          themeBuckets: themeBuckets,
          sourceDetails: buildSourceDetails(ctx),
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
