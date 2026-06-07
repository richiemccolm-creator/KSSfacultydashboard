-- Tracking hub: faculty annotations and concern flags per pupil (monitoring hub only)

CREATE TABLE IF NOT EXISTS public.tracking_hub_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pupil_key TEXT NOT NULL,
  subject TEXT NOT NULL CHECK (subject IN ('art', 'drama')),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_email TEXT,
  body TEXT NOT NULL DEFAULT '',
  is_flag BOOLEAN NOT NULL DEFAULT false,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_hub_annotations_pupil
  ON public.tracking_hub_annotations (pupil_key, subject, created_at DESC);

ALTER TABLE public.tracking_hub_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tracking hub annotations"
  ON public.tracking_hub_annotations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can add tracking hub annotations"
  ON public.tracking_hub_annotations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own tracking hub annotations"
  ON public.tracking_hub_annotations FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "Faculty head or admin can update any tracking hub annotation"
  ON public.tracking_hub_annotations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_emails
      WHERE email = (auth.jwt() ->> 'email')
        AND (is_admin = true OR role = 'faculty_head')
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.tracking_hub_annotations TO authenticated;
