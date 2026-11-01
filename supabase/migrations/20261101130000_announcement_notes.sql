-- Announcement notes: a faculty head's private jottings for the next round of
-- announcements ("remind staff about prelim folders", "show tickets on sale
-- Weds"). They are written on the Announcements page (My notes tab) and read
-- by the Sunday-night announcements agent, which runs with the service role
-- and marks each note it uses.
--
-- Only the person who wrote a note can see or change it. A note waits until
-- used_at is set; mention_from holds it back until a given week.

CREATE TABLE IF NOT EXISTS public.announcement_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  mention_from DATE,
  used_at TIMESTAMPTZ,
  used_in UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.announcement_notes.mention_from IS
  'Not used before this date. NULL means use it in the next announcements.';
COMMENT ON COLUMN public.announcement_notes.used_at IS
  'When the note went into announcements (or was ticked off by hand). NULL = still waiting.';
COMMENT ON COLUMN public.announcement_notes.used_in IS
  'Ids of the announcements the agent wrote from this note.';

CREATE INDEX IF NOT EXISTS idx_announcement_notes_owner
  ON public.announcement_notes (owner_id, used_at, created_at DESC);

ALTER TABLE public.announcement_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner reads own announcement notes" ON public.announcement_notes;
CREATE POLICY "Owner reads own announcement notes"
  ON public.announcement_notes FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner adds own announcement notes" ON public.announcement_notes;
CREATE POLICY "Owner adds own announcement notes"
  ON public.announcement_notes FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner edits own announcement notes" ON public.announcement_notes;
CREATE POLICY "Owner edits own announcement notes"
  ON public.announcement_notes FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner deletes own announcement notes" ON public.announcement_notes;
CREATE POLICY "Owner deletes own announcement notes"
  ON public.announcement_notes FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Supabase grants every new table to anon and authenticated by default; start clean.
REVOKE ALL ON public.announcement_notes FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.announcement_notes TO authenticated;
GRANT UPDATE (body, mention_from, used_at, used_in) ON public.announcement_notes TO authenticated;

CREATE OR REPLACE FUNCTION public.announcement_notes_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS announcement_notes_touch ON public.announcement_notes;
CREATE TRIGGER announcement_notes_touch
  BEFORE UPDATE ON public.announcement_notes
  FOR EACH ROW EXECUTE FUNCTION public.announcement_notes_touch();
