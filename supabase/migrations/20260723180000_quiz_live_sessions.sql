-- Classroom Toolkit Quiz Builder Phase 2: live sessions for QR / phone play
-- Pupils join anonymously via PIN; teachers host while signed in.

CREATE TABLE IF NOT EXISTS public.quiz_live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Quiz',
  quiz_json JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby', 'question', 'reveal', 'end', 'closed')),
  question_index INT NOT NULL DEFAULT 0,
  question_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quiz_live_sessions_pin_format CHECK (pin ~ '^[0-9]{6}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS quiz_live_sessions_open_pin_uidx
  ON public.quiz_live_sessions (pin)
  WHERE status IN ('lobby', 'question', 'reveal');

CREATE INDEX IF NOT EXISTS quiz_live_sessions_host_idx
  ON public.quiz_live_sessions (host_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.quiz_live_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.quiz_live_sessions(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  token TEXT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quiz_live_players_nickname_len CHECK (char_length(trim(nickname)) BETWEEN 1 AND 24),
  CONSTRAINT quiz_live_players_token_len CHECK (char_length(token) >= 16)
);

CREATE UNIQUE INDEX IF NOT EXISTS quiz_live_players_session_token_uidx
  ON public.quiz_live_players (session_id, token);

CREATE UNIQUE INDEX IF NOT EXISTS quiz_live_players_session_nick_uidx
  ON public.quiz_live_players (session_id, lower(trim(nickname)));

CREATE INDEX IF NOT EXISTS quiz_live_players_session_score_idx
  ON public.quiz_live_players (session_id, score DESC);

CREATE TABLE IF NOT EXISTS public.quiz_live_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.quiz_live_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.quiz_live_players(id) ON DELETE CASCADE,
  question_index INT NOT NULL,
  choice INT NOT NULL,
  correct BOOLEAN NOT NULL DEFAULT false,
  points INT NOT NULL DEFAULT 0,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, player_id, question_index)
);

CREATE INDEX IF NOT EXISTS quiz_live_answers_session_q_idx
  ON public.quiz_live_answers (session_id, question_index);

ALTER TABLE public.quiz_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_live_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_live_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts manage own quiz sessions" ON public.quiz_live_sessions;
CREATE POLICY "Hosts manage own quiz sessions"
  ON public.quiz_live_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts read players in own sessions" ON public.quiz_live_players;
CREATE POLICY "Hosts read players in own sessions"
  ON public.quiz_live_players
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_live_sessions s
      WHERE s.id = session_id AND s.host_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Hosts read answers in own sessions" ON public.quiz_live_answers;
CREATE POLICY "Hosts read answers in own sessions"
  ON public.quiz_live_answers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_live_sessions s
      WHERE s.id = session_id AND s.host_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_live_sessions TO authenticated;
GRANT SELECT ON public.quiz_live_players TO authenticated;
GRANT SELECT ON public.quiz_live_answers TO authenticated;

DROP TRIGGER IF EXISTS quiz_live_sessions_updated_at ON public.quiz_live_sessions;
CREATE TRIGGER quiz_live_sessions_updated_at
  BEFORE UPDATE ON public.quiz_live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Public join by PIN (anon + authenticated)
CREATE OR REPLACE FUNCTION public.quiz_join_session(p_pin text, p_nickname text, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.quiz_live_sessions%ROWTYPE;
  v_player public.quiz_live_players%ROWTYPE;
  v_nick text;
BEGIN
  v_nick := trim(both FROM coalesce(p_nickname, ''));
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid game PIN';
  END IF;
  IF char_length(v_nick) < 1 OR char_length(v_nick) > 24 THEN
    RAISE EXCEPTION 'Nickname must be 1–24 characters';
  END IF;
  IF p_token IS NULL OR char_length(p_token) < 16 THEN
    RAISE EXCEPTION 'Invalid player token';
  END IF;

  SELECT * INTO v_session
  FROM public.quiz_live_sessions
  WHERE pin = p_pin AND status IN ('lobby', 'question', 'reveal')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No live game found for that PIN';
  END IF;

  SELECT * INTO v_player
  FROM public.quiz_live_players
  WHERE session_id = v_session.id AND token = p_token;

  IF FOUND THEN
    UPDATE public.quiz_live_players
    SET nickname = v_nick
    WHERE id = v_player.id
    RETURNING * INTO v_player;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.quiz_live_players
      WHERE session_id = v_session.id AND lower(trim(nickname)) = lower(v_nick)
    ) THEN
      RAISE EXCEPTION 'That nickname is already taken';
    END IF;

    INSERT INTO public.quiz_live_players (session_id, nickname, token)
    VALUES (v_session.id, v_nick, p_token)
    RETURNING * INTO v_player;
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'player_id', v_player.id,
    'nickname', v_player.nickname,
    'token', v_player.token,
    'score', v_player.score,
    'status', v_session.status,
    'question_index', v_session.question_index,
    'title', v_session.title
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.quiz_get_session_state(p_pin text, p_token text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.quiz_live_sessions%ROWTYPE;
  v_player public.quiz_live_players%ROWTYPE;
  v_q jsonb;
  v_opts jsonb;
  v_answered boolean := false;
  v_choice int;
  v_leaders jsonb;
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid game PIN';
  END IF;

  SELECT * INTO v_session
  FROM public.quiz_live_sessions
  WHERE pin = p_pin AND status <> 'closed'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  IF p_token IS NOT NULL AND char_length(p_token) >= 16 THEN
    SELECT * INTO v_player
    FROM public.quiz_live_players
    WHERE session_id = v_session.id AND token = p_token;
  END IF;

  v_q := COALESCE(v_session.quiz_json -> 'questions' -> v_session.question_index, '{}'::jsonb);
  v_opts := COALESCE(v_q -> 'options', '[]'::jsonb);

  IF v_player.id IS NOT NULL THEN
    SELECT true, a.choice INTO v_answered, v_choice
    FROM public.quiz_live_answers a
    WHERE a.session_id = v_session.id
      AND a.player_id = v_player.id
      AND a.question_index = v_session.question_index;
    IF NOT FOUND THEN
      v_answered := false;
      v_choice := NULL;
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nickname', p.nickname,
    'score', p.score
  ) ORDER BY p.score DESC, p.joined_at ASC), '[]'::jsonb)
  INTO v_leaders
  FROM (
    SELECT nickname, score, joined_at
    FROM public.quiz_live_players
    WHERE session_id = v_session.id
    ORDER BY score DESC, joined_at ASC
    LIMIT 10
  ) p;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'title', v_session.title,
    'status', v_session.status,
    'question_index', v_session.question_index,
    'question_count', jsonb_array_length(COALESCE(v_session.quiz_json -> 'questions', '[]'::jsonb)),
    'question_started_at', v_session.question_started_at,
    'prompt', CASE
      WHEN v_session.status IN ('question', 'reveal') THEN COALESCE(v_q ->> 'prompt', '')
      ELSE NULL
    END,
    'options', CASE
      WHEN v_session.status IN ('question', 'reveal') THEN v_opts
      ELSE '[]'::jsonb
    END,
    'correct', CASE
      WHEN v_session.status IN ('reveal', 'end') THEN (v_q ->> 'correct')::int
      ELSE NULL
    END,
    'time_limit', COALESCE((v_q ->> 'timeLimit')::int, 20),
    'answered', v_answered,
    'choice', v_choice,
    'player_score', COALESCE(v_player.score, 0),
    'nickname', v_player.nickname,
    'leaders', v_leaders
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.quiz_submit_answer(p_token text, p_question_index int, p_choice int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player public.quiz_live_players%ROWTYPE;
  v_session public.quiz_live_sessions%ROWTYPE;
  v_q jsonb;
  v_correct_idx int;
  v_is_correct boolean;
  v_points int := 0;
  v_elapsed numeric;
  v_limit numeric;
  v_existing public.quiz_live_answers%ROWTYPE;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 16 THEN
    RAISE EXCEPTION 'Invalid player token';
  END IF;

  SELECT * INTO v_player
  FROM public.quiz_live_players
  WHERE token = p_token
  ORDER BY joined_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  SELECT * INTO v_session
  FROM public.quiz_live_sessions
  WHERE id = v_player.session_id;

  IF v_session.status <> 'question' THEN
    RAISE EXCEPTION 'Answers are locked right now';
  END IF;

  IF p_question_index IS DISTINCT FROM v_session.question_index THEN
    RAISE EXCEPTION 'That question is not active';
  END IF;

  SELECT * INTO v_existing
  FROM public.quiz_live_answers
  WHERE session_id = v_session.id
    AND player_id = v_player.id
    AND question_index = p_question_index;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already', true,
      'choice', v_existing.choice,
      'correct', v_existing.correct,
      'points', v_existing.points,
      'score', v_player.score
    );
  END IF;

  v_q := v_session.quiz_json -> 'questions' -> p_question_index;
  IF v_q IS NULL OR v_q = 'null'::jsonb THEN
    RAISE EXCEPTION 'Question missing';
  END IF;

  v_correct_idx := COALESCE((v_q ->> 'correct')::int, 0);
  IF p_choice IS NULL OR p_choice < 0 OR p_choice > 3 THEN
    RAISE EXCEPTION 'Invalid choice';
  END IF;

  v_limit := COALESCE((v_q ->> 'timeLimit')::numeric, 20);
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - COALESCE(v_session.question_started_at, NOW())));
  IF v_elapsed > (v_limit + 2) THEN
    RAISE EXCEPTION 'Time is up';
  END IF;

  v_is_correct := (p_choice = v_correct_idx);
  IF v_is_correct THEN
    v_points := GREATEST(100, FLOOR(1000 * GREATEST(0, 1 - (v_elapsed / NULLIF(v_limit, 0)))))::int;
  ELSE
    v_points := 0;
  END IF;

  INSERT INTO public.quiz_live_answers (session_id, player_id, question_index, choice, correct, points)
  VALUES (v_session.id, v_player.id, p_question_index, p_choice, v_is_correct, v_points);

  UPDATE public.quiz_live_players
  SET score = score + v_points
  WHERE id = v_player.id
  RETURNING * INTO v_player;

  RETURN jsonb_build_object(
    'ok', true,
    'already', false,
    'choice', p_choice,
    'correct', v_is_correct,
    'points', v_points,
    'score', v_player.score
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.quiz_list_players(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host uuid;
  v_out jsonb;
BEGIN
  SELECT host_id INTO v_host FROM public.quiz_live_sessions WHERE id = p_session_id;
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF auth.uid() IS NULL OR auth.uid() <> v_host THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'nickname', p.nickname,
    'score', p.score,
    'joined_at', p.joined_at
  ) ORDER BY p.score DESC, p.joined_at ASC), '[]'::jsonb)
  INTO v_out
  FROM public.quiz_live_players p
  WHERE p.session_id = p_session_id;

  RETURN v_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.quiz_join_session(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_get_session_state(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_submit_answer(text, int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quiz_list_players(uuid) TO authenticated;

-- Realtime (ignore errors if publication already has table)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_live_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_live_players;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
