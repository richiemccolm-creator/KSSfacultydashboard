-- Mini Whiteboards: let pupils place emoji stickers on their boards.
-- A sticker is stored alongside pen strokes as {"e": "<sticker id>", "w": <size>, "p": [x, y]}.
-- Only ids on the list below are kept; the app maps each id to an emoji.
-- At most 40 stickers per board, sizes clamped to 30-240 board units.

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
  v_e text;
  v_w int;
  v_p jsonb;
  v_n int;
  v_i int;
  v_j int;
  v_num numeric;
  v_pts jsonb;
  v_stickers int := 0;
  v_allowed text[] := ARRAY[
    '#1A2340', '#3B6CFF', '#F45E68', '#35C796', '#F4A62A', '#F4F1E8', '#111827'
  ];
  v_sticker_ids text[] := ARRAY[
    'thumbs_up', 'thumbs_down', 'clap', 'star', 'heart',
    'check', 'cross', 'question', 'idea', 'think',
    'laugh', 'smile', 'wow', 'sad', 'fire',
    'hundred', 'party', 'theatre', 'palette', 'rocket'
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

    -- Sticker
    IF v_item ? 'e' THEN
      v_e := lower(trim(both FROM coalesce(v_item->>'e', '')));
      IF NOT (v_e = ANY (v_sticker_ids)) OR v_stickers >= 40 THEN
        CONTINUE;
      END IF;
      v_p := v_item -> 'p';
      IF jsonb_typeof(v_p) <> 'array' OR jsonb_array_length(v_p) <> 2 THEN
        CONTINUE;
      END IF;
      BEGIN
        v_w := greatest(30, least(240, round(coalesce((v_item->>'w')::numeric, 90))::int));
      EXCEPTION WHEN others THEN
        v_w := 90;
      END;
      v_pts := '[]'::jsonb;
      FOR v_j IN 0 .. 1 LOOP
        BEGIN
          v_num := (v_p ->> v_j)::numeric;
        EXCEPTION WHEN others THEN
          v_num := 0;
        END;
        v_pts := v_pts || to_jsonb(greatest(0, least(1000, round(v_num)::int)));
      END LOOP;
      v_stickers := v_stickers + 1;
      v_out := v_out || jsonb_build_array(jsonb_build_object('e', v_e, 'w', v_w, 'p', v_pts));
      CONTINUE;
    END IF;

    -- Pen stroke (unchanged)
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

GRANT EXECUTE ON FUNCTION public.wb_sanitize_strokes(jsonb) TO anon, authenticated;
