-- Calendar event requests: staff submit; faculty head/admin approve → shared_calendar_events

ALTER TABLE public.shared_calendar_events
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.allowed_emails
  ADD COLUMN IF NOT EXISTS role TEXT;

CREATE OR REPLACE FUNCTION public.is_school_manager()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  SELECT is_admin, role INTO r
  FROM public.allowed_emails
  WHERE email = (auth.jwt()->>'email')
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF COALESCE(r.is_admin, false) THEN
    RETURN true;
  END IF;
  IF lower(trim(COALESCE(r.role, ''))) = 'faculty_head' THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

-- Faculty head parity on shared calendar (matches app canManageSchool)
DROP POLICY IF EXISTS "Admin can insert shared calendar" ON public.shared_calendar_events;
DROP POLICY IF EXISTS "Admin can update shared calendar" ON public.shared_calendar_events;
DROP POLICY IF EXISTS "Admin can delete shared calendar" ON public.shared_calendar_events;

CREATE POLICY "School managers can insert shared calendar"
  ON public.shared_calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (public.is_school_manager());

CREATE POLICY "School managers can update shared calendar"
  ON public.shared_calendar_events FOR UPDATE
  TO authenticated
  USING (public.is_school_manager());

CREATE POLICY "School managers can delete shared calendar"
  ON public.shared_calendar_events FOR DELETE
  TO authenticated
  USING (public.is_school_manager());

CREATE TABLE IF NOT EXISTS public.calendar_event_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  end_date DATE,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejected_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  CONSTRAINT calendar_event_requests_dates_ok CHECK (
    end_date IS NULL OR end_date >= date
  )
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_requests_status
  ON public.calendar_event_requests (status, submitted_at);

CREATE INDEX IF NOT EXISTS idx_calendar_event_requests_requester
  ON public.calendar_event_requests (requester_id, status);

ALTER TABLE public.calendar_event_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters can view own calendar requests"
  ON public.calendar_event_requests FOR SELECT
  TO authenticated
  USING (requester_id = auth.uid() OR public.is_school_manager());

CREATE POLICY "Authenticated staff can submit calendar requests"
  ON public.calendar_event_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND status = 'pending'
  );

CREATE POLICY "Requesters can update own pending requests"
  ON public.calendar_event_requests FOR UPDATE
  TO authenticated
  USING (
    requester_id = auth.uid() AND status = 'pending'
  )
  WITH CHECK (
    requester_id = auth.uid() AND status = 'pending'
  );

CREATE POLICY "School managers can review calendar requests"
  ON public.calendar_event_requests FOR UPDATE
  TO authenticated
  USING (public.is_school_manager());

CREATE POLICY "Requesters can delete own pending calendar requests"
  ON public.calendar_event_requests FOR DELETE
  TO authenticated
  USING (requester_id = auth.uid() AND status = 'pending');

DROP TRIGGER IF EXISTS calendar_event_requests_updated_at ON public.calendar_event_requests;
CREATE TRIGGER calendar_event_requests_updated_at
  BEFORE UPDATE ON public.calendar_event_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.approve_calendar_event_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.calendar_event_requests%ROWTYPE;
  d DATE;
  end_d DATE;
  reviewer UUID;
BEGIN
  IF NOT public.is_school_manager() THEN
    RAISE EXCEPTION 'Not authorized to approve calendar requests';
  END IF;

  reviewer := auth.uid();
  SELECT * INTO req FROM public.calendar_event_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already reviewed';
  END IF;

  end_d := COALESCE(req.end_date, req.date);
  d := req.date;

  WHILE d <= end_d LOOP
    INSERT INTO public.shared_calendar_events (title, date, category, description)
    VALUES (
      req.title,
      d,
      req.category,
      NULLIF(trim(COALESCE(req.description, '')), '')
    );
    d := d + 1;
  END LOOP;

  UPDATE public.calendar_event_requests
  SET
    status = 'approved',
    reviewed_at = NOW(),
    reviewed_by = reviewer,
    updated_at = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('id', p_request_id, 'status', 'approved');
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_calendar_event_request(
  p_request_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reviewer UUID;
BEGIN
  IF NOT public.is_school_manager() THEN
    RAISE EXCEPTION 'Not authorized to reject calendar requests';
  END IF;

  reviewer := auth.uid();

  UPDATE public.calendar_event_requests
  SET
    status = 'rejected',
    rejected_reason = NULLIF(trim(COALESCE(p_reason, '')), ''),
    reviewed_at = NOW(),
    reviewed_by = reviewer,
    updated_at = NOW()
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already reviewed';
  END IF;

  RETURN jsonb_build_object('id', p_request_id, 'status', 'rejected');
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_calendar_event_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_calendar_event_request(UUID, TEXT) TO authenticated;
