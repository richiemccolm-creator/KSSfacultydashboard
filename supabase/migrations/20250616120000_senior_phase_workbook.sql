-- Senior Phase Tracking: shared faculty workbook (syncs across devices when signed in).

CREATE TABLE IF NOT EXISTS public.senior_phase_workbook (
  id TEXT PRIMARY KEY DEFAULT 'default',
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.senior_phase_workbook (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.senior_phase_workbook ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read senior phase workbook"
  ON public.senior_phase_workbook FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert senior phase workbook"
  ON public.senior_phase_workbook FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update senior phase workbook"
  ON public.senior_phase_workbook FOR UPDATE
  TO authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE ON public.senior_phase_workbook TO authenticated;
