-- Quiz Busters: every pupil can join with a name so the host sees who buzzed.

ALTER TABLE public.quiz_busters_players
  ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';

ALTER TABLE public.quiz_busters_players
  DROP CONSTRAINT IF EXISTS quiz_busters_players_name_len;
ALTER TABLE public.quiz_busters_players
  ADD CONSTRAINT quiz_busters_players_name_len
  CHECK (display_name = '' OR char_length(btrim(display_name)) BETWEEN 1 AND 32);

DROP FUNCTION IF EXISTS public.qb_join_session(text, text, text);

CREATE OR REPLACE FUNCTION public.qb_join_session(p_pin text, p_team text, p_token text, p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.quiz_busters_sessions%ROWTYPE;
  v_player public.quiz_busters_players%ROWTYPE;
  v_team text;
  v_name text;
BEGIN
  v_team := lower(trim(both FROM coalesce(p_team, '')));
  v_name := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid game PIN';
  END IF;
  IF v_team NOT IN ('blue', 'amber') THEN
    RAISE EXCEPTION 'Choose Blue or Amber';
  END IF;
  IF p_token IS NULL OR char_length(p_token) < 16 THEN
    RAISE EXCEPTION 'Invalid player token';
  END IF;
  IF char_length(v_name) < 1 THEN
    RAISE EXCEPTION 'Enter your name';
  END IF;
  IF char_length(v_name) > 32 THEN
    v_name := left(v_name, 32);
  END IF;

  SELECT * INTO v_session
  FROM public.quiz_busters_sessions
  WHERE pin = p_pin AND status IN ('idle', 'armed', 'locked')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No live Quiz Busters game for that PIN';
  END IF;

  SELECT * INTO v_player
  FROM public.quiz_busters_players
  WHERE session_id = v_session.id AND token = p_token;

  IF FOUND THEN
    UPDATE public.quiz_busters_players
    SET team = v_team, display_name = v_name
    WHERE id = v_player.id
    RETURNING * INTO v_player;
  ELSE
    INSERT INTO public.quiz_busters_players (session_id, team, token, display_name)
    VALUES (v_session.id, v_team, p_token, v_name)
    RETURNING * INTO v_player;
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'player_id', v_player.id,
    'team', v_player.team,
    'name', v_player.display_name,
    'token', v_player.token,
    'status', v_session.status,
    'buzz_team', v_session.buzz_team,
    'title', v_session.title
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.qb_get_session_state(p_pin text, p_token text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.quiz_busters_sessions%ROWTYPE;
  v_player public.quiz_busters_players%ROWTYPE;
  v_buzz_name text;
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid game PIN';
  END IF;

  SELECT * INTO v_session
  FROM public.quiz_busters_sessions
  WHERE pin = p_pin AND status <> 'closed'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  IF p_token IS NOT NULL AND char_length(p_token) >= 16 THEN
    SELECT * INTO v_player
    FROM public.quiz_busters_players
    WHERE session_id = v_session.id AND token = p_token;
  END IF;

  IF v_session.buzz_player_id IS NOT NULL THEN
    SELECT NULLIF(btrim(display_name), '') INTO v_buzz_name
    FROM public.quiz_busters_players
    WHERE id = v_session.buzz_player_id;
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'title', v_session.title,
    'status', v_session.status,
    'team', v_player.team,
    'name', NULLIF(btrim(v_player.display_name), ''),
    'buzz_team', v_session.buzz_team,
    'buzz_player_name', v_buzz_name,
    'you_won', (v_session.buzz_team IS NOT NULL AND v_session.buzz_team = v_player.team),
    'you_buzzed', (v_session.buzz_player_id IS NOT NULL AND v_session.buzz_player_id = v_player.id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.qb_buzz(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player public.quiz_busters_players%ROWTYPE;
  v_session public.quiz_busters_sessions%ROWTYPE;
  v_updated public.quiz_busters_sessions%ROWTYPE;
  v_buzz_name text;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 16 THEN
    RAISE EXCEPTION 'Invalid player token';
  END IF;

  SELECT p.* INTO v_player
  FROM public.quiz_busters_players p
  JOIN public.quiz_busters_sessions s ON s.id = p.session_id
  WHERE p.token = p_token AND s.status <> 'closed'
  ORDER BY p.joined_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Buzzer not joined';
  END IF;

  SELECT * INTO v_session
  FROM public.quiz_busters_sessions
  WHERE id = v_player.session_id;

  IF v_session.status = 'closed' THEN
    RAISE EXCEPTION 'This game has ended';
  END IF;

  UPDATE public.quiz_busters_sessions
  SET
    buzz_team = v_player.team,
    buzz_player_id = v_player.id,
    buzz_at = NOW(),
    status = 'locked'
  WHERE id = v_session.id
    AND status = 'armed'
    AND buzz_team IS NULL
  RETURNING * INTO v_updated;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'won', true,
      'you_buzzed', true,
      'buzz_team', v_updated.buzz_team,
      'buzz_player_name', NULLIF(btrim(v_player.display_name), ''),
      'status', v_updated.status
    );
  END IF;

  SELECT * INTO v_session
  FROM public.quiz_busters_sessions
  WHERE id = v_player.session_id;

  IF v_session.buzz_player_id IS NOT NULL THEN
    SELECT NULLIF(btrim(display_name), '') INTO v_buzz_name
    FROM public.quiz_busters_players
    WHERE id = v_session.buzz_player_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'won', (v_session.buzz_team = v_player.team),
    'you_buzzed', (v_session.buzz_player_id = v_player.id),
    'buzz_team', v_session.buzz_team,
    'buzz_player_name', v_buzz_name,
    'status', v_session.status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.qb_list_host_state(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.quiz_busters_sessions%ROWTYPE;
  v_blue int := 0;
  v_amber int := 0;
  v_buzz_name text;
BEGIN
  SELECT * INTO v_session FROM public.quiz_busters_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF auth.uid() IS NULL OR auth.uid() <> v_session.host_id THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT count(*)::int INTO v_blue
  FROM public.quiz_busters_players
  WHERE session_id = p_session_id AND team = 'blue';

  SELECT count(*)::int INTO v_amber
  FROM public.quiz_busters_players
  WHERE session_id = p_session_id AND team = 'amber';

  IF v_session.buzz_player_id IS NOT NULL THEN
    SELECT NULLIF(btrim(display_name), '') INTO v_buzz_name
    FROM public.quiz_busters_players
    WHERE id = v_session.buzz_player_id;
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'pin', v_session.pin,
    'status', v_session.status,
    'buzz_team', v_session.buzz_team,
    'buzz_player_id', v_session.buzz_player_id,
    'buzz_player_name', v_buzz_name,
    'buzz_at', v_session.buzz_at,
    'letter_index', v_session.letter_index,
    'blue_count', v_blue,
    'amber_count', v_amber,
    'players', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'team', p.team,
          'name', coalesce(NULLIF(btrim(p.display_name), ''), 'Player')
        ) ORDER BY p.joined_at
      ), '[]'::jsonb)
      FROM public.quiz_busters_players p
      WHERE p.session_id = p_session_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qb_join_session(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qb_get_session_state(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qb_buzz(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qb_list_host_state(uuid) TO authenticated;
