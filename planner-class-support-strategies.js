/**
 * Class Support strategy bank for Teacher Planner.
 * Teaching-focused possible approaches, keyed by consideration category.
 * Keep this file data-only so the bank can be edited without touching UI logic.
 */
(function (root) {
  var CATEGORIES = [
    { id: 'literacy', label: 'Literacy' },
    { id: 'eal', label: 'EAL / Language' },
    { id: 'processing', label: 'Processing & Memory' },
    { id: 'attention', label: 'Attention & Focus' },
    { id: 'communication', label: 'Communication' },
    { id: 'confidence', label: 'Confidence' },
    { id: 'sensory', label: 'Sensory' },
    { id: 'physical', label: 'Physical / Access' },
    { id: 'groupDynamics', label: 'Group Dynamics' },
    { id: 'other', label: 'Other' }
  ];

  var CATEGORY_IDS = {};
  CATEGORIES.forEach(function (c) { CATEGORY_IDS[c.id] = c; });

  var STRATEGIES = {
    literacy: [
      { id: 'lit-vocab-bank', text: 'Provide a vocabulary bank for key terms' },
      { id: 'lit-sentence-starters', text: 'Offer sentence starters for written or spoken responses' },
      { id: 'lit-model-response', text: 'Model an example response before pupils begin' },
      { id: 'lit-chunk-reading', text: 'Break longer reading into shorter sections' },
      { id: 'lit-highlight-key', text: 'Highlight key information in texts or instructions' },
      { id: 'lit-alt-recording', text: 'Allow alternative ways of recording where appropriate' }
    ],
    eal: [
      { id: 'eal-preteach', text: 'Pre-teach key vocabulary' },
      { id: 'eal-vocab-visible', text: 'Keep key vocabulary visible' },
      { id: 'eal-visual-instructions', text: 'Use visual instructions alongside spoken ones' },
      { id: 'eal-model-example', text: 'Model an example before the task' },
      { id: 'eal-sentence-starters', text: 'Provide sentence starters' },
      { id: 'eal-partner-rehearsal', text: 'Allow partner rehearsal before sharing' },
      { id: 'eal-check-understanding', text: 'Check understanding before moving on' },
      { id: 'eal-simplify-language', text: 'Simplify unnecessary complex language' }
    ],
    processing: [
      { id: 'proc-chunk', text: 'Chunk instructions into smaller steps' },
      { id: 'proc-visible', text: 'Keep instructions visible' },
      { id: 'proc-one-stage', text: 'Give one stage at a time' },
      { id: 'proc-model-first', text: 'Model before starting' },
      { id: 'proc-check', text: 'Check understanding' },
      { id: 'proc-time', text: 'Allow processing time' },
      { id: 'proc-visual-reminders', text: 'Use visual reminders' }
    ],
    attention: [
      { id: 'att-shorter-stages', text: 'Break tasks into shorter stages' },
      { id: 'att-time-clear', text: 'Make time expectations clear' },
      { id: 'att-instructions-visible', text: 'Keep task instructions visible' },
      { id: 'att-checkpoints', text: 'Use clear checkpoints' },
      { id: 'att-reduce-instructions', text: 'Reduce unnecessary instructions' },
      { id: 'att-starting-action', text: 'Give a clear starting action' }
    ],
    communication: [
      { id: 'com-model-responses', text: 'Model expected responses' },
      { id: 'com-thinking-time', text: 'Give thinking time before answers' },
      { id: 'com-structured-discussion', text: 'Use structured discussion' },
      { id: 'com-rehearse', text: 'Allow rehearsal before answering' },
      { id: 'com-prompts', text: 'Provide prompts where useful' }
    ],
    confidence: [
      { id: 'conf-think-pair-share', text: 'Use think-pair-share before whole-class response' },
      { id: 'conf-rehearse-sharing', text: 'Rehearse before sharing' },
      { id: 'conf-predictable-q', text: 'Use predictable questioning' },
      { id: 'conf-group-roles', text: 'Provide structured group roles' },
      { id: 'conf-model-first', text: 'Model first' },
      { id: 'conf-alt-contribute', text: 'Offer appropriate alternative ways to contribute' }
    ],
    sensory: [
      { id: 'sen-reduce-load', text: 'Reduce unnecessary sensory load where possible' },
      { id: 'sen-predictable', text: 'Keep the working area predictable' },
      { id: 'sen-warn-change', text: 'Signal changes of activity clearly' },
      { id: 'sen-start-place', text: 'Give a clear place and way to start' },
      { id: 'sen-quiet-option', text: 'Offer a quieter option for focused tasks where practical' },
      { id: 'sen-movement', text: 'Allow movement breaks when useful' }
    ],
    physical: [
      { id: 'phy-seating', text: 'Check seating and access to materials' },
      { id: 'phy-reach', text: 'Keep resources within easy reach' },
      { id: 'phy-demo-visible', text: 'Make sure demonstrations are visible to everyone' },
      { id: 'phy-extra-time', text: 'Allow extra time for practical tasks' },
      { id: 'phy-alt-recording', text: 'Offer alternative ways of recording' },
      { id: 'phy-room-layout', text: 'Plan the room layout before the lesson' }
    ],
    groupDynamics: [
      { id: 'grp-roles', text: 'Use structured group roles' },
      { id: 'grp-responsibilities', text: 'Make responsibilities explicit' },
      { id: 'grp-grouping', text: 'Consider deliberate grouping' },
      { id: 'grp-success', text: 'Give clear collaborative success criteria' },
      { id: 'grp-timed', text: 'Use timed checkpoints' }
    ],
    other: [
      { id: 'oth-instructions-visible', text: 'Keep key instructions visible' },
      { id: 'oth-model', text: 'Model an example' },
      { id: 'oth-check', text: 'Check understanding' },
      { id: 'oth-processing', text: 'Allow processing time' }
    ]
  };

  function uniquePush(out, seen, item) {
    if (!item || !item.id || !item.text) return;
    var textKey = String(item.text).replace(/\s+/g, ' ').trim().toLowerCase();
    if (seen[item.id] || seen[textKey]) return;
    seen[item.id] = 1;
    seen[textKey] = 1;
    out.push({ id: item.id, text: item.text, categoryId: item.categoryId });
  }

  var api = {
    CATEGORIES: CATEGORIES,
    CATEGORY_IDS: CATEGORY_IDS,
    STRATEGIES: STRATEGIES,

    isCategoryId: function (id) {
      return !!CATEGORY_IDS[String(id || '')];
    },

    labelFor: function (id) {
      var cat = CATEGORY_IDS[String(id || '')];
      return cat ? cat.label : '';
    },

    orderedCategoryIds: function (ids) {
      var set = {};
      (ids || []).forEach(function (id) {
        if (CATEGORY_IDS[id]) set[id] = 1;
      });
      return CATEGORIES.map(function (c) { return c.id; }).filter(function (id) { return set[id]; });
    },

    strategiesFor: function (categoryIds) {
      var seen = {};
      var out = [];
      api.orderedCategoryIds(categoryIds).forEach(function (catId) {
        (STRATEGIES[catId] || []).forEach(function (s) {
          uniquePush(out, seen, {
            id: s.id,
            text: s.text,
            categoryId: catId
          });
        });
      });
      return out;
    }
  };

  root.PlannerClassSupportBank = api;
})(typeof window !== 'undefined' ? window : globalThis);
