-- Quiz live: teacher-facilitated vs self-paced modes + richer player progress

ALTER TABLE public.quiz_live_sessions
  ADD COLUMN IF NOT EXISTS play_mode TEXT NOT NULL DEFAULT 'facilitated';

ALTER TABLE public.quiz_live_sessions
  DROP CONSTRAINT IF EXISTS quiz_live_sessions_play_mode_check;

ALTER TABLE public.quiz_live_sessions
  ADD CONSTRAINT quiz_live_sessions_play_mode_check
  CHECK (play_mode IN ('facilitated', 'self_paced'));

-- Allow self-paced active status
ALTER TABLE public.quiz_live_sessions
  DROP CONSTRAINT IF EXISTS quiz_live_sessions_status_check;

ALTER TABLE public.quiz_live_sessions
  ADD CONSTRAINT quiz_live_sessions_status_check
  CHECK (status IN ('lobby', 'question', 'reveal', 'playing', 'end', 'closed'));

DROP INDEX IF EXISTS quiz_live_sessions_open_pin_uidx;
CREATE UNIQUE INDEX quiz_live_sessions_open_pin_uidx
  ON public.quiz_live_sessions (pin)
  WHERE status IN ('lobby', 'question', 'reveal', 'playing');

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
  WHERE pin = p_pin AND status IN ('lobby', 'question', 'reveal', 'playing')
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
    'play_mode', v_session.play_mode,
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
  v_questions jsonb := '[]'::jsonb;
  v_answered_idx jsonb := '[]'::jsonb;
  v_qcount int := 0;
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

  v_qcount := jsonb_array_length(COALESCE(v_session.quiz_json -> 'questions', '[]'::jsonb));

  IF p_token IS NOT NULL AND char_length(p_token) >= 16 THEN
    SELECT * INTO v_player
    FROM public.quiz_live_players
    WHERE session_id = v_session.id AND token = p_token;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nickname', p.nickname,
    'score', p.score,
    'answered', p.answered
  ) ORDER BY p.score DESC, p.joined_at ASC), '[]'::jsonb)
  INTO v_leaders
  FROM (
    SELECT
      pl.nickname,
      pl.score,
      pl.joined_at,
      (
        SELECT count(*)::int FROM public.quiz_live_answers a
        WHERE a.player_id = pl.id
      ) AS answered
    FROM public.quiz_live_players pl
    WHERE pl.session_id = v_session.id
    ORDER BY pl.score DESC, pl.joined_at ASC
    LIMIT 12
  ) p;

  -- Self-paced: send question bank (no correct answers) + which ones this pupil finished
  IF v_session.play_mode = 'self_paced' AND v_session.status IN ('playing', 'end') THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'prompt', q ->> 'prompt',
        'options', COALESCE(q -> 'options', '[]'::jsonb),
        'timeLimit', COALESCE((q ->> 'timeLimit')::int, 20)
      )
      ORDER BY ord
    ), '[]'::jsonb)
    INTO v_questions
    FROM jsonb_array_elements(COALESCE(v_session.quiz_json -> 'questions', '[]'::jsonb))
      WITH ORDINALITY AS t(q, ord);

    IF v_player.id IS NOT NULL THEN
      SELECT COALESCE(jsonb_agg(a.question_index ORDER BY a.question_index), '[]'::jsonb)
      INTO v_answered_idx
      FROM public.quiz_live_answers a
      WHERE a.session_id = v_session.id AND a.player_id = v_player.id;
    END IF;

    RETURN jsonb_build_object(
      'session_id', v_session.id,
      'title', v_session.title,
      'status', v_session.status,
      'play_mode', v_session.play_mode,
      'question_index', v_session.question_index,
      'question_count', v_qcount,
      'questions', v_questions,
      'answered_indexes', v_answered_idx,
      'player_score', COALESCE(v_player.score, 0),
      'nickname', v_player.nickname,
      'leaders', v_leaders
    );
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

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'title', v_session.title,
    'status', v_session.status,
    'play_mode', COALESCE(v_session.play_mode, 'facilitated'),
    'question_index', v_session.question_index,
    'question_count', v_qcount,
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
  v_qcount int;
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

  v_qcount := jsonb_array_length(COALESCE(v_session.quiz_json -> 'questions', '[]'::jsonb));
  IF p_question_index IS NULL OR p_question_index < 0 OR p_question_index >= v_qcount THEN
    RAISE EXCEPTION 'Invalid question';
  END IF;

  IF COALESCE(v_session.play_mode, 'facilitated') = 'self_paced' THEN
    IF v_session.status <> 'playing' THEN
      RAISE EXCEPTION 'Answers are locked right now';
    END IF;
  ELSE
    IF v_session.status <> 'question' THEN
      RAISE EXCEPTION 'Answers are locked right now';
    END IF;
    IF p_question_index IS DISTINCT FROM v_session.question_index THEN
      RAISE EXCEPTION 'That question is not active';
    END IF;
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

  v_is_correct := (p_choice = v_correct_idx);

  IF COALESCE(v_session.play_mode, 'facilitated') = 'self_paced' THEN
    v_points := CASE WHEN v_is_correct THEN 1000 ELSE 0 END;
  ELSE
    v_limit := COALESCE((v_q ->> 'timeLimit')::numeric, 20);
    v_elapsed := EXTRACT(EPOCH FROM (NOW() - COALESCE(v_session.question_started_at, NOW())));
    IF v_elapsed > (v_limit + 2) THEN
      RAISE EXCEPTION 'Time is up';
    END IF;
    IF v_is_correct THEN
      v_points := GREATEST(100, FLOOR(1000 * GREATEST(0, 1 - (v_elapsed / NULLIF(v_limit, 0)))))::int;
    ELSE
      v_points := 0;
    END IF;
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
  v_qcount int;
BEGIN
  SELECT host_id,
         jsonb_array_length(COALESCE(quiz_json -> 'questions', '[]'::jsonb))
  INTO v_host, v_qcount
  FROM public.quiz_live_sessions
  WHERE id = p_session_id;

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
    'answered', p.answered,
    'question_count', v_qcount,
    'joined_at', p.joined_at
  ) ORDER BY p.score DESC, p.joined_at ASC), '[]'::jsonb)
  INTO v_out
  FROM (
    SELECT
      pl.id,
      pl.nickname,
      pl.score,
      pl.joined_at,
      (
        SELECT count(*)::int FROM public.quiz_live_answers a
        WHERE a.player_id = pl.id
      ) AS answered
    FROM public.quiz_live_players pl
    WHERE pl.session_id = p_session_id
  ) p;

  RETURN v_out;
END;
$$;
