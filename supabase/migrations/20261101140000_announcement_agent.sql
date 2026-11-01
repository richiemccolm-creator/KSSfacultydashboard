-- Sunday-night announcements agent: settings and a log of each run.
--
-- The weekly-announcements Edge Function (supabase/functions/weekly-announcements)
-- reads the coming fortnight of the shared calendar and the faculty head's
-- waiting announcement notes, asks Claude to write the week's announcements,
-- and saves them for Monday morning. It runs with the service role, so it
-- writes announcement_agent_runs itself; staff can only read their own runs.
--
-- The schedule that calls the function is set up separately, in
-- 20261101150000_announcement_agent_schedule.sql, after the function is deployed.

CREATE TABLE IF NOT EXISTS public.announcement_agent_settings (
  owner_id UUID PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  publish_time TIME NOT NULL DEFAULT '07:30',
  tone TEXT NOT NULL DEFAULT 'friendly' CHECK (tone IN ('friendly', 'formal', 'brief')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.announcement_agent_settings IS
  'One row per faculty head who has set up the Sunday announcements agent.';
COMMENT ON COLUMN public.announcement_agent_settings.publish_time IS
  'UK time on Monday when the agent''s announcements go live.';

ALTER TABLE public.announcement_agent_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner reads own agent settings" ON public.announcement_agent_settings;
CREATE POLICY "Owner reads own agent settings"
  ON public.announcement_agent_settings FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- Only faculty heads and admins can switch the agent on, because it posts announcements.
DROP POLICY IF EXISTS "Managers add own agent settings" ON public.announcement_agent_settings;
CREATE POLICY "Managers add own agent settings"
  ON public.announcement_agent_settings FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.is_school_manager());

DROP POLICY IF EXISTS "Managers edit own agent settings" ON public.announcement_agent_settings;
CREATE POLICY "Managers edit own agent settings"
  ON public.announcement_agent_settings FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() AND public.is_school_manager());

REVOKE ALL ON public.announcement_agent_settings FROM anon, authenticated;
GRANT SELECT, INSERT ON public.announcement_agent_settings TO authenticated;
GRANT UPDATE (enabled, publish_time, tone) ON public.announcement_agent_settings TO authenticated;

CREATE OR REPLACE FUNCTION public.announcement_agent_settings_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS announcement_agent_settings_touch ON public.announcement_agent_settings;
CREATE TRIGGER announcement_agent_settings_touch
  BEFORE UPDATE ON public.announcement_agent_settings
  FOR EACH ROW EXECUTE FUNCTION public.announcement_agent_settings_touch();

CREATE TABLE IF NOT EXISTS public.announcement_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_of DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'error')),
  summary TEXT,
  scheduled_count INT NOT NULL DEFAULT 0,
  draft_count INT NOT NULL DEFAULT 0,
  announcement_ids UUID[] NOT NULL DEFAULT '{}',
  note_ids UUID[] NOT NULL DEFAULT '{}',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

COMMENT ON COLUMN public.announcement_agent_runs.week_of IS
  'The Monday the announcements were written for.';

-- One successful (or in-progress) run per person per week, so a repeated
-- trigger never posts the same week twice. A failed run can be retried.
CREATE UNIQUE INDEX IF NOT EXISTS announcement_agent_runs_one_per_week
  ON public.announcement_agent_runs (owner_id, week_of)
  WHERE status <> 'error';

CREATE INDEX IF NOT EXISTS idx_announcement_agent_runs_owner
  ON public.announcement_agent_runs (owner_id, created_at DESC);

ALTER TABLE public.announcement_agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner reads own agent runs" ON public.announcement_agent_runs;
CREATE POLICY "Owner reads own agent runs"
  ON public.announcement_agent_runs FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

REVOKE ALL ON public.announcement_agent_runs FROM anon, authenticated;
GRANT SELECT ON public.announcement_agent_runs TO authenticated;
