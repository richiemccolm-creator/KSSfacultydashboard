-- Faculty Head Hub: draft and scheduled announcements.
-- status = 'draft' keeps an announcement private to faculty heads/admins.
-- status = 'published' shows it to staff once publish_at has passed, so a
-- scheduled post needs no job to "send" it: visibility is decided at read time.

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ NULL;

-- Existing announcements went live when they were created.
UPDATE public.announcements
  SET publish_at = COALESCE(created_at, now())
  WHERE publish_at IS NULL;

ALTER TABLE public.announcements
  ALTER COLUMN publish_at SET DEFAULT now();

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_status_check;
ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_status_check CHECK (status IN ('draft', 'published'));

CREATE INDEX IF NOT EXISTS announcements_status_publish_at_idx
  ON public.announcements (status, publish_at);

COMMENT ON COLUMN public.announcements.status IS
  'draft = only faculty heads/admins can see it; published = staff see it from publish_at.';
COMMENT ON COLUMN public.announcements.publish_at IS
  'When a published announcement becomes visible to staff. A future time means scheduled.';

-- Row level security. Any existing SELECT policy that lets every signed-in
-- user read the whole table would also expose drafts (policies are OR-ed),
-- so replace all announcement policies with a known set.
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'announcements'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.announcements', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Staff read live announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (
    public.is_school_manager()
    OR (status = 'published' AND COALESCE(publish_at, created_at) <= now())
  );

CREATE POLICY "School managers insert announcements"
  ON public.announcements FOR INSERT
  TO authenticated
  WITH CHECK (public.is_school_manager());

CREATE POLICY "School managers update announcements"
  ON public.announcements FOR UPDATE
  TO authenticated
  USING (public.is_school_manager())
  WITH CHECK (public.is_school_manager());

CREATE POLICY "School managers delete announcements"
  ON public.announcements FOR DELETE
  TO authenticated
  USING (public.is_school_manager());
