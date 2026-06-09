/**
 * Year-end improvement plan synthesis — save/load and DIP tracker seeding.
 */
(function() {
  function useSupabase() {
    return window.supabase && window.supabase.auth && window.supabase.auth.getSession;
  }

  function getSession() {
    if (!window.supabase) return Promise.resolve(null);
    return window.supabase.auth.getSession().then(function(_a) {
      return _a && _a.data && _a.data.session || null;
    });
  }

  function emptyPlan(schoolYear) {
    var planFor = window.SynthesisEngine ? SynthesisEngine.nextSchoolYear(schoolYear) : schoolYear;
    return {
      school_year: schoolYear,
      plan_for_year: planFor,
      evidence_snapshot: {},
      suggested_priorities: [],
      accepted_priorities: [],
      strengths: [],
      manual_notes: '',
      next_year_plan: { narrative: '', priorities: [] },
      dip_seed_applied: false
    };
  }

  function makeCommitmentRow(priority, schoolYear) {
    var actions = priority.actions || [];
    var firstAction = actions[0] || priority.text || '';
    return {
      id: 'synth-' + (priority.id || Date.now()),
      commitment: priority.title || priority.themeLabel || 'Improvement priority',
      subject: 'Both',
      lead: 'Faculty Head',
      successMeasure: 'Measurable improvement against ' + (schoolYear || 'evaluated year') + ' evidence',
      dataArea: priority.text || priority.rationale || '',
      research: 'Drawn from year-end triangulation of evidence, DIP evaluation and faculty self-evaluation (' + schoolYear + ').',
      resources: 'Faculty meeting time; Pedagogy Pod; DIP Mission Tracker monitoring',
      qiQuestions: 'HGIOS4 QI 2.3 / 3.1 — How will this priority improve learning, teaching and assessment?',
      terms: {
        t1: { measure: firstAction, progress: '' },
        t2: { measure: '', progress: '' },
        t3: { measure: '', progress: '' },
        t4: { measure: '', progress: '' }
      },
      _synthesisSource: priority.id
    };
  }

  window.ImprovementPlanSynthesisService = {
    load: function(schoolYear) {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { resolve(null); return; }
        getSession().then(function(session) {
          if (!session) { reject(new Error('Not authenticated')); return; }
          window.supabase.from('improvement_plan_synthesis')
            .select('*')
            .eq('school_year', schoolYear)
            .maybeSingle()
            .then(function(r) {
              if (r.error) { reject(r.error); return; }
              resolve(r.data || null);
            });
        }).catch(reject);
      });
    },

    save: function(payload) {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { reject(new Error('Supabase required')); return; }
        getSession().then(function(session) {
          if (!session) { reject(new Error('Not authenticated')); return; }
          var row = {
            school_year: payload.school_year,
            plan_for_year: payload.plan_for_year || (window.SynthesisEngine && SynthesisEngine.nextSchoolYear(payload.school_year)),
            evidence_snapshot: payload.evidence_snapshot || {},
            suggested_priorities: payload.suggested_priorities || [],
            accepted_priorities: payload.accepted_priorities || [],
            strengths: payload.strengths || [],
            manual_notes: payload.manual_notes || '',
            next_year_plan: payload.next_year_plan || {},
            dip_seed_applied: !!payload.dip_seed_applied,
            updated_by: session.user.id
          };
          window.supabase.from('improvement_plan_synthesis')
            .upsert(row, { onConflict: 'school_year' })
            .select()
            .maybeSingle()
            .then(function(r) {
              if (r.error) { reject(r.error); return; }
              resolve(r.data);
            });
        }).catch(reject);
      });
    },

    applyToDipTracker: function(schoolYear, acceptedPriorities) {
      if (!window.DipTrackerService || !window.SynthesisEngine) {
        return Promise.reject(new Error('DIP tracker service not loaded'));
      }
      var planForYear = SynthesisEngine.nextSchoolYear(schoolYear);
      acceptedPriorities = acceptedPriorities || [];
      if (!acceptedPriorities.length) {
        return Promise.reject(new Error('No accepted priorities to apply'));
      }
      return DipTrackerService.loadTracker(planForYear).then(function(tracker) {
        tracker = tracker || { version: 1, schoolYear: planForYear, sheets: {}, lastUpdated: null };
        if (!tracker.sheets) tracker.sheets = {};
        tracker.schoolYear = planForYear;
        var seededIds = [];
        acceptedPriorities.forEach(function(p) {
          var sheetId = SynthesisEngine.sheetForTheme(p.theme);
          if (!tracker.sheets[sheetId]) {
            tracker.sheets[sheetId] = { challenge: '', mission: '', commitments: [] };
          }
          if (!tracker.sheets[sheetId].commitments) tracker.sheets[sheetId].commitments = [];
          var exists = tracker.sheets[sheetId].commitments.some(function(c) {
            return c._synthesisSource === p.id || c.id === 'synth-' + p.id;
          });
          if (exists) return;
          var row = makeCommitmentRow(p, schoolYear);
          tracker.sheets[sheetId].commitments.push(row);
          seededIds.push(row.id);
        });
        tracker.lastUpdated = new Date().toISOString();
        return DipTrackerService.saveTracker(tracker, planForYear).then(function() {
          return { planForYear: planForYear, seededIds: seededIds };
        });
      });
    }
  };
})();
