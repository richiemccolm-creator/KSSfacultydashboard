/**
 * Class Management pupils → Drama / Art BGE tracker classes.
 * Matches roster pupils to tracker pupils (saved roster id first, then name) and works out
 * who still needs adding. Never removes anyone: a pupil missing from the roster keeps their scores.
 */
(function(root) {
  'use strict';

  var YGS = ['s1', 's2', 's3'];

  function normName(s) {
    return String(s || '')
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')   // strip accents
      .replace(/[‘’ʼ`]/g, "'")                // curly apostrophes
      .replace(/[‐-―]/g, '-')                      // dashes
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function yearGroupFor(level) {
    var n = parseInt(String(level).replace(/\D/g, ''), 10);
    return n >= 1 && n <= 3 ? 's' + n : null;
  }

  /** Display name plus every form a teacher might have typed. */
  function rosterPupil(row) {
    var first = String(row.first_name || '').trim();
    var last = String(row.last_name || '').trim();
    var pref = String(row.preferred_name || '').trim();
    var shown = ((pref || first) + ' ' + last).trim();
    var keys = {};
    [shown, first + ' ' + last, pref + ' ' + last, last + ' ' + (pref || first), last + ', ' + (pref || first), last + ', ' + first]
      .forEach(function(k) { k = normName(k); if (k && k !== ',') keys[k] = true; });
    return { rosterId: String(row.pupil_id || ''), name: shown, keys: Object.keys(keys), sortKey: normName(last + ' ' + (pref || first)) };
  }

  /** Group roster rows by tracker year group and class name (the key the class sync already uses). */
  function groupRows(rows) {
    var out = {};
    (rows || []).forEach(function(row) {
      var yg = yearGroupFor(row.year_level != null ? row.year_level : row.year_level_label);
      var cls = String(row.class_name || '').trim();
      if (!yg || !cls || !row.pupil_id) return;
      out[yg] = out[yg] || {};
      out[yg][cls] = out[yg][cls] || [];
      if (!out[yg][cls].some(function(p) { return p.rosterId === String(row.pupil_id); })) out[yg][cls].push(rosterPupil(row));
    });
    Object.keys(out).forEach(function(yg) {
      Object.keys(out[yg]).forEach(function(cls) {
        out[yg][cls].sort(function(a, b) { return a.sortKey.localeCompare(b.sortKey); }); // register order: surname
      });
    });
    return out;
  }

  /**
   * Compare one tracker class with its roster.
   * Returns { links:[{pid, rosterId}], missing:[rosterPupil] } — links are name matches to remember.
   */
  function compareClass(trackerPupils, roster) {
    var byRosterId = {}, byName = {};
    (trackerPupils || []).forEach(function(p) {
      if (p.rosterId) byRosterId[p.rosterId] = p;
      var k = normName(p.name);
      if (k && !p.rosterId) (byName[k] = byName[k] || []).push(p);
    });
    var used = {};
    var links = [], missing = [];
    (roster || []).forEach(function(rp) {
      if (byRosterId[rp.rosterId]) return;
      var match = null;
      rp.keys.some(function(k) {
        var list = byName[k] || [];
        for (var i = 0; i < list.length; i++) if (!used[list[i].id]) { match = list[i]; return true; }
        return false;
      });
      if (match) { used[match.id] = true; links.push({ pid: match.id, rosterId: rp.rosterId }); }
      else missing.push(rp);
    });
    return { links: links, missing: missing };
  }

  function ignoredIds(S, yg, cls) {
    return (S.rosterIgnored && S.rosterIgnored[yg] && S.rosterIgnored[yg][cls]) || [];
  }

  /** Roster pupils not yet in this tracker class, leaving out ones the teacher chose not to add. */
  function missing(S, grouped, yg, cls) {
    var roster = grouped && grouped[yg] && grouped[yg][cls];
    if (!roster || !S.pupils[yg] || !Object.prototype.hasOwnProperty.call(S.pupils[yg], cls)) return [];
    var skip = ignoredIds(S, yg, cls);
    return compareClass(S.pupils[yg][cls] || [], roster).missing.filter(function(rp) { return skip.indexOf(rp.rosterId) === -1; });
  }

  /** Don't suggest these roster pupils for this class again (e.g. the teacher removed them). */
  function ignore(S, yg, cls, rosterIds) {
    S.rosterIgnored = S.rosterIgnored || {};
    S.rosterIgnored[yg] = S.rosterIgnored[yg] || {};
    var list = S.rosterIgnored[yg][cls] = S.rosterIgnored[yg][cls] || [];
    (rosterIds || []).forEach(function(id) { if (id && list.indexOf(id) === -1) list.push(id); });
  }

  /**
   * Bring the tracker in line with the roster without asking where it is safe to:
   *  - remember roster ids for pupils matched by name
   *  - fill tracker classes that have no pupils yet
   * Classes that already have pupils are left for the teacher (see missing()).
   * Only classes that already exist in the tracker are touched. Returns { filled, classes, linked }.
   */
  function sync(S, grouped, uid) {
    var out = { filled: 0, classes: 0, linked: 0 };
    YGS.forEach(function(yg) {
      Object.keys((grouped && grouped[yg]) || {}).forEach(function(cls) {
        if (!S.pupils[yg] || !Object.prototype.hasOwnProperty.call(S.pupils[yg], cls)) return;
        var current = S.pupils[yg][cls] || [];
        var links = compareClass(current, grouped[yg][cls]).links;
        out.linked += applyLinks(S, links.map(function(l) { return { yg: yg, cls: cls, pid: l.pid, rosterId: l.rosterId }; }));
        if (current.length) return;
        var add = addPupils(S, yg, cls, missing(S, grouped, yg, cls), uid);
        if (add) { out.filled += add; out.classes++; }
      });
    });
    return out;
  }

  /** Add roster pupils to a tracker class. Returns how many were added. */
  function addPupils(S, yg, cls, rosterPupils, uid) {
    var list = S.pupils[yg][cls] = S.pupils[yg][cls] || [];
    var have = {};
    list.forEach(function(p) { if (p.rosterId) have[p.rosterId] = true; });
    var added = 0;
    (rosterPupils || []).forEach(function(rp) {
      if (have[rp.rosterId]) return;
      list.push({ id: uid(), name: rp.name, rosterId: rp.rosterId });
      have[rp.rosterId] = true;
      added++;
    });
    return added;
  }

  /** Remember roster ids for pupils matched by name. Returns how many changed. */
  function applyLinks(S, links) {
    var n = 0;
    (links || []).forEach(function(l) {
      var p = ((S.pupils[l.yg] || {})[l.cls] || []).filter(function(x) { return x.id === l.pid; })[0];
      if (p && p.rosterId !== l.rosterId) { p.rosterId = l.rosterId; n++; }
    });
    return n;
  }

  root.TrackerRoster = {
    normName: normName,
    groupRows: groupRows,
    compareClass: compareClass,
    missing: missing,
    ignore: ignore,
    sync: sync,
    addPupils: addPupils,
    applyLinks: applyLinks
  };
})(typeof window !== 'undefined' ? window : globalThis);
