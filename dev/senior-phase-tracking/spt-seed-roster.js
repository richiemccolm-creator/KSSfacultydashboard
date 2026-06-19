/**
 * Expanded development cohort — pupils across all subjects and levels.
 */
(function(global) {
  'use strict';

  function pupil(ts, spec, className, teacherId) {
    return {
      id: spec.id,
      first_name: spec.first,
      surname: spec.surname,
      preferred_name: spec.first,
      year_group: spec.year,
      candidate_number: spec.cand,
      class_group: className,
      teacher_id: teacherId,
      active_status: true,
      notes: spec.notes || '',
      created_at: ts,
      updated_at: ts
    };
  }

  function enrolment(ts, spec, classId, courseId, teacherId) {
    return {
      id: spec.enrolment_id,
      pupil_id: spec.id,
      course_id: courseId,
      class_id: classId,
      teacher_id: teacherId,
      current_level: spec.level,
      target_grade: spec.target || 'C',
      latest_working_grade: spec.working || 'C',
      final_estimate: spec.estimate || spec.working || 'C',
      risk_status: spec.risk || 'Green',
      risk_manual_override: false,
      risk_override_reason: '',
      has_open_flag: !!spec.flag,
      active_status: true,
      start_date: '2025-08-15',
      end_date: null,
      created_at: ts,
      updated_at: ts
    };
  }

  function classRow(ts, id, courseSlug, name, teacherId) {
    return {
      id: id,
      course_id: 'c-' + courseSlug,
      class_name: name,
      teacher_id: teacherId,
      academic_year: global.SptConfig.currentAcademicYear(),
      created_at: ts,
      updated_at: ts
    };
  }

  /** @type {Array<{classId:string,courseSlug:string,className:string,teacherId:string,pupils:object[]}>} */
  var CLASS_ROSTERS = [
    {
      classId: 'cl-nd-a', courseSlug: 'n5n4-drama', className: 'N5/N4 Drama A', teacherId: 't-anderson',
      pupils: [
        { id: 'p-ailsa-bain', enrolment_id: 'e-ailsa-nd', first: 'Ailsa', surname: 'Bain', year: 'S4', cand: '2420001', level: 'National 5', risk: 'Green', target: 'B', working: 'B', estimate: 'B' },
        { id: 'p-blair-christie', enrolment_id: 'e-blair-nd', first: 'Blair', surname: 'Christie', year: 'S4', cand: '2420002', level: 'National 5', risk: 'Amber', target: 'C', working: 'D', estimate: 'C' },
        { id: 'p-corrie-donaldson', enrolment_id: 'e-corrie-nd', first: 'Corrie', surname: 'Donaldson', year: 'S4', cand: '2420003', level: 'National 4', risk: 'Red', target: 'Pass', working: '—', estimate: '—', notes: 'N4 evidence route' },
        { id: 'p-dougie-elliot', enrolment_id: 'e-dougie-nd', first: 'Dougie', surname: 'Elliot', year: 'S4', cand: '2420004', level: 'National 5', risk: 'Green', target: 'A', working: 'A', estimate: 'A' },
        { id: 'p-eilidh-forbes', enrolment_id: 'e-eilidh-nd', first: 'Eilidh', surname: 'Forbes', year: 'S4', cand: '2420005', level: 'National 4', risk: 'Amber', target: 'Pass', working: 'Pass', estimate: 'Pass' }
      ]
    },
    {
      classId: 'cl-nd-b', courseSlug: 'n5n4-drama', className: 'N5/N4 Drama B', teacherId: 't-bruce',
      pupils: [
        { id: 'p-reid', enrolment_id: 'e-connor-nd', first: 'Connor', surname: 'Reid', year: 'S4', cand: '2402001', level: 'National 5', risk: 'Amber', target: 'C', working: 'C', estimate: 'C' },
        { id: 'p-stewart', enrolment_id: 'e-ryan-nd', first: 'Ryan', surname: 'Stewart', year: 'S4', cand: '2402002', level: 'National 4', risk: 'Red', target: 'Pass', working: '—', estimate: '—', flag: true, notes: 'Level change under review' },
        { id: 'p-finlay-gillies', enrolment_id: 'e-finlay-nd', first: 'Finlay', surname: 'Gillies', year: 'S4', cand: '2420010', level: 'National 5', risk: 'Green', target: 'B', working: 'B', estimate: 'B' },
        { id: 'p-gemma-hunter', enrolment_id: 'e-gemma-nd', first: 'Gemma', surname: 'Hunter', year: 'S4', cand: '2420011', level: 'National 5', risk: 'Amber', target: 'C', working: 'D', estimate: 'C', flag: true, notes: 'Attendance concern' },
        { id: 'p-hamish-innes', enrolment_id: 'e-hamish-nd', first: 'Hamish', surname: 'Innes', year: 'S4', cand: '2420012', level: 'National 4', risk: 'Red', target: 'Pass', working: '—', estimate: '—' }
      ]
    },
    {
      classId: 'cl-hd-a', courseSlug: 'higher-drama', className: 'H Drama A', teacherId: 't-anderson',
      pupils: [
        { id: 'p-campbell', enrolment_id: 'e-emma-hd', first: 'Emma', surname: 'Campbell', year: 'S5', cand: '2401001', level: 'Higher', risk: 'Green', target: 'A', working: 'A', estimate: 'A' },
        { id: 'p-morrison', enrolment_id: 'e-jamie-hd', first: 'Jamie', surname: 'Morrison', year: 'S5', cand: '2401002', level: 'Higher', risk: 'Amber', target: 'B', working: 'D', estimate: 'C', flag: true, notes: 'Prelim below target — monitoring' },
        { id: 'p-iona-johnstone', enrolment_id: 'e-iona-hd', first: 'Iona', surname: 'Johnstone', year: 'S5', cand: '2420020', level: 'Higher', risk: 'Green', target: 'A', working: 'A', estimate: 'A' },
        { id: 'p-jared-keith', enrolment_id: 'e-jared-hd', first: 'Jared', surname: 'Keith', year: 'S5', cand: '2420021', level: 'Higher', risk: 'Amber', target: 'B', working: 'C', estimate: 'C' },
        { id: 'p-kiera-laidlaw', enrolment_id: 'e-kiera-hd', first: 'Kiera', surname: 'Laidlaw', year: 'S5', cand: '2420022', level: 'Higher', risk: 'Green', target: 'B', working: 'B', estimate: 'B' },
        { id: 'p-logan-macpherson', enrolment_id: 'e-logan-hd', first: 'Logan', surname: 'MacPherson', year: 'S5', cand: '2420023', level: 'Higher', risk: 'Amber', target: 'C', working: 'D', estimate: 'C' }
      ]
    },
    {
      classId: 'cl-hd-b', courseSlug: 'higher-drama', className: 'H Drama B', teacherId: 't-bruce',
      pupils: [
        { id: 'p-sinclair', enrolment_id: 'e-noah-hd2', first: 'Noah', surname: 'Sinclair', year: 'S5', cand: '2409001', level: 'Higher', risk: 'Green', target: 'B', working: 'B', estimate: 'B' },
        { id: 'p-niamh-nicolson', enrolment_id: 'e-niamh-hd', first: 'Niamh', surname: 'Nicolson', year: 'S5', cand: '2420030', level: 'Higher', risk: 'Green', target: 'A', working: 'A', estimate: 'A' },
        { id: 'p-owen-orr', enrolment_id: 'e-owen-hd', first: 'Owen', surname: 'Orr', year: 'S5', cand: '2420031', level: 'Higher', risk: 'Amber', target: 'B', working: 'C', estimate: 'C' },
        { id: 'p-paige-paterson', enrolment_id: 'e-paige-hd', first: 'Paige', surname: 'Paterson', year: 'S5', cand: '2420032', level: 'Higher', risk: 'Green', target: 'B', working: 'B', estimate: 'B' },
        { id: 'p-quinn-quinn', enrolment_id: 'e-quinn-hd', first: 'Quinn', surname: 'Quinn', year: 'S5', cand: '2420033', level: 'Higher', risk: 'Red', target: 'C', working: 'F', estimate: 'D', flag: true, notes: 'Behaviour and attainment concern' }
      ]
    },
    {
      classId: 'cl-ahd-a', courseSlug: 'ah-drama', className: 'AH Drama A', teacherId: 't-anderson',
      pupils: [
        { id: 'p-fraser', enrolment_id: 'e-maya-ahd', first: 'Maya', surname: 'Fraser', year: 'S6', cand: '2408001', level: 'Advanced Higher', risk: 'Green', target: 'A', working: 'A', estimate: 'A', notes: 'On track' },
        { id: 'p-rhona-ross', enrolment_id: 'e-rhona-ahd', first: 'Rhona', surname: 'Ross', year: 'S6', cand: '2420040', level: 'Advanced Higher', risk: 'Green', target: 'A', working: 'A', estimate: 'A' },
        { id: 'p-struan-scott', enrolment_id: 'e-struan-ahd', first: 'Struan', surname: 'Scott', year: 'S6', cand: '2420041', level: 'Advanced Higher', risk: 'Amber', target: 'B', working: 'C', estimate: 'C' },
        { id: 'p-tara-tulloch', enrolment_id: 'e-tara-ahd', first: 'Tara', surname: 'Tulloch', year: 'S6', cand: '2420042', level: 'Advanced Higher', risk: 'Green', target: 'B', working: 'B', estimate: 'B' }
      ]
    },
    {
      classId: 'cl-ahd-b', courseSlug: 'ah-drama', className: 'AH Drama B', teacherId: 't-bruce',
      pupils: [
        { id: 'p-uisdean-urquhart', enrolment_id: 'e-uisdean-ahd', first: 'Uisdean', surname: 'Urquhart', year: 'S6', cand: '2420045', level: 'Advanced Higher', risk: 'Green', target: 'A', working: 'A', estimate: 'A' },
        { id: 'p-vivienne-watson', enrolment_id: 'e-vivienne-ahd', first: 'Vivienne', surname: 'Watson', year: 'S6', cand: '2420046', level: 'Advanced Higher', risk: 'Amber', target: 'B', working: 'C', estimate: 'C' },
        { id: 'p-wallace-young', enrolment_id: 'e-wallace-ahd', first: 'Wallace', surname: 'Young', year: 'S6', cand: '2420047', level: 'Advanced Higher', risk: 'Green', target: 'B', working: 'B', estimate: 'B' },
        { id: 'p-yvonne-abernethy', enrolment_id: 'e-yvonne-ahd', first: 'Yvonne', surname: 'Abernethy', year: 'S6', cand: '2420048', level: 'Advanced Higher', risk: 'Red', target: 'C', working: 'D', estimate: 'D', flag: true, notes: 'Dissertation behind schedule' }
      ]
    },
    {
      classId: 'cl-na-a', courseSlug: 'n5n4-art', className: 'N5/N4 Art A', teacherId: 't-campbell',
      pupils: [
        { id: 'p-zara-brodie', enrolment_id: 'e-zara-na', first: 'Zara', surname: 'Brodie', year: 'S4', cand: '2420050', level: 'National 5', risk: 'Green', target: 'B', working: 'B', estimate: 'B' },
        { id: 'p-adam-campbell', enrolment_id: 'e-adam-na', first: 'Adam', surname: 'Campbell', year: 'S4', cand: '2420051', level: 'National 5', risk: 'Amber', target: 'C', working: 'D', estimate: 'C' },
        { id: 'p-beth-duncan', enrolment_id: 'e-beth-na', first: 'Beth', surname: 'Duncan', year: 'S4', cand: '2420052', level: 'National 4', risk: 'Red', target: 'Pass', working: '—', estimate: '—', notes: 'Missing unit evidence' },
        { id: 'p-cara-edwards', enrolment_id: 'e-cara-na', first: 'Cara', surname: 'Edwards', year: 'S4', cand: '2420053', level: 'National 5', risk: 'Green', target: 'A', working: 'A', estimate: 'A' },
        { id: 'p-dean-fleming', enrolment_id: 'e-dean-na', first: 'Dean', surname: 'Fleming', year: 'S4', cand: '2420054', level: 'National 4', risk: 'Amber', target: 'Pass', working: 'Pass', estimate: 'Pass' }
      ]
    },
    {
      classId: 'cl-na-c', courseSlug: 'n5n4-art', className: 'N5/N4 Art C', teacherId: 't-campbell',
      pupils: [
        { id: 'p-henderson', enrolment_id: 'e-sophie-na', first: 'Sophie', surname: 'Henderson', year: 'S4', cand: '2403001', level: 'National 5', risk: 'Red', target: 'B', working: 'C', estimate: 'C', notes: 'Missing unit evidence' },
        { id: 'p-ella-grant', enrolment_id: 'e-ella-na', first: 'Ella', surname: 'Grant', year: 'S4', cand: '2420060', level: 'National 5', risk: 'Green', target: 'B', working: 'B', estimate: 'B' },
        { id: 'p-fraser-hay', enrolment_id: 'e-fraser-na', first: 'Fraser', surname: 'Hay', year: 'S4', cand: '2420061', level: 'National 5', risk: 'Amber', target: 'C', working: 'D', estimate: 'C' },
        { id: 'p-grace-irvine', enrolment_id: 'e-grace-na', first: 'Grace', surname: 'Irvine', year: 'S4', cand: '2420062', level: 'National 4', risk: 'Red', target: 'Pass', working: '—', estimate: '—' },
        { id: 'p-harry-james', enrolment_id: 'e-harry-na', first: 'Harry', surname: 'James', year: 'S4', cand: '2420063', level: 'National 5', risk: 'Green', target: 'A', working: 'A', estimate: 'A' }
      ]
    },
    {
      classId: 'cl-hp-a', courseSlug: 'higher-photo', className: 'H Photo A', teacherId: 't-douglas',
      pupils: [
        { id: 'p-thomson', enrolment_id: 'e-isla-hp', first: 'Isla', surname: 'Thomson', year: 'S6', cand: '2404001', level: 'Higher', risk: 'Amber', target: 'A', working: 'B', estimate: 'B', notes: 'Incomplete project evidence' },
        { id: 'p-iris-kerr', enrolment_id: 'e-iris-hp', first: 'Iris', surname: 'Kerr', year: 'S6', cand: '2420070', level: 'Higher', risk: 'Green', target: 'A', working: 'A', estimate: 'A' },
        { id: 'p-jake-lamb', enrolment_id: 'e-jake-hp', first: 'Jake', surname: 'Lamb', year: 'S6', cand: '2420071', level: 'Higher', risk: 'Amber', target: 'B', working: 'C', estimate: 'C' },
        { id: 'p-kate-marshall', enrolment_id: 'e-kate-hp', first: 'Kate', surname: 'Marshall', year: 'S6', cand: '2420072', level: 'Higher', risk: 'Green', target: 'B', working: 'B', estimate: 'B' },
        { id: 'p-liam-neil', enrolment_id: 'e-liam-hp', first: 'Liam', surname: 'Neil', year: 'S6', cand: '2420073', level: 'Higher', risk: 'Amber', target: 'C', working: 'D', estimate: 'C' }
      ]
    },
    {
      classId: 'cl-hp-b', courseSlug: 'higher-photo', className: 'H Photo B', teacherId: 't-douglas',
      pupils: [
        { id: 'p-molly-osborne', enrolment_id: 'e-molly-hp', first: 'Molly', surname: 'Osborne', year: 'S5', cand: '2420080', level: 'Higher', risk: 'Green', target: 'A', working: 'A', estimate: 'A' },
        { id: 'p-nathan-park', enrolment_id: 'e-nathan-hp', first: 'Nathan', surname: 'Park', year: 'S5', cand: '2420081', level: 'Higher', risk: 'Amber', target: 'B', working: 'C', estimate: 'C' },
        { id: 'p-olivia-rae', enrolment_id: 'e-olivia-hp', first: 'Olivia', surname: 'Rae', year: 'S5', cand: '2420082', level: 'Higher', risk: 'Green', target: 'B', working: 'B', estimate: 'B' },
        { id: 'p-peter-shaw', enrolment_id: 'e-peter-hp', first: 'Peter', surname: 'Shaw', year: 'S5', cand: '2420083', level: 'Higher', risk: 'Red', target: 'C', working: 'F', estimate: 'D', flag: true, notes: 'Project not submitted' }
      ]
    },
    {
      classId: 'cl-npa-l4-a', courseSlug: 'npa-photo', className: 'NPA Photo L4 A', teacherId: 't-douglas',
      pupils: [
        { id: 'p-toby-craig', enrolment_id: 'e-toby-npa', first: 'Toby', surname: 'Craig', year: 'S3', cand: '2420160', level: 'Level 4', risk: 'Green', target: 'Pass', working: 'Pass', estimate: 'Pass' },
        { id: 'p-una-doyle', enrolment_id: 'e-una-npa', first: 'Una', surname: 'Doyle', year: 'S3', cand: '2420161', level: 'Level 4', risk: 'Amber', target: 'Pass', working: 'Pass', estimate: 'Pass', notes: 'GR4L 44 — building portfolio' },
        { id: 'p-vic-easton', enrolment_id: 'e-vic-npa', first: 'Vic', surname: 'Easton', year: 'S4', cand: '2420162', level: 'Level 4', risk: 'Green', target: 'Pass', working: 'Pass', estimate: 'Pass' },
        { id: 'p-will-faith', enrolment_id: 'e-will-npa', first: 'Will', surname: 'Faith', year: 'S3', cand: '2420163', level: 'Level 4', risk: 'Red', target: 'Pass', working: 'NP', estimate: 'NP', flag: true, notes: 'Understanding Photography unit overdue' }
      ]
    },
    {
      classId: 'cl-npa-a', courseSlug: 'npa-photo', className: 'NPA Photo L5 A', teacherId: 't-douglas',
      pupils: [
        { id: 'p-graham', enrolment_id: 'e-mia-npa', first: 'Mia', surname: 'Graham', year: 'S3', cand: '2410001', level: 'Level 5', risk: 'Amber', target: 'Pass', working: 'Pass', estimate: 'Pass', notes: 'NPA Photography — portfolio in progress' },
        { id: 'p-murray', enrolment_id: 'e-callum-npa', first: 'Callum', surname: 'Murray', year: 'S4', cand: '2410002', level: 'Level 5', risk: 'Green', target: 'Pass', working: 'Pass', estimate: 'Pass' },
        { id: 'p-rachel-todd', enrolment_id: 'e-rachel-npa', first: 'Rachel', surname: 'Todd', year: 'S3', cand: '2420090', level: 'Level 5', risk: 'Green', target: 'Pass', working: 'Pass', estimate: 'Pass' },
        { id: 'p-sam-union', enrolment_id: 'e-sam-npa', first: 'Sam', surname: 'Union', year: 'S4', cand: '2420091', level: 'Level 5', risk: 'Amber', target: 'Pass', working: 'Pass', estimate: 'Pass' }
      ]
    },
    {
      classId: 'cl-aa-a', courseSlug: 'ah-art', className: 'AH Art A', teacherId: 't-campbell',
      pupils: [
        { id: 'p-robertson', enrolment_id: 'e-chloe-aa', first: 'Chloe', surname: 'Robertson', year: 'S6', cand: '2406001', level: 'Advanced Higher', risk: 'Amber', target: 'A', working: 'C', estimate: 'B', notes: 'Portfolio concerns' },
        { id: 'p-tessa-vaughan', enrolment_id: 'e-tessa-aa', first: 'Tessa', surname: 'Vaughan', year: 'S6', cand: '2420100', level: 'Advanced Higher', risk: 'Green', target: 'A', working: 'A', estimate: 'A' },
        { id: 'p-una-white', enrolment_id: 'e-una-aa', first: 'Una', surname: 'White', year: 'S6', cand: '2420101', level: 'Advanced Higher', risk: 'Amber', target: 'B', working: 'C', estimate: 'C' },
        { id: 'p-victor-yates', enrolment_id: 'e-victor-aa', first: 'Victor', surname: 'Yates', year: 'S6', cand: '2420102', level: 'Advanced Higher', risk: 'Green', target: 'B', working: 'B', estimate: 'B' }
      ]
    },
    {
      classId: 'cl-aa-b', courseSlug: 'ah-art', className: 'AH Art B', teacherId: 't-douglas',
      pupils: [
        { id: 'p-balfour', enrolment_id: 'e-erin-aab', first: 'Erin', surname: 'Balfour', year: 'S6', cand: '2411001', level: 'Advanced Higher', risk: 'Green', target: 'B', working: 'B', estimate: 'B' },
        { id: 'p-wendy-zhang', enrolment_id: 'e-wendy-aa', first: 'Wendy', surname: 'Zhang', year: 'S6', cand: '2420110', level: 'Advanced Higher', risk: 'Green', target: 'A', working: 'A', estimate: 'A' },
        { id: 'p-xander-ahmed', enrolment_id: 'e-xander-aa', first: 'Xander', surname: 'Ahmed', year: 'S6', cand: '2420111', level: 'Advanced Higher', risk: 'Amber', target: 'B', working: 'C', estimate: 'C' },
        { id: 'p-yasmin-begum', enrolment_id: 'e-yasmin-aa', first: 'Yasmin', surname: 'Begum', year: 'S6', cand: '2420112', level: 'Advanced Higher', risk: 'Green', target: 'B', working: 'B', estimate: 'B' }
      ]
    },
    {
      classId: 'cl-fs-a', courseSlug: 'l6l5-film', className: 'L6 Film A', teacherId: 't-evans',
      pupils: [
        { id: 'p-maclean', enrolment_id: 'e-lewis-fs', first: 'Lewis', surname: 'MacLean', year: 'S5', cand: '2405001', level: 'Level 6', risk: 'Amber', target: 'Pass', working: 'Pass', estimate: 'Pass', notes: 'Moving L6 to L5' },
        { id: 'p-alex-cohen', enrolment_id: 'e-alex-fs', first: 'Alex', surname: 'Cohen', year: 'S5', cand: '2420120', level: 'Level 6', risk: 'Amber', target: 'Pass', working: 'Pass', estimate: 'Pass' },
        { id: 'p-bella-diaz', enrolment_id: 'e-bella-fs', first: 'Bella', surname: 'Diaz', year: 'S5', cand: '2420121', level: 'Level 6', risk: 'Green', target: 'Pass', working: 'Pass', estimate: 'Pass' },
        { id: 'p-carlos-evans', enrolment_id: 'e-carlos-fs', first: 'Carlos', surname: 'Evans', year: 'S6', cand: '2420122', level: 'Level 6', risk: 'Green', target: 'Pass', working: 'Pass', estimate: 'Pass' }
      ]
    },
    {
      classId: 'cl-fs-b', courseSlug: 'l6l5-film', className: 'L5 Film B', teacherId: 't-douglas',
      pupils: [
        { id: 'p-diana-ford', enrolment_id: 'e-diana-fs', first: 'Diana', surname: 'Ford', year: 'S4', cand: '2420130', level: 'Level 5', risk: 'Green', target: 'Pass', working: 'Pass', estimate: 'Pass' },
        { id: 'p-ethan-gray', enrolment_id: 'e-ethan-fs', first: 'Ethan', surname: 'Gray', year: 'S4', cand: '2420131', level: 'Level 5', risk: 'Amber', target: 'Pass', working: 'Pass', estimate: 'Pass' },
        { id: 'p-fiona-hart', enrolment_id: 'e-fiona-fs', first: 'Fiona', surname: 'Hart', year: 'S4', cand: '2420132', level: 'Level 5', risk: 'Red', target: 'Pass', working: 'NP', estimate: 'NP', flag: true, notes: 'Unit 1 incomplete' },
        { id: 'p-george-ivey', enrolment_id: 'e-george-fs', first: 'George', surname: 'Ivey', year: 'S4', cand: '2420133', level: 'Level 5', risk: 'Green', target: 'Pass', working: 'Pass', estimate: 'Pass' }
      ]
    },
    {
      classId: 'cl-ci-a', courseSlug: 'creative-industries', className: 'CI A', teacherId: 't-anderson',
      pupils: [
        { id: 'p-hannah-jones', enrolment_id: 'e-hannah-ci', first: 'Hannah', surname: 'Jones', year: 'S4', cand: '2420140', level: 'National 5', risk: 'Green', target: 'Pass', working: 'Pass', estimate: 'Pass' },
        { id: 'p-ian-kemp', enrolment_id: 'e-ian-ci', first: 'Ian', surname: 'Kemp', year: 'S4', cand: '2420141', level: 'National 5', risk: 'Amber', target: 'Pass', working: 'Pass', estimate: 'Pass' },
        { id: 'p-julia-lopez', enrolment_id: 'e-julia-ci', first: 'Julia', surname: 'Lopez', year: 'S4', cand: '2420142', level: 'National 5', risk: 'Red', target: 'Pass', working: 'NP', estimate: 'NP' },
        { id: 'p-kevin-moss', enrolment_id: 'e-kevin-ci', first: 'Kevin', surname: 'Moss', year: 'S4', cand: '2420143', level: 'National 5', risk: 'Green', target: 'Pass', working: 'Pass', estimate: 'Pass' }
      ]
    },
    {
      classId: 'cl-ci-b', courseSlug: 'creative-industries', className: 'CI B', teacherId: 't-douglas',
      pupils: [
        { id: 'p-walker', enrolment_id: 'e-aiden-ci', first: 'Aiden', surname: 'Walker', year: 'S5', cand: '2407001', level: 'National 5', risk: 'Red', target: 'Pass', working: 'NP', estimate: 'NP', notes: 'Missing evidence' },
        { id: 'p-laura-nash', enrolment_id: 'e-laura-ci', first: 'Laura', surname: 'Nash', year: 'S5', cand: '2420150', level: 'National 5', risk: 'Amber', target: 'Pass', working: 'Pass', estimate: 'Pass' },
        { id: 'p-marc-owen', enrolment_id: 'e-marc-ci', first: 'Marc', surname: 'Owen', year: 'S5', cand: '2420151', level: 'National 5', risk: 'Green', target: 'Pass', working: 'Pass', estimate: 'Pass' },
        { id: 'p-nina-price', enrolment_id: 'e-nina-ci', first: 'Nina', surname: 'Price', year: 'S5', cand: '2420152', level: 'National 5', risk: 'Red', target: 'Pass', working: 'NP', estimate: 'NP' }
      ]
    }
  ];

  var EXPANDED_MARKER_PUPIL = 'p-dean-fleming';

  function buildCohort(ts) {
    var classes = [];
    var pupils = [];
    var enrolments = [];
    var pupilIds = {};

    CLASS_ROSTERS.forEach(function(cr) {
      classes.push(classRow(ts, cr.classId, cr.courseSlug, cr.className, cr.teacherId));
      cr.pupils.forEach(function(spec) {
        if (!pupilIds[spec.id]) {
          pupils.push(pupil(ts, spec, cr.className, cr.teacherId));
          pupilIds[spec.id] = true;
        }
        enrolments.push(enrolment(ts, spec, cr.classId, 'c-' + cr.courseSlug, cr.teacherId));
      });
    });

    return { classes: classes, pupils: pupils, enrolments: enrolments };
  }

  function evidenceStatusesForRisk(risk, unitCount) {
    var out = [];
    for (var i = 0; i < unitCount; i++) {
      if (risk === 'Green') out.push(i < unitCount - 1 ? 'Banked' : 'In Progress');
      else if (risk === 'Amber') out.push(i === 0 ? 'Banked' : i === 1 ? 'In Progress' : 'Not Started');
      else out.push(i === 0 ? 'In Progress' : i === 1 ? 'Missing' : 'Not Started');
    }
    return out;
  }

  function buildEvidenceBank(enrolments, courses, ts) {
    if (!global.SptEvidence) return [];
    var evidence = [];
    var seen = {};
    enrolments.forEach(function(en, idx) {
      if (seen[en.id]) return;
      seen[en.id] = true;
      var course = courses.find(function(c) { return c.id === en.course_id; });
      if (!course || !global.SptEvidence.usesEvidenceBank(course, en)) return;
      var tpl = global.SptEvidence.getUnitTemplate(course, en);
      var statuses = evidenceStatusesForRisk(en.risk_status, tpl.length);
      tpl.forEach(function(u, i) {
        var st = statuses[i] || 'Not Started';
        evidence.push({
          id: 'ev-' + en.id + '-' + i,
          enrolment_id: en.id,
          unit_code: u.unit_code,
          evidence_title: u.unit_name,
          unit_or_component: u.unit_name,
          short_label: u.short_label,
          evidence_type: 'Unit Evidence',
          evidence_status: st,
          display_order: i + 1,
          date_banked: st === 'Banked' ? '2025-11-12' : null,
          verified_by_teacher_id: st === 'Banked' ? en.teacher_id : null,
          verification_status: st === 'Banked' ? 'Verified' : 'Not Verified',
          notes: '',
          created_at: ts,
          updated_at: ts
        });
      });
    });
    return evidence;
  }

  function buildBaselines(enrolments, ts) {
    var marks = [72, 58, 45, 81, 52, 38, 65, 48, 55, 42, 68, 61, 49, 77, 44];
    var baselines = [];
    var n = 0;
    enrolments.forEach(function(en) {
      if (en.course_id !== 'c-n5n4-drama' && en.course_id !== 'c-n5n4-art') return;
      if (en.current_level !== 'National 5' && en.current_level !== 'National 4') return;
      var mark = marks[n % marks.length];
      n++;
      var grade = mark >= 70 ? 'A' : mark >= 60 ? 'B' : mark >= 50 ? 'C' : mark >= 40 ? 'D' : 'F';
      baselines.push({
        id: 'bl-' + en.id,
        enrolment_id: en.id,
        s3_exam_mark: mark,
        s3_exam_grade: grade,
        effort: mark >= 60 ? 3 : 2,
        behaviour: mark >= 50 ? 3 : 2,
        homelearning: mark >= 55 ? 3 : 2,
        progress: +(mark / 20).toFixed(1),
        cfe_level: mark >= 65 ? 'Fourth' : 'Third',
        source: 'manual',
        notes: 'S3 baseline (sample)',
        locked_at: '2025-08-15',
        created_at: ts,
        updated_at: ts
      });
    });
    return baselines;
  }

  function buildPrelimMarks(enrolments, prelimComponents, ts) {
    var marks = [];
    enrolments.forEach(function(en, idx) {
      var courseSlug = en.course_id.replace('c-', '');
      if (!global.SptConfig.PRELIM_COMPONENT_TEMPLATES[courseSlug]) return;
      if (en.current_level === 'National 4') return;
      var comps = prelimComponents.filter(function(pc) { return pc.course_id === en.course_id; });
      comps.forEach(function(pc, ci) {
        var max = pc.max_marks;
        var pct = en.risk_status === 'Green' ? 0.75 : en.risk_status === 'Amber' ? 0.55 : 0.38;
        var raw = Math.round(max * pct) - (ci * 2) + (idx % 3);
        raw = Math.max(0, Math.min(max, raw));
        marks.push({
          id: 'pm-' + en.id + '-' + ci,
          enrolment_id: en.id,
          prelim_component_id: pc.id,
          raw_mark: raw,
          created_at: ts,
          updated_at: ts
        });
      });
    });
    return marks;
  }

  function mergeIntoDb(db) {
    var ts = new Date().toISOString();
    var cohort = buildCohort(ts);
    db.classes = db.classes || [];
    db.pupils = db.pupils || [];
    db.enrolments = db.enrolments || [];
    db.evidence_bank = db.evidence_bank || [];
    db.enrolment_baselines = db.enrolment_baselines || [];
    db.attendance_records = db.attendance_records || [];
    db.pupil_tracking_data = db.pupil_tracking_data || [];
    db.prelim_marks = db.prelim_marks || [];

    var existingPupilIds = {};
    var existingEnrolmentIds = {};
    var existingClassIds = {};
    db.pupils.forEach(function(p) { existingPupilIds[p.id] = true; });
    db.enrolments.forEach(function(e) { existingEnrolmentIds[e.id] = true; });
    db.classes.forEach(function(c) { existingClassIds[c.id] = true; });

    var changed = false;
    cohort.classes.forEach(function(cl) {
      if (!existingClassIds[cl.id]) { db.classes.push(cl); changed = true; }
    });
    cohort.pupils.forEach(function(p) {
      if (!existingPupilIds[p.id]) { db.pupils.push(p); changed = true; }
    });
    cohort.enrolments.forEach(function(en) {
      if (!existingEnrolmentIds[en.id]) { db.enrolments.push(en); changed = true; }
    });

    var newEnrolments = cohort.enrolments.filter(function(en) { return !existingEnrolmentIds[en.id]; });

    var trackingPoints = (db.school_tracking_points || []).slice().sort(function(a, b) {
      return (a.tracking_point_date || '').localeCompare(b.tracking_point_date || '');
    });
    function seedWgScore(en, tpi, course) {
      if (global.SptEvidence && global.SptEvidence.isPassFailCourse(course)) {
        if (en.risk_status === 'Red') return 8;
        if (en.risk_status === 'Amber') return 7;
        return 6;
      }
      if (en.risk_status === 'Red') return tpi === 2 ? 7 : 6;
      if (en.risk_status === 'Amber') return 5;
      return 4;
    }

    newEnrolments.forEach(function(en, idx) {
      if (existingEnrolmentIds[en.id] && db.attendance_records.some(function(a) { return a.enrolment_id === en.id; })) return;
      changed = true;
      var course = (db.courses || []).find(function(c) { return c.id === en.course_id; });
      trackingPoints.forEach(function(tp, tpi) {
        db.attendance_records.push({
          id: 'att-' + en.id + '-' + tpi,
          enrolment_id: en.id,
          tracking_point_id: tp.id,
          attendance_score: seedWgScore(en, tpi, course),
          teacher_comment: '',
          created_at: ts,
          updated_at: ts
        });
      });
      if (trackingPoints[0]) {
        db.pupil_tracking_data.push({
          id: 'ptd-' + en.id + '-1',
          enrolment_id: en.id,
          tracking_point_id: trackingPoints[0].id,
          effort: idx % 5 === 0 ? 2 : 3,
          behaviour: idx % 4 === 0 ? 2 : 3,
          imported_from_school_tracking: true,
          import_batch_id: 'batch-seed-001',
          created_at: ts,
          updated_at: ts
        });
      }
      if (trackingPoints[1]) {
        db.pupil_tracking_data.push({
          id: 'ptd-' + en.id + '-2',
          enrolment_id: en.id,
          tracking_point_id: trackingPoints[1].id,
          working_grade: en.latest_working_grade,
          target_grade: en.target_grade,
          effort: idx % 3 === 0 ? 3 : 2,
          behaviour: 3,
          homework: idx % 4 === 0 ? 2 : 3,
          concern_level: en.risk_status === 'Red' ? 'High' : en.risk_status === 'Amber' ? 'Medium' : 'Low',
          teacher_comment: 'Imported from whole-school tracking (sample)',
          imported_from_school_tracking: true,
          import_batch_id: 'batch-seed-001',
          created_at: ts,
          updated_at: ts
        });
      }
    });

    var existingEvIds = {};
    db.evidence_bank.forEach(function(ev) { existingEvIds[ev.id] = true; });
    buildEvidenceBank(db.enrolments, db.courses || [], ts).forEach(function(ev) {
      if (!existingEvIds[ev.id]) { db.evidence_bank.push(ev); changed = true; }
    });

    var existingBl = {};
    (db.enrolment_baselines || []).forEach(function(b) { existingBl[b.enrolment_id] = true; });
    buildBaselines(db.enrolments, ts).forEach(function(bl) {
      if (!existingBl[bl.enrolment_id]) { db.enrolment_baselines.push(bl); changed = true; }
    });

    var existingPm = {};
    (db.prelim_marks || []).forEach(function(pm) {
      existingPm[pm.enrolment_id + ':' + pm.prelim_component_id] = true;
    });
    buildPrelimMarks(db.enrolments, db.prelim_components || [], ts).forEach(function(pm) {
      var key = pm.enrolment_id + ':' + pm.prelim_component_id;
      if (!existingPm[key]) { db.prelim_marks.push(pm); changed = true; }
    });

    return changed;
  }

  global.SptSeedRoster = {
    CLASS_ROSTERS: CLASS_ROSTERS,
    EXPANDED_MARKER_PUPIL: EXPANDED_MARKER_PUPIL,
    buildCohort: buildCohort,
    buildEvidenceBank: buildEvidenceBank,
    buildBaselines: buildBaselines,
    buildPrelimMarks: buildPrelimMarks,
    mergeIntoDb: mergeIntoDb
  };
})(typeof window !== 'undefined' ? window : global);
