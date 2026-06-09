-- Triangulation of Evidence: surveys, focus groups, and exported observations

CREATE TABLE IF NOT EXISTS public.triangulation_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_year TEXT NOT NULL,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('survey', 'focus_group', 'observation')),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triangulation_evidence_school_year
  ON public.triangulation_evidence (school_year, evidence_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_triangulation_evidence_uploaded_by
  ON public.triangulation_evidence (uploaded_by, created_at DESC);

ALTER TABLE public.triangulation_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view triangulation evidence"
  ON public.triangulation_evidence FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert own triangulation evidence"
  ON public.triangulation_evidence FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Uploaders or faculty heads can update triangulation evidence"
  ON public.triangulation_evidence FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = uploaded_by
    OR EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = (auth.jwt()->>'email')
        AND (COALESCE(ae.is_admin, false) OR ae.role = 'faculty_head')
    )
  );

CREATE POLICY "Uploaders or faculty heads can delete triangulation evidence"
  ON public.triangulation_evidence FOR DELETE
  TO authenticated
  USING (
    auth.uid() = uploaded_by
    OR EXISTS (
      SELECT 1 FROM public.allowed_emails ae
      WHERE ae.email = (auth.jwt()->>'email')
        AND (COALESCE(ae.is_admin, false) OR ae.role = 'faculty_head')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.triangulation_evidence TO authenticated;

DROP TRIGGER IF EXISTS triangulation_evidence_updated_at ON public.triangulation_evidence;
CREATE TRIGGER triangulation_evidence_updated_at
  BEFORE UPDATE ON public.triangulation_evidence
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
