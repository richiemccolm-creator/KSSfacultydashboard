/**
 * Tracking & Monitoring Hub — core data prep, filters, Overview, role scope.
 */
(function(global) {
  'use strict';

  var HUB = {
    sources: { drama: [], art: [] },
    pupils: [],
    pupilMap: {},
    factRows: [],
    filteredRows: [],
    filterOptions: {},
    teacherDirectory: [],
    lastSync: null,
    roleScoped: false,
    currentUserEmail: '',
    dataQuality: { flagged: [], count: 0 },
    enrichment: { moderationByUser: {}, lessonsByUser: {} },
    annotations: {}
  };

  var FILTER_STATE = {
    yearGroups: [],
    classes: [],
    teachers: [],
    subjects: [],
    trackingPeriods: [],
    riskBands: [],
    searchText: ''
  };

  var ACTIVE_VIEW = 'overview';
  var DIMS = ['creating', 'presenting', 'evaluating', 'effort', 'behaviour', 'homelearning'];
  var DIM_LABELS = ['Creating', 'Presenting', 'Evaluating', 'Effort', 'Behaviour', 'Home L.'];
  var DIM_SHORT = ['Cre', 'Pre', 'Eva', 'Eff', 'Beh', 'HL'];

  /* ── Utilities ── */

  function $(id) { return document.getElementById(id); }

  function toast(msg) {
    var el = $('th-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function() { el.classList.remove('show'); }, 2200);
  }

  function safeText(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function avg(values) {
    var nums = (values || []).filter(function(v) { return typeof v === 'number' && v > 0; });
    if (!nums.length) return null;
    return nums.reduce(function(a, b) { return a + b; }, 0) / nums.length;
  }

  function tpSort(a, b) {
    var na = Number((String(a).match(/\d+/) || [0])[0]);
    var nb = Number((String(b).match(/\d+/) || [0])[0]);
    if (na === nb) return String(a).localeCompare(String(b));
    return na - nb;
  }

  function bandFromValue(v) {
    if (v == null || v === 0) return 'unknown';
    if (v < 2.5) return 'concern';
    if (v < 3.25) return 'secure';
    return 'strong';
  }

  function bandClass(band) {
    if (band === 'concern') return 'background:var(--band-concern-bg);color:var(--band-concern-fg)';
    if (band === 'strong') return 'background:var(--band-strong-bg);color:var(--band-strong-fg)';
    if (band === 'secure') return 'background:var(--band-secure-bg);color:var(--band-secure-fg)';
    return 'background:var(--band-unknown-bg);color:var(--band-unknown-fg)';
  }

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0] || '?').slice(0, 2).toUpperCase();
  }

  function dimsForSubject(subject, hasProgressOnly) {
    if (subject === 'drama') return DIMS.slice();
    if (hasProgressOnly) return ['progress', 'effort', 'behaviour', 'homelearning'];
    return DIMS.slice();
  }

  /** Canonical dimension-based risk (CURSOR_BRIEF_TRACKING_HUB.md §1.4) */
  function getRiskForPupil(scores) {
    var avgs = {};
    DIMS.forEach(function(d) {
      var vals = [];
      Object.keys(scores || {}).forEach(function(tp) {
        var v = scores[tp] && scores[tp][d];
        if (typeof v === 'number' && v > 0) vals.push(v);
      });
      avgs[d] = vals.length ? vals.reduce(function(a, b) { return a + b; }, 0) / vals.length : null;
    });
    var lowCount = DIMS.filter(function(d) { return avgs[d] != null && avgs[d] <= 2.5; }).length;
    return {
      avgs: avgs,
      lowCount: lowCount,
      isAtRisk: lowCount >= 2,
      severity: lowCount >= 4 ? 'high' : lowCount === 3 ? 'medium' : lowCount === 2 ? 'low' : null
    };
  }

  /* ── Data normalisation ── */

  function normalizeCloudRows(rows) {
    var byIdentity = {};
    HUB.sources = { drama: [], art: [] };
    (rows || []).forEach(function(row) {
      var subject = row.data_type === 'drama-v3' ? 'drama' : row.data_type === 'art-v2' ? 'art' : null;
      if (!subject || !row.data) return;
      HUB.sources[subject].push(Object.assign({
        teacherName: row.teacherName || row.email || 'Unknown',
        teacherEmail: row.email || '',
        userId: row.user_id || ''
      }, row.data));
    });

    ['drama', 'art'].forEach(function(subject) {
      HUB.sources[subject].forEach(function(src) {
        ['s1', 's2', 's3'].forEach(function(yg) {
          var classes = src.pupils && src.pupils[yg] ? src.pupils[yg] : {};
          Object.keys(classes).forEach(function(cls) {
            (classes[cls] || []).forEach(function(p) {
              var scores = src.scores && src.scores[yg] && src.scores[yg][p.id] ? src.scores[yg][p.id] : {};
              var profile = src.profiles && src.profiles[yg] && src.profiles[yg][p.id] ? src.profiles[yg][p.id] : {};
              var identity = (String(p.name || '').trim().toLowerCase() + '|' + yg + '|' + cls).trim();
              if (!byIdentity[identity]) {
                byIdentity[identity] = {
                  key: identity,
                  name: p.name || 'Unknown',
                  yg: yg,
                  cls: cls,
                  teacher: src.teacherName || 'Unknown',
                  gender: p.gender || profile.gender || '',
                  subjects: {}
                };
              }
              var riskInfo = getRiskForPupil(scores);
              byIdentity[identity].subjects[subject] = {
                scores: scores,
                profile: profile,
                teacher: src.teacherName || 'Unknown',
                teacherEmail: src.teacherEmail || '',
                teacherUserId: src.userId || '',
                risk: riskInfo
              };
            });
          });
        });
      });
    });

    HUB.pupilMap = byIdentity;
    HUB.pupils = Object.keys(byIdentity).map(function(k) { return byIdentity[k]; })
      .sort(function(a, b) { return a.name.localeCompare(b.name); });
    HUB.factRows = buildFactRows(HUB.pupils);
    applyRoleScopeAfterNormalize();
    HUB.filterOptions = computeFilterOptions(HUB.factRows);
    HUB.filteredRows = applyFilters(HUB.factRows, FILTER_STATE);
    HUB.dataQuality = computeDataQuality(HUB.factRows);
    HUB.enrichment = global.TrackingHubEnrich
      ? global.TrackingHubEnrich.buildIndexes(rows)
      : { moderationByUser: {}, lessonsByUser: {} };
    HUB.lastSync = new Date();

    updateHeaderSync();
    updateDataQualityUi();
  }

  function buildFactRows(pupils) {
    var out = [];
    pupils.forEach(function(pupil) {
      ['drama', 'art'].forEach(function(subject) {
        var entry = pupil.subjects[subject];
        if (!entry) return;
        var tpKeys = Object.keys(entry.scores || {}).sort(tpSort);
        var hasProgressOnly = tpKeys.some(function(tp) { return entry.scores[tp] && entry.scores[tp].progress > 0; });
        var dims = dimsForSubject(subject, hasProgressOnly);
        var riskBand = entry.risk && entry.risk.severity ? entry.risk.severity : 'none';
        tpKeys.forEach(function(tp) {
          var row = entry.scores[tp] || {};
          var scoreAvg = avg(dims.map(function(d) { return row[d]; }));
          out.push({
            pupilKey: pupil.key,
            name: pupil.name,
            yg: pupil.yg,
            cls: pupil.cls,
            teacher: entry.teacher || pupil.teacher,
            teacherEmail: entry.teacherEmail || '',
            teacherUserId: entry.teacherUserId || '',
            gender: pupil.gender || '',
            subject: subject,
            tp: tp,
            scoreAvg: scoreAvg,
            creating: row.creating || null,
            presenting: row.presenting || null,
            evaluating: row.evaluating || null,
            progress: row.progress || null,
            effort: row.effort || null,
            behaviour: row.behaviour || null,
            homelearning: row.homelearning || null,
            riskBand: riskBand,
            lowCount: entry.risk ? entry.risk.lowCount : 0,
            isAtRisk: entry.risk ? entry.risk.isAtRisk : false,
            attainmentBand: bandFromValue(scoreAvg)
          });
        });
      });
    });
    return out;
  }

  function computeFilterOptions(rows) {
    function uniq(key, sorter) {
      var values = Array.from(new Set(rows.map(function(r) { return r[key] || ''; }).filter(Boolean)));
      values.sort(sorter || function(a, b) { return String(a).localeCompare(String(b)); });
      return values;
    }
    return {
      yearGroups: uniq('yg'),
      classes: uniq('cls'),
      teachers: uniq('teacher'),
      subjects: uniq('subject'),
      trackingPeriods: uniq('tp', tpSort),
      riskBands: ['high', 'medium', 'low']
    };
  }

  /* ── Role scope + data quality ── */

  function isRoleScopedUser() {
    if (global.__authGuardIsAdmin || global.__authGuardIsFacultyHead) return false;
    var role = String(global.__authGuardRole || '').toLowerCase();
    return role === 'teacher';
  }

  function getSessionEmail() {
    return new Promise(function(resolve) {
      if (!global.supabase || !global.supabase.auth) { resolve(''); return; }
      global.supabase.auth.getSession().then(function(r) {
        var email = (((r.data || {}).session || {}).user || {}).email || '';
        resolve(String(email).trim());
      }).catch(function() { resolve(''); });
    });
  }

  function resolveRoleScope() {
    return getSessionEmail().then(function(email) {
      HUB.currentUserEmail = email;
      HUB.roleScoped = isRoleScopedUser();
      updateScopeUi();
      if (global.TrackingHubPrefs) global.TrackingHubPrefs.refreshPresetSelect();
      if (global.TrackingHubTargets) global.TrackingHubTargets.refreshStorage();
      return HUB.roleScoped;
    });
  }

  function applyRoleScopeAfterNormalize() {
    if (!HUB.roleScoped || !HUB.currentUserEmail) return;
    var email = HUB.currentUserEmail.toLowerCase();
    HUB.factRows = HUB.factRows.filter(function(r) {
      return (r.teacherEmail || '').toLowerCase() === email;
    });
    var keys = new Set(HUB.factRows.map(function(r) { return r.pupilKey; }));
    var nextMap = {};
    keys.forEach(function(k) {
      if (HUB.pupilMap[k]) nextMap[k] = HUB.pupilMap[k];
    });
    HUB.pupilMap = nextMap;
    HUB.pupils = Object.keys(nextMap).map(function(k) { return nextMap[k]; })
      .sort(function(a, b) { return a.name.localeCompare(b.name); });
  }

  function updateScopeUi() {
    var banner = $('th-scope-banner');
    if (banner) {
      banner.classList.toggle('is-hidden', !HUB.roleScoped);
      if (HUB.roleScoped) {
        banner.textContent = 'Showing your classes only · ' + (HUB.currentUserEmail || 'signed-in teacher');
      }
    }
    var morePivot = $('th-more-pivot');
    var moreViews = document.querySelector('.th-more-views');
    if (morePivot) morePivot.style.display = HUB.roleScoped ? 'none' : '';
    if (moreViews && HUB.roleScoped) moreViews.removeAttribute('open');
    var teacherFilter = $('flt-teachers');
    if (teacherFilter) {
      teacherFilter.disabled = HUB.roleScoped;
      if (HUB.roleScoped) teacherFilter.title = 'Locked to your classes';
    }
  }

  function computeDataQuality(rows) {
    var byClass = {};
    (rows || []).forEach(function(r) {
      var key = r.cls + '|' + r.yg + '|' + r.subject + '|' + r.teacher;
      if (!byClass[key]) {
        byClass[key] = {
          label: r.yg.toUpperCase() + ' ' + r.cls + ' · ' + r.subject,
          total: 0,
          scored: 0
        };
      }
      byClass[key].total++;
      if (r.scoreAvg != null) byClass[key].scored++;
    });
    var flagged = [];
    Object.keys(byClass).forEach(function(k) {
      var c = byClass[k];
      var missingPct = c.total ? ((c.total - c.scored) / c.total) * 100 : 0;
      if (missingPct > 10) flagged.push({ label: c.label, missingPct: Math.round(missingPct) });
    });
    flagged.sort(function(a, b) { return b.missingPct - a.missingPct; });
    return { flagged: flagged, count: flagged.length };
  }

  function updateDataQualityUi() {
    var el = $('th-data-quality');
    if (!el) return;
    var dq = HUB.dataQuality || { flagged: [], count: 0 };
    if (!HUB.lastSync) {
      el.className = 'th-data-quality';
      el.textContent = '';
      return;
    }
    if (!dq.count) {
      el.className = 'th-data-quality is-ok';
      el.innerHTML = '<i class="ti ti-circle-check" aria-hidden="true"></i> Data complete';
      el.title = 'All classes have at least 90% score coverage';
      return;
    }
    el.className = 'th-data-quality is-warn';
    el.innerHTML = '<i class="ti ti-alert-circle" aria-hidden="true"></i> ' + dq.count + ' class' + (dq.count === 1 ? '' : 'es') + ' with gaps';
    el.title = dq.flagged.slice(0, 6).map(function(f) {
      return f.label + ' (' + f.missingPct + '% missing)';
    }).join('\n');
  }

  /* ── Filters ── */

  function readMulti(id) {
    var sel = $(id);
    if (!sel) return [];
    return Array.prototype.filter.call(sel.options, function(o) { return o.selected; })
      .map(function(o) { return o.value; });
  }

  function setMulti(id, options, selected) {
    var sel = $(id);
    if (!sel) return;
    var selectedSet = new Set(selected || []);
    sel.innerHTML = (options || []).map(function(v) {
      var label = v.toUpperCase ? String(v).toUpperCase() : v;
      return '<option value="' + safeText(v) + '"' + (selectedSet.has(v) ? ' selected' : '') + '>' + safeText(label) + '</option>';
    }).join('');
  }

  function setSingle(id, options, selected, placeholder) {
    var sel = $(id);
    if (!sel) return;
    var selectedValue = (selected && selected.length === 1) ? selected[0] : '';
    sel.innerHTML = '<option value="">' + safeText(placeholder || 'All') + '</option>' +
      (options || []).map(function(v) {
        var label = v.toUpperCase ? String(v).toUpperCase() : v;
        return '<option value="' + safeText(v) + '">' + safeText(label) + '</option>';
      }).join('');
    sel.value = selectedValue || '';
  }

  function syncQuickControlsFromState() {
    var mapping = [
      ['flt-quick-year', FILTER_STATE.yearGroups],
      ['flt-quick-class', FILTER_STATE.classes],
      ['flt-quick-tp', FILTER_STATE.trackingPeriods],
      ['flt-quick-risk', FILTER_STATE.riskBands]
    ];
    mapping.forEach(function(m) {
      var el = $(m[0]);
      if (!el) return;
      el.value = (m[1] && m[1].length === 1) ? m[1][0] : '';
    });
    var q = $('flt-quick-search');
    if (q) q.value = FILTER_STATE.searchText || '';
    syncSubjectPills();
  }

  function syncSubjectPills() {
    var pills = document.querySelectorAll('.th-pill[data-subject]');
    var subs = FILTER_STATE.subjects || [];
    pills.forEach(function(pill) {
      var val = pill.getAttribute('data-subject');
      pill.classList.remove('active-all', 'active-art', 'active-drama');
      if (!subs.length && val === 'all') {
        pill.classList.add('active-all');
      } else if (subs.length === 1 && subs[0] === val) {
        pill.classList.add(val === 'art' ? 'active-art' : 'active-drama');
      }
    });
  }

  function selectOnlyValue(id, value) {
    var sel = $(id);
    if (!sel) return;
    var any = false;
    Array.prototype.forEach.call(sel.options, function(opt) {
      var matched = !!value && opt.value === value;
      opt.selected = matched;
      if (matched) any = true;
    });
    if (!value || !any) {
      Array.prototype.forEach.call(sel.options, function(opt) { opt.selected = false; });
    }
  }

  function applyQuickFilters() {
    selectOnlyValue('flt-yearGroups', ($('flt-quick-year') || {}).value || '');
    selectOnlyValue('flt-classes', ($('flt-quick-class') || {}).value || '');
    selectOnlyValue('flt-trackingPeriods', ($('flt-quick-tp') || {}).value || '');
    selectOnlyValue('flt-riskBands', ($('flt-quick-risk') || {}).value || '');
    var hidden = $('flt-searchText');
    var quick = $('flt-quick-search');
    if (hidden && quick) hidden.value = quick.value;
    applyFilterControls();
  }

  function applyFilterControls() {
    FILTER_STATE.yearGroups = readMulti('flt-yearGroups');
    FILTER_STATE.classes = readMulti('flt-classes');
    FILTER_STATE.teachers = readMulti('flt-teachers');
    FILTER_STATE.subjects = readMulti('flt-subjects');
    FILTER_STATE.trackingPeriods = readMulti('flt-trackingPeriods');
    FILTER_STATE.riskBands = readMulti('flt-riskBands');
    FILTER_STATE.searchText = (($('flt-searchText') || {}).value || '').trim().toLowerCase();
    syncQuickControlsFromState();
    recalcFilteredState();
  }

  function resetFilters() {
    FILTER_STATE = {
      yearGroups: [], classes: [], teachers: [], subjects: [],
      trackingPeriods: [], riskBands: [], searchText: ''
    };
    hydrateFilterControls();
    recalcFilteredState();
  }

  function setSubjectFilter(subject) {
    var sel = $('flt-subjects');
    if (!sel) return;
    Array.prototype.forEach.call(sel.options, function(opt) { opt.selected = false; });
    if (subject && subject !== 'all') {
      Array.prototype.forEach.call(sel.options, function(opt) {
        if (opt.value === subject) opt.selected = true;
      });
      FILTER_STATE.subjects = [subject];
    } else {
      FILTER_STATE.subjects = [];
    }
    syncSubjectPills();
    recalcFilteredState();
  }

  function hydrateFilterControls() {
    var opts = HUB.filterOptions;
    setMulti('flt-yearGroups', opts.yearGroups, FILTER_STATE.yearGroups);
    setMulti('flt-classes', opts.classes, FILTER_STATE.classes);
    setMulti('flt-teachers', opts.teachers, FILTER_STATE.teachers);
    setMulti('flt-subjects', opts.subjects, FILTER_STATE.subjects);
    setMulti('flt-trackingPeriods', opts.trackingPeriods, FILTER_STATE.trackingPeriods);
    setMulti('flt-riskBands', opts.riskBands, FILTER_STATE.riskBands);
    setSingle('flt-quick-year', opts.yearGroups, FILTER_STATE.yearGroups, 'All years');
    setSingle('flt-quick-class', opts.classes, FILTER_STATE.classes, 'All classes');
    setSingle('flt-quick-tp', opts.trackingPeriods, FILTER_STATE.trackingPeriods, 'All TPs');
    setSingle('flt-quick-risk', opts.riskBands, FILTER_STATE.riskBands, 'All risk');
    var hidden = $('flt-searchText');
    if (hidden) hidden.value = FILTER_STATE.searchText || '';
    syncQuickControlsFromState();
  }

  function applyFilters(rows, state) {
    function allow(selected, value) {
      if (!selected || !selected.length) return true;
      return selected.indexOf(value) >= 0;
    }
    return (rows || []).filter(function(r) {
      var searchable = (r.name + ' ' + r.cls + ' ' + r.teacher + ' ' + r.subject + ' ' + r.tp).toLowerCase();
      var riskMatch = true;
      if (state.riskBands && state.riskBands.length) {
        riskMatch = state.riskBands.indexOf(r.riskBand) >= 0;
      }
      return allow(state.yearGroups, r.yg) &&
        allow(state.classes, r.cls) &&
        allow(state.teachers, r.teacher) &&
        allow(state.subjects, r.subject) &&
        allow(state.trackingPeriods, r.tp) &&
        riskMatch &&
        (!state.searchText || searchable.indexOf(state.searchText) >= 0);
    });
  }

  function renderActiveFilterChips() {
    var chips = $('th-filter-chips');
    if (!chips) return;
    var groups = [
      ['Year', FILTER_STATE.yearGroups],
      ['Class', FILTER_STATE.classes],
      ['Teacher', FILTER_STATE.teachers],
      ['Subject', FILTER_STATE.subjects],
      ['TP', FILTER_STATE.trackingPeriods],
      ['Risk', FILTER_STATE.riskBands]
    ];
    var html = [];
    groups.forEach(function(g) {
      if (g[1] && g[1].length) {
        html.push('<span class="th-chip">' + g[0] + ': ' + g[1].map(safeText).join(', ') + '</span>');
      }
    });
    if (FILTER_STATE.searchText) {
      html.push('<span class="th-chip">Search: ' + safeText(FILTER_STATE.searchText) + '</span>');
    }
    chips.innerHTML = html.join('');
    chips.classList.toggle('is-hidden', !html.length);
  }

  function renderAllViews() {
    if (ACTIVE_VIEW === 'overview') {
      renderOverview();
    } else if (global.TrackingHubTabs) {
      global.TrackingHubTabs.renderAll();
    }
  }

  function recalcFilteredState() {
    HUB.filteredRows = applyFilters(HUB.factRows, FILTER_STATE);
    var chip = $('th-filtered-count');
    if (chip) chip.textContent = HUB.filteredRows.length + ' rows';
    renderActiveFilterChips();
    HUB.dataQuality = computeDataQuality(HUB.filteredRows);
    updateDataQualityUi();
    renderAllViews();
    updateHeaderSync();
    if (global.TrackingHubPrefs) global.TrackingHubPrefs.syncToUrl();
    if (global.TrackingHubSnapshot) global.TrackingHubSnapshot.onDataRefresh();
  }

  function getTargetScore(yg, cls, subject) {
    if (global.TrackingHubTargets) {
      return global.TrackingHubTargets.getClassTarget(yg, cls, subject);
    }
    return 3;
  }

  function updateHeaderSync() {
    var status = $('th-source-status');
    if (!status) return;
    if (!HUB.lastSync) {
      status.textContent = 'No cloud data loaded yet';
      return;
    }
    var mins = Math.max(0, Math.round((Date.now() - HUB.lastSync.getTime()) / 60000));
    var syncText = mins < 1 ? 'just now' : mins + ' min ago';
    var session = global.TrackingHubSnapshot
      ? global.TrackingHubSnapshot.currentSessionLabel() : '';
    status.textContent = HUB.pupils.length + ' pupils · ' +
      (session ? session + ' · ' : '') + 'sync ' + syncText;
  }

  /* ── Pupil rollup (canonical risk) ── */

  function buildPupilRollup(rows) {
    var map = {};
    rows.forEach(function(r) {
      var pk = r.pupilKey + '|' + r.subject;
      if (!map[pk]) {
        var pupil = HUB.pupilMap[r.pupilKey];
        var entry = pupil && pupil.subjects[r.subject];
        var risk = entry && entry.risk ? entry.risk : { lowCount: 0, severity: null, isAtRisk: false, avgs: {} };
        map[pk] = {
          pupilKey: r.pupilKey,
          subject: r.subject,
          name: r.name,
          yg: r.yg,
          cls: r.cls,
          teacher: r.teacher,
          risk: risk,
          scoreAvg: null
        };
      }
      if (r.scoreAvg != null) {
        map[pk].scoreAvg = map[pk].scoreAvg == null ? r.scoreAvg : (map[pk].scoreAvg + r.scoreAvg) / 2;
      }
    });
    return Object.keys(map).map(function(k) { return map[k]; })
      .filter(function(p) { return p.risk.isAtRisk; })
      .sort(function(a, b) {
        return (b.risk.lowCount - a.risk.lowCount) ||
          (a.scoreAvg || 99) - (b.scoreAvg || 99) ||
          a.name.localeCompare(b.name);
      });
  }

  function computeOverviewKpis(rows) {
    var pupilKeys = new Set(rows.map(function(r) { return r.pupilKey; }));
    var artPupils = new Set();
    var dramaPupils = new Set();
    var dualPupils = new Set();
    var atRiskPupils = new Set();
    var highCount = 0;
    var medCount = 0;
    var lowCount = 0;
    var secureCount = 0;

    pupilKeys.forEach(function(pk) {
      var subset = rows.filter(function(r) { return r.pupilKey === pk; });
      var subjects = new Set(subset.map(function(r) { return r.subject; }));
      if (subjects.has('art')) artPupils.add(pk);
      if (subjects.has('drama')) dramaPupils.add(pk);
      if (subjects.has('art') && subjects.has('drama')) dualPupils.add(pk);
    });

    var seenRisk = {};
    rows.forEach(function(r) {
      var key = r.pupilKey + '|' + r.subject;
      if (seenRisk[key]) return;
      seenRisk[key] = true;
      if (r.isAtRisk) atRiskPupils.add(key);
      if (r.riskBand === 'high') highCount++;
      else if (r.riskBand === 'medium') medCount++;
      else if (r.riskBand === 'low') lowCount++;
      else secureCount++;
    });

    var avgScore = avg(rows.map(function(r) { return r.scoreAvg; }));
    var scored = rows.filter(function(r) { return r.scoreAvg != null; }).length;
    var coveragePct = rows.length ? Math.round((scored / rows.length) * 100) : 0;

    var tps = Array.from(new Set(rows.map(function(r) { return r.tp; }))).sort(tpSort);
    var trendDelta = null;
    var trendLabel = '';
    if (tps.length >= 2) {
      var latest = tps[tps.length - 1];
      var prev = tps[tps.length - 2];
      var latestAvg = avg(rows.filter(function(r) { return r.tp === latest; }).map(function(r) { return r.scoreAvg; }));
      var prevAvg = avg(rows.filter(function(r) { return r.tp === prev; }).map(function(r) { return r.scoreAvg; }));
      if (latestAvg != null && prevAvg != null) {
        trendDelta = latestAvg - prevAvg;
        trendLabel = String(prev).toUpperCase();
      }
    }

    var target = global.TrackingHubTargets ? global.TrackingHubTargets.getFacultyTarget() : 3;
    var aboveTargetPct = global.TrackingHubGrades
      ? global.TrackingHubGrades.pctAboveTarget(rows, target) : null;

    return {
      pupils: pupilKeys.size,
      artPupils: artPupils.size,
      dramaPupils: dramaPupils.size,
      dualPupils: dualPupils.size,
      atRisk: atRiskPupils.size,
      highCount: highCount,
      medCount: medCount,
      lowCount: lowCount,
      secureCount: secureCount,
      avgScore: avgScore,
      coveragePct: coveragePct,
      missingScores: rows.length - scored,
      aboveTargetPct: aboveTargetPct,
      trendDelta: trendDelta,
      trendLabel: trendLabel
    };
  }

  /* ── Overview rendering ── */

  function renderOverview() {
    if (ACTIVE_VIEW !== 'overview') return;
    var rows = HUB.filteredRows;
    renderOverviewKpis(rows);
    renderOverviewCharts(rows);
    renderOverviewAttention(rows);
    renderOverviewTeachers(rows);
  }

  function renderOverviewKpis(rows) {
    var slot = $('th-kpi-grid');
    if (!slot) return;
    var k = computeOverviewKpis(rows);
    var artFlex = k.artPupils || 1;
    var dramaFlex = k.dramaPupils || 1;
    var dualFlex = k.dualPupils || 0;
    var trendHtml = '';
    if (k.trendDelta != null) {
      var up = k.trendDelta >= 0;
      trendHtml = '<div class="th-kpi-trend ' + (up ? 'up' : 'down') + '">' +
        '<i class="ti ti-trending-' + (up ? 'up' : 'down') + '" aria-hidden="true"></i>' +
        (up ? '+' : '') + k.trendDelta.toFixed(2) + ' vs ' + safeText(k.trendLabel) +
        '</div>';
    }

    slot.innerHTML =
      '<div class="th-kpi-card th-kpi-clickable" data-kpi="pupils" tabindex="0" role="button">' +
        '<div class="th-kpi-head"><span class="th-kpi-label">Pupils</span><i class="ti ti-users th-kpi-icon" aria-hidden="true"></i></div>' +
        '<div class="th-kpi-value">' + k.pupils + '</div>' +
        '<div class="th-kpi-bar">' +
          '<span class="th-kpi-bar-seg" style="flex:' + artFlex + ';background:#c0622a"></span>' +
          '<span class="th-kpi-bar-seg" style="flex:' + dramaFlex + ';background:#4a7fd4"></span>' +
          (dualFlex ? '<span class="th-kpi-bar-seg" style="flex:' + dualFlex + ';background:#8b5cf6"></span>' : '') +
        '</div>' +
        '<div class="th-kpi-sub">' + k.artPupils + ' art · ' + k.dramaPupils + ' drama' +
          (k.dualPupils ? ' · ' + k.dualPupils + ' dual' : '') + '</div>' +
      '</div>' +
      '<div class="th-kpi-card accent-risk th-kpi-clickable" data-kpi="at-risk" tabindex="0" role="button">' +
        '<div class="th-kpi-head"><span class="th-kpi-label risk">At risk</span><i class="ti ti-alert-triangle th-kpi-icon risk" aria-hidden="true"></i></div>' +
        '<div class="th-kpi-value" style="color:var(--sev-high-fg)">' + k.atRisk + '</div>' +
        '<div class="th-kpi-badges">' +
          '<span class="th-badge th-badge-high">' + k.highCount + ' high</span>' +
          '<span class="th-badge th-badge-med">' + k.medCount + ' med</span>' +
          (k.lowCount ? '<span class="th-badge th-badge-low">' + k.lowCount + ' low</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="th-kpi-card">' +
        '<div class="th-kpi-head"><span class="th-kpi-label">Average score</span><i class="ti ti-chart-bar th-kpi-icon" aria-hidden="true"></i></div>' +
        '<div class="th-kpi-value">' + (k.avgScore != null ? k.avgScore.toFixed(2) : '—') + '<small> / 4</small></div>' +
        trendHtml +
      '</div>' +
      '<div class="th-kpi-card">' +
        '<div class="th-kpi-head"><span class="th-kpi-label">Coverage</span><i class="ti ti-circle-check th-kpi-icon" aria-hidden="true"></i></div>' +
        '<div class="th-kpi-value">' + k.coveragePct + '<small>%</small></div>' +
        '<div class="th-kpi-bar-track"><div class="th-kpi-bar-fill" style="width:' + k.coveragePct + '%"></div></div>' +
        '<div class="th-kpi-sub">' + k.missingScores + ' rows without score' +
          (k.aboveTargetPct != null ? ' · ' + k.aboveTargetPct + '% at/above target' : '') +
        '</div>' +
      '</div>';
  }

  function renderOverviewCharts(rows) {
    if (!global.TrackingHubCharts) return;
    global.TrackingHubCharts.destroyAll();

    var grouped = { drama: {}, art: {} };
    rows.forEach(function(r) {
      if (!grouped[r.subject][r.tp]) grouped[r.subject][r.tp] = [];
      grouped[r.subject][r.tp].push(r.scoreAvg);
    });
    function series(subject) {
      return Object.keys(grouped[subject]).sort(tpSort).map(function(tp) {
        return { tp: tp, value: avg(grouped[subject][tp]) };
      });
    }
    var dramaSeries = series('drama');
    var artSeries = series('art');
    var labels = Array.from(new Set(
      dramaSeries.concat(artSeries).map(function(p) { return p.tp; })
    )).sort(tpSort);

    var lineWrap = $('chart-score-trend-wrap');
    var lineCanvas = $('chart-score-trend');
    var lineEmpty = $('chart-score-trend-empty');
    if (lineCanvas && labels.length) {
      if (lineEmpty) lineEmpty.style.display = 'none';
      if (lineCanvas) lineCanvas.style.display = 'block';
      var artData = labels.map(function(tp) {
        var pt = artSeries.find(function(p) { return p.tp === tp; });
        return pt ? pt.value : null;
      });
      var dramaData = labels.map(function(tp) {
        var pt = dramaSeries.find(function(p) { return p.tp === tp; });
        return pt ? pt.value : null;
      });
      var facultyTarget = global.TrackingHubTargets
        ? global.TrackingHubTargets.getFacultyTarget() : 3;
      global.TrackingHubCharts.renderScoreTrend(
        lineCanvas,
        labels.map(function(tp) { return String(tp).toUpperCase(); }),
        artData,
        dramaData,
        function(subject, tp) {
          setSubjectFilter(subject);
          selectOnlyValue('flt-trackingPeriods', tp);
          FILTER_STATE.trackingPeriods = [tp];
          syncQuickControlsFromState();
          recalcFilteredState();
          toast('Filtered to ' + subject + ' · ' + String(tp).toUpperCase());
        },
        facultyTarget
      );
      if (global.TrackingHubA11y) {
        global.TrackingHubA11y.scoreTrendTable(
          labels.map(function(tp) { return String(tp).toUpperCase(); }),
          artData,
          dramaData
        );
      }
    } else if (lineWrap) {
      if (lineCanvas) lineCanvas.style.display = 'none';
      if (lineEmpty) {
        lineEmpty.style.display = 'block';
        lineEmpty.textContent = 'No tracking points for current filters.';
      }
    }

    var artDimAvgs = DIMS.map(function(d) { return avg(rows.filter(function(r) { return r.subject === 'art'; }).map(function(r) { return r[d]; })); });
    var dramaDimAvgs = DIMS.map(function(d) { return avg(rows.filter(function(r) { return r.subject === 'drama'; }).map(function(r) { return r[d]; })); });
    var radarCanvas = $('chart-dimension-radar');
    if (radarCanvas) {
      global.TrackingHubCharts.renderDimensionRadar(radarCanvas, DIM_SHORT, artDimAvgs, dramaDimAvgs, true);
      if (global.TrackingHubA11y) {
        global.TrackingHubA11y.radarTable(DIM_SHORT, artDimAvgs, dramaDimAvgs);
      }
    }

    var riskCounts = { high: 0, medium: 0, low: 0, secure: 0 };
    var seen = {};
    rows.forEach(function(r) {
      var key = r.pupilKey + '|' + r.subject;
      if (seen[key]) return;
      seen[key] = true;
      if (r.riskBand === 'high') riskCounts.high++;
      else if (r.riskBand === 'medium') riskCounts.medium++;
      else if (r.riskBand === 'low') riskCounts.low++;
      else riskCounts.secure++;
    });
    var donutCanvas = $('chart-risk-donut');
    var donutSegments = [
      { key: 'high', label: 'High', count: riskCounts.high, color: '#ef4444' },
      { key: 'medium', label: 'Medium', count: riskCounts.medium, color: '#f59e0b' },
      { key: 'low', label: 'Low', count: riskCounts.low, color: '#fbbf24' },
      { key: 'secure', label: 'Secure', count: riskCounts.secure, color: '#22c55e' }
    ];
    if (donutCanvas) {
      global.TrackingHubCharts.renderRiskDonut(donutCanvas, donutSegments, function(band) {
        if (band === 'secure') {
          FILTER_STATE.riskBands = [];
        } else {
          FILTER_STATE.riskBands = [band];
        }
        hydrateFilterControls();
        recalcFilteredState();
        toast('Filtered to ' + band + ' risk');
      }, true);
      if (global.TrackingHubA11y) global.TrackingHubA11y.donutTable(donutSegments);
    }
  }

  function renderOverviewAttention(rows) {
    var slot = $('th-attention-grid');
    var countEl = $('th-attention-count');
    if (!slot) return;
    var rollup = buildPupilRollup(rows);
    if (countEl) countEl.textContent = 'View all ' + rollup.length;
    if (!rollup.length) {
      slot.innerHTML = '<div class="th-empty">No at-risk pupils for current filters.</div>';
      return;
    }
    slot.innerHTML = rollup.slice(0, 4).map(function(p) {
      var sev = p.risk.severity || 'low';
      var avatarClass = p.subject === 'art' ? 'art' : 'drama';
      var dimCells = DIMS.map(function(d) {
        var v = p.risk.avgs[d];
        var band = bandFromValue(v);
        var display = v != null ? v.toFixed(1) : '—';
        return '<span class="th-dim-cell" style="' + bandClass(band) + '">' + display + '</span>';
      }).join('');
      var flagHtml = global.TrackingHubNotes && global.TrackingHubNotes.hasOpenFlag(p.pupilKey, p.subject)
        ? ' <i class="ti ti-flag-filled th-flag-icon" title="Open hub flag" aria-label="Open concern flag"></i>' : '';
      return '<div class="th-attention-card sev-' + sev + '" data-pupil="' + safeText(p.pupilKey) + '" data-subject="' + safeText(p.subject) + '" tabindex="0" role="button" aria-label="Open profile for ' + safeText(p.name) + '">' +
        '<div class="th-attention-pupil">' +
          '<span class="th-avatar ' + avatarClass + '">' + safeText(initials(p.name)) + '</span>' +
          '<div><div class="th-pupil-name">' + safeText(p.name) + flagHtml + '</div>' +
          '<div class="th-pupil-meta">' + safeText(p.yg.toUpperCase()) + ' · ' + safeText(p.cls) + ' · ' + safeText(p.subject) + '</div></div>' +
        '</div>' +
        '<div class="th-dim-strip">' + dimCells + '</div>' +
      '</div>';
    }).join('');
  }

  function renderOverviewTeachers(rows) {
    var body = $('th-teacher-table-body');
    if (!body) return;
    var q = (($('th-teacher-search') || {}).value || '').trim().toLowerCase();
    var byTeacher = {};
    rows.forEach(function(r) {
      var key = r.teacher || 'Unknown';
      if (!byTeacher[key]) {
        byTeacher[key] = {
          teacher: key,
          subjects: new Set(),
          classes: new Set(),
          pupils: new Set(),
          atRisk: new Set(),
          scoreSum: 0,
          scored: 0,
          scoreRows: 0,
          tpCoverage: {}
        };
      }
      var t = byTeacher[key];
      t.subjects.add(r.subject);
      t.classes.add(r.cls);
      t.pupils.add(r.pupilKey);
      if (r.isAtRisk) t.atRisk.add(r.pupilKey + '|' + r.subject);
      t.scoreRows++;
      if (r.scoreAvg != null) { t.scored++; t.scoreSum += r.scoreAvg; }
      if (!t.tpCoverage[r.tp]) t.tpCoverage[r.tp] = { total: 0, scored: 0 };
      t.tpCoverage[r.tp].total++;
      if (r.scoreAvg != null) t.tpCoverage[r.tp].scored++;
    });

    (HUB.teacherDirectory || []).forEach(function(entry) {
      var key = String(entry.display_name || entry.email || '').trim();
      if (key && !byTeacher[key]) {
        byTeacher[key] = {
          teacher: key, email: entry.email || '',
          subjects: new Set(), classes: new Set(), pupils: new Set(),
          atRisk: new Set(), scoreSum: 0, scored: 0, scoreRows: 0, tpCoverage: {}
        };
      }
    });

    var list = Object.keys(byTeacher).map(function(k) {
      var t = byTeacher[k];
      var subs = Array.from(t.subjects);
      var avgScore = t.scored ? t.scoreSum / t.scored : null;
      var tps = Object.keys(t.tpCoverage).sort(tpSort);
      return {
        teacher: t.teacher,
        email: t.email || '',
        subjects: subs,
        classes: t.classes.size,
        pupils: t.pupils.size,
        atRisk: t.atRisk.size,
        avgScore: avgScore,
        coverage: t.scoreRows ? Math.round((t.scored / t.scoreRows) * 100) : 0,
        tpCoverage: tps.map(function(tp) {
          var c = t.tpCoverage[tp];
          var pct = c.total ? c.scored / c.total : 0;
          return pct >= 0.8 ? 'full' : pct > 0 ? 'partial' : 'empty';
        })
      };
    }).filter(function(t) {
      return !q || t.teacher.toLowerCase().indexOf(q) >= 0;
    }).sort(function(a, b) {
      return (b.pupils - a.pupils) || a.teacher.localeCompare(b.teacher);
    }).slice(0, 5);

    if (!list.length) {
      body.innerHTML = '<tr><td colspan="7" class="th-muted">No teacher rows for current filters.</td></tr>';
      return;
    }

    body.innerHTML = list.map(function(t) {
      var primarySub = t.subjects.length > 1 ? 'both' : (t.subjects[0] === 'art' ? 'art' : 'drama');
      var avatarClass = primarySub === 'both' ? 'both' : primarySub;
      var subChips = t.subjects.length
        ? t.subjects.map(function(s) {
            return '<span class="th-subject-chip ' + s + '">' + safeText(s.charAt(0).toUpperCase() + s.slice(1)) + '</span>';
          }).join(' ')
        : '<span class="th-muted">—</span>';
      var atRiskClass = t.atRisk >= 6 ? 'th-badge-high' : t.atRisk >= 3 ? 'th-badge-med' : 'th-badge-low';
      var barPct = t.avgScore != null ? Math.round(((t.avgScore - 1) / 3) * 100) : 0;
      var covSquares = t.tpCoverage.length
        ? t.tpCoverage.map(function(state) {
            return '<span class="th-coverage-sq ' + (state === 'full' ? 'full' : state === 'partial' ? 'partial' : '') + '"></span>';
          }).join('')
        : '<span class="th-muted">—</span>';
      return '<tr>' +
        '<td><div class="th-teacher-cell">' +
          '<span class="th-teacher-avatar ' + avatarClass + '">' + safeText(initials(t.teacher)) + '</span>' +
          '<div><div style="font-weight:500">' + safeText(t.teacher) + '</div>' +
          (t.email ? '<div class="th-teacher-email">' + safeText(t.email) + '</div>' : '') +
        '</div></td>' +
        '<td>' + subChips + '</td>' +
        '<td style="text-align:center">' + t.classes + '</td>' +
        '<td style="text-align:center">' + t.pupils + '</td>' +
        '<td><div class="th-score-bar-wrap">' +
          '<div class="th-score-bar"><div class="th-score-bar-fill" style="width:' + barPct + '%"></div></div>' +
          '<span style="font-weight:500">' + (t.avgScore != null ? t.avgScore.toFixed(2) : '—') + '</span>' +
        '</div></td>' +
        '<td style="text-align:center"><span class="th-badge ' + atRiskClass + '">' + t.atRisk + '</span></td>' +
        '<td><div class="th-coverage-strip">' + covSquares + '</div></td>' +
      '</tr>';
    }).join('');
  }

  function exportOverviewCsv() {
    var rows = HUB.filteredRows || [];
    var headers = ['pupil', 'year_group', 'class', 'teacher', 'subject', 'tracking_period', 'score_avg', 'risk_band', 'low_dimensions', 'attainment_band'];
    var csv = [headers.join(',')].concat(rows.map(function(r) {
      var vals = [r.name, r.yg, r.cls, r.teacher, r.subject, r.tp, r.scoreAvg, r.riskBand, r.lowCount, r.attainmentBand];
      return vals.map(function(v) {
        var txt = String(v == null ? '' : v).replace(/"/g, '""');
        return '"' + txt + '"';
      }).join(',');
    })).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tracking-overview-export.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    toast('Exported ' + rows.length + ' rows');
  }

  /* ── Cloud load ── */

  function rowsFromStaffWork(staffRows) {
    var out = [];
    (staffRows || []).forEach(function(item) {
      var teacherName = item.teacherName || item.display_name || item.email || 'Unknown';
      var email = item.email || '';
      if (item.drama) out.push({ user_id: item.user_id, email: email, teacherName: teacherName, data_type: 'drama-v3', data: item.drama });
      if (item.art) out.push({ user_id: item.user_id, email: email, teacherName: teacherName, data_type: 'art-v2', data: item.art });
    });
    return out;
  }

  function fetchCloudRowsWithFallback() {
    if (!global.DataService) return Promise.reject(new Error('Data service unavailable'));
    var tried = [];
    function tryFn(label, fn) {
      if (typeof fn !== 'function') return Promise.resolve(null);
      tried.push(label);
      return Promise.resolve().then(fn).then(function(rows) {
        return rows && rows.length ? rows : null;
      }).catch(function() { return null; });
    }
    return tryFn('getAllForMonitoring', function() { return global.DataService.getAllForMonitoring(); })
      .then(function(rows) { return rows || tryFn('getAllForAdmin', function() { return global.DataService.getAllForAdmin(); }); })
      .then(function(rows) {
        return rows || tryFn('getStaffListWithWorkForAdmin', function() {
          return global.DataService.getStaffListWithWorkForAdmin().then(rowsFromStaffWork);
        });
      })
      .then(function(rows) {
        if (rows) return rows;
        throw new Error('No cloud rows returned from: ' + tried.join(', '));
      });
  }

  function refreshTeacherDirectory() {
    if (!global.DataService || typeof global.DataService.listTeachingStaffForClassLoader !== 'function') {
      HUB.teacherDirectory = [];
      return Promise.resolve([]);
    }
    return global.DataService.listTeachingStaffForClassLoader().then(function(rows) {
      var byName = {};
      (rows || []).forEach(function(r) {
        var name = String((r && (r.display_name || r.email)) || '').trim();
        if (!name) return;
        if (!byName[name]) byName[name] = { teacher_id: r.teacher_id || '', email: r.email || '', display_name: name };
      });
      HUB.teacherDirectory = Object.keys(byName).map(function(k) { return byName[k]; })
        .sort(function(a, b) { return a.display_name.localeCompare(b.display_name); });
      return HUB.teacherDirectory;
    }).catch(function() {
      HUB.teacherDirectory = [];
      return [];
    }).then(function() {
      renderOverviewTeachers(HUB.filteredRows || []);
      return HUB.teacherDirectory;
    });
  }

  function loadFromCloud() {
    var statusEl = $('th-source-status');
    var authReady = !!global.__authReady;
    var canView = !authReady || !!global.__authGuardCanViewSchoolWideTracking || !!global.__authGuardIsAdmin;
    if (!canView) {
      if (statusEl) statusEl.textContent = 'You do not have school-wide tracking permissions.';
      toast('No access to school-wide monitoring');
      return;
    }
    if (!global.DataService) {
      if (statusEl) statusEl.textContent = 'Cloud data service unavailable.';
      toast('Cloud data service unavailable');
      return;
    }
    var loadBtn = $('th-load-cloud-btn');
    var refreshBtn = $('th-refresh-btn');
    if (loadBtn) loadBtn.disabled = true;
    if (refreshBtn) refreshBtn.disabled = true;
    if (statusEl) statusEl.textContent = 'Loading cloud data…';
    fetchCloudRowsWithFallback().then(function(rows) {
      normalizeCloudRows(rows || []);
      hydrateFilterControls();
      if (global.TrackingHubPrefs) global.TrackingHubPrefs.applyPendingUrlState();
      else recalcFilteredState();
      var notesLoad = global.TrackingHubNotes
        ? global.TrackingHubNotes.loadAll().then(function() { renderAllViews(); })
        : Promise.resolve();
      notesLoad.then(function() { refreshTeacherDirectory(); });
      if (!rows || !rows.length) {
        if (statusEl) statusEl.textContent = 'No tracker sources in cloud';
        toast('No tracker sources found');
        return;
      }
      updateHeaderSync();
      toast('Cloud data refreshed');
    }).catch(function(err) {
      var msg = (err && (err.message || err.details)) ? String(err.message || err.details) : 'Unknown error';
      if (statusEl) statusEl.textContent = 'Cloud load failed: ' + msg;
      toast('Could not load cloud data');
    }).finally(function() {
      if (loadBtn) loadBtn.disabled = false;
      if (refreshBtn) refreshBtn.disabled = false;
    });
  }

  function waitForAuthGuardReady(timeoutMs) {
    return new Promise(function(resolve, reject) {
      if (global.__authReady) { resolve(); return; }
      var done = false;
      var t = setTimeout(function() { if (!done) { done = true; reject(new Error('timeout')); } }, timeoutMs || 5000);
      function finish() { if (done) return; done = true; clearTimeout(t); resolve(); }
      global.addEventListener('auth-guard-ready', finish, { once: true });
    });
  }

  /* ── Navigation ── */

  function setView(id) {
    ACTIVE_VIEW = id;
    document.querySelectorAll('.th-view').forEach(function(el) { el.style.display = 'none'; });
    var panel = $('view-' + id);
    if (panel) panel.style.display = 'block';
    document.querySelectorAll('.th-tab[data-view]').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-view') === id);
    });
    var moreViews = document.querySelector('.th-more-views');
    if (moreViews) moreViews.classList.toggle('is-active', id === 'pivot');
    renderAllViews();
    if (global.TrackingHubPrefs) global.TrackingHubPrefs.syncToUrl();
  }

  function getActiveView() { return ACTIVE_VIEW; }

  /* ── Event wiring ── */

  function bindEvents() {
    document.querySelectorAll('.th-tab[data-view]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setView(btn.getAttribute('data-view'));
      });
    });

    document.querySelectorAll('.th-pill[data-subject]').forEach(function(pill) {
      pill.addEventListener('click', function() {
        setSubjectFilter(pill.getAttribute('data-subject'));
      });
    });

    var applyBtn = $('flt-apply-btn');
    if (applyBtn) applyBtn.addEventListener('click', applyQuickFilters);
    var resetBtn = $('flt-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);
    var advApply = $('flt-adv-apply-btn');
    if (advApply) advApply.addEventListener('click', applyFilterControls);

    ['flt-quick-year', 'flt-quick-class', 'flt-quick-tp', 'flt-quick-risk'].forEach(function(id) {
      var el = $(id);
      if (el) el.addEventListener('change', applyQuickFilters);
    });

    var search = $('flt-quick-search');
    if (search) {
      search.addEventListener('keydown', function(ev) { if (ev.key === 'Enter') applyQuickFilters(); });
    }

    var teacherSearch = $('th-teacher-search');
    if (teacherSearch) {
      teacherSearch.addEventListener('input', function() { renderOverviewTeachers(HUB.filteredRows || []); });
    }

    var kpiGrid = $('th-kpi-grid');
    if (kpiGrid) {
      function handleKpiCard(card) {
        if (!card) return;
        var kpi = card.getAttribute('data-kpi');
        if (kpi === 'at-risk') setView('at-risk');
        else if (kpi === 'pupils') setView('classes');
      }
      kpiGrid.addEventListener('click', function(ev) {
        handleKpiCard(ev.target.closest('[data-kpi]'));
      });
      kpiGrid.addEventListener('keydown', function(ev) {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        var card = ev.target.closest('[data-kpi]');
        if (!card) return;
        ev.preventDefault();
        handleKpiCard(card);
      });
    }

    var exportBtn = $('th-export-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportOverviewCsv);

    var loadBtn = $('th-load-cloud-btn');
    if (loadBtn) loadBtn.addEventListener('click', loadFromCloud);
    var refreshBtn = $('th-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadFromCloud);

    var attentionLink = $('th-attention-link');
    if (attentionLink) {
      attentionLink.addEventListener('click', function() { setView('at-risk'); });
    }

    var seeAllClasses = $('th-see-all-classes');
    if (seeAllClasses) {
      seeAllClasses.addEventListener('click', function(ev) {
        ev.preventDefault();
        setView('classes');
      });
    }

    var attentionGrid = $('th-attention-grid');
    if (attentionGrid) {
      function openAttentionCard(card) {
        if (!card || !global.TrackingHubDrawer) return;
        global.TrackingHubDrawer.open(card.getAttribute('data-pupil'), card.getAttribute('data-subject'), card);
      }
      attentionGrid.addEventListener('click', function(ev) {
        openAttentionCard(ev.target.closest('.th-attention-card'));
      });
      if (global.TrackingHubA11y) {
        global.TrackingHubA11y.makeKeyboardActivatable(attentionGrid, '.th-attention-card', openAttentionCard);
      }
    }

  }

  function init() {
    try {
      var params = new URLSearchParams(global.location.search || '');
      if (params.get('embed') === '1' || params.get('embed') === 'true') {
        document.body.classList.add('is-embedded');
      }
    } catch (e) { /* ignore */ }

    bindEvents();
    global.loadFromCloud = loadFromCloud;

    if (global.TrackingHubTabs) global.TrackingHubTabs.init(HubApi);
    if (global.TrackingHubDrawer) global.TrackingHubDrawer.init(HubApi);
    if (global.TrackingHubPrefs) global.TrackingHubPrefs.init(HubApi);
    if (global.TrackingHubNotes) global.TrackingHubNotes.init(HubApi);
    if (global.TrackingHubTargets) global.TrackingHubTargets.init(HubApi);
    if (global.TrackingHubCommentary) global.TrackingHubCommentary.init();
    if (global.TrackingHubSnapshot) global.TrackingHubSnapshot.init(HubApi);
    if (global.TrackingHubDigest) global.TrackingHubDigest.init(HubApi);
    if (global.TrackingHubParent) global.TrackingHubParent.init(HubApi);

    function startHubAfterAccess() {
      waitForAuthGuardReady(5000).then(function() {
        return resolveRoleScope();
      }).then(function() {
        loadFromCloud();
      }).catch(function() {
        toast('Auth still loading, retrying…');
        setTimeout(loadFromCloud, 250);
      });
      refreshTeacherDirectory();
    }

    if (typeof global.ensureTrackingHubAccess === 'function') {
      global.ensureTrackingHubAccess(startHubAfterAccess).catch(function(err) {
        toast((err && err.message) ? err.message : 'Could not verify hub access');
      });
    } else {
      startHubAfterAccess();
    }
  }

  var HubApi = {
    HUB: HUB,
    DIMS: DIMS,
    DIM_LABELS: DIM_LABELS,
    DIM_SHORT: DIM_SHORT,
    FILTER_STATE: FILTER_STATE,
    getActiveView: getActiveView,
    setView: setView,
    recalcFilteredState: recalcFilteredState,
    getRiskForPupil: getRiskForPupil,
    buildPupilRollup: buildPupilRollup,
    safeText: safeText,
    avg: avg,
    tpSort: tpSort,
    bandFromValue: bandFromValue,
    bandClass: bandClass,
    initials: initials,
    dimsForSubject: dimsForSubject,
    toast: toast,
    loadFromCloud: loadFromCloud,
    hydrateFilterControls: hydrateFilterControls,
    getTargetScore: getTargetScore,
    init: init
  };

  global.TrackingHub = HubApi;
})(window);
