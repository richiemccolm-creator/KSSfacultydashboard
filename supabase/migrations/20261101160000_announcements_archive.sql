-- Faculty Head Hub: archive announcements that are done.
-- status = 'archived' is set when the faculty head takes a post down or
-- archives a draft. Archived posts stay listed under Archive on the
-- Announcements page, where they can be reposted, moved back to drafts or
-- deleted. Staff never see them: the read policy from the drafts migration
-- only shows published posts to staff.

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_status_check;
ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_status_check CHECK (status IN ('draft', 'published', 'archived'));

COMMENT ON COLUMN public.announcements.status IS
  'draft = only faculty heads/admins can see it; published = staff see it from publish_at; archived = taken down, kept for reference.';
