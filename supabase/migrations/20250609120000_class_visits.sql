-- Class Visit Feedback: saved observations stored in Supabase (faculty-wide)

CREATE TABLE IF NOT EXISTS public.class_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_year TEXT NOT NULL,
  saved_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_visits_school_year
  ON public.class_visits (school_year, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_class_visits_saved_by
  ON public.class_visits (saved_by, created_at DESC);

ALTER TABLE public.class_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view class visits"
  ON public.class_visits FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert own class visits"
  ON public.class_visits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = saved_by);

CREATE POLICY "Users or school managers can update class visits"
  ON public.class_visits FOR UPDATE
  TO authenticated
  USING (auth.uid() = saved_by OR public.is_school_manager());

CREATE POLICY "Users or school managers can delete class visits"
  ON public.class_visits FOR DELETE
  TO authenticated
  USING (auth.uid() = saved_by OR public.is_school_manager());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_visits TO authenticated;

DROP TRIGGER IF EXISTS class_visits_updated_at ON public.class_visits;
CREATE TRIGGER class_visits_updated_at
  BEFORE UPDATE ON public.class_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
