/**
 * Shared logic: tracker → report builder export, comment suggestions, attitude bank.
 */
(function (global) {
  'use strict';

  var EXPORT_KEYS = {
    drama: 'bge_drama_tracker_export_v1',
    art: 'bge_art_tracker_export_v1'
  };

  var YEAR_PREFIX = { S1: 'A', S2: 'B', S3: 'C' };

  var PROC_DIM_TO_CPE = {
    drama: { creating: 'Creating', presenting: 'Presenting', evaluating: 'Evaluating' },
    art: { creating: 'EC', presenting: 'EC', evaluating: 'RA' }
  };

  /* CPE maps mirror the report builders — used only for tracker suggestions */
  var CPE_MAPS = {
    drama: {"A1":"Presenting","A2":"Creating","A3":"Creating","A4":"Presenting","A5":"Presenting","A6":"Presenting","A7":"Creating","A8":"Evaluating","A9":"Creating","A10":"Presenting","A11":"Presenting","A12":"Creating","A13":"Creating","A14":"Creating","A15":"Creating","A16":"Presenting","A17":"Presenting","A18":"Evaluating","A19":"Evaluating","A20":"Presenting","A21":"Creating","A22":"Creating","A23":"Presenting","A24":"Presenting","A25":"Presenting","A26":"Creating","A27":"Creating","A28":"Evaluating","A29":"Creating","A30":"Creating","A31":"Creating","A32":"Presenting","A33":"Creating","A34":"Evaluating","A35":"Creating","A36":"Presenting","A37":"Evaluating","A38":"Creating","A39":"Presenting","A40":"Presenting","A41":"Creating","A42":"Creating","A43":"Presenting","A44":"Presenting","A45":"Evaluating","B1":"Creating","B2":"Creating","B3":"Creating","B4":"Presenting","B5":"Evaluating","B6":"Presenting","B7":"Presenting","B8":"Creating","B9":"Creating","B10":"Presenting","B11":"Presenting","B12":"Creating","B13":"Presenting","B14":"Creating","B15":"Creating","B16":"Presenting","B17":"Presenting","B18":"Evaluating","B19":"Creating","B20":"Creating","B21":"Presenting","B22":"Presenting","B23":"Evaluating","B24":"Creating","B25":"Presenting","B26":"Presenting","B27":"Creating","B28":"Creating","B29":"Creating","B30":"Creating","B31":"Creating","B32":"Presenting","B33":"Creating","B34":"Evaluating","B35":"Presenting","B36":"Creating","B37":"Creating","B38":"Evaluating","B39":"Creating","B40":"Presenting","B41":"Presenting","B42":"Creating","B43":"Creating","B44":"Creating","B45":"Presenting","C1":"Presenting","C2":"Creating","C3":"Creating","C4":"Presenting","C5":"Presenting","C6":"Presenting","C7":"Evaluating","C8":"Presenting","C9":"Creating","C10":"Creating","C11":"Creating","C12":"Presenting","C13":"Presenting","C14":"Presenting","C15":"Creating","C16":"Presenting","C17":"Creating","C18":"Presenting","C19":"Creating","C20":"Evaluating","C21":"Creating","C22":"Creating","C23":"Creating","C24":"Presenting","C25":"Evaluating","C26":"Presenting","C27":"Presenting","C28":"Creating","C29":"Creating","C30":"Presenting","C31":"Creating","C32":"Creating","C33":"Creating","C34":"Presenting","C35":"Evaluating","C36":"Creating","C37":"Creating","C38":"Creating","C39":"Presenting","C40":"Presenting","C41":"Creating","C42":"Presenting","C43":"Evaluating","C44":"Presenting","C45":"Creating"},
    art: {"A1":"EC","A2":"EC","A3":"EC","A4":"EC","A5":"EC","A6":"RA","A7":"EC","A8":"EC","A9":"EC","A10":"EC","A11":"RA","A12":"EC","A13":"EC","A14":"RA","A15":"RA","A16":"EC","A17":"EC","A18":"EC","A19":"EC","A20":"RA","A21":"EC","A22":"EC","A23":"RA","A24":"EC","A25":"EC","A26":"EC","A27":"EC","A28":"EC","A29":"RA","A30":"EC","A31":"EC","A32":"EC","A33":"EC","A34":"EC","A35":"RA","A36":"RA","A37":"EC","A38":"EC","A39":"EC","A40":"EC","A41":"EC","A42":"RA","A43":"EC","A44":"EC","A45":"RA","B1":"EC","B2":"EC","B3":"EC","B4":"EC","B5":"EC","B6":"RA","B7":"EC","B8":"EC","B9":"RA","B10":"EC","B11":"EC","B12":"EC","B13":"RA","B14":"EC","B15":"EC","B16":"EC","B17":"EC","B18":"EC","B19":"EC","B20":"RA","B21":"EC","B22":"EC","B23":"RA","B24":"EC","B25":"EC","B26":"EC","B27":"RA","B28":"RA","B29":"RA","B30":"EC","B31":"EC","B32":"EC","B33":"EC","B34":"EC","B35":"RA","B36":"RA","B37":"EC","B38":"EC","B39":"EC","B40":"EC","B41":"RA","B42":"EC","B43":"EC","B44":"EC","B45":"RA","C1":"EC","C2":"EC","C3":"EC","C4":"EC","C5":"EC","C6":"RA","C7":"EC","C8":"EC","C9":"RA","C10":"EC","C11":"RA","C12":"RA","C13":"EC","C14":"EC","C15":"EC","C16":"EC","C17":"EC","C18":"RA","C19":"EC","C20":"EC","C21":"EC","C22":"RA","C23":"EC","C24":"RA","C25":"RA","C26":"EC","C27":"RA","C28":"EC","C29":"EC","C30":"EC","C31":"EC","C32":"EC","C33":"EC","C34":"RA","C35":"RA","C36":"RA","C37":"EC","C38":"EC","C39":"EC","C40":"RA","C41":"EC","C42":"RA","C43":"RA","C44":"EC","C45":"EC"}
  };

  var ATTITUDE_TEXT = {
    drama: {
      AT1: 'X shows a positive attitude in Drama and is willing to try new activities, even when finding them challenging.',
      AT2: 'X engages well in small-group tasks and contributes when working with peers in a supported setting.',
      AT3: 'X demonstrates reasonable effort in practical work and responds well to encouragement and feedback.',
      AT4: 'X is encouraged to maintain focus during lessons and avoid distracting others, so that learning time is used effectively.',
      AT5: 'X is encouraged to complete home learning tasks on time, as this supports progress in Drama.'
    },
    art: {
      AT1: 'X shows a positive attitude in Art & Design and is willing to try new activities, even when finding them challenging.',
      AT2: 'X engages well in small-group tasks and contributes when working with peers in a supported setting.',
      AT3: 'X demonstrates reasonable effort in practical work and responds well to encouragement and feedback.',
      AT4: 'X is encouraged to maintain focus during lessons and avoid distracting others, so that learning time is used effectively.',
      AT5: 'X is encouraged to complete home learning tasks on time, as this supports progress in Art & Design.'
    }
  };

  var SECTION_HINTS = {
    strengths: 'Optional — select only what you could defend in a conversation with parents.',
    aod: 'Focus on 2–4 specific gaps. Avoid repeating the same theme.',
    next_steps: 'Forward-looking actions. Should connect to AoD but not duplicate it.',
    attitude: 'Effort, behaviour and home learning — use when subject strengths are limited.',
    additional: 'Attendance, pastoral context, or a brief honest framing sentence.'
  };

  var WRITING_GUIDE = 'Select Progress and CfE level first — this creates the opening progress sentence (e.g. "Jamie is on track at Second Level."). Strengths are optional — empty sections are omitted from export. Aim for 0–3 strengths, 2–4 areas of development, and 2–3 next steps.';

  var TRACK_STATUSES = [
    { id: 'working_on_targets', label: 'Working on personal targets' },
    { id: 'not_yet_on_track', label: 'Not yet on track' },
    { id: 'on_track', label: 'On track' },
    { id: 'performing_above', label: 'Performing above' }
  ];

  var EAL_SNIPPET = {
    drama: 'NAME is an EAL learner and is building confidence in spoken English through drama activities.',
    art: 'NAME is an EAL learner and is developing vocabulary and confidence in expressive arts.'
  };

  function processAvg(dimAvgs) {
    if (!dimAvgs) return null;
    var vals = ['creating', 'presenting', 'evaluating']
      .map(function (d) { return dimAvgs[d]; })
      .filter(function (v) { return v != null; });
    if (!vals.length) return null;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  }

  function suggestTrackStatus(dimAvgs) {
    var proc = processAvg(dimAvgs);
    if (proc == null) return '';
    if (proc >= 3.5) return 'performing_above';
    if (proc >= 2.5) return 'on_track';
    if (proc >= 2.0) return 'not_yet_on_track';
    return 'working_on_targets';
  }

  function buildProgressSentence(p) {
    if (!p || !p.firstName || !p.cfeLevel || !p.trackStatus) return null;
    var name = p.firstName;
    var level = p.cfeLevel;
    var phrases = {
      working_on_targets: name + ' is working on personal targets at ' + level + '.',
      not_yet_on_track: name + ' is not yet on track at ' + level + '.',
      on_track: name + ' is on track at ' + level + '.',
      performing_above: name + ' is performing above expectations at ' + level + '.'
    };
    return phrases[p.trackStatus] || null;
  }

  function getEalSnippet(subject, firstName) {
    var tpl = EAL_SNIPPET[subject] || EAL_SNIPPET.drama;
    return tpl.replace(/NAME/g, firstName || 'They');
  }

  function getAttitudeBank(subject) {
    return ATTITUDE_TEXT[subject] || ATTITUDE_TEXT.drama;
  }

  function codeToSection(code) {
    if (!code) return null;
    if (code.indexOf('AT') === 0) return 'attitude';
    var num = parseInt(code.slice(1), 10);
    if (isNaN(num)) return null;
    if (num <= 15) return 'strengths';
    if (num <= 30) return 'aod';
    return 'next_steps';
  }

  function codesInRange(cpeMap, prefix, start, end, category) {
    var out = [];
    for (var n = start; n <= end; n++) {
      var code = prefix + n;
      if (cpeMap[code] === category) out.push(code);
    }
    return out;
  }

  function pickUnused(list, used) {
    for (var i = 0; i < list.length; i++) {
      if (used.indexOf(list[i]) === -1) return list[i];
    }
    return null;
  }

  function suggestCodes(subject, year, dimAvgs) {
    var prefix = YEAR_PREFIX[year];
    if (!prefix) return { strengths: [], aod: [], next_steps: [], attitude: [] };

    var cpeMap = CPE_MAPS[subject];
    var dimToCpe = PROC_DIM_TO_CPE[subject];
    var used = [];
    var strengths = [];
    var aod = [];
    var nextSteps = [];
    var attitude = [];

    ['creating', 'presenting', 'evaluating'].forEach(function (dim) {
      var avg = dimAvgs && dimAvgs[dim];
      if (avg == null) return;
      var cat = dimToCpe[dim];
      if (avg >= 3) {
        var sCode = pickUnused(codesInRange(cpeMap, prefix, 1, 15, cat), used);
        if (sCode) { strengths.push(sCode); used.push(sCode); }
      }
      if (avg <= 2.5) {
        var aCode = pickUnused(codesInRange(cpeMap, prefix, 16, 30, cat), used);
        if (aCode) { aod.push(aCode); used.push(aCode); }
        var nCode = pickUnused(codesInRange(cpeMap, prefix, 31, 45, cat), used);
        if (nCode) { nextSteps.push(nCode); used.push(nCode); }
      }
    });

    if (dimAvgs && dimAvgs.effort != null && dimAvgs.effort >= 3) {
      attitude.push('AT1');
    } else if (dimAvgs && dimAvgs.effort != null && dimAvgs.effort >= 2.5 && strengths.length === 0) {
      attitude.push('AT3');
    }
    if (dimAvgs && dimAvgs.behaviour != null && dimAvgs.behaviour <= 2.5) {
      attitude.push('AT4');
    }
    if (dimAvgs && dimAvgs.homelearning != null && dimAvgs.homelearning <= 2.5) {
      attitude.push('AT5');
    }

    return {
      strengths: strengths.slice(0, 3),
      aod: aod.slice(0, 4),
      next_steps: nextSteps.slice(0, 3),
      attitude: attitude
    };
  }

  function computeDimAvgs(scoresByTp, tpIds) {
    var dims = ['creating', 'presenting', 'evaluating', 'effort', 'behaviour', 'homelearning'];
    var dimScores = {};
    dims.forEach(function (d) { dimScores[d] = []; });

    (tpIds || []).forEach(function (tpId) {
      var sc = (scoresByTp && scoresByTp[tpId]) || {};
      dims.forEach(function (d) {
        if (sc[d] > 0) dimScores[d].push(sc[d]);
      });
    });

    var dimAvgs = {};
    dims.forEach(function (d) {
      dimAvgs[d] = dimScores[d].length
        ? dimScores[d].reduce(function (a, b) { return a + b; }, 0) / dimScores[d].length
        : null;
    });
    return dimAvgs;
  }

  function buildTrackerExportEntry(subject, pupil, year, scoresByTp, tpIds, extra) {
    var dimAvgs = computeDimAvgs(scoresByTp, tpIds);
    var suggested = suggestCodes(subject, year, dimAvgs);
    var codes = suggested.strengths
      .concat(suggested.aod)
      .concat(suggested.next_steps)
      .concat(suggested.attitude);

    var parts = (pupil.name || '').trim().split(/\s+/);
    var entry = {
      firstName: parts[0] || 'Unknown',
      lastName: parts.slice(1).join(' ') || '',
      year: year,
      dimAvgs: dimAvgs,
      suggestedCodes: codes,
      benchmarks: codes,
      noStrengthsSuggested: suggested.strengths.length === 0,
      trackStatus: suggestTrackStatus(dimAvgs)
    };

    if (extra) {
      if (extra.cfeLevel) entry.cfeLevel = extra.cfeLevel;
      if (extra.notes) entry.notes = extra.notes;
      if (extra.isEal) entry.isEal = true;
    }
    return entry;
  }

  function emptySelections() {
    return { strengths: [], aod: [], next_steps: [], attitude: [] };
  }

  function hydrateSelections(selections) {
    var s = selections || {};
    return {
      strengths: s.strengths || [],
      aod: s.aod || [],
      next_steps: s.next_steps || [],
      attitude: s.attitude || []
    };
  }

  var THEME_OVERLAP_PHRASES = [
    'voice, movement, and expression',
    'voice and movement',
    'imaginative ideas',
    'short dramatic narratives',
    'observational drawing',
    'proportion, scale',
    'colour mixing',
    'tonal variation',
    'working from scripts',
    'timing, cues, and delivery',
    'group work',
    'audience engagement',
    'character more convincingly',
    'real and imaginary scenarios'
  ];

  function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function lowerFirst(str) {
    if (!str) return str;
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  function stripOpener(sentence, firstName) {
    var name = escapeRegExp(firstName);
    var patterns = [
      { type: 'encouraged', re: new RegExp('^' + name + '\\s+is encouraged to\\s+', 'i') },
      { type: 'could', re: new RegExp('^' + name + '\\s+could\\s+', 'i') },
      { type: 'should', re: new RegExp('^' + name + '\\s+should\\s+', 'i') },
      { type: 'needs', re: new RegExp('^' + name + '\\s+needs to\\s+', 'i') },
      { type: 'would_benefit', re: new RegExp('^' + name + '\\s+would benefit from\\s+', 'i') }
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = sentence.match(patterns[i].re);
      if (m) {
        return { type: patterns[i].type, rest: sentence.slice(m[0].length) };
      }
    }
    return { type: null, rest: sentence };
  }

  function rewriteOpener(type, firstName, rest, duplicateIndex) {
    if (duplicateIndex <= 0) {
      return firstName + ' is encouraged to ' + rest;
    }
    if (type === 'encouraged') {
      var alts = [
        function () { return firstName + ' should also ' + rest; },
        function () { return 'They could also ' + lowerFirst(rest); },
        function () { return 'A further focus is for ' + firstName + ' to ' + rest; },
        function () { return 'Next, ' + firstName + ' should ' + rest; }
      ];
      return alts[(duplicateIndex - 1) % alts.length]();
    }
    if (type === 'could') {
      var couldAlts = [
        function () { return firstName + ' should also ' + rest; },
        function () { return 'It would help if ' + firstName + ' could ' + rest; },
        function () { return firstName + ' is encouraged to ' + rest; }
      ];
      return couldAlts[(duplicateIndex - 1) % couldAlts.length]();
    }
    if (type === 'should') {
      var shouldAlts = [
        function () { return firstName + ' could also ' + rest; },
        function () { return 'Continuing this focus, ' + firstName + ' should ' + rest; },
        function () { return firstName + ' is encouraged to ' + rest; }
      ];
      return shouldAlts[(duplicateIndex - 1) % shouldAlts.length]();
    }
    if (type === 'needs') {
      return (duplicateIndex === 1 ? firstName + ' should also ' : 'They also need to ') + rest;
    }
    if (type === 'would_benefit') {
      return (duplicateIndex === 1 ? firstName + ' should also ' : firstName + ' is encouraged to ') + rest;
    }
    return sentence;
  }

  function rebuildOpener(type, firstName, rest) {
    if (type === 'encouraged') return firstName + ' is encouraged to ' + rest;
    if (type === 'could') return firstName + ' could ' + rest;
    if (type === 'should') return firstName + ' should ' + rest;
    if (type === 'needs') return firstName + ' needs to ' + rest;
    if (type === 'would_benefit') return firstName + ' would benefit from ' + rest;
    return rest;
  }

  function dedupeOpeners(sentences, firstName) {
    var counts = { encouraged: 0, could: 0, should: 0, needs: 0, would_benefit: 0 };
    return sentences.map(function (sentence) {
      var parsed = stripOpener(sentence, firstName);
      if (!parsed.type) return sentence;
      var n = counts[parsed.type]++;
      if (n === 0) {
        return rebuildOpener(parsed.type, firstName, parsed.rest);
      }
      return rewriteOpener(parsed.type, firstName, parsed.rest, n);
    });
  }

  function joinComposed(sentences) {
    if (!sentences.length) return '';
    return sentences.join(' ');
  }

  /**
   * Rule-based stitching: vary repeated openers, then join with spaces.
   * @param {string[]} sentences - already personalised (X → name)
   * @param {{ firstName?: string }} options
   * @returns {string}
   */
  function composeSectionSentences(sentences, options) {
    var list = (sentences || []).filter(function (s) { return s && String(s).trim(); });
    if (!list.length) return '';
    var firstName = (options && options.firstName) || 'They';
    return joinComposed(dedupeOpeners(list, firstName));
  }

  function normaliseForOverlap(text) {
    return String(text).toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Detect shared themes between AoD and Next Steps (preview warnings).
   * @param {string[]} aodSentences
   * @param {string[]} nextStepSentences
   * @returns {string[]} human-readable theme labels
   */
  function detectAodNextStepsOverlap(aodSentences, nextStepSentences) {
    var aod = (aodSentences || []).map(normaliseForOverlap);
    var next = (nextStepSentences || []).map(normaliseForOverlap);
    if (!aod.length || !next.length) return [];

    var found = [];
    THEME_OVERLAP_PHRASES.forEach(function (phrase) {
      var p = phrase.toLowerCase();
      var inAod = aod.some(function (s) { return s.indexOf(p) !== -1; });
      var inNext = next.some(function (s) { return s.indexOf(p) !== -1; });
      if (inAod && inNext) found.push(phrase);
    });

    return found;
  }

  function formatOverlapWarningHtml(themes) {
    if (!themes || !themes.length) return '';
    var list = themes.slice(0, 3).map(function (t) {
      return '<li>' + String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</li>';
    }).join('');
    var more = themes.length > 3 ? ' (+' + (themes.length - 3) + ' more)' : '';
    return '<div class="preview-overlap-warn" style="margin:10px 0 14px;padding:10px 12px;background:#fff8e6;border:1px solid #f0d78c;border-radius:6px;font-size:.75rem;color:#7a5c00;line-height:1.5">' +
      '<strong style="display:block;margin-bottom:4px">Overlapping themes in Areas of Development and Next Steps</strong>' +
      '<span>Consider removing or swapping a comment so these sections do not repeat the same focus' + more + ':</span>' +
      '<ul style="margin:6px 0 0 16px;padding:0">' + list + '</ul></div>';
  }

  function applySuggestedToPupil(pupil, entry, replace) {
    pupil.selections = pupil.selections || emptySelections();
    if (replace) {
      pupil.selections = emptySelections();
    }

    var prefix = YEAR_PREFIX[pupil.year];
    var codes = entry.suggestedCodes || entry.benchmarks || [];
    codes.forEach(function (code) {
      if (code.indexOf('AT') !== 0 && prefix && code.charAt(0) !== prefix) return;
      var key = codeToSection(code);
      if (!key || !pupil.selections[key]) return;
      if (pupil.selections[key].indexOf(code) === -1) {
        pupil.selections[key].push(code);
      }
    });

    pupil.trackerImport = true;
    pupil.noStrengthsSuggested = !!entry.noStrengthsSuggested;
    if (entry.cfeLevel && !pupil.cfeLevel) pupil.cfeLevel = entry.cfeLevel;
    if (entry.trackStatus) pupil.trackStatus = entry.trackStatus;
    if (entry.isEal) pupil.isEal = true;
    if (entry.notes && !pupil.additionalComments) pupil.additionalComments = entry.notes;
  }

  global.ReportBuilderBridge = {
    EXPORT_KEYS: EXPORT_KEYS,
    SECTION_HINTS: SECTION_HINTS,
    WRITING_GUIDE: WRITING_GUIDE,
    TRACK_STATUSES: TRACK_STATUSES,
    getAttitudeBank: getAttitudeBank,
    getEalSnippet: getEalSnippet,
    buildProgressSentence: buildProgressSentence,
    suggestTrackStatus: suggestTrackStatus,
    codeToSection: codeToSection,
    suggestCodes: suggestCodes,
    computeDimAvgs: computeDimAvgs,
    buildTrackerExportEntry: buildTrackerExportEntry,
    emptySelections: emptySelections,
    hydrateSelections: hydrateSelections,
    applySuggestedToPupil: applySuggestedToPupil,
    composeSectionSentences: composeSectionSentences,
    detectAodNextStepsOverlap: detectAodNextStepsOverlap,
    formatOverlapWarningHtml: formatOverlapWarningHtml
  };
})(typeof window !== 'undefined' ? window : globalThis);
