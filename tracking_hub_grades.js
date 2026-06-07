/**
 * Tracking Hub — Phase 5: BGE descriptors + SQA pathway estimates
 */
(function(global) {
  'use strict';

  var BGE = {
    1: 'Working on targets',
    2: 'Not yet on track',
    3: 'On track',
    4: 'Above expectations'
  };

  function roundScore(v) {
    if (v == null || typeof v !== 'number' || v <= 0) return null;
    return Math.round(v * 100) / 100;
  }

  function bgeDescriptor(score) {
    var v = roundScore(score);
    if (v == null) return '—';
    var band = v < 1.5 ? 1 : v < 2.5 ? 2 : v < 3.25 ? 3 : 4;
    return BGE[band] + ' (' + v.toFixed(1) + ')';
  }

  function bgeShort(score) {
    var v = roundScore(score);
    if (v == null) return '—';
    if (v < 1.5) return 'Wt';
    if (v < 2.5) return 'NY';
    if (v < 3.25) return 'On';
    return 'Ab';
  }

  /** Illustrative senior-phase estimate from BGE average (guidance only). */
  function sqaPathwayEstimate(score, yg) {
    var v = roundScore(score);
    if (v == null) return '—';
    var y = String(yg || '').toLowerCase();
    if (y === 's1' || y === 's2') {
      if (v >= 3.25) return 'Strong BGE → likely N5 pathway';
      if (v >= 2.5) return 'Secure BGE → N4/N5 pathway';
      return 'Support needed → N4 focus';
    }
    if (y === 's3') {
      if (v >= 3.5) return 'Est. Higher A/B';
      if (v >= 3.0) return 'Est. N5 A/B';
      if (v >= 2.5) return 'Est. N5 C / N4';
      return 'Est. N4 / support';
    }
    if (v >= 3.5) return 'Est. Higher A/B';
    if (v >= 3.0) return 'Est. N5 A/B';
    if (v >= 2.5) return 'Est. N5 C';
    return 'Est. N4';
  }

  function pctAboveTarget(rows, target) {
    var t = typeof target === 'number' ? target : 3;
    var scored = (rows || []).filter(function(r) { return r.scoreAvg != null; });
    if (!scored.length) return null;
    var above = scored.filter(function(r) { return r.scoreAvg >= t; }).length;
    return Math.round((above / scored.length) * 100);
  }

  function scoreTitle(score, yg) {
    var v = roundScore(score);
    if (v == null) return 'No score';
    return bgeDescriptor(v) + ' · ' + sqaPathwayEstimate(v, yg);
  }

  global.TrackingHubGrades = {
    bgeDescriptor: bgeDescriptor,
    bgeShort: bgeShort,
    sqaPathwayEstimate: sqaPathwayEstimate,
    pctAboveTarget: pctAboveTarget,
    scoreTitle: scoreTitle
  };
})(window);
