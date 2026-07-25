-- Classroom Toolkit Exit Tickets: live short-text responses with teacher-gated board
-- Pupils join via PIN (anon); teachers host while signed in.

CREATE TABLE IF NOT EXISTS public.exit_ticket_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Exit Ticket',
  prompts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby', 'open', 'closed')),
  show_nicknames BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT exit_ticket_sessions_pin_format CHECK (pin ~ '^[0-9]{6}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS exit_ticket_sessions_open_pin_uidx
  ON public.exit_ticket_sessions (pin)
  WHERE status IN ('lobby', 'open');

CREATE INDEX IF NOT EXISTS exit_ticket_sessions_host_idx
  ON public.exit_ticket_sessions (host_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.exit_ticket_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.exit_ticket_sessions(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  token TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT exit_ticket_players_nickname_len CHECK (char_length(trim(nickname)) BETWEEN 1 AND 24),
  CONSTRAINT exit_ticket_players_token_len CHECK (char_length(token) >= 16)
);

CREATE UNIQUE INDEX IF NOT EXISTS exit_ticket_players_session_token_uidx
  ON public.exit_ticket_players (session_id, token);

CREATE UNIQUE INDEX IF NOT EXISTS exit_ticket_players_session_nick_uidx
  ON public.exit_ticket_players (session_id, lower(trim(nickname)));

CREATE TABLE IF NOT EXISTS public.exit_ticket_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.exit_ticket_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.exit_ticket_players(id) ON DELETE CASCADE,
  prompt_index INT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'hidden', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, player_id, prompt_index),
  CONSTRAINT exit_ticket_responses_body_len CHECK (char_length(trim(body)) BETWEEN 1 AND 160),
  CONSTRAINT exit_ticket_responses_prompt_idx CHECK (prompt_index >= 0 AND prompt_index < 10)
);

CREATE INDEX IF NOT EXISTS exit_ticket_responses_session_status_idx
  ON public.exit_ticket_responses (session_id, status, created_at DESC);

ALTER TABLE public.exit_ticket_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exit_ticket_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exit_ticket_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts manage own exit ticket sessions" ON public.exit_ticket_sessions;
CREATE POLICY "Hosts manage own exit ticket sessions"
  ON public.exit_ticket_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts read exit ticket players" ON public.exit_ticket_players;
CREATE POLICY "Hosts read exit ticket players"
  ON public.exit_ticket_players
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exit_ticket_sessions s
      WHERE s.id = session_id AND s.host_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Hosts manage exit ticket responses" ON public.exit_ticket_responses;
CREATE POLICY "Hosts manage exit ticket responses"
  ON public.exit_ticket_responses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exit_ticket_sessions s
      WHERE s.id = session_id AND s.host_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exit_ticket_sessions s
      WHERE s.id = session_id AND s.host_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exit_ticket_sessions TO authenticated;
GRANT SELECT ON public.exit_ticket_players TO authenticated;
GRANT SELECT, UPDATE ON public.exit_ticket_responses TO authenticated;

DROP TRIGGER IF EXISTS exit_ticket_sessions_updated_at ON public.exit_ticket_sessions;
CREATE TRIGGER exit_ticket_sessions_updated_at
  BEFORE UPDATE ON public.exit_ticket_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS exit_ticket_responses_updated_at ON public.exit_ticket_responses;
CREATE TRIGGER exit_ticket_responses_updated_at
  BEFORE UPDATE ON public.exit_ticket_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Basic school-safe blocklist (obvious terms). Expandable later.
CREATE OR REPLACE FUNCTION public.exit_ticket_text_is_blocked(p_text text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text;
  v_words text[] := ARRAY[
    'fuck','fucking','fucked','shit','shitty','bitch','bastard','asshole','arsehole',
    'cunt','cock','dick','piss','wank','wanker','slut','whore','nigger','nigga',
    'faggot','retard','retarded','rape','rapist','kill yourself','kys'
  ];
  w text;
BEGIN
  v := lower(trim(both FROM coalesce(p_text, '')));
  IF v = '' THEN
    RETURN false;
  END IF;
  -- strip light punctuation for matching
  v := regexp_replace(v, '[[:punct:]]+', ' ', 'g');
  v := ' ' || regexp_replace(v, '\s+', ' ', 'g') || ' ';
  FOREACH w IN ARRAY v_words LOOP
    IF position(' ' || w || ' ' IN v) > 0 THEN
      RETURN true;
    END IF;
    -- also catch glued forms
    IF position(w IN replace(v, ' ', '')) > 0 AND char_length(w) >= 4 THEN
      IF position(w IN regexp_replace(lower(coalesce(p_text,'')), '[^a-z]', '', 'g')) > 0 THEN
        RETURN true;
      END IF;
    END IF;
  END LOOP;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.exit_join_session(p_pin text, p_nickname text, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.exit_ticket_sessions%ROWTYPE;
  v_player public.exit_ticket_players%ROWTYPE;
  v_nick text;
BEGIN
  v_nick := trim(both FROM coalesce(p_nickname, ''));
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid PIN';
  END IF;
  IF char_length(v_nick) < 1 OR char_length(v_nick) > 24 THEN
    RAISE EXCEPTION 'Nickname must be 1–24 characters';
  END IF;
  IF public.exit_ticket_text_is_blocked(v_nick) THEN
    RAISE EXCEPTION 'Please choose a different nickname';
  END IF;
  IF p_token IS NULL OR char_length(p_token) < 16 THEN
    RAISE EXCEPTION 'Invalid player token';
  END IF;

  SELECT * INTO v_session
  FROM public.exit_ticket_sessions
  WHERE pin = p_pin AND status IN ('lobby', 'open')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No live exit ticket found for that PIN';
  END IF;

  SELECT * INTO v_player
  FROM public.exit_ticket_players
  WHERE session_id = v_session.id AND token = p_token;

  IF FOUND THEN
    UPDATE public.exit_ticket_players
    SET nickname = v_nick
    WHERE id = v_player.id
    RETURNING * INTO v_player;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.exit_ticket_players
      WHERE session_id = v_session.id AND lower(trim(nickname)) = lower(v_nick)
    ) THEN
      RAISE EXCEPTION 'That nickname is already taken';
    END IF;

    INSERT INTO public.exit_ticket_players (session_id, nickname, token)
    VALUES (v_session.id, v_nick, p_token)
    RETURNING * INTO v_player;
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'player_id', v_player.id,
    'nickname', v_player.nickname,
    'token', v_player.token,
    'status', v_session.status,
    'title', v_session.title,
    'prompt_count', jsonb_array_length(COALESCE(v_session.prompts_json, '[]'::jsonb))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.exit_get_session_state(p_pin text, p_token text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.exit_ticket_sessions%ROWTYPE;
  v_player public.exit_ticket_players%ROWTYPE;
  v_prompts jsonb := '[]'::jsonb;
  v_mine jsonb := '[]'::jsonb;
  v_player_count int := 0;
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid PIN';
  END IF;

  SELECT * INTO v_session
  FROM public.exit_ticket_sessions
  WHERE pin = p_pin AND status <> 'closed'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF p_token IS NOT NULL AND char_length(p_token) >= 16 THEN
    SELECT * INTO v_player
    FROM public.exit_ticket_players
    WHERE session_id = v_session.id AND token = p_token;
  END IF;

  SELECT count(*)::int INTO v_player_count
  FROM public.exit_ticket_players
  WHERE session_id = v_session.id;

  IF v_session.status = 'open' THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('index', (ord - 1)::int, 'text', elem)
      ORDER BY ord
    ), '[]'::jsonb)
    INTO v_prompts
    FROM jsonb_array_elements_text(COALESCE(v_session.prompts_json, '[]'::jsonb))
      WITH ORDINALITY AS t(elem, ord);
  ELSE
    v_prompts := '[]'::jsonb;
  END IF;

  IF v_player.id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'prompt_index', r.prompt_index,
      'status', r.status,
      'body', CASE WHEN r.status = 'blocked' THEN NULL ELSE r.body END
    ) ORDER BY r.prompt_index), '[]'::jsonb)
    INTO v_mine
    FROM public.exit_ticket_responses r
    WHERE r.session_id = v_session.id AND r.player_id = v_player.id;
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'title', v_session.title,
    'status', v_session.status,
    'prompt_count', jsonb_array_length(COALESCE(v_session.prompts_json, '[]'::jsonb)),
    'prompts', v_prompts,
    'player_count', v_player_count,
    'nickname', v_player.nickname,
    'my_responses', v_mine
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.exit_submit_response(p_token text, p_prompt_index int, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player public.exit_ticket_players%ROWTYPE;
  v_session public.exit_ticket_sessions%ROWTYPE;
  v_body text;
  v_existing public.exit_ticket_responses%ROWTYPE;
  v_count int;
  v_status text := 'pending';
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 16 THEN
    RAISE EXCEPTION 'Invalid player token';
  END IF;

  v_body := trim(both FROM coalesce(p_body, ''));
  IF char_length(v_body) < 1 THEN
    RAISE EXCEPTION 'Please write an answer';
  END IF;
  IF char_length(v_body) > 160 THEN
    RAISE EXCEPTION 'Keep your answer under 160 characters';
  END IF;

  SELECT * INTO v_player
  FROM public.exit_ticket_players
  WHERE token = p_token
  ORDER BY joined_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  SELECT * INTO v_session
  FROM public.exit_ticket_sessions
  WHERE id = v_player.session_id;

  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Submissions are not open yet';
  END IF;

  v_count := jsonb_array_length(COALESCE(v_session.prompts_json, '[]'::jsonb));
  IF p_prompt_index IS NULL OR p_prompt_index < 0 OR p_prompt_index >= v_count THEN
    RAISE EXCEPTION 'Invalid prompt';
  END IF;

  IF public.exit_ticket_text_is_blocked(v_body) THEN
    -- Store as blocked for teacher visibility; tell pupil to rewrite
    INSERT INTO public.exit_ticket_responses (session_id, player_id, prompt_index, body, status)
    VALUES (v_session.id, v_player.id, p_prompt_index, v_body, 'blocked')
    ON CONFLICT (session_id, player_id, prompt_index)
    DO UPDATE SET body = EXCLUDED.body, status = 'blocked', updated_at = NOW()
    RETURNING * INTO v_existing;

    RETURN jsonb_build_object(
      'ok', false,
      'blocked', true,
      'status', 'blocked',
      'message', 'Please rewrite your answer using respectful language.'
    );
  END IF;

  SELECT * INTO v_existing
  FROM public.exit_ticket_responses
  WHERE session_id = v_session.id
    AND player_id = v_player.id
    AND prompt_index = p_prompt_index;

  IF FOUND AND v_existing.status IN ('pending', 'approved', 'hidden') THEN
    -- Allow rewrite only if blocked previously; otherwise already submitted
    IF v_existing.status <> 'blocked' THEN
      RETURN jsonb_build_object(
        'ok', true,
        'already', true,
        'status', v_existing.status,
        'body', v_existing.body
      );
    END IF;
  END IF;

  INSERT INTO public.exit_ticket_responses (session_id, player_id, prompt_index, body, status)
  VALUES (v_session.id, v_player.id, p_prompt_index, v_body, v_status)
  ON CONFLICT (session_id, player_id, prompt_index)
  DO UPDATE SET body = EXCLUDED.body, status = 'pending', updated_at = NOW()
  RETURNING * INTO v_existing;

  RETURN jsonb_build_object(
    'ok', true,
    'already', false,
    'blocked', false,
    'status', v_existing.status,
    'body', v_existing.body
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.exit_list_host_state(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.exit_ticket_sessions%ROWTYPE;
  v_players jsonb;
  v_responses jsonb;
BEGIN
  SELECT * INTO v_session FROM public.exit_ticket_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF auth.uid() IS NULL OR auth.uid() <> v_session.host_id THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'nickname', p.nickname,
    'joined_at', p.joined_at
  ) ORDER BY p.joined_at ASC), '[]'::jsonb)
  INTO v_players
  FROM public.exit_ticket_players p
  WHERE p.session_id = p_session_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'player_id', r.player_id,
    'nickname', pl.nickname,
    'prompt_index', r.prompt_index,
    'body', r.body,
    'status', r.status,
    'created_at', r.created_at
  ) ORDER BY r.created_at DESC), '[]'::jsonb)
  INTO v_responses
  FROM public.exit_ticket_responses r
  JOIN public.exit_ticket_players pl ON pl.id = r.player_id
  WHERE r.session_id = p_session_id;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'title', v_session.title,
    'status', v_session.status,
    'pin', v_session.pin,
    'show_nicknames', v_session.show_nicknames,
    'prompts', v_session.prompts_json,
    'player_count', jsonb_array_length(v_players),
    'players', v_players,
    'responses', v_responses
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.exit_set_response_status(p_response_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resp public.exit_ticket_responses%ROWTYPE;
  v_host uuid;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('pending', 'approved', 'hidden', 'blocked') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT r.* INTO v_resp
  FROM public.exit_ticket_responses r
  WHERE r.id = p_response_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Response not found';
  END IF;

  SELECT host_id INTO v_host FROM public.exit_ticket_sessions WHERE id = v_resp.session_id;
  IF auth.uid() IS NULL OR auth.uid() <> v_host THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.exit_ticket_responses
  SET status = p_status, updated_at = NOW()
  WHERE id = p_response_id
  RETURNING * INTO v_resp;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_resp.id,
    'status', v_resp.status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.exit_approve_all_clean(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host uuid;
  v_n int;
BEGIN
  SELECT host_id INTO v_host FROM public.exit_ticket_sessions WHERE id = p_session_id;
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF auth.uid() IS NULL OR auth.uid() <> v_host THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.exit_ticket_responses
  SET status = 'approved', updated_at = NOW()
  WHERE session_id = p_session_id AND status = 'pending';

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'approved', v_n);
END;
$$;

GRANT EXECUTE ON FUNCTION public.exit_ticket_text_is_blocked(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exit_join_session(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exit_get_session_state(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exit_submit_response(text, int, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exit_list_host_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exit_set_response_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exit_approve_all_clean(uuid) TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.exit_ticket_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.exit_ticket_responses;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
