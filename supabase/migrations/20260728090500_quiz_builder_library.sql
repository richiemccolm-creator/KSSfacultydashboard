-- Classroom Toolkit Quiz Builder: persistent per-user quiz library
-- Stores authored/imported quizzes so teachers can access them across devices.

CREATE TABLE IF NOT EXISTS public.quiz_builder_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_quiz_id TEXT,
  title TEXT NOT NULL DEFAULT 'Untitled quiz',
  description TEXT NOT NULL DEFAULT '',
  quiz_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quiz_builder_quizzes_title_len CHECK (char_length(trim(title)) BETWEEN 1 AND 120),
  CONSTRAINT quiz_builder_quizzes_description_len CHECK (char_length(description) <= 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS quiz_builder_quizzes_owner_client_uidx
  ON public.quiz_builder_quizzes (owner_id, client_quiz_id)
  WHERE client_quiz_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS quiz_builder_quizzes_owner_updated_idx
  ON public.quiz_builder_quizzes (owner_id, updated_at DESC);

ALTER TABLE public.quiz_builder_quizzes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage own quiz builder quizzes" ON public.quiz_builder_quizzes;
CREATE POLICY "Owners manage own quiz builder quizzes"
  ON public.quiz_builder_quizzes
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_builder_quizzes TO authenticated;

DROP TRIGGER IF EXISTS quiz_builder_quizzes_updated_at ON public.quiz_builder_quizzes;
CREATE TRIGGER quiz_builder_quizzes_updated_at
  BEFORE UPDATE ON public.quiz_builder_quizzes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Optional helper RPC to upsert by client-side quiz id.
-- This keeps API usage simple from the browser and guarantees owner scoping.
CREATE OR REPLACE FUNCTION public.quiz_builder_upsert_quiz(
  p_client_quiz_id text,
  p_title text,
  p_description text,
  p_quiz_json jsonb
)
RETURNS public.quiz_builder_quizzes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid := auth.uid();
  v_row public.quiz_builder_quizzes%ROWTYPE;
BEGIN
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_client_quiz_id IS NULL OR char_length(trim(p_client_quiz_id)) = 0 THEN
    RAISE EXCEPTION 'client_quiz_id is required';
  END IF;

  INSERT INTO public.quiz_builder_quizzes (
    owner_id,
    client_quiz_id,
    title,
    description,
    quiz_json
  )
  VALUES (
    v_owner_id,
    trim(p_client_quiz_id),
    coalesce(nullif(trim(p_title), ''), 'Untitled quiz'),
    coalesce(p_description, ''),
    coalesce(p_quiz_json, '{}'::jsonb)
  )
  ON CONFLICT (owner_id, client_quiz_id)
  DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    quiz_json = EXCLUDED.quiz_json,
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.quiz_builder_upsert_quiz(text, text, text, jsonb) TO authenticated;
