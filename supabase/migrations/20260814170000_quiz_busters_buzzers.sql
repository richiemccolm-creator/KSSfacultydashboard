-- Quiz Busters: iPad team buzzers with server-side first-press lock.
-- Pupils join anonymously via PIN/QR; the teacher hosts while signed in.

CREATE TABLE IF NOT EXISTS public.quiz_busters_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Quiz Busters',
  status TEXT NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle', 'armed', 'locked', 'closed')),
  buzz_team TEXT CHECK (buzz_team IS NULL OR buzz_team IN ('blue', 'amber')),
  buzz_player_id UUID,
  buzz_at TIMESTAMPTZ,
  letter_index INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quiz_busters_sessions_pin_format CHECK (pin ~ '^[0-9]{6}$'),
  CONSTRAINT quiz_busters_sessions_title_len CHECK (char_length(trim(title)) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX IF NOT EXISTS quiz_busters_sessions_open_pin_uidx
  ON public.quiz_busters_sessions (pin)
  WHERE status IN ('idle', 'armed', 'locked');

CREATE INDEX IF NOT EXISTS quiz_busters_sessions_host_idx
  ON public.quiz_busters_sessions (host_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.quiz_busters_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.quiz_busters_sessions(id) ON DELETE CASCADE,
  team TEXT NOT NULL CHECK (team IN ('blue', 'amber')),
  token TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quiz_busters_players_token_len CHECK (char_length(token) >= 16)
);

CREATE UNIQUE INDEX IF NOT EXISTS quiz_busters_players_session_token_uidx
  ON public.quiz_busters_players (session_id, token);

CREATE INDEX IF NOT EXISTS quiz_busters_players_session_team_idx
  ON public.quiz_busters_players (session_id, team);

ALTER TABLE public.quiz_busters_sessions
  DROP CONSTRAINT IF EXISTS quiz_busters_sessions_buzz_player_fk;
ALTER TABLE public.quiz_busters_sessions
  ADD CONSTRAINT quiz_busters_sessions_buzz_player_fk
  FOREIGN KEY (buzz_player_id) REFERENCES public.quiz_busters_players(id) ON DELETE SET NULL;

ALTER TABLE public.quiz_busters_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_busters_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts manage own quiz busters sessions" ON public.quiz_busters_sessions;
CREATE POLICY "Hosts manage own quiz busters sessions"
  ON public.quiz_busters_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts read quiz busters players" ON public.quiz_busters_players;
CREATE POLICY "Hosts read quiz busters players"
  ON public.quiz_busters_players
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_busters_sessions s
      WHERE s.id = session_id AND s.host_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_busters_sessions TO authenticated;
GRANT SELECT ON public.quiz_busters_players TO authenticated;

DROP TRIGGER IF EXISTS quiz_busters_sessions_updated_at ON public.quiz_busters_sessions;
CREATE TRIGGER quiz_busters_sessions_updated_at
  BEFORE UPDATE ON public.quiz_busters_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.qb_join_session(p_pin text, p_team text, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.quiz_busters_sessions%ROWTYPE;
  v_player public.quiz_busters_players%ROWTYPE;
  v_team text;
BEGIN
  v_team := lower(trim(both FROM coalesce(p_team, '')));
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid game PIN';
  END IF;
  IF v_team NOT IN ('blue', 'amber') THEN
    RAISE EXCEPTION 'Choose Blue or Amber';
  END IF;
  IF p_token IS NULL OR char_length(p_token) < 16 THEN
    RAISE EXCEPTION 'Invalid player token';
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
    SET team = v_team
    WHERE id = v_player.id
    RETURNING * INTO v_player;
  ELSE
    INSERT INTO public.quiz_busters_players (session_id, team, token)
    VALUES (v_session.id, v_team, p_token)
    RETURNING * INTO v_player;
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'player_id', v_player.id,
    'team', v_player.team,
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

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'title', v_session.title,
    'status', v_session.status,
    'team', v_player.team,
    'buzz_team', v_session.buzz_team,
    'you_won', (v_session.buzz_team IS NOT NULL AND v_session.buzz_team = v_player.team)
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
      'buzz_team', v_updated.buzz_team,
      'status', v_updated.status
    );
  END IF;

  SELECT * INTO v_session
  FROM public.quiz_busters_sessions
  WHERE id = v_player.session_id;

  RETURN jsonb_build_object(
    'ok', true,
    'won', (v_session.buzz_team = v_player.team),
    'buzz_team', v_session.buzz_team,
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

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'pin', v_session.pin,
    'status', v_session.status,
    'buzz_team', v_session.buzz_team,
    'buzz_at', v_session.buzz_at,
    'letter_index', v_session.letter_index,
    'blue_count', v_blue,
    'amber_count', v_amber
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qb_join_session(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qb_get_session_state(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qb_buzz(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qb_list_host_state(uuid) TO authenticated;
