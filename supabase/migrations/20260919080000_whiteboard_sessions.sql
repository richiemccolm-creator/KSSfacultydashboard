-- Classroom Toolkit Mini Whiteboards: live pupil boards via QR/PIN
-- Pupils join with a name + token; teachers host while signed in.

CREATE TABLE IF NOT EXISTS public.whiteboard_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Mini Whiteboards',
  prompt TEXT NOT NULL DEFAULT 'Show me your thinking',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('lobby', 'open', 'closed')),
  anonymous BOOLEAN NOT NULL DEFAULT false,
  locked BOOLEAN NOT NULL DEFAULT false,
  round INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whiteboard_sessions_pin_format CHECK (pin ~ '^[0-9]{6}$'),
  CONSTRAINT whiteboard_sessions_prompt_len CHECK (char_length(trim(prompt)) BETWEEN 1 AND 160),
  CONSTRAINT whiteboard_sessions_title_len CHECK (char_length(trim(title)) BETWEEN 1 AND 80),
  CONSTRAINT whiteboard_sessions_round_pos CHECK (round >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS whiteboard_sessions_open_pin_uidx
  ON public.whiteboard_sessions (pin)
  WHERE status IN ('lobby', 'open');

CREATE INDEX IF NOT EXISTS whiteboard_sessions_host_idx
  ON public.whiteboard_sessions (host_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.whiteboard_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.whiteboard_sessions(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  token TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whiteboard_players_nickname_len CHECK (char_length(trim(nickname)) BETWEEN 1 AND 24),
  CONSTRAINT whiteboard_players_token_len CHECK (char_length(token) >= 16)
);

CREATE UNIQUE INDEX IF NOT EXISTS whiteboard_players_session_token_uidx
  ON public.whiteboard_players (session_id, token);

CREATE UNIQUE INDEX IF NOT EXISTS whiteboard_players_session_nick_uidx
  ON public.whiteboard_players (session_id, lower(trim(nickname)));

CREATE TABLE IF NOT EXISTS public.whiteboard_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.whiteboard_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.whiteboard_players(id) ON DELETE CASCADE,
  strokes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  rev INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, player_id),
  CONSTRAINT whiteboard_boards_json_size CHECK (pg_column_size(strokes_json) <= 102400),
  CONSTRAINT whiteboard_boards_rev_pos CHECK (rev >= 0)
);

CREATE INDEX IF NOT EXISTS whiteboard_boards_session_idx
  ON public.whiteboard_boards (session_id, updated_at DESC);

ALTER TABLE public.whiteboard_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whiteboard_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whiteboard_boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts manage own whiteboard sessions" ON public.whiteboard_sessions;
CREATE POLICY "Hosts manage own whiteboard sessions"
  ON public.whiteboard_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts read whiteboard players" ON public.whiteboard_players;
CREATE POLICY "Hosts read whiteboard players"
  ON public.whiteboard_players
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.whiteboard_sessions s
      WHERE s.id = session_id AND s.host_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Hosts read whiteboard boards" ON public.whiteboard_boards;
CREATE POLICY "Hosts read whiteboard boards"
  ON public.whiteboard_boards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.whiteboard_sessions s
      WHERE s.id = session_id AND s.host_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whiteboard_sessions TO authenticated;
GRANT SELECT ON public.whiteboard_players TO authenticated;
GRANT SELECT ON public.whiteboard_boards TO authenticated;

DROP TRIGGER IF EXISTS whiteboard_sessions_updated_at ON public.whiteboard_sessions;
CREATE TRIGGER whiteboard_sessions_updated_at
  BEFORE UPDATE ON public.whiteboard_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS whiteboard_boards_updated_at ON public.whiteboard_boards;
CREATE TRIGGER whiteboard_boards_updated_at
  BEFORE UPDATE ON public.whiteboard_boards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.wb_text_is_blocked(p_text text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT public.exit_ticket_text_is_blocked(p_text);
$$;

CREATE OR REPLACE FUNCTION public.wb_sanitize_strokes(p_strokes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_out jsonb := '[]'::jsonb;
  v_item jsonb;
  v_c text;
  v_w int;
  v_p jsonb;
  v_n int;
  v_i int;
  v_j int;
  v_num numeric;
  v_pts jsonb;
  v_allowed text[] := ARRAY[
    '#1A2340', '#3B6CFF', '#F45E68', '#35C796', '#F4A62A', '#F4F1E8', '#111827'
  ];
BEGIN
  IF p_strokes IS NULL OR jsonb_typeof(p_strokes) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;
  IF jsonb_array_length(p_strokes) > 250 THEN
    RAISE EXCEPTION 'Too many strokes — wipe the board and keep the answer simpler';
  END IF;
  IF pg_column_size(p_strokes) > 102400 THEN
    RAISE EXCEPTION 'Drawing is too large — wipe the board and keep the answer simpler';
  END IF;

  FOR v_i IN 0 .. jsonb_array_length(p_strokes) - 1 LOOP
    v_item := p_strokes -> v_i;
    IF jsonb_typeof(v_item) <> 'object' THEN
      CONTINUE;
    END IF;
    v_c := upper(trim(both FROM coalesce(v_item->>'c', '')));
    IF NOT (v_c = ANY (v_allowed)) THEN
      CONTINUE;
    END IF;
    BEGIN
      v_w := greatest(1, least(28, coalesce((v_item->>'w')::int, 4)));
    EXCEPTION WHEN others THEN
      v_w := 4;
    END;
    v_p := v_item -> 'p';
    IF jsonb_typeof(v_p) <> 'array' THEN
      CONTINUE;
    END IF;
    v_n := jsonb_array_length(v_p);
    IF v_n < 2 OR v_n > 400 OR (v_n % 2) = 1 THEN
      CONTINUE;
    END IF;
    v_pts := '[]'::jsonb;
    FOR v_j IN 0 .. v_n - 1 LOOP
      BEGIN
        v_num := (v_p ->> v_j)::numeric;
      EXCEPTION WHEN others THEN
        v_num := 0;
      END;
      v_pts := v_pts || to_jsonb(greatest(0, least(1000, round(v_num)::int)));
    END LOOP;
    v_out := v_out || jsonb_build_array(jsonb_build_object('c', v_c, 'w', v_w, 'p', v_pts));
  END LOOP;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.wb_join_session(p_pin text, p_nickname text, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.whiteboard_sessions%ROWTYPE;
  v_player public.whiteboard_players%ROWTYPE;
  v_board public.whiteboard_boards%ROWTYPE;
  v_nick text;
BEGIN
  v_nick := trim(both FROM coalesce(p_nickname, ''));
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid PIN';
  END IF;
  IF char_length(v_nick) < 1 OR char_length(v_nick) > 24 THEN
    RAISE EXCEPTION 'Name must be 1–24 characters';
  END IF;
  IF public.wb_text_is_blocked(v_nick) THEN
    RAISE EXCEPTION 'Please choose a different name';
  END IF;
  IF p_token IS NULL OR char_length(p_token) < 16 THEN
    RAISE EXCEPTION 'Invalid player token';
  END IF;

  SELECT * INTO v_session
  FROM public.whiteboard_sessions
  WHERE pin = p_pin AND status IN ('lobby', 'open')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No live whiteboards found for that PIN';
  END IF;

  SELECT * INTO v_player
  FROM public.whiteboard_players
  WHERE session_id = v_session.id AND token = p_token;

  IF FOUND THEN
    UPDATE public.whiteboard_players
    SET nickname = v_nick
    WHERE id = v_player.id
    RETURNING * INTO v_player;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.whiteboard_players
      WHERE session_id = v_session.id AND lower(trim(nickname)) = lower(v_nick)
    ) THEN
      RAISE EXCEPTION 'That name is already taken';
    END IF;

    INSERT INTO public.whiteboard_players (session_id, nickname, token)
    VALUES (v_session.id, v_nick, p_token)
    RETURNING * INTO v_player;
  END IF;

  INSERT INTO public.whiteboard_boards (session_id, player_id)
  VALUES (v_session.id, v_player.id)
  ON CONFLICT (session_id, player_id) DO NOTHING;

  SELECT * INTO v_board
  FROM public.whiteboard_boards
  WHERE session_id = v_session.id AND player_id = v_player.id;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'player_id', v_player.id,
    'nickname', v_player.nickname,
    'token', v_player.token,
    'status', v_session.status,
    'title', v_session.title,
    'prompt', v_session.prompt,
    'anonymous', v_session.anonymous,
    'locked', v_session.locked,
    'round', v_session.round,
    'strokes', COALESCE(v_board.strokes_json, '[]'::jsonb),
    'rev', COALESCE(v_board.rev, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.wb_get_session_state(p_pin text, p_token text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.whiteboard_sessions%ROWTYPE;
  v_player public.whiteboard_players%ROWTYPE;
  v_board public.whiteboard_boards%ROWTYPE;
  v_player_count int := 0;
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid PIN';
  END IF;

  SELECT * INTO v_session
  FROM public.whiteboard_sessions
  WHERE pin = p_pin AND status <> 'closed'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF p_token IS NOT NULL AND char_length(p_token) >= 16 THEN
    SELECT * INTO v_player
    FROM public.whiteboard_players
    WHERE session_id = v_session.id AND token = p_token;
  END IF;

  SELECT count(*)::int INTO v_player_count
  FROM public.whiteboard_players
  WHERE session_id = v_session.id;

  IF v_player.id IS NOT NULL THEN
    SELECT * INTO v_board
    FROM public.whiteboard_boards
    WHERE session_id = v_session.id AND player_id = v_player.id;
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'title', v_session.title,
    'prompt', v_session.prompt,
    'status', v_session.status,
    'anonymous', v_session.anonymous,
    'locked', v_session.locked,
    'round', v_session.round,
    'player_count', v_player_count,
    'nickname', v_player.nickname,
    'strokes', COALESCE(v_board.strokes_json, '[]'::jsonb),
    'rev', COALESCE(v_board.rev, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.wb_submit_strokes(p_token text, p_strokes jsonb, p_round int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player public.whiteboard_players%ROWTYPE;
  v_session public.whiteboard_sessions%ROWTYPE;
  v_board public.whiteboard_boards%ROWTYPE;
  v_clean jsonb;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 16 THEN
    RAISE EXCEPTION 'Invalid player token';
  END IF;

  SELECT * INTO v_player
  FROM public.whiteboard_players
  WHERE token = p_token
  ORDER BY joined_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  SELECT * INTO v_session
  FROM public.whiteboard_sessions
  WHERE id = v_player.session_id;

  IF v_session.status = 'closed' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'closed', 'round', v_session.round);
  END IF;
  IF v_session.locked THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked', 'round', v_session.round);
  END IF;
  IF p_round IS NULL OR p_round <> v_session.round THEN
    SELECT * INTO v_board
    FROM public.whiteboard_boards
    WHERE session_id = v_session.id AND player_id = v_player.id;
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'round',
      'round', v_session.round,
      'strokes', COALESCE(v_board.strokes_json, '[]'::jsonb),
      'rev', COALESCE(v_board.rev, 0)
    );
  END IF;

  v_clean := public.wb_sanitize_strokes(p_strokes);

  INSERT INTO public.whiteboard_boards (session_id, player_id, strokes_json, rev)
  VALUES (v_session.id, v_player.id, v_clean, 1)
  ON CONFLICT (session_id, player_id)
  DO UPDATE SET
    strokes_json = EXCLUDED.strokes_json,
    rev = public.whiteboard_boards.rev + 1,
    updated_at = NOW()
  RETURNING * INTO v_board;

  RETURN jsonb_build_object(
    'ok', true,
    'rev', v_board.rev,
    'round', v_session.round
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.wb_wipe_boards(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.whiteboard_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.whiteboard_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF auth.uid() IS NULL OR auth.uid() <> v_session.host_id THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.whiteboard_sessions
  SET round = round + 1, locked = false
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  UPDATE public.whiteboard_boards
  SET strokes_json = '[]'::jsonb, rev = rev + 1, updated_at = NOW()
  WHERE session_id = p_session_id;

  RETURN jsonb_build_object('ok', true, 'round', v_session.round);
END;
$$;

CREATE OR REPLACE FUNCTION public.wb_list_host_state(p_session_id uuid, p_known jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.whiteboard_sessions%ROWTYPE;
  v_boards jsonb;
  v_known jsonb;
BEGIN
  SELECT * INTO v_session FROM public.whiteboard_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF auth.uid() IS NULL OR auth.uid() <> v_session.host_id THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  v_known := COALESCE(p_known, '{}'::jsonb);
  IF jsonb_typeof(v_known) <> 'object' THEN
    v_known := '{}'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'nickname', t.nickname,
    'joined_at', t.joined_at,
    'rev', t.rev,
    'has_ink', t.has_ink,
    'strokes', CASE
      WHEN COALESCE((v_known ->> t.id::text)::int, -1) < t.rev THEN t.strokes
      ELSE NULL
    END
  ) ORDER BY t.joined_at ASC), '[]'::jsonb)
  INTO v_boards
  FROM (
    SELECT
      p.id,
      p.nickname,
      p.joined_at,
      COALESCE(b.rev, 0) AS rev,
      (jsonb_array_length(COALESCE(b.strokes_json, '[]'::jsonb)) > 0) AS has_ink,
      COALESCE(b.strokes_json, '[]'::jsonb) AS strokes
    FROM public.whiteboard_players p
    LEFT JOIN public.whiteboard_boards b
      ON b.player_id = p.id AND b.session_id = p.session_id
    WHERE p.session_id = p_session_id
  ) t;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'title', v_session.title,
    'prompt', v_session.prompt,
    'status', v_session.status,
    'pin', v_session.pin,
    'anonymous', v_session.anonymous,
    'locked', v_session.locked,
    'round', v_session.round,
    'player_count', jsonb_array_length(v_boards),
    'boards', v_boards
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.wb_text_is_blocked(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wb_sanitize_strokes(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wb_join_session(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wb_get_session_state(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wb_submit_strokes(text, jsonb, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wb_wipe_boards(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wb_list_host_state(uuid, jsonb) TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whiteboard_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whiteboard_boards;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
