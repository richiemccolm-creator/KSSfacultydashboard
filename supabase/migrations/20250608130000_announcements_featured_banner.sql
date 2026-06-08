-- Faculty Hub: optional full-width featured announcement banner on home screen

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS featured_banner boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.announcements.featured_banner IS
  'When true, show this announcement as a full-width banner under the home welcome section (only one should be active at a time).';
