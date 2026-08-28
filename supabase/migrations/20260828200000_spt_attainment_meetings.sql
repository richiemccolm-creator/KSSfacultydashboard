-- Attainment Meetings: additive shared store for live hub mode.
-- Tracking workbook tables are not modified. IDs on these rows may
-- reference pupils, enrolments, classes, and tracking points, but there
-- are no foreign keys into those records and this migration never writes
-- them. Meeting records sync across devices for authorised staff.

CREATE OR REPLACE FUNCTION public.spt_is_meeting_reader()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.allowed_emails
    WHERE email = (auth.jwt() ->> 'email')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.spt_is_meeting_writer()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  SELECT is_admin, role INTO r
  FROM public.allowed_emails
  WHERE email = (auth.jwt() ->> 'email')
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF lower(trim(COALESCE(r.role, ''))) = 'read_only' THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.spt_can_view_class_review(p_teacher_hub_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.spt_is_meeting_reader() THEN
    RETURN false;
  END IF;
  IF public.is_school_manager() THEN
    RETURN true;
  END IF;
  IF p_teacher_hub_user_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN p_teacher_hub_user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.spt_can_write_class_review(p_teacher_hub_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.spt_is_meeting_writer() THEN
    RETURN false;
  END IF;
  IF public.is_school_manager() THEN
    RETURN true;
  END IF;
  IF p_teacher_hub_user_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN p_teacher_hub_user_id = auth.uid();
END;
$$;

CREATE TABLE IF NOT EXISTS public.spt_attainment_review_cycles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  year_group TEXT NOT NULL,
  tracking_point_id TEXT,
  tracking_point_label TEXT,
  session TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_by_role TEXT,
  created_by_teacher_id TEXT,
  created_by_label TEXT,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.spt_attainment_class_reviews (
  id TEXT PRIMARY KEY,
  review_cycle_id TEXT NOT NULL REFERENCES public.spt_attainment_review_cycles(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL,
  teacher_id TEXT,
  teacher_hub_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'not_started',
  meeting_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (review_cycle_id, class_id)
);

CREATE TABLE IF NOT EXISTS public.spt_attainment_pupil_reviews (
  id TEXT PRIMARY KEY,
  class_review_id TEXT NOT NULL REFERENCES public.spt_attainment_class_reviews(id) ON DELETE CASCADE,
  enrolment_id TEXT NOT NULL,
  pupil_id TEXT,
  discussion_status TEXT NOT NULL DEFAULT 'suggested',
  reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_review_id, enrolment_id)
);

CREATE TABLE IF NOT EXISTS public.spt_attainment_actions (
  id TEXT PRIMARY KEY,
  class_review_id TEXT NOT NULL REFERENCES public.spt_attainment_class_reviews(id) ON DELETE CASCADE,
  enrolment_id TEXT,
  pupil_id TEXT,
  owner_type TEXT NOT NULL,
  owner_id TEXT,
  action_text TEXT NOT NULL DEFAULT '',
  review_point_id TEXT,
  review_date TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  completed_at TIMESTAMPTZ,
  created_by_role TEXT,
  created_by_teacher_id TEXT,
  created_by_label TEXT,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spt_am_class_reviews_cycle
  ON public.spt_attainment_class_reviews (review_cycle_id);

CREATE INDEX IF NOT EXISTS idx_spt_am_class_reviews_teacher
  ON public.spt_attainment_class_reviews (teacher_hub_user_id);

CREATE INDEX IF NOT EXISTS idx_spt_am_pupil_reviews_class
  ON public.spt_attainment_pupil_reviews (class_review_id);

CREATE INDEX IF NOT EXISTS idx_spt_am_actions_class
  ON public.spt_attainment_actions (class_review_id);

ALTER TABLE public.spt_attainment_review_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spt_attainment_class_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spt_attainment_pupil_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spt_attainment_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allowlisted staff can view attainment review cycles"
  ON public.spt_attainment_review_cycles;
CREATE POLICY "Allowlisted staff can view attainment review cycles"
  ON public.spt_attainment_review_cycles FOR SELECT
  TO authenticated
  USING (public.spt_is_meeting_reader());

DROP POLICY IF EXISTS "School managers can insert attainment review cycles"
  ON public.spt_attainment_review_cycles;
CREATE POLICY "School managers can insert attainment review cycles"
  ON public.spt_attainment_review_cycles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_school_manager());

DROP POLICY IF EXISTS "School managers can update attainment review cycles"
  ON public.spt_attainment_review_cycles;
CREATE POLICY "School managers can update attainment review cycles"
  ON public.spt_attainment_review_cycles FOR UPDATE
  TO authenticated
  USING (public.is_school_manager())
  WITH CHECK (public.is_school_manager());

DROP POLICY IF EXISTS "School managers can delete attainment review cycles"
  ON public.spt_attainment_review_cycles;
CREATE POLICY "School managers can delete attainment review cycles"
  ON public.spt_attainment_review_cycles FOR DELETE
  TO authenticated
  USING (public.is_school_manager());

DROP POLICY IF EXISTS "Staff can view authorised class reviews"
  ON public.spt_attainment_class_reviews;
CREATE POLICY "Staff can view authorised class reviews"
  ON public.spt_attainment_class_reviews FOR SELECT
  TO authenticated
  USING (public.spt_can_view_class_review(teacher_hub_user_id));

DROP POLICY IF EXISTS "Staff can insert authorised class reviews"
  ON public.spt_attainment_class_reviews;
CREATE POLICY "Staff can insert authorised class reviews"
  ON public.spt_attainment_class_reviews FOR INSERT
  TO authenticated
  WITH CHECK (public.spt_can_write_class_review(teacher_hub_user_id));

DROP POLICY IF EXISTS "Staff can update authorised class reviews"
  ON public.spt_attainment_class_reviews;
CREATE POLICY "Staff can update authorised class reviews"
  ON public.spt_attainment_class_reviews FOR UPDATE
  TO authenticated
  USING (public.spt_can_write_class_review(teacher_hub_user_id))
  WITH CHECK (public.spt_can_write_class_review(teacher_hub_user_id));

DROP POLICY IF EXISTS "School managers can delete class reviews"
  ON public.spt_attainment_class_reviews;
CREATE POLICY "School managers can delete class reviews"
  ON public.spt_attainment_class_reviews FOR DELETE
  TO authenticated
  USING (public.is_school_manager());

DROP POLICY IF EXISTS "Staff can view authorised pupil reviews"
  ON public.spt_attainment_pupil_reviews;
CREATE POLICY "Staff can view authorised pupil reviews"
  ON public.spt_attainment_pupil_reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.spt_attainment_class_reviews cr
      WHERE cr.id = class_review_id
        AND public.spt_can_view_class_review(cr.teacher_hub_user_id)
    )
  );

DROP POLICY IF EXISTS "Staff can insert authorised pupil reviews"
  ON public.spt_attainment_pupil_reviews;
CREATE POLICY "Staff can insert authorised pupil reviews"
  ON public.spt_attainment_pupil_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    public.spt_is_meeting_writer()
    AND EXISTS (
      SELECT 1 FROM public.spt_attainment_class_reviews cr
      WHERE cr.id = class_review_id
        AND public.spt_can_write_class_review(cr.teacher_hub_user_id)
    )
  );

DROP POLICY IF EXISTS "Staff can update authorised pupil reviews"
  ON public.spt_attainment_pupil_reviews;
CREATE POLICY "Staff can update authorised pupil reviews"
  ON public.spt_attainment_pupil_reviews FOR UPDATE
  TO authenticated
  USING (
    public.spt_is_meeting_writer()
    AND EXISTS (
      SELECT 1 FROM public.spt_attainment_class_reviews cr
      WHERE cr.id = class_review_id
        AND public.spt_can_write_class_review(cr.teacher_hub_user_id)
    )
  )
  WITH CHECK (
    public.spt_is_meeting_writer()
    AND EXISTS (
      SELECT 1 FROM public.spt_attainment_class_reviews cr
      WHERE cr.id = class_review_id
        AND public.spt_can_write_class_review(cr.teacher_hub_user_id)
    )
  );

DROP POLICY IF EXISTS "School managers can delete pupil reviews"
  ON public.spt_attainment_pupil_reviews;
CREATE POLICY "School managers can delete pupil reviews"
  ON public.spt_attainment_pupil_reviews FOR DELETE
  TO authenticated
  USING (public.is_school_manager());

DROP POLICY IF EXISTS "Staff can view authorised meeting actions"
  ON public.spt_attainment_actions;
CREATE POLICY "Staff can view authorised meeting actions"
  ON public.spt_attainment_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.spt_attainment_class_reviews cr
      WHERE cr.id = class_review_id
        AND public.spt_can_view_class_review(cr.teacher_hub_user_id)
    )
  );

DROP POLICY IF EXISTS "Staff can insert authorised meeting actions"
  ON public.spt_attainment_actions;
CREATE POLICY "Staff can insert authorised meeting actions"
  ON public.spt_attainment_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.spt_is_meeting_writer()
    AND EXISTS (
      SELECT 1 FROM public.spt_attainment_class_reviews cr
      WHERE cr.id = class_review_id
        AND public.spt_can_write_class_review(cr.teacher_hub_user_id)
    )
  );

DROP POLICY IF EXISTS "Staff can update authorised meeting actions"
  ON public.spt_attainment_actions;
CREATE POLICY "Staff can update authorised meeting actions"
  ON public.spt_attainment_actions FOR UPDATE
  TO authenticated
  USING (
    public.spt_is_meeting_writer()
    AND EXISTS (
      SELECT 1 FROM public.spt_attainment_class_reviews cr
      WHERE cr.id = class_review_id
        AND public.spt_can_write_class_review(cr.teacher_hub_user_id)
    )
  )
  WITH CHECK (
    public.spt_is_meeting_writer()
    AND EXISTS (
      SELECT 1 FROM public.spt_attainment_class_reviews cr
      WHERE cr.id = class_review_id
        AND public.spt_can_write_class_review(cr.teacher_hub_user_id)
    )
  );

DROP POLICY IF EXISTS "Staff can delete authorised meeting actions"
  ON public.spt_attainment_actions;
CREATE POLICY "Staff can delete authorised meeting actions"
  ON public.spt_attainment_actions FOR DELETE
  TO authenticated
  USING (
    public.spt_is_meeting_writer()
    AND EXISTS (
      SELECT 1 FROM public.spt_attainment_class_reviews cr
      WHERE cr.id = class_review_id
        AND public.spt_can_write_class_review(cr.teacher_hub_user_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.spt_attainment_review_cycles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spt_attainment_class_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spt_attainment_pupil_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spt_attainment_actions TO authenticated;

DROP TRIGGER IF EXISTS spt_am_review_cycles_updated_at ON public.spt_attainment_review_cycles;
CREATE TRIGGER spt_am_review_cycles_updated_at
  BEFORE UPDATE ON public.spt_attainment_review_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS spt_am_class_reviews_updated_at ON public.spt_attainment_class_reviews;
CREATE TRIGGER spt_am_class_reviews_updated_at
  BEFORE UPDATE ON public.spt_attainment_class_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS spt_am_pupil_reviews_updated_at ON public.spt_attainment_pupil_reviews;
CREATE TRIGGER spt_am_pupil_reviews_updated_at
  BEFORE UPDATE ON public.spt_attainment_pupil_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS spt_am_actions_updated_at ON public.spt_attainment_actions;
CREATE TRIGGER spt_am_actions_updated_at
  BEFORE UPDATE ON public.spt_attainment_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
