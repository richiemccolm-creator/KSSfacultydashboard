/**
 * Tracking Hub — Faculty insights per subject (gaps, strengths, export, print).
 */
(function(global) {
  'use strict';

  var TH = null;
  var PROC = ['creating', 'presenting', 'evaluating'];
  var ATT = ['effort', 'behaviour', 'homelearning'];
  var DIM_KEYS = PROC.concat(ATT);
  var DIM_LABELS = ['Creating', 'Presenting', 'Evaluating', 'Effort', 'Behaviour', 'Home Learning'];
  var PROC_LABELS = ['Creating', 'Presenting', 'Evaluating'];
  var ATT_LABELS = ['Effort', 'Behaviour', 'Home Learning'];
  var SUBJECT_META = {
    drama: { label: 'Drama', color: '#4a7fd4', cls: 'drama' },
    art: { label: 'Art & Design', color: '#c0622a', cls: 'art' }
  };

  var LAST_INSIGHTS = null;
  var EXPANDED = false;

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function csvCell(v) {
    var txt = String(v == null ? '' : v).replace(/"/g, '""');
    return '"' + txt + '"';
  }

  function getTarget() {
    return global.TrackingHubTargets ? global.TrackingHubTargets.getFacultyTarget() : 3;
  }

  function rollupsForSubject(rows, subject) {
    var map = {};
    (rows || []).filter(function(r) { return r.subject === subject; }).forEach(function(r) {
      if (map[r.pupilKey]) return;
      var pupil = TH.HUB.pupilMap[r.pupilKey];
      var entry = pupil && pupil.subjects[subject];
      if (!entry) return;
      map[r.pupilKey] = {
        pupilKey: r.pupilKey,
        name: r.name,
        yg: r.yg,
        cls: r.cls,
        teacher: r.teacher,
        risk: entry.risk || TH.getRiskForPupil(entry.scores),
        scores: entry.scores || {}
      };
    });
    return Object.keys(map).map(function(k) { return map[k]; });
  }

  function classifyProcessAttitude(avgs) {
    var procVals = PROC.map(function(d) { return avgs[d]; }).filter(function(v) { return v != null; });
    var attVals = ATT.map(function(d) { return avgs[d]; }).filter(function(v) { return v != null; });
    if (!procVals.length || !attVals.length) return null;
    var procAvg = TH.avg(procVals);
    var attAvg = TH.avg(attVals);
    var procLow = procAvg <= 2.5;
    var attLow = attAvg <= 2.5;
    if (!procLow && !attLow) return 'strongBoth';
    if (procLow && !attLow) return 'processGap';
    if (!procLow && attLow) return 'attitudeGap';
    return 'bothConcern';
  }

  function computeSubjectInsight(rows, subject) {
    var rollups = rollupsForSubject(rows, subject);
    var subjRows = (rows || []).filter(function(r) { return r.subject === subject; });
    var meta = SUBJECT_META[subject];
    if (!rollups.length) {
      return { subject: subject, label: meta.label, color: meta.color, cls: meta.cls, empty: true };
    }

    var dimAvgs = {};
    DIM_KEYS.forEach(function(d) {
      dimAvgs[d] = TH.avg(rollups.map(function(p) { return p.risk.avgs[d]; }));
    });

    var procAvg = TH.avg(PROC.map(function(d) { return dimAvgs[d]; }).filter(function(v) { return v != null; }));
    var attAvg = TH.avg(ATT.map(function(d) { return dimAvgs[d]; }).filter(function(v) { return v != null; }));

    var ranked = DIM_KEYS.map(function(d, i) {
      return { key: d, label: DIM_LABELS[i], avg: dimAvgs[d] };
    }).filter(function(x) { return x.avg != null; }).sort(function(a, b) { return b.avg - a.avg; });

    var strongest = ranked[0] || null;
    var weakest = ranked.length ? ranked[ranked.length - 1] : null;

    var pressure = {};
    DIM_KEYS.forEach(function(d, i) {
      pressure[d] = {
        label: DIM_LABELS[i],
        count: rollups.filter(function(p) {
          var v = p.risk.avgs[d];
          return v != null && v <= 2.5;
        }).length
      };
    });

    var paSplit = { strongBoth: 0, processGap: 0, attitudeGap: 0, bothConcern: 0, unclassified: 0 };
    rollups.forEach(function(p) {
      var bucket = classifyProcessAttitude(p.risk.avgs);
      if (bucket) paSplit[bucket]++;
      else paSplit.unclassified++;
    });

    var tps = Array.from(new Set(subjRows.map(function(r) { return r.tp; }))).sort(TH.tpSort);
    var tpLabels = tps.map(function(tp) { return String(tp).toUpperCase(); });
    var procTrend = {};
    var attTrend = {};
    PROC.forEach(function(d) {
      procTrend[d] = tps.map(function(tp) {
        return TH.avg(subjRows.filter(function(r) { return r.tp === tp; }).map(function(r) { return r[d]; }));
      });
    });
    ATT.forEach(function(d) {
      attTrend[d] = tps.map(function(tp) {
        return TH.avg(subjRows.filter(function(r) { return r.tp === tp; }).map(function(r) { return r[d]; }));
      });
    });

    var atRisk = rollups.filter(function(p) { return p.risk.isAtRisk; }).length;
    var scored = subjRows.filter(function(r) { return r.scoreAvg != null; }).length;
    var coveragePct = subjRows.length ? Math.round((scored / subjRows.length) * 100) : 0;

    var byYg = {};
    rollups.forEach(function(p) {
      if (!byYg[p.yg]) byYg[p.yg] = { pupils: 0, atRisk: 0, procSum: 0, attSum: 0, n: 0 };
      var g = byYg[p.yg];
      g.pupils++;
      if (p.risk.isAtRisk) g.atRisk++;
      var pv = TH.avg(PROC.map(function(d) { return p.risk.avgs[d]; }).filter(function(v) { return v != null; }));
      var av = TH.avg(ATT.map(function(d) { return p.risk.avgs[d]; }).filter(function(v) { return v != null; }));
      if (pv != null) { g.procSum += pv; g.n++; }
      if (av != null) g.attSum += av;
    });
    Object.keys(byYg).forEach(function(yg) {
      var g = byYg[yg];
      g.procAvg = g.n ? g.procSum / g.n : null;
      g.attAvg = g.n ? g.attSum / g.n : null;
    });

    var callouts = buildCallouts({
      subject: subject,
      label: meta.label,
      rollups: rollups,
      dimAvgs: dimAvgs,
      procAvg: procAvg,
      attAvg: attAvg,
      strongest: strongest,
      weakest: weakest,
      pressure: pressure,
      paSplit: paSplit,
      tps: tps,
      procTrend: procTrend,
      attTrend: attTrend,
      byYg: byYg,
      atRisk: atRisk,
      target: getTarget()
    });

    return {
      subject: subject,
      label: meta.label,
      color: meta.color,
      cls: meta.cls,
      empty: false,
      pupilCount: rollups.length,
      atRisk: atRisk,
      coveragePct: coveragePct,
      dimAvgs: dimAvgs,
      dimAvgsArr: DIM_KEYS.map(function(d) { return dimAvgs[d]; }),
      procAvg: procAvg,
      attAvg: attAvg,
      strongest: strongest,
      weakest: weakest,
      pressure: pressure,
      pressureMax: Math.max.apply(null, DIM_KEYS.map(function(d) { return pressure[d].count; }).concat([1])),
      paSplit: paSplit,
      paSegments: [
        { key: 'strongBoth', label: 'Strong both', count: paSplit.strongBoth, color: '#22c55e' },
        { key: 'processGap', label: 'Process gap', count: paSplit.processGap, color: '#7c3aed' },
        { key: 'attitudeGap', label: 'Attitude gap', count: paSplit.attitudeGap, color: '#f59e0b' },
        { key: 'bothConcern', label: 'Both concern', count: paSplit.bothConcern, color: '#ef4444' }
      ].filter(function(s) { return s.count > 0; }),
      tpLabels: tpLabels,
      tps: tps,
      procTrend: procTrend,
      attTrend: attTrend,
      byYg: byYg,
      callouts: callouts,
      rollups: rollups
    };
  }

  function buildCallouts(ctx) {
    var out = [];
    var n = ctx.rollups.length;
    var target = ctx.target;

    if (ctx.weakest && ctx.strongest && ctx.weakest.key !== ctx.strongest.key) {
      var gap = ctx.strongest.avg - ctx.weakest.avg;
      if (gap >= 0.3) {
        out.push({
          severity: ctx.weakest.avg <= 2.5 ? 'high' : 'medium',
          title: 'Curriculum gap — ' + ctx.weakest.label,
          text: ctx.label + ': ' + ctx.weakest.label + ' averages ' + ctx.weakest.avg.toFixed(1) +
            ', ' + (gap).toFixed(1) + ' below ' + ctx.strongest.label + ' (' + ctx.strongest.avg.toFixed(1) + ').'
        });
      }
    }

    var pressureRank = DIM_KEYS.map(function(d) { return ctx.pressure[d]; })
      .sort(function(a, b) { return b.count - a.count; });
    if (pressureRank[0] && pressureRank[0].count > 0) {
      var pct = Math.round((pressureRank[0].count / n) * 100);
      out.push({
        severity: pct >= 30 ? 'high' : 'medium',
        title: 'Most pupils under pressure — ' + pressureRank[0].label,
        text: pressureRank[0].count + ' of ' + n + ' pupils (' + pct + '%) average ≤ 2.5 in ' + pressureRank[0].label + '.'
      });
    }

    if (ctx.procAvg != null && ctx.attAvg != null) {
      var diff = ctx.procAvg - ctx.attAvg;
      if (Math.abs(diff) >= 0.25) {
        if (diff > 0) {
          out.push({
            severity: ctx.attAvg <= 2.5 ? 'high' : 'medium',
            title: 'Engagement lagging process',
            text: 'Process avg ' + ctx.procAvg.toFixed(1) + ' vs attitude ' + ctx.attAvg.toFixed(1) +
              ' — consider classroom routines, effort and home learning support.'
          });
        } else {
          out.push({
            severity: ctx.procAvg <= 2.5 ? 'high' : 'medium',
            title: 'Curriculum skills lagging engagement',
            text: 'Attitude avg ' + ctx.attAvg.toFixed(1) + ' vs process ' + ctx.procAvg.toFixed(1) +
              ' — pupils are engaged but need support on Creating / Presenting / Evaluating.'
          });
        }
      }
    }

    if (ctx.tps.length >= 2) {
      var first = ctx.tps[0];
      var last = ctx.tps[ctx.tps.length - 1];
      var procFirst = TH.avg(PROC.map(function(d) { return ctx.procTrend[d][0]; }).filter(function(v) { return v != null; }));
      var procLast = TH.avg(PROC.map(function(d) {
        return ctx.procTrend[d][ctx.procTrend[d].length - 1];
      }).filter(function(v) { return v != null; }));
      if (procFirst != null && procLast != null) {
        var delta = procLast - procFirst;
        if (delta <= -0.15) {
          out.push({
            severity: 'medium',
            title: 'Process scores declining',
            text: 'Process average fell ' + Math.abs(delta).toFixed(1) + ' from ' +
              String(first).toUpperCase() + ' to ' + String(last).toUpperCase() + '.'
          });
        } else if (delta >= 0.15) {
          out.push({
            severity: 'low',
            title: 'Process improving over the year',
            text: 'Process average rose +' + delta.toFixed(1) + ' from ' +
              String(first).toUpperCase() + ' to ' + String(last).toUpperCase() + '.'
          });
        }
      }
      var attFirst = TH.avg(ATT.map(function(d) { return ctx.attTrend[d][0]; }).filter(function(v) { return v != null; }));
      var attLast = TH.avg(ATT.map(function(d) {
        return ctx.attTrend[d][ctx.attTrend[d].length - 1];
      }).filter(function(v) { return v != null; }));
      if (attFirst != null && attLast != null && attLast - attFirst <= -0.15) {
        out.push({
          severity: 'high',
          title: 'Effort / behaviour / HL trending down',
          text: 'Attitude average fell ' + Math.abs(attLast - attFirst).toFixed(1) + ' from ' +
            String(first).toUpperCase() + ' to ' + String(last).toUpperCase() + '.'
        });
      }
    }

    var ygKeys = Object.keys(ctx.byYg).sort();
    if (ygKeys.length > 1) {
      var worstYg = ygKeys.slice().sort(function(a, b) {
        return (ctx.byYg[b].atRisk / Math.max(ctx.byYg[b].pupils, 1)) -
          (ctx.byYg[a].atRisk / Math.max(ctx.byYg[a].pupils, 1));
      })[0];
      if (worstYg && ctx.byYg[worstYg].atRisk > 0) {
        out.push({
          severity: 'medium',
          title: worstYg.toUpperCase() + ' highest at-risk share',
          text: worstYg.toUpperCase() + ': ' + ctx.byYg[worstYg].atRisk + ' of ' +
            ctx.byYg[worstYg].pupils + ' pupils at risk in ' + ctx.label + '.'
        });
      }
    }

    if (ctx.procAvg != null && ctx.procAvg < target) {
      out.push({
        severity: ctx.procAvg <= 2.5 ? 'high' : 'low',
        title: 'Below faculty target (process)',
        text: 'Process average ' + ctx.procAvg.toFixed(1) + ' vs target ' + target.toFixed(1) + '.'
      });
    }

    var sevOrder = { high: 0, medium: 1, low: 2 };
    out.sort(function(a, b) { return (sevOrder[a.severity] || 9) - (sevOrder[b.severity] || 9); });
    return out.slice(0, 6);
  }

  function computeFacultyInsights(rows) {
    var subjects = [];
    if ((rows || []).some(function(r) { return r.subject === 'drama'; })) subjects.push('drama');
    if ((rows || []).some(function(r) { return r.subject === 'art'; })) subjects.push('art');
    var out = {
      generatedAt: new Date(),
      subjects: subjects,
      drama: computeSubjectInsight(rows, 'drama'),
      art: computeSubjectInsight(rows, 'art'),
      rowCount: (rows || []).length
    };
    LAST_INSIGHTS = out;
    return out;
  }

  function fmtAvg(v) {
    return v != null ? v.toFixed(1) : '—';
  }

  function pressureBarHtml(insight, limit) {
    var items = DIM_KEYS.map(function(d) { return insight.pressure[d]; })
      .sort(function(a, b) { return b.count - a.count; });
    if (limit) items = items.slice(0, limit);
    return items.map(function(item) {
      var w = Math.round((item.count / insight.pressureMax) * 100);
      return '<div class="th-fi-pressure-row">' +
        '<span class="th-fi-pressure-lbl">' + esc(item.label) + '</span>' +
        '<div class="th-fi-pressure-track"><div class="th-fi-pressure-fill" style="width:' + w +
        '%;background:' + insight.color + '"></div></div>' +
        '<span class="th-fi-pressure-val">' + item.count + '</span></div>';
    }).join('');
  }

  function calloutsHtml(callouts, limit) {
    var list = limit ? callouts.slice(0, limit) : callouts;
    if (!list.length) {
      return '<p class="th-muted" style="margin:0;font-size:11px">No significant gaps detected for current filters.</p>';
    }
    return '<div class="th-fi-callouts">' + list.map(function(c) {
      return '<div class="th-fi-callout sev-' + esc(c.severity) + '">' +
        '<div class="th-fi-callout-title">' + esc(c.title) + '</div>' +
        '<div class="th-fi-callout-text">' + esc(c.text) + '</div></div>';
    }).join('') + '</div>';
  }

  function subjectCardHtml(insight, compact, idPrefix) {
    var pid = idPrefix || (compact ? 'th-fi-compact-' : 'th-fi-modal-');
    if (insight.empty) {
      return '<div class="th-fi-subject th-fi-subject-' + insight.cls + ' th-fi-empty">' +
        '<div class="th-fi-subject-head"><span class="th-fi-subject-title">' + esc(insight.label) + '</span></div>' +
        '<p class="th-muted">No tracker data for current filters.</p></div>';
    }

    var strength = insight.strongest
      ? '<span class="th-fi-badge th-fi-badge-strong">' + esc(insight.strongest.label) + ' ' + fmtAvg(insight.strongest.avg) + '</span>'
      : '';
    var gap = insight.weakest && insight.weakest.avg <= 2.5
      ? '<span class="th-fi-badge th-fi-badge-gap">' + esc(insight.weakest.label) + ' ' + fmtAvg(insight.weakest.avg) + '</span>'
      : (insight.weakest
        ? '<span class="th-fi-badge th-fi-badge-watch">' + esc(insight.weakest.label) + ' ' + fmtAvg(insight.weakest.avg) + '</span>'
        : '');

    var chartsBlock = compact ?
      '<div class="th-fi-chart-card th-fi-chart-card-compact">' +
        '<div class="th-fi-chart-label">Dimension profile</div>' +
        '<div class="th-chart-wrap th-fi-chart-dim-mini"><canvas id="' + pid + insight.subject + '-dim"></canvas></div>' +
      '</div>' :
      '<div class="th-fi-charts">' +
        '<div class="th-fi-chart-card"><div class="th-fi-chart-label">Dimension averages</div>' +
          '<div class="th-chart-wrap th-fi-chart-dim"><canvas id="' + pid + insight.subject + '-dim"></canvas></div></div>' +
        '<div class="th-fi-chart-card"><div class="th-fi-chart-label">Process vs attitude</div>' +
          '<div class="th-chart-wrap th-fi-chart-donut"><canvas id="' + pid + insight.subject + '-pa"></canvas></div></div>' +
        '<div class="th-fi-chart-card"><div class="th-fi-chart-label">Process by TP</div>' +
          '<div class="th-chart-wrap th-fi-chart-trend"><canvas id="' + pid + insight.subject + '-proc"></canvas></div></div>' +
        '<div class="th-fi-chart-card"><div class="th-fi-chart-label">Attitude by TP</div>' +
          '<div class="th-chart-wrap th-fi-chart-trend"><canvas id="' + pid + insight.subject + '-att"></canvas></div></div>' +
      '</div>';

    return '<div class="th-fi-subject th-fi-subject-' + insight.cls + '">' +
      '<div class="th-fi-subject-head">' +
        '<span class="th-fi-subject-title">' + esc(insight.label) + '</span>' +
        '<span class="th-fi-subject-meta">' + insight.pupilCount + ' pupils · ' + insight.atRisk + ' at risk · ' + insight.coveragePct + '% coverage</span>' +
      '</div>' +
      '<div class="th-fi-summary-row">' +
        '<div class="th-fi-stat"><span class="th-fi-stat-val" style="color:' + insight.color + '">' + fmtAvg(insight.procAvg) + '</span><span class="th-fi-stat-lbl">Process</span></div>' +
        '<div class="th-fi-stat"><span class="th-fi-stat-val" style="color:#b45309">' + fmtAvg(insight.attAvg) + '</span><span class="th-fi-stat-lbl">Attitude</span></div>' +
        '<div class="th-fi-badges">' + strength + gap + '</div>' +
      '</div>' +
      '<div class="th-fi-pressure-block">' +
        '<div class="th-fi-block-title">Dimensions under pressure (≤ 2.5)</div>' +
        pressureBarHtml(insight, compact ? 4 : null) +
      '</div>' +
      chartsBlock +
      '<div class="th-fi-block-title">Insights</div>' +
      calloutsHtml(insight.callouts, compact ? 3 : null) +
    '</div>';
  }

  function renderSubjectCharts(insight, prefix) {
    if (!global.TrackingHubCharts || insight.empty) return;
    var Charts = global.TrackingHubCharts;
    var target = getTarget();
    var p = prefix || 'th-fi-modal-';

    var dimCanvas = document.getElementById(p + insight.subject + '-dim');
    if (dimCanvas) {
      Charts.renderSubjectDimBars(dimCanvas, DIM_LABELS, insight.dimAvgsArr, insight.color, target, p + insight.subject + '-dim');
    }

    var paCanvas = document.getElementById(p + insight.subject + '-pa');
    if (paCanvas && insight.paSegments.length) {
      Charts.renderProcessAttitudeDonut(paCanvas, insight.paSegments, p + insight.subject + '-pa');
    }

    var procCanvas = document.getElementById(p + insight.subject + '-proc');
    if (procCanvas && insight.tpLabels.length) {
      Charts.renderSubjectDimTrend(
        procCanvas,
        insight.tpLabels,
        PROC_LABELS,
        PROC.map(function(d) { return insight.procTrend[d]; }),
        p + insight.subject + '-proc'
      );
    }

    var attCanvas = document.getElementById(p + insight.subject + '-att');
    if (attCanvas && insight.tpLabels.length) {
      Charts.renderSubjectDimTrend(
        attCanvas,
        insight.tpLabels,
        ATT_LABELS,
        ATT.map(function(d) { return insight.attTrend[d]; }),
        p + insight.subject + '-att'
      );
    }
  }

  function filterLabel() {
    var fs = TH.FILTER_STATE;
    var parts = [];
    if (fs.yearGroups.length) parts.push(fs.yearGroups.join(', ').toUpperCase());
    if (fs.subjects.length === 1) parts.push(fs.subjects[0] === 'art' ? 'Art' : 'Drama');
    if (fs.classes.length) parts.push(fs.classes.join(', '));
    if (fs.trackingPeriods.length) parts.push(fs.trackingPeriods.map(function(t) { return String(t).toUpperCase(); }).join(', '));
    return parts.length ? parts.join(' · ') : 'All faculty data';
  }

  function renderFacultyInsights(rows) {
    var slot = document.getElementById('th-faculty-insights');
    var stamp = document.getElementById('th-fi-stamp');
    if (!slot) return;

    if (!rows || !rows.length) {
      slot.innerHTML = '<div class="th-fi-empty-state th-empty">Load cloud data and refresh to see faculty insights.</div>';
      if (stamp) stamp.textContent = '';
      LAST_INSIGHTS = null;
      return;
    }

    var insights = computeFacultyInsights(rows);
    var visible = insights.subjects.filter(function(s) {
      if (TH.FILTER_STATE.subjects.length === 1) return TH.FILTER_STATE.subjects[0] === s;
      return true;
    });

    if (!visible.length) {
      slot.innerHTML = '<div class="th-fi-empty-state th-empty">No subject data for current filters.</div>';
      return;
    }

    var gridCls = visible.length === 1 ? 'th-fi-grid th-fi-grid-single' : 'th-fi-grid';
    slot.innerHTML = '<div class="' + gridCls + '">' +
      visible.map(function(s) { return subjectCardHtml(insights[s], true); }).join('') +
      '</div>';

    if (stamp) {
      stamp.textContent = 'Updated ' + insights.generatedAt.toLocaleString() + ' · ' + filterLabel();
    }

    requestAnimationFrame(function() {
      visible.forEach(function(s) {
        var ins = insights[s];
        if (ins.empty) return;
        renderSubjectCharts(ins, 'th-fi-compact-');
      });
    });

    if (EXPANDED) renderExpandedModal(insights, visible);
  }

  function renderExpandedModal(insights, visible) {
    var body = document.getElementById('th-fi-modal-body');
    if (!body) return;
    var gridCls = visible.length === 1 ? 'th-fi-grid th-fi-grid-single' : 'th-fi-grid';
    body.innerHTML = '<div class="' + gridCls + '">' +
      visible.map(function(s) { return subjectCardHtml(insights[s], false); }).join('') +
      '</div>';
    requestAnimationFrame(function() {
      visible.forEach(function(s) { renderSubjectCharts(insights[s], 'th-fi-modal-'); });
    });
  }

  function openExpanded() {
    if (!LAST_INSIGHTS) {
      TH.toast('Load data first');
      return;
    }
    EXPANDED = true;
    var modal = document.getElementById('th-fi-modal');
    if (!modal) return;
    var visible = LAST_INSIGHTS.subjects.filter(function(s) {
      if (TH.FILTER_STATE.subjects.length === 1) return TH.FILTER_STATE.subjects[0] === s;
      return true;
    });
    renderExpandedModal(LAST_INSIGHTS, visible);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('th-modal-open');
  }

  function closeExpanded() {
    EXPANDED = false;
    var modal = document.getElementById('th-fi-modal');
    if (modal) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('th-modal-open');
  }

  function printHtml() {
    if (!LAST_INSIGHTS) return '';
    var filter = filterLabel();
    var session = global.TrackingHubSnapshot
      ? global.TrackingHubSnapshot.currentSessionLabel() : '';
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Faculty tracking insights</title>' +
      '<style>body{font-family:Inter,sans-serif;padding:28px;color:#0b1220;font-size:12px;line-height:1.5}' +
      'h1{font-size:20px;margin:0 0 4px;color:#1e2d4a}h2{font-size:14px;margin:24px 0 10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;color:#1e2d4a}' +
      '.meta{color:#64748b;font-size:11px;margin-bottom:20px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}' +
      '@media(max-width:720px){.grid{grid-template-columns:1fr}}' +
      '.card{border:1px solid #e2e8f0;border-radius:8px;padding:14px;page-break-inside:avoid}' +
      '.card.drama{border-top:3px solid #4a7fd4}.card.art{border-top:3px solid #c0622a}' +
      '.stats{display:flex;gap:16px;margin:10px 0}.stat strong{font-size:18px;display:block}' +
      '.stat span{font-size:10px;text-transform:uppercase;color:#64748b;letter-spacing:.06em}' +
      'table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #e2e8f0;padding:5px 8px;text-align:left;font-size:11px}' +
      'th{background:#f4f6fb;font-size:10px;text-transform:uppercase}' +
      '.bar-row{display:flex;align-items:center;gap:8px;margin:4px 0;font-size:11px}' +
      '.bar-lbl{width:90px;flex-shrink:0}.bar-track{flex:1;height:8px;background:#f1f4f9;border-radius:4px;overflow:hidden}' +
      '.bar-fill{height:100%;border-radius:4px}.callout{background:#fffbeb;border-left:3px solid #f59e0b;padding:8px 10px;margin:8px 0;border-radius:4px}' +
      '.callout.high{border-left-color:#ef4444;background:#fef2f2}.callout-title{font-weight:600;font-size:11px;margin-bottom:2px}' +
      '.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;margin-right:6px}' +
      '.badge-strong{background:#dcfce7;color:#166534}.badge-gap{background:#fee2e2;color:#b91c1c}</style></head><body>' +
      '<h1>Faculty Tracking Insights</h1>' +
      '<p class="meta">' + esc(session) + (session ? ' · ' : '') + esc(filter) +
      ' · Generated ' + esc(LAST_INSIGHTS.generatedAt.toLocaleString()) + '</p><div class="grid">';

    LAST_INSIGHTS.subjects.forEach(function(s) {
      var ins = LAST_INSIGHTS[s];
      if (ins.empty) return;
      html += '<div class="card ' + ins.cls + '"><h2>' + esc(ins.label) + '</h2>' +
        '<p class="meta">' + ins.pupilCount + ' pupils · ' + ins.atRisk + ' at risk · ' + ins.coveragePct + '% coverage</p>' +
        '<div class="stats">' +
          '<div class="stat"><strong style="color:' + ins.color + '">' + fmtAvg(ins.procAvg) + '</strong><span>Process</span></div>' +
          '<div class="stat"><strong style="color:#b45309">' + fmtAvg(ins.attAvg) + '</strong><span>Attitude</span></div>' +
        '</div>';
      if (ins.strongest) {
        html += '<span class="badge badge-strong">Strength: ' + esc(ins.strongest.label) + ' ' + fmtAvg(ins.strongest.avg) + '</span>';
      }
      if (ins.weakest) {
        html += '<span class="badge badge-gap">Gap: ' + esc(ins.weakest.label) + ' ' + fmtAvg(ins.weakest.avg) + '</span>';
      }
      html += '<h3 style="font-size:12px;margin:14px 0 6px">Dimensions under pressure</h3>';
      DIM_KEYS.forEach(function(d) {
        var item = ins.pressure[d];
        var w = Math.round((item.count / ins.pressureMax) * 100);
        html += '<div class="bar-row"><span class="bar-lbl">' + esc(item.label) + '</span>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + w + '%;background:' + ins.color + '"></div></div>' +
          '<span>' + item.count + '</span></div>';
      });
      html += '<h3 style="font-size:12px;margin:14px 0 6px">Dimension averages</h3><table><thead><tr><th>Dimension</th><th>Avg</th><th>Band</th></tr></thead><tbody>';
      DIM_KEYS.forEach(function(d, i) {
        var v = ins.dimAvgs[d];
        var band = v == null ? '—' : (v <= 2.5 ? 'Concern' : v <= 3.25 ? 'Secure' : 'Strong');
        html += '<tr><td>' + esc(DIM_LABELS[i]) + '</td><td>' + fmtAvg(v) + '</td><td>' + band + '</td></tr>';
      });
      html += '</tbody></table>';
      if (ins.tpLabels.length) {
        html += '<h3 style="font-size:12px;margin:14px 0 6px">Tracking period trends (process)</h3><table><thead><tr><th>TP</th>';
        PROC_LABELS.forEach(function(l) { html += '<th>' + esc(l) + '</th>'; });
        html += '</tr></thead><tbody>';
        ins.tps.forEach(function(tp, idx) {
          html += '<tr><td>' + esc(String(tp).toUpperCase()) + '</td>';
          PROC.forEach(function(d) {
            var v = ins.procTrend[d][idx];
            html += '<td>' + (v != null ? v.toFixed(2) : '—') + '</td>';
          });
          html += '</tr>';
        });
        html += '</tbody></table>';
      }
      html += '<h3 style="font-size:12px;margin:14px 0 6px">Key insights</h3>';
      ins.callouts.forEach(function(c) {
        html += '<div class="callout ' + esc(c.severity) + '"><div class="callout-title">' + esc(c.title) +
          '</div><div>' + esc(c.text) + '</div></div>';
      });
      html += '</div>';
    });

    html += '</div></body></html>';
    return html;
  }

  function printSummary() {
    if (!LAST_INSIGHTS) {
      TH.toast('Load data first');
      return;
    }
    var w = global.open('', '_blank', 'noopener');
    if (!w) {
      TH.toast('Allow pop-ups to print summary');
      return;
    }
    w.document.write(printHtml());
    w.document.close();
    w.focus();
    setTimeout(function() { w.print(); }, 350);
  }

  function exportExcelCsv() {
    if (!LAST_INSIGHTS) {
      TH.toast('Load data first');
      return;
    }
    var lines = [];
    var filter = filterLabel();

    lines.push(['Faculty Tracking Insights Export'].map(csvCell).join(','));
    lines.push(['Generated', LAST_INSIGHTS.generatedAt.toISOString()].map(csvCell).join(','));
    lines.push(['Filters', filter].map(csvCell).join(','));
    lines.push('');

    LAST_INSIGHTS.subjects.forEach(function(s) {
      var ins = LAST_INSIGHTS[s];
      if (ins.empty) return;
      lines.push([ins.label + ' — Summary'].map(csvCell).join(','));
      lines.push(['Metric', 'Value'].map(csvCell).join(','));
      lines.push(['Pupils', ins.pupilCount].map(csvCell).join(','));
      lines.push(['At risk', ins.atRisk].map(csvCell).join(','));
      lines.push(['Coverage %', ins.coveragePct].map(csvCell).join(','));
      lines.push(['Process average', ins.procAvg != null ? ins.procAvg.toFixed(2) : ''].map(csvCell).join(','));
      lines.push(['Attitude average', ins.attAvg != null ? ins.attAvg.toFixed(2) : ''].map(csvCell).join(','));
      lines.push(['Strength', ins.strongest ? ins.strongest.label + ' ' + ins.strongest.avg.toFixed(2) : ''].map(csvCell).join(','));
      lines.push(['Gap', ins.weakest ? ins.weakest.label + ' ' + ins.weakest.avg.toFixed(2) : ''].map(csvCell).join(','));
      lines.push('');

      lines.push(['Dimension averages'].map(csvCell).join(','));
      lines.push(['Dimension', 'Average', 'Band'].map(csvCell).join(','));
      DIM_KEYS.forEach(function(d, i) {
        var v = ins.dimAvgs[d];
        var band = v == null ? '' : (v <= 2.5 ? 'Concern' : v <= 3.25 ? 'Secure' : 'Strong');
        lines.push([DIM_LABELS[i], v != null ? v.toFixed(2) : '', band].map(csvCell).join(','));
      });
      lines.push('');

      lines.push(['Pupils under pressure (avg ≤ 2.5)'].map(csvCell).join(','));
      lines.push(['Dimension', 'Pupil count'].map(csvCell).join(','));
      DIM_KEYS.forEach(function(d) {
        lines.push([ins.pressure[d].label, ins.pressure[d].count].map(csvCell).join(','));
      });
      lines.push('');

      lines.push(['Process vs attitude split'].map(csvCell).join(','));
      lines.push(['Category', 'Pupil count'].map(csvCell).join(','));
      ins.paSegments.forEach(function(seg) {
        lines.push([seg.label, seg.count].map(csvCell).join(','));
      });
      lines.push('');

      if (ins.tps.length) {
        lines.push(['Process trends by TP'].map(csvCell).join(','));
        lines.push(['TP'].concat(PROC_LABELS).map(csvCell).join(','));
        ins.tps.forEach(function(tp, idx) {
          lines.push([String(tp).toUpperCase()].concat(PROC.map(function(d) {
            var v = ins.procTrend[d][idx];
            return v != null ? v.toFixed(2) : '';
          })).map(csvCell).join(','));
        });
        lines.push('');
        lines.push(['Attitude trends by TP'].map(csvCell).join(','));
        lines.push(['TP'].concat(ATT_LABELS).map(csvCell).join(','));
        ins.tps.forEach(function(tp, idx) {
          lines.push([String(tp).toUpperCase()].concat(ATT.map(function(d) {
            var v = ins.attTrend[d][idx];
            return v != null ? v.toFixed(2) : '';
          })).map(csvCell).join(','));
        });
        lines.push('');
      }

      lines.push(['Auto insights'].map(csvCell).join(','));
      lines.push(['Severity', 'Title', 'Detail'].map(csvCell).join(','));
      ins.callouts.forEach(function(c) {
        lines.push([c.severity, c.title, c.text].map(csvCell).join(','));
      });
      lines.push('');
    });

    lines.push(['Pupil-level data'].map(csvCell).join(','));
    lines.push(['Subject', 'Pupil', 'Year', 'Class', 'Teacher', 'Process avg', 'Attitude avg', 'At risk', 'Low dims',
      'Creating', 'Presenting', 'Evaluating', 'Effort', 'Behaviour', 'Home Learning'].map(csvCell).join(','));
    LAST_INSIGHTS.subjects.forEach(function(s) {
      var ins = LAST_INSIGHTS[s];
      if (ins.empty) return;
      ins.rollups.forEach(function(p) {
        var procV = TH.avg(PROC.map(function(d) { return p.risk.avgs[d]; }).filter(function(v) { return v != null; }));
        var attV = TH.avg(ATT.map(function(d) { return p.risk.avgs[d]; }).filter(function(v) { return v != null; }));
        lines.push([
          ins.label, p.name, p.yg, p.cls, p.teacher,
          procV != null ? procV.toFixed(2) : '',
          attV != null ? attV.toFixed(2) : '',
          p.risk.isAtRisk ? 'Yes' : 'No',
          p.risk.lowCount || 0
        ].concat(DIM_KEYS.map(function(d) {
          var v = p.risk.avgs[d];
          return v != null ? v.toFixed(2) : '';
        })).map(csvCell).join(','));
      });
    });

    var blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'faculty-tracking-insights-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    TH.toast('Insights exported for Excel');
  }

  function bindEvents() {
    var expandBtn = document.getElementById('th-fi-expand');
    var printBtn = document.getElementById('th-fi-print');
    var exportBtn = document.getElementById('th-fi-export');
    var modalPrintBtn = document.getElementById('th-fi-modal-print');
    var modalExportBtn = document.getElementById('th-fi-modal-export');
    var modal = document.getElementById('th-fi-modal');
    if (expandBtn) expandBtn.addEventListener('click', openExpanded);
    if (printBtn) printBtn.addEventListener('click', printSummary);
    if (exportBtn) exportBtn.addEventListener('click', exportExcelCsv);
    if (modalPrintBtn) modalPrintBtn.addEventListener('click', printSummary);
    if (modalExportBtn) modalExportBtn.addEventListener('click', exportExcelCsv);
    if (modal) {
      modal.querySelectorAll('[data-close-fi]').forEach(function(el) {
        el.addEventListener('click', closeExpanded);
      });
    }
    document.addEventListener('keydown', function(ev) {
      if (ev.key === 'Escape' && EXPANDED) closeExpanded();
    });
  }

  function init(hubApi) {
    TH = hubApi;
    bindEvents();
  }

  global.TrackingHubInsights = {
    init: init,
    render: renderFacultyInsights,
    compute: computeFacultyInsights,
    printSummary: printSummary,
    exportExcelCsv: exportExcelCsv,
    getLastInsights: function() { return LAST_INSIGHTS; }
  };
})(window);
