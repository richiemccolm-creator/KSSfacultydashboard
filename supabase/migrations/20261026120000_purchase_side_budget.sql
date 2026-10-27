-- Side budget: an order that sits outwith the subject budgets.
-- The requester (or the Faculty Head at approval) types which school budget
-- pays for it. It skips the subject budget check, never counts towards a
-- subject's spent/committed, and the Faculty Head records the Headteacher's
-- sign-off when approving.

ALTER TABLE public.purchase_requests
  ADD COLUMN IF NOT EXISTS side_budget boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS side_budget_source text,
  ADD COLUMN IF NOT EXISTS headteacher_approved_name text,
  ADD COLUMN IF NOT EXISTS headteacher_approved_at timestamptz;

ALTER TABLE public.purchase_requests
  DROP CONSTRAINT IF EXISTS purchase_requests_side_budget_source_check;
ALTER TABLE public.purchase_requests
  ADD CONSTRAINT purchase_requests_side_budget_source_check
  CHECK (
    NOT side_budget
    OR status = 'draft'
    OR nullif(trim(coalesce(side_budget_source, '')), '') IS NOT NULL
  );

-- Subject usage ignores side-budget orders.
CREATE OR REPLACE FUNCTION public.purchase_budget_usage(p_academic_year text, p_subject_code text, p_exclude_request_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(spent numeric, committed numeric)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    COALESCE((
      SELECT SUM(l.line_total)
      FROM public.purchase_request_lines l
      JOIN public.purchase_requests r ON r.id = l.request_id
      WHERE r.academic_year = p_academic_year
        AND r.subject_code = p_subject_code
        AND r.status = 'processed'
        AND NOT r.side_budget
        AND (p_exclude_request_id IS NULL OR r.id <> p_exclude_request_id)
    ), 0)::NUMERIC AS spent,
    COALESCE((
      SELECT SUM(l.line_total)
      FROM public.purchase_request_lines l
      JOIN public.purchase_requests r ON r.id = l.request_id
      WHERE r.academic_year = p_academic_year
        AND r.subject_code = p_subject_code
        AND r.status = 'approved'
        AND NOT r.side_budget
        AND (p_exclude_request_id IS NULL OR r.id <> p_exclude_request_id)
    ), 0)::NUMERIC AS committed;
$function$;

CREATE OR REPLACE FUNCTION public.purchase_dashboard_stats(p_academic_year text)
 RETURNS TABLE(subject_code text, budget_gbp numeric, spent_gbp numeric, committed_gbp numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    s.code::TEXT,
    COALESCE(b.amount_gbp, 0)::NUMERIC,
    COALESCE((
      SELECT SUM(l.line_total)
      FROM public.purchase_request_lines l
      JOIN public.purchase_requests r ON r.id = l.request_id
      WHERE r.academic_year = p_academic_year AND r.subject_code = s.code AND r.status = 'processed' AND NOT r.side_budget
    ), 0)::NUMERIC,
    COALESCE((
      SELECT SUM(l.line_total)
      FROM public.purchase_request_lines l
      JOIN public.purchase_requests r ON r.id = l.request_id
      WHERE r.academic_year = p_academic_year AND r.subject_code = s.code AND r.status = 'approved' AND NOT r.side_budget
    ), 0)::NUMERIC
  FROM (VALUES ('drama'), ('art_design'), ('photography')) AS s(code)
  LEFT JOIN public.purchase_budgets b ON b.academic_year = p_academic_year AND b.subject_code = s.code;
$function$;

-- Running totals for side-budget orders (no cap).
CREATE OR REPLACE FUNCTION public.purchase_side_budget_stats(p_academic_year text)
 RETURNS TABLE(spent_gbp numeric, committed_gbp numeric, pending_gbp numeric, order_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(SUM(l.line_total) FILTER (WHERE r.status = 'processed'), 0)::NUMERIC,
    COALESCE(SUM(l.line_total) FILTER (WHERE r.status = 'approved'), 0)::NUMERIC,
    COALESCE(SUM(l.line_total) FILTER (WHERE r.status = 'submitted'), 0)::NUMERIC,
    COUNT(DISTINCT r.id) FILTER (WHERE r.status IN ('submitted', 'approved', 'processed'))::INTEGER
  FROM public.purchase_requests r
  LEFT JOIN public.purchase_request_lines l ON l.request_id = r.id
  WHERE r.academic_year = p_academic_year AND r.side_budget;
$function$;

REVOKE ALL ON FUNCTION public.purchase_side_budget_stats(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_side_budget_stats(text) TO authenticated;

-- Approve: side-budget orders skip the subject check but need the
-- Headteacher's name. The Faculty Head can also move a submitted order onto
-- the side budget here (p_side_budget = true + p_side_budget_source).
DROP FUNCTION IF EXISTS public.approve_purchase_request(uuid);

CREATE OR REPLACE FUNCTION public.approve_purchase_request(
  p_request_id uuid,
  p_side_budget boolean DEFAULT NULL,
  p_side_budget_source text DEFAULT NULL,
  p_headteacher_name text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_can_manage BOOLEAN;
  v_req RECORD;
  v_side BOOLEAN;
  v_source TEXT;
  v_head TEXT := nullif(trim(coalesce(p_headteacher_name, '')), '');
  v_budget NUMERIC;
  v_total NUMERIC;
  v_spent NUMERIC;
  v_committed NUMERIC;
  v_year_prefix TEXT;
  v_prefix TEXT;
  v_next INT;
  v_po TEXT;
BEGIN
  v_can_manage := public.has_faculty_management_access();
  IF NOT v_can_manage THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req FROM public.purchase_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF v_req.status <> 'submitted' THEN
    RAISE EXCEPTION 'Request must be submitted to approve';
  END IF;

  v_side := COALESCE(p_side_budget, v_req.side_budget);
  v_source := CASE WHEN v_side
    THEN COALESCE(nullif(trim(coalesce(p_side_budget_source, '')), ''), nullif(trim(coalesce(v_req.side_budget_source, '')), ''))
    ELSE NULL END;

  v_total := public.purchase_request_total(p_request_id);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Request has no line items or zero total';
  END IF;

  IF v_side THEN
    IF v_source IS NULL THEN
      RAISE EXCEPTION 'Enter which school budget this side-budget order comes from.';
    END IF;
    IF v_head IS NULL THEN
      RAISE EXCEPTION 'Enter the name of the Headteacher who approved this side-budget order.';
    END IF;
  ELSE
    SELECT amount_gbp INTO v_budget FROM public.purchase_budgets
    WHERE academic_year = v_req.academic_year AND subject_code = v_req.subject_code;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No budget set for this year and subject';
    END IF;

    SELECT spent, committed INTO v_spent, v_committed
    FROM public.purchase_budget_usage(v_req.academic_year, v_req.subject_code, p_request_id);

    IF v_total > (v_budget - v_spent - v_committed) THEN
      RAISE EXCEPTION 'Insufficient budget: need %, available %', v_total, (v_budget - v_spent - v_committed);
    END IF;
  END IF;

  v_year_prefix := split_part(v_req.academic_year, '-', 1);
  v_prefix := public.purchase_subject_po_prefix(v_req.subject_code);

  SELECT COALESCE(MAX(split_part(po_number, '-', 4)::INT), 0) + 1 INTO v_next
  FROM public.purchase_requests
  WHERE academic_year = v_req.academic_year
    AND subject_code = v_req.subject_code
    AND po_number IS NOT NULL
    AND split_part(po_number, '-', 4) ~ '^[0-9]{4}$';

  v_po := format('PO-%s-%s-%s', v_year_prefix, v_prefix, lpad(v_next::TEXT, 4, '0'));

  UPDATE public.purchase_requests SET
    status = 'approved',
    approved_at = NOW(),
    approved_by = auth.uid(),
    po_number = v_po,
    rejected_reason = NULL,
    side_budget = v_side,
    side_budget_source = v_source,
    headteacher_approved_name = CASE WHEN v_side THEN v_head ELSE NULL END,
    headteacher_approved_at = CASE WHEN v_side THEN NOW() ELSE NULL END
  WHERE id = p_request_id;

  RETURN jsonb_build_object('ok', true, 'po_number', v_po);
END;
$function$;

REVOKE ALL ON FUNCTION public.approve_purchase_request(uuid, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_purchase_request(uuid, boolean, text, text) TO authenticated;

-- Draft save gains the side-budget fields.
DROP FUNCTION IF EXISTS public.save_purchase_draft(uuid, text, text, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.save_purchase_draft(
  p_request_id uuid,
  p_academic_year text,
  p_subject_code text,
  p_notes text,
  p_budget_vote text,
  p_budget_vote_other text,
  p_lines jsonb,
  p_side_budget boolean DEFAULT false,
  p_side_budget_source text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_status text;
  v_owner uuid;
  v_subject text := nullif(trim(coalesce(p_subject_code, '')), '');
  v_year text := nullif(trim(coalesce(p_academic_year, '')), '');
  v_vote text := nullif(trim(coalesce(p_budget_vote, '')), '');
  v_other text := null;
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_lines jsonb := coalesce(p_lines, '[]'::jsonb);
  v_side boolean := coalesce(p_side_budget, false);
  v_source text := null;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_subject IS NULL THEN
    RAISE EXCEPTION 'Select a subject for this purchase.';
  END IF;

  IF jsonb_typeof(v_lines) <> 'array' THEN
    RAISE EXCEPTION 'Line items must be an array';
  END IF;

  IF v_vote = 'other' THEN
    v_other := nullif(trim(coalesce(p_budget_vote_other, '')), '');
  END IF;

  IF v_side THEN
    v_source := nullif(trim(coalesce(p_side_budget_source, '')), '');
  END IF;

  IF p_request_id IS NULL THEN
    IF v_year IS NULL THEN
      RAISE EXCEPTION 'Academic year is required';
    END IF;

    INSERT INTO public.purchase_requests (
      academic_year,
      subject_code,
      requester_id,
      status,
      notes,
      budget_vote,
      budget_vote_other,
      side_budget,
      side_budget_source
    )
    VALUES (
      v_year,
      v_subject,
      v_uid,
      'draft',
      v_notes,
      v_vote,
      v_other,
      v_side,
      v_source
    )
    RETURNING id INTO v_id;
  ELSE
    SELECT id, status, requester_id
      INTO v_id, v_status, v_owner
    FROM public.purchase_requests
    WHERE id = p_request_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'PO_DRAFT_STALE: This request has changed and can no longer be edited. Close it and reopen to see the current state.';
    END IF;

    IF v_owner IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'Not allowed to edit this request';
    END IF;

    IF v_status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'PO_DRAFT_STALE: This request has changed and can no longer be edited. Close it and reopen to see the current state.';
    END IF;

    SELECT id INTO v_id
    FROM public.purchase_requests
    WHERE id = p_request_id AND status = 'draft'
    FOR UPDATE;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'PO_DRAFT_STALE: This request has changed and can no longer be edited. Close it and reopen to see the current state.';
    END IF;

    UPDATE public.purchase_requests
    SET
      subject_code = v_subject,
      notes = v_notes,
      budget_vote = v_vote,
      budget_vote_other = v_other,
      side_budget = v_side,
      side_budget_source = v_source,
      updated_at = now()
    WHERE id = v_id AND status = 'draft';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PO_DRAFT_STALE: This request has changed and can no longer be edited. Close it and reopen to see the current state.';
    END IF;

    DELETE FROM public.purchase_request_lines
    WHERE request_id = v_id;
  END IF;

  INSERT INTO public.purchase_request_lines (
    request_id,
    product_code,
    description,
    unit_price,
    quantity,
    sort_order
  )
  SELECT
    v_id,
    coalesce(nullif(trim(elem->>'product_code'), ''), ''),
    coalesce(nullif(trim(elem->>'description'), ''), ''),
    coalesce(nullif(elem->>'unit_price', ''), '0')::numeric,
    coalesce(nullif(elem->>'quantity', ''), '1')::numeric,
    (ord - 1)::integer
  FROM jsonb_array_elements(v_lines) WITH ORDINALITY AS t(elem, ord);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_purchase_draft(uuid, text, text, text, text, text, jsonb, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_purchase_draft(uuid, text, text, text, text, text, jsonb, boolean, text) TO authenticated;
