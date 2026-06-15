-- Faculty Hub: track when announcements are edited for home-screen update pills

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.announcements
  SET updated_at = created_at
  WHERE updated_at IS NULL OR updated_at < created_at;

DROP TRIGGER IF EXISTS announcements_updated_at ON public.announcements;
CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON COLUMN public.announcements.updated_at IS
  'Last edit timestamp; shown on the Faculty Hub home announcement panel.';
