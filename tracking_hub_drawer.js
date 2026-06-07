/**
 * Tracking Hub — Phase 2 profile drawer
 */
(function(global) {
  'use strict';

  var TH = null;
  var DRAWER_STATE = { pupilKey: null, subject: null, triggerEl: null };

  function $(id) { return document.getElementById(id); }

  function classAvgForPupil(pupilKey, subject, dim) {
    var rows = TH.HUB.filteredRows.filter(function(r) {
      return r.cls === (TH.HUB.pupilMap[pupilKey] || {}).cls && r.subject === subject;
    });
    return TH.avg(rows.map(function(r) { return r[dim]; }));
  }

  function tpAvgForRow(scores, tp, dims) {
    var row = scores[tp] || {};
    return TH.avg(dims.map(function(d) { return row[d]; }));
  }

  function relatedPupilLinks(pupilKey, subject, risk) {
    var pupil = TH.HUB.pupilMap[pupilKey];
    if (!pupil) return { classMates: [], sameRisk: [] };
    var classMates = [];
    Object.keys(TH.HUB.pupilMap).forEach(function(k) {
      if (k === pupilKey) return;
      var p = TH.HUB.pupilMap[k];
      if (p.yg !== pupil.yg || p.cls !== pupil.cls) return;
      var entry = p.subjects[subject];
      if (!entry) return;
      classMates.push({
        pupilKey: k,
        subject: subject,
        name: p.name,
        yg: p.yg,
        cls: p.cls,
        risk: entry.risk || TH.getRiskForPupil(entry.scores)
      });
    });
    classMates.sort(function(a, b) {
      return (b.risk.lowCount - a.risk.lowCount) || a.name.localeCompare(b.name);
    });

    var sameRisk = [];
    if (global.TrackingHubTabs && global.TrackingHubTabs.buildPupilSubjectRollups) {
      var rollups = global.TrackingHubTabs.buildPupilSubjectRollups(TH.HUB.filteredRows);
      sameRisk = rollups.filter(function(p) {
        return p.subject === subject && p.pupilKey !== pupilKey &&
          p.risk.severity === risk.severity && p.risk.isAtRisk;
      }).sort(function(a, b) { return a.name.localeCompare(b.name); });
    }

    return { classMates: classMates.slice(0, 3), sameRisk: sameRisk.slice(0, 3) };
  }

  function renderRelatedList(items) {
    if (!items.length) return '<p class="th-muted">None nearby.</p>';
    return '<div class="th-related-list">' + items.map(function(p) {
      return '<button type="button" class="th-related-item th-open-related" data-pupil="' + TH.safeText(p.pupilKey) +
        '" data-subject="' + TH.safeText(p.subject) + '">' +
        '<strong>' + TH.safeText(p.name) + '</strong> · ' + TH.safeText(p.yg ? p.yg.toUpperCase() : '') +
        ' ' + TH.safeText(p.cls || '') +
        (p.risk && p.risk.severity ? ' · ' + TH.safeText(p.risk.severity) : '') +
        '</button>';
    }).join('') + '</div>';
  }

  function renderDrawer() {
    var body = $('profile-drawer-body');
    if (!body) return;
    var key = DRAWER_STATE.pupilKey;
    var subject = DRAWER_STATE.subject;
    var pupil = key && TH.HUB.pupilMap[key];
    if (!pupil) {
      body.innerHTML = '<div class="th-empty">Pupil not found.</div>';
      return;
    }

    var entry = subject && pupil.subjects[subject] ? pupil.subjects[subject] : pupil.subjects.drama || pupil.subjects.art;
    if (!entry) {
      body.innerHTML = '<div class="th-empty">No tracker data for this pupil.</div>';
      return;
    }
    var activeSubject = subject || (pupil.subjects.drama ? 'drama' : 'art');
    var risk = entry.risk || TH.getRiskForPupil(entry.scores);
    var tps = Object.keys(entry.scores || {}).sort(TH.tpSort);
    var dims = TH.dimsForSubject(activeSubject, false);
    var tpAvgs = tps.map(function(tp) { return tpAvgForRow(entry.scores, tp, dims); });
    var overall = TH.avg(tpAvgs.filter(function(v) { return v != null; }));
    var profile = entry.profile || {};
    var lastUpdated = profile.lastUpdated ? String(profile.lastUpdated) : '';

    var avatar = $('profile-drawer-avatar');
    var title = $('profile-drawer-name');
    var meta = $('profile-drawer-meta');
    var badge = $('profile-drawer-badge');
    if (avatar) {
      avatar.className = 'th-drawer-avatar ' + (activeSubject === 'art' ? 'art' : 'drama');
      avatar.textContent = TH.initials(pupil.name);
    }
    if (title) title.textContent = pupil.name;
    if (meta) meta.textContent = pupil.yg.toUpperCase() + ' · ' + pupil.cls + ' · ' + (entry.teacher || pupil.teacher);
    if (badge) badge.innerHTML = '<span class="th-subject-chip ' + activeSubject + '">' + (activeSubject === 'art' ? 'Art' : 'Drama') + '</span> ' +
      (risk.severity === 'high' ? '<span class="th-badge th-badge-high">High</span>' :
        risk.severity === 'medium' ? '<span class="th-badge th-badge-med">Medium</span>' :
        risk.severity === 'low' ? '<span class="th-badge th-badge-low">Low</span>' :
        '<span class="th-badge" style="background:#dcfce7;color:#166534">Secure</span>');

    var letterBtn = $('profile-drawer-letter');
    if (letterBtn) {
      var q = new URLSearchParams();
      q.set('name', pupil.name || '');
      q.set('class', [pupil.cls, pupil.yg.toUpperCase()].join(' · '));
      q.set('subject', activeSubject);
      q.set('source', 'tracking-hub');
      letterBtn.href = 'letter_generator.html?' + q.toString();
    }

    var dimRows = TH.DIMS.map(function(d) {
      var v = risk.avgs[d];
      var band = TH.bandFromValue(v);
      var cls = band === 'concern' ? 'concern' : band === 'strong' ? 'strong' : 'secure';
      return '<tr><td>' + TH.safeText(TH.DIM_LABELS[TH.DIMS.indexOf(d)] || d) + '</td>' +
        tps.map(function(tp) {
          var row = entry.scores[tp] || {};
          var val = row[d];
          var b = TH.bandFromValue(typeof val === 'number' && val > 0 ? val : null);
          var c = b === 'concern' ? 'concern' : b === 'strong' ? 'strong' : b === 'secure' ? 'secure' : 'empty';
          return '<td><span class="th-score-cell ' + c + '">' + (val > 0 ? val : '—') + '</span></td>';
        }).join('') +
        '<td><span class="th-score-cell ' + cls + '">' + (v != null ? v.toFixed(1) : '—') + '</span></td></tr>';
    }).join('');

    var notesHtml = '';
    tps.forEach(function(tp) {
      var note = entry.scores[tp] && entry.scores[tp].notes;
      if (note) notesHtml += '<div class="th-profile-note"><strong>' + TH.safeText(String(tp).toUpperCase()) + ':</strong> <em>' + TH.safeText(note) + '</em></div>';
    });

    var related = relatedPupilLinks(key, activeSubject, risk);
    var relatedHtml =
      '<div class="th-profile-section"><div class="th-profile-section-title">Others in this class</div>' +
        renderRelatedList(related.classMates) + '</div>' +
      '<div class="th-profile-section"><div class="th-profile-section-title">Same risk level in ' +
        (activeSubject === 'art' ? 'Art' : 'Drama') + '</div>' +
        renderRelatedList(related.sameRisk) + '</div>';

    var notesSection =
      '<div class="th-profile-section"><div class="th-profile-section-title">Hub notes &amp; flags</div>' +
        (global.TrackingHubNotes ? global.TrackingHubNotes.renderNotesHtml(key, activeSubject) : '') +
        '<div class="th-note-form">' +
          '<textarea class="th-note-input" id="profile-note-input" rows="2" placeholder="Add a monitoring note…"></textarea>' +
          '<label class="th-note-flag-label"><input type="checkbox" id="profile-note-flag"> Flag as concern</label>' +
          '<button type="button" class="th-btn th-btn-primary th-btn-compact" id="profile-add-note-btn">Save note</button>' +
        '</div></div>';

    var crossHtml = '';
    var subjects = Object.keys(pupil.subjects || {});
    if (subjects.length > 1) {
      crossHtml = '<div class="th-profile-section"><div class="th-profile-section-title">Cross-subject</div><div class="th-profile-cross">';
      subjects.forEach(function(sub) {
        var e = pupil.subjects[sub];
        var r = e.risk || TH.getRiskForPupil(e.scores);
        crossHtml += '<div class="th-profile-cross-item"><strong>' + (sub === 'art' ? 'Art' : 'Drama') + '</strong> · ' +
          (r.severity || 'secure') + ' · ' + (r.lowCount || 0) + ' low dims</div>';
      });
      crossHtml += '</div></div>';
    }

    body.innerHTML =
      '<div class="th-profile-stats">' +
        '<div class="th-profile-stat"><span class="lbl">Overall avg</span><span class="val">' + (overall != null ? overall.toFixed(2) : '—') + '</span>' +
          (global.TrackingHubGrades && overall != null ?
            '<span class="th-profile-grade">' + TH.safeText(global.TrackingHubGrades.bgeShort(overall)) + '</span>' : '') +
        '</div>' +
        '<div class="th-profile-stat th-profile-stat-wide"><span class="lbl">Pathway estimate</span><span class="val th-profile-stat-sm">' +
          TH.safeText(global.TrackingHubGrades ? global.TrackingHubGrades.sqaPathwayEstimate(overall, pupil.yg) : '—') +
        '</span></div>' +
        '<div class="th-profile-stat"><span class="lbl">Low dimensions</span><span class="val">' + (risk.lowCount || 0) + '</span></div>' +
        '<div class="th-profile-stat"><span class="lbl">Last updated</span><span class="val th-profile-stat-sm">' +
          TH.safeText(lastUpdated || '—') + '</span></div>' +
        '<div class="th-profile-stat"><span class="lbl">Target</span><span class="val">' +
          (TH.getTargetScore ? TH.getTargetScore(pupil.yg, pupil.cls, activeSubject).toFixed(2) : '3.00') +
        '</span></div>' +
      '</div>' +
      '<div class="th-profile-section"><div class="th-profile-section-title">Dimension radar</div>' +
        '<div class="th-chart-wrap th-chart-wrap-profile"><canvas id="profile-radar-chart"></canvas></div></div>' +
      '<div class="th-profile-section"><div class="th-profile-section-title">Dimension trajectories</div>' +
        '<div class="th-chart-wrap th-chart-wrap-profile th-chart-wrap-tall"><canvas id="profile-dim-chart"></canvas></div></div>' +
      '<div class="th-profile-section"><div class="th-profile-section-title">Dimension scores</div>' +
        '<div class="th-table-wrap"><table class="th-table th-profile-tp-table"><thead><tr><th>Dimension</th>' +
        tps.map(function(tp) { return '<th>' + TH.safeText(String(tp).toUpperCase()) + '</th>'; }).join('') +
        '<th>Avg</th></tr></thead><tbody>' + dimRows + '</tbody></table></div>' +
        (notesHtml ? '<div class="th-profile-notes-block">' + notesHtml + '</div>' : '') +
      '</div>' +
      '<div class="th-profile-section"><div class="th-profile-section-title">Teacher notes' +
        (lastUpdated ? ' <span class="th-profile-updated">· ' + TH.safeText(lastUpdated) + '</span>' : '') +
        '</div><p class="th-profile-text">' + TH.safeText(profile.teacherNotes || 'No teacher notes yet.') + '</p></div>' +
      '<div class="th-profile-section"><div class="th-profile-section-title">Pupil reflection</div>' +
        '<p class="th-profile-text">' + TH.safeText(profile.pupilReflection || 'No reflection yet.') + '</p></div>' +
      notesSection + relatedHtml + crossHtml;

    if (global.TrackingHubCharts) {
      var pupilAvgs = TH.DIMS.map(function(d) { return risk.avgs[d]; });
      var classAvgs = TH.DIMS.map(function(d) { return classAvgForPupil(key, activeSubject, d); });
      var radarCanvas = $('profile-radar-chart');
      if (radarCanvas) {
        global.TrackingHubCharts.renderProfileRadar(radarCanvas, TH.DIM_SHORT, pupilAvgs, classAvgs);
      }
      var dimCanvas = $('profile-dim-chart');
      if (dimCanvas && global.TrackingHubCharts.renderPupilDimLines) {
        var dimSeries = TH.DIMS.map(function(d) {
          return tps.map(function(tp) {
            var row = entry.scores[tp] || {};
            var v = row[d];
            return (typeof v === 'number' && v > 0) ? v : null;
          });
        });
        var target = TH.getTargetScore ? TH.getTargetScore(pupil.yg, pupil.cls, activeSubject) : 3;
        global.TrackingHubCharts.renderPupilDimLines(
          dimCanvas,
          tps.map(function(tp) { return String(tp).toUpperCase(); }),
          TH.DIM_SHORT,
          dimSeries,
          target
        );
      }
    }

    trapFocus();
  }

  function getFocusable(container) {
    if (!container) return [];
    return Array.prototype.filter.call(
      container.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'),
      function(el) { return el.offsetParent !== null; }
    );
  }

  function trapFocus() {
    var drawer = document.querySelector('.th-drawer');
    var nodes = getFocusable(drawer);
    if (!nodes.length) return;
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    first.focus();
    function onKey(ev) {
      if (ev.key !== 'Tab') return;
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    }
    DRAWER_STATE._trapHandler = onKey;
    document.addEventListener('keydown', onKey);
  }

  function releaseFocusTrap() {
    if (DRAWER_STATE._trapHandler) {
      document.removeEventListener('keydown', DRAWER_STATE._trapHandler);
      DRAWER_STATE._trapHandler = null;
    }
    if (DRAWER_STATE.triggerEl && DRAWER_STATE.triggerEl.focus) {
      try { DRAWER_STATE.triggerEl.focus(); } catch (e) { /* ignore */ }
    }
  }

  function open(pupilKey, subject, triggerEl) {
    DRAWER_STATE.pupilKey = pupilKey;
    DRAWER_STATE.subject = subject || null;
    DRAWER_STATE.triggerEl = triggerEl || document.activeElement;
    var overlay = $('profile-drawer');
    if (overlay) {
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('th-drawer-open');
    }
    renderDrawer();
  }

  function close() {
    releaseFocusTrap();
    DRAWER_STATE.pupilKey = null;
    DRAWER_STATE.subject = null;
    DRAWER_STATE.triggerEl = null;
    var overlay = $('profile-drawer');
    if (overlay) {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('th-drawer-open');
    if (global.TrackingHubCharts) {
      global.TrackingHubCharts.destroy('profileRadar');
      global.TrackingHubCharts.destroy('profileDim');
      global.TrackingHubCharts.destroy('profileTp');
    }
  }

  function bindEvents() {
    var overlay = $('profile-drawer');
    if (overlay) {
      overlay.addEventListener('click', function(ev) {
        if (ev.target === overlay || ev.target.closest('[data-close-drawer]')) close();
        var rel = ev.target.closest('.th-open-related');
        if (rel) {
          open(rel.getAttribute('data-pupil'), rel.getAttribute('data-subject'), rel);
        }
      });
    }
    document.addEventListener('keydown', function(ev) {
      if (ev.key === 'Escape' && overlay && overlay.classList.contains('is-open')) close();
    });
  }

  function init(hubApi) {
    TH = hubApi;
    bindEvents();
  }

  function getState() {
    return { pupilKey: DRAWER_STATE.pupilKey, subject: DRAWER_STATE.subject };
  }

  global.TrackingHubDrawer = {
    init: init,
    open: open,
    close: close,
    render: renderDrawer,
    getState: getState
  };

  function bootHub() {
    if (global.TrackingHub && typeof global.TrackingHub.init === 'function') {
      global.TrackingHub.init();
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootHub);
  } else {
    bootHub();
  }
})(window);
