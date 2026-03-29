-- Atomic RPC: add production and insert history row in one transaction.
CREATE OR REPLACE FUNCTION public.add_production(
  p_job_id uuid,
  p_delta integer,
  p_updated_by uuid,
  p_created_at timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  inserted_row json;
BEGIN
  IF p_delta <= 0 THEN
    RAISE EXCEPTION 'Delta must be positive: %', p_delta;
  END IF;

  UPDATE public.jobs
  SET
    parts_produced = LEAST(
      parts_needed,
      parts_produced + COALESCE(parts_overproduced, 0) + p_delta
    ),
    parts_overproduced = GREATEST(
      0,
      parts_produced + COALESCE(parts_overproduced, 0) + p_delta - parts_needed
    ),
    status = CASE
      WHEN archived THEN 'archived'
      WHEN LEAST(
        parts_needed,
        parts_produced + COALESCE(parts_overproduced, 0) + p_delta
      ) >= parts_needed THEN 'completed'
      ELSE 'active'
    END,
    updated_at = p_created_at
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;

  INSERT INTO public.job_updates (job_id, delta, update_type, updated_by, created_at)
  VALUES (p_job_id, p_delta, 'production', p_updated_by, p_created_at)
  RETURNING * INTO rec;

  inserted_row := row_to_json(rec);
  RETURN inserted_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_production(uuid, integer, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_production(uuid, integer, uuid, timestamptz) TO service_role;
