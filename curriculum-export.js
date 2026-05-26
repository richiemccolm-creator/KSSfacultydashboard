/**
 * Faculty Curriculum Handbook export — print/PDF preview and Word download.
 * Reads MODERATION_UNITS, SLIDE_DATA, vocab arrays from faculty-hub.html (window globals).
 * Uses CURRICULUM_TPS from curriculum-units.js for map tables.
 */
/* global JSZip */
(function () {
  'use strict';

  var SUBJECTS = [
    { key: 'drama', label: 'Drama', color: '#1e2d4a', accent: '#4a7fd4', tpsKey: 'drama', years: ['s1', 's2', 's3'] },
    { key: 'ad', label: 'Art & Design', color: '#92400e', accent: '#f59e0b', tpsKey: 'art', years: ['s1', 's2', 's3'] },
    { key: 'photo', label: 'Photography', color: '#0f766e', accent: '#14b8a6', years: ['npa-s3', 'npa-s4', 'higher'] }
  ];

  var YEAR_LABELS = {
    s1: 'S1', s2: 'S2', s3: 'S3',
    'npa-s3': 'NPA S3', 'npa-s4': 'NPA S4', higher: 'Higher'
  };

  var PHOTO_TP_KEYS = { 'npa-s3': 'npas3', 'npa-s4': 'npas4', higher: 'higher' };

  function getData() {
    return {
      moderation: window.MODERATION_UNITS || {},
      slides: window.SLIDE_DATA || {},
      dramaVocab: window.DRAMA_VOCAB || [],
      adVocab: window.AD_VOCAB || [],
      tps: window.CURRICULUM_TPS || {}
    };
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function decodeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"');
  }

  function escXml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function slideKeyFromUnitId(unitId) {
    if (!unitId) return null;
    if (unitId.indexOf('ad-') === 0) return 'slide-art-' + unitId.slice(3);
    if (unitId.indexOf('photo-') === 0) return null;
    return 'slide-' + unitId;
  }

  function mergeUnit(unit, slides) {
    var slideKey = slideKeyFromUnitId(unit.id);
    var slide = slideKey ? slides[slideKey] : null;
    return {
      id: unit.id,
      subject: unit.subject,
      year: unit.year,
      num: unit.num,
      title: decodeHtml(unit.title || (slide && slide.title) || ''),
      timing: unit.timing || (slide && slide.timing) || '',
      learningIntentions: unit.learningIntentions || (slide && slide.lis) || [],
      successCriteria: unit.successCriteria || (slide && slide.scs) || [],
      eos: unit.eos || (slide && slide.eos) || [],
      assessment: unit.assessment || [],
      assessmentDetail: (slide && slide.assessment) || unit.assessment || [],
      vocab: (slide && slide.vocab) || [],
      meta_skills: (slide && slide.meta_skills) || [],
      meta_notes: (slide && slide.meta_notes) || [],
      lit: unit.lit || [],
      mnu: unit.mnu || [],
      literacyFocus: unit.literacyFocus || null,
      numeracyFocus: unit.numeracyFocus || null
    };
  }

  function unitsForSubjectYear(moderation, subjectKey, year) {
    var list = moderation[subjectKey] || [];
    return list.filter(function (u) { return u.year === year; })
      .sort(function (a, b) { return String(a.num).localeCompare(String(b.num), undefined, { numeric: true }); });
  }

  function getTpRows(tps, tpsKey, year) {
    var subjectTps = tps[tpsKey];
    if (!subjectTps) return [];
    return subjectTps[year] || [];
  }

  function toast(msg) {
    if (typeof window.backupToast === 'function') window.backupToast(msg);
  }

  function listItems(items, tag) {
    tag = tag || 'li';
    if (!items || !items.length) return '<p class="hb-empty">—</p>';
    return '<ul>' + items.map(function (i) {
      return '<' + tag + '>' + escHtml(i) + '</' + tag + '>';
    }).join('') + '</ul>';
  }

  function pills(items, cls) {
    if (!items || !items.length) return '<span class="hb-empty">—</span>';
    return items.map(function (i) {
      return '<span class="hb-pill ' + (cls || '') + '">' + escHtml(i) + '</span>';
    }).join('');
  }

  function buildMapTable(tps, tpsKey, year, color) {
    var rows = getTpRows(tps, tpsKey, year);
    if (!rows.length) return '';
    var body = rows.map(function (tp) {
      var modes = (tp.modes || []).join(' · ');
      var eos = (tp.eos || []).map(function (e) {
        return '<span class="hb-pill hb-pill-eo">' + escHtml(e) + '</span>';
      }).join('');
      return '<tr>' +
        '<td class="hb-map-tp">' + escHtml(tp.label || tp.id) + '</td>' +
        '<td><strong>' + escHtml(tp.unit || '') + '</strong><br><span class="hb-muted">' + escHtml(tp.timing || '') + '</span></td>' +
        '<td>' + eos + '</td>' +
        '<td>' + escHtml(tp.assessed || '') + '</td>' +
        '<td>' + escHtml(modes) + '</td>' +
        '</tr>';
    }).join('');
    return '<table class="hb-map-table" style="--subject-color:' + color + '">' +
      '<thead><tr><th>TP</th><th>Unit</th><th>Experiences &amp; Outcomes</th><th>What is assessed</th><th>Modes</th></tr></thead>' +
      '<tbody>' + body + '</tbody></table>';
  }

  function buildUnitPage(unit, color) {
    var html = '<article class="hb-unit" style="--subject-color:' + color + '">';
    html += '<header class="hb-unit-header">';
    html += '<span class="hb-unit-num">Unit ' + escHtml(unit.num) + '</span>';
    html += '<h3 class="hb-unit-title">' + escHtml(unit.title) + '</h3>';
    if (unit.timing) html += '<p class="hb-unit-timing">' + escHtml(unit.timing) + '</p>';
    html += '</header>';

    html += '<div class="hb-unit-grid">';
    html += '<section class="hb-block"><h4>Learning intentions</h4>' + listItems(unit.learningIntentions) + '</section>';
    html += '<section class="hb-block"><h4>Success criteria</h4>' + listItems(unit.successCriteria) + '</section>';

    html += '<section class="hb-block hb-block-full"><h4>Experiences &amp; Outcomes</h4><div class="hb-pills">' +
      pills(unit.eos, 'hb-pill-eo') + '</div></section>';

    if (unit.vocab && unit.vocab.length) {
      html += '<section class="hb-block hb-block-full"><h4>Key vocabulary</h4><div class="hb-pills">' +
        pills(unit.vocab, 'hb-pill-vocab') + '</div></section>';
    }

    var assessItems = unit.assessmentDetail && unit.assessmentDetail.length
      ? unit.assessmentDetail : unit.assessment;
    html += '<section class="hb-block"><h4>Assessment</h4>' + listItems(assessItems) + '</section>';

    if (unit.literacyFocus && (unit.literacyFocus.learningIntentions || []).length) {
      var lf = unit.literacyFocus;
      html += '<section class="hb-block hb-block-lit"><h4>Literacy focus</h4>';
      if (unit.lit && unit.lit.length) html += '<div class="hb-pills">' + pills(unit.lit, 'hb-pill-lit') + '</div>';
      html += listItems(lf.learningIntentions) + listItems(lf.successCriteria) + '</section>';
    }

    if (unit.numeracyFocus && (unit.numeracyFocus.learningIntentions || []).length) {
      var nf = unit.numeracyFocus;
      html += '<section class="hb-block hb-block-mnu"><h4>Numeracy focus</h4>';
      if (unit.mnu && unit.mnu.length) html += '<div class="hb-pills">' + pills(unit.mnu, 'hb-pill-mnu') + '</div>';
      html += listItems(nf.learningIntentions) + listItems(nf.successCriteria) + '</section>';
    }

    if (unit.meta_skills && unit.meta_skills.length) {
      html += '<section class="hb-block hb-block-full"><h4>SDS meta-skills</h4><div class="hb-pills">' +
        pills(unit.meta_skills, 'hb-pill-meta') + '</div>';
      if (unit.meta_notes && unit.meta_notes.length) {
        html += '<ul class="hb-meta-notes">' + unit.meta_notes.map(function (n) {
          return '<li>' + escHtml(n) + '</li>';
        }).join('') + '</ul>';
      }
      html += '</section>';
    }

    html += '</div></article>';
    return html;
  }

  function buildGlossary(vocab, title, color) {
    if (!vocab || !vocab.length) return '';
    var byYear = {};
    vocab.forEach(function (v) {
      var y = (v.year || 'all').toLowerCase();
      if (!byYear[y]) byYear[y] = {};
      var cat = v.cat || 'General';
      if (!byYear[y][cat]) byYear[y][cat] = [];
      byYear[y][cat].push(v);
    });
    var yearOrder = ['s1', 's2', 's3', 'all'];
    var html = '<section class="hb-glossary" style="--subject-color:' + color + '">';
    html += '<h2 id="glossary-' + title.toLowerCase().replace(/\s+/g, '-') + '">' + escHtml(title) + ' — Vocabulary</h2>';
    yearOrder.forEach(function (yr) {
      if (!byYear[yr]) return;
      html += '<div class="hb-glossary-year"><h3>' + escHtml(YEAR_LABELS[yr] || yr.toUpperCase()) + '</h3>';
      Object.keys(byYear[yr]).sort().forEach(function (cat) {
        html += '<div class="hb-glossary-cat"><h4>' + escHtml(cat) + '</h4><dl>';
        byYear[yr][cat].forEach(function (entry) {
          html += '<dt>' + escHtml(entry.term) + '</dt><dd>' + escHtml(entry.def) + '</dd>';
        });
        html += '</dl></div>';
      });
      html += '</div>';
    });
    html += '</section>';
    return html;
  }

  function handbookStyles() {
    return [
      '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap");',
      '*{box-sizing:border-box;margin:0;padding:0}',
      'body{font-family:Inter,system-ui,sans-serif;color:#1e293b;line-height:1.55;font-size:10.5pt;background:#fff}',
      '.hb-doc{max-width:210mm;margin:0 auto}',
      '.hb-cover{min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:3rem 2rem;background:linear-gradient(145deg,#1e2d4a 0%,#2a3f62 45%,#3a5489 100%);color:#fff;page-break-after:always;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.hb-cover-logo{width:100px;height:auto;margin-bottom:2rem;filter:brightness(1.1)}',
      '.hb-cover-school{font-size:.65rem;font-weight:600;letter-spacing:.25em;text-transform:uppercase;color:rgba(255,255,255,.55);margin-bottom:.75rem}',
      '.hb-cover-title{font-family:Sora,sans-serif;font-size:2.4rem;font-weight:800;line-height:1.15;margin-bottom:.5rem}',
      '.hb-cover-sub{font-size:1rem;color:rgba(255,255,255,.75);max-width:28rem;margin:0 auto 2rem}',
      '.hb-cover-meta{font-size:.75rem;color:rgba(255,255,255,.5)}',
      '.hb-cover-strip{display:flex;gap:0;margin-top:2.5rem;width:100%;max-width:320px}',
      '.hb-cover-strip span{flex:1;height:4px}',
      '.hb-section{padding:2rem 2.5rem;page-break-inside:avoid}',
      '.hb-section-break{page-break-before:always}',
      '.hb-toc{padding:2.5rem}',
      '.hb-toc h2{font-family:Sora,sans-serif;font-size:1.35rem;color:#1e2d4a;margin-bottom:1.25rem}',
      '.hb-toc ol{padding-left:1.25rem}',
      '.hb-toc li{margin:.45rem 0;font-size:.9rem}',
      '.hb-toc a{color:#2f64bf;text-decoration:none}',
      '.hb-intro{background:#f8fafc;border-left:4px solid #4a7fd4;padding:1.25rem 1.5rem;margin:0 2.5rem 1rem;border-radius:0 8px 8px 0}',
      '.hb-intro p{margin:.5rem 0;font-size:.9rem;color:#475569}',
      '.hb-subject-header{padding:1.75rem 2.5rem;background:var(--subject-color,#1e2d4a);color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.hb-subject-header h2{font-family:Sora,sans-serif;font-size:1.5rem;font-weight:800}',
      '.hb-subject-header p{font-size:.85rem;opacity:.85;margin-top:.35rem}',
      '.hb-year-header{padding:1rem 2.5rem;background:#f1f5f9;border-bottom:3px solid var(--subject-color,#1e2d4a)}',
      '.hb-year-header h3{font-family:Sora,sans-serif;font-size:1.1rem;color:var(--subject-color,#1e2d4a)}',
      '.hb-map-wrap{padding:1rem 2.5rem 1.5rem}',
      '.hb-map-table{width:100%;border-collapse:collapse;font-size:.72rem;margin-bottom:1rem}',
      '.hb-map-table th{background:var(--subject-color,#1e2d4a);color:#fff;padding:.45rem .5rem;text-align:left;font-weight:600;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.hb-map-table td{padding:.45rem .5rem;border-bottom:1px solid #e2e8f0;vertical-align:top}',
      '.hb-map-table tr:nth-child(even) td{background:#f8fafc}',
      '.hb-map-tp{font-weight:700;color:var(--subject-color,#1e2d4a);white-space:nowrap}',
      '.hb-muted{color:#64748b;font-size:.68rem}',
      '.hb-unit{padding:1.25rem 2.5rem;page-break-inside:avoid;border-bottom:1px solid #e2e8f0}',
      '.hb-unit-header{margin-bottom:.85rem;padding-bottom:.65rem;border-bottom:2px solid var(--subject-color,#1e2d4a)}',
      '.hb-unit-num{display:inline-block;font-size:.6rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--subject-color,#1e2d4a);background:rgba(30,45,74,.08);padding:.2rem .5rem;border-radius:4px;margin-bottom:.35rem}',
      '.hb-unit-title{font-family:Sora,sans-serif;font-size:1.05rem;color:#1e293b}',
      '.hb-unit-timing{font-size:.75rem;color:#64748b;margin-top:.2rem}',
      '.hb-unit-grid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}',
      '.hb-block{background:#f8fafc;border-radius:6px;padding:.65rem .85rem}',
      '.hb-block-full{grid-column:1/-1}',
      '.hb-block-lit{border-left:3px solid #3b82f6}',
      '.hb-block-mnu{border-left:3px solid #8b5cf6}',
      '.hb-block h4{font-size:.62rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:.35rem}',
      '.hb-block ul{margin:0;padding-left:1.1rem;font-size:.78rem}',
      '.hb-block li{margin:.2rem 0}',
      '.hb-pills{display:flex;flex-wrap:wrap;gap:.25rem;margin-top:.25rem}',
      '.hb-pill{display:inline-block;font-size:.62rem;font-weight:600;padding:.15rem .4rem;border-radius:999px;background:rgba(30,45,74,.1);color:#1e2d4a;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.hb-pill-eo{background:#dbeafe;color:#1e40af}',
      '.hb-pill-vocab{background:#fef3c7;color:#92400e}',
      '.hb-pill-lit{background:#dbeafe;color:#1d4ed8}',
      '.hb-pill-mnu{background:#ede9fe;color:#6d28d9}',
      '.hb-pill-meta{background:#d1fae5;color:#065f46}',
      '.hb-meta-notes{margin-top:.35rem;padding-left:1.1rem;font-size:.72rem;color:#475569}',
      '.hb-empty{color:#94a3b8;font-style:italic;font-size:.78rem}',
      '.hb-assess-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;padding:0 2.5rem 1.5rem}',
      '.hb-assess-card{background:#f8fafc;border-radius:8px;padding:.85rem;border-top:3px solid #4a7fd4}',
      '.hb-assess-card h4{font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:.25rem}',
      '.hb-assess-card p{font-size:.78rem;color:#334155}',
      '.hb-glossary{padding:1.5rem 2.5rem}',
      '.hb-glossary h2{font-family:Sora,sans-serif;font-size:1.2rem;color:var(--subject-color);margin-bottom:1rem}',
      '.hb-glossary-year{margin-bottom:1.25rem}',
      '.hb-glossary-year h3{font-size:.85rem;color:#475569;margin-bottom:.5rem;padding-bottom:.25rem;border-bottom:1px solid #e2e8f0}',
      '.hb-glossary-cat{margin-bottom:.75rem}',
      '.hb-glossary-cat h4{font-size:.7rem;font-weight:700;color:var(--subject-color);margin-bottom:.35rem}',
      '.hb-glossary dl{font-size:.75rem}',
      '.hb-glossary dt{font-weight:600;color:#1e293b;margin-top:.35rem}',
      '.hb-glossary dd{color:#475569;margin-left:0;padding-left:.75rem;border-left:2px solid #e2e8f0;margin-top:.1rem}',
      '.hb-footer{text-align:center;padding:1.5rem;font-size:.65rem;color:#94a3b8;border-top:1px solid #e2e8f0}',
      '.hb-note{background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:.75rem 1rem;margin:1rem 2.5rem;font-size:.78rem;color:#92400e}',
      '.hb-print-bar{position:sticky;top:0;background:#1e2d4a;color:#fff;padding:.65rem 1.5rem;display:flex;justify-content:space-between;align-items:center;z-index:100;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.hb-print-bar button{background:#4a7fd4;color:#fff;border:none;padding:.45rem 1rem;border-radius:6px;font-weight:600;font-size:.8rem;cursor:pointer}',
      '.hb-print-bar button:hover{background:#3b6fc4}',
      '@media print{',
      '.hb-print-bar{display:none!important}',
      '.hb-cover{min-height:100vh}',
      '.hb-unit{page-break-inside:avoid}',
      '.hb-year-header{page-break-after:avoid}',
      'body{-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '@page{size:A4 portrait;margin:18mm}',
      '}'
    ].join('\n');
  }

  function buildHandbookHtml() {
    var data = getData();
    var moderation = data.moderation;
    var slides = data.slides;
    var tps = data.tps;
    var exportDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">';
    html += '<title>Expressive Arts Faculty — Curriculum Handbook</title>';
    html += '<style>' + handbookStyles() + '</style></head><body>';

    html += '<div class="hb-print-bar"><span>Curriculum Handbook — use Print → Save as PDF</span>';
    html += '<button type="button" onclick="window.print()">Print / Save as PDF</button></div>';

    html += '<div class="hb-doc">';

    html += '<section class="hb-cover">';
    html += '<img src="faculty-hub-logo.png" alt="" class="hb-cover-logo" onerror="this.style.display=\'none\'">';
    html += '<div class="hb-cover-school">Knightswood Secondary School</div>';
    html += '<h1 class="hb-cover-title">Expressive Arts Faculty</h1>';
    html += '<p class="hb-cover-sub">Curriculum Handbook for New Staff — Drama, Art &amp; Design, and Photography</p>';
    html += '<p class="hb-cover-meta">Exported ' + escHtml(exportDate) + '</p>';
    html += '<div class="hb-cover-strip"><span style="background:#1e2d4a"></span><span style="background:#92400e"></span><span style="background:#0f766e"></span></div>';
    html += '</section>';

    html += '<nav class="hb-toc hb-section-break"><h2>Contents</h2><ol>';
    html += '<li><a href="#welcome">Welcome</a></li>';
    html += '<li><a href="#assessment">Assessment &amp; Tracking</a></li>';
    html += SUBJECTS.map(function (s) {
      return '<li><a href="#subject-' + s.key + '">' + escHtml(s.label) + '</a></li>';
    }).join('');
    html += '<li><a href="#glossary-drama">Drama Vocabulary</a></li>';
    html += '<li><a href="#glossary-art-design">Art &amp; Design Vocabulary</a></li>';
    html += '</ol></nav>';

    html += '<section id="welcome" class="hb-section hb-section-break">';
    html += '<h2 style="font-family:Sora,sans-serif;color:#1e2d4a;margin-bottom:.75rem">Welcome</h2>';
    html += '<div class="hb-intro" style="margin:0">';
    html += '<p>This handbook brings together the faculty curriculum for <strong>Drama</strong>, <strong>Art &amp; Design</strong>, and <strong>Photography</strong>. Each BGE unit includes learning intentions, success criteria, Experiences &amp; Outcomes, key vocabulary, assessment, and cross-curricular literacy and numeracy links where applicable.</p>';
    html += '<p>Use the curriculum maps to see how Tracking Periods align to units. Detailed unit pages follow for each year group. Senior Drama and Art curriculum pages (S4–S6) are in development — Photography senior courses are included below.</p>';
    html += '</div></section>';

    html += '<section id="assessment" class="hb-section">';
    html += '<h2 style="font-family:Sora,sans-serif;color:#1e2d4a;margin-bottom:.75rem">Assessment &amp; Tracking</h2>';
    html += '<p style="font-size:.85rem;color:#475569;margin-bottom:1rem">BGE assessment in Drama and Art &amp; Design is built around <strong>six Tracking Periods</strong> per year group. Each TP is tied to a unit, evidences named Experiences &amp; Outcomes, and is assessed across four modes: <strong>Say, Write, Make, and Do</strong>. Progress is recorded on a <strong>1–4 scale</strong> and feeds the school BGE Tracking &amp; Monitoring cycle.</p>';
    html += '<div class="hb-assess-grid">';
    [
      ['Tracking Periods', '6 per year group — one per major unit, aligned to the teaching calendar'],
      ['Assessment Modes', 'Say · Write · Make · Do — each TP specifies which modes apply'],
      ['Progress Scale', '1 Working on targets · 2 Not yet on track · 3 On track · 4 Above expectations'],
      ['Recording', 'Faculty trackers feed the whole-school Tracking &amp; Monitoring cycle'],
      ['Evidence', 'Performance, practical work, written evaluation, peer and self-assessment'],
      ['S3 Transition', 'S2 TP6 data informs senior phase pathway guidance and subject choice']
    ].forEach(function (pair) {
      html += '<div class="hb-assess-card"><h4>' + escHtml(pair[0]) + '</h4><p>' + pair[1] + '</p></div>';
    });
    html += '</div></section>';

    SUBJECTS.forEach(function (subj, subjIdx) {
      html += '<header id="subject-' + subj.key + '" class="hb-subject-header' + (subjIdx === 0 ? ' hb-section-break' : '') + '" style="--subject-color:' + subj.color + '">';
      html += '<h2>' + escHtml(subj.label) + '</h2>';
      html += '<p>Broad General Education and senior courses</p></header>';

      subj.years.forEach(function (year, yrIdx) {
        var yearLabel = YEAR_LABELS[year] || year;
        html += '<div class="hb-year-header' + (yrIdx > 0 ? ' hb-section-break' : '') + '" style="--subject-color:' + subj.color + '">';
        html += '<h3>' + escHtml(subj.label) + ' — ' + escHtml(yearLabel) + '</h3></div>';

        if (subj.tpsKey) {
          html += '<div class="hb-map-wrap"><h4 style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:.5rem">Curriculum map</h4>';
          html += buildMapTable(tps, subj.tpsKey, year, subj.color);
          html += '</div>';
        } else {
          var photoTpKey = PHOTO_TP_KEYS[year];
          if (photoTpKey && tps.photography && tps.photography[photoTpKey]) {
            html += '<div class="hb-map-wrap"><h4 style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:.5rem">Course overview</h4>';
            html += buildMapTable(tps, 'photography', photoTpKey, subj.color);
            html += '</div>';
          }
        }

        var rawUnits = unitsForSubjectYear(moderation, subj.key, year);
        rawUnits.forEach(function (raw) {
          html += buildUnitPage(mergeUnit(raw, slides), subj.color);
        });

        if (!rawUnits.length) {
          html += '<p class="hb-note">No units defined for this stage.</p>';
        }
      });
    });

    html += buildGlossary(data.dramaVocab, 'Drama', '#1e2d4a');
    html += buildGlossary(data.adVocab, 'Art & Design', '#92400e');

    html += '<footer class="hb-footer">Expressive Arts Faculty · Knightswood Secondary School · Curriculum Handbook · ' + escHtml(exportDate) + '</footer>';
    html += '</div></body></html>';
    return html;
  }

  function docxPara(text, bold) {
    var t = escXml(text);
    if (bold) {
      return '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">' + t + '</w:t></w:r></w:p>';
    }
    return '<w:p><w:r><w:t xml:space="preserve">' + t + '</w:t></w:r></w:p>';
  }

  function buildHandbookDocxXml() {
    var data = getData();
    var moderation = data.moderation;
    var slides = data.slides;
    var tps = data.tps;
    var paras = [];
    var exportDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    paras.push(['Expressive Arts Faculty — Curriculum Handbook', true]);
    paras.push(['Knightswood Secondary School', false]);
    paras.push(['Exported ' + exportDate, false]);
    paras.push(['', false]);
    paras.push(['Welcome', true]);
    paras.push(['This handbook covers Drama, Art & Design, and Photography curriculum units for new staff.', false]);
    paras.push(['', false]);
    paras.push(['Assessment & Tracking', true]);
    paras.push(['Six Tracking Periods per year; modes Say, Write, Make, Do; progress scale 1–4.', false]);
    paras.push(['', false]);

    SUBJECTS.forEach(function (subj) {
      paras.push([subj.label, true]);
      subj.years.forEach(function (year) {
        var yearLabel = YEAR_LABELS[year] || year;
        paras.push([subj.label + ' — ' + yearLabel, true]);

        if (subj.tpsKey) {
          getTpRows(tps, subj.tpsKey, year).forEach(function (tp) {
            paras.push([(tp.label || tp.id) + ': ' + (tp.unit || '') + ' (' + (tp.timing || '') + ')', false]);
            paras.push(['  E&Os: ' + (tp.eos || []).join(', '), false]);
            paras.push(['  Assessed: ' + (tp.assessed || ''), false]);
          });
        }

        unitsForSubjectYear(moderation, subj.key, year).forEach(function (raw) {
          var u = mergeUnit(raw, slides);
          paras.push(['Unit ' + u.num + ': ' + u.title + (u.timing ? ' — ' + u.timing : ''), true]);
          if (u.learningIntentions.length) {
            paras.push(['Learning intentions:', false]);
            u.learningIntentions.forEach(function (li) { paras.push(['  • ' + li, false]); });
          }
          if (u.successCriteria.length) {
            paras.push(['Success criteria:', false]);
            u.successCriteria.forEach(function (sc) { paras.push(['  • ' + sc, false]); });
          }
          if (u.eos.length) paras.push(['E&Os: ' + u.eos.join(', '), false]);
          if (u.vocab.length) paras.push(['Vocabulary: ' + u.vocab.join(', '), false]);
          var assess = u.assessmentDetail.length ? u.assessmentDetail : u.assessment;
          if (assess.length) {
            paras.push(['Assessment:', false]);
            assess.forEach(function (a) { paras.push(['  • ' + a, false]); });
          }
          if (u.meta_skills.length) paras.push(['Meta-skills: ' + u.meta_skills.join(', '), false]);
          paras.push(['', false]);
        });
      });
    });

    function addGlossary(vocab, title) {
      if (!vocab.length) return;
      paras.push([title + ' — Vocabulary', true]);
      vocab.forEach(function (v) {
        paras.push([v.term + ': ' + v.def, false]);
      });
      paras.push(['', false]);
    }
    addGlossary(data.dramaVocab, 'Drama');
    addGlossary(data.adVocab, 'Art & Design');

    var body = paras.map(function (p) { return docxPara(p[0], p[1]); }).join('');
    return '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      body +
      '</w:body></w:document>';
  }

  function buildDocxBlob() {
    var Zip = typeof JSZip !== 'undefined' ? JSZip : null;
    if (!Zip) return Promise.reject(new Error('JSZip unavailable'));
    var zip = new Zip();
    zip.file('word/document.xml', buildHandbookDocxXml());
    zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.folder('_rels').file('.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  function openPreview() {
    var html = buildHandbookHtml();
    var w = window.open('', '_blank');
    if (!w) {
      toast('Pop-up blocked — allow pop-ups to preview the handbook.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function downloadWord() {
    if (typeof JSZip === 'undefined') {
      toast('Word export unavailable — use Preview & Print / PDF.');
      return;
    }
    buildDocxBlob().then(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'ExpressiveArts_Curriculum_Handbook_' + new Date().toISOString().slice(0, 10) + '.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast('Curriculum handbook Word document downloaded.');
    }).catch(function () {
      toast('Word export failed — try Preview & Print / PDF.');
    });
  }

  function openModal() {
    var modal = document.getElementById('curriculumHandbookModal');
    if (modal) {
      modal.classList.add('visible');
      modal.setAttribute('aria-hidden', 'false');
    }
  }

  function closeModal() {
    var modal = document.getElementById('curriculumHandbookModal');
    if (modal) {
      modal.classList.remove('visible');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  window.CurriculumExport = {
    openPreview: openPreview,
    downloadWord: downloadWord,
    openModal: openModal,
    closeModal: closeModal,
    buildHandbookHtml: buildHandbookHtml
  };
  window.openCurriculumHandbookModal = openModal;
  window.closeCurriculumHandbookModal = closeModal;
})();
