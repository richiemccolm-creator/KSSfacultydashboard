-- Admin and faculty head can update any staff profile display_name (Faculty Dashboard staff editor)
CREATE POLICY "Admin can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_emails
      WHERE email = (auth.jwt()->>'email')
        AND (is_admin = true OR role = 'faculty_head')
    )
  );
