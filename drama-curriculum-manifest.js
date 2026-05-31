/**
 * Drama lesson slides — units, lessons, and slide file paths.
 * Single source of truth for drama-homepage.html and future slide decks.
 *
 * New slide HTML files (drama-slides-*.html, drama-u*.html) must include:
 *   drama-slides-core.css, drama-slides-i18n.css, drama-slides-compat.css (legacy u decks)
 *   drama-slides-core.js, drama-slides-i18n.js, drama-slides-deck.js (legacy u decks)
 *   drama-slides-{deck-id}.i18n.js  (per-deck translations for drama-slides-* format)
 *
 * Mark every user-facing string with data-i18n="key" (or data-i18n-html for HTML).
 * English stays in the HTML; add ar/fa/zh/ur/pl to the deck .i18n.js file.
 * Regenerate unit 01 translations: python3 scripts/generate-unit01-i18n.py
 *
 * Shared features: fullscreen (F key), language bar (top), double-click deck.
 * Lesson timing: plan for 50-minute periods (Connect 5 · Explore 10 · Create 20 · Share 10 · Reflect 5).
 * Navigation: Previous undoes reveals first; ← / Backspace / Page Up go back.
 * Template: drama-slides-unit01_1.html
 */
window.DRAMA_CURRICULUM = {
  units: {
    '01': {
      id: '01',
      year: 'S1',
      title: 'Intro to Drama & Group Work',
      weeks: 'Wks 1–2',
      month: 'Aug',
      colour: '#FF3B30',
      gradEnd: '#FF6259',
      desc: 'Build confidence, learn the space and work safely together.',
      lessons: [
        {
          id: '1',
          title: 'Welcome to Drama',
          slides: 'drama-u01-l01.html',
          status: 'ready'
        },
        {
          id: '2',
          title: 'Group Work & Trust',
          slides: 'drama-u01-l02.html',
          status: 'ready'
        },
        {
          id: '3',
          title: 'Freeze Frames',
          slides: 'drama-u01-l03.html',
          status: 'ready'
        }
      ]
    },
    '02': {
      id: '02',
      year: 'S1',
      title: 'Mime & Melodrama',
      weeks: 'Wks 3–6',
      month: 'Aug–Sep',
      colour: '#F97316',
      gradEnd: '#FBA04A',
      desc: 'Communicate meaning without words using physical performance.',
      lessons: [
        {
          id: '1',
          title: 'What is Mime?',
          slides: 'drama-u02-l01.html',
          status: 'ready'
        },
        {
          id: '2',
          title: 'Mime Skills Practice',
          slides: 'drama-u02-l02.html',
          status: 'ready'
        }
      ]
    },
    '03': {
      id: '03',
      year: 'S1',
      title: 'Voice',
      weeks: 'Wks 7–9',
      month: 'Sep–Oct',
      colour: '#D4A800',
      gradEnd: '#FACC15',
      desc: 'Apply pitch, pace, tone and projection to portray character.',
      lessons: []
    },
    '04': {
      id: '04',
      year: 'S1',
      title: 'Improvisation',
      weeks: 'Wks 10–14',
      month: 'Oct–Nov',
      colour: '#65A30D',
      gradEnd: '#84CC16',
      desc: 'Respond spontaneously and build collaborative scenes without a script.',
      lessons: []
    },
    '05': {
      id: '05',
      year: 'S1',
      title: 'Working with Scripts',
      weeks: 'Wks 19–22',
      month: 'Jan–Feb',
      colour: '#1D4ED8',
      gradEnd: '#2563EB',
      desc: 'Interpret scripts and bring characters to life through rehearsal.',
      lessons: []
    },
    '06': {
      id: '06',
      year: 'S1',
      title: 'Production Skills',
      weeks: 'Wks 23–27',
      month: 'Feb–Mar',
      colour: '#0891B2',
      gradEnd: '#06B6D4',
      desc: 'Explore lighting, sound, set and design to enhance performance.',
      lessons: []
    },
    '07': {
      id: '07',
      year: 'S1',
      title: 'Small-Scale Production',
      weeks: 'Wks 28–38',
      month: 'Apr–May',
      colour: '#6D28D9',
      gradEnd: '#8B5CF6',
      desc: 'Bring everything together in a final group performance or production.',
      lessons: []
    }
  }
};

window.getDramaUnit = function(unitId) {
  var id = String(unitId || '').replace(/^0+/, '') || '0';
  var key = id.length === 1 ? '0' + id : id;
  if (window.DRAMA_CURRICULUM.units[key]) return window.DRAMA_CURRICULUM.units[key];
  if (window.DRAMA_CURRICULUM.units[unitId]) return window.DRAMA_CURRICULUM.units[unitId];
  return null;
};
