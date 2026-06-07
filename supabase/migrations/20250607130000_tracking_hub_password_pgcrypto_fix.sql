-- Fix: gen_salt/crypt require pgcrypto on Supabase (extensions schema).
-- Run this if set_tracking_hub_password fails with "function gen_salt(unknown) does not exist".

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.verify_tracking_hub_password(p_password text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
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
SET search_path = public, extensions
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
