/**
 * Purchase ordering: budgets, requests, lines; uses Supabase tables + RPCs.
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

  window.PurchaseOrderService = {
    getCurrentAcademicYear: function() {
      var d = new Date();
      var y = d.getFullYear();
      var m = d.getMonth();
      if (m >= 7) return y + '-' + String(y + 1).slice(-2);
      return (y - 1) + '-' + String(y).slice(-2);
    },

    /** @returns {Promise<Array<{subject_code:string,budget_gbp:number,spent_gbp:number,committed_gbp:number}>>} */
    getDashboardStats: function(academicYear) {
      return getSession().then(function(session) {
        if (!session) throw new Error('Not authenticated');
        return window.supabase.rpc('purchase_dashboard_stats', { p_academic_year: academicYear || '' });
      }).then(function(r) {
        if (r.error) throw r.error;
        return (r.data || []).map(function(row) {
          return {
            subject_code: row.subject_code,
            budget_gbp: Number(row.budget_gbp),
            spent_gbp: Number(row.spent_gbp),
            committed_gbp: Number(row.committed_gbp)
          };
        });
      });
    },

    /** @returns {Promise<Array>} */
    listBudgets: function(academicYear) {
      return requireSession().then(function() {
        return window.supabase.from('purchase_budgets')
          .select('id, academic_year, subject_code, amount_gbp')
          .eq('academic_year', academicYear)
          .order('subject_code');
      }).then(function(r) {
        if (r.error) throw r.error;
        return r.data || [];
      });
    },

    upsertBudget: function(academicYear, subjectCode, amountGbp) {
      return requireSession().then(function() {
        return window.supabase.from('purchase_budgets')
          .upsert(
            {
              academic_year: academicYear,
              subject_code: subjectCode,
              amount_gbp: Number(amountGbp)
            },
            { onConflict: 'academic_year,subject_code' }
          )
          .select();
      }).then(function(r) {
        if (r.error) throw r.error;
        return r.data && r.data[0];
      });
    },

    /** Full request with lines */
    getRequest: function(id) {
      return requireSession().then(function() {
        return window.supabase.from('purchase_requests')
          .select(
            'id, academic_year, subject_code, requester_id, status, notes, budget_vote, budget_vote_other, created_at, updated_at, submitted_at, approved_at, approved_by, rejected_reason, po_number, processed_at, processed_by, purchase_request_lines(*)'
          )
          .eq('id', id)
          .maybeSingle();
      }).then(function(r) {
        if (r.error) throw r.error;
        return r.data;
      });
    },

    listMyRequests: function(academicYear) {
      return requireSession().then(function(session) {
        var q = window.supabase.from('purchase_requests')
          .select('id, academic_year, subject_code, status, created_at, submitted_at, po_number, notes')
          .eq('requester_id', session.user.id)
          .order('updated_at', { ascending: false });
        if (academicYear) q = q.eq('academic_year', academicYear);
        return q;
      }).then(function(r) {
        if (r.error) throw r.error;
        return r.data || [];
      });
    },

    listSubmittedForAdmin: function() {
      return requireSession().then(function() {
        return window.supabase.from('purchase_requests')
          .select('id, academic_year, subject_code, status, created_at, submitted_at, notes, requester_id')
          .eq('status', 'submitted')
          .order('submitted_at', { ascending: true });
      }).then(function(r) {
        if (r.error) throw r.error;
        return r.data || [];
      });
    },

    listApprovedForAdmin: function() {
      return requireSession().then(function() {
        return window.supabase.from('purchase_requests')
          .select('id, academic_year, subject_code, status, created_at, submitted_at, approved_at, po_number, notes, requester_id')
          .eq('status', 'approved')
          .order('approved_at', { ascending: false });
      }).then(function(r) {
        if (r.error) throw r.error;
        return r.data || [];
      });
    },

    createDraft: function(academicYear, subjectCode, notes) {
      return requireSession().then(function(session) {
        return window.supabase.from('purchase_requests')
          .insert({
            academic_year: academicYear,
            subject_code: subjectCode,
            requester_id: session.user.id,
            status: 'draft',
            notes: notes || null
          })
          .select('id')
          .single();
      }).then(function(r) {
        if (r.error) throw r.error;
        return r.data.id;
      });
    },

    STALE_DRAFT_MESSAGE: 'This request has changed and can no longer be edited. Close it and reopen to see the current state.',

    /** True when the database refused a draft write because the request is no longer a draft. */
    isStaleDraftError: function(err) {
      if (err && err.code === 'PO_DRAFT_STALE') return true;
      var parts = [
        err && err.message,
        err && err.details,
        err && err.hint,
        err && err.code
      ].join(' ');
      return /PO_DRAFT_STALE/.test(parts);
    },

    /**
     * Atomically create or update a draft (metadata + line items) via save_purchase_draft.
     * Does not modify the request if it is no longer a draft.
     * @param {string|null} requestId - existing draft id, or null/empty to create
     * @param {{academicYear:string, subject:string, notes:string, vote:string, other:string, lines:Array}} payload
     * @returns {Promise<string>} request id
     */
    saveDraft: function(requestId, payload) {
      payload = payload || {};
      var vote = (payload.vote && String(payload.vote).trim()) ? String(payload.vote).trim() : null;
      var other = null;
      if (vote === 'other') {
        other = (payload.other && String(payload.other).trim()) ? String(payload.other).trim() : null;
      }
      var lines = (payload.lines || []).map(function(l) {
        return {
          product_code: String(l.product_code || '').trim(),
          description: String(l.description || '').trim(),
          unit_price: Number(l.unit_price) || 0,
          quantity: Number(l.quantity) || 1
        };
      });
      var id = requestId && String(requestId).trim() ? String(requestId).trim() : null;
      return requireSession().then(function() {
        return window.supabase.rpc('save_purchase_draft', {
          p_request_id: id,
          p_academic_year: payload.academicYear || '',
          p_subject_code: payload.subject || '',
          p_notes: (payload.notes && String(payload.notes).trim()) ? String(payload.notes).trim() : null,
          p_budget_vote: vote,
          p_budget_vote_other: other,
          p_lines: lines
        });
      }).then(function(r) {
        if (r.error) {
          if (window.PurchaseOrderService.isStaleDraftError(r.error)) {
            var stale = new Error(window.PurchaseOrderService.STALE_DRAFT_MESSAGE);
            stale.code = 'PO_DRAFT_STALE';
            throw stale;
          }
          throw r.error;
        }
        return r.data;
      });
    },

    submitRequest: function(requestId) {
      return requireSession().then(function() {
        return window.supabase.from('purchase_requests')
          .update({
            status: 'submitted',
            submitted_at: new Date().toISOString()
          })
          .eq('id', requestId)
          .eq('status', 'draft')
          .select();
      }).then(function(r) {
        if (r.error) throw r.error;
        if (!r.data || r.data.length === 0) {
          var stale = new Error(window.PurchaseOrderService.STALE_DRAFT_MESSAGE);
          stale.code = 'PO_DRAFT_STALE';
          throw stale;
        }
      });
    },

    /** Delete own request when status is draft, submitted, or rejected (via RPC; cascades lines). */
    deleteMyRequest: function(requestId) {
      return requireSession().then(function() {
        return window.supabase.rpc('delete_my_purchase_request', { p_request_id: requestId });
      }).then(function(r) {
        if (r.error) throw r.error;
        if (r.data !== true) throw new Error('Could not delete (not yours, or already approved/processed)');
      });
    },

    deleteDraft: function(requestId) {
      return window.PurchaseOrderService.deleteMyRequest(requestId);
    },

    /** Faculty Head / admin only. Permanently deletes a request in any status (RPC). */
    adminDeleteRequest: function(requestId) {
      return requireSession().then(function() {
        return window.supabase.rpc('admin_delete_purchase_request', { p_request_id: requestId });
      }).then(function(r) {
        if (r.error) throw r.error;
        if (r.data !== true) throw new Error('Could not delete this request.');
      });
    },

    listProcessedForAdmin: function(academicYear) {
      return requireSession().then(function() {
        var q = window.supabase.from('purchase_requests')
          .select('id, academic_year, subject_code, status, processed_at, po_number, notes, requester_id')
          .eq('status', 'processed')
          .order('processed_at', { ascending: false });
        if (academicYear) q = q.eq('academic_year', academicYear);
        return q;
      }).then(function(r) {
        if (r.error) throw r.error;
        return r.data || [];
      });
    },

    getMyProfile: function() {
      return requireSession().then(function(session) {
        return window.supabase.from('profiles')
          .select('id, email, display_name')
          .eq('id', session.user.id)
          .maybeSingle();
      }).then(function(r) {
        if (r.error) throw r.error;
        return r.data;
      });
    },

    updateMyDisplayName: function(displayName) {
      return requireSession().then(function(session) {
        var v = (displayName && String(displayName).trim()) ? String(displayName).trim() : null;
        return window.supabase.from('profiles')
          .update({ display_name: v })
          .eq('id', session.user.id)
          .select('id, display_name');
      }).then(function(r) {
        if (r.error) throw r.error;
      });
    },

    approveRequest: function(requestId) {
      return requireSession().then(function() {
        return window.supabase.rpc('approve_purchase_request', { p_request_id: requestId });
      }).then(function(r) {
        if (r.error) throw r.error;
        return r.data;
      });
    },

    rejectRequest: function(requestId, reason) {
      var text = (reason && String(reason).trim()) ? String(reason).trim() : '';
      if (!text) return Promise.reject(new Error('Enter a reason for rejecting this request.'));
      return requireSession().then(function() {
        return window.supabase.from('purchase_requests')
          .update({
            status: 'rejected',
            rejected_reason: text
          })
          .eq('id', requestId)
          .eq('status', 'submitted')
          .select();
      }).then(function(r) {
        if (r.error) throw r.error;
        if (!r.data || r.data.length === 0) throw new Error('Could not reject');
      });
    },

    markProcessed: function(requestId) {
      return requireSession().then(function(session) {
        return window.supabase.from('purchase_requests')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            processed_by: session.user.id
          })
          .eq('id', requestId)
          .eq('status', 'approved')
          .select();
      }).then(function(r) {
        if (r.error) throw r.error;
        if (!r.data || r.data.length === 0) throw new Error('Could not mark processed');
      });
    },

    getProfile: function(userId) {
      return requireSession().then(function() {
        return window.supabase.from('profiles')
          .select('id, email, display_name')
          .eq('id', userId)
          .maybeSingle();
      }).then(function(r) {
        if (r.error) throw r.error;
        return r.data;
      });
    },

    /** Sum line_total per request_id (admin dashboard / lists). */
    sumLineTotalsByRequestIds: function(ids) {
      if (!ids || ids.length === 0) return Promise.resolve({});
      return requireSession().then(function() {
        return window.supabase.from('purchase_request_lines')
          .select('request_id, line_total')
          .in('request_id', ids);
      }).then(function(r) {
        if (r.error) throw r.error;
        var map = {};
        (r.data || []).forEach(function(row) {
          var id = row.request_id;
          if (!map[id]) map[id] = 0;
          map[id] += Number(row.line_total);
        });
        return map;
      });
    }
  };
})();
