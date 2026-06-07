/**
 * Tracking Hub — Phase 2 tabs: Classes, At Risk, Pupil List, Pivot
 */
(function(global) {
  'use strict';

  var TH = null;
  var EXPANDED_TEACHER = null;
  var PIVOT_STATE = { row: 'cls', col: 'tp', value: 'avgScore' };
  var AT_RISK_SORT = 'severity';
  var AT_RISK_FILTERS = { yg: '', subject: '', severity: '' };
  var PUPIL_PAGE = { page: 1, perPage: 50 };

  function api() { return global.TrackingHub || {}; }

  function $(id) { return document.getElementById(id); }

  function buildPupilSubjectRollups(rows) {
    var HUB = TH.HUB;
    var map = {};
    (rows || []).forEach(function(r) {
      var key = r.pupilKey + '|' + r.subject;
      if (!map[key]) {
        var pupil = HUB.pupilMap[r.pupilKey];
        var entry = pupil && pupil.subjects[r.subject];
        map[key] = {
          pupilKey: r.pupilKey,
          subject: r.subject,
          name: r.name,
          yg: r.yg,
          cls: r.cls,
          teacher: r.teacher,
          risk: entry && entry.risk ? entry.risk : { lowCount: 0, severity: null, isAtRisk: false, avgs: {} },
          scores: entry ? entry.scores : {},
          tpScores: {}
        };
      }
      if (r.tp && r.scoreAvg != null) map[key].tpScores[r.tp] = r.scoreAvg;
    });
    return Object.keys(map).map(function(k) { return map[k]; });
  }

  function severityChip(severity) {
    if (severity === 'high') return '<span class="th-badge th-badge-high">High</span>';
    if (severity === 'medium') return '<span class="th-badge th-badge-med">Medium</span>';
    if (severity === 'low') return '<span class="th-badge th-badge-low">Low</span>';
    return '<span class="th-badge" style="background:#dcfce7;color:#166534">Secure</span>';
  }

  function subjectChip(subject) {
    var cls = subject === 'art' ? 'art' : 'drama';
    var label = subject === 'art' ? 'Art' : 'Drama';
    return '<span class="th-subject-chip ' + cls + '">' + TH.safeText(label) + '</span>';
  }

  function scoreCell(score, yg) {
    if (score == null) return '<span class="th-score-cell empty">—</span>';
    var band = TH.bandFromValue(score);
    var cls = band === 'concern' ? 'concern' : band === 'strong' ? 'strong' : 'secure';
    var title = global.TrackingHubGrades ? global.TrackingHubGrades.scoreTitle(score, yg) : '';
    return '<span class="th-score-cell ' + cls + '"' + (title ? ' title="' + TH.safeText(title) + '"' : '') + '>' +
      Number(score).toFixed(1) + '</span>';
  }

  function sparkline(tpScores, tps) {
    var pts = (tps || []).map(function(tp) { return tpScores[tp]; }).filter(function(v) { return v != null; });
    if (pts.length < 2) return '<span class="th-muted">—</span>';
    var vals = (tps || []).map(function(tp) { return tpScores[tp]; });
    var nums = vals.filter(function(v) { return v != null; });
    var min = Math.min.apply(null, nums);
    var max = Math.max.apply(null, nums);
    var range = (max - min) || 1;
    var w = 56;
    var h = 14;
    var coords = [];
    var idx = 0;
    vals.forEach(function(v) {
      if (v == null) return;
      var x = (idx / Math.max(1, nums.length - 1)) * (w - 4) + 2;
      var y = h - 2 - ((v - min) / range) * (h - 4);
      coords.push(x.toFixed(1) + ',' + y.toFixed(1));
      idx++;
    });
    var stroke = TH.bandFromValue(TH.avg(nums));
    var color = stroke === 'concern' ? '#b91c1c' : stroke === 'strong' ? '#166534' : '#b45309';
    return '<svg class="th-spark" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><polyline fill="none" stroke="' + color + '" stroke-width="1.5" points="' + coords.join(' ') + '"/></svg>';
  }

  function letterUrl(rollup) {
    var q = new URLSearchParams();
    q.set('name', rollup.name || '');
    q.set('class', [rollup.cls, (rollup.yg || '').toUpperCase()].filter(Boolean).join(' · '));
    q.set('subject', rollup.subject === 'drama' ? 'drama' : 'art');
    q.set('source', 'tracking-hub');
    return 'letter_generator.html?' + q.toString();
  }

  function getTpsFromRows(rows) {
    return Array.from(new Set((rows || []).map(function(r) { return r.tp; }).filter(Boolean))).sort(TH.tpSort);
  }

  /* ── Classes (Teachers & classes) ── */

  function buildTeacherRollups(rows) {
    var byTeacher = {};
    rows.forEach(function(r) {
      var key = r.teacher || 'Unknown';
      if (!byTeacher[key]) {
        byTeacher[key] = {
          teacher: key,
          userId: r.teacherUserId || '',
          subjects: new Set(),
          classes: new Set(),
          pupils: new Set(),
          atRisk: new Set(),
          scoreSum: 0,
          scored: 0,
          scoreRows: 0,
          tpCoverage: {},
          classPupils: {}
        };
      }
      var t = byTeacher[key];
      if (!t.userId && r.teacherUserId) t.userId = r.teacherUserId;
      t.subjects.add(r.subject);
      t.classes.add(r.cls);
      t.pupils.add(r.pupilKey);
      if (r.isAtRisk) t.atRisk.add(r.pupilKey + '|' + r.subject);
      t.scoreRows++;
      if (r.scoreAvg != null) { t.scored++; t.scoreSum += r.scoreAvg; }
      if (!t.tpCoverage[r.tp]) t.tpCoverage[r.tp] = { total: 0, scored: 0 };
      t.tpCoverage[r.tp].total++;
      if (r.scoreAvg != null) t.tpCoverage[r.tp].scored++;
      var cKey = r.cls + '|' + r.subject + '|' + r.yg;
      if (!t.classPupils[cKey]) {
        t.classPupils[cKey] = { cls: r.cls, subject: r.subject, yg: r.yg, pupilKeys: new Set() };
      }
      t.classPupils[cKey].pupilKeys.add(r.pupilKey);
    });
    return Object.keys(byTeacher).map(function(k) {
      var t = byTeacher[k];
      var tps = Object.keys(t.tpCoverage).sort(TH.tpSort);
      return {
        teacher: t.teacher,
        userId: t.userId || '',
        subjects: Array.from(t.subjects),
        classes: t.classes.size,
        pupils: t.pupils.size,
        atRisk: t.atRisk.size,
        avgScore: t.scored ? t.scoreSum / t.scored : null,
        coverage: t.scoreRows ? Math.round((t.scored / t.scoreRows) * 100) : 0,
        tpCoverage: tps.map(function(tp) {
          var c = t.tpCoverage[tp];
          var pct = c.total ? c.scored / c.total : 0;
          return pct >= 0.8 ? 'full' : pct > 0 ? 'partial' : 'empty';
        }),
        classGroups: Object.keys(t.classPupils).map(function(ck) {
          var g = t.classPupils[ck];
          return { cls: g.cls, subject: g.subject, yg: g.yg, pupilCount: g.pupilKeys.size };
        }).sort(function(a, b) { return a.cls.localeCompare(b.cls); })
      };
    }).sort(function(a, b) { return b.pupils - a.pupils || a.teacher.localeCompare(b.teacher); });
  }

  function renderClassPupilTable(teacher, cls, subject, yg, tps, userId) {
    var ENR = global.TrackingHubEnrich;
    var enrich = TH.HUB.enrichment || {};
    var modEntries = enrich.moderationByUser[userId] || [];
    var rows = TH.HUB.filteredRows.filter(function(r) {
      return r.teacher === teacher && r.cls === cls && r.subject === subject && r.yg === yg;
    });
    var rollups = buildPupilSubjectRollups(rows);
    var seen = {};
    rollups = rollups.filter(function(p) {
      if (seen[p.pupilKey]) return false;
      seen[p.pupilKey] = true;
      return true;
    }).sort(function(a, b) { return a.name.localeCompare(b.name); });

    if (!rollups.length) return '<div class="th-muted">No pupils in this class.</div>';

    return '<table class="th-mini-table"><thead><tr><th>Pupil</th>' +
      tps.map(function(tp) {
        var icon = ENR ? ENR.moderationIcon(modEntries, tp) : '';
        return '<th>' + TH.safeText(String(tp).toUpperCase()) + icon + '</th>';
      }).join('') +
      '<th>Trend</th><th>Status</th></tr></thead><tbody>' +
      rollups.map(function(p) {
        return '<tr class="th-pupil-row" data-pupil="' + TH.safeText(p.pupilKey) + '" data-subject="' + TH.safeText(p.subject) + '" tabindex="0" role="button" aria-label="Open profile for ' + TH.safeText(p.name) + '">' +
          '<td><strong>' + TH.safeText(p.name) + '</strong></td>' +
          tps.map(function(tp) { return '<td>' + scoreCell(p.tpScores[tp], p.yg) + '</td>'; }).join('') +
          '<td>' + sparkline(p.tpScores, tps) + '</td>' +
          '<td>' + severityChip(p.risk.severity) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function renderClasses() {
    var body = $('classes-teacher-body');
    if (!body) return;
    var q = (($('classes-teacher-search') || {}).value || '').trim().toLowerCase();
    var rows = TH.HUB.filteredRows;
    var teachers = buildTeacherRollups(rows).filter(function(t) {
      return !q || t.teacher.toLowerCase().indexOf(q) >= 0;
    });
    var tps = getTpsFromRows(rows);

    if (!teachers.length) {
      body.innerHTML = '<tr><td colspan="7" class="th-muted">No teachers for current filters.</td></tr>';
      return;
    }

    var html = [];
    teachers.forEach(function(t) {
      var primarySub = t.subjects.length > 1 ? 'both' : (t.subjects[0] === 'art' ? 'art' : 'drama');
      var avatarClass = primarySub === 'both' ? 'both' : primarySub;
      var subChips = t.subjects.map(function(s) { return subjectChip(s); }).join(' ');
      var barPct = t.avgScore != null ? Math.round(((t.avgScore - 1) / 3) * 100) : 0;
      var atRiskClass = t.atRisk >= 6 ? 'th-badge-high' : t.atRisk >= 3 ? 'th-badge-med' : 'th-badge-low';
      var covSquares = t.tpCoverage.map(function(state) {
        return '<span class="th-coverage-sq ' + (state === 'full' ? 'full' : state === 'partial' ? 'partial' : '') + '"></span>';
      }).join('');
      var expanded = EXPANDED_TEACHER === t.teacher;

      html.push('<tr class="th-teacher-row' + (expanded ? ' is-expanded' : '') + '" data-teacher="' + TH.safeText(t.teacher) + '" tabindex="0" role="button" aria-expanded="' + (expanded ? 'true' : 'false') + '">' +
        '<td><div class="th-teacher-cell"><span class="th-teacher-avatar ' + avatarClass + '">' + TH.safeText(TH.initials(t.teacher)) + '</span>' +
        '<div><div style="font-weight:500">' + TH.safeText(t.teacher) + '</div></div></div></td>' +
        '<td>' + subChips + '</td>' +
        '<td style="text-align:center">' + t.classes + '</td>' +
        '<td style="text-align:center">' + t.pupils + '</td>' +
        '<td><div class="th-score-bar-wrap"><div class="th-score-bar"><div class="th-score-bar-fill" style="width:' + barPct + '%"></div></div>' +
        '<span style="font-weight:500">' + (t.avgScore != null ? t.avgScore.toFixed(2) : '—') + '</span></div></td>' +
        '<td style="text-align:center"><span class="th-badge ' + atRiskClass + '">' + t.atRisk + '</span></td>' +
        '<td><div class="th-coverage-strip">' + covSquares + '</div></td></tr>');

      if (expanded) {
        html.push('<tr class="th-expand-row"><td colspan="7"><div class="th-expand-inner">');
        var lessons = (TH.HUB.enrichment && TH.HUB.enrichment.lessonsByUser[t.userId]) || [];
        t.classGroups.forEach(function(g) {
          var lessonSub = global.TrackingHubEnrich
            ? global.TrackingHubEnrich.lessonSubtitle(lessons, g.cls, g.yg) : '';
          html.push('<div class="th-class-block">' +
            '<div class="th-class-block-head"><i class="ti ti-corner-down-right" aria-hidden="true"></i> ' +
            TH.safeText(t.teacher) + ' · ' + TH.safeText(g.yg.toUpperCase()) + ' ' + TH.safeText(g.cls) + ' · ' + TH.safeText(g.subject) +
            ' · ' + g.pupilCount + ' pupils' + TH.safeText(lessonSub) + '</div>');
          var classTarget = TH.getTargetScore ? TH.getTargetScore(g.yg, g.cls, g.subject) : 3;
          html.push('<div class="th-class-tools">' +
            '<label class="th-class-target-label">Class target ' +
            '<input type="number" class="th-class-target-input" min="1" max="4" step="0.25" ' +
            'value="' + classTarget + '" data-target-teacher="' + TH.safeText(t.teacher) + '" ' +
            'data-target-yg="' + TH.safeText(g.yg) + '" data-target-cls="' + TH.safeText(g.cls) + '" ' +
            'data-target-subject="' + TH.safeText(g.subject) + '"></label></div>');
          if (global.TrackingHubCommentary) {
            html.push(global.TrackingHubCommentary.renderEditor(t.teacher, g.yg, g.cls, g.subject));
          }
          html.push(renderClassPupilTable(t.teacher, g.cls, g.subject, g.yg, tps, t.userId));
          html.push('</div>');
        });
        html.push('</div></td></tr>');
      }
    });
    body.innerHTML = html.join('');
  }

  /* ── At Risk ── */

  function sortAtRisk(list) {
    var sorted = list.slice();
    if (AT_RISK_SORT === 'name') {
      sorted.sort(function(a, b) { return a.name.localeCompare(b.name); });
    } else if (AT_RISK_SORT === 'class') {
      sorted.sort(function(a, b) { return a.cls.localeCompare(b.cls) || a.name.localeCompare(b.name); });
    } else if (AT_RISK_SORT === 'trajectory') {
      sorted.sort(function(a, b) {
        var ta = trajectoryDelta(a.tpScores);
        var tb = trajectoryDelta(b.tpScores);
        return ta - tb || (b.risk.lowCount - a.risk.lowCount);
      });
    } else {
      sorted.sort(function(a, b) {
        return (b.risk.lowCount - a.risk.lowCount) ||
          (severityRank(b.risk.severity) - severityRank(a.risk.severity)) ||
          a.name.localeCompare(b.name);
      });
    }
    return sorted;
  }

  function severityRank(s) {
    if (s === 'high') return 3;
    if (s === 'medium') return 2;
    if (s === 'low') return 1;
    return 0;
  }

  function trajectoryDelta(tpScores) {
    var tps = Object.keys(tpScores || {}).sort(TH.tpSort);
    if (tps.length < 2) return 0;
    var first = tpScores[tps[0]];
    var last = tpScores[tps[tps.length - 1]];
    if (first == null || last == null) return 0;
    return last - first;
  }

  function filterAtRiskRollups(rollups) {
    return rollups.filter(function(p) {
      if (AT_RISK_FILTERS.yg && p.yg !== AT_RISK_FILTERS.yg) return false;
      if (AT_RISK_FILTERS.subject && p.subject !== AT_RISK_FILTERS.subject) return false;
      if (AT_RISK_FILTERS.severity && (p.risk.severity || 'low') !== AT_RISK_FILTERS.severity) return false;
      return true;
    });
  }

  function syncAtRiskFilterChips() {
    var wrap = $('at-risk-filters');
    if (!wrap) return;
    wrap.querySelectorAll('[data-at-risk-yg]').forEach(function(btn) {
      btn.classList.toggle('active', (btn.getAttribute('data-at-risk-yg') || '') === AT_RISK_FILTERS.yg);
    });
    wrap.querySelectorAll('[data-at-risk-subject]').forEach(function(btn) {
      btn.classList.toggle('active', (btn.getAttribute('data-at-risk-subject') || '') === AT_RISK_FILTERS.subject);
    });
    wrap.querySelectorAll('[data-at-risk-sev]').forEach(function(btn) {
      btn.classList.toggle('active', (btn.getAttribute('data-at-risk-sev') || '') === AT_RISK_FILTERS.severity);
    });
  }

  function renderAtRisk() {
    var grid = $('at-risk-grid');
    if (!grid) return;
    syncAtRiskFilterChips();
    var rollups = buildPupilSubjectRollups(TH.HUB.filteredRows).filter(function(p) { return p.risk.isAtRisk; });
    rollups = filterAtRiskRollups(rollups);
    rollups = sortAtRisk(rollups);
    var countEl = $('at-risk-count');
    if (countEl) countEl.textContent = rollups.length + ' pupils';

    if (!rollups.length) {
      grid.innerHTML = '<div class="th-empty">No at-risk pupils for current filters.</div>';
      return;
    }

    grid.innerHTML = rollups.map(function(p) {
      var sev = p.risk.severity || 'low';
      var dimCells = TH.DIMS.map(function(d) {
        var v = p.risk.avgs[d];
        var band = TH.bandFromValue(v);
        var display = v != null ? v.toFixed(1) : '—';
        return '<span class="th-dim-cell" style="' + TH.bandClass(band) + '">' + display + '</span>';
      }).join('');
      var tps = Object.keys(p.tpScores).sort(TH.tpSort);
      var flagHtml = global.TrackingHubNotes && global.TrackingHubNotes.hasOpenFlag(p.pupilKey, p.subject)
        ? ' <i class="ti ti-flag-filled th-flag-icon" title="Open hub flag" aria-hidden="true"></i>' : '';
      return '<div class="th-at-risk-card sev-' + sev + '">' +
        '<div class="th-attention-pupil">' +
          '<span class="th-avatar ' + (p.subject === 'art' ? 'art' : 'drama') + '">' + TH.safeText(TH.initials(p.name)) + '</span>' +
          '<div><div class="th-pupil-name">' + TH.safeText(p.name) + flagHtml + '</div>' +
          '<div class="th-pupil-meta">' + TH.safeText(p.yg.toUpperCase()) + ' · ' + TH.safeText(p.cls) + ' · ' + subjectChip(p.subject) + '</div></div>' +
          severityChip(sev) +
        '</div>' +
        '<div class="th-dim-strip">' + dimCells + '</div>' +
        '<div class="th-at-risk-footer">' +
          sparkline(p.tpScores, tps) +
          '<div class="th-at-risk-actions">' +
            '<button type="button" class="th-btn th-btn-ghost th-btn-compact th-open-profile" data-pupil="' + TH.safeText(p.pupilKey) + '" data-subject="' + TH.safeText(p.subject) + '">Profile</button>' +
            '<a class="th-btn th-btn-ghost th-btn-compact" href="' + TH.safeText(letterUrl(p)) + '" target="_blank" rel="noopener">Letter</a>' +
          '</div></div></div>';
    }).join('');
  }

  /* ── Pupil List ── */

  function renderPupilList() {
    var head = $('pupil-list-head');
    var body = $('pupil-list-body');
    var meta = $('pupil-list-meta');
    if (!head || !body) return;

    var rows = TH.HUB.filteredRows;
    var tps = getTpsFromRows(rows);
    var rollups = buildPupilSubjectRollups(rows).sort(function(a, b) {
      return a.name.localeCompare(b.name) || a.subject.localeCompare(b.subject) || a.cls.localeCompare(b.cls);
    });

    var total = rollups.length;
    var perPage = PUPIL_PAGE.perPage;
    var pages = Math.max(1, Math.ceil(total / perPage));
    if (PUPIL_PAGE.page > pages) PUPIL_PAGE.page = pages;
    var start = (PUPIL_PAGE.page - 1) * perPage;
    var pageRows = rollups.slice(start, start + perPage);

    head.innerHTML = '<tr><th class="th-sticky-col">#</th><th class="th-sticky-col-2">Name</th><th>Year</th><th>Class</th><th>Teacher</th><th>Subject</th>' +
      tps.map(function(tp) { return '<th>' + TH.safeText(String(tp).toUpperCase()) + '</th>'; }).join('') +
      '<th>Band</th><th>Trend</th><th>Risk</th></tr>';

    if (!pageRows.length) {
      body.innerHTML = '<tr><td colspan="' + (9 + tps.length) + '" class="th-muted">No pupils for current filters.</td></tr>';
    } else {
      body.innerHTML = pageRows.map(function(p, i) {
        var trend = trajectoryDelta(p.tpScores);
        var trendIcon = trend >= 0.15 ? 'ti-trending-up' : trend <= -0.15 ? 'ti-trending-down' : 'ti-minus';
        var trendCls = trend >= 0.15 ? 'up' : trend <= -0.15 ? 'down' : '';
        var avg = TH.avg(Object.keys(p.tpScores).map(function(tp) { return p.tpScores[tp]; }));
        var band = global.TrackingHubGrades ? global.TrackingHubGrades.bgeShort(avg) : '—';
        return '<tr class="th-pupil-row" data-pupil="' + TH.safeText(p.pupilKey) + '" data-subject="' + TH.safeText(p.subject) + '" tabindex="0" role="button">' +
          '<td class="th-sticky-col">' + (start + i + 1) + '</td>' +
          '<td class="th-sticky-col-2"><strong>' + TH.safeText(p.name) + '</strong></td>' +
          '<td>' + TH.safeText(p.yg.toUpperCase()) + '</td>' +
          '<td>' + TH.safeText(p.cls) + '</td>' +
          '<td>' + TH.safeText(p.teacher) + '</td>' +
          '<td>' + subjectChip(p.subject) + '</td>' +
          tps.map(function(tp) { return '<td>' + scoreCell(p.tpScores[tp], p.yg) + '</td>'; }).join('') +
          '<td><span class="th-grade-chip">' + TH.safeText(band) + '</span></td>' +
          '<td><i class="ti ' + trendIcon + ' th-trend-icon ' + trendCls + '" aria-hidden="true"></i></td>' +
          '<td>' + severityChip(p.risk.severity) + '</td></tr>';
      }).join('');
    }

    if (meta) {
      meta.textContent = 'Showing ' + (total ? start + 1 : 0) + '–' + Math.min(start + perPage, total) + ' of ' + total;
    }
    var pageLbl = $('pupil-list-page');
    if (pageLbl) pageLbl.textContent = 'Page ' + PUPIL_PAGE.page + ' / ' + pages;
  }

  function exportPupilListCsv() {
    var rollups = buildPupilSubjectRollups(TH.HUB.filteredRows);
    var tps = getTpsFromRows(TH.HUB.filteredRows);
    var headers = ['name', 'year', 'class', 'teacher', 'subject'].concat(tps).concat(['risk']);
    var csv = [headers.join(',')].concat(rollups.map(function(p) {
      var vals = [p.name, p.yg, p.cls, p.teacher, p.subject]
        .concat(tps.map(function(tp) { return p.tpScores[tp] != null ? p.tpScores[tp] : ''; }))
        .concat([p.risk.severity || '']);
      return vals.map(function(v) {
        var txt = String(v == null ? '' : v).replace(/"/g, '""');
        return '"' + txt + '"';
      }).join(',');
    })).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tracking-pupil-list.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    TH.toast('Exported pupil list');
  }

  /* ── Pivot ── */

  function pivotLabel(key) {
    var labels = {
      yg: 'Year', cls: 'Class', teacher: 'Teacher', subject: 'Subject', tp: 'TP',
      riskBand: 'Risk', attainmentBand: 'Attainment'
    };
    return labels[key] || key;
  }

  function initPivotControls() {
    var rowSel = $('pivot-row');
    var colSel = $('pivot-col');
    var valSel = $('pivot-value');
    if (!rowSel || !colSel || !valSel) return;
    var dims = ['yg', 'cls', 'teacher', 'subject', 'tp', 'riskBand', 'attainmentBand'];
    rowSel.innerHTML = dims.map(function(d) { return '<option value="' + d + '">' + pivotLabel(d) + '</option>'; }).join('');
    colSel.innerHTML = dims.map(function(d) { return '<option value="' + d + '">' + pivotLabel(d) + '</option>'; }).join('');
    valSel.innerHTML = '<option value="count">Count</option><option value="avgScore">Avg score</option><option value="riskPct">At-risk %</option>';
    rowSel.value = PIVOT_STATE.row;
    colSel.value = PIVOT_STATE.col;
    valSel.value = PIVOT_STATE.value;
  }

  function pivotAggVal(agg, metric) {
    if (metric === 'count') return agg.count;
    if (metric === 'avgScore') return agg.sumScore / (agg.scoreCount || 1);
    if (metric === 'riskPct') return agg.count ? (agg.riskCount / agg.count) * 100 : 0;
    return agg.count;
  }

  function formatPivot(metric, v) {
    if (metric === 'count') return String(Math.round(v));
    if (metric === 'riskPct') return v.toFixed(1) + '%';
    return v.toFixed(2);
  }

  function renderPivot() {
    var tbl = $('pivot-table');
    if (!tbl) return;
    var rows = TH.HUB.filteredRows;
    if (!rows.length) {
      tbl.innerHTML = '<tbody><tr><td class="th-muted">No data for current filters.</td></tr></tbody>';
      return;
    }
    var rKey = PIVOT_STATE.row;
    var cKey = PIVOT_STATE.col;
    var metric = PIVOT_STATE.value;
    var matrix = {};
    var rowKeys = [];
    var colKeys = [];
    rows.forEach(function(r) {
      var rv = r[rKey] || '—';
      var cv = r[cKey] || '—';
      if (rowKeys.indexOf(rv) < 0) rowKeys.push(rv);
      if (colKeys.indexOf(cv) < 0) colKeys.push(cv);
      if (!matrix[rv]) matrix[rv] = {};
      if (!matrix[rv][cv]) matrix[rv][cv] = { count: 0, sumScore: 0, scoreCount: 0, riskCount: 0 };
      var agg = matrix[rv][cv];
      agg.count++;
      if (r.scoreAvg != null) { agg.sumScore += r.scoreAvg; agg.scoreCount++; }
      if (r.isAtRisk) agg.riskCount++;
    });
    rowKeys.sort(function(a, b) { return String(a).localeCompare(String(b)); });
    colKeys.sort(function(a, b) { return String(a).localeCompare(String(b)); });

    var thead = '<thead><tr><th>' + TH.safeText(pivotLabel(rKey)) + ' \\ ' + TH.safeText(pivotLabel(cKey)) + '</th>' +
      colKeys.map(function(c) { return '<th>' + TH.safeText(c) + '</th>'; }).join('') + '</tr></thead>';
    var tbody = '<tbody>' + rowKeys.map(function(rv) {
      return '<tr><td><strong>' + TH.safeText(rv) + '</strong></td>' +
        colKeys.map(function(cv) {
          var agg = matrix[rv] && matrix[rv][cv] ? matrix[rv][cv] : { count: 0, sumScore: 0, scoreCount: 0, riskCount: 0 };
          var v = pivotAggVal(agg, metric);
          var band = metric === 'avgScore' ? TH.bandFromValue(v) : null;
          var style = band ? TH.bandClass(band) : '';
          return '<td class="th-pivot-cell"' + (style ? ' style="' + style + '"' : '') + '>' + formatPivot(metric, v) + '</td>';
        }).join('') + '</tr>';
    }).join('') + '</tbody>';
    tbl.innerHTML = thead + tbody;
  }

  function renderAll() {
    if (TH.getActiveView() === 'classes') renderClasses();
    if (TH.getActiveView() === 'at-risk') renderAtRisk();
    if (TH.getActiveView() === 'pupils') renderPupilList();
    if (TH.getActiveView() === 'pivot') renderPivot();
  }

  function bindTabEvents() {
    var classesBody = $('classes-teacher-body');
    if (classesBody) {
      classesBody.addEventListener('change', function(ev) {
        var input = ev.target.closest('.th-class-target-input');
        if (!input || !global.TrackingHubTargets) return;
        global.TrackingHubTargets.setClassTarget(
          input.getAttribute('data-target-yg'),
          input.getAttribute('data-target-cls'),
          input.getAttribute('data-target-subject'),
          input.value
        );
        TH.toast('Class target updated');
      });
      function toggleTeacherRow(row) {
        if (!row) return;
        var teacher = row.getAttribute('data-teacher');
        EXPANDED_TEACHER = EXPANDED_TEACHER === teacher ? null : teacher;
        renderClasses();
      }
      function openPupilRow(row) {
        if (!row) return;
        global.TrackingHubDrawer.open(row.getAttribute('data-pupil'), row.getAttribute('data-subject'), row);
      }
      classesBody.addEventListener('click', function(ev) {
        var row = ev.target.closest('.th-teacher-row');
        if (row) { toggleTeacherRow(row); return; }
        var prow = ev.target.closest('.th-pupil-row');
        if (prow) openPupilRow(prow);
      });
      if (global.TrackingHubA11y) {
        global.TrackingHubA11y.makeKeyboardActivatable(classesBody, '.th-teacher-row', toggleTeacherRow);
        global.TrackingHubA11y.makeKeyboardActivatable(classesBody, '.th-pupil-row', openPupilRow);
      }
    }

    var classesSearch = $('classes-teacher-search');
    if (classesSearch) classesSearch.addEventListener('input', renderClasses);

    var atRiskGrid = $('at-risk-grid');
    if (atRiskGrid) {
      atRiskGrid.addEventListener('click', function(ev) {
        var btn = ev.target.closest('.th-open-profile');
        if (!btn) return;
        global.TrackingHubDrawer.open(btn.getAttribute('data-pupil'), btn.getAttribute('data-subject'), btn);
      });
    }

    var atRiskSort = $('at-risk-sort');
    if (atRiskSort) {
      atRiskSort.addEventListener('change', function() {
        AT_RISK_SORT = atRiskSort.value;
        renderAtRisk();
      });
    }

    var atRiskFilters = $('at-risk-filters');
    if (atRiskFilters) {
      atRiskFilters.addEventListener('click', function(ev) {
        var ygBtn = ev.target.closest('[data-at-risk-yg]');
        var subBtn = ev.target.closest('[data-at-risk-subject]');
        var sevBtn = ev.target.closest('[data-at-risk-sev]');
        if (ygBtn) AT_RISK_FILTERS.yg = ygBtn.getAttribute('data-at-risk-yg') || '';
        if (subBtn) AT_RISK_FILTERS.subject = subBtn.getAttribute('data-at-risk-subject') || '';
        if (sevBtn) AT_RISK_FILTERS.severity = sevBtn.getAttribute('data-at-risk-sev') || '';
        if (ygBtn || subBtn || sevBtn) renderAtRisk();
      });
    }

    var pupilBody = $('pupil-list-body');
    if (pupilBody) {
      function openPupilListRow(row) {
        if (!row) return;
        global.TrackingHubDrawer.open(row.getAttribute('data-pupil'), row.getAttribute('data-subject'), row);
      }
      pupilBody.addEventListener('click', function(ev) {
        openPupilListRow(ev.target.closest('.th-pupil-row'));
      });
      if (global.TrackingHubA11y) {
        global.TrackingHubA11y.makeKeyboardActivatable(pupilBody, '.th-pupil-row', openPupilListRow);
      }
    }

    var pupilPerPage = $('pupil-list-per-page');
    if (pupilPerPage) {
      pupilPerPage.addEventListener('change', function() {
        PUPIL_PAGE.perPage = Number(pupilPerPage.value) || 50;
        PUPIL_PAGE.page = 1;
        renderPupilList();
      });
    }
    var pupilPrev = $('pupil-list-prev');
    var pupilNext = $('pupil-list-next');
    if (pupilPrev) pupilPrev.addEventListener('click', function() { if (PUPIL_PAGE.page > 1) { PUPIL_PAGE.page--; renderPupilList(); } });
    if (pupilNext) pupilNext.addEventListener('click', function() {
      var total = buildPupilSubjectRollups(TH.HUB.filteredRows).length;
      var pages = Math.ceil(total / PUPIL_PAGE.perPage);
      if (PUPIL_PAGE.page < pages) { PUPIL_PAGE.page++; renderPupilList(); }
    });

    var pupilExport = $('pupil-list-export');
    if (pupilExport) pupilExport.addEventListener('click', exportPupilListCsv);

    ['pivot-row', 'pivot-col', 'pivot-value'].forEach(function(id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('change', function() {
        PIVOT_STATE.row = $('pivot-row').value;
        PIVOT_STATE.col = $('pivot-col').value;
        PIVOT_STATE.value = $('pivot-value').value;
        renderPivot();
      });
    });

    var morePivot = $('th-more-pivot');
    if (morePivot) {
      morePivot.addEventListener('click', function(ev) {
        ev.preventDefault();
        var more = document.querySelector('.th-more-views');
        if (more) more.removeAttribute('open');
        TH.setView('pivot');
      });
    }
  }

  function init(hubApi) {
    TH = hubApi;
    initPivotControls();
    bindTabEvents();
  }

  global.TrackingHubTabs = {
    init: init,
    renderAll: renderAll,
    renderClasses: renderClasses,
    renderAtRisk: renderAtRisk,
    renderPupilList: renderPupilList,
    renderPivot: renderPivot,
    buildPupilSubjectRollups: buildPupilSubjectRollups
  };
})(window);
