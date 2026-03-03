-- Add failed production tracking: parts_failed on jobs, new update_type, and atomic RPC.

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS parts_failed integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.jobs.parts_failed IS 'Number of parts that failed production; tracked separately from produced/delivered.';

-- Extend job_updates.update_type to allow 'failed_production'
ALTER TABLE public.job_updates
DROP CONSTRAINT IF EXISTS job_updates_update_type_check;

ALTER TABLE public.job_updates
ADD CONSTRAINT job_updates_update_type_check
CHECK (update_type IN ('production', 'delivery', 'failed_production'));

-- Atomic RPC: add failed production and insert history row
CREATE OR REPLACE FUNCTION public.add_failed_production(
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
  SET parts_failed = parts_failed + p_delta, updated_at = p_created_at
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;

  INSERT INTO public.job_updates (job_id, delta, update_type, updated_by, created_at)
  VALUES (p_job_id, p_delta, 'failed_production', p_updated_by, p_created_at)
  RETURNING * INTO rec;

  inserted_row := row_to_json(rec);
  RETURN inserted_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_failed_production(uuid, integer, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_failed_production(uuid, integer, uuid, timestamptz) TO service_role;
