/**
 * Promote-with-archive and tracking-history snapshots for BGE trackers (art / drama).
 */
window.TrackerPromoteArchive = (function() {
  'use strict';

  var YGS = ['s1', 's2', 's3'];

  function deepCopy(val) {
    return val == null ? val : JSON.parse(JSON.stringify(val));
  }

  function ensureArchivedShape(S) {
    if (!S || typeof S !== 'object') return S;
    S.archived = S.archived || { s1: {}, s2: {}, s3: {} };
    YGS.forEach(function(yg) {
      if (!S.archived[yg] || typeof S.archived[yg] !== 'object') S.archived[yg] = {};
    });
    return S;
  }

  function extractClassData(S, yg, cls) {
    var pupils = (S.pupils && S.pupils[yg] && S.pupils[yg][cls]) || [];
    var scores = {};
    var profiles = {};
    pupils.forEach(function(p) {
      if (S.scores && S.scores[yg] && S.scores[yg][p.id]) scores[p.id] = deepCopy(S.scores[yg][p.id]);
      if (S.profiles && S.profiles[yg] && S.profiles[yg][p.id]) profiles[p.id] = deepCopy(S.profiles[yg][p.id]);
    });
    return {
      pupils: pupils.map(function(p) { return { id: p.id, name: p.name }; }),
      scores: scores,
      profiles: profiles
    };
  }

  function removeActiveClassData(S, yg, cls) {
    if (!S.pupils || !S.pupils[yg] || !S.pupils[yg][cls]) return S;
    (S.pupils[yg][cls] || []).forEach(function(p) {
      if (S.scores && S.scores[yg]) delete S.scores[yg][p.id];
      if (S.profiles && S.profiles[yg]) delete S.profiles[yg][p.id];
    });
    delete S.pupils[yg][cls];
    return S;
  }

  function archiveClass(S, yg, cls, meta) {
    S = ensureArchivedShape(S);
    var data = extractClassData(S, yg, cls);
    S.archived[yg][cls] = {
      pupils: data.pupils,
      scores: data.scores,
      profiles: data.profiles,
      archivedAt: new Date().toISOString(),
      promotedTo: meta && meta.promotedTo ? meta.promotedTo : null,
      reason: (meta && meta.reason) || 'promoted'
    };
    removeActiveClassData(S, yg, cls);
    return S;
  }

  function archiveClassFromHandover(S, yg, cls, handover, meta) {
    S = ensureArchivedShape(S);
    S.archived[yg][cls] = {
      pupils: deepCopy((handover && handover.pupils) || []),
      scores: deepCopy((handover && handover.scores) || {}),
      profiles: deepCopy((handover && handover.profiles) || {}),
      archivedAt: new Date().toISOString(),
      promotedTo: meta && meta.promotedTo ? meta.promotedTo : null,
      reason: (meta && meta.reason) || 'promoted'
    };
    removeActiveClassData(S, yg, cls);
    return S;
  }

  function attachTrackingSnapshots(S, toYg, newPupils, handover, fromYg, fromClsName) {
    if (!S.profiles) S.profiles = { s1: {}, s2: {}, s3: {} };
    if (!S.profiles[toYg]) S.profiles[toYg] = {};
    (newPupils || []).forEach(function(np, i) {
      var oldP = handover.pupils && handover.pupils[i];
      if (!oldP) return;
      var oldId = oldP.id;
      if (!S.profiles[toYg][np.id]) S.profiles[toYg][np.id] = {};
      S.profiles[toYg][np.id].trackingHistory = S.profiles[toYg][np.id].trackingHistory || {};
      S.profiles[toYg][np.id].trackingHistory[fromYg] = {
        className: fromClsName || handover.className || '',
        scores: handover.scores && handover.scores[oldId] ? deepCopy(handover.scores[oldId]) : {},
        profiles: handover.profiles && handover.profiles[oldId] ? deepCopy(handover.profiles[oldId]) : {},
        snapshotAt: new Date().toISOString()
      };
    });
    return S;
  }

  function promoteClass(S, options) {
    options = options || {};
    var fromYg = options.fromYearGroup;
    var cls = options.className;
    var toYg = options.toYearGroup;
    var targetCls = options.toClassName;
    var uidFn = options.uid || function() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2);
    };
    var includeSnapshot = options.includeSnapshot !== false;
    var archiveSource = options.archiveSource !== false;

    if (!S.pupils || !S.pupils[fromYg] || !S.pupils[fromYg][cls]) {
      throw new Error('Class not found');
    }
    if (S.pupils[toYg] && S.pupils[toYg][targetCls]) {
      throw new Error('Target class already exists');
    }

    var handover = extractClassData(S, fromYg, cls);
    handover.className = cls;
    handover.yearGroup = fromYg;

    var newPupils = handover.pupils.map(function(p) {
      return { id: uidFn(), name: p.name };
    });
    if (!S.pupils[toYg]) S.pupils[toYg] = {};
    S.pupils[toYg][targetCls] = newPupils;

    if (includeSnapshot) {
      attachTrackingSnapshots(S, toYg, newPupils, handover, fromYg, cls);
    }

    if (archiveSource) {
      archiveClassFromHandover(S, fromYg, cls, handover, {
        promotedTo: { yearGroup: toYg, className: targetCls }
      });
    }

    return {
      state: S,
      pupilCount: newPupils.length,
      toYearGroup: toYg,
      toClassName: targetCls,
      archived: archiveSource
    };
  }

  function deleteArchivedClass(S, yg, cls) {
    S = ensureArchivedShape(S);
    if (S.archived[yg]) delete S.archived[yg][cls];
    return S;
  }

  function archivedClassNames(S, yg) {
    S = ensureArchivedShape(S);
    return Object.keys(S.archived[yg] || {}).sort();
  }

  return {
    YGS: YGS,
    ensureArchivedShape: ensureArchivedShape,
    extractClassData: extractClassData,
    archiveClass: archiveClass,
    archiveClassFromHandover: archiveClassFromHandover,
    attachTrackingSnapshots: attachTrackingSnapshots,
    promoteClass: promoteClass,
    deleteArchivedClass: deleteArchivedClass,
    archivedClassNames: archivedClassNames
  };
})();
