/**
 * My Week starting data.
 *
 * Teachers start with a blank week: no tasks, focus, ticked routines,
 * faculty events or timetable. Only the routine rows and focus prompts
 * are provided. Dates in any rows added here are offsets from the school
 * week the page is first opened; the app turns them into real dates.
 *
 * Integration:
 * - tasks: personal and linked rows the teacher owns
 * - facultyEvents: read-only Faculty Calendar items (not task completion)
 * - timetable: weekly teaching pattern, replaced later by the hub timetable
 * - routines / focus examples: personal, not compliance
 */
(function () {
  "use strict";

  window.MyWeekSeed = {
    /* Suggestions for the class field. Empty until the hub supplies real codes. */
    classCodes: [],

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
    tasks: [],

    focuses: [],

    /** Completion is Monday to Friday, per routine template. */
    routines: [],

    /** Read-only. Future source: Faculty Calendar. Not mixed into task totals. */
    facultyEvents: []
  };
})();
