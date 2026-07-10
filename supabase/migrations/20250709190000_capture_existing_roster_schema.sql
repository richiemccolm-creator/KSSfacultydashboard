-- Documentation capture of roster / promotion objects that already exist in the live Supabase project.
-- DO NOT treat this as greenfield DDL — objects were created in the SQL editor before this migration.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where definitions are included.
--
-- BEFORE DEPLOYING: run the capture queries below in the Supabase SQL editor and paste
-- pg_get_functiondef output into the "LIVE FUNCTION DEFINITIONS" section if signatures differ.

-- =============================================================================
-- CAPTURE QUERIES (run in Supabase SQL editor; paste results into repo notes)
-- =============================================================================
-- select table_name, column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
-- order by table_name, ordinal_position;
--
-- select routine_name, data_type as returns
-- from information_schema.routines
-- where routine_schema = 'public'
-- order by routine_name;
--
-- select pg_get_functiondef(p.oid)
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in (
--     'preview_promotion_run',
--     'commit_promotion_run',
--     'bulk_upsert_pupils_and_enrollments',
--     'assign_classes_to_teachers',
--     'detect_existing_class_conflicts',
--     'list_my_assigned_classes_for_tracker',
--     'upsert_teacher_subject_classes_for_loader',
--     'list_teacher_class_pupils_for_loader',
--     'list_teaching_staff_for_class_loader'
--   );

-- =============================================================================
-- INFERRED TABLE SHAPES (from data-service.js client fallbacks — verify against live DB)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS academic_years_label_key ON public.academic_years (label);

CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  year_level_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  class_code TEXT NOT NULL,
  class_name TEXT NOT NULL,
  source TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classes_year_subject ON public.classes (academic_year_id, subject);
CREATE UNIQUE INDEX IF NOT EXISTS classes_year_subject_code_key
  ON public.classes (academic_year_id, subject, class_code);

CREATE TABLE IF NOT EXISTS public.class_teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_role TEXT NOT NULL DEFAULT 'primary',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_teacher
  ON public.class_teacher_assignments (teacher_id, assignment_role);

CREATE TABLE IF NOT EXISTS public.pupils (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT,
  first_name TEXT,
  last_name TEXT,
  preferred_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Live DB may use class_enrollments, class_enrollments, or enrolments — verify with capture query.
CREATE TABLE IF NOT EXISTS public.class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  pupil_id UUID NOT NULL REFERENCES public.pupils(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS class_enrollments_class_pupil_key
  ON public.class_enrollments (class_id, pupil_id);

-- =============================================================================
-- RPC SIGNATURES EXPECTED BY data-service.js (parameter names only — bodies live in Supabase)
-- =============================================================================
-- preview_promotion_run(
--   p_from_academic_year_label text,
--   p_to_academic_year_label text,
--   p_from_year_level integer,
--   p_to_year_level integer,
--   p_teacher_reassignments jsonb
-- ) returns jsonb
--
-- commit_promotion_run(
--   p_from_academic_year_label text,
--   p_to_academic_year_label text,
--   p_from_year_level integer,
--   p_to_year_level integer,
--   p_teacher_reassignments jsonb,
--   p_override_conflicts boolean
-- ) returns jsonb
--
-- bulk_upsert_pupils_and_enrollments(
--   p_rows jsonb,
--   p_academic_year_label text,
--   p_mode text,
--   p_override_conflicts boolean
-- ) returns jsonb
--
-- assign_classes_to_teachers(
--   p_assignments jsonb,
--   p_academic_year_label text,
--   p_override_conflicts boolean
-- ) returns jsonb
--
-- detect_existing_class_conflicts(
--   p_rows jsonb,
--   p_academic_year_label text
-- ) returns jsonb
--
-- list_my_assigned_classes_for_tracker(
--   p_subject text,
--   p_academic_year_label text
-- ) returns setof ...
--
-- upsert_teacher_subject_classes_for_loader(
--   p_teacher_id uuid,
--   p_subject text,
--   p_academic_year_label text,
--   p_classes jsonb,
--   p_replace_existing boolean
-- ) returns jsonb
--
-- list_teacher_class_pupils_for_loader(
--   p_teacher_id uuid,
--   p_subject text,
--   p_academic_year_label text
-- ) returns setof ...

-- =============================================================================
-- LIVE FUNCTION DEFINITIONS
-- Paste output from pg_get_functiondef here after running capture queries in production.
-- =============================================================================
