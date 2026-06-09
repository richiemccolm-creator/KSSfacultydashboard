-- Year-end improvement plan synthesis (evaluated year → plan for following year)

CREATE TABLE IF NOT EXISTS public.improvement_plan_synthesis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_year TEXT NOT NULL,
  plan_for_year TEXT NOT NULL,
  evidence_snapshot JSONB NOT NULL DEFAULT '{}',
  suggested_priorities JSONB NOT NULL DEFAULT '[]',
  accepted_priorities JSONB NOT NULL DEFAULT '[]',
  strengths JSONB NOT NULL DEFAULT '[]',
  manual_notes TEXT NOT NULL DEFAULT '',
  next_year_plan JSONB NOT NULL DEFAULT '{}',
  dip_seed_applied BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_year)
);

CREATE INDEX IF NOT EXISTS idx_improvement_plan_synthesis_plan_for
  ON public.improvement_plan_synthesis (plan_for_year);

ALTER TABLE public.improvement_plan_synthesis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view improvement plan synthesis"
  ON public.improvement_plan_synthesis FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "School managers can insert improvement plan synthesis"
  ON public.improvement_plan_synthesis FOR INSERT
  TO authenticated
  WITH CHECK (public.is_school_manager());

CREATE POLICY "School managers can update improvement plan synthesis"
  ON public.improvement_plan_synthesis FOR UPDATE
  TO authenticated
  USING (public.is_school_manager());

CREATE POLICY "School managers can delete improvement plan synthesis"
  ON public.improvement_plan_synthesis FOR DELETE
  TO authenticated
  USING (public.is_school_manager());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.improvement_plan_synthesis TO authenticated;

DROP TRIGGER IF EXISTS improvement_plan_synthesis_updated_at ON public.improvement_plan_synthesis;
CREATE TRIGGER improvement_plan_synthesis_updated_at
  BEFORE UPDATE ON public.improvement_plan_synthesis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
