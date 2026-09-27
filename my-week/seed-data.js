/**
 * My Week demo data.
 *
 * Illustrative Art, Drama, Photography and Creative Industries material
 * for a Knightswood Secondary teacher. Not live school records.
 * No pupil names. "Craig" is a colleague, as in the planning brief.
 *
 * Dates are offsets from the school week the prototype is first opened.
 * The app turns those offsets into real dates and stores them.
 *
 * Integration:
 * - tasks: personal and linked rows the teacher owns
 * - facultyEvents: read-only Faculty Calendar items (not task completion)
 * - timetable: weekly teaching pattern, replaced later by the hub timetable
 * - routines / focus examples: personal, not compliance
 */
(function () {
  "use strict";

  var classCodes = [
    "1DRA1",
    "2DRA1",
    "3DRA2",
    "4DRA1",
    "5DRA1",
    "5CI1",
    "4ART2",
    "5ART1",
    "5PHOTO1"
  ];

  window.MyWeekSeed = {
    classCodes: classCodes,

    linkedAreas: {
      attainment: "Attainment Meetings",
      lesson: "Lesson Planner",
      support: "Class Support",
      tracking: "Tracking"
    },

    focusExamples: [
      "Make questioning more deliberate.",
      "Give pupils longer thinking time.",
      "Make evaluation visible.",
      "Improve transitions between activities."
    ],

    routineTemplates: [
      { id: "routine_do_now", title: "Do Now" },
      { id: "routine_reflection", title: "Reflection / Plenary" },
      { id: "routine_homework", title: "Homework checked" },
      { id: "routine_resources", title: "Resources prepared ahead" },
      { id: "routine_lesson_reflection", title: "Lesson reflection" }
    ],

    /**
     * weekOffset 0 is the school week containing the first open.
     * dayIndex 0 is Monday … 4 is Friday.
     * type "faculty" is read-only and does not count toward progress.
     */
    tasks: [
      { id: "task_001", weekOffset: 0, dayIndex: 0, title: "Print S1 mime evaluation sheets", type: "personal", completed: true, priority: "normal", createdAt: "T08:05:00" },
      { id: "task_002", weekOffset: 0, dayIndex: 0, title: "Email Craig", type: "personal", completed: true, priority: "normal", notes: "Craig needs the S2 groups before Thursday.", createdAt: "T08:10:00" },
      { id: "task_003", weekOffset: 0, dayIndex: 0, title: "Check S2 staging assessment", type: "personal", completed: true, priority: "normal", createdAt: "T08:20:00" },
      { id: "task_004", weekOffset: 0, dayIndex: 0, title: "Complete S4 attainment notes", type: "linked", completed: false, priority: "important", linkedArea: "attainment", linkedId: "4DRA1", createdAt: "T08:30:00" },

      { id: "task_005", weekOffset: 0, dayIndex: 1, title: "Prepare AH Drama rehearsal task", type: "personal", completed: true, priority: "important", createdAt: "T08:05:00" },
      { id: "task_006", weekOffset: 0, dayIndex: 1, title: "Review 5DRA1 attainment notes", type: "linked", completed: true, priority: "normal", linkedArea: "attainment", linkedId: "5DRA1", createdAt: "T08:15:00" },
      { id: "task_007", weekOffset: 0, dayIndex: 1, title: "Order black card", type: "personal", completed: true, priority: "normal", notes: "For S3 melodrama masks.", createdAt: "T08:25:00" },
      { id: "task_008", weekOffset: 0, dayIndex: 1, title: "Upload Creative Industries brief", type: "linked", completed: true, priority: "normal", linkedArea: "lesson", linkedId: "5CI1", createdAt: "T08:40:00" },
      { id: "task_009", weekOffset: 0, dayIndex: 1, title: "Bring printed examples", type: "faculty", completed: false, priority: "normal", notes: "For Professional Learning at 3:45.", createdAt: "T15:00:00" },

      { id: "task_010", weekOffset: 0, dayIndex: 2, title: "Prepare 2DRA1 lesson", type: "linked", completed: false, priority: "normal", linkedArea: "lesson", linkedId: "2DRA1", createdAt: "T08:05:00" },
      { id: "task_011", weekOffset: 0, dayIndex: 2, title: "Check Photography folio progress", type: "linked", completed: false, priority: "important", linkedArea: "attainment", linkedId: "5PHOTO1", createdAt: "T08:15:00" },
      { id: "task_012", weekOffset: 0, dayIndex: 2, title: "Email pupil support", type: "personal", completed: true, priority: "normal", createdAt: "T08:30:00" },
      { id: "task_013", weekOffset: 0, dayIndex: 2, title: "Prepare Professional Learning activity", type: "personal", completed: true, priority: "normal", createdAt: "T09:00:00" },
      { id: "task_014", weekOffset: 0, dayIndex: 2, title: "Draft S3 melodrama stimulus", type: "personal", completed: false, priority: "normal", createdAt: "T09:20:00" },

      { id: "task_015", weekOffset: 0, dayIndex: 3, title: "Check S5 Photography support information", type: "linked", completed: false, priority: "normal", linkedArea: "support", linkedId: "5PHOTO1", createdAt: "T08:05:00" },
      { id: "task_016", weekOffset: 0, dayIndex: 3, title: "Set out S4 Art folio table", type: "personal", completed: false, priority: "normal", createdAt: "T08:20:00" },
      { id: "task_017", weekOffset: 0, dayIndex: 3, title: "Write 3DRA2 lesson reflection", type: "personal", completed: false, priority: "normal", createdAt: "T08:40:00" },
      { id: "task_018", weekOffset: 0, dayIndex: 3, title: "Upload Photography resources", type: "personal", completed: true, priority: "normal", createdAt: "T09:00:00" },
      { id: "task_019", weekOffset: 0, dayIndex: 3, title: "Order tracing paper", type: "personal", completed: false, priority: "normal", createdAt: "T09:15:00" },

      { id: "task_020", weekOffset: 0, dayIndex: 4, title: "Pack exhibition labels", type: "personal", completed: false, priority: "normal", createdAt: "T08:05:00" },
      { id: "task_021", weekOffset: 0, dayIndex: 4, title: "Confirm technician for Friday sharing", type: "personal", completed: false, priority: "normal", createdAt: "T08:20:00" },

      { id: "task_090", weekOffset: -1, dayIndex: 3, title: "Update S2 Drama resources", type: "personal", completed: false, priority: "normal", createdAt: "T10:00:00" },
      { id: "task_091", weekOffset: -1, dayIndex: 4, title: "Send AH rehearsal schedule", type: "personal", completed: false, priority: "important", createdAt: "T10:20:00" },
      { id: "task_092", weekOffset: -1, dayIndex: 0, title: "Print S4 scripts", type: "personal", completed: true, priority: "normal", createdAt: "T08:10:00" },
      { id: "task_093", weekOffset: -1, dayIndex: 1, title: "Email technician about gels", type: "personal", completed: true, priority: "normal", createdAt: "T08:30:00" }
    ],

    focuses: [
      { weekOffset: 0, focus: "Make questioning more deliberate." },
      { weekOffset: -1, focus: "Give pupils longer thinking time." }
    ],

    /**
     * Completion is Monday to Friday. Seeded so the matrix is lived-in,
     * not a blank compliance grid.
     */
    routines: [
      {
        weekOffset: 0,
        items: {
          routine_do_now: [true, true, true, false, true],
          routine_reflection: [true, false, true, true, false],
          routine_homework: [false, true, false, true, false],
          routine_resources: [true, true, true, true, true],
          routine_lesson_reflection: [true, false, false, false, true]
        }
      },
      {
        weekOffset: -1,
        items: {
          routine_do_now: [true, true, true, true, false],
          routine_reflection: [true, true, false, true, true],
          routine_homework: [true, false, true, false, false],
          routine_resources: [true, true, true, false, true],
          routine_lesson_reflection: [false, true, true, false, false]
        }
      }
    ],

    /** Read-only. Future source: Faculty Calendar. Not mixed into task totals. */
    facultyEvents: [
      { id: "faculty_001", dayIndex: 0, title: "S4 Art attainment discussions" },
      { id: "faculty_002", dayIndex: 1, title: "Professional Learning · 3:45" },
      { id: "faculty_003", dayIndex: 2, title: "S5/6 Tracking closes" },
      { id: "faculty_004", dayIndex: 2, title: "Moderation session" },
      { id: "faculty_005", dayIndex: 3, title: "Photography folio check" }
    ],

    /**
     * Repeats each week until the hub injects a real timetable.
     * planStatus: attached | resources | none | free
     */
    timetable: {
      monday: [
        { period: "P1", classCode: "1DRA1", subject: "Drama", lessonTitle: "Mime · Lesson 4", planStatus: "attached" },
        { period: "P2", planStatus: "free" },
        { period: "P3", classCode: "3DRA2", subject: "Drama", lessonTitle: "Character Development", planStatus: "none" },
        { period: "P4", classCode: "5CI1", subject: "Creative Industries", lessonTitle: "Viral Challenge", planStatus: "resources" },
        { period: "P5", classCode: "2DRA1", subject: "Drama", lessonTitle: "Tableau and levels", planStatus: "attached" },
        { period: "P6", planStatus: "free" },
        { period: "P7", planStatus: "free" }
      ],
      tuesday: [
        { period: "P1", classCode: "5DRA1", subject: "Drama", lessonTitle: "AH rehearsal notes", planStatus: "attached" },
        { period: "P2", classCode: "4DRA1", subject: "Drama", lessonTitle: "Stimulus response", planStatus: "none" },
        { period: "P3", planStatus: "free" },
        { period: "P4", classCode: "1DRA1", subject: "Drama", lessonTitle: "Mime · Lesson 5", planStatus: "attached" },
        { period: "P5", classCode: "5PHOTO1", subject: "Photography", lessonTitle: "Folio tutorial", planStatus: "resources" },
        { period: "P6", classCode: "3DRA2", subject: "Drama", lessonTitle: "Status and space", planStatus: "attached" },
        { period: "P7", planStatus: "free" }
      ],
      wednesday: [
        { period: "P1", planStatus: "free" },
        { period: "P2", classCode: "2DRA1", subject: "Drama", lessonTitle: "Melodrama conventions", planStatus: "attached" },
        { period: "P3", classCode: "5CI1", subject: "Creative Industries", lessonTitle: "Audience research", planStatus: "none" },
        { period: "P4", classCode: "5DRA1", subject: "Drama", lessonTitle: "Monologue workshop", planStatus: "attached" },
        { period: "P5", planStatus: "free" },
        { period: "P6", classCode: "3DRA2", subject: "Drama", lessonTitle: "Rehearsal", planStatus: "none" },
        { period: "P7", classCode: "5ART1", subject: "Art", lessonTitle: "Critical studies", planStatus: "resources" }
      ],
      thursday: [
        { period: "P1", classCode: "1DRA1", subject: "Drama", lessonTitle: "Evaluation", planStatus: "attached" },
        { period: "P2", planStatus: "free" },
        { period: "P3", classCode: "4ART2", subject: "Art", lessonTitle: "Observational studies", planStatus: "none" },
        { period: "P4", classCode: "2DRA1", subject: "Drama", lessonTitle: "Performance prep", planStatus: "attached" },
        { period: "P5", classCode: "5CI1", subject: "Creative Industries", lessonTitle: "Pitch draft", planStatus: "resources" },
        { period: "P6", classCode: "4DRA1", subject: "Drama", lessonTitle: "Attainment conversation", planStatus: "none" },
        { period: "P7", classCode: "5DRA1", subject: "Drama", lessonTitle: "Technical rehearsal", planStatus: "none" }
      ],
      friday: [
        { period: "P1", classCode: "3DRA2", subject: "Drama", lessonTitle: "Sharing", planStatus: "attached" },
        { period: "P2", classCode: "1DRA1", subject: "Drama", lessonTitle: "Cool down and reflection", planStatus: "attached" },
        { period: "P3", planStatus: "free" },
        { period: "P4", classCode: "5PHOTO1", subject: "Photography", lessonTitle: "Folio check", planStatus: "resources" },
        { period: "P5", classCode: "2DRA1", subject: "Drama", lessonTitle: "Peer feedback", planStatus: "none" },
        { period: "P6", planStatus: "free" },
        { period: "P7", planStatus: "free" }
      ]
    }
  };
})();
