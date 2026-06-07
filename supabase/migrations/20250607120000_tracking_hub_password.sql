-- Shared password gate for Tracking & Monitoring hub (admin-managed, server-verified).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.faculty_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.faculty_settings ENABLE ROW LEVEL SECURITY;

-- No direct client access; use RPCs only.
REVOKE ALL ON public.faculty_settings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.allowed_emails
    WHERE email = (auth.jwt()->>'email')
      AND COALESCE(is_admin, false) = true
  );
$$;

CREATE OR REPLACE FUNCTION public.tracking_hub_password_is_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.faculty_settings
    WHERE key = 'tracking_hub_password_hash'
      AND length(trim(value)) > 0
  );
$$;

CREATE OR REPLACE FUNCTION public.verify_tracking_hub_password(p_password text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT value INTO stored_hash
  FROM public.faculty_settings
  WHERE key = 'tracking_hub_password_hash'
  LIMIT 1;

  IF stored_hash IS NULL OR length(trim(stored_hash)) = 0 THEN
    RETURN true;
  END IF;

  IF p_password IS NULL OR length(trim(p_password)) = 0 THEN
    RETURN false;
  END IF;

  RETURN stored_hash = crypt(p_password, stored_hash);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_tracking_hub_password(p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF p_password IS NULL OR length(trim(p_password)) = 0 THEN
    DELETE FROM public.faculty_settings WHERE key = 'tracking_hub_password_hash';
    RETURN;
  END IF;

  IF length(trim(p_password)) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  INSERT INTO public.faculty_settings (key, value, updated_by, updated_at)
  VALUES ('tracking_hub_password_hash', crypt(trim(p_password), gen_salt('bf')), auth.uid(), NOW())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.tracking_hub_password_is_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_tracking_hub_password(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_tracking_hub_password(text) TO authenticated;
