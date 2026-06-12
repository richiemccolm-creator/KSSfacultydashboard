/**
 * Curriculum units for Drama, Art & Design, Photography.
 * Shared by trackers and teacher planner. Single source of truth.
 * CURRICULUM_TPS: full shape (eos, modes, assessed) for trackers.
 * CURRICULUM_UNITS: same structure, used by planner.
 */
window.CURRICULUM_TPS = {
  drama: {
    s1: [
      { id: 'tp1', label: 'TP1', unit: 'Mime & Melodrama', timing: 'Aug–Sep', eos: ['EXA 3-12a', 'EXA 3-14a', 'EXA 3-15a'], modes: ['Do', 'Write'], assessed: 'Performance of mime/melodrama + peer & self evaluation' , meta_skills: ["Creativity", "Communicating", "Sense-making"], meta_notes: ["Creating solutions through physical storytelling and thinking outside the box (Second Level)", "Communicating emotion and character to an audience without words (Second Level)", "Identifying and ordering patterns in performance using S.P.E.C.S. (Second Level)"] },
      { id: 'tp2', label: 'TP2', unit: 'Improvisation', timing: 'Oct–Nov', eos: ['EXA 3-12a', 'EXA 3-14a', 'EXA 3-15a'], modes: ['Do', 'Say'], assessed: 'Improvised scene performance + written reflection' , meta_skills: ["Creativity", "Adapting", "Collaborating"], meta_notes: ["Generating and adapting ideas spontaneously in improvised scenes (Second Level)", "Changing approach when working in a group and responding to unexpected offers (Second Level)", "Building on others' ideas and reaching agreements during group improvisation (Second Level)"] },
      { id: 'tp3', label: 'TP3', unit: 'Intro to Stimulus', timing: 'Nov–Dec', eos: ['EXA 3-12a', 'EXA 3-14a', 'EXA 3-15a'], modes: ['Do', 'Write', 'Say'], assessed: 'Group-devised scene + verbal & written evaluation' , meta_skills: ["Curiosity", "Creativity", "Sense-making"], meta_notes: ["Posing interesting questions about stimulus material to deepen understanding (Second Level)", "Developing original creative responses to images, music and text (Second Level)", "Organising devised work in a logical structure with clear purpose (Third/Fourth Level)"] },
      { id: 'tp4', label: 'TP4', unit: 'Working with Scripts', timing: 'Jan–Feb', eos: ['EXA 3-12a', 'EXA 3-14a', 'EXA 3-15a'], modes: ['Do', 'Write'], assessed: 'Scripted scene performance + written evaluation' , meta_skills: ["Critical thinking", "Sense-making", "Focusing"], meta_notes: ["Examining options and weighing pros and cons of character choices (Third/Fourth Level)", "Drawing conclusions from script analysis using drama vocabulary (Second Level)", "Remaining focused during rehearsal to complete scripted performance tasks (Second Level)"] },
      { id: 'tp5', label: 'TP5', unit: 'Production Skills', timing: 'Feb–Mar', eos: ['EXA 3-14a', 'EXA 3-15a'], modes: ['Make', 'Write'], assessed: 'Design task (lighting plan or set design sketch) + written reflection' , meta_skills: ["Initiative", "Creativity", "Critical thinking"], meta_notes: ["Setting own goals and planning production tasks within deadlines (Second Level)", "Problem-solving design and production challenges creatively (Second Level)", "Evaluating how design choices shape audience experience (Third/Fourth Level)"] },
      { id: 'tp6', label: 'TP6', unit: 'Small-Scale Production', timing: 'Apr–May', eos: ['EXA 3-12a', 'EXA 3-14a', 'EXA 3-15a'], modes: ['Do', 'Write', 'Say'], assessed: 'Final performance showcase + written self-evaluation' , meta_skills: ["Leading", "Collaborating", "Focusing"], meta_notes: ["Co-ordinating activities with others during group production (Third/Fourth Level)", "Taking increasing responsibility for team work and reaching compromise (Third/Fourth Level)", "Focusing on the task through planning, rehearsal and final performance (Third/Fourth Level)"] }
    ],
    s2: [
      { id: 'tp1', label: 'TP1', unit: 'Stage Combat', timing: 'May–Jun', eos: ['EXA 3-12a', 'EXA 3-14a', 'EXA 3-15a'], modes: ['Do', 'Write'], assessed: 'Safe performance of staged fight + written reflection on safety & technique' , meta_skills: ["Focusing", "Adapting", "Feeling"], meta_notes: ["Being systematic and working through safety protocols with concentration (Second Level)", "Responding to partner feedback and adapting choreographed sequences (Third/Fourth Level)", "Showing sensitivity to others' feelings and physical boundaries (Third/Fourth Level)"] },
      { id: 'tp2', label: 'TP2', unit: 'Areas of Stage & Staging', timing: 'Aug–Sep', eos: ['EXA 3-12a', 'EXA 3-14a', 'EXA 3-15a'], modes: ['Do', 'Write', 'Say'], assessed: 'Blocking exercise + written analysis of how staging affects audience' , meta_skills: ["Sense-making", "Creativity", "Critical thinking"], meta_notes: ["Identifying and ordering patterns in staging configurations and stage areas (Second Level)", "Experimenting with blocking and spatial solutions (Third/Fourth Level)", "Examining pros and cons of staging choices on audience experience (Third/Fourth Level)"] },
      { id: 'tp3', label: 'TP3', unit: 'Voice & Movement', timing: 'Sep–Oct', eos: ['EXA 3-12a', 'EXA 3-14a', 'EXA 3-15a'], modes: ['Do', 'Say'], assessed: 'Performance piece + peer evaluation using drama vocabulary' , meta_skills: ["Communicating", "Focusing", "Adapting"], meta_notes: ["Communicating confidently through integrated voice and movement (Third/Fourth Level)", "Organising thinking to sustain focus on character and mood (Third/Fourth Level)", "Critically evaluating and changing approach in response to peer feedback (Third/Fourth Level)"] },
      { id: 'tp4', label: 'TP4', unit: 'Working with Scripts', timing: 'Oct–Nov', eos: ['EXA 3-12a', 'EXA 3-14a', 'EXA 3-15a'], modes: ['Do', 'Write'], assessed: 'Scripted performance with annotated script + written evaluation' , meta_skills: ["Critical thinking", "Sense-making", "Collaborating"], meta_notes: ["Explaining and justifying performance choices from script analysis (Third/Fourth Level)", "Drawing conclusions about character, relationships and subtext (Third/Fourth Level)", "Working collaboratively in ensemble rehearsal and refining scenes (Second Level)"] },
      { id: 'tp5', label: 'TP5', unit: 'Production Skills', timing: 'Nov–Dec', eos: ['EXA 3-12a', 'EXA 3-14a', 'EXA 3-15a'], modes: ['Make', 'Write', 'Say'], assessed: 'Technical design presentation for one production area + written review' , meta_skills: ["Leading", "Initiative", "Critical thinking"], meta_notes: ["Taking responsibility for a production area and co-ordinating with others (Third/Fourth Level)", "Determining and setting realistic targets for production tasks (Third/Fourth Level)", "Evaluating design decisions and predicting likely consequences (Third/Fourth Level)"] },
      { id: 'tp6', label: 'TP6', unit: 'Showcase & Review', timing: 'Apr–May', eos: ['EXA 3-12a', 'EXA 3-14a', 'EXA 3-15a'], modes: ['Do', 'Write', 'Say'], assessed: 'Live performance in role + final written reflection — S2 transition data' , meta_skills: ["Feeling", "Collaborating", "Integrity"], meta_notes: ["Managing performance nerves and showing sensitivity in showcase context (Third/Fourth Level)", "Giving and responding to feedback and reaching agreement through compromise (Third/Fourth Level)", "Demonstrating personal values through performance reflection (Third/Fourth Level)"] }
    ],
    s3: [
      { id: 'tp1', label: 'TP1', unit: 'Directing Unit', timing: 'May–Jun', eos: ['EXA 4-12a', 'EXA 4-14a', 'EXA 4-15a'], modes: ['Do', 'Say'], assessed: 'Short directing task — tension, mood & atmosphere; verbal justification of decisions' },
      { id: 'tp2', label: 'TP2', unit: 'Forms & Conventions', timing: 'Aug–Sep', eos: ['EXA 4-12a', 'EXA 4-14a', 'EXA 4-15a'], modes: ['Do', 'Write', 'Make'], assessed: 'Performance using forms & conventions + written reflection on audience impact' },
      { id: 'tp3', label: 'TP3', unit: 'Theatre in Education', timing: 'Sep–Oct', eos: ['EXA 4-12a', 'EXA 4-14a', 'EXA 4-15a'], modes: ['Do', 'Write'], assessed: 'Teacher-assessed TIE performance + written evaluation of purpose & message' },
      { id: 'tp4', label: 'TP4', unit: 'Script Unit + Mini PFP', timing: 'Oct–Dec', eos: ['EXA 4-12a', 'EXA 4-14a', 'EXA 4-15a'], modes: ['Do', 'Write'], assessed: 'S3 PFP mini-essay (acting) + script performance + rehearsal diaries' },
      { id: 'tp5', label: 'TP5', unit: 'Drama Skills — Stimulus', timing: 'Jan–Feb', eos: ['EXA 4-12a', 'EXA 4-14a', 'EXA 4-15a'], modes: ['Do', 'Write', 'Say'], assessed: 'Written booklet + rehearsal diaries + group stimulus performance + peer feedback' },
      { id: 'tp6', label: 'TP6', unit: 'Production Skills — Design', timing: 'Feb–Apr', eos: ['EXA 4-14a', 'EXA 4-15a'], modes: ['Make', 'Write', 'Say'], assessed: 'S3 PFP Design essay + final design concept with production artefacts + Q&A' }
    ]
  },
  art: {
    s1: [
      { id: 'tp1', label: 'TP1', unit: 'Pattern', timing: 'On unit completion', eos: ['EXA 3-02a', 'EXA 3-03a', 'EXA 3-06a'], modes: ['Make', 'Write'], assessed: 'Completed pattern design in response to brief with written/verbal evaluation' , meta_skills: ["Creativity", "Sense-making", "Focusing"], meta_notes: ["Creating design solutions in response to a brief (Second Level)", "Recognising repeat, symmetry and motif patterns in visual design (Second Level)", "Working systematically through the design process (Second Level)"] },
      { id: 'tp2', label: 'TP2', unit: 'Colour', timing: 'On unit completion', eos: ['EXA 3-02a', 'EXA 3-03a', 'EXA 3-07a'], modes: ['Make', 'Say'], assessed: 'Colour theory exercises and colour study painting — mixing, tints, shades' , meta_skills: ["Curiosity", "Creativity", "Sense-making"], meta_notes: ["Asking questions about how colour creates meaning and mood (Second Level)", "Experimenting with mixing, tints and shades (Second Level)", "Connecting Colourist context to own colour work (Second Level)"] },
      { id: 'tp3', label: 'TP3', unit: 'Shape, Texture & Form', timing: 'On unit completion', eos: ['EXA 3-02a', 'EXA 3-03a', 'EXA 3-07a'], modes: ['Make', 'Do'], assessed: '3D tile or relief piece with verbal evaluation using art vocabulary', meta_skills: ['Creativity', 'Critical thinking', 'Curiosity'], meta_notes: ['Experimenting with materials to create 3D form (Second Level)', 'Explaining and justifying choices using art vocabulary (Second Level)', 'Exploring Cubism and Brutalism as contextual references (Second Level)'] },
      { id: 'tp4', label: 'TP4', unit: 'Line', timing: 'On unit completion', eos: ['EXA 3-03a'], modes: ['Make', 'Do'], assessed: 'Continuous line drawing and observational study demonstrating line variation' , meta_skills: ["Focusing", "Sense-making", "Initiative"], meta_notes: ["Sustained concentration on continuous line and observational drawing (Second Level)", "Identifying patterns and relationships in observed subjects (Second Level)", "Persisting with challenging drawing tasks and setting own improvement goals (Second Level)"] },
      { id: 'tp5', label: 'TP5', unit: 'Mid-year review', timing: 'Mid-year', eos: ['EXA 3-07a'], modes: ['Write', 'Say'], assessed: 'Written/verbal self-evaluation across first two completed units' , meta_skills: ["Critical thinking", "Sense-making", "Initiative"], meta_notes: ["Self-evaluating work across completed units with reasoned judgement (Third/Fourth Level)", "Identifying patterns in progress and areas for development (Second Level)", "Setting realistic targets for improvement (Third/Fourth Level)"] },
      { id: 'tp6', label: 'TP6', unit: 'End-of-year review', timing: 'End of year', eos: ['EXA 3-02a', 'EXA 3-03a', 'EXA 3-06a', 'EXA 3-07a'], modes: ['Make', 'Write', 'Say'], assessed: 'Holistic portfolio review across all S1 units — informs S2 planning' , meta_skills: ["Critical thinking", "Focusing", "Adapting"], meta_notes: ["Holistic portfolio review with supporting evidence (Third/Fourth Level)", "Sustained reflection on learning across the year (Third/Fourth Level)", "Adapting approach and planning for next year (Third/Fourth Level)"] }
    ],
    s2: [
      { id: 'tp1', label: 'TP1', unit: '3D Design', timing: 'On unit completion', eos: ['EXA 3-02a', 'EXA 3-03a', 'EXA 3-06a', 'EXA 3-07a'], modes: ['Make', 'Do', 'Write'], assessed: '3D piece with development drawings and evaluation explaining how brief was met' , meta_skills: ["Initiative", "Creativity", "Leading"], meta_notes: ["Planning and selecting information for the 3D design process (Third/Fourth Level)", "Experimenting with designs and materials to make ideas real (Third/Fourth Level)", "Taking ownership of design decisions from investigation to resolution (Second Level)"] },
      { id: 'tp2', label: 'TP2', unit: 'Graphic Design', timing: 'On unit completion', eos: ['EXA 3-02a', 'EXA 3-03a', 'EXA 3-06a', 'EXA 3-07a'], modes: ['Make', 'Write'], assessed: 'Design compositions evaluated against brief — layout, typography, colour' , meta_skills: ["Sense-making", "Creativity", "Communicating"], meta_notes: ["Understanding audience and purpose in graphic design briefs (Third/Fourth Level)", "Developing brief-driven design solutions (Third/Fourth Level)", "Communicating ideas through visual hierarchy and composition (Third/Fourth Level)"] },
      { id: 'tp3', label: 'TP3', unit: 'Expressive', timing: 'On unit completion', eos: ['EXA 3-02a', 'EXA 3-03a', 'EXA 3-07a'], modes: ['Make', 'Say'], assessed: 'Two-media expressive piece with observational drawing and style exploration' , meta_skills: ["Creativity", "Curiosity", "Feeling"], meta_notes: ["Exploring personal creative voice through expressive work (Third/Fourth Level)", "Being curious about unfamiliar artistic approaches and influences (Third/Fourth Level)", "Using visual elements to express mood and feeling (Second Level)"] },
      { id: 'tp4', label: 'TP4', unit: 'Portraiture', timing: 'On unit completion', eos: ['EXA 3-03a', 'EXA 3-04a', 'EXA 3-07a'], modes: ['Make', 'Write'], assessed: 'Final portrait — accurate proportions, applied tone and texture. Artist influence explained' , meta_skills: ["Focusing", "Critical thinking", "Feeling"], meta_notes: ["Sustained focus on observational accuracy in portraiture (Third/Fourth Level)", "Justifying proportion, tone and technique choices with evidence (Third/Fourth Level)", "Showing sensitivity when representing others in portrait work (Third/Fourth Level)"] },
      { id: 'tp5', label: 'TP5', unit: 'Mid-year review', timing: 'Mid-year', eos: ['EXA 3-07a'], modes: ['Write', 'Say'], assessed: 'Written/verbal self-evaluation across first two completed units' , meta_skills: ["Critical thinking", "Sense-making", "Initiative"], meta_notes: ["Self-evaluating work across completed units with reasoned judgement (Third/Fourth Level)", "Identifying patterns in progress and areas for development (Second Level)", "Setting realistic targets for improvement (Third/Fourth Level)"] },
      { id: 'tp6', label: 'TP6', unit: 'End-of-year review', timing: 'End of year', eos: ['EXA 3-02a', 'EXA 3-03a', 'EXA 3-06a', 'EXA 3-07a'], modes: ['Make', 'Write', 'Say'], assessed: 'Holistic review — all S2 units. Data used for senior phase pathway planning' , meta_skills: ["Critical thinking", "Focusing", "Adapting"], meta_notes: ["Holistic portfolio review with supporting evidence (Third/Fourth Level)", "Sustained reflection on learning across the year (Third/Fourth Level)", "Adapting approach and planning for next year (Third/Fourth Level)"] }
    ],
    s3: [
      { id: 'tp1', label: 'TP1', unit: 'Expressive Investigations', timing: 'Term 1', eos: ['EXA 4-02a', 'EXA 4-03a', 'EXA 4-07a'], modes: ['Make', 'Write'], assessed: 'Sketchbook investigations, series of expressive studies, artist research page' },
      { id: 'tp2', label: 'TP2', unit: 'Expressive Developments', timing: 'Term 2a', eos: ['EXA 4-02a', 'EXA 4-03a', 'EXA 4-07a'], modes: ['Make', 'Write'], assessed: 'Developed sketchbook work, refined studies, resolved expressive artwork' },
      { id: 'tp3', label: 'TP3', unit: 'Critical Study — Expressive (Frida Kahlo)', timing: 'Term 2b', eos: ['EXA 4-04a', 'EXA 4-07a'], modes: ['Write'], assessed: 'Critical analysis writing, artist research notes, visual response study' },
      { id: 'tp4', label: 'TP4', unit: 'Critical Study — Design (Philippe Starck)', timing: 'Term 3', eos: ['EXA 4-05a', 'EXA 4-06a', 'EXA 4-07a'], modes: ['Write'], assessed: 'Critical analysis writing, designer research notes, design response study' },
      { id: 'tp5', label: 'TP5', unit: 'Expressive Final + Evaluation', timing: 'Term 4a', eos: ['EXA 4-02a', 'EXA 4-03a', 'EXA 4-07a'], modes: ['Make', 'Write'], assessed: 'Final resolved artwork, written evaluation, annotated sketchbook' },
      { id: 'tp6', label: 'TP6', unit: 'Design — Market Research + Brief', timing: 'Term 4b', eos: ['EXA 4-05a', 'EXA 4-06a', 'EXA 4-07a'], modes: ['Write', 'Make'], assessed: 'Market research notes, design brief document, range of initial ideas' }
    ]
  },
  photography: {
    npas3: [
      { id: 'npa-s3-01', label: 'NPA S3', unit: 'NPA Photography S3', timing: 'S3', subject: 'photography' }
    ],
    npas4: [
      { id: 'npa-s4-01', label: 'NPA S4', unit: 'NPA Photography S4', timing: 'S4', subject: 'photography' }
    ],
    higher: [
      { id: 'higher-01', label: 'Higher', unit: 'Higher Photography', timing: 'S5/6', subject: 'photography' }
    ]
  }
};

window.CURRICULUM_UNITS = window.CURRICULUM_TPS;

/**
 * Get unit key for storage, e.g. "drama-s1-tp1"
 */
window.getUnitKey = function(subject, yearGroup, tpId) {
  return subject + '-' + yearGroup + '-' + tpId;
};

/**
 * Get unit from key
 */
window.getUnitFromKey = function(key) {
  var parts = (key || '').split('-');
  if (parts.length < 2) return null;
  var subj = window.CURRICULUM_UNITS && window.CURRICULUM_UNITS[parts[0]];
  if (!subj) return null;
  var yg = parts[1];
  var ygData = subj[yg];
  if (!ygData) return null;
  if (parts.length === 3) {
    return ygData.find(function(u) { return u.id === parts[2]; }) || null;
  }
  if (parts.length > 3) {
    var tpId = parts.slice(2).join('-');
    return ygData.find(function(u) { return u.id === tpId; }) || null;
  }
  return ygData[0] || null;
};
