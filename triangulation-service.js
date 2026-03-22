/**
 * Triangulation of Evidence service: CRUD for survey, focus_group, observation data.
 * Admin-only. Uses Supabase triangulation_evidence table.
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

  window.TriangulationService = {
    getEvidence: function(schoolYear, evidenceType) {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { resolve([]); return; }
        getSession().then(function(session) {
          if (!session) { reject(new Error('Not authenticated')); return; }
          var q = window.supabase.from('triangulation_evidence')
            .select('id, school_year, evidence_type, uploaded_by, data, metadata, created_at')
            .eq('school_year', schoolYear || '');
          if (evidenceType) q = q.eq('evidence_type', evidenceType);
          q.order('created_at', { ascending: false })
            .then(function(r) {
              if (r.error) { reject(r.error); return; }
              resolve(r.data || []);
            });
        }).catch(reject);
      });
    },

    saveEvidence: function(payload) {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { reject(new Error('Supabase required')); return; }
        getSession().then(function(session) {
          if (!session) { reject(new Error('Not authenticated')); return; }
          var row = {
            school_year: payload.school_year || getCurrentSchoolYear(),
            evidence_type: payload.evidence_type,
            uploaded_by: session.user.id,
            data: payload.data || {},
            metadata: payload.metadata || {}
          };
          var q = payload.id
            ? window.supabase.from('triangulation_evidence').update(row).eq('id', payload.id)
            : window.supabase.from('triangulation_evidence').insert(row);
          q.select().then(function(r) {
            if (r.error) { reject(r.error); return; }
            resolve(r.data && r.data[0] ? r.data[0] : row);
          });
        }).catch(reject);
      });
    },

    deleteEvidence: function(id) {
      return new Promise(function(resolve, reject) {
        if (!useSupabase()) { reject(new Error('Supabase required')); return; }
        getSession().then(function(session) {
          if (!session) { reject(new Error('Not authenticated')); return; }
          window.supabase.from('triangulation_evidence')
            .delete()
            .eq('id', id)
            .then(function(r) {
              if (r.error) reject(r.error);
              else resolve();
            });
        }).catch(reject);
      });
    },

    getSynthesis: function(schoolYear) {
      var self = this;
      return self.getEvidence(schoolYear).then(function(rows) {
        var survey = rows.filter(function(r) { return r.evidence_type === 'survey'; });
        var focusGroup = rows.filter(function(r) { return r.evidence_type === 'focus_group'; });
        var observation = rows.filter(function(r) { return r.evidence_type === 'observation'; });
        return {
          school_year: schoolYear,
          survey: survey,
          focus_group: focusGroup,
          observation: observation,
          hasData: survey.length > 0 || focusGroup.length > 0 || observation.length > 0
        };
      });
    }
  };

  function getCurrentSchoolYear() {
    var d = new Date();
    var year = d.getFullYear();
    var month = d.getMonth();
    if (month >= 7) return year + '-' + String(year + 1).slice(-2);
    return (year - 1) + '-' + String(year).slice(-2);
  }

  window.getCurrentSchoolYear = getCurrentSchoolYear;
})();
