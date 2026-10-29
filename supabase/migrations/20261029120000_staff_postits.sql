-- Staff post-its: short notes one member of staff sticks on a colleague's
-- Faculty Hub home page, beside the banner, until the colleague ticks "Got it".
-- Only the sender and the recipient can see a note. The sender's id and name are
-- stamped by the trigger, so a note can't claim to be from someone else.
-- The recipient can mark a note seen or dismissed; the sender can withdraw it.

CREATE TABLE IF NOT EXISTS public.staff_postits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 140),
  color TEXT NOT NULL DEFAULT 'yellow' CHECK (color IN ('yellow', 'mint', 'sky', 'peach', 'rose')),
  show_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seen_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_staff_postits_recipient
  ON public.staff_postits (recipient_id, dismissed_at, show_from);
CREATE INDEX IF NOT EXISTS idx_staff_postits_sender
  ON public.staff_postits (sender_id, created_at DESC);

ALTER TABLE public.staff_postits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sender and recipient can view post-its"
  ON public.staff_postits FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Staff can send post-its as themselves"
  ON public.staff_postits FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Recipient can mark post-its seen or dismissed"
  ON public.staff_postits FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE POLICY "Sender can withdraw post-its"
  ON public.staff_postits FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());

-- Supabase grants every new table to anon and authenticated by default; start clean.
REVOKE ALL ON public.staff_postits FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.staff_postits TO authenticated;
-- The recipient may only touch the two status columns, never the text.
GRANT UPDATE (seen_at, dismissed_at) ON public.staff_postits TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_postits_stamp_sender()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.sender_id := auth.uid();
  SELECT COALESCE(NULLIF(btrim(p.display_name), ''), split_part(p.email, '@', 1))
    INTO NEW.sender_name
    FROM public.profiles p
   WHERE p.id = NEW.sender_id;
  NEW.body := btrim(NEW.body);
  NEW.created_at := NOW();
  NEW.seen_at := NULL;
  NEW.dismissed_at := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_postits_stamp_sender ON public.staff_postits;
CREATE TRIGGER staff_postits_stamp_sender
  BEFORE INSERT ON public.staff_postits
  FOR EACH ROW EXECUTE FUNCTION public.staff_postits_stamp_sender();

-- Colleagues to send to. profiles is private to each user (and managers), so
-- this returns only ids and names, never email addresses.
CREATE OR REPLACE FUNCTION public.staff_postit_directory()
RETURNS TABLE (id UUID, display_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id,
         COALESCE(NULLIF(btrim(p.display_name), ''), split_part(p.email, '@', 1)) AS display_name
    FROM public.profiles p
   WHERE auth.uid() IS NOT NULL
     AND p.id <> auth.uid()
   ORDER BY 2;
$$;

REVOKE ALL ON FUNCTION public.staff_postit_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_postit_directory() TO authenticated;
