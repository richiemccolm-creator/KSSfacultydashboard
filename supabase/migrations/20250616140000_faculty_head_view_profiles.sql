-- Faculty head can view all profiles (parity with school managers for staff lists and tracking)
CREATE POLICY "Faculty head can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.allowed_emails
      WHERE email = (auth.jwt()->>'email')
        AND role = 'faculty_head'
    )
  );
