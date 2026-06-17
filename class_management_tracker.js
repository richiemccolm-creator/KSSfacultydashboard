/**
 * Tracker class list, transfer, and promote-and-assign (faculty head).
 * Depends on DataService.getForUser / setForUser / upsertTeacherSubjectClassesForLoader.
 */
window.ClassManagementTracker = (function() {
  'use strict';

  var YGS = ['s1', 's2', 's3'];

  function dataTypeForSubject(subject) {
    return subject === 'drama' ? 'drama-v3' : 'art-v2';
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function emptyTrackerState() {
    return {
      pupils: { s1: {}, s2: {}, s3: {} },
      scores: { s1: {}, s2: {}, s3: {} },
      profiles: { s1: {}, s2: {}, s3: {} },
      archived: { s1: {}, s2: {}, s3: {} },
      curTP: { s1: 'tp1', s2: 'tp1', s3: 'tp1' },
      curCls: { s1: 'all', s2: 'all', s3: 'all' },
      defaultsOn: {}
    };
  }

  function ensureTrackerShape(S) {
    if (!S || typeof S !== 'object') S = emptyTrackerState();
    S.pupils = S.pupils || { s1: {}, s2: {}, s3: {} };
    S.scores = S.scores || { s1: {}, s2: {}, s3: {} };
    S.profiles = S.profiles || { s1: {}, s2: {}, s3: {} };
    YGS.forEach(function(yg) {
      if (!S.pupils[yg] || typeof S.pupils[yg] !== 'object') S.pupils[yg] = {};
      if (!S.scores[yg] || typeof S.scores[yg] !== 'object') S.scores[yg] = {};
      if (!S.profiles[yg] || typeof S.profiles[yg] !== 'object') S.profiles[yg] = {};
    });
    if (window.TrackerPromoteArchive) TrackerPromoteArchive.ensureArchivedShape(S);
    return S;
  }

  function pupilCountInClass(S, yg, cls) {
    return ((S.pupils[yg] && S.pupils[yg][cls]) || []).length;
  }

  function hasScoresInClass(S, yg, cls) {
    var pupils = (S.pupils[yg] && S.pupils[yg][cls]) || [];
    return pupils.some(function(p) {
      var sc = S.scores[yg] && S.scores[yg][p.id];
      return sc && Object.keys(sc).length > 0;
    });
  }

  function buildClassRowsFromStaff(staffList, filter) {
    var rows = [];
    var f = filter || {};
    var subjFilter = f.subject || '';
    var ygFilter = f.yearGroup || '';
    var q = (f.q || '').toLowerCase();

    (staffList || []).forEach(function(staff) {
      var userId = staff.user_id;
      var teacherName = staff.teacherName || staff.display_name || staff.email || 'Unknown';
      var email = staff.email || '';

      function addFromTracker(data, subject) {
        if (!data) return;
        var S = ensureTrackerShape(data);
        YGS.forEach(function(yg) {
          if (ygFilter && yg !== ygFilter) return;
          if (subjFilter && subject !== subjFilter) return;
          Object.keys(S.pupils[yg] || {}).sort().forEach(function(cls) {
            var n = pupilCountInClass(S, yg, cls);
            if (!n && !cls) return;
            var row = {
              userId: userId,
              teacherName: teacherName,
              email: email,
              subject: subject,
              yearGroup: yg,
              className: cls,
              pupilCount: n,
              hasScores: hasScoresInClass(S, yg, cls)
            };
            if (q) {
              var hay = (teacherName + ' ' + email + ' ' + cls + ' ' + subject + ' ' + yg).toLowerCase();
              if (hay.indexOf(q) === -1) return;
            }
            rows.push(row);
          });
        });
      }

      addFromTracker(staff.art, 'art');
      addFromTracker(staff.drama, 'drama');
    });

    return rows.sort(function(a, b) {
      return (a.teacherName || '').localeCompare(b.teacherName || '') ||
        (a.subject || '').localeCompare(b.subject || '') ||
        (a.yearGroup || '').localeCompare(b.yearGroup || '') ||
        (a.className || '').localeCompare(b.className || '');
    });
  }

  function extractHandover(S, subject, yg, cls) {
    S = ensureTrackerShape(S);
    var pupils = (S.pupils[yg] && S.pupils[yg][cls]) || [];
    var scores = {};
    var profiles = {};
    pupils.forEach(function(p) {
      if (S.scores[yg] && S.scores[yg][p.id]) scores[p.id] = S.scores[yg][p.id];
      if (S.profiles[yg] && S.profiles[yg][p.id]) profiles[p.id] = S.profiles[yg][p.id];
    });
    return {
      subject: subject,
      version: 1,
      exportDate: new Date().toISOString(),
      yearGroup: yg,
      className: cls,
      pupils: pupils.map(function(p) { return { id: p.id, name: p.name }; }),
      scores: scores,
      profiles: profiles
    };
  }

  function removeClassFromState(S, yg, cls) {
    S = ensureTrackerShape(S);
    (S.pupils[yg][cls] || []).forEach(function(p) {
      if (S.scores[yg]) delete S.scores[yg][p.id];
      if (S.profiles[yg]) delete S.profiles[yg][p.id];
    });
    delete S.pupils[yg][cls];
    return S;
  }

  function importHandoverIntoState(S, handover, targetCls, replaceExisting) {
    S = ensureTrackerShape(S);
    var yg = handover.yearGroup;
    var target = targetCls || handover.className;
    if (!YGS.includes(yg)) throw new Error('Invalid year group');

    if (replaceExisting) {
      var existingCls = Object.keys(S.pupils[yg] || {}).find(function(c) {
        return c === target || c.indexOf(target + ' (imported ') === 0;
      });
      if (existingCls) S = removeClassFromState(S, yg, existingCls);
    }

    if (S.pupils[yg][target]) {
      throw new Error('Class "' + target + '" already exists for this teacher');
    }

    var pidMap = {};
    var newPupils = (handover.pupils || []).map(function(p) {
      var np = { id: uid(), name: p.name };
      pidMap[p.id] = np.id;
      return np;
    });
    S.pupils[yg][target] = newPupils;
    Object.keys(handover.scores || {}).forEach(function(oldPid) {
      var newPid = pidMap[oldPid];
      if (newPid) S.scores[yg][newPid] = handover.scores[oldPid];
    });
    Object.keys(handover.profiles || {}).forEach(function(oldPid) {
      var newPid = pidMap[oldPid];
      if (newPid) S.profiles[yg][newPid] = handover.profiles[oldPid];
    });
    return { state: S, pupilCount: newPupils.length, className: target, yearGroup: yg };
  }

  function suggestPromotedClassName(cls, fromYg, toYg, targetState) {
    var toLabel = toYg.toUpperCase();
    var next = cls;
    if (/\bS1\b/i.test(cls) && toYg === 's2') next = cls.replace(/\bS1\b/gi, toLabel);
    else if (/\bS2\b/i.test(cls) && toYg === 's3') next = cls.replace(/\bS2\b/gi, toLabel);
    else if (/\bs1\b/i.test(cls) && toYg === 's2') next = cls.replace(/\bs1\b/gi, toYg);
    else if (/\bs2\b/i.test(cls) && toYg === 's3') next = cls.replace(/\bs2\b/gi, toYg);
    else next = suggestCodeBump(cls);
    var pupils = targetState && targetState.pupils && targetState.pupils[toYg];
    if (pupils && pupils[next]) return next + ' (promoted)';
    return next;
  }

  function suggestCodeBump(cls) {
    var m = /^(\D*)(\d)(.*)$/.exec(String(cls).trim());
    if (!m) return cls;
    return m[1] + (parseInt(m[2], 10) + 1) + m[3];
  }

  function nextYearGroup(yg) {
    if (yg === 's1') return 's2';
    if (yg === 's2') return 's3';
    return null;
  }

  function promoteHandoverToState(targetS, handover, toYg, toClsName, includeSnapshot) {
    targetS = ensureTrackerShape(targetS);
    var fromYg = handover.yearGroup;
    var toCls = toClsName || suggestPromotedClassName(handover.className, fromYg, toYg, targetS);
    if (targetS.pupils[toYg][toCls]) {
      throw new Error('"' + toCls + '" already exists in ' + toYg.toUpperCase());
    }

    var pidMap = {};
    var newPupils = (handover.pupils || []).map(function(p) {
      var np = { id: uid(), name: p.name };
      pidMap[p.id] = np.id;
      return np;
    });
    targetS.pupils[toYg][toCls] = newPupils;

    if (includeSnapshot) {
      newPupils.forEach(function(np, i) {
        var oldP = handover.pupils[i];
        if (!oldP) return;
        var oldId = oldP.id;
        if (!targetS.profiles[toYg][np.id]) targetS.profiles[toYg][np.id] = {};
        targetS.profiles[toYg][np.id].trackingHistory = targetS.profiles[toYg][np.id].trackingHistory || {};
        targetS.profiles[toYg][np.id].trackingHistory[fromYg] = {
          className: handover.className,
          scores: handover.scores && handover.scores[oldId] ? handover.scores[oldId] : {},
          profiles: handover.profiles && handover.profiles[oldId] ? handover.profiles[oldId] : {},
          snapshotAt: new Date().toISOString()
        };
      });
    }

    return {
      state: targetS,
      toYearGroup: toYg,
      toClassName: toCls,
      pupilCount: newPupils.length
    };
  }

  function classCodeFromName(name) {
    var s = String(name || '').trim();
    var m = /\b(\d[A-Za-z0-9]+)\b/.exec(s);
    return m ? m[1] : s.replace(/\s+/g, '').slice(0, 32) || 'class';
  }

  function yearLevelNum(yg) {
    if (yg === 's1') return 1;
    if (yg === 's2') return 2;
    if (yg === 's3') return 3;
    return null;
  }

  function syncRosterClass(options) {
    var opts = options || {};
    if (!window.DataService || typeof DataService.upsertTeacherSubjectClassesForLoader !== 'function') {
      return Promise.resolve(null);
    }
    var yl = yearLevelNum(opts.yearGroup);
    if (!yl) return Promise.resolve(null);
    return DataService.upsertTeacherSubjectClassesForLoader({
      teacherId: opts.teacherId,
      subject: opts.subject,
      academicYearLabel: opts.academicYearLabel,
      classes: [{
        year_level: 'S' + yl,
        class_code: opts.classCode || classCodeFromName(opts.className),
        class_name: opts.className
      }],
      replaceExisting: false
    });
  }

  function loadTrackerState(userId, subject) {
    var dt = dataTypeForSubject(subject);
    return DataService.getForUser(userId, dt).then(function(data) {
      return ensureTrackerShape(data || emptyTrackerState());
    });
  }

  function saveTrackerState(userId, subject, state) {
    return DataService.setForUser(userId, dataTypeForSubject(subject), state);
  }

  function transferClass(options) {
    var opts = options || {};
    var fromId = opts.fromUserId;
    var toId = opts.toUserId;
    var subject = opts.subject;
    var yg = opts.yearGroup;
    var cls = opts.className;
    var targetCls = opts.targetClassName || cls;
    var removeFromSource = opts.removeFromSource !== false;
    var syncRoster = opts.syncRoster !== false;
    var academicYear = opts.academicYearLabel;

    return loadTrackerState(fromId, subject).then(function(fromS) {
      if (!fromS.pupils[yg] || !fromS.pupils[yg][cls]) {
        throw new Error('Class not found on source teacher');
      }
      var handover = extractHandover(fromS, subject, yg, cls);
      handover.className = targetCls;

      return loadTrackerState(toId, subject).then(function(toS) {
        var result = importHandoverIntoState(toS, handover, targetCls, true);
        var saves = [saveTrackerState(toId, subject, result.state)];
        if (removeFromSource) {
          fromS = removeClassFromState(fromS, yg, cls);
          saves.push(saveTrackerState(fromId, subject, fromS));
        }
        return Promise.all(saves).then(function() {
          if (!syncRoster || !academicYear) return result;
          return syncRosterClass({
            teacherId: toId,
            subject: subject,
            academicYearLabel: academicYear,
            yearGroup: yg,
            className: targetCls,
            classCode: opts.classCode
          }).then(function() { return result; });
        });
      });
    });
  }

  function promoteAndAssign(options) {
    var opts = options || {};
    var fromId = opts.fromUserId;
    var toId = opts.toUserId || opts.fromUserId;
    var subject = opts.subject;
    var fromYg = opts.fromYearGroup;
    var cls = opts.className;
    var toYg = opts.toYearGroup || nextYearGroup(fromYg);
    var toCls = opts.toClassName;
    var includeSnapshot = opts.includeSnapshot !== false;
    var archiveSource = opts.archiveSource !== false;
    var academicYear = opts.academicYearLabel;

    if (!toYg) throw new Error('Cannot promote above S3');

    return loadTrackerState(fromId, subject).then(function(fromS) {
      if (!fromS.pupils[fromYg] || !fromS.pupils[fromYg][cls]) {
        throw new Error('Class not found on source teacher');
      }
      var handover = extractHandover(fromS, subject, fromYg, cls);

      function archiveSourceClass(state, result) {
        if (!archiveSource || !window.TrackerPromoteArchive) return state;
        return TrackerPromoteArchive.archiveClassFromHandover(state, fromYg, cls, handover, {
          promotedTo: { yearGroup: result.toYearGroup, className: result.toClassName }
        });
      }

      function afterPromote(result, saves) {
        return Promise.all(saves).then(function() {
          if (!academicYear) return result;
          return syncRosterClass({
            teacherId: toId,
            subject: subject,
            academicYearLabel: academicYear,
            yearGroup: toYg,
            className: result.toClassName,
            classCode: opts.classCode
          }).then(function() { return result; });
        });
      }

      if (fromId === toId) {
        var defaultName = toCls || suggestPromotedClassName(cls, fromYg, toYg, fromS);
        var sameResult = promoteHandoverToState(fromS, handover, toYg, defaultName, includeSnapshot);
        archiveSourceClass(sameResult.state, sameResult);
        return afterPromote(sameResult, [saveTrackerState(fromId, subject, sameResult.state)]);
      }

      return loadTrackerState(toId, subject).then(function(toS) {
        var defaultName = toCls || suggestPromotedClassName(cls, fromYg, toYg, toS);
        var result = promoteHandoverToState(toS, handover, toYg, defaultName, includeSnapshot);
        var saves = [saveTrackerState(toId, subject, result.state)];
        fromS = archiveSourceClass(fromS, result);
        if (archiveSource) saves.push(saveTrackerState(fromId, subject, fromS));
        return afterPromote(result, saves);
      });
    });
  }

  return {
    buildClassRowsFromStaff: buildClassRowsFromStaff,
    suggestPromotedClassName: suggestPromotedClassName,
    nextYearGroup: nextYearGroup,
    transferClass: transferClass,
    promoteAndAssign: promoteAndAssign,
    loadStaff: function() {
      return DataService.getStaffListWithWorkForAdmin();
    }
  };
})();
