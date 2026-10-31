-- N5 Creative Industries assessment tracker: pupils, assessment decisions
-- against each SQA performance criterion, evidence checkpoints, unit
-- sign-offs and follow-ups, shared across devices for faculty staff.
--
-- Each decision is its own row keyed by (pupil, code), so two teachers
-- marking on two devices never overwrite each other's work. Who made each
-- decision, and when, is stamped by the database for verification.
--
-- Codes in ci_assess_marks:
--   u3.1a            performance criterion (kind 'pc')
--   u3.check.obs1    evidence checkpoint (kind 'check')
--   u3.signoff       unit sign-off (kind 'signoff')
--
-- Anyone on the Faculty Hub allowlist can read. Anyone on it except
-- read-only accounts can write.

CREATE OR REPLACE FUNCTION public.ci_assess_can_read()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.allowed_emails
    WHERE lower(email) = lower(auth.jwt() ->> 'email')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ci_assess_can_write()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  SELECT role INTO r
  FROM public.allowed_emails
  WHERE lower(email) = lower(auth.jwt() ->> 'email')
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  RETURN lower(trim(COALESCE(r.role, ''))) <> 'read_only';
END;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ci_assess_settings (
  school_year TEXT PRIMARY KEY,
  intro_variant TEXT NOT NULL DEFAULT 'UK' CHECK (intro_variant IN ('UK', 'SCOT')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.ci_assess_pupils (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_year TEXT NOT NULL,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 140),
  class_code TEXT NOT NULL DEFAULT '' CHECK (char_length(class_code) <= 70),
  team TEXT NOT NULL DEFAULT '' CHECK (char_length(team) <= 70),
  notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 8000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ci_assess_pupils_year
  ON public.ci_assess_pupils (school_year, class_code, name);

CREATE TABLE IF NOT EXISTS public.ci_assess_marks (
  pupil_id UUID NOT NULL REFERENCES public.ci_assess_pupils(id) ON DELETE CASCADE,
  code TEXT NOT NULL CHECK (code ~ '^u[1-4]\.([1-3][a-f]|check\.[a-z0-9]+|signoff)$'),
  kind TEXT NOT NULL CHECK (kind IN ('pc', 'check', 'signoff')),
  -- pc: n not assessed, d developing, r to assess, m achieved, x action required
  -- check: m verified, n outstanding
  -- signoff: m signed off
  status TEXT NOT NULL DEFAULT 'n' CHECK (status IN ('n', 'd', 'r', 'm', 'x')),
  evidence_type TEXT NOT NULL DEFAULT '' CHECK (char_length(evidence_type) <= 60),
  evidence_ref TEXT NOT NULL DEFAULT '' CHECK (char_length(evidence_ref) <= 300),
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 4000),
  assessed_on DATE,
  signed_by TEXT NOT NULL DEFAULT '' CHECK (char_length(signed_by) <= 120),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_name TEXT,
  PRIMARY KEY (pupil_id, code)
);

CREATE TABLE IF NOT EXISTS public.ci_assess_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_year TEXT NOT NULL,
  pupil_id UUID REFERENCES public.ci_assess_pupils(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  due_on DATE,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_ci_assess_followups_year
  ON public.ci_assess_followups (school_year, done_at, due_on);

-- ---------------------------------------------------------------------------
-- Stamps: who changed what, set by the database
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ci_assess_staff_name()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(btrim(p.display_name), ''), split_part(p.email, '@', 1))
    FROM public.profiles p
   WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.ci_assess_stamp_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ci_assess_stamp_mark()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  NEW.updated_by := auth.uid();
  NEW.updated_by_name := public.ci_assess_staff_name();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ci_assess_stamp_followup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := NOW();
    NEW.created_by := auth.uid();
    NEW.created_by_name := public.ci_assess_staff_name();
  ELSE
    NEW.created_at := OLD.created_at;
    NEW.created_by := OLD.created_by;
    NEW.created_by_name := OLD.created_by_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ci_assess_settings_stamp ON public.ci_assess_settings;
CREATE TRIGGER ci_assess_settings_stamp
  BEFORE INSERT OR UPDATE ON public.ci_assess_settings
  FOR EACH ROW EXECUTE FUNCTION public.ci_assess_stamp_row();

DROP TRIGGER IF EXISTS ci_assess_pupils_stamp ON public.ci_assess_pupils;
CREATE TRIGGER ci_assess_pupils_stamp
  BEFORE INSERT OR UPDATE ON public.ci_assess_pupils
  FOR EACH ROW EXECUTE FUNCTION public.ci_assess_stamp_row();

DROP TRIGGER IF EXISTS ci_assess_marks_stamp ON public.ci_assess_marks;
CREATE TRIGGER ci_assess_marks_stamp
  BEFORE INSERT OR UPDATE ON public.ci_assess_marks
  FOR EACH ROW EXECUTE FUNCTION public.ci_assess_stamp_mark();

DROP TRIGGER IF EXISTS ci_assess_followups_stamp ON public.ci_assess_followups;
CREATE TRIGGER ci_assess_followups_stamp
  BEFORE INSERT OR UPDATE ON public.ci_assess_followups
  FOR EACH ROW EXECUTE FUNCTION public.ci_assess_stamp_followup();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

ALTER TABLE public.ci_assess_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ci_assess_pupils ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ci_assess_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ci_assess_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Faculty staff can read CI settings"
  ON public.ci_assess_settings FOR SELECT TO authenticated
  USING (public.ci_assess_can_read());
CREATE POLICY "Faculty staff can add CI settings"
  ON public.ci_assess_settings FOR INSERT TO authenticated
  WITH CHECK (public.ci_assess_can_write());
CREATE POLICY "Faculty staff can change CI settings"
  ON public.ci_assess_settings FOR UPDATE TO authenticated
  USING (public.ci_assess_can_write()) WITH CHECK (public.ci_assess_can_write());

CREATE POLICY "Faculty staff can read CI pupils"
  ON public.ci_assess_pupils FOR SELECT TO authenticated
  USING (public.ci_assess_can_read());
CREATE POLICY "Faculty staff can add CI pupils"
  ON public.ci_assess_pupils FOR INSERT TO authenticated
  WITH CHECK (public.ci_assess_can_write());
CREATE POLICY "Faculty staff can change CI pupils"
  ON public.ci_assess_pupils FOR UPDATE TO authenticated
  USING (public.ci_assess_can_write()) WITH CHECK (public.ci_assess_can_write());
CREATE POLICY "Faculty staff can remove CI pupils"
  ON public.ci_assess_pupils FOR DELETE TO authenticated
  USING (public.ci_assess_can_write());

CREATE POLICY "Faculty staff can read CI marks"
  ON public.ci_assess_marks FOR SELECT TO authenticated
  USING (public.ci_assess_can_read());
CREATE POLICY "Faculty staff can add CI marks"
  ON public.ci_assess_marks FOR INSERT TO authenticated
  WITH CHECK (public.ci_assess_can_write());
CREATE POLICY "Faculty staff can change CI marks"
  ON public.ci_assess_marks FOR UPDATE TO authenticated
  USING (public.ci_assess_can_write()) WITH CHECK (public.ci_assess_can_write());
CREATE POLICY "Faculty staff can remove CI marks"
  ON public.ci_assess_marks FOR DELETE TO authenticated
  USING (public.ci_assess_can_write());

CREATE POLICY "Faculty staff can read CI follow-ups"
  ON public.ci_assess_followups FOR SELECT TO authenticated
  USING (public.ci_assess_can_read());
CREATE POLICY "Faculty staff can add CI follow-ups"
  ON public.ci_assess_followups FOR INSERT TO authenticated
  WITH CHECK (public.ci_assess_can_write());
CREATE POLICY "Faculty staff can change CI follow-ups"
  ON public.ci_assess_followups FOR UPDATE TO authenticated
  USING (public.ci_assess_can_write()) WITH CHECK (public.ci_assess_can_write());
CREATE POLICY "Faculty staff can remove CI follow-ups"
  ON public.ci_assess_followups FOR DELETE TO authenticated
  USING (public.ci_assess_can_write());

-- Supabase grants every new table to anon and authenticated by default; start clean.
REVOKE ALL ON public.ci_assess_settings, public.ci_assess_pupils,
  public.ci_assess_marks, public.ci_assess_followups FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ci_assess_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ci_assess_pupils TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ci_assess_marks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ci_assess_followups TO authenticated;

REVOKE ALL ON FUNCTION public.ci_assess_can_read() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ci_assess_can_write() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ci_assess_staff_name() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ci_assess_can_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ci_assess_can_write() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ci_assess_staff_name() TO authenticated;

-- Live updates: a mark made on the iPad shows on the classroom PC without a refresh.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ci_assess_pupils;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ci_assess_marks;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ci_assess_followups;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Deletes over realtime need the old row's key.
ALTER TABLE public.ci_assess_marks REPLICA IDENTITY FULL;
ALTER TABLE public.ci_assess_pupils REPLICA IDENTITY FULL;
ALTER TABLE public.ci_assess_followups REPLICA IDENTITY FULL;
