/**
 * Tracking Hub — novice UX: help glossary + first-visit coach tour
 */
(function(global) {
  'use strict';

  var COACH_KEY = 'trackingHubCoachDismissed';
  var COACH_STEPS = [
    {
      title: 'Welcome',
      text: 'This hub shows Art & Drama tracker data from the cloud. It loads automatically — use Refresh if you need the latest scores.'
    },
    {
      title: 'Find pupils quickly',
      text: 'Use Overview for the big picture and At Risk for everyone flagged. Open Classes, click a teacher row, then click a pupil to see their full profile.'
    },
    {
      title: 'Simple filters',
      text: 'Filter by year, class, subject, or search by name. Advanced options (saved views, targets, snapshots) are tucked away until you need them.'
    }
  ];

  var coachIndex = 0;

  function $(id) { return document.getElementById(id); }

  function isCoachDismissed() {
    try { return localStorage.getItem(COACH_KEY) === '1'; } catch (e) { return false; }
  }

  function dismissCoach() {
    try { localStorage.setItem(COACH_KEY, '1'); } catch (e) { /* ignore */ }
    closeCoach();
  }

  function openGlossary() {
    var el = $('th-glossary');
    if (!el) return;
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('th-modal-open');
    var closeBtn = el.querySelector('[data-close-glossary]');
    if (closeBtn) closeBtn.focus();
  }

  function closeGlossary() {
    var el = $('th-glossary');
    if (!el) return;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    if (!document.getElementById('th-coach') || !document.getElementById('th-coach').classList.contains('is-open')) {
      document.body.classList.remove('th-modal-open');
    }
  }

  function renderCoachStep() {
    var step = COACH_STEPS[coachIndex];
    var stepEl = $('th-coach-step');
    var titleEl = $('th-coach-title');
    var textEl = $('th-coach-text');
    var nextBtn = $('th-coach-next');
    if (stepEl) stepEl.textContent = (coachIndex + 1) + ' / ' + COACH_STEPS.length;
    if (titleEl) titleEl.textContent = step.title;
    if (textEl) textEl.textContent = step.text;
    if (nextBtn) nextBtn.textContent = coachIndex >= COACH_STEPS.length - 1 ? 'Done' : 'Next';
  }

  function openCoach() {
    coachIndex = 0;
    renderCoachStep();
    var el = $('th-coach');
    if (!el) return;
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('th-modal-open');
    var nextBtn = $('th-coach-next');
    if (nextBtn) nextBtn.focus();
  }

  function closeCoach() {
    var el = $('th-coach');
    if (!el) return;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    if (!document.getElementById('th-glossary') || !document.getElementById('th-glossary').classList.contains('is-open')) {
      document.body.classList.remove('th-modal-open');
    }
  }

  function coachNext() {
    if (coachIndex >= COACH_STEPS.length - 1) {
      dismissCoach();
      return;
    }
    coachIndex++;
    renderCoachStep();
  }

  function bindEvents() {
    var helpBtn = $('th-help-btn');
    if (helpBtn) helpBtn.addEventListener('click', openGlossary);

    var glossary = $('th-glossary');
    if (glossary) {
      glossary.addEventListener('click', function(ev) {
        if (ev.target.closest('[data-close-glossary]')) closeGlossary();
      });
    }

    var tourBtn = $('th-glossary-tour');
    if (tourBtn) {
      tourBtn.addEventListener('click', function() {
        closeGlossary();
        openCoach();
      });
    }

    var coach = $('th-coach');
    if (coach) {
      var skipBtn = $('th-coach-skip');
      var nextBtn = $('th-coach-next');
      if (skipBtn) skipBtn.addEventListener('click', dismissCoach);
      if (nextBtn) nextBtn.addEventListener('click', coachNext);
      coach.addEventListener('click', function(ev) {
        if (ev.target.classList.contains('th-coach-backdrop')) dismissCoach();
      });
    }

    document.addEventListener('keydown', function(ev) {
      if (ev.key !== 'Escape') return;
      if ($('th-glossary') && $('th-glossary').classList.contains('is-open')) closeGlossary();
      else if ($('th-coach') && $('th-coach').classList.contains('is-open')) dismissCoach();
    });
  }

  function maybeShowCoach() {
    if (isCoachDismissed()) return;
    setTimeout(openCoach, 800);
  }

  function init() {
    bindEvents();
    maybeShowCoach();
  }

  global.TrackingHubUx = {
    init: init,
    openGlossary: openGlossary,
    openCoach: openCoach
  };
})(window);
