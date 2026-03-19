-- Email allowlist: only listed emails can access the app
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  email TEXT PRIMARY KEY,
  display_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- Users can only check if THEIR email is in the list (no one sees the full list)
CREATE POLICY "Users can check own email"
  ON public.allowed_emails FOR SELECT
  USING (email = (auth.jwt()->>'email'));
