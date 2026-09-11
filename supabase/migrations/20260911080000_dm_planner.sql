-- Faculty DM / MOD year planner: one JSON document per school year.
-- Authenticated faculty can read; school managers write.

CREATE TABLE IF NOT EXISTS public.dm_planner (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_year TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_year)
);

CREATE INDEX IF NOT EXISTS idx_dm_planner_school_year
  ON public.dm_planner (school_year DESC);

CREATE INDEX IF NOT EXISTS idx_dm_planner_updated
  ON public.dm_planner (updated_at DESC);

ALTER TABLE public.dm_planner ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view DM planner"
  ON public.dm_planner FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "School managers can insert DM planner"
  ON public.dm_planner FOR INSERT
  TO authenticated
  WITH CHECK (public.is_school_manager());

CREATE POLICY "School managers can update DM planner"
  ON public.dm_planner FOR UPDATE
  TO authenticated
  USING (public.is_school_manager());

CREATE POLICY "School managers can delete DM planner"
  ON public.dm_planner FOR DELETE
  TO authenticated
  USING (public.is_school_manager());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_planner TO authenticated;

DROP TRIGGER IF EXISTS dm_planner_updated_at ON public.dm_planner;
CREATE TRIGGER dm_planner_updated_at
  BEFORE UPDATE ON public.dm_planner
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
