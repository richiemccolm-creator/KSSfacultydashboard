/**
 * Concern feedback loop — notify flag raisers and faculty head when support actions are recorded.
 */
(function(global) {
  'use strict';

  function recipientKey(note) {
    if (note.recipient_role) return 'role:' + note.recipient_role;
    if (note.recipient_teacher_id) return 'teacher:' + note.recipient_teacher_id;
    return 'unknown';
  }

  function isRecipient(db, note) {
    if (note.recipient_role && db.dev_role === note.recipient_role) return true;
    if (note.recipient_teacher_id) {
      var teacherId = db.simulated_teacher_id;
      if (db.dev_role === 'class_teacher' && teacherId && note.recipient_teacher_id === teacherId) return true;
    }
    return false;
  }

  function forCurrentUser(db) {
    return (db.concern_feedback || []).filter(function(note) {
      return isRecipient(db, note);
    });
  }

  function unreadCount(db) {
    return forCurrentUser(db).filter(function(note) { return !note.read_at; }).length;
  }

  function flagsForIntervention(db, interventionId, concernId) {
    return (db.teacher_concerns || []).filter(function(f) {
      return f.intervention_id === interventionId || (concernId && f.id === concernId);
    });
  }

  function collectRecipients(db, intervention, entry) {
    var authorTeacherId = entry.author_teacher_id || null;
    var authorRole = entry.author_role || db.dev_role;
    var seen = {};
    var recipients = [];

    function add(type, id) {
      var key = type + ':' + id;
      if (seen[key]) return;
      if (type === 'teacher' && id === authorTeacherId) return;
      if (type === 'role' && id === authorRole) return;
      seen[key] = true;
      recipients.push({ type: type, id: id });
    }

    flagsForIntervention(db, intervention.id, entry.concern_id).forEach(function(f) {
      if (f.raised_by_teacher_id) add('teacher', f.raised_by_teacher_id);
    });

    if (intervention.responsible_teacher_id) {
      add('teacher', intervention.responsible_teacher_id);
    }

    if (authorRole !== 'faculty_head') {
      add('role', 'faculty_head');
    }

    return recipients;
  }

  function notifyTrailEntry(db, entry, intervention) {
    if (!entry || !intervention) return [];
    var recipients = collectRecipients(db, intervention, entry);
    var created = [];
    recipients.forEach(function(r) {
      var note = global.SptStore.insertRecord(db, 'concern_feedback', {
        recipient_teacher_id: r.type === 'teacher' ? r.id : null,
        recipient_role: r.type === 'role' ? r.id : null,
        flag_id: entry.concern_id || null,
        intervention_id: intervention.id,
        trail_entry_id: entry.id,
        enrolment_id: intervention.enrolment_id,
        author_label: entry.author_label || 'Staff',
        note_preview: (entry.note || '').slice(0, 200),
        read_at: null
      }, 'concern_feedback_notify');
      created.push(note);
    });
    return created;
  }

  function markRead(db, notificationId) {
    var note = global.SptStore.byId(db.concern_feedback, notificationId);
    if (!note || !isRecipient(db, note) || note.read_at) return note;
    return global.SptStore.updateRecord(db, 'concern_feedback', notificationId, {
      read_at: new Date().toISOString()
    }, 'concern_feedback_read');
  }

  function markAllRead(db) {
    forCurrentUser(db).forEach(function(note) {
      if (!note.read_at) markRead(db, note.id);
    });
    return db;
  }

  function actionLabel(entry) {
    if (!entry) return 'Update';
    if (entry.source === 'alert_action') return 'Action taken';
    return 'Follow-up';
  }

  global.SptFeedback = {
    forCurrentUser: forCurrentUser,
    unreadCount: unreadCount,
    notifyTrailEntry: notifyTrailEntry,
    markRead: markRead,
    markAllRead: markAllRead,
    actionLabel: actionLabel,
    isRecipient: isRecipient
  };
})(typeof window !== 'undefined' ? window : global);
