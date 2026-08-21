-- Faculty Head / admin can permanently delete a procurement request in any status.
-- Spent and committed are derived from request rows, so deleting the request
-- (and its lines) reverses the budget effect. Annual pots are not touched.

CREATE OR REPLACE FUNCTION public.admin_delete_purchase_request(p_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_school_manager() THEN
    RAISE EXCEPTION 'Not allowed to permanently delete purchase requests';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request id is required';
  END IF;

  DELETE FROM public.purchase_request_lines
  WHERE request_id = p_request_id;

  DELETE FROM public.purchase_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_purchase_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_purchase_request(uuid) TO authenticated;
