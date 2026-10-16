-- Save one Teacher Planner lesson without uploading the whole year.
-- The planner keeps every lesson (with Pencil handwriting) in one pupil_data
-- row (data_type 'plannerLessons'). Saving a lesson used to resend that whole
-- document; this replaces the lesson with the same id inside it, or appends it.
-- SECURITY INVOKER so existing pupil_data RLS still applies.

CREATE OR REPLACE FUNCTION public.upsert_planner_lesson(p_lesson jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id text := nullif(trim(coalesce(p_lesson->>'id', '')), '');
  v_data jsonb;
  v_lessons jsonb;
  v_found boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_id IS NULL OR jsonb_typeof(p_lesson) <> 'object' THEN
    RAISE EXCEPTION 'Lesson id required';
  END IF;

  SELECT data INTO v_data
  FROM public.pupil_data
  WHERE user_id = v_uid AND data_type = 'plannerLessons'
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.pupil_data (user_id, data_type, data)
    VALUES (v_uid, 'plannerLessons', jsonb_build_object('lessons', jsonb_build_array(p_lesson)));
    RETURN;
  END IF;

  v_data := coalesce(v_data, '{}'::jsonb);
  v_lessons := CASE WHEN jsonb_typeof(v_data->'lessons') = 'array' THEN v_data->'lessons' ELSE '[]'::jsonb END;

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_lessons) AS e(l) WHERE e.l->>'id' = v_id
  ) INTO v_found;

  IF v_found THEN
    SELECT coalesce(jsonb_agg(CASE WHEN e.l->>'id' = v_id THEN p_lesson ELSE e.l END ORDER BY e.ord), '[]'::jsonb)
    INTO v_lessons
    FROM jsonb_array_elements(v_lessons) WITH ORDINALITY AS e(l, ord);
  ELSE
    v_lessons := v_lessons || jsonb_build_array(p_lesson);
  END IF;

  UPDATE public.pupil_data
  SET data = jsonb_set(v_data, '{lessons}', v_lessons, true)
  WHERE user_id = v_uid AND data_type = 'plannerLessons';
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_planner_lesson(jsonb) TO authenticated;
