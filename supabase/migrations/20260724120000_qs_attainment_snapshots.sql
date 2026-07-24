-- QS Attainment Dashboard: yearly Excel-parsed snapshots for SIP review
-- Contains pupil-level attainment data — authenticated faculty read; managers write.

CREATE TABLE IF NOT EXISTS public.qs_attainment_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_year TEXT NOT NULL,
  session_label TEXT NOT NULL DEFAULT '',
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_year)
);

CREATE INDEX IF NOT EXISTS idx_qs_attainment_snapshots_school_year
  ON public.qs_attainment_snapshots (school_year DESC);

CREATE INDEX IF NOT EXISTS idx_qs_attainment_snapshots_updated
  ON public.qs_attainment_snapshots (updated_at DESC);

ALTER TABLE public.qs_attainment_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view QS attainment snapshots"
  ON public.qs_attainment_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "School managers can insert QS attainment snapshots"
  ON public.qs_attainment_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (public.is_school_manager());

CREATE POLICY "School managers can update QS attainment snapshots"
  ON public.qs_attainment_snapshots FOR UPDATE
  TO authenticated
  USING (public.is_school_manager());

CREATE POLICY "School managers can delete QS attainment snapshots"
  ON public.qs_attainment_snapshots FOR DELETE
  TO authenticated
  USING (public.is_school_manager());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qs_attainment_snapshots TO authenticated;

DROP TRIGGER IF EXISTS qs_attainment_snapshots_updated_at ON public.qs_attainment_snapshots;
CREATE TRIGGER qs_attainment_snapshots_updated_at
  BEFORE UPDATE ON public.qs_attainment_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
