'use strict';
/** Shared monthly activity grid for Quality Calendar + Faculty Hub home (read-only). */
window.QualityCalendarMonthsData = [
  { month: "Aug", categories: [
    { name: "QI 2.3 Learning, teaching & assessment", cat: "qi23", activities: [
      { key: "learnerConversations", name: "Learner Conversation", gc: ["Progress"], missions: ["QI 2.3"], focus: ["S4"] }
    ]},
    { name: "QI 3.1 Ensuring wellbeing, equality & inclusion", cat: "qi31", activities: [
      { key: "environment", name: "Environment Checklist", gc: ["Wellbeing"], missions: ["QI 3.1"], focus: ["*"] }
    ]},
    { name: "QI 3.2 Raising attainment & achievement", cat: "qi32", activities: [
      { key: "tracking", name: "School Attainment Data (incl. tracking info)", gc: ["Progress"], missions: ["QI 3.2"], focus: ["S4 Initial Grades"] }
    ]}
  ]},
  { month: "Sept", categories: [
    { name: "QI 1.3 Leadership of change", cat: "qi13", activities: [
      { key: "sltMeetings", name: "SLT / PT / FH Meetings", gc: ["Progress"], missions: ["QI 1.3"], focus: ["*"] }
    ]},
    { name: "QI 2.3 Learning, teaching & assessment", cat: "qi23", activities: [
      { key: "learnerConversations", name: "Learner Conversation", gc: ["Progress"], missions: ["QI 2.3"], focus: ["S3", "S5-6"] }
    ]},
    { name: "QI 3.2 Raising attainment & achievement", cat: "qi32", activities: [
      { key: "tracking", name: "School Attainment Data (incl. tracking info)", gc: ["Progress"], missions: ["QI 3.2"], focus: ["S5-6 Initial Grades", "S3 Interim Reports"] },
      { key: "insightData", name: "Insight Data", gc: ["Progress"], missions: ["QI 3.2"], focus: ["*"] },
      { key: "attainmentMeetings", name: "HT / PT-FH Attainment Meetings", gc: ["Progress"], missions: ["QI 3.2"], focus: ["S4-SQA"] }
    ]}
  ]},
  { month: "Oct", categories: [
    { name: "QI 1.3 Leadership of change", cat: "qi13", activities: [
      { key: "prd", name: "PRD Process Complete", gc: ["Progress"], missions: ["QI 1.3"], focus: ["*"] },
      { key: "sipReview", name: "SIP / DIP Review", gc: ["Progress"], missions: ["QI 1.3"], focus: ["*"] }
    ]},
    { name: "QI 2.3 Learning, teaching & assessment", cat: "qi23", activities: [
      { key: "observations", name: "Class Observations & Pupil Voice", gc: ["Progress"], missions: ["QI 2.3"], focus: ["S4"] },
      { key: "learnerConversations", name: "Learner Conversation", gc: ["Progress"], missions: ["QI 2.3"], focus: ["S2", "S4"] }
    ]},
    { name: "QI 3.1 Ensuring wellbeing, equality & inclusion", cat: "qi31", activities: [
      { key: "attendance", name: "Attendance & Exclusion", gc: ["Wellbeing"], missions: ["QI 3.1"], focus: ["*"] }
    ]},
    { name: "QI 3.2 Raising attainment & achievement", cat: "qi32", activities: [
      { key: "tracking", name: "School Attainment Data (incl. tracking info)", gc: ["Progress"], missions: ["QI 3.2"], focus: ["S4 Full reports", "S2 Interim Reports"] },
      { key: "reportQA", name: "Full Report Quality Assurance", gc: ["Progress"], missions: ["QI 2.3"], focus: ["S4"] },
      { key: "leavers", name: "Leaver Destinations", gc: ["Progress"], missions: ["QI 3.2"], focus: ["*"] }
    ]}
  ]},
  { month: "Nov", categories: [
    { name: "QI 1.3 Leadership of change", cat: "qi13", activities: [
      { key: "sltMeetings", name: "SLT / PT / FH Meetings", gc: ["Progress"], missions: ["QI 1.3"], focus: ["*"] }
    ]},
    { name: "QI 2.3 Learning, teaching & assessment", cat: "qi23", activities: [
      { key: "observations", name: "Class Observations & Pupil Voice", gc: ["Progress"], missions: ["QI 2.3"], focus: ["S5-6"] },
      { key: "learnerConversations", name: "Learner Conversation", gc: ["Progress"], missions: ["QI 2.3"], focus: ["S5-6"] }
    ]},
    { name: "QI 3.2 Raising attainment & achievement", cat: "qi32", activities: [
      { key: "tracking", name: "School Attainment Data (incl. tracking info)", gc: ["Progress"], missions: ["QI 3.2"], focus: ["S5-6 Full reports"] },
      { key: "reportQA", name: "Full Report Quality Assurance", gc: ["Progress"], missions: ["QI 2.3"], focus: ["S5-6"] },
      { key: "parentFeedback", name: "Parent Carer Feedback", gc: ["Progress"], missions: [], focus: ["S1"] }
    ]}
  ]},
  { month: "Dec", categories: [
    { name: "QI 1.3 Leadership of change", cat: "qi13", activities: [
      { key: "sipReview", name: "SIP / DIP Review", gc: ["Progress"], missions: ["QI 1.3"], focus: ["*"] }
    ]},
    { name: "QI 2.3 Learning, teaching & assessment", cat: "qi23", activities: [
      { key: "learnerConversations", name: "Learner Conversation", gc: ["Progress"], missions: ["QI 2.3"], focus: ["S3"] }
    ]},
    { name: "QI 3.1 Ensuring wellbeing, equality & inclusion", cat: "qi31", activities: [
      { key: "environment", name: "Environment Checklist", gc: ["Wellbeing"], missions: ["QI 3.1"], focus: ["*"] },
      { key: "attendance", name: "Attendance & Exclusion", gc: ["Wellbeing"], missions: ["QI 3.1"], focus: ["*"] }
    ]},
    { name: "QI 3.2 Raising attainment & achievement", cat: "qi32", activities: [
      { key: "tracking", name: "School Attainment Data (incl. tracking info)", gc: ["Progress"], missions: ["QI 3.2"], focus: ["S3 Full reports"] },
      { key: "reportQA", name: "Full Report Quality Assurance", gc: ["Progress"], missions: ["QI 2.3"], focus: ["S3"] },
      { key: "attainmentMeetings", name: "HT / PT-FH Attainment Meetings", gc: ["Progress"], missions: ["QI 3.2"], focus: ["S1-3"] }
    ]}
  ]},
  { month: "Jan", categories: [
    { name: "QI 1.3 Leadership of change", cat: "qi13", activities: [
      { key: "sltMeetings", name: "SLT / PT / FH Meetings", gc: ["Progress"], missions: ["QI 1.3"], focus: ["*"] }
    ]},
    { name: "QI 2.3 Learning, teaching & assessment", cat: "qi23", activities: [
      { key: "observations", name: "Class Observations & Pupil Voice", gc: ["Progress"], missions: ["QI 2.3"], focus: ["S1-2"] },
      { key: "learnerConversations", name: "Learner Conversation", gc: ["Progress"], missions: ["QI 2.3"], focus: ["S4-5"] }
    ]},
    { name: "QI 3.2 Raising attainment & achievement", cat: "qi32", activities: [
      { key: "tracking", name: "School Attainment Data (incl. tracking info)", gc: ["Progress"], missions: ["QI 3.2"], focus: ["S4-6 Interim Reports"] },
      { key: "attainmentMeetings", name: "HT / PT-FH Attainment Meetings", gc: ["Progress"], missions: ["QI 3.2"], focus: ["S4-6"] },
      { key: "parentFeedback", name: "Parent Carer Feedback", gc: ["Progress"], missions: [], focus: ["S4-6"] }
    ]}
  ]},
  { month: "Feb", categories: [
    { name: "QI 2.3 Learning, teaching & assessment", cat: "qi23", activities: [
      { key: "learnerConversations", name: "Learner Conversation", gc: ["Progress"], missions: ["QI 2.3"], focus: ["S2"] }
    ]},
    { name: "QI 3.2 Raising attainment & achievement", cat: "qi32", activities: [
      { key: "tracking", name: "School Attainment Data (incl. tracking info)", gc: ["Progress"], missions: ["QI 3.2"], focus: ["S2 Full Reports"] },
      { key: "reportQA", name: "Full Report Quality Assurance", gc: ["Progress"], missions: ["QI 2.3"], focus: ["S2"] },
      { key: "insightData", name: "Insight Data", gc: ["Progress"], missions: ["QI 3.2"], focus: ["*"] },
      { key: "leavers", name: "Leaver Destinations", gc: ["Progress"], missions: ["QI 3.2"], focus: ["*"] },
      { key: "parentFeedback", name: "Parent Carer Feedback", gc: ["Progress"], missions: [], focus: ["S2"] }
    ]}
  ]},
  { month: "Mar", categories: [
    { name: "QI 1.3 Leadership of change", cat: "qi13", activities: [
      { key: "sipReview", name: "SIP / DIP Review", gc: ["Progress"], missions: ["QI 1.3"], focus: ["*"] },
      { key: "sltMeetings", name: "SLT / PT / FH Meetings", gc: ["Progress"], missions: ["QI 1.3"], focus: ["*"] }
    ]},
    { name: "QI 2.3 Learning, teaching & assessment", cat: "qi23", activities: [
      { key: "learnerConversations", name: "Learner Conversation", gc: ["Progress"], missions: ["QI 2.3"], focus: ["S1"] }
    ]},
    { name: "QI 3.1 Ensuring wellbeing, equality & inclusion", cat: "qi31", activities: [
      { key: "attendance", name: "Attendance & Exclusion", gc: ["Wellbeing"], missions: ["QI 3.1"], focus: ["*"] }
    ]},
    { name: "QI 3.2 Raising attainment & achievement", cat: "qi32", activities: [
      { key: "tracking", name: "School Attainment Data (incl. tracking info)", gc: ["Progress"], missions: ["QI 3.2"], focus: ["S1 Interim Reports"] }
    ]}
  ]},
  { month: "Apr", categories: [] },
  { month: "May", categories: [
    { name: "QI 1.3 Leadership of change", cat: "qi13", activities: [
      { key: "sltMeetings", name: "SLT / PT / FH Meetings", gc: ["Progress"], missions: ["QI 1.3"], focus: ["*"] },
      { key: "sipReview", name: "SIP / DIP Review", gc: ["Progress"], missions: ["QI 1.3"], focus: ["*"] }
    ]},
    { name: "QI 2.3 Learning, teaching & assessment", cat: "qi23", activities: [
      { key: "observations", name: "Class Observations & Pupil Voice", gc: ["Progress"], missions: ["QI 2.3"], focus: ["S3"] }
    ]},
    { name: "QI 3.1 Ensuring wellbeing, equality & inclusion", cat: "qi31", activities: [
      { key: "environment", name: "Environment Checklist", gc: ["Wellbeing"], missions: ["QI 3.1"], focus: ["*"] }
    ]},
    { name: "QI 3.2 Raising attainment & achievement", cat: "qi32", activities: [
      { key: "parentFeedback", name: "Parent Carer Feedback", gc: ["Progress"], missions: [], focus: ["S3"] },
      { key: "partnersFeedback", name: "Partners Feedback", gc: ["Progress"], missions: [], focus: ["*"] },
      { key: "hmieQuestionnaire", name: "Young People HMIe Questionnaire", gc: ["Progress"], missions: [], focus: ["*"] }
    ]}
  ]},
  { month: "June", categories: [
    { name: "QI 1.3 Leadership of change", cat: "qi13", activities: [
      { key: "prd", name: "PRD Process Review", gc: ["Progress"], missions: ["QI 1.3"], focus: ["*"] }
    ]},
    { name: "QI 2.3 Learning, teaching & assessment", cat: "qi23", activities: [
      { key: "learnerConversations", name: "Learner Conversation", gc: ["Progress"], missions: ["QI 2.3"], focus: ["S1"] }
    ]},
    { name: "QI 3.1 Ensuring wellbeing, equality & inclusion", cat: "qi31", activities: [
      { key: "attendance", name: "Attendance & Exclusion", gc: ["Wellbeing"], missions: ["QI 3.1"], focus: ["*"] }
    ]},
    { name: "QI 3.2 Raising attainment & achievement", cat: "qi32", activities: [
      { key: "tracking", name: "School Attainment Data (incl. tracking info)", gc: ["Progress"], missions: ["QI 3.2"], focus: ["S1"] },
      { key: "reportQA", name: "Full Report Quality Assurance", gc: ["Progress"], missions: ["QI 2.3"], focus: ["S1"] },
      { key: "attainmentMeetings", name: "HT / PT-FH Attainment Meetings", gc: ["Progress"], missions: ["QI 3.2"], focus: ["S1-3"] }
    ]}
  ]}
];
window.QualityCalendarMonthsOrder = ["Aug","Sept","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","June"];
