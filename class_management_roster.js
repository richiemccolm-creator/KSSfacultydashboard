/**
 * Roster pupil lists + manual push to Art/Drama BGE trackers.
 */
window.ClassManagementRoster = (function() {
  'use strict';

  var CACHE_TYPE = 'cm-roster-v1';

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function classKey(cls) {
    return 'S' + cls.year_level + '|' + String(cls.class_code || '').trim().toLowerCase();
  }

  function normalizeName(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function fullName(first, last, preferred) {
    var pref = String(preferred || '').trim();
    if (pref) return pref;
    var fn = String(first || '').trim();
    var ln = String(last || '').trim();
    if (fn && ln && fn.toLowerCase() !== ln.toLowerCase()) return fn + ' ' + ln;
    return fn || ln || '';
  }

  function splitDisplayName(name) {
    var s = String(name || '').trim();
    if (!s) return { first_name: 'Pupil', last_name: '' };
    var parts = s.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { first_name: parts[0], last_name: parts[0] };
    return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
  }

  function yearGroupFromLevel(level) {
    var n = Number(level);
    if (n === 1) return 's1';
    if (n === 2) return 's2';
    if (n === 3) return 's3';
    return null;
  }

  function cacheEntryKey(teacherId, subject, academicYear, key) {
    return [teacherId, subject, academicYear, key].join('|');
  }

  function readCacheEntry(cache, teacherId, subject, academicYear, key) {
    if (!cache || !cache.entries) return null;
    return cache.entries[cacheEntryKey(teacherId, subject, academicYear, key)] || null;
  }

  function writeCacheEntry(cache, teacherId, subject, academicYear, key, pupils) {
    cache = cache && typeof cache === 'object' ? cache : { version: 1, entries: {} };
    cache.version = 1;
    cache.entries = cache.entries || {};
    cache.entries[cacheEntryKey(teacherId, subject, academicYear, key)] = {
      pupils: (pupils || []).map(function(p) {
        return {
          local_id: p.local_id || uid(),
          name: String(p.name || '').trim(),
          tracker_pupil_id: p.tracker_pupil_id || null,
          pupil_id: p.pupil_id || null
        };
      }),
      updated_at: new Date().toISOString()
    };
    return cache;
  }

  function loadCache() {
    if (!window.DataService || typeof DataService.get !== 'function') {
      return Promise.resolve({ version: 1, entries: {} });
    }
    return DataService.get(CACHE_TYPE).then(function(data) {
      if (!data || typeof data !== 'object') return { version: 1, entries: {} };
      data.entries = data.entries || {};
      return data;
    }).catch(function() {
      return { version: 1, entries: {} };
    });
  }

  function saveCache(cache) {
    if (!window.DataService || typeof DataService.set !== 'function') {
      return Promise.resolve();
    }
    return DataService.set(CACHE_TYPE, cache || { version: 1, entries: {} });
  }

  function listRosterPupilsFromCloud(options) {
    var opts = options || {};
    if (!window.DataService || typeof DataService.listTeacherClassPupilsForLoader !== 'function') {
      return Promise.resolve([]);
    }
    return DataService.listTeacherClassPupilsForLoader(opts);
  }

  function pupilsForClassFromRows(rows, cls) {
    var key = classKey(cls);
    return (rows || []).filter(function(row) {
      var rowKey = 'S' + (Number(row.year_level) || parseInt(String(row.year_level_label || '').replace(/\D/g, ''), 10) || 0) +
        '|' + String(row.class_code || '').trim().toLowerCase();
      return rowKey === key;
    }).map(function(row) {
      return {
        local_id: uid(),
        name: fullName(row.first_name, row.last_name, row.preferred_name) || String(row.pupil_name || '').trim(),
        pupil_id: row.pupil_id || row.id || null,
        tracker_pupil_id: row.tracker_pupil_id || null
      };
    }).filter(function(p) { return p.name; });
  }

  function loadPupilsForTeacher(options) {
    var opts = options || {};
    var teacherId = opts.teacherId;
    var subject = opts.subject;
    var academicYear = opts.academicYearLabel;
    var classes = opts.classes || [];
    var byClass = {};

    return Promise.all([
      listRosterPupilsFromCloud({
        teacherId: teacherId,
        subject: subject,
        academicYearLabel: academicYear
      }),
      loadCache()
    ]).then(function(results) {
      var cloudRows = results[0] || [];
      var cache = results[1];
      classes.forEach(function(cls) {
        var key = classKey(cls);
        var fromCloud = pupilsForClassFromRows(cloudRows, cls);
        var fromCache = readCacheEntry(cache, teacherId, subject, academicYear, key);
        var cachePupils = fromCache && Array.isArray(fromCache.pupils) ? fromCache.pupils : [];
        var chosen = fromCloud.length ? fromCloud : cachePupils;
        if (fromCloud.length && cachePupils.length) {
          chosen = fromCloud.map(function(p) {
            var cached = cachePupils.find(function(c) {
              return normalizeName(c.name) === normalizeName(p.name);
            });
            if (cached && cached.tracker_pupil_id) {
              p.tracker_pupil_id = cached.tracker_pupil_id;
            }
            return p;
          });
        }
        byClass[key] = chosen;
      });
      return byClass;
    });
  }

  function buildBulkRows(teacherEmail, subject, academicYear, classes, pupilsByClass) {
    var rows = [];
    (classes || []).forEach(function(cls) {
      var pupils = pupilsByClass[classKey(cls)] || [];
      pupils.forEach(function(p) {
        var names = splitDisplayName(p.name);
        rows.push({
          subject: subject,
          year_level: 'S' + cls.year_level,
          class_code: cls.class_code,
          class_name: cls.class_name || cls.class_code,
          teacher_email: teacherEmail,
          first_name: names.first_name,
          last_name: names.last_name,
          preferred_name: '',
          external_id: p.pupil_id || ''
        });
      });
    });
    return rows;
  }

  function saveRosterPupils(options) {
    var opts = options || {};
    var teacherId = opts.teacherId;
    var teacherEmail = opts.teacherEmail;
    var subject = opts.subject;
    var academicYear = opts.academicYearLabel;
    var classes = opts.classes || [];
    var pupilsByClass = opts.pupilsByClass || {};

    return loadCache().then(function(cache) {
      classes.forEach(function(cls) {
        cache = writeCacheEntry(cache, teacherId, subject, academicYear, classKey(cls), pupilsByClass[classKey(cls)] || []);
      });
      return saveCache(cache);
    }).then(function() {
      var rows = buildBulkRows(teacherEmail, subject, academicYear, classes, pupilsByClass);
      if (!rows.length) return { saved_pupils: 0 };
      if (!window.DataService || typeof DataService.bulkUpsertPupilsAndEnrollments !== 'function') {
        return { saved_pupils: rows.length, cache_only: true };
      }
      return DataService.bulkUpsertPupilsAndEnrollments({
        rows: rows,
        academicYearLabel: academicYear,
        mode: 'replace',
        overrideConflicts: true
      }).then(function(res) {
        return {
          saved_pupils: rows.length,
          inserted_enrollments: res && res.inserted_enrollments ? res.inserted_enrollments : 0,
          updated_enrollments: res && res.updated_enrollments ? res.updated_enrollments : 0
        };
      }).catch(function(err) {
        if (String(err && err.message || '').toLowerCase().indexOf('replace') !== -1) {
          return DataService.bulkUpsertPupilsAndEnrollments({
            rows: rows,
            academicYearLabel: academicYear,
            mode: 'add_only',
            overrideConflicts: false
          }).then(function(res) {
            return {
              saved_pupils: rows.length,
              inserted_enrollments: res && res.inserted_enrollments ? res.inserted_enrollments : 0,
              fallback_add_only: true
            };
          });
        }
        throw err;
      });
    });
  }

  function pupilHasScores(S, yg, pupilId) {
    var sc = S.scores && S.scores[yg] && S.scores[yg][pupilId];
    return !!(sc && Object.keys(sc).length);
  }

  function applyRosterToTrackerState(S, classes, pupilsByClass, removeMissing) {
    var stats = {
      added: 0,
      updated: 0,
      removed: 0,
      classes: 0,
      scored_removals: [],
      details: []
    };

    (classes || []).forEach(function(cls) {
      var yg = yearGroupFromLevel(cls.year_level);
      var className = String(cls.class_name || cls.class_code || '').trim();
      var rosterPupils = (pupilsByClass[classKey(cls)] || []).filter(function(p) {
        return String(p.name || '').trim();
      });
      if (!yg || !className) return;

      if (!S.pupils[yg][className]) S.pupils[yg][className] = [];
      var trackerList = S.pupils[yg][className].slice();
      var newList = [];
      var usedIds = {};
      var detail = {
        className: className,
        yearGroup: yg,
        added: [],
        renamed: [],
        removed: [],
        scoredKept: []
      };

      rosterPupils.forEach(function(rp) {
        var name = String(rp.name || '').trim();
        var existing = null;
        if (rp.tracker_pupil_id) {
          existing = trackerList.find(function(t) { return t.id === rp.tracker_pupil_id; });
        }
        if (!existing) {
          existing = trackerList.find(function(t) {
            return normalizeName(t.name) === normalizeName(name) && !usedIds[t.id];
          });
        }
        if (existing) {
          if (existing.name !== name) {
            existing.name = name;
            stats.updated += 1;
            detail.renamed.push(name);
          }
          newList.push(existing);
          usedIds[existing.id] = true;
          rp.tracker_pupil_id = existing.id;
        } else {
          var np = { id: uid(), name: name };
          newList.push(np);
          usedIds[np.id] = true;
          rp.tracker_pupil_id = np.id;
          stats.added += 1;
          detail.added.push(name);
        }
      });

      trackerList.forEach(function(tp) {
        if (usedIds[tp.id]) return;
        if (!removeMissing) {
          newList.push(tp);
          return;
        }
        if (pupilHasScores(S, yg, tp.id)) {
          stats.scored_removals.push({ name: tp.name, className: className, yearGroup: yg });
          detail.scoredKept.push(tp.name);
          newList.push(tp);
          return;
        }
        if (S.scores[yg]) delete S.scores[yg][tp.id];
        if (S.profiles[yg]) delete S.profiles[yg][tp.id];
        stats.removed += 1;
        detail.removed.push(tp.name);
      });

      S.pupils[yg][className] = newList;
      stats.classes += 1;
      stats.details.push(detail);
    });

    return stats;
  }

  function previewPushToTracker(options) {
    var opts = options || {};
    if (!window.ClassManagementTracker) {
      return Promise.reject(new Error('Tracker module not loaded'));
    }
    return ClassManagementTracker.loadTrackerState(opts.teacherId, opts.subject).then(function(S) {
      var clone = JSON.parse(JSON.stringify(S));
      return applyRosterToTrackerState(
        clone,
        opts.classes || [],
        opts.pupilsByClass || {},
        opts.removeMissing !== false
      );
    });
  }

  function pushToTracker(options) {
    var opts = options || {};
    var teacherId = opts.teacherId;
    var subject = opts.subject;
    var classes = opts.classes || [];
    var pupilsByClass = opts.pupilsByClass || {};
    var removeMissing = opts.removeMissing !== false;

    if (!window.ClassManagementTracker) {
      return Promise.reject(new Error('Tracker module not loaded'));
    }

    return ClassManagementTracker.loadTrackerState(teacherId, subject).then(function(S) {
      var stats = applyRosterToTrackerState(S, classes, pupilsByClass, removeMissing);

      return ClassManagementTracker.saveTrackerState(teacherId, subject, S).then(function() {
        return loadCache().then(function(cache) {
          classes.forEach(function(cls) {
            cache = writeCacheEntry(
              cache,
              teacherId,
              subject,
              opts.academicYearLabel,
              classKey(cls),
              pupilsByClass[classKey(cls)] || []
            );
          });
          return saveCache(cache).then(function() { return stats; });
        });
      });
    });
  }

  function loadFromTracker(options) {
    var opts = options || {};
    var teacherId = opts.teacherId;
    var subject = opts.subject;
    var classes = opts.classes || [];
    var selectedKey = opts.selectedClassKey || '';

    if (!window.ClassManagementTracker) {
      return Promise.reject(new Error('Tracker module not loaded'));
    }

    return ClassManagementTracker.loadTrackerState(teacherId, subject).then(function(S) {
      var byClass = {};
      classes.forEach(function(cls) {
        var key = classKey(cls);
        if (selectedKey && key !== selectedKey) return;
        var yg = yearGroupFromLevel(cls.year_level);
        var className = String(cls.class_name || cls.class_code || '').trim();
        var bag = (yg && S.pupils && S.pupils[yg]) || {};
        var list = bag[className] || [];
        if (!list.length && className) {
          var want = className.toLowerCase();
          var hit = Object.keys(bag).find(function(k) {
            return String(k).trim().toLowerCase() === want;
          });
          if (hit) list = bag[hit] || [];
        }
        byClass[key] = list.map(function(p) {
          return {
            local_id: uid(),
            name: String(p.name || '').trim(),
            tracker_pupil_id: p.id
          };
        }).filter(function(p) { return p.name; });
      });
      return byClass;
    });
  }

  return {
    classKey: classKey,
    uid: uid,
    loadPupilsForTeacher: loadPupilsForTeacher,
    saveRosterPupils: saveRosterPupils,
    previewPushToTracker: previewPushToTracker,
    pushToTracker: pushToTracker,
    loadFromTracker: loadFromTracker
  };
})();
