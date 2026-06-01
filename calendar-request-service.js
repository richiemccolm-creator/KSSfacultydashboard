/**
 * Calendar event requests: staff submit for faculty-head approval → shared calendar.
 */
(function() {
  function getSession() {
    if (!window.supabase || !window.supabase.auth) return Promise.resolve(null);
    return window.supabase.auth.getSession().then(function(_a) {
      return _a && _a.data && _a.data.session || null;
    });
  }

  function requireSession() {
    return getSession().then(function(s) {
      if (!s) throw new Error('Not authenticated');
      return s;
    });
  }

  function canManageSchool() {
    return !!(window.__authGuardCanManageSchool || window.__authGuardIsAdmin || window.__authGuardIsFacultyHead);
  }

  function normalizeRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      requester_id: row.requester_id,
      title: row.title || '',
      date: row.date,
      end_date: row.end_date || null,
      category: row.category || 'general',
      description: row.description || '',
      status: row.status || 'pending',
      rejected_reason: row.rejected_reason || '',
      created_at: row.created_at,
      updated_at: row.updated_at,
      submitted_at: row.submitted_at,
      reviewed_at: row.reviewed_at,
      reviewed_by: row.reviewed_by
    };
  }

  function expandDateRange(startIso, endIso) {
    var start = String(startIso || '').slice(0, 10);
    var end = String(endIso || start).slice(0, 10);
    if (!start) return [];
    if (end < start) end = start;
    var out = [];
    var cur = new Date(start + 'T12:00:00');
    var last = new Date(end + 'T12:00:00');
    if (Number.isNaN(cur.getTime()) || Number.isNaN(last.getTime())) return [start];
    while (cur <= last) {
      out.push(
        cur.getFullYear() + '-' +
        String(cur.getMonth() + 1).padStart(2, '0') + '-' +
        String(cur.getDate()).padStart(2, '0')
      );
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }

  function formatDateRange(row) {
    var start = String(row.date || '').slice(0, 10);
    var end = row.end_date ? String(row.end_date).slice(0, 10) : start;
    if (!start) return '';
    if (end && end !== start) return start + ' – ' + end;
    return start;
  }

  window.CalendarRequestService = {
    canManageSchool: canManageSchool,
    formatDateRange: formatDateRange,
    expandDateRange: expandDateRange,

    submitRequest: function(payload) {
      var title = String(payload && payload.title || '').trim();
      var date = String(payload && payload.date || '').slice(0, 10);
      var endDate = payload && payload.end_date ? String(payload.end_date).slice(0, 10) : null;
      var category = String(payload && payload.category || 'general').trim() || 'general';
      var description = String(payload && payload.description || '').trim();
      if (!title || !date) return Promise.reject(new Error('Title and start date are required'));
      if (endDate && endDate < date) return Promise.reject(new Error('End date must be on or after start date'));

      return requireSession().then(function(session) {
        return window.supabase.from('calendar_event_requests').insert({
          requester_id: session.user.id,
          title: title,
          date: date,
          end_date: endDate || null,
          category: category,
          description: description || null,
          status: 'pending'
        }).select().single();
      }).then(function(r) {
        if (r.error) throw r.error;
        return normalizeRow(r.data);
      });
    },

    listMyRequests: function() {
      return requireSession().then(function(session) {
        return window.supabase.from('calendar_event_requests')
          .select('id, requester_id, title, date, end_date, category, description, status, rejected_reason, created_at, updated_at, submitted_at, reviewed_at, reviewed_by')
          .eq('requester_id', session.user.id)
          .order('submitted_at', { ascending: false })
          .limit(50);
      }).then(function(r) {
        if (r.error) throw r.error;
        return (r.data || []).map(normalizeRow);
      });
    },

    listPendingForReview: function() {
      if (!canManageSchool()) return Promise.resolve([]);
      return requireSession().then(function() {
        return window.supabase.from('calendar_event_requests')
          .select('id, requester_id, title, date, end_date, category, description, status, rejected_reason, created_at, submitted_at, reviewed_at, reviewed_by')
          .eq('status', 'pending')
          .order('submitted_at', { ascending: true });
      }).then(function(r) {
        if (r.error) throw r.error;
        return (r.data || []).map(normalizeRow);
      });
    },

    listRecentReviewedForRequester: function() {
      return requireSession().then(function(session) {
        return window.supabase.from('calendar_event_requests')
          .select('id, requester_id, title, date, end_date, category, status, rejected_reason, reviewed_at, updated_at')
          .eq('requester_id', session.user.id)
          .in('status', ['approved', 'rejected'])
          .order('reviewed_at', { ascending: false })
          .limit(20);
      }).then(function(r) {
        if (r.error) throw r.error;
        return (r.data || []).map(normalizeRow);
      });
    },

    approveRequest: function(requestId) {
      return requireSession().then(function() {
        return window.supabase.rpc('approve_calendar_event_request', { p_request_id: requestId });
      }).then(function(r) {
        if (r.error) throw r.error;
        return r.data;
      });
    },

    rejectRequest: function(requestId, reason) {
      return requireSession().then(function() {
        return window.supabase.rpc('reject_calendar_event_request', {
          p_request_id: requestId,
          p_reason: reason || null
        });
      }).then(function(r) {
        if (r.error) throw r.error;
        return r.data;
      });
    },

    cancelMyPending: function(requestId) {
      return requireSession().then(function(session) {
        return window.supabase.from('calendar_event_requests')
          .delete()
          .eq('id', requestId)
          .eq('requester_id', session.user.id)
          .eq('status', 'pending');
      }).then(function(r) {
        if (r.error) throw r.error;
      });
    },

    getRequesterProfiles: function(userIds) {
      var ids = (userIds || []).filter(Boolean);
      if (!ids.length) return Promise.resolve({});
      return requireSession().then(function() {
        return window.supabase.from('profiles')
          .select('id, email, display_name')
          .in('id', ids);
      }).then(function(r) {
        if (r.error) throw r.error;
        var map = {};
        (r.data || []).forEach(function(p) {
          map[p.id] = p.display_name || p.email || 'Staff member';
        });
        return map;
      });
    }
  };
})();
