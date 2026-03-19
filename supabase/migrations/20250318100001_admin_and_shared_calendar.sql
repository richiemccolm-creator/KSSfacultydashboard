-- Admin can view all pupil_data and profiles (for Faculty Dashboard)
CREATE POLICY "Admin can view all pupil data"
  ON public.pupil_data FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.allowed_emails WHERE email = (auth.jwt()->>'email') AND is_admin = true)
  );

CREATE POLICY "Admin can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.allowed_emails WHERE email = (auth.jwt()->>'email') AND is_admin = true)
  );

-- Shared calendar: admin-managed events visible to all
CREATE TABLE IF NOT EXISTS public.shared_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.shared_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read shared calendar"
  ON public.shared_calendar_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert shared calendar"
  ON public.shared_calendar_events FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.allowed_emails WHERE email = (auth.jwt()->>'email') AND is_admin = true)
  );

CREATE POLICY "Admin can update shared calendar"
  ON public.shared_calendar_events FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.allowed_emails WHERE email = (auth.jwt()->>'email') AND is_admin = true)
  );

CREATE POLICY "Admin can delete shared calendar"
  ON public.shared_calendar_events FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.allowed_emails WHERE email = (auth.jwt()->>'email') AND is_admin = true)
  );
