-- Post-it reactions: the person a post-it was sent to can like or love it.
-- The sender sees a small slip beside their banner until they clear it.
-- Needs 20261029120000_staff_postits.sql first.
-- Both changes go through functions so each person can only touch their own side:
-- the recipient sets the reaction, the sender clears the slip.

ALTER TABLE public.staff_postits
  ADD COLUMN IF NOT EXISTS reaction TEXT CHECK (reaction IN ('like', 'love')),
  ADD COLUMN IF NOT EXISTS reacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reaction_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_staff_postits_sender_reactions
  ON public.staff_postits (sender_id, reaction_seen_at)
  WHERE reaction IS NOT NULL;

-- React to a post-it sent to me. Pass NULL to take the reaction back.
CREATE OR REPLACE FUNCTION public.staff_postit_react(p_id UUID, p_reaction TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_reaction IS NOT NULL AND p_reaction NOT IN ('like', 'love') THEN
    RAISE EXCEPTION 'Unknown reaction';
  END IF;
  UPDATE public.staff_postits
     SET reaction = p_reaction,
         reacted_at = CASE WHEN p_reaction IS NULL THEN NULL ELSE NOW() END,
         reaction_seen_at = NULL,
         seen_at = COALESCE(seen_at, NOW())
   WHERE id = p_id
     AND recipient_id = auth.uid();
END;
$$;

-- Clear reaction slips from my screen (post-its I sent).
CREATE OR REPLACE FUNCTION public.staff_postit_clear_reactions(p_ids UUID[])
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.staff_postits
     SET reaction_seen_at = NOW()
   WHERE id = ANY(p_ids)
     AND sender_id = auth.uid()
     AND reaction IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.staff_postit_react(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_postit_clear_reactions(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_postit_react(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_postit_clear_reactions(UUID[]) TO authenticated;
