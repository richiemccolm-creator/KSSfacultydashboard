/**
 * SDS Meta-skills Progression Framework — 12 skills in 3 domains.
 * Shared by faculty hub, trackers, curriculum units, and drama slides.
 */
(function () {
  var DOMAINS = {
    'Self-management': ['Focusing', 'Integrity', 'Adapting', 'Initiative'],
    'Social intelligence': ['Communicating', 'Feeling', 'Collaborating', 'Leading'],
    'Innovation': ['Curiosity', 'Creativity', 'Sense-making', 'Critical thinking']
  };

  var DOMAIN_COLOURS = {
    'Self-management': '#3b82f6',
    'Social intelligence': '#10b981',
    'Innovation': '#f59e0b'
  };

  var COLOURS = {
    Focusing: '#2563eb',
    Integrity: '#1d4ed8',
    Adapting: '#60a5fa',
    Initiative: '#93c5fd',
    Communicating: '#059669',
    Feeling: '#10b981',
    Collaborating: '#34d399',
    Leading: '#6ee7b7',
    Curiosity: '#d97706',
    Creativity: '#f59e0b',
    'Sense-making': '#fbbf24',
    'Critical thinking': '#fcd34d'
  };

  var SKILL_TO_DOMAIN = {};
  Object.keys(DOMAINS).forEach(function (domain) {
    DOMAINS[domain].forEach(function (skill) {
      SKILL_TO_DOMAIN[skill] = domain;
    });
  });

  window.META_SKILLS = {
    domains: DOMAINS,
    domainColours: DOMAIN_COLOURS,
    colours: COLOURS,
    cfeLevel: { s1: 'Second Level', s2: 'Third/Fourth Level' }
  };

  window.getMetaSkillColour = function (skill) {
    return COLOURS[skill] || '#9ca3af';
  };

  window.getMetaSkillDomain = function (skill) {
    return SKILL_TO_DOMAIN[skill] || '';
  };

  window.renderMetaDots = function (skills) {
    return (skills || []).map(function (skill) {
      var colour = getMetaSkillColour(skill);
      return '<span class="map-meta-dot" style="background:' + colour + '" title="' + skill + '"></span>';
    }).join('');
  };

  window.renderMetaChips = function (skills, className) {
    var chipClass = className || 'meta-skill-chip';
    return (skills || []).map(function (skill) {
      var colour = getMetaSkillColour(skill);
      var domain = getMetaSkillDomain(skill);
      return '<span class="' + chipClass + '" style="background:' + colour + '22;border-color:' + colour + ';color:' + colour + '" title="' + domain + '">' + skill + '</span>';
    }).join('');
  };

  window.renderMetaPanel = function (skills, notes, opts) {
    opts = opts || {};
    var items = (skills || []).map(function (skill, i) {
      var colour = getMetaSkillColour(skill);
      var domain = getMetaSkillDomain(skill);
      var note = (notes && notes[i]) || '';
      return '<div class="meta-panel-item">' +
        '<div class="meta-panel-dot" style="background:' + colour + '"></div>' +
        '<div class="meta-panel-body">' +
          '<div class="meta-panel-skill" style="color:' + colour + '">' + skill + '</div>' +
          (opts.showDomain !== false ? '<div class="meta-panel-domain">' + domain + '</div>' : '') +
          (note ? '<div class="meta-panel-note">' + note + '</div>' : '') +
        '</div></div>';
    }).join('');
    return '<div class="meta-panel">' + items + '</div>';
  };

  /** Back-compat alias used by faculty-hub renderSlide */
  window.SLIDE_META_COLOURS = COLOURS;
})();
