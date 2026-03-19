-- Curriculum Design and Report Builder: Initial schema with RLS
-- Run this in Supabase SQL Editor after creating your project

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pupil data: all app data stored as JSONB per data_type
-- data_type maps to: drama-v3, art-v2, bge_drama_reports_v1, bge_art_reports_v1,
-- academicCalendarEvents, dipSelfEvaluation, moderation-data
CREATE TABLE IF NOT EXISTS public.pupil_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, data_type)
);

-- Index for fast lookups by user and data type
CREATE INDEX IF NOT EXISTS idx_pupil_data_user_type ON public.pupil_data(user_id, data_type);

-- Enable RLS on both tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pupil_data ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Pupil data: users can only access their own data
CREATE POLICY "Users can view own pupil data"
  ON public.pupil_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pupil data"
  ON public.pupil_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pupil data"
  ON public.pupil_data FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pupil data"
  ON public.pupil_data FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger: create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update updated_at on pupil_data
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pupil_data_updated_at ON public.pupil_data;
CREATE TRIGGER pupil_data_updated_at
  BEFORE UPDATE ON public.pupil_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
