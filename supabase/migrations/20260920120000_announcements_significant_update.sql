-- Faculty Hub: significant-update alert on the home masthead banner.
-- Separate from updated_at, which changes on every edit (typos, pinning).

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS significant_update_at TIMESTAMPTZ NULL;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS update_note TEXT NULL;

COMMENT ON COLUMN public.announcements.significant_update_at IS
  'Set only when an edit is flagged as a significant update; drives the home-banner alert for staff who already read the previous version.';

COMMENT ON COLUMN public.announcements.update_note IS
  'Optional one-line summary of what changed, shown on the significant-update alert strip.';
