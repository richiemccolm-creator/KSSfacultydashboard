/**
 * N5 Skills for Work: Creative Industries — Senior Phase (S5/6).
 * Merged into window.DRAMA_CURRICULUM.units for drama-homepage lesson slides.
 * Slide files: drama-ci-s01.html … drama-ci-s61.html (100-minute double periods).
 */
(function () {
  function session(n, title) {
    var id = String(n);
    var file = 'drama-ci-s' + (n < 10 ? '0' + n : String(n)) + '.html';
    return { id: id, title: title, slides: file, status: 'planned', session: n };
  }

  var ciUnits = {
    ci01: {
      id: 'ci01',
      unitLabel: 'U1',
      year: 'Senior',
      course: 'N5 Skills for Work: Creative Industries',
      sqaCode: 'J17V 75',
      title: 'Creative Industries: An Introduction',
      weeks: 'Wks 1–9',
      month: 'Aug–Oct',
      colour: '#00AAFF',
      gradEnd: '#33CCFF',
      desc: 'Investigate the Creative Industries, employment pathways, and employability skills.',
      nabWindow: 'Wks 8–9',
      lessons: [
        session(1, 'Course Induction + Self-Eval #1'),
        session(2, 'Marketplace Activity — Exploring the Sectors'),
        session(3, 'Structure, Scale & Sectors Deep Dive'),
        session(4, 'Legal Parameters, Health & Safety + Agencies'),
        session(5, 'O1 Completion + Sector Confirmed + O2 Launch'),
        session(6, 'Employment Opportunities + Freelance Issues'),
        session(7, 'Job Roles, Career Paths + Self-Eval #2'),
        session(8, 'Focus Job Role in Depth'),
        session(9, 'Presenting O2 Findings'),
        session(10, 'Folio Audit + Full O1/O2 Consolidation')
      ]
    },
    ci02: {
      id: 'ci02',
      unitLabel: 'U2',
      year: 'Senior',
      course: 'N5 Skills for Work: Creative Industries',
      sqaCode: 'J17W 75',
      title: 'Skills Development',
      weeks: 'Wks 5–9',
      month: 'Sep–Oct',
      colour: '#AAFF00',
      gradEnd: '#88CC00',
      desc: 'Develop practical skills for a chosen job role through sustained practical work.',
      nabWindow: 'Wks 8–9 (with U1)',
      lessons: [
        session(11, 'U2 Launch + Skills Audit'),
        session(12, 'Targets + Development Plan'),
        session(13, 'Practical Skills Development #1'),
        session(14, 'Practical Skills Development #2'),
        session(15, 'Practical Skills Development #3'),
        session(16, 'Practical Skills Development #4 + External Input'),
        session(17, 'Practical Skills Development #5 — Final Push'),
        session(18, 'O3 Evaluation'),
        session(19, 'O1 Completion + Full Folio Audit')
      ]
    },
    ci03: {
      id: 'ci03',
      unitLabel: 'U3',
      year: 'Senior',
      course: 'N5 Skills for Work: Creative Industries',
      sqaCode: 'J17X 75',
      title: 'The Creative Process — Go Viral Challenge',
      weeks: 'Wks 10–17',
      month: 'Oct–Dec',
      colour: '#CC44FF',
      gradEnd: '#9922CC',
      desc: 'Build a social media brand through research, development, and evaluation.',
      nabWindow: 'Wk 17',
      lessons: [
        session(20, 'Go Viral — Brief Introduction'),
        session(21, 'Research Stage — Brief Analysis + Landscape Research'),
        session(22, 'Personal Brand Concept — Full Response'),
        session(23, 'Team Presentations + Agree Team Direction'),
        session(24, 'Content Strategy + Platform Deep Dive'),
        session(25, 'First Content Creation Workshop'),
        session(26, 'Go Viral Making #1 + Weekly Review #1'),
        session(27, 'Understanding Your Audience'),
        session(28, 'Content Creation Workshop — Engagement Focus'),
        session(29, 'Go Viral Making #2 + Weekly Review #2'),
        session(30, 'Elevating Production Quality'),
        session(31, 'Content Creation Workshop — Quality Push'),
        session(32, 'Go Viral Making #3 + Weekly Review #3'),
        session(33, 'Working With the Algorithm'),
        session(34, 'Content Creation Workshop — Algorithm-Aware'),
        session(35, 'Go Viral Making #4 + Weekly Review #4'),
        session(36, 'Creative Collaboration'),
        session(37, 'Content Creation Workshop — Collab Focus'),
        session(38, 'Go Viral Making #5 + Weekly Review #5'),
        session(39, 'Final Strategy Sprint'),
        session(40, 'Content Creation Workshop — Christmas Sprint'),
        session(41, 'Go Viral Making #6 + Weekly Review #6'),
        session(42, 'Summative Evaluation'),
        session(43, 'Go Viral Showcase + NAB Completion'),
        session(44, 'Resit + Folio Tidy'),
        session(45, 'Resit + Folio Tidy (continued)'),
        session(46, 'End of Term')
      ]
    },
    ci04: {
      id: 'ci04',
      unitLabel: 'U4',
      year: 'Senior',
      course: 'N5 Skills for Work: Creative Industries',
      sqaCode: 'J17Y 75',
      title: 'Creative Project',
      weeks: 'Wks 19–24',
      month: 'Jan–Feb',
      colour: '#FF9900',
      gradEnd: '#CC7700',
      desc: 'Capstone team project — planning, implementation, and evaluation.',
      nabWindow: 'Wk 24',
      lessons: [
        session(47, 'Brief Issue + Initial Team Discussion'),
        session(48, 'Group Plan Completion'),
        session(49, 'Implementation Begins'),
        session(50, 'Implementation #2'),
        session(51, 'Implementation #3'),
        session(52, 'Implementation #4'),
        session(53, 'Implementation #5 + Mid-Project Review'),
        session(54, 'Implementation #6 — Quality and Finish'),
        session(55, 'Implementation #7 — Final Push'),
        session(56, 'Project Compilation + Self-Eval #3'),
        session(57, 'Final Project Refinement'),
        session(58, 'Project Presentation'),
        session(59, 'O3 Evaluation — Own and Team Contribution'),
        session(60, 'O3 Evaluation — Implementation + Action Points'),
        session(61, 'Full Course Folio Audit + NAB Prep')
      ]
    }
  };

  if (!window.DRAMA_CURRICULUM) window.DRAMA_CURRICULUM = { units: {} };
  if (!window.DRAMA_CURRICULUM.units) window.DRAMA_CURRICULUM.units = {};
  Object.assign(window.DRAMA_CURRICULUM.units, ciUnits);

  window.N5_CI_UNITS = ciUnits;
})();
