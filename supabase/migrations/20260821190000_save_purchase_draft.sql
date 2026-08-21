-- Atomic draft save: metadata + line items, only while status is still draft.
-- SECURITY INVOKER so existing RLS still applies. The function also checks
-- authentication, ownership, and draft status before any line mutation.
-- A failed insert after delete rolls back; existing lines stay intact.

CREATE OR REPLACE FUNCTION public.save_purchase_draft(
  p_request_id uuid,
  p_academic_year text,
  p_subject_code text,
  p_notes text,
  p_budget_vote text,
  p_budget_vote_other text,
  p_lines jsonb
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
      budget_vote_other
    )
    VALUES (
      v_year,
      v_subject,
      v_uid,
      'draft',
      v_notes,
      v_vote,
      v_other
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

REVOKE ALL ON FUNCTION public.save_purchase_draft(uuid, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_purchase_draft(uuid, text, text, text, text, text, jsonb) TO authenticated;
