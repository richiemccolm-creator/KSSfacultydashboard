-- Staff chat: live one-to-one and group conversations between staff on the Faculty Hub.
-- Needs 20261029120000_staff_postits.sql first (the chat reuses staff_postit_directory()
-- for the list of colleagues).
-- Only the members of a chat can see it, its members or its messages. The sender's id
-- and name are stamped by a trigger. Chats are started through functions so nobody
-- can add themselves to someone else's conversation.
-- Messages and read receipts are published to Supabase Realtime; RLS still decides
-- who receives each change.

CREATE TABLE IF NOT EXISTS public.staff_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('direct', 'group')),
  title TEXT CHECK (title IS NULL OR char_length(btrim(title)) BETWEEN 1 AND 60),
  -- For direct chats: the two member ids in sorted order, so each pair has one chat.
  direct_key TEXT UNIQUE,
  created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.staff_chat_members (
  chat_id UUID NOT NULL REFERENCES public.staff_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.staff_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.staff_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_chat_members_user ON public.staff_chat_members (user_id);
CREATE INDEX IF NOT EXISTS idx_staff_chat_messages_chat ON public.staff_chat_messages (chat_id, created_at DESC);

-- Membership check used by the policies. SECURITY DEFINER so the members policy
-- doesn't recurse into itself.
CREATE OR REPLACE FUNCTION public.is_staff_chat_member(p_chat UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_chat_members
     WHERE chat_id = p_chat AND user_id = auth.uid()
  );
$$;

ALTER TABLE public.staff_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their chats"
  ON public.staff_chats FOR SELECT
  TO authenticated
  USING (public.is_staff_chat_member(id));

CREATE POLICY "Members can view who is in their chats"
  ON public.staff_chat_members FOR SELECT
  TO authenticated
  USING (public.is_staff_chat_member(chat_id));

CREATE POLICY "Members can view messages in their chats"
  ON public.staff_chat_messages FOR SELECT
  TO authenticated
  USING (public.is_staff_chat_member(chat_id));

CREATE POLICY "Members can post in their chats as themselves"
  ON public.staff_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_staff_chat_member(chat_id));

-- Supabase grants every new table to anon and authenticated by default; start clean.
-- Creating chats, joining, leaving and read receipts all go through the functions below.
REVOKE ALL ON public.staff_chats FROM anon, authenticated;
REVOKE ALL ON public.staff_chat_members FROM anon, authenticated;
REVOKE ALL ON public.staff_chat_messages FROM anon, authenticated;
GRANT SELECT ON public.staff_chats TO authenticated;
GRANT SELECT ON public.staff_chat_members TO authenticated;
GRANT SELECT, INSERT ON public.staff_chat_messages TO authenticated;

-- Stamp the sender, tidy the text, and move the chat to the top of everyone's list.
CREATE OR REPLACE FUNCTION public.staff_chat_messages_stamp()
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
  UPDATE public.staff_chats SET last_message_at = NEW.created_at WHERE id = NEW.chat_id;
  -- Sending counts as having read the chat up to now.
  UPDATE public.staff_chat_members SET last_read_at = NEW.created_at
   WHERE chat_id = NEW.chat_id AND user_id = NEW.sender_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_chat_messages_stamp ON public.staff_chat_messages;
CREATE TRIGGER staff_chat_messages_stamp
  BEFORE INSERT ON public.staff_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.staff_chat_messages_stamp();

-- Open (or start) my one-to-one chat with a colleague. Returns the chat id.
CREATE OR REPLACE FUNCTION public.staff_chat_open_direct(p_other UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  k TEXT;
  cid UUID;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF p_other IS NULL OR p_other = me THEN RAISE EXCEPTION 'Choose a colleague'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_other) THEN
    RAISE EXCEPTION 'Colleague not found';
  END IF;
  k := LEAST(me::text, p_other::text) || ':' || GREATEST(me::text, p_other::text);
  SELECT id INTO cid FROM public.staff_chats WHERE direct_key = k;
  IF cid IS NULL THEN
    INSERT INTO public.staff_chats (kind, direct_key, created_by)
    VALUES ('direct', k, me)
    ON CONFLICT (direct_key) DO NOTHING
    RETURNING id INTO cid;
    IF cid IS NULL THEN
      SELECT id INTO cid FROM public.staff_chats WHERE direct_key = k;
    END IF;
  END IF;
  INSERT INTO public.staff_chat_members (chat_id, user_id)
  VALUES (cid, me), (cid, p_other)
  ON CONFLICT DO NOTHING;
  RETURN cid;
END;
$$;

-- Start a group chat with a name and colleagues. Returns the chat id.
CREATE OR REPLACE FUNCTION public.staff_chat_create_group(p_title TEXT, p_members UUID[])
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  cid UUID;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Give the group a name (up to 60 characters)';
  END IF;
  IF COALESCE(array_length(p_members, 1), 0) = 0 THEN RAISE EXCEPTION 'Choose who is in the group'; END IF;
  IF array_length(p_members, 1) > 80 THEN RAISE EXCEPTION 'Groups can have up to 80 people'; END IF;
  INSERT INTO public.staff_chats (kind, title, created_by)
  VALUES ('group', btrim(p_title), me)
  RETURNING id INTO cid;
  INSERT INTO public.staff_chat_members (chat_id, user_id)
  SELECT cid, me
  UNION
  SELECT cid, p.id FROM public.profiles p WHERE p.id = ANY(p_members)
  ON CONFLICT DO NOTHING;
  RETURN cid;
END;
$$;

-- Add colleagues to a group I'm in.
CREATE OR REPLACE FUNCTION public.staff_chat_add_members(p_chat UUID, p_members UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_chats c
     WHERE c.id = p_chat AND c.kind = 'group' AND public.is_staff_chat_member(c.id)
  ) THEN
    RAISE EXCEPTION 'You can only add people to a group you are in';
  END IF;
  INSERT INTO public.staff_chat_members (chat_id, user_id)
  SELECT p_chat, p.id FROM public.profiles p WHERE p.id = ANY(p_members)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Leave a group. The last person out deletes the group and its messages.
CREATE OR REPLACE FUNCTION public.staff_chat_leave(p_chat UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff_chats WHERE id = p_chat AND kind = 'group') THEN
    RAISE EXCEPTION 'Only group chats can be left';
  END IF;
  DELETE FROM public.staff_chat_members WHERE chat_id = p_chat AND user_id = auth.uid();
  DELETE FROM public.staff_chats c
   WHERE c.id = p_chat
     AND NOT EXISTS (SELECT 1 FROM public.staff_chat_members m WHERE m.chat_id = c.id);
END;
$$;

-- I've read this chat up to now.
CREATE OR REPLACE FUNCTION public.staff_chat_mark_read(p_chat UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.staff_chat_members
     SET last_read_at = NOW()
   WHERE chat_id = p_chat AND user_id = auth.uid();
$$;

-- My chats, most recent first, with a name to show, the last message and my unread count.
CREATE OR REPLACE FUNCTION public.staff_chat_list()
RETURNS TABLE (
  id UUID,
  kind TEXT,
  title TEXT,
  other_id UUID,
  member_count INT,
  last_message_at TIMESTAMPTZ,
  last_body TEXT,
  last_sender_id UUID,
  last_sender_name TEXT,
  unread INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id,
         c.kind,
         CASE WHEN c.kind = 'group' THEN c.title
              ELSE COALESCE(NULLIF(btrim(op.display_name), ''), split_part(op.email, '@', 1), 'Colleague') END,
         o.user_id,
         (SELECT count(*)::int FROM public.staff_chat_members x WHERE x.chat_id = c.id),
         COALESCE(c.last_message_at, c.created_at),
         lm.body,
         lm.sender_id,
         lm.sender_name,
         (SELECT count(*)::int FROM public.staff_chat_messages u
           WHERE u.chat_id = c.id AND u.sender_id <> auth.uid() AND u.created_at > me.last_read_at)
    FROM public.staff_chat_members me
    JOIN public.staff_chats c ON c.id = me.chat_id
    LEFT JOIN LATERAL (
      SELECT m.user_id FROM public.staff_chat_members m
       WHERE c.kind = 'direct' AND m.chat_id = c.id AND m.user_id <> auth.uid()
       LIMIT 1
    ) o ON TRUE
    LEFT JOIN public.profiles op ON op.id = o.user_id
    LEFT JOIN LATERAL (
      SELECT m.body, m.sender_id, m.sender_name FROM public.staff_chat_messages m
       WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1
    ) lm ON TRUE
   WHERE me.user_id = auth.uid()
     -- A direct chat nobody has written in yet stays out of the list.
     AND (c.kind = 'group' OR lm.body IS NOT NULL)
   ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
   LIMIT 100;
$$;

-- Who is in a chat I'm in: ids, names and how far each has read. No emails.
CREATE OR REPLACE FUNCTION public.staff_chat_members_of(p_chat UUID)
RETURNS TABLE (user_id UUID, display_name TEXT, last_read_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id,
         COALESCE(NULLIF(btrim(p.display_name), ''), split_part(p.email, '@', 1), 'Colleague'),
         m.last_read_at
    FROM public.staff_chat_members m
    LEFT JOIN public.profiles p ON p.id = m.user_id
   WHERE m.chat_id = p_chat
     AND public.is_staff_chat_member(p_chat)
   ORDER BY 2;
$$;

REVOKE ALL ON FUNCTION public.is_staff_chat_member(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_chat_open_direct(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_chat_create_group(TEXT, UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_chat_add_members(UUID, UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_chat_leave(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_chat_mark_read(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_chat_list() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_chat_members_of(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff_chat_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_chat_open_direct(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_chat_create_group(TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_chat_add_members(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_chat_leave(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_chat_mark_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_chat_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_chat_members_of(UUID) TO authenticated;

-- Live updates: new messages, and read receipts for "Seen".
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_chat_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_chat_members;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
