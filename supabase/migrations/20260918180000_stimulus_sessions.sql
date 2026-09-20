-- Classroom Toolkit Stimulus Generator: live devising starting-points via QR/PIN
-- Pupils join anonymously (group name + token); teachers host while signed in.

CREATE TABLE IF NOT EXISTS public.stimulus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Stimulus Generator',
  status TEXT NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby', 'open', 'closed')),
  locks_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stimulus_sessions_pin_format CHECK (pin ~ '^[0-9]{6}$'),
  CONSTRAINT stimulus_sessions_title_len CHECK (char_length(trim(title)) BETWEEN 1 AND 80)
);

CREATE UNIQUE INDEX IF NOT EXISTS stimulus_sessions_open_pin_uidx
  ON public.stimulus_sessions (pin)
  WHERE status IN ('lobby', 'open');

CREATE INDEX IF NOT EXISTS stimulus_sessions_host_idx
  ON public.stimulus_sessions (host_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.stimulus_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.stimulus_sessions(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  token TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stimulus_players_nickname_len CHECK (char_length(trim(nickname)) BETWEEN 1 AND 24),
  CONSTRAINT stimulus_players_token_len CHECK (char_length(token) >= 16)
);

CREATE UNIQUE INDEX IF NOT EXISTS stimulus_players_session_token_uidx
  ON public.stimulus_players (session_id, token);

CREATE UNIQUE INDEX IF NOT EXISTS stimulus_players_session_nick_uidx
  ON public.stimulus_players (session_id, lower(trim(nickname)));

CREATE TABLE IF NOT EXISTS public.stimulus_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.stimulus_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.stimulus_players(id) ON DELETE CASCADE,
  choices_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  stimulus_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, player_id),
  CONSTRAINT stimulus_results_json_size CHECK (
    pg_column_size(choices_json) <= 4096 AND pg_column_size(stimulus_json) <= 16384
  )
);

CREATE INDEX IF NOT EXISTS stimulus_results_session_updated_idx
  ON public.stimulus_results (session_id, updated_at DESC);

ALTER TABLE public.stimulus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stimulus_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stimulus_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts manage own stimulus sessions" ON public.stimulus_sessions;
CREATE POLICY "Hosts manage own stimulus sessions"
  ON public.stimulus_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts read stimulus players" ON public.stimulus_players;
CREATE POLICY "Hosts read stimulus players"
  ON public.stimulus_players
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stimulus_sessions s
      WHERE s.id = session_id AND s.host_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Hosts read stimulus results" ON public.stimulus_results;
CREATE POLICY "Hosts read stimulus results"
  ON public.stimulus_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stimulus_sessions s
      WHERE s.id = session_id AND s.host_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stimulus_sessions TO authenticated;
GRANT SELECT ON public.stimulus_players TO authenticated;
GRANT SELECT ON public.stimulus_results TO authenticated;

DROP TRIGGER IF EXISTS stimulus_sessions_updated_at ON public.stimulus_sessions;
CREATE TRIGGER stimulus_sessions_updated_at
  BEFORE UPDATE ON public.stimulus_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS stimulus_results_updated_at ON public.stimulus_results;
CREATE TRIGGER stimulus_results_updated_at
  BEFORE UPDATE ON public.stimulus_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.stimulus_text_is_blocked(p_text text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN public.exit_ticket_text_is_blocked(p_text);
END;
$$;

CREATE OR REPLACE FUNCTION public.stimulus_join_session(p_pin text, p_nickname text, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.stimulus_sessions%ROWTYPE;
  v_player public.stimulus_players%ROWTYPE;
  v_nick text;
BEGIN
  v_nick := trim(both FROM coalesce(p_nickname, ''));
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid PIN';
  END IF;
  IF char_length(v_nick) < 1 OR char_length(v_nick) > 24 THEN
    RAISE EXCEPTION 'Group name must be 1–24 characters';
  END IF;
  IF public.stimulus_text_is_blocked(v_nick) THEN
    RAISE EXCEPTION 'Please choose a different group name';
  END IF;
  IF p_token IS NULL OR char_length(p_token) < 16 THEN
    RAISE EXCEPTION 'Invalid player token';
  END IF;

  SELECT * INTO v_session
  FROM public.stimulus_sessions
  WHERE pin = p_pin AND status IN ('lobby', 'open')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No live stimulus session found for that PIN';
  END IF;

  SELECT * INTO v_player
  FROM public.stimulus_players
  WHERE session_id = v_session.id AND token = p_token;

  IF FOUND THEN
    UPDATE public.stimulus_players
    SET nickname = v_nick
    WHERE id = v_player.id
    RETURNING * INTO v_player;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.stimulus_players
      WHERE session_id = v_session.id AND lower(trim(nickname)) = lower(v_nick)
    ) THEN
      RAISE EXCEPTION 'That group name is already taken';
    END IF;

    INSERT INTO public.stimulus_players (session_id, nickname, token)
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
    'locks', COALESCE(v_session.locks_json, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.stimulus_get_session_state(p_pin text, p_token text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.stimulus_sessions%ROWTYPE;
  v_player public.stimulus_players%ROWTYPE;
  v_result public.stimulus_results%ROWTYPE;
  v_player_count int := 0;
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid PIN';
  END IF;

  SELECT * INTO v_session
  FROM public.stimulus_sessions
  WHERE pin = p_pin AND status <> 'closed'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF p_token IS NOT NULL AND char_length(p_token) >= 16 THEN
    SELECT * INTO v_player
    FROM public.stimulus_players
    WHERE session_id = v_session.id AND token = p_token;
  END IF;

  SELECT count(*)::int INTO v_player_count
  FROM public.stimulus_players
  WHERE session_id = v_session.id;

  IF v_player.id IS NOT NULL THEN
    SELECT * INTO v_result
    FROM public.stimulus_results
    WHERE session_id = v_session.id AND player_id = v_player.id;
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'title', v_session.title,
    'status', v_session.status,
    'locks', COALESCE(v_session.locks_json, '{}'::jsonb),
    'player_count', v_player_count,
    'nickname', v_player.nickname,
    'my_result', CASE
      WHEN v_result.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'choices', v_result.choices_json,
        'stimulus', v_result.stimulus_json,
        'updated_at', v_result.updated_at
      )
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.stimulus_submit_result(p_token text, p_choices jsonb, p_stimulus jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player public.stimulus_players%ROWTYPE;
  v_session public.stimulus_sessions%ROWTYPE;
  v_row public.stimulus_results%ROWTYPE;
  v_title text;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 16 THEN
    RAISE EXCEPTION 'Invalid player token';
  END IF;
  IF p_stimulus IS NULL OR jsonb_typeof(p_stimulus) <> 'object' THEN
    RAISE EXCEPTION 'Stimulus is required';
  END IF;
  IF pg_column_size(coalesce(p_choices, '{}'::jsonb)) > 4096 THEN
    RAISE EXCEPTION 'Choices payload is too large';
  END IF;
  IF pg_column_size(p_stimulus) > 16384 THEN
    RAISE EXCEPTION 'Stimulus payload is too large';
  END IF;

  v_title := trim(both FROM coalesce(p_stimulus->>'title', ''));
  IF char_length(v_title) < 1 THEN
    RAISE EXCEPTION 'Stimulus needs a title';
  END IF;
  IF public.stimulus_text_is_blocked(v_title)
     OR public.stimulus_text_is_blocked(coalesce(p_stimulus->>'scenario', '')) THEN
    RAISE EXCEPTION 'Please generate again — that wording is not allowed';
  END IF;

  SELECT * INTO v_player
  FROM public.stimulus_players
  WHERE token = p_token
  ORDER BY joined_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  SELECT * INTO v_session
  FROM public.stimulus_sessions
  WHERE id = v_player.session_id;

  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Generating is not open yet';
  END IF;

  INSERT INTO public.stimulus_results (session_id, player_id, choices_json, stimulus_json)
  VALUES (v_session.id, v_player.id, coalesce(p_choices, '{}'::jsonb), p_stimulus)
  ON CONFLICT (session_id, player_id)
  DO UPDATE SET
    choices_json = EXCLUDED.choices_json,
    stimulus_json = EXCLUDED.stimulus_json,
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'updated_at', v_row.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.stimulus_list_host_state(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.stimulus_sessions%ROWTYPE;
  v_players jsonb;
  v_results jsonb;
BEGIN
  SELECT * INTO v_session FROM public.stimulus_sessions WHERE id = p_session_id;
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
  FROM public.stimulus_players p
  WHERE p.session_id = p_session_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'player_id', r.player_id,
    'nickname', pl.nickname,
    'choices', r.choices_json,
    'stimulus', r.stimulus_json,
    'updated_at', r.updated_at
  ) ORDER BY r.updated_at DESC), '[]'::jsonb)
  INTO v_results
  FROM public.stimulus_results r
  JOIN public.stimulus_players pl ON pl.id = r.player_id
  WHERE r.session_id = p_session_id;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'title', v_session.title,
    'status', v_session.status,
    'pin', v_session.pin,
    'locks', COALESCE(v_session.locks_json, '{}'::jsonb),
    'player_count', jsonb_array_length(v_players),
    'players', v_players,
    'results', v_results
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.stimulus_text_is_blocked(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stimulus_join_session(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stimulus_get_session_state(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stimulus_submit_result(text, jsonb, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stimulus_list_host_state(uuid) TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stimulus_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stimulus_results;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
