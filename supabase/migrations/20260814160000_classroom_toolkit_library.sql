-- Classroom Toolkit: per-user cloud library
-- Stores Quiz Busters boards, Quiz Builder quizzes, Heads Up / Exit Ticket packs,
-- favourites and Big Timer prefs so signed-in teachers can use them on any device.
-- Apply in the Supabase SQL editor if you are not running `supabase db push`.

CREATE TABLE IF NOT EXISTS public.classroom_toolkit_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_key TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT classroom_toolkit_library_store_key_format
    CHECK (store_key ~ '^tk_[a-z0-9_]{1,64}$'),
  CONSTRAINT classroom_toolkit_library_owner_store_key
    UNIQUE (owner_id, store_key)
);

CREATE INDEX IF NOT EXISTS classroom_toolkit_library_owner_updated_idx
  ON public.classroom_toolkit_library (owner_id, updated_at DESC);

ALTER TABLE public.classroom_toolkit_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage own classroom toolkit library" ON public.classroom_toolkit_library;
CREATE POLICY "Owners manage own classroom toolkit library"
  ON public.classroom_toolkit_library
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classroom_toolkit_library TO authenticated;

DROP TRIGGER IF EXISTS classroom_toolkit_library_updated_at ON public.classroom_toolkit_library;
CREATE TRIGGER classroom_toolkit_library_updated_at
  BEFORE UPDATE ON public.classroom_toolkit_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.classroom_toolkit_load_library(p_store_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_data jsonb;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_store_key IS NULL OR p_store_key !~ '^tk_[a-z0-9_]{1,64}$' THEN
    RAISE EXCEPTION 'Invalid store_key';
  END IF;

  SELECT data INTO v_data
  FROM public.classroom_toolkit_library
  WHERE owner_id = v_owner AND store_key = p_store_key;

  RETURN v_data;
END;
$$;

CREATE OR REPLACE FUNCTION public.classroom_toolkit_upsert_library(
  p_store_key text,
  p_data jsonb
)
RETURNS public.classroom_toolkit_library
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_row public.classroom_toolkit_library%ROWTYPE;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_store_key IS NULL OR p_store_key !~ '^tk_[a-z0-9_]{1,64}$' THEN
    RAISE EXCEPTION 'Invalid store_key';
  END IF;

  INSERT INTO public.classroom_toolkit_library (owner_id, store_key, data)
  VALUES (
    v_owner,
    p_store_key,
    coalesce(p_data, '[]'::jsonb)
  )
  ON CONFLICT (owner_id, store_key)
  DO UPDATE SET
    data = EXCLUDED.data,
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.classroom_toolkit_load_library(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.classroom_toolkit_upsert_library(text, jsonb) TO authenticated;

-- Quiz Builder library upsert was defined against a partial unique index, which
-- PostgreSQL cannot use for ON CONFLICT (owner_id, client_quiz_id). Replace it
-- with a real unique constraint so the existing RPC works.
DROP INDEX IF EXISTS public.quiz_builder_quizzes_owner_client_uidx;

DO $$
BEGIN
  IF to_regclass('public.quiz_builder_quizzes') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quiz_builder_quizzes_owner_client_key'
      AND conrelid = 'public.quiz_builder_quizzes'::regclass
  ) THEN
    ALTER TABLE public.quiz_builder_quizzes
      ADD CONSTRAINT quiz_builder_quizzes_owner_client_key
      UNIQUE (owner_id, client_quiz_id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN unique_violation THEN NULL;
END $$;
