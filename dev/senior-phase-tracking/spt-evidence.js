/**
 * Evidence Bank — eligibility, SQA unit templates, seeding.
 */
(function(global) {
  'use strict';

  var UNIT_TEMPLATES = {
    'n4-drama': [
      { unit_code: 'H231 74', unit_name: 'Drama Skills', short_label: 'Skills' },
      { unit_code: 'H232 74', unit_name: 'Production Skills', short_label: 'Production' },
      { unit_code: 'H233 74', unit_name: 'Drama Performance (AVU)', short_label: 'Performance' }
    ],
    'n4-art': [
      { unit_code: 'H202 74', unit_name: 'Expressive Activity', short_label: 'Expressive' },
      { unit_code: 'H204 74', unit_name: 'Design Activity', short_label: 'Design' },
      { unit_code: 'H206 74', unit_name: 'Practical Activity (AVU)', short_label: 'Practical' }
    ],
    'creative-industries': [
      { unit_code: 'H6MV 75', unit_name: 'An Introduction (Scotland)', short_label: 'Intro' },
      { unit_code: 'J17W 75', unit_name: 'Skills Development', short_label: 'Skills' },
      { unit_code: 'J17X 75', unit_name: 'The Creative Process', short_label: 'Process' },
      { unit_code: 'J17Y 75', unit_name: 'Creative Project', short_label: 'Project' }
    ],
    'film-level5': [
      { unit_code: 'J9CT 45', unit_name: 'Film and Screen: Elements', short_label: 'Elements' },
      { unit_code: 'J8R2 45', unit_name: 'Film and Screen: Roles', short_label: 'Roles' },
      { unit_code: 'J8G3 45', unit_name: 'Film and Screen: Creative Project', short_label: 'Project' }
    ],
    'film-level6': [
      { unit_code: 'J8G1 46', unit_name: 'Film and Screen: Elements', short_label: 'Elements' },
      { unit_code: 'J8R2 46', unit_name: 'Film and Screen: Roles', short_label: 'Roles' },
      { unit_code: 'J8G3 46', unit_name: 'Film and Screen: Creative Project', short_label: 'Project' }
    ],
    'npa-photo-l4': [
      { unit_code: 'J4GA 44', unit_name: 'Understanding Photography', short_label: 'Understanding' },
      { unit_code: 'J4GB 44', unit_name: 'Photographing People', short_label: 'People' },
      { unit_code: 'J4GC 44', unit_name: 'Photographing Places', short_label: 'Places' },
      { unit_code: 'J4GD 44', unit_name: 'Working with Photographs', short_label: 'Working' }
    ],
    'npa-photo-l5': [
      { unit_code: 'J4GA 45', unit_name: 'Understanding Photography', short_label: 'Understanding' },
      { unit_code: 'J4GB 45', unit_name: 'Photographing People', short_label: 'People' },
      { unit_code: 'J4GC 45', unit_name: 'Photographing Places', short_label: 'Places' },
      { unit_code: 'J4GD 45', unit_name: 'Working with Photographs', short_label: 'Working' }
    ]
  };

  function isN34Level(level) {
    var l = String(level || '').toLowerCase();
    return l.indexOf('national 3') >= 0 || l === 'n3' ||
      l.indexOf('national 4') >= 0 || l === 'n4' ||
      l.indexOf('level 3') >= 0 || l.indexOf('level 4') >= 0;
  }

  function isFilmLevel5(level) {
    var l = String(level || '').toLowerCase();
    return l.indexOf('level 5') >= 0 || l.indexOf('national 5') >= 0 || l === 'n5';
  }

  function isNpaPhotoLevel4(level) {
    var l = String(level || '').toLowerCase().trim();
    if (l.indexOf('level 5') >= 0) return false;
    return l.indexOf('level 4') >= 0;
  }

  function templateKey(course, enrolment) {
    if (!course || !enrolment) return null;
    if (course.slug === 'creative-industries') return 'creative-industries';
    if (course.slug === 'npa-photo') {
      return isNpaPhotoLevel4(enrolment.current_level) ? 'npa-photo-l4' : 'npa-photo-l5';
    }
    if (course.slug === 'l6l5-film') return isFilmLevel5(enrolment.current_level) ? 'film-level5' : 'film-level6';
    if (course.slug === 'n5n4-drama' && isN34Level(enrolment.current_level)) return 'n4-drama';
    if (course.slug === 'n5n4-art' && isN34Level(enrolment.current_level)) return 'n4-art';
    return null;
  }

  function usesEvidenceBank(course, enrolment) {
    return templateKey(course, enrolment) != null;
  }

  function usesExamRoute(course, enrolment) {
    if (!course || !enrolment) return false;
    if (course.slug === 'creative-industries' || course.slug === 'l6l5-film' || course.slug === 'npa-photo') return false;
    if (course.slug === 'n5n4-drama' || course.slug === 'n5n4-art') {
      return !isN34Level(enrolment.current_level);
    }
    return true;
  }

  function isPassFailCourse(course) {
    return course && (course.slug === 'creative-industries' || course.slug === 'l6l5-film' || course.slug === 'npa-photo');
  }

  function getUnitTemplate(course, enrolment) {
    var key = templateKey(course, enrolment);
    return key ? (UNIT_TEMPLATES[key] || []).slice() : [];
  }

  function evidenceForEnrolment(db, enrolmentId) {
    return (db.evidence_bank || []).filter(function(ev) { return ev.enrolment_id === enrolmentId; })
      .sort(function(a, b) { return (a.display_order || 0) - (b.display_order || 0); });
  }

  function missingCount(db, enrolmentId) {
    var en = global.SptStore.byId(db.enrolments, enrolmentId);
    var course = en ? global.SptStore.byId(db.courses, en.course_id) : null;
    if (!en || !course || !usesEvidenceBank(course, en)) return 0;
    return evidenceForEnrolment(db, enrolmentId).filter(function(ev) {
      return ev.evidence_status === 'Missing' || ev.evidence_status === 'Not Started';
    }).length;
  }

  function bankedCount(db, enrolmentId) {
    return evidenceForEnrolment(db, enrolmentId).filter(function(ev) {
      return ev.evidence_status === 'Banked';
    }).length;
  }

  function seedForEnrolment(db, enrolmentId) {
    var en = global.SptStore.byId(db.enrolments, enrolmentId);
    if (!en) return [];
    var course = global.SptStore.byId(db.courses, en.course_id);
    if (!usesEvidenceBank(course, en)) return [];
    var tpl = getUnitTemplate(course, en);
    var existing = evidenceForEnrolment(db, enrolmentId);
    var created = [];
    tpl.forEach(function(u, i) {
      var match = existing.find(function(ev) { return ev.unit_code === u.unit_code; });
      if (match) return;
      var row = global.SptStore.insertRecord(db, 'evidence_bank', {
        enrolment_id: enrolmentId,
        unit_code: u.unit_code,
        evidence_title: u.unit_name,
        unit_or_component: u.unit_name,
        short_label: u.short_label,
        evidence_type: 'Unit Evidence',
        evidence_status: 'Not Started',
        display_order: i + 1,
        date_banked: null,
        verified_by_teacher_id: null,
        verification_status: 'Not Verified',
        notes: ''
      }, 'evidence_seed');
      created.push(row);
    });
    return created;
  }

  function removeForEnrolment(db, enrolmentId) {
    var before = (db.evidence_bank || []).length;
    db.evidence_bank = (db.evidence_bank || []).filter(function(ev) {
      return ev.enrolment_id !== enrolmentId;
    });
    if (db.evidence_bank.length !== before) global.SptStore.save(db);
  }

  function syncEnrolment(db, enrolmentId) {
    var en = global.SptStore.byId(db.enrolments, enrolmentId);
    if (!en) return;
    var course = global.SptStore.byId(db.courses, en.course_id);
    if (usesEvidenceBank(course, en)) {
      var tpl = getUnitTemplate(course, en);
      var validCodes = {};
      tpl.forEach(function(u) { validCodes[u.unit_code] = true; });
      db.evidence_bank = (db.evidence_bank || []).filter(function(ev) {
        if (ev.enrolment_id !== enrolmentId) return true;
        return !!validCodes[ev.unit_code];
      });
      seedForEnrolment(db, enrolmentId);
    } else {
      removeForEnrolment(db, enrolmentId);
    }
  }

  function syncAll(db) {
    (db.enrolments || []).forEach(function(en) {
      if (en.active_status === false) return;
      syncEnrolment(db, en.id);
    });
    return db;
  }

  function statusCellHtml(ev, canEdit) {
    if (!ev) return '—';
    if (canEdit) {
      var opts = (global.SptConfig.STATUS.evidence || []).map(function(s) {
        return '<option' + (ev.evidence_status === s ? ' selected' : '') + '>' + s + '</option>';
      }).join('');
      return '<select class="inline-select" data-evidence="' + ev.id + '">' + opts + '</select>';
    }
    return '<span class="badge ' + (global.SptConfig.BADGE_CLASS[ev.evidence_status] || 'badge-grey') + '">' +
      (ev.evidence_status || '—') + '</span>';
  }

  global.SptEvidence = {
    UNIT_TEMPLATES: UNIT_TEMPLATES,
    isN34Level: isN34Level,
    isNpaPhotoLevel4: isNpaPhotoLevel4,
    usesEvidenceBank: usesEvidenceBank,
    usesExamRoute: usesExamRoute,
    isPassFailCourse: isPassFailCourse,
    getUnitTemplate: getUnitTemplate,
    evidenceForEnrolment: evidenceForEnrolment,
    missingCount: missingCount,
    bankedCount: bankedCount,
    seedForEnrolment: seedForEnrolment,
    removeForEnrolment: removeForEnrolment,
    syncEnrolment: syncEnrolment,
    syncAll: syncAll,
    statusCellHtml: statusCellHtml
  };
})(typeof window !== 'undefined' ? window : global);
