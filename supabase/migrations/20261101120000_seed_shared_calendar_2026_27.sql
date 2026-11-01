-- Copy the 2026-27 school calendar into the database.
--
-- Until now the 107 events in academic-calendar-defaults.js lived only in the
-- code: every calendar page added them on top of shared_calendar_events, so
-- the calendar looked complete whether or not the database held them. Server
-- jobs (such as the Sunday announcements agent) only see the database, so the
-- events need to be stored there too.
--
-- Safe to run more than once. An event already in the table (same title and
-- date) is not added again; its category is brought in line with the coded
-- one, which is what the calendar pages already show. Events added through
-- the hub are left alone.

WITH defaults (title, date, category) AS (
  VALUES
  ('INSET Day 1', DATE '2026-08-10', 'inset'),
  ('INSET Day 2', DATE '2026-08-11', 'inset'),
  ('Pupils Return', DATE '2026-08-12', 'general'),
  ('Faculty DM 1 – DIP Priorities & Analysis', DATE '2026-08-18', 'faculty-deadline'),
  ('Faculty DM 2', DATE '2026-08-25', 'faculty-deadline'),
  ('Strategy Group Meeting (SGM)', DATE '2026-09-02', 'meeting'),
  ('S4 Interim Working Grades', DATE '2026-09-03', 'reporting'),
  ('Faculty DM 3 – Attainment Meetings', DATE '2026-09-08', 'faculty-deadline'),
  ('Leadership Team Meeting 1', DATE '2026-09-10', 'meeting'),
  ('S3 Interim Reports Deadline', DATE '2026-09-11', 'reporting'),
  ('Ped Pod 1', DATE '2026-09-16', 'meeting'),
  ('S3 Interim Reports QA', DATE '2026-09-18', 'reporting'),
  ('Primary Information Evening', DATE '2026-09-22', 'general'),
  ('S5-6 Interim Reports Deadline', DATE '2026-09-24', 'reporting'),
  ('Holiday – September Weekend', DATE '2026-09-25', 'holiday'),
  ('Holiday – September Weekend', DATE '2026-09-28', 'holiday'),
  ('Faculty DM 4', DATE '2026-09-29', 'faculty-deadline'),
  ('S5-6 Interim Reports QA', DATE '2026-10-01', 'reporting'),
  ('S4 Full Reports Deadline', DATE '2026-10-02', 'reporting'),
  ('Faculty DM 5 – Attainment Meetings', DATE '2026-10-06', 'faculty-deadline'),
  ('S4 Full Reports QA', DATE '2026-10-07', 'reporting'),
  ('INSET Day 3', DATE '2026-10-09', 'inset'),
  ('Holiday – October Week', DATE '2026-10-12', 'holiday'),
  ('Holiday – October Week', DATE '2026-10-13', 'holiday'),
  ('Holiday – October Week', DATE '2026-10-14', 'holiday'),
  ('Holiday – October Week', DATE '2026-10-15', 'holiday'),
  ('Holiday – October Week', DATE '2026-10-16', 'holiday'),
  ('Faculty DM 6', DATE '2026-10-20', 'faculty-deadline'),
  ('S2 Interim Reports Deadline', DATE '2026-10-23', 'reporting'),
  ('Faculty MOD 1 – S2', DATE '2026-10-27', 'faculty-deadline'),
  ('S2 Interim Reports QA', DATE '2026-10-29', 'reporting'),
  ('Whole-School Moderation Meeting 1', DATE '2026-11-04', 'meeting'),
  ('S5-6 Full Reports Deadline', DATE '2026-11-06', 'reporting'),
  ('Faculty DM 7', DATE '2026-11-10', 'faculty-deadline'),
  ('S5-6 Full Reports QA', DATE '2026-11-13', 'reporting'),
  ('Faculty DM 8 – DIP Review', DATE '2026-11-17', 'faculty-deadline'),
  ('Leadership Team Meeting 2', DATE '2026-11-19', 'meeting'),
  ('S1 Parent/Carer Evening', DATE '2026-11-25', 'general'),
  ('Ped Pod 2', DATE '2026-12-02', 'meeting'),
  ('S3 Full Reports Deadline', DATE '2026-12-04', 'reporting'),
  ('Faculty MOD 2 – S3', DATE '2026-12-08', 'faculty-deadline'),
  ('S3 Full Reports QA', DATE '2026-12-11', 'reporting'),
  ('Faculty DM 9', DATE '2026-12-15', 'faculty-deadline'),
  ('School Closes (2:30pm)', DATE '2026-12-18', 'general'),
  ('Holiday – Christmas & New Year', DATE '2026-12-21', 'holiday'),
  ('Holiday – Christmas & New Year', DATE '2026-12-22', 'holiday'),
  ('Holiday – Christmas & New Year', DATE '2026-12-23', 'holiday'),
  ('Holiday – Christmas & New Year', DATE '2026-12-24', 'holiday'),
  ('Holiday – Christmas & New Year', DATE '2026-12-25', 'holiday'),
  ('Holiday – Christmas & New Year', DATE '2026-12-28', 'holiday'),
  ('Holiday – Christmas & New Year', DATE '2026-12-29', 'holiday'),
  ('Holiday – Christmas & New Year', DATE '2026-12-30', 'holiday'),
  ('Holiday – Christmas & New Year', DATE '2026-12-31', 'holiday'),
  ('Holiday – Christmas & New Year', DATE '2027-01-01', 'holiday'),
  ('Holiday – Christmas & New Year', DATE '2027-01-04', 'holiday'),
  ('QA: S4-6 Prelim Analysis | S1-2 Class Observations & Learner Voice', DATE '2027-01-04', 'deadline'),
  ('Holiday – Christmas & New Year', DATE '2027-01-05', 'holiday'),
  ('Faculty DM 9 (After School) – New Year Priorities', DATE '2027-01-05', 'faculty-deadline'),
  ('Pupils Return', DATE '2027-01-06', 'general'),
  ('Faculty MOD 3 – S4/5 and 6', DATE '2027-01-12', 'faculty-deadline'),
  ('S5-6 Interim Reports Deadline', DATE '2027-01-13', 'reporting'),
  ('S5-6 Parent/Carer Evening', DATE '2027-01-20', 'general'),
  ('Faculty DM 10', DATE '2027-01-26', 'faculty-deadline'),
  ('S4 Interim Tracking Entry', DATE '2027-01-26', 'reporting'),
  ('S4 Interim Reports Deadline', DATE '2027-01-27', 'reporting'),
  ('Leadership Team Meeting 3', DATE '2027-01-29', 'meeting'),
  ('S4 Parent/Carer Evening', DATE '2027-02-02', 'general'),
  ('Whole-School Moderation Meeting 2', DATE '2027-02-11', 'meeting'),
  ('Holiday – February Mid-Term', DATE '2027-02-15', 'holiday'),
  ('Holiday – February Mid-Term', DATE '2027-02-16', 'holiday'),
  ('INSET Day 4', DATE '2027-02-17', 'inset'),
  ('S2 Full Reports Deadline', DATE '2027-02-19', 'reporting'),
  ('Faculty MOD 3 – S3', DATE '2027-02-23', 'faculty-deadline'),
  ('S2 Full Reports QA', DATE '2027-02-26', 'reporting'),
  ('Ped Pod 3', DATE '2027-03-03', 'meeting'),
  ('S2 Parent/Carer Evening', DATE '2027-03-09', 'general'),
  ('Faculty MOD 4 – S1', DATE '2027-03-16', 'faculty-deadline'),
  ('Leadership Team Meeting 4', DATE '2027-03-18', 'meeting'),
  ('S1 Interim Reports Deadline', DATE '2027-03-19', 'reporting'),
  ('Faculty DM 12', DATE '2027-03-23', 'faculty-deadline'),
  ('Faculty DM 13', DATE '2027-03-30', 'faculty-deadline'),
  ('School Closes (2:30pm)', DATE '2027-04-01', 'general'),
  ('Holiday – Easter', DATE '2027-04-05', 'holiday'),
  ('Holiday – Easter', DATE '2027-04-06', 'holiday'),
  ('Holiday – Easter', DATE '2027-04-07', 'holiday'),
  ('Holiday – Easter', DATE '2027-04-08', 'holiday'),
  ('Holiday – Easter', DATE '2027-04-09', 'holiday'),
  ('Holiday – Easter', DATE '2027-04-12', 'holiday'),
  ('Holiday – Easter', DATE '2027-04-13', 'holiday'),
  ('Holiday – Easter', DATE '2027-04-14', 'holiday'),
  ('Holiday – Easter', DATE '2027-04-15', 'holiday'),
  ('Holiday – Easter', DATE '2027-04-16', 'holiday'),
  ('Strategy Group Meeting 2 (SGM)', DATE '2027-04-21', 'meeting'),
  ('S3 Parent/Carer Evening', DATE '2027-04-28', 'general'),
  ('Holiday – May Day', DATE '2027-05-03', 'holiday'),
  ('Faculty DM 14', DATE '2027-05-11', 'faculty-deadline'),
  ('Leadership Team Meeting 5', DATE '2027-05-13', 'meeting'),
  ('Faculty DM 15', DATE '2027-05-18', 'faculty-deadline'),
  ('Whole-School Moderation Meeting 3', DATE '2027-05-26', 'meeting'),
  ('Holiday – May Weekend', DATE '2027-05-28', 'holiday'),
  ('Holiday – May Weekend', DATE '2027-05-31', 'holiday'),
  ('S1 Full Reports Deadline', DATE '2027-06-04', 'reporting'),
  ('Ped Pod 4', DATE '2027-06-09', 'meeting'),
  ('S1 Full Reports QA', DATE '2027-06-11', 'reporting'),
  ('Faculty MOD 5', DATE '2027-06-15', 'faculty-deadline'),
  ('Leadership Team Meeting 6', DATE '2027-06-17', 'meeting'),
  ('School Closes 1pm – Summer', DATE '2027-06-25', 'general')
),
recategorised AS (
  UPDATE public.shared_calendar_events s
    SET category = d.category
    FROM defaults d
    WHERE s.title = d.title AND s.date = d.date AND s.category IS DISTINCT FROM d.category
    RETURNING s.id
)
INSERT INTO public.shared_calendar_events (title, date, category)
SELECT d.title, d.date, d.category
FROM defaults d
WHERE NOT EXISTS (
  SELECT 1 FROM public.shared_calendar_events s
  WHERE s.title = d.title AND s.date = d.date
);
