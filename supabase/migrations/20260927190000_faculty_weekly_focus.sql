-- Faculty focus of the week: one shared sentence per school week.
-- Shown at the top of every teacher's School work and on the Faculty Hub home.
-- Authenticated staff can read; school managers (admins and faculty heads) write.

CREATE TABLE IF NOT EXISTS public.faculty_weekly_focus (
  week_start DATE PRIMARY KEY,
  focus TEXT NOT NULL CHECK (char_length(focus) BETWEEN 1 AND 180),
  set_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  set_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (EXTRACT(ISODOW FROM week_start) = 1)
);

ALTER TABLE public.faculty_weekly_focus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view faculty focus"
  ON public.faculty_weekly_focus FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "School managers can insert faculty focus"
  ON public.faculty_weekly_focus FOR INSERT
  TO authenticated
  WITH CHECK (public.is_school_manager());

CREATE POLICY "School managers can update faculty focus"
  ON public.faculty_weekly_focus FOR UPDATE
  TO authenticated
  USING (public.is_school_manager());

CREATE POLICY "School managers can delete faculty focus"
  ON public.faculty_weekly_focus FOR DELETE
  TO authenticated
  USING (public.is_school_manager());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.faculty_weekly_focus TO authenticated;

DROP TRIGGER IF EXISTS faculty_weekly_focus_updated_at ON public.faculty_weekly_focus;
CREATE TRIGGER faculty_weekly_focus_updated_at
  BEFORE UPDATE ON public.faculty_weekly_focus
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
