-- Classroom Toolkit Traffic Lights: RAG understanding checks via QR/PIN
-- Pupils join anonymously (nickname + token); teachers host while signed in.

CREATE TABLE IF NOT EXISTS public.traffic_light_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Traffic Lights',
  prompt TEXT NOT NULL DEFAULT 'How well do you understand today''s learning?',
  criteria_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby', 'open', 'closed')),
  anonymous BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT traffic_light_sessions_pin_format CHECK (pin ~ '^[0-9]{6}$'),
  CONSTRAINT traffic_light_sessions_prompt_len CHECK (char_length(trim(prompt)) BETWEEN 1 AND 160),
  CONSTRAINT traffic_light_sessions_title_len CHECK (char_length(trim(title)) BETWEEN 1 AND 80)
);

CREATE UNIQUE INDEX IF NOT EXISTS traffic_light_sessions_open_pin_uidx
  ON public.traffic_light_sessions (pin)
  WHERE status IN ('lobby', 'open');

CREATE INDEX IF NOT EXISTS traffic_light_sessions_host_idx
  ON public.traffic_light_sessions (host_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.traffic_light_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.traffic_light_sessions(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  token TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT traffic_light_players_nickname_len CHECK (char_length(trim(nickname)) BETWEEN 1 AND 24),
  CONSTRAINT traffic_light_players_token_len CHECK (char_length(token) >= 16)
);

CREATE UNIQUE INDEX IF NOT EXISTS traffic_light_players_session_token_uidx
  ON public.traffic_light_players (session_id, token);

CREATE UNIQUE INDEX IF NOT EXISTS traffic_light_players_session_nick_uidx
  ON public.traffic_light_players (session_id, lower(trim(nickname)));

-- item_index 0 = overall prompt; 1+ = optional success criteria
CREATE TABLE IF NOT EXISTS public.traffic_light_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.traffic_light_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.traffic_light_players(id) ON DELETE CASCADE,
  item_index INT NOT NULL,
  colour TEXT NOT NULL CHECK (colour IN ('red', 'amber', 'green')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, player_id, item_index),
  CONSTRAINT traffic_light_votes_item_idx CHECK (item_index >= 0 AND item_index < 8)
);

CREATE INDEX IF NOT EXISTS traffic_light_votes_session_idx
  ON public.traffic_light_votes (session_id, item_index);

ALTER TABLE public.traffic_light_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_light_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_light_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts manage own traffic light sessions" ON public.traffic_light_sessions;
CREATE POLICY "Hosts manage own traffic light sessions"
  ON public.traffic_light_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts read traffic light players" ON public.traffic_light_players;
CREATE POLICY "Hosts read traffic light players"
  ON public.traffic_light_players
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.traffic_light_sessions s
      WHERE s.id = session_id AND s.host_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Hosts read traffic light votes" ON public.traffic_light_votes;
CREATE POLICY "Hosts read traffic light votes"
  ON public.traffic_light_votes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.traffic_light_sessions s
      WHERE s.id = session_id AND s.host_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.traffic_light_sessions TO authenticated;
GRANT SELECT ON public.traffic_light_players TO authenticated;
GRANT SELECT ON public.traffic_light_votes TO authenticated;

DROP TRIGGER IF EXISTS traffic_light_sessions_updated_at ON public.traffic_light_sessions;
CREATE TRIGGER traffic_light_sessions_updated_at
  BEFORE UPDATE ON public.traffic_light_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS traffic_light_votes_updated_at ON public.traffic_light_votes;
CREATE TRIGGER traffic_light_votes_updated_at
  BEFORE UPDATE ON public.traffic_light_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Basic nickname filter (school-safe)
CREATE OR REPLACE FUNCTION public.lights_text_is_blocked(p_text text)
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
  v := regexp_replace(v, '[[:punct:]]+', ' ', 'g');
  v := ' ' || regexp_replace(v, '\s+', ' ', 'g') || ' ';
  FOREACH w IN ARRAY v_words LOOP
    IF position(' ' || w || ' ' IN v) > 0 THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.lights_join_session(p_pin text, p_nickname text, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.traffic_light_sessions%ROWTYPE;
  v_player public.traffic_light_players%ROWTYPE;
  v_nick text;
BEGIN
  v_nick := trim(both FROM coalesce(p_nickname, ''));
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid PIN';
  END IF;
  IF char_length(v_nick) < 1 OR char_length(v_nick) > 24 THEN
    RAISE EXCEPTION 'Nickname must be 1–24 characters';
  END IF;
  IF public.lights_text_is_blocked(v_nick) THEN
    RAISE EXCEPTION 'Please choose a different nickname';
  END IF;
  IF p_token IS NULL OR char_length(p_token) < 16 THEN
    RAISE EXCEPTION 'Invalid player token';
  END IF;

  SELECT * INTO v_session
  FROM public.traffic_light_sessions
  WHERE pin = p_pin AND status IN ('lobby', 'open')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No live traffic lights found for that PIN';
  END IF;

  SELECT * INTO v_player
  FROM public.traffic_light_players
  WHERE session_id = v_session.id AND token = p_token;

  IF FOUND THEN
    UPDATE public.traffic_light_players
    SET nickname = v_nick
    WHERE id = v_player.id
    RETURNING * INTO v_player;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.traffic_light_players
      WHERE session_id = v_session.id AND lower(trim(nickname)) = lower(v_nick)
    ) THEN
      RAISE EXCEPTION 'That nickname is already taken';
    END IF;

    INSERT INTO public.traffic_light_players (session_id, nickname, token)
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
    'prompt', v_session.prompt,
    'criteria', COALESCE(v_session.criteria_json, '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.lights_get_session_state(p_pin text, p_token text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.traffic_light_sessions%ROWTYPE;
  v_player public.traffic_light_players%ROWTYPE;
  v_mine jsonb := '[]'::jsonb;
  v_player_count int := 0;
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid PIN';
  END IF;

  SELECT * INTO v_session
  FROM public.traffic_light_sessions
  WHERE pin = p_pin AND status <> 'closed'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF p_token IS NOT NULL AND char_length(p_token) >= 16 THEN
    SELECT * INTO v_player
    FROM public.traffic_light_players
    WHERE session_id = v_session.id AND token = p_token;
  END IF;

  SELECT count(*)::int INTO v_player_count
  FROM public.traffic_light_players
  WHERE session_id = v_session.id;

  IF v_player.id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'item_index', v.item_index,
      'colour', v.colour
    ) ORDER BY v.item_index), '[]'::jsonb)
    INTO v_mine
    FROM public.traffic_light_votes v
    WHERE v.session_id = v_session.id AND v.player_id = v_player.id;
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'title', v_session.title,
    'prompt', v_session.prompt,
    'criteria', COALESCE(v_session.criteria_json, '[]'::jsonb),
    'status', v_session.status,
    'anonymous', v_session.anonymous,
    'player_count', v_player_count,
    'nickname', v_player.nickname,
    'my_votes', v_mine
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.lights_submit_vote(p_token text, p_item_index int, p_colour text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player public.traffic_light_players%ROWTYPE;
  v_session public.traffic_light_sessions%ROWTYPE;
  v_colour text;
  v_count int;
  v_vote public.traffic_light_votes%ROWTYPE;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 16 THEN
    RAISE EXCEPTION 'Invalid player token';
  END IF;

  v_colour := lower(trim(both FROM coalesce(p_colour, '')));
  IF v_colour NOT IN ('red', 'amber', 'green') THEN
    RAISE EXCEPTION 'Pick red, amber or green';
  END IF;

  SELECT * INTO v_player
  FROM public.traffic_light_players
  WHERE token = p_token
  ORDER BY joined_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  SELECT * INTO v_session
  FROM public.traffic_light_sessions
  WHERE id = v_player.session_id;

  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Voting is not open yet';
  END IF;

  v_count := jsonb_array_length(COALESCE(v_session.criteria_json, '[]'::jsonb));
  -- item 0 = overall; 1..n = criteria
  IF p_item_index IS NULL OR p_item_index < 0 OR p_item_index > v_count THEN
    RAISE EXCEPTION 'Invalid item';
  END IF;

  INSERT INTO public.traffic_light_votes (session_id, player_id, item_index, colour)
  VALUES (v_session.id, v_player.id, p_item_index, v_colour)
  ON CONFLICT (session_id, player_id, item_index)
  DO UPDATE SET colour = EXCLUDED.colour, updated_at = NOW()
  RETURNING * INTO v_vote;

  RETURN jsonb_build_object(
    'ok', true,
    'item_index', v_vote.item_index,
    'colour', v_vote.colour
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.lights_list_host_state(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.traffic_light_sessions%ROWTYPE;
  v_players jsonb;
  v_votes jsonb;
  v_counts jsonb;
  v_criteria_count int;
BEGIN
  SELECT * INTO v_session FROM public.traffic_light_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF auth.uid() IS NULL OR auth.uid() <> v_session.host_id THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  v_criteria_count := jsonb_array_length(COALESCE(v_session.criteria_json, '[]'::jsonb));

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'nickname', p.nickname,
    'joined_at', p.joined_at
  ) ORDER BY p.joined_at ASC), '[]'::jsonb)
  INTO v_players
  FROM public.traffic_light_players p
  WHERE p.session_id = p_session_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'player_id', v.player_id,
    'nickname', pl.nickname,
    'item_index', v.item_index,
    'colour', v.colour,
    'updated_at', v.updated_at
  ) ORDER BY v.updated_at DESC), '[]'::jsonb)
  INTO v_votes
  FROM public.traffic_light_votes v
  JOIN public.traffic_light_players pl ON pl.id = v.player_id
  WHERE v.session_id = p_session_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'item_index', t.idx,
    'red', COALESCE(c.red, 0),
    'amber', COALESCE(c.amber, 0),
    'green', COALESCE(c.green, 0),
    'total', COALESCE(c.red, 0) + COALESCE(c.amber, 0) + COALESCE(c.green, 0)
  ) ORDER BY t.idx), '[]'::jsonb)
  INTO v_counts
  FROM generate_series(0, v_criteria_count) AS t(idx)
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE colour = 'red')::int AS red,
      count(*) FILTER (WHERE colour = 'amber')::int AS amber,
      count(*) FILTER (WHERE colour = 'green')::int AS green
    FROM public.traffic_light_votes
    WHERE session_id = p_session_id AND item_index = t.idx
  ) c ON true;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'title', v_session.title,
    'prompt', v_session.prompt,
    'criteria', COALESCE(v_session.criteria_json, '[]'::jsonb),
    'status', v_session.status,
    'pin', v_session.pin,
    'anonymous', v_session.anonymous,
    'player_count', jsonb_array_length(v_players),
    'players', v_players,
    'votes', v_votes,
    'counts', v_counts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.lights_text_is_blocked(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lights_join_session(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lights_get_session_state(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lights_submit_vote(text, int, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lights_list_host_state(uuid) TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.traffic_light_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.traffic_light_votes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
