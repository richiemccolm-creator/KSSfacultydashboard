/**
 * Advanced Higher Drama — Senior Phase curriculum entry.
 * Merged into window.DRAMA_CURRICULUM.units for drama-homepage.html.
 * Key dates hub: ah_drama_hub.html
 */
(function () {
  var ahUnit = {
    ah01: {
      id: 'ah01',
      unitLabel: 'AH',
      year: 'Senior',
      course: 'Advanced Higher Drama',
      title: 'Key Dates & Deadlines',
      weeks: 'Aug–Apr',
      month: '2026–27',
      colour: '#6D28D9',
      gradEnd: '#8B5CF6',
      desc: 'Centre deadlines, SQA uplifts, and session milestones for AH Drama.',
      hubPanel: 'drama-ah-deadlines',
      lessons: [
        {
          id: '1',
          title: 'Key Dates & Deadlines Calendar',
          slides: 'ah_drama_hub.html',
          status: 'ready',
          isHub: true
        }
      ]
    }
  };

  if (!window.DRAMA_CURRICULUM) window.DRAMA_CURRICULUM = { units: {} };
  if (!window.DRAMA_CURRICULUM.units) window.DRAMA_CURRICULUM.units = {};
  Object.assign(window.DRAMA_CURRICULUM.units, ahUnit);
})();
