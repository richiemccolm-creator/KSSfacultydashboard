/**
 * N5 Skills for Work: Creative Industries — the four mandatory units, their
 * outcomes and performance criteria, and the evidence checkpoints the faculty
 * confirms before a unit is signed off. Wording from the SQA unit specifications.
 */
(function () {
  var UNITS = {
    u1: {
      id: 'u1', code: 'J17V 75', name: 'An Introduction', short: 'Introduction', tag: 'Intro',
      source: 'https://www.sqa.org.uk/sqa/files/nq/J17V75.pdf',
      outcomes: [
        { name: 'Investigate the creative industries in the UK', pc: [
          ['a', 'Identify and describe sectors within the creative industries in the UK.'],
          ['b', 'Describe relevant legal parameters affecting a sector of your own choice.'],
          ['c', 'Identify and describe the main health and safety legislation relevant to the chosen sector.'],
          ['d', 'Identify and describe agencies and organisations relevant to the chosen sector.'],
          ['e', 'Organise and present findings.']
        ] },
        { name: 'Investigate employment within a chosen sector of the creative industries', pc: [
          ['a', 'Investigate employment opportunities.'],
          ['b', 'Identify and describe job roles and career paths.'],
          ['c', 'Identify employability skills, qualifications and responsibilities required for a personally selected job role.'],
          ['d', 'Organise and present findings.']
        ] },
        { name: 'Review and evaluate own employability skills', pc: [
          ['a', 'Identify own strengths and areas for improvement in specified employability skills.'],
          ['b', 'Seek feedback from others when reviewing specified employability skills.'],
          ['c', 'Set targets for improvement in specific employability skills.'],
          ['d', 'Evaluate progress in achieving these targets over a set period of time.']
        ] }
      ],
      checks: [
        ['review1', 'Initial employability review completed, signed and dated', 'Review 1'],
        ['review2', 'Midpoint employability review completed, signed and dated', 'Review 2'],
        ['review3', 'Final employability review completed, signed and dated', 'Review 3'],
        ['feedback', 'Feedback across the three reviews: teacher twice, another person once; assessor countersigned', 'Feedback']
      ]
    },
    u2: {
      id: 'u2', code: 'J17W 75', name: 'Skills Development', short: 'Skills Development', tag: 'Skills',
      source: 'https://www.sqa.org.uk/files/nq/J17W75.pdf',
      outcomes: [
        { name: 'Investigate practical skills required for a chosen job role', pc: [
          ['a', 'Identify practical skills required for a chosen job role.'],
          ['b', 'Evaluate own practical skills relevant to a chosen job role.'],
          ['c', 'Set targets for further development of own practical skills.']
        ] },
        { name: 'Develop own practical skills', pc: [
          ['a', 'Select approaches for developing own practical skills.'],
          ['b', 'Plan and implement approaches.'],
          ['c', 'Practise and refine practical skills in a creative context.']
        ] },
        { name: 'Evaluate own practical skills development', pc: [
          ['a', 'Evaluate effectiveness of chosen approaches in supporting own practical skills development.'],
          ['b', 'Seek feedback from others.'],
          ['c', 'Evaluate own progress based on information gathered.']
        ] }
      ],
      checks: [
        ['skills', 'At least three job-related practical skills identified', 'Skills'],
        ['targets', 'At least three practical-skill development targets documented', 'Targets'],
        ['approaches', 'At least three development approaches and implementation plan documented', 'Approaches'],
        ['observation', 'Practical demonstration supported by an assessor observation checklist', 'Observed'],
        ['feedback', 'Evaluation includes feedback from teacher and another person', 'Feedback']
      ]
    },
    u3: {
      id: 'u3', code: 'J17X 75', name: 'The Creative Process', short: 'Creative Process', tag: 'Process',
      source: 'https://www.sqa.org.uk/files/nq/J17X75.pdf',
      outcomes: [
        { name: 'Prepare for a team response to a given brief', pc: [
          ['a', 'Produce a personal response to a given brief.'],
          ['b', 'Present a personal response to the team.'],
          ['c', 'Respond to feedback on personal response.'],
          ['d', 'Provide feedback to other team members’ personal responses.'],
          ['e', 'Agree team response.']
        ] },
        { name: 'Produce and present the team response', pc: [
          ['a', 'Contribute to identification of key tasks and stages for the response.'],
          ['b', 'Contribute to identification and agreement of roles and responsibilities.'],
          ['c', 'Carry out own agreed role(s) in the team presentation.']
        ] },
        { name: 'Evaluate the team response', pc: [
          ['a', 'Seek feedback from audience.'],
          ['b', 'Evaluate effectiveness of the team response.']
        ] }
      ],
      checks: [
        ['personal', 'Individual response to the Viral Challenge in folio', 'Response'],
        ['obs1', 'Outcome 1: assessor observation checklist recorded', 'Obs O1'],
        ['obs2', 'Outcome 2: assessor observation checklist recorded', 'Obs O2'],
        ['presentation', 'Team presentation and individual contribution evidenced', 'Presented'],
        ['evaluation', 'Audience feedback and personal evaluation filed', 'Evaluation']
      ]
    },
    u4: {
      id: 'u4', code: 'J17Y 75', name: 'Creative Project', short: 'Creative Project', tag: 'Project',
      source: 'https://www.sqa.org.uk/files/nq/J17Y75.pdf',
      outcomes: [
        { name: 'Contribute to the production of a plan for a creative project in response to a given brief', pc: [
          ['a', 'Agree a suitable creative project.'],
          ['b', 'Identify key tasks required to implement the creative project.'],
          ['c', 'Identify resources required to implement the creative project.'],
          ['d', 'Contribute to the allocation of roles and responsibilities.'],
          ['e', 'Agree own tasks required to implement the creative project.'],
          ['f', 'Agree timescales and review dates for the creative project.']
        ] },
        { name: 'Contribute to the implementation of a creative project', pc: [
          ['a', 'Carry out own tasks as planned.'],
          ['b', 'Use practical skills, resources, techniques and equipment as planned.'],
          ['c', 'Comply with relevant health and safety guidelines.'],
          ['d', 'Review progress of the creative project at agreed dates.'],
          ['e', 'Support others while undertaking activity.']
        ] },
        { name: 'Evaluate the creative project', pc: [
          ['a', 'Evaluate own and team contribution to the creative project.'],
          ['b', 'Evaluate implementation of the creative project.']
        ] }
      ],
      checks: [
        ['plan', 'Group project plan and agreed individual responsibilities filed', 'Plan'],
        ['obs1', 'Planning participation supported by assessor observation checklist', 'Obs plan'],
        ['obs2', 'Implementation supported by assessor observation checklist', 'Obs work'],
        ['evaluation', 'Final evaluation includes at least two future action points', 'Evaluation']
      ]
    }
  };

  // The Scotland variant of the Introduction unit has its own code and wording.
  function forVariant(variant) {
    var units = JSON.parse(JSON.stringify(UNITS));
    if (variant === 'SCOT') {
      units.u1.name = 'An Introduction – Scotland';
      units.u1.code = 'H6MV 75';
      units.u1.source = 'https://www.sqa.org.uk/sqa/files/nq/H6MV75.pdf';
      units.u1.outcomes[0].name = 'Investigate the creative industries in Scotland';
      units.u1.outcomes[0].pc[0][1] = 'Identify and describe sectors within the creative industries in Scotland.';
    }
    Object.keys(units).forEach(function (id) {
      var u = units[id];
      u.criteria = [];
      u.outcomes.forEach(function (o, i) {
        o.pc.forEach(function (pc) {
          u.criteria.push({
            code: id + '.' + (i + 1) + pc[0],
            label: (i + 1) + pc[0],
            text: pc[1],
            outcome: i + 1,
            outcomeName: o.name
          });
        });
      });
      u.checkpoints = u.checks.map(function (c) {
        return { code: id + '.check.' + c[0], key: c[0], text: c[1], short: c[2] || c[0] };
      });
    });
    return units;
  }

  window.CI_ASSESS_UNITS = {
    ORDER: ['u1', 'u2', 'u3', 'u4'],
    forVariant: forVariant,
    EVIDENCE_TYPES: ['Folio / OneNote', 'Observation', 'Presentation', 'Peer or audience feedback', 'Practical product', 'Learner review', 'Other']
  };
})();
